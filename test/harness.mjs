import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { openStore } from '../src/store.mjs';
import { provision } from '../src/identity.mjs';
import { makeApp } from '../src/app.mjs';

export async function harness(extraConfig = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'synthetic-consent-'));
  const dbPath = join(dir, 'test.sqlite');
  let store = openStore(dbPath);
  const accounts = provision(store);
  let app, origin;
  async function start(port = 0) {
    // A bound but not-yet-handling server discovers an ephemeral local test port.
    if (!port) {
      const { createServer } = await import('node:net');
      const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
      port = probe.address().port; await new Promise(resolve => probe.close(resolve));
    }
    origin = `http://localhost:${port}`;
    app = makeApp(store, { ...extraConfig, origin, rpID: 'localhost' });
    app.server.listen(port, '127.0.0.1'); await once(app.server, 'listening');
  }
  await start();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const contexts = [], forbidden = [];
  async function actor(name, virtual = true) {
    const context = await browser.newContext(); contexts.push(context);
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      forbidden.push(new URL(route.request().url()).origin); return route.abort();
    });
    const page = await context.newPage();
    let cdp, authenticatorId;
    if (virtual) {
      cdp = await context.newCDPSession(page);
      await cdp.send('WebAuthn.enable');
      ({ authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: {
        protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true,
        isUserVerified: true, automaticPresenceSimulation: true,
      } }));
    }
    await page.goto(`${origin}/app`);
    const account = accounts.find(a => a.username === name);
    await page.getByLabel('Username', { exact: true }).fill(name);
    await page.getByLabel('Password', { exact: true }).fill(account.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByText(`Signed in as ${name}.`, { exact: false }).waitFor();
    const call = async (path, body, method = 'POST', extra = {}) => page.evaluate(async ({ path, body, method, extra }) => {
      const session = await (await fetch('/api/session')).json();
      const response = await fetch(path, { method, headers: body === undefined ? extra : {
        'Content-Type': 'application/json', 'X-CSRF-Token': session.csrf, ...extra },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, data: await response.json() };
    }, { path, body, method, extra });
    const register = async () => {
      const options = await call('/api/register/options', {});
      const response = await page.evaluate(optionsJSON => window.SimpleWebAuthnBrowser.startRegistration({ optionsJSON }),
        options.data.options);
      return call('/api/register/verify', { challengeId: options.data.challengeId, response });
    };
    const assertion = async item => {
      const options = await call(`/api/requests/${item.snapshot.request_id}/options`, { digest: item.digest });
      if (options.status !== 200) throw new Error(`Options refused: ${options.data.error}`);
      const response = await page.evaluate(optionsJSON => window.SimpleWebAuthnBrowser.startAuthentication({ optionsJSON }),
        options.data.options);
      return { challengeId: options.data.challengeId, response };
    };
    return { page, context, call, register, assertion, cdp, authenticatorId };
  }
  return { actor, accounts, forbidden, browser, databasePath: dbPath,
    get store() { return store; }, get origin() { return origin; },
    async restart() {
      const port = app.server.address().port;
      await new Promise(resolve => { app.server.close(resolve); app.server.closeAllConnections(); }); store.close();
      store = openStore(dbPath); await start(port);
    },
    async close() {
      await browser.close();
      await new Promise(resolve => { app.server.close(resolve); app.server.closeAllConnections(); });
      store.close(); await rm(dir, { recursive: true, force: true });
    },
  };
}
export const sample = (overrides = {}) => ({ buyer_id: 'buyer-a', merchant_id: 'SYNTH-MERCHANT-1',
  merchant_name: 'Synthetic shop', amount: '1.00', currency: 'USD',
  description: 'Synthetic notebook; no real goods or money', lifetime_minutes: 10, ...overrides });
