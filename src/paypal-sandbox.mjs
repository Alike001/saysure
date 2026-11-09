import { ensure, Failure } from './core.mjs';
export const SANDBOX = 'https://api-m.sandbox.paypal.com';
const idPattern = /^[A-Z0-9]{5,32}$/;
export function sandboxClient(config, { transport = fetch, observe = () => {}, now = Date.now, initialToken } = {}) {
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
  async function request(path, options, operation) {
    try {
      const response = await transport(`${SANDBOX}${path}`, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
      observe({ operation, http_status: response.status });
      if (!response.ok) throw new Failure(`PAYPAL_HTTP_${response.status}`, 502);
      // Bound responses, never log/persist raw JSON or provider error bodies.
      let length = 0, chunks = [];
      for await (const chunk of response.body) {
        length += chunk.length; ensure(length <= 256000, 'PAYPAL_RESPONSE_TOO_LARGE', 502); chunks.push(chunk);
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch (error) {
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
  async function getOrder(id) {
    ensure(typeof id === 'string' && idPattern.test(id), 'INVALID_ORDER_ID', 400);
    const bearer = await authenticate();
    try {
      return await request(`/v2/checkout/orders/${id}`, { method: 'GET',
        headers: { Authorization: `Bearer ${bearer}`, Accept: 'application/json' } }, 'order_get');
    } catch (error) {
      if (error.message === 'PAYPAL_HTTP_401') { token = undefined; expiry = 0; }
      throw error; // No hidden retries or arbitrary URL/write method.
    }
  }
  return { provenance: transport === fetch ? 'authenticated-sandbox-api' : 'mock-paypal-fixture', getOrder, async probeAuthentication() { await authenticate(); return { authenticated: true }; } };
}
