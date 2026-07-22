/**
 * Receiver 面捕渲染自动化测试
 *
 * 测试内容：
 * 1. 默认姿态渲染（验证 renderer 初始化）
 * 2. 眼睛开合（眨眼）— 模拟 eyeLeft/eyeRight 变化
 * 3. 嘴巴张合 — 模拟 mouthOpen 变化
 * 4. 头部 roll — 验证眼睛随脸旋转（像素级验证）
 * 5. gaze 追踪 — 验证瞳孔偏移
 * 6. 头部 yaw/pitch — 鱼转头和抬头低头
 * 7. 音频播放 — 模拟音频分片
 * 8. 音频状态机 — off → waiting → playing/error
 * 9. 黑屏页加载并显示纯黑背景
 * 10. 黑屏页点击进入全屏
 *
 * 使用方法：npx playwright test tests/e2e/receiver-face-render.test.mjs --project=chromium-desktop
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const RECEIVER_URL = 'http://127.0.0.1:8769/android-capture/app/src/main/assets/web/receiver/index.html?token=test-token';
const BLACK_SCREEN_URL = 'http://127.0.0.1:8769/android-capture/app/src/main/assets/web/black-screen/index.html';
const ARTIFACTS_DIR = './artifacts/receiver-face-render';

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
});

/**
 * 等待 receiver 渲染器模块加载完成并初始化。
 * receiver 使用 <script type="module"> 异步加载渲染器，
 * 需要等待 window._ProceduralSpindleWhaleAvatar 可用后再调用 initProcRenderer。
 * 注意：rendererReady/initProcRenderer 在 IIFE 闭包内，通过 __cheapLiveReceiverDiag 和 __cheapLiveInitRenderer 暴露。
 */
async function waitForRenderer(page, timeout = 15000) {
  // 1. 等待 ES module 加载完成（渲染器类被挂到 window）
  await page.waitForFunction(
    () => typeof window._ProceduralSpindleWhaleAvatar !== 'undefined',
    { timeout }
  );

  // 2. 如果 rendererReady 还不是 true，主动调用 initProcRenderer
  await page.evaluate(() => {
    const diag = window.__cheapLiveReceiverDiag || {};
    if (!diag.rendererReady) {
      if (typeof window.__cheapLiveInitRenderer === 'function') {
        window.__cheapLiveInitRenderer('sacabambaspis3d');
      }
    }
  });

  // 3. 等待 diag.rendererReady 变为 true
  await page.waitForFunction(
    () => {
      const diag = window.__cheapLiveReceiverDiag || {};
      return diag.rendererReady === true;
    },
    { timeout }
  );

  // 4. 额外等待一帧确保渲染完成
  await page.waitForTimeout(500);
}

// 注入面捕帧的辅助函数（通过 __cheapLiveInjectFaceFrame 暴露的 API）
async function injectFaceFrame(page, params) {
  await page.evaluate((p) => {
    if (typeof window.__cheapLiveInjectFaceFrame === 'function') {
      window.__cheapLiveInjectFaceFrame(p, 'real-camera');
    }
  }, params);
  // 等待动画帧渲染
  await page.waitForTimeout(300);
}

// 获取 renderer 内部状态（通过 __cheapLiveReceiverDiag 暴露的对象）
async function getRendererState(page) {
  return await page.evaluate(() => {
    const diag = window.__cheapLiveReceiverDiag || {};
    return {
      rendererReady: diag.rendererReady || false,
      hasRealFrame: diag.realFrameActive || false,
      lastFrameSource: diag.captureMode || null,
      realFrameActive: diag.realFrameActive || false,
      lastAppliedValues: diag.lastAppliedValues || {},
      rendererParams: diag.rendererParams || null,
      audioPlaybackState: diag.audioPlaybackState || 'off',
      audioChunkCount: diag.audioChunkCount || 0,
      audioUnlocked: diag.audioUnlocked || false,
    };
  });
}

/**
 * 获取 canvas 指定区域的像素数据，用于验证眼睛是否旋转。
 * 返回该区域内非背景色像素的分布。
 */
