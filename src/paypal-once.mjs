// Private operator capability only. Never imported by the application server.
import { createHash, randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { mkdir, open, readFile, rename } from 'node:fs/promises';
import { plannedOrder } from './paypal-create.mjs';
import { SANDBOX, sandboxClient } from './paypal-sandbox.mjs';
import { normalizeSandboxOrder, reviewable } from './paypal-order.mjs';
export const MERCHANT = '7TSZELT2DA9JJ';
export const APPROVAL = 'I authorize exactly one SaySure sandbox 1.00 USD order create and one GET; no payment execution.';
export const sha256 = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const check = (condition, code) => { if (!condition) throw new Error(code); };
async function durable(path, data, exclusive = false) {
  const target = exclusive ? path : `${path}.tmp`;
  const file = await open(target, exclusive ? 'wx' : 'w', 0o600);
  try { await file.writeFile(json(data)); await file.sync(); } finally { await file.close(); }
  if (!exclusive) await rename(target, path);
  const parent = await open(dirname(path), 'r');
  try { await parent.sync(); } finally { await parent.close(); }
}
const load = async path => JSON.parse(await readFile(path, 'utf8'));
export function binding(config, expectedFingerprint) {
  sandboxClient(config); // Local validation only; no authentication or network.
  const fingerprint = sha256(config.PAYPAL_CLIENT_ID);
  check(fingerprint === expectedFingerprint, 'APP_FINGERPRINT_MISMATCH');
  check(!config.PAYPAL_MERCHANT_ID || config.PAYPAL_MERCHANT_ID === MERCHANT, 'MERCHANT_MISMATCH');
  check(!config.PAYPAL_CURRENT_ORDER_ID && !config.PAYPAL_ALLOWED_ORDER_IDS, 'PRIOR_ORDER_CONFIGURED_STOP');
  return { host: SANDBOX, app_fingerprint: fingerprint, merchant_id: MERCHANT,
    payload: plannedOrder(MERCHANT), payload_sha256: sha256(JSON.stringify(plannedOrder(MERCHANT))) };
}
export async function prepareOnce(directory, config, expectedFingerprint) {
  const fixed = binding(config, expectedFingerprint);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = `${directory}/attempt.json`;
  const candidate = { version: 1, ...fixed, request_id: randomUUID(), prepared_at: new Date().toISOString() };
  candidate.review_digest = sha256(JSON.stringify(candidate));
  try { await durable(path, candidate, true); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  const record = await load(path);
  validate(record, fixed);
  return record;
}
function validate(record, fixed) {
  const { review_digest, ...reviewed } = record;
  check(sha256(JSON.stringify(reviewed)) === review_digest, 'ATTEMPT_CHANGED');
  for (const key of Object.keys(fixed)) check(JSON.stringify(record[key]) === JSON.stringify(fixed[key]), 'BINDING_CHANGED');
  check(/^[a-f0-9-]{36}$/.test(record.request_id), 'REQUEST_ID_INVALID');
}
export function preview(record) {
  return { authorization: 'NOT APPROVED; zero PayPal requests during preflight',
    app: 'PayTale (operator-confirmed Sandbox dashboard association)',
    app_fingerprint_prefix: record.app_fingerprint.slice(0, 12), merchant_id: record.merchant_id,
    request_id: record.request_id, review_digest: record.review_digest,
    prerequisite: 'POST https://api-m.sandbox.paypal.com/v1/oauth2/token (token memory only)',
    create: { method: 'POST', url: `${SANDBOX}/v2/checkout/orders`,
      headers: { Authorization: 'Bearer <memory-only token>', Accept: 'application/json', 'Content-Type': 'application/json',
        'PayPal-Request-Id': record.request_id, Prefer: 'return=representation' }, body: record.payload },
    read: { method: 'GET', url: `${SANDBOX}/v2/checkout/orders/{exact returned id}`,
      headers: { Authorization: 'Bearer <same memory-only token>', Accept: 'application/json' } },
    retries: 0, captures: 0, authorizations: 0, refunds: 0, buyer_automation: false };
}
// No raw messages, descriptions, links, payer data or headers are retained.
const safeCode = value => typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(value) ? value : null;
const safeDebug = value => typeof value === 'string' && /^[a-f0-9]{8,64}$/i.test(value) ? value : null;
async function responseData(response) {
  let length = 0; const chunks = [];
  for await (const chunk of response.body) {
    length += chunk.length; check(length <= 256000, 'RESPONSE_TOO_LARGE'); chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export async function executeOnce({ directory, config, expectedFingerprint, approval, transport = fetch, onAuthenticated = () => {}, beforeRequest = () => {} }) {
  const record = await load(`${directory}/attempt.json`);
  validate(record, binding(config, expectedFingerprint));
  check(approval?.statement === APPROVAL && approval?.review_digest === record.review_digest,
    'SEPARATE_OPERATOR_APPROVAL_REQUIRED');
  // Permanent exclusive marker BEFORE OAuth. Never removed, even after crash or failed authentication.
  await durable(`${directory}/execution-started.json`, { review_digest: record.review_digest,
    started_at: new Date().toISOString() }, true);
  const result = { provenance: transport === fetch ? 'authenticated-sandbox-api' : 'mock-paypal-fixture',
    review_digest: record.review_digest, request_id: record.request_id, operations: [],
    order_id: null, validated: false, payment_executed: false };
  const save = () => durable(`${directory}/result.json`, result);
  async function request(operation, path, options) {
    const event = { operation, attempted_at: new Date().toISOString(), http_status: null, debug_id: null };
    result.operations.push(event); await save(); // Write-ahead: unknown outcome is never retried.
    beforeRequest({ operation, path });
    const response = await transport(`${SANDBOX}${path}`, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
    event.http_status = response.status; event.debug_id = safeDebug(response.headers.get('paypal-debug-id'));
    await save();
    let data;
    try { data = await responseData(response); }
    catch { event.response_error = 'UNREADABLE_RESPONSE'; await save(); throw new Error('UNREADABLE_RESPONSE'); }
    event.debug_id ??= safeDebug(data.debug_id);
    if (!response.ok) {
      event.name = safeCode(data.name);
      event.issues = (Array.isArray(data.details) ? data.details : []).slice(0, 10).map(d => safeCode(d.issue)).filter(Boolean);
    }
    await save();
    check(response.ok, 'PROVIDER_REFUSED');
    return { data, status: response.status };
  }
  try {
    const { data: auth } = await request('oauth', '/v1/oauth2/token', { method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${config.PAYPAL_CLIENT_ID}:${config.PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
    check(typeof auth.access_token === 'string' && /^[\x21-\x7e]+$/.test(auth.access_token) &&
      auth.token_type?.toLowerCase() === 'bearer', 'INVALID_TOKEN');
    onAuthenticated({ access_token: auth.access_token, token_type: auth.token_type, expires_in: auth.expires_in });
    const headers = { Authorization: `Bearer ${auth.access_token}`, Accept: 'application/json' };
    const created = await request('order_create', '/v2/checkout/orders', { method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', 'PayPal-Request-Id': record.request_id,
        Prefer: 'return=representation' }, body: JSON.stringify(record.payload) });
    check(/^[A-Z0-9]{5,32}$/.test(created.data.id ?? ''), 'CREATE_ID_UNAVAILABLE');
    result.order_id = created.data.id;
    result.create_status = safeCode(created.data.status); await save();
    check([200, 201].includes(created.status), 'CREATE_OUTCOME_UNCONFIRMED');
    const started = Date.now();
    const read = await request('order_get', `/v2/checkout/orders/${result.order_id}`, { method: 'GET', headers });
    // Provider projection and local derived validation are explicitly separate.
    result.provider_fields = { id: /^[A-Z0-9]{5,32}$/.test(read.data.id ?? '') ? read.data.id : null,
      intent: safeCode(read.data.intent), status: safeCode(read.data.status),
      purchase_units: (read.data.purchase_units ?? []).slice(0, 10).map(u => ({
        merchant_id: /^[A-Z0-9]{5,32}$/.test(u.payee?.merchant_id ?? '') ? u.payee.merchant_id : null,
        amount: { value: /^\d{1,12}(?:\.\d{1,2})?$/.test(u.amount?.value ?? '') ? u.amount.value : null,
          currency_code: /^[A-Z]{3}$/.test(u.amount?.currency_code ?? '') ? u.amount.currency_code : null } })) };
    await save();
    check(read.status === 200 && read.data.purchase_units?.length === 1 &&
      read.data.purchase_units[0].amount?.value === '1.00' &&
      read.data.purchase_units[0].amount?.currency_code === 'USD', 'EXACT_AMOUNT_MISMATCH');
    const normalized = normalizeSandboxOrder(read.data, result.order_id, MERCHANT, started);
    reviewable(normalized);
    result.local_validation = { normalized, observed_at: started,
      merchant_name_verified: false, payer_ownership_verified: false, consent_granted: false };
    result.validated = true;
  } catch {
    result.failure = 'STOP_RECONCILE_HTTP_EVIDENCE_NO_RETRY';
  }
  await save(); return result;
}
