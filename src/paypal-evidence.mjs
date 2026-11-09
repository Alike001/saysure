import { ensure, fields } from './core.mjs';

// Offline, read-only boundary: transport is REQUIRED; no fetch, OAuth, credentials or UI route.
// A caller must supply trusted server observations, never browser/helper evidence.
export function normalizeOrder({ order, expectedId, httpStatus = 200, observedAt, validUntil }, now = Date.now()) {
  ensure(httpStatus === 200, httpStatus === 404 ? 'ORDER_UNAVAILABLE_404' : 'ORDER_UNAVAILABLE');
  ensure(typeof expectedId === 'string' && /^[A-Z0-9]{5,32}$/.test(expectedId) && order?.id === expectedId,
    'ORDER_ID_MISMATCH');
  ensure(Number.isSafeInteger(observedAt) && observedAt <= now && now - observedAt < 60_000,
    'ORDER_EVIDENCE_STALE');
  // Local conservative validity deadline, NOT a provider-reported expiration.
  ensure(Number.isSafeInteger(validUntil) && validUntil > now && validUntil > observedAt,
    'ORDER_VALIDITY_UNAVAILABLE');
  ensure(order.intent === 'CAPTURE', 'UNSUPPORTED_ORDER_INTENT');
  ensure(['CREATED', 'SAVED', 'PAYER_ACTION_REQUIRED', 'APPROVED', 'COMPLETED', 'VOIDED'].includes(order.status),
    'ORDER_STATUS_UNAVAILABLE');
  ensure(Array.isArray(order.purchase_units) && order.purchase_units.length === 1, 'UNSUPPORTED_PURCHASE_UNITS');
  const unit = order.purchase_units[0];
  const merchantId = unit?.payee?.merchant_id;
  ensure(typeof merchantId === 'string' && /^[A-Z0-9]{5,32}$/.test(merchantId), 'PAYEE_ID_UNAVAILABLE');
  const amount = fields({ merchant_id: merchantId, merchant_name: 'Unverified merchant',
    amount: unit.amount?.value, currency: unit.amount?.currency_code, description: 'Provider order' });
  // Reject inconsistent payment evidence rather than inferring a payable order.
  ensure(!unit.payments || order.status === 'COMPLETED' || order.status === 'VOIDED', 'ORDER_PAYMENT_CONFLICT');
  return Object.freeze({ source: 'paypal-sandbox-read', order_id: order.id,
    amount_minor: amount.amount_minor, currency: amount.currency, payee_id: merchantId,
    merchant_name_verified: false, status: order.status,
    buyer_approval: order.status === 'APPROVED' ? 'provider-approved' : 'not-established',
    observed_at: observedAt, local_valid_until: validUntil,
    // This module grants NO consent/payment authority, even for APPROVED orders.
    payment_authorized_by_saysure: false });
}
export function assertCurrentOrder(evidence, bound, now = Date.now()) {
  ensure(evidence?.source === 'paypal-sandbox-read' && evidence.observed_at <= now &&
    now - evidence.observed_at < 60_000 && evidence.local_valid_until > now, 'ORDER_EVIDENCE_STALE');
  ensure(['CREATED', 'SAVED', 'PAYER_ACTION_REQUIRED', 'APPROVED'].includes(evidence.status), 'ORDER_NOT_REVIEWABLE');
  for (const key of ['order_id', 'amount_minor', 'currency', 'payee_id']) {
    ensure(evidence[key] === bound[key], 'ORDER_DETAILS_CHANGED');
  }
  return true;
}
export function readOnlyOrders(transport) {
  ensure(typeof transport === 'function', 'EXPLICIT_MOCK_TRANSPORT_REQUIRED');
  return async (id, timing, now = Date.now()) => {
    ensure(typeof id === 'string' && /^[A-Z0-9]{5,32}$/.test(id), 'INVALID_ORDER_ID');
    const response = await transport({ method: 'GET', path: `/v2/checkout/orders/${id}` });
    return normalizeOrder({ ...timing, expectedId: id, httpStatus: response.status, order: response.body }, now);
  };
}
