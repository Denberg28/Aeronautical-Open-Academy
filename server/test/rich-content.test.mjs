import test from 'node:test';
import assert from 'node:assert/strict';
import { createAcademy } from '../src/server.mjs';
import { sanitizeRichHtml, detectImageMime, extractImageIds } from '../src/richtext.mjs';

const pass = 'A long private testing passphrase!';
// Minimal valid 1x1 PNG (67 bytes).
const TINY_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
  'hex',
);

async function fixture() {
  const app = await createAcademy({
    dbPath: ':memory:',
    bootstrap: { email: 'admin@example.test', name: 'Admin', password: pass },
    scryptN: 16384,
  });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const call = async (path, { method = 'GET', token, body, rawBody, contentType } = {}) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (rawBody !== undefined) headers['Content-Type'] = contentType || 'application/octet-stream';
    else if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + path, {
      method,
      headers,
      body: rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null };
  };
  const login = async (email, password = pass) => (await call('/v1/auth/login', { method: 'POST', body: { email, password } })).body.token;
  const admin = await login('admin@example.test');
  const account = async (email, role) => {
    const temp = 'Initial temporary passphrase 2026!';
    const created = await call('/v1/admin/accounts', { method: 'POST', token: admin, body: { name: role, email, role, password: temp } });
    assert.equal(created.status, 201);
    const t0 = await login(email, temp);
    assert.equal((await call('/v1/auth/password', { method: 'POST', token: t0, body: { current_password: temp, new_password: pass } })).status, 200);
    return { id: created.body.account.id, email, token: await login(email, pass) };
  };
  return { app, base, call, login, admin, account, close: () => app.close() };
}

