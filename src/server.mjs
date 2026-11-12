import { pathToFileURL } from 'node:url';
import { localConfig, paypalIntegration } from './paypal-config.mjs';
import { mkdir } from 'node:fs/promises';
import { openStore, openPostgresStore } from './store.mjs';
import { provisionStaging } from './identity.mjs';
import { makeApp } from './app.mjs';
import { ensure } from './core.mjs';

export async function startLocalServer(preparedIntegration) {
  process.umask(0o077);
  // Render must see a listening port after boot. Fail with a useful stage
  // rather than silently consuming its 15-minute port-scan deadline.
  const hostedBoot = !!(process.env.RENDER_EXTERNAL_URL || process.env.RENDER === 'true');
  let stage = 'configuration';
  const watchdog = hostedBoot ? setTimeout(() => {
    console.error('SaySure startup timed out during ' + stage + '; HTTP port was never opened.');
    process.exit(1);
  }, 60_000) : null;
  watchdog?.unref();
  console.log('SaySure startup: loading configuration (values withheld).');
  const env = await localConfig();
  console.log('SaySure startup: configuration loaded; AI key ' +
    (env.GROQ_API_KEY ? 'present' : 'absent') + '.');
  const publicRuntime = !!(env.RENDER_EXTERNAL_URL || env.RENDER === 'true');
  ensure(!publicRuntime || !!env.DATABASE_URL, 'DATABASE_URL_REQUIRED', 503);
  const origin = env.PUBLIC_ORIGIN || env.RENDER_EXTERNAL_URL || 'http://localhost:3100';
  const rpID = env.WEBAUTHN_RP_ID || new URL(origin).hostname;
  const config = { origin, rpID };
  let store;
  try {
    stage = 'persistence';
    if (env.DATABASE_URL) {
      console.log('SaySure startup: opening PostgreSQL (no credentials logged).');
      store = await openPostgresStore(env.DATABASE_URL);
      stage = 'account verification';
      console.log('SaySure startup: PostgreSQL schema ready; validating existing accounts.');
      const result = await provisionStaging(store, env);
      if (result.created) {
        console.log('Staging accounts provisioned. Remove STAGING_*_PASSWORD values from deployment settings after first successful start.');
      } else if (result.rotated) {
        console.log('Staging account passwords rotated and existing sessions invalidated. Remove STAGING_ROTATE_PASSWORDS and STAGING_*_PASSWORD values from deployment settings after first successful start.');
      }
      console.log('Persistence: PostgreSQL pool ready.');
    } else {
      await mkdir(new URL('../.local/', import.meta.url), { recursive: true, mode: 0o700 });
      store = openStore(new URL('../.local/consent.sqlite', import.meta.url).pathname);
      if (Number((await store.get('SELECT COUNT(*) AS n FROM users')).n) !== 3) {
        console.error('Run npm run setup first. Existing local database was not changed.');
        await store.close(); process.exit(1);
      }
      console.log('Persistence: local SQLite experiment.');
    }
  } catch (error) {
    if (store) await Promise.resolve(store.close()).catch(() => {});
    console.error('SaySure persistence startup refused. Check database connectivity and staging bootstrap settings.');
    throw error;
  }
  stage = 'PayPal read-only configuration';
  let integration;
  try { integration = preparedIntegration ?? paypalIntegration(env); }
  catch {
    await store.close();
    console.error('PayPal sandbox configuration refused. Check private configuration.');
    process.exit(1);
  }
  stage = 'HTTP server creation';
  const app = makeApp(store, { ...config, paypal: integration, ai: { apiKey: env.GROQ_API_KEY } });
  const port = Number(env.PORT ?? 3100);
  ensure(Number.isInteger(port) && port > 0 && port <= 65535, 'INVALID_PORT', 503);
  const host = publicRuntime ? '0.0.0.0' : '127.0.0.1';
  app.server.on('error', async () => {
    console.error('Cannot start SaySure HTTP server.');
    await app.close();
    await store.close();
    process.exitCode = 1;
  });
  stage = 'HTTP port bind';
  app.server.listen(port, host, () => {
    if (watchdog) clearTimeout(watchdog);
    console.log(`SaySure consent review: ${origin}`);
  });
  console.log('Buyer question routing: ' + (env.GROQ_API_KEY ? 'Groq enabled (redacted question only)' : 'local fallback (no Groq key configured)'));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
    app.server.close(async () => {
      await app.close();
      await store.close();
      process.exit(0);
    });
  });
  return { ...app, store, origin };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await startLocalServer();
