import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const requestedDirectory = process.env.CHEAPLIVE_MOTION_VIDEO_DIR;
if (!requestedDirectory) {
  console.log('MOTION_VIDEO_TEST: SKIPPED (CHEAPLIVE_MOTION_VIDEO_DIR is not set)');
  process.exit(0);
}

const videoDirectory = path.resolve(requestedDirectory);
if (!fs.existsSync(videoDirectory) || !fs.statSync(videoDirectory).isDirectory()) {
  console.error('MOTION_VIDEO_TEST: FAIL (configured directory does not exist or is not a directory)');
  process.exit(1);
}
const extensions = new Set(['.mp4', '.mov', '.webm', '.m4v']);
const videoFiles = fs.readdirSync(videoDirectory)
  .filter((name) => extensions.has(path.extname(name).toLowerCase()))
  .sort();
if (videoFiles.length === 0) {
  console.error('MOTION_VIDEO_TEST: FAIL (configured directory contains no supported video files)');
  process.exit(1);
}

async function reservePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const address = probe.address();
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  if (!address || typeof address !== 'object') throw new Error('Failed to reserve a local test port');
  return address.port;
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceDirectory = path.join(repoRoot, '.tmp', 'test-evidence', 'motion-video', timestamp);
fs.mkdirSync(evidenceDirectory, { recursive: true });
const port = await reservePort();
const playwright = path.join(repoRoot, 'node_modules', '.bin', 'playwright');
console.log(`MOTION_VIDEO_TEST: RUN videos=${videoFiles.length} evidence=.tmp/test-evidence/motion-video/${timestamp}`);
const result = spawnSync(playwright, [
  'test',
  '--config', 'tests/motion-video/playwright.motion.config.mjs',
  '--project', 'chromium-desktop',
  '--workers', '1',
], {
  cwd: repoRoot,
  env: {
    ...process.env,
    CHEAPLIVE_TEST_PORT: String(port),
    CHEAPLIVE_TEST_BASE_URL: `http://127.0.0.1:${port}`,
    CHEAPLIVE_MOTION_VIDEO_DIR: videoDirectory,
    CHEAPLIVE_MOTION_EVIDENCE_DIR: evidenceDirectory,
  },
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
