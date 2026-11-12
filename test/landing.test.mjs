import test from 'node:test';
import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import { harness } from './harness.mjs';

test('hosted entry keeps landing, no-login demo and protected workspace on one origin and reflows', { timeout: 90000 }, async t => {
  const h = await harness();
  t.after(() => h.close());
  const context = await h.browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto(h.origin);
  await page.getByRole('heading', { name: 'Get help with a payment. Keep the final say.' }).waitFor();
  await page.getByRole('link', { name: /Try the guided demo/ }).first().waitFor();
  await page.getByRole('link', { name: 'Open live workspace' }).waitFor();
  assert.match(await page.locator('body').innerText(), /The Helper prepares\.\s*The Buyer decides\./);
  assert.match(await page.locator('body').innerText(), /in development and are not live in this staging release/);
  assert.equal(await page.locator('img, video, iframe').count(), 0);

  const demoLink = page.getByRole('link', { name: /Try the guided demo/ }).first();
  assert.equal(await demoLink.getAttribute('href'), '/demo');
  const workspaceLink = page.getByRole('link', { name: 'Open live workspace' }).first();
  assert.equal(await workspaceLink.getAttribute('href'), '/app');

  for (const width of [320, 375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'horizontal overflow at ' + width + 'px');
    if ([320, 1440].includes(width)) {
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      assert.deepEqual(results.violations.map(v => v.id), [], 'accessibility scan failed at ' + width + 'px');
    }
  }

  await page.goto(h.origin + '/demo');
  await page.getByRole('heading', { name: 'Review a payment request.' }).waitFor();
  await page.getByRole('button', { name: 'Simulate consent approval', exact: true }).waitFor();
  await page.getByText('SIMULATION ONLY', { exact: false }).waitFor();
  await page.getByRole('link', { name: 'Back to website', exact: true }).waitFor();
  const demoWorkspaceLink = page.getByRole('link', { name: 'Open workspace', exact: true });
  await demoWorkspaceLink.waitFor();
  assert.equal(await demoWorkspaceLink.getAttribute('href'), '/app');
  assert.equal(await page.getByRole('heading', { name: 'How SaySure works' }).count(), 0);
  assert.equal(await page.locator('.demo-hero').count(), 0);
  const demoQuestion = await page.evaluate(async () => {
    const response = await fetch('/api/demo-question', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Does my passkey make a payment?' })
    });
    return { status: response.status, data: await response.json() };
  });
  assert.equal(demoQuestion.status, 200);
  assert.equal(demoQuestion.data.source, 'local');
  assert.equal(demoQuestion.data.topic, 'consent');
  assert.equal(await page.evaluate(async () => (await fetch('/api/requests')).status), 401);
  assert.equal((await context.cookies()).some(cookie => cookie.name === 'consent_session'), false);
  await page.setViewportSize({ width: 320, height: 900 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'demo horizontal overflow at 320px');
  const demoA11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  assert.deepEqual(demoA11y.violations.map(v => v.id), []);

  await page.goto(h.origin + '/app');
  await page.getByRole('heading', { name: 'Sign in to your workspace' }).waitFor();
  await page.getByText('a PayPal account is not required', { exact: false }).waitFor();
  await page.getByText('The Helper signs in with the Helper account', { exact: false }).waitFor();
  await page.getByLabel('Username', { exact: true }).waitFor();
  await page.getByLabel('Account secret').waitFor();
  await page.getByRole('link', { name: /Try the guided demo/ }).first().waitFor();
  assert.deepEqual(errors, []);
  await context.close();
});
