import { purchaseCases } from './purchase-cases.mjs';
export const readinessCases = purchaseCases.map((c, i) => ({ ...c,
  expectedTopic: ['terms', 'difference', 'difference', 'difference', 'unsupported', 'availability'][i] }));
const base = { ...purchaseCases[1], expected_total_minor: '100', merchant: { name: 'Example Store',
  name_source: 'helper-provided', payee_id: 'MOCKPAYEE123', expected_payee_id: 'MOCKPAYEE123' } };
for (const [id, question, expectedTopic] of [
  ['total', 'Why does my total differ from what I expected?', 'difference'],
  ['items', 'What items am I being charged for?', 'items'],
  ['merchant', 'Is this the same merchant I expected?', 'merchant'],
  ['payment', 'Has payment already happened?', 'payment'],
  ['decline', 'What happens if I decline?', 'decline'],
  ['simple', 'Can you explain this in simpler language?', 'simple'],
  ['paraphrase-cost', 'What accounts for the jump in the bill?', 'difference'],
  ['paraphrase-items', 'Walk me through the things on this list.', 'items'],
  ['paraphrase-merchant', 'Am I dealing with the business I had in mind?', 'merchant'],
  ['paraphrase-payment', 'Did funds move out of my wallet yet?', 'payment'],
]) readinessCases.push({ ...base, id: `question-${id}`, question, expectedTopic });
readinessCases.push({ ...base, id: 'merchant-mismatch', question: 'Is this the same merchant I expected?',
  merchant: { ...base.merchant, payee_id: 'MOCKOTHER123' }, expectedTopic: 'merchant' });
