import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startLocal, AcademyBridge, validateOrigin } from "../bridge.mjs";

test("desktop local workflow: permissions, link reauthorization, persistence, submission and export", async () => {
  const directory = await mkdtemp(join(tmpdir(), "academy-desktop-"));
  let local = await startLocal(directory,{legacyFixture:true});
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
    await bridge.logout();
    await bridge.login({ username: "student", password: "student" });
    const student = await bridge.request(`/v1/subjects/${id}`);
    assert.equal(student.items.length, 3);
    await assert.rejects(
      bridge.request(`/v1/subjects/${id}/items`, {
        method: "POST",
        body: { kind: "material", title: "Forbidden", body: "no" },
      }),
      /Subject unavailable/,
    );
    await bridge.request(`/v1/items/${ref.id}/complete`, {
      method: "POST",
      body: { completed: true },
    });
    const activity = student.items.find((i) => i.kind === "activity");
    await bridge.request(`/v1/items/${activity.id}/submission`, {
      method: "POST",
      body: { output: "The four forces balance during steady level flight." },
      key: crypto.randomUUID(),
    });
    await bridge.logout();
    await bridge.login({ username: "instructor", password: "instructor" });
    const learners = await bridge.request(`/v1/subjects/${id}/learners`);
    assert.equal(learners.learners[0].summary.submitted, 1);
    assert.equal(learners.learners[0].summary.read, 1);
    const report = await bridge.exportReport(id);
    assert.equal(report.subarray(0, 2).toString(), "PK");
    await bridge.logout();
    await local.academy.close();
    local = await startLocal(directory,{legacyFixture:true});
    bridge = new AcademyBridge(local);
    await bridge.login({ username: "student", password: "student" });
    const after = await bridge.request(`/v1/subjects/${id}`);
    assert.ok(after.items.find((i) => i.id === ref.id).completed);
    assert.ok(after.items.find((i) => i.id === activity.id).submission);
    await bridge.logout();
    await bridge.login({ username: "admin", password: "admin" });
    assert.equal(
      (await bridge.request("/v1/admin/accounts")).accounts.length,
      3,
    );
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
    // Reject non-image bytes; accept valid PNG and bind to a rich entry.
    await assert.rejects(bridge.uploadImage(subject.id, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), /Unsupported image/);
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

    // Local demo account can update its password using its sign-in alias password.
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
test("organization sign-in never maps demo credentials or forwards the local access key", async () => {
  const seen = [];
  const bridge = new AcademyBridge(
    { origin: "http://127.0.0.1:1234", accessKey: "local-only" },
    {
      fetcher: async (url, options) => {
        seen.push({ url, options });
        return new Response(
          JSON.stringify({
            token: "synthetic",
            account: { id: "user", role: "instructor" },
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
  for (const origin of [
    "http://school.edu",
    "https://user:pass@school.edu",
    "https://school.edu/path",
    "https://school.edu/?q=1",
  ])
    assert.throws(() => validateOrigin(origin));
});

test("subject QR is owner-authorized and contains only the Android subject identifier", async () => {
  const directory = await mkdtemp(join(tmpdir(), "academy-qr-"));
  const local = await startLocal(directory,{legacyFixture:true});
  const bridge = new AcademyBridge(local);
  try {
    await assert.rejects(bridge.subjectQr("../../etc"), /valid subject/);
    await bridge.login({username:"instructor", password:"instructor"});
    const {subjects} = await bridge.request("/v1/subjects");
    const subject = subjects[0];
    const qr = await bridge.subjectQr(subject.id);
    assert.equal(qr.payload, `aoa://subject/${subject.id}`);
    assert.equal(Buffer.from(qr.image.split(",")[1],"base64").toString(),qr.svg);
    assert.match(qr.svg, /<svg/);
    assert.ok(!qr.svg.includes(subject.title));
    await bridge.logout();
    await bridge.login({username:"student",password:"student"});
    await assert.rejects(bridge.subjectQr(subject.id), /Only the subject instructor/);
    const {items} = await bridge.request(`/v1/subjects/${subject.id}`);
    assert.ok(items.every((item) => item.correct_index === undefined));
    await bridge.logout();
    await assert.rejects(bridge.subjectQr(subject.id), /Sign in/);
    await bridge.login({username:"admin",password:"admin"});
    assert.equal((await bridge.subjectQr(subject.id)).payload, qr.payload);
    const detail = await bridge.request(`/v1/subjects/${subject.id}`);
    await bridge.request(`/v1/subjects/${subject.id}/archive`,{method:"POST",body:{
      confirm_delete:true, expected_title:subject.title, expected_description:subject.description,
      expected_order_revision:detail.subject.order_revision, expected_eligibility_revision:detail.subject.eligibility_revision,
      expected_items:detail.items.map((item) => ({id:item.id,edit_version:item.edit_version})),
    }});
    await assert.rejects(bridge.subjectQr(subject.id), /unavailable/i);
  } finally {
    await bridge.logout(); await local.academy.close();
    await rm(directory,{recursive:true,force:true});
  }
});
