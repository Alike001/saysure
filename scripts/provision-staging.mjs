import { localConfig } from '../src/paypal-config.mjs';
import { openPostgresStore } from '../src/store.mjs';
import { provisionStaging } from '../src/identity.mjs';
import { ensure } from '../src/core.mjs';

const env = await localConfig();
ensure(typeof env.DATABASE_URL === 'string' && env.DATABASE_URL.length > 0, 'DATABASE_URL_REQUIRED', 503);
const store = await openPostgresStore(env.DATABASE_URL);
try {
  const result = await provisionStaging(store, env);
  console.log(result.created ? 'Staging accounts created.' : 'Staging accounts already exist; no credentials changed.');
  console.log('No passwords or credential material were printed.');
} finally {
  await store.close();
}
