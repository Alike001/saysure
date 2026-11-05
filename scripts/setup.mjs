import { mkdir, writeFile } from 'node:fs/promises';
import { openStore } from '../src/store.mjs';
import { provision } from '../src/identity.mjs';
process.umask(0o077);
await mkdir(new URL('../.local/', import.meta.url), { recursive: true, mode: 0o700 });
const store = openStore(new URL('../.local/consent.sqlite', import.meta.url).pathname);
try {
  const accounts = provision(store);
  await writeFile(new URL('../.local/accounts.json', import.meta.url), JSON.stringify(accounts, null, 2) + '\n',
    { mode: 0o600, flag: 'wx' });
  console.log('Provisioned helper, buyer-a, buyer-b. Private login secrets: .local/accounts.json');
  console.log('Give each buyer only their own entry through an independently trusted channel. Never commit this file.');
} catch { console.error('Setup refused: accounts may already exist. Existing database is preserved.'); process.exitCode = 1; }
finally { store.close(); }
