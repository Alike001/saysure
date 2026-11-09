import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness.mjs';
import { fixtureOrder, orderId, merchant } from './paypal-fixtures.mjs';
import { validateConsumptionReceipt } from '../public/consumption.js';
async function fixture(t) {
  const raw = fixtureOrder(); let reads = 0;
  const h = await harness({ paypal: { merchantId: merchant, allowedOrders: [orderId],
    client: { provenance: 'mock-paypal-fixture', async getOrder() { reads++; return structuredClone(raw); } } } });
  t.after(() => h.close()); const helper = await h.actor('helper', false), buyer = await h.actor('buyer-a', false);
  const imported = await helper.call('/api/paypal/requests', { order_id: orderId, buyer_id: 'buyer-a' });
  assert.equal(imported.status, 201); const item = imported.data, id = item.snapshot.request_id;
  h.store.run("UPDATE requests SET status='approved',consent_digest=digest WHERE id=?", id);
  await buyer.page.reload();
  const button = buyer.page.getByRole('button', { name: 'Consume consent once (local test only)', exact: true }); await button.waitFor();
  h.store.db.exec(`CREATE TRIGGER deny_trace BEFORE INSERT ON consumption_diagnostics BEGIN SELECT RAISE(ABORT,'PRIVATE_TRACE_FAILURE'); END;
    CREATE TRIGGER deny_counter BEFORE INSERT ON consumption_rejections BEGIN SELECT RAISE(ABORT,'PRIVATE_COUNTER_FAILURE'); END;`);
  return { h, buyer, button, item, id, path: `/api/requests/${id}/consume`, reads: () => reads - 1 };
}
test('missing operational traces do not prevent genuine committed acknowledgement or mandatory persistence', async t => {
  const f = await fixture(t);
  await f.buyer.page.route('**/api/requests', route => route.fulfill({ status: 500, json: { error: 'FIXTURE_REFRESH_FAILURE' } }));
  const received = f.buyer.page.waitForResponse(r => r.url().endsWith('/consume'));
  await f.button.click(); const response = await received, data = await response.json();
  assert.equal(response.status(), 200); await validateConsumptionReceipt(data, f.item);
  assert.match(data.consumption_receipt.correlation_id, /^[a-f0-9-]{36}$/);
  assert.equal(response.headers()['x-consumption-correlation-id'], data.consumption_receipt.correlation_id);
  await f.buyer.page.locator('#message').filter({ hasText: 'committed receipt was confirmed' }).waitFor();
  assert.equal(f.h.store.get('SELECT COUNT(*) n FROM consumption_diagnostics').n, 0);
  assert.equal(f.h.store.get('SELECT COUNT(*) n FROM consumption_rejections').n, 0);
  const event = f.h.store.get("SELECT * FROM events WHERE request_id=? AND event='consume'", f.id);
  assert.equal(event.seq, data.consumption_receipt.event.id); assert.equal(event.at, data.consumed_at);
  assert.equal(f.h.store.request(f.id).status, 'consumed'); assert.equal(f.reads(), 1);
  assert.equal(await f.buyer.page.getByRole('button', { name: 'Consume consent once (local test only)', exact: true }).count(), 0);
  await f.h.restart(); assert.equal(f.h.store.request(f.id).status, 'consumed');
  assert.equal(f.h.store.get("SELECT COUNT(*) n FROM events WHERE event='consume'").n, 1);
  assert.equal((await f.buyer.call(f.path, { digest: f.item.digest })).status, 409); assert.equal(f.reads(), 1);
});
test('mandatory event failure still rolls back and never announces success when telemetry is unavailable', async t => {
  const f = await fixture(t);
  f.h.store.db.exec("CREATE TRIGGER deny_consume BEFORE INSERT ON events WHEN NEW.event='consume' BEGIN SELECT RAISE(ABORT,'PRIVATE_EVENT_FAILURE'); END;");
  const received = f.buyer.page.waitForResponse(r => r.url().endsWith('/consume')); await f.button.click();
  const response = await received; assert.equal(response.status(), 500);
  assert.match(response.headers()['x-consumption-correlation-id'], /^[a-f0-9-]{36}$/);
  await f.buyer.page.locator('#message').filter({ hasText: 'Reference:' }).waitFor();
  assert.doesNotMatch(await f.buyer.page.locator('#message').innerText(), /Consent consumed|PRIVATE_/);
  const row = f.h.store.request(f.id); assert.equal(row.status, 'approved'); assert.equal(row.consumed_at, null);
  assert.equal(f.h.store.get("SELECT COUNT(*) n FROM events WHERE event='consume'").n, 0);
  assert.equal(f.h.store.get('SELECT COUNT(*) n FROM consumption_diagnostics').n, 0);
});
test('HTTP 200 alone remains unconfirmed when optional diagnostics are unavailable', async t => {
  const f = await fixture(t);
  await f.buyer.page.route('**/api/requests/*/consume', route => route.fulfill({ status: 200, json: { ...f.item, status: 'approved' } }));
  await f.button.click(); await f.buyer.page.locator('#message').filter({ hasText: 'Consumption was not confirmed' }).waitFor();
  assert.equal(f.h.store.request(f.id).status, 'approved'); assert.equal(f.reads(), 0);
  assert.equal(f.h.store.get("SELECT COUNT(*) n FROM events WHERE event='consume'").n, 0);
});
