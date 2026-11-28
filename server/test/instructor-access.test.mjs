import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createAcademy } from '../src/server.mjs';
import { LocalMaterials } from '../src/materials.mjs';

const pass = 'A long private testing passphrase!';

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'academy-access-test-'));
  let time = Date.now();
  const app = await createAcademy({
    dbPath: join(directory, 'test.sqlite'),
    materials: new LocalMaterials(join(directory, 'files')),
    bootstrap: { email: 'admin@example.test', name: 'Administrator', password: pass },
    scryptN: 16384,
    clock: () => time,
  });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + app.server.address().port;
  async function call(path, { method = 'GET', token, body, key, binary } = {}) {
    const headers = {};
    if (token) headers.Authorization = 'Bearer ' + token;
    if (key) headers['Idempotency-Key'] = key;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (binary) headers['Content-Type'] = 'application/pdf';
    const response = await fetch(base + path, {
      method,
      headers,
      body: binary || (body === undefined ? undefined : JSON.stringify(body)),
    });
    const type = response.headers.get('content-type') || '';
    return {
      status: response.status,
      headers: response.headers,
      body: /^(application\/pdf|application\/vnd\.openxmlformats)/.test(type)
        ? Buffer.from(await response.arrayBuffer())
        : await response.json(),
    };
  }
  async function login(emailAddress, password = pass) {
    const r = await call('/v1/auth/login', { method: 'POST', body: { email: emailAddress, password } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body.token;
  }
  const admin = await login('admin@example.test');
  async function account(emailAddress, role, student_number) {
    const r = await call('/v1/admin/accounts', {
      method: 'POST',
      token: admin,
      body: { email: emailAddress, name: role + ' ' + emailAddress.split('@')[0], password: pass, role, ...(student_number ? { student_number } : {}) },
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    let token = await login(emailAddress);
    const changed = await call('/v1/auth/password', {
      method: 'POST',
      token,
      body: { current_password: pass, new_password: pass + 'changed' },
    });
    assert.equal(changed.status, 200);
    token = await login(emailAddress, pass + 'changed');
    return { ...r.body.account, token };
  }
  return {
    app,
    call,
    login,
    admin,
    account,
    advance: (ms) => { time += ms; },
    close: async () => {
      await app.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

test('admin controls instructor subject access: read_only, editor, suspend, and activate', async () => {
  const f = await fixture();
  try {
    const owner = await f.account('owner@example.test', 'instructor');
    const guest = await f.account('guest@example.test', 'instructor');
    const student = await f.account('student@example.test', 'student', 'AERO-101');

    // Non-admin cannot view or edit instructor grants.
    const created = await f.call('/v1/subjects', {
      method: 'POST',
      token: owner.token,
      body: { title: 'Aerodynamics 101', description: 'Lift and drag fundamentals' },
    });
    assert.equal(created.status, 201);
    const sid = created.body.id;

    assert.equal((await f.call(`/v1/admin/subjects/${sid}/instructors`, { token: owner.token })).status, 403);
    assert.equal((await f.call(`/v1/admin/subjects/${sid}/instructors`, { token: student.token })).status, 403);
    assert.equal((await f.call(`/v1/subjects/${sid}`, { token: guest.token })).status, 404);

    // Seed content: PDF material, quiz, written activity, student submission.
    await f.call('/v1/admin/enrolments', { method: 'POST', token: f.admin, body: { subject_id: sid, student_id: student.id } });
    const pdfItem = (await f.call(`/v1/subjects/${sid}/items`, {
      method: 'POST',
      token: owner.token,
      body: { kind: 'material', material_mode: 'file', title: 'Airfoil PDF', body: 'Read inline only.', published: false },
    })).body.id;
    assert.equal((await f.call(`/v1/items/${pdfItem}/file`, {
      method: 'POST',
      token: owner.token,
      binary: Buffer.from('%PDF-1.4\nsynthetic airfoil\n%%EOF'),
    })).status, 200);
    assert.equal((await f.call(`/v1/items/${pdfItem}`, {
      method: 'PATCH',
      token: owner.token,
      body: { published: true, expected_edit_version: 2 },
    })).status, 200);

    const quizItem = (await f.call(`/v1/subjects/${sid}/items`, {
      method: 'POST',
      token: owner.token,
      body: { kind: 'quiz', title: 'Lift Check', body: 'Select the right answer.', options: ['Down', 'Up'], correct_index: 1, published: true },
    })).body.id;

    const activityItem = (await f.call(`/v1/subjects/${sid}/items`, {
      method: 'POST',
      token: owner.token,
      body: { kind: 'activity', title: 'Wing Report', body: 'Write your notes.', published: true },
    })).body.id;

    const submission = await f.call(`/v1/items/${activityItem}/submission`, {
      method: 'POST',
      token: student.token,
      key: randomUUID(),
      body: { output: 'Camber increases lift.' },
    });
    assert.equal(submission.status, 201);
    const learnerDetail = await f.call(`/v1/subjects/${sid}/learners/${student.id}`, { token: owner.token });
    const submissionId = learnerDetail.body.items.find((i) => i.id === activityItem).submission_id;
    assert.ok(submissionId);

    // 1. Grant guest instructor READ-ONLY active access.
    const grantRo = await f.call(`/v1/admin/subjects/${sid}/instructors`, {
      method: 'POST',
      token: f.admin,
      body: { instructor_id: guest.id, access_level: 'read_only', status: 'active' },
    });
    assert.equal(grantRo.status, 200);
    assert.equal(grantRo.body.access.access_level, 'read_only');
    assert.equal(grantRo.body.access.status, 'active');

    // Read-only instructor can list/view subject, view inline PDF, view learners/detail/eligibility, but answer keys are hidden.
    const listRo = await f.call('/v1/subjects', { token: guest.token });
    assert.equal(listRo.status, 200);
    assert.equal(listRo.body.subjects.length, 1);
    assert.equal(listRo.body.subjects[0].access_level, 'read_only');
    assert.equal(listRo.body.subjects[0].can_edit, false);
    assert.equal(listRo.body.subjects[0].can_delete, false);

    const viewRo = await f.call(`/v1/subjects/${sid}`, { token: guest.token });
    assert.equal(viewRo.status, 200);
    assert.equal(viewRo.body.subject.access_level, 'read_only');
    assert.equal(viewRo.body.subject.can_edit, false);
    const roQuiz = viewRo.body.items.find((i) => i.id === quizItem);
    assert.equal(roQuiz.correct_index, undefined);
    assert.equal(roQuiz.questions[0].correct_index, undefined);
    assert.equal(roQuiz.can_edit, false);

    const inlinePdf = await f.call(`/v1/items/${pdfItem}/content`, { token: guest.token });
    assert.equal(inlinePdf.status, 200);
    assert.equal(inlinePdf.headers.get('x-download-options'), 'noopen');
    assert.equal((await f.call(`/v1/items/${pdfItem}/content?download=1`, { token: guest.token })).status, 403);

    assert.equal((await f.call(`/v1/subjects/${sid}/learners`, { token: guest.token })).status, 200);
    assert.equal((await f.call(`/v1/subjects/${sid}/learners/${student.id}`, { token: guest.token })).status, 200);
    assert.equal((await f.call(`/v1/subjects/${sid}/eligibility`, { token: guest.token })).status, 200);

    // Read-only instructor is DENIED on all mutations, grading, eligibility save, reorder, export, and archive.
    assert.equal((await f.call(`/v1/subjects/${sid}`, { method: 'PATCH', token: guest.token, body: { title: 'Tampered', description: 'Nope' } })).status, 403);
    assert.equal((await f.call(`/v1/subjects/${sid}/items`, { method: 'POST', token: guest.token, body: { kind: 'material', material_mode: 'text', title: 'Blocked', body: 'x' } })).status, 403);
    assert.equal((await f.call(`/v1/items/${activityItem}`, { method: 'PATCH', token: guest.token, body: { title: 'Blocked', expected_edit_version: 1 } })).status, 403);
    assert.equal((await f.call(`/v1/items/${activityItem}/schedule`, { method: 'POST', token: guest.token, body: { published: true, publish_at: null, due_at: null, expected_edit_version: 1 } })).status, 403);
    assert.equal((await f.call(`/v1/subjects/${sid}/order`, { method: 'POST', token: guest.token, body: { item_ids: [pdfItem, quizItem, activityItem], expected_revision: 1 } })).status, 403);
    assert.equal((await f.call(`/v1/subjects/${sid}/eligibility`, { method: 'POST', token: guest.token, body: { all_students: true, student_numbers: [], expected_revision: 1 } })).status, 403);
    assert.equal((await f.call(`/v1/submissions/${submissionId}/grade`, { method: 'POST', token: guest.token, body: { score: 90, feedback: 'Blocked' } })).status, 403);
    assert.equal((await f.call(`/v1/subjects/${sid}/export`, { token: guest.token })).status, 403);
    assert.equal((await f.call(`/v1/subjects/${sid}/archive`, { method: 'POST', token: guest.token, body: { confirm_delete: true } })).status, 404);

    // 2. Promote guest instructor to EDITOR active access.
    const grantEditor = await f.call(`/v1/admin/subjects/${sid}/instructors`, {
      method: 'POST',
      token: f.admin,
      body: { instructor_id: guest.id, access_level: 'editor', status: 'active' },
    });
    assert.equal(grantEditor.status, 200);
    assert.equal(grantEditor.body.access.access_level, 'editor');

    const viewEd = await f.call(`/v1/subjects/${sid}`, { token: guest.token });
    assert.equal(viewEd.body.subject.access_level, 'editor');
    assert.equal(viewEd.body.subject.can_edit, true);
    assert.equal(viewEd.body.subject.can_delete, false);

    // Editor can create own entry, edit own entry, edit subject, grade student, and export.
    const guestItem = await f.call(`/v1/subjects/${sid}/items`, {
      method: 'POST',
      token: guest.token,
      body: { kind: 'material', material_mode: 'text', title: 'Co-instructor Notes', body: 'Drag polar notes', published: true },
    });
    assert.equal(guestItem.status, 201);
    assert.equal((await f.call(`/v1/items/${guestItem.body.id}`, {
      method: 'PATCH',
      token: guest.token,
      body: { title: 'Co-instructor Notes Rev 2', expected_edit_version: 1 },
    })).status, 200);
    // Editor still cannot overwrite another author's item or archive another owner's subject.
    assert.equal((await f.call(`/v1/items/${activityItem}`, { method: 'PATCH', token: guest.token, body: { title: 'Hijack', expected_edit_version: 1 } })).status, 403);
    assert.equal((await f.call(`/v1/subjects/${sid}/archive`, { method: 'POST', token: guest.token, body: { confirm_delete: true } })).status, 404);

    assert.equal((await f.call(`/v1/submissions/${submissionId}/grade`, {
      method: 'POST',
      token: guest.token,
      body: { score: 95, feedback: 'Good work' },
    })).status, 200);
    assert.equal((await f.call(`/v1/subjects/${sid}/export`, { token: guest.token })).status, 200);

    // 3. Suspend BOTH guest and original owner on this subject.
    assert.equal((await f.call(`/v1/admin/subjects/${sid}/instructors`, {
      method: 'POST',
      token: f.admin,
      body: { instructor_id: guest.id, access_level: 'editor', status: 'suspended' },
    })).status, 200);
    assert.equal((await f.call(`/v1/admin/subjects/${sid}/instructors`, {
      method: 'POST',
      token: f.admin,
      body: { instructor_id: owner.id, access_level: 'editor', status: 'suspended' },
    })).status, 200);

    for (const suspended of [guest, owner]) {
      assert.equal((await f.call('/v1/subjects', { token: suspended.token })).body.subjects.length, 0);
      assert.equal((await f.call(`/v1/subjects/${sid}`, { token: suspended.token })).status, 404);
      assert.equal((await f.call(`/v1/subjects/${sid}/learners`, { token: suspended.token })).status, 404);
      assert.equal((await f.call(`/v1/items/${pdfItem}/content`, { token: suspended.token })).status, 404);
      assert.equal((await f.call(`/v1/subjects/${sid}/export`, { token: suspended.token })).status, 404);
      assert.equal((await f.call(`/v1/subjects/${sid}/archive`, { method: 'POST', token: suspended.token, body: { confirm_delete: true } })).status, 404);
    }

    // 4. Reactivate owner as read_only: owner regains read visibility without write privileges until restored to editor.
    assert.equal((await f.call(`/v1/admin/subjects/${sid}/instructors`, {
      method: 'POST',
      token: f.admin,
      body: { instructor_id: owner.id, access_level: 'read_only', status: 'active' },
    })).status, 200);
    const ownerRestored = await f.call(`/v1/subjects/${sid}`, { token: owner.token });
    assert.equal(ownerRestored.status, 200);
    assert.equal(ownerRestored.body.subject.access_level, 'read_only');
    assert.equal(ownerRestored.body.subject.can_edit, false);
    assert.equal(ownerRestored.body.subject.can_delete, false);
    assert.equal((await f.call(`/v1/items/${activityItem}`, { method: 'PATCH', token: owner.token, body: { title: 'Blocked while read_only', expected_edit_version: 1 } })).status, 403);

    // 5. Verify admin listing reflects current assignments accurately.
    const adminList = await f.call(`/v1/admin/subjects/${sid}/instructors`, { token: f.admin });
    assert.equal(adminList.status, 200);
    const byId = new Map(adminList.body.instructors.map((r) => [r.instructor_id, r]));
    assert.equal(byId.get(owner.id).status, 'active');
    assert.equal(byId.get(owner.id).access_level, 'read_only');
    assert.equal(byId.get(owner.id).is_owner, true);
    assert.equal(byId.get(guest.id).status, 'suspended');
    assert.equal(byId.get(guest.id).access_level, 'editor');
  } finally {
    await f.close();
  }
});

test('students default to reader with no download capability; registration validation and atomic audit enforced', async () => {
  const f = await fixture();
  try {
    const owner = await f.account('reader-owner@example.test', 'instructor');
    const student = await f.account('reader-student@example.test', 'student', 'READ-01');
    const sid = (await f.call('/v1/subjects', {
      method: 'POST',
      token: owner.token,
      body: { title: 'Flight Safety', description: 'Reader enforcement test' },
    })).body.id;
    await f.call('/v1/admin/enrolments', { method: 'POST', token: f.admin, body: { subject_id: sid, student_id: student.id } });
    const pdfItem = (await f.call(`/v1/subjects/${sid}/items`, {
      method: 'POST',
      token: owner.token,
      body: { kind: 'material', material_mode: 'file', title: 'Safety Manual', body: 'View only', published: false },
    })).body.id;
    assert.equal((await f.call(`/v1/items/${pdfItem}/file`, {
      method: 'POST',
      token: owner.token,
      binary: Buffer.from('%PDF-1.4\nsafety\n%%EOF'),
    })).status, 200);
    await f.call(`/v1/items/${pdfItem}`, { method: 'PATCH', token: owner.token, body: { published: true, expected_edit_version: 2 } });

    // Student capabilities and subject access_level.
    const me = await f.call('/v1/me', { token: student.token });
    assert.equal(me.body.capabilities.student_download, false);
    assert.equal(me.body.capabilities.student_role_default, 'reader');

    const subjects = await f.call('/v1/subjects', { token: student.token });
    assert.equal(subjects.body.subjects[0].access_level, 'reader');
    assert.equal(subjects.body.subjects[0].can_edit, false);
    assert.equal(subjects.body.subjects[0].can_delete, false);

    // Inline view works with hardened headers; download flag is blocked; offline_allowed is rejected.
    const inline = await f.call(`/v1/items/${pdfItem}/content`, { token: student.token });
    assert.equal(inline.status, 200);
    assert.match(inline.headers.get('content-disposition'), /^inline;/);
    assert.equal(inline.headers.get('x-download-options'), 'noopen');
    assert.equal(inline.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.equal((await f.call(`/v1/items/${pdfItem}/content?download=1`, { token: student.token })).status, 403);
    assert.equal((await f.call(`/v1/subjects/${sid}/items`, {
      method: 'POST',
      token: owner.token,
      body: { kind: 'material', material_mode: 'text', title: 'Bad offline', body: 'x', offline_allowed: true },
    })).status, 400);

    // Registration security: reject unexpected fields and non-student student_number.
    assert.equal((await f.call('/v1/admin/accounts', {
      method: 'POST',
      token: f.admin,
      body: { name: 'Injected', email: 'inject@example.test', role: 'student', password: pass, status: 'active', must_change_password: false },
    })).status, 400);
    assert.equal((await f.call('/v1/admin/accounts', {
      method: 'POST',
      token: f.admin,
      body: { name: 'Bad Inst', email: 'badinst@example.test', role: 'instructor', password: pass, student_number: 'INST-1' },
    })).status, 400);

    // Atomic audit failure rolls back account creation completely.
    f.app.db.exec("CREATE TRIGGER fail_audit_create BEFORE INSERT ON audit WHEN NEW.action='account-create' BEGIN SELECT RAISE(ABORT,'audit blocked'); END;");
    const failedCreate = await f.call('/v1/admin/accounts', {
      method: 'POST',
      token: f.admin,
      body: { name: 'Rolled Back', email: 'rollback@example.test', role: 'student', password: pass },
    });
    assert.equal(failedCreate.status, 500);
    assert.equal(f.app.db.prepare('SELECT id FROM accounts WHERE email=?').get('rollback@example.test'), undefined);
    f.app.db.exec('DROP TRIGGER fail_audit_create;');

    // Atomic audit failure rolls back admin password reset without invalidating existing sessions.
    f.app.db.exec("CREATE TRIGGER fail_audit_reset BEFORE INSERT ON audit WHEN NEW.action='password-reset' BEGIN SELECT RAISE(ABORT,'audit blocked'); END;");
    const failedReset = await f.call(`/v1/admin/accounts/${student.id}/password`, {
      method: 'POST',
      token: f.admin,
      body: { password: 'Another long temporary passphrase!' },
    });
    assert.equal(failedReset.status, 500);
    assert.equal((await f.call('/v1/me', { token: student.token })).status, 200);
    f.app.db.exec('DROP TRIGGER fail_audit_reset;');
  } finally {
    await f.close();
  }
});
