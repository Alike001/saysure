import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { sandboxClient } from './paypal-sandbox.mjs';
import { ensure } from './core.mjs';
export async function localConfig() {
  // Own optional ignored configuration; never import or mutate PayTale at app startup.
  const file = await readFile(new URL('../.env', import.meta.url), 'utf8').catch(error => {
    if (error.code === 'ENOENT') return ''; throw error;
  });
  return { ...parseEnv(file), ...process.env };
}
export function paypalIntegration(env) {
  if (env.PAYPAL_READ_ENABLED !== 'true') return undefined;
  ensure(/^[A-Z0-9]{5,32}$/.test(env.PAYPAL_MERCHANT_ID ?? ''), 'EXPECTED_PAYEE_REQUIRED', 503);
  const allowedOrders = (env.PAYPAL_ALLOWED_ORDER_IDS ?? '').split(',').filter(Boolean);
  ensure(allowedOrders.length <= 10 && allowedOrders.every(id => /^[A-Z0-9]{5,32}$/.test(id)), 'INVALID_ORDER_ALLOWLIST', 503);
  return { client: sandboxClient(env), merchantId: env.PAYPAL_MERCHANT_ID, allowedOrders };
}