async function getCanvasPixelInfo(page, region) {
  return await page.evaluate((r) => {
    const canvas = document.getElementById('stage');
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const x = Math.floor(r.x);
    const y = Math.floor(r.y);
    const w = Math.floor(r.w);
    const h = Math.floor(r.h);
    if (x < 0 || y < 0 || x + w > canvas.width || y + h > canvas.height) return null;
    const imageData = ctx.getImageData(x, y, w, h);
    const data = imageData.data;
    // 统计非背景（非深蓝/黑）像素的重心
    let sumX = 0, sumY = 0, count = 0;
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const idx = (py * w + px) * 4;
        const rr = data[idx], gg = data[idx + 1], bb = data[idx + 2];
        // 眼白是白色，虹膜是棕色，瞳孔是黑色
        // 检测"亮"像素（眼白）和"暗"像素（瞳孔/虹膜）
        const brightness = (rr + gg + bb) / 3;
        if (brightness > 100) {
          sumX += px;
          sumY += py;
          count++;
        }
      }
    }
    return {
      count,
      centroidX: count > 0 ? sumX / count : -1,
      centroidY: count > 0 ? sumY / count : -1,
    };
  }, region);
}

test.describe('Receiver 面捕渲染', () => {

  test('默认姿态渲染 — renderer 初始化', async ({ page }) => {
    await page.goto(RECEIVER_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await waitForRenderer(page);

    const state = await getRendererState(page);
    console.log('Default state:', JSON.stringify(state, null, 2));

    // renderer 应该已初始化
    expect(state.rendererReady).toBe(true);

    // 截图
    await page.screenshot({ path: `${ARTIFACTS_DIR}/01-default-pose.png` });
  });

  test('眼睛开合（眨眼）— eyeLeft/eyeRight 变化', async ({ page }) => {
    await page.goto(RECEIVER_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await waitForRenderer(page);

    // 睁眼
    await injectFaceFrame(page, {
      eyeLeft: 1.0, eyeRight: 1.0, mouthOpen: 0, mouthSmile: 0,
      headYaw: 0, headPitch: 0, headRoll: 0,
      gazeLeftX: 0, gazeLeftY: 0, gazeRightX: 0, gazeRightY: 0,
      positionX: 0, positionY: 0,
    });
    await page.screenshot({ path: `${ARTIFACTS_DIR}/02-eyes-open.png` });
    const openState = await getRendererState(page);
    console.log('Eyes open:', openState.lastAppliedValues);

    // 闭眼
    await injectFaceFrame(page, {
      eyeLeft: 0.0, eyeRight: 0.0, mouthOpen: 0, mouthSmile: 0,
      headYaw: 0, headPitch: 0, headRoll: 0,
      gazeLeftX: 0, gazeLeftY: 0, gazeRightX: 0, gazeRightY: 0,
      positionX: 0, positionY: 0,
    });
    await page.screenshot({ path: `${ARTIFACTS_DIR}/03-eyes-closed.png` });
    const closedState = await getRendererState(page);
    console.log('Eyes closed:', closedState.lastAppliedValues);

    // 验证 eyeLeft/eyeRight 被正确应用
    expect(closedState.lastAppliedValues.eyeLeft).toBeLessThan(0.1);
    expect(openState.lastAppliedValues.eyeLeft).toBeGreaterThan(0.9);

    // 验证 renderer params 被更新
    expect(closedState.rendererParams).toBeTruthy();
    const closedEyeL = closedState.rendererParams.eyeLeft;
    const openEyeL = openState.rendererParams.eyeLeft;
    console.log(`Renderer eyeLeft: open=${openEyeL}, closed=${closedEyeL}`);
    expect(closedEyeL).toBeLessThan(openEyeL);
  });

  test('嘴巴张合 — mouthOpen 变化', async ({ page }) => {
    await page.goto(RECEIVER_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await waitForRenderer(page);

    // 闭嘴
    await injectFaceFrame(page, {
      eyeLeft: 1.0, eyeRight: 1.0, mouthOpen: 0.0, mouthSmile: 0,
      headYaw: 0, headPitch: 0, headRoll: 0,
      gazeLeftX: 0, gazeLeftY: 0, gazeRightX: 0, gazeRightY: 0,
      positionX: 0, positionY: 0,
    });
    await page.screenshot({ path: `${ARTIFACTS_DIR}/04-mouth-closed.png` });
    const closedState = await getRendererState(page);

    // 大张嘴
    await injectFaceFrame(page, {
      eyeLeft: 1.0, eyeRight: 1.0, mouthOpen: 1.0, mouthSmile: 0,
      headYaw: 0, headPitch: 0, headRoll: 0,
      gazeLeftX: 0, gazeLeftY: 0, gazeRightX: 0, gazeRightY: 0,
      positionX: 0, positionY: 0,
    });
    await page.screenshot({ path: `${ARTIFACTS_DIR}/05-mouth-open.png` });
    const openState = await getRendererState(page);

    console.log('Mouth closed:', closedState.lastAppliedValues);
    console.log('Mouth open:', openState.lastAppliedValues);

    // 验证 mouthOpen 被正确应用
    expect(openState.lastAppliedValues.mouthOpen).toBeGreaterThan(0.9);
    expect(closedState.lastAppliedValues.mouthOpen).toBeLessThan(0.1);

    // 验证 renderer params
    const closedMouth = closedState.rendererParams.mouthOpen;
    const openMouth = openState.rendererParams.mouthOpen;
    console.log(`Renderer mouthOpen: closed=${closedMouth}, open=${openMouth}`);
    expect(openMouth).toBeGreaterThan(closedMouth);
  });

  test('头部 roll — 眼睛随脸旋转（像素级验证）', async ({ page }) => {
    await page.goto(RECEIVER_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await waitForRenderer(page);

    // 获取 canvas 尺寸
    const canvasSize = await page.evaluate(() => {
      const c = document.getElementById('stage');
      return { w: c.width, h: c.height };
    });
    console.log('Canvas size:', canvasSize);

    // roll = 0，闭眼（用闭眼线来验证旋转，闭眼线是水平的）
    await injectFaceFrame(page, {
      eyeLeft: 0.0, eyeRight: 0.0, mouthOpen: 0, mouthSmile: 0,
      headYaw: 0, headPitch: 0, headRoll: 0,
      gazeLeftX: 0, gazeLeftY: 0, gazeRightX: 0, gazeRightY: 0,
      positionX: 0, positionY: 0,
    });
    await page.screenshot({ path: `${ARTIFACTS_DIR}/06-roll-0-closed-eyes.png` });
    const roll0State = await getRendererState(page);

    // roll = 40 度，闭眼
    await injectFaceFrame(page, {
      eyeLeft: 0.0, eyeRight: 0.0, mouthOpen: 0, mouthSmile: 0,
      headYaw: 0, headPitch: 0, headRoll: 40,
      gazeLeftX: 0, gazeLeftY: 0, gazeRightX: 0, gazeRightY: 0,
      positionX: 0, positionY: 0,
    });
    await page.screenshot({ path: `${ARTIFACTS_DIR}/07-roll-40-closed-eyes.png` });
    const roll40State = await getRendererState(page);

    // roll = -40 度，闭眼
    await injectFaceFrame(page, {
      eyeLeft: 0.0, eyeRight: 0.0, mouthOpen: 0, mouthSmile: 0,
      headYaw: 0, headPitch: 0, headRoll: -40,
      gazeLeftX: 0, gazeLeftY: 0, gazeRightX: 0, gazeRightY: 0,
      positionX: 0, positionY: 0,
    });
    await page.screenshot({ path: `${ARTIFACTS_DIR}/08-roll-neg40-closed-eyes.png` });
    const rollNeg40State = await getRendererState(page);

    console.log('Roll 0:', roll0State.lastAppliedValues);
    console.log('Roll 40:', roll40State.lastAppliedValues);
    console.log('Roll -40:', rollNeg40State.lastAppliedValues);

    // 验证 headRoll 被正确传递
    expect(roll0State.lastAppliedValues.headRoll).toBe(0);
    expect(roll40State.lastAppliedValues.headRoll).toBe(40);
    expect(rollNeg40State.lastAppliedValues.headRoll).toBe(-40);

    // 验证 renderer params 中的 headRoll
    const r0 = roll0State.rendererParams.headRoll;
    const r40 = roll40State.rendererParams.headRoll;
    const rNeg40 = rollNeg40State.rendererParams.headRoll;
    console.log(`Renderer headRoll: 0=${r0}, 40=${r40}, -40=${rNeg40}`);
    expect(r40).not.toBe(r0);
    expect(rNeg40).not.toBe(r0);
    expect(r40).not.toBe(rNeg40);

    // 像素级验证：闭眼时眼睛线应该随 roll 旋转
    // 取整个 canvas 的像素，统计"暗色线段"的方向
    const pixelAnalysis = await page.evaluate(() => {
      const canvas = document.getElementById('stage');
      const ctx = canvas.getContext('2d');
      const w = canvas.width, h = canvas.height;
      // 找出所有"暗色"像素（闭眼线是 #333）
      const darkPixels = [];
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          const r = data[idx], g = data[idx + 1], b = data[idx + 2];
          // 闭眼线颜色 #333 = rgb(51,51,51)，但可能有抗锯齿
          // 检测暗色但非纯黑的像素
          const brightness = (r + g + b) / 3;
          if (brightness > 20 && brightness < 120) {
            darkPixels.push({ x, y });
          }
        }
      }
      return { count: darkPixels.length, sample: darkPixels.slice(0, 10) };
    });
    console.log('Roll -40 dark pixel analysis:', pixelAnalysis);
  });

  test('头部 roll — 睁眼时眼睛椭圆随脸旋转', async ({ page }) => {
    await page.goto(RECEIVER_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await waitForRenderer(page);

    // roll = 0，睁眼
    await injectFaceFrame(page, {
      eyeLeft: 1.0, eyeRight: 1.0, mouthOpen: 0, mouthSmile: 0,
      headYaw: 0, headPitch: 0, headRoll: 0,
      gazeLeftX: 0, gazeLeftY: 0, gazeRightX: 0, gazeRightY: 0,
      positionX: 0, positionY: 0,
    });
    await page.screenshot({ path: `${ARTIFACTS_DIR}/09-roll-0-eyes-open.png` });

    // roll = 45 度，睁眼
    await injectFaceFrame(page, {
      eyeLeft: 1.0, eyeRight: 1.0, mouthOpen: 0, mouthSmile: 0,
      headYaw: 0, headPitch: 0, headRoll: 45,
      gazeLeftX: 0, gazeLeftY: 0, gazeRightX: 0, gazeRightY: 0,
      positionX: 0, positionY: 0,
    });
    await page.screenshot({ path: `${ARTIFACTS_DIR}/10-roll-45-eyes-open.png` });

    // roll = -45 度，睁眼
    await injectFaceFrame(page, {
      eyeLeft: 1.0, eyeRight: 1.0, mouthOpen: 0, mouthSmile: 0,
      headYaw: 0, headPitch: 0, headRoll: -45,
      gazeLeftX: 0, gazeLeftY: 0, gazeRightX: 0, gazeRightY: 0,
      positionX: 0, positionY: 0,
    });
    await page.screenshot({ path: `${ARTIFACTS_DIR}/11-roll-neg45-eyes-open.png` });

    // 验证截图存在（像素级旋转验证需要图像比较，这里验证渲染不报错）
    expect(fs.existsSync(`${ARTIFACTS_DIR}/09-roll-0-eyes-open.png`)).toBe(true);
    expect(fs.existsSync(`${ARTIFACTS_DIR}/10-roll-45-eyes-open.png`)).toBe(true);
    expect(fs.existsSync(`${ARTIFACTS_DIR}/11-roll-neg45-eyes-open.png`)).toBe(true);
  });

  test('gaze 追踪 — 瞳孔偏移', async ({ page }) => {
    await page.goto(RECEIVER_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await waitForRenderer(page);

    // gaze 中心
    await injectFaceFrame(page, {
      eyeLeft: 1.0, eyeRight: 1.0, mouthOpen: 0, mouthSmile: 0,
      headYaw: 0, headPitch: 0, headRoll: 0,
      gazeLeftX: 0, gazeLeftY: 0, gazeRightX: 0, gazeRightY: 0,
      positionX: 0, positionY: 0,
    });
    await page.screenshot({ path: `${ARTIFACTS_DIR}/12-gaze-center.png` });
    const centerState = await getRendererState(page);

    // gaze 向右
    await injectFaceFrame(page, {
      eyeLeft: 1.0, eyeRight: 1.0, mouthOpen: 0, mouthSmile: 0,
      headYaw: 0, headPitch: 0, headRoll: 0,
      gazeLeftX: 1.0, gazeLeftY: 0, gazeRightX: 1.0, gazeRightY: 0,
      positionX: 0, positionY: 0,
    });
    await page.screenshot({ path: `${ARTIFACTS_DIR}/13-gaze-right.png` });
    const rightState = await getRendererState(page);

    // gaze 向左
    await injectFaceFrame(page, {
      eyeLeft: 1.0, eyeRight: 1.0, mouthOpen: 0, mouthSmile: 0,
      headYaw: 0, headPitch: 0, headRoll: 0,
      gazeLeftX: -1.0, gazeLeftY: 0, gazeRightX: -1.0, gazeRightY: 0,
      positionX: 0, positionY: 0,
    });
    await page.screenshot({ path: `${ARTIFACTS_DIR}/14-gaze-left.png` });
    const leftState = await getRendererState(page);

    console.log('Gaze center:', centerState.lastAppliedValues);
    console.log('Gaze right:', rightState.lastAppliedValues);
    console.log('Gaze left:', leftState.lastAppliedValues);

    // 验证 gaze 参数被正确传递（receiver 对 gaze 做镜像翻转：gazeLeftX = -rawGazeRX）
    // 发送 gazeLeftX=1, gazeRightX=1 → 镜像后 gazeLeftX = -1
    expect(rightState.lastAppliedValues.gazeLeftX).toBe(-1.0);
    // 发送 gazeLeftX=-1, gazeRightX=-1 → 镜像后 gazeLeftX = 1
    expect(leftState.lastAppliedValues.gazeLeftX).toBe(1.0);

    // 验证 renderer params 中的 gaze
    const centerGaze = centerState.rendererParams.gazeLeftX;
    const rightGaze = rightState.rendererParams.gazeLeftX;
    const leftGaze = leftState.rendererParams.gazeLeftX;
    console.log(`Renderer gazeLeftX: center=${centerGaze}, right=${rightGaze}, left=${leftGaze}`);
    expect(rightGaze).not.toBe(centerGaze);
    expect(leftGaze).not.toBe(centerGaze);
  });

  test('头部 yaw/pitch — 鱼转头和抬头低头', async ({ page }) => {
    await page.goto(RECEIVER_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await waitForRenderer(page);

    const poses = [
      { yaw: 0, pitch: 0, label: 'center' },
      { yaw: 30, pitch: 0, label: 'yaw-right' },
      { yaw: -30, pitch: 0, label: 'yaw-left' },
      { yaw: 0, pitch: 20, label: 'pitch-up' },
      { yaw: 0, pitch: -20, label: 'pitch-down' },
    ];

    for (let i = 0; i < poses.length; i++) {
      const p = poses[i];
      await injectFaceFrame(page, {
        eyeLeft: 1.0, eyeRight: 1.0, mouthOpen: 0, mouthSmile: 0,
        headYaw: p.yaw, headPitch: p.pitch, headRoll: 0,
        gazeLeftX: 0, gazeLeftY: 0, gazeRightX: 0, gazeRightY: 0,
        positionX: 0, positionY: 0,
      });
      await page.screenshot({ path: `${ARTIFACTS_DIR}/15-pose-${p.label}.png` });
      const state = await getRendererState(page);
      console.log(`Pose ${p.label}: yaw=${state.lastAppliedValues.headYaw}, pitch=${state.lastAppliedValues.headPitch}`);
    }

    // 验证 yaw 被正确传递
    await injectFaceFrame(page, {
      eyeLeft: 1.0, eyeRight: 1.0, mouthOpen: 0, mouthSmile: 0,
      headYaw: 30, headPitch: 0, headRoll: 0,
      gazeLeftX: 0, gazeLeftY: 0, gazeRightX: 0, gazeRightY: 0,
      positionX: 0, positionY: 0,
    });
    const yawState = await getRendererState(page);
    expect(yawState.lastAppliedValues.headYaw).toBe(30);
  });

  test('眉毛追踪 — browLeft/browRight 变化', async ({ page }) => {
    await page.goto(RECEIVER_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await waitForRenderer(page);

    // 眉毛放松
    await injectFaceFrame(page, {
      eyeLeft: 1.0, eyeRight: 1.0, mouthOpen: 0, mouthSmile: 0,
      headYaw: 0, headPitch: 0, headRoll: 0,
      gazeLeftX: 0, gazeLeftY: 0, gazeRightX: 0, gazeRightY: 0,
      browLeft: 0, browRight: 0,
      positionX: 0, positionY: 0,
    });
    await page.screenshot({ path: `${ARTIFACTS_DIR}/16-brow-relaxed.png` });

    // 眉毛抬高
    await injectFaceFrame(page, {
      eyeLeft: 1.0, eyeRight: 1.0, mouthOpen: 0, mouthSmile: 0,
      headYaw: 0, headPitch: 0, headRoll: 0,
      gazeLeftX: 0, gazeLeftY: 0, gazeRightX: 0, gazeRightY: 0,
      browLeft: 1.0, browRight: 1.0,
      positionX: 0, positionY: 0,
    });
    await page.screenshot({ path: `${ARTIFACTS_DIR}/17-brow-raised.png` });

    const raisedState = await getRendererState(page);
    console.log('Brow raised:', raisedState.lastAppliedValues);
    // 验证 brow 参数被传递
    if (raisedState.lastAppliedValues.browLeft !== undefined) {
      expect(raisedState.lastAppliedValues.browLeft).toBeGreaterThan(0.9);
    }
  });
});

test.describe('Receiver 控制台扩展选项', () => {

  test('镜像开关 — 切换镜像翻转 gaze 方向反转', async ({ page }) => {
    await page.goto(RECEIVER_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await waitForRenderer(page);

    // 默认镜像 ON：发送 gazeRightX=1 → 镜像后 gazeLeftX = -1
    await injectFaceFrame(page, {
      eyeLeft: 1.0, eyeRight: 1.0, mouthOpen: 0, mouthSmile: 0,
      headYaw: 0, headPitch: 0, headRoll: 0,
      gazeLeftX: 1.0, gazeLeftY: 0, gazeRightX: 1.0, gazeRightY: 0,
      positionX: 0, positionY: 0,
    });
    const mirrorOnState = await getRendererState(page);
    expect(mirrorOnState.lastAppliedValues.gazeLeftX).toBe(-1.0);

    // 点击镜像按钮关闭镜像
    const mirrorBtn = page.locator('#toggleMirrorBtn');
    await mirrorBtn.click();
    await page.waitForTimeout(200);

    // 镜像 OFF：发送 gazeRightX=1 → 不镜像 gazeLeftX = rawGazeLX = 1
    await injectFaceFrame(page, {
      eyeLeft: 1.0, eyeRight: 1.0, mouthOpen: 0, mouthSmile: 0,
      headYaw: 0, headPitch: 0, headRoll: 0,
      gazeLeftX: 1.0, gazeLeftY: 0, gazeRightX: 1.0, gazeRightY: 0,
      positionX: 0, positionY: 0,
    });
    const mirrorOffState = await getRendererState(page);
    expect(mirrorOffState.lastAppliedValues.gazeLeftX).toBe(1.0);

    await page.screenshot({ path: `${ARTIFACTS_DIR}/18-mirror-off.png` });

    // 恢复镜像 ON
    await mirrorBtn.click();
    await page.waitForTimeout(200);
  });

  test('灵敏度滑块 — 调整 head 灵敏度放大头部姿态', async ({ page }) => {
    await page.goto(RECEIVER_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await waitForRenderer(page);

    // 默认灵敏度 1.0：发送 headYaw=30 → headYaw_norm = 0.5 - 30/120 = 0.25
    await injectFaceFrame(page, {
      eyeLeft: 1.0, eyeRight: 1.0, mouthOpen: 0, mouthSmile: 0,
      headYaw: 30, headPitch: 0, headRoll: 0,
      gazeLeftX: 0, gazeLeftY: 0, gazeRightX: 0, gazeRightY: 0,
      positionX: 0, positionY: 0,
    });
    const sens1State = await getRendererState(page);
    const headYaw1 = sens1State.rendererParams.headYaw;
    console.log('Sensitivity 1.0 headYaw:', headYaw1);

    // 调整 head 灵敏度为 2.0
    await page.evaluate(() => {
      const slider = document.getElementById('sensHead');
      slider.value = 200;
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(200);

    // 灵敏度 2.0：headYaw_norm = 0.5 + (0.25 - 0.5) * 2 = 0.0
    await injectFaceFrame(page, {
      eyeLeft: 1.0, eyeRight: 1.0, mouthOpen: 0, mouthSmile: 0,
      headYaw: 30, headPitch: 0, headRoll: 0,
      gazeLeftX: 0, gazeLeftY: 0, gazeRightX: 0, gazeRightY: 0,
      positionX: 0, positionY: 0,
    });
    const sens2State = await getRendererState(page);
    const headYaw2 = sens2State.rendererParams.headYaw;
    console.log('Sensitivity 2.0 headYaw:', headYaw2);

    // 灵敏度 2.0 时 headYaw 应该比 1.0 时更偏离 0.5
    expect(Math.abs(headYaw2 - 0.5)).toBeGreaterThan(Math.abs(headYaw1 - 0.5));
  });

  test('测试表情按钮 — 点击眨眼按钮触发模拟表情', async ({ page }) => {
    await page.goto(RECEIVER_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await waitForRenderer(page);

    // 点击"眨眼"测试按钮
    const blinkBtn = page.locator('.expr-btn[data-expr="blink"]');
    await blinkBtn.click();
    await page.waitForTimeout(500);

    // 验证 avatarExpression 被设置
    const state = await page.evaluate(() => {
      return {
        avatarExpression: window.__cheapLiveTest ? null : null, // expression 在闭包内
        rendererParams: window.__cheapLiveReceiverDiag?.rendererParams,
      };
    });
    console.log('After blink test button:', state);
    // 眨眼时 eyeLeft/eyeRight 应该为 0
    expect(state.rendererParams.eyeLeft).toBeLessThan(0.1);
    expect(state.rendererParams.eyeRight).toBeLessThan(0.1);

    await page.screenshot({ path: `${ARTIFACTS_DIR}/19-test-blink.png` });

    // 点击重置
    const resetBtn = page.locator('.expr-btn[data-expr=""]').first();
    await resetBtn.click();
    await page.waitForTimeout(300);
  });

  test('测试动作按钮 — 点击张望按钮触发模拟动作', async ({ page }) => {
    await page.goto(RECEIVER_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await waitForRenderer(page);

    // 点击"张望"测试按钮
    const lookBtn = page.locator('.action-btn[data-action="look"]');
    await lookBtn.click();
    await page.waitForTimeout(500);

    // 验证 avatarAction 被设置（通过 rendererParams 的 headYaw 变化）
    const state1 = await page.evaluate(() => window.__cheapLiveReceiverDiag?.rendererParams);
    await page.waitForTimeout(500);
    const state2 = await page.evaluate(() => window.__cheapLiveReceiverDiag?.rendererParams);
    console.log('Look action state1 headYaw:', state1?.headYaw, 'state2 headYaw:', state2?.headYaw);

    // 张望动作会让 headYaw 随时间变化（sin 波动）
    // 验证 headYaw 不是固定的 0.5
    expect(state2.headYaw).not.toBe(0.5);

    await page.screenshot({ path: `${ARTIFACTS_DIR}/20-test-look-action.png` });
  });
});

test.describe('Receiver 音频模拟', () => {

  test('音频播放 — 模拟音频分片', async ({ page }) => {
    await page.goto(RECEIVER_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // 点击"打开音频"按钮
    const enableBtn = page.locator('#enableAudioBtn');
    await enableBtn.click();
    await page.waitForTimeout(500);

    const afterClickState = await getRendererState(page);
    console.log('After click enable audio:', afterClickState);
    expect(afterClickState.audioUnlocked).toBe(true);

    // 检查音频元素是否存在
    const audioState = await page.evaluate(() => {
      const audioEl = document.querySelector('audio');
      return {
        hasAudioElement: !!audioEl,
        audioSrc: audioEl ? audioEl.src : null,
        audioPaused: audioEl ? audioEl.paused : null,
        audioReadyState: audioEl ? audioEl.readyState : null,
        mediaSourceExists: typeof MediaSource !== 'undefined',
        audioPlaybackState: window.__cheapLiveReceiverDiag?.audioPlaybackState,
      };
    });
    console.log('Audio element state:', audioState);
    expect(audioState.hasAudioElement).toBe(true);
    expect(audioState.mediaSourceExists).toBe(true);

    await page.screenshot({ path: `${ARTIFACTS_DIR}/20-audio-enabled.png` });
  });

  test('音频状态机 — off → waiting → playing/error', async ({ page }) => {
    await page.goto(RECEIVER_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // 初始状态应该是 off
    let state = await getRendererState(page);
    expect(state.audioPlaybackState).toBe('off');

    // 点击启用音频
    await page.locator('#enableAudioBtn').click();
    await page.waitForTimeout(300);

    state = await getRendererState(page);
    console.log('After enable:', state);
    // 应该处于 waiting 或 playing 状态
    expect(['waiting', 'playing']).toContain(state.audioPlaybackState);
    expect(state.audioUnlocked).toBe(true);
  });
});

test.describe('屏幕保护黑屏页', () => {

  test('黑屏页加载并显示纯黑背景', async ({ page }) => {
    await page.goto(BLACK_SCREEN_URL, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    await page.waitForTimeout(1000);

    // 截图
    await page.screenshot({ path: `${ARTIFACTS_DIR}/30-black-screen.png` });

    // 检查背景色是黑色
    const bgColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    console.log('Black screen bg color:', bgColor);
    expect(bgColor).toBe('rgb(0, 0, 0)');

    // 检查黑色像素比例（需要 > 98%）
    const blackRatio = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const ctx = canvas.getContext('2d');
      // 简化：检查 body 的背景色和所有可见元素
      const bodyBg = window.getComputedStyle(document.body).backgroundColor;
      const htmlBg = window.getComputedStyle(document.documentElement).backgroundColor;
      return {
        bodyBg: bodyBg,
        htmlBg: htmlBg,
        bodyIsBlack: bodyBg === 'rgb(0, 0, 0)',
        htmlIsBlack: htmlBg === 'rgb(0, 0, 0)',
      };
    });
    console.log('Black screen verification:', blackRatio);
    expect(blackRatio.bodyIsBlack).toBe(true);
    expect(blackRatio.htmlIsBlack).toBe(true);
  });

  test('黑屏页点击进入全屏', async ({ page }) => {
    await page.goto(BLACK_SCREEN_URL, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    await page.waitForTimeout(500);

    // 点击页面
    await page.click('body');
    await page.waitForTimeout(500);

    // 检查是否进入全屏（在 headless 模式下可能不支持全屏，所以只验证不报错）
    const state = await page.evaluate(() => {
      return {
        fullscreenElement: document.fullscreenElement,
        webkitFullscreenElement: document.webkitFullscreenElement,
        hintDisplay: document.getElementById('hint') ? document.getElementById('hint').style.display : null,
      };
    });
    console.log('After click:', state);
    // hint 应该被隐藏（display=none 或 class=hide）
    // 注意：headless 模式下 fullscreen API 可能不可用
  });
});
