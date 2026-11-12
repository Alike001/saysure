import { randomBytes } from 'node:crypto';
import { ensure, random, sha } from './core.mjs';
import { passwordRecord } from './identity.mjs';

// Public judge trials are explicitly synthetic and isolated. Buyer credentials are
// never issued to the Helper. High-entropy invitation codes are single-use.
export function trialAccess(store, requests) {
  async function create() {
    ensure(store.dialect === 'postgres' || store.dialect === 'sqlite', 'TRIAL_UNAVAILABLE', 503);
    const count = await store.get("SELECT COUNT(*) AS n FROM users WHERE id LIKE 'trial-%-h'");
    ensure(Number(count?.n) < 40, 'TRIAL_CAPACITY_REACHED', 429);
    const id = 'trial-' + randomBytes(6).toString('hex');
    const helperId = id + '-h', buyerId = id + '-b';
    const password = random(), unusedBuyerSecret = random(), invitation = random();
    const helperHash = passwordRecord(password), buyerHash = passwordRecord(unusedBuyerSecret);
    await store.transaction(async tx => {
      await tx.run('INSERT INTO users VALUES(?,?,?,?)', helperId, 'helper', helperHash.salt, helperHash.hash);
      await tx.run('INSERT INTO users VALUES(?,?,?,?)', buyerId, 'buyer', buyerHash.salt, buyerHash.hash);
      await tx.run('INSERT INTO trial_invites VALUES(?,?,?,?,?)',
        sha(invitation), helperId, buyerId, Date.now() + 30 * 60_000, null);
    });
    // Explicit synthetic sample in the actual workspace; this is not imported PayPal evidence.
    await requests.create({ user_id: helperId, role: 'helper' }, {
      buyer_id: buyerId, merchant_id: 'SYNTH-CAMPUS-SHOP',
      merchant_name: 'Sample Campus Shop (fictional)', amount: '12.00', currency: 'USD',
      description: 'Synthetic stationery kit — no real goods or money',
      lifetime_minutes: 30
    });
    return { username: helperId, password, buyer_username: buyerId, invitation };
  }
  async function claim(invitation) {
    ensure(typeof invitation === 'string' && /^[A-Za-z0-9_-]{43}$/.test(invitation), 'INVITATION_INVALID', 400);
    const password = random(), record = passwordRecord(password);
    const user = await store.transaction(async tx => {
      const invite = await tx.get('SELECT * FROM trial_invites WHERE token_hash=?', sha(invitation));
      ensure(invite && invite.claimed === null && Number(invite.expires) > Date.now(),
        'INVITATION_INVALID_OR_EXPIRED', 403);
      const changed = await tx.run('UPDATE trial_invites SET claimed=? WHERE token_hash=? AND claimed IS NULL AND expires>?',
        Date.now(), sha(invitation), Date.now());
      ensure(changed.changes === 1, 'INVITATION_ALREADY_CLAIMED', 403);
      const updated = await tx.run("UPDATE users SET salt=?,password_hash=? WHERE id=? AND role='buyer'",
        record.salt, record.hash, invite.buyer_id);
      ensure(updated.changes === 1, 'INVITATION_ACCOUNT_MISSING', 409);
      return invite.buyer_id;
    });
    return { username: user, password };
  }
  return { create, claim };
}
