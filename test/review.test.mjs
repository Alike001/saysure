import test from 'node:test';
import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import { harness, sample } from './harness.mjs';

test('accessible buyer review in Chrome (speech API stub; no physical audio claim)', { timeout: 90000 }, async t => {
  const h = await harness(); t.after(() => h.close());
  const helper = await h.actor('helper'), buyer = await h.actor('buyer-a');
  const created = await helper.call('/api/requests', sample({ merchant_name: 'Example Store' }));
  const item = created.data;
  await buyer.page.addInitScript(() => {
    window.audioCalls = [];
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      speak(u) { window.audioCalls.push(['speak', u.text]); },
      cancel() { window.audioCalls.push(['stop']); }, pause() { window.audioCalls.push(['pause']); },
      resume() { window.audioCalls.push(['resume']); },
    } });
  });
  await buyer.page.reload();
  const article = buyer.page.getByRole('article');
  await article.getByRole('heading', { name: '1.00 USD — Example Store' }).waitFor();
  await t.test('exact speech, pause, resume and stop; no automatic approval', async () => {
    assert.deepEqual(await buyer.page.evaluate(() => window.audioCalls), []);
    await article.getByRole('button', { name: 'Read payment details aloud' }).click();
    const spoken = await buyer.page.evaluate(() => window.audioCalls.find(c => c[0] === 'speak')[1]);
    for (const value of ['1.00 USD', 'Example Store', item.snapshot.merchant_id, item.snapshot.description, 'unverified']) assert.ok(spoken.includes(value));
    await article.getByRole('button', { name: 'Pause audio', exact: true }).click();
    await article.getByRole('button', { name: 'Resume audio', exact: true }).click();
    await article.getByRole('button', { name: 'Stop audio', exact: true }).click();
    assert.deepEqual((await buyer.page.evaluate(() => window.audioCalls)).slice(-3), [['pause'], ['resume'], ['stop']]);
    assert.equal(h.store.request(item.snapshot.request_id).status, 'pending');
    assert.equal(h.store.get('SELECT COUNT(*) AS n FROM challenges').n, 0);
  });
  await t.test('mobile reflow, visible controls, axe and keyboard review/decline', async () => {
    await buyer.page.setViewportSize({ width: 320, height: 800 });
    assert.equal(await buyer.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const read = article.getByRole('button', { name: 'Read payment details aloud' });
    assert.ok((await read.boundingBox()).height >= 48);
    await read.focus(); await buyer.page.keyboard.press('Enter');
    await buyer.page.keyboard.press('Tab');
    assert.equal(await article.getByRole('button', { name: 'Pause audio', exact: true }).evaluate(e => e === document.activeElement), true);
    await article.getByRole('button', { name: 'Stop audio', exact: true }).click();
    await article.getByRole('checkbox').focus(); await buyer.page.keyboard.press('Space');
    assert.equal(await article.getByRole('checkbox').isChecked(), true);
    const result = await new AxeBuilder({ page: buyer.page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    assert.deepEqual(result.violations.map(v => v.id), []);
    await article.getByRole('button', { name: 'Decline / Reject this request' }).focus();
    await buyer.page.keyboard.press('Enter');
    await buyer.page.locator('#message').filter({ hasText: 'Request rejected' }).waitFor();
    assert.equal(await buyer.page.getByRole('article').getByRole('heading', { level: 3 }).evaluate(e => e === document.activeElement), true);
    assert.equal(h.store.request(item.snapshot.request_id).status, 'rejected');
  });
  await t.test('missing speech remains readable and announces unavailability', async () => {
    await buyer.page.evaluate(() => Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined }));
    await buyer.page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await article.getByText('Speech is unavailable', { exact: false }).waitFor();
    assert.equal(await article.getByRole('button', { name: 'Read payment details aloud' }).isDisabled(), true);
    await article.getByRole('heading', { name: '1.00 USD — Example Store' }).waitFor();
  });
  await t.test('live local expiry disables consent and clears review, server rejects current evidence', async () => {
    const fresh = (await helper.call('/api/requests', sample())).data;
    await buyer.page.reload();
    const card = buyer.page.getByRole('article').filter({ hasText: fresh.snapshot.request_id });
    await card.getByRole('checkbox').check();
    // Move the page clock only. The server is tested separately below.
    await buyer.page.evaluate(expires => { Date.now = () => expires + 1; }, fresh.snapshot.expires_at);
    await card.getByText('This review expired.', { exact: false }).waitFor();
    assert.equal(await card.getByRole('checkbox').isChecked(), false);
    assert.match(await card.locator('.request-status').innerText(), /Status: expired/);
    assert.equal(await card.getByRole('button', { name: 'Decline / Reject this request' }).isDisabled(), true);
    assert.equal(await card.getByRole('button', { name: 'Approve using my passkey — synthetic request' }).isDisabled(), true);
    const s = { ...fresh.snapshot, expires_at: Date.now() - 1 };
    const { digest } = await import('../src/core.mjs');
    h.store.run('UPDATE requests SET snapshot=?,digest=? WHERE id=?', JSON.stringify(s), digest(s), s.request_id);
    const options = await buyer.call(`/api/requests/${s.request_id}/options`, { digest: digest(s) });
    assert.equal(options.status, 409); assert.equal(h.store.request(s.request_id).status, 'expired');
  });
  await t.test('helper cannot introduce PayPal proof or obtain buyer audio/review controls', async () => {
    assert.equal((await helper.call('/api/requests', { ...sample(), paypal_order_id: 'MOCKORDER123' })).status, 400);
    assert.equal((await helper.call('/api/requests', { ...sample(), synthetic: false })).status, 400);
    await helper.page.reload();
    assert.equal(await helper.page.getByRole('button', { name: 'Read payment details aloud' }).count(), 0);
    assert.equal(await helper.page.getByRole('checkbox').count(), 0);
    assert.deepEqual(h.forbidden, []);
  });
});
