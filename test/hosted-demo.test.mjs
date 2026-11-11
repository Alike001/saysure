import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { demoServer } from '../src/demo-server.mjs';

test('public demo: only synthetic viewer and redacted question routing, no authenticated APIs', async t => {
  const publicUrl = 'https://saysure-synthetic-test.onrender.com';
  const server = demoServer({ publicUrl });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { await new Promise(resolve => server.close(resolve)); server.closeAllConnections(); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const host = 'saysure-synthetic-test.onrender.com';
  const headers = { Host: host };

  const page = await fetch(base + '/', { headers });
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /Start the guided demo/);
  assert.match(html, /DEMO ONLY — interactive simulation/);
  assert.match(html, /Your money. Your final say/);
  assert.doesNotMatch(html, /account secret|PAYPAL_CLIENT_SECRET|GROQ_API_KEY=/);

  const css = await fetch(base + '/style.css', { headers });
  assert.equal(css.status, 200);
  assert.match(await css.text(), /#071d3d|--navy/);

  const ai = await fetch(base + '/api/demo-question', {
    method: 'POST', headers: { ...headers, Origin: publicUrl, 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'Does my passkey make a payment?' })
  });
  assert.equal(ai.status, 200);
  assert.deepEqual(await ai.json(), { topic: 'consent', source: 'local' });

  const wrongOrigin = await fetch(base + '/api/demo-question', {
    method: 'POST', headers: { ...headers, Origin: 'https://evil.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'What is the amount?' })
  });
  assert.equal(wrongOrigin.status, 403);

  assert.equal((await fetch(base + '/', { headers: { Host: 'localhost' } })).status, 403);
  assert.equal((await fetch(base + '/api/requests', { headers })).status, 404);
  assert.equal((await fetch(base + '/api/login', { headers })).status, 404);
  assert.equal((await fetch(base + '/.env', { headers })).status, 404);
  assert.equal((await fetch(base + '/healthz', { headers })).status, 200);
});

test('public demo refuses an insecure configured public origin', () => {
  assert.throws(() => demoServer({ publicUrl: 'http://saysure.onrender.com' }), /INVALID_PUBLIC_DEMO_ORIGIN/);
});
