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
  async function evidence(id, executor = store) {
    const e = await executor.get('SELECT observed_at,available,provenance FROM paypal_bindings WHERE request_id=?', id);
    return { observed_at: e?.observed_at ?? null, current: !!e?.available && fresh(e.observed_at),
      provenance: e?.provenance ?? 'unavailable', merchant_identity_verified: false };
  }
  async function view(row, executor = store) {
    const snapshot = intact(row);
    return { snapshot, digest: row.digest, status: row.status,
      consent_digest: row.consent_digest, consumed_at: row.consumed_at,
      display_amount: displayAmount(snapshot), synthetic: snapshot.kind !== 'paypal',
      ...(snapshot.kind === 'paypal' ? { paypal_evidence: await evidence(row.id, executor) } : {}) };
  }
  async function assertEvidence(row, proof, executor = store) {
    const snapshot = intact(row);
    if (snapshot.kind !== 'paypal') return;
    const currentEvidence = await evidence(row.id, executor);
    ensure(['mock-paypal-fixture', 'authenticated-sandbox-api'].includes(snapshot.evidence_provenance) &&
      currentEvidence.provenance === snapshot.evidence_provenance &&
      proof?.provenance === snapshot.evidence_provenance, 'ORDER_PROVENANCE_CHANGED');
    ensure(proof?.digest === row.digest && fresh(proof.observedAt) && currentEvidence.current, 'ORDER_EVIDENCE_STALE');
  }
  async function owned(id, session, { expire = true, executor = store } = {}) {
    const row = expire ? await executor.request(id) : await executor.get('SELECT * FROM requests WHERE id=?', id);
    ensure(row, 'REQUEST_NOT_FOUND', 404);
    return visible(row, session);
  }
  async function create(session, input) {
    helper(session);
    const data = fields(input);
    ensure(typeof input.buyer_id === 'string', 'UNKNOWN_BUYER', 400);
    ensure(await store.get("SELECT id FROM users WHERE id=? AND role='buyer'", input.buyer_id), 'UNKNOWN_BUYER', 400);
    ensure(input.revision === undefined, 'SERVER_ASSIGNS_REVISION', 400);
    const s = { request_id: `SYNTH-${randomUUID()}`, merchant_id: data.merchant_id,
      merchant_name: data.merchant_name, amount_minor: data.amount_minor, currency: data.currency,
      description: data.description, buyer_id: input.buyer_id, nonce: random(),
      expires_at: Date.now() + data.minutes * 60_000, revision: 1 };
    await store.transaction(async tx => {
      await tx.run('INSERT INTO requests(id,helper_id,buyer_id,snapshot,digest,status) VALUES(?,?,?,?,?,?)',
        s.request_id, session.user_id, s.buyer_id, JSON.stringify(s), digest(s), 'pending');
      await tx.event(session.user_id, 'request_created', s.request_id);
    });
    return view(await store.request(s.request_id));
  }
  async function revise(session, id, input) {
    helper(session);
    const data = fields(input);
    return store.transaction(async tx => {
      const row = await owned(id, session, { executor: tx }), prior = intact(row);
      ensure(prior.kind !== 'paypal', 'PAYPAL_FIELDS_SERVER_ONLY', 403);
      ensure(input.buyer_id === row.buyer_id, 'BUYER_IMMUTABLE', 403);
      ensure(input.revision === prior.revision, 'REVISION_CHANGED');
      ensure(['pending', 'approved'].includes(row.status), 'REQUEST_CLOSED');
      const s = { ...prior, merchant_id: data.merchant_id, merchant_name: data.merchant_name,
        amount_minor: data.amount_minor, currency: data.currency, description: data.description,
        nonce: random(), expires_at: Date.now() + data.minutes * 60_000, revision: prior.revision + 1 };
      await tx.run("UPDATE requests SET snapshot=?,digest=?,status='pending',consent_digest=NULL WHERE id=?",
        JSON.stringify(s), digest(s), id);
      await tx.run('UPDATE challenges SET used=2 WHERE request_id=?', id);
      await tx.event(session.user_id, 'request_revised_consent_invalidated', id);
      return view(await tx.request(id), tx);
    });
  }
  async function action(session, id, action, expectedDigest, proof = null) {
    buyer(session);
    const committed = await store.transaction(async tx => {
      const row = await owned(id, session, { expire: action !== 'consume', executor: tx });
      const snapshot = intact(row);
      let consumedAt;
      ensure(row.digest === expectedDigest, 'DETAILS_CHANGED_REVIEW_AGAIN');
      if (action === 'consume') {
        await assertEvidence(row, proof, tx);
        ensure(row.status === 'approved' && row.consent_digest === row.digest && !row.consumed_at,
          'CONSENT_NOT_AVAILABLE');
        consumedAt = Date.now();
        ensure(Number.isSafeInteger(consumedAt) && Number.isSafeInteger(snapshot.expires_at) &&
          consumedAt < snapshot.expires_at, 'REQUEST_EXPIRED');
        const expiryPredicate = tx.dialect === 'postgres'
          ? "(snapshot::jsonb ->> 'expires_at')::bigint>?"
          : "json_extract(snapshot,'$.expires_at')>?";
        const result = await tx.run(`UPDATE requests SET status='consumed',consumed_at=? WHERE id=? AND status='approved'
          AND digest=? AND consent_digest=? AND consumed_at IS NULL AND ${expiryPredicate}`,
        consumedAt, id, expectedDigest, expectedDigest, consumedAt);
        ensure(result.changes === 1, 'CONSENT_ALREADY_CONSUMED');
      } else {
        ensure(action === 'reject' ? ['pending', 'invalidated'].includes(row.status) : row.status === 'approved', 'REQUEST_CLOSED');
        await tx.run('UPDATE requests SET status=?,consent_digest=NULL WHERE id=?',
          action === 'reject' ? 'rejected' : 'withdrawn', id);
      }
      await tx.run('UPDATE challenges SET used=2 WHERE request_id=?', id);
      const eventResult = await tx.event(session.user_id, action, id, consumedAt);
      const item = await view(await tx.request(id), tx);
      if (action !== 'consume') return item;
      const event = await tx.get('SELECT seq,at,event,request_id FROM events WHERE seq=?', Number(eventResult.lastInsertRowid));
      return { ...item, consumption_receipt: { version: 1, request_id: id, buyer_id: snapshot.buyer_id, status: item.status,
        consent_digest: row.digest, consumed_at: item.consumed_at,
        event: { id: event.seq, type: event.event, request_id: event.request_id, at: event.at } } };
    });
    if (committed.consumption_receipt) committed.consumption_receipt.committed = true;
    return committed;
  }
  async function list(session) {
    await store.expire();
    const column = session.role === 'helper' ? 'helper_id' : 'buyer_id';
    const order = store.dialect === 'postgres' ? 'created_at DESC' : 'rowid DESC';
    const rows = await store.all(`SELECT * FROM requests WHERE ${column}=? ORDER BY ${order} LIMIT 100`,
      session.user_id);
    return Promise.all(rows.map(row => view(row)));
  }
  return { create, revise, action, list, owned, intact, view, assertEvidence };
}
