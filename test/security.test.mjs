import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { harness, sample } from './harness.mjs';
import { alterAndSign, wrongHost } from './attacks.mjs';

test('Real Chrome WebAuthn API with virtual authenticators: synthetic security experiment', { timeout: 300_000 }, async t => {
  const h = await harness(); t.after(() => h.close());
  const records = [], browserVersion = h.browser.version();
  async function check(name, fn) {
    await t.test(name, { timeout: name.startsWith('17 ') ? 90_000 : 30_000 }, async () => {
      try { await fn(); records.push({ name, outcome: 'PASS' }); }
      catch (error) { records.push({ name, outcome: 'FAIL', reason: error.message }); throw error; }
    });
  }
  const helper = await h.actor('helper', false), a = await h.actor('buyer-a'), b = await h.actor('buyer-b');
  const create = async (overrides = {}) => {
    const result = await helper.call('/api/requests', sample(overrides));
    assert.equal(result.status, 201); return result.data;
  };
  const approve = (actor, item, proof) => actor.call(`/api/requests/${item.snapshot.request_id}/approve`, proof);
  const consume = (actor, item) => actor.call(`/api/requests/${item.snapshot.request_id}/consume`, { digest: item.digest });
  const revise = (item, patch) => helper.call(`/api/requests/${item.snapshot.request_id}`,
    sample({ revision: item.snapshot.revision, ...patch }), 'PATCH');
  const status = item => h.store.request(item.snapshot.request_id).status;

  await check('01 valid enrollment: separate buyer credentials, verified UV, replacement blocked', async () => {
    assert.equal((await a.register()).status, 200); assert.equal((await b.register()).status, 200);
    const keys = h.store.all('SELECT id,buyer_id FROM credentials');
    assert.equal(keys.length, 2); assert.notEqual(keys[0].id, keys[1].id);
    assert.equal((await a.call('/api/register/options', {})).status, 409);
    assert.equal((await helper.call('/api/register/options', {})).status, 403);
  });
  await check('02 valid approval: actual browser-generated signature verified and digest recorded', async () => {
    const item = await create(), proof = await a.assertion(item);
    const result = await approve(a, item, proof);
    assert.equal(result.status, 200); assert.equal(result.data.status, 'approved');
    assert.equal(result.data.consent_digest, item.digest);
  });
  for (const [field, patch] of [['amount', { amount: '2.00' }],
    ['merchant ID', { merchant_id: 'SYNTH-MERCHANT-2' }], ['merchant name', { merchant_name: 'Changed shop' }],
    ['currency', { currency: 'EUR' }], ['description', { description: 'Changed goods' }],
    ['revision only', {}]]) {
    await check(`03 tamper ${field}: old signed assertion and old review digest denied`, async () => {
      const item = await create(), proof = await a.assertion(item);
      assert.equal((await revise(item, patch)).status, 200);
      assert.equal((await approve(a, item, proof)).status, 409);
      assert.equal((await a.call(`/api/requests/${item.snapshot.request_id}/options`, { digest: item.digest })).status, 409);
      assert.equal(status(item), 'pending');
    });
  }
  await check('04 changed buyer: helper reassignment denied; internal synthetic corruption fails closed', async () => {
    const item = await create(), proof = await a.assertion(item);
    assert.equal((await revise(item, { buyer_id: 'buyer-b' })).status, 403);
    h.store.run('UPDATE requests SET buyer_id=? WHERE id=?', 'buyer-b', item.snapshot.request_id);
    assert.equal((await approve(a, item, proof)).status, 404);
    // Remove this deliberately corrupted fixture so normal inbox reads remain usable.
    h.store.run('DELETE FROM requests WHERE id=?', item.snapshot.request_id);
  });
  await check('05 expired challenge: pre-generated assertion denied at server expiry', async () => {
    const item = await create(), proof = await a.assertion(item);
    h.store.run('UPDATE challenges SET expires=? WHERE id=?', Date.now() - 1, proof.challengeId);
    assert.equal((await approve(a, item, proof)).status, 409); assert.equal(status(item), 'pending');
  });
  await check('06 expired request: consent and continuation denied', async () => {
    const item = await create();
    const s = { ...item.snapshot, expires_at: Date.now() - 1 };
    h.store.run('UPDATE requests SET snapshot=? WHERE id=?', JSON.stringify(s), s.request_id);
    assert.equal((await a.call(`/api/requests/${s.request_id}/options`, { digest: item.digest })).status, 409);
    assert.equal((await consume(a, item)).status, 409);
    assert.equal(status(item), 'expired');
    h.store.run('DELETE FROM requests WHERE id=?', s.request_id);
  });
  await check('07 replay assertion: 100 replays denied, exactly one consent event', async () => {
    const item = await create(), proof = await a.assertion(item);
    assert.equal((await approve(a, item, proof)).status, 200);
    const replays = await Promise.all(Array.from({ length: 100 }, () => approve(a, item, proof)));
    assert.ok(replays.every(r => r.status === 409));
    assert.equal(h.store.get("SELECT COUNT(*) AS n FROM events WHERE request_id=? AND event='consent_approved'",
      item.snapshot.request_id).n, 1);
  });
  await check('08 reused consent: one local consume, repeated use denied', async () => {
    const item = await create(); assert.equal((await approve(a, item, await a.assertion(item))).status, 200);
    assert.equal((await consume(a, item)).status, 200); assert.equal((await consume(a, item)).status, 409);
  });
  await check('09 incorrect passkey and invalid signature cannot approve', async () => {
    const item = await create(), proof = await a.assertion(item);
    proof.response.id = h.store.get('SELECT id FROM credentials WHERE buyer_id=?', 'buyer-b').id;
    assert.equal((await approve(a, item, proof)).status, 403);
    const badSignature = await a.assertion(item);
    badSignature.response.response.signature = Buffer.alloc(70, 3).toString('base64url');
    assert.equal((await approve(a, item, badSignature)).status, 400); assert.equal(status(item), 'pending');
  });
  await check('10 helper cannot approve, use buyer proof, consume, reject, or enroll substitute', async () => {
    const item = await create(), proof = await a.assertion(item), id = item.snapshot.request_id;
    assert.equal((await helper.call(`/api/requests/${id}/options`, { digest: item.digest })).status, 403);
    assert.equal((await approve(helper, item, proof)).status, 403);
    assert.equal((await consume(helper, item)).status, 403);
    assert.equal((await helper.call(`/api/requests/${id}/reject`, { digest: item.digest })).status, 403);
    assert.equal((await helper.call('/api/register/options', { buyer_id: 'buyer-a' })).status, 400);
    assert.equal(status(item), 'pending');
  });
  await check('11 parallel duplicates: 20 approvals and 20 consumes yield one of each', async () => {
    const item = await create(), proof = await a.assertion(item);
    const approvals = await Promise.all(Array.from({ length: 20 }, () => approve(a, item, proof)));
    assert.equal(approvals.filter(r => r.status === 200).length, 1);
    assert.ok(approvals.filter(r => r.status !== 200).every(r => r.status === 409));
    const consumes = await Promise.all(Array.from({ length: 20 }, () => consume(a, item)));
    assert.equal(consumes.filter(r => r.status === 200).length, 1);
  });
  await check('12 refresh and server/database restart: challenge/session retained, replay and reuse still denied', async () => {
    const item = await create(), proof = await a.assertion(item);
    await a.page.reload(); await h.restart();
    assert.equal((await approve(a, item, proof)).status, 200);
    await h.restart();
    assert.equal((await approve(a, item, proof)).status, 409);
    assert.equal((await consume(a, item)).status, 200); await h.restart();
    assert.equal((await consume(a, item)).status, 409);
  });
  await check('13 buyer-b isolated: cannot see or approve buyer-a; can approve own request', async () => {
    const item = await create(), proof = await a.assertion(item);
    const inbox = await b.call('/api/requests', undefined, 'GET');
    assert.ok(inbox.data.every(r => r.snapshot.buyer_id === 'buyer-b'));
    assert.equal((await b.call(`/api/requests/${item.snapshot.request_id}/options`, { digest: item.digest })).status, 404);
    assert.equal((await approve(b, item, proof)).status, 403);
    const own = await create({ buyer_id: 'buyer-b' });
    assert.equal((await approve(b, own, await b.assertion(own))).status, 200);
  });
  await check('14 signature validation: wrong origin, RP hash, challenge, UV, user presence, and type denied', async () => {
    for (const attack of ['origin', 'challenge', 'type', 'crossOrigin', 'rpHash', 'uv', 'up']) {
      const item = await create(), proof = await a.assertion(item);
      await alterAndSign(a, proof, attack);
      assert.equal((await approve(a, item, proof)).status, 400, attack);
      assert.equal(status(item), 'pending');
    }
  });
  await check('15 previous approval invalidated by revision; rejected and withdrawn consent cannot be consumed', async () => {
    const item = await create(); await approve(a, item, await a.assertion(item));
    const revised = await revise(item, { amount: '3.00' }); assert.equal(revised.status, 200);
    assert.equal((await consume(a, item)).status, 409);
    assert.equal(revised.data.consent_digest, null);
    assert.equal((await a.call(`/api/requests/${item.snapshot.request_id}/reject`, { digest: revised.data.digest })).status, 200);
    const other = await create(); await approve(a, other, await a.assertion(other));
    assert.equal((await a.call(`/api/requests/${other.snapshot.request_id}/withdraw`, { digest: other.digest })).status, 200);
    assert.equal((await consume(a, other)).status, 409);
  });
  await check('16 request validation, CSRF, host/origin, anonymous access and role injection', async () => {
    assert.equal((await helper.call('/api/requests', sample({ amount: '1.001' }))).status, 400);
    assert.equal((await helper.call('/api/requests', sample({ amount: '-1' }))).status, 400);
    assert.equal((await helper.call('/api/requests', sample({ currency: 'GBP' }))).status, 400);
    assert.equal((await a.call('/api/requests', sample())).status, 403);
    assert.equal((await helper.call('/api/register/options', {}, 'POST', { 'X-CSRF-Token': 'wrong' })).status, 403);
    const badOrigin = await fetch(`${h.origin}/api/login`, { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(badOrigin.status, 403);
    assert.equal((await fetch(`${h.origin}/api/requests`)).status, 401);
    assert.equal(await wrongHost(h.origin), 403);
    assert.equal((await helper.call('/api/login', { username: 'buyer-a', password: 'wrong', role: 'buyer' })).status, 400);
  });
  await check('17 usable UI: native registration/approval path, safe text, focus and automated accessibility', async () => {
    // Use existing enrolled buyer and UI; previous API tests did not bypass the verifier.
    const item = await create({ merchant_name: '<img src=x onerror=alert(1)>', description: '<script>alert(1)</script>' });
    await a.page.reload();
    const article = a.page.getByRole('article').filter({ hasText: item.snapshot.request_id });
    assert.equal(await article.locator('img,script').count(), 0);
    await article.getByRole('checkbox').check();
    await article.getByRole('button', { name: 'Approve using my passkey — synthetic request' }).click();
    await a.page.getByRole('status').filter({ hasText: 'Consent approved for these exact details.' }).waitFor();
    assert.equal(await article.getByRole('heading', { level: 3 }).evaluate(e => document.activeElement === e), true);
    assert.equal(status(item), 'approved');
    const results = await new AxeBuilder({ page: a.page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    assert.equal(results.violations.length, 0, JSON.stringify(results.violations.map(v => ({ id: v.id, impact: v.impact }))));
    await a.page.setViewportSize({ width: 320, height: 800 });
    assert.equal(await a.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await helper.page.reload();
    const helperAxe = await new AxeBuilder({ page: helper.page }).analyze();
    assert.equal(helperAxe.violations.length, 0);
  });
  await check('18 privacy/boundary: local traffic only, hashed sessions, no helper consent events', async () => {
    assert.deepEqual(h.forbidden, []);
    const cookies = await a.context.cookies(); const cookie = cookies.find(c => c.name === 'consent_session');
    assert.equal(cookie.httpOnly, true); assert.equal(cookie.sameSite, 'Strict');
    assert.ok(h.store.all('SELECT id FROM sessions').every(row => row.id !== cookie.value));
    assert.equal(h.store.get("SELECT COUNT(*) AS n FROM events WHERE actor='helper' AND event='consent_approved'").n, 0);
  });
  await check('19 second session for same buyer cannot reuse another session challenge', async () => {
    const second = await h.actor('buyer-a', false);
    const item = await create(), proof = await a.assertion(item);
    assert.equal((await approve(second, item, proof)).status, 403);
    assert.equal((await approve(a, item, proof)).status, 200);
  });
  await check('20 withdrawal versus consumption: twenty races each serialize to one winner', async () => {
    for (let n = 0; n < 20; n++) {
      const item = await create(); await approve(a, item, await a.assertion(item));
      const results = await Promise.all([consume(a, item),
        a.call(`/api/requests/${item.snapshot.request_id}/withdraw`, { digest: item.digest })]);
      assert.equal(results.filter(r => r.status === 200).length, 1);
      assert.ok(['consumed', 'withdrawn'].includes(status(item)));
    }
  });
  await writeFile(`${h.databasePath}.security-results.json`, JSON.stringify({
    checked_at: new Date().toISOString(), browser: browserVersion,
    authenticator: 'Chrome CDP virtual CTAP2 with resident keys and UV; NOT a physical/user passkey',
    financial_data: 'synthetic only', mock_verifier: false, forbidden_network_origins: h.forbidden,
    results: records, manual_physical_passkey: 'NOT_EXECUTED',
  }, null, 2) + '\n');
});
