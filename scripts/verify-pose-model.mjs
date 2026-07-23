import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const expected = Object.freeze({
  bytes: 5_777_746,
  sha256: '59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a',
});
const files = [
  'src/shared/models/pose_landmarker_lite.task',
  'android-capture/app/src/main/assets/web/mediapipe/tasks-vision/pose_landmarker_lite.task',
];

const digests = files.map((relative) => {
  const contents = fs.readFileSync(path.join(repoRoot, relative));
  const sha256 = crypto.createHash('sha256').update(contents).digest('hex');
  assert.equal(contents.byteLength, expected.bytes, `${relative}: unexpected byte size`);
  assert.equal(sha256, expected.sha256, `${relative}: unexpected SHA-256`);
  return sha256;
});
assert.equal(new Set(digests).size, 1, 'canonical and Android model copies differ');

const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'docs/architecture/WEB_ASSET_SYNC_MANIFEST.json'), 'utf8'));
const serialized = JSON.stringify(manifest);
assert.ok(serialized.includes(expected.sha256), 'asset manifest does not pin the audited model SHA-256');
assert.ok(serialized.includes(files[0]), 'asset manifest does not name the canonical model');
assert.ok(serialized.includes(files[1]), 'asset manifest does not name the Android model mirror');

console.log(`Pose model check passed: files=${files.length} bytes=${expected.bytes} sha256=${expected.sha256}`);
