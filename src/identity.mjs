import { scryptSync, timingSafeEqual, randomBytes } from 'node:crypto';
import { ensure, random, sha } from './core.mjs';

const roles = [['helper', 'helper'], ['buyer-a', 'buyer'], ['buyer-b', 'buyer']];
function passwordRecord(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 32).toString('hex');
  return { salt, hash };
}

export function provision(store) {
  if (store.dialect === 'postgres') return provisionPostgres(store);
  ensure(store.get('SELECT COUNT(*) AS n FROM users').n === 0, 'ALREADY_PROVISIONED');
  const accounts = [];
  store.atomic(() => {
    for (const [id, role] of roles) {
      const password = random();
      const { salt, hash } = passwordRecord(password);
      store.run('INSERT INTO users VALUES(?,?,?,?)', id, role, salt, hash);
      accounts.push({ username: id, role, password });
    }
  });
  return accounts;
}

async function provisionPostgres(store) {
  ensure((await store.get('SELECT COUNT(*) AS n FROM users')).n === 0, 'ALREADY_PROVISIONED');
  const accounts = roles.map(([username, role]) => ({ username, role, password: random() }));
  await store.transaction(async tx => {
    for (const account of accounts) {
      const { salt, hash } = passwordRecord(account.password);
      await tx.run('INSERT INTO users VALUES(?,?,?,?)', account.username, account.role, salt, hash);
    }
  });
  return accounts;
}

// Staging credentials are supplied through the deployment's private environment settings.
// This function never prints or persists the plaintext passwords.
export async function provisionStaging(store, env) {
  const current = await store.get('SELECT COUNT(*) AS n FROM users');
  if (Number(current?.n) === 3) return { created: false, users: 3 };
  ensure(Number(current?.n) === 0, 'STAGING_ACCOUNT_STATE_UNEXPECTED', 503);
  const accounts = [
    ['helper', 'helper', env.STAGING_HELPER_PASSWORD],
    ['buyer-a', 'buyer', env.STAGING_BUYER_A_PASSWORD],
    ['buyer-b', 'buyer', env.STAGING_BUYER_B_PASSWORD],
  ];
  for (const [id, , password] of accounts) {
    ensure(typeof password === 'string' && password.length >= 16 && password.length <= 200 &&
      !/[\r\n]/.test(password), 'STAGING_BOOTSTRAP_PASSWORDS_REQUIRED', 503);
  }
  await store.transaction(async tx => {
    ensure(Number((await tx.get('SELECT COUNT(*) AS n FROM users')).n) === 0,
      'STAGING_ACCOUNT_STATE_CHANGED', 503);
    for (const [id, role, password] of accounts) {
      const { salt, hash } = passwordRecord(password);
      await tx.run('INSERT INTO users VALUES(?,?,?,?)', id, role, salt, hash);
    }
  });
  return { created: true, users: 3 };
}

export function authenticate(store, username, password) {
  if (store.dialect === 'postgres') return authenticatePostgres(store, username, password);
  ensure(typeof username === 'string' && typeof password === 'string' && password.length <= 200,
    'LOGIN_FAILED', 401);
  const user = store.get('SELECT * FROM users WHERE id=?', username);
  const computed = scryptSync(password, user?.salt ?? 'unknown-account-salt', 32);
  const expected = Buffer.from(user?.password_hash ?? '0'.repeat(64), 'hex');
  ensure(timingSafeEqual(computed, expected) && user, 'LOGIN_FAILED', 401);
  return user;
}

async function authenticatePostgres(store, username, password) {
  ensure(typeof username === 'string' && typeof password === 'string' && password.length <= 200,
    'LOGIN_FAILED', 401);
  const user = await store.get('SELECT * FROM users WHERE id=?', username);
  const computed = scryptSync(password, user?.salt ?? 'unknown-account-salt', 32);
  const expected = Buffer.from(user?.password_hash ?? '0'.repeat(64), 'hex');
  ensure(timingSafeEqual(computed, expected) && user, 'LOGIN_FAILED', 401);
  return user;
}

export function issueSession(store, userId, oldToken) {
  if (store.dialect === 'postgres') return issuePostgresSession(store, userId, oldToken);
  const token = random(), csrf = random();
  store.atomic(() => {
    if (oldToken) store.run('DELETE FROM sessions WHERE id=?', sha(oldToken));
    store.run('INSERT INTO sessions VALUES(?,?,?,?)', sha(token), userId, csrf, Date.now() + 30 * 60_000);
  });
  return { token, csrf };
}

async function issuePostgresSession(store, userId, oldToken) {
  const token = random(), csrf = random();
  await store.transaction(async tx => {
    if (oldToken) await tx.run('DELETE FROM sessions WHERE id=?', sha(oldToken));
    await tx.run('INSERT INTO sessions VALUES(?,?,?,?)', sha(token), userId, csrf, Date.now() + 30 * 60_000);
  });
  return { token, csrf };
}

export function sessionFor(store, cookie = '') {
  const token = cookie.split(';').map(p => p.trim()).find(p => p.startsWith('consent_session='))?.slice(16);
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return store.get(`SELECT sessions.*, users.role FROM sessions JOIN users ON users.id=sessions.user_id
    WHERE sessions.id=? AND sessions.expires>?`, sha(token), Date.now());
}
export function buyer(session) { ensure(session?.role === 'buyer', 'BUYER_SESSION_REQUIRED', 403); }
export function helper(session) { ensure(session?.role === 'helper', 'HELPER_SESSION_REQUIRED', 403); }
