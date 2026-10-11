import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, test } from 'node:test';

// The app is pointed at an address where nothing listens, to verify that
// requests fail quickly with a clear 503 and a sanitized reason.
let server;
let base;

before(async () => {
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/unreachable';
  process.env.NODE_ENV = 'test';
  process.env.DB_CONNECT_TIMEOUT_MS = '1000';
  const { default: app } = await import('../src/app.js');
  server = app.listen(0);
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(() => new Promise((resolve) => server.close(resolve)));

test('health reports the database as disconnected with a sanitized reason', async () => {
  const started = Date.now();
  const res = await fetch(`${base}/health`);
  const body = await res.json();
  assert.equal(res.status, 503);
  assert.equal(body.data.api, 'up');
  assert.equal(body.data.database, 'disconnected');
  assert.equal(body.data.databaseReason, 'connection_refused');
  assert.doesNotMatch(JSON.stringify(body), /mongodb:\/\/|127\.0\.0\.1/);
  assert.ok(Date.now() - started < 3000, 'bounded by DB_CONNECT_TIMEOUT_MS');
});

test('task routes answer 503 DB_UNAVAILABLE quickly instead of hanging', async () => {
  const started = Date.now();
  for (const [method, path] of [
    ['GET', '/tasks'],
    ['GET', '/tasks/stats'],
    ['POST', '/tasks'],
    ['PATCH', '/tasks/6708f1a2c3b4d5e6f7a8b901/status'],
  ]) {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : '{}',
    });
    const body = await res.json();
    assert.equal(res.status, 503, `${method} ${path}`);
    assert.equal(body.code, 'DB_UNAVAILABLE');
    assert.doesNotMatch(JSON.stringify(body), /mongodb:\/\//);
  }
  // Within the retry cooldown, requests reuse the last failure instead of waiting again.
  assert.ok(Date.now() - started < 2500, `took ${Date.now() - started}ms`);
});
