import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { demoServer } from '../src/demo-server.mjs';

test('seeded public demo: fictional queue, role switch, isolated helper creation, invalidation, no credentials', { timeout: 90000 }, async t => {
  const server = demoServer();
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  t.after(async () => { await browser.close(); await new Promise(resolve => server.close(resolve)); server.closeAllConnections(); });
  const context = await browser.newContext({ viewport: { width: 320, height: 900 } });
  const requests = [], errors = [];
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => {
    requests.push(route.request());
    return new URL(route.request().url()).origin === 'http://localhost:' + server.address().port ? route.continue() : route.abort();
  });
  await page.goto('http://localhost:' + server.address().port);
  await page.getByRole('heading', { name: 'Review a payment request.' }).waitFor();
  assert.equal(await page.locator('.demo-case').count(), 5);
  for (const name of ['Example Store', 'Campus Supplies', 'City Electronics', 'QuickMart', 'Household Goods']) {
    assert.ok((await page.locator('#demo-cases').innerText()).includes(name));
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByRole('button', { name: /Campus Supplies/ }).click();
  assert.match(await page.locator('#review').innerText(), /12.00 USD/);
  assert.equal(await page.locator('#demo-status').innerText(), 'CONSENT SIMULATED');
  await page.getByRole('button', { name: 'Helper view' }).click();
  assert.equal(await page.locator('#helper-console').isVisible(), true);
  assert.equal(await page.locator('.decision-panel').isVisible(), false);
  await page.getByLabel('Merchant name (fictional)').fill('Neighborhood Books');
  await page.getByLabel('Amount (USD)').fill('18.50');
  await page.getByLabel('Item or purpose').fill('Paperback book');
  await page.getByRole('button', { name: 'Create sample request' }).click();
  assert.equal(await page.locator('.demo-case').count(), 6);
  assert.match(await page.locator('#demo-create-result').innerText(), /Created SYN-1006 in this browser only/);
  await page.getByRole('button', { name: 'Buyer view' }).click();
  assert.equal(await page.locator('.decision-panel').isVisible(), true);
  assert.match(await page.locator('#review').innerText(), /Neighborhood Books/);
  assert.match(await page.locator('#review').innerText(), /18.50 USD/);
  await page.getByRole('button', { name: 'Simulate consent approval' }).click();
  assert.equal(await page.locator('#demo-status').innerText(), 'CONSENT SIMULATED');
  await page.getByRole('button', { name: 'Helper view' }).click();
  await page.getByRole('button', { name: /Revise selected request/ }).click();
  await page.getByRole('button', { name: 'Buyer view' }).click();
  assert.equal(await page.locator('#demo-status').innerText(), 'REVIEW NEEDED');
  assert.match(await page.locator('#review').innerText(), /Revision: 2. Simulated local consent: pending/);
  assert.equal((await context.cookies()).length, 0);
  assert.ok(requests.every(r => r.method() === 'GET' && new URL(r.url()).pathname.indexOf('/api') === -1));
  assert.deepEqual(errors, []);
});
