import { addSpeech, exactAmount, stopAudio } from './presentation.js';
import { questionAnswer } from './buyer-help.js';
import { answer as localAnswer, topics as buyerTopics } from './comprehension.js';
const $ = id => document.getElementById(id);
let mode = 'synthetic', status = 'pending', revision = 1, quantity = '2';
function stop() { stopAudio(); }
function notify(text) { $('message').textContent = text; }
function item() {
  return { synthetic: true, status, snapshot: { request_id: 'FIXTURE-ONLY', merchant_name: mode === 'synthetic' ? 'Example Store' : 'MOCK payee MOCKPAYEE123',
    merchant_id: mode === 'synthetic' ? 'SYNTH-SHOP-1' : 'MOCKPAYEE123', amount_minor: (BigInt(quantity) * 100n).toString(), currency: 'USD',
    description: 'Fixture notebook. No real goods or money.', revision, expires_at: Date.now() + 600000 } };
}
function report() {
  return { case_id: 'demo-only', items: [{ id: 'notebook', name: 'A5 ruled journal', quantity, unit_minor: '100' }],
    total_minor: item().snapshot.amount_minor, expected_total_minor: '100', currency: 'USD',
    issues: quantity === '2' ? [{ id: 'quantity-notebook', text: 'Expected quantity 1; recorded quantity 2 for notebook.' }] : [],
    merchant: { name: item().snapshot.merchant_name, name_source: 'helper-provided fixture', payee_id: item().snapshot.merchant_id, expected_payee_id: item().snapshot.merchant_id },
    boundary: status === 'rejected' ? 'Simulated buyer refusal. Do not proceed.' : 'DEMO FIXTURE ONLY. Not evidence of a payable order.' };
}
function paint() {
  stop(); const s = item().snapshot, host = $('review'); host.replaceChildren();
  const p = text => { const node = document.createElement('p'); node.textContent = text; host.append(node); };
  const heading = document.createElement('h3'); heading.textContent = `${exactAmount(s)} — ${s.merchant_name}`; host.append(heading);
  p(mode === 'synthetic' ? 'SYNTHETIC / helper-supplied / merchant unverified.' : 'MOCK PayPal fixture / no authenticated API response / shop identity unverified.');
  p('Item: A5 ruled journal. Expected quantity: 1. Recorded quantity: ' + quantity + '. Unit amount: 1.00 USD.');
  p(`Revision: ${revision}. Simulated local consent: ${status}.`);
  p('Genuine PayPal order verification: not established. PayPal buyer approval: not established. Payment authorization/completion: not established.');
  $('payment-audio').replaceChildren();
  addSpeech($('payment-audio'), () => `${mode === 'mock' ? 'MOCK PayPal fixture. No authenticated API response.' : 'Synthetic request.'} Amount: ${exactAmount(s)}. Merchant unverified: ${s.merchant_name}. Reference: ${s.merchant_id}. ${s.description} Expected quantity 1; recorded quantity ${quantity}. Unit amount 1.00 USD. Simulated consent: ${status}. No payment was made.`, 'payment details', notify);
  for (const selected of ['synthetic', 'mock']) $(selected).setAttribute('aria-pressed', String(mode === selected));
  $('approve').disabled = status !== 'pending'; $('consume').disabled = status !== 'approved';
  $('decline').disabled = status !== 'pending'; $('revise').disabled = !['pending', 'approved'].includes(status);
  $('explanation').textContent = '';
  if (document.activeElement?.disabled) $('review-heading').focus();
}
function reset() { status = 'pending'; revision = 1; quantity = '2'; paint(); notify('Simulation restarted. No real state or payment was changed.'); }
for (const selected of ['synthetic', 'mock']) $(selected).addEventListener('click', () => {
  if (mode === selected) { notify('This evidence type is already selected. Use Start again to restart.'); return; }
  mode = selected; reset();
});
$('reset').addEventListener('click', reset);
$('start').addEventListener('click', () => $('review-heading').focus());
$('approve').addEventListener('click', () => { if (status !== 'pending') return; status = 'approved'; paint(); notify('SIMULATED consent approval only. No passkey or payment operation occurred.'); });
$('consume').addEventListener('click', () => { if (status !== 'approved') return; status = 'consumed'; paint(); notify('SIMULATED consent consumed once. No payment occurred.'); });
$('decline').addEventListener('click', () => { if (status !== 'pending') return; status = 'rejected'; paint(); notify('SIMULATED refusal recorded. Nothing was approved or paid.'); });
$('revise').addEventListener('click', () => {
  if (!['pending', 'approved'].includes(status)) return;
  revision++; quantity = quantity === '2' ? '1' : '2'; status = 'pending'; paint(); notify('Fixture revised. Simulated prior consent invalidated; review again.');
});
$('answer').addEventListener('click', () => { stop(); $('explanation').textContent = questionAnswer($('question').value, report()); });
$('ask-question').addEventListener('click', async () => {
  const button = $('ask-question');
  const question = $('buyer-question').value.trim();
  if (question.length < 3) { $('ai-explanation').textContent = 'Enter a question of at least three characters.'; $('buyer-question').focus(); return; }
  button.disabled = true;
  $('ai-explanation').textContent = 'Understanding your question…';
  try {
    const response = await fetch('/api/demo-question', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'QUESTION_UNAVAILABLE');
    const source = result.source === 'ai' ? 'AI matched your question' : 'Local matching was used';
    $('ai-explanation').textContent = source + ': ' + (buyerTopics[result.topic] || buyerTopics.unknown) +
      ' ' + localAnswer(result.topic, item());
  } catch {
    $('ai-explanation').textContent = 'Question help is temporarily unavailable. You can still use the fixed questions above.';
  } finally { button.disabled = false; }
});
addSpeech($('answer-audio'), () => {
  if (!$('explanation').textContent) $('explanation').textContent = questionAnswer($('question').value, report());
  return $('explanation').textContent;
}, 'explanation', notify, { read: 'read-answer', pause: 'pause-answer', stop: 'stop-answer' });
window.addEventListener('pagehide', stop); paint();
