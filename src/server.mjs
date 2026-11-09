import { localConfig, paypalIntegration } from './paypal-config.mjs';
import { mkdir } from 'node:fs/promises';
import { openStore } from './store.mjs';
import { makeApp } from './app.mjs';
process.umask(0o077);
// Intentionally fixed local origin. LAN/HTTPS is a separate explicit configuration exercise.
const config = { origin: 'http://localhost:3100', rpID: 'localhost' };
await mkdir(new URL('../.local/', import.meta.url), { recursive: true, mode: 0o700 });
const store = openStore(new URL('../.local/consent.sqlite', import.meta.url).pathname);
if (store.get('SELECT COUNT(*) AS n FROM users').n !== 3) {
  console.error('Run npm run setup first.'); store.close(); process.exit(1);
}
let integration;
try { integration = paypalIntegration(await localConfig()); }
catch { console.error('PayPal sandbox configuration refused. Check private configuration.'); store.close(); process.exit(1); }
const { server } = makeApp(store, { ...config, paypal: integration });
server.on('error', () => { console.error('Cannot start localhost:3100.'); store.close(); process.exitCode = 1; });
server.listen(3100, '127.0.0.1', () => console.log('SaySure local consent review: http://localhost:3100'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { store.close(); process.exit(0); }));
