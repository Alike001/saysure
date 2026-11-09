// One new, separately approved attended session. Old grants and records are untouched.
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { binding, prepareOnce, executeOnce, APPROVAL, sha256 } from './paypal-once.mjs';
import { prepareReadPlan, consentReadIntegration, privateJson, readJson, READ_APPROVAL } from './paypal-read-plan.mjs';
import { ensure } from './core.mjs';
export const ATTENDED_APPROVAL = 'I authorize one attended SaySure sandbox attempt: one OAuth, one new 1.00 USD CAPTURE order, at most five GETs, real buyer passkey consent and one local consumption; no payment execution, retries or replacement order.';
export const CUTOFF_MS = 15 * 60000;
export async function prepareAttended(directory, config, historicalDirectory) {
  const old = readJson(`${historicalDirectory}/attempt.json`);
  const marker = readJson(`${historicalDirectory}/execution-started.json`);
  const result = readJson(`${historicalDirectory}/result.json`);
  const { review_digest, ...reviewed } = old;
  ensure(review_digest === sha256(JSON.stringify(reviewed)) && marker.review_digest === review_digest &&
    result.review_digest === review_digest && result.provenance === 'authenticated-sandbox-api' && result.validated,
  'ATTENDED_HISTORY_INVALID');
  const fixed = binding(config, old.app_fingerprint);
  const attempt = await prepareOnce(directory, config, old.app_fingerprint);
  ensure(attempt.request_id !== old.request_id, 'ATTENDED_KEY_REUSED');
  const plan = { version: 1, attempt_digest: attempt.review_digest, app_fingerprint: fixed.app_fingerprint,
    merchant_id: fixed.merchant_id, payload_sha256: fixed.payload_sha256, buyer_id: 'buyer-a',
    max_oauth: 1, max_creates: 1, max_gets: 5, cutoff_ms: CUTOFF_MS,
    excluded_order_id: result.order_id };
  plan.digest = sha256(JSON.stringify(plan));
  try { privateJson(`${directory}/attended-plan.json`, plan); } catch (e) { if (e.code !== 'EEXIST') throw e; }
  ensure(readJson(`${directory}/attended-plan.json`).digest === plan.digest, 'ATTENDED_PLAN_CHANGED');
  return { attempt, plan };
}
export function loadAttended(directory, config) {
  const plan = readJson(`${directory}/attended-plan.json`);
  const { digest, ...data } = plan;
  ensure(digest === sha256(JSON.stringify(data)) && plan.version === 1 && plan.cutoff_ms === CUTOFF_MS &&
    plan.max_gets === 5 && plan.max_oauth === 1 && plan.max_creates === 1 && plan.buyer_id === 'buyer-a',
  'ATTENDED_PLAN_INVALID');
  const fixed = binding(config, plan.app_fingerprint);
  const attempt = readJson(`${directory}/attempt.json`);
  ensure(plan.attempt_digest === attempt.review_digest && fixed.payload_sha256 === plan.payload_sha256 &&
    fixed.merchant_id === plan.merchant_id, 'ATTENDED_BINDING_CHANGED');
  return plan;
}
export async function executeAttended({ directory, config, attended = false, transport = fetch, now = Date.now }) {
  ensure(attended === true, 'ATTENDED_OPERATOR_REQUIRED', 403);
  const plan = loadAttended(directory, config);
  let approval, info;
  try { info = statSync(`${directory}/operator-approval.json`); approval = readJson(`${directory}/operator-approval.json`); }
  catch { ensure(false, 'ATTENDED_SEPARATE_APPROVAL_REQUIRED', 403); }
  ensure(info.isFile() && !(info.mode & 0o077) && info.uid === process.getuid() &&
    approval.statement === ATTENDED_APPROVAL && approval.plan_digest === plan.digest, 'ATTENDED_SEPARATE_APPROVAL_REQUIRED', 403);
  ensure(!existsSync(`${directory}/execution-started.json`) && !existsSync(`${directory}/result.json`), 'ATTENDED_ALREADY_USED');
  const started = now(), deadline = started + plan.cutoff_ms;
  privateJson(`${directory}/attended-started.json`, { plan_digest: plan.digest, started_at: started, deadline });
  const current = (request) => {
    ensure(now() < deadline, 'ATTENDED_OPERATIONAL_CUTOFF');
    ensure(!request || request.path !== `/v2/checkout/orders/${plan.excluded_order_id}`, 'ATTENDED_OLD_ORDER_FORBIDDEN');
  };
  let initialToken;
  const result = await executeOnce({ directory, config, expectedFingerprint: plan.app_fingerprint,
    approval: { statement: APPROVAL, review_digest: plan.attempt_digest }, transport, beforeRequest: current,
    onAuthenticated: token => {
      ensure(Number.isFinite(token.expires_in) && token.expires_in > 60, 'ATTENDED_TOKEN_INVALID');
      initialToken = { access_token: token.access_token, token_type: token.token_type,
        expires_at: now() + (token.expires_in - 60) * 1000 };
    } });
  ensure(result.validated === true, 'ATTENDED_CREATE_READ_FAILED'); current();
  ensure(result.order_id !== plan.excluded_order_id && result.provider_fields.status === 'CREATED', 'ATTENDED_NEW_ORDER_INVALID');
  const readDirectory = `${directory}/consent-read`;
  mkdirSync(readDirectory, { mode: 0o700 });
  const readPlan = prepareReadPlan(readDirectory, directory, { operationalDeadline: deadline, allowMock: transport !== fetch });
  // Child grant is derived only from this explicit parent approval, never a prior read grant.
  privateJson(`${readDirectory}/operator-approval.json`, { statement: READ_APPROVAL, plan_digest: readPlan.digest,
    parent_plan_digest: plan.digest });
  // The single OAuth already happened in this same process. No refresh is allowed.
  privateJson(`${readDirectory}/oauth-1.json`, { ...result.operations[0], shared_from_parent: true,
    parent_plan_digest: plan.digest, provenance: result.provenance });
  const integration = consentReadIntegration(config, readDirectory, { transport, initialToken });
  return { integration, result, deadline };
}
