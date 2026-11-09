// Run from repository root. Explicit private file; process.env cannot override reviewed credentials.
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { prepareOnce, executeOnce, preview, sha256 } from '../src/paypal-once.mjs';
const directory = resolve('.local/paypal-one-order');
try {
  const [mode, flag, path, approvalFlag, approvalPath, ...extra] = process.argv.slice(2);
  if (!['preflight', 'execute'].includes(mode) || flag !== '--config' || !path || extra.length ||
    (mode === 'preflight' && approvalFlag) ||
    (mode === 'execute' && (approvalFlag !== '--approval' || !approvalPath))) throw new Error('ARGUMENTS_INVALID');
  const config = parseEnv(await readFile(path, 'utf8'));
  const db = new DatabaseSync(resolve('../capturedesk-feasibility/.local/checkout.sqlite'), { readOnly: true });
  let history;
  try { history = JSON.parse(db.prepare('SELECT document FROM baseline WHERE slot=1').get().document); }
  finally { db.close(); }
  if (history.app_fingerprint !== sha256(config.PAYPAL_CLIENT_ID ?? '') || history.merchant_id !== '7TSZELT2DA9JJ')
    throw new Error('HISTORICAL_BINDING_MISMATCH');
  // Check the application's existing durable order registry without changing it.
  const own = new DatabaseSync(resolve('.local/consent.sqlite'), { readOnly: true });
  try {
    const table = own.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='paypal_bindings'").get();
    if (table && own.prepare('SELECT COUNT(*) AS n FROM paypal_bindings').get().n > 0)
      throw new Error('EXISTING_ORDER_BINDINGS_RECONCILE_FIRST');
  } finally { own.close(); }
  // Also refuse separately provisioned current orders in SaySure's own config.
  const ownConfig = parseEnv(await readFile('.env', 'utf8').catch(e => { if (e.code === 'ENOENT') return ''; throw e; }));
  if (ownConfig.PAYPAL_CURRENT_ORDER_ID || ownConfig.PAYPAL_ALLOWED_ORDER_IDS) throw new Error('EXISTING_ORDER_CONFIG_RECONCILE_FIRST');
  if (mode === 'preflight') {
    const record = await prepareOnce(directory, config, history.app_fingerprint);
    const attempted = await stat(`${directory}/execution-started.json`).then(() => true, e => { if (e.code === 'ENOENT') return false; throw e; });
    console.log(JSON.stringify({ ...preview(record), prior_history: 'One separate historical PayTale order; unavailable per saved 404; no new lookup',
      existing_saysure_order_bindings: 0, attempt_already_started: attempted,
      decision: attempted ? 'STOP: reconcile existing attempt; execution blocked' : 'PREFLIGHT ONLY; separate operator approval required' }, null, 2));
  } else {
    const info = await stat(approvalPath);
    if (!info.isFile() || (info.mode & 0o077) || info.uid !== process.getuid()) throw new Error('APPROVAL_MUST_BE_PRIVATE_OPERATOR_FILE');
    const approval = JSON.parse(await readFile(approvalPath, 'utf8'));
    const result = await executeOnce({ directory, config, expectedFingerprint: history.app_fingerprint, approval });
    console.log(JSON.stringify({ validated: result.validated, operations: result.operations.map(o => ({ operation: o.operation, http_status: o.http_status })),
      private_evidence: '.local/paypal-one-order/result.json', retry_permitted: false }));
    if (!result.validated) process.exitCode = 1;
  }
} catch {
  console.error('STOP: configuration, approval, prior-attempt or evidence guard refused. No retry authorized. Inspect private records; raw errors suppressed.');
  process.exitCode = 1;
}
