#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
export const MANIFEST_PATH = 'docs/architecture/WEB_ASSET_SYNC_MANIFEST.json';

// This historical filename is kept so existing automation does not break.
// The map now covers only byte-for-byte mirrors proven to share one runtime
// contract. Same-named files that have intentionally diverged are documented
// in docs/architecture/WEB_ASSET_SYNC.md and are not copied by this script.
export const ASSET_GROUPS = [
  {
    feature: 'android-receiver-procedural-renderer',
    source: 'android-capture/app/src/main/assets/web/receiver/procedural-mesh-renderer.js',
    targets: [
      'android-capture/app/src/main/assets/web/contest-demo/procedural-mesh-renderer.js',
      'android-capture/app/src/main/assets/web/demo/procedural-mesh-renderer.js',
    ],
  },
  {
    feature: 'android-receiver-spindle-mesh',
    source: 'android-capture/app/src/main/assets/web/receiver/mesh-spindle-whale.js',
    targets: [
      'android-capture/app/src/main/assets/web/contest-demo/mesh-spindle-whale.js',
      'android-capture/app/src/main/assets/web/demo/mesh-spindle-whale.js',
    ],
  },
  {
    feature: 'android-receiver-sphere-mesh',
    source: 'android-capture/app/src/main/assets/web/receiver/mesh-sphere.js',
    targets: [
      'android-capture/app/src/main/assets/web/contest-demo/mesh-sphere.js',
    ],
  },
  {
    feature: 'soundtouch-runtime',
    source: 'src/face-tracking/lib/soundtouch.min.js',
    targets: [
      'android-capture/app/src/main/assets/web/contest-demo/lib/soundtouch.min.js',
    ],
  },
  {
    feature: 'mediapipe-license',
    source: 'src/face-tracking/mediapipe/LICENSE',
    targets: [
      'android-capture/app/src/main/assets/web/contest-demo/mediapipe/LICENSE',
      'android-capture/app/src/main/assets/web/mediapipe/LICENSE',
    ],
  },
  {
    feature: 'face-landmarker-model',
    source: 'src/face-tracking/mediapipe/face_landmarker.task',
    targets: [
      'android-capture/app/src/main/assets/web/contest-demo/mediapipe/face_landmarker.task',
      'android-capture/app/src/main/assets/web/mediapipe/tasks-vision/face_landmarker.task',
    ],
  },
  {
    feature: 'mediapipe-vision-bundle',
    source: 'src/face-tracking/mediapipe/vision_bundle.mjs',
    targets: [
      'android-capture/app/src/main/assets/web/contest-demo/mediapipe/vision_bundle.mjs',
      'android-capture/app/src/main/assets/web/mediapipe/tasks-vision/vision_bundle.mjs',
    ],
  },
  ...[
    'vision_wasm_internal.js',
    'vision_wasm_internal.wasm',
    'vision_wasm_nosimd_internal.js',
    'vision_wasm_nosimd_internal.wasm',
  ].map((name) => ({
    feature: `mediapipe-${name}`,
    source: `src/face-tracking/mediapipe/wasm/${name}`,
    targets: [
      `android-capture/app/src/main/assets/web/contest-demo/mediapipe/wasm/${name}`,
      `android-capture/app/src/main/assets/web/mediapipe/tasks-vision/wasm/${name}`,
    ],
  })),
];

function resolveRepoPath(relativePath) {
  const resolved = path.resolve(REPO_ROOT, relativePath);
  const prefix = `${REPO_ROOT}${path.sep}`;
  if (!resolved.startsWith(prefix)) {
    throw new Error(`Asset path escapes repository: ${relativePath}`);
  }
  return resolved;
}

export function sha256File(relativePath) {
  const bytes = fs.readFileSync(resolveRepoPath(relativePath));
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

export function buildManifest() {
  return {
    schemaVersion: 1,
    generatedBy: 'node scripts/sync-contest-demo-to-android.mjs --write',
    entries: ASSET_GROUPS.map((group) => {
      const sourcePath = resolveRepoPath(group.source);
      if (!fs.existsSync(sourcePath)) {
        throw new Error(`Canonical source missing: ${group.source}`);
      }
      return {
        feature: group.feature,
        source: group.source,
        sha256: sha256File(group.source),
        size: fs.statSync(sourcePath).size,
        targets: [...group.targets],
      };
    }),
  };
}

export function checkAssetSync() {
  const manifest = buildManifest();
  const failures = [];

  for (const entry of manifest.entries) {
    for (const target of entry.targets) {
      const targetPath = resolveRepoPath(target);
      if (!fs.existsSync(targetPath)) {
        failures.push(`${target}: missing (source ${entry.source})`);
        continue;
      }
      const actualHash = sha256File(target);
      if (actualHash !== entry.sha256) {
        failures.push(`${target}: ${actualHash} != ${entry.sha256} (source ${entry.source})`);
      }
    }
  }

  const expectedManifest = `${JSON.stringify(manifest, null, 2)}\n`;
  const manifestPath = resolveRepoPath(MANIFEST_PATH);
  if (!fs.existsSync(manifestPath)) {
    failures.push(`${MANIFEST_PATH}: missing`);
  } else if (fs.readFileSync(manifestPath, 'utf8') !== expectedManifest) {
    failures.push(`${MANIFEST_PATH}: stale`);
  }

  return { failures, manifest };
}

export function writeAssetSync() {
  const manifest = buildManifest();
  let copied = 0;

  for (const entry of manifest.entries) {
    const sourcePath = resolveRepoPath(entry.source);
    for (const target of entry.targets) {
      const targetPath = resolveRepoPath(target);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      if (!fs.existsSync(targetPath) || sha256File(target) !== entry.sha256) {
        fs.copyFileSync(sourcePath, targetPath);
        copied += 1;
      }
    }
  }

  const manifestPath = resolveRepoPath(MANIFEST_PATH);
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { copied, manifest };
}

function main() {
  const mode = process.argv.includes('--write') ? 'write' : 'check';
  if (mode === 'write') {
    const result = writeAssetSync();
    console.log(`Web asset sync complete: copied=${result.copied}, groups=${result.manifest.entries.length}`);
    return;
  }

  const result = checkAssetSync();
  if (result.failures.length > 0) {
    console.error('Web asset sync check failed:');
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Web asset sync check passed: groups=${result.manifest.entries.length}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
