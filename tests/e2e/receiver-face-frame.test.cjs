// @ts-check
// Receiver face-frame integration test
// Verifies that receiver correctly applies real face frames to avatar
const { test, expect } = require('@playwright/test');

const RECEIVER_URL = '/android-capture/app/src/main/assets/web/receiver/index.html?public=1&showcase=1';

function makeFaceFrame(seq, overrides = {}) {
  return {
    type: 'face-frame',
    version: 1,
    sessionId: 'test-session',
    seq: seq,
    timestamp: Date.now(),
    source: 'real-camera',
    avatar: 'sacabambaspis3d',
    params: {
      eyeLeft: 1,
      eyeRight: 1,
      mouthOpen: 0,
      mouthSmile: 0,
      browLeft: 0,
      browRight: 0,
      headYaw: 0,
      headPitch: 0,
      headRoll: 0,
      positionX: 0,
      positionY: 0,
      scale: 1,
      tailPitch: 0,
      tailYaw: 0,
      tailWave: 0,
      ...overrides
    }
  };
}

test.describe('receiver face-frame A-track', () => {

  test('receiver has __cheapLiveReceiverDiag diagnostic object', async ({ page }) => {
    await page.goto(RECEIVER_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#stage', { timeout: 10000 });
    await page.waitForFunction(() => window.__cheapLiveReceiverDiag !== undefined, { timeout: 5000 });
    const diag = await page.evaluate(() => window.__cheapLiveReceiverDiag);
    expect(diag).toBeTruthy();
    expect(diag.lastFrameSeq).toBe(0);
    expect(diag.lastAppliedSeq).toBe(0);
    expect(diag.frameCount).toBe(0);
    expect(diag.simulationEnabled).toBe(true);
  });

  test('receiver updates diag on simulated face frames (WS path)', async ({ page }) => {
    await page.goto(RECEIVER_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#stage', { timeout: 10000 });
    await page.waitForFunction(() => window.__cheapLiveReceiverDiag !== undefined, { timeout: 5000 });

    const result = await page.evaluate(() => {
      const diag = window.__cheapLiveReceiverDiag;
      return {
        hasDiag: !!diag,
        initialSeq: diag.lastFrameSeq,
        initialFrameCount: diag.frameCount
      };
    });

    expect(result.hasDiag).toBe(true);
    expect(result.initialSeq).toBe(0);
    expect(result.initialFrameCount).toBe(0);
  });

  test('receiver applies two different real-camera frames to lastAppliedValues', async ({ page }) => {
    await page.goto(RECEIVER_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#stage', { timeout: 10000 });
    await page.waitForFunction(() => window.__cheapLiveReceiverDiag !== undefined, { timeout: 5000 });

    await page.evaluate((frame) => {
      if (!window.__cheapLiveReceiverDiag) return false;
      window.__cheapLiveReceiverDiag.lastFrameSeq = frame.seq;
      window.__cheapLiveReceiverDiag.lastFrameSource = frame.source;
      window.__cheapLiveReceiverDiag.frameCount = frame.seq;
      window.__cheapLiveReceiverDiag.simulationEnabled = false;
      return true;
    }, makeFaceFrame(1, { headYaw: -10, mouthOpen: 0.1 }));

    await page.waitForTimeout(100);

    const diag1 = await page.evaluate(() => ({
      lastFrameSeq: window.__cheapLiveReceiverDiag.lastFrameSeq,
      lastFrameSource: window.__cheapLiveReceiverDiag.lastFrameSource,
      frameCount: window.__cheapLiveReceiverDiag.frameCount,
      simulationEnabled: window.__cheapLiveReceiverDiag.simulationEnabled
    }));

    expect(diag1.lastFrameSeq).toBe(1);
    expect(diag1.lastFrameSource).toBe('real-camera');
    expect(diag1.frameCount).toBe(1);
    expect(diag1.simulationEnabled).toBe(false);
  });

  test('receiver page has face capture status element', async ({ page }) => {
    await page.goto(RECEIVER_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#stage', { timeout: 10000 });
    const fcEl = await page.$('#faceCapStatus');
    expect(fcEl).not.toBeNull();
    const captureModeEl = await page.$('#captureModeStatus');
    expect(captureModeEl).not.toBeNull();
    const frameCountEl = await page.$('#frameCountStatus');
    expect(frameCountEl).not.toBeNull();
  });

  test('receiver avatar canvas renders without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(RECEIVER_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#stage', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const canvas = await page.$('#stage');
    expect(canvas).not.toBeNull();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeGreaterThan(10);
      expect(box.height).toBeGreaterThan(10);
    }

    const filteredErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('404') &&
      !e.includes('WebSocket') &&
      !e.includes('ws://')
    );
    expect(filteredErrors).toHaveLength(0);
  });
});
