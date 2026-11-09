import { ensure } from './core.mjs';
export const glossary = Object.freeze({ A5: 'A small paper format often used for notebooks.',
  ruled: 'Pages printed with lines to guide writing.', refill: 'A replacement insert, rather than a complete pen.' });
// Inputs here are pre-reviewed synthetic fixtures only, never raw PayPal/real buyer text.
export function comparePurchase(record) {
  ensure(['synthetic', 'mock-paypal-fixture'].includes(record.source), 'SANITIZED_FIXTURE_REQUIRED');
  ensure(['USD', 'EUR', 'JPY', 'NGN'].includes(record.currency), 'CURRENCY_REQUIRED');
  const positive = v => typeof v === 'string' && /^[1-9][0-9]{0,8}$/.test(v);
  ensure(Array.isArray(record.items) && record.items.length <= 10 &&
    record.items.every(i => /^[a-z-]+$/.test(i.id) && positive(i.quantity) && positive(i.unit_minor)), 'INVALID_ITEM_FACTS');
  ensure(new Set(record.items.map(i => i.id)).size === record.items.length, 'DUPLICATE_ITEM');
  const total = record.items.reduce((sum, i) => sum + BigInt(i.quantity) * BigInt(i.unit_minor), 0n);
  ensure(total.toString() === record.total_minor, 'ITEM_TOTAL_MISMATCH');
  ensure(record.expected.every(i => /^[a-z-]+$/.test(i.id) && positive(i.quantity)), 'INVALID_EXPECTATION');
  ensure(record.expected_total_minor === undefined || positive(record.expected_total_minor), 'INVALID_EXPECTED_TOTAL');
  const issues = [];
  for (const wanted of record.expected) {
    const actual = record.items.find(i => i.id === wanted.id);
    if (!actual) issues.push({ id: `missing-${wanted.id}`, text: `Expected item ${wanted.id} is absent from this fixture.` });
    else if (actual.quantity !== wanted.quantity) issues.push({ id: `quantity-${wanted.id}`,
      text: `Expected quantity ${wanted.quantity}; recorded quantity ${actual.quantity} for ${wanted.id}.` });
  }
  for (const actual of record.items) if (!record.expected.some(i => i.id === actual.id)) {
    issues.push({ id: `extra-${actual.id}`, text: `Recorded item ${actual.id} was not in the expectation list.` });
  }
  // These cannot be removed by model selection: refusal, freshness and payment limits are deterministic.
  const boundary = record.refused ? 'The buyer refused. Do not proceed.' :
    record.stale ? 'This fixture is stale or unverified. It is not evidence of a payable order.' :
      'This is a fixture comparison only, not authorization or payment completion.';
  const terms = Object.keys(glossary).filter(term => record.items.some(i => i.name.includes(term)));
  const requested_terms = terms.filter(term => (record.question ?? '').toLowerCase().includes(term.toLowerCase()));
  return { question: record.question ?? '', requested_terms, definitions: glossary,
    expected_total_minor: record.expected_total_minor, merchant: record.merchant,
    case_id: record.id, source: record.source, items: record.items, expected: record.expected,
    total_minor: record.total_minor, currency: record.currency, boundary, issues, terms };
}
export function validateSelection(output, report) {
  ensure(output && Object.keys(output).sort().join() === 'case_id,issue_ids,term_ids' && output.case_id === report.case_id,
    'AI_UNSUPPORTED_PURCHASE_CLAIM');
  ensure(Array.isArray(output.issue_ids) && Array.isArray(output.term_ids) &&
    output.issue_ids.length <= report.issues.length && output.term_ids.length <= report.terms.length &&
    new Set(output.issue_ids).size === output.issue_ids.length && new Set(output.term_ids).size === output.term_ids.length &&
    output.issue_ids.every(id => report.issues.some(i => i.id === id)) &&
    output.term_ids.every(id => report.requested_terms.includes(id)), 'AI_UNSUPPORTED_PURCHASE_CLAIM');
  return { boundary: report.boundary, explanations: output.issue_ids.map(id => report.issues.find(i => i.id === id).text),
    definitions: output.term_ids.map(id => glossary[id]),
    // Every actual financial value comes from the deterministic report, never the selection.
    financial_facts: { total_minor: report.total_minor, currency: report.currency, items: report.items },
    limitation: 'AI selection may omit relevant issues. Review the full structured comparison.' };
}
