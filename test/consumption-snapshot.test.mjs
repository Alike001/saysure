import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openStore } from '../src/store.mjs';
import { provision } from '../src/identity.mjs';
import { requestService } from '../src/requests.mjs';
import { digest, canonical } from '../src/core.mjs';
import { normalizeSandboxOrder } from '../src/paypal-order.mjs';
import { fixtureOrder, merchant, orderId } from './paypal-fixtures.mjs';
import { canonicalConsentDigest, validateConsumptionReceipt, matchesConsumedState } from '../public/consumption.js';
import { reviewedEvidence } from '../public/evidence-provenance.js';
async function fixture(t) {
  const store = openStore(':memory:'); provision(store); t.after(() => store.close());
  const requests = requestService(store), now = Date.now();
  const item = await requests.create({ role: 'helper', user_id: 'helper' }, { buyer_id: 'buyer-a', merchant_id: merchant,
    merchant_name: 'Fixture reference (unverified)', amount: '1.00', currency: 'USD', description: 'Fixture description' });
  item.snapshot.kind = 'paypal'; item.snapshot.provider = normalizeSandboxOrder(fixtureOrder(), orderId, merchant, now);
  item.snapshot.evidence_provenance = 'mock-paypal-fixture';
  item.synthetic = false; item.digest = digest(item.snapshot);
  store.run("UPDATE requests SET snapshot=?,digest=?,consent_digest=?,status='approved' WHERE id=?",
    JSON.stringify(item.snapshot), item.digest, item.digest, item.snapshot.request_id);
  store.run('INSERT INTO paypal_bindings VALUES(?,?,?,1,?)', item.snapshot.request_id, orderId, now, 'mock-paypal-fixture');
  item.paypal_evidence = { provenance: 'mock-paypal-fixture', observed_at: now, current: true, merchant_identity_verified: false };
  const data = await requests.action({ role: 'buyer', user_id: 'buyer-a' }, item.snapshot.request_id, 'consume', item.digest,
    { digest: item.digest, observedAt: now, provenance: 'mock-paypal-fixture' });
  data.consumption_receipt.correlation_id = randomUUID();
  return { item, data };
}
test('valid PayPal receipt retains original reviewed snapshot and verifies its canonical digest', async t => {
  const { item, data } = await fixture(t);
  assert.equal(await canonicalConsentDigest(item.snapshot), item.digest);
  const result = await validateConsumptionReceipt(data, item);
  assert.deepEqual(result.snapshot, item.snapshot); assert.notEqual(result.snapshot, data.snapshot);
  data.snapshot.buyer_id = 'CHANGED_AFTER_VALIDATION'; assert.equal(result.snapshot.buyer_id, 'buyer-a');
});
test('all returned transaction details must exactly match the reviewed snapshot', async t => {
  const { item, data } = fixture(t);
  const changes = {
    buyer: d => d.snapshot.buyer_id = 'buyer-b', amount: d => d.snapshot.amount_minor = '999',
    currency: d => d.snapshot.currency = 'EUR', merchant: d => d.snapshot.merchant_id = 'WRONG123',
    name: d => d.snapshot.merchant_name = 'Different shop', description: d => d.snapshot.description = 'Different item',
    request: d => d.snapshot.request_id = `PAYPAL-${randomUUID()}`, digest: d => d.digest = '0'.repeat(64),
    receipt_buyer: d => d.consumption_receipt.buyer_id = 'buyer-b', receipt_digest: d => d.consumption_receipt.consent_digest = '0'.repeat(64),
    payee: d => d.snapshot.provider.payee_id = 'WRONG123', order: d => d.snapshot.provider.order_id = 'WRONG123',
    provider_status: d => d.snapshot.provider.status = 'APPROVED', unit: d => d.snapshot.provider.units[0].amount_value = '9.99',
    nonce: d => d.snapshot.nonce = 'changed', revision: d => d.snapshot.revision++, expiry: d => d.snapshot.expires_at++,
    extra: d => d.snapshot.extra = 'unreviewed', missing: d => delete d.snapshot.description,
    display: d => d.display_amount = '9.99 USD', missing_event: d => delete d.consumption_receipt.event,
  };
  for (const [name, mutate] of Object.entries(changes)) await t.test(name, async () => {
    const changed = structuredClone(data); mutate(changed);
    await assert.rejects(() => validateConsumptionReceipt(changed, item), /not confirmed/);
    if (!name.startsWith('receipt_') && name !== 'missing_event') assert.equal(matchesConsumedState(changed, data), false, name);
  });
});
test('changing the expected snapshot without updating its canonical digest also fails', async t => {
  const { item, data } = await fixture(t), wrong = structuredClone(item);
  wrong.snapshot.buyer_id = 'buyer-b'; const returned = structuredClone(data); returned.snapshot.buyer_id = 'buyer-b';
  returned.consumption_receipt.buyer_id = 'buyer-b';
  await assert.rejects(() => validateConsumptionReceipt(returned, wrong), /not confirmed/);
});
test('legacy canonical byte domains remain unchanged for synthetic and PayPal snapshots', async () => {
  const s = { request_id: 'SYNTH-test', merchant_id: 'shop', merchant_name: 'Shop', amount_minor: '100',
    currency: 'USD', description: 'notebook', buyer_id: 'buyer-a', nonce: 'nonce', expires_at: 100000, revision: 1 };
  assert.equal(canonical(s), '["synthetic-consent-v1","SYNTH-test","shop","Shop","100","USD","notebook","buyer-a","nonce",100000,1]');
  const p = { environment: 'sandbox', order_id: 'MOCKORDER123', intent: 'CAPTURE', status: 'CREATED',
    payee_id: 'MOCKPAYEE123', amount_minor: '100', currency: 'USD', created_at: 1, provider_window_end: 100,
    units: [{ index: 1, amount_value: '1.00', amount_minor: '100', currency: 'USD' }] };
  const paypal = { ...s, kind: 'paypal', provider: p };
  assert.equal(canonical(paypal), JSON.stringify(['paypal-consent-v1', s.request_id, s.buyer_id, s.merchant_id,
    s.merchant_name, s.amount_minor, s.currency, s.description,
    ['sandbox', 'MOCKORDER123', 'CAPTURE', 'CREATED', 'MOCKPAYEE123', '100', 'USD', 1, 100, [[1, '1.00', '100', 'USD']]],
    s.nonce, s.expires_at, s.revision]));
  for (const value of [s, paypal]) assert.equal(await canonicalConsentDigest(value), digest(value));
});
test('provenance is part of the v2 canonical digest and legacy bytes remain v1', async t => {
  const { item } = await fixture(t), changed = structuredClone(item.snapshot);
  assert.match(canonical(changed), /^\["paypal-consent-v2","mock-paypal-fixture"/);
  changed.evidence_provenance = 'authenticated-sandbox-api'; assert.notEqual(digest(changed), item.digest);
  delete changed.evidence_provenance; assert.match(canonical(changed), /^\["paypal-consent-v1"/);
});
test('receipt rejects missing, unknown and bidirectionally changed provenance', async t => {
  const { item, data } = fixture(t);
  for (const source of ['mock-paypal-fixture', 'authenticated-sandbox-api']) {
    const original = structuredClone(item), receipt = structuredClone(data);
    original.snapshot.evidence_provenance = source; original.paypal_evidence.provenance = source;
    original.digest = digest(original.snapshot);
    receipt.snapshot = structuredClone(original.snapshot); receipt.digest = original.digest;
    receipt.consent_digest = original.digest; receipt.consumption_receipt.consent_digest = original.digest;
    receipt.paypal_evidence.provenance = source;
    await validateConsumptionReceipt(receipt, original);
    for (const bad of [undefined, 'unknown', source === 'mock-paypal-fixture' ? 'authenticated-sandbox-api' : 'mock-paypal-fixture']) {
      const mutated = structuredClone(receipt); mutated.paypal_evidence.provenance = bad;
      await assert.rejects(() => validateConsumptionReceipt(mutated, original), /not confirmed/);
      assert.equal(matchesConsumedState(mutated, receipt), false);
      const changedSnapshot = structuredClone(receipt); changedSnapshot.snapshot.evidence_provenance = bad;
      await assert.rejects(() => validateConsumptionReceipt(changedSnapshot, original), /not confirmed/);
    }
    const evidence = reviewedEvidence(receipt);
    assert.equal(evidence.provenance, source); assert.equal(evidence.current, true);
  }
});
test('fresh evidence timestamps and identity assertions must be verifiable', async t => {
  const { item, data } = fixture(t);
  for (const mutate of [d => d.paypal_evidence.observed_at = Date.now() + 600000,
    d => d.paypal_evidence.observed_at = item.paypal_evidence.observed_at - 1,
    d => d.paypal_evidence.observed_at = null, d => d.paypal_evidence.current = 'true',
    d => d.paypal_evidence.merchant_identity_verified = true]) {
    const changed = structuredClone(data); mutate(changed);
    await assert.rejects(() => validateConsumptionReceipt(changed, item), /not confirmed/);
  }
});
