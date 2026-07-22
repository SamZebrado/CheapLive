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

function normalizeOptions(options = {}) {
  return {
    repoRoot: fs.realpathSync(options.repoRoot ?? REPO_ROOT),
    assetGroups: options.assetGroups ?? ASSET_GROUPS,
    manifestPath: options.manifestPath ?? MANIFEST_PATH,
  };
}

export function resolveRepoPath(relativePath, repoRoot = REPO_ROOT) {
  if (typeof relativePath !== 'string' || relativePath.length === 0 || path.isAbsolute(relativePath)) {
    throw new Error(`Asset path must be a non-empty repository-relative path: ${relativePath}`);
  }
  const canonicalRoot = fs.realpathSync(repoRoot);
  const resolved = path.resolve(canonicalRoot, relativePath);
  const prefix = `${canonicalRoot}${path.sep}`;
  if (!resolved.startsWith(prefix)) {
    throw new Error(`Asset path escapes repository: ${relativePath}`);
  }
  return resolved;
}

export function assertSafeRepoPath(relativePath, options = {}) {
  const { repoRoot } = normalizeOptions(options);
  const resolved = resolveRepoPath(relativePath, repoRoot);
  const relativeParts = path.relative(repoRoot, resolved).split(path.sep);
  let cursor = repoRoot;
  for (const part of relativeParts) {
    cursor = path.join(cursor, part);
    if (!fs.existsSync(cursor)) break;
    if (fs.lstatSync(cursor).isSymbolicLink()) {
      throw new Error(`Asset path contains a symbolic link: ${relativePath}`);
    }
  }
  return resolved;
}

function requireRegularFile(relativePath, options, label) {
  const resolved = assertSafeRepoPath(relativePath, options);
  if (!fs.existsSync(resolved)) {
    throw new Error(`${label} missing: ${relativePath}`);
  }
  if (!fs.lstatSync(resolved).isFile()) {
    throw new Error(`${label} is not a regular file: ${relativePath}`);
  }
  return resolved;
}

export function sha256File(relativePath, options = {}) {
  const bytes = fs.readFileSync(requireRegularFile(relativePath, options, 'Asset file'));
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

export function buildManifest(options = {}) {
  const normalized = normalizeOptions(options);
  const groups = [...normalized.assetGroups]
    .map((group) => ({ ...group, targets: [...group.targets].sort() }))
    .sort((left, right) => left.feature.localeCompare(right.feature));
  return {
    schemaVersion: 1,
    generatedBy: 'node scripts/sync-contest-demo-to-android.mjs --write',
    entries: groups.map((group) => {
      const sourcePath = requireRegularFile(group.source, normalized, 'Canonical source');
      return {
        feature: group.feature,
        source: group.source,
        sha256: sha256File(group.source, normalized),
        size: fs.statSync(sourcePath).size,
        targets: [...group.targets],
      };
    }),
  };
}

export function checkAssetSync(options = {}) {
  const normalized = normalizeOptions(options);
  const manifest = buildManifest(normalized);
  const failures = [];

  for (const entry of manifest.entries) {
    for (const target of entry.targets) {
      let targetPath;
      try {
        targetPath = assertSafeRepoPath(target, normalized);
      } catch (error) {
        failures.push(`${target}: ${error.message}`);
        continue;
      }
      if (!fs.existsSync(targetPath)) {
        failures.push(`${target}: missing (source ${entry.source})`);
        continue;
      }
      if (!fs.lstatSync(targetPath).isFile()) {
        failures.push(`${target}: not a regular file (source ${entry.source})`);
        continue;
      }
      const actualHash = sha256File(target, normalized);
      if (actualHash !== entry.sha256) {
        failures.push(`${target}: ${actualHash} != ${entry.sha256} (source ${entry.source})`);
      }
    }
  }

  const expectedManifest = `${JSON.stringify(manifest, null, 2)}\n`;
  let manifestPath;
  try {
    manifestPath = assertSafeRepoPath(normalized.manifestPath, normalized);
  } catch (error) {
    failures.push(`${normalized.manifestPath}: ${error.message}`);
    return { failures, manifest };
  }
  if (!fs.existsSync(manifestPath)) {
    failures.push(`${normalized.manifestPath}: missing`);
  } else if (fs.readFileSync(manifestPath, 'utf8') !== expectedManifest) {
    failures.push(`${normalized.manifestPath}: stale`);
  }

  return { failures, manifest };
}

export function writeAssetSync(options = {}) {
  const normalized = normalizeOptions(options);
  const manifest = buildManifest(normalized);
  let copied = 0;

  for (const entry of manifest.entries) {
    const sourcePath = requireRegularFile(entry.source, normalized, 'Canonical source');
    for (const target of entry.targets) {
      let targetPath = assertSafeRepoPath(target, normalized);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      targetPath = assertSafeRepoPath(target, normalized);
      if (fs.existsSync(targetPath) && !fs.lstatSync(targetPath).isFile()) {
        throw new Error(`Mirror target is not a regular file: ${target}`);
      }
      if (!fs.existsSync(targetPath) || sha256File(target, normalized) !== entry.sha256) {
        fs.copyFileSync(sourcePath, targetPath);
        copied += 1;
      }
    }
  }

  let manifestPath = assertSafeRepoPath(normalized.manifestPath, normalized);
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  manifestPath = assertSafeRepoPath(normalized.manifestPath, normalized);
  if (fs.existsSync(manifestPath) && !fs.lstatSync(manifestPath).isFile()) {
    throw new Error(`Manifest target is not a regular file: ${normalized.manifestPath}`);
  }
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
