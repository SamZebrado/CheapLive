/**
 * Receiver 眼睛/roll/瞳孔/眼皮形状专项测试
 *
 * 覆盖：
 * 1. 睁眼 / 半闭眼 / 闭眼形状
 * 2. 头部 roll：眼睛随脸旋转，不反向
 * 3. 瞳孔 gaze 偏移：左右/上下可见
 * 4. 下眼皮稳定、上眼皮下盖
 *
 * 使用方法：npx playwright test tests/e2e/receiver-eye-roll-shape.test.mjs --project=chromium-desktop
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';

const RECEIVER_URL = 'http://127.0.0.1:8769/android-capture/app/src/main/assets/web/receiver/index.html?token=test-token';
const ARTIFACTS_DIR = './.automation/f-track-eye-roll-shape';

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
});

async function waitForRenderer(page, timeout = 15000) {
  await page.waitForFunction(
    () => typeof window._ProceduralSpindleWhaleAvatar !== 'undefined',
    { timeout }
  );
  await page.evaluate(() => {
    const diag = window.__cheapLiveReceiverDiag || {};
    if (!diag.rendererReady && typeof window.__cheapLiveInitRenderer === 'function') {
      window.__cheapLiveInitRenderer('sacabambaspis3d');
    }
  });
  await page.waitForFunction(
    () => {
      const diag = window.__cheapLiveReceiverDiag || {};
      return diag.rendererReady === true;
    },
    { timeout }
  );
  await page.waitForTimeout(500);
}

async function injectFaceFrame(page, params) {
  await page.evaluate((p) => {
    if (typeof window.__cheapLiveInjectFaceFrame === 'function') {
      window.__cheapLiveInjectFaceFrame(p, 'real-camera');
    }
  }, params);
  await page.waitForTimeout(300);
}

// F 轨测试关注几何形状，关闭镜像避免左右眼/gaze 被交换导致断言反向。
async function setMirror(page, enabled) {
  await page.evaluate((en) => {
    if (typeof window.__cheapLiveSetMirror === 'function') {
      window.__cheapLiveSetMirror(en);
    }
  }, enabled);
}

async function getEyeDebug(page) {
  return await page.evaluate(() => {
    const diag = window.__cheapLiveReceiverDiag || {};
    return {
      eyeLeftDebug: diag.eyeLeftDebug || null,
      eyeRightDebug: diag.eyeRightDebug || null,
      rendererParams: diag.rendererParams || null,
      lastAppliedValues: diag.lastAppliedValues || {},
    };
  });
}

async function getCanvasPixelHash(page) {
  return await page.evaluate(() => {
    const canvas = document.getElementById('stage');
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let h = 0;
    for (let i = 0; i < data.length; i += 16) {
      h = ((h << 5) - h + data[i]) | 0;
      h = ((h << 5) - h + data[i + 1]) | 0;
      h = ((h << 5) - h + data[i + 2]) | 0;
    }
    return h;
  });
}

test.describe('Receiver 眼睛形状与 roll', () => {
  test('睁眼 / 半闭眼 / 闭眼形状变化', async ({ page }) => {
    await page.goto(RECEIVER_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await waitForRenderer(page);
    await setMirror(page, false);

    const cases = [
      { eyeLeft: 1.0, eyeRight: 1.0, label: 'open' },
      { eyeLeft: 0.5, eyeRight: 0.5, label: 'half-closed' },
      { eyeLeft: 0.0, eyeRight: 0.0, label: 'closed' },
    ];

    const results = [];
    for (const c of cases) {
      await injectFaceFrame(page, {
        eyeLeft: c.eyeLeft, eyeRight: c.eyeRight,
        mouthOpen: 0, mouthSmile: 0,
        headYaw: 0, headPitch: 0, headRoll: 0,
        gazeLeftX: 0, gazeLeftY: 0, gazeRightX: 0, gazeRightY: 0,
      });
      const shot = `${ARTIFACTS_DIR}/eye-${c.label}.png`;
      await page.screenshot({ path: shot });
      const debug = await getEyeDebug(page);
      const hash = await getCanvasPixelHash(page);
      results.push({ label: c.label, debug, hash, shot });
      console.log(`Eye ${c.label}:`, JSON.stringify({
        open: debug.eyeLeftDebug?.open,
        closed: debug.eyeLeftDebug?.closed,
        lowerY: debug.eyeLeftDebug?.lowerY,
        upperY: debug.eyeLeftDebug?.upperY,
        hash,
      }));
    }

    // 三种状态必须有不同 canvas hash
    expect(results[0].hash).not.toBe(results[1].hash);
    expect(results[0].hash).not.toBe(results[2].hash);
    expect(results[1].hash).not.toBe(results[2].hash);

    // 半闭眼时上眼皮必须下压（upperY < 0，即眼睛中心上方）
    const half = results[1].debug.eyeLeftDebug;
    expect(half.upperY).toBeLessThan(0);
    // 下眼皮保持稳定在下方
    expect(half.lowerY).toBeGreaterThan(0);
    // 上眼皮比下眼皮更靠上（upperY < lowerY）
    expect(half.upperY).toBeLessThan(half.lowerY);
  });

  test('wink 左右眼状态不同', async ({ page }) => {
    await page.goto(RECEIVER_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await waitForRenderer(page);
    await setMirror(page, false);

    await injectFaceFrame(page, {
      eyeLeft: 1.0, eyeRight: 0.0,
      mouthOpen: 0, mouthSmile: 0,
      headYaw: 0, headPitch: 0, headRoll: 0,
      gazeLeftX: 0, gazeLeftY: 0, gazeRightX: 0, gazeRightY: 0,
    });
    await page.screenshot({ path: `${ARTIFACTS_DIR}/wink-left.png` });
    const debug = await getEyeDebug(page);
    console.log('Wink debug:', JSON.stringify({
      leftOpen: debug.eyeLeftDebug?.open,
      rightOpen: debug.eyeRightDebug?.open,
    }));

    expect(debug.eyeLeftDebug.open).toBeGreaterThan(0.9);
    expect(debug.eyeRightDebug.open).toBeLessThan(0.1);
  });

  test('pupil gaze 左右/上下偏移可见', async ({ page }) => {
    await page.goto(RECEIVER_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await waitForRenderer(page);
    await setMirror(page, false);

    const gazes = [
      { gazeLeftX: 0, gazeLeftY: 0, gazeRightX: 0, gazeRightY: 0, label: 'center' },
      { gazeLeftX: 1, gazeLeftY: 0, gazeRightX: 1, gazeRightY: 0, label: 'right' },
      { gazeLeftX: -1, gazeLeftY: 0, gazeRightX: -1, gazeRightY: 0, label: 'left' },
      { gazeLeftX: 0, gazeLeftY: 1, gazeRightX: 0, gazeRightY: 1, label: 'up' },
      { gazeLeftX: 0, gazeLeftY: -1, gazeRightX: 0, gazeRightY: -1, label: 'down' },
    ];

    const results = [];
    for (const g of gazes) {
      await injectFaceFrame(page, {
        eyeLeft: 1.0, eyeRight: 1.0,
        mouthOpen: 0, mouthSmile: 0,
        headYaw: 0, headPitch: 0, headRoll: 0,
        ...g,
      });
      const shot = `${ARTIFACTS_DIR}/gaze-${g.label}.png`;
      await page.screenshot({ path: shot });
      const debug = await getEyeDebug(page);
      const hash = await getCanvasPixelHash(page);
      results.push({ label: g.label, debug, hash, shot });
      console.log(`Gaze ${g.label}: pupil=(${debug.eyeLeftDebug?.pupilX?.toFixed(2)}, ${debug.eyeLeftDebug?.pupilY?.toFixed(2)}) hash=${hash}`);
    }

    const center = results[0].debug.eyeLeftDebug;
    const right = results[1].debug.eyeLeftDebug;
    const left = results[2].debug.eyeLeftDebug;
    const up = results[3].debug.eyeLeftDebug;
    const down = results[4].debug.eyeLeftDebug;

    // 瞳孔偏移量不能为 0 或极小
    expect(Math.abs(right.pupilX)).toBeGreaterThan(0.5);
    expect(Math.abs(left.pupilX)).toBeGreaterThan(0.5);
    expect(Math.abs(up.pupilY)).toBeGreaterThan(0.5);
    expect(Math.abs(down.pupilY)).toBeGreaterThan(0.5);

    // 方向正确
    expect(right.pupilX).toBeGreaterThan(center.pupilX);
    expect(left.pupilX).toBeLessThan(center.pupilX);
    expect(up.pupilY).toBeLessThan(center.pupilY); // 屏幕 y 向下，gaze up 时 pupilY 应减小
    expect(down.pupilY).toBeGreaterThan(center.pupilY);

    // canvas hash 应有变化
    const hashes = results.map(r => r.hash);
    expect(new Set(hashes).size).toBe(hashes.length);
  });

  test('roll -30 / +30 眼睛随脸旋转', async ({ page }) => {
    await page.goto(RECEIVER_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await waitForRenderer(page);
    await setMirror(page, false);

    const rolls = [
      { headRoll: 0, label: 'roll-0' },
      { headRoll: 30, label: 'roll-30' },
      { headRoll: -30, label: 'roll-neg30' },
    ];

    const results = [];
    for (const r of rolls) {
      await injectFaceFrame(page, {
        eyeLeft: 0.0, eyeRight: 0.0, // 闭眼，用闭眼线看旋转
        mouthOpen: 0, mouthSmile: 0,
        headYaw: 0, headPitch: 0, headRoll: r.headRoll,
        gazeLeftX: 0, gazeLeftY: 0, gazeRightX: 0, gazeRightY: 0,
      });
      const shot = `${ARTIFACTS_DIR}/${r.label}-closed.png`;
      await page.screenshot({ path: shot });
      const debug = await getEyeDebug(page);
      const hash = await getCanvasPixelHash(page);
      results.push({ label: r.label, debug, hash, shot });
      console.log(`${r.label}: eye ang=${debug.eyeLeftDebug?.ang?.toFixed(3)} pupil=(${debug.eyeLeftDebug?.pupilX?.toFixed(2)}, ${debug.eyeLeftDebug?.pupilY?.toFixed(2)}) hash=${hash}`);
    }

    // roll 0 / 30 / -30 的 angle 应该不同
    const ang0 = results[0].debug.eyeLeftDebug.ang;
    const ang30 = results[1].debug.eyeLeftDebug.ang;
    const angNeg30 = results[2].debug.eyeLeftDebug.ang;

    expect(ang30).not.toBeCloseTo(ang0, 2);
    expect(angNeg30).not.toBeCloseTo(ang0, 2);
    expect(ang30).not.toBeCloseTo(angNeg30, 2);

    // 方向：正 roll 应该产生正 angle 变化，负 roll 应该产生负 angle 变化
    // 眼睛必须跟随脸部一起 roll，不能反向或保持水平
    const delta30 = ang30 - ang0;
    const deltaNeg30 = angNeg30 - ang0;
    expect(delta30).toBeGreaterThan(0.2);        // 约 +30° roll 在投影中应有明显增加
    expect(deltaNeg30).toBeLessThan(-0.2);       // 约 -30° roll 应明显减少
    expect(delta30 * deltaNeg30).toBeLessThan(0); // 一正一负

    // canvas hash 应各不相同
    const hashes = results.map(r => r.hash);
    expect(new Set(hashes).size).toBe(hashes.length);
  });

  test('roll 时睁眼椭圆随脸旋转', async ({ page }) => {
    await page.goto(RECEIVER_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await waitForRenderer(page);
    await setMirror(page, false);

    const rolls = [0, 30, -30];
    const hashes = [];
    for (const roll of rolls) {
      await injectFaceFrame(page, {
        eyeLeft: 1.0, eyeRight: 1.0,
        mouthOpen: 0, mouthSmile: 0,
        headYaw: 0, headPitch: 0, headRoll: roll,
        gazeLeftX: 0, gazeLeftY: 0, gazeRightX: 0, gazeRightY: 0,
      });
      const shot = `${ARTIFACTS_DIR}/roll-open-${roll}.png`;
      await page.screenshot({ path: shot });
      const debug = await getEyeDebug(page);
      hashes.push(await getCanvasPixelHash(page));
      console.log(`Roll open ${roll}: ang=${debug.eyeLeftDebug?.ang?.toFixed(3)}`);
    }
    expect(new Set(hashes).size).toBe(hashes.length);
  });
});
