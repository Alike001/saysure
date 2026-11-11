import { reviewedEvidence } from './evidence-provenance.js';
import { exactAmount } from './presentation.js';
export const topics = Object.freeze({
  amount: 'What is the amount?', merchant: 'Is this merchant verified?',
  consent: 'Does my passkey make a payment?', availability: 'Can this request still be reviewed?',
  fees: 'Are fees or delivery guaranteed?', unknown: 'Something else',
});
// Both ordinary help and model-selected topics use these same deterministic answers.
export function answer(topic, item, now = Date.now()) {
  if (item.snapshot.kind === 'paypal') return `${reviewedEvidence(item, now).provenance === 'mock-paypal-fixture' ? 'MOCK PayPal fixture. No real API verification.' : reviewedEvidence(item, now).provenance === 'authenticated-sandbox-api' ? 'Recorded authenticated sandbox observation.' : 'PayPal evidence provenance unavailable.'} ${reviewedEvidence(item, now).current ? 'This review is recent; the server must revalidate.' : 'This evidence is historical or stale. Do not approve.'} This is a PayPal sandbox order review. Check the recorded API evidence, payee reference and purchase-unit totals. Shop identity is unverified. Local consent does not authorize or complete a payment. Stale or unavailable evidence requires a new review.`;
  if (item.synthetic !== true) return 'Current payment evidence is unavailable. Do not approve.';
  const s = item.snapshot;
  const live = item.status === 'pending' && s.expires_at > now;
  const prefix = live ? 'This is a synthetic request, with no real money. ' :
    'This request cannot receive a new approval. These are historical request details, not an amount payable now. ';
  const answers = {
    amount: `The recorded amount is ${exactAmount(s)}.`,
    merchant: `The helper supplied ${s.merchant_name}, reference ${s.merchant_id}. The merchant identity is unverified.`,
    consent: 'Your passkey records local consent for the exact details. It does not approve a PayPal checkout or make a payment.',
    availability: live ? 'You may review, decline, or choose the passkey control yourself. The server checks current details again before accepting consent.' : 'Refresh requests to see current status. Do not treat this request as payable.',
    fees: 'This request does not establish delivery, extra fees, exchange costs, refunds or seller trust. Ask for independent evidence.',
    unknown: 'This prototype cannot answer that safely. Review the recorded details and ask for independent evidence before deciding.',
  };
  return prefix + (answers[topic] ?? answers.unknown);
}
export function acceptTopics(output, count) {
  if (!output || Object.keys(output).join() !== 'topics' || !Array.isArray(output.topics) ||
    output.topics.length !== count || output.topics.some(t => !Object.hasOwn(topics, t))) {
    throw new Error('AI_UNSUPPORTED_OUTPUT');
  }
  return output.topics;
}
