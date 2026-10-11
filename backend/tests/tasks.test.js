import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { startTestApi, validTask } from './helpers.js';

let api;

before(async () => {
  api = await startTestApi();
});

after(async () => {
  await api?.stop();
});

beforeEach(async () => {
  await api.Task.deleteMany({});
});

describe('GET /api/health', () => {
  test('reports a connected database', async () => {
    const { status, body } = await api.request('GET', '/health');
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.database, 'connected');
  });
});

describe('POST /api/tasks', () => {
  test('creates a task and persists it', async () => {
    const { status, body } = await api.request('POST', '/tasks', validTask);
    assert.equal(status, 201);
    assert.equal(body.success, true);
    assert.match(body.data.id, /^[a-f\d]{24}$/);
    assert.equal(body.data.taskDate, '2026-10-20T00:00:00.000Z');
    assert.ok(body.data.createdAt && body.data.updatedAt);

    const stored = await api.Task.findById(body.data.id).lean();
    assert.equal(stored.description, validTask.description);
    assert.equal(stored.price, 450);
  });

  test('ignores client-supplied timestamps and ids', async () => {
    const { status, body } = await api.request('POST', '/tasks', {
      ...validTask,
      _id: '6708f1a2c3b4d5e6f7a8b901',
      createdAt: '2000-01-01T00:00:00.000Z',
      updatedAt: '2000-01-01T00:00:00.000Z',
      hacked: true,
    });
    assert.equal(status, 201);
    assert.notEqual(body.data.id, '6708f1a2c3b4d5e6f7a8b901');
    assert.ok(new Date(body.data.createdAt).getFullYear() > 2000);
    assert.equal(body.data.hacked, undefined);
  });

  test('trims the description and rounds price to 2 decimals', async () => {
    const { body } = await api.request('POST', '/tasks', { ...validTask, description: '  Flyers  ', price: 10.005 });
    assert.equal(body.data.description, 'Flyers');
    assert.equal(body.data.price, 10.01);
  });

  test('keeps the calendar date when given a full ISO timestamp', async () => {
    const { body } = await api.request('POST', '/tasks', { ...validTask, taskDate: '2026-10-20T23:30:00+05:00' });
    assert.equal(body.data.taskDate, '2026-10-20T00:00:00.000Z');
  });

  test('requires every field', async () => {
    const { status, body } = await api.request('POST', '/tasks', {});
    assert.equal(status, 400);
    assert.equal(body.success, false);
    assert.deepEqual(Object.keys(body.errors).sort(), ['description', 'paperSize', 'paperType', 'paperWeight', 'price', 'quantity', 'taskDate']);
  });

  const invalidCases = [
    ['negative price', { price: -1 }, 'price'],
    ['price as string', { price: '450' }, 'price'],
    ['NaN-like price', { price: 'abc' }, 'price'],
    ['huge price', { price: 1e12 }, 'price'],
    ['blank description', { description: '   ' }, 'description'],
    ['too long description', { description: 'x'.repeat(501) }, 'description'],
    ['unknown paper type', { paperType: 'shiny' }, 'paperType'],
    ['translated paper type label', { paperType: 'Glossy' }, 'paperType'],
    ['unknown paper size', { paperSize: 'B9' }, 'paperSize'],
    ['impossible date', { taskDate: '2026-02-30' }, 'taskDate'],
    ['non-date string', { taskDate: 'tomorrow' }, 'taskDate'],
    ['numeric date', { taskDate: 1760000000000 }, 'taskDate'],
  ];
  for (const [name, override, field] of invalidCases) {
    test(`rejects ${name}`, async () => {
      const { status, body } = await api.request('POST', '/tasks', { ...validTask, ...override });
      assert.equal(status, 400);
      assert.ok(body.errors[field], `expected an error for ${field}`);
    });
  }

  test('rejects malformed JSON', async () => {
    const { status, body } = await api.request('POST', '/tasks', '{bad json');
    assert.equal(status, 400);
    assert.equal(body.message, 'Request body contains invalid JSON');
  });

  test('rejects a non-object body', async () => {
    const { status } = await api.request('POST', '/tasks', '[1,2]');
    assert.equal(status, 400);
  });
});

