import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { localConfig } from '../src/paypal-config.mjs';
import { sandboxClient } from '../src/paypal-sandbox.mjs';
import { normalizeSandboxOrder, reviewable } from '../src/paypal-order.mjs';
const report = { at: new Date().toISOString(), operations: [], order_creation: 0,
  captures: 0, refunds: 0, authorizations: 0, current_order_verified: false };
try {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--config')) throw new Error('CONFIG_ARGUMENT_INVALID');
  const config = args.length ? { ...parseEnv(await readFile(args[1], 'utf8')), ...process.env } : await localConfig();
  const client = sandboxClient(config, { observe: event => report.operations.push(event) });
  await client.probeAuthentication(); report.oauth_authenticated = true;
  if (!config.PAYPAL_CURRENT_ORDER_ID) report.blocker = 'No current order configured; historical 404 order not queried.';
  else {
    if (!(config.PAYPAL_ALLOWED_ORDER_IDS ?? '').split(',').includes(config.PAYPAL_CURRENT_ORDER_ID)) throw new Error('ORDER_NOT_ALLOWLISTED');
    const started = Date.now(), order = await client.getOrder(config.PAYPAL_CURRENT_ORDER_ID);
    const p = normalizeSandboxOrder(order, config.PAYPAL_CURRENT_ORDER_ID, config.PAYPAL_MERCHANT_ID, started);
    reviewable(p); report.current_order_verified = true;
    report.normalized = p; // Allowlist projection only; no payer/addresses/merchant prose.
  }
} catch (error) {
  report.blocker = /^PAYPAL_[A-Z_0-9]+$|^ORDER_[A-Z_]+$|^EXPECTED_PAYEE_REQUIRED$/.test(error.message)
    ? error.message : 'CONFIG_OR_PROVIDER_UNAVAILABLE';
}
await writeFile(new URL('../evidence/paypal-readiness.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
