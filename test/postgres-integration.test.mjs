import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { openPostgresStore } from '../src/store.mjs';
import { provisionStaging } from '../src/identity.mjs';
import { makeApp } from '../src/app.mjs';

const enabled = process.env.SAYSURE_POSTGRES_TEST === 'true' && !!process.env.DATABASE_URL;

test('PostgreSQL runtime supports login, request creation and single-use consumption without blocking HTTP', {
  skip: !enabled,
  timeout: 30000
}, async t => {
  const store = await openPostgresStore(process.env.DATABASE_URL, { max: 4 });
  let app;
  try {
    await store.run(`TRUNCATE TABLE consumption_diagnostics,consumption_rejections,events,consumption_claims,
      paypal_bindings,challenges,requests,sessions,credentials,users RESTART IDENTITY CASCADE`);
    const env = {
      STAGING_HELPER_PASSWORD: 'helper-stage-password-2026',
      STAGING_BUYER_A_PASSWORD: 'buyer-a-stage-password-2026',
      STAGING_BUYER_B_PASSWORD: 'buyer-b-stage-password-2026'
    };
    const provisioned = await provisionStaging(store, env);
    assert.equal(provisioned.created, true);
    await assert.rejects(() => provisionStaging(store, {
      STAGING_HELPER_PASSWORD: 'replacement-password-2026',
      STAGING_BUYER_A_PASSWORD: 'replacement-password-2026',
      STAGING_BUYER_B_PASSWORD: 'replacement-password-2026'
    }), /ALREADY_PROVISIONED|STAGING_ACCOUNT_STATE_UNEXPECTED/);

    const config = { origin: 'http://127.0.0.1:0', rpID: '127.0.0.1' };
    app = makeApp(store, config);
    app.server.listen(0, '127.0.0.1');
    await once(app.server, 'listening');
    config.origin = `http://127.0.0.1:${app.server.address().port}`;

    const health = await fetch(`${config.origin}/healthz`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok', database: 'postgres' });

    async function login(username, password) {
      const response = await fetch(`${config.origin}/api/login`, {
        method: 'POST',
        headers: { Origin: config.origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      assert.equal(response.status, 200);
      const cookie = response.headers.get('set-cookie')?.split(';')[0];
      assert.ok(cookie?.startsWith('consent_session='));
      const session = await fetch(`${config.origin}/api/session`, { headers: { Cookie: cookie } });
      assert.equal(session.status, 200);
      return { cookie, ...(await session.json()) };
    }
    const helper = await login('helper', env.STAGING_HELPER_PASSWORD);
    const buyers = await fetch(`${config.origin}/api/buyers`, { headers: { Cookie: helper.cookie } });
    assert.deepEqual(await buyers.json(), [{ id: 'buyer-a' }, { id: 'buyer-b' }]);

    const created = await fetch(`${config.origin}/api/requests`, {
      method: 'POST',
      headers: { Origin: config.origin, Cookie: helper.cookie, 'X-CSRF-Token': helper.csrf,
        'Content-Type': 'application/json' },
      body: JSON.stringify({ buyer_id: 'buyer-a', merchant_id: 'SYNTH-STORE', merchant_name: 'Test shop',
        amount: '1.00', currency: 'USD', description: 'PostgreSQL integration fixture', lifetime_minutes: 10 })
    });
    assert.equal(created.status, 201);
    const item = await created.json();
    assert.match(item.snapshot.request_id, /^SYNTH-/);
    assert.equal(item.status, 'pending');

    const buyer = await login('buyer-a', env.STAGING_BUYER_A_PASSWORD);
    await store.run("UPDATE requests SET status='approved',consent_digest=digest WHERE id=?", item.snapshot.request_id);
    const consume = () => fetch(`${config.origin}/api/requests/${item.snapshot.request_id}/consume`, {
      method: 'POST',
      headers: { Origin: config.origin, Cookie: buyer.cookie, 'X-CSRF-Token': buyer.csrf,
        'Content-Type': 'application/json' },
      body: JSON.stringify({ digest: item.digest })
    });
    const results = await Promise.all([consume(), consume()]);
    const statuses = results.map(response => response.status).sort();
    assert.deepEqual(statuses, [200, 409]);
    const success = results[statuses.indexOf(200)];
    const receipt = await success.json();
    assert.equal(receipt.status, 'consumed');
    assert.equal(receipt.consumption_receipt.committed, true);
    assert.equal(receipt.consumption_receipt.event.type, 'consume');
    assert.equal((await store.get("SELECT COUNT(*) AS n FROM events WHERE event='consume'")).n, 1);
    assert.equal((await store.get('SELECT COUNT(*) AS n FROM consumption_claims')).n, 0);
    assert.equal((await store.get('SELECT COUNT(*) AS n FROM users')).n, 3);
  } finally {
    if (app?.server?.listening) {
      await new Promise(resolve => { app.server.close(resolve); app.server.closeAllConnections(); });
      await app.close();
    }
    await store.close();
  }
});
