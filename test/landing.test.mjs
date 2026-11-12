import test from 'node:test';
import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import { harness } from './harness.mjs';

test('hosted entry explains SaySure, separates the no-login demo from the protected workspace, and reflows', { timeout: 90000 }, async t => {
  const h = await harness();
  t.after(() => h.close());
  const context = await h.browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto(h.origin);
  await page.getByRole('heading', { name: 'Get help with a payment. Keep the final say.' }).waitFor();
  await page.getByRole('link', { name: /Try the guided demo/ }).waitFor();
  await page.getByRole('link', { name: 'Open live workspace' }).waitFor();
  assert.match(await page.locator('body').innerText(), /The Helper prepares\. The Buyer decides\./);
  assert.match(await page.locator('body').innerText(), /in development and are not live in this staging release/);
  assert.equal(await page.locator('img, video, iframe').count(), 0);

  const demoLink = page.getByRole('link', { name: /Try the guided demo/ }).first();
  assert.equal(await demoLink.getAttribute('href'), 'https://saysure-public-demo.onrender.com');
  const workspaceLink = page.getByRole('link', { name: 'Open live workspace' }).first();
  assert.equal(await workspaceLink.getAttribute('href'), '/app');

  for (const width of [320, 375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, \`horizontal overflow at \${width}px\`);
    if ([320, 1440].includes(width)) {
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      assert.deepEqual(results.violations.map(v => v.id), [], \`accessibility scan failed at \${width}px\`);
    }
  }

  await page.goto(\`\${h.origin}/app\`);
  await page.getByRole('heading', { name: 'Sign in to your workspace' }).waitFor();
  await page.getByLabel('Username', { exact: true }).waitFor();
  await page.getByLabel('Account secret').waitFor();
  await page.getByRole('link', { name: /Try the guided demo/ }).waitFor();
  assert.deepEqual(errors, []);
  await context.close();
});
