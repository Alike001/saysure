import { exactAmount } from './presentation.js';
export const questionTopics = Object.freeze(['difference', 'items', 'merchant', 'payment', 'decline', 'simple', 'terms', 'availability', 'unsupported']);
// Fair ordinary baseline: common questions route without a model.
export function ordinaryTopic(question) {
  const q = question.toLowerCase();
  if (/ignore|override|refund|guarantee|0\.01/.test(q)) return 'unsupported';
  if (/expired|historical|old order|pay now/.test(q)) return 'availability';
  if (/declin|refus|say no|reject/.test(q)) return 'decline';
  if (/already.*pa|payment.*happen|payment.*complete|paid/.test(q)) return 'payment';
  if (/merchant|seller|same shop/.test(q)) return 'merchant';
  if (/simpl|plain language/.test(q)) return 'simple';
  if (/mean|a5|ruled|unfamiliar/.test(q)) return 'terms';
  if (/differ|expected|extra|where is|single|wanted just/.test(q)) return 'difference';
  if (/items|charged for|itemization/.test(q)) return 'items';
  return 'unsupported';
}
export function validateQuestionChoice(output, report) {
  if (!output || Object.keys(output).sort().join() !== 'case_id,topic' || output.case_id !== report.case_id ||
    !questionTopics.includes(output.topic)) throw new Error('AI_UNSUPPORTED_QUESTION_CHOICE');
  return output.topic;
}
export function questionAnswer(topic, report) {
  if (!questionTopics.includes(topic)) topic = 'unsupported';
  const amount = exactAmount({ amount_minor: report.total_minor, currency: report.currency });
  const merchant = report.merchant ?? {};
  const merchantText = `${merchant.name ? `Displayed name: ${merchant.name}. Source: ${merchant.name_source ?? 'unverified'}. ` : 'No supported merchant display name is available. '}` +
    'Shop identity is not independently verified. ' +
    (merchant.payee_id && merchant.expected_payee_id ? `Recorded payee reference ${merchant.payee_id} ${merchant.payee_id === merchant.expected_payee_id ? 'matches' : 'differs from'} expected reference ${merchant.expected_payee_id}. A matching reference is not proof of shop identity.` : 'There is no evidence to establish that this is the shop you expected.');
  const items = report.items.map(i => `${i.name}: quantity ${i.quantity}, unit amount ${exactAmount({ amount_minor: i.unit_minor, currency: report.currency })}.`).join(' ');
  const answers = {
    difference: `${report.issues.map(i => i.text).join(' ') || 'No item or quantity difference was found in the supplied expectations.'} Recorded item total: ${amount}. ${report.expected_total_minor ? `Buyer-expected total: ${exactAmount({ amount_minor: report.expected_total_minor, currency: report.currency })}.` : 'No expected total was supplied.'} This fixture does not establish additional tax, fees or delivery costs.`,
    items: `${items} Recorded item total: ${amount}. These are fixture items, not a statement of completed charges.`,
    merchant: merchantText,
    payment: 'Payment completion is not established by this evidence. SaySure consent and a passkey unlock do not establish PayPal buyer approval, authorization or capture.',
    decline: 'Declining records your refusal in SaySure and prevents that local consent from being used. It does not cancel or refund a separate PayPal payment. The assistant cannot override refusal.',
    simple: `This record lists ${amount}. ${report.issues.length ? 'The listed items differ from your expectations. Review the differences before deciding.' : 'Check the listed items and merchant reference.'} Nothing is paid by this assistant. You can decline.`,
    terms: report.requested_terms?.length ? report.requested_terms.map(t => report.definitions[t]).join(' ') : 'No supported definition was identified for your question. Ask for clarification; do not guess the product or its purpose.',
    availability: 'Historical, expired or unverified records are not evidence of a currently payable order. Obtain fresh server-verified evidence before considering consent.',
    unsupported: 'That claim or action is not supported. The assistant cannot change amounts, verify a shop identity, guarantee products/taxes, approve a transaction or claim payment success.',
  };
  return `${report.boundary} ${answers[topic]}`;
}
