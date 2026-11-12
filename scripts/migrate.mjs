import { localConfig } from '../src/paypal-config.mjs';
import { openPostgresStore } from '../src/store.mjs';
import { ensure } from '../src/core.mjs';

const env = await localConfig();
ensure(typeof env.DATABASE_URL === 'string' && env.DATABASE_URL.length > 0, 'DATABASE_URL_REQUIRED', 503);
const store = await openPostgresStore(env.DATABASE_URL);
try {
  await store.ping();
  console.log('SaySure PostgreSQL schema is current and the database is reachable.');
} finally {
  await store.close();
}
