import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
let failed = false;
for (const dir of ['src', 'public', 'scripts', 'test']) {
  for (const file of await readdir(new URL(`../${dir}/`, import.meta.url))) {
    if (!/\.(mjs|js)$/.test(file)) continue;
    const path = new URL(`../${dir}/${file}`, import.meta.url).pathname;
    if (spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' }).status) failed = true;
    const lines = (await readFile(path, 'utf8')).split('\n').length;
    if (lines > 300) { console.error(`${dir}/${file}: ${lines} lines exceeds 300`); failed = true; }
    else if (lines > 200) console.warn(`${dir}/${file}: ${lines} lines (target 200)`);
  }
}
if (failed) process.exitCode = 1; else console.log('Syntax and source-size checks passed.');
