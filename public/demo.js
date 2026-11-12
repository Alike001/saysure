import { addSpeech, exactAmount, stopAudio } from './presentation.js';
import { questionAnswer } from './buyer-help.js';
import { answer as localAnswer, topics as buyerTopics } from './comprehension.js';
const $ = id => document.getElementById(id);
let mode = 'synthetic', status = 'pending', revision = 1, quantity = '2';
const demoCases = [
  { id: 'SYN-1001', merchant: 'Example Store', merchantId: 'SYNTH-SHOP-1', itemName: 'A5 ruled journal', quantity: '2', originalQuantity: '2', expected: '1', unitMinor: 100, currency: 'USD', status: 'pending', revision: 1, buyer: 'Buyer A', description: 'Fixture notebook. No real goods or money.' },
  { id: 'SYN-1002', merchant: 'Campus Supplies', merchantId: 'SYNTH-CAMPUS-2', itemName: 'Stationery kit', quantity: '1', originalQuantity: '1', expected: '1', unitMinor: 1200, currency: 'USD', status: 'approved', revision: 1, buyer: 'Buyer B', description: 'Fictional campus stationery.' },
  { id: 'SYN-1003', merchant: 'City Electronics', merchantId: 'SYNTH-CITY-3', itemName: 'USB-C charger', quantity: '1', originalQuantity: '1', expected: '1', unitMinor: 8900, currency: 'USD', status: 'pending', revision: 2, buyer: 'Buyer A', description: 'Fictional charger request, updated once.' },
  { id: 'SYN-1004', merchant: 'QuickMart', merchantId: 'SYNTH-QUICK-4', itemName: 'Grocery basket', quantity: '1', originalQuantity: '1', expected: '1', unitMinor: 850, currency: 'USD', status: 'rejected', revision: 1, buyer: 'Buyer B', description: 'Fictional groceries; declined by Buyer.' },
  { id: 'SYN-1005', merchant: 'Household Goods', merchantId: 'SYNTH-HOME-5', itemName: 'Laundry supplies', quantity: '1', originalQuantity: '1', expected: '1', unitMinor: 2499, currency: 'USD', status: 'consumed', revision: 1, buyer: 'Buyer A', description: 'Fictional supplies; simulated single-use consent.' },
];
let activeCase = 0, role = 'buyer';
function currentCase() { return demoCases[activeCase]; }
function saveCurrent() { Object.assign(currentCase(), { status, revision, quantity }); }
function formatMoney(minor, currency = 'USD') { return (Number(minor) / 100).toFixed(2) + ' ' + currency; }
const statusNames = { pending: 'Awaiting review', approved: 'Consent simulated', rejected: 'Declined', consumed: 'Consumed (simulated)' };
function renderOverview() {
  const metrics = $('demo-metrics'), cases = $('demo-cases');
  metrics.replaceChildren(); cases.replaceChildren();
  const values = [
    ['Requests', demoCases.length],
    ['Awaiting review', demoCases.filter(c => c.status === 'pending').length],
    ['Consent simulated', demoCases.filter(c => c.status === 'approved').length],
    ['Declined', demoCases.filter(c => c.status === 'rejected').length],
  ];
  for (const [label, value] of values) {
    const card = document.createElement('div'); card.className = 'demo-metric';
    const n = document.createElement('strong'); n.textContent = String(value);
    const l = document.createElement('span'); l.textContent = label;
    card.append(n, l); metrics.append(card);
  }
  demoCases.forEach((record, index) => {
    const button = document.createElement('button'); button.type = 'button';
    button.className = 'demo-case'; button.setAttribute('aria-pressed', String(activeCase === index));
    const name = document.createElement('strong'); name.textContent = record.merchant;
    const detail = document.createElement('small'); detail.textContent = record.itemName + ' · ' + record.buyer + ' · ' + formatMoney(BigInt(record.quantity) * BigInt(record.unitMinor), record.currency);
    const state = document.createElement('span'); state.className = 'demo-case-state'; state.dataset.state = record.status; state.textContent = statusNames[record.status];
    button.append(name, detail, state);
    button.addEventListener('click', () => {
      if (index === activeCase) return;
      saveCurrent(); activeCase = index; mode = 'synthetic';
      ({ status, revision, quantity } = currentCase());
      paint(); notify('Showing fictional request ' + currentCase().id + '. No real workspace record was opened.');
    });
    cases.append(button);
  });
  if ($('helper-revise')) $('helper-revise').disabled = !['pending', 'approved'].includes(status);
}
function updateRole(next) {
  role = next;
  document.body.dataset.role = next;
  $('buyer-view').setAttribute('aria-pressed', String(next === 'buyer'));
  $('helper-view').setAttribute('aria-pressed', String(next === 'helper'));
  $('helper-console').hidden = next !== 'helper';
  stop();
  notify(next === 'buyer'
    ? 'Buyer view: review and make a simulated independent decision.'
    : 'Helper view: prepare or revise a fictional request. The Helper cannot approve it.');
}

