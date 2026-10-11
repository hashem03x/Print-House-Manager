import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { startOfDayInTimeZone } from '../src/utils/dates.js';
import { startTestApi, validTask } from './helpers.js';

const TIME_ZONE = 'Africa/Cairo';
let api;

before(async () => {
  api = await startTestApi({ timeZone: TIME_ZONE });
});

after(async () => {
  await api?.stop();
});

beforeEach(async () => {
  await api.Task.deleteMany({});
});

test('returns zeros for an empty database', async () => {
  const { status, body } = await api.request('GET', '/tasks/stats');
  assert.equal(status, 200);
  assert.equal(body.data.totalTasks, 0);
  assert.equal(body.data.tasksToday, 0);
  assert.equal(body.data.totalValue, 0);
  assert.deepEqual(body.data.latestTasks, []);
  assert.equal(body.data.timeZone, TIME_ZONE);
});

test('computes totals, today count (business time zone) and latest tasks', async () => {
  const todayStart = startOfDayInTimeZone(new Date(), TIME_ZONE);

  // Insert directly so createdAt can be controlled; timestamps: false keeps our values.
  const docs = [
    { ...validTask, description: 'yesterday late', price: 10.1, createdAt: new Date(todayStart.getTime() - 60_000) },
    { ...validTask, description: 'today early', price: 20.2, createdAt: new Date(todayStart.getTime() + 60_000) },
    { ...validTask, description: 'old', price: 0.3, createdAt: new Date('2025-01-01T10:00:00Z') },
  ].map((doc) => ({ ...doc, taskDate: new Date('2026-10-20T00:00:00Z'), updatedAt: doc.createdAt }));
  await api.Task.collection.insertMany(docs);

  // Plus one created through the API right now.
  await api.request('POST', '/tasks', { ...validTask, description: 'just now', price: 100 });

  const { body } = await api.request('GET', '/tasks/stats');
  assert.equal(body.data.totalTasks, 4);
  assert.equal(body.data.tasksToday, 2);
  assert.equal(body.data.totalValue, 130.6); // no floating-point noise
  assert.deepEqual(
    body.data.latestTasks.map((t) => t.description),
    ['just now', 'today early', 'yesterday late', 'old']
  );
  assert.equal(body.data.todayStart, todayStart.toISOString());
});

test('stats reflect creates, updates and deletes', async () => {
  const a = (await api.request('POST', '/tasks', { ...validTask, price: 100 })).body.data;
  await api.request('POST', '/tasks', { ...validTask, price: 50 });
  await api.request('PUT', `/tasks/${a.id}`, { price: 300 });

  let stats = (await api.request('GET', '/tasks/stats')).body.data;
  assert.equal(stats.totalTasks, 2);
  assert.equal(stats.totalValue, 350);

  await api.request('DELETE', `/tasks/${a.id}`);
  stats = (await api.request('GET', '/tasks/stats')).body.data;
  assert.equal(stats.totalTasks, 1);
  assert.equal(stats.totalValue, 50);
  assert.equal(stats.tasksToday, 1);
});

test('limits latest tasks to 5', async () => {
  for (let i = 0; i < 7; i++) await api.request('POST', '/tasks', { ...validTask, description: `task ${i}` });
  const { body } = await api.request('GET', '/tasks/stats');
  assert.equal(body.data.latestTasks.length, 5);
  assert.equal(body.data.latestTasks[0].description, 'task 6');
});