describe('GET /api/tasks/:id', () => {
  test('returns a single task', async () => {
    const created = (await api.request('POST', '/tasks', validTask)).body.data;
    const { status, body } = await api.request('GET', `/tasks/${created.id}`);
    assert.equal(status, 200);
    assert.equal(body.data.id, created.id);
  });

  test('rejects an invalid ObjectId', async () => {
    const { status, body } = await api.request('GET', '/tasks/not-an-id');
    assert.equal(status, 400);
    assert.equal(body.message, 'Invalid task ID');
  });

  test('returns 404 for a missing task', async () => {
    const { status, body } = await api.request('GET', '/tasks/6708f1a2c3b4d5e6f7a8b999');
    assert.equal(status, 404);
    assert.equal(body.message, 'Task not found');
  });
});

describe('PUT /api/tasks/:id', () => {
  test('updates fields, bumps updatedAt and never changes createdAt', async () => {
    const created = (await api.request('POST', '/tasks', validTask)).body.data;
    await new Promise((resolve) => setTimeout(resolve, 15));

    const { status, body } = await api.request('PUT', `/tasks/${created.id}`, {
      price: 500,
      taskDate: '2026-11-01',
      createdAt: '2000-01-01T00:00:00.000Z',
    });
    assert.equal(status, 200);
    assert.equal(body.data.price, 500);
    assert.equal(body.data.taskDate, '2026-11-01T00:00:00.000Z');
    assert.equal(body.data.createdAt, created.createdAt);
    assert.notEqual(body.data.updatedAt, created.updatedAt);

    const stored = await api.Task.findById(created.id).lean();
    assert.equal(stored.createdAt.toISOString(), created.createdAt);
    assert.equal(stored.description, validTask.description);
  });

  test('requires at least one writable field', async () => {
    const created = (await api.request('POST', '/tasks', validTask)).body.data;
    const { status } = await api.request('PUT', `/tasks/${created.id}`, { createdAt: '2000-01-01' });
    assert.equal(status, 400);
  });

  test('validates provided fields', async () => {
    const created = (await api.request('POST', '/tasks', validTask)).body.data;
    const { status, body } = await api.request('PUT', `/tasks/${created.id}`, { price: -5 });
    assert.equal(status, 400);
    assert.ok(body.errors.price);
  });

  test('returns 404 for a missing task', async () => {
    const { status } = await api.request('PUT', '/tasks/6708f1a2c3b4d5e6f7a8b999', { price: 1 });
    assert.equal(status, 404);
  });
});

describe('DELETE /api/tasks/:id', () => {
  test('deletes a task', async () => {
    const created = (await api.request('POST', '/tasks', validTask)).body.data;
    const { status, body } = await api.request('DELETE', `/tasks/${created.id}`);
    assert.equal(status, 200);
    assert.equal(body.data.id, created.id);
    assert.equal(await api.Task.countDocuments(), 0);

    const again = await api.request('DELETE', `/tasks/${created.id}`);
    assert.equal(again.status, 404);
  });
});

