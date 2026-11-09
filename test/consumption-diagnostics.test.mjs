import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import net from 'node:net';
import { openStore } from '../src/store.mjs';
import { consumptionDiagnostics } from '../src/consumption-diagnostics.mjs';
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'saysure-diagnostics-'));
  const store = openStore(join(directory, 'test.sqlite'));
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  return store;
}
test('diagnostics whitelist fields/codes and enforce count, age and byte retention', t => {
  const store = fixture(t); let now = 10000;
  const log = consumptionDiagnostics(store, { now: () => now, maxEntries: 4, maxAgeMs: 100, maxBytes: 1000 });
  t.after(() => log.close());
  const correlation = randomUUID(), requestId = `PAYPAL-${randomUUID()}`;
  const forbidden = { password: 'PRIVATE_PASSWORD', csrf: 'PRIVATE_CSRF', access_token: 'PRIVATE_TOKEN',
    headers: { Authorization: 'PRIVATE_HEADER' }, signature: 'PRIVATE_SIGNATURE', privateKey: 'PRIVATE_KEY',
    session: 'PRIVATE_SESSION', error: new Error('PRIVATE_ERROR'), code: 'PRIVATE_CODE' };
  for (let n = 0; n < 10; n++) assert.equal(log.record(correlation, 'validation_rejected', { ...forbidden, requestId, status: 403 }), true);
  let rows = store.all('SELECT * FROM consumption_diagnostics');
  assert.ok(rows.length > 0 && rows.length <= 4);
  assert.ok(store.get('SELECT SUM(size_bytes) AS n FROM consumption_diagnostics').n <= 1000);
  assert.doesNotMatch(JSON.stringify(rows), /PRIVATE|password|csrf|access_token|Authorization|signature|privateKey|session/);
  assert.ok(rows.every(r => r.correlation_id === correlation && r.code === 'INTERNAL_ERROR' && r.http_status === 403));
  assert.ok(rows.every(r => r.request_tag.length === 16));
  assert.equal(log.record('PRIVATE_BAD_ID', 'validation_rejected', forbidden), false);
  assert.equal(log.record(correlation, 'PRIVATE_STAGE', forbidden), false);
  now += 101; log.record(correlation, 'attempt_received', { code: 'OK' });
  rows = store.all('SELECT * FROM consumption_diagnostics'); assert.equal(rows.length, 1); assert.equal(rows[0].at, now);
  log.close(); now += 101;
  const restarted = consumptionDiagnostics(store, { now: () => now, maxAgeMs: 100 });
  restarted.close(); assert.equal(store.get('SELECT COUNT(*) AS n FROM consumption_diagnostics').n, 0);
  const byteBound = consumptionDiagnostics(store, { now: () => now, maxEntries: 100, maxBytes: 300 });
  t.after(() => byteBound.close());
  for (let n = 0; n < 20; n++) byteBound.record(correlation, 'failed', { code: 'INTERNAL_ERROR' });
  assert.ok(store.get('SELECT COALESCE(SUM(size_bytes),0) AS n FROM consumption_diagnostics').n <= 300);
});
test('diagnostic failure is isolated from mandatory business-event persistence', t => {
  const store = fixture(t), log = consumptionDiagnostics(store); t.after(() => log.close());
  store.db.exec("CREATE TRIGGER fail_diagnostic BEFORE INSERT ON consumption_diagnostics BEGIN SELECT RAISE(ABORT,'PRIVATE_SQL'); END;");
  assert.equal(log.record(randomUUID(), 'failed', { code: 'INTERNAL_ERROR' }), false);
  assert.equal(store.get('SELECT COUNT(*) AS n FROM consumption_diagnostics').n, 0);
});
test('test preload blocks outbound fetch and raw TCP before transport', async () => {
  await assert.rejects(() => fetch('https://offline-test.invalid'), /OFFLINE_TEST_NETWORK_BLOCKED/);
  assert.throws(() => net.connect(443, 'offline-test.invalid'), /OFFLINE_TEST_NETWORK_BLOCKED/);
});

