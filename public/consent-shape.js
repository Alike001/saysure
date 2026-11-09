// Fixed ordered tuples: no dependence on object property order or provider JSON serialization.
export function orderTuple(p) {
  return [p.environment, p.order_id, p.intent, p.status, p.payee_id, p.amount_minor, p.currency,
    p.created_at, p.provider_window_end, p.units.map(u => [u.index, u.amount_value, u.amount_minor, u.currency])];
}

// Fixed ordered tuple, versioned domain, no arbitrary client JSON serialization.
export function canonical(s) {
  if (s.kind === 'paypal') return JSON.stringify([...(Object.hasOwn(s, 'evidence_provenance')
    ? ['paypal-consent-v2', s.evidence_provenance] : ['paypal-consent-v1']), s.request_id, s.buyer_id,
    s.merchant_id, s.merchant_name, s.amount_minor, s.currency, s.description,
    orderTuple(s.provider), s.nonce, s.expires_at, s.revision]);
  return JSON.stringify(['synthetic-consent-v1', s.request_id, s.merchant_id, s.merchant_name,
    s.amount_minor, s.currency, s.description, s.buyer_id, s.nonce, s.expires_at, s.revision]);
}
