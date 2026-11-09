import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:net';
import { prepareAttended, executeAttended, loadAttended } from '../src/paypal-attended.mjs';
import { readJson, privateJson } from '../src/paypal-read-plan.mjs';
import { digest, ensure } from '../src/core.mjs';
const directory = resolve('.local/paypal-attended-final');
try {
  const [mode, flag, path, attendedFlag, ...extra] = process.argv.slice(2);
  ensure(['preflight', 'run', 'report'].includes(mode) && !extra.length, 'ATTENDED_ARGUMENTS_INVALID');
  if (mode === 'report') {
    ensure(!flag, 'ATTENDED_ARGUMENTS_INVALID');
    const result = readJson(`${directory}/result.json`);
    ensure(result.validated, 'ATTENDED_NO_VERIFIED_ORDER');
    const db = new DatabaseSync(resolve('.local/consent.sqlite'), { readOnly: true });
    try {
      const binding = db.prepare('SELECT request_id,provenance,observed_at FROM paypal_bindings WHERE order_id=?').get(result.order_id);
      const row = binding && db.prepare('SELECT * FROM requests WHERE id=?').get(binding.request_id);
      const snapshot = row && JSON.parse(row.snapshot);
      const report = { at: new Date().toISOString(), order_id: result.order_id, bound: !!row,
        provenance: binding?.provenance, local_status: row?.status,
        snapshot_digest_valid: !!row && digest(snapshot) === row.digest,
        consent_digest_matches: !!row && row.consent_digest === row.digest,
        consumed_at: row?.consumed_at, provider: snapshot?.provider,
        events: row ? db.prepare('SELECT at,event FROM events WHERE request_id=? ORDER BY seq').all(row.id) : [],
        phone_ceremony: 'Requires separate operator observation; database does not identify authenticator hardware',
        payment_executed_by_saysure: false };
      privateJson(`${directory}/consent-report-${Date.now()}.json`, report);
      console.log(JSON.stringify({ bound: report.bound, local_status: report.local_status,
        snapshot_digest_valid: report.snapshot_digest_valid, private_report_saved: true }));
    } finally { db.close(); }
  } else {
    ensure(flag === '--config' && path && (mode === 'run' ? attendedFlag === '--attended' : !attendedFlag), 'ATTENDED_ARGUMENTS_INVALID');
    const config = parseEnv(readFileSync(path, 'utf8'));
    // Existing enrolled buyer required; never provision/reset this database.
    const db = new DatabaseSync(resolve('.local/consent.sqlite'), { readOnly: true });
    try {
      ensure(db.prepare("SELECT COUNT(*) AS n FROM credentials WHERE buyer_id='buyer-a'").get().n === 1, 'ATTENDED_EXISTING_PASSKEY_REQUIRED');
    } finally { db.close(); }
    if (mode === 'preflight') {
      const { attempt, plan } = await prepareAttended(directory, config, resolve('.local/paypal-one-order'));
      console.log(JSON.stringify({ authorization: 'NOT APPROVED; no network', app_fingerprint_prefix: plan.app_fingerprint.slice(0,12),
        merchant: plan.merchant_id, payload: attempt.payload, request_id: attempt.request_id, plan_digest: plan.digest,
        ceilings: { oauth: 1, creates: 1, gets: 5 }, operational_cutoff_minutes: 15,
        approval_file_present: existsSync(`${directory}/operator-approval.json`), prior_attempt_started: existsSync(`${directory}/attended-started.json`) }, null, 2));
    } else {
      ensure(process.stdin.isTTY, 'ATTENDED_PRIVATE_TERMINAL_REQUIRED');
      loadAttended(directory, config);
      // Check the fixed localhost port before consuming any external operation.
      await new Promise((resolvePort, reject) => {
        const probe = createServer(); probe.once('error', () => reject(new Error('ATTENDED_PORT_BUSY')));
        probe.listen(3100, '127.0.0.1', () => probe.close(resolvePort));
      });
      const { integration, result, deadline } = await executeAttended({ directory, config, attended: true });
      console.log(JSON.stringify({ order_id: result.order_id, status: result.provider_fields.status,
        amount: '1.00 USD', operational_cutoff_utc: new Date(deadline).toISOString(), payment_executed: false }));
      const { startLocalServer } = await import('../src/server.mjs');
      await startLocalServer(integration);
    }
  }
} catch (error) {
  console.error(/^ATTENDED_[A-Z_]+$|^READ_[A-Z_]+$/.test(error.message) ? error.message : 'ATTENDED_STOP_INSPECT_PRIVATE_RECORDS_NO_RETRY');
  process.exitCode = 1;
}
