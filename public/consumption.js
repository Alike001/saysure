import { canonical } from './consent-shape.js';
import { evidenceConsistent } from './evidence-provenance.js';
const validTime = (value, now) => Number.isSafeInteger(value) && value > 0 && value <= now + 60000;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  if (value === null || ['string', 'boolean'].includes(typeof value) || typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  throw new Error('Malformed snapshot');
}
export function sameSnapshot(a, b) {
  try { return isObject(a) && isObject(b) && stable(a) === stable(b); } catch { return false; }
}
export async function canonicalConsentDigest(snapshot) {
  const bytes = new TextEncoder().encode(canonical(snapshot));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function matchesConsumedState(data, expected) {
  return sameSnapshot(data?.snapshot, expected.snapshot) && data.digest === expected.digest &&
    data.consent_digest === expected.digest && data.status === 'consumed' &&
    data.consumed_at === expected.consumed_at && data.synthetic === expected.synthetic &&
    data.display_amount === expected.display_amount &&
    (expected.snapshot.kind !== 'paypal' || evidenceConsistent(data) && evidenceConsistent(expected) &&
      data.paypal_evidence.provenance === expected.paypal_evidence.provenance);
}
export async function validateReviewedEvidence(item) {
  if (item.snapshot.kind !== 'paypal') return;
  // Legacy snapshots remain readable, but cannot acquire a new verified label or receipt.
  if (!Object.hasOwn(item.snapshot, 'evidence_provenance')) return;
  if (!evidenceConsistent(item) || await canonicalConsentDigest(item.snapshot) !== item.digest)
    throw new Error('PayPal evidence provenance or canonical review integrity is inconsistent.');
}
export async function validateConsumptionReceipt(data, item, now = Date.now()) {
  try {
    const reviewed = structuredClone(item.snapshot);
    if (reviewed.kind === 'paypal' && (!evidenceConsistent(item) || !evidenceConsistent(data) ||
      data.paypal_evidence.observed_at < item.paypal_evidence.observed_at ||
      data.paypal_evidence.observed_at > now || data.paypal_evidence.current !== true)) throw new Error('Evidence mismatch');
    const expectedDigest = await canonicalConsentDigest(reviewed);
    const r = data?.consumption_receipt, e = r?.event, id = reviewed.request_id;
    if (!/^(?:SYNTH|PAYPAL)-[a-f0-9-]{36}$/.test(id ?? '') ||
      typeof reviewed.buyer_id !== 'string' || !reviewed.buyer_id ||
      !/^[a-f0-9]{64}$/.test(item.digest ?? '') || expectedDigest !== item.digest ||
      !r || !/^[a-f0-9-]{36}$/.test(r.correlation_id ?? '') || r.version !== 1 || r.committed !== true ||
      r.status !== 'consumed' || r.request_id !== id || r.buyer_id !== reviewed.buyer_id ||
      r.consent_digest !== expectedDigest || !validTime(r.consumed_at, now) ||
      !Number.isSafeInteger(reviewed.expires_at) || r.consumed_at >= reviewed.expires_at ||
      !Number.isSafeInteger(e?.id) || e.id <= 0 || e.type !== 'consume' || e.request_id !== id ||
      !validTime(e.at, now) || e.at !== r.consumed_at ||
      !matchesConsumedState(data, { ...item, snapshot: reviewed, consumed_at: r.consumed_at })) throw new Error('Receipt mismatch');
    // Only consumption state/evidence is new. Retain the exact independently reviewed snapshot.
    return { ...data, snapshot: reviewed };
  } catch {
    throw new Error('Consumption was not confirmed by a matching committed receipt and reviewed snapshot. Do not retry automatically; ask the operator to inspect the saved state.');
  }
}
