import test from 'node:test';
import assert from 'node:assert/strict';
import * as provenance from '../src/paypal-provenance.mjs';
import * as sandbox from '../src/paypal-sandbox.mjs';
import { fixtureOrder, orderId, testConfig, jsonResponse } from './paypal-fixtures.mjs';
import { consentReadIntegration, privateJson, READ_APPROVAL } from '../src/paypal-read-plan.mjs';
import { sha } from '../src/core.mjs';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('unrelated modules cannot register or seal arbitrary authenticated clients', () => {
  assert.deepEqual(Object.keys(provenance), ['adapterProvenance']);
  assert.deepEqual(Object.keys(sandbox).sort(), ['SANDBOX', 'sandboxAdapterProvenance', 'sandboxClient'].sort());
  const fake = Object.freeze({ provenance: 'authenticated-sandbox-api', getOrder: async () => fixtureOrder() });
  assert.equal(sandbox.sandboxAdapterProvenance(fake), undefined);
  assert.throws(() => provenance.adapterProvenance(fake), /PROVENANCE_INVALID/);
  assert.throws(() => provenance.sealSandboxAdapter(fake, fetch), TypeError);
});
test('only fixed adapter construction receives native identity; copying or replacing methods cannot mint it', () => {
  // Inspect identity only: never invoke this native adapter or authenticate.
  const native = sandbox.sandboxClient(testConfig);
  assert.equal(provenance.adapterProvenance(native), 'authenticated-sandbox-api');
  assert.equal(sandbox.sandboxAdapterProvenance({ ...native }), undefined);
  assert.throws(() => provenance.adapterProvenance({ ...native }), /PROVENANCE_INVALID/);
  assert.throws(() => native.getOrder = async () => fixtureOrder(), TypeError);
  assert.throws(() => native.provenance = 'mock-paypal-fixture', TypeError);
});
test('every supplied transport including fetch references and explicit authentication claims is mock', () => {
  for (const transport of [fetch, fetch.bind(globalThis), async () => jsonResponse(fixtureOrder())]) {
    const client = sandbox.sandboxClient(testConfig, { transport, provenance: 'authenticated-sandbox-api', authenticated: true });
    assert.equal(provenance.adapterProvenance(client), 'mock-paypal-fixture');
  }
  assert.throws(() => sandbox.sandboxClient(testConfig, { transport: undefined }), /TRANSPORT_INVALID/);
  assert.equal(provenance.adapterProvenance({ provenance: 'mock-paypal-fixture', getOrder: async () => fixtureOrder() }), 'mock-paypal-fixture');
});
test('policy hooks cannot replace evidence or endpoints; fixture observations remain mock', async () => {
  const calls = [], raw = fixtureOrder(), stages = [];
  const client = sandbox.sandboxClient(testConfig, {
    transport: async (url, options) => {
      calls.push({ url, method: options.method, redirect: options.redirect });
      return url.endsWith('/token') ? jsonResponse({ access_token: 'FIXTURE_TOKEN', token_type: 'Bearer', expires_in: 3600 }) : jsonResponse(raw);
    },
    beforeRequest(operation) { stages.push(operation); return 'FIXTURE_RESERVATION'; },
    afterResponse(slot, metadata) {
      assert.equal(slot, 'FIXTURE_RESERVATION'); assert.deepEqual(Object.keys(metadata).sort(), ['debug_id', 'http_status']);
      return jsonResponse(fixtureOrder({ id: 'FORGEDORDER123' }));
    },
    afterOrder(copy) { copy.id = 'FORGEDORDER123'; return copy; },
  });
  const result = await client.getOrder(orderId, { onReadReserved: () => stages.push('read_reserved') });
  assert.equal(result.id, orderId); assert.equal(provenance.adapterProvenance(client), 'mock-paypal-fixture');
  assert.deepEqual(calls, [
    { url: `${sandbox.SANDBOX}/v1/oauth2/token`, method: 'POST', redirect: 'error' },
    { url: `${sandbox.SANDBOX}/v2/checkout/orders/${orderId}`, method: 'GET', redirect: 'error' },
  ]);
  assert.deepEqual(stages, ['oauth', 'order_get', 'read_reserved']);
  await assert.rejects(() => client.getOrder('../capture'), /INVALID_ORDER_ID/); assert.equal(calls.length, 2);
  for (const overrides of [{ PAYPAL_ENV: 'live' }, { PAYPAL_BASE_URL: 'https://api-m.paypal.com' }, { PAYPAL_MODE: 'live' }]) {
    assert.throws(() => sandbox.sandboxClient({ ...testConfig, ...overrides }), /SANDBOX_ONLY/);
  }
});
test('read policy preserves actual adapter identity and conservatively marks any injected transport mock', t => {
  const dir = mkdtempSync(join(tmpdir(), 'saysure-native-policy-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const plan = { version: 1, host: sandbox.SANDBOX, order_id: orderId, merchant_id: '7TSZELT2DA9JJ',
    amount: '1.00', currency: 'USD', intent: 'CAPTURE', status: 'CREATED', buyer_id: 'buyer-a',
    app_fingerprint: sha(testConfig.PAYPAL_CLIENT_ID), max_gets: 4, max_oauth: 1 };
  plan.digest = sha(JSON.stringify(plan)); privateJson(`${dir}/plan.json`, plan);
  privateJson(`${dir}/operator-approval.json`, { statement: READ_APPROVAL, plan_digest: plan.digest });
  const native = consentReadIntegration(testConfig, dir).client;
  assert.equal(sandbox.sandboxAdapterProvenance(native), 'authenticated-sandbox-api');
  assert.equal(provenance.adapterProvenance(consentReadIntegration(testConfig, dir, { transport: fetch }).client), 'mock-paypal-fixture');
  assert.deepEqual(readdirSync(dir).sort(), ['operator-approval.json', 'plan.json']); // Construction spends no operation.
});
