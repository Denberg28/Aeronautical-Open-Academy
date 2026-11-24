import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { AcademyBridge } from '../bridge.mjs';
import { responseBytes } from '../transport.mjs';

// Integration — CI may point this test at the separately maintained shared API checkout.
const apiRoot = resolve(process.env.ACADEMY_SHARED_API_ROOT || fileURLToPath(new URL('../../', import.meta.url)));
const { createAcademy } = await import(pathToFileURL(join(apiRoot, 'server/src/server.mjs')));
const { LocalMaterials } = await import(pathToFileURL(join(apiRoot, 'server/src/materials.mjs')));

test('organization sync, PDF upload/read, scheduling, student block and global logout work with the shared API', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'academy-shared-'));
  const password = 'Synthetic organization test password!';
  const app = await createAcademy({
    dbPath: join(directory, 'test.sqlite'),
    materials: new LocalMaterials(join(directory, 'files')),
    bootstrap: { email: 'admin@example.test', name: 'Synthetic admin', password },
    scryptN: 16384,
  });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const fetcher = (url, options) => fetch('http://127.0.0.1:' + app.server.address().port + new URL(url).pathname, options);
  const bridge = () => new AcademyBridge({ origin: 'http://unused', accessKey: 'never-forwarded' }, { fetcher });
  const admin = bridge(), instructor = bridge(), other = bridge(), studentClient = bridge();
  const login = (client, email, pass = password) => client.login({ mode: 'organization', origin: 'https://academy.fixture.test', username: email, password: pass });
  try {
    await login(admin, 'admin@example.test');
    await admin.request('/v1/admin/accounts', { method: 'POST', body: { email: 'teacher@example.test', name: 'Synthetic instructor', role: 'instructor', password } });
    await admin.request('/v1/admin/accounts', { method: 'POST', body: { email: 'learner@example.test', name: 'Synthetic learner', role: 'student', password } });

    // Student account cannot sign in via desktop bridge even on a shared organization API.
    await assert.rejects(
      login(studentClient, 'learner@example.test'),
      (err) => err.status === 403 && /administrators and instructors only/i.test(err.message),
    );
    assert.equal(studentClient.token, '');

    // Instructor rotates temporary password and signs in on two sessions.
    await login(instructor, 'teacher@example.test');
    await instructor.request('/v1/auth/password', { method: 'POST', body: { current_password: password, new_password: password + 'changed' } });
    await login(instructor, 'teacher@example.test', password + 'changed');
    await login(other, 'teacher@example.test', password + 'changed');

    const { id } = await instructor.request('/v1/subjects', { method: 'POST', body: { title: 'Shared repository', description: 'Synthetic' } });
    const created = await instructor.request(`/v1/subjects/${id}/items`, { method: 'POST', body: { kind: 'material', material_mode: 'file', title: 'Protected PDF', body: 'Read inside Academy' } });
    let item = (await instructor.request(`/v1/items/${created.id}`)).item;
    const bytes = await readFile(new URL('../../app/src/main/assets/materials/a-learning-guide.pdf', import.meta.url));
    await instructor.uploadMaterial(item.id, item.edit_version, bytes);
    item = (await instructor.request(`/v1/items/${item.id}`)).item;
    await instructor.request(`/v1/items/${item.id}`, { method: 'POST', body: { published: true, expected_edit_version: item.edit_version } });

    const beforeDates = (await instructor.request(`/v1/items/${item.id}`)).item;
    await instructor.request(`/v1/items/${item.id}/schedule`, { method: 'POST', body: { expected_edit_version: beforeDates.edit_version, published: true, publish_at: Date.now() + 3600000, due_at: Date.now() + 7200000 } });
    const scheduled = (await instructor.request(`/v1/items/${item.id}`)).item;
    assert.equal(scheduled.publication_state, 'scheduled');
    await instructor.request(`/v1/items/${item.id}/schedule`, { method: 'POST', body: { expected_edit_version: scheduled.edit_version, published: true, publish_at: null, due_at: Date.now() - 60000 } });

    const pdf = await other.readMaterial(item.id, item.revision);
    assert.deepEqual(Buffer.from(pdf.data, 'base64'), bytes);
    assert.equal(pdf.token, undefined);
    await assert.rejects(other.request(`/v1/items/${item.id}/content`), /dedicated/);

    const receipt = await other.sync();
    assert.equal(receipt.protocol, 'academy-sync-v1');
    assert.equal(receipt.capabilities.scheduling, 'dates-v1');
    assert.equal((await other.request(`/v1/items/${item.id}`)).item.due_state, 'overdue');

    await instructor.request('/v1/auth/logout-all', { method: 'POST', body: {} });
    await assert.rejects(other.sync(), (error) => error.status === 401);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('bounded responses and session switches reject stale private data', async () => {
  await assert.rejects(responseBytes(new Response('small', { headers: { 'Content-Length': '99999999' } }), 100), /too large/);
  let release;
  const waiting = new Promise((resolve) => { release = resolve; });
  const bridge = new AcademyBridge({ origin: 'http://unused', accessKey: 'private' }, {
    fetcher: async (url) => {
      if (url.endsWith('/v1/me')) await waiting;
      return new Response(JSON.stringify(url.endsWith('/login') ? { token: 'synthetic', account: { id: 'one', role: 'instructor' } } : { account: { id: 'one' } }));
    },
  });
  await bridge.login({ mode: 'organization', origin: 'https://academy.fixture.test', username: 'one@example.test', password: 'synthetic' });
  const pending = bridge.request('/v1/me');
  await bridge.logout();
  release();
  await assert.rejects(pending, (error) => error.status === 401);
  assert.equal(bridge.token, '');
});
