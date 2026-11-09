import { orderTuple } from './order-shape.mjs';
import { normalizeOrder } from './paypal-evidence.mjs';
import { ensure } from './core.mjs';
export const fresh = (at, now = Date.now()) => Number.isSafeInteger(at) && at <= now && now - at < 60000;
export function normalizeSandboxOrder(order, expectedId, merchantId, observedAt, now = Date.now()) {
  ensure(typeof merchantId === 'string' && /^[A-Z0-9]{5,32}$/.test(merchantId), 'EXPECTED_PAYEE_REQUIRED', 503);
  const created = Date.parse(order?.create_time);
  // Conservative local window, not a claim about provider expiration. Never renew it on refresh.
  ensure(Number.isFinite(created) && created <= now && created + 3 * 3600000 > now, 'ORDER_EXPIRED_OR_TIME_UNAVAILABLE');
  ensure(Array.isArray(order.purchase_units) && order.purchase_units.length > 0 && order.purchase_units.length <= 10,
    'UNSUPPORTED_PURCHASE_UNITS');
  const units = order.purchase_units.map((unit, index) => {
    const e = normalizeOrder({ order: { ...order, purchase_units: [unit] }, expectedId,
      observedAt, validUntil: created + 3 * 3600000 }, now);
    ensure(e.payee_id === merchantId, 'ORDER_PAYEE_MISMATCH', 403);
    // Free text, payer, shipping, email, links and payment_source are deliberately omitted.
    return { index: index + 1, amount_value: unit.amount.value, amount_minor: e.amount_minor, currency: e.currency };
  });
  ensure(units.every(u => u.currency === units[0].currency), 'MIXED_ORDER_CURRENCIES');
  const total = units.reduce((sum, u) => sum + BigInt(u.amount_minor), 0n);
  ensure(total <= 100000000000n, 'AMOUNT_OUT_OF_RANGE');
  return { environment: 'sandbox', order_id: expectedId, intent: order.intent, status: order.status,
    payee_id: merchantId, amount_minor: total.toString(), currency: units[0].currency,
    units, created_at: created, provider_window_end: created + 3 * 3600000 };
}
export const sameOrder = (a, b) => JSON.stringify(orderTuple(a)) === JSON.stringify(orderTuple(b));
export function reviewable(p) {
  ensure(['CREATED', 'SAVED', 'PAYER_ACTION_REQUIRED', 'APPROVED'].includes(p.status), 'ORDER_NOT_REVIEWABLE');
}
