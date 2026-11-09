import { randomUUID } from 'node:crypto';
import { ensure, random, digest } from './core.mjs';
import { helper, buyer } from './identity.mjs';
import { normalizeSandboxOrder, reviewable, sameOrder, fresh } from './paypal-order.mjs';
export function paypalRequests(store, requests, integration) {
  function configured(orderId) {
    ensure(integration?.client && integration.allowedOrders?.includes(orderId), 'PAYPAL_ORDER_NOT_CONFIGURED', 503);
  }
  async function read(orderId) {
    configured(orderId);
    const started = Date.now();
    const raw = await integration.client.getOrder(orderId);
    const provider = normalizeSandboxOrder(raw, orderId, integration.merchantId, started);
    reviewable(provider); return { provider, observedAt: started };
  }
  function invalidate(row) {
    store.atomic(() => {
      const current = store.request(row.id);
      if (current.digest !== row.digest || !['pending', 'approved'].includes(current.status)) return;
      store.run("UPDATE requests SET status='invalidated',consent_digest=NULL WHERE id=?", row.id);
      store.run('UPDATE paypal_bindings SET available=0 WHERE request_id=?', row.id);
      store.run('UPDATE challenges SET used=2 WHERE request_id=?', row.id);
    });
  }
  async function revalidate(session, id, expected = {}) {
    buyer(session);
    const row = requests.owned(id, session), s = requests.intact(row);
    if (s.kind !== 'paypal') return null;
    ensure(['pending', 'approved'].includes(row.status), 'REQUEST_CLOSED');
    if (expected.status) ensure(row.status === expected.status, 'CONSENT_NOT_AVAILABLE');
    if (expected.digest) ensure(row.digest === expected.digest, 'DETAILS_CHANGED_REVIEW_AGAIN');
    try {
      const result = await read(s.provider.order_id);
      ensure(sameOrder(result.provider, s.provider), 'ORDER_DETAILS_CHANGED');
      return store.atomic(() => {
        const current = requests.owned(id, session); requests.intact(current);
        ensure(current.digest === row.digest && current.status === row.status &&
          ['pending', 'approved'].includes(current.status), 'DETAILS_CHANGED_REVIEW_AGAIN');
        ensure(fresh(result.observedAt), 'ORDER_EVIDENCE_STALE');
        store.run('UPDATE paypal_bindings SET observed_at=?,available=1 WHERE request_id=?', result.observedAt, id);
        return { digest: current.digest, observedAt: result.observedAt };
      });
    } catch (error) { invalidate(row); throw error; }
  }
  function snapshot(id, buyerId, provider, revision) {
    return { kind: 'paypal', request_id: id, buyer_id: buyerId, provider,
      merchant_id: provider.payee_id, merchant_name: `PayPal payee ${provider.payee_id} (shop identity unverified)`,
      amount_minor: provider.amount_minor, currency: provider.currency,
      description: 'Sandbox order. Merchant free text omitted for privacy. Purchase-unit totals are included in this review.',
      revision, nonce: random(), expires_at: Math.min(Date.now() + 600000, provider.provider_window_end) };
  }
  async function create(session, input) {
    helper(session);
    ensure(Object.keys(input).every(k => ['order_id', 'buyer_id'].includes(k)), 'UNKNOWN_FIELD', 400);
    ensure(typeof input.buyer_id === 'string' && store.get("SELECT id FROM users WHERE id=? AND role='buyer'", input.buyer_id),
      'UNKNOWN_BUYER', 400);
    ensure(!integration?.buyerId || input.buyer_id === integration.buyerId, 'READ_BUYER_FORBIDDEN', 403);
    configured(input.order_id);
    ensure(!store.get('SELECT request_id FROM paypal_bindings WHERE order_id=?', input.order_id), 'ORDER_ALREADY_BOUND');
    const result = await read(input.order_id);
    return store.atomic(() => {
      ensure(fresh(result.observedAt), 'ORDER_EVIDENCE_STALE');
      ensure(!store.get('SELECT request_id FROM paypal_bindings WHERE order_id=?', input.order_id), 'ORDER_ALREADY_BOUND');
      const s = snapshot(`PAYPAL-${randomUUID()}`, input.buyer_id, result.provider, 1);
      store.run('INSERT INTO requests(id,helper_id,buyer_id,snapshot,digest,status) VALUES(?,?,?,?,?,?)',
        s.request_id, session.user_id, s.buyer_id, JSON.stringify(s), digest(s), 'pending');
      store.run('INSERT INTO paypal_bindings VALUES(?,?,?,1,?)', s.request_id, input.order_id, result.observedAt,
        integration.client.provenance ?? 'mock-paypal-fixture');
      store.event(session.user_id, 'paypal_order_bound', s.request_id);
      return requests.view(store.request(s.request_id));
    });
  }
  async function refresh(session, id, expectedDigest) {
    helper(session);
    ensure(integration?.refreshAllowed !== false, 'READ_REFRESH_NOT_AUTHORIZED', 403);
    const row = requests.owned(id, session), prior = requests.intact(row);
    ensure(prior.kind === 'paypal' && row.digest === expectedDigest, 'DETAILS_CHANGED_REVIEW_AGAIN');
    ensure(['pending', 'approved', 'invalidated'].includes(row.status), 'REQUEST_CLOSED');
    let result;
    try { result = await read(prior.provider.order_id); } catch (error) { invalidate(row); throw error; }
    return store.atomic(() => {
      const current = requests.owned(id, session);
      ensure(current.digest === row.digest && ['pending', 'approved', 'invalidated'].includes(current.status), 'DETAILS_CHANGED_REVIEW_AGAIN');
      ensure(fresh(result.observedAt), 'ORDER_EVIDENCE_STALE');
      const s = snapshot(id, prior.buyer_id, result.provider, prior.revision + 1);
      store.run("UPDATE requests SET snapshot=?,digest=?,status='pending',consent_digest=NULL WHERE id=?",
        JSON.stringify(s), digest(s), id);
      store.run('UPDATE paypal_bindings SET observed_at=?,available=1 WHERE request_id=?', result.observedAt, id);
      store.run('UPDATE challenges SET used=2 WHERE request_id=?', id);
      store.event(session.user_id, 'paypal_revision_consent_invalidated', id);
      return requests.view(store.request(id));
    });
  }
  return { create, refresh, revalidate };
}
