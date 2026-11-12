import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../src/store.mjs';
import { authenticate, issueSession, provisionStaging, sessionFor } from '../src/identity.mjs';

test('staging account rotation changes only the three expected accounts and invalidates sessions', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'saysure-staging-rotation-'));
  const store = openStore(join(directory, 'staging.sqlite'));
  t.after(async () => { store.close(); await rm(directory, { recursive: true, force: true }); });

  const initial = {
    STAGING_HELPER_PASSWORD: 'initial-helper-secret-2026',
    STAGING_BUYER_A_PASSWORD: 'initial-buyer-a-secret-2026',
    STAGING_BUYER_B_PASSWORD: 'initial-buyer-b-secret-2026'
  };
  assert.deepEqual(await provisionStaging(store, initial), { created: true, users: 3 });
  assert.equal(authenticate(store, 'helper', initial.STAGING_HELPER_PASSWORD).role, 'helper');
  assert.equal(authenticate(store, 'buyer-a', initial.STAGING_BUYER_A_PASSWORD).role, 'buyer');

  await store.run('INSERT INTO credentials VALUES(?,?,?,?,?,?,?)',
    'buyer-a-passkey', 'buyer-a', Buffer.from([1, 2, 3]), 0, '[]', 'singleDevice', 0);
  await store.run('INSERT INTO requests VALUES(?,?,?,?,?,?,?,?)',
    'staging-request', 'helper', 'buyer-a', JSON.stringify({ expires_at: Date.now() + 60_000 }),
    'review-digest', 'pending', null, null);

  const session = issueSession(store, 'helper');
  const cookie = 'consent_session=' + session.token;
  assert.ok(sessionFor(store, cookie));

  const invalidRotation = {
    STAGING_ROTATE_PASSWORDS: 'true',
    STAGING_HELPER_PASSWORD: 'too-short',
    STAGING_BUYER_A_PASSWORD: 'replacement-buyer-a-secret-2026',
    STAGING_BUYER_B_PASSWORD: 'replacement-buyer-b-secret-2026'
  };
  await assert.rejects(provisionStaging(store, invalidRotation), /STAGING_BOOTSTRAP_PASSWORDS_REQUIRED/);
  assert.equal(authenticate(store, 'helper', initial.STAGING_HELPER_PASSWORD).role, 'helper');

  const replacement = {
    STAGING_ROTATE_PASSWORDS: 'true',
    STAGING_HELPER_PASSWORD: 'replacement-helper-secret-2026',
    STAGING_BUYER_A_PASSWORD: 'replacement-buyer-a-secret-2026',
    STAGING_BUYER_B_PASSWORD: 'replacement-buyer-b-secret-2026'
  };
  assert.deepEqual(await provisionStaging(store, replacement), { created: false, rotated: true, users: 3 });
  assert.throws(() => authenticate(store, 'helper', initial.STAGING_HELPER_PASSWORD), /LOGIN_FAILED/);
  assert.throws(() => authenticate(store, 'buyer-a', initial.STAGING_BUYER_A_PASSWORD), /LOGIN_FAILED/);
  assert.equal(authenticate(store, 'helper', replacement.STAGING_HELPER_PASSWORD).role, 'helper');
  assert.equal(authenticate(store, 'buyer-a', replacement.STAGING_BUYER_A_PASSWORD).role, 'buyer');
  assert.equal(authenticate(store, 'buyer-b', replacement.STAGING_BUYER_B_PASSWORD).role, 'buyer');
  assert.equal(sessionFor(store, cookie), null);
  assert.equal((await store.get('SELECT COUNT(*) AS n FROM users')).n, 3);
  assert.equal((await store.get('SELECT COUNT(*) AS n FROM credentials')).n, 1);
  assert.equal((await store.get('SELECT COUNT(*) AS n FROM requests')).n, 1);
  assert.deepEqual(await provisionStaging(store, {
    STAGING_HELPER_PASSWORD: 'ignored-secret-2026',
    STAGING_BUYER_A_PASSWORD: 'ignored-secret-2026',
    STAGING_BUYER_B_PASSWORD: 'ignored-secret-2026'
  }), { created: false, users: 3 });
  assert.equal(authenticate(store, 'helper', replacement.STAGING_HELPER_PASSWORD).role, 'helper');
});