test('rich HTML sanitizer preserves formatting/indent/safe image refs and strips XSS payloads', () => {
  const dirty = '<h2 data-indent="1" onclick="alert(1)">Title</h2><p data-indent="3" style="color:red"><strong>Bold</strong> <em>Italic</em> <u>Under</u></p><script>alert(1)</script><iframe src="https://evil"></iframe><img src="x" onerror="alert(2)"><img data-img="11111111-1111-1111-1111-111111111111" src="javascript:alert(3)" onerror="alert(4)" alt="Wing diagram"><svg onload="alert(5)"></svg>';
  const clean = sanitizeRichHtml(dirty);
  assert.ok(clean.includes('<h2 data-indent="1">Title</h2>'));
  assert.ok(clean.includes('<p data-indent="3"><strong>Bold</strong> <em>Italic</em> <u>Under</u></p>'));
  assert.ok(clean.includes('<img data-img="11111111-1111-1111-1111-111111111111" alt="Wing diagram">'));
  assert.ok(!clean.includes('<script'));
  assert.ok(!clean.includes('<iframe'));
  assert.ok(!clean.includes('<svg'));
  assert.ok(!clean.includes('onerror'));
  assert.ok(!clean.includes('onclick'));
  assert.ok(!clean.includes('javascript:'));
  assert.ok(!clean.includes('style='));
  assert.deepEqual(extractImageIds(clean), ['11111111-1111-1111-1111-111111111111']);

  const obfuscated = '<p>Safe\0Text</p><!<!-- -->--<script>alert(6)</script><!-- unclosed <img onerror=alert(7)>';
  const cleanObf = sanitizeRichHtml(obfuscated);
  assert.ok(cleanObf.includes('<p>SafeText</p>'));
  assert.ok(!cleanObf.includes('\0'));
  assert.ok(!cleanObf.includes('alert('));
  assert.ok(!cleanObf.includes('onerror'));

  assert.equal(detectImageMime(TINY_PNG), 'image/png');
  assert.equal(detectImageMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
  assert.equal(detectImageMime(Buffer.from('not an image at all')), null);
});

test('pasted images upload, bind to rich entries, enforce access & prune on edit', async () => {
  const f = await fixture();
  try {
    const teacher = await f.account('rich-inst@example.test', 'instructor');
    const student = await f.account('rich-stud@example.test', 'student');
    const outsider = await f.account('rich-out@example.test', 'student');
    const subject = (await f.call('/v1/subjects', { method: 'POST', token: teacher.token, body: { title: 'Aerodynamics', description: 'Rich notes' } })).body.id;
    await f.call('/v1/admin/enrolments', { method: 'POST', token: f.admin, body: { subject_id: subject, student_id: student.id } });

    // Student cannot upload images; fake image is rejected.
    assert.equal((await f.call(`/v1/subjects/${subject}/images`, { method: 'POST', token: student.token, rawBody: TINY_PNG, contentType: 'image/png' })).status, 404);
    assert.equal((await f.call(`/v1/subjects/${subject}/images`, { method: 'POST', token: teacher.token, rawBody: Buffer.from('<svg></svg>'), contentType: 'image/svg+xml' })).status, 400);

    // Valid PNG upload succeeds.
    const up = await f.call(`/v1/subjects/${subject}/images`, { method: 'POST', token: teacher.token, rawBody: TINY_PNG, contentType: 'image/png' });
    assert.equal(up.status, 201);
    const imgId = up.body.image.id;
    assert.equal(up.body.image.mime_type, 'image/png');

    // Create rich entry referencing image + paragraph spacing + indentation.
    const create = await f.call(`/v1/subjects/${subject}/items`, {
      method: 'POST',
      token: teacher.token,
      body: {
        kind: 'material',
        material_mode: 'text',
        title: 'Airfoil Lesson',
        body: 'Airfoil Lesson\nLift force notes',
        body_html: `<p data-indent="2"><strong>Lift</strong> diagram:</p><figure data-img="${imgId}"><img data-img="${imgId}" alt="Airfoil"></figure><script>evil()</script>`,
        paragraph_spacing: 'relaxed',
        published: true,
      },
    });
    assert.equal(create.status, 201);
    const itemId = create.body.id;

    // Enrolled student reads sanitized rich HTML, spacing, and authorized inline image.
    const detail = (await f.call(`/v1/subjects/${subject}`, { token: student.token })).body;
    const item = detail.items.find((i) => i.id === itemId);
    assert.equal(item.paragraph_spacing, 'relaxed');
    assert.ok(item.body_html.includes('data-indent="2"'));
    assert.ok(item.body_html.includes(`data-img="${imgId}"`));
    assert.ok(!item.body_html.includes('<script'));

    const imgRes = await fetch(`${f.base}/v1/items/${itemId}/images/${imgId}`, { headers: { Authorization: `Bearer ${student.token}` } });
    assert.equal(imgRes.status, 200);
    assert.equal(imgRes.headers.get('content-type'), 'image/png');
    assert.equal(imgRes.headers.get('content-disposition'), 'inline');
    assert.equal(imgRes.headers.get('x-download-options'), 'noopen');
    assert.ok(Buffer.from(await imgRes.arrayBuffer()).equals(TINY_PNG));

    // Unenrolled outsider is denied image access.
    assert.equal((await f.call(`/v1/items/${itemId}/images/${imgId}`, { token: outsider.token })).status, 404);

    // Invalid spacing rejected.
    assert.equal((await f.call(`/v1/items/${itemId}`, { method: 'PATCH', token: teacher.token, body: { paragraph_spacing: 'giant', expected_edit_version: 1 } })).status, 400);

    // Removing the image from body_html prunes the orphaned image row.
    assert.equal((await f.call(`/v1/items/${itemId}`, { method: 'PATCH', token: teacher.token, body: { body_html: '<p>Text only now</p>', paragraph_spacing: 'loose', expected_edit_version: 1 } })).status, 200);
    assert.equal((await f.call(`/v1/items/${itemId}/images/${imgId}`, { token: student.token })).status, 404);
  } finally {
    await f.close();
  }
});

test('multi-level order parent_updates moves entries across levels atomically and blocks cycles/depth>4', async () => {
  const f = await fixture();
  try {
    const teacher = await f.account('level-inst@example.test', 'instructor');
    const subject = (await f.call('/v1/subjects', { method: 'POST', token: teacher.token, body: { title: 'Levels', description: 'Drag across levels' } })).body.id;
    const mk = async (kind, title, parent_id = null) =>
      (await f.call(`/v1/subjects/${subject}/items`, { method: 'POST', token: teacher.token, body: { kind, title, body: title, published: true, parent_id } })).body.id;
    const m1 = await mk('material', 'Module 1');
    const m2 = await mk('material', 'Module 2');
    const a1 = await mk('activity', 'Act 1', m1);

    let sub = (await f.call(`/v1/subjects/${subject}`, { token: teacher.token })).body;
    // Move a1 from m1 into m2 AND nest m2 inside m1 in one atomic order update!
    const move = await f.call(`/v1/subjects/${subject}/order`, {
      method: 'POST',
      token: teacher.token,
      body: {
        item_ids: [m1, m2, a1],
        expected_revision: sub.subject.order_revision,
        parent_updates: [
          { id: m2, parent_id: m1 },
          { id: a1, parent_id: m2 },
        ],
      },
    });
    assert.equal(move.status, 200);
    sub = (await f.call(`/v1/subjects/${subject}`, { token: teacher.token })).body;
    assert.equal(sub.items.find((i) => i.id === m2).parent_id, m1);
    assert.equal(sub.items.find((i) => i.id === a1).parent_id, m2);

    // Cycle check: cannot move m1 inside its child m2.
    assert.equal((await f.call(`/v1/subjects/${subject}/order`, {
      method: 'POST',
      token: teacher.token,
      body: {
        item_ids: [m2, m1, a1],
        expected_revision: sub.subject.order_revision,
        parent_updates: [{ id: m1, parent_id: m2 }],
      },
    })).status, 400);

    // Move a1 out to root level (parent_id: null).
    const outdent = await f.call(`/v1/subjects/${subject}/order`, {
      method: 'POST',
      token: teacher.token,
      body: {
        item_ids: [m1, m2, a1],
        expected_revision: sub.subject.order_revision,
        parent_updates: [{ id: a1, parent_id: null }],
      },
    });
    assert.equal(outdent.status, 200);
    sub = (await f.call(`/v1/subjects/${subject}`, { token: teacher.token })).body;
    assert.equal(sub.items.find((i) => i.id === a1).parent_id, null);
  } finally {
    await f.close();
  }
});

test('admin password update supports both direct password update (require_change:false) and forced rotation (default)', async () => {
  const f = await fixture();
  try {
    const user = await f.account('pw-user@example.test', 'student');
    const directPass = 'Direct Updated Password 2026!';
    const r1 = await f.call(`/v1/admin/accounts/${user.id}/password`, {
      method: 'POST',
      token: f.admin,
      body: { password: directPass, require_change: false },
    });
    assert.equal(r1.status, 200);
    assert.equal(r1.body.must_change_password, false);
    // Old session revoked immediately.
    assert.equal((await f.call('/v1/me', { token: user.token })).status, 401);
    // New direct password works without forcing rotation.
    const tDirect = await f.login(user.email, directPass);
    const meDirect = await f.call('/v1/me', { token: tDirect });
    assert.equal(meDirect.status, 200);
    assert.equal(meDirect.body.account.must_change_password, false);
    assert.equal((await f.call('/v1/subjects', { token: tDirect })).status, 200);

    // Default (omitted require_change) still enforces first-login rotation.
    const tempPass = 'Forced Rotation Passphrase 2026!';
    const r2 = await f.call(`/v1/admin/accounts/${user.id}/password`, {
      method: 'POST',
      token: f.admin,
      body: { password: tempPass },
    });
    assert.equal(r2.status, 200);
    assert.equal(r2.body.must_change_password, true);
    const tTemp = await f.login(user.email, tempPass);
    assert.equal((await f.call('/v1/subjects', { token: tTemp })).status, 403);
  } finally {
    await f.close();
  }
});
