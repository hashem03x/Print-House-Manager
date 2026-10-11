import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { startTestApi, validTask } from './helpers.js';

let api;
const { customPaperSize: _omit, ...baseTask } = validTask;
const predefined = { ...baseTask, paperSize: 'A4' };
const custom = { ...validTask, paperSize: 'custom', customPaperSize: { width: 320, height: 450, unit: 'mm' } };

before(async () => {
  api = await startTestApi();
});

after(async () => {
  await api?.stop();
});

beforeEach(async () => {
  await api.Task.deleteMany({});
});

describe('Task status', () => {
  test('new tasks default to pending; status can be set on create', async () => {
    const a = (await api.request('POST', '/tasks', predefined)).body.data;
    const b = (await api.request('POST', '/tasks', { ...predefined, status: 'completed' })).body.data;
    assert.equal(a.status, 'pending');
    assert.equal(b.status, 'completed');
  });

  test('rejects an invalid status on create', async () => {
    const { status, body } = await api.request('POST', '/tasks', { ...predefined, status: 'done' });
    assert.equal(status, 400);
    assert.ok(body.errors.status);
  });

  test('PATCH /:id/status updates and persists the status, returning the task', async () => {
    const task = (await api.request('POST', '/tasks', predefined)).body.data;

    const done = await api.request('PATCH', `/tasks/${task.id}/status`, { status: 'completed' });
    assert.equal(done.status, 200);
    assert.equal(done.body.data.status, 'completed');
    assert.equal(done.body.data.description, task.description);
    assert.equal((await api.Task.findById(task.id).lean()).status, 'completed');

    const back = await api.request('PATCH', `/tasks/${task.id}/status`, { status: 'pending' });
    assert.equal(back.body.data.status, 'pending');
    assert.equal(back.body.data.createdAt, task.createdAt);
  });

  test('PATCH /:id/status validates input and existence', async () => {
    const task = (await api.request('POST', '/tasks', predefined)).body.data;
    assert.equal((await api.request('PATCH', `/tasks/${task.id}/status`, { status: 'archived' })).status, 400);
    assert.equal((await api.request('PATCH', `/tasks/${task.id}/status`, {})).status, 400);
    assert.equal((await api.request('PATCH', '/tasks/bad-id/status', { status: 'completed' })).status, 400);
    assert.equal((await api.request('PATCH', '/tasks/6708f1a2c3b4d5e6f7a8b999/status', { status: 'completed' })).status, 404);
  });

  test('PUT can also change status', async () => {
    const task = (await api.request('POST', '/tasks', predefined)).body.data;
    const { body } = await api.request('PUT', `/tasks/${task.id}`, { status: 'completed' });
    assert.equal(body.data.status, 'completed');
  });

  test('legacy documents without a status read, filter and count as pending', async () => {
    const now = new Date();
    await api.Task.collection.insertOne({
      description: 'legacy job',
      taskDate: new Date('2026-01-01T00:00:00Z'),
      paperType: 'matte',
      paperSize: 'A4',
      price: 10,
      createdAt: now,
      updatedAt: now,
    });
    await api.request('POST', '/tasks', { ...predefined, status: 'completed', price: 5 });

    const list = (await api.request('GET', '/tasks')).body.data.tasks;
    assert.equal(list.find((t) => t.description === 'legacy job').status, 'pending');

    const pending = (await api.request('GET', '/tasks?status=pending')).body.data;
    assert.deepEqual(pending.tasks.map((t) => t.description), ['legacy job']);
    const completed = (await api.request('GET', '/tasks?status=completed')).body.data;
    assert.equal(completed.pagination.total, 1);

    const stats = (await api.request('GET', '/tasks/stats')).body.data;
    assert.equal(stats.totalTasks, 2);
    assert.equal(stats.pendingTasks, 1);
    assert.equal(stats.completedTasks, 1);
    assert.equal(stats.totalValue, 15);

    // Editing a legacy task still works
    const legacy = list.find((t) => t.description === 'legacy job');
    const edited = await api.request('PUT', `/tasks/${legacy.id}`, { price: 20 });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.data.status, 'pending');
  });

  test('status filter combines with search, paper filters, sorting and pagination', async () => {
    for (let i = 1; i <= 6; i++) {
      await api.request('POST', '/tasks', {
        ...predefined,
        description: `Flyer ${i}`,
        price: i * 10,
        status: i % 2 === 0 ? 'completed' : 'pending',
      });
    }
    await api.request('POST', '/tasks', { ...predefined, description: 'Banner', paperType: 'glossy', status: 'completed' });

    const { body } = await api.request(
      'GET',
      '/tasks?status=completed&search=flyer&paperType=matte&paperSize=A4&sortBy=price&order=desc&limit=2&page=1'
    );
    assert.equal(body.data.pagination.total, 3);
    assert.equal(body.data.pagination.totalPages, 2);
    assert.deepEqual(body.data.tasks.map((t) => t.price), [60, 40]);

    assert.equal((await api.request('GET', '/tasks?status=bogus')).status, 400);
  });
});

