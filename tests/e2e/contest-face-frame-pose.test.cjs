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

function getCanvasPixelHash(page, canvasId) {
  return page.evaluate((id) => {
    const c = document.getElementById(id);
    if (!c) return null;
    const ctx = c.getContext('2d');
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let hash = 0;
    const step = Math.max(1, Math.floor(data.length / 4 / 1000));
    for (let i = 0; i < data.length; i += step * 4) {
      hash = (hash * 31 + data[i] + data[i + 1] * 7 + data[i + 2] * 13) & 0x7fffffff;
    }
    return hash;
  }, canvasId);
}

test.describe('contest demo: face frame pose & mouth (Phase 2B)', () => {
  test('inject frame updates diagnostic and disables idle', async ({ page }) => {
    const errs = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errs.push(m.text());
    });
    page.on('pageerror', (e) => errs.push(e.message));

    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const diagBefore = await page.evaluate(() => ({
      idleActive: window.__cheapLiveContestAvatarDiag.idleActive,
      faceFrameActive: window.__cheapLiveContestAvatarDiag.faceFrameActive,
      lastAppliedSeq: window.__cheapLiveContestAvatarDiag.lastAppliedSeq,
    }));
    expect(diagBefore.idleActive).toBe(true);
    expect(diagBefore.faceFrameActive).toBe(false);
    expect(diagBefore.lastAppliedSeq).toBe(0);

    const result = await page.evaluate(() => {
      return window.__cheapLiveContestAvatarApplyFrame({
        source: 'mock-real-camera',
        seq: 1,
        headYaw: -20,
        headPitch: 10,
        headRoll: 15,
        mouthOpen: 0.1,
        mouthSmile: 0,
      });
    });
    expect(result).toBe(true);

    await page.waitForTimeout(100);

    const diagAfter = await page.evaluate(() => ({
      idleActive: window.__cheapLiveContestAvatarDiag.idleActive,
      faceFrameActive: window.__cheapLiveContestAvatarDiag.faceFrameActive,
      frameSource: window.__cheapLiveContestAvatarDiag.frameSource,
      lastAppliedSeq: window.__cheapLiveContestAvatarDiag.lastAppliedSeq,
      lastAppliedValues: window.__cheapLiveContestAvatarDiag.lastAppliedValues,
    }));

    expect(diagAfter.faceFrameActive).toBe(true);
    expect(diagAfter.frameSource).toBe('mock-real-camera');
    expect(diagAfter.lastAppliedSeq).toBe(1);
    expect(diagAfter.idleActive).toBe(false);
    expect(diagAfter.lastAppliedValues).toBeDefined();
    expect(typeof diagAfter.lastAppliedValues.yaw).toBe('number');
    expect(typeof diagAfter.lastAppliedValues.pitch).toBe('number');
    expect(typeof diagAfter.lastAppliedValues.roll).toBe('number');
    expect(typeof diagAfter.lastAppliedValues.mouthOpen).toBe('number');

    expect(errs.length).toBe(0);
  });

  test('two different frames produce different canvas output', async ({ page }) => {
    const errs = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errs.push(m.text());
    });
    page.on('pageerror', (e) => errs.push(e.message));

    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    await page.evaluate(() => {
      window.__cheapLiveContestAvatarApplyFrame({
        source: 'mock-real-camera',
        seq: 1,
        headYaw: -30,
        headPitch: 20,
        headRoll: -20,
        mouthOpen: 0.8,
        mouthSmile: 0.5,
      });
    });
    await page.waitForTimeout(100);

    const hash1 = await getCanvasPixelHash(page, 'avatarCanvas');

    await page.evaluate(() => {
      window.__cheapLiveContestAvatarApplyFrame({
        source: 'mock-real-camera',
        seq: 2,
        headYaw: 25,
        headPitch: -15,
        headRoll: 15,
        mouthOpen: 0.1,
        mouthSmile: 0,
      });
    });
    await page.waitForTimeout(100);

    const hash2 = await getCanvasPixelHash(page, 'avatarCanvas');

    expect(hash1).not.toBe(hash2);
    expect(hash1).not.toBeNull();
    expect(hash2).not.toBeNull();

    ensureScreenshotDir();
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'phase2b-frame-pose-mouth.png'),
      fullPage: true,
    });

    expect(errs.length).toBe(0);
  });

  test('idle stays disabled while frames keep coming', async ({ page }) => {
    const errs = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errs.push(m.text());
    });
    page.on('pageerror', (e) => errs.push(e.message));

    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    for (let i = 0; i < 5; i++) {
      await page.evaluate((idx) => {
        window.__cheapLiveContestAvatarApplyFrame({
          source: 'mock-real-camera',
          seq: idx,
          headYaw: idx * 5 - 10,
          headPitch: 0,
          headRoll: 0,
          mouthOpen: 0.3,
          mouthSmile: 0.2,
        });
      }, i);
      await page.waitForTimeout(50);
    }

    const diag = await page.evaluate(() => ({
      idleActive: window.__cheapLiveContestAvatarDiag.idleActive,
      faceFrameActive: window.__cheapLiveContestAvatarDiag.faceFrameActive,
      lastAppliedSeq: window.__cheapLiveContestAvatarDiag.lastAppliedSeq,
    }));

    expect(diag.faceFrameActive).toBe(true);
    expect(diag.idleActive).toBe(false);
    expect(diag.lastAppliedSeq).toBe(4);

    expect(errs.length).toBe(0);
  });
});
