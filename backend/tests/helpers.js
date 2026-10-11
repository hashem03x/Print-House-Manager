import { once } from 'node:events';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Starts the API against a throwaway database and returns helpers.
 * Uses TEST_MONGODB_URI when provided, otherwise an in-memory MongoDB.
 * Environment variables must be set before the app modules are imported.
 */
export async function startTestApi({ timeZone = 'Africa/Cairo' } = {}) {
  let mongo;
  let uri = process.env.TEST_MONGODB_URI;
  if (!uri) {
    mongo = await MongoMemoryServer.create();
    uri = mongo.getUri('phm-test');
  }

  process.env.MONGODB_URI = uri;
  process.env.NODE_ENV = 'test';
  process.env.CLIENT_URL = 'http://localhost:5173';
  process.env.APP_TIMEZONE = timeZone;

  const { default: app } = await import('../src/app.js');
  const db = await import('../src/config/db.js');
  const { Task } = await import('../src/models/Task.js');

  await db.connectDB(uri);
  await Task.deleteMany({});

  const server = app.listen(0);
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api`;

  async function request(method, path, body, headers = {}) {
    const res = await fetch(base + path, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json', ...headers } : headers,
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
  }

  async function stop() {
    await new Promise((resolve) => server.close(resolve));
    await db.disconnectDB();
    await mongo?.stop();
  }

  return { base, request, Task, stop };
}

export const validTask = Object.freeze({
  description: '500 business cards',
  taskDate: '2026-10-20',
  paperType: 'matte_sticker',
  paperSize: 'custom',
  paperWeight: 80,
  customPaperSize: Object.freeze({ width: 90, height: 50, unit: 'mm' }),
  price: 450,
});
