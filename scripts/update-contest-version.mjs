#!/usr/bin/env node
// scripts/update-contest-version.mjs
// 用法：node scripts/update-contest-version.mjs
// 作用：把当前 git HEAD 的 branch / short SHA / 构建时间写入
//       src/contest-demo/contest-build.json，供参赛 Demo 页面静态展示版本号。
// 局限：commit 自身 SHA 无法在 commit 时已知，因此记录的是 build 时刻的 HEAD SHA，
//       不是该 commit 自身的 SHA。这是静态 GitHub Pages 下的合理折中，不做 amend 循环。

import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');
const targetFile = join(repoRoot, 'src/contest-demo/contest-build.json');

function run(cmd) {
  try {
    return execSync(cmd, { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch (e) {
    return '';
  }
}

function pad(n) { return n < 10 ? '0' + n : '' + n; }

function formatLocal(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())} +0800`;
}

function formatUTC(d) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

const branch = run('git rev-parse --abbrev-ref HEAD') || 'unknown';
const gitShortSha = run('git rev-parse --short HEAD') || 'unknown';
const now = new Date();

let prev = {};
try {
  prev = JSON.parse(readFileSync(targetFile, 'utf8'));
} catch (e) {
  // ignore
}

const stamp = {
  branch,
  gitShortSha,
  buildTimeLocal: formatLocal(now),
  buildTimeUTC: formatUTC(now),
  note: 'Static build stamp for GitHub Pages. Updated by scripts/update-contest-version.mjs before release. Self-referential SHA limitation applies: the SHA recorded here is the HEAD at build time, not the SHA of the commit that contains this file.',
};

if (prev.gitShortSha === gitShortSha && prev.branch === branch) {
  // SHA 没变就只更新 buildTime，避免每次都改文件造成 noise
  stamp.buildTimeLocal = prev.buildTimeLocal;
  stamp.buildTimeUTC = prev.buildTimeUTC;
}

writeFileSync(targetFile, JSON.stringify(stamp, null, 2) + '\n', 'utf8');
console.log('[update-contest-version] wrote', targetFile);
console.log(JSON.stringify(stamp, null, 2));
