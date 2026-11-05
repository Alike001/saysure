import test from 'node:test';
import assert from 'node:assert/strict';
import { canonical, digest, fields, displayAmount } from '../src/core.mjs';
import { sample } from './harness.mjs';

test('canonical snapshot: each bound field changes digest, property order does not', () => {
  const snapshot = { request_id: 'SYNTH-test', merchant_id: 'shop', merchant_name: 'Shop',
    amount_minor: '100', currency: 'USD', description: 'notebook', buyer_id: 'buyer-a',
    nonce: 'nonce', expires_at: 100000, revision: 1 };
  const changes = { request_id: 'SYNTH-other', merchant_id: 'other', merchant_name: 'Other',
    amount_minor: '200', currency: 'EUR', description: 'other', buyer_id: 'buyer-b',
    nonce: 'other', expires_at: 100001, revision: 2 };
  for (const [field, value] of Object.entries(changes)) {
    assert.notEqual(digest({ ...snapshot, [field]: value }), digest(snapshot), field);
  }
  const reversed = Object.fromEntries(Object.entries(snapshot).reverse());
  assert.equal(canonical(reversed), canonical(snapshot));
  assert.equal(digest(reversed), digest(snapshot));
});
test('exact integer amounts, supported exponents and unsupported/ambiguous input rejection', () => {
  assert.equal(fields(sample({ amount: '0.01' })).amount_minor, '1');
  assert.equal(fields(sample({ amount: '1.2' })).amount_minor, '120');
  assert.equal(fields(sample({ amount: '100', currency: 'JPY' })).amount_minor, '100');
  assert.equal(displayAmount({ amount_minor: '1', currency: 'USD' }), '0.01 USD');
  assert.equal(displayAmount({ amount_minor: '100', currency: 'JPY' }), '100 JPY');
  for (const amount of ['0', '-1', '01', '1e2', '1,00', '1.001', ' 1.00', 'Infinity']) {
    assert.throws(() => fields(sample({ amount })), undefined, amount);
  }
  assert.throws(() => fields(sample({ amount: '1.00', currency: 'JPY' })));
  assert.throws(() => fields(sample({ merchant_name: 'Shop\u202eevil' })));
});
