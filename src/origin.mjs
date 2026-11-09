import { ensure } from './core.mjs';
// This prototype has no HTTPS deployment mode. A new RP requires separate storage,
// enrollment and operator review; changing config cannot migrate localhost credentials.
export function assertLocalExperiment(config) {
  let origin;
  try { origin = new URL(config.origin); } catch { ensure(false, 'INVALID_EXPERIMENT_ORIGIN'); }
  ensure(config.rpID === 'localhost' && origin.hostname === 'localhost' && origin.protocol === 'http:' &&
    origin.origin === config.origin, 'SEPARATE_HTTPS_ENROLLMENT_REQUIRED');
}
