import { demoServer } from '../src/demo-server.mjs';
const server = demoServer();
server.on('error', () => { console.error('Demo cannot bind localhost:3200. No real store was opened.'); process.exitCode = 1; });
server.listen(3200, '127.0.0.1', () => console.log('DEMO ONLY: http://localhost:3200 — fixtures; no accounts, passkeys, AI or PayPal calls.'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  server.close(() => process.exit(0)); server.closeAllConnections();
});
