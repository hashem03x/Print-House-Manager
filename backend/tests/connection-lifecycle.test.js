import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Reproduces the serverless deployment: only src/app.js is imported (as Vercel
 * does) — server.js and its startup connection never run. Requests must open
 * the shared connection themselves, exactly once.
 */
let mongo;
let server;
let base;
let connectCalls = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(check, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return true;
    await sleep(250);
  }
  return false;
}
const health = async () => (await fetch(`${base}/health`)).json();

before(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri('phm-lifecycle');
  process.env.NODE_ENV = 'test';
  process.env.DB_CONNECT_TIMEOUT_MS = '2000';

  // Count real connection attempts on the same mongoose instance the app uses.
  const originalConnect = mongoose.connect.bind(mongoose);
  mongoose.connect = (...args) => {
    connectCalls += 1;
    return originalConnect(...args);
  };

  const { default: app } = await import('../src/app.js');
  server = app.listen(0);
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.connection.close();
  await mongo.stop();
});

test('a cold app (no server.js) connects on the first request and serves data', async () => {
  assert.equal(mongoose.connection.readyState, 0, 'nothing connected before the first request');

  const created = await fetch(`${base}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: 'cold start', taskDate: '2026-10-11', paperType: 'matte_sticker', paperSize: 'A4', paperWeight: 100, price: 5 }),
  });
  assert.equal(created.status, 201);

  const list = await (await fetch(`${base}/tasks`)).json();
  assert.equal(list.success, true);
  assert.equal(list.data.pagination.total, 1);
});

test('concurrent requests share one connection (no connection per request)', async () => {
  const responses = await Promise.all(Array.from({ length: 25 }, () => fetch(`${base}/tasks/stats`)));
  assert.ok(responses.every((res) => res.status === 200));
  assert.equal(connectCalls, 1, 'mongoose.connect must be called exactly once');
  assert.equal(mongoose.connections.length, 1);
});

test('health reflects the real database state', async () => {
  const body = await health();
  assert.equal(body.data.database, 'connected');
  assert.equal(body.data.databaseReason, null);
  assert.equal(body.success, true);
});

test('recovers from a temporary disconnection without reconnecting manually', { timeout: 90_000 }, async () => {
  await mongo.stop({ doCleanup: false, force: false });

  // The driver notices the outage via its heartbeat; health turns 503.
  const sawDown = await waitFor(async () => (await health()).data.database !== 'connected', 40_000);
  assert.ok(sawDown, 'health should report the outage');

  const during = await fetch(`${base}/tasks`);
  assert.equal(during.status, 503);
  assert.equal((await during.json()).code, 'DB_UNAVAILABLE');

  await mongo.start(true); // same port
  const recovered = await waitFor(async () => (await fetch(`${base}/tasks`)).status === 200, 40_000);
  assert.ok(recovered, 'requests should succeed again after MongoDB returns');
  assert.equal((await health()).data.database, 'connected');
  assert.equal(connectCalls, 1, 'the driver reconnects by itself; no second mongoose.connect');

  const list = await (await fetch(`${base}/tasks`)).json();
  assert.equal(list.data.pagination.total, 1, 'data intact after reconnect');
});
