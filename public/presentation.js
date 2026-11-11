// Presentation uses the exact server snapshot, never AI-generated payment fields.
import { reviewedEvidence } from './evidence-provenance.js';
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
    const evidence = reviewedEvidence(item, now);
    const current = evidence.current;
    return `${evidence.provenance === 'mock-paypal-fixture' ? 'MOCK PayPal fixture. No real API verification.' : evidence.provenance === 'authenticated-sandbox-api' ? 'Recorded authenticated PayPal sandbox observation.' : 'PayPal evidence provenance unavailable.'} ` +
      `Recorded amount: ${exactAmount(s)}. Payee reference: ${s.provider.payee_id}. Shop identity unverified. ` +
      `Order: ${s.provider.order_id}. Recorded provider status: ${s.provider.status}. Local consent: ${state}. ` +
      `Revision: ${s.revision}. Expires: ${new Date(s.expires_at).toLocaleString()}. ` +
      s.provider.units.map(u => `Purchase unit ${u.index}: ${exactAmount(u)}. `).join('') +
      `${!current ? 'Evidence historical, unavailable or stale. Do not approve from this review.' : evidence.provenance === 'mock-paypal-fixture' ? 'Mock data only; no real API verification.' : 'API evidence was recently read. The server must recheck before consent.'} ` +
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
  return addSpeech(parent, () => paymentSummary(item), 'payment details', notify);
}
// One playback owner keeps payment and explanation controls in sync.
export function addSpeech(parent, text, name, notify = () => {}, ids = {}) {
  const group = document.createElement('div'); group.className = 'audio-controls';
  group.setAttribute('role', 'group'); group.setAttribute('aria-label', `${name === 'payment details' ? 'Payment' : 'Explanation'} audio`);
  const synth = window.speechSynthesis;
  const status = document.createElement('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  function button(label, handler, id) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
    if (id) b.id = id;
    b.addEventListener('click', handler); group.append(b); return b;
  }
  const reset = message => {
    if ([pause, stop].includes(document.activeElement)) read.focus();
    pause.disabled = stop.disabled = true; pause.textContent = pauseLabel; status.textContent = message;
  };
  const explanation = name !== 'payment details';
  const pauseLabel = explanation ? 'Pause explanation audio' : 'Pause audio';
  const resumeLabel = explanation ? 'Resume explanation audio' : 'Resume audio';
  const read = button(explanation ? 'Read explanation aloud' : 'Read payment details aloud', () => {
    stopAudio();
    try {
      const utterance = new window.SpeechSynthesisUtterance(text());
      utterance.lang = 'en'; utterance.rate = 0.9;
      const finish = message => {
        if (active?.utterance !== utterance) return;
        active = null; reset(message);
      };
      utterance.onend = () => finish('Finished reading. Nothing was approved.');
      utterance.onerror = () => finish('Audio unavailable. Read the visible text or use your screen reader.');
      active = { synth, utterance, reset: ownerReset };
      pause.disabled = stop.disabled = false; pause.textContent = pauseLabel;
      status.textContent = `Reading ${name}. Nothing is being approved.`;
      if (synth.paused) synth.resume();
      synth.speak(utterance);
    } catch (error) { stopAudio(); reset('Audio unavailable. Read the visible text.'); notify(error.message); }
  }, ids.read);
  const pause = button(pauseLabel, () => {
    if (!active || active.reset !== ownerReset) return;
    if (pause.textContent === pauseLabel) { synth.pause(); pause.textContent = resumeLabel; status.textContent = 'Audio paused.'; }
    else { synth.resume(); pause.textContent = pauseLabel; status.textContent = 'Reading resumed.'; }
  }, ids.pause);
  // Ownership is checked by group state; a new reader resets this group's controls.
  const ownerReset = () => reset('Audio stopped. Nothing was approved.');
  const stop = button(explanation ? 'Stop explanation audio' : 'Stop audio', () => { stopAudio(); }, ids.stop);
  pause.disabled = stop.disabled = true;
  if (!synth || !window.SpeechSynthesisUtterance) {
    read.disabled = true; status.textContent = 'Speech is unavailable in this browser. All details remain readable.';
  }
  group.append(status); parent.append(group);
}
if (typeof window !== 'undefined') window.addEventListener('pagehide', stopAudio);
