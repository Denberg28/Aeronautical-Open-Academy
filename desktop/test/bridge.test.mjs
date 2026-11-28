import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startLocal, AcademyBridge, validateOrigin } from "../bridge.mjs";

test("desktop local workflow: admin/instructor permissions, link reauthorization, student blocking and persistence", async () => {
  const directory = await mkdtemp(join(tmpdir(), "academy-desktop-"));
  let local = await startLocal(directory, { legacyFixture: true });
  const opened = [];
  let bridge = new AcademyBridge(local, {
    openExternal: async (url) => opened.push(url),
  });
  try {
    assert.equal((await fetch(local.origin + "/v1/subjects")).status, 403);
    await assert.rejects(bridge.request("/v1/subjects"), /Sign in/);
    const instructor = await bridge.login({
      username: "instructor",
      password: "instructor",
    });
    assert.equal(instructor.account.role, "instructor");
    assert.equal(instructor.token, undefined);
    const subjects = await bridge.request("/v1/subjects");
    const id = subjects.subjects[0].id;
    const item = await bridge.request(`/v1/subjects/${id}/items`, {
      method: "POST",
      body: {
        kind: "material",
        material_mode: "text",
        title: "A test reference",
        body: "A test reference\nhttps://www.nasa.gov/",
        published: true,
      },
    });
    const detail = await bridge.request(`/v1/subjects/${id}`);
    const ref = detail.items.find((i) => i.id === item.id);
    await bridge.openLink({
      id: ref.id,
      revision: ref.revision,
      url: "https://www.nasa.gov/",
    });
    assert.equal(opened.length, 1);
    await assert.rejects(
      bridge.openLink({
        id: ref.id,
        revision: ref.revision,
        url: "https://evil.com/",
      }),
      /changed/,
    );
    await assert.rejects(bridge.request("/v1/admin/accounts"), /Administrator/);
    await assert.rejects(bridge.request("/v1/../health"), /Invalid/);
    await assert.rejects(bridge.request("//evil.com/v1/subjects"), /Invalid/);
    // Student-only routes are blocked at the desktop bridge boundary.
    await assert.rejects(bridge.request(`/v1/subjects/${id}/learners`), /Student features are not available/);
    await assert.rejects(bridge.request(`/v1/subjects/${id}/eligibility`), /Student features are not available/);
    await assert.rejects(bridge.request("/v1/subjects/discover"), /Student features are not available/);
    await assert.rejects(bridge.request(`/v1/items/${ref.id}/complete`, { method: "POST", body: { completed: true } }), /Student features are not available/);
    await bridge.logout();

    // Fresh local workspace seeds only admin and instructor (no student account).
    await bridge.login({ username: "admin", password: "admin" });
    const accounts = (await bridge.request("/v1/admin/accounts")).accounts;
    assert.equal(accounts.length, 2);
    assert.deepEqual(accounts.map((a) => a.role).sort(), ["admin", "instructor"]);

    // Even if a student account exists on a shared/upgraded backend, desktop login rejects it with 403.
    const studentPass = "Student Account Desktop Block 2026!";
    await bridge.request("/v1/admin/accounts", {
      method: "POST",
      body: { name: "Blocked Student", email: "blocked-student@academy.test", role: "student", password: studentPass },
    });
    await bridge.logout();
    await assert.rejects(
      bridge.login({ username: "blocked-student@academy.test", password: studentPass }),
      (err) => err.status === 403 && /administrators and instructors only/i.test(err.message),
    );
    assert.equal(bridge.token, "");
    assert.equal(bridge.account, null);

    // Restart preserves created materials cleanly.
    await local.academy.close();
    local = await startLocal(directory, { legacyFixture: true });
    bridge = new AcademyBridge(local);
    await bridge.login({ username: "instructor", password: "instructor" });
    const after = await bridge.request(`/v1/subjects/${id}`);
    assert.ok(after.items.some((i) => i.id === ref.id));
  } finally {
    await bridge.logout();
    await local.academy.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("bridge supports local account password update and authenticated pasted image roundtrip", async () => {
  const directory = await mkdtemp(join(tmpdir(), "academy-bridge-v15-"));
  const local = await startLocal(directory, { legacyFixture: true });
  const bridge = new AcademyBridge(local);
  const tinyPng = Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082",
    "hex",
  );
  try {
    await bridge.login({ username: "instructor", password: "instructor" });
    const subject = (await bridge.request("/v1/subjects")).subjects[0];
    await assert.rejects(
      bridge.uploadImage(subject.id, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')),
      /Unsupported image/,
    );
    const uploaded = await bridge.uploadImage(subject.id, tinyPng);
    assert.ok(uploaded.dataUrl.startsWith("data:image/png;base64,"));
    const created = await bridge.request(`/v1/subjects/${subject.id}/items`, {
      method: "POST",
      body: {
        kind: "material",
        material_mode: "text",
        title: "Diagram note",
        body: "Diagram note\n[Image: Diagram]",
        body_html: `<p data-indent="1"><strong>Diagram</strong></p><figure data-img="${uploaded.image.id}"><img data-img="${uploaded.image.id}" alt="Diagram"></figure>`,
        paragraph_spacing: "relaxed",
        published: true,
      },
    });
    const read = await bridge.readImage({ itemId: created.id, imageId: uploaded.image.id });
    assert.equal(read.dataUrl, uploaded.dataUrl);

    const nextPass = "My Updated Local Instructor Password 2026!";
    await bridge.request("/v1/auth/password", {
      method: "POST",
      body: { current_password: "instructor", new_password: nextPass },
    });
    await assert.rejects(bridge.login({ username: "instructor", password: "instructor" }));
    const loggedIn = await bridge.login({ username: "instructor", password: nextPass });
    assert.equal(loggedIn.account.role, "instructor");
  } finally {
    await bridge.logout();
    await local.academy.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("organization sign-in never maps demo credentials, rejects student accounts, and validates origins", async () => {
  const seen = [];
  const bridge = new AcademyBridge(
    { origin: "http://127.0.0.1:1234", accessKey: "local-only" },
    {
      fetcher: async (url, options) => {
        seen.push({ url, options });
        const body = options.body ? JSON.parse(options.body) : {};
        const role = body.email === "student@school.edu" ? "student" : "instructor";
        return new Response(
          JSON.stringify({
            token: "synthetic",
            account: { id: "user", role },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  );
  await bridge.login({
    mode: "organization",
    origin: "https://academy.school.edu",
    username: "instructor",
    password: "instructor",
  });
  assert.equal(seen[0].options.headers["X-Academy-Desktop"], undefined);
  assert.equal(JSON.parse(seen[0].options.body).password, "instructor");
  assert.equal(seen[0].options.redirect, "error");

  await assert.rejects(
    bridge.login({
      mode: "organization",
      origin: "https://academy.school.edu",
      username: "student@school.edu",
      password: "valid-student-password",
    }),
    (err) => err.status === 403 && /administrators and instructors only/i.test(err.message),
  );
  assert.equal(bridge.token, "");

  for (const origin of [
    "http://school.edu",
    "https://user:pass@school.edu",
    "https://school.edu/path",
    "https://school.edu/?q=1",
  ])
    assert.throws(() => validateOrigin(origin));
});
