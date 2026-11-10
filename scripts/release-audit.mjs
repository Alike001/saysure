import { execFileSync } from 'node:child_process';
import { readFile, lstat, realpath, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, relative, isAbsolute, basename } from 'node:path';
import { parseEnv } from 'node:util';
const fail = code => { throw new Error(code); };
const git = (args, options = {}) => execFileSync('git', args, {
  maxBuffer: 32 * 1024 * 1024, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...options });
const lines = value => value.trim().split('\n').filter(Boolean);
const paths = value => value.split('\0').filter(Boolean);
const forbidden = /(^|\/)(\.env[^/]*|\.local\/|accounts\.json$)|\.(?:sqlite(?:-wal|-shm)?|db|har|pem|key|log)$/i;
function argumentsFor(argv) {
  let output, overwrite = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--output' && !output && argv[i + 1] && !argv[i + 1].startsWith('--')) output = argv[++i];
    else if (argv[i] === '--overwrite' && !overwrite) overwrite = true;
    else fail('RELEASE_AUDIT_INVALID_ARGUMENT');
  }
  if (overwrite && !output) fail('RELEASE_AUDIT_OUTPUT_REQUIRED');
  return { output, overwrite };
}
async function audit(root, excludedOutput) {
  const privateValues = new Set();
  async function optionalPrivate(path) {
    try {
      const rel = relative(root, await realpath(path));
      if (rel === '..' || rel.startsWith('../') || isAbsolute(rel)) fail('RELEASE_AUDIT_PRIVATE_PATH_INVALID');
      return await readFile(path, 'utf8');
    } catch (error) { if (error.code === 'ENOENT') return ''; throw error; }
  }
  const env = parseEnv(await optionalPrivate(resolve(root, '.env')));
  for (const [key, value] of [...Object.entries(env), ...Object.entries(process.env)]) {
    if (/SECRET|API_KEY|CLIENT_ID|PASSWORD|TOKEN/.test(key) && value.length >= 12) privateValues.add(value);
  }
  const accounts = JSON.parse(await optionalPrivate(resolve(root, '.local/accounts.json')) || '[]');
  for (const a of accounts) if (a.password?.length >= 12) privateValues.add(a.password);
  const findings = [], tracked = paths(git(['ls-files', '-z'], { cwd: root }));
  const untracked = paths(git(['ls-files', '--others', '--exclude-standard', '-z'], { cwd: root }))
    .filter(path => resolve(root, path) !== excludedOutput);
  function inspect(content, location) {
    if ([...privateValues].some(value => content.includes(value))) findings.push({ location, reason: 'Exact private configured value detected; value redacted' });
    if (/^-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/m.test(content)) findings.push({ location, reason: 'Private key marker detected' });
  }
  for (const path of [...tracked, ...untracked]) {
    if (forbidden.test(path)) findings.push({ location: path, reason: 'Private artifact path in source inventory' });
    const file = resolve(root, path);
    if ((await lstat(file)).isSymbolicLink()) findings.push({ location: path, reason: 'Symbolic link requires separate review; target not read' });
    else inspect(await readFile(file, 'utf8'), path);
  }
  const objects = lines(git(['rev-list', '--objects', '--all'], { cwd: root }));
  for (const object of objects) {
    const path = object.slice(object.indexOf(' ') + 1);
    if (object.includes(' ') && forbidden.test(path)) findings.push({ location: path, reason: 'Private artifact path in history' });
  }
  const ids = objects.map(line => line.split(' ')[0]);
  const types = ids.length ? git(['cat-file', '--batch-check=%(objectname) %(objecttype)'], {
    cwd: root, input: ids.join('\n') + '\n' }) : '';
  const blobs = lines(types).filter(line => line.endsWith(' blob')).map(line => line.split(' ')[0]);
  for (const id of blobs) inspect(git(['cat-file', 'blob', id], { cwd: root }), `history blob ${id.slice(0, 12)}`);
  const safeFindings = findings.map(finding => ({ ...finding, location: [...privateValues]
    .reduce((location, value) => location.split(value).join('[REDACTED]'), finding.location) }));
  return { at: new Date().toISOString(), tracked_files_scanned: tracked.length,
    untracked_files_scanned: untracked.length, history_blobs_scanned: blobs.length,
    exact_private_values_checked: privateValues.size, findings: safeFindings, passed: findings.length === 0,
    limits: 'Exact repository-local/environment credentials and bootstrap values of at least 12 characters, private paths and key markers only. Ignored private evidence is not scanned. Does not prove absence of unknown secrets, PII, legal/IP or dependency licensing issues.',
    remote_configured: !!git(['remote'], { cwd: root }).trim(), license_present: tracked.includes('LICENSE') };
}
async function outputReport(root, output, overwrite, content) {
  const destination = resolve(output), parent = await realpath(resolve(destination, '..'));
  const canonical = resolve(parent, basename(destination));
  const tracked = paths(git(['ls-files', '-z'], { cwd: root })).map(path => resolve(root, path));
  if (tracked.includes(canonical)) fail('RELEASE_AUDIT_TRACKED_OUTPUT');
  if ([destination, canonical].some(path => path.split(/[\\/]/).includes('.local')) || /^\.env/.test(basename(destination)) ||
    /(?:accounts\.json|\.(?:sqlite(?:-wal|-shm)?|db|pem|key|har|log))$/i.test(destination)) fail('RELEASE_AUDIT_PRIVATE_OUTPUT');
  try {
    const info = await lstat(destination);
    if (info.isSymbolicLink()) fail('RELEASE_AUDIT_SYMLINK_OUTPUT');
    if (info.nlink > 1) fail('RELEASE_AUDIT_LINKED_OUTPUT');
  }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const flags = constants.O_WRONLY | constants.O_CREAT | (overwrite ? constants.O_TRUNC : constants.O_EXCL) | (constants.O_NOFOLLOW ?? 0);
  let file;
  try { file = await open(destination, flags, 0o600); }
  catch (error) { if (error.code === 'EEXIST') fail('RELEASE_AUDIT_OUTPUT_EXISTS'); throw error; }
  try { await file.writeFile(content); } finally { await file.close(); }
}
try {
  const { output, overwrite } = argumentsFor(process.argv.slice(2));
  const root = git(['rev-parse', '--show-toplevel']).trim();
  const report = await audit(root, output ? resolve(output) : undefined);
  const content = JSON.stringify(report, null, 2) + '\n';
  if (output) await outputReport(root, output, overwrite, content);
  process.stdout.write(content);
  if (!report.passed) process.exitCode = 1;
} catch (error) {
  // Never print Git stderr, parsed private data or raw exception text.
  console.error(/^RELEASE_AUDIT_[A-Z_]+$/.test(error.message) ? error.message : 'RELEASE_AUDIT_FAILED');
  process.exitCode = 1;
}
