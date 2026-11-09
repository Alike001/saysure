import { ensure, Failure } from './core.mjs';
export const SANDBOX = 'https://api-m.sandbox.paypal.com';
const idPattern = /^[A-Z0-9]{5,32}$/;
const nativeFetch = globalThis.fetch;
const adapters = new WeakMap(); // Only this fixed-endpoint constructor can register an adapter.
export const sandboxAdapterProvenance = client => adapters.get(client);
export function sandboxClient(config, settings = {}) {
  const mocked = Object.hasOwn(settings, 'transport');
  const transport = mocked ? settings.transport : nativeFetch;
  ensure(typeof transport === 'function', 'PAYPAL_TRANSPORT_INVALID');
  const { observe = () => {}, now = Date.now, initialToken,
    beforeRequest = () => {}, afterResponse = () => {}, onRequestError = () => {},
    beforeOrder = () => {}, afterOrder = () => {}, onOrderError = () => {} } = settings;
  ensure(config.PAYPAL_ENV === 'sandbox' && (!config.PAYPAL_MODE || config.PAYPAL_MODE === 'sandbox') &&
    (!config.PAYPAL_BASE_URL || config.PAYPAL_BASE_URL === SANDBOX), 'SANDBOX_ONLY_CONFIG_REQUIRED', 503);
  for (const key of ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET']) {
    ensure(typeof config[key] === 'string' && config[key].trim() && !/[\r\n]/.test(config[key]) &&
      !/^(your|replace|<)/i.test(config[key]), 'PAYPAL_CREDENTIALS_REQUIRED', 503);
  }
  let token, expiry = 0, inflight;
  if (initialToken) {
    ensure(typeof initialToken.access_token === 'string' && /^[\x21-\x7e]+$/.test(initialToken.access_token) &&
      initialToken.token_type?.toLowerCase() === 'bearer' && Number.isFinite(initialToken.expires_at) &&
      initialToken.expires_at > now(), 'PAYPAL_TOKEN_INVALID', 502);
    token = initialToken.access_token; expiry = initialToken.expires_at;
  }
  async function request(path, options, operation, onReadReserved = () => {}) {
    let reservation;
    try {
      reservation = beforeRequest(operation); // Policy hooks cannot replace transport or responses.
      if (operation === 'order_get') onReadReserved();
      const response = await transport(`${SANDBOX}${path}`, { ...options, redirect: 'error', signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) });
      observe({ operation, http_status: response.status });
      const debug = response.headers.get('paypal-debug-id');
      afterResponse(reservation, { http_status: response.status, debug_id: /^[a-f0-9]{8,64}$/i.test(debug ?? '') ? debug : null });
      if (!response.ok) throw new Failure(`PAYPAL_HTTP_${response.status}`, 502);
      // Bound responses, never log/persist raw JSON or provider error bodies.
      let length = 0, chunks = [];
      for await (const chunk of response.body) {
        length += chunk.length; ensure(length <= 256000, 'PAYPAL_RESPONSE_TOO_LARGE', 502); chunks.push(chunk);
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch (error) {
      onRequestError(reservation);
      if (error instanceof Failure) throw error;
      throw new Failure('PAYPAL_NETWORK_OR_RESPONSE_UNAVAILABLE', 502);
    }
  }
  async function authenticate() {
    if (token && now() < expiry) return token;
    if (inflight) return inflight;
    inflight = (async () => {
      const data = await request('/v1/oauth2/token', { method: 'POST',
        headers: { Authorization: `Basic ${Buffer.from(`${config.PAYPAL_CLIENT_ID}:${config.PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: 'grant_type=client_credentials' }, 'oauth');
      ensure(typeof data.access_token === 'string' && /^[\x21-\x7e]+$/.test(data.access_token) &&
        data.token_type?.toLowerCase() === 'bearer' && Number.isFinite(data.expires_in) && data.expires_in > 0,
      'PAYPAL_TOKEN_INVALID', 502);
      token = data.access_token; expiry = now() + Math.max(0, data.expires_in - 60) * 1000;
      return token;
    })();
    try { return await inflight; } finally { inflight = undefined; }
  }
  async function getOrder(id, { signal, onReadReserved = () => {} } = {}) {
    ensure(typeof id === 'string' && idPattern.test(id), 'INVALID_ORDER_ID', 400);
    beforeOrder(id);
    try {
      const started = now();
      ensure(!signal?.aborted, 'CONSUMPTION_TIMED_OUT', 504);
      const bearer = await authenticate();
      ensure(!signal?.aborted, 'CONSUMPTION_TIMED_OUT', 504);
      const raw = await request(`/v2/checkout/orders/${id}`, { method: 'GET', signal,
        headers: { Authorization: `Bearer ${bearer}`, Accept: 'application/json' } }, 'order_get', onReadReserved);
      // Validation/ledger hooks receive a copy; their return values never become evidence.
      await afterOrder(structuredClone(raw), id, started);
      return raw;
    } catch (error) {
      if (error.message === 'PAYPAL_HTTP_401') { token = undefined; expiry = 0; }
      onOrderError();
      throw error; // No hidden retries or arbitrary URL/write method.
    }
  }
  // Any explicit transport override is mock, even the captured/global fetch reference.
  const provenance = mocked ? 'mock-paypal-fixture' : 'authenticated-sandbox-api';
  const client = Object.freeze({ provenance, getOrder,
    async probeAuthentication() { await authenticate(); return { authenticated: true }; } });
  adapters.set(client, provenance);
  return client;
}
