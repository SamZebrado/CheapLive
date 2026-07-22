import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const testDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'unit');
const separateGates = new Set([
  'signaling-server.test.js',
  'web-asset-sync.test.mjs',
]);
const files = fs.readdirSync(testDir)
  .filter((name) => /\.test\.(?:js|mjs)$/.test(name) && !separateGates.has(name))
  .sort()
  .map((name) => path.join(testDir, name));

if (files.length === 0) {
  throw new Error('No unit test files found');
}

const result = spawnSync(process.execPath, ['--test', ...files], {
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
