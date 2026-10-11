import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, describe, test } from 'node:test';

// Empty string counts as "set", so dotenv will not load backend/.env over it.
process.env.MONGODB_URI = '';
process.env.NODE_ENV = 'test';

const { categorizeDbError, DbConnectionError } = await import('../src/config/db.js');

describe('missing MONGODB_URI on a serverless host', () => {
  let server;
  let base;

  before(async () => {
    const { default: app } = await import('../src/app.js'); // must not exit the process
    server = app.listen(0);
    await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}/api`;
  });

  after(() => new Promise((resolve) => server.close(resolve)));

  test('health explains the configuration problem', async () => {
    const res = await fetch(`${base}/health`);
    const body = await res.json();
    assert.equal(res.status, 503);
    assert.equal(body.data.databaseReason, 'missing_configuration');
    assert.equal(body.data.configurationValid, false);
  });

  test('API routes return 503 DB_UNAVAILABLE', async () => {
    const res = await fetch(`${base}/tasks`);
    assert.equal(res.status, 503);
    assert.equal((await res.json()).code, 'DB_UNAVAILABLE');
  });
});

describe('connection error categories', () => {
  const cases = [
    [{ name: 'MongoServerError', code: 8000, message: 'bad auth : authentication failed' }, 'authentication_failed'],
    [{ name: 'MongoServerError', code: 18, message: 'Authentication failed.' }, 'authentication_failed'],
    [{ name: 'MongoServerSelectionError', message: 'querySrv ENOTFOUND _mongodb._tcp.cluster0.nope.mongodb.net' }, 'dns_resolution_failed'],
    [
      {
        name: 'MongooseServerSelectionError',
        message: "Could not connect to any servers in your MongoDB Atlas cluster. One common reason is that you're trying to access the database from an IP that isn't whitelisted.",
      },
      'network_access_denied',
    ],
    [{ name: 'MongoServerSelectionError', message: 'connect ECONNREFUSED 127.0.0.1:27017' }, 'connection_refused'],
    [{ name: 'MongoServerSelectionError', message: 'Server selection timed out after 7000 ms' }, 'timeout'],
    [{ name: 'MongoParseError', message: 'Invalid scheme, expected connection string to start with "mongodb://"' }, 'invalid_uri'],
    [{ name: 'Error', message: 'something else' }, 'unknown'],
    [new DbConnectionError('missing_configuration', 'x'), 'missing_configuration'],
  ];
  for (const [error, expected] of cases) {
    test(`${expected}: ${error.message.slice(0, 50)}`, () => {
      assert.equal(categorizeDbError(error), expected);
    });
  }
});
