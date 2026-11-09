import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { openStore } from '../src/store.mjs';
import { provision, issueSession } from '../src/identity.mjs';
import { requestService } from '../src/requests.mjs';
import { paypalRequests } from '../src/paypal-requests.mjs';
import { fixtureOrder, orderId, merchant } from './paypal-fixtures.mjs';
function worker(path, raw) {
  const child = fork(new URL('./consumption-process-worker.mjs', import.meta.url), [], {
    execArgv: ['--import', new URL('../scripts/offline-test-guard.mjs', import.meta.url).pathname],
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: { PATH: process.env.PATH } });
  const seen = [], waiters = [];
  child.on('message', m => { seen.push(m); for (const waiter of [...waiters]) if (m.type === waiter.type) waiter.resolve(m); });
  const wait = type => new Promise((resolve, reject) => {
    const existing = seen.find(m => m.type === type); if (existing) { resolve(existing); return; }
    const timer = setTimeout(() => reject(Error(`CHILD_TIMEOUT_${type}`)), 10000);
    waiters.push({ type, resolve: m => { clearTimeout(timer); resolve(m); } });
  });
  child.send({ type: 'start', path, raw, merchant }); return { child, seen, wait };
}
test('two OS application processes sharing SQLite permit only one provider entry and one consumption', { timeout: 30000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'saysure-process-contention-')), path = join(directory, 'fixture.sqlite');
  const store = openStore(path); provision(store); const raw = fixtureOrder();
  const provider = paypalRequests(store, requestService(store), { merchantId: merchant, allowedOrders: [orderId],
    client: { provenance: 'mock-paypal-fixture', getOrder: async () => structuredClone(raw) } });
  const item = await provider.create({ role: 'helper', user_id: 'helper' }, { order_id: orderId, buyer_id: 'buyer-a' });
  store.run("UPDATE requests SET status='approved',consent_digest=digest WHERE id=?", item.snapshot.request_id);
  const issued = issueSession(store, 'buyer-a'), workers = [worker(path, raw), worker(path, raw)];
  async function post(origin) {
    const response = await fetch(`${origin}/api/requests/${item.snapshot.request_id}/consume`, { method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: `consent_session=${issued.token}`, 'X-CSRF-Token': issued.csrf },
      body: JSON.stringify({ digest: item.digest }) });
    return { status: response.status, data: await response.json() };
  }
  try {
    const [a, b] = await Promise.all(workers.map(w => w.wait('ready'))); assert.notEqual(a.pid, b.pid);
    const first = post(a.origin); await workers[0].wait('provider_entered');
    const second = await post(b.origin); assert.equal(second.status, 409); assert.equal(second.data.error, 'CONSUMPTION_IN_PROGRESS');
    assert.equal(workers[1].seen.filter(m => m.type === 'provider_entered').length, 0);
    workers[0].child.send({ type: 'release' }); const completed = await first; assert.equal(completed.status, 200);
    assert.match(completed.data.consumption_receipt.correlation_id, /^[a-f0-9-]{36}$/);
    assert.equal((await post(b.origin)).status, 409);
    assert.equal(store.request(item.snapshot.request_id).status, 'consumed');
    assert.equal(store.get("SELECT COUNT(*) n FROM events WHERE event='consume'").n, 1);
    assert.equal(store.get('SELECT COUNT(*) n FROM consumption_claims').n, 0);
    assert.equal(workers.flatMap(w => w.seen).filter(m => m.type === 'provider_entered').length, 1);
  } finally {
    await Promise.all(workers.map(async w => {
      const exited = once(w.child, 'exit'); w.child.kill('SIGKILL'); await exited;
    })); store.close(); rmSync(directory, { recursive: true, force: true });
  }
});
