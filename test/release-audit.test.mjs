import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, statSync, symlinkSync, linkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const script = new URL('../scripts/release-audit.mjs', import.meta.url).pathname;
const guard = new URL('../scripts/offline-test-guard.mjs', import.meta.url).pathname;
function fixture(t) {
  const base = mkdtempSync(join(tmpdir(), 'saysure-release-tool-')), root = join(base, 'repo');
  mkdirSync(root); mkdirSync(join(root, 'evidence'));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  git('init', '--quiet');
  writeFileSync(join(root, '.gitignore'), '.env*\n.local/\n*.report.json\n');
  writeFileSync(join(root, 'evidence/release-audit.json'), '{"historical":true}\n');
  writeFileSync(join(root, 'source.mjs'), 'export const synthetic = true;\n');
  const commit = () => { git('add', '--all'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
    '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '--quiet', '-m', 'fixture'); };
  commit(); t.after(() => rmSync(base, { recursive: true, force: true }));
  const run = (...args) => spawnSync(process.execPath, ['--import', guard, script, ...args], {
    cwd: root, encoding: 'utf8', env: { PATH: process.env.PATH } });
  return { base, root, git, commit, run, read: p => readFileSync(join(root, p), 'utf8'),
    write: (p, content) => writeFileSync(join(root, p), content) };
}
test('release audit defaults to stdout and preserves historical evidence and the working tree', t => {
  const f = fixture(t), before = f.read('evidence/release-audit.json'), result = f.run();
  assert.equal(result.status, 0, result.stderr); const report = JSON.parse(result.stdout);
  assert.equal(report.passed, true); assert.equal(report.tracked_files_scanned, 3);
  assert.equal(report.history_blobs_scanned, 3); assert.equal(report.untracked_files_scanned, 0);
  assert.equal(f.read('evidence/release-audit.json'), before); assert.equal(f.git('status', '--porcelain'), '');
});
test('explicit report output is private and contains the same JSON as stdout', t => {
  const f = fixture(t), result = f.run('--output', 'audit.report.json');
  assert.equal(result.status, 0, result.stderr); assert.equal(f.read('audit.report.json'), result.stdout);
  assert.equal(statSync(join(f.root, 'audit.report.json')).mode & 0o777, 0o600);
  assert.equal(f.git('status', '--porcelain'), '');
});
test('existing output refuses replacement unless --overwrite is explicit', t => {
  const f = fixture(t); f.write('audit.report.json', 'preserve me');
  const refused = f.run('--output', 'audit.report.json'); assert.equal(refused.status, 1);
  assert.match(refused.stderr, /RELEASE_AUDIT_OUTPUT_EXISTS/); assert.equal(f.read('audit.report.json'), 'preserve me');
  const allowed = f.run('--output', 'audit.report.json', '--overwrite');
  assert.equal(allowed.status, 0, allowed.stderr); assert.equal(JSON.parse(f.read('audit.report.json')).passed, true);
});
test('tracked output remains protected even with --overwrite', t => {
  const f = fixture(t), before = f.read('evidence/release-audit.json');
  const result = f.run('--output', 'evidence/release-audit.json', '--overwrite');
  assert.equal(result.status, 1); assert.match(result.stderr, /RELEASE_AUDIT_TRACKED_OUTPUT/);
  assert.equal(f.read('evidence/release-audit.json'), before);
});
test('symlink and hardlink outputs cannot overwrite their targets', t => {
  const f = fixture(t), before = f.read('source.mjs');
  for (const [name, link] of [['symbol.report.json', symlinkSync], ['hard.report.json', linkSync]]) {
    link(join(f.root, 'source.mjs'), join(f.root, name));
    const result = f.run('--output', name, '--overwrite'); assert.equal(result.status, 1);
    assert.match(result.stderr, /RELEASE_AUDIT_(SYMLINK|LINKED)_OUTPUT/); assert.equal(f.read('source.mjs'), before);
  }
});
test('invalid CLI arguments fail without writing or leaking error internals', t => {
  const f = fixture(t);
  for (const args of [['--output'], ['--overwrite'], ['--unknown'], ['--output', '--overwrite']]) {
    const result = f.run(...args); assert.equal(result.status, 1); assert.equal(result.stdout, '');
    assert.match(result.stderr, /^RELEASE_AUDIT_[A-Z_]+\n$/);
  }
  assert.equal(f.git('status', '--porcelain'), '');
});
test('clean clone needs no configuration and never reads sibling configuration', t => {
  const f = fixture(t), sibling = join(f.base, 'capturedesk-feasibility'); mkdirSync(sibling);
  const value = 'SIBLING_ONLY_SYNTHETIC_SECRET'; writeFileSync(join(sibling, '.env'), `PAYPAL_CLIENT_SECRET=${value}\n`);
  f.write('source.mjs', `export const fixture = '${value}';\n`);
  const result = f.run(); assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).exact_private_values_checked, 0);
});
test('local credentials detect tracked and untracked leaks but never appear in the report', t => {
  const f = fixture(t), token = 'LOCAL_SYNTHETIC_TOKEN_12345', password = 'BOOTSTRAP_SYNTHETIC_SECRET_12345';
  mkdirSync(join(f.root, '.local')); f.write('.env', `PAYPAL_CLIENT_SECRET=${token}\n`);
  f.write('.local/accounts.json', JSON.stringify([{ password }]));
  f.write('source.mjs', `export const value = '${token}';\n`); f.write('new.mjs', `export const value = '${password}';\n`);
  f.write(`${token}.mjs`, `export const value = '${password}';\n`);
  const result = f.run(); assert.equal(result.status, 1); const report = JSON.parse(result.stdout);
  assert.equal(report.untracked_files_scanned, 2); assert.equal(report.exact_private_values_checked, 2);
  assert.deepEqual(report.findings.map(f => f.location).sort(), ['[REDACTED].mjs', 'new.mjs', 'source.mjs']);
  for (const value of [token, password]) assert.ok(!result.stdout.includes(value) && !result.stderr.includes(value));
});
test('deleted secrets and prohibited paths remain detectable in Git history', t => {
  const f = fixture(t), value = 'HISTORICAL_SYNTHETIC_SECRET_12345';
  f.write('.env', `PAYPAL_CLIENT_SECRET=${value}\n`); f.git('add', '--force', '.env'); f.commit();
  f.git('rm', '--quiet', '.env'); f.commit();
  f.write('.env', `PAYPAL_CLIENT_SECRET=${value}\n`);
  const result = f.run(); assert.equal(result.status, 1); const report = JSON.parse(result.stdout);
  assert.ok(report.findings.some(f => f.reason === 'Private artifact path in history'));
  assert.ok(report.findings.some(f => f.location.startsWith('history blob ')));
  assert.ok(!result.stdout.includes(value));
});
test('private output and malformed local configuration fail with sanitized errors', t => {
  const f = fixture(t); f.write('.env', 'PAYPAL_CLIENT_SECRET=PRIVATE_SYNTHETIC_VALUE_12345\n');
  const result = f.run('--output', '.env', '--overwrite'); assert.equal(result.status, 1);
  assert.match(result.stderr, /RELEASE_AUDIT_PRIVATE_OUTPUT/); assert.ok(f.read('.env').includes('PRIVATE_SYNTHETIC_VALUE_12345'));
  mkdirSync(join(f.root, '.local')); f.write('.local/marker.json', '{"preserve":true}');
  const marker = f.run('--output', '.local/marker.json', '--overwrite');
  assert.equal(marker.status, 1); assert.match(marker.stderr, /RELEASE_AUDIT_PRIVATE_OUTPUT/);
  assert.equal(f.read('.local/marker.json'), '{"preserve":true}');
  symlinkSync(join(f.root, '.local'), join(f.root, 'local-alias'));
  const alias = f.run('--output', 'local-alias/marker.json', '--overwrite');
  assert.equal(alias.status, 1); assert.match(alias.stderr, /RELEASE_AUDIT_PRIVATE_OUTPUT/);
  assert.equal(f.read('.local/marker.json'), '{"preserve":true}');
  f.write('.local/accounts.json', 'PRIVATE_MALFORMED_JSON');
  const invalid = f.run(); assert.equal(invalid.status, 1); assert.equal(invalid.stdout, '');
  assert.equal(invalid.stderr, 'RELEASE_AUDIT_FAILED\n');
});
