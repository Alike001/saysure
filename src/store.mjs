import { DatabaseSync } from 'node:sqlite';
import { ensure } from './core.mjs';

export function openStore(path) {
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;
    PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, role TEXT NOT NULL,
      salt TEXT NOT NULL, password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS credentials(id TEXT PRIMARY KEY, buyer_id TEXT NOT NULL UNIQUE
      REFERENCES users(id), public_key BLOB NOT NULL, counter INTEGER NOT NULL,
      transports TEXT NOT NULL, device_type TEXT NOT NULL, backed_up INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
      csrf TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY, helper_id TEXT NOT NULL REFERENCES users(id),
      buyer_id TEXT NOT NULL REFERENCES users(id), snapshot TEXT NOT NULL, digest TEXT NOT NULL,
      status TEXT NOT NULL, consent_digest TEXT, consumed_at INTEGER);
    CREATE TABLE IF NOT EXISTS challenges(id TEXT PRIMARY KEY, session_id TEXT NOT NULL,
      buyer_id TEXT NOT NULL, kind TEXT NOT NULL, request_id TEXT, digest TEXT,
      challenge TEXT NOT NULL, expires INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS paypal_bindings(request_id TEXT PRIMARY KEY REFERENCES requests(id),
      order_id TEXT NOT NULL UNIQUE, observed_at INTEGER NOT NULL, available INTEGER NOT NULL, provenance TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY, at INTEGER NOT NULL,
      actor TEXT NOT NULL, event TEXT NOT NULL, request_id TEXT);`);
  function atomic(fn) {
    db.exec('BEGIN IMMEDIATE');
    try { const value = fn(); db.exec('COMMIT'); return value; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  const get = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const event = (actor, name, id = null) => run(
    'INSERT INTO events(at,actor,event,request_id) VALUES(?,?,?,?)', Date.now(), actor, name, id);
  function expire(now = Date.now()) {
    // Expiry is an authoritative state transition, never only a browser timer.
    for (const row of all("SELECT * FROM requests WHERE status IN ('pending','approved')")) {
      if (JSON.parse(row.snapshot).expires_at <= now) {
        run("UPDATE requests SET status='expired',consent_digest=NULL WHERE id=?", row.id);
        run('UPDATE challenges SET used=1 WHERE request_id=?', row.id);
      }
    }
  }
  function request(id) {
    expire();
    const row = get('SELECT * FROM requests WHERE id=?', id);
    ensure(row, 'REQUEST_NOT_FOUND', 404);
    return row;
  }
  return { db, get, all, run, atomic, event, expire, request, close: () => db.close() };
}
