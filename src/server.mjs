import { pathToFileURL } from 'node:url';
import { localConfig, paypalIntegration } from './paypal-config.mjs';
import { mkdir } from 'node:fs/promises';
import { openStore, openPostgresStore } from './store.mjs';
import { provisionStaging } from './identity.mjs';
import { makeApp } from './app.mjs';
import { ensure } from './core.mjs';

export async function startLocalServer(preparedIntegration) {
  process.umask(0o077);
  const env = await localConfig();
  const publicRuntime = !!(env.RENDER_EXTERNAL_URL || env.RENDER === 'true');
  ensure(!publicRuntime || !!env.DATABASE_URL, 'DATABASE_URL_REQUIRED', 503);
  const origin = env.PUBLIC_ORIGIN || env.RENDER_EXTERNAL_URL || 'http://localhost:3100';
  const rpID = env.WEBAUTHN_RP_ID || new URL(origin).hostname;
  const config = { origin, rpID };
  let store;
  try {
    if (env.DATABASE_URL) {
      store = await openPostgresStore(env.DATABASE_URL);
      const result = await provisionStaging(store, env);
      if (result.created) {
        console.log('Staging accounts provisioned. Remove STAGING_*_PASSWORD values from deployment settings after first successful start.');
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
    await store?.close?.().catch?.(() => {});
    console.error('SaySure persistence startup refused. Check database connectivity and staging bootstrap settings.');
    throw error;
  }
  let integration;
  try { integration = preparedIntegration ?? paypalIntegration(env); }
  catch {
    await store.close();
    console.error('PayPal sandbox configuration refused. Check private configuration.');
    process.exit(1);
  }
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
  app.server.listen(port, host, () => console.log(`SaySure consent review: ${origin}`));
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
