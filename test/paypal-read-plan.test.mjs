import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sha } from '../src/core.mjs';
import { consentReadIntegration, privateJson, readJson, READ_APPROVAL } from '../src/paypal-read-plan.mjs';
import { SANDBOX } from '../src/paypal-sandbox.mjs';
import { fixtureOrder, testConfig, orderId, jsonResponse } from './paypal-fixtures.mjs';
import { harness } from './harness.mjs';
const merchant = '7TSZELT2DA9JJ';
const raw = () => fixtureOrder({ status: 'CREATED', purchase_units: [{ payee: { merchant_id: merchant }, amount: { value: '1.00', currency_code: 'USD' } }] });
function setup(t, approved = true) {
  const directory = mkdtempSync(join(tmpdir(), 'saysure-read-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const plan = { version: 1, host: SANDBOX, order_id: orderId, merchant_id: merchant,
    amount: '1.00', currency: 'USD', intent: 'CAPTURE', status: 'CREATED', buyer_id: 'buyer-a',
    app_fingerprint: sha(testConfig.PAYPAL_CLIENT_ID), max_gets: 4, max_oauth: 1 };
  plan.digest = sha(JSON.stringify(plan)); privateJson(`${directory}/plan.json`, plan);
  if (approved) privateJson(`${directory}/operator-approval.json`, { statement: READ_APPROVAL, plan_digest: plan.digest });
  return directory;
}
const token = () => jsonResponse({ access_token: 'private-token', token_type: 'Bearer', expires_in: 3600 });
test('missing/wrong read approval or changed app prevents all network use', t => {
  const directory = setup(t, false); let calls = 0;
  const opts = { transport: async () => { calls++; } };
  assert.throws(() => consentReadIntegration(testConfig, directory, opts), /APPROVAL_REQUIRED/);
  privateJson(`${directory}/operator-approval.json`, { statement: READ_APPROVAL, plan_digest: 'wrong' });
  assert.throws(() => consentReadIntegration(testConfig, directory, opts), /APPROVAL_REQUIRED/);
  assert.throws(() => consentReadIntegration({ ...testConfig, PAYPAL_CLIENT_ID: 'wrong' }, directory, opts), /APP_MISMATCH/);
  assert.equal(calls, 0);
});
test('persistent ceilings, exact order only, no token renewal on restart, no unauthorized writes', async t => {
  const directory = setup(t), calls = [];
  const transport = async (url, options) => { calls.push({ url, method: options.method }); return url.endsWith('/token') ? token() : jsonResponse(raw()); };
  const integration = consentReadIntegration(testConfig, directory, { transport });
  await assert.rejects(() => integration.client.getOrder('OTHERORDER123'), /ORDER_FORBIDDEN/);
  assert.equal(calls.length, 0);
  for (let n = 0; n < 4; n++) await integration.client.getOrder(orderId);
  await assert.rejects(() => integration.client.getOrder(orderId), /BUDGET_EXHAUSTED/);
  assert.equal(calls.length, 5);
  assert.equal(calls.filter(c => c.method === 'GET').length, 4);
  assert.ok(calls.every(c => c.url === `${SANDBOX}/v1/oauth2/token` && c.method === 'POST' || c.url === `${SANDBOX}/v2/checkout/orders/${orderId}` && c.method === 'GET'));
  assert.throws(() => consentReadIntegration(testConfig, directory, { transport }), /EXPERIMENT_STOPPED/);
  assert.equal(readJson(`${directory}/get-4.json`).provenance, 'mock-paypal-fixture');
});
test('restart after a partial journey cannot obtain another OAuth token or reset GET budget', async t => {
  const directory = setup(t); let calls = 0;
  const transport = async url => { calls++; return url.endsWith('/token') ? token() : jsonResponse(raw()); };
  await consentReadIntegration(testConfig, directory, { transport }).client.getOrder(orderId);
  const restarted = consentReadIntegration(testConfig, directory, { transport });
  await assert.rejects(() => restarted.client.getOrder(orderId), /BUDGET_EXHAUSTED/);
  assert.equal(calls, 2); assert.equal(existsSync(`${directory}/get-2.json`), false);
});
test('GET refusal, timeout, stale/changed order stops permanently without cached or mock fallback', async t => {
  for (const variant of [404, 401, 403, 500, 'network', 'amount', 'currency', 'merchant', 'status', 'stale', 'id']) {
    await t.test(String(variant), async t => {
      const directory = setup(t); let calls = 0;
      const integration = consentReadIntegration(testConfig, directory, { transport: async url => {
        calls++; if (url.endsWith('/token')) return token();
        if (variant === 'network') throw Error('private failure');
        if (typeof variant === 'number') return jsonResponse({ name: 'RESOURCE_NOT_FOUND' }, variant);
        const data = raw();
        if (variant === 'amount') data.purchase_units[0].amount.value = '2.00';
        if (variant === 'currency') data.purchase_units[0].amount.currency_code = 'EUR';
        if (variant === 'merchant') data.purchase_units[0].payee.merchant_id = 'WRONG123';
        if (variant === 'status') data.status = 'APPROVED';
        if (variant === 'stale') data.create_time = new Date(Date.now() - 4 * 3600000).toISOString();
        if (variant === 'id') data.id = 'WRONG123';
        return jsonResponse(data);
      } });
      await assert.rejects(() => integration.client.getOrder(orderId));
      await assert.rejects(() => integration.client.getOrder(orderId), /EXPERIMENT_STOPPED/);
      assert.equal(calls, 2);
      const event = readJson(`${directory}/get-1.json`);
      assert.equal(event.http_status, typeof variant === 'number' ? variant : variant === 'network' ? null : 200);
    });
  }
});
test('bounded Chrome journey: MOCK PayPal, virtual authenticator, real verifier; four reads bind approve consume once', { timeout: 120000 }, async t => {
  const directory = setup(t), calls = [], order = raw();
  const paypal = consentReadIntegration(testConfig, directory, { transport: async (url, opts) => {
    calls.push({ url, method: opts.method }); return url.endsWith('/token') ? token() : jsonResponse(order);
  } });
  const h = await harness({ paypal }); t.after(() => h.close());
  const helper = await h.actor('helper'), buyer = await h.actor('buyer-a'), other = await h.actor('buyer-b');
  assert.equal((await buyer.register()).status, 200);
  assert.equal((await helper.call('/api/paypal/requests', { order_id: orderId, buyer_id: 'buyer-b' })).status, 403);
  assert.equal(calls.length, 0);
  const imported = await helper.call('/api/paypal/requests', { order_id: orderId, buyer_id: 'buyer-a' });
  assert.equal(imported.status, 201); const item = imported.data, path = `/api/requests/${item.snapshot.request_id}`;
  assert.equal(item.paypal_evidence.provenance, 'mock-paypal-fixture'); assert.equal(calls.length, 2);
  assert.equal((await helper.call('/api/paypal/requests', { order_id: orderId, buyer_id: 'buyer-a' })).status, 409);
  assert.equal((await helper.call(`${path}/refresh-provider`, { digest: item.digest })).status, 403);
  assert.equal((await helper.call(`${path}/options`, { digest: item.digest })).status, 403);
  assert.equal((await other.call(`${path}/options`, { digest: item.digest })).status, 404);
  assert.equal(calls.length, 2);
  const assertion = await buyer.assertion(item); assert.equal(calls.length, 3);
  assert.equal((await buyer.call(`${path}/approve`, assertion)).status, 200); assert.equal(calls.length, 4);
  assert.notEqual((await buyer.call(`${path}/approve`, assertion)).status, 200); assert.equal(calls.length, 4);
  await buyer.page.reload(); await buyer.page.getByText('Buyer consent approved.', { exact: false }).waitFor();
  assert.equal(await buyer.page.getByText('PayPal order verified.', { exact: false }).count(), 0);
  assert.equal((await buyer.call(`${path}/consume`, { digest: item.digest })).status, 200); assert.equal(calls.length, 5);
  assert.notEqual((await buyer.call(`${path}/consume`, { digest: item.digest })).status, 200); assert.equal(calls.length, 5);
  await h.restart();
  const saved = (await buyer.call('/api/requests', undefined, 'GET')).data.find(x => x.snapshot.request_id === item.snapshot.request_id);
  assert.equal(saved.status, 'consumed');
  assert.notEqual((await buyer.call(`${path}/consume`, { digest: item.digest })).status, 200); assert.equal(calls.length, 5);
  assert.equal(h.store.request(item.snapshot.request_id).consent_digest, item.digest);
  assert.deepEqual(h.forbidden, []);
});
