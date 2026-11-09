import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareAttended, executeAttended, ATTENDED_APPROVAL, CUTOFF_MS } from '../src/paypal-attended.mjs';
import { privateJson, readJson } from '../src/paypal-read-plan.mjs';
import { prepareOnce } from '../src/paypal-once.mjs';
import { sha } from '../src/core.mjs';
import { testConfig, jsonResponse, fixtureOrder } from './paypal-fixtures.mjs';
import { harness } from './harness.mjs';
const merchant = '7TSZELT2DA9JJ', orderId = 'ATTENDEDORDER123';
async function setup(t) {
  const root = mkdtempSync(join(tmpdir(), 'saysure-attended-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const old = join(root, 'old'), directory = join(root, 'new'); mkdirSync(old);
  const prior = await prepareOnce(old, testConfig, sha(testConfig.PAYPAL_CLIENT_ID));
  privateJson(`${old}/execution-started.json`, { review_digest: prior.review_digest });
  privateJson(`${old}/result.json`, { review_digest: prior.review_digest, validated: true,
    provenance: 'authenticated-sandbox-api', order_id: 'OLDORDER123' }); // Synthetic local historical fixture.
  const { attempt, plan } = await prepareAttended(directory, testConfig, old);
  return { old, directory, attempt, plan, prior };
}
const approve = ({ directory, plan }) => privateJson(`${directory}/operator-approval.json`, { statement: ATTENDED_APPROVAL, plan_digest: plan.digest });
const order = () => fixtureOrder({ id: orderId, status: 'CREATED', purchase_units: [{ payee: { merchant_id: merchant }, amount: { value: '1.00', currency_code: 'USD' } }] });
const transportFor = data => async (url, opts) => url.endsWith('/token') ? jsonResponse({ access_token: 'private-token', token_type: 'Bearer', expires_in: 3600 }) :
  opts.method === 'POST' ? jsonResponse({ id: orderId, status: 'CREATED' }, 201) : jsonResponse(data);
test('new reservation is stable and independent; no attendance/approval means zero network', async t => {
  const s = await setup(t);
  assert.notEqual(s.attempt.request_id, s.prior.request_id);
  assert.deepEqual((await prepareAttended(s.directory, testConfig, s.old)).plan, s.plan);
  let calls = 0;
  const args = { directory: s.directory, config: testConfig, transport: async () => { calls++; } };
  await assert.rejects(() => executeAttended(args), /OPERATOR_REQUIRED/);
  await assert.rejects(() => executeAttended({ ...args, attended: true }), /SEPARATE_APPROVAL_REQUIRED/);
  privateJson(`${s.directory}/operator-approval.json`, { statement: ATTENDED_APPROVAL, plan_digest: s.prior.review_digest });
  await assert.rejects(() => executeAttended({ ...args, attended: true }), /SEPARATE_APPROVAL_REQUIRED/);
  assert.equal(calls, 0); assert.equal(existsSync(`${s.directory}/attended-started.json`), false);
});
test('uncertain create stops once, retains actual HTTP/unknown outcome and cannot restart', async t => {
  const s = await setup(t); approve(s); let creates = 0;
  const transport = async url => {
    if (url.endsWith('/token')) return jsonResponse({ access_token: 'private-token', token_type: 'Bearer', expires_in: 3600 });
    creates++; throw Error('timeout');
  };
  const args = { directory: s.directory, config: testConfig, attended: true, transport };
  await assert.rejects(() => executeAttended(args), /CREATE_READ_FAILED/);
  await assert.rejects(() => executeAttended(args), /ALREADY_USED/);
  assert.equal(creates, 1); assert.equal(readJson(`${s.directory}/result.json`).operations[1].http_status, null);
});
test('15-minute cutoff prevents the next wire request without extending the three-hour policy', async t => {
  const s = await setup(t); approve(s); let clock = Date.now(), calls = 0;
  const transport = async url => { calls++; clock += CUTOFF_MS + 1;
    return jsonResponse({ access_token: 'private-token', token_type: 'Bearer', expires_in: 3600 }); };
  await assert.rejects(() => executeAttended({ directory: s.directory, config: testConfig, attended: true,
    transport, now: () => clock }), /CREATE_READ_FAILED/);
  assert.equal(calls, 1);
});
test('MOCK attended E2E: one OAuth, one create, five GETs; virtual passkey with real verifier; one consumption', { timeout: 120000 }, async t => {
  const s = await setup(t); approve(s); const data = order(), calls = [];
  const base = transportFor(data);
  const transport = async (url, opts) => { calls.push({ url, method: opts.method }); return base(url, opts); };
  const { integration, result, deadline } = await executeAttended({ directory: s.directory, config: testConfig, attended: true, transport });
  assert.equal(result.provenance, 'mock-paypal-fixture'); assert.equal(calls.length, 3);
  assert.equal(integration.deadline, deadline);
  const h = await harness({ paypal: integration }); t.after(() => h.close());
  const helper = await h.actor('helper'), buyer = await h.actor('buyer-a');
  assert.equal((await buyer.register()).status, 200);
  const imported = await helper.call('/api/paypal/requests', { order_id: orderId, buyer_id: 'buyer-a' });
  assert.equal(imported.status, 201); const item = imported.data, path = `/api/requests/${item.snapshot.request_id}`;
  assert.ok(item.snapshot.expires_at <= deadline);
  assert.equal(item.paypal_evidence.provenance, 'mock-paypal-fixture');
  const proof = await buyer.assertion(item);
  assert.equal((await buyer.call(`${path}/approve`, proof)).status, 200);
  assert.equal((await buyer.call(`${path}/consume`, { digest: item.digest })).status, 200);
  assert.notEqual((await buyer.call(`${path}/consume`, { digest: item.digest })).status, 200);
  assert.notEqual((await buyer.call(`${path}/approve`, proof)).status, 200);
  assert.equal(calls.length, 7);
  assert.equal(calls.filter(c => c.method === 'GET').length, 5);
  assert.equal(calls.filter(c => c.method === 'POST' && c.url.endsWith('/token')).length, 1);
  assert.equal(calls.filter(c => c.method === 'POST' && c.url.endsWith('/orders')).length, 1);
  assert.ok(calls.filter(c => c.method === 'GET').every(c => c.url.endsWith(`/orders/${orderId}`)));
  assert.equal(h.store.request(item.snapshot.request_id).status, 'consumed');
  assert.equal(h.store.all("SELECT * FROM events WHERE request_id=? AND event='consume'", item.snapshot.request_id).length, 1);
  assert.deepEqual(h.forbidden, []);
  await assert.rejects(() => executeAttended({ directory: s.directory, config: testConfig, attended: true, transport }), /ALREADY_USED/);
  // Late reads cannot spend another slot; an old grant cannot renew the token.
  const planPath = `${s.directory}/consent-read/plan.json`, plan = readJson(planPath);
  plan.operational_deadline = Date.now() - 1;
  delete plan.digest; plan.digest = sha(JSON.stringify(plan)); privateJson(planPath, plan, false);
  await assert.rejects(() => integration.client.getOrder(orderId)); assert.equal(calls.length, 7);
});

test('operational cutoff after creation blocks fresh evidence without another external call', async t => {
  const s = await setup(t); approve(s); let calls = 0;
  const base = transportFor(order());
  const transport = async (url, options) => { calls++; return base(url, options); };
  const { integration, deadline } = await executeAttended({ directory: s.directory, config: testConfig, attended: true, transport });
  const originalNow = Date.now;
  try {
    Date.now = () => deadline + 1;
    await assert.rejects(() => integration.client.getOrder(orderId), /OPERATIONAL_CUTOFF/);
    assert.equal(calls, 3);
  } finally { Date.now = originalNow; }
});

test('an anomalous create response with the old ID cannot trigger a GET of the expired order', async t => {
  const s = await setup(t); approve(s); const calls = [];
  const transport = async (url, options) => {
    calls.push({ url, method: options.method });
    return url.endsWith('/token') ? jsonResponse({ access_token: 'private-token', token_type: 'Bearer', expires_in: 3600 }) :
      jsonResponse({ id: 'OLDORDER123', status: 'CREATED' }, 201);
  };
  await assert.rejects(() => executeAttended({ directory: s.directory, config: testConfig, attended: true, transport }), /CREATE_READ_FAILED/);
  assert.equal(calls.length, 2); assert.ok(calls.every(call => call.method === 'POST'));
});
