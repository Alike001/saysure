import { stopAudio } from './presentation.js';
import { renderRequests } from './review.js';
const $ = id => document.getElementById(id);
let session;
const explanations = {
  DETAILS_CHANGED_REVIEW_AGAIN: 'Details changed. Refresh and review the whole request again.',
  CHALLENGE_EXPIRED_OR_USED: 'This passkey challenge expired or was already used. Refresh and try again.',
  ENROLL_BUYER_PASSKEY_FIRST: 'Register your own buyer passkey before approving.',
  REQUEST_NOT_PENDING: 'This request is no longer pending. Refresh to see its current status.',
  LOGIN_FAILED: 'Sign-in failed. Check your own username and account secret.',
  SESSION_EXPIRED: 'Your session expired. Sign in again.',
  PASSKEY_AUTHENTICATION_FAILED: 'Passkey verification failed. No approval was recorded.',
  PASSKEY_REGISTRATION_FAILED: 'Passkey registration failed. No credential was enrolled.',
  REVISION_CHANGED: 'The request was revised. Refresh before editing again.',
};
export function notify(text, focus = true) {
  $('message').textContent = text;
  if (focus) $('message').focus();
}
export async function api(path, body, method = 'POST') {
  const response = await fetch(path, { method, credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': session?.csrf ?? '' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json();
  if (!response.ok) throw new Error(explanations[data.error] ??
    `The action was refused (${data.error}). Refresh and check the request. No payment was made.`);
  return data;
}
export async function perform(button, fn) {
  button.disabled = true;
  try { await fn(); }
  catch (error) {
    notify(error.name === 'NotAllowedError' || error.name === 'WebAuthnError'
      ? 'Your authenticator did not complete the request. Nothing was approved. You may try again or reject.'
      : error.message);
  } finally { button.disabled = false; }
}
async function load() {
  stopAudio();
  session = await api('/api/session', undefined, 'GET');
  const user = session.user;
  $('login-panel').hidden = !!user;
  $('account').hidden = !user;
  $('helper').hidden = user?.role !== 'helper';
  $('inbox').hidden = !user;
  $('enrollment').hidden = user?.role !== 'buyer' || session.enrolled;
  $('enrolled').hidden = user?.role !== 'buyer' || !session.enrolled;
  if (!user) { $('requests').replaceChildren(); return; }
  $('identity').textContent = `Signed in as ${user.id}. Server-assigned role: ${user.role}.`;
  if (user.role === 'helper') {
    const buyers = await api('/api/buyers', undefined, 'GET');
    $('buyer').replaceChildren(...buyers.map(b => new Option(b.id, b.id)));
  }
  await refresh();
}
export async function refresh() {
  const items = await api('/api/requests', undefined, 'GET');
  renderRequests(items, session, { api, perform, notify, refresh, edit });
}
function resetForm() {
  $('request-form').reset();
  $('request-form').elements.request_id.value = '';
  $('request-form').elements.revision.value = '';
  $('buyer').disabled = false; $('cancel-edit').hidden = true;
  $('save-request').textContent = 'Create synthetic request';
}
function edit(item) {
  const s = item.snapshot, form = $('request-form');
  for (const key of ['request_id', 'revision', 'buyer_id', 'merchant_id', 'merchant_name', 'currency', 'description']) {
    form.elements[key].value = s[key];
  }
  form.elements.amount.value = item.display_amount.split(' ')[0];
  form.elements.lifetime_minutes.value = 10;
  $('buyer').disabled = true; $('cancel-edit').hidden = false;
  $('save-request').textContent = 'Save revision and invalidate consent';
  $('merchant-id').focus();
}
$('login').addEventListener('submit', event => {
  event.preventDefault();
  perform(event.submitter, async () => {
    const values = Object.fromEntries(new FormData(event.target));
    await api('/api/login', values); event.target.reset();
    await load(); $('account-heading').focus(); notify('Signed in to your own account.', false);
  });
});
$('logout').addEventListener('click', event => perform(event.target, async () => {
  await api('/api/logout', {}); resetForm(); await load(); $('username').focus(); notify('Signed out.', false);
}));
$('register').addEventListener('click', event => perform(event.target, async () => {
  if (!window.PublicKeyCredential || !window.isSecureContext) throw new Error('A secure context and WebAuthn-capable browser are required.');
  const options = await api('/api/register/options', {});
  const response = await window.SimpleWebAuthnBrowser.startRegistration({ optionsJSON: options.options });
  await api('/api/register/verify', { challengeId: options.challengeId, response });
  await load(); notify('Your passkey was registered to this buyer account. No payment was approved.');
}));
$('request-form').addEventListener('submit', event => {
  event.preventDefault();
  perform(event.submitter, async () => {
    const form = event.target;
    const values = Object.fromEntries(new FormData(form));
    values.buyer_id = form.elements.buyer_id.value;
    const id = values.request_id; delete values.request_id;
    values.lifetime_minutes = Number(values.lifetime_minutes);
    if (id) values.revision = Number(values.revision); else delete values.revision;
    await api(id ? `/api/requests/${id}` : '/api/requests', values, id ? 'PATCH' : 'POST');
    resetForm(); await refresh(); notify(id ? 'Revision saved. Prior challenges and consent were invalidated.' : 'Synthetic request created. The buyer must review it independently.');
  });
});
$('cancel-edit').addEventListener('click', () => { resetForm(); $('merchant-id').focus(); });
$('refresh').addEventListener('click', event => perform(event.target, async () => {
  await refresh(); notify('Requests refreshed. Review any changed details before approving.');
}));
load().catch(error => notify(error.message));
