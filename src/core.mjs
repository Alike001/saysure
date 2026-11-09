import { canonical } from '../public/consent-shape.js';
export { canonical } from '../public/consent-shape.js';
import { createHash, randomBytes } from 'node:crypto';

export class Failure extends Error {
  constructor(code, status = 409) { super(code); this.status = status; }
}
export function ensure(condition, code, status) {
  if (!condition) throw new Failure(code, status);
}
export const random = () => randomBytes(32).toString('base64url');
export const sha = value => createHash('sha256').update(value).digest('hex');
export const exponents = Object.freeze({ USD: 2, EUR: 2, NGN: 2, JPY: 0 });
export function text(value, name, max = 120) {
  ensure(typeof value === 'string' && value.trim() && value.length <= max &&
    !/[\p{Cc}\p{Cf}]/u.test(value), `INVALID_${name}`, 400);
  return value.trim().normalize('NFC');
}
export function fields(input) {
  ensure(input && typeof input === 'object' && !Array.isArray(input), 'INVALID_REQUEST', 400);
  ensure(Object.keys(input).every(k => ['merchant_id', 'merchant_name', 'amount', 'currency',
    'description', 'buyer_id', 'lifetime_minutes', 'revision'].includes(k)), 'UNKNOWN_FIELD', 400);
  ensure(Object.hasOwn(exponents, input.currency), 'UNSUPPORTED_CURRENCY', 400);
  const places = exponents[input.currency];
  ensure(typeof input.amount === 'string' &&
    new RegExp(`^(0|[1-9][0-9]{0,8})${places ? '(\\.[0-9]{1,' + places + '})?' : ''}$`).test(input.amount),
  'INVALID_DECIMAL_AMOUNT', 400);
  const [whole, fraction = ''] = input.amount.split('.');
  const minor = BigInt(whole) * 10n ** BigInt(places) + BigInt(fraction.padEnd(places, '0') || '0');
  ensure(minor > 0n && minor <= 100000000000n, 'AMOUNT_OUT_OF_RANGE', 400);
  const minutes = input.lifetime_minutes ?? 10;
  ensure(Number.isInteger(minutes) && minutes >= 1 && minutes <= 30, 'INVALID_LIFETIME', 400);
  return { merchant_id: text(input.merchant_id, 'MERCHANT_ID', 80),
    merchant_name: text(input.merchant_name, 'MERCHANT_NAME'), amount_minor: minor.toString(),
    currency: input.currency, description: text(input.description, 'DESCRIPTION', 500), minutes };
}
export const digest = snapshot => sha(canonical(snapshot));
export function displayAmount(s) {
  const places = exponents[s.currency];
  const digits = s.amount_minor.padStart(places + 1, '0');
  return `${places ? digits.slice(0, -places) + '.' + digits.slice(-places) : digits} ${s.currency}`;
}
export function clientData(response) {
  try {
    const data = JSON.parse(Buffer.from(response.response.clientDataJSON, 'base64url').toString());
    ensure(data.crossOrigin !== true && !data.topOrigin, 'CROSS_ORIGIN_DENIED', 400);
    return data;
  } catch { throw new Failure('INVALID_CLIENT_DATA', 400); }
}
