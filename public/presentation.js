// Presentation uses the exact server snapshot, never AI-generated payment fields.
export function exactAmount(s) {
  const exponent = { USD: 2, EUR: 2, NGN: 2, JPY: 0 }[s.currency];
  if (exponent === undefined || !/^\d+$/.test(s.amount_minor)) throw new Error('Unavailable amount evidence.');
  const digits = s.amount_minor.padStart(exponent + 1, '0');
  return `${exponent ? `${digits.slice(0, -exponent)}.${digits.slice(-exponent)}` : digits} ${s.currency}`;
}
export function paymentSummary(item, now = Date.now()) {
  const s = item.snapshot;
  const state = s.expires_at <= now && ['pending', 'approved'].includes(item.status) ? 'expired' : item.status;
  if (s.kind === 'paypal' && item.paypal_evidence) {
    const evidence = item.paypal_evidence;
    const current = evidence.current && now - evidence.observed_at < 60000 && evidence.observed_at <= now;
    return `${evidence.provenance === 'mock-paypal-fixture' ? 'MOCK PayPal fixture. No real API verification.' : 'PayPal sandbox order.'} ` +
      `Recorded amount: ${exactAmount(s)}. Payee reference: ${s.provider.payee_id}. Shop identity unverified. ` +
      `Order: ${s.provider.order_id}. Recorded provider status: ${s.provider.status}. Local consent: ${state}. ` +
      `Revision: ${s.revision}. Expires: ${new Date(s.expires_at).toLocaleString()}. ` +
      s.provider.units.map(u => `Purchase unit ${u.index}: ${exactAmount(u)}. `).join('') +
      `${evidence.provenance === 'mock-paypal-fixture' ? 'Mock data only; no real API verification.' : current ? 'API evidence was recently read. The server must recheck before consent.' : 'Evidence unavailable or stale. Do not approve from this review.'} ` +
      'SaySure consent is separate from PayPal buyer approval. No payment is made by this app.';
  }
  if (item.synthetic !== true) throw new Error('Payment evidence is unavailable. Do not approve.');
  return `Synthetic request. No real money. Amount: ${exactAmount(s)}. ` +
    `Helper-supplied merchant name, unverified: ${s.merchant_name}. Merchant ID, unverified: ${s.merchant_id}. ` +
    `Helper-supplied description: ${s.description}. Status: ${state}. ` +
    `Revision: ${s.revision}. Expires: ${new Date(s.expires_at).toLocaleString()}. ` +
    (state === 'pending' ? 'Review these exact details before choosing. Listening does not approve anything.' :
      'This request cannot receive a new approval. No PayPal payment was made by this app.');
}
let active = null;
export function stopAudio() {
  if (active) { active.utterance.onend = null; active.utterance.onerror = null; active.synth.cancel(); active.reset(); active = null; }
}
export function addAudio(parent, item, notify) {
  const group = document.createElement('div'); group.className = 'audio-controls';
  group.setAttribute('role', 'group'); group.setAttribute('aria-label', 'Payment audio');
  const synth = window.speechSynthesis;
  const status = document.createElement('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  function button(text, handler) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = text;
    b.addEventListener('click', handler); group.append(b); return b;
  }
  const read = button('Read payment details aloud', () => {
    stopAudio();
    try {
      const utterance = new window.SpeechSynthesisUtterance(paymentSummary(item));
      utterance.lang = 'en'; utterance.rate = 0.9;
      utterance.onend = () => { active = null; pause.disabled = stop.disabled = true; status.textContent = 'Finished reading. Nothing was approved.'; };
      utterance.onerror = () => { active = null; pause.disabled = stop.disabled = true; status.textContent = 'Audio unavailable. Read the visible details or use your screen reader.'; };
      active = { synth, utterance, reset: () => { pause.disabled = stop.disabled = true; status.textContent = 'Audio stopped.'; } }; pause.disabled = stop.disabled = false; pause.textContent = 'Pause audio';
      status.textContent = 'Reading payment details. Nothing is being approved.'; synth.speak(utterance);
    } catch (error) { notify(error.message); }
  });
  const pause = button('Pause audio', () => {
    if (!active) return;
    if (pause.textContent === 'Pause audio') { synth.pause(); pause.textContent = 'Resume audio'; status.textContent = 'Audio paused.'; }
    else { synth.resume(); pause.textContent = 'Pause audio'; status.textContent = 'Reading resumed.'; }
  });
  const stop = button('Stop audio', () => {
    stopAudio(); pause.disabled = stop.disabled = true; status.textContent = 'Audio stopped. Nothing was approved.';
  });
  pause.disabled = stop.disabled = true;
  if (!synth || !window.SpeechSynthesisUtterance) {
    read.disabled = true; status.textContent = 'Speech is unavailable in this browser. All details are readable below.';
  }
  group.append(status); parent.append(group);
}
if (typeof window !== 'undefined') window.addEventListener('pagehide', stopAudio);
