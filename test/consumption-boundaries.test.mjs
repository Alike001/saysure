import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openStore } from '../src/store.mjs';
import { provision } from '../src/identity.mjs';
import { requestService } from '../src/requests.mjs';
import { consumptionService } from '../src/consumption.mjs';
import { digest } from '../src/core.mjs';
import { validateConsumptionReceipt } from '../public/consumption.js';
function fixture(t) {
  const store = openStore(':memory:'); provision(store); t.after(() => store.close());
  const requests = requestService(store);
  const item = requests.create({ role: 'helper', user_id: 'helper' }, { buyer_id: 'buyer-a',
    merchant_id: 'FIXTURE', merchant_name: 'Fixture', amount: '1.00', currency: 'USD', description: 'Fixture' });
  const base = Date.now(), expiry = base + 1000;
  item.snapshot.expires_at = expiry; item.digest = digest(item.snapshot);
  store.run("UPDATE requests SET snapshot=?,digest=?,consent_digest=?,status='approved' WHERE id=?",
    JSON.stringify(item.snapshot), item.digest, item.digest, item.snapshot.request_id);
  store.run('INSERT INTO sessions VALUES(?,?,?,?)', 'FIXTURE_SESSION', 'buyer-a', 'FIXTURE_CSRF', base + 60000);
  return { store, requests, item, base, expiry, session: { id: 'FIXTURE_SESSION', role: 'buyer', user_id: 'buyer-a' } };
}
for (const offset of [-1, 0, 1]) test(`atomic consumption timestamp at expiry ${offset < 0 ? '-1' : '+' + offset} ms`, async t => {
  const f = fixture(t), original = Date.now, at = f.expiry + offset;
  try {
    Date.now = () => at;
    if (offset < 0) {
      const result = f.requests.action(f.session, f.item.snapshot.request_id, 'consume', f.item.digest);
      assert.equal(result.consumed_at, at); assert.equal(result.consumption_receipt.event.at, at);
      result.consumption_receipt.correlation_id = randomUUID();
      await validateConsumptionReceipt(result, f.item, at);
    } else {
      assert.throws(() => f.requests.action(f.session, f.item.snapshot.request_id, 'consume', f.item.digest), /REQUEST_EXPIRED/);
      const row = f.store.get('SELECT * FROM requests WHERE id=?', f.item.snapshot.request_id);
      assert.equal(row.status, 'approved'); assert.equal(row.consumed_at, null); assert.equal(row.consent_digest, f.item.digest);
      assert.equal(f.store.get("SELECT COUNT(*) AS n FROM events WHERE event='consume'").n, 0);
    }
  } finally { Date.now = original; }
});
test('clock crossing between initial validation and transaction acceptance rejects without mutation', async t => {
  const f = fixture(t), original = Date.now; let clock = f.base, validated = false;
  const service = consumptionService(f.store, f.requests, { revalidate: async () => null, invalidate: () => {} });
  try {
    Date.now = () => clock;
    await assert.rejects(() => service.consume(f.session, f.item.snapshot.request_id, f.item.digest, stage => {
      if (stage === 'validation_passed') validated = true;
      if (stage === 'database_started') clock = f.expiry;
    }), /REQUEST_EXPIRED/);
    assert.equal(validated, true);
    const row = f.store.get('SELECT * FROM requests WHERE id=?', f.item.snapshot.request_id);
    assert.equal(row.status, 'approved'); assert.equal(row.consumed_at, null); assert.equal(row.digest, f.item.digest);
    assert.equal(f.store.get("SELECT COUNT(*) AS n FROM events WHERE event='consume'").n, 0);
    assert.equal(f.store.get('SELECT COUNT(*) AS n FROM consumption_claims').n, 0);
  } finally { Date.now = original; }
});
test('event insertion failure rolls back the timestamp and state together', t => {
  const f = fixture(t);
  f.store.db.exec("CREATE TRIGGER fail_event BEFORE INSERT ON events WHEN NEW.event='consume' BEGIN SELECT RAISE(ABORT,'FIXTURE_ROLLBACK'); END;");
  assert.throws(() => f.requests.action(f.session, f.item.snapshot.request_id, 'consume', f.item.digest), /FIXTURE_ROLLBACK/);
  const row = f.store.get('SELECT * FROM requests WHERE id=?', f.item.snapshot.request_id);
  assert.equal(row.status, 'approved'); assert.equal(row.consumed_at, null);
  assert.equal(f.store.get("SELECT COUNT(*) AS n FROM events WHERE event='consume'").n, 0);
});
test('receipt timestamp semantics match the authoritative acceptance timestamp, not later wall time', async t => {
  const f = fixture(t), original = Date.now; let calls = 0;
  try {
    Date.now = () => ++calls === 1 ? f.expiry - 1 : f.expiry + 1;
    const result = f.requests.action(f.session, f.item.snapshot.request_id, 'consume', f.item.digest);
    result.consumption_receipt.correlation_id = randomUUID();
    assert.equal(result.consumed_at, f.expiry - 1); assert.equal(result.consumption_receipt.event.at, f.expiry - 1);
    await validateConsumptionReceipt(result, f.item, f.expiry + 1);
    for (const at of [f.expiry, f.expiry + 1]) {
      const invalid = structuredClone(result); invalid.consumed_at = at;
      invalid.consumption_receipt.consumed_at = at; invalid.consumption_receipt.event.at = at;
      await assert.rejects(() => validateConsumptionReceipt(invalid, f.item, f.expiry + 1), /not confirmed/);
    }
  } finally { Date.now = original; }
});
