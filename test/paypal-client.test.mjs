import test from 'node:test';
import assert from 'node:assert/strict';
import { sandboxClient, SANDBOX } from '../src/paypal-sandbox.mjs';
import { normalizeSandboxOrder, sameOrder } from '../src/paypal-order.mjs';
import { plannedOrder, createSandboxOrder } from '../src/paypal-create.mjs';
import { paypalIntegration } from '../src/paypal-config.mjs';
import { digest } from '../src/core.mjs';
import { fixtureOrder, merchant, orderId, testConfig, jsonResponse } from './paypal-fixtures.mjs';

test('sandbox client authenticates backend GET, caches token, redacts normalized fields', async () => {
  const calls = [], observed = [];
  const client = sandboxClient(testConfig, { transport: async (url, options) => {
    calls.push({ url, ...options });
    return jsonResponse(url.endsWith('/token') ? { access_token: 'test-token', token_type: 'Bearer', expires_in: 3600 } : fixtureOrder());
  }, observe: event => observed.push(event) });
  const started = Date.now(), raw = await client.getOrder(orderId); await client.getOrder(orderId);
  assert.equal(calls.length, 3); assert.equal(calls[0].method, 'POST'); assert.equal(calls[1].method, 'GET');
  assert.equal(calls[1].url, `${SANDBOX}/v2/checkout/orders/${orderId}`);
  assert.equal(calls[1].headers.Authorization, 'Bearer test-token');
  assert.equal(calls[0].body, 'grant_type=client_credentials'); assert.equal(calls[1].redirect, 'error');
  assert.equal(client.provenance, 'mock-paypal-fixture');
  const p = normalizeSandboxOrder(raw, orderId, merchant, started);
  assert.equal(p.amount_minor, '100'); assert.equal(p.payee_id, merchant);
  assert.doesNotMatch(JSON.stringify({ p, observed }), /PRIVATE|email_address|access_token|test-secret|test-token/);
});
test('sandbox GET failures 401/403/404/5xx, OAuth failure, bad JSON and network fail safely', async () => {
  for (const status of [401, 403, 404, 500, 503]) {
    const client = sandboxClient(testConfig, { transport: async url => url.endsWith('/token')
      ? jsonResponse({ access_token: 'token', token_type: 'Bearer', expires_in: 3600 }) : jsonResponse({ secret: 'PRIVATE' }, status) });
    await assert.rejects(() => client.getOrder(orderId), new RegExp(`PAYPAL_HTTP_${status}`));
  }
  for (const transport of [async () => jsonResponse({}, 401), async () => { throw new Error('PRIVATE'); },
    async () => new Response('PRIVATE'), async () => jsonResponse({ access_token: 'bad\r\n', token_type: 'Bearer', expires_in: 1 })]) {
    await assert.rejects(() => sandboxClient(testConfig, { transport }).getOrder(orderId), e => !e.message.includes('PRIVATE'));
  }
});
test('401 evicts token, expired tokens renew, concurrent OAuth is coalesced without hidden GET retries', async () => {
  let clock = 1000, tokens = 0, fail = false;
  const client = sandboxClient(testConfig, { now: () => clock, transport: async url => {
    if (url.endsWith('/token')) { tokens++; return jsonResponse({ access_token: 'token', token_type: 'Bearer', expires_in: 120 }); }
    return jsonResponse(fail ? {} : fixtureOrder(), fail ? 401 : 200);
  } });
  await Promise.all([client.getOrder(orderId), client.getOrder(orderId)]); assert.equal(tokens, 1);
  clock += 61000; await client.getOrder(orderId); assert.equal(tokens, 2);
  fail = true; await assert.rejects(() => client.getOrder(orderId));
  fail = false; await client.getOrder(orderId); assert.equal(tokens, 3);
});
test('exact multi-unit totals and ownership/currency/time/missing-field boundaries', () => {
  const now = Date.now(), unit = fixtureOrder().purchase_units[0];
  const raw = fixtureOrder({ create_time: new Date(now).toISOString(), purchase_units: [unit, { ...unit, amount: { value: '0.29', currency_code: 'USD' } }] });
  const p = normalizeSandboxOrder(raw, orderId, merchant, now);
  assert.equal(p.amount_minor, '129'); assert.equal(p.units[1].amount_value, '0.29');
  assert.equal(sameOrder(p, structuredClone(p)), true);
  for (const mutate of [x => x.id = 'WRONG123', x => x.intent = 'AUTHORIZE', x => delete x.status,
    x => delete x.create_time, x => x.create_time = new Date(now - 10800001).toISOString(),
    x => delete x.purchase_units[0].amount, x => delete x.purchase_units[0].payee,
    x => x.purchase_units[0].payee.merchant_id = 'WRONG123',
    x => x.purchase_units[1].amount.currency_code = 'EUR',
    x => x.purchase_units[0].amount.value = '0.001']) {
    const data = structuredClone(raw); mutate(data);
    assert.throws(() => normalizeSandboxOrder(data, orderId, merchant, now));
  }
  assert.throws(() => normalizeSandboxOrder(raw, orderId, merchant, now - 60000, now));
  const s = { kind: 'paypal', provider: p, request_id: 'PAYPAL-test', buyer_id: 'buyer-a', nonce: 'nonce', revision: 1, expires_at: now + 1000 };
  for (const key of ['order_id', 'payee_id', 'currency', 'amount_minor', 'status', 'intent', 'environment']) {
    assert.notEqual(digest(s), digest({ ...s, provider: { ...p, [key]: 'changed' } }));
  }
  const altered = structuredClone(s); altered.provider.units[0].amount_minor = '999';
  assert.notEqual(digest(s), digest(altered));
});
test('configuration and creation gates cannot trigger unapproved network operations', async () => {
  let calls = 0;
  for (const options of [{}, { enabled: true }, { operatorApproved: true }]) {
    await assert.rejects(() => createSandboxOrder({ ...options, transport: async () => { calls++; } }), /CREATION_DISABLED/);
  }
  assert.equal(calls, 0); assert.equal(plannedOrder(merchant).purchase_units[0].amount.value, '1.00');
  assert.equal(plannedOrder(merchant).intent, 'CAPTURE');
  for (const config of [{ ...testConfig, PAYPAL_ENV: 'live' }, { ...testConfig, PAYPAL_BASE_URL: 'https://evil.example' },
    { ...testConfig, PAYPAL_MODE: 'live' }, { ...testConfig, PAYPAL_CLIENT_SECRET: '' }]) assert.throws(() => sandboxClient(config));
  assert.equal(paypalIntegration(testConfig), undefined);
  assert.throws(() => paypalIntegration({ ...testConfig, PAYPAL_READ_ENABLED: 'true' }), /EXPECTED_PAYEE/);
  await assert.rejects(() => sandboxClient(testConfig).getOrder('../capture'), /INVALID_ORDER_ID/);
});
