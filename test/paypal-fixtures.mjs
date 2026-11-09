export const merchant = 'MOCKPAYEE123';
export const orderId = 'MOCKORDER123';
export const fixtureOrder = (overrides = {}) => ({ id: orderId, intent: 'CAPTURE', status: 'PAYER_ACTION_REQUIRED',
  create_time: new Date().toISOString(), payer: { email_address: 'private-buyer@example.invalid', name: { given_name: 'PRIVATE' } },
  purchase_units: [{ amount: { currency_code: 'USD', value: '1.00' }, payee: { merchant_id: merchant, email_address: 'private-seller@example.invalid' },
    description: 'PRIVATE CUSTOM TEXT', shipping: { address: { address_line_1: 'PRIVATE STREET' } } }], ...overrides });
export const testConfig = { PAYPAL_ENV: 'sandbox', PAYPAL_CLIENT_ID: 'test-client', PAYPAL_CLIENT_SECRET: 'test-secret' };
export const jsonResponse = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
