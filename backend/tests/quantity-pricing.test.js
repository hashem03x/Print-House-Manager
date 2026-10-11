import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { computeTotal } from '../src/utils/pricing.js';
import { startTestApi } from './helpers.js';

let api;
const base = { description: 'Job', taskDate: '2026-10-20', paperType: 'bristol', paperSize: 'A4', paperWeight: 100, quantity: 1, price: 10 };
const create = async (overrides) => (await api.request('POST', '/tasks', { ...base, ...overrides })).body.data;

before(async () => {
  api = await startTestApi();
});

after(async () => {
  await api?.stop();
});

beforeEach(async () => {
  await api.Task.deleteMany({});
});

describe('Quantity validation', () => {
  test('is required for new tasks', async () => {
    const { quantity: _omit, ...withoutQuantity } = base;
    const { status, body } = await api.request('POST', '/tasks', withoutQuantity);
    assert.equal(status, 400);
    assert.ok(body.errors.quantity);
  });

  for (const invalid of [0, -1, 1.5, '2', '١٠', true, 1_000_001, Number.MAX_SAFE_INTEGER]) {
    test(`rejects ${JSON.stringify(invalid)}`, async () => {
      const { status, body } = await api.request('POST', '/tasks', { ...base, quantity: invalid });
      assert.equal(status, 400);
      assert.ok(body.errors.quantity);
    });
  }

  test('accepts positive whole numbers up to the maximum', async () => {
    for (const quantity of [1, 2, 500, 1_000_000]) {
      const { status, body } = await api.request('POST', '/tasks', { ...base, quantity });
      assert.equal(status, 201);
      assert.equal(body.data.quantity, quantity);
    }
  });

  test('rejects an invalid quantity on update', async () => {
    const task = await create({});
    assert.equal((await api.request('PUT', `/tasks/${task.id}`, { quantity: 0 })).status, 400);
    assert.equal((await api.request('PUT', `/tasks/${task.id}`, { quantity: 2.5 })).status, 400);
  });
});

describe('Unit price and total', () => {
  test('total = quantity × unit price; the unit price is stored as given', async () => {
    const task = await create({ quantity: 250, price: 1.35 });
    assert.equal(task.price, 1.35);
    assert.equal(task.quantity, 250);
    assert.equal(task.total, 337.5);

    const stored = await api.Task.findById(task.id).lean();
    assert.equal(stored.price, 1.35, 'unit price is never replaced by the total');
    assert.equal(stored.total, undefined, 'total is computed, not stored');

    const fetched = (await api.request('GET', `/tasks/${task.id}`)).body.data;
    const listed = (await api.request('GET', '/tasks')).body.data.tasks[0];
    assert.equal(fetched.total, 337.5);
    assert.equal(listed.total, 337.5);
  });

  test('rounds totals to 2 decimals without floating-point noise', async () => {
    assert.equal((await create({ quantity: 3, price: 0.1 })).total, 0.3);
    assert.equal(computeTotal(19.99, 7), 139.93);
    assert.equal(computeTotal(5, undefined), 5);
  });

  test('editing quantity keeps the unit price, and vice versa', async () => {
    const task = await create({ quantity: 10, price: 4 });
    const q = (await api.request('PUT', `/tasks/${task.id}`, { quantity: 25 })).body.data;
    assert.deepEqual([q.quantity, q.price, q.total], [25, 4, 100]);
    const p = (await api.request('PUT', `/tasks/${task.id}`, { price: 4.5 })).body.data;
    assert.deepEqual([p.quantity, p.price, p.total], [25, 4.5, 112.5]);
    const s = (await api.request('PATCH', `/tasks/${task.id}/status`, { status: 'completed' })).body.data;
    assert.deepEqual([s.quantity, s.price, s.total], [25, 4.5, 112.5]);
  });

  test('dashboard total value sums task totals, not unit prices', async () => {
    await create({ quantity: 100, price: 2.5 }); // 250
    await create({ quantity: 3, price: 0.1 }); // 0.3
    await create({ quantity: 1, price: 99.99 }); // 99.99
    const stats = (await api.request('GET', '/tasks/stats')).body.data;
    assert.equal(stats.totalValue, 350.29);
    assert.ok(stats.latestTasks.every((t) => t.total === computeTotal(t.price, t.quantity)));
  });

  test('sorts by total and by quantity across pages', async () => {
    await create({ description: 'A', quantity: 1, price: 100 }); // 100
    await create({ description: 'B', quantity: 50, price: 3 }); // 150
    await create({ description: 'C', quantity: 10, price: 5 }); // 50
    await create({ description: 'D', quantity: 2, price: 60 }); // 120

    const byTotal = async (order, page) =>
      (await api.request('GET', `/tasks?sortBy=total&order=${order}&limit=2&page=${page}`)).body.data;
    const desc1 = await byTotal('desc', 1);
    const desc2 = await byTotal('desc', 2);
    assert.deepEqual([...desc1.tasks, ...desc2.tasks].map((t) => t.description), ['B', 'D', 'A', 'C']);
    assert.equal(desc1.pagination.total, 4);
    assert.ok(desc1.tasks[0].id && desc1.tasks[0].total === 150, 'aggregated results keep the normal response shape');

    const asc = (await api.request('GET', '/tasks?sortBy=total&order=asc')).body.data.tasks;
    assert.deepEqual(asc.map((t) => t.description), ['C', 'A', 'D', 'B']);

    const byQty = (await api.request('GET', '/tasks?sortBy=quantity&order=desc')).body.data.tasks;
    assert.deepEqual(byQty.map((t) => t.quantity), [50, 10, 2, 1]);

    const filtered = (await api.request('GET', '/tasks?sortBy=total&order=desc&search=a')).body.data;
    assert.deepEqual(filtered.tasks.map((t) => t.description), ['A']);
  });
});

