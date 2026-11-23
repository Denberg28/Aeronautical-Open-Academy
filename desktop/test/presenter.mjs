import { _electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const directory = await mkdtemp(join(tmpdir(), 'academy-presenter-ui-'));
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

  // 1. Instructor plays a multi-question Examination from AE 101 template.
  await loginDemo('instructor');
  const examCard = page.locator('[data-item]', { hasText: 'Prelim - Examination 1' }).first();
  await examCard.locator('[data-action="play-item"]').click();
  const dlg = page.locator('#presenter-dialog[open]');
  await dlg.waitFor();

  // Verify full-viewport dimensions.
  const dims = await page.evaluate(() => {
    const r = document.getElementById('presenter-dialog').getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), iw: window.innerWidth, ih: window.innerHeight };
  });
  assert.equal(dims.w, dims.iw);
  assert.equal(dims.h, dims.ih);

  // Verify Question 1 displays letter options ONLY (no radio/checkbox inputs, no answer key).
  assert.match(await dlg.locator('.presenter-status').textContent(), /^Question 1 of \d+$/);
  assert.equal(await dlg.locator('input[type=radio], input[type=checkbox]').count(), 0);
  assert.equal(await dlg.locator('[data-presenter-key]').count(), 0);
  const letters = await dlg.locator('.presenter-letter').allTextContents();
  assert.ok(letters.length >= 2);
  assert.equal(letters[0], 'A');
  assert.equal(letters[1], 'B');
  assert.equal(await dlg.locator('[data-presenter="prev"]').isDisabled(), true);
  if (shotsDir) await page.screenshot({ path: join(shotsDir, '07-presenter-slide.png') });

  // Navigate forward with Next arrow and back with Previous arrow.
  await dlg.locator('[data-presenter="next"]').click();
  assert.match(await dlg.locator('.presenter-status').textContent(), /^Question 2 of \d+$/);
  assert.equal(await dlg.locator('[data-presenter="prev"]').isDisabled(), false);
  await dlg.locator('[data-presenter="prev"]').click();
  assert.match(await dlg.locator('.presenter-status').textContent(), /^Question 1 of \d+$/);

  // Advance to the end of the examination and verify confirmation dialog before revealing answer key.
  const total = Number((await dlg.locator('.presenter-status').textContent()).match(/of (\d+)/)[1]);
  for (let i = 1; i < total; i++) {
    await dlg.locator('[data-presenter="next"]').click();
  }
  assert.match(await dlg.locator('[data-presenter="next"]').textContent(), /Finish/);
  await dlg.locator('[data-presenter="next"]').click();
  await dlg.locator('#presenter-confirm').waitFor();
  assert.match(await dlg.locator('#presenter-confirm-title').textContent(), /Show answer key\?/);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-presenter')), 'confirm-no');
  if (shotsDir) await page.screenshot({ path: join(shotsDir, '08-presenter-confirm.png') });

  // Cancel keeps user on last question with answer key still hidden.
  await dlg.locator('[data-presenter="confirm-no"]').click();
  assert.equal(await dlg.locator('#presenter-confirm').count(), 0);
  assert.equal(await dlg.locator('[data-presenter-key]').count(), 0);

  // Confirm reveals the class answer key with numbered answers and letter pills.
  await dlg.locator('[data-presenter="next"]').click();
  await dlg.locator('[data-presenter="confirm-yes"]').click();
  await dlg.locator('[data-presenter-key="true"]').waitFor();
  assert.equal(await dlg.locator('.presenter-key-row').count(), total);
  if (shotsDir) await page.screenshot({ path: join(shotsDir, '09-presenter-answer-key.png') });

  // Back to questions and Exit cleanly clears dialog DOM.
  await dlg.locator('[data-presenter="review-slides"]').click();
  assert.match(await dlg.locator('.presenter-status').textContent(), /^Question 1 of/);
  await dlg.locator('[data-presenter="close"]').first().click();
  assert.equal(await page.locator('#presenter-dialog[open]').count(), 0);
  assert.equal(await page.locator('#presenter-dialog').evaluate((el) => el.innerHTML), '');

  // 2. Verify Play works on Quiz and Activity items too.
  for (const title of ['Prelim - Quiz 1: Evidence', 'Prelim - Activity 1: Requirement and calculation record']) {
    const card = page.locator('[data-item]', { hasText: title }).first();
    await card.locator('[data-action="play-item"]').click();
    await dlg.waitFor();
    assert.equal(await dlg.locator('input[type=radio], input[type=checkbox]').count(), 0);
    await dlg.locator('[data-presenter="close"]').first().click();
  }

  // 3. XSS sanitization check: HTML tags in quiz prompt/options render strictly as text in presenter.
  await page.evaluate(async () => {
    const parent = state.items.find((i) => i.kind === 'material').id;
    await post(`/v1/subjects/${state.active.id}/items`, {
      kind: 'quiz',
      parent_id: parent,
      title: 'XSS Safety Quiz',
      body: 'XSS check',
      published: true,
      questions: [{ prompt: '<img src=x onerror=alert(1)> Prompt', options: ['<b>Alpha</b>', '<script>evil()</script>'], correct_index: 0 }],
    });
    await reloadActive();
  });
  await page.locator('[data-item]', { hasText: 'XSS Safety Quiz' }).first().locator('[data-action="play-item"]').click();
  await dlg.waitFor();
  assert.equal(await dlg.locator('img, script').count(), 0);
  await dlg.locator('[data-presenter="next"]').click();
  await dlg.locator('[data-presenter="confirm-yes"]').click();
  assert.equal(await dlg.locator('img, script').count(), 0);
  await dlg.locator('[data-presenter="close"]').first().click();

  // 4. Student sees ZERO Play buttons.
  await logout();
  await loginDemo('student');
  assert.equal(await page.locator('[data-action="play-item"]').count(), 0);

  // 5. Read-only instructor can play slides (letter options only) but cannot reveal answer key at end.
  await logout();
  await loginDemo('admin');
  await page.evaluate(async () => {
    const pass = 'Read Only Presenter Passphrase 2026!';
    const created = await post('/v1/admin/accounts', {
      name: 'RO Presenter',
      email: 'ropres@academy.test',
      role: 'instructor',
      password: pass,
    });
    await post(`/v1/admin/subjects/${state.active.id}/instructors`, {
      instructor_id: created.account.id,
      access_level: 'read_only',
      status: 'active',
    });
  });
  await logout();
  // Rotate temp password on first login.
  const tempPass = 'Read Only Presenter Passphrase 2026!';
  const newPass = 'Rotated Presenter Passphrase 2026!';
  await page.locator('#login-form [name=username]').fill('ropres@academy.test');
  await page.locator('#login-form [name=password]').fill(tempPass);
  await page.locator('#login-form button[type=submit]').click();
  await page.waitForSelector('#password');
  await idle();
  await page.locator('#password [name=current]').fill(tempPass);
  await page.locator('#password [name=next]').fill(newPass);
  await page.locator('#password [name=confirm]').fill(newPass);
  await page.locator('#password button.primary').click();
  await page.waitForSelector('#signin[open]');
  await idle();

  await page.locator('#login-form [name=username]').fill('ropres@academy.test');
  await page.locator('#login-form [name=password]').fill(newPass);
  await page.locator('#login-form button[type=submit]').click();
  await page.waitForSelector('#app:not([hidden]) .center');
  await idle();

  await page.locator('[data-item]', { hasText: 'Prelim - Quiz 1: Evidence' }).first().locator('[data-action="play-item"]').click();
  await dlg.waitFor();
  assert.equal(await dlg.locator('.presenter-letter').first().textContent(), 'A');
  await dlg.locator('[data-presenter="next"]').click();
  await dlg.locator('#presenter-confirm').waitFor();
  assert.equal(await dlg.locator('[data-presenter="confirm-yes"]').count(), 0);
  assert.match(await dlg.locator('#presenter-confirm-title').textContent(), /End of assessment/);
  await dlg.locator('#presenter-confirm [data-presenter="close"]').click();

  assert.deepEqual(errors, []);
  console.log('PASS: fullscreen Play presenter on quiz/activity/examination, Next/Previous arrow navigation, letter-only options, end-of-item answer-key confirmation, XSS sanitization, and student/read-only isolation.');
} finally {
  if (application) {
    const pages = application.windows();
    if (pages[0]) await pages[0].evaluate(() => { state.dirty = false; }).catch(() => {});
    await application.close();
  }
  await rm(directory, { recursive: true, force: true });
}
