import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  ASSET_GROUPS,
  buildManifest,
  checkAssetSync,
  writeAssetSync,
} from '../../scripts/sync-contest-demo-to-android.mjs';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SCRIPT_PATH = fileURLToPath(new URL('../../scripts/sync-contest-demo-to-android.mjs', import.meta.url));

function fixture(t) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cheaplive-asset-sync-'));
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  fs.mkdirSync(path.join(repoRoot, 'canonical'), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, 'canonical/source.txt'), 'canonical\n');
  return {
    repoRoot,
    assetGroups: [{
      feature: 'fixture',
      source: 'canonical/source.txt',
      targets: ['mirror/target.txt'],
    }],
    manifestPath: 'manifest.json',
  };
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

test('web asset map has one canonical source per generated target', () => {
  const targets = new Set();
  for (const group of ASSET_GROUPS) {
    assert.ok(group.source.length > 0, `${group.feature} must declare a source`);
    assert.ok(group.targets.length > 0, `${group.feature} must declare targets`);
    for (const target of group.targets) {
      assert.notEqual(target, group.source, `${group.feature} cannot mirror onto its source`);
      assert.ok(!targets.has(target), `${target} has more than one canonical source`);
      targets.add(target);
    }
  }
});

test('web asset manifest uses full SHA-256 values', () => {
  const manifest = buildManifest();
  assert.equal(manifest.schemaVersion, 1);
  for (const entry of manifest.entries) {
    assert.match(entry.sha256, /^[0-9a-f]{64}$/);
    assert.ok(entry.size > 0);
  }
});

test('generated Android web assets match canonical sources', () => {
  const result = checkAssetSync();
  assert.deepEqual(result.failures, []);
});

test('path escape is rejected before a mirror can be written', (t) => {
  const options = fixture(t);
  options.assetGroups[0].targets = ['../escaped.txt'];
  assert.throws(() => writeAssetSync(options), /escapes repository/);
  assert.equal(fs.existsSync(path.join(options.repoRoot, '..', 'escaped.txt')), false);
});

test('missing canonical source is rejected', (t) => {
  const options = fixture(t);
  fs.unlinkSync(path.join(options.repoRoot, 'canonical/source.txt'));
  assert.throws(() => buildManifest(options), /Canonical source missing/);
});

test('missing target is reported by check mode without creating it', (t) => {
  const options = fixture(t);
  writeAssetSync(options);
  const target = path.join(options.repoRoot, 'mirror/target.txt');
  fs.unlinkSync(target);
  const result = checkAssetSync(options);
  assert.match(result.failures.join('\n'), /mirror\/target\.txt: missing/);
  assert.equal(fs.existsSync(target), false, 'check mode must remain read-only');
});

test('stale target is reported', (t) => {
  const options = fixture(t);
  writeAssetSync(options);
  fs.writeFileSync(path.join(options.repoRoot, 'mirror/target.txt'), 'stale\n');
  const result = checkAssetSync(options);
  assert.match(result.failures.join('\n'), /mirror\/target\.txt: [0-9a-f]{64} != [0-9a-f]{64}/);
});

test('stale manifest is reported', (t) => {
  const options = fixture(t);
  writeAssetSync(options);
  fs.appendFileSync(path.join(options.repoRoot, options.manifestPath), 'stale\n');
  const result = checkAssetSync(options);
  assert.ok(result.failures.includes('manifest.json: stale'));
});

test('symlink escape is rejected and outside file is untouched', (t) => {
  const options = fixture(t);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'cheaplive-asset-outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.symlinkSync(outside, path.join(options.repoRoot, 'mirror'));
  assert.throws(() => writeAssetSync(options), /symbolic link/);
  assert.equal(fs.existsSync(path.join(outside, 'target.txt')), false);
});

test('sync is idempotent and keeps the manifest byte-stable', (t) => {
  const options = fixture(t);
  const first = writeAssetSync(options);
  const manifestPath = path.join(options.repoRoot, options.manifestPath);
  const firstHash = sha256(manifestPath);
  const second = writeAssetSync(options);
  assert.equal(first.copied, 1);
  assert.equal(second.copied, 0);
  assert.equal(sha256(manifestPath), firstHash);
  assert.deepEqual(checkAssetSync(options).failures, []);
});

test('CLI check is independent of current working directory', () => {
  const workingDirectories = [
    REPO_ROOT,
    path.join(REPO_ROOT, 'scripts'),
    path.dirname(REPO_ROOT),
    os.tmpdir(),
  ];
  for (const cwd of workingDirectories) {
    const result = spawnSync(process.execPath, [SCRIPT_PATH, '--check'], {
      cwd,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, `cwd=${cwd}\nstdout=${result.stdout}\nstderr=${result.stderr}`);
    assert.match(result.stdout, /Web asset sync check passed/);
  }
});
