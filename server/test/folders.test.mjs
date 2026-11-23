import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createAcademy } from '../src/server.mjs';

const pass = 'A long private testing passphrase!';

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'academy-folders-test-'));
  const app = await createAcademy({
    dbPath: join(directory, 'test.sqlite'),
    bootstrap: { email: 'admin@example.test', name: 'Administrator', password: pass },
    scryptN: 16384,
  });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + app.server.address().port;
  async function call(path, { method = 'GET', token, body } = {}) {
    const headers = {};
    if (token) headers.Authorization = 'Bearer ' + token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }
  async function login(emailAddress, password = pass) {
    const r = await call('/v1/auth/login', { method: 'POST', body: { email: emailAddress, password } });
    assert.equal(r.status, 200);
    return r.body.token;
  }
  const admin = await login('admin@example.test');
  async function account(emailAddress, role) {
    const r = await call('/v1/admin/accounts', {
      method: 'POST',
      token: admin,
      body: { email: emailAddress, name: role, password: pass, role },
    });
    assert.equal(r.status, 201);
    let token = await login(emailAddress);
    assert.equal((await call('/v1/auth/password', {
      method: 'POST',
      token,
      body: { current_password: pass, new_password: pass + 'changed' },
    })).status, 200);
    token = await login(emailAddress, pass + 'changed');
    return { ...r.body.account, token };
  }
  return {
    app,
    call,
    admin,
    account,
    close: async () => {
      await app.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

test('admin manages subject folders, hierarchy moves, cycle/depth guards, safe delete, and role visibility', async () => {
  const f = await fixture();
  try {
    const instructor = await f.account('inst@example.test', 'instructor');
    const student = await f.account('stud@example.test', 'student');

    const sub = (await f.call('/v1/subjects', {
      method: 'POST',
      token: instructor.token,
      body: { title: 'Aerodynamics 101', description: 'Lift and drag' },
    })).body.id;
    await f.call('/v1/admin/enrolments', { method: 'POST', token: f.admin, body: { subject_id: sub, student_id: student.id } });

    // Non-admin denied on all folder endpoints.
    for (const user of [instructor, student]) {
      assert.equal((await f.call('/v1/admin/folders', { token: user.token })).status, 403);
      assert.equal((await f.call('/v1/admin/folders', { method: 'POST', token: user.token, body: { name: 'Denied' } })).status, 403);
      assert.equal((await f.call(`/v1/admin/subjects/${sub}/folder`, { method: 'POST', token: user.token, body: { folder_id: null } })).status, 403);
    }

    // Create top-level folders and a nested subfolder.
    const f1 = (await f.call('/v1/admin/folders', { method: 'POST', token: f.admin, body: { name: 'Year 1' } }));
    assert.equal(f1.status, 201);
    const f2 = (await f.call('/v1/admin/folders', { method: 'POST', token: f.admin, body: { name: 'Year 2' } }));
    assert.equal(f2.status, 201);
    const fEmpty = (await f.call('/v1/admin/folders', { method: 'POST', token: f.admin, body: { name: 'Private Empty' } }));
    assert.equal(fEmpty.status, 201);
    const fSub = (await f.call('/v1/admin/folders', { method: 'POST', token: f.admin, body: { name: 'Aero Lab', parent_id: f1.body.folder.id } }));
    assert.equal(fSub.status, 201);
    assert.equal(fSub.body.folder.parent_id, f1.body.folder.id);

    // Move subject into nested subfolder.
    const assign = await f.call(`/v1/admin/subjects/${sub}/folder`, {
      method: 'POST',
      token: f.admin,
      body: { folder_id: fSub.body.folder.id },
    });
    assert.equal(assign.status, 200);
    assert.equal(assign.body.folder_id, fSub.body.folder.id);

    // Non-admin sees ONLY folders containing (or ancestors of) their visible subjects — never Private Empty or Year 2!
    for (const user of [instructor, student]) {
      const list = await f.call('/v1/subjects', { token: user.token });
      assert.equal(list.status, 200);
      assert.equal(list.body.subjects[0].folder_id, fSub.body.folder.id);
      assert.deepEqual(list.body.folders.map((x) => x.name).sort(), ['Aero Lab', 'Year 1']);
    }

    // Admin sees all folders including empty ones.
    const adminList = await f.call('/v1/subjects', { token: f.admin });
    assert.equal(adminList.body.folders.length, 4);

    // Hierarchy moves: reorder Year 2 BEFORE Year 1.
    const reorder = await f.call(`/v1/admin/folders/${f2.body.folder.id}`, {
      method: 'PATCH',
      token: f.admin,
      body: { before_id: f1.body.folder.id },
    });
    assert.equal(reorder.status, 200);
    const rootOrder = reorder.body.folders.filter((x) => !x.parent_id).map((x) => x.name);
    assert.deepEqual(rootOrder, ['Year 2', 'Year 1', 'Private Empty']);

    // Cycle prevention: moving Year 1 into itself or into its own child Aero Lab is rejected.
    assert.equal((await f.call(`/v1/admin/folders/${f1.body.folder.id}`, {
      method: 'PATCH',
      token: f.admin,
      body: { parent_id: f1.body.folder.id },
    })).status, 400);
    assert.equal((await f.call(`/v1/admin/folders/${f1.body.folder.id}`, {
      method: 'PATCH',
      token: f.admin,
      body: { parent_id: fSub.body.folder.id },
    })).status, 400);

    // Move Aero Lab inside Year 2 and rename it.
    const reparent = await f.call(`/v1/admin/folders/${fSub.body.folder.id}`, {
      method: 'PATCH',
      token: f.admin,
      body: { parent_id: f2.body.folder.id, name: 'Flight Dynamics' },
    });
    assert.equal(reparent.status, 200);
    assert.equal(reparent.body.folder.parent_id, f2.body.folder.id);
    assert.equal(reparent.body.folder.name, 'Flight Dynamics');

    // Enforce max nesting depth (5 levels: depth 0..4 allowed, depth 5 rejected).
    const d2 = (await f.call('/v1/admin/folders', { method: 'POST', token: f.admin, body: { name: 'L2', parent_id: fSub.body.folder.id } })).body.folder.id;
    const d3 = (await f.call('/v1/admin/folders', { method: 'POST', token: f.admin, body: { name: 'L3', parent_id: d2 } })).body.folder.id;
    const d4 = (await f.call('/v1/admin/folders', { method: 'POST', token: f.admin, body: { name: 'L4', parent_id: d3 } })).body.folder.id;
    assert.equal((await f.call('/v1/admin/folders', { method: 'POST', token: f.admin, body: { name: 'L5-TooDeep', parent_id: d4 } })).status, 400);

    // Delete Flight Dynamics -> subject and child folder L2 safely move up to Year 2, never deleted!
    const del = await f.call(`/v1/admin/folders/${fSub.body.folder.id}`, { method: 'DELETE', token: f.admin });
    assert.equal(del.status, 200);
    assert.equal(del.body.moved_to, f2.body.folder.id);
    const afterDel = await f.call('/v1/subjects', { token: f.admin });
    assert.equal(afterDel.body.subjects.find((s) => s.id === sub).folder_id, f2.body.folder.id);
    assert.equal(afterDel.body.folders.find((x) => x.id === d2).parent_id, f2.body.folder.id);

    // Move subject back to root.
    assert.equal((await f.call(`/v1/admin/subjects/${sub}/folder`, {
      method: 'POST',
      token: f.admin,
      body: { folder_id: null },
    })).status, 200);
    assert.equal((await f.call('/v1/subjects', { token: f.admin })).body.subjects[0].folder_id, null);

    // Atomic audit rollback on folder create.
    f.app.db.exec("CREATE TRIGGER fail_folder_audit BEFORE INSERT ON audit WHEN NEW.action='folder-create' BEGIN SELECT RAISE(ABORT,'audit blocked'); END;");
    assert.equal((await f.call('/v1/admin/folders', { method: 'POST', token: f.admin, body: { name: 'Rolled Back' } })).status, 500);
    assert.equal(f.app.db.prepare("SELECT id FROM subject_folders WHERE name='Rolled Back'").get(), undefined);
    f.app.db.exec('DROP TRIGGER fail_folder_audit;');
  } finally {
    await f.close();
  }
});