describe('Custom paper size', () => {
  test('creates a custom-size task with dimensions in mm', async () => {
    const { status, body } = await api.request('POST', '/tasks', custom);
    assert.equal(status, 201);
    assert.deepEqual(body.data.customPaperSize, { width: 320, height: 450, unit: 'mm' });

    const fetched = (await api.request('GET', `/tasks/${body.data.id}`)).body.data;
    assert.deepEqual(fetched.customPaperSize, { width: 320, height: 450, unit: 'mm' });
  });

  test('predefined sizes have no dimensions', async () => {
    const { body } = await api.request('POST', '/tasks', predefined);
    assert.equal(body.data.customPaperSize, undefined);
  });

  const invalid = [
    ['missing dimensions', { paperSize: 'custom', customPaperSize: undefined }, 'customPaperSize'],
    ['null dimensions', { paperSize: 'custom', customPaperSize: null }, 'customPaperSize'],
    ['zero width', { customPaperSize: { width: 0, height: 450, unit: 'mm' } }, 'customPaperSize.width'],
    ['negative height', { customPaperSize: { width: 320, height: -1, unit: 'mm' } }, 'customPaperSize.height'],
    ['string width', { customPaperSize: { width: '320', height: 450, unit: 'mm' } }, 'customPaperSize.width'],
    ['empty height', { customPaperSize: { width: 320, height: '', unit: 'mm' } }, 'customPaperSize.height'],
    ['missing unit', { customPaperSize: { width: 320, height: 450 } }, 'customPaperSize.unit'],
    ['unsupported unit', { customPaperSize: { width: 32, height: 45, unit: 'ft' } }, 'customPaperSize.unit'],
    ['translated unit label', { customPaperSize: { width: 32, height: 45, unit: 'سم' } }, 'customPaperSize.unit'],
    ['over 10 m in meters', { customPaperSize: { width: 11, height: 1, unit: 'm' } }, 'customPaperSize.width'],
    ['over 10 m in inches', { customPaperSize: { width: 1, height: 400, unit: 'in' } }, 'customPaperSize.height'],
    ['huge width', { customPaperSize: { width: 20000, height: 450, unit: 'mm' } }, 'customPaperSize.width'],
    ['not an object', { customPaperSize: '320x450' }, 'customPaperSize'],
  ];
  for (const [name, override, key] of invalid) {
    test(`rejects ${name}`, async () => {
      const { status, body } = await api.request('POST', '/tasks', { ...custom, ...override });
      assert.equal(status, 400);
      assert.ok(body.errors[key], `expected error key ${key}, got ${JSON.stringify(body.errors)}`);
    });
  }

  test('rejects dimensions with a predefined size', async () => {
    const { status, body } = await api.request('POST', '/tasks', { ...predefined, customPaperSize: { width: 1, height: 1, unit: 'mm' } });
    assert.equal(status, 400);
    assert.ok(body.errors.customPaperSize);
  });

  test('switching custom -> predefined clears stored dimensions', async () => {
    const task = (await api.request('POST', '/tasks', custom)).body.data;
    const { status, body } = await api.request('PUT', `/tasks/${task.id}`, { paperSize: 'A3', customPaperSize: null });
    assert.equal(status, 200);
    assert.equal(body.data.paperSize, 'A3');
    assert.equal(body.data.customPaperSize, undefined);
    const stored = await api.Task.findById(task.id).lean();
    assert.equal(stored.customPaperSize, undefined);
  });

  test('switching to predefined without sending null also clears dimensions', async () => {
    const task = (await api.request('POST', '/tasks', custom)).body.data;
    const { body } = await api.request('PUT', `/tasks/${task.id}`, { paperSize: 'A5' });
    assert.equal(body.data.customPaperSize, undefined);
  });

  test('predefined -> custom requires dimensions', async () => {
    const task = (await api.request('POST', '/tasks', predefined)).body.data;
    const missing = await api.request('PUT', `/tasks/${task.id}`, { paperSize: 'custom' });
    assert.equal(missing.status, 400);
    assert.ok(missing.body.errors.customPaperSize);

    const ok = await api.request('PUT', `/tasks/${task.id}`, { paperSize: 'custom', customPaperSize: { width: 21.05, height: 9.9, unit: 'cm' } });
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.body.data.customPaperSize, { width: 21.05, height: 9.9, unit: 'cm' });
  });

  test('editing other fields preserves custom dimensions', async () => {
    const task = (await api.request('POST', '/tasks', custom)).body.data;
    const { body } = await api.request('PUT', `/tasks/${task.id}`, { price: 1, description: 'Edited' });
    assert.deepEqual(body.data.customPaperSize, { width: 320, height: 450, unit: 'mm' });
  });

  test('updating only dimensions works for custom tasks and is rejected for predefined ones', async () => {
    const c = (await api.request('POST', '/tasks', custom)).body.data;
    const updated = await api.request('PUT', `/tasks/${c.id}`, { customPaperSize: { width: 100, height: 200, unit: 'mm' } });
    assert.deepEqual(updated.body.data.customPaperSize, { width: 100, height: 200, unit: 'mm' });

    const p = (await api.request('POST', '/tasks', predefined)).body.data;
    const rejected = await api.request('PUT', `/tasks/${p.id}`, { customPaperSize: { width: 100, height: 200, unit: 'mm' } });
    assert.equal(rejected.status, 400);
  });

  test('clearing dimensions on a custom task is rejected', async () => {
    const task = (await api.request('POST', '/tasks', custom)).body.data;
    const { status } = await api.request('PUT', `/tasks/${task.id}`, { customPaperSize: null });
    assert.equal(status, 400);
  });
});

