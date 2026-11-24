import { _electron } from "playwright";
import assert from "node:assert/strict";
import { mkdtemp, rm, readdir, readFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PNG_1X1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2dIAAAAASUVORK5CYII=";
const saveShots = process.env.ACADEMY_QA_SHOTS === "1";
const shotDir = fileURLToPath(new URL("../../out/desktop-qa/", import.meta.url));
if (saveShots) await mkdir(shotDir, { recursive: true });

const directory = await mkdtemp(join(tmpdir(), "academy-transfer-ui-"));
let application;
try {
  application = await _electron.launch({
    args: [
      resolve(import.meta.dirname, ".."),
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
    ],
    env: { ...process.env, ACADEMY_TEST_LEGACY_SEED: "1", ACADEMY_TEST_DATA: directory },
    timeout: 30000,
  });
  const page = await application.firstWindow();
  page.on("dialog", (d) => void d.dismiss().catch(() => {}));
  page.setDefaultTimeout(15000);
  await application.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1480, 960),
  );
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  const login = async (role) => {
    await page.locator(`[data-demo="${role}"]`).click();
    await page.locator("#login-form button[type=submit]").click();
    await page.waitForSelector("#app:not([hidden]) .center");
    await page.waitForFunction(() => !document.body.classList.contains("working"));
  };
  const waitIdle = async () => {
    await page.waitForFunction(() => !document.body.classList.contains("working"));
  };

  await login("admin");

  // 1. Author a rich-content entry with Relaxed (18px) paragraph spacing and pasted PNG snip.
  await page.locator('[data-action="add"][data-parent=""]').first().click();
  await waitIdle();
  // Verify WYSIWYG editor font size matches standardized 16px reading standard.
  const editorFontSize = await page.locator("#rich-editor").evaluate((el) => getComputedStyle(el).fontSize);
  assert.equal(editorFontSize, "16px");

  await page.locator("#composer input[name=title]").fill("Transfer Standard Lesson");
  await page.selectOption('#composer select[name="paragraph_spacing"]', "relaxed");
  await page.evaluate((b64) => {
    const editor = document.querySelector("#rich-editor");
    editor.focus();
    editor.innerHTML = "<p>First standardized paragraph.</p><p>Second standardized paragraph.</p>";
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const file = new File([bytes], "diagram.png", { type: "image/png" });
    const dt = new DataTransfer();
    dt.items.add(file);
    editor.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, PNG_1X1_BASE64);
  await page.locator("#rich-editor .entry-figure img").waitFor();
  await page.locator("#composer button[type=submit]").click();
  await waitIdle();

  // Verify rendered paragraph spacing actually honors Relaxed (18px) on <p> tags.
  const transferCard = page.locator("article.material").filter({
    has: page.getByRole("heading", { name: "Transfer Standard Lesson", exact: true }),
  });
  await transferCard.waitFor();
  const paraGap = await transferCard.locator(".reading-copy p").first().evaluate((el) => getComputedStyle(el).marginBottom);
  assert.equal(paraGap, "18px");

  // 2. Export active subject -> verify timestamped creation filename on disk and valid SHA-256 package.
  await page.locator('[data-action="export-subject"]').click();
  await waitIdle();
  const exportFiles = (await readdir(directory)).filter((f) => f.endsWith(".aoa.json"));
  assert.equal(exportFiles.length, 1);
  assert.match(
    exportFiles[0],
    /^Introduction-to-Aeronautics_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.aoa\.json$/,
  );
  const exportedRaw = JSON.parse(await readFile(join(directory, exportFiles[0]), "utf8"));
  assert.equal(exportedRaw.format, "aoa-export-v1");
  assert.match(exportedRaw.integrity.sha256, /^[a-f0-9]{64}$/);
  assert.ok(exportedRaw.created_at_local);

  // 3. Visit My subjects and Settings -> verify standardized Export/Import UI & capture screenshots.
  await page.locator('[data-action="subjects"]').first().click();
  await waitIdle();
  await page.locator('[data-action="import-package"]').waitFor();
  await page.locator('[data-action="export-repository"]').waitFor();
  if (saveShots) {
    await page.screenshot({ path: join(shotDir, "14-my-subjects-transfer.png"), fullPage: true });
  }

  await page.getByText("MORE", { exact: true }).click();
  await page.locator('[data-action="settings"]').first().click();
  await waitIdle();
  await page.locator("#transfer-card").waitFor();
  if (saveShots) {
    await page.screenshot({ path: join(shotDir, "15-settings-transfer.png"), fullPage: true });
  }

  // 4. Import the exported package via UI confirmation dialog -> verify new subject + rich content + image + spacing.
  const beforeCount = await page.evaluate(() => state.subjects.length);
  await page.locator('#transfer-card [data-action="import-package"]').click();
  await page.locator("#confirm[open]").waitFor();
  const confirmText = await page.locator("#confirm").textContent();
  assert.ok(confirmText.includes(exportFiles[0]));
  assert.ok(confirmText.includes("Created"));
  await page.locator("#confirm-yes").click();
  await waitIdle();

  const afterCount = await page.evaluate(() => state.subjects.length);
  assert.equal(afterCount, beforeCount + 1);
  const importedCard = page.locator("article.material").filter({
    has: page.getByRole("heading", { name: "Transfer Standard Lesson", exact: true }),
  });
  await importedCard.waitFor();
  await importedCard.locator(".entry-figure img").waitFor();
  const importedGap = await importedCard.locator(".reading-copy p").first().evaluate((el) => getComputedStyle(el).marginBottom);
  assert.equal(importedGap, "18px");

  // 5. Verify compact 1060px layout has zero horizontal overflow with Export/Edit hero actions.
  await application.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1060, 720),
  );
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
  console.log(
    "PASS: subject/repository export with creation date-time filename, SHA-256 validated import with confirmation preview, preserved 18px paragraph spacing/images, WYSIWYG 16px editor, and zero overflow.",
  );
} finally {
  await application?.windows()[0]?.evaluate(() => { state.dirty = false; }).catch(() => {});
  await application?.close();
  await rm(directory, { recursive: true, force: true });
}
