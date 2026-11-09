// Fixed ordered tuples: no dependence on object property order or provider JSON serialization.
export function orderTuple(p) {
  return [p.environment, p.order_id, p.intent, p.status, p.payee_id, p.amount_minor, p.currency,
    p.created_at, p.provider_window_end, p.units.map(u => [u.index, u.amount_value, u.amount_minor, u.currency])];
}
