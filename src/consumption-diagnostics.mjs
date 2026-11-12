import { createHash } from 'node:crypto';
const stages = new Set(['attempt_received', 'validation_passed', 'validation_rejected', 'duplicate_wait',
  'read_reserved', 'provider_revalidated', 'database_started', 'database_committed', 'failed', 'timed_out', 'response_finished', 'response_closed']);
const codes = new Set(['OK', 'LOGIN_REQUIRED', 'INVALID_HOST', 'INVALID_ORIGIN', 'CROSS_SITE_DENIED',
  'CSRF_REQUIRED', 'JSON_REQUIRED', 'INVALID_JSON', 'UNKNOWN_FIELD', 'QUERY_NOT_SUPPORTED',
  'BUYER_SESSION_REQUIRED', 'REQUEST_NOT_FOUND', 'SNAPSHOT_CHANGED', 'DETAILS_CHANGED_REVIEW_AGAIN',
  'REQUEST_EXPIRED', 'CONSENT_NOT_AVAILABLE', 'CONSUMPTION_IN_PROGRESS', 'CONSUMPTION_TIMED_OUT', 'SESSION_EXPIRED',
  'ORDER_DETAILS_CHANGED', 'ORDER_EVIDENCE_STALE', 'ORDER_PROVENANCE_INVALID', 'ORDER_PROVENANCE_CHANGED',
  'CONSUMPTION_ADMISSION_REQUIRED', 'REQUEST_CLOSED', 'READ_BUDGET_EXHAUSTED',
  'READ_EXPERIMENT_STOPPED', 'READ_OPERATOR_APPROVAL_REQUIRED', 'READ_OPERATIONAL_CUTOFF',
  'PAYPAL_NETWORK_OR_RESPONSE_UNAVAILABLE', 'PAYPAL_HTTP_401', 'PAYPAL_HTTP_403', 'PAYPAL_HTTP_404',
  'PAYPAL_HTTP_422', 'PAYPAL_HTTP_500', 'PAYPAL_HTTP_503', 'READ_FIXED_ORDER_CHANGED',
  'ORDER_EXPIRED_OR_TIME_UNAVAILABLE', 'ORDER_PAYEE_MISMATCH', 'INTERNAL_ERROR']);
const rejectionCodes = new Set(['LOGIN_REQUIRED', 'INVALID_HOST', 'INVALID_ORIGIN', 'CROSS_SITE_DENIED',
  'CSRF_REQUIRED', 'BUYER_SESSION_REQUIRED', 'JSON_REQUIRED', 'INVALID_JSON', 'UNKNOWN_FIELD',
  'QUERY_NOT_SUPPORTED', 'ROUTE_NOT_FOUND', 'INTERNAL_ERROR', 'OTHER_REJECTION']);

