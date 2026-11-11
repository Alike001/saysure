import { randomUUID } from 'node:crypto';
import { adapterProvenance } from './paypal-provenance.mjs';
import { ensure, random, digest } from './core.mjs';
import { helper, buyer } from './identity.mjs';
import { normalizeSandboxOrder, reviewable, sameOrder, fresh } from './paypal-order.mjs';
export function paypalRequests(store, requests, integration) {
  function configured(orderId) {
    ensure(integration?.client && integration.allowedOrders?.includes(orderId), 'PAYPAL_ORDER_NOT_CONFIGURED', 503);
  }
  async function read(orderId, options = {}) {
    configured(orderId);
    const client = integration.client, provenance = adapterProvenance(client);
    const started = Date.now();
    const raw = await client.getOrder(orderId, options);
    ensure(integration.client === client && adapterProvenance(client) === provenance, 'ORDER_PROVENANCE_CHANGED');
    const provider = normalizeSandboxOrder(raw, orderId, integration.merchantId, started);
    reviewable(provider); return { provider, observedAt: started, provenance };
  }
  async function invalidate(row) {
    await store.transaction(async tx => {
      const current = await tx.request(row.id);
      if (current.digest !== row.digest || !['pending', 'approved'].includes(current.status)) return;
      await tx.run("UPDATE requests SET status='invalidated',consent_digest=NULL WHERE id=?", row.id);
      await tx.run('UPDATE paypal_bindings SET available=0 WHERE request_id=?', row.id);
      await tx.run('UPDATE challenges SET used=2 WHERE request_id=?', row.id);
    });
  }
  async function revalidate(session, id, expected = {}) {
    buyer(session);
    const row = await requests.owned(id, session, { expire: !expected.consumption }), s = requests.intact(row);
    if (expected.consumption) ensure(Date.now() < s.expires_at, 'REQUEST_EXPIRED');
    if (s.kind !== 'paypal') return null;
    ensure(['pending', 'approved'].includes(row.status), 'REQUEST_CLOSED');
    if (expected.status) ensure(row.status === expected.status, 'CONSENT_NOT_AVAILABLE');
    if (expected.digest) ensure(row.digest === expected.digest, 'DETAILS_CHANGED_REVIEW_AGAIN');
    try {
      const binding = await store.get('SELECT provenance FROM paypal_bindings WHERE request_id=?', id);
      ensure(s.evidence_provenance && binding?.provenance === s.evidence_provenance &&
        adapterProvenance(integration?.client) === s.evidence_provenance, 'ORDER_PROVENANCE_CHANGED');
      ensure(!expected.signal?.aborted, 'CONSUMPTION_TIMED_OUT', 504);
      const result = await read(s.provider.order_id, { signal: expected.signal,
        onReadReserved: () => expected.trace?.('read_reserved') });
      ensure(result.provenance === s.evidence_provenance, 'ORDER_PROVENANCE_CHANGED');
      ensure(!expected.signal?.aborted, 'CONSUMPTION_TIMED_OUT', 504);
      ensure(sameOrder(result.provider, s.provider), 'ORDER_DETAILS_CHANGED');
      expected.trace?.('provider_revalidated');
      return await store.transaction(async tx => {
        const current = await requests.owned(id, session, { expire: !expected.consumption, executor: tx });
        const snapshot = requests.intact(current);
        if (expected.consumption) ensure(Date.now() < snapshot.expires_at, 'REQUEST_EXPIRED');
        ensure(current.digest === row.digest && current.status === row.status &&
          ['pending', 'approved'].includes(current.status), 'DETAILS_CHANGED_REVIEW_AGAIN');
        ensure(fresh(result.observedAt), 'ORDER_EVIDENCE_STALE');
        await tx.run('UPDATE paypal_bindings SET observed_at=?,available=1 WHERE request_id=?', result.observedAt, id);
        return { digest: current.digest, observedAt: result.observedAt, provenance: result.provenance };
      });
    } catch (error) {
      if (!(expected.consumption && error.message === 'REQUEST_EXPIRED')) await invalidate(row);
      throw error;
    }
  }
  function snapshot(id, buyerId, provider, revision, provenance) {
    return { kind: 'paypal', evidence_provenance: provenance, request_id: id, buyer_id: buyerId, provider,
      merchant_id: provider.payee_id, merchant_name: `PayPal payee ${provider.payee_id} (shop identity unverified)`,
      amount_minor: provider.amount_minor, currency: provider.currency,
      description: 'Sandbox order. Merchant free text omitted for privacy. Purchase-unit totals are included in this review.',
      revision, nonce: random(), expires_at: Math.min(Date.now() + 600000, provider.provider_window_end, integration.deadline ?? Infinity) };
  }
  async function create(session, input) {
    helper(session);
    ensure(Object.keys(input).every(k => ['order_id', 'buyer_id'].includes(k)), 'UNKNOWN_FIELD', 400);
    ensure(typeof input.buyer_id === 'string' &&
      await store.get("SELECT id FROM users WHERE id=? AND role='buyer'", input.buyer_id), 'UNKNOWN_BUYER', 400);
    ensure(!integration?.buyerId || input.buyer_id === integration.buyerId, 'READ_BUYER_FORBIDDEN', 403);
    configured(input.order_id);
    ensure(!await store.get('SELECT request_id FROM paypal_bindings WHERE order_id=?', input.order_id), 'ORDER_ALREADY_BOUND');
    const result = await read(input.order_id);
    return store.transaction(async tx => {
      ensure(fresh(result.observedAt), 'ORDER_EVIDENCE_STALE');
      ensure(!await tx.get('SELECT request_id FROM paypal_bindings WHERE order_id=?', input.order_id), 'ORDER_ALREADY_BOUND');
      const s = snapshot(`PAYPAL-${randomUUID()}`, input.buyer_id, result.provider, 1, result.provenance);
      await tx.run('INSERT INTO requests(id,helper_id,buyer_id,snapshot,digest,status) VALUES(?,?,?,?,?,?)',
        s.request_id, session.user_id, s.buyer_id, JSON.stringify(s), digest(s), 'pending');
      await tx.run('INSERT INTO paypal_bindings VALUES(?,?,?,1,?)', s.request_id, input.order_id, result.observedAt,
        result.provenance);
      await tx.event(session.user_id, 'paypal_order_bound', s.request_id);
      return requests.view(await tx.request(s.request_id), tx);
    });
  }
  async function refresh(session, id, expectedDigest) {
    helper(session);
    ensure(integration?.refreshAllowed !== false, 'READ_REFRESH_NOT_AUTHORIZED', 403);
    const row = await requests.owned(id, session), prior = requests.intact(row);
    ensure(prior.kind === 'paypal' && row.digest === expectedDigest, 'DETAILS_CHANGED_REVIEW_AGAIN');
    ensure(['pending', 'approved', 'invalidated'].includes(row.status), 'REQUEST_CLOSED');
    let result;
    try { result = await read(prior.provider.order_id); } catch (error) { await invalidate(row); throw error; }
    return store.transaction(async tx => {
      const current = await requests.owned(id, session, { executor: tx });
      ensure(current.digest === row.digest && ['pending', 'approved', 'invalidated'].includes(current.status), 'DETAILS_CHANGED_REVIEW_AGAIN');
      ensure(fresh(result.observedAt), 'ORDER_EVIDENCE_STALE');
      ensure(result.provenance === prior.evidence_provenance, 'ORDER_PROVENANCE_CHANGED');
      const s = snapshot(id, prior.buyer_id, result.provider, prior.revision + 1, result.provenance);
      await tx.run("UPDATE requests SET snapshot=?,digest=?,status='pending',consent_digest=NULL WHERE id=?",
        JSON.stringify(s), digest(s), id);
      await tx.run('UPDATE paypal_bindings SET observed_at=?,available=1 WHERE request_id=?', result.observedAt, id);
      await tx.run('UPDATE challenges SET used=2 WHERE request_id=?', id);
      await tx.event(session.user_id, 'paypal_revision_consent_invalidated', id);
      return requests.view(await tx.request(id), tx);
    });
  }
  return { create, refresh, revalidate, invalidate };
}
