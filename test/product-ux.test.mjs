import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import AxeBuilder from '@axe-core/playwright';
import { harness, sample } from './harness.mjs';
import { demoServer } from '../src/demo-server.mjs';
const widths = [320, 375, 390, 768, 1440];
const evidence = '/tmp/saysure-final-ux';
const scanResults = [];
async function scan(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa']).analyze();
  scanResults.push({ title: await page.title(), width: page.viewportSize().width, violations: result.violations });
  await writeFile(`${evidence}/axe-results.json`, JSON.stringify(scanResults, null, 2));
  assert.deepEqual(result.violations.map(v => v.id), []);
}
const position = locator => locator.evaluate(e => e.getBoundingClientRect().top + scrollY);

test('product UX: five-width layouts, transaction-first decisions, keyboard, errors and screenshots', { timeout: 600000 }, async t => {
  await mkdir(evidence, { recursive: true });
  const h = await harness(); t.after(() => h.close());
  const helper = await h.actor('helper', false), buyer = await h.actor('buyer-a', false);
  await helper.call('/api/requests', sample({ merchant_name: 'Example Store' }));
  await buyer.page.reload();
  const guestContext = await h.browser.newContext();
  const guest = await guestContext.newPage(); await guest.goto(h.origin + '/app');
  const measurements = [];
  for (const width of widths) {
    for (const [name, page] of [['buyer', buyer.page], ['helper', helper.page], ['signin', guest]]) {
      await page.setViewportSize({ width, height: 900 }); await scan(page);
      await page.screenshot({ path: `${evidence}/${name}-${width}.png`, fullPage: true });
    }
    const card = buyer.page.getByRole('article'), approve = card.getByRole('button', { name: 'Approve using my passkey — synthetic request' });
    const approvalY = await position(approve), facts = card.locator('.transaction-facts');
    assert.ok(await position(facts) < approvalY);
    assert.ok(await facts.evaluate(e => e.getBoundingClientRect().bottom + scrollY) < approvalY);
    const setupButton = card.getByRole('button', { name: 'Set up passkey to approve' });
    const setupY = await position(setupButton);
    assert.ok(setupY < 1175, `Passkey setup is too far down at ${width}: ${setupY}`);
    assert.ok(approvalY < setupY + 240, `Decision must immediately follow its setup step at ${width}: ${approvalY}`);
    assert.ok((await approve.boundingBox()).height >= 48);
    assert.equal(await approve.isDisabled(), true); // no Buyer passkey enrollment
    assert.equal(await card.locator('.advanced').getAttribute('open'), null);
    measurements.push({ width, amountY: await position(card.getByRole('heading', { level: 3 })), approvalY });
  }
  await writeFile(`${evidence}/measurements.json`, JSON.stringify(measurements, null, 2));
  await t.test('refresh keeps focus; decline leads to the same request heading and cannot approve', async () => {
    const refresh = buyer.page.getByRole('button', { name: 'Refresh', exact: true });
    await refresh.focus(); await buyer.page.keyboard.press('Enter');
    await buyer.page.locator('#message').filter({ hasText: 'Requests updated' }).waitFor();
    assert.equal(await refresh.evaluate(e => e === document.activeElement), true);
    const decline = buyer.page.getByRole('button', { name: 'Decline / Reject this request' });
    await decline.focus(); await buyer.page.keyboard.press('Enter');
    await buyer.page.locator('#message').filter({ hasText: 'Request rejected' }).waitFor();
    assert.equal(await buyer.page.getByRole('article').getByRole('heading', { level: 3 }).evaluate(e => e === document.activeElement), true);
    assert.equal(await buyer.page.getByRole('button', { name: 'Approve using my passkey — synthetic request' }).count(), 0);
    await buyer.page.keyboard.press('Tab');
    assert.equal(await buyer.page.getByRole('link', { name: 'Help understanding this request' }).evaluate(e => e === document.activeElement), true);
    await scan(buyer.page);
  });
  await t.test('amount and authentication errors have field associations and corrective focus', async () => {
    await helper.page.getByLabel('Store reference', { exact: true }).fill('SYNTH-TEST');
    await helper.page.getByLabel('Store or recipient name', { exact: true }).fill('Example Store');
    await helper.page.getByLabel('Amount (e.g. 12.00)', { exact: true }).fill('1,00');
    await helper.page.getByLabel("What's this for?", { exact: true }).fill('Synthetic test');
    await helper.page.getByRole('button', { name: 'Send test request' }).click();
    await helper.page.locator('#amount-error').filter({ hasText: 'Enter an exact positive amount' }).waitFor();
    assert.equal(await helper.page.locator('#amount').getAttribute('aria-invalid'), 'true');
    assert.equal(await helper.page.locator('#amount').evaluate(e => e === document.activeElement), true);
    assert.equal(await guest.locator('#returning-login').isHidden(), true);
    await guest.goto(h.origin + '/app/login');
    await guest.getByLabel('Username', { exact: true }).fill('unknown');
    await guest.getByLabel('Password', { exact: true }).fill('incorrect-secret');
    await guest.getByRole('button', { name: 'Sign in', exact: true }).click();
    await guest.locator('#login-error').filter({ hasText: 'Those login details did not match' }).waitFor();
    assert.equal(await guest.locator('#username').getAttribute('aria-describedby'), 'login-error');
    assert.equal(await guest.locator('#username').getAttribute('aria-invalid'), 'true');
    assert.equal(await guest.locator('#username').evaluate(e => e === document.activeElement), true);
    await helper.page.locator('#amount').fill('1.00');
    await helper.page.locator('#merchant-name').fill('   ');
    await helper.page.getByRole('button', { name: 'Send test request' }).click();
    await helper.page.locator('#merchant-name-error').filter({ hasText: 'visible characters' }).waitFor();
    assert.equal(await helper.page.locator('#merchant-name').getAttribute('aria-invalid'), 'true');
    assert.equal(await helper.page.locator('#merchant-name').evaluate(e => e === document.activeElement), true);
    await scan(guest); await scan(helper.page);
  });
  const grouped = await helper.page.locator('#request-form .request-field').evaluateAll(fields =>
    fields.every(field => { const label = field.querySelector('label'); return !!label && !!field.querySelector('#' + label.htmlFor); }));
  assert.equal(grouped, true, 'all Helper form labels should be grouped with matching fields');
  await helper.call('/api/requests', sample({ merchant_name: 'M'.repeat(120), description: 'D'.repeat(500) }));
  await buyer.page.reload();
  for (const width of widths) {
    await buyer.page.setViewportSize({ width, height: 900 });
    assert.equal(await buyer.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  assert.deepEqual(h.forbidden, []);
});

test('demo: guided entry, mode/reset semantics, coherent source speech and explanation playback states', { timeout: 300000 }, async t => {
  const h = await harness(); t.after(() => h.close());
  const server = demoServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const context = await h.browser.newContext();
  const page = await context.newPage(), requests = [];
  const origin = `http://localhost:${server.address().port}`;
  await page.route('**/*', route => {
    requests.push(route.request().url());
    return new URL(route.request().url()).origin === origin ? route.continue() : route.abort();
  });
  await page.addInitScript(() => {
    window.audioCalls = [];
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      speak(u) { window.utterance = u; window.audioCalls.push(['speak', u.text]); }, cancel() { window.audioCalls.push(['stop']); },
      pause() { window.audioCalls.push(['pause']); }, resume() { window.audioCalls.push(['resume']); },
    } });
    navigator.credentials.create = navigator.credentials.get = () => { throw Error('No demo passkeys'); };
  });
  await page.goto(origin);
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 }); await scan(page);
    await page.screenshot({ path: `${evidence}/demo-${width}.png`, fullPage: true });
  }
  await page.getByRole('heading', { name: 'Review a payment request.' }).waitFor();
  await page.locator('#review-heading').focus();
  assert.equal(await page.locator('#review-heading').evaluate(e => e === document.activeElement), true);
  await page.getByRole('button', { name: 'Read explanation aloud' }).click();
  await page.getByRole('button', { name: 'Pause explanation audio' }).click();
  await page.getByRole('button', { name: 'Resume explanation audio' }).click();
  await page.getByRole('button', { name: 'Stop explanation audio' }).click();
  assert.deepEqual((await page.evaluate(() => window.audioCalls)).slice(-3), [['pause'], ['resume'], ['stop']]);
  assert.equal(await page.locator('#pause-answer').isDisabled(), true);
  assert.equal(await page.locator('#stop-answer').isDisabled(), true);
  await page.getByRole('button', { name: 'Read explanation aloud' }).click();
  await page.evaluate(() => window.utterance.onend());
  await page.getByText('Finished reading. Nothing was approved.', { exact: true }).waitFor();
  await page.getByText('Advanced demo controls', { exact: true }).click();
  await page.getByRole('button', { name: 'MOCK PayPal order', exact: true }).click();
  assert.equal(await page.locator('#mock').getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: 'Read payment details aloud' }).click();
  const spoken = await page.evaluate(() => window.utterance.text);
  assert.match(spoken, /MOCK PayPal fixture.*No authenticated API response/);
  assert.match(spoken, /Expected quantity 1; recorded quantity 2/);
  await page.getByLabel('Choose a question').selectOption('merchant');
  await page.getByRole('button', { name: 'Explain this question', exact: true }).click();
  assert.match(await page.locator('#explanation').innerText(), /MOCK payee MOCKPAYEE123/);
  await page.locator('#decline').click(); await page.locator('#mock').click();
  assert.equal(await page.locator('#approve').isDisabled(), true); // reselect does not erase refusal
  await page.locator('#reset').click(); assert.equal(await page.locator('#approve').isEnabled(), true);
  await page.addInitScript(() => Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined }));
  await page.reload();
  assert.equal(await page.locator('#read-answer').isDisabled(), true);
  assert.equal(await page.locator('#stop-answer').isDisabled(), true);
  assert.ok(requests.every(url => new URL(url).origin === origin && !new URL(url).pathname.startsWith('/api')));
});
