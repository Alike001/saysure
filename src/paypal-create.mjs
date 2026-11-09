import { ensure, Failure } from './core.mjs';
import { SANDBOX } from './paypal-sandbox.mjs';
// Separate future capability. No app route, CLI execution path, capture or authorize method.
export function plannedOrder(merchantId) {
  ensure(typeof merchantId === 'string' && /^[A-Z0-9]{5,32}$/.test(merchantId), 'EXPECTED_PAYEE_REQUIRED');
  return { intent: 'CAPTURE', purchase_units: [{ reference_id: 'saysure-test',
    payee: { merchant_id: merchantId }, description: 'SaySure synthetic notebook test; no real goods',
    amount: { currency_code: 'USD', value: '1.00' } }] };
}
export async function createSandboxOrder({ enabled = false, operatorApproved = false, config,
  requestId, accessToken, transport = fetch } = {}) {
  // Both gates checked BEFORE configuration, credentials or transport use.
  ensure(enabled === true && operatorApproved === true, 'SANDBOX_CREATION_DISABLED', 403);
  ensure(config?.PAYPAL_ENV === 'sandbox' && (!config.PAYPAL_MODE || config.PAYPAL_MODE === 'sandbox') &&
    (!config.PAYPAL_BASE_URL || config.PAYPAL_BASE_URL === SANDBOX), 'SANDBOX_ONLY_CONFIG_REQUIRED');
  ensure(typeof requestId === 'string' && /^[a-zA-Z0-9-]{16,38}$/.test(requestId), 'IDEMPOTENCY_KEY_REQUIRED');
  ensure(typeof accessToken === 'string' && /^[\x21-\x7e]+$/.test(accessToken), 'PAYPAL_TOKEN_INVALID');
  try {
    const response = await transport(`${SANDBOX}/v2/checkout/orders`, { method: 'POST', redirect: 'error',
      signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json', 'PayPal-Request-Id': requestId, Prefer: 'return=representation' },
      body: JSON.stringify(plannedOrder(config.PAYPAL_MERCHANT_ID)) });
    ensure([200, 201].includes(response.status), 'SANDBOX_CREATION_UNCONFIRMED', 502);
    const data = await response.json();
    ensure(/^[A-Z0-9]{5,32}$/.test(data.id ?? '') && ['CREATED', 'PAYER_ACTION_REQUIRED'].includes(data.status),
      'SANDBOX_CREATION_UNCONFIRMED', 502);
    return { order_id: data.id, status: data.status }; // Follow with a fresh authenticated GET, not success claims.
  } catch { throw new Failure('SANDBOX_CREATION_UNCONFIRMED', 502); }
}
