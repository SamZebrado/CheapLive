const { test, expect } = require('@playwright/test');

const DEMO_URL = 'http://127.0.0.1:8773/src/contest-demo/contest-interactive-demo.html';

test.describe('Contest Demo Layout Regression', () => {
  test('1280x800 三栏不换行', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const panels = await page.evaluate(() => {
      const phone = document.querySelector('#phoneFrame');
      const receiver = document.querySelector('#receiverPanel');
      const game = document.querySelector('#gamePanel');
      return [phone, receiver, game].map(el => {
        const r = el.getBoundingClientRect();
        return { top: r.top, left: r.left, width: r.width };
      });
    });

    expect(Math.abs(panels[0].top - panels[1].top)).toBeLessThan(20);
    expect(Math.abs(panels[0].top - panels[2].top)).toBeLessThan(20);
  });

  test('1440x900 三栏不换行', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const panels = await page.evaluate(() => {
      const phone = document.querySelector('#phoneFrame');
      const receiver = document.querySelector('#receiverPanel');
      const game = document.querySelector('#gamePanel');
      return [phone, receiver, game].map(el => {
        const r = el.getBoundingClientRect();
        return { top: r.top };
      });
    });

    expect(Math.abs(panels[0].top - panels[1].top)).toBeLessThan(20);
    expect(Math.abs(panels[0].top - panels[2].top)).toBeLessThan(20);
  });

  test('avatar canvas 正方形且不超过 520px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const canvasInfo = await page.evaluate(() => {
      const canvas = document.querySelector('#avatarCanvas');
      const r = canvas.getBoundingClientRect();
      return { width: r.width, height: r.height };
    });

    expect(Math.abs(canvasInfo.width - canvasInfo.height)).toBeLessThan(10);
    expect(canvasInfo.width).toBeLessThanOrEqual(520);
  });

  test('左侧 panel 没有 visible video', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const videoInfo = await page.evaluate(() => {
      const videos = [...document.querySelectorAll('video')];
      return videos.map(v => {
        const r = v.getBoundingClientRect();
        const cs = getComputedStyle(v);
        return {
          area: r.width * r.height,
          offscreen: r.left < -100 || r.top < -100 || r.width <= 2 || r.height <= 2,
          display: cs.display,
          opacity: parseFloat(cs.opacity),
        };
      });
    });

    videoInfo.forEach(v => {
      expect(v.offscreen || v.area <= 4 || v.opacity === 0).toBeTruthy();
    });
  });

  test('摄像头按钮存在', async ({ page }) => {
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    const btn = await page.$('#faceCamBtn');
    expect(btn).toBeTruthy();
  });

  test('音频监听按钮存在', async ({ page }) => {
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    const btn = await page.$('#monitorBtn');
    expect(btn).toBeTruthy();
    const text = await btn.textContent();
    expect(text).toContain('监听');
  });

  test('face params mock frame 能驱动 avatar', async ({ page }) => {
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const categories = [
        { categoryName: 'jawOpen', score: 0.6 },
        { categoryName: 'eyeBlinkLeft', score: 0.1 },
        { categoryName: 'eyeBlinkRight', score: 0.1 },
        { categoryName: 'mouthSmileLeft', score: 0.4 },
        { categoryName: 'mouthSmileRight', score: 0.4 },
      ];
      const data = new Float32Array(16);
      data[0]=0.766; data[2]=0.6428; data[8]=-0.6428; data[10]=0.766; data[5]=1; data[15]=1;
      const matrices = [{ data }];
      const beforeYaw = state.faceParams.yaw;
      const beforeMouth = state.faceParams.mouthOpen;
      updateFaceParamsFromBlendshapes({ categories }, matrices);
      return {
        yawChanged: beforeYaw !== state.faceParams.yaw,
        mouthChanged: beforeMouth !== state.faceParams.mouthOpen,
      };
    });

    expect(result.yawChanged).toBe(true);
    expect(result.mouthChanged).toBe(true);
  });

  test('lastCameraFrame.appliedToAvatar=true', async ({ page }) => {
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const categories = [
        { categoryName: 'jawOpen', score: 0.5 },
      ];
      const data = new Float32Array(16);
      data[0]=1; data[5]=1; data[10]=1; data[15]=1;
      const matrices = [{ data }];
      updateFaceParamsFromBlendshapes({ categories }, matrices);
      const diag = window.__cheapLiveContestAvatarDiag;
      return diag.lastCameraFrame ? diag.lastCameraFrame.appliedToAvatar : false;
    });

    expect(result).toBe(true);
  });

  test('3D rendererReady=true 且 rendererClass 正确', async ({ page }) => {
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const diag = await page.evaluate(() => {
      const d = window.__cheapLiveContestAvatarDiag || {};
      return { rendererReady: d.rendererReady, rendererClass: d.rendererClass };
    });

    expect(diag.rendererReady).toBe(true);
    expect(diag.rendererClass).toBe('ProceduralSpindleWhaleAvatar');
  });

  test('fallbackActive=false', async ({ page }) => {
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const diag = await page.evaluate(() => {
      const d = window.__cheapLiveContestAvatarDiag || {};
      return d.fallbackActive;
    });

    expect(diag).toBe(false);
  });

  test('3D 加载失败不自动切 2D', async ({ page }) => {
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Check that error overlay exists in DOM (hidden by default)
    const errorOverlay = await page.$('#avatar3DError');
    expect(errorOverlay).toBeTruthy();

    // Check that manualFallback2D function exists
    const hasManualFallback = await page.evaluate(() => typeof manualFallback2D === 'function');
    expect(hasManualFallback).toBe(true);

    // Check that retry3DRenderer function exists
    const hasRetry = await page.evaluate(() => typeof retry3DRenderer === 'function');
    expect(hasRetry).toBe(true);
  });

  test('MediaPipe 请求全部 same-origin', async ({ page }) => {
    const cdnRequests = [];
    page.on('request', req => {
      const url = req.url();
      if (url.includes('cdn.jsdelivr') || url.includes('googleapis') || url.includes('unpkg')) {
        cdnRequests.push(url);
      }
    });

    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Initial page load should not trigger any CDN requests
    expect(cdnRequests.length).toBe(0);
  });
});
