import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOrder, assertCurrentOrder, readOnlyOrders } from '../src/paypal-evidence.mjs';
import { assertLocalExperiment } from '../src/origin.mjs';
import { acceptTopics, answer } from '../public/comprehension.js';
import { paymentSummary } from '../public/presentation.js';
const now = 1900000000000;
const order = () => ({ id: 'MOCKORDER123', intent: 'CAPTURE', status: 'PAYER_ACTION_REQUIRED',
  purchase_units: [{ amount: { currency_code: 'USD', value: '1.00' }, payee: { merchant_id: 'MOCKPAYEE123' } }] });
const input = () => ({ order: order(), expectedId: 'MOCKORDER123', observedAt: now, validUntil: now + 600000 });
const item = { synthetic: true, status: 'pending', snapshot: { amount_minor: '100', currency: 'USD',
  merchant_name: 'Example Store', merchant_id: 'SYNTH-SHOP-1', description: 'Synthetic notebook',
  expires_at: now + 600000, revision: 1 } };
test('read-only adapter: exact amount/payee evidence, no verified name or payment authority', async () => {
  const calls = [];
  const read = readOnlyOrders(async request => { calls.push(request); return { status: 200, body: order() }; });
  const evidence = await read('MOCKORDER123', { observedAt: now, validUntil: now + 600000 }, now);
  assert.deepEqual(calls, [{ method: 'GET', path: '/v2/checkout/orders/MOCKORDER123' }]);
  assert.equal(evidence.amount_minor, '100'); assert.equal(evidence.merchant_name_verified, false);
  assert.equal(evidence.buyer_approval, 'not-established'); assert.equal(evidence.payment_authorized_by_saysure, false);
  assert.equal(assertCurrentOrder(evidence, evidence, now), true);
  assert.throws(() => readOnlyOrders(), /EXPLICIT_MOCK_TRANSPORT_REQUIRED/);
  await assert.rejects(() => read('../capture', {}, now), /INVALID_ORDER_ID/);
});
test('provider evidence fails closed for unavailable, incorrect, stale and conflicting orders', () => {
  for (const mutate of [
    x => x.httpStatus = 404, x => x.httpStatus = 401, x => x.order.id = 'OTHER123',
    x => x.observedAt = now - 60000, x => x.observedAt = now + 1,
    x => delete x.validUntil, x => x.validUntil = now,
    x => x.order.purchase_units.push(x.order.purchase_units[0]),
    x => delete x.order.purchase_units[0].payee.merchant_id,
    x => x.order.purchase_units[0].amount.value = '1e2',
    x => x.order.purchase_units[0].amount.currency_code = 'GBP',
    x => x.order.status = 'UNKNOWN', x => x.order.purchase_units[0].payments = { captures: [] },
  ]) { const data = input(); mutate(data); assert.throws(() => normalizeOrder(data, now)); }
  const e = normalizeOrder(input(), now);
  assert.throws(() => assertCurrentOrder(e, e, now + 60000), /STALE/);
  for (const key of ['amount_minor', 'currency', 'payee_id', 'order_id']) {
    assert.throws(() => assertCurrentOrder(e, { ...e, [key]: 'changed' }, now), /DETAILS_CHANGED/);
  }
  for (const status of ['COMPLETED', 'VOIDED']) {
    const data = input(); data.order.status = status;
    const closed = normalizeOrder(data, now);
    assert.throws(() => assertCurrentOrder(closed, closed, now), /NOT_REVIEWABLE/);
  }
  const data = input(); data.order.status = 'APPROVED';
  assert.equal(normalizeOrder(data, now).buyer_approval, 'provider-approved');
});
test('exact speech and ordinary help retain synthetic provenance and stale-state boundaries', () => {
  const spoken = paymentSummary(item, now);
  for (const exact of ['1.00 USD', 'Example Store', 'SYNTH-SHOP-1', 'Synthetic notebook', 'unverified', 'pending']) assert.ok(spoken.includes(exact));
  assert.match(paymentSummary(item, now + 600001), /expired.*cannot receive a new approval/s);
  assert.match(answer('amount', item, now + 600001), /historical.*not an amount payable now/s);
  assert.match(answer('fees', item, now), /does not establish/);
  assert.throws(() => paymentSummary({ ...item, synthetic: false }, now), /unavailable/);
  for (const [currency, minor, exact] of [['JPY', '100', '100 JPY'], ['NGN', '101', '1.01 NGN'], ['EUR', '1', '0.01 EUR']]) {
    assert.ok(paymentSummary({ ...item, snapshot: { ...item.snapshot, currency, amount_minor: minor } }, now).includes(exact));
  }
});
test('AI-selected PayPal topics produce grounded local answers, never model-written facts', () => {
  const paypalItem = {
    synthetic: false, status: 'pending',
    snapshot: { kind: 'paypal', amount_minor: '100', currency: 'USD',
      merchant_id: 'MOCKPAYEE123', merchant_name: 'PayPal payee MOCKPAYEE123 (shop identity unverified)',
      evidence_provenance: 'authenticated-sandbox-api', expires_at: now + 600000,
      provider: { status: 'PAYER_ACTION_REQUIRED', order_id: 'MOCKORDER123', units: [] } },
    paypal_evidence: { provenance: 'authenticated-sandbox-api', observed_at: now,
      current: true, merchant_identity_verified: false }
  };
  assert.match(answer('amount', paypalItem, now), /Recorded order amount: 1\\.00 USD/);
  assert.match(answer('merchant', paypalItem, now), /MOCKPAYEE123.*not independently verified/);
  assert.match(answer('consent', paypalItem, now), /does not approve a PayPal checkout or capture a payment/);
  assert.match(answer('availability', paypalItem, now), /PAYER_ACTION_REQUIRED.*re-read the order/);
  assert.match(answer('fees', paypalItem, now), /does not independently establish taxes/);
  const stale = { ...paypalItem, paypal_evidence: { ...paypalItem.paypal_evidence, current: false } };
  assert.match(answer('availability', stale, now), /historical or stale/);
});

test('AI prose, altered financial values, completion claims and unsupported advice are rejected', () => {
  for (const output of [{ topics: ['amount'], amount: '0.01' }, { topics: ['payment completed'] },
    { topics: ['approve'] }, { topics: ['trusted merchant'] }, { topics: ['refund guaranteed'] },
    { text: 'You have paid 0.01 EUR' }, { topics: [] }, null]) {
    assert.throws(() => acceptTopics(output, 1), /AI_UNSUPPORTED_OUTPUT/);
  }
  assert.deepEqual(acceptTopics({ topics: ['merchant', 'unknown'] }, 2), ['merchant', 'unknown']);
  assert.match(answer('invented', item, now), /cannot answer that safely/);
});
test('localhost RP credentials cannot be repurposed by changing origin/RP settings', () => {
  assertLocalExperiment({ origin: 'http://localhost:3100', rpID: 'localhost' });
  for (const config of [
    { origin: 'http://192.168.1.2:3100', rpID: '192.168.1.2' },
    { origin: 'https://phone.example', rpID: 'phone.example' },
    { origin: 'https://phone.example', rpID: 'localhost' },
    { origin: 'http://127.0.0.1:3100', rpID: 'localhost' },
  ]) assert.throws(() => assertLocalExperiment(config), /SEPARATE_HTTPS_ENROLLMENT_REQUIRED/);
});
