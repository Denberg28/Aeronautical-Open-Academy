import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startLocal, AcademyBridge, validateOrigin } from "../bridge.mjs";

test("desktop local workflow: permissions, link reauthorization, persistence, submission and export", async () => {
  const directory = await mkdtemp(join(tmpdir(), "academy-desktop-"));
  let local = await startLocal(directory);
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
    local = await startLocal(directory);
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
