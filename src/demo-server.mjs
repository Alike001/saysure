import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createBuyerQuestionRouter } from './buyer-question.mjs';

// Standalone static fixture viewer: no database, accounts, cookies, WebAuthn or payment transport.
const files = new Map([['/', ['demo.html', 'text/html']], ['/demo.js', ['demo.js', 'text/javascript']],
  ['/buyer-help.js', ['buyer-help.js', 'text/javascript']], ['/presentation.js', ['presentation.js', 'text/javascript']],
  ['/comprehension.js', ['comprehension.js', 'text/javascript']],
  ['/evidence-provenance.js', ['evidence-provenance.js', 'text/javascript']],
  ['/style.css', ['style.css', 'text/css']]]);
async function readQuestion(req) {
  if (req.headers['content-type'] !== 'application/json') throw Object.assign(new Error('JSON_REQUIRED'), { status: 415 });
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2048) throw Object.assign(new Error('BODY_TOO_LARGE'), { status: 413 });
    chunks.push(chunk);
  }
  let input;
  try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('INVALID_JSON'), { status: 400 }); }
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).join() !== 'question') {
    throw Object.assign(new Error('INVALID_QUESTION_REQUEST'), { status: 400 });
  }
  return input.question;
}
export function demoServer({ ai } = {}) {
  const routeQuestion = createBuyerQuestionRouter(ai);
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'");
    if (req.headers.host !== 'localhost:' + server.address().port) {
      res.writeHead(403); res.end('Invalid host'); return;
    }
    if (req.method === 'POST' && req.url === '/api/demo-question') {
      const origin = 'http://localhost:' + server.address().port;
      if (req.headers.origin !== origin) { res.writeHead(403); res.end(JSON.stringify({ error: 'INVALID_ORIGIN' })); return; }
      try {
        const question = await readQuestion(req);
        const result = await routeQuestion({ question, actor: req.socket.remoteAddress || 'demo' });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(error.status || 400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: ['INVALID_BUYER_QUESTION', 'BUYER_QUESTION_RATE_LIMIT',
          'JSON_REQUIRED', 'BODY_TOO_LARGE', 'INVALID_JSON', 'INVALID_QUESTION_REQUEST'].includes(error.message)
          ? error.message : 'QUESTION_UNAVAILABLE' }));
      }
      return;
    }
    const asset = req.method === 'GET' && files.get(req.url);
    if (!asset) { res.writeHead(404); res.end('Fixture viewer: route unavailable'); return; }
    try {
      res.writeHead(200, { 'Content-Type': asset[1] + '; charset=utf-8' });
      res.end(await readFile(new URL('../public/' + asset[0], import.meta.url)));
    } catch {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  });
  return server;
}
