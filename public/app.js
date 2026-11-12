import { matchesConsumedState, validateReviewedEvidence } from './consumption.js';
import { stopAudio } from './presentation.js';
import { renderRequests } from './review.js';
const $ = id => document.getElementById(id);
let session;
let trialAccessDetails = null;
let trialRevealed = false;
function setTrialVisibility(reveal) {
  trialRevealed = reveal;
  $('trial-password').textContent = reveal && trialAccessDetails ? trialAccessDetails.password : '••••••••';
  $('trial-invitation').textContent = reveal && trialAccessDetails?.invitation ? trialAccessDetails.invitation : '••••••••';
  $('trial-reveal').textContent = reveal ? 'Hide access details' : 'Show access details';
  $('trial-reveal').setAttribute('aria-pressed', String(reveal));
  $('trial-password').setAttribute('aria-label', reveal ? 'Visible password' : 'Password hidden until revealed');
}
function showTrialDetails(data, helperRole) {
  trialAccessDetails = data;
  $('trial-access').hidden = false;
  $('trial-username').textContent = data.username;
  $('trial-invite-label').hidden = !helperRole;
  $('trial-invitation').hidden = !helperRole;
  $('trial-share').hidden = !helperRole;
  setTrialVisibility(false);
  $('trial-access-instructions').textContent = helperRole
    ? 'Share the Buyer invite link with another person or open it in a separate browser. Only the Buyer can approve their own request.'
    : 'Review the sample request below. You can decline, or set up your own passkey before approving.';
  $('trial-access-heading').focus();
}

