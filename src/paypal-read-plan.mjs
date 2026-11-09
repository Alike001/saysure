// Operator-only read budget. Not an order creator and never a cached-response provider.
import { readFileSync, openSync, closeSync, writeFileSync, fsyncSync, statSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { sha, ensure } from './core.mjs';
import { sandboxClient, SANDBOX } from './paypal-sandbox.mjs';
import { normalizeSandboxOrder, reviewable } from './paypal-order.mjs';
export const READ_APPROVAL = 'I authorize one sandbox OAuth and at most four GETs for the reviewed SaySure order-bound consent plan; no payment execution or new order.';
export const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
export function privateJson(path, value, exclusive = true) {
  const fd = openSync(path, exclusive ? 'wx' : 'w', 0o600);
  try { writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
  const parent = openSync(dirname(path), 'r');
  try { fsyncSync(parent); } finally { closeSync(parent); }
}
export function readPlan(directory) {
  const plan = readJson(`${directory}/plan.json`);
  const { digest, ...data } = plan;
  ensure(digest === sha(JSON.stringify(data)) && plan.version === 1 && plan.host === SANDBOX &&
    plan.max_gets === 4 && plan.max_oauth === 1 && plan.buyer_id === 'buyer-a' && /^[A-Z0-9]{5,32}$/.test(plan.order_id) &&
    plan.merchant_id === '7TSZELT2DA9JJ' && plan.amount === '1.00' && plan.currency === 'USD' &&
    plan.intent === 'CAPTURE' && plan.status === 'CREATED', 'READ_PLAN_INVALID');
  return plan;
}
export function prepareReadPlan(directory, attemptDirectory, { operationalDeadline, allowMock = false } = {}) {
  const attempt = readJson(`${attemptDirectory}/attempt.json`);
  const marker = readJson(`${attemptDirectory}/execution-started.json`);
  const result = readJson(`${attemptDirectory}/result.json`);
  const { review_digest, ...data } = attempt;
  ensure(review_digest === sha(JSON.stringify(data)) && marker.review_digest === review_digest &&
    result.review_digest === review_digest && result.validated === true &&
    (result.provenance === 'authenticated-sandbox-api' || allowMock && result.provenance === 'mock-paypal-fixture'),
  'HISTORICAL_PROVENANCE_INVALID');
  const p = result.provider_fields;
  ensure(p?.id === result.order_id && p.purchase_units?.length === 1, 'HISTORICAL_ORDER_INVALID');
  const unit = p.purchase_units[0];
  const value = { version: 1, host: SANDBOX, order_id: p.id, merchant_id: unit.merchant_id,
    amount: unit.amount.value, currency: unit.amount.currency_code, intent: p.intent, status: p.status,
    app_fingerprint: attempt.app_fingerprint, source_review_digest: review_digest,
    buyer_id: 'buyer-a', max_gets: 4, max_oauth: 1,
    stages: ['initial review', 'before challenge', 'after signature', 'before consumption'],
    ...(operationalDeadline ? { operational_deadline: operationalDeadline } : {}) };
  value.digest = sha(JSON.stringify(value));
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  try { privateJson(`${directory}/plan.json`, value); } catch (e) { if (e.code !== 'EEXIST') throw e; }
  const existing = readPlan(directory);
  ensure(existing.digest === value.digest, 'PRIOR_READ_PLAN_CHANGED');
  return existing;
}
export function consentReadIntegration(config, directory, options = {}) {
  const plan = readPlan(directory);
  ensure(sha(config.PAYPAL_CLIENT_ID ?? '') === plan.app_fingerprint, 'READ_APP_MISMATCH');
  function approved() {
    const current = readPlan(directory);
    ensure(current.digest === plan.digest, 'READ_PLAN_CHANGED');
    ensure(!plan.operational_deadline || Date.now() < plan.operational_deadline, 'READ_OPERATIONAL_CUTOFF', 503);
    let approval, info;
    try {
      info = statSync(`${directory}/operator-approval.json`);
      approval = readJson(`${directory}/operator-approval.json`);
    } catch { ensure(false, 'READ_OPERATOR_APPROVAL_REQUIRED', 503); }
    ensure(info.isFile() && !(info.mode & 0o077) && info.uid === process.getuid() &&
      approval.statement === READ_APPROVAL && approval.plan_digest === plan.digest, 'READ_OPERATOR_APPROVAL_REQUIRED', 503);
    try { statSync(`${directory}/stopped.json`); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
    ensure(false, 'READ_EXPERIMENT_STOPPED', 503);
  }
  approved(); // Even server construction refuses missing approval, without network.
  function stop(code) {
    try { privateJson(`${directory}/stopped.json`, { at: new Date().toISOString(), code }); }
    catch (e) { if (e.code !== 'EEXIST') throw e; }
  }
  function reserve(operation) {
    approved();
    const ceiling = operation === 'oauth' ? plan.max_oauth : plan.max_gets;
    for (let n = 1; n <= ceiling; n++) {
      const path = `${directory}/${operation}-${n}.json`;
      const event = { operation, at: new Date().toISOString(), plan_digest: plan.digest,
        provenance: client.provenance, http_status: null, debug_id: null };
      try { privateJson(path, event); return { path, event }; }
      catch (e) { if (e.code !== 'EEXIST') throw e; }
    }
    ensure(false, 'READ_BUDGET_EXHAUSTED', 503);
  }
  const settings = {
    initialToken: options.initialToken,
    beforeRequest(operation) {
      ensure(['oauth', 'order_get'].includes(operation), 'READ_OPERATION_FORBIDDEN', 403);
      return reserve(operation === 'oauth' ? 'oauth' : 'get');
    },
    afterResponse(slot, event) {
      Object.assign(slot.event, event); privateJson(slot.path, slot.event, false);
      if (event.http_status >= 400) stop('PROVIDER_HTTP_FAILURE');
    },
    onRequestError(slot) { if (slot) stop('NETWORK_OR_LEDGER_FAILURE'); },
    beforeOrder(id) { ensure(id === plan.order_id, 'READ_ORDER_FORBIDDEN', 403); approved(); },
    afterOrder(raw, id, started) {
      const p = normalizeSandboxOrder(raw, id, plan.merchant_id, started); reviewable(p); approved();
      ensure(raw.purchase_units.length === 1 && p.intent === plan.intent && p.status === plan.status &&
        p.currency === plan.currency && p.units[0].amount_value === plan.amount, 'READ_FIXED_ORDER_CHANGED');
      privateJson(`${directory}/observation-${Date.now()}-${process.pid}.json`, {
        provenance: client.provenance, observed_at: started, provider: p, plan_digest: plan.digest });
    },
    onOrderError() { stop('ORDER_UNVERIFIABLE_OR_CHANGED'); },
  };
  if (Object.hasOwn(options, 'transport')) settings.transport = options.transport;
  // The policy adds budget/validation hooks, never an arbitrary transport wrapper or new identity.
  const client = sandboxClient(config, settings);
  return { merchantId: plan.merchant_id, allowedOrders: [plan.order_id], buyerId: plan.buyer_id,
    refreshAllowed: false, deadline: plan.operational_deadline, client };
}
