import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ASSET_GROUPS,
  buildManifest,
  checkAssetSync,
} from '../../scripts/sync-contest-demo-to-android.mjs';

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
