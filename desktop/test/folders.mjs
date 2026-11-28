import { _electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const directory = await mkdtemp(join(tmpdir(), 'academy-folders-ui-'));
const shotsDir = process.env.ACADEMY_QA_SHOTS ? resolve(import.meta.dirname, '../../out/desktop-qa') : '';
if (shotsDir) await mkdir(shotsDir, { recursive: true });
let application;

try {
  application = await _electron.launch({
    args: [resolve(import.meta.dirname, '..'), '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    env: { ...process.env, ACADEMY_TEST_DATA: directory },
    timeout: 30000,
  });
  const page = await application.firstWindow();
  page.on('dialog', (dialog) => { void dialog.dismiss().catch(() => {}); });
  page.setDefaultTimeout(15000);
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1480, 960));
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  const idle = () => page.waitForFunction(() => !document.body.classList.contains('working'));
  const loginDemo = async (role) => {
    await page.waitForSelector('#signin[open]');
    await page.locator(`[data-demo="${role}"]`).click();
    await page.locator('#login-form button[type=submit]').click();
    await page.waitForSelector('#app:not([hidden]) .center');
    await idle();
  };
  const logout = async () => {
    await page.locator('[data-action="logout"]').click();
    await page.waitForSelector('#signin[open]');
    await idle();
  };
  const createFolder = async (name, parentLabel = '') => {
    await page.locator('[data-action="new-folder"]').click();
    await page.locator('#folder-form [name=name]').fill(name);
    if (parentLabel) {
      await page.locator('#folder-form select[name=parent_id]').selectOption({ label: parentLabel });
    }
    await page.locator('#folder-form button[type=submit]').click();
    await idle();
  };
  const htmlDrag = async (sourceLocator, targetLocator, positionRatio = 0.5) => {
    const src = await sourceLocator.boundingBox();
    const dst = await targetLocator.boundingBox();
    assert.ok(src && dst, 'Drag source and target must be visible');
    const sx = src.x + src.width / 2;
    const sy = src.y + src.height / 2;
    const tx = dst.x + dst.width / 2;
    const ty = dst.y + dst.height * positionRatio;
    await page.evaluate(({ sx, sy, tx, ty }) => {
      const from = document.elementFromPoint(sx, sy)?.closest('[draggable="true"]');
      const to = document.elementFromPoint(tx, ty)?.closest('[data-folder-drop]');
      if (!from || !to) throw new Error('Missing drag endpoints');
      const dt = new DataTransfer();
      from.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: sx, clientY: sy }));
      to.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: tx, clientY: ty }));
      to.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: tx, clientY: ty }));
      from.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: tx, clientY: ty }));
    }, { sx, sy, tx, ty });
    await idle();
  };

  // 1. Admin creates top-level folders and a subfolder in the left pane.
  await loginDemo('admin');
  await createFolder('Year 1');
  await createFolder('Year 2');
  await createFolder('Aerodynamics', 'Year 1');

  const folderRow = (name) => page.locator('.nav-folder-row', { hasText: name }).first();
  const folderNode = (name) => page.locator('.nav-folder', { has: page.locator('> .nav-folder-row .nav-folder-name', { hasText: name }) }).first();
  const subjectBtn = page.locator('#subject-nav [data-action="subject"]').first();

  // 2. Drag subject into nested subfolder "Aerodynamics".
  await htmlDrag(subjectBtn, folderRow('Aerodynamics'), 0.5);
  assert.equal(await folderNode('Aerodynamics').locator('[data-action="subject"]').count(), 1);
  assert.equal(await folderRow('Aerodynamics').locator('.nav-folder-count').textContent(), '1');
  assert.equal(await folderRow('Year 1').locator('.nav-folder-count').textContent(), '1');
  if (shotsDir) await page.screenshot({ path: join(shotsDir, '05-admin-folders.png') });

  // 3. Reorder folder "Year 2" BEFORE "Year 1" in the left pane (top edge drop).
  await htmlDrag(folderRow('Year 2'), folderRow('Year 1'), 0.1);
  const topNames = await page.locator('#subject-nav > .nav-folder > .nav-folder-row .nav-folder-name').allTextContents();
  assert.deepEqual(topNames, ['Year 2', 'Year 1']);

  // 4. Move folder "Aerodynamics" (carrying its subject) INSIDE "Year 2" (middle drop).
  await htmlDrag(folderRow('Aerodynamics'), folderRow('Year 2'), 0.5);
  assert.equal(await folderNode('Year 2').locator('.nav-folder-name', { hasText: 'Aerodynamics' }).count(), 1);
  assert.equal(await folderRow('Year 2').locator('.nav-folder-count').textContent(), '1');
  assert.equal(await folderRow('Year 1').locator('.nav-folder-count').textContent(), '0');

  // 5. Keyboard hierarchy move: Alt+ArrowLeft outdents "Aerodynamics" back to top level.
  await folderRow('Aerodynamics').focus();
  await page.keyboard.press('Alt+ArrowLeft');
  await idle();
  const afterOutdent = await page.locator('#subject-nav > .nav-folder > .nav-folder-row .nav-folder-name').allTextContents();
  assert.deepEqual(afterOutdent, ['Year 2', 'Year 1', 'Aerodynamics']);

  // 6. Rename folder inline and verify subject card shows updated folder badge in My subjects.
  await folderRow('Aerodynamics').hover();
  await folderRow('Aerodynamics').locator('[data-action="rename-folder"]').click();
  await page.locator('#folder-form [name=name]').fill('Core Aero');
  await page.locator('#folder-form button[type=submit]').click();
  await idle();
  assert.equal(await folderRow('Core Aero').count(), 1);
  await page.locator('[data-action="subjects"]').first().click();
  await idle();
  assert.match(await page.locator('.course-card').first().textContent(), /Core Aero/);

  // 7. Drag subject back to root ("My subjects"), then back into "Core Aero".
  await htmlDrag(page.locator('#subject-nav [data-action="subject"]').first(), page.locator('[data-action="subjects"][data-folder-drop="root"]'), 0.5);
  assert.equal(await page.locator('.nav-root-zone [data-action="subject"]').count(), 1);
  assert.equal(await folderRow('Core Aero').locator('.nav-folder-count').textContent(), '0');
  await htmlDrag(page.locator('#subject-nav [data-action="subject"]').first(), folderRow('Core Aero'), 0.5);
  assert.equal(await folderNode('Core Aero').locator('[data-action="subject"]').count(), 1);

  // 8. Delete empty folder "Year 1" with confirmation.
  await folderRow('Year 1').hover();
  await folderRow('Year 1').locator('[data-action="delete-folder"]').click();
  await page.locator('#confirm-yes').click();
  await idle();
  assert.equal(await folderRow('Year 1').count(), 0);

  // 9. Instructor sees ONLY folders with their subjects ("Core Aero"), NOT empty "Year 2", and has NO folder admin controls or drag handles.
  await logout();
  await loginDemo('instructor');
  assert.equal(await folderRow('Core Aero').count(), 1);
  assert.equal(await folderRow('Year 2').count(), 0);
  assert.equal(await page.locator('[data-action="new-folder"]').count(), 0);
  assert.equal(await page.locator('[data-action="rename-folder"]').count(), 0);
  assert.equal(await page.locator('[data-action="delete-folder"]').count(), 0);
  assert.equal(await page.locator('#subject-nav [draggable="true"]').count(), 0);
  if (shotsDir) await page.screenshot({ path: join(shotsDir, '06-instructor-folders.png') });

  assert.deepEqual(errors, []);
  console.log('PASS: admin subject folders creation, drag-drop subject into folder, folder hierarchy reorder/nest/outdent, rename, safe delete, and instructor read-only visibility.');
} finally {
  if (application) await application.close();
  await rm(directory, { recursive: true, force: true });
}