describe('Custom paper size units', () => {
  const cases = [
    { width: 320, height: 450, unit: 'mm' },
    { width: 32, height: 45, unit: 'cm' },
    { width: 0.32, height: 0.45, unit: 'm' },
    { width: 12.6, height: 17.7, unit: 'in' },
  ];

  for (const dims of cases) {
    test(`stores and returns dimensions exactly as entered in ${dims.unit}`, async () => {
      const created = await api.request('POST', '/tasks', { ...custom, customPaperSize: dims });
      assert.equal(created.status, 201);
      assert.deepEqual(created.body.data.customPaperSize, dims);
      const fetched = (await api.request('GET', `/tasks/${created.body.data.id}`)).body.data;
      assert.deepEqual(fetched.customPaperSize, dims);
      const listed = (await api.request('GET', '/tasks?paperSize=custom')).body.data.tasks[0];
      assert.deepEqual(listed.customPaperSize, dims);
    });
  }

  test('changing only the unit keeps the numbers unchanged', async () => {
    const task = (await api.request('POST', '/tasks', custom)).body.data;
    const { body } = await api.request('PUT', `/tasks/${task.id}`, {
      customPaperSize: { width: 320, height: 450, unit: 'cm' },
    });
    assert.deepEqual(body.data.customPaperSize, { width: 320, height: 450, unit: 'cm' });
  });

  test('accepts the maximum (10 m) in every unit', async () => {
    for (const dims of [
      { width: 10000, height: 1, unit: 'mm' },
      { width: 1000, height: 1, unit: 'cm' },
      { width: 10, height: 1, unit: 'm' },
      { width: 393.7, height: 1, unit: 'in' },
    ]) {
      const { status } = await api.request('POST', '/tasks', { ...custom, customPaperSize: dims });
      assert.equal(status, 201, JSON.stringify(dims));
    }
  });

  test('legacy custom sizes without a unit are treated as millimeters', async () => {
    const now = new Date();
    const { insertedId } = await api.Task.collection.insertOne({
      description: 'legacy custom',
      taskDate: new Date('2026-01-01T00:00:00Z'),
      paperType: 'other',
      paperSize: 'custom',
      customPaperSize: { width: 500, height: 700 },
      price: 10,
      createdAt: now,
      updatedAt: now,
    });
    const id = insertedId.toString();
    const fetched = (await api.request('GET', `/tasks/${id}`)).body.data;
    assert.deepEqual(fetched.customPaperSize, { width: 500, height: 700, unit: 'mm' });

    // Editing unrelated fields keeps the dimensions (now explicitly stored as mm).
    const edited = await api.request('PUT', `/tasks/${id}`, { price: 20 });
    assert.equal(edited.status, 200);
    assert.deepEqual(edited.body.data.customPaperSize, { width: 500, height: 700, unit: 'mm' });
  });
});

