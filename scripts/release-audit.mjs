import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
const git = args => execFileSync('git', args, { maxBuffer: 32 * 1024 * 1024, encoding: 'utf8' }).trim();
const privateValues = new Set();
// Compare exact local secrets without ever printing them. Reference repository is read-only.
for (const file of ['.env', '../capturedesk-feasibility/.env']) {
  const env = parseEnv(await readFile(file, 'utf8').catch(() => ''));
  for (const [key, value] of Object.entries(env)) if (/SECRET|API_KEY|CLIENT_ID|PASSWORD/.test(key) && value.length >= 12) privateValues.add(value);
}
const accounts = JSON.parse(await readFile('.local/accounts.json', 'utf8').catch(() => '[]'));
for (const a of accounts) if (a.password?.length >= 12) privateValues.add(a.password);
const findings = [], tracked = git(['ls-files', '-z']).split('\0').filter(Boolean);
const forbidden = /(^|\/)(\.env[^/]*|\.local\/|accounts\.json$)|\.(?:sqlite(?:-wal|-shm)?|db|har|pem|key)$/i;
function inspect(content, location) {
  if ([...privateValues].some(value => content.includes(value))) findings.push({ location, reason: 'Exact private configured value detected; value redacted' });
  if (/^-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/m.test(content)) findings.push({ location, reason: 'Private key marker detected' });
}
for (const path of tracked) {
  if (forbidden.test(path)) findings.push({ location: path, reason: 'Private artifact path tracked' });
  inspect(await readFile(path, 'utf8'), path);
}
const objects = git(['rev-list', '--objects', '--all']).split('\n').filter(Boolean).map(line => line.split(' ')[0]);
const types = execFileSync('git', ['cat-file', '--batch-check=%(objectname) %(objecttype)'], { input: objects.join('\n') + '\n', encoding: 'utf8' });
const blobs = types.trim().split('\n').filter(line => line.endsWith(' blob')).map(line => line.split(' ')[0]);
for (const id of blobs) inspect(git(['cat-file', 'blob', id]), `history blob ${id.slice(0, 12)}`);
const report = { at: new Date().toISOString(), tracked_files_scanned: tracked.length, history_blobs_scanned: blobs.length,
  exact_private_values_checked: privateValues.size, findings, passed: findings.length === 0,
  limits: 'Exact configured credentials/bootstrap secrets, private artifact paths and key markers only. Does not prove absence of unknown secrets, PII, legal/IP or dependency licensing issues.',
  remote_configured: !!git(['remote']), license_present: tracked.includes('LICENSE'), no_push_or_deployment: true };
await writeFile('evidence/release-audit.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report)); if (!report.passed) process.exitCode = 1;
