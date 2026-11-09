import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { openStore } from '../src/store.mjs';
import { provision, issueSession } from '../src/identity.mjs';
import { makeApp } from '../src/app.mjs';
import { paypalRequests } from '../src/paypal-requests.mjs';
import { classifyRoute } from '../src/routes.mjs';
import { fixtureOrder, orderId, merchant } from './paypal-fixtures.mjs';

// Raw HTTP preserves dangerous paths which fetch/browser URL parsing would normalize away.
export function rawPost(origin, path, issued, digest) {
  return new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port: new URL(origin).port, path, method: 'POST',
      headers: { Host: new URL(origin).host, Origin: origin, 'Content-Type': 'application/json',
        Cookie: `consent_session=${issued.token}`, 'X-CSRF-Token': issued.csrf } }, response => {
      let body = ''; response.on('data', part => body += part);
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, data: JSON.parse(body) }));
    });
    request.on('error', reject); request.end(JSON.stringify({ digest }));
  });
}
async function fixture(t) {
  const store = openStore(':memory:'); provision(store); let reads = 0;
  const raw = fixtureOrder(), config = { origin: 'http://localhost:3100', rpID: 'localhost',
    paypal: { merchantId: merchant, allowedOrders: [orderId], client: { provenance: 'mock-paypal-fixture',
      async getOrder() { reads++; return structuredClone(raw); } } } };
  const app = makeApp(store, config);
  const provider = paypalRequests(store, app.requests, config.paypal);
  const item = await provider.create({ role: 'helper', user_id: 'helper' }, { order_id: orderId, buyer_id: 'buyer-a' });
  store.run("UPDATE requests SET status='approved',consent_digest=digest WHERE id=?", item.snapshot.request_id);
  const issued = issueSession(store, 'buyer-a');
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  config.origin = `http://localhost:${app.server.address().port}`;
  t.after(async () => { await new Promise(resolve => { app.server.close(resolve); app.server.closeAllConnections(); }); store.close(); });
  return { store, item, reads: () => reads - 1, post: path => rawPost(config.origin, path, issued, item.digest) };
}
test('raw noncanonical route variants reject before provider reads, state changes or consume events', async t => {
  const f = await fixture(t), base = `/api/requests/${f.item.snapshot.request_id}`;
  const paths = [`${base}/extra/../consume`, `${base}/extra/%2e%2e/consume`, `${base}/%2E/consume`,
    `${base}%2fconsume`, `${base}%5cconsume`, `${base}//consume`, `${base}/consume/extra`,
    `${base}/consume/`, `${base}/%xx/consume`, `${base}/consume?label=%xx`,
    `//api/requests/${f.item.snapshot.request_id}/consume`, `${base}/consume#fragment`];
  for (const path of paths) await t.test(path.slice(base.length), async () => {
    const response = await f.post(path); assert.ok([400, 404].includes(response.status));
    const row = f.store.get('SELECT status,consumed_at FROM requests WHERE id=?', f.item.snapshot.request_id);
    assert.equal(row.status, 'approved'); assert.equal(row.consumed_at, null); assert.equal(f.reads(), 0);
    assert.equal(f.store.get("SELECT COUNT(*) n FROM events WHERE event='consume'").n, 0);
    assert.equal(f.store.get('SELECT COUNT(*) n FROM consumption_claims').n, 0);
  });
});
for (const query of ['', '?view=buyer&label=Review%20once&label=%2Fconsume']) {
  test(`canonical consumption with inert query ${query || '(none)'} has a traced committed receipt`, async t => {
    const f = await fixture(t), path = `/api/requests/${f.item.snapshot.request_id}/consume`;
    assert.deepEqual(classifyRoute(path, 'POST'), classifyRoute(path + query, 'POST'));
    const response = await f.post(path + query); assert.equal(response.status, 200);
    const correlation = response.data.consumption_receipt.correlation_id;
    assert.match(correlation, /^[a-f0-9-]{36}$/);
    assert.equal(response.headers['x-consumption-correlation-id'], correlation);
    assert.ok(f.store.get("SELECT seq FROM consumption_diagnostics WHERE correlation_id=? AND stage='database_committed'", correlation));
    assert.equal(f.reads(), 1); assert.equal(response.data.status, 'consumed');
    assert.equal(f.store.get("SELECT COUNT(*) n FROM events WHERE event='consume'").n, 1);
  });
}
