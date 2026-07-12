#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WEB_ROOT = path.resolve(__dirname, '..', 'src');
const ANDROID_ASSETS_ROOT = path.resolve(__dirname, '..', '..', 'CheapLive', 'android-capture', 'app', 'src', 'main', 'assets', 'web');
const TARGET_DIR = path.join(ANDROID_ASSETS_ROOT, 'contest-demo');

const ALLOWLIST = [
  { src: 'contest-demo/contest-interactive-demo.html', dest: 'contest-interactive-demo.html' },
  { src: 'contest-demo/contest-interactive-demo.js', dest: 'contest-interactive-demo.js' },
  { src: 'contest-demo/contest-interactive-demo.css', dest: 'contest-interactive-demo.css' },
  { src: 'contest-demo/contest-avatar-adapter.js', dest: 'contest-avatar-adapter.js' },
  { src: 'contest-demo/contest-voice-adapter.js', dest: 'contest-voice-adapter.js' },
  { src: 'contest-demo/contest-build.json', dest: 'contest-build.json' },
  { src: 'face-tracking/procedural-mesh-renderer.js', dest: 'procedural-mesh-renderer.js' },
  { src: 'face-tracking/mesh-spindle-whale.js', dest: 'mesh-spindle-whale.js' },
  { src: 'face-tracking/mesh-sphere.js', dest: 'mesh-sphere.js' },
  { src: 'face-tracking/procedural-avatar-classic.js', dest: 'procedural-avatar-classic.js' },
  { src: 'face-tracking/voice-changer.js', dest: 'voice-changer.js' },
  { src: 'face-tracking/lib/soundtouch.min.js', dest: 'lib/soundtouch.min.js' },
  { src: 'face-tracking/mediapipe/vision_bundle.mjs', dest: 'mediapipe/vision_bundle.mjs' },
  { src: 'face-tracking/mediapipe/LICENSE', dest: 'mediapipe/LICENSE' },
  { src: 'face-tracking/mediapipe/face_landmarker.task', dest: 'mediapipe/face_landmarker.task' },
  { src: 'face-tracking/mediapipe/wasm/vision_wasm_internal.js', dest: 'mediapipe/wasm/vision_wasm_internal.js' },
  { src: 'face-tracking/mediapipe/wasm/vision_wasm_internal.wasm', dest: 'mediapipe/wasm/vision_wasm_internal.wasm' },
  { src: 'face-tracking/mediapipe/wasm/vision_wasm_nosimd_internal.js', dest: 'mediapipe/wasm/vision_wasm_nosimd_internal.js' },
  { src: 'face-tracking/mediapipe/wasm/vision_wasm_nosimd_internal.wasm', dest: 'mediapipe/wasm/vision_wasm_nosimd_internal.wasm' },
];

function computeFileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 32);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getGitSha() {
  try {
    const result = fs.readFileSync(path.join(WEB_ROOT, '..', '.git', 'HEAD'), 'utf-8').trim();
    if (result.startsWith('ref: ')) {
      const refPath = path.join(WEB_ROOT, '..', '.git', result.slice(5));
      return fs.readFileSync(refPath, 'utf-8').trim().slice(0, 8);
    }
    return result.slice(0, 8);
  } catch {
    return 'unknown';
  }
}

async function sync() {
  console.log('=== Contest Demo → Android Assets Sync ===');
  console.log(`Web Root: ${WEB_ROOT}`);
  console.log(`Android Assets Root: ${ANDROID_ASSETS_ROOT}`);
  console.log(`Target: ${TARGET_DIR}`);
  
  if (!fs.existsSync(WEB_ROOT)) {
    console.error('Error: Web root not found');
    process.exit(1);
  }
  
  if (!fs.existsSync(ANDROID_ASSETS_ROOT)) {
    console.error('Error: Android assets root not found');
    process.exit(1);
  }
  
  ensureDir(TARGET_DIR);
  
  const manifest = {
    sourceSha: getGitSha(),
    syncTime: new Date().toISOString(),
    files: [],
  };
  
  let changedCount = 0;
  let copiedCount = 0;
  
  for (const item of ALLOWLIST) {
    const srcPath = path.join(WEB_ROOT, item.src);
    const destPath = path.join(TARGET_DIR, item.dest);
    
    if (!fs.existsSync(srcPath)) {
      console.warn(`Source missing: ${item.src}`);
      continue;
    }
    
    ensureDir(path.dirname(destPath));
    
    const srcHash = computeFileHash(srcPath);
    let destHash = null;
    if (fs.existsSync(destPath)) {
      destHash = computeFileHash(destPath);
    }
    
    if (srcHash !== destHash) {
      fs.copyFileSync(srcPath, destPath);
      copiedCount++;
      if (destHash !== null) {
        changedCount++;
      }
      console.log(`Copied: ${item.src} → ${item.dest}`);
    } else {
      console.log(`Skipped (unchanged): ${item.src}`);
    }
    
    manifest.files.push({
      src: item.src,
      dest: item.dest,
      hash: srcHash,
      size: fs.statSync(srcPath).size,
    });
  }
  
  const manifestPath = path.join(TARGET_DIR, 'contest-demo-assets-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  
  console.log('');
  console.log('=== Sync Complete ===');
  console.log(`Source SHA: ${manifest.sourceSha}`);
  console.log(`Copied: ${copiedCount} files`);
  console.log(`Changed: ${changedCount} files`);
  console.log(`Manifest written to: ${manifestPath}`);
  
  return { copiedCount, changedCount, manifest };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  sync().catch(console.error);
}

export { sync, ALLOWLIST, TARGET_DIR, WEB_ROOT };
