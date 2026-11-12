import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness.mjs';

test('judge trial: real isolated Helper and Buyer accounts, seeded synthetic request, single-use invitation, scoped actions', { timeout: 100000 }, async t => {
  const h = await harness(); t.after(() => h.close());
  const hctx = await h.browser.newContext(), helper = await hctx.newPage();
  const bctx = await h.browser.newContext(), buyer = await bctx.newPage();
  const otherCtx = await h.browser.newContext(), other = await otherCtx.newPage();
  for (const page of [helper, buyer, other]) await page.goto(h.origin + '/app');

  await helper.getByRole('button', { name: 'Create private test workspace' }).click();
  await helper.getByText('Save your test workspace access').waitFor();
  const helperId = await helper.locator('#trial-username').innerText();
  const helperPassword = await helper.locator('#trial-password').innerText();
  const invitation = await helper.locator('#trial-invitation').innerText();
  assert.match(helperId, /^trial-[a-f0-9]{12}-h$/);
  assert.ok(helperPassword.length >= 40);
  assert.match(invitation, /^[A-Za-z0-9_-]{43}$/);
  const seeded = await helper.evaluate(async () => (await fetch('/api/requests')).json());
  assert.equal(seeded.length, 1);
  assert.equal(seeded[0].synthetic, true);
  assert.equal(seeded[0].display_amount, '12.00 USD');
  const counterpart = helperId.replace(/-h$/, '-b');
  const buyers = await helper.evaluate(async () => (await fetch('/api/buyers')).json());
  assert.deepEqual(buyers, [{ id: counterpart }]);
  await helper.reload();
  assert.match(await helper.locator('#identity').innerText(), /Role: helper/);

  await buyer.locator('#trial-code').fill(invitation);
  await buyer.getByRole('button', { name: 'Join as Buyer' }).click();
  await buyer.getByText('Save your test workspace access').waitFor();
  assert.equal(await buyer.locator('#trial-username').innerText(), counterpart);
  const buyerPassword = await buyer.locator('#trial-password').innerText();
  assert.ok(buyerPassword.length >= 40);
  assert.notEqual(buyerPassword, helperPassword);
  const received = await buyer.evaluate(async () => (await fetch('/api/requests')).json());
  assert.equal(received.length, 1);
  assert.equal(received[0].snapshot.request_id, seeded[0].snapshot.request_id);
  await other.locator('#trial-code').fill(invitation);
  await other.getByRole('button', { name: 'Join as Buyer' }).click();
  await other.locator('#message').filter({ hasText: 'INVITATION_INVALID_OR_EXPIRED' }).waitFor();
  const access = await buyer.evaluate(async () => {
    const res = await fetch('/api/buyers'); return res.status;
  });
  assert.equal(access, 403);
  const tryImport = await helper.evaluate(async () => {
    const s = await (await fetch('/api/session')).json();
    return (await fetch('/api/paypal/requests', { method:'POST',
      headers:{ 'Content-Type':'application/json','X-CSRF-Token':s.csrf },body:'{}' })).status;
  });
  assert.equal(tryImport, 403);
  const decline = await buyer.evaluate(async id => {
    const s = await (await fetch('/api/session')).json();
    return fetch('/api/requests/' + id + '/reject', { method:'POST',
      headers:{ 'Content-Type':'application/json','X-CSRF-Token':s.csrf },
      body:JSON.stringify({ digest: (await (await fetch('/api/requests')).json())[0].digest }) }).then(x=>x.status);
  }, received[0].snapshot.request_id);
  assert.equal(decline, 200);
  assert.equal((await helper.evaluate(async () => (await fetch('/api/requests')).json()))[0].status, 'rejected');
  assert.deepEqual(await otherCtx.cookies(), []);
});

test('judge trial enforces Helper buyer scope and prevents forged cross-trial requests', { timeout: 100000 }, async t => {
  const h = await harness(); t.after(() => h.close());
  const pages = [];
  for (let i = 0; i < 2; i++) {
    const ctx = await h.browser.newContext();
    const page = await ctx.newPage(); pages.push(page); await page.goto(h.origin + '/app');
    await page.getByRole('button', { name: 'Create private test workspace' }).click();
    await page.getByText('Save your test workspace access').waitFor();
  }
  const a = await pages[0].locator('#trial-username').innerText();
  const b = await pages[1].locator('#trial-username').innerText();
  const result = await pages[0].evaluate(async buyerId => {
    const s = await (await fetch('/api/session')).json();
    const response = await fetch('/api/requests', { method:'POST',headers:{
      'Content-Type':'application/json','X-CSRF-Token':s.csrf },
      body:JSON.stringify({buyer_id:buyerId,merchant_id:'SYNTH-A',merchant_name:'Example',amount:'1.00',
        currency:'USD',description:'Fictional test',lifetime_minutes:10})});
    return {status:response.status,data:await response.json()};
  }, b.replace(/-h$/, '-b'));
  assert.equal(result.status, 403);
  assert.equal(result.data.error, 'TRIAL_BUYER_SCOPE');
  assert.notEqual(a,b);
});
