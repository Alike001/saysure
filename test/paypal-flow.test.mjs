import test from 'node:test';
import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import { harness, sample } from './harness.mjs';
import { fixtureOrder, merchant, orderId, testConfig, jsonResponse } from './paypal-fixtures.mjs';
import { sandboxClient } from '../src/paypal-sandbox.mjs';

test('PayPal-backed consent in Chrome: MOCK provider transport, real WebAuthn verifier', { timeout: 120000 }, async t => {
  let current = fixtureOrder(), failure = null, delay = null;
  const calls = [];
  const client = sandboxClient(testConfig, { transport: async (url, options) => {
    calls.push({ operation: url.endsWith('/token') ? 'oauth' : 'order_get', method: options.method });
    if (url.endsWith('/token')) return jsonResponse({ access_token: 'test-token', token_type: 'Bearer', expires_in: 3600 });
    if (delay) await delay;
    return jsonResponse(failure ? {} : current, failure ?? 200);
  } });
  const h = await harness({ paypal: { client, merchantId: merchant, allowedOrders: [orderId, 'SECONDORDER123'] } });
  t.after(() => h.close());
  const helper = await h.actor('helper'), buyer = await h.actor('buyer-a'), other = await h.actor('buyer-b');
  assert.equal((await buyer.register()).status, 200);
  const imported = await helper.call('/api/paypal/requests', { order_id: orderId, buyer_id: 'buyer-a' });
  assert.equal(imported.status, 201, JSON.stringify(imported.data));
  let item = imported.data;
  const path = () => `/api/requests/${item.snapshot.request_id}`;
  const reload = async () => { item = (await buyer.call('/api/requests', undefined, 'GET')).data.find(i => i.snapshot.request_id === item.snapshot.request_id); };
  const refresh = async () => {
    const r = await helper.call(`${path()}/refresh-provider`, { digest: item.digest });
    assert.equal(r.status, 200, JSON.stringify(r.data)); item = r.data;
  };
  const approve = async proof => buyer.call(`${path()}/approve`, proof);
  await t.test('import is server-owned, private, distinct and bound once to its app buyer', async () => {
    assert.equal(item.synthetic, false); assert.equal(item.snapshot.amount_minor, '100');
    assert.equal(item.paypal_evidence.provenance, 'mock-paypal-fixture');
    assert.doesNotMatch(JSON.stringify(item), /PRIVATE|email_address|test-token|test-secret/);
    assert.equal((await helper.call('/api/paypal/requests', { order_id: orderId, buyer_id: 'buyer-b' })).status, 409);
    assert.equal((await buyer.call('/api/paypal/requests', { order_id: orderId, buyer_id: 'buyer-a' })).status, 403);
    assert.equal((await helper.call('/api/paypal/requests', { order_id: orderId, buyer_id: 'buyer-a', amount: '0.01' })).status, 400);
    assert.equal((await helper.call('/api/paypal/requests', { order_id: 'UNKNOWN123', buyer_id: 'buyer-a' })).status, 503);
    assert.equal((await other.call(`${path()}/options`, { digest: item.digest })).status, 404);
    assert.equal((await helper.call(path(), { ...sample(), revision: 1 }, 'PATCH')).status, 403);
    assert.equal((await helper.call(`${path()}/options`, { digest: item.digest })).status, 403);
  });
  await t.test('buyer explicitly approves PayPal local consent through the accessible UI', async () => {
    await buyer.page.reload();
    const card = buyer.page.getByRole('article');
    await card.getByRole('checkbox').check();
    await card.getByRole('button', { name: 'Approve local consent for this PayPal order with my passkey', exact: true }).click();
    await buyer.page.locator('#message').filter({ hasText: 'Consent approved for these exact details.' }).waitFor();
    assert.equal(h.store.request(item.snapshot.request_id).status, 'approved');
    assert.equal(await buyer.page.locator('#message').evaluate(e => e === document.activeElement), true);
    await refresh();
  });
  await t.test('current evidence checked again after signature: changed amount/currency/payee/status and API failure cannot approve', async () => {
    for (const mutate of [
      x => x.purchase_units[0].amount.value = '2.00', x => x.purchase_units[0].amount.currency_code = 'EUR',
      x => x.purchase_units[0].payee.merchant_id = 'WRONG123', x => x.status = 'APPROVED',
      x => delete x.purchase_units[0].amount, x => failure = 404,
    ]) {
      const proof = await buyer.assertion(item); mutate(current);
      assert.notEqual((await approve(proof)).status, 200);
      assert.equal(h.store.request(item.snapshot.request_id).status, 'invalidated');
      assert.equal(h.store.request(item.snapshot.request_id).consent_digest, null);
      current = fixtureOrder(); failure = null; await refresh();
    }
  });
  await t.test('provider refresh after consent changes revision/nonce and blocks old assertion and old consent', async () => {
    const proof = await buyer.assertion(item); assert.equal((await approve(proof)).status, 200);
    const old = item; current.purchase_units[0].amount.value = '1.25';
    await refresh();
    assert.equal(item.status, 'pending'); assert.equal(item.snapshot.amount_minor, '125');
    assert.equal(item.snapshot.revision, old.snapshot.revision + 1); assert.notEqual(item.snapshot.nonce, old.snapshot.nonce);
    assert.notEqual(item.digest, old.digest);
    assert.notEqual((await approve(proof)).status, 200);
    assert.notEqual((await buyer.call(`${path()}/consume`, { digest: old.digest })).status, 200);
  });
  await t.test('consumption re-reads provider evidence; helper/other buyers cannot trigger it', async () => {
    const count = calls.length;
    assert.equal((await helper.call(`${path()}/consume`, { digest: item.digest })).status, 403);
    assert.equal((await other.call(`${path()}/consume`, { digest: item.digest })).status, 404);
    assert.equal(calls.length, count);
    assert.equal((await approve(await buyer.assertion(item))).status, 200);
    const prior = structuredClone(current); current.purchase_units[0].amount.value = '1.26';
    assert.notEqual((await buyer.call(`${path()}/consume`, { digest: item.digest })).status, 200);
    assert.equal(h.store.request(item.snapshot.request_id).status, 'invalidated');
    assert.equal(h.store.request(item.snapshot.request_id).consumed_at, null);
    current = prior; await refresh();
  });
  await t.test('approval and consumption concurrency remain one-time with current provider evidence', async () => {
    const proof = await buyer.assertion(item);
    const outcomes = await Promise.all(Array.from({ length: 6 }, () => approve(proof)));
    assert.equal(outcomes.filter(r => r.status === 200).length, 1);
    const consumed = await Promise.all(Array.from({ length: 6 }, () => buyer.call(`${path()}/consume`, { digest: item.digest })));
    assert.equal(consumed.filter(r => r.status === 200).length, 1);
    assert.equal(h.store.request(item.snapshot.request_id).status, 'consumed');
    assert.notEqual((await buyer.call(`${path()}/consume`, { digest: item.digest })).status, 200);
    assert.notEqual((await helper.call(`${path()}/refresh-provider`, { digest: item.digest })).status, 200);
    await h.restart(); await reload(); assert.equal(item.status, 'consumed');
  });
  await t.test('buyer review clearly labels mocked evidence and separates payment/consent; mobile axe', async () => {
    await buyer.page.reload(); const card = buyer.page.getByRole('article');
    await card.getByText('MOCK PayPal fixture — no real API verification.', { exact: true }).waitFor();
    await card.getByText('Payment authorization and completion: not established.', { exact: false }).waitFor();
    assert.equal(await card.getByRole('button', { name: 'Approve local consent', exact: false }).count(), 0);
    await buyer.page.setViewportSize({ width: 320, height: 900 });
    assert.equal(await buyer.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual((await new AxeBuilder({ page: buyer.page }).analyze()).violations.map(v => v.id), []);
  });
  await t.test('decline wins over an in-flight helper refresh; unavailability cannot override refusal', async () => {
    current = fixtureOrder({ id: 'SECONDORDER123' });
    const second = await helper.call('/api/paypal/requests', { order_id: 'SECONDORDER123', buyer_id: 'buyer-a' });
    assert.equal(second.status, 201); item = second.data;
    let release; delay = new Promise(resolve => { release = resolve; });
    const updating = helper.call(`${path()}/refresh-provider`, { digest: item.digest });
    // Wait until the server starts this GET, then refuse without depending on PayPal availability.
    const prior = calls.length;
    for (let i = 0; i < 100 && calls.length === prior; i++) await new Promise(resolve => setTimeout(resolve, 10));
    const declined = await buyer.call(`${path()}/reject`, { digest: item.digest });
    assert.equal(declined.status, 200); release(); delay = null;
    assert.notEqual((await updating).status, 200);
    assert.equal(h.store.request(item.snapshot.request_id).status, 'rejected');
    assert.notEqual((await buyer.call(`${path()}/options`, { digest: item.digest })).status, 200);
    assert.ok(calls.every(c => c.operation === 'oauth' ? c.method === 'POST' : c.method === 'GET'));
    assert.deepEqual(h.forbidden, []);
  });
});
