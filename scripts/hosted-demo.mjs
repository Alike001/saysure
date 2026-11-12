import { demoServer } from '../src/demo-server.mjs';

// Public deployment serves ONLY the stateless synthetic walkthrough.
// It never imports the authenticated server, opens SQLite, creates passkeys,
// or enables PayPal API calls. The optional Groq key stays in Render's env.
const url = process.env.RENDER_EXTERNAL_URL;
const port = Number(process.env.PORT ?? 10000);
if (!url || !Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PUBLIC_DEMO_CONFIG_REQUIRED: expected RENDER_EXTERNAL_URL and a valid PORT.');
  process.exit(1);
}
const server = demoServer({ publicUrl: url, ai: { apiKey: process.env.GROQ_API_KEY } });
server.on('error', () => {
  console.error('PUBLIC_DEMO_LISTEN_FAILED');
  process.exitCode = 1;
});
server.listen(port, '0.0.0.0', () => {
  console.log('SaySure public synthetic demo serving (no credentials, database, PayPal actions or passkey operations).');
  console.log('Groq buyer question classifier: ' + (process.env.GROQ_API_KEY ? 'configured' : 'deterministic fallback'));
});
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