function stop() { stopAudio(); }
function notify(text) { $('message').textContent = text; }
function item() {
  const selected = currentCase();
  return { synthetic: true, status, snapshot: {
    request_id: selected.id,
    merchant_name: mode === 'mock' ? 'MOCK payee MOCKPAYEE123' : selected.merchant,
    merchant_id: mode === 'mock' ? 'MOCKPAYEE123' : selected.merchantId,
    amount_minor: (BigInt(quantity) * BigInt(selected.unitMinor)).toString(),
    currency: selected.currency, description: selected.description, revision,
    expires_at: Date.now() + 600000,
  } };
}
function report() {
  const selected = currentCase();
  return { case_id: 'demo-only', items: [{ id: selected.id, name: selected.itemName, quantity, unit_minor: String(selected.unitMinor) }],
    total_minor: item().snapshot.amount_minor,
    expected_total_minor: (BigInt(selected.expected) * BigInt(selected.unitMinor)).toString(),
    currency: selected.currency,
    issues: quantity !== selected.expected ? [{ id: 'quantity-' + selected.id, text: 'Expected quantity ' + selected.expected + '; recorded quantity ' + quantity + ' for ' + selected.itemName + '.' }] : [],
    merchant: { name: item().snapshot.merchant_name, name_source: 'helper-provided fixture', payee_id: item().snapshot.merchant_id, expected_payee_id: item().snapshot.merchant_id },
    boundary: status === 'rejected' ? 'Simulated buyer refusal. Do not proceed.' : 'DEMO FIXTURE ONLY. Not evidence of a payable order.' };
}
function paint() {
  stop();
  saveCurrent(); renderOverview();
  const selected = currentCase(), s = item().snapshot, host = $('review');
  host.replaceChildren();
  const p = (text, className = '') => {
    const node = document.createElement('p');
    node.textContent = text;
    if (className) node.className = className;
    host.append(node);
    return node;
  };
  p('AMOUNT REQUESTED', 'review-amount-label');
  const heading = document.createElement('h3');
  heading.textContent = exactAmount(s);
  host.append(heading);
  p(s.merchant_name, 'review-merchant');
  p(mode === 'synthetic' ? 'Helper-provided · merchant unverified' : 'MOCK PayPal fixture · no authenticated API response', 'review-source');

  const facts = document.createElement('dl');
  facts.className = 'review-facts';
  const addFact = (label, value) => {
    const term = document.createElement('dt'); term.textContent = label;
    const detail = document.createElement('dd'); detail.textContent = value;
    facts.append(term, detail);
  };
  addFact('Item', selected.itemName);
  addFact('Recorded quantity', quantity + (quantity === '1' ? ' unit' : ' units'));
  addFact('Expected quantity', selected.expected + (selected.expected === '1' ? ' unit' : ' units'));
  addFact('Unit amount', formatMoney(selected.unitMinor, selected.currency));
  addFact('Merchant reference', s.merchant_id);
  addFact('Revision', String(revision));
  host.append(facts);

  const warning = document.createElement('div');
  warning.className = quantity !== selected.expected ? 'review-warning' : 'review-clear';
  warning.setAttribute('role', 'status');
  warning.textContent = quantity !== selected.expected
    ? 'Review needed: the request records ' + quantity + ' ' + selected.itemName + ' units, but the expected quantity is ' + selected.expected + '. The recorded total is ' + formatMoney(s.amount_minor, s.currency) + '.'
    : 'Quantity check: the recorded and expected quantities match. The total is ' + formatMoney(s.amount_minor, s.currency) + '.';
  host.append(warning);
  p('Revision: ' + revision + '. Simulated local consent: ' + status + '.', 'review-state');
  p('No genuine PayPal order verification, buyer approval or payment completion is established.', 'review-state');

  const statusLabel = { pending: 'REVIEW NEEDED', approved: 'CONSENT SIMULATED', rejected: 'DECLINED', consumed: 'CONSUMED (SIMULATED)' };
  $('demo-status').textContent = statusLabel[status] || 'SIMULATED';
  $('demo-status').dataset.state = status;
  $('payment-audio').replaceChildren();
  addSpeech($('payment-audio'), () =>
    (mode === 'mock' ? 'MOCK PayPal fixture. No authenticated API response. ' : 'Synthetic request. ') +
    'Amount: ' + exactAmount(s) + '. Merchant unverified: ' + s.merchant_name +
    '. Reference: ' + s.merchant_id + '. ' + s.description +
    '. Expected quantity ' + selected.expected + '; recorded quantity ' + quantity +
    '. Unit amount ' + formatMoney(selected.unitMinor, selected.currency) + '. Simulated consent: ' + status + '. No payment was made.',
    'payment details', notify);
  for (const selected of ['synthetic', 'mock']) $(selected).setAttribute('aria-pressed', String(mode === selected));
  $('approve').disabled = status !== 'pending';
  $('consume').disabled = status !== 'approved';
  $('decline').disabled = status !== 'pending';
  $('revise').disabled = !['pending', 'approved'].includes(status);
  $('explanation').textContent = '';
  $('ai-explanation').textContent = '';
  if (document.activeElement?.disabled) $('review-heading').focus();
}
function reset() { status = 'pending'; revision = 1; quantity = currentCase().originalQuantity; paint(); notify('Simulation restarted. No real state or payment was changed.'); }
for (const selected of ['synthetic', 'mock']) $(selected).addEventListener('click', () => {
  if (mode === selected) { notify('This evidence type is already selected. Use Start again to restart.'); return; }
  mode = selected; reset();
});
$('reset').addEventListener('click', reset);
$('approve').addEventListener('click', () => { if (status !== 'pending') return; status = 'approved'; paint(); notify('SIMULATED consent approval only. No passkey or payment operation occurred.'); });
$('consume').addEventListener('click', () => { if (status !== 'approved') return; status = 'consumed'; paint(); notify('SIMULATED consent consumed once. No payment occurred.'); });
$('decline').addEventListener('click', () => { if (status !== 'pending') return; status = 'rejected'; paint(); notify('SIMULATED refusal recorded. Nothing was approved or paid.'); });
function reviseSelected() {
  if (!['pending', 'approved'].includes(status)) return;
  revision++; quantity = quantity === '2' ? '1' : '2'; status = 'pending'; paint();
  notify('Fixture revised. Simulated prior consent invalidated; review again.');
}
$('revise').addEventListener('click', reviseSelected);
$('helper-revise').addEventListener('click', reviseSelected);
$('buyer-view').addEventListener('click', () => updateRole('buyer'));
$('helper-view').addEventListener('click', () => updateRole('helper'));
$('demo-create').addEventListener('submit', event => {
  event.preventDefault();
  const merchant = $('demo-merchant').value.trim();
  const amount = $('demo-amount').value.trim();
  const description = $('demo-description').value.trim();
  const feedback = $('demo-create-result');
  if (!/^[a-zA-Z0-9 .'’-]{3,60}$/.test(merchant) || !/^[0-9]{1,4}\.[0-9]{2}$/.test(amount) || description.length < 3 || description.length > 80) {
    feedback.textContent = 'Enter a merchant (3–60 characters), a positive dollar amount such as 18.50, and an item (3–80 characters).';
    return;
  }
  const cents = Number(amount.replace('.', ''));
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > 999999) {
    feedback.textContent = 'Enter an amount between 0.01 and 9,999.99 USD.'; return;
  }
  saveCurrent();
  const id = 'SYN-' + String(1001 + demoCases.length);
  demoCases.push({ id, merchant, merchantId: 'SYNTH-USER-' + demoCases.length, itemName: description,
    quantity: '1', originalQuantity: '1', expected: '1', unitMinor: cents, currency: 'USD',
    status: 'pending', revision: 1, buyer: 'Buyer A', description: 'New fictional request. No real money.' });
  activeCase = demoCases.length - 1;
  ({ status, revision, quantity } = currentCase());
  paint(); feedback.textContent = 'Created ' + id + ' in this browser only. Switch to Buyer view to review it.';
  notify('New fictional request prepared. No real account, payment or database was touched.');
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
window.addEventListener('pagehide', stop); updateRole('buyer'); paint();
