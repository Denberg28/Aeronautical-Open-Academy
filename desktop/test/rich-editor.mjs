import { _electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgAAIAAAUAAen63NgAAAAASUVORK5CYII=';

const directory = await mkdtemp(join(tmpdir(), 'academy-rich-ui-'));
const shotsDir = process.env.ACADEMY_QA_SHOTS ? resolve(import.meta.dirname, '../../out/desktop-qa') : '';
if (shotsDir) await mkdir(shotsDir, { recursive: true });
let application;

try {
  application = await _electron.launch({
    args: [resolve(import.meta.dirname, '..'), '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    env: { ...process.env, ACADEMY_TEST_DATA: directory, ACADEMY_TEST_LEGACY_SEED: '1' },
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
  const loginCredentials = async (email, password) => {
    await page.waitForSelector('#signin[open]');
    await page.locator('#login-form [name=username]').fill(email);
    await page.locator('#login-form [name=password]').fill(password);
    await page.locator('#login-form button[type=submit]').click();
    await page.waitForSelector('#app:not([hidden]) .center');
    await idle();
  };
  const logout = async () => {
    await page.locator('[data-action="logout"]').click();
    await page.waitForSelector('#signin[open]');
    await idle();
  };

  // 1. Instructor opens rich composer, adopts pasted HTML format, pastes a PNG snip, indents & sets relaxed spacing.
  await loginDemo('instructor');
  await page.locator('[data-action="add"][data-parent=""]').first().click();
  await idle();
  await page.locator('#composer input[name=title]').fill('Lesson 02 — Wing Lift & Diagrams');

  // Simulate Word/Excel dual-payload paste (formatted HTML + plain text + auxiliary PNG bitmap) — must adopt formatted HTML, not turn text into an image.
  await page.evaluate((b64) => {
    const raw = atob(b64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const file = new File([bytes], 'word-preview.png', { type: 'image/png' });
    const ed = document.getElementById('rich-editor');
    ed.focus();
    const dt = new DataTransfer();
    dt.items.add(file);
    dt.setData(
      'text/html',
      '<h2>Aerodynamic Forces</h2><p style="margin-left:56px"><span style="font-weight:bold">Bernoulli</span> and <em>circulation</em></p><ul><li>Leading edge</li><li>Trailing edge</li></ul><script>window.__xss=1</script><img src="x" onerror="window.__xss=2">',
    );
    dt.setData('text/plain', 'Aerodynamic Forces\nBernoulli and circulation');
    ed.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
  }, TINY_PNG_BASE64);
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.equal(await page.locator('#rich-editor h2').count(), 1);
  assert.equal(await page.locator('#rich-editor strong').textContent(), 'Bernoulli');
  assert.equal(await page.locator('#rich-editor em').textContent(), 'circulation');
  assert.equal(await page.locator('#rich-editor [data-indent="2"]').count(), 1);
  assert.equal(await page.locator('#rich-editor ul li').count(), 2);
  assert.equal(await page.locator('#rich-editor figure.entry-figure').count(), 0);

  // Paste a pure PNG screenshot snip (no text/plain) into #rich-editor via clipboardData file.
  await page.evaluate((b64) => {
    const raw = atob(b64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const file = new File([bytes], 'snip.png', { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);
    const ed = document.getElementById('rich-editor');
    ed.focus();
    ed.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
  }, TINY_PNG_BASE64);
  await page.locator('#rich-editor figure.entry-figure img[data-img]').waitFor();

  // Verify left column expand/collapse via arrow controls while keeping the unsaved draft intact and zero horizontal overflow.
  const sidebarWidth = () => page.locator('#sidebar').evaluate((el) => Math.round(el.getBoundingClientRect().width));
  const hasOverflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  const normalW = await sidebarWidth();
  assert.ok(normalW >= 220 && normalW <= 250, `Expected normal sidebar ~236px, got ${normalW}`);
  await page.locator('[data-action="sidebar-widen"]').click();
  const expandedW = await sidebarWidth();
  assert.ok(expandedW >= 320, `Expected expanded sidebar >= 320px, got ${expandedW}`);
  assert.equal(await hasOverflow(), false);
  assert.equal(await page.locator('[data-action="sidebar-widen"]').isDisabled(), true);
  assert.equal(await page.locator('#composer input[name=title]').inputValue(), 'Lesson 02 — Wing Lift & Diagrams');
  if (shotsDir) await page.screenshot({ path: join(shotsDir, '13-sidebar-expanded.png') });
  await page.locator('[data-action="sidebar-narrow"]').click();
  assert.equal(await sidebarWidth(), normalW);
  await page.locator('[data-action="sidebar-narrow"]').click();
  const collapsedW = await sidebarWidth();
  assert.ok(collapsedW <= 64, `Expected collapsed sidebar <= 64px, got ${collapsedW}`);
  assert.equal(await hasOverflow(), false);
  assert.equal(await page.locator('[data-action="sidebar-widen"]').isVisible(), true);
  await page.locator('[data-action="sidebar-widen"]').click();
  assert.equal(await sidebarWidth(), normalW);

  // Toolbar Indent button + Relaxed paragraph spacing.
  await page.locator('#rich-editor h2').click();
  await page.locator('[data-action="editor-cmd"][data-cmd="indent"]').click();
  assert.equal(await page.locator('#rich-editor h2[data-indent="1"]').count(), 1);
  await page.locator('#paragraph-spacing').selectOption('relaxed');
  assert.equal(await page.locator('#rich-editor').getAttribute('data-spacing'), 'relaxed');
  if (shotsDir) await page.screenshot({ path: join(shotsDir, '10-rich-editor.png') });

  await page.locator('#composer button[type=submit]').click();
  await idle();

  const richCard = page.locator('[data-item]', { hasText: 'Lesson 02 — Wing Lift & Diagrams' }).first();
  await richCard.waitFor();
  assert.equal(await richCard.locator('.rich-copy[data-spacing="relaxed"]').count(), 1);
  assert.equal(await richCard.locator('.rich-copy h2[data-indent="1"]').count(), 1);
  assert.equal(await richCard.locator('.rich-copy [data-indent="2"]').count(), 1);
  await richCard.locator('.rich-copy img.entry-image[data-loaded="1"]').waitFor();

  // 2. Minimize individual entry + Minimize all / Expand all.
  const richId = await richCard.getAttribute('data-item');
  await richCard.locator('[data-action="toggle-entry"]').click();
  assert.equal(await richCard.locator('[data-entry-body]').isVisible(), false);
  assert.equal(await richCard.evaluate((el) => el.classList.contains('is-minimized')), true);
  await richCard.locator('[data-action="toggle-entry"]').click();
  assert.equal(await richCard.locator('[data-entry-body]').isVisible(), true);

  await page.locator('[data-action="toggle-all-entries"]').click();
  assert.equal(await page.locator('[data-entry-body]:visible').count(), 0);
  await page.locator('[data-action="toggle-all-entries"]').click();
  assert.ok((await page.locator('[data-entry-body]:visible').count()) >= 2);

  // 3. Drag entry on different levels (nest Material inside Material, move Activity across materials, Alt+ArrowLeft outdent).
  const firstMaterialId = await page.evaluate(() => state.items.find((i) => i.title === 'The principles of flight').id);
  const childActivityId = await page.evaluate(() => state.items.find((i) => i.title === 'Reflect on the four forces').id);

  // Drag child activity from Material 1 into the middle of Lesson 02 (cross-parent drag).
  const richBox = await richCard.boundingBox();
  await page.locator(`[data-drag="${childActivityId}"]`).dragTo(richCard, {
    targetPosition: { x: 120, y: Math.round(richBox.height * 0.5) },
  });
  await idle();
  assert.equal(
    await page.evaluate((id) => state.items.find((i) => i.id === id)?.parent_id, childActivityId),
    richId,
    'Activity dragged into another material',
  );

  // Nest Lesson 02 (carrying its child activity) inside "The principles of flight" -> 3 levels deep!
  const firstCard = page.locator(`[data-item="${firstMaterialId}"]`);
  const firstBox = await firstCard.boundingBox();
  await page.locator(`[data-drag="${richId}"]`).dragTo(firstCard, {
    targetPosition: { x: 120, y: Math.round(firstBox.height * 0.5) },
  });
  await idle();
  assert.equal(
    await page.evaluate((id) => state.items.find((i) => i.id === id)?.parent_id, richId),
    firstMaterialId,
    'Material nested inside another material',
  );
  if (shotsDir) await page.screenshot({ path: join(shotsDir, '11-rich-entry-levels.png') });

  // Keyboard Alt+ArrowLeft outdents the nested child activity up one level (from Lesson 02 -> The principles of flight).
  await page.locator(`[data-drag="${childActivityId}"]`).press('Alt+ArrowLeft');
  await idle();
  assert.equal(
    await page.evaluate((id) => state.items.find((i) => i.id === id)?.parent_id, childActivityId),
    firstMaterialId,
    'Alt+ArrowLeft outdents entry one level up',
  );

  // Admin views the hydrated pasted image with draggable="false".
  await logout();
  await loginDemo('admin');
  const adminRichCard = page.locator(`[data-item="${richId}"]`);
  await adminRichCard.locator('.rich-copy img.entry-image[data-loaded="1"]').waitFor();
  assert.equal(await adminRichCard.locator('.rich-copy img.entry-image').getAttribute('draggable'), 'false');

  // 4. Admin creates an Instructor account with generated password, updates password directly (without forced rotation), and instructor updates own password in Settings.
  await page.locator('[data-action="accounts"]').click();
  await idle();
  await page.locator('[data-action="new-account"]').click();
  await page.locator('#new-account [name=name]').fill('Flight Instructor');
  await page.locator('#new-account [name=email]').fill('finst@academy.test');
  await page.locator('#new-account [data-action="generate-password"]').click();
  const generatedPass = await page.locator('#new-account [name=password]').inputValue();
  assert.ok(generatedPass.length >= 15);
  assert.equal(await page.locator('#new-account [name=confirm_password]').inputValue(), generatedPass);
  if (shotsDir) await page.screenshot({ path: join(shotsDir, '12-accounts-password.png') });
  await page.locator('#new-account button.primary').click();
  await idle();
  await page.getByText('finst@academy.test', { exact: true }).waitFor();

  // Admin updates instructor password directly (unchecking require_change so user can sign in immediately).
  const finstRow = page.locator('tr', { hasText: 'finst@academy.test' });
  await finstRow.locator('[data-action="reset-password"]').click();
  const directPass = 'Direct Instructor Password 2026!';
  await page.locator('#reset-password-form [name=password]').fill(directPass);
  await page.locator('#reset-password-form [name=confirm_password]').fill(directPass);
  await page.locator('#reset-password-form [name=require_change]').uncheck();
  await page.locator('#reset-password-form button.primary').click();
  await page.locator('#confirm-yes').click();
  await idle();

  // Instructor signs in with direct password (no forced password rotation) and updates own password in Settings.
  await logout();
  await loginCredentials('finst@academy.test', directPass);
  assert.equal(await page.locator('#password').count(), 0);
  await page.locator('.sidebar summary', { hasText: 'MORE' }).click();
  await page.locator('[data-action="settings"]').click();
  await idle();
  const finalPass = 'Instructor Self Updated Password 2026!';
  await page.locator('#password [name=current]').fill(directPass);
  await page.locator('#password [name=next]').fill(finalPass);
  await page.locator('#password [name=confirm]').fill(finalPass);
  await page.locator('#password button.primary').click();
  await page.waitForSelector('#signin[open]');
  await idle();

  await loginCredentials('finst@academy.test', finalPass);
  assert.match(await page.locator('.topbar').textContent(), /Flight Instructor/);

  // 7. Workspace state persistence across logout/login + minimize right pane + frictionless shortcuts.
  await logout();
  await loginDemo('instructor');
  const firstEntry = page.locator('article.material').first();
  const firstEntryId = await firstEntry.getAttribute('data-item');
  const rightbarWidth = () => page.locator('#rightbar').evaluate((el) => Math.round(el.getBoundingClientRect().width));
  const initialRightW = await rightbarWidth();
  assert.ok(initialRightW >= 240, `Expected expanded rightbar >= 240px, got ${initialRightW}`);

  // Minimize an entry card, expand left column, and minimize the right pane.
  await firstEntry.locator('[data-action="toggle-entry"]').click();
  assert.equal(await firstEntry.locator('[data-entry-body]').isHidden(), true);
  await page.locator('[data-action="sidebar-widen"]').click();
  await page.locator('#rightbar [data-action="rightbar-toggle"]').click();
  const collapsedRightW = await rightbarWidth();
  assert.ok(collapsedRightW <= 48, `Expected minimized rightbar <= 48px, got ${collapsedRightW}`);
  assert.equal(await page.locator('#rightbar .rightbar-body').isVisible(), false);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  if (shotsDir) await page.screenshot({ path: join(shotsDir, '16-rightbar-minimized.png') });

  // Ctrl+K focuses search and Escape clears it cleanly.
  await page.keyboard.press('Control+k');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'search');
  await page.locator('#search').fill('forces');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#search').inputValue(), '');
  assert.equal(await firstEntry.locator('[data-entry-body]').isHidden(), true);

  // Logout and sign back in as Instructor: minimized entry, expanded sidebar, and minimized right pane persist!
  await logout();
  await loginDemo('instructor');
  assert.equal(await page.locator('#app').evaluate((el) => el.classList.contains('sidebar-expanded')), true);
  assert.equal(await page.locator('#app').evaluate((el) => el.classList.contains('rightbar-collapsed')), true);
  assert.ok((await rightbarWidth()) <= 48);
  assert.equal(await page.locator(`[data-item="${firstEntryId}"] [data-entry-body]`).isHidden(), true);

  // Verify Alt+\ expands the right pane cleanly and saves state.
  await page.locator('#center').click({ position: { x: 20, y: 20 } });
  await page.keyboard.press('Alt+\\');
  assert.ok((await rightbarWidth()) >= 240);
  assert.equal(await page.locator('#rightbar .rightbar-body').isVisible(), true);

  // Per-account isolation: Admin must NOT inherit Instructor's minimized entry or expanded sidebar.
  await logout();
  await loginDemo('admin');
  assert.equal(await page.locator('#app').evaluate((el) => el.classList.contains('sidebar-expanded')), false);
  assert.equal(await page.locator('#app').evaluate((el) => el.classList.contains('rightbar-collapsed')), false);
  assert.equal(await page.locator(`[data-item="${firstEntryId}"] [data-entry-body]`).isVisible(), true);

  // 8. Streamlined workflow checks: filter pills, quick + Add, Escape cancel, Ctrl+Enter save, My subjects search, and click-through toast.
  assert.equal(await page.locator('#toast').evaluate((el) => getComputedStyle(el).pointerEvents), 'none');
  // Quick + Add in top toolbar -> Escape closes cleanly when clean -> Ctrl+Enter submits new draft entry.
  await page.locator('.utility [data-action="add"][data-parent=""]').click();
  await page.locator('#composer input[name=title]').waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#composer').count(), 0);

  await page.locator('.utility [data-action="add"][data-parent=""]').click();
  await page.locator('#composer input[name=title]').fill('Draft Flight Checklist');
  await page.locator('#composer input[name=published]').uncheck();
  await page.keyboard.press('Control+Enter');
  await idle();
  await page.locator('[data-item]', { hasText: 'Draft Flight Checklist' }).first().waitFor();

  // Filter pills narrow visible entries accurately and restore on All.
  await page.locator('[data-action="filter-entries"][data-filter="drafts"]').click();
  assert.equal(await page.locator('[data-action="filter-entries"][data-filter="drafts"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('[data-item]:visible', { hasText: 'Draft Flight Checklist' }).count(), 1);
  assert.equal(await page.locator('[data-item]:visible', { hasText: 'The principles of flight' }).count(), 0);

  await page.locator('[data-action="filter-entries"][data-filter="assessments"]').click();
  assert.equal(await page.locator('[data-item]:visible', { hasText: 'Reflect on the four forces' }).count(), 1);
  assert.equal(await page.locator('[data-item]:visible', { hasText: 'Draft Flight Checklist' }).count(), 0);

  await page.locator('[data-action="filter-entries"][data-filter="materials"]').click();
  assert.equal(await page.locator('[data-item]:visible', { hasText: 'Reflect on the four forces' }).count(), 0);
  assert.equal(await page.locator('[data-item]:visible', { hasText: 'The principles of flight' }).count(), 1);

  await page.locator('[data-action="filter-entries"][data-filter="all"]').click();
  assert.equal(await page.locator('[data-item]:visible', { hasText: 'Draft Flight Checklist' }).count(), 1);

  // Create a second subject via Ctrl+Enter and test instant search on My subjects (Ctrl+K + Escape).
  await page.locator('[data-action="subjects"]').click();
  await idle();
  await page.locator('[data-action="new-subject"]').click();
  await page.locator('#subject-form [name=title]').fill('Avionics Navigation');
  await page.locator('#subject-form [name=description]').fill('VOR, ILS, and inertial reference basics.');
  await page.keyboard.press('Control+Enter');
  await idle();
  await page.locator('[data-action="subjects"]').click();
  await idle();
  await page.locator('#subject-search').waitFor();
  await page.keyboard.press('Control+k');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'subject-search');
  await page.locator('#subject-search').fill('Avionics');
  assert.equal(await page.locator('#subjects-grid .course-card:not([hidden])').count(), 1);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#subject-search').inputValue(), '');
  assert.ok((await page.locator('#subjects-grid .course-card:not([hidden])').count()) >= 2);

  // Verify zero horizontal overflow at compact 1060px width with the streamlined subject toolbar.
  await page.locator('#subjects-grid .course-card').first().click();
  await idle();
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1060, 820));
  assert.equal(await hasOverflow(), false);

  assert.deepEqual(errors, []);
  console.log('PASS: streamlined filter pills, quick + Add, Ctrl+Enter/Escape authoring, My subjects search, left/right collapsible panes, workspace state persistence, rich content paste/snip/indent/spacing, multi-level drag, and password management.');
} finally {
  if (application) {
    const pages = application.windows();
    if (pages[0]) await pages[0].evaluate(() => { state.dirty = false; }).catch(() => {});
    await application.close();
  }
  await rm(directory, { recursive: true, force: true });
}
