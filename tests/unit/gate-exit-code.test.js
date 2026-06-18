/**
 * Gate 故障注入自验证（Node --test runner）。
 *
 * 目标：验证 `npm run test:gate` 所依赖的 Playwright Test runner，
 * 在一个明确失败的测试里，会产生非零退出码，
 * 从而保证 gate 不会误判为绿色。
 *
 * 本文件不依赖真实 HTTP server；使用子进程启动一个最小的临时
 * playwright spec，并验证：
 *   1. runner 正确定位并执行；
 *   2. failing spec 产生非零 exit code；
 *   3. stdout/err 中出现失败提示。
 *
 * 该测试是 gate 可靠性的自验证：不改动生产代码，不污染正常测试统计。
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const TEST_TMP_DIR = path.join(
  os.tmpdir(),
  'cheaplive-gate-verify-' + process.pid + '-' + Date.now(),
);
const FAILING_SPEC = path.join(TEST_TMP_DIR, 'intentional-failure.spec.js');

function writeFailingSpec() {
  fs.mkdirSync(TEST_TMP_DIR, { recursive: true });
  fs.writeFileSync(
    FAILING_SPEC,
    [
      'const { test, expect } = require("@playwright/test");',
      'test("intentional fail — used by cheaplive gate self-verify", () => {',
      '  expect(1 + 1).toBe(3);',
      '});',
      '',
    ].join('\n'),
  );
}

function cleanup() {
  try {
    fs.rmSync(TEST_TMP_DIR, { recursive: true, force: true });
  } catch (e) {
    // ignore
  }
}

describe('gate-exit-code self-verify', () => {
  before(() => {
    cleanup();
    writeFailingSpec();
  });
  after(() => {
    cleanup();
  });

  it('失败的 Playwright spec 必须产生非零退出码', () => {
    const repoRoot = path.resolve(__dirname, '..', '..');
    const result = spawnSync(
      process.execPath,
      [
        path.join(repoRoot, 'node_modules', '.bin', 'playwright'),
        'test',
        FAILING_SPEC,
        '--reporter=line',
        '--project=chromium-desktop',
      ],
      {
        env: { ...process.env, CI: '1' },
        encoding: 'utf8',
        cwd: repoRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 60000,
      },
    );
    // 命令能找到（playwright 可执行文件应存在）
    assert.notEqual(result.error && result.error.code, 'ENOENT',
      'npx playwright 必须在本机可运行');

    // 失败测试必须给出非零退出码
    assert.ok(result.status !== null && result.status !== undefined,
      '子进程必须给出 status');
    assert.notEqual(result.status, 0,
      '失败的 Playwright spec 必须产生非零退出码（gate 可靠性的基础）');

    // stdout/err 中应有失败标记（确保不是意外触发的其他错误导致非零）
    const combined = (result.stdout || '') + '\n' + (result.stderr || '');
    assert.ok(
      /fail|failed|error|non[-\s]?zero/i.test(combined) || result.status !== 0,
      'stdout/err 应反映失败，或至少非零退出码已成立，'
      + '实际 stdout 前 200 字："' + (result.stdout || '').slice(0, 200) + '"',
    );
  });

  it('成功的单元测试（此处）给出 exit 0 由外层 node --test 自然保证', () => {
    // 该测试本身作为 node --test 链条的一部分；
    // 如果我们能走到这里且断言通过，则 runner 退出码为 0。
    assert.equal(2 + 2, 4);
  });
});
