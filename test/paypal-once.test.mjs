import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { APPROVAL, MERCHANT, sha256, prepareOnce, executeOnce, preview } from '../src/paypal-once.mjs';
import { fixtureOrder, jsonResponse, orderId, testConfig } from './paypal-fixtures.mjs';
const fingerprint = sha256(testConfig.PAYPAL_CLIENT_ID);
async function setup(t) {
  const directory = await mkdtemp(join(tmpdir(), 'saysure-once-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const record = await prepareOnce(directory, testConfig, fingerprint);
  const options = { directory, config: testConfig, expectedFingerprint: fingerprint,
    approval: { statement: APPROVAL, review_digest: record.review_digest } };
  return { directory, record, options };
}
const oauth = () => jsonResponse({ access_token: 'PRIVATE-TOKEN', token_type: 'Bearer', expires_in: 3600 });
const goodOrder = () => fixtureOrder({ purchase_units: [{ amount: { value: '1.00', currency_code: 'USD' }, payee: { merchant_id: MERCHANT } }] });
test('preflight is stable, private, no network; changed app/config/payload refused', async t => {
  const { directory, record } = await setup(t);
  assert.deepEqual(await prepareOnce(directory, testConfig, fingerprint), record);
  assert.equal(preview(record).create.body.purchase_units.length, 1);
  for (const config of [{ ...testConfig, PAYPAL_ENV: 'live' }, { ...testConfig, PAYPAL_CLIENT_ID: 'wrong' },
    { ...testConfig, PAYPAL_MERCHANT_ID: 'WRONG123' }, { ...testConfig, PAYPAL_CURRENT_ORDER_ID: orderId },
    { ...testConfig, PAYPAL_BASE_URL: 'https://evil.invalid' }]) {
    await assert.rejects(() => prepareOnce(directory, config, fingerprint));
  }
  record.payload.purchase_units[0].amount.value = '2.00';
  await writeFile(`${directory}/attempt.json`, JSON.stringify(record));
  await assert.rejects(() => prepareOnce(directory, testConfig, fingerprint), /ATTEMPT_CHANGED/);
});
test('missing or different approval prevents even OAuth', async t => {
  const { options } = await setup(t); let calls = 0;
  for (const approval of [undefined, {}, { statement: APPROVAL, review_digest: 'wrong' }]) {
    await assert.rejects(() => executeOnce({ ...options, approval, transport: async () => { calls++; } }), /APPROVAL_REQUIRED/);
  }
  assert.equal(calls, 0);
});
test('one concurrent winner, exact sandbox payload and GET ID, private sanitized provenance', async t => {
  const { options, directory, record } = await setup(t); const calls = [];
  const transport = async (url, opts) => {
    calls.push({ url, ...opts });
    if (url.endsWith('/token')) return oauth();
    if (opts.method === 'POST') return jsonResponse({ id: orderId, status: 'CREATED', payer: 'PRIVATE' }, 201);
    return jsonResponse(goodOrder());
  };
  const outcomes = await Promise.allSettled([executeOnce({ ...options, transport }), executeOnce({ ...options, transport })]);
  assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1);
  const result = outcomes.find(r => r.status === 'fulfilled').value;
  assert.equal(result.validated, true); assert.equal(result.provenance, 'mock-paypal-fixture');
  assert.equal(result.local_validation.consent_granted, false);
  assert.equal(calls.length, 3); assert.deepEqual(JSON.parse(calls[1].body), record.payload);
  assert.equal(calls[1].headers['PayPal-Request-Id'], record.request_id);
  assert.equal(calls[2].url, `https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}`);
  assert.equal(calls[2].method, 'GET');
  assert.doesNotMatch(await readFile(`${directory}/result.json`, 'utf8'), /PRIVATE|email|shipping|test-secret/);
  await assert.rejects(() => executeOnce({ ...options, transport }), { code: 'EEXIST' });
  assert.equal(calls.length, 3);
});
test('create refusal, unreadable response and uncertain network never cause a second create', async t => {
  for (const status of [401, 403, 422, 500, 'network', 'json']) {
    await t.test(String(status), async t => {
      const { options, directory } = await setup(t); let creates = 0;
      const transport = async (url) => {
        if (url.endsWith('/token')) return oauth();
        creates++;
        if (status === 'network') throw new Error('PRIVATE');
        if (status === 'json') return new Response('PRIVATE', { status: 201 });
        return new Response(JSON.stringify({ name: 'NOT_AUTHORIZED', debug_id: 'abcdef1234567',
          details: [{ issue: 'PERMISSION_DENIED', description: 'PRIVATE' }] }), { status });
      };
      const result = await executeOnce({ ...options, transport });
      assert.equal(result.validated, false); assert.equal(creates, 1);
      if (typeof status === 'number') {
        assert.equal(result.operations[1].http_status, status);
        assert.equal(result.operations[1].debug_id, 'abcdef1234567');
        assert.deepEqual(result.operations[1].issues, ['PERMISSION_DENIED']);
      }
      await assert.rejects(() => executeOnce({ ...options, transport }), { code: 'EEXIST' });
      assert.equal(creates, 1);
      assert.doesNotMatch(await readFile(`${directory}/result.json`, 'utf8'), /PRIVATE/);
    });
  }
});
test('GET failure and changed evidence retain actual HTTP status; no mocks or retries substituted', async t => {
  for (const variant of [404, 403, 500, 'amount', 'currency', 'payee', 'id', 'intent', 'units']) {
    await t.test(String(variant), async t => {
      const { options } = await setup(t); let calls = 0;
      const result = await executeOnce({ ...options, transport: async (url, opts) => {
        calls++;
        if (url.endsWith('/token')) return oauth();
        if (opts.method === 'POST') return jsonResponse({ id: orderId, status: 'CREATED' }, 201);
        if (typeof variant === 'number') return jsonResponse({ name: 'RESOURCE_NOT_FOUND' }, variant);
        const data = goodOrder();
        if (variant === 'amount') data.purchase_units[0].amount.value = '2.00';
        if (variant === 'currency') data.purchase_units[0].amount.currency_code = 'EUR';
        if (variant === 'payee') data.purchase_units[0].payee.merchant_id = 'WRONG123';
        if (variant === 'id') data.id = 'WRONG123';
        if (variant === 'intent') data.intent = 'AUTHORIZE';
        if (variant === 'units') data.purchase_units.push(data.purchase_units[0]);
        return jsonResponse(data);
      } });
      assert.equal(calls, 3); assert.equal(result.validated, false); assert.equal(result.order_id, orderId);
      if (typeof variant === 'number') assert.equal(result.operations[2].http_status, variant);
    });
  }
});
