import { readFile } from 'node:fs/promises';
const id = process.argv[2];
if (!process.stdout.isTTY || !['helper', 'buyer-a', 'buyer-b'].includes(id)) {
  console.error('Run in your private interactive terminal: npm run account -- helper|buyer-a|buyer-b');
  process.exit(1);
}
const accounts = JSON.parse(await readFile(new URL('../.local/accounts.json', import.meta.url), 'utf8'));
const account = accounts.find(a => a.username === id);
console.log(`Username: ${account.username}\nAccount secret: ${account.password}`);
console.log('Keep this local experiment secret private. Do not paste it into chat or commit it.');
