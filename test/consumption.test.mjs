import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { harness } from './harness.mjs';
import { fixtureOrder, merchant, orderId, testConfig, jsonResponse } from './paypal-fixtures.mjs';
import { privateJson, consentReadIntegration, READ_APPROVAL } from '../src/paypal-read-plan.mjs';
import { sha } from '../src/core.mjs';
import { requestService } from '../src/requests.mjs';
import { paypalRequests } from '../src/paypal-requests.mjs';
import { consumptionService } from '../src/consumption.mjs';
import { openStore } from '../src/store.mjs';
import { validateConsumptionReceipt } from '../public/consumption.js';
async function fixture(t, extra = {}) {
  let reads = 0, waiting = null;
  const data = fixtureOrder();
  const client = { provenance: 'mock-paypal-fixture', async getOrder(id, options = {}) {
    assert.equal(id, orderId); reads++; options.onReadReserved?.();
    if (waiting) await waiting;
    return structuredClone(data);
  } };
  const h = await harness({ paypal: { client, merchantId: merchant, allowedOrders: [orderId] }, ...extra });
  t.after(() => h.close());
  const helper = await h.actor('helper', false), buyer = await h.actor('buyer-a', false);
  const imported = await helper.call('/api/paypal/requests', { order_id: orderId, buyer_id: 'buyer-a' });
  assert.equal(imported.status, 201);
  const item = imported.data, id = item.snapshot.request_id, path = `/api/requests/${id}/consume`;
  // Isolated approved fixture only. No ceremony or historical credential is used.
  h.store.run("UPDATE requests SET status='approved',consent_digest=digest WHERE id=?", id);
  const initial = reads;
  return { h, helper, buyer, item, id, path, data, reads: () => reads - initial,
    delay(promise) { waiting = promise; },
    async button() { await buyer.page.reload(); const b = buyer.page.getByRole('button', { name: 'Consume consent once (local test only)', exact: true }); await b.waitFor(); return b; } };
}
test('HTTP 200 approved response is never accepted as a consumption acknowledgement', async t => {
  const f = await fixture(t), button = await f.button();
  await f.buyer.page.route('**/api/requests/*/consume', route => route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ ...f.item, status: 'approved', consumed_at: null }) }));
  await button.click(); await f.buyer.page.locator('#message').filter({ hasText: 'Consumption was not confirmed' }).waitFor();
  assert.equal(f.h.store.request(f.id).status, 'approved'); assert.equal(f.reads(), 0);
  assert.equal(await button.isDisabled(), true);
  assert.equal(f.h.store.all("SELECT * FROM events WHERE event='consume'").length, 0);
});
test('valid committed receipt drives accessible UI; sequential duplicate rejects; state survives restart', async t => {
  const f = await fixture(t), button = await f.button();
  const response = f.buyer.page.waitForResponse(r => r.url().endsWith('/consume'));
  await button.click(); const data = await (await response).json();
  await validateConsumptionReceipt(data, f.item);
  assert.equal(data.status, 'consumed'); assert.equal(data.consumption_receipt.committed, true);
  assert.equal(data.consumption_receipt.event.type, 'consume');
  const event = f.h.store.get('SELECT * FROM events WHERE seq=?', data.consumption_receipt.event.id);
  assert.equal(event.request_id, f.id); assert.equal(event.at, data.consumption_receipt.event.at);
  await f.buyer.page.locator('#message').filter({ hasText: 'Consent consumed once' }).waitFor();
  assert.equal(await f.buyer.page.locator('#message').evaluate(e => e === document.activeElement), true);
  assert.equal(await f.buyer.page.getByRole('button', { name: 'Consume consent once (local test only)', exact: true }).count(), 0);
  for (const mutate of [d => d.consumption_receipt.request_id = 'WRONG', d => d.consumption_receipt.consent_digest = 'wrong',
    d => d.consumption_receipt.event.type = 'approved', d => d.consumption_receipt.event.id = null,
    d => d.consumption_receipt.consumed_at = Date.now() + 120000, d => d.status = 'approved']) {
    const bad = structuredClone(data); mutate(bad); await assert.rejects(() => validateConsumptionReceipt(bad, f.item), /not confirmed/);
  }
  const duplicate = await f.buyer.call(f.path, { digest: f.item.digest }); assert.equal(duplicate.status, 409);
  assert.equal(f.reads(), 1); assert.equal(f.h.store.get('SELECT COUNT(*) AS n FROM consumption_claims').n, 0);
  await f.h.restart(); assert.equal(f.h.store.request(f.id).status, 'consumed');
  assert.equal((await f.buyer.call(f.path, { digest: f.item.digest })).status, 409); assert.equal(f.reads(), 1);
});
test('commit followed by failed or inconsistent list refresh retains confirmed consumption', async t => {
  for (const status of [500, 200]) await t.test(String(status), async t => {
    const f = await fixture(t), button = await f.button();
    await f.buyer.page.route('**/api/requests', route => route.fulfill({ status, contentType: 'application/json',
      body: JSON.stringify(status === 500 ? { error: 'FIXTURE_REFRESH_FAILURE' } : [{ ...f.item, status: 'approved' }]) }));
    await button.click(); await f.buyer.page.locator('#message').filter({ hasText: 'committed receipt was confirmed' }).waitFor();
    assert.equal(f.h.store.request(f.id).status, 'consumed');
    assert.equal(await f.buyer.page.getByRole('button', { name: 'Consume consent once (local test only)', exact: true }).count(), 0);
    assert.equal(f.h.store.all("SELECT * FROM events WHERE event='consume'").length, 1);
  });
});
test('database failure rolls back state and event, releases claim, and returns a diagnostic reference', async t => {
  const f = await fixture(t);
  f.h.store.db.exec("CREATE TRIGGER fail_consume BEFORE INSERT ON events WHEN NEW.event='consume' BEGIN SELECT RAISE(ABORT,'PRIVATE_SQL_MESSAGE'); END;");
  const capture = f.buyer.page.waitForResponse(r => r.url().endsWith('/consume'));
  const result = await f.buyer.call(f.path, { digest: f.item.digest }); assert.equal(result.status, 500);
  assert.match((await capture).headers()['x-consumption-correlation-id'], /^[a-f0-9-]{36}$/);
  assert.equal(f.h.store.request(f.id).status, 'approved'); assert.equal(f.h.store.request(f.id).consumed_at, null);
  assert.equal(f.h.store.all("SELECT * FROM events WHERE event='consume'").length, 0);
  assert.equal(f.h.store.get('SELECT COUNT(*) AS n FROM consumption_claims').n, 0);
  const log = f.h.store.all('SELECT * FROM consumption_diagnostics');
  assert.ok(log.some(e => e.stage === 'database_started')); assert.ok(log.some(e => e.stage === 'failed'));
  assert.ok(!log.some(e => e.stage === 'database_committed')); assert.doesNotMatch(JSON.stringify(log), /PRIVATE_SQL_MESSAGE/);
});
test('expiry, wrong actor and changed evidence remain fail closed', async t => {
  for (const variant of ['expired', 'amount', 'currency', 'merchant', 'status', 'helper', 'buyer', 'digest']) {
    await t.test(variant, async t => {
      const f = await fixture(t);
      if (variant === 'expired') {
        const s = JSON.parse(f.h.store.request(f.id).snapshot); s.expires_at = Date.now() - 1;
        const { digest } = await import('../src/core.mjs'); f.item.digest = digest(s);
        f.h.store.run('UPDATE requests SET snapshot=?,digest=?,consent_digest=? WHERE id=?', JSON.stringify(s), f.item.digest, f.item.digest, f.id);
      }
      if (variant === 'amount') f.data.purchase_units[0].amount.value = '2.00';
      if (variant === 'currency') f.data.purchase_units[0].amount.currency_code = 'EUR';
      if (variant === 'merchant') f.data.purchase_units[0].payee.merchant_id = 'WRONG123';
      if (variant === 'status') f.data.status = 'APPROVED';
      const actor = variant === 'helper' ? f.helper : variant === 'buyer' ? await f.h.actor('buyer-b', false) : f.buyer;
      const result = await actor.call(f.path, { digest: variant === 'digest' ? 'wrong' : f.item.digest });
      assert.notEqual(result.status, 200); assert.equal(f.h.store.request(f.id).consumed_at, null);
      assert.equal(f.h.store.all("SELECT * FROM events WHERE event='consume'").length, 0);
      if (['expired', 'helper', 'buyer', 'digest'].includes(variant)) assert.equal(f.reads(), 0);
    });
  }
});
test('timeout releases claim and a late provider response cannot commit', async t => {
  const f = await fixture(t, { consumption: { timeoutMs: 30 } });
  let release; f.delay(new Promise(resolve => release = resolve));
  const result = await f.buyer.call(f.path, { digest: f.item.digest }); assert.equal(result.status, 504);
  assert.equal(f.h.store.request(f.id).status, 'invalidated');
  assert.equal(f.h.store.get('SELECT COUNT(*) AS n FROM consumption_claims').n, 0);
  release(); await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(f.h.store.request(f.id).consumed_at, null); assert.equal(f.h.store.all("SELECT * FROM events WHERE event='consume'").length, 0);
});
test('one remaining GET: overlapping duplicates share work; another app instance cannot reserve a read', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'saysure-consumption-budget-')); t.after(() => rmSync(directory, { recursive: true, force: true }));
  const plan = { version: 1, host: 'https://api-m.sandbox.paypal.com', order_id: orderId, merchant_id: '7TSZELT2DA9JJ',
    amount: '1.00', currency: 'USD', intent: 'CAPTURE', status: 'CREATED', buyer_id: 'buyer-a',
    app_fingerprint: sha(testConfig.PAYPAL_CLIENT_ID), max_gets: 4, max_oauth: 1 };
  plan.digest = sha(JSON.stringify(plan)); privateJson(`${directory}/plan.json`, plan);
  privateJson(`${directory}/operator-approval.json`, { statement: READ_APPROVAL, plan_digest: plan.digest });
  const data = fixtureOrder({ status: 'CREATED', purchase_units: [{ payee: { merchant_id: plan.merchant_id }, amount: { value: '1.00', currency_code: 'USD' } }] });
  let reads = 0, release, entered; const started = new Promise(resolve => entered = resolve);
  const paypal = consentReadIntegration(testConfig, directory, { initialToken: { access_token: 'FIXTURE_TOKEN', token_type: 'Bearer', expires_at: Date.now() + 3600000 },
    transport: async () => { reads++; if (reads === 4) { entered(); await new Promise(resolve => release = resolve); } return jsonResponse(data); } });
  const f = await fixture(t, { paypal });
  await paypal.client.getOrder(orderId); await paypal.client.getOrder(orderId);
  const first = f.buyer.call(f.path, { digest: f.item.digest }); await started;
  const second = f.buyer.call(f.path, { digest: f.item.digest });
  for (let n = 0; n < 100 && !f.h.store.get("SELECT seq FROM consumption_diagnostics WHERE stage='duplicate_wait'"); n++) await new Promise(r => setTimeout(r, 10));
  assert.ok(f.h.store.get("SELECT seq FROM consumption_diagnostics WHERE stage='duplicate_wait'"));
  const alternate = openStore(f.h.databasePath);
  try {
    const requests = requestService(alternate), provider = paypalRequests(alternate, requests, paypal);
    const service = consumptionService(alternate, requests, provider);
    const session = alternate.get("SELECT sessions.*,users.role FROM sessions JOIN users ON users.id=sessions.user_id WHERE user_id='buyer-a'");
    await assert.rejects(() => service.consume(session, f.id, f.item.digest), /CONSUMPTION_IN_PROGRESS/);
  } finally { alternate.close(); }
  release(); const results = await Promise.all([first, second]); assert.deepEqual(results.map(r => r.status), [200, 409]);
  assert.equal(reads, 4); assert.equal(existsSync(`${directory}/stopped.json`), false);
  assert.equal(f.h.store.request(f.id).status, 'consumed'); assert.equal(f.h.store.all("SELECT * FROM events WHERE event='consume'").length, 1);
  const stages = f.h.store.all('SELECT stage FROM consumption_diagnostics').map(r => r.stage);
  for (const stage of ['read_reserved', 'provider_revalidated', 'database_committed', 'response_finished']) assert.ok(stages.includes(stage));
});
