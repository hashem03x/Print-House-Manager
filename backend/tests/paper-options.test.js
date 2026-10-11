import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import {
  LEGACY_PAPER_SIZES,
  LEGACY_PAPER_TYPES,
  PAPER_SIZES,
  PAPER_TYPES,
  PAPER_WEIGHTS,
} from '../src/constants/paperOptions.js';
import { startTestApi } from './helpers.js';

let api;
const base = { description: 'Job', taskDate: '2026-10-20', paperType: 'bristol', paperSize: 'A4', paperWeight: 120, quantity: 1, price: 100 };
const PREDEFINED_SIZES = PAPER_SIZES.filter((size) => size !== 'custom');

before(async () => {
  api = await startTestApi();
});

after(async () => {
  await api?.stop();
});

beforeEach(async () => {
  await api.Task.deleteMany({});
});

describe('Current paper types, sizes and weights', () => {
  test('the configured options match the specification', () => {
    assert.deepEqual([...PAPER_TYPES], ['bristol', 'glossy_heavy', 'glossy_light', 'glossy_two_side', 'matte_sticker', 'glossy_sticker', 'carbon_original_copy', 'carbon_original_two_copies']);
    assert.deepEqual([...PAPER_SIZES], ['A6', 'A4', 'A5', 'size_9', 'size_18', 'size_16', 'custom']);
    assert.deepEqual([...PAPER_WEIGHTS], [70, 80, 100, 120]);
  });

  test('every paper type works with every predefined size and is returned unchanged', async () => {
    let i = 0;
    for (const paperType of PAPER_TYPES) {
      for (const paperSize of PREDEFINED_SIZES) {
        const paperWeight = PAPER_WEIGHTS[i++ % PAPER_WEIGHTS.length];
        const { status, body } = await api.request('POST', '/tasks', { ...base, paperType, paperSize, paperWeight });
        assert.equal(status, 201, `${paperType}/${paperSize}`);
        const fetched = (await api.request('GET', `/tasks/${body.data.id}`)).body.data;
        assert.equal(fetched.paperType, paperType);
        assert.equal(fetched.paperSize, paperSize);
        assert.equal(fetched.paperWeight, paperWeight);
      }
    }
    assert.equal(await api.Task.countDocuments(), PAPER_TYPES.length * PREDEFINED_SIZES.length);
  });

  test('custom size keeps dimensions and unit alongside type and weight', async () => {
    const { status, body } = await api.request('POST', '/tasks', {
      ...base,
      paperType: 'glossy_two_side',
      paperSize: 'custom',
      customPaperSize: { width: 32, height: 45, unit: 'cm' },
      paperWeight: 70,
    });
    assert.equal(status, 201);
    assert.equal(body.data.paperType, 'glossy_two_side');
    assert.equal(body.data.paperWeight, 70);
    assert.deepEqual(body.data.customPaperSize, { width: 32, height: 45, unit: 'cm' });
  });

  for (const legacy of LEGACY_PAPER_TYPES) {
    test(`rejects retired paper type "${legacy}" for new tasks`, async () => {
      const { status, body } = await api.request('POST', '/tasks', { ...base, paperType: legacy });
      assert.equal(status, 400);
      assert.match(body.errors.paperType, /no longer available/);
    });
  }

  for (const legacy of LEGACY_PAPER_SIZES) {
    test(`rejects retired paper size "${legacy}" for new tasks`, async () => {
      const { status, body } = await api.request('POST', '/tasks', { ...base, paperSize: legacy });
      assert.equal(status, 400);
      assert.ok(body.errors.paperSize);
    });
  }

  test('rejects display labels instead of stored values', async () => {
    for (const [field, value] of [['paperType', 'Bristol'], ['paperType', 'بريستول'], ['paperSize', 'Size 9'], ['paperSize', 'مقاس ٩'], ['paperSize', 'Custom']]) {
      const { status } = await api.request('POST', '/tasks', { ...base, [field]: value });
      assert.equal(status, 400, `${field}=${value}`);
    }
  });
});

