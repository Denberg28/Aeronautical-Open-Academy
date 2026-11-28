import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { startLocal, AcademyBridge } from '../bridge.mjs';

test('canonical PC template: 25 entries, 16 forms, 40 questions and read-only instructor answer-key isolation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'academy-forms-'));
  let local;
  try {
    local = await startLocal(directory);
    const bridge = new AcademyBridge(local);
    await bridge.login({ username: 'instructor', password: 'instructor' });
    const subjects = (await bridge.request('/v1/subjects')).subjects;
    assert.equal(subjects.length, 1);
    assert.match(subjects[0].title, /AE 101/);
    const subject = subjects[0];
    const teacher = await bridge.request(`/v1/subjects/${subject.id}`);
    assert.equal(teacher.items.length, 25);
    const forms = teacher.items.filter((item) => item.questions);
    assert.equal(forms.length, 16);
    assert.equal(forms.reduce((n, item) => n + item.questions.length, 0), 40);
    assert.equal(forms.filter((i) => i.kind === 'quiz').length, 8);
    assert.equal(forms.filter((i) => i.assessment_type === 'examination').length, 4);
    assert.ok(forms.every((item) => item.questions.every((q) => Number.isInteger(q.correct_index))));
    await bridge.logout();

    // Admin assigns a second instructor as Read only: can view materials & questions, never sees answer keys or can edit.
    await bridge.login({ username: 'admin', password: 'admin' });
    const readerPass = 'Read Only Instructor Pass 2026!';
    const created = await bridge.request('/v1/admin/accounts', {
      method: 'POST',
      body: { name: 'Reader Instructor', email: 'reader@academy.test', role: 'instructor', password: readerPass },
    });
    await bridge.request(`/v1/admin/accounts/${created.account.id}/password`, {
      method: 'POST',
      body: { password: readerPass, require_change: false },
    });
    await bridge.request(`/v1/admin/subjects/${subject.id}/instructors`, {
      method: 'POST',
      body: { instructor_id: created.account.id, access_level: 'read_only', status: 'active' },
    });
    await bridge.logout();

    await bridge.login({ username: 'reader@academy.test', password: readerPass });
    const roView = await bridge.request(`/v1/subjects/${subject.id}`);
    assert.equal(roView.subject.can_edit, false);
    assert.ok(roView.items.every((item) => !JSON.stringify(item).includes('correct_index')));
    await assert.rejects(
      bridge.request(`/v1/subjects/${subject.id}/items`, {
        method: 'POST',
        body: { kind: 'material', title: 'Blocked', body: 'no' },
      }),
      /read-only|cannot modify/i,
    );
  } finally {
    await local?.academy.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('PC v9 upgrade backs up, replaces only untouched factory content and retains historical entries', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'academy-upgrade-'));
  let local;
  try {
    local = await startLocal(directory, { legacyFixture: true });
    const activity = local.academy.db.prepare("SELECT id FROM items WHERE kind='activity'").get();
    await local.academy.close();
    local = null;
    let db = new DatabaseSync(join(directory, 'academy.sqlite'));
    db.exec('DROP TABLE IF EXISTS item_images; ALTER TABLE items DROP COLUMN body_html; ALTER TABLE items DROP COLUMN paragraph_spacing; DROP INDEX IF EXISTS items_release; ALTER TABLE items DROP COLUMN publish_at; ALTER TABLE items DROP COLUMN due_at; DROP INDEX IF EXISTS subjects_folder; ALTER TABLE subjects DROP COLUMN folder_id; DROP TABLE IF EXISTS subject_folders; DROP TABLE IF EXISTS subject_instructors; DROP TABLE desktop_templates; DROP TABLE IF EXISTS security_limits; DROP INDEX IF EXISTS sessions_expiry; PRAGMA user_version=9;');
    db.close();
    local = await startLocal(directory);
    assert.equal(local.academy.db.prepare('SELECT count(*) n FROM items WHERE archived=0').get().n, 25);
    assert.equal(local.academy.db.prepare('SELECT archived FROM items WHERE id=?').get(activity.id).archived, 1);
    const backupPath = join(directory, 'academy-before-pc-0.12.sqlite');
    const time = (await stat(backupPath)).mtimeMs;
    db = new DatabaseSync(backupPath, { readOnly: true });
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 9);
    db.close();
    await local.academy.close();
    local = await startLocal(directory);
    assert.equal((await stat(backupPath)).mtimeMs, time);
    assert.equal(local.academy.db.prepare('SELECT count(*) n FROM items WHERE archived=0').get().n, 25);
  } finally {
    await local?.academy.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('edited subjects survive practice installation and archived templates are never resurrected', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'academy-preserve-'));
  let local;
  try {
    local = await startLocal(directory, { legacyFixture: true });
    local.academy.db.prepare("UPDATE subjects SET title='My edited subject'").run();
    await local.academy.close();
    local = await startLocal(directory);
    assert.equal(local.academy.db.prepare('SELECT count(*) n FROM subjects WHERE archived=0').get().n, 2);
    assert.ok(local.academy.db.prepare("SELECT id FROM subjects WHERE title='My edited subject'").get());
    local.academy.db.prepare('UPDATE subjects SET archived=1 WHERE id=(SELECT subject_id FROM desktop_templates)').run();
    await local.academy.close();
    local = await startLocal(directory);
    assert.equal(local.academy.db.prepare('SELECT count(*) n FROM subjects WHERE archived=0').get().n, 1);
  } finally {
    await local?.academy.close();
    await rm(directory, { recursive: true, force: true });
  }
});
