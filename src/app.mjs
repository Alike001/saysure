import { randomUUID } from 'node:crypto';
import { classifyRoute } from './routes.mjs';
import { consumptionService } from './consumption.mjs';
import { consumptionDiagnostics } from './consumption-diagnostics.mjs';
import { paypalRequests } from './paypal-requests.mjs';
import { assertOriginConfig } from './origin.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { Failure, ensure } from './core.mjs';
import { authenticate, issueSession, sessionFor } from './identity.mjs';
import { requestService } from './requests.mjs';
import { passkeyService } from './passkeys.mjs';
import { createBuyerQuestionRouter } from './buyer-question.mjs';

const root = new URL('../', import.meta.url);
const assets = new Map([
  ['/', ['public/landing.html', 'text/html']], ['/demo', ['public/demo.html', 'text/html']],
  ['/demo.html', ['public/demo.html', 'text/html']], ['/app', ['public/index.html', 'text/html']],
  ['/landing.css', ['public/landing.css', 'text/css']], ['/app.js', ['public/app.js', 'text/javascript']],
  ['/demo.js', ['public/demo.js', 'text/javascript']], ['/buyer-help.js', ['public/buyer-help.js', 'text/javascript']],
  ['/comprehension.js', ['public/comprehension.js', 'text/javascript']],
  ['/presentation.js', ['public/presentation.js', 'text/javascript']],
  ['/review.js', ['public/review.js', 'text/javascript']],
  ['/consumption.js', ['public/consumption.js', 'text/javascript']],
  ['/evidence-provenance.js', ['public/evidence-provenance.js', 'text/javascript']],
  ['/consent-shape.js', ['public/consent-shape.js', 'text/javascript']], ['/style.css', ['public/style.css', 'text/css']],
  ['/webauthn.js', ['node_modules/@simplewebauthn/browser/dist/bundle/index.umd.min.js', 'text/javascript']],
]);
async function jsonBody(req, maxBytes = 24_000) {
  ensure(req.headers['content-type'] === 'application/json', 'JSON_REQUIRED', 415);
  let bytes = 0, chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length; ensure(bytes <= maxBytes, 'BODY_TOO_LARGE', 413); chunks.push(chunk);
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
  assertOriginConfig(config);
  const requests = requestService(store);
  const paypal = paypalRequests(store, requests, config.paypal);
  const diagnostics = consumptionDiagnostics(store, config.consumptionDiagnostics);
  const consumption = consumptionService(store, requests, paypal, config.consumption);
  const passkeys = passkeyService(store, requests, config, paypal);
  const buyerQuestion = createBuyerQuestionRouter(config.ai);
  const demoQuestion = createBuyerQuestionRouter(config.ai);
  const attempts = new Map();
  const telemetry = new Set();
  const cookie = token => `consent_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=1800${
    config.origin.startsWith('https:') ? '; Secure' : ''}`;
  function recordTrace(correlationId, stage, input = {}) {
    const task = Promise.resolve(diagnostics.record(correlationId, stage, input));
    telemetry.add(task);
    task.finally(() => telemetry.delete(task));
    return task;
  }
  async function flushTelemetry() {
    await Promise.all([...telemetry]);
    await diagnostics.flush();
  }
  const server = createServer(async (req, res) => {
    let route;
    let correlationId = null;
    let lastStage = 'attempt_received';
    const trace = (stage, code = 'OK', eventId) => {
      lastStage = stage;
      if (correlationId) void recordTrace(correlationId, stage, { requestId: route.id, code, eventId });
    };
    function admitConsumptionTrace() {
      correlationId = randomUUID();
      res.setHeader('X-Consumption-Correlation-Id', correlationId);
      trace('attempt_received');
      res.once('finish', () => { void recordTrace(correlationId, 'response_finished', { status: res.statusCode, code: 'OK' }); });
      res.once('close', () => {
        if (!res.writableFinished) void recordTrace(correlationId, 'response_closed', { code: 'INTERNAL_ERROR' });
      });
    }
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
      route = classifyRoute(req.url, req.method);
      const url = route;
      if (req.method === 'GET' && url.pathname === '/healthz') {
        send(200, { status: 'ok', storage: store.dialect }); return;
      }
      if (req.method === 'GET' && url.pathname === '/readyz') {
        await store.ping();
        send(200, { status: 'ready', database: store.dialect }); return;
      }
      if (req.method === 'GET' && assets.has(url.pathname)) {
        const [file, type] = assets.get(url.pathname);
        res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
        res.end(await readFile(new URL(file, root))); return;
      }
      // The public walkthrough shares this origin but remains stateless: this route
      // never reads a workspace session, touches the store, or invokes PayPal.
      if (req.method === 'POST' && url.pathname === '/api/demo-question') {
        ensure(req.headers.origin === config.origin, 'INVALID_ORIGIN', 403);
        const input = await jsonBody(req, 2048);
        keys(input, ['question']);
        const result = await demoQuestion({ question: input.question,
          actor: `demo:${req.socket.remoteAddress || 'unknown'}` });
        send(200, result); return;
      }
      const session = await sessionFor(store, req.headers.cookie);
      if (req.method === 'GET' && url.pathname === '/api/session') {
        send(200, session ? { user: { id: session.user_id, role: session.role }, csrf: session.csrf,
          enrolled: !!await passkeys.credential(session.user_id), origin: config.origin, rpID: config.rpID }
          : { user: null, origin: config.origin, rpID: config.rpID }); return;
      }
      if (req.method === 'GET' && url.pathname === '/api/requests') {
        ensure(session, 'LOGIN_REQUIRED', 401); send(200, await requests.list(session)); return;
      }
      if (req.method === 'GET' && url.pathname === '/api/buyers') {
        ensure(session?.role === 'helper', 'HELPER_SESSION_REQUIRED', 403);
        send(200, await store.all("SELECT id FROM users WHERE role='buyer' ORDER BY id")); return;
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
        const user = await authenticate(store, input.username, input.password);
        const issued = await issueSession(store, user.id);
        if (session) await store.run('DELETE FROM sessions WHERE id=?', session.id);
        res.setHeader('Set-Cookie', cookie(issued.token)); send(200, { logged_in: true }); return;
      }
      ensure(session, 'LOGIN_REQUIRED', 401);
      ensure(req.headers['x-csrf-token'] === session.csrf, 'CSRF_REQUIRED', 403);
      if (req.method === 'POST' && url.pathname === '/api/buyer-question') {
        keys(input, ['question']);
        ensure(session.role === 'buyer', 'BUYER_SESSION_REQUIRED', 403);
        send(200, await buyerQuestion({ question: input.question, actor: session.user_id }));
        return;
      }
      if (route.consumption) {
        ensure(session.role === 'buyer', 'BUYER_SESSION_REQUIRED', 403);
        admitConsumptionTrace();
      }
      if (req.method === 'POST' && url.pathname === '/api/logout') {
        keys(input, []);
        await store.transaction(async tx => {
          await tx.run('DELETE FROM sessions WHERE id=?', session.id);
          await tx.run('UPDATE challenges SET used=2 WHERE session_id=?', session.id);
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
        send(201, await requests.create(session, input)); return;
      }
      if (req.method === 'POST' && url.pathname === '/api/paypal/requests') {
        send(201, await paypal.create(session, input)); return;
      }
      ensure(route.id, 'ROUTE_NOT_FOUND', 404);
      const { id, action } = route;
      if (req.method === 'PATCH' && !action) { send(200, await requests.revise(session, id, input)); return; }
      ensure(req.method === 'POST' && action, 'ROUTE_NOT_FOUND', 404);
      keys(input, action === 'approve' ? ['challengeId', 'response'] : ['digest']);
      if (action === 'refresh-provider') send(200, await paypal.refresh(session, id, input.digest));
      else if (action === 'options') send(200, await passkeys.approvalOptions(session, id, input.digest));
      else if (action === 'approve') send(200, await passkeys.approve(session, id, input));
      else if (action === 'consume') {
        ensure(route.consumption && correlationId, 'CONSUMPTION_ADMISSION_REQUIRED', 500);
        const result = await consumption.consume(session, id, input.digest, trace);
        result.consumption_receipt.correlation_id = correlationId;
        await flushTelemetry();
        send(200, result);
      }
      else send(200, await requests.action(session, id, action, input.digest));
    } catch (error) {
      if (correlationId) trace(['attempt_received', 'validation_passed', 'duplicate_wait'].includes(lastStage)
        ? 'validation_rejected' : 'failed', error instanceof Failure ? error.message : 'INTERNAL_ERROR');
      else if (route?.consumption) await diagnostics.reject(error instanceof Failure ? error.message : 'INTERNAL_ERROR',
        error instanceof Failure ? error.status : 500);
      await flushTelemetry().catch(() => {});
      send(error instanceof Failure ? error.status : 500,
        { error: error instanceof Failure ? error.message : 'INTERNAL_ERROR' });
    }
  });
  server.once('close', () => { void diagnostics.close(); });
  server.requestTimeout = 15_000; server.headersTimeout = 10_000;
  return { server, requests, passkeys, close: () => diagnostics.close() };
}
