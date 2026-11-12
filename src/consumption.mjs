import { randomUUID } from 'node:crypto';
import { buyer } from './identity.mjs';
import { ensure, Failure } from './core.mjs';
export function consumptionService(store, requests, paypal, { timeoutMs = 20000 } = {}) {
  ensure(Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 20000, 'INVALID_CONSUMPTION_TIMEOUT');
  const pending = new Map();
  async function validate(session, id, expectedDigest) {
    buyer(session);
    ensure(await store.get('SELECT id FROM sessions WHERE id=? AND user_id=? AND expires>?',
      session.id, session.user_id, Date.now()), 'SESSION_EXPIRED', 401);
    const row = await requests.owned(id, session, { expire: false });
    const snapshot = requests.intact(row);
    ensure(Number.isSafeInteger(snapshot.expires_at) && Date.now() < snapshot.expires_at, 'REQUEST_EXPIRED');
    ensure(row.digest === expectedDigest, 'DETAILS_CHANGED_REVIEW_AGAIN');
    ensure(row.status === 'approved' && row.consent_digest === row.digest && !row.consumed_at, 'CONSENT_NOT_AVAILABLE');
    return row;
  }
  async function consume(session, id, expectedDigest, trace = () => {}) {
    const row = await validate(session, id, expectedDigest);
    trace('validation_passed');
    const key = JSON.stringify([session.user_id, id, expectedDigest]);
    if (pending.has(key)) {
      trace('duplicate_wait');
      await pending.get(key).catch(() => {});
      throw new Failure('CONSENT_NOT_AVAILABLE');
    }
    const owner = randomUUID();
    const acquired = await store.transaction(async tx => {
      const result = await tx.run(`INSERT INTO consumption_claims
        (request_id,owner,started_at) VALUES(?,?,?) ON CONFLICT(request_id) DO NOTHING`,
      id, owner, Date.now());
      return result.changes === 1;
    });
    ensure(acquired, 'CONSUMPTION_IN_PROGRESS');
    const controller = new AbortController();
    let timer;
    let retainClaim = false;
    const work = (async () => {
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          // Retain the cross-process claim until provider evidence is invalidated.
          // If invalidation cannot be confirmed, the request remains fail-closed.
          retainClaim = true;
          Promise.resolve(paypal.invalidate(row)).then(async () => {
            await store.run('DELETE FROM consumption_claims WHERE request_id=? AND owner=?', id, owner);
            retainClaim = false;
          }).catch(() => {});
          trace('timed_out', 'CONSUMPTION_TIMED_OUT');
          reject(new Failure('CONSUMPTION_TIMED_OUT', 504));
        }, timeoutMs);
      });

      try {
        const proof = await Promise.race([
          paypal.revalidate(session, id, {
            status: 'approved',
            digest: expectedDigest,
            consumption: true,
            signal: controller.signal,
            trace
          }),
          deadline
        ]);
        ensure(!controller.signal.aborted, 'CONSUMPTION_TIMED_OUT', 504);
        await validate(session, id, expectedDigest);
        trace('database_started');
        const result = await requests.action(session, id, 'consume', expectedDigest, proof);
        trace('database_committed', 'OK', result.consumption_receipt.event.id);
        return result;
      } finally {
        clearTimeout(timer);
        controller.abort();
        if (!retainClaim) {
          try {
            await store.run('DELETE FROM consumption_claims WHERE request_id=? AND owner=?', id, owner);
          } catch {
            trace('failed', 'INTERNAL_ERROR');
          }
        }
      }
    })();

    pending.set(key, work);
    try { return await work; }
    finally { if (pending.get(key) === work) pending.delete(key); }
  }
  return { consume };
}
