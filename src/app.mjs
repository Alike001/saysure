import { assertLocalExperiment } from './origin.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { Failure, ensure } from './core.mjs';
import { authenticate, issueSession, sessionFor } from './identity.mjs';
import { requestService } from './requests.mjs';
import { passkeyService } from './passkeys.mjs';

const root = new URL('../', import.meta.url);
const assets = new Map([
  ['/', ['public/index.html', 'text/html']], ['/app.js', ['public/app.js', 'text/javascript']],
  ['/comprehension.js', ['public/comprehension.js', 'text/javascript']],
  ['/presentation.js', ['public/presentation.js', 'text/javascript']],
  ['/review.js', ['public/review.js', 'text/javascript']], ['/style.css', ['public/style.css', 'text/css']],
  ['/webauthn.js', ['node_modules/@simplewebauthn/browser/dist/bundle/index.umd.min.js', 'text/javascript']],
]);
async function jsonBody(req) {
  ensure(req.headers['content-type'] === 'application/json', 'JSON_REQUIRED', 415);
  let bytes = 0, chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length; ensure(bytes <= 24_000, 'BODY_TOO_LARGE', 413); chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    ensure(value && typeof value === 'object' && !Array.isArray(value), 'INVALID_JSON', 400);
    return value;
  } catch { throw new Failure('INVALID_JSON', 400); }
}
function keys(input, allowed) {
  ensure(Object.keys(input).every(k => allowed.includes(k)), 'UNKNOWN_FIELD', 400);
}
export function makeApp(store, config) {
  assertLocalExperiment(config);
  const requests = requestService(store), passkeys = passkeyService(store, requests, config);
  const attempts = new Map();
  const cookie = token => `consent_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=1800${
    config.origin.startsWith('https:') ? '; Secure' : ''}`;
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), payment=()');
    function send(status, data) {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data));
    }
    try {
      ensure(req.headers.host === new URL(config.origin).host, 'INVALID_HOST', 403);
      ensure(!req.headers['sec-fetch-site'] || ['same-origin', 'none'].includes(req.headers['sec-fetch-site']),
        'CROSS_SITE_DENIED', 403);
      const url = new URL(req.url, config.origin);
      ensure(!url.search, 'QUERY_NOT_SUPPORTED', 400);
      if (req.method === 'GET' && assets.has(url.pathname)) {
        const [file, type] = assets.get(url.pathname);
        res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
        res.end(await readFile(new URL(file, root))); return;
      }
      const session = sessionFor(store, req.headers.cookie);
      if (req.method === 'GET' && url.pathname === '/api/session') {
        send(200, session ? { user: { id: session.user_id, role: session.role }, csrf: session.csrf,
          enrolled: !!passkeys.credential(session.user_id), origin: config.origin, rpID: config.rpID }
          : { user: null, origin: config.origin, rpID: config.rpID }); return;
      }
      if (req.method === 'GET' && url.pathname === '/api/requests') {
        ensure(session, 'LOGIN_REQUIRED', 401); send(200, requests.list(session)); return;
      }
      if (req.method === 'GET' && url.pathname === '/api/buyers') {
        ensure(session?.role === 'helper', 'HELPER_SESSION_REQUIRED', 403);
        send(200, store.all("SELECT id FROM users WHERE role='buyer' ORDER BY id")); return;
      }
      ensure(['POST', 'PATCH'].includes(req.method), 'ROUTE_NOT_FOUND', 404);
      ensure(req.headers.origin === config.origin, 'INVALID_ORIGIN', 403);
      const input = await jsonBody(req);
      if (req.method === 'POST' && url.pathname === '/api/login') {
        keys(input, ['username', 'password']);
        const address = req.socket.remoteAddress;
        const now = Date.now(), previous = attempts.get(address);
        const limit = !previous || previous.until <= now ? { count: 0, until: now + 60_000 } : previous;
        attempts.set(address, limit);
        ensure(++limit.count <= 12, 'TOO_MANY_LOGIN_ATTEMPTS', 429);
        const user = authenticate(store, input.username, input.password);
        // Login rotates existing session; password/role never enter a browser-selected session.
        const issued = issueSession(store, user.id);
        if (session) store.run('DELETE FROM sessions WHERE id=?', session.id);
        res.setHeader('Set-Cookie', cookie(issued.token)); send(200, { logged_in: true }); return;
      }
      ensure(session, 'LOGIN_REQUIRED', 401);
      ensure(req.headers['x-csrf-token'] === session.csrf, 'CSRF_REQUIRED', 403);
      if (req.method === 'POST' && url.pathname === '/api/logout') {
        keys(input, []);
        store.atomic(() => {
          store.run('DELETE FROM sessions WHERE id=?', session.id);
          store.run('UPDATE challenges SET used=2 WHERE session_id=?', session.id);
        });
        res.setHeader('Set-Cookie', 'consent_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
        send(200, { logged_out: true }); return;
      }
      if (req.method === 'POST' && url.pathname === '/api/register/options') {
        keys(input, []); send(200, await passkeys.registrationOptions(session)); return;
      }
      if (req.method === 'POST' && url.pathname === '/api/register/verify') {
        keys(input, ['challengeId', 'response']); send(200, await passkeys.register(session, input)); return;
      }
      if (req.method === 'POST' && url.pathname === '/api/requests') {
        send(201, requests.create(session, input)); return;
      }
      const match = url.pathname.match(/^\/api\/requests\/(SYNTH-[a-f0-9-]{36})(?:\/(options|approve|reject|withdraw|consume))?$/);
      ensure(match, 'ROUTE_NOT_FOUND', 404);
      const [, id, action] = match;
      if (req.method === 'PATCH' && !action) { send(200, requests.revise(session, id, input)); return; }
      ensure(req.method === 'POST' && action, 'ROUTE_NOT_FOUND', 404);
      keys(input, action === 'approve' ? ['challengeId', 'response'] : ['digest']);
      if (action === 'options') send(200, await passkeys.approvalOptions(session, id, input.digest));
      else if (action === 'approve') send(200, await passkeys.approve(session, id, input));
      else send(200, requests.action(session, id, action, input.digest));
    } catch (error) {
      send(error instanceof Failure ? error.status : 500,
        { error: error instanceof Failure ? error.message : 'INTERNAL_ERROR' });
    }
  });
  server.requestTimeout = 15_000; server.headersTimeout = 10_000;
  return { server, requests, passkeys };
}
