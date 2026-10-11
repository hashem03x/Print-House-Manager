import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, test } from 'node:test';

// The app is started WITHOUT a database connection to verify graceful degradation.
let server;
let base;

before(async () => {
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/unreachable';
  process.env.NODE_ENV = 'test';
  const { default: app } = await import('../src/app.js');
  server = app.listen(0);
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(() => new Promise((resolve) => server.close(resolve)));

test('health reports the database as disconnected with 503', async () => {
  const res = await fetch(`${base}/health`);
  const body = await res.json();
  assert.equal(res.status, 503);
  assert.equal(body.data.database, 'disconnected');
});

test('task routes fail fast with 503 instead of hanging', async () => {
  const started = Date.now();
  for (const [method, path] of [
    ['GET', '/tasks'],
    ['GET', '/tasks/stats'],
    ['POST', '/tasks'],
  ]) {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: method === 'POST' ? '{}' : undefined });
    const body = await res.json();
    assert.equal(res.status, 503, `${method} ${path}`);
    assert.equal(body.success, false);
    assert.doesNotMatch(JSON.stringify(body), /mongodb:\/\//);
  }
  assert.ok(Date.now() - started < 2000);
});
