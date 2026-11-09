import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
// Standalone static fixture viewer: no database, accounts, cookies, WebAuthn or external transport.
const files = new Map([['/', ['demo.html', 'text/html']], ['/demo.js', ['demo.js', 'text/javascript']],
  ['/buyer-help.js', ['buyer-help.js', 'text/javascript']], ['/presentation.js', ['presentation.js', 'text/javascript']],
  ['/evidence-provenance.js', ['evidence-provenance.js', 'text/javascript']],
  ['/style.css', ['style.css', 'text/css']]]);
export function demoServer() {
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'");
    if (req.headers.host !== `localhost:${server.address().port}`) { res.writeHead(403); res.end('Invalid host'); return; }
    const asset = req.method === 'GET' && files.get(req.url);
    if (!asset) { res.writeHead(404); res.end('Fixture viewer: route unavailable'); return; }
    try { res.writeHead(200, { 'Content-Type': `${asset[1]}; charset=utf-8` }); res.end(await readFile(new URL(`../public/${asset[0]}`, import.meta.url))); }
    catch { if (!res.headersSent) res.writeHead(500); res.end(); }
  });
  return server;
}
