export const validProvenance = p => ['mock-paypal-fixture', 'authenticated-sandbox-api'].includes(p);
export function evidenceConsistent(item) {
  const p = item?.snapshot?.evidence_provenance, e = item?.paypal_evidence;
  return validProvenance(p) && e?.provenance === p &&
    Number.isSafeInteger(e.observed_at) && e.observed_at > 0 &&
    typeof e.current === 'boolean' && e.merchant_identity_verified === false;
}
export function reviewedEvidence(item, now = Date.now()) {
  const provenance = item.snapshot.evidence_provenance;
  const consistent = evidenceConsistent(item);
  const e = item.paypal_evidence;
  return { provenance: validProvenance(provenance) ? provenance : 'unavailable',
    observed_at: consistent ? e.observed_at : null,
    current: consistent && e.current && e.observed_at <= now && now - e.observed_at < 60000 &&
      item.snapshot.expires_at > now };
}