describe('Tasks created before quantity existed', () => {
  let legacyId;

  beforeEach(async () => {
    const now = new Date();
    const { insertedId } = await api.Task.collection.insertOne({
      description: 'old flyer',
      taskDate: new Date('2026-10-11T00:00:00Z'),
      paperType: 'offset',
      paperSize: 'A4',
      price: 125,
      createdAt: now,
      updatedAt: now,
    });
    legacyId = insertedId.toString();
  });

  test('read as quantity 1 with total equal to their stored price', async () => {
    const task = (await api.request('GET', `/tasks/${legacyId}`)).body.data;
    assert.equal(task.quantity, 1);
    assert.equal(task.price, 125);
    assert.equal(task.total, 125);
    const raw = await api.Task.collection.findOne({ _id: (await api.Task.findById(legacyId))._id });
    assert.equal(raw.quantity, undefined, 'reading never rewrites the document');
  });

  test('count at their stored price in the dashboard total', async () => {
    await create({ quantity: 4, price: 25 }); // 100
    assert.equal((await api.request('GET', '/tasks/stats')).body.data.totalValue, 225);
  });

  test('sort by total treats a missing quantity as 1', async () => {
    await create({ description: 'new', quantity: 2, price: 50 }); // 100
    const tasks = (await api.request('GET', '/tasks?sortBy=total&order=desc')).body.data.tasks;
    assert.deepEqual(tasks.map((t) => t.total), [125, 100]);
  });

  test('can be edited; giving a quantity then multiplies the unit price', async () => {
    const kept = (await api.request('PUT', `/tasks/${legacyId}`, { description: 'old flyer (edited)', paperWeight: 80 })).body.data;
    assert.deepEqual([kept.quantity, kept.price, kept.total], [1, 125, 125]);
    const changed = (await api.request('PUT', `/tasks/${legacyId}`, { quantity: 4 })).body.data;
    assert.deepEqual([changed.quantity, changed.price, changed.total], [4, 125, 500]);
  });
});

describe('Carbonless paper types', () => {
  for (const paperType of ['carbon_original_copy', 'carbon_original_two_copies']) {
    test(`${paperType} can be created, edited and filtered`, async () => {
      const task = await create({ paperType, quantity: 50, price: 3 });
      assert.equal(task.paperType, paperType);
      assert.equal(task.total, 150);
      const filtered = (await api.request('GET', `/tasks?paperType=${paperType}`)).body.data;
      assert.equal(filtered.pagination.total, 1);
      const edited = (await api.request('PUT', `/tasks/${task.id}`, { paperType: 'bristol' })).body.data;
      assert.equal(edited.paperType, 'bristol');
      const back = (await api.request('PUT', `/tasks/${task.id}`, { paperType })).body.data;
      assert.equal(back.paperType, paperType);
    });
  }

  test('works with custom sizes, units and weights', async () => {
    const task = await create({
      paperType: 'carbon_original_two_copies',
      paperSize: 'custom',
      customPaperSize: { width: 21, height: 29.7, unit: 'cm' },
      paperWeight: 70,
      quantity: 3,
      price: 12.5,
    });
    assert.deepEqual(task.customPaperSize, { width: 21, height: 29.7, unit: 'cm' });
    assert.equal(task.total, 37.5);
  });
});