test('unauthenticated flood uses separate bounded aggregates and cannot evict authenticated traces', async t => {
  const { makeApp } = await import('../src/app.mjs');
  const { once } = await import('node:events');
  const store = fixture(t); let now = 10000;
  const limits = { now: () => now, maxEntries: 6, maxBytes: 2000, maxAgeMs: 10000,
    rejections: { maxEntries: 3, maxBytes: 512, maxAgeMs: 100 } };
  const log = consumptionDiagnostics(store, limits); t.after(() => log.close());
  const legitimate = randomUUID(); log.record(legitimate, 'database_committed', { code: 'OK', eventId: 1 });
  const before = store.all('SELECT * FROM consumption_diagnostics');
  const config = { origin: 'http://localhost:3100', rpID: 'localhost', consumptionDiagnostics: limits };
  const app = makeApp(store, config); app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  config.origin = `http://localhost:${app.server.address().port}`;
  try {
    for (let n = 0; n < 40; n++) {
      const response = await fetch(`${config.origin}/api/requests/SYNTH-${randomUUID()}/consume`, {
        method: 'POST', headers: { Origin: 'https://untrusted.invalid', 'Content-Type': 'text/plain' }, body: 'PRIVATE_BODY' });
      assert.equal(response.status, 403); assert.equal(response.headers.get('X-Consumption-Correlation-Id'), null);
      await response.json();
    }
    assert.deepEqual(store.all('SELECT * FROM consumption_diagnostics'), before);
    let counters = store.all('SELECT * FROM consumption_rejections');
    assert.equal(counters.length, 1); assert.equal(counters[0].code, 'INVALID_ORIGIN'); assert.equal(counters[0].count, 40);
    assert.doesNotMatch(JSON.stringify(counters), /PRIVATE|SYNTH|correlation|request_tag/);
    for (const code of ['CSRF_REQUIRED', 'LOGIN_REQUIRED', 'INVALID_JSON', 'INVALID_HOST', 'PRIVATE_UNKNOWN_CODE']) {
      log.reject(code, 403);
    }
    counters = store.all('SELECT * FROM consumption_rejections');
    assert.ok(counters.length <= 3); assert.ok(store.get('SELECT SUM(size_bytes) AS n FROM consumption_rejections').n <= 512);
    assert.deepEqual(store.all('SELECT * FROM consumption_diagnostics'), before);
    now += 101; log.reject('LOGIN_REQUIRED', 401);
    assert.equal(store.get('SELECT COUNT(*) AS n FROM consumption_rejections').n, 1);
    assert.deepEqual(store.all('SELECT * FROM consumption_diagnostics'), before);
    // Authenticated traces retain their own independent limits, with no aggregate migration.
    for (let n = 0; n < 20; n++) log.record(randomUUID(), 'validation_rejected', { code: 'CONSENT_NOT_AVAILABLE' });
    assert.ok(store.get('SELECT COUNT(*) AS n FROM consumption_diagnostics').n <= 6);
    assert.ok(store.get('SELECT SUM(size_bytes) AS n FROM consumption_diagnostics').n <= 2000);
    assert.equal(store.get('SELECT COUNT(*) AS n FROM consumption_rejections').n, 1);
  } finally { await new Promise(resolve => { app.server.close(resolve); app.server.closeAllConnections(); }); }
});
test('aggregate storage failure remains sanitized and does not change consent state', t => {
  const store = fixture(t), log = consumptionDiagnostics(store); t.after(() => log.close());
  store.db.exec("CREATE TRIGGER fail_rejection BEFORE INSERT ON consumption_rejections BEGIN SELECT RAISE(ABORT,'PRIVATE_SQL'); END;");
  assert.equal(log.reject('PRIVATE_TOKEN', 403), false);
  assert.equal(store.get('SELECT COUNT(*) AS n FROM consumption_rejections').n, 0);
  assert.equal(store.get('SELECT COUNT(*) AS n FROM requests').n, 0);
});
