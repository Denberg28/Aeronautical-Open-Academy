import { _electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const directory = await mkdtemp(join(tmpdir(), 'academy-access-ui-'));
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
  const action = async (name, extra = '') => {
    if (['settings', 'help'].includes(name) && !(await page.locator(`[data-action="${name}"]`).first().isVisible()))
      await page.getByText('MORE', { exact: true }).click();
    await page.locator(`[data-action="${name}"]${extra}`).first().click();
    await idle();
  };
  const loginDemo = async (role) => {
    await page.locator(`[data-demo="${role}"]`).click();
    await page.locator('#login-form button[type=submit]').click();
    await page.waitForSelector('#app:not([hidden]) .center');
    await idle();
  };
  const loginCredentials = async (username, password) => {
    await page.locator('#login-form [name=username]').fill(username);
    await page.locator('#login-form [name=password]').fill(password);
    await page.locator('#login-form button[type=submit]').click();
    await page.waitForSelector('#app:not([hidden]) .center');
    await idle();
  };
  const submit = async (selector) => {
    await page.locator(`${selector} button[type=submit], ${selector} button:not([type])`).last().click();
    await idle();
  };

  // 1. Verify application rename & login workspace hint behavior.
  await page.waitForSelector('#signin[open]');
  assert.equal(await page.title(), 'Aeronautical Academy Repository');
  const brand = await page.locator('.login-brand').textContent();
  assert.match(brand, /AERONAUTICAL/i);
  assert.match(brand, /ACADEMY REPOSITORY/i);
  await page.locator('#workspace').selectOption('organization');
  assert.equal(await page.locator('#org-hint').isVisible(), true);
  assert.equal(await page.locator('#demo-hint').isVisible(), false);
  await page.locator('#workspace').selectOption('local');
  assert.equal(await page.locator('#org-hint').isVisible(), false);
  if (shotsDir) await page.screenshot({ path: join(shotsDir, '01-signin-renamed.png') });

  // 2. Admin creates a co-instructor (verifying role-aware Student ID hide & password toggle) and grants read_only access.
  await loginDemo('admin');
  assert.match(await page.locator('.sidebar-foot').textContent(), /Aeronautical Academy Repository/);
  await action('accounts');
  await action('new-account');
  assert.equal(await page.locator('#student-id-field').isVisible(), true);
  await page.locator('#new-account select[name=role]').selectOption('instructor');
  assert.equal(await page.locator('#student-id-field').isVisible(), false);
  await page.locator('#new-account [data-action="toggle-field-password"]').click();
  assert.equal(await page.locator('#new-account [name=password]').getAttribute('type'), 'text');
  await page.locator('#new-account [data-action="toggle-field-password"]').click();
  assert.equal(await page.locator('#new-account [name=password]').getAttribute('type'), 'password');

  const tempPass = 'Temp Instructor Passphrase 2026!';
  const newPass = 'Rotated Instructor Passphrase 2026!';
  await page.locator('#new-account [name=name]').fill('Co-Instructor');
  await page.locator('#new-account [name=email]').fill('coinst@academy.test');
  await page.locator('#new-account [name=password]').fill(tempPass);
  await page.locator('#new-account [name=confirm_password]').fill(tempPass);
  await submit('#new-account');
  await page.getByText('coinst@academy.test', { exact: true }).waitFor();

  // Grant read_only access on the active subject via Subject access view.
  await action('access');
  const row = page.locator('tr', { hasText: 'coinst@academy.test' });
  await row.waitFor();
  await row.locator('select').selectOption('read_only');
  await row.locator('[data-action="grant-instructor"]').click();
  await idle();
  assert.match(await row.textContent(), /Active · Read only/);
  if (shotsDir) await page.screenshot({ path: join(shotsDir, '02-admin-subject-access.png') });

  // 3. First sign-in forces password rotation with confirmation check and locked-down navigation.
  await action('logout');
  await loginCredentials('coinst@academy.test', tempPass);
  assert.equal(await page.locator('.banner').isVisible(), true);
  assert.equal(await page.locator('[data-action="subjects"]').count(), 0);
  assert.equal(await page.locator('[data-action="sync"]').count(), 0);
  await page.locator('#password [name=current]').fill(tempPass);
  await page.locator('#password [name=next]').fill(newPass);
  await page.locator('#password [name=confirm]').fill('Mismatched Passphrase 2026!');
  await submit('#password');
  assert.match(await page.locator('#toast').textContent(), /do not match/i);
  await page.locator('#password [name=confirm]').fill(newPass);
  await submit('#password');
  await page.waitForSelector('#signin[open]');

  // 4. Co-instructor signs in with rotated passphrase -> read-only UI enforcement.
  await loginCredentials('coinst@academy.test', newPass);
  assert.match(await page.locator('.subject-hero').textContent(), /Read-only access/);
  assert.equal(await page.locator('[data-action="add"]').count(), 0);
  assert.equal(await page.locator('[data-action="edit-subject"]').count(), 0);
  assert.equal(await page.locator('[data-action="edit"]').count(), 0);
  assert.equal(await page.locator('[data-action="delete"]').count(), 0);
  assert.equal(await page.locator('[data-action="publish"]').count(), 0);
  assert.equal(await page.locator('[data-action="schedule"]').count(), 0);
  if (shotsDir) await page.screenshot({ path: join(shotsDir, '03-instructor-readonly.png') });

  await action('learners');
  assert.equal(await page.locator('[data-action="export"]').count(), 0);
  assert.match(await page.locator('#center').textContent(), /Read-only access/);
  await action('eligibility');
  assert.equal(await page.locator('#eligibility [name=all]').isDisabled(), true);
  assert.equal(await page.locator('[data-action="generate-qr"]').count(), 0);

  // 5. Admin promotes to Editor, verifies edit controls appear (without subject delete for non-owner), then suspends & verifies removal.
  await action('logout');
  await loginDemo('admin');
  await action('access');
  await row.locator('select').selectOption('editor');
  await row.locator('[data-action="save-instructor-level"]').click();
  await idle();
  assert.match(await row.textContent(), /Active · Editor/);

  await action('logout');
  await loginCredentials('coinst@academy.test', newPass);
  assert.doesNotMatch(await page.locator('.subject-hero').textContent(), /Read-only access/);
  assert.ok((await page.locator('[data-action="add"]').count()) > 0);
  assert.equal(await page.locator('[data-action="edit-subject"]').count(), 1);
  await action('edit-subject');
  assert.equal(await page.locator('[data-action="delete-subject"]').count(), 0);

  await action('logout');
  await loginDemo('admin');
  await action('access');
  await row.locator('[data-action="suspend-instructor"]').click();
  await page.locator('#confirm-yes').click();
  await idle();
  assert.match(await row.textContent(), /Suspended · Editor/);

  await action('logout');
  await loginCredentials('coinst@academy.test', newPass);
  assert.match(await page.locator('#center').textContent(), /No subjects yet/);

  await action('logout');
  await loginDemo('admin');
  await action('access');
  await row.locator('[data-action="activate-instructor"]').click();
  await idle();
  assert.match(await row.textContent(), /Active · Editor/);

  // 6. Verify student default reader role & zero download/edit controls.
  await action('logout');
  await loginDemo('student');
  assert.match(await page.locator('.account-role').textContent(), /Student · Reader/);
  assert.equal(await page.locator('[data-action="export"]').count(), 0);
  assert.equal(await page.locator('[data-action="add"]').count(), 0);
  assert.equal(await page.locator('[data-action="edit-subject"]').count(), 0);
  if (shotsDir) await page.screenshot({ path: join(shotsDir, '04-student-reader.png') });
  await action('settings');
  assert.match(await page.locator('#center').textContent(), /Reader \(downloads disabled\)/);

  assert.deepEqual(errors, []);
  console.log('PASS: app rename, login/registration workflow, forced password rotation, instructor read-only/editor/suspend/activate access, and student reader/no-download default.');
} finally {
  if (application) await application.close();
  await rm(directory, { recursive: true, force: true });
}
