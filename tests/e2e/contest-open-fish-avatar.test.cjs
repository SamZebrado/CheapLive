const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const DEMO_URL = 'http://127.0.0.1:8769/src/contest-demo/contest-interactive-demo.html';
const SCREENSHOT_DIR = path.join(__dirname, '..', '..', '.automation', 'contest-demo-open-fish');

function ensureScreenshotDir() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
}

test.describe('contest demo: open 3D fish avatar (Phase 1A + P0 fix)', () => {
  test('default avatar is 3D sacabambaspis from src/face-tracking, with real pixel content', async ({ page }) => {
    const errs = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errs.push(m.text());
    });
    page.on('pageerror', (e) => errs.push(e.message));

    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const diag = await page.evaluate(() => window.__cheapLiveContestAvatarDiag);
    expect(diag).toBeDefined();
    expect(diag.rendererKey).toBe('sacabambaspis3d');
    expect(diag.source).toBe('src/face-tracking');
    expect(diag.fallbackActive).toBe(false);
    expect(diag.fallbackReason).toBeNull();
    expect(diag.rendererReady).toBe(true);
    expect(diag.error).toBeNull();
    expect(diag.rendererClass).toBe('ProceduralSpindleWhaleAvatar');

    const selectedBtn = await page.evaluate(() => {
      const btn = document.querySelector('#avatarGrid .avatar-btn.selected');
      return btn ? btn.dataset.avatar : null;
    });
    expect(selectedBtn).toBe('sacabambaspis-3d');

    // Canvas 必须是正方形（关键 P0 修复：之前被 CSS 拉成 1398×360）
    expect(diag.mainCanvasDiag).not.toBeNull();
    expect(diag.mainCanvasDiag.isSquare).toBe(true);
    expect(diag.mainCanvasDiag.w).toBeGreaterThan(300);
    expect(diag.mainCanvasDiag.h).toBeGreaterThan(300);

    // 浮动窗 canvas 也必须正方形
    expect(diag.fwCanvasDiag).not.toBeNull();
    expect(diag.fwCanvasDiag.isSquare).toBe(true);

    // Canvas 必须有真实像素内容（非空白、非 fallback 黑屏）
    const canvasHasContent = await page.evaluate(() => {
      const c = document.getElementById('avatarCanvas');
      if (!c) return false;
      const ctx = c.getContext('2d');
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let nonEmpty = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0) {
          nonEmpty++;
          if (nonEmpty > 100) return true;
        }
      }
      return nonEmpty > 100;
    });
    expect(canvasHasContent).toBe(true);

    expect(errs.length).toBe(0);

    ensureScreenshotDir();
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'phase1a-default-3d-fish.png'),
      fullPage: true,
    });
  });

  test('2D white fish fallback not active, default selected is 3D', async ({ page }) => {
    const errs = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errs.push(m.text());
    });
    page.on('pageerror', (e) => errs.push(e.message));

    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const diag = await page.evaluate(() => window.__cheapLiveContestAvatarDiag);
    expect(diag.fallbackActive).toBe(false);

    const is3DSelected = await page.evaluate(() => {
      const btn = document.querySelector('#avatarGrid .avatar-btn.selected');
      return btn && btn.dataset.avatar === 'sacabambaspis-3d';
    });
    expect(is3DSelected).toBe(true);

    expect(errs.length).toBe(0);
  });

  test('injecting yaw-left / yaw-right / roll produces distinct canvas pixel hashes', async ({ page }) => {
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const hashOf = async () => {
      return await page.evaluate(() => {
        const c = document.getElementById('avatarCanvas');
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let h = 5381;
        for (let i = 0; i < d.length; i += 4) {
          h = ((h << 5) + h + d[i] + d[i + 1] + d[i + 2]) | 0;
        }
        return h;
      });
    };

    const base = await hashOf();

    await page.evaluate(() => {
      window.__cheapLiveContestAvatarApplyFrame({
        seq: 1, source: 'mock-real-camera',
        headYaw: -25, headPitch: 0, headRoll: 0,
        mouthOpen: 0.05, mouthSmile: 0,
      });
    });
    await page.waitForTimeout(250);
    const yawLeft = await hashOf();

    await page.evaluate(() => {
      window.__cheapLiveContestAvatarApplyFrame({
        seq: 2, source: 'mock-real-camera',
        headYaw: 25, headPitch: 0, headRoll: 0,
        mouthOpen: 0.05, mouthSmile: 0,
      });
    });
    await page.waitForTimeout(250);
    const yawRight = await hashOf();

    await page.evaluate(() => {
      window.__cheapLiveContestAvatarApplyFrame({
        seq: 3, source: 'mock-real-camera',
        headYaw: 0, headPitch: 0, headRoll: 25,
        mouthOpen: 0.05, mouthSmile: 0,
      });
    });
    await page.waitForTimeout(250);
    const roll = await hashOf();

    // 4 个 hash 必须互不相同，证明 3D 渲染管线真正在响应姿态
    const distinct = new Set([base, yawLeft, yawRight, roll]);
    expect(distinct.size).toBe(4);

    // diagnostic 也应记录最后注入的值
    const diag = await page.evaluate(() => window.__cheapLiveContestAvatarDiag);
    expect(diag.lastRenderTime).not.toBeNull();
  });
});
