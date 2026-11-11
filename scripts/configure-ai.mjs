import { chmod, readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { resolve } from 'node:path';

const localPath = resolve('.env');
const localText = await readFile(localPath, 'utf8').catch(error => {
  if (error.code === 'ENOENT') return '';
  throw error;
});
const local = parseEnv(localText);
const siblingText = await readFile(new URL('../../capturedesk-feasibility/.env', import.meta.url), 'utf8')
  .catch(error => error.code === 'ENOENT' ? '' : Promise.reject(error));
const sibling = parseEnv(siblingText);
const key = process.env.GROQ_API_KEY || local.GROQ_API_KEY || sibling.GROQ_API_KEY;
if (!key || !/^gsk_[A-Za-z0-9_-]{20,}$/.test(key)) {
  console.error('No valid GROQ_API_KEY was found in the environment or the existing local .env files. No file was changed.');
  process.exitCode = 1;
} else if (!local.GROQ_API_KEY) {
  const separator = localText && !localText.endsWith('\\n') ? '\\n' : '';
  await writeFile(localPath, `${localText}${separator}GROQ_API_KEY=${key}\\n`, { mode: 0o600 });
  await chmod(localPath, 0o600);
  console.log('Groq key copied into this repository’s ignored .env file. Its value was not displayed.');
} else {
  await chmod(localPath, 0o600);
  console.log('Groq key is already configured in this repository’s ignored .env file. Its value was not displayed.');
}
