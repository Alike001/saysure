import { scryptSync, timingSafeEqual, randomBytes } from 'node:crypto';
import { ensure, random, sha } from './core.mjs';

export function provision(store) {
  ensure(store.get('SELECT COUNT(*) AS n FROM users').n === 0, 'ALREADY_PROVISIONED');
  const accounts = [];
  store.atomic(() => {
    for (const [id, role] of [['helper', 'helper'], ['buyer-a', 'buyer'], ['buyer-b', 'buyer']]) {
      const password = random();
      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync(password, salt, 32).toString('hex');
      store.run('INSERT INTO users VALUES(?,?,?,?)', id, role, salt, hash);
      accounts.push({ username: id, role, password });
    }
  });
  return accounts;
}
export function authenticate(store, username, password) {
  ensure(typeof username === 'string' && typeof password === 'string' && password.length <= 200,
    'LOGIN_FAILED', 401);
  const user = store.get('SELECT * FROM users WHERE id=?', username);
  // Equal KDF work for unknown users. Bootstrap secrets must be distributed independently.
  const computed = scryptSync(password, user?.salt ?? 'unknown-account-salt', 32);
  const expected = Buffer.from(user?.password_hash ?? '0'.repeat(64), 'hex');
  ensure(timingSafeEqual(computed, expected) && user, 'LOGIN_FAILED', 401);
  return user;
}
export function issueSession(store, userId, oldToken) {
  const token = random(), csrf = random();
  store.atomic(() => {
    if (oldToken) store.run('DELETE FROM sessions WHERE id=?', sha(oldToken));
    store.run('INSERT INTO sessions VALUES(?,?,?,?)', sha(token), userId, csrf, Date.now() + 30 * 60_000);
  });
  return { token, csrf };
}
export function sessionFor(store, cookie = '') {
  const token = cookie.split(';').map(p => p.trim()).find(p => p.startsWith('consent_session='))?.slice(16);
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return store.get(`SELECT sessions.*, users.role FROM sessions JOIN users ON users.id=sessions.user_id
    WHERE sessions.id=? AND sessions.expires>?`, sha(token), Date.now()) ?? null;
}
export function buyer(session) { ensure(session?.role === 'buyer', 'BUYER_SESSION_REQUIRED', 403); }
export function helper(session) { ensure(session?.role === 'helper', 'HELPER_SESSION_REQUIRED', 403); }