const explanations = {
  DETAILS_CHANGED_REVIEW_AGAIN: 'Details changed. Refresh and review the whole request again.',
  CHALLENGE_EXPIRED_OR_USED: 'This passkey challenge expired or was already used. Refresh and try again.',
  ENROLL_BUYER_PASSKEY_FIRST: 'Register your own buyer passkey before approving.',
  REQUEST_NOT_PENDING: 'This request is no longer pending. Refresh to see its current status.',
  INVALID_DECIMAL_AMOUNT: 'Enter an exact positive amount using digits and a decimal point. Use whole numbers for JPY; at most two decimal places for USD, EUR or NGN.',
  LOGIN_FAILED: 'Those login details did not match. Check the username and password you saved when you started your test.',
  SESSION_EXPIRED: 'Your session expired. Sign in again.',
  PASSKEY_AUTHENTICATION_FAILED: 'Passkey verification failed. No approval was recorded.',
  PASSKEY_REGISTRATION_FAILED: 'Passkey registration failed. No credential was enrolled.',
  PAYPAL_ORDER_NOT_CONFIGURED: 'PayPal reads are disabled or this order is not operator-allowlisted. Ask the operator; no payment was made.',
  ORDER_DETAILS_CHANGED: 'PayPal details changed. Prior consent is invalid. Ask the helper to re-read and review a new revision.',
  ORDER_EVIDENCE_STALE: 'PayPal evidence is stale. Re-read the order and review again.',
  REVISION_CHANGED: 'The request changed. Refresh to see the latest details.',
  INVITATION_INVALID_OR_EXPIRED: 'This invitation has expired or already been used. Ask the Helper for a new invitation.',
  INVITATION_ALREADY_CLAIMED: 'This invitation has already been used. Ask the Helper for a new one.',
  INVITATION_INVALID: 'That invitation is not valid. Check the link and try again.',
  TRIAL_RATE_LIMIT: 'You have started several tests recently. Sign in to your existing test or try again later.',
  TRIAL_CAPACITY_REACHED: 'The public test is currently full. You can still use the guided demo.',
  PASSKEY_AUTHENTICATION_FAILED: 'The device did not verify this approval. Nothing was approved. Try again or decline.',
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
  $('identity').textContent = user.id.startsWith('trial-')
    ? (user.role === 'helper' ? 'Signed in as Helper · Your private test workspace' : 'Signed in as Buyer · Review your sample request')
    : `Signed in as ${user.id}. Role: ${user.role}.`;
  if (user.role === 'helper') {
    const buyers = await api('/api/buyers', undefined, 'GET');
    $('buyer').replaceChildren(...buyers.map(b => new Option(b.id.startsWith('trial-') ? 'Your invited Buyer' : b.id, b.id)));
    $('paypal-buyer').replaceChildren(...buyers.map(b => new Option(b.id.startsWith('trial-') ? 'Your invited Buyer' : b.id, b.id)));
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
  $('save-request').textContent = 'Send test request';
}
function edit(item) {
  const s = item.snapshot, form = $('request-form');
  for (const key of ['request_id', 'revision', 'buyer_id', 'merchant_id', 'merchant_name', 'currency', 'description']) {
    form.elements[key].value = s[key];
  }
  form.elements.amount.value = item.display_amount.split(' ')[0];
  form.elements.lifetime_minutes.value = 10;
  $('buyer').disabled = true; $('cancel-edit').hidden = false;
  $('save-request').textContent = 'Save changes and ask Buyer to review again';
  $('merchant-id').focus();
}
$('login').addEventListener('submit', event => {
  event.preventDefault();
  perform(event.submitter, async () => {
    const values = Object.fromEntries(new FormData(event.target));
    await api('/api/login', values); event.target.reset();
    await load();
    if (location.pathname === '/app/login') history.replaceState(null, '', '/app');
    $('account-heading').focus(); notify('Welcome back to your workspace.', false);
  });
});
$('logout').addEventListener('click', event => perform(event.target, async () => {
  await api('/api/logout', {}); resetForm(); trialAccessDetails = null;
  setTrialVisibility(false);
  $('trial-access').hidden = true;
  $('trial-password').textContent = '';
  $('trial-invitation').textContent = '';
  await load();
  if (location.pathname === '/app/login') history.replaceState(null, '', '/app');
  $('returning-login').hidden = true;
  $('returning-login').open = false;
  document.querySelector('.trial-access-options').hidden = false;
  document.querySelector('.workspace-step-guide').hidden = false;
  document.querySelector('.workspace-demo-link').hidden = false;
  document.getElementById('login-heading').textContent = 'Try the real workspace';
  document.querySelector('.workspace-welcome > p:not(.app-kicker)').textContent =
    'See how one person prepares a request and another makes the decision. Your first test is ready in one click.';
  $('trial-start').focus();
  notify('Signed out. You can start a fresh sample test or return later using your saved access details.', false);
}));
$('trial-start').addEventListener('click', event => perform(event.target, async () => {
  const created = await api('/api/trial/create', {});
  await load(); showTrialDetails(created, true);
  notify('Your workspace is ready! Save your login, then copy the Buyer invitation link.');
}));
$('trial-claim-form').addEventListener('submit', event => {
  event.preventDefault();
  perform(event.submitter, async () => {
    const invitation = $('trial-code').value.trim();
    const created = await api('/api/trial/claim', { invitation });
    $('trial-code').value = '';
    await load(); showTrialDetails(created, false);
    notify('Welcome! Review your sample request. To approve, first set up your passkey. You can also decline.');
  });
});
$('trial-copy').addEventListener('click', event => perform(event.target, async () => {
  if (!trialAccessDetails) throw new Error('Your one-time login is no longer available.');
  await navigator.clipboard.writeText('SaySure test login\nReturn later: ' + location.origin + '/app/login' +
    '\nUsername: ' + trialAccessDetails.username + '\nPassword: ' + trialAccessDetails.password);
  notify('Your login was copied. Save it somewhere private. Never share your password.');
}));
$('trial-share').addEventListener('click', event => perform(event.target, async () => {
  if (!trialAccessDetails?.invitation) throw new Error('No Buyer invitation available.');
  const link = new URL('/app', location.origin);
  link.hash = 'invite=' + trialAccessDetails.invitation;
  await navigator.clipboard.writeText(link.toString());
  notify('Buyer invite link copied. Share the link only with your Buyer, not your login details.');
}));
$('trial-reveal').addEventListener('click', () => setTrialVisibility(!trialRevealed));
$('register').addEventListener('click', event => perform(event.target, async () => {
  if (!window.PublicKeyCredential || !window.isSecureContext || !window.SimpleWebAuthnBrowser)
    throw new Error('Passkeys are unavailable in this browser. Try Chrome on a passkey-enabled device or use a security key. You can still decline.');
  const options = await api('/api/register/options', {});
  const response = await window.SimpleWebAuthnBrowser.startRegistration({ optionsJSON: options.options });
  await api('/api/register/verify', { challengeId: options.challengeId, response });
  await load(); notify('Your passkey is ready! Review the request, tick the confirmation box and then approve. No money moves.');
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
    resetForm(); await refresh(); notify(id
      ? 'Changes saved. The Buyer must review these details again.'
      : 'Request sent to your Buyer. Ask them to open their workspace and refresh.');
  });
});
$('cancel-edit').addEventListener('click', () => { resetForm(); $('merchant-id').focus(); });
$('refresh').addEventListener('click', event => perform(event.target, async () => {
  await refresh(); notify('Requests updated. Check the latest details before deciding.');
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

function handleBuyerInviteLink() {
  const match = /^#invite=([A-Za-z0-9_-]{43})$/.exec(location.hash);
  if (!match) return;
  $('trial-code').value = match[1];
  history.replaceState(null, '', location.pathname + location.search);
  if (!$('login-panel').hidden) {
    $('trial-code').focus();
    notify('Buyer invitation loaded. Select Join as Buyer to open your request.');
  }
}
window.addEventListener('hashchange', handleBuyerInviteLink);
handleBuyerInviteLink();

// Keep the public workspace entry completely free of a login form.
 // Existing private test accounts can resume at /app/login without needing signup.
if (location.pathname === '/app/login') {
  $('returning-login').hidden = false;
  $('returning-login').open = true;
  document.querySelector('.trial-access-options').hidden = true;
  document.querySelector('.workspace-step-guide').hidden = true;
  document.querySelector('.workspace-demo-link').hidden = true;
  document.getElementById('login-heading').textContent = 'Return to your test workspace';
  document.querySelector('.workspace-welcome > p:not(.app-kicker)').textContent =
    'Enter the username and password you saved when you started your test.';
}
if (location.hash === '#signin') {
  history.replaceState(null, '', '/app/login');
  location.assign('/app/login');
}
