import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startLocal, AcademyBridge } from "../bridge.mjs";
import {
  buildExportFilename,
  buildExportPackage,
  parseAndValidateImport,
  importPackage,
} from "../transfer.mjs";

const PNG_1X1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2dIAAAAASUVORK5CYII=";

test("export filenames include Windows-safe title slug and exact creation date & time", () => {
  const fixed = new Date(2026, 10, 24, 14, 5, 9);
  assert.equal(
    buildExportFilename({ scope: "subject", title: 'AE 101: Lift / Drag * "Lab"', createdAt: fixed }),
    "AE-101-Lift-Drag-Lab_2026-11-24_14-05-09.aoa.json",
  );
  assert.equal(
    buildExportFilename({ scope: "repository", createdAt: fixed }),
    "Aeronautical-Academy-Repository_2026-11-24_14-05-09.aoa.json",
  );
});

test("export/import preserves multi-level entries, rich HTML, spacing, pasted images, folders, quizzes, schedules, and blocks read-only export or tampered files", async () => {
  const srcDir = await mkdtemp(join(tmpdir(), "academy-transfer-src-"));
  const dstDir = await mkdtemp(join(tmpdir(), "academy-transfer-dst-"));
  const srcLocal = await startLocal(srcDir, { legacyFixture: true });
  const dstLocal = await startLocal(dstDir, { legacyFixture: true });
  try {
    const admin = new AcademyBridge(srcLocal);
    await admin.login({ mode: "local", username: "admin", password: "admin" });

    // Create nested folder Year 1 / Aerodynamics
    const rootFolder = (await admin.request("/v1/admin/folders", { method: "POST", body: { name: "Year 1" } })).folder;
    const subFolder = (await admin.request("/v1/admin/folders", { method: "POST", body: { name: "Aerodynamics", parent_id: rootFolder.id } })).folder;

    // Create subject inside nested folder
    const createdSubj = await admin.request("/v1/subjects", {
      method: "POST",
      body: { title: "Aerodynamics Lab", description: "Wind tunnel notes and assessments." },
    });
    await admin.request(`/v1/admin/subjects/${createdSubj.id}/folder`, {
      method: "POST",
      body: { folder_id: subFolder.id },
    });

    // Upload pasted PNG image and create rich-HTML root material with relaxed spacing
    const uploadedImg = (await admin.uploadImage(createdSubj.id, Buffer.from(PNG_1X1_BASE64, "base64"))).image;
    const rootMat = await admin.request(`/v1/subjects/${createdSubj.id}/items`, {
      method: "POST",
      body: {
        kind: "material",
        material_mode: "text",
        title: "Lesson 1 — Bernoulli",
        body: "Pressure decreases as velocity increases.",
        body_html: `<h2>Bernoulli</h2><p data-indent="1">Pressure decreases as velocity increases.</p><figure><img data-img="${uploadedImg.id}" alt="diagram"></figure>`,
        paragraph_spacing: "relaxed",
        published: true,
      },
    });
    // Level 2 nested material + Level 3 nested quiz
    const subMat = await admin.request(`/v1/subjects/${createdSubj.id}/items`, {
      method: "POST",
      body: {
        kind: "material",
        material_mode: "text",
        title: "Sub-module 1.1 — Lab Setup",
        body: "Calibrate pitot static tube.",
        paragraph_spacing: "loose",
        published: true,
        parent_id: rootMat.id,
      },
    });
    const quiz = await admin.request(`/v1/subjects/${createdSubj.id}/items`, {
      method: "POST",
      body: {
        kind: "quiz",
        title: "Quick Check",
        body: "Verify lift concepts.",
        published: true,
        parent_id: subMat.id,
        questions: [
          { prompt: "Which force opposes weight?", options: ["Drag", "Lift", "Thrust"], correct_index: 1 },
        ],
      },
    });
    const dueAt = Date.now() + 86400000;
    await admin.request(`/v1/items/${quiz.id}/schedule`, {
      method: "POST",
      body: { expected_edit_version: 1, publish_at: null, due_at: dueAt, published: true },
    });

    // Grant read-only instructor access and verify read-only export is rejected (403)
    const accounts = (await admin.request("/v1/admin/accounts")).accounts;
    const instAcc = accounts.find((a) => a.role === "instructor");
    await admin.request(`/v1/admin/subjects/${createdSubj.id}/instructors`, {
      method: "POST",
      body: { instructor_id: instAcc.id, access_level: "read_only", status: "active" },
    });
    const roInst = new AcademyBridge(srcLocal);
    await roInst.login({ mode: "local", username: "instructor", password: "instructor" });
    await assert.rejects(
      buildExportPackage(roInst, { scope: "subject", subjectId: createdSubj.id }),
      (err) => err.status === 403 && /read-only/i.test(err.message),
    );
    await roInst.logout();

    // Admin exports single subject package
    const exported = await buildExportPackage(admin, {
      scope: "subject",
      subjectId: createdSubj.id,
      appVersion: "0.13.0-rc.2",
    });
    assert.match(exported.filename, /^Aerodynamics-Lab_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.aoa\.json$/);
    assert.equal(exported.summary.subjectCount, 1);
    assert.equal(exported.summary.itemCount, 3);
    assert.equal(exported.summary.imageCount, 1);

    // Tampered package must be rejected
    const tampered = JSON.parse(exported.json);
    tampered.subjects[0].title = "Tampered Subject";
    assert.throws(
      () => parseAndValidateImport(JSON.stringify(tampered), exported.filename),
      /integrity check failed/i,
    );

    // Validated parse + import into destination workspace
    const { payload, summary } = parseAndValidateImport(exported.json, exported.filename);
    assert.equal(summary.subjectTitles[0], "Aerodynamics Lab");

    const dstAdmin = new AcademyBridge(dstLocal);
    await dstAdmin.login({ mode: "local", username: "admin", password: "admin" });
    const imported = await importPackage(dstAdmin, payload);
    assert.equal(imported.importedSubjects.length, 1);
    assert.equal(imported.totalItems, 3);
    assert.equal(imported.totalImages, 1);
    assert.equal(imported.createdFolders, 2);

    const dstListing = await dstAdmin.request("/v1/subjects");
    const newSubj = dstListing.subjects.find((s) => s.id === imported.importedSubjects[0].id);
    assert.ok(newSubj);
    assert.ok(newSubj.folder_id);
    const dstSubFolder = dstListing.folders.find((f) => f.id === newSubj.folder_id);
    assert.equal(dstSubFolder?.name, "Aerodynamics");
    const dstRootFolder = dstListing.folders.find((f) => f.id === dstSubFolder.parent_id);
    assert.equal(dstRootFolder?.name, "Year 1");

    const dstDetail = await dstAdmin.request(`/v1/subjects/${newSubj.id}`);
    assert.equal(dstDetail.items.length, 3);
    const [impMat, impSubMat, impQuiz] = dstDetail.items;
    assert.equal(impMat.paragraph_spacing, "relaxed");
    assert.match(impMat.body_html, /data-img="[a-f0-9-]{36}"/);
    const newImgId = impMat.body_html.match(/data-img="([a-f0-9-]{36})"/)[1];
    assert.notEqual(newImgId, uploadedImg.id);
    const readBack = await dstAdmin.readImage({ subjectId: newSubj.id, itemId: impMat.id, imageId: newImgId });
    assert.equal(readBack.dataUrl, `data:image/png;base64,${PNG_1X1_BASE64}`);
    assert.equal(impSubMat.parent_id, impMat.id);
    assert.equal(impSubMat.paragraph_spacing, "loose");
    assert.equal(impQuiz.parent_id, impSubMat.id);
    assert.equal(impQuiz.questions[0].correct_index, 1);
    assert.equal(impQuiz.due_at, dueAt);

    await admin.logout();
    await dstAdmin.logout();
  } finally {
    await srcLocal.academy.close();
    await dstLocal.academy.close();
    await rm(srcDir, { recursive: true, force: true });
    await rm(dstDir, { recursive: true, force: true });
  }
});
