import { ensure } from './core.mjs';

export function assertOriginConfig(config) {
  let origin;
  try { origin = new URL(config.origin); } catch { ensure(false, 'INVALID_EXPERIMENT_ORIGIN'); }
  const localHttp = origin.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
  ensure((origin.protocol === 'https:' || localHttp) && origin.origin === config.origin,
    'HTTPS_REQUIRED_FOR_PUBLIC_ORIGIN', 503);
  ensure(typeof config.rpID === 'string' && config.rpID === origin.hostname,
    'WEBAUTHN_RP_ID_MISMATCH', 503);
  return true;
}
