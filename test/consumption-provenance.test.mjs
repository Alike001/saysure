import test from 'node:test';
import assert from 'node:assert/strict';
import { openStore } from '../src/store.mjs';
import { provision } from '../src/identity.mjs';
import { requestService } from '../src/requests.mjs';
import { paypalRequests } from '../src/paypal-requests.mjs';
import { sandboxClient } from '../src/paypal-sandbox.mjs';
import { adapterProvenance } from '../src/paypal-provenance.mjs';
import { digest } from '../src/core.mjs';
import { harness } from './harness.mjs';
import { fixtureOrder, orderId, merchant, testConfig } from './paypal-fixtures.mjs';
const helper = { role: 'helper', user_id: 'helper' }, buyer = { role: 'buyer', user_id: 'buyer-a' };
test('only sealed native adapters can claim authenticated API provenance; injected clients fail before read', async t => {
  const store = openStore(':memory:'); provision(store); t.after(() => store.close());
  let reads = 0;
  for (const provenance of ['authenticated-sandbox-api', undefined, 'unknown']) {
    const provider = paypalRequests(store, requestService(store), { merchantId: merchant, allowedOrders: [orderId],
      client: { provenance, async getOrder() { reads++; return fixtureOrder(); } } });
    await assert.rejects(() => provider.create(helper, { order_id: orderId, buyer_id: 'buyer-a' }), /PROVENANCE_INVALID/);
  }
  assert.equal(reads, 0);
  // Construction alone, with fixture configuration: no authentication or network operation.
  const native = sandboxClient(testConfig);
  assert.equal(adapterProvenance(native), 'authenticated-sandbox-api');
  assert.throws(() => native.provenance = 'mock-paypal-fixture', TypeError);
  assert.equal(adapterProvenance(sandboxClient(testConfig, { transport: async () => { throw Error('NO_IO'); } })), 'mock-paypal-fixture');
});
test('provenance changed after approval fails closed before provider reservation', async t => {
  const store = openStore(':memory:'); provision(store); t.after(() => store.close()); let reads = 0;
  const client = { provenance: 'mock-paypal-fixture', async getOrder() { reads++; return fixtureOrder(); } };
  const provider = paypalRequests(store, requestService(store), { merchantId: merchant, allowedOrders: [orderId], client });
  const item = await provider.create(helper, { order_id: orderId, buyer_id: 'buyer-a' });
  const id = item.snapshot.request_id;
  store.run("UPDATE requests SET status='approved',consent_digest=digest WHERE id=?", id);
  client.provenance = 'authenticated-sandbox-api';
  await assert.rejects(() => provider.revalidate(buyer, id, { status: 'approved', digest: item.digest, consumption: true }), /PROVENANCE/);
  assert.equal(reads, 1); assert.equal(store.request(id).status, 'invalidated');
  assert.equal(store.get("SELECT COUNT(*) n FROM events WHERE event='consume'").n, 0);
});
test('provenance changed during provider observation cannot produce fresh proof', async t => {
  const store = openStore(':memory:'); provision(store); t.after(() => store.close()); let change = false;
  const raw = fixtureOrder(), client = { provenance: 'mock-paypal-fixture', async getOrder() {
    if (change) client.provenance = 'authenticated-sandbox-api'; return raw;
  } };
  const provider = paypalRequests(store, requestService(store), { merchantId: merchant, allowedOrders: [orderId], client });
  const item = await provider.create(helper, { order_id: orderId, buyer_id: 'buyer-a' });
  store.run("UPDATE requests SET status='approved',consent_digest=digest WHERE id=?", item.snapshot.request_id); change = true;
  await assert.rejects(() => provider.revalidate(buyer, item.snapshot.request_id), /PROVENANCE/);
  assert.equal(store.request(item.snapshot.request_id).status, 'invalidated');
});
test('browser retains mock review and never announces success for promoted receipt metadata', async t => {
  const raw = fixtureOrder(), h = await harness({ paypal: { merchantId: merchant, allowedOrders: [orderId],
    client: { provenance: 'mock-paypal-fixture', getOrder: async () => structuredClone(raw) } } });
  t.after(() => h.close()); const helperActor = await h.actor('helper', false), buyerActor = await h.actor('buyer-a', false);
  const imported = await helperActor.call('/api/paypal/requests', { order_id: orderId, buyer_id: 'buyer-a' });
  const id = imported.data.snapshot.request_id;
  h.store.run("UPDATE requests SET status='approved',consent_digest=digest WHERE id=?", id);
  await buyerActor.page.reload();
  const consume = buyerActor.page.getByRole('button', { name: 'Consume consent once (local test only)', exact: true });
  await consume.waitFor();
  await buyerActor.page.route('**/api/requests/*/consume', async route => {
    const response = await route.fetch(), data = await response.json();
    data.paypal_evidence.provenance = 'authenticated-sandbox-api'; await route.fulfill({ response, json: data });
  });
  await buyerActor.page.route('**/api/requests', route => route.fulfill({ status: 500, json: { error: 'FIXTURE_REFRESH_FAILURE' } }));
  await consume.click();
  await buyerActor.page.locator('#message').filter({ hasText: 'Consumption was not confirmed' }).waitFor();
  const text = await buyerActor.page.locator('#requests').innerText();
  assert.match(text, /MOCK PayPal fixture/); assert.doesNotMatch(text, /PayPal order verified\./);
  assert.equal(h.store.request(id).status, 'consumed'); // Committed state is not undone by a rejected acknowledgement.
  assert.equal(h.store.get("SELECT COUNT(*) n FROM events WHERE event='consume'").n, 1);
});
test('authenticated fixture labels require canonical binding; failed refresh retains verified committed state', async t => {
  const raw = fixtureOrder(), h = await harness({ paypal: { merchantId: merchant, allowedOrders: [orderId],
    client: { provenance: 'mock-paypal-fixture', getOrder: async () => raw } } });
  t.after(() => h.close()); const helperActor = await h.actor('helper', false), buyerActor = await h.actor('buyer-a', false);
  const imported = await helperActor.call('/api/paypal/requests', { order_id: orderId, buyer_id: 'buyer-a' });
  const item = imported.data, id = item.snapshot.request_id;
  // Deliberate synthetic UI-only authenticated-shape fixture, never a real API observation.
  item.snapshot.evidence_provenance = 'authenticated-sandbox-api'; item.paypal_evidence.provenance = 'authenticated-sandbox-api';
  item.digest = digest(item.snapshot); item.consent_digest = item.digest; item.status = 'consumed'; item.consumed_at = Date.now();
  const { randomUUID } = await import('node:crypto');
  item.consumption_receipt = { version: 1, correlation_id: randomUUID(), committed: true, request_id: id, buyer_id: 'buyer-a',
    status: 'consumed', consent_digest: item.digest, consumed_at: item.consumed_at,
    event: { id: 123, type: 'consume', request_id: id, at: item.consumed_at } };
  const review = { ...item, status: 'approved', consumed_at: null };
  await buyerActor.page.route('**/api/requests', route => route.fulfill({ json: [review] })); await buyerActor.page.reload();
  await buyerActor.page.getByText('PayPal order verified.', { exact: false }).first().waitFor();
  await buyerActor.page.route('**/api/requests/*/consume', route => route.fulfill({ json: item }));
  await buyerActor.page.route('**/api/requests', route => route.fulfill({ status: 500, json: { error: 'FIXTURE' } }));
  await buyerActor.page.getByRole('button', { name: 'Consume consent once (local test only)', exact: true }).click();
  await buyerActor.page.locator('#message').filter({ hasText: 'committed receipt was confirmed' }).waitFor();
  assert.match(await buyerActor.page.locator('#requests').innerText(), /PayPal order verified\./);
  assert.equal(await buyerActor.page.getByRole('button', { name: 'Consume consent once (local test only)', exact: true }).count(), 0);
});
