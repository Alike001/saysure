import { randomUUID } from 'node:crypto';
import { buyer } from './identity.mjs';
import { ensure, Failure } from './core.mjs';
export function consumptionService(store, requests, paypal, { timeoutMs = 20000 } = {}) {
  ensure(Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 20000, 'INVALID_CONSUMPTION_TIMEOUT');
  const pending = new Map();
  function validate(session, id, expectedDigest) {
    buyer(session);
    ensure(store.get('SELECT id FROM sessions WHERE id=? AND user_id=? AND expires>?',
      session.id, session.user_id, Date.now()), 'SESSION_EXPIRED', 401);
    const row = requests.owned(id, session, { expire: false });
    const snapshot = requests.intact(row);
    ensure(Number.isSafeInteger(snapshot.expires_at) && Date.now() < snapshot.expires_at, 'REQUEST_EXPIRED');
    ensure(row.digest === expectedDigest, 'DETAILS_CHANGED_REVIEW_AGAIN');
    ensure(row.status === 'approved' && row.consent_digest === row.digest && !row.consumed_at, 'CONSENT_NOT_AVAILABLE');
    return row;
  }
  async function consume(session, id, expectedDigest, trace = () => {}) {
    const row = validate(session, id, expectedDigest);
    trace('validation_passed');
    const key = JSON.stringify([session.user_id, id, expectedDigest]);
    if (pending.has(key)) {
      trace('duplicate_wait');
      await pending.get(key).catch(() => {});
      throw new Failure('CONSENT_NOT_AVAILABLE'); // Never launch a second attempt after waiting.
    }
    const owner = randomUUID();
    // SQLite uniqueness coordinates separate app instances sharing this database, before any GET.
    const acquired = store.atomic(() => store.run(`INSERT OR IGNORE INTO consumption_claims
      (request_id,owner,started_at) VALUES(?,?,?)`, id, owner, Date.now()).changes === 1);
    ensure(acquired, 'CONSUMPTION_IN_PROGRESS');
    const controller = new AbortController();
    let timer;
    const work = (async () => {
      const deadline = new Promise((_, reject) => { timer = setTimeout(() => {
        controller.abort();
        try { paypal.invalidate(row); } catch { /* fail closed if storage is unavailable */ } // Fail closed; a late provider response cannot commit or enable retry.
        trace('timed_out', 'CONSUMPTION_TIMED_OUT');
        reject(new Failure('CONSUMPTION_TIMED_OUT', 504));
      }, timeoutMs); });
      try {
        const proof = await Promise.race([paypal.revalidate(session, id, {
          status: 'approved', digest: expectedDigest, consumption: true, signal: controller.signal, trace }), deadline]);
        ensure(!controller.signal.aborted, 'CONSUMPTION_TIMED_OUT', 504);
        validate(session, id, expectedDigest); // Recheck session/ownership/expiry after network I/O.
        trace('database_started');
        const result = requests.action(session, id, 'consume', expectedDigest, proof);
        trace('database_committed', 'OK', result.consumption_receipt.event.id);
        return result;
      } finally {
        clearTimeout(timer);
        controller.abort();
        try { store.run('DELETE FROM consumption_claims WHERE request_id=? AND owner=?', id, owner); }
        catch { trace('failed', 'INTERNAL_ERROR'); } // A retained claim blocks later attempts safely.
      }
    })();
    pending.set(key, work);
    try { return await work; }
    finally { if (pending.get(key) === work) pending.delete(key); }
  }
  return { consume };
}
