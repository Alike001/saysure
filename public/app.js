import { matchesConsumedState, validateReviewedEvidence } from './consumption.js';
import { stopAudio } from './presentation.js';
import { renderRequests } from './review.js';
const $ = id => document.getElementById(id);
let session;
const explanations = {
  DETAILS_CHANGED_REVIEW_AGAIN: 'Details changed. Refresh and review the whole request again.',
  CHALLENGE_EXPIRED_OR_USED: 'This passkey challenge expired or was already used. Refresh and try again.',
  ENROLL_BUYER_PASSKEY_FIRST: 'Register your own buyer passkey before approving.',
  REQUEST_NOT_PENDING: 'This request is no longer pending. Refresh to see its current status.',
  INVALID_DECIMAL_AMOUNT: 'Enter an exact positive amount using digits and a decimal point. Use whole numbers for JPY; at most two decimal places for USD, EUR or NGN.',
  LOGIN_FAILED: 'Sign-in failed. Check your own username and account secret.',
  SESSION_EXPIRED: 'Your session expired. Sign in again.',
  PASSKEY_AUTHENTICATION_FAILED: 'Passkey verification failed. No approval was recorded.',
  PASSKEY_REGISTRATION_FAILED: 'Passkey registration failed. No credential was enrolled.',
  PAYPAL_ORDER_NOT_CONFIGURED: 'PayPal reads are disabled or this order is not operator-allowlisted. Ask the operator; no payment was made.',
  ORDER_DETAILS_CHANGED: 'PayPal details changed. Prior consent is invalid. Ask the helper to re-read and review a new revision.',
  ORDER_EVIDENCE_STALE: 'PayPal evidence is stale. Re-read the order and review again.',
  REVISION_CHANGED: 'The request was revised. Refresh before editing again.',
};
export function notify(text, focus = false) {
  $('message').textContent = text;
  if (focus) $('message').focus();
}
export async function api(path, body, method = 'POST') {
  const response = await fetch(path, { method, credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': session?.csrf ?? '' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json();
  if (!response.ok) {
    const correlation = response.headers.get('X-Consumption-Correlation-Id');
    const reference = /^[a-f0-9-]{36}$/.test(correlation ?? '') ? ` Reference: ${correlation}.` : '';
    const error = new Error((explanations[data.error] ??
      `The action was refused (${data.error}). Refresh and check the request. No payment was made.`) + reference);
    error.code = data.error; throw error;
  }
  return data;
}
export async function perform(button, fn) {
  const article = button.closest('article');
  button.disabled = true; button.dataset.busy = 'true';
  for (const id of ['amount', 'username', 'password']) $(id).removeAttribute('aria-invalid');
  $('amount-error').textContent = $('login-error').textContent = '';
  for (const error of document.querySelectorAll('[data-field-error]')) error.textContent = '';
  for (const field of document.querySelectorAll('[aria-invalid]')) field.removeAttribute('aria-invalid');
  try { await fn(); }
  catch (error) {
    if (['INVALID_DECIMAL_AMOUNT', 'INVALID_AMOUNT', 'AMOUNT_OUT_OF_RANGE'].includes(error.code)) {
      $('amount-error').textContent = explanations.INVALID_DECIMAL_AMOUNT;
      $('amount').setAttribute('aria-invalid', 'true'); $('amount').focus();
    } else if (error.code === 'LOGIN_FAILED') {
      $('login-error').textContent = explanations.LOGIN_FAILED;
      for (const id of ['username', 'password']) $(id).setAttribute('aria-invalid', 'true');
      $('username').focus();
    }
    const fields = {
      INVALID_MERCHANT_ID: ['merchant-id', 'Enter a merchant reference with visible characters, up to 80 characters.'],
      INVALID_MERCHANT_NAME: ['merchant-name', 'Enter a displayed merchant name with visible characters, up to 120 characters.'],
      INVALID_DESCRIPTION: ['description', 'Enter a description with visible characters, up to 500 characters.'],
      INVALID_LIFETIME: ['lifetime', 'Enter a whole number of minutes from 1 to 30.'],
      UNKNOWN_BUYER: ['buyer', 'Select an available Buyer account.'],
    };
    if (fields[error.code]) {
      const [id, text] = fields[error.code], field = $(id);
      let local = $(`${id}-error`);
      if (!local) {
        local = document.createElement('p'); local.id = `${id}-error`; local.className = 'field-error';
        local.dataset.fieldError = 'true'; local.setAttribute('role', 'alert'); field.after(local);
      }
      local.textContent = text; field.setAttribute('aria-describedby', local.id);
      field.setAttribute('aria-invalid', 'true'); field.focus();
    }
    if (article) {
      let local = article.querySelector('.action-message');
      if (!local) { local = document.createElement('p'); local.className = 'action-message'; local.setAttribute('role', 'alert'); article.querySelector('h3').after(local); }
      local.textContent = error.message;
      if (['DETAILS_CHANGED_REVIEW_AGAIN', 'REQUEST_NOT_PENDING', 'ORDER_DETAILS_CHANGED', 'ORDER_EVIDENCE_STALE'].includes(error.code)) {
        article.querySelector('.request-status').textContent = 'Review unavailable — refresh requests before deciding';
        for (const b of article.querySelectorAll('button')) if (/Approve|Consume|Decline|Withdraw/.test(b.textContent)) { b.disabled = true; b.dataset.locked = 'true'; }
        for (const c of article.querySelectorAll('input[type=checkbox]')) { c.checked = false; c.disabled = true; }
      }
    }
    notify(error.name === 'NotAllowedError' || error.name === 'WebAuthnError'
      ? 'Your authenticator did not complete the request. Nothing was approved. You may try again or reject.'
      : error.message);
  } finally {
    delete button.dataset.busy;
    if (button.dataset.locked !== 'true') button.disabled = false;
    button.dispatchEvent(new Event('action-finished'));
    if (document.activeElement === document.body) {
      if (article) document.getElementById(article.getAttribute('aria-labelledby'))?.focus();
      else if (button.isConnected && !button.disabled) button.focus();
    }
  }
}
async function load() {
  stopAudio();
  session = await api('/api/session', undefined, 'GET');
  const user = session.user;
  $('login-panel').hidden = !!user;
  $('account').hidden = !user;
  $('paypal-helper').hidden = user?.role !== 'helper';
  document.querySelector('.provider-tools').hidden = user?.role !== 'helper';
  $('buyer-settings').hidden = user?.role !== 'buyer';
  $('helper').hidden = user?.role !== 'helper';
  $('inbox').hidden = !user;
  $('enrollment').hidden = user?.role !== 'buyer' || session.enrolled;
  $('enrolled').hidden = user?.role !== 'buyer' || !session.enrolled;
  if (!user) { $('requests').replaceChildren(); return; }
  $('identity').textContent = `Signed in as ${user.id}. Role: ${user.role}.`;
  if (user.role === 'helper') {
    const buyers = await api('/api/buyers', undefined, 'GET');
    $('buyer').replaceChildren(...buyers.map(b => new Option(b.id, b.id)));
    $('paypal-buyer').replaceChildren(...buyers.map(b => new Option(b.id, b.id)));
  }
  await refresh();
}
export async function refresh({ consumption } = {}) {
  const items = await api('/api/requests', undefined, 'GET');
  await Promise.all(items.map(validateReviewedEvidence));
  if (consumption && !matchesConsumedState(items.find(i => i.snapshot.request_id === consumption.snapshot.request_id), consumption)) {
    throw new Error('The refreshed list does not match the committed consumption receipt.');
  }
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

$('paypal-import').addEventListener('submit', event => {
  event.preventDefault();
  perform(event.submitter, async () => {
    await api('/api/paypal/requests', Object.fromEntries(new FormData(event.target)));
    event.target.reset(); await refresh();
    notify('Order review prepared. Check the source label and recorded details in the request. No payment was made.');
  });
});
