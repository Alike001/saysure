import { fresh } from './paypal-order.mjs';
import { randomUUID } from 'node:crypto';
import { ensure, fields, random, digest, displayAmount } from './core.mjs';
import { buyer, helper } from './identity.mjs';

export function requestService(store) {
  function visible(row, session) {
    ensure((session.role === 'buyer' && row.buyer_id === session.user_id) ||
      (session.role === 'helper' && row.helper_id === session.user_id), 'REQUEST_NOT_FOUND', 404);
    return row;
  }
  function intact(row) {
    const s = JSON.parse(row.snapshot);
    ensure(s.buyer_id === row.buyer_id && s.request_id === row.id && digest(s) === row.digest,
      'SNAPSHOT_CHANGED');
    return s;
  }
  function view(row) {
    const snapshot = intact(row);
    return { snapshot, digest: row.digest, status: row.status,
      consent_digest: row.consent_digest, consumed_at: row.consumed_at,
      display_amount: displayAmount(snapshot), synthetic: snapshot.kind !== 'paypal',
      ...(snapshot.kind === 'paypal' ? { paypal_evidence: evidence(row.id) } : {}) };
  }
  function evidence(id) {
    const e = store.get('SELECT observed_at,available,provenance FROM paypal_bindings WHERE request_id=?', id);
    return { observed_at: e?.observed_at ?? null, current: !!e?.available && fresh(e.observed_at),
      provenance: e?.provenance ?? 'unavailable', merchant_identity_verified: false };
  }
  function assertEvidence(row, proof) {
    const snapshot = intact(row);
    if (snapshot.kind !== 'paypal') return;
    ensure(['mock-paypal-fixture', 'authenticated-sandbox-api'].includes(snapshot.evidence_provenance) &&
      evidence(row.id).provenance === snapshot.evidence_provenance &&
      proof?.provenance === snapshot.evidence_provenance, 'ORDER_PROVENANCE_CHANGED');
    ensure(proof?.digest === row.digest && fresh(proof.observedAt) && evidence(row.id).current, 'ORDER_EVIDENCE_STALE');
  }
  function owned(id, session, { expire = true } = {}) {
    const row = expire ? store.request(id) : store.get('SELECT * FROM requests WHERE id=?', id);
    ensure(row, 'REQUEST_NOT_FOUND', 404); return visible(row, session);
  }
  function create(session, input) {
    helper(session);
    const data = fields(input);
    ensure(typeof input.buyer_id === 'string', 'UNKNOWN_BUYER', 400);
    ensure(store.get("SELECT id FROM users WHERE id=? AND role='buyer'", input.buyer_id), 'UNKNOWN_BUYER', 400);
    ensure(input.revision === undefined, 'SERVER_ASSIGNS_REVISION', 400);
    const s = { request_id: `SYNTH-${randomUUID()}`, merchant_id: data.merchant_id,
      merchant_name: data.merchant_name, amount_minor: data.amount_minor, currency: data.currency,
      description: data.description, buyer_id: input.buyer_id, nonce: random(),
      expires_at: Date.now() + data.minutes * 60_000, revision: 1 };
    store.atomic(() => {
      store.run('INSERT INTO requests(id,helper_id,buyer_id,snapshot,digest,status) VALUES(?,?,?,?,?,?)',
        s.request_id, session.user_id, s.buyer_id, JSON.stringify(s), digest(s), 'pending');
      store.event(session.user_id, 'request_created', s.request_id);
    });
    return view(store.request(s.request_id));
  }
  function revise(session, id, input) {
    helper(session);
    const data = fields(input);
    return store.atomic(() => {
      const row = owned(id, session), prior = intact(row);
      ensure(prior.kind !== 'paypal', 'PAYPAL_FIELDS_SERVER_ONLY', 403);
      ensure(input.buyer_id === row.buyer_id, 'BUYER_IMMUTABLE', 403);
      ensure(input.revision === prior.revision, 'REVISION_CHANGED');
      ensure(['pending', 'approved'].includes(row.status), 'REQUEST_CLOSED');
      const s = { ...prior, merchant_id: data.merchant_id, merchant_name: data.merchant_name,
        amount_minor: data.amount_minor, currency: data.currency, description: data.description,
        nonce: random(), expires_at: Date.now() + data.minutes * 60_000, revision: prior.revision + 1 };
      store.run("UPDATE requests SET snapshot=?,digest=?,status='pending',consent_digest=NULL WHERE id=?",
        JSON.stringify(s), digest(s), id);
      store.run('UPDATE challenges SET used=2 WHERE request_id=?', id);
      store.event(session.user_id, 'request_revised_consent_invalidated', id);
      return view(store.request(id));
    });
  }
  function action(session, id, action, expectedDigest, proof = null) {
    buyer(session);
    const committed = store.atomic(() => {
      const row = owned(id, session, { expire: action !== 'consume' }), snapshot = intact(row);
      let consumedAt;
      ensure(row.digest === expectedDigest, 'DETAILS_CHANGED_REVIEW_AGAIN');
      if (action === 'consume') {
        assertEvidence(row, proof);
        ensure(row.status === 'approved' && row.consent_digest === row.digest && !row.consumed_at,
          'CONSENT_NOT_AVAILABLE');
        consumedAt = Date.now(); // The sole authoritative acceptance/event timestamp for this consumption.
        ensure(Number.isSafeInteger(consumedAt) && Number.isSafeInteger(snapshot.expires_at) &&
          consumedAt < snapshot.expires_at, 'REQUEST_EXPIRED');
        const result = store.run(`UPDATE requests SET status='consumed',consumed_at=? WHERE id=? AND status='approved'
          AND digest=? AND consent_digest=? AND consumed_at IS NULL AND json_extract(snapshot,'$.expires_at')>?`,
        consumedAt, id, expectedDigest, expectedDigest, consumedAt);
        ensure(result.changes === 1, 'CONSENT_ALREADY_CONSUMED');
      } else {
        ensure(action === 'reject' ? ['pending', 'invalidated'].includes(row.status) : row.status === 'approved', 'REQUEST_CLOSED');
        store.run('UPDATE requests SET status=?,consent_digest=NULL WHERE id=?',
          action === 'reject' ? 'rejected' : 'withdrawn', id);
      }
      store.run('UPDATE challenges SET used=2 WHERE request_id=?', id);
      const eventResult = store.event(session.user_id, action, id, consumedAt);
      const item = view(store.request(id));
      if (action !== 'consume') return item;
      const event = store.get('SELECT seq,at,event,request_id FROM events WHERE seq=?', Number(eventResult.lastInsertRowid));
      return { ...item, consumption_receipt: { version: 1, request_id: id, buyer_id: snapshot.buyer_id, status: item.status,
        consent_digest: row.digest, consumed_at: item.consumed_at,
        event: { id: event.seq, type: event.event, request_id: event.request_id, at: event.at } } };
    });
    // This acknowledgement is attached only after COMMIT returned successfully.
    if (committed.consumption_receipt) committed.consumption_receipt.committed = true;
    return committed;
  }
  function list(session) {
    store.expire();
    const column = session.role === 'helper' ? 'helper_id' : 'buyer_id';
    return store.all(`SELECT * FROM requests WHERE ${column}=? ORDER BY rowid DESC LIMIT 100`,
      session.user_id).map(view);
  }
  return { create, revise, action, list, owned, intact, view, assertEvidence };
}
