import test from 'node:test';
import assert from 'node:assert/strict';
import { comparePurchase, validateSelection } from '../src/purchase-assistant.mjs';
import { validateQuestionChoice, questionAnswer, ordinaryTopic } from '../public/buyer-help.js';
import { readinessCases } from '../scripts/readiness-cases.mjs';
import { purchaseCases } from '../scripts/purchase-cases.mjs';
test('the three prior irrelevant glossary failures are rejected by question-scoped grounding', () => {
  for (const c of purchaseCases.slice(1, 4)) {
    const r = comparePurchase(c);
    assert.throws(() => validateSelection({ case_id: c.id, issue_ids: c.expectedIssues, term_ids: ['A5', 'ruled'] }, r));
    const valid = validateSelection({ case_id: c.id, issue_ids: c.expectedIssues, term_ids: [] }, r);
    assert.deepEqual(valid.definitions, []);
  }
});
test('buyer-question answers preserve exact facts, helper provenance, refusal and stale boundaries', () => {
  for (const c of readinessCases) {
    const r = comparePurchase(c), copy = structuredClone(r);
    const topic = validateQuestionChoice({ case_id: c.id, topic: c.expectedTopic }, r);
    const a = questionAnswer(topic, r); assert.deepEqual(r, copy);
    if (topic === 'difference') { assert.match(a, /Recorded item total:/); assert.match(a, /does not establish additional tax/); }
    if (topic === 'items') assert.match(a, /quantity 2, unit amount 1.00 USD/);
    if (topic === 'merchant') { assert.match(a, /helper-provided/); assert.match(a, /not independently verified/); }
    if (topic === 'payment') assert.match(a, /completion is not established/);
    if (topic === 'decline') assert.match(a, /does not cancel or refund/);
    if (c.refused) assert.match(a, /refused. Do not proceed/);
    if (c.stale) assert.match(a, /not evidence of a payable/);
  }
  assert.match(questionAnswer('merchant', comparePurchase(readinessCases.at(-1))), /differs from expected reference/);
});
test('model financial claims, payment actions, unknown topics and cross-case selections fail closed', () => {
  const r = comparePurchase(readinessCases[0]);
  for (const o of [{ case_id: r.case_id, topic: 'payment', paid: true }, { case_id: r.case_id, topic: 'approve' },
    { case_id: r.case_id, topic: 'items', amount: '0.01' }, { case_id: 'wrong', topic: 'items' }, null]) {
    assert.throws(() => validateQuestionChoice(o, r), /AI_UNSUPPORTED/);
  }
  assert.equal(ordinaryTopic('What items am I being charged for?'), 'items');
  assert.match(questionAnswer('invented', r), /claim or action is not supported/);
});
