// No default network operation. Serve requires a separately signed-off private read plan.
import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { prepareReadPlan, consentReadIntegration } from '../src/paypal-read-plan.mjs';
const directory = resolve('.local/paypal-consent-read');
try {
  const [mode, flag, path, ...extra] = process.argv.slice(2);
  if (mode === 'preflight' && !flag) {
    const plan = prepareReadPlan(directory, resolve('.local/paypal-one-order'));
    console.log(JSON.stringify({ authorization: 'NOT APPROVED; zero new PayPal calls',
      plan_digest: plan.digest, host: plan.host, order_id: plan.order_id, merchant_id: plan.merchant_id,
      amount: plan.amount, currency: plan.currency, expected_status: plan.status, buyer_id: plan.buyer_id,
      max_oauth: plan.max_oauth, max_gets: plan.max_gets, stages: plan.stages,
      approval_file_exists: existsSync(`${directory}/operator-approval.json`),
      note: 'Prior response is historical only. Fresh GET may fail; never replace the order.' }, null, 2));
  } else if (mode === 'serve' && flag === '--config' && path && !extra.length) {
    const config = parseEnv(readFileSync(path, 'utf8'));
    const paypal = consentReadIntegration(config, directory);
    const { startLocalServer } = await import('../src/server.mjs');
    await startLocalServer(paypal);
  } else throw new Error('ARGUMENTS_INVALID');
} catch (error) {
  console.error(/^READ_[A-Z_]+$|^HISTORICAL_[A-Z_]+$|^PRIOR_READ_PLAN_CHANGED$/.test(error.message)
    ? error.message : 'CONSENT_PREFLIGHT_OR_CONFIG_REFUSED');
  process.exitCode = 1;
}
