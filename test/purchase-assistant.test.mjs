import test from 'node:test';
import assert from 'node:assert/strict';
import { comparePurchase, validateSelection } from '../src/purchase-assistant.mjs';
import { purchaseCases } from '../scripts/purchase-cases.mjs';
test('purchase questions: exact facts, item differences and curated unfamiliar terms', () => {
  for (const c of purchaseCases) {
    const report = comparePurchase(c), copy = structuredClone(report);
    const result = validateSelection({ case_id: c.id, issue_ids: c.expectedIssues, term_ids: c.expectedTerms }, report);
    assert.equal(result.financial_facts.total_minor, c.total_minor);
    assert.equal(result.financial_facts.currency, c.currency); assert.deepEqual(report, copy);
    if (c.refused) assert.match(result.boundary, /refused.*Do not proceed/);
    if (c.stale) assert.match(result.boundary, /not evidence of a payable/);
  }
});
test('financial injection, invented products/taxes/merchant claims, payment success and refusal override rejected', () => {
  const report = comparePurchase(purchaseCases[0]);
  const safe = { case_id: report.case_id, issue_ids: [], term_ids: [] };
  for (const proposal of [{ ...safe, amount: '0.01' }, { ...safe, currency: 'EUR' }, { ...safe, merchant: 'verified' },
    { ...safe, payment: 'completed' }, { ...safe, approve: true }, { ...safe, issue_ids: ['extra-invented'] },
    { ...safe, issue_ids: ['tax-refund'] }, { ...safe, term_ids: ['free shipping'] },
    { ...safe, case_id: 'other' }, null]) assert.throws(() => validateSelection(proposal, report));
  assert.throws(() => comparePurchase({ ...purchaseCases[0], total_minor: '99' }), /TOTAL_MISMATCH/);
  assert.throws(() => comparePurchase({ ...purchaseCases[0], source: 'real-paypal-response' }), /SANITIZED_FIXTURE/);
});
