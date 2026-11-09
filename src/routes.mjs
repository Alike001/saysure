import { ensure } from './core.mjs';

// Origin-form ASCII paths only: no decoding or URL normalization before routing.
// Query values are inert metadata; none can select a route, actor or operation.
export function classifyRoute(target, method) {
  ensure(typeof target === 'string' && target.length <= 8192 && !target.includes('#'), 'NONCANONICAL_ROUTE', 400);
  const at = target.indexOf('?');
  const pathname = at < 0 ? target : target.slice(0, at);
  const query = at < 0 ? '' : target.slice(at + 1);
  ensure(/^\/[A-Za-z0-9/_.-]*$/.test(pathname) && !pathname.includes('//') &&
    (pathname === '/' || !pathname.endsWith('/')) &&
    !pathname.split('/').some(segment => segment === '.' || segment === '..'), 'NONCANONICAL_ROUTE', 400);
  try { decodeURIComponent(query.replace(/\+/g, ' ')); }
  catch { ensure(false, 'NONCANONICAL_ROUTE', 400); }
  const match = pathname.match(/^\/api\/requests\/((?:SYNTH|PAYPAL)-[a-f0-9-]{36})(?:\/(options|approve|reject|withdraw|consume|refresh-provider))?$/);
  return Object.freeze({ pathname, id: match?.[1], action: match?.[2],
    consumption: method === 'POST' && match?.[2] === 'consume' });
}
