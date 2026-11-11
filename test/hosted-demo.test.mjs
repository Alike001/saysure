import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import { demoServer } from '../src/demo-server.mjs';

function call(base, host, path, { method = 'GET', origin, body } = {}) {
  const url = new URL(base);
  return new Promise((resolve, reject) => {
    const headers = { host };
    if (origin) headers.origin = origin;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const req = request({ hostname: url.hostname, port: Number(url.port), path, method, headers }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, text, json: () => JSON.parse(text) });
      });
    });
    req.on('error', reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

test('public demo: only synthetic viewer and redacted question routing, no authenticated APIs', async t => {
  const publicUrl = 'https://saysure-synthetic-test.onrender.com';
  const server = demoServer({ publicUrl });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { await new Promise(resolve => server.close(resolve)); server.closeAllConnections(); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const host = 'saysure-synthetic-test.onrender.com';

  const page = await call(base, host, '/');
  assert.equal(page.status, 200);
  assert.match(page.text, /Start the guided demo/);
  assert.match(page.text, /DEMO ONLY — interactive simulation/);
  assert.match(page.text, /Your money. Your final say/);
  assert.doesNotMatch(page.text, /account secret|PAYPAL_CLIENT_SECRET|GROQ_API_KEY=/);

  const css = await call(base, host, '/style.css');
  assert.equal(css.status, 200);
  assert.match(css.text, /#071d3d|--navy/);

  const ai = await call(base, host, '/api/demo-question', {
    method: 'POST', origin: publicUrl, body: { question: 'Does my passkey make a payment?' }
  });
  assert.equal(ai.status, 200);
  assert.deepEqual(ai.json(), { topic: 'consent', source: 'local' });

  const wrongOrigin = await call(base, host, '/api/demo-question', {
    method: 'POST', origin: 'https://evil.example', body: { question: 'What is the amount?' }
  });
  assert.equal(wrongOrigin.status, 403);

  assert.equal((await call(base, 'localhost', '/')).status, 403);
  assert.equal((await call(base, host, '/api/requests')).status, 404);
  assert.equal((await call(base, host, '/api/login')).status, 404);
  assert.equal((await call(base, host, '/.env')).status, 404);
  assert.equal((await call(base, host, '/healthz')).status, 200);
});

test('public demo refuses an insecure configured public origin', () => {
  assert.throws(() => demoServer({ publicUrl: 'http://saysure.onrender.com' }), /INVALID_PUBLIC_DEMO_ORIGIN/);
});
