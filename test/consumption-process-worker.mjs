import { openStore } from '../src/store.mjs';
import { makeApp } from '../src/app.mjs';
let store, app, release;
process.on('message', async message => {
  if (message.type === 'start') {
    store = openStore(message.path);
    const config = { origin: 'http://localhost:3100', rpID: 'localhost', paypal: {
      merchantId: message.merchant, allowedOrders: [message.raw.id], client: {
        provenance: 'mock-paypal-fixture', async getOrder() {
          process.send({ type: 'provider_entered', pid: process.pid });
          await new Promise(resolve => release = resolve); return structuredClone(message.raw);
        } } } };
    app = makeApp(store, config);
    app.server.listen(0, '127.0.0.1', () => {
      config.origin = `http://localhost:${app.server.address().port}`;
      process.send({ type: 'ready', origin: config.origin, pid: process.pid });
    });
  } else if (message.type === 'release') release?.();
  else if (message.type === 'stop') {
    app.server.close(() => { store.close(); process.exit(0); }); app.server.closeAllConnections();
  }
});
