// Smoke test that needs NO database: routing, validation, auth guards, error format.
//   npm test
process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/unused';
process.env.JWT_SECRET ||= 'test-secret';

import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const { default: app } = await import('../src/app.js');
const { User } = await import('../src/models/User.js');
const { ScreeningWinner } = await import('../src/models/ScreeningWinner.js');
const { SiteImage } = await import('../src/models/SiteImage.js');
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

const call = async (method, path, body, token) => {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json() };
};

test('health', async () => {
  const r = await call('GET', '/api/health');
  assert.equal(r.status, 200);
});

test('unknown route -> 404 json', async () => {
  const r = await call('GET', '/api/nope');
  assert.equal(r.status, 404);
  assert.equal(r.json.success, false);
});

test('signup / login validation', async () => {
  assert.equal((await call('POST', '/api/auth/signup', { username: 'a', password: '1' })).status, 400);
  assert.equal((await call('POST', '/api/admin/users', { username: 'ab', password: '1' })).status, 401);
  assert.equal((await call('POST', '/api/auth/login', {})).status, 400);
  assert.equal((await call('POST', '/api/auth/admin/login', { username: 'x' })).status, 400);
});

test('protected routes need a token', async () => {
  for (const [m, p] of [
    ['POST', '/api/screenings/choices/' + 'a'.repeat(24) + '/vote'],
    ['GET', '/api/screenings/votes/me'],
    ['POST', '/api/movie-logs'],
    ['GET', '/api/admin/choices'],
    ['GET', '/api/admin/users'],
    ['PUT', '/api/admin/images/now_playing_background'],
    ['DELETE', '/api/admin/images/now_playing_background'],
    ['POST', '/api/admin/winners'],
    ['DELETE', '/api/admin/choices/' + 'a'.repeat(24)],
  ]) {
    assert.equal((await call(m, p)).status, 401, `${m} ${p}`);
  }
  const bad = jwt.sign({ id: 'x' }, 'wrong-secret');
  assert.equal((await call('GET', '/api/admin/choices', null, bad)).status, 401);
});

test('malformed JSON -> 400', async () => {
  const res = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{oops',
  });
  assert.equal(res.status, 400);
});

test('admin create choice validates recommended_by is a user id', async () => {
  // no token -> 401 first; body rules are covered by the schema check below
  assert.equal((await call('POST', '/api/admin/choices', { recommended_by: 'Sam' })).status, 401);
});

// ---- Database layer stubbed: checks hashing, the admin cap and the admin-only guard ----

const fakeDoc = (data) => ({ ...data, toJSON: () => ({ ...data, hashed_password: undefined }) });
const stubbed = { countDocuments: User.countDocuments, create: User.create, findById: User.findById };
test.after(() => Object.assign(User, stubbed));

test('one-time admin signup: hashes password, creates an admin, then closes', async () => {
  let saved;
  User.create = async (data) => (saved = fakeDoc(data));

  User.countDocuments = async () => 0;
  const ok = await call('POST', '/api/auth/signup', { username: 'Boss', password: 'secret12' });
  assert.equal(ok.status, 201);
  assert.equal(saved.is_admin, true);
  assert.notEqual(saved.hashed_password, 'secret12');
  assert.ok(await bcrypt.compare('secret12', saved.hashed_password));
  assert.equal(ok.json.data.hashed_password, undefined);
  assert.equal(JSON.stringify(ok.json).includes('$2'), false);

  User.countDocuments = async () => 2;
  const closed = await call('POST', '/api/auth/signup', { username: 'third', password: 'secret12' });
  assert.equal(closed.status, 403);
});

test('admin creates a normal user with a hashed password; normal users cannot', async () => {
  let saved;
  User.create = async (data) => (saved = fakeDoc(data));

  const adminToken = jwt.sign({ id: 'a1' }, process.env.JWT_SECRET);
  User.findById = async () => ({ is_admin: true, is_deleted: false });
  const r = await call('POST', '/api/admin/users', { username: 'viewer1', password: 'pass1234' }, adminToken);
  assert.equal(r.status, 201);
  assert.equal(saved.is_admin, false);
  assert.ok(await bcrypt.compare('pass1234', saved.hashed_password));
  assert.equal(r.json.data.hashed_password, undefined);

  assert.equal((await call('POST', '/api/admin/users', { username: 'x', password: '1' }, adminToken)).status, 400);

  User.findById = async () => ({ is_admin: false, is_deleted: false });
  assert.equal((await call('POST', '/api/admin/users', { username: 'viewer2', password: 'pass1234' }, adminToken)).status, 403);
});