describe('Status update integrity and error codes', () => {
  test('PATCH status changes only status and keeps the same document', async () => {
    const created = (await api.request('POST', '/tasks', { ...custom, customPaperSize: { width: 12.6, height: 17.7, unit: 'in' } })).body.data;
    const before = await api.Task.findById(created.id).lean();

    const { status, body } = await api.request('PATCH', `/tasks/${created.id}/status`, { status: 'completed' });
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.id, created.id);

    const after = await api.Task.findById(created.id).lean();
    assert.ok(after, 'document must still exist');
    assert.equal(after.status, 'completed');
    for (const field of ['description', 'taskDate', 'paperType', 'paperSize', 'price', 'createdAt']) {
      assert.deepEqual(after[field], before[field], field);
    }
    assert.deepEqual(after.customPaperSize, { width: 12.6, height: 17.7, unit: 'in' });
    assert.equal(await api.Task.countDocuments(), 1);

    // Ignores any other fields sent to the status endpoint.
    await api.request('PATCH', `/tasks/${created.id}/status`, { status: 'pending', price: 0, description: 'hack' });
    const again = await api.Task.findById(created.id).lean();
    assert.equal(again.status, 'pending');
    assert.equal(again.price, before.price);
    assert.equal(again.description, before.description);
  });

  test('works for a task on a later page and while other tasks exist', async () => {
    const ids = [];
    for (let i = 0; i < 12; i++) ids.push((await api.request('POST', '/tasks', { ...predefined, description: `T${i}` })).body.data.id);
    const page2 = (await api.request('GET', '/tasks?page=2&limit=10')).body.data.tasks;
    const target = page2[0];
    const { status } = await api.request('PATCH', `/tasks/${target.id}/status`, { status: 'completed' });
    assert.equal(status, 200);
    assert.equal(await api.Task.countDocuments(), 12);
    assert.equal((await api.request('GET', '/tasks?status=completed')).body.data.tasks[0].id, target.id);
  });

  test('distinguishes a missing task from a missing route', async () => {
    const missing = await api.request('PATCH', '/tasks/6708f1a2c3b4d5e6f7a8b999/status', { status: 'completed' });
    assert.equal(missing.status, 404);
    assert.equal(missing.body.code, 'TASK_NOT_FOUND');

    const route = await api.request('POST', '/tasks/6708f1a2c3b4d5e6f7a8b999/complete', { status: 'completed' });
    assert.equal(route.status, 404);
    assert.equal(route.body.code, 'ROUTE_NOT_FOUND');

    const badId = await api.request('PATCH', '/tasks/123/status', { status: 'completed' });
    assert.equal(badId.status, 400);
    assert.equal(badId.body.code, 'INVALID_ID');

    const badBody = await api.request('PATCH', `/tasks/6708f1a2c3b4d5e6f7a8b999/status`, { status: 'done' });
    assert.equal(badBody.body.code, 'VALIDATION_ERROR');
  });

  test('deletion still works independently of status', async () => {
    const task = (await api.request('POST', '/tasks', predefined)).body.data;
    await api.request('PATCH', `/tasks/${task.id}/status`, { status: 'completed' });
    const del = await api.request('DELETE', `/tasks/${task.id}`);
    assert.equal(del.status, 200);
    const gone = await api.request('GET', `/tasks/${task.id}`);
    assert.equal(gone.status, 404);
    assert.equal(gone.body.code, 'TASK_NOT_FOUND');
  });
});
