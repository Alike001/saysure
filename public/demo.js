import { addAudio, exactAmount, stopAudio } from './presentation.js';
import { questionAnswer } from './buyer-help.js';
const $ = id => document.getElementById(id);
let mode = 'synthetic', status = 'pending', revision = 1, quantity = '2';
let answerAudio;
function stop() { stopAudio(); window.speechSynthesis?.cancel(); answerAudio = null; }
function notify(text) { $('message').textContent = text; $('message').focus(); }
function item() {
  return { synthetic: true, status, snapshot: { request_id: 'FIXTURE-ONLY', merchant_name: mode === 'synthetic' ? 'Example Store' : 'MOCK payee MOCKPAYEE123',
    merchant_id: mode === 'synthetic' ? 'SYNTH-SHOP-1' : 'MOCKPAYEE123', amount_minor: (BigInt(quantity) * 100n).toString(), currency: 'USD',
    description: 'Fixture notebook. No real goods or money.', revision, expires_at: Date.now() + 600000 } };
}
function report() {
  return { case_id: 'demo-only', items: [{ id: 'notebook', name: 'A5 ruled journal', quantity, unit_minor: '100' }],
    total_minor: item().snapshot.amount_minor, expected_total_minor: '100', currency: 'USD',
    issues: quantity === '2' ? [{ id: 'quantity-notebook', text: 'Expected quantity 1; recorded quantity 2 for notebook.' }] : [],
    merchant: { name: 'Example Store', name_source: 'helper-provided fixture', payee_id: 'MOCKPAYEE123', expected_payee_id: 'MOCKPAYEE123' },
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
  addAudio(host, item(), notify);
  $('approve').disabled = status !== 'pending'; $('consume').disabled = status !== 'approved';
  $('decline').disabled = status !== 'pending'; $('revise').disabled = !['pending', 'approved'].includes(status);
  $('explanation').textContent = '';
}
for (const selected of ['synthetic', 'mock']) $(selected).addEventListener('click', () => {
  mode = selected; status = 'pending'; revision = 1; quantity = '2'; paint(); notify('Fixture reset. No real state or payment was changed.');
});
$('approve').addEventListener('click', () => { if (status !== 'pending') return; status = 'approved'; paint(); notify('SIMULATED consent approval only. No passkey or payment operation occurred.'); });
$('consume').addEventListener('click', () => { if (status !== 'approved') return; status = 'consumed'; paint(); notify('SIMULATED consent consumed once. No payment occurred.'); });
$('decline').addEventListener('click', () => { if (status !== 'pending') return; status = 'rejected'; paint(); notify('SIMULATED refusal recorded. Nothing was approved or paid.'); });
$('revise').addEventListener('click', () => {
  if (!['pending', 'approved'].includes(status)) return;
  revision++; quantity = quantity === '2' ? '1' : '2'; status = 'pending'; paint(); notify('Fixture revised. Simulated prior consent invalidated; review again.');
});
$('answer').addEventListener('click', () => { stop(); $('explanation').textContent = questionAnswer($('question').value, report()); });
$('read-answer').addEventListener('click', () => {
  stop();
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) { notify('Speech unavailable. Read the visible explanation.'); return; }
  if (!$('explanation').textContent) $('explanation').textContent = questionAnswer($('question').value, report());
  answerAudio = new SpeechSynthesisUtterance($('explanation').textContent); answerAudio.lang = 'en';
  answerAudio.onerror = () => notify('Audio unavailable. Read the visible explanation.'); window.speechSynthesis.speak(answerAudio);
});
$('stop-answer').addEventListener('click', () => { stop(); notify('Explanation audio stopped.'); });
window.addEventListener('pagehide', stop); paint();