describe('GET /api/tasks (list)', () => {
  const seeds = [
    { description: 'Flyers glossy', taskDate: '2026-10-05', paperType: 'glossy_heavy', paperSize: 'A4', paperWeight: 100, quantity: 1, price: 100 },
    {
      description: 'Banner opening (a+b)',
      taskDate: '2026-10-01',
      paperType: 'glossy_sticker',
      paperSize: 'custom',
      customPaperSize: { width: 3, height: 1, unit: 'm' },
      paperWeight: 120,
      quantity: 1,
      price: 900,
    },
    { description: 'كروت شخصية', taskDate: '2026-10-03', paperType: 'matte_sticker', paperSize: 'A5', paperWeight: 100, quantity: 1, price: 300 },
    { description: 'Letterheads', taskDate: '2026-10-04', paperType: 'bristol', paperSize: 'A4', paperWeight: 100, quantity: 1, price: 50 },
    { description: 'Flyers matte', taskDate: '2026-10-02', paperType: 'matte_sticker', paperSize: 'A4', paperWeight: 100, quantity: 1, price: 200 },
  ];

  beforeEach(async () => {
    for (const seed of seeds) await api.request('POST', '/tasks', seed);
  });

  test('returns tasks with pagination metadata, newest first by default', async () => {
    const { status, body } = await api.request('GET', '/tasks');
    assert.equal(status, 200);
    assert.equal(body.data.tasks.length, 5);
    assert.equal(body.data.tasks[0].description, 'Flyers matte');
    assert.deepEqual(body.data.pagination, {
      page: 1, limit: 10, total: 5, totalPages: 1, hasNextPage: false, hasPrevPage: false,
    });
  });

  test('paginates with stable sorting', async () => {
    const page1 = (await api.request('GET', '/tasks?limit=2&page=1&sortBy=price&order=asc')).body.data;
    const page3 = (await api.request('GET', '/tasks?limit=2&page=3&sortBy=price&order=asc')).body.data;
    assert.deepEqual(page1.tasks.map((t) => t.price), [50, 100]);
    assert.deepEqual(page3.tasks.map((t) => t.price), [900]);
    assert.equal(page1.pagination.totalPages, 3);
    assert.equal(page1.pagination.hasNextPage, true);
    assert.equal(page3.pagination.hasNextPage, false);
    assert.equal(page3.pagination.hasPrevPage, true);
  });

  test('sorts by taskDate', async () => {
    const { body } = await api.request('GET', '/tasks?sortBy=taskDate&order=asc');
    assert.deepEqual(body.data.tasks.map((t) => t.taskDate.slice(0, 10)), [
      '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05',
    ]);
  });

  test('combines search, filters, sorting and pagination', async () => {
    const { body } = await api.request(
      'GET',
      '/tasks?search=flyers&paperSize=A4&sortBy=price&order=desc&limit=1&page=2'
    );
    assert.equal(body.data.pagination.total, 2);
    assert.equal(body.data.tasks.length, 1);
    assert.equal(body.data.tasks[0].description, 'Flyers glossy');
  });

  test('filters by paper type and size together', async () => {
    const { body } = await api.request('GET', '/tasks?paperType=matte_sticker&paperSize=A5');
    assert.deepEqual(body.data.tasks.map((t) => t.description), ['كروت شخصية']);
  });

  test('searches case-insensitively, in Arabic, and escapes regex characters', async () => {
    assert.equal((await api.request('GET', '/tasks?search=FLYERS')).body.data.pagination.total, 2);
    assert.equal((await api.request('GET', `/tasks?search=${encodeURIComponent('كروت')}`)).body.data.pagination.total, 1);
    assert.equal((await api.request('GET', `/tasks?search=${encodeURIComponent('(a+b)')}`)).body.data.pagination.total, 1);
    assert.equal((await api.request('GET', `/tasks?search=${encodeURIComponent('.*')}`)).body.data.pagination.total, 0);
  });

  test('returns an empty page beyond the last page', async () => {
    const { body } = await api.request('GET', '/tasks?page=9');
    assert.equal(body.data.tasks.length, 0);
    assert.equal(body.data.pagination.totalPages, 1);
  });

  test('caps the page size', async () => {
    const { body } = await api.request('GET', '/tasks?limit=1000');
    assert.equal(body.data.pagination.limit, 100);
  });

  test('rejects invalid query parameters, including non-allowlisted sort fields', async () => {
    const { status, body } = await api.request('GET', '/tasks?page=0&limit=-1&sortBy=__proto__&order=up&paperType=x&paperSize=y');
    assert.equal(status, 400);
    assert.deepEqual(Object.keys(body.errors).sort(), ['limit', 'order', 'page', 'paperSize', 'paperType', 'sortBy']);
  });
});

describe('Routing and CORS', () => {
  test('unknown routes return a JSON 404', async () => {
    const { status, body } = await api.request('GET', '/nope');
    assert.equal(status, 404);
    assert.equal(body.success, false);
  });

  test('allows the configured client origin only', async () => {
    const allowed = await api.request('GET', '/health', undefined, { Origin: 'http://localhost:5173' });
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    const blocked = await api.request('GET', '/health', undefined, { Origin: 'http://evil.example' });
    assert.equal(blocked.headers.get('access-control-allow-origin'), null);
  });
});