describe('Paper weight', () => {
  test('is required for new tasks', async () => {
    const { paperWeight: _omit, ...withoutWeight } = base;
    const { status, body } = await api.request('POST', '/tasks', withoutWeight);
    assert.equal(status, 400);
    assert.ok(body.errors.paperWeight);
  });

  for (const invalid of [90, 0, -80, '80', '80 gsm', true]) {
    test(`rejects invalid weight ${JSON.stringify(invalid)}`, async () => {
      const { status, body } = await api.request('POST', '/tasks', { ...base, paperWeight: invalid });
      assert.equal(status, 400);
      assert.ok(body.errors.paperWeight);
    });
  }

  test('can be changed and is preserved by unrelated edits', async () => {
    const task = (await api.request('POST', '/tasks', base)).body.data;
    const changed = await api.request('PUT', `/tasks/${task.id}`, { paperWeight: 70 });
    assert.equal(changed.body.data.paperWeight, 70);
    const other = await api.request('PUT', `/tasks/${task.id}`, { price: 5, paperType: 'glossy_light' });
    assert.equal(other.body.data.paperWeight, 70);
    assert.equal((await api.request('PATCH', `/tasks/${task.id}/status`, { status: 'completed' })).body.data.paperWeight, 70);
    assert.equal((await api.request('PUT', `/tasks/${task.id}`, { paperWeight: 75 })).status, 400);
  });

  test('filters by weight together with search, type, size, status, sorting and pagination', async () => {
    const rows = [
      ['Flyer A', 'glossy_heavy', 'A4', 120, 30, 'completed'],
      ['Flyer B', 'glossy_heavy', 'A4', 120, 10, 'completed'],
      ['Flyer C', 'glossy_heavy', 'A4', 120, 20, 'completed'],
      ['Flyer D', 'glossy_heavy', 'A4', 80, 40, 'completed'],
      ['Flyer E', 'glossy_heavy', 'A5', 120, 50, 'completed'],
      ['Flyer F', 'bristol', 'A4', 120, 60, 'completed'],
      ['Flyer G', 'glossy_heavy', 'A4', 120, 70, 'pending'],
      ['Card H', 'glossy_heavy', 'A4', 120, 80, 'completed'],
    ];
    for (const [description, paperType, paperSize, paperWeight, price, status] of rows) {
      await api.request('POST', '/tasks', { ...base, description, paperType, paperSize, paperWeight, price, status });
    }

    const weightOnly = (await api.request('GET', '/tasks?paperWeight=120')).body.data;
    assert.equal(weightOnly.pagination.total, 7);

    const { body } = await api.request(
      'GET',
      '/tasks?paperWeight=120&paperType=glossy_heavy&paperSize=A4&status=completed&search=flyer&sortBy=price&order=asc&limit=2&page=1'
    );
    assert.equal(body.data.pagination.total, 3); // A, B, C
    assert.equal(body.data.pagination.totalPages, 2);
    assert.deepEqual(body.data.tasks.map((t) => t.description), ['Flyer B', 'Flyer C']);

    const page2 = (await api.request('GET', '/tasks?paperWeight=120&paperType=glossy_heavy&paperSize=A4&status=completed&search=flyer&sortBy=price&order=asc&limit=2&page=2')).body.data;
    assert.deepEqual(page2.tasks.map((t) => t.description), ['Flyer A']);

    assert.equal((await api.request('GET', '/tasks?paperWeight=90')).status, 400);
    assert.equal((await api.request('GET', '/tasks?paperWeight=abc')).status, 400);
  });
});

describe('Existing (legacy) tasks', () => {
  let legacyId;

  beforeEach(async () => {
    // Shaped like the records already in production: old type, no weight, no status.
    const now = new Date();
    const { insertedId } = await api.Task.collection.insertOne({
      description: 'old offset job',
      taskDate: new Date('2026-10-12T00:00:00Z'),
      paperType: 'offset',
      paperSize: 'A3',
      price: 1250,
      createdAt: now,
      updatedAt: now,
    });
    legacyId = insertedId.toString();
  });

  test('remain readable with their original values', async () => {
    const task = (await api.request('GET', `/tasks/${legacyId}`)).body.data;
    assert.equal(task.paperType, 'offset');
    assert.equal(task.paperSize, 'A3');
    assert.equal(task.paperWeight, undefined);
    assert.equal(task.status, 'pending');
    assert.equal(task.price, 1250);
  });

  test('remain filterable by their legacy values and counted in stats', async () => {
    assert.equal((await api.request('GET', '/tasks?paperType=offset')).body.data.pagination.total, 1);
    assert.equal((await api.request('GET', '/tasks?paperSize=A3')).body.data.pagination.total, 1);
    assert.equal((await api.request('GET', '/tasks/stats')).body.data.totalTasks, 1);
  });

  test('can be edited while keeping their legacy type and size', async () => {
    const { status, body } = await api.request('PUT', `/tasks/${legacyId}`, {
      description: 'old offset job (edited)',
      taskDate: '2026-10-12',
      paperType: 'offset',
      paperSize: 'A3',
      paperWeight: 100,
      quantity: 1,
      price: 1300,
      customPaperSize: null,
    });
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.data.paperType, 'offset');
    assert.equal(body.data.paperSize, 'A3');
    assert.equal(body.data.paperWeight, 100);
    assert.equal(body.data.price, 1300);
  });

  test('can be moved to a current option, but not to another retired one', async () => {
    const toOtherLegacy = await api.request('PUT', `/tasks/${legacyId}`, { paperType: 'matte' });
    assert.equal(toOtherLegacy.status, 400);
    assert.match(toOtherLegacy.body.errors.paperType, /no longer available/);

    const toOtherLegacySize = await api.request('PUT', `/tasks/${legacyId}`, { paperSize: 'A2' });
    assert.equal(toOtherLegacySize.status, 400);

    const toCurrent = await api.request('PUT', `/tasks/${legacyId}`, { paperType: 'bristol', paperSize: 'size_18' });
    assert.equal(toCurrent.status, 200);
    assert.equal(toCurrent.body.data.paperType, 'bristol');
    assert.equal(toCurrent.body.data.paperSize, 'size_18');

    // Once moved to a current value, the old one cannot be chosen again.
    assert.equal((await api.request('PUT', `/tasks/${legacyId}`, { paperType: 'offset' })).status, 400);
  });

  test('status changes work on legacy tasks without a weight', async () => {
    const { status, body } = await api.request('PATCH', `/tasks/${legacyId}/status`, { status: 'completed' });
    assert.equal(status, 200);
    assert.equal(body.data.paperType, 'offset');
    assert.equal(body.data.status, 'completed');
  });
});