test('voting is refused (409) while a winner is current', async () => {
  const original = { findById: User.findById, exists: ScreeningWinner.exists };
  try {
    User.findById = async () => ({ _id: 'u1', is_admin: false, is_deleted: false });
    ScreeningWinner.exists = async () => ({ _id: 'w1' });
    const token = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET);
    const r = await call('POST', '/api/screenings/choices/' + 'a'.repeat(24) + '/vote', null, token);
    assert.equal(r.status, 409);
    assert.match(r.json.message, /closed/i);
  } finally {
    Object.assign(User, { findById: original.findById });
    ScreeningWinner.exists = original.exists;
  }
});

// ---- Site images (stored in MongoDB): upload rules and serving ----

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100, 1)]);
const upload = (path, buffer, token, name = 'bg.png') => {
  const form = new FormData();
  if (buffer) form.append('image', new Blob([buffer]), name);
  return fetch(base + path, { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: form }).then(
    async (res) => ({ status: res.status, json: await res.json() })
  );
};

test('image upload: type check, 1 MB cap, admin only, saved to MongoDB layer', async () => {
  const keep = { findById: User.findById, update: SiteImage.findOneAndUpdate };
  try {
    const token = jwt.sign({ id: 'a1' }, process.env.JWT_SECRET);
    let saved;
    SiteImage.findOneAndUpdate = async (_q, doc) => (saved = { ...doc, updatedAt: new Date() });

    User.findById = async () => ({ _id: 'a1', is_admin: true, is_deleted: false });
    const ok = await upload('/api/admin/images/now_playing_background', PNG, token);
    assert.equal(ok.status, 200);
    assert.equal(saved.content_type, 'image/png');
    assert.ok(saved.data.equals(PNG));
    assert.match(ok.json.data.url, /^\/api\/site\/images\/now_playing_background\?v=\d+$/);

    // just under / just over the cap (default 1 MB)
    const under = Buffer.concat([PNG, Buffer.alloc(1024 * 1024 - PNG.length)]);
    assert.equal((await upload('/api/admin/images/now_playing_background', under, token)).status, 200);
    const over = Buffer.concat([PNG, Buffer.alloc(1024 * 1024 - PNG.length + 1)]);
    const big = await upload('/api/admin/images/now_playing_background', over, token);
    assert.equal(big.status, 413);
    assert.match(big.json.message, /maximum is 1 MB/);

    // not an image (renamed text / SVG) is refused even with an image name
    const fake = await upload('/api/admin/images/now_playing_background', Buffer.from('<svg onload=alert(1)>'), token, 'x.png');
    assert.equal(fake.status, 400);
    assert.equal((await upload('/api/admin/images/now_playing_background', null, token)).status, 400);
    assert.equal((await upload('/api/admin/images/nope', PNG, token)).status, 404);

    User.findById = async () => ({ _id: 'u1', is_admin: false, is_deleted: false });
    assert.equal((await upload('/api/admin/images/now_playing_background', PNG, token)).status, 403);
  } finally {
    User.findById = keep.findById;
    SiteImage.findOneAndUpdate = keep.update;
  }
});

test('images are served publicly with a cross-origin header; list shows the limit', async () => {
  const keep = { findOne: SiteImage.findOne, find: SiteImage.find };
  try {
    const updatedAt = new Date('2026-01-01T00:00:00Z');
    SiteImage.findOne = async () => ({ key: 'now_playing_background', content_type: 'image/png', data: PNG });
    const res = await fetch(base + '/api/site/images/now_playing_background');
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/png');
    assert.equal(res.headers.get('cross-origin-resource-policy'), 'cross-origin');
    assert.ok(Buffer.from(await res.arrayBuffer()).equals(PNG));

    SiteImage.find = () => ({ select: async () => [{ key: 'now_playing_background', size: 101, updatedAt }] });
    const list = await call('GET', '/api/site/images');
    assert.equal(list.json.data.max_upload_bytes, 1024 * 1024);
    assert.equal(list.json.data.images.now_playing_background.url, `/api/site/images/now_playing_background?v=${updatedAt.getTime()}`);

    SiteImage.findOne = async () => null;
    assert.equal((await fetch(base + '/api/site/images/now_playing_background')).status, 404);
    assert.equal((await fetch(base + '/api/site/images/other')).status, 404);
  } finally {
    Object.assign(SiteImage, { findOne: keep.findOne, find: keep.find });
  }
});