export function consumptionDiagnostics(store, { now = Date.now, maxEntries = 1000,
  maxAgeMs = 7 * 86400000, maxBytes = 262144, rejections = {} } = {}) {
  const untrusted = { maxEntries: 32, maxAgeMs: 86400000, maxBytes: 8192, ...rejections };
  for (const value of [maxEntries, maxAgeMs, maxBytes, untrusted.maxEntries, untrusted.maxAgeMs, untrusted.maxBytes]) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error('INVALID_DIAGNOSTIC_LIMIT');
  }
  let tail = Promise.resolve();
  function enqueue(fn) {
    const task = tail.then(fn, fn);
    tail = task.catch(() => false);
    return task;
  }
  async function prune(tx, at) {
    await tx.run('DELETE FROM consumption_diagnostics WHERE at<?', at - maxAgeMs);
    await tx.run(`DELETE FROM consumption_diagnostics WHERE seq NOT IN
      (SELECT seq FROM consumption_diagnostics ORDER BY seq DESC LIMIT ?)`, maxEntries);
    while ((await tx.get('SELECT COALESCE(SUM(size_bytes),0) AS n FROM consumption_diagnostics')).n > maxBytes) {
      await tx.run('DELETE FROM consumption_diagnostics WHERE seq=(SELECT MIN(seq) FROM consumption_diagnostics)');
    }
  }
  async function pruneRejections(tx, at) {
    await tx.run('DELETE FROM consumption_rejections WHERE first_at<?', at - untrusted.maxAgeMs);
    await tx.run(`DELETE FROM consumption_rejections WHERE code NOT IN
      (SELECT code FROM consumption_rejections ORDER BY last_at DESC,code LIMIT ?)`, untrusted.maxEntries);
    while ((await tx.get('SELECT COALESCE(SUM(size_bytes),0) AS n FROM consumption_rejections')).n > untrusted.maxBytes) {
      await tx.run('DELETE FROM consumption_rejections WHERE code=(SELECT code FROM consumption_rejections ORDER BY last_at,code LIMIT 1)');
    }
  }
  function record(correlationId, stage, input = {}) {
    if (!/^[a-f0-9-]{36}$/.test(correlationId ?? '') || !stages.has(stage)) return Promise.resolve(false);
    const requestTag = /^(?:SYNTH|PAYPAL)-[a-f0-9-]{36}$/.test(input.requestId ?? '')
      ? createHash('sha256').update(input.requestId).digest('hex').slice(0, 16) : null;
    const event = { at: now(), correlation_id: correlationId, stage, request_tag: requestTag,
      code: codes.has(input.code) ? input.code : 'INTERNAL_ERROR',
      http_status: Number.isInteger(input.status) && input.status >= 100 && input.status <= 599 ? input.status : null,
      event_id: Number.isSafeInteger(input.eventId) && input.eventId > 0 ? input.eventId : null };
    return enqueue(async () => {
      try {
        await store.transaction(async tx => {
          await tx.run(`INSERT INTO consumption_diagnostics(at,correlation_id,stage,request_tag,code,http_status,event_id,size_bytes)
            VALUES(?,?,?,?,?,?,?,?)`, event.at, event.correlation_id, stage, requestTag, event.code,
          event.http_status, event.event_id, Buffer.byteLength(JSON.stringify(event)));
          await prune(tx, event.at);
        });
        return true;
      } catch { return false; }
    });
  }
  function reject(code, status) {
    const safeCode = rejectionCodes.has(code) ? code : 'OTHER_REJECTION';
    const httpStatus = Number.isInteger(status) && status >= 100 && status <= 599 ? status : null;
    return enqueue(async () => {
      try {
        await store.transaction(async tx => {
          const at = now(); await pruneRejections(tx, at);
          const previous = await tx.get('SELECT first_at,count FROM consumption_rejections WHERE code=?', safeCode);
          const row = { code: safeCode, first_at: previous?.first_at ?? at, last_at: at,
            count: Math.min((previous?.count ?? 0) + 1, 2147483647), http_status: httpStatus };
          await tx.run(`INSERT INTO consumption_rejections(code,first_at,last_at,count,http_status,size_bytes) VALUES(?,?,?,?,?,?)
            ON CONFLICT(code) DO UPDATE SET last_at=excluded.last_at,count=excluded.count,
            http_status=excluded.http_status,size_bytes=excluded.size_bytes`, row.code, row.first_at, row.last_at,
          row.count, row.http_status, Buffer.byteLength(JSON.stringify(row)));
          await pruneRejections(tx, at);
        });
        return true;
      } catch { return false; }
    });
  }
  function sweep() {
    return enqueue(async () => {
      try {
        await store.transaction(async tx => {
          const at = now(); await prune(tx, at); await pruneRejections(tx, at);
        });
      } catch { /* best effort; diagnostics never controls consent */ }
    });
  }
  void sweep();
  const timer = setInterval(() => { void sweep(); }, Math.min(3600000, maxAgeMs, untrusted.maxAgeMs));
  timer.unref();
  return { record, reject, flush: () => tail, close: async () => { clearInterval(timer); await tail; } };
}
