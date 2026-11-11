import { demoServer } from '../src/demo-server.mjs';
import { localConfig } from '../src/paypal-config.mjs';
const env = await localConfig();
const server = demoServer({ ai: { apiKey: env.GROQ_API_KEY } });
server.on('error', () => { console.error('Demo cannot bind localhost:3200. No real store was opened.'); process.exitCode = 1; });
server.listen(3200, '127.0.0.1', () => {
  console.log('DEMO ONLY: http://localhost:3200 — synthetic fixtures; no accounts, passkeys, PayPal or payments.');
  console.log('Buyer question routing: ' + (env.GROQ_API_KEY ? 'Groq enabled (redacted question only)' : 'local fallback (no Groq key configured)'));
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  server.close(() => process.exit(0)); server.closeAllConnections();
});
