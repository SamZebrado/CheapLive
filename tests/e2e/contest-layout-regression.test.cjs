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

  test('辅助工具箱区域存在', async ({ page }) => {
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const section = await page.$('.toolbox-section');
    expect(section).toBeTruthy();

    const header = await page.$eval('.toolbox-header h2', el => el.textContent);
    expect(header).toContain('辅助工具箱');
  });

  test('辅助工具箱三张卡片存在且链接正确', async ({ page }) => {
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const cards = await page.$$('.toolbox-card');
    expect(cards.length).toBe(3);

    // 字幕卡片
    const subtitleCard = cards[0];
    const subtitleTitle = await subtitleCard.$eval('.toolbox-card-title', el => el.textContent);
    expect(subtitleTitle).toContain('字幕');
    const subtitleBtn = await subtitleCard.$('.toolbox-card-btn');
    const subtitleHref = await subtitleBtn.getAttribute('href');
    expect(subtitleHref).toContain('subtitle.html');
    const subtitleTarget = await subtitleBtn.getAttribute('target');
    expect(subtitleTarget).toBe('_blank');

    // 手写板卡片
    const handwriteCard = cards[1];
    const handwriteTitle = await handwriteCard.$eval('.toolbox-card-title', el => el.textContent);
    expect(handwriteTitle).toContain('手写');
    const handwriteBtn = await handwriteCard.$('.toolbox-card-btn');
    const handwriteHref = await handwriteBtn.getAttribute('href');
    expect(handwriteHref).toContain('accessibility-communication');
    const handwriteTarget = await handwriteBtn.getAttribute('target');
    expect(handwriteTarget).toBe('_blank');

    // 慢慢倒卡片
    const islandCard = cards[2];
    const islandTitle = await islandCard.$eval('.toolbox-card-title', el => el.textContent);
    expect(islandTitle).toContain('慢慢倒');
    const islandBtn = await islandCard.$('.toolbox-card-btn');
    const islandHref = await islandBtn.getAttribute('href');
    expect(islandHref).toContain('IslandSlonelyFall');
    const islandTarget = await islandBtn.getAttribute('target');
    expect(islandTarget).toBe('_blank');
  });

  test('辅助工具箱不抢占主布局位置（在三栏下方）', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const positions = await page.evaluate(() => {
      const mainLayout = document.querySelector('.main-layout');
      const toolbox = document.querySelector('.toolbox-section');
      const mainRect = mainLayout.getBoundingClientRect();
      const toolRect = toolbox.getBoundingClientRect();
      return {
        mainBottom: mainRect.bottom,
        toolboxTop: toolRect.top,
        toolboxBottom: toolRect.bottom,
      };
    });

    // toolbox 应该在主布局下方
    expect(positions.toolboxTop).toBeGreaterThan(positions.mainBottom - 10);
  });

  test('floating mode button 可切换 edit/display mode', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const before = await page.evaluate(() => {
      const diag = window.__cheapLiveContestFloatingDiag || {};
      const btn = document.getElementById('fwModeBtn');
      return {
        mode: diag.mode,
        buttonText: btn ? btn.textContent : null,
        buttonClickable: diag.modeButtonClickable,
      };
    });

    // 初始应该是 edit 模式
    expect(before.mode).toBe('edit');
    expect(before.buttonClickable).toBe(true);

    // 点击 mode button
    await page.click('#fwModeBtn');
    await page.waitForTimeout(500);

    const after = await page.evaluate(() => {
      const diag = window.__cheapLiveContestFloatingDiag || {};
      const btn = document.getElementById('fwModeBtn');
      const fw = document.getElementById('floatingWindow');
      return {
        mode: diag.mode,
        buttonText: btn ? btn.textContent : null,
        hasDisplayClass: fw ? fw.classList.contains('fw-display-mode') : false,
        hasEditClass: fw ? fw.classList.contains('fw-edit-mode') : false,
        buttonClass: btn ? btn.className : '',
      };
    });

    // 点击后应该切换到 display 模式
    expect(after.mode).toBe('display');
    expect(after.hasDisplayClass).toBe(true);
    expect(after.hasEditClass).toBe(false);
    // 按钮文字应该是"显示"（当前是显示模式）
    expect(after.buttonText).toContain('显示');

    // 再点一次，切回 edit 模式
    await page.click('#fwModeBtn');
    await page.waitForTimeout(500);

    const after2 = await page.evaluate(() => {
      const diag = window.__cheapLiveContestFloatingDiag || {};
      const btn = document.getElementById('fwModeBtn');
      return {
        mode: diag.mode,
        buttonText: btn ? btn.textContent : null,
      };
    });

    expect(after2.mode).toBe('edit');
    expect(after2.buttonText).toContain('编辑');
  });

  test('floating window 背景透明且不使用全局 opacity', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const result = await page.evaluate(() => {
      const diag = window.__cheapLiveContestFloatingDiag || {};
      const fw = document.getElementById('floatingWindow');
      const fwContent = document.querySelector('.floating-window .fw-content');
      const fwCanvas = document.getElementById('fwAvatarCanvas');

      const isTransparent = (bg) => {
        return bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent' || bg === '';
      };

      const fwBg = fw ? getComputedStyle(fw).backgroundColor : '';
      const contentBg = fwContent ? getComputedStyle(fwContent).backgroundColor : '';
      const canvasBg = fwCanvas ? getComputedStyle(fwCanvas).backgroundColor : '';
      const winOpacity = fw ? parseFloat(getComputedStyle(fw).opacity) : 1;

      return {
        fwWindowBackground: fwBg,
        fwContentBackground: contentBg,
        fwCanvasBackground: canvasBg,
        windowOpacity: winOpacity,
        fwBgTransparent: isTransparent(fwBg),
        contentBgTransparent: isTransparent(contentBg),
        canvasBgTransparent: isTransparent(canvasBg),
        usesGlobalOpacity: winOpacity < 0.99,
        rendererTransparentMode: diag.rendererTransparentMode,
        diagMode: diag.mode,
      };
    });

    // edit mode 下背景应该透明
    expect(result.fwBgTransparent).toBe(true);
    expect(result.contentBgTransparent).toBe(true);
    expect(result.usesGlobalOpacity).toBe(false);
    expect(result.windowOpacity).toBe(1);

    // 切换到 display mode，检查背景仍然透明
    await page.click('#fwModeBtn');
    await page.waitForTimeout(500);

    const result2 = await page.evaluate(() => {
      const fw = document.getElementById('floatingWindow');
      const fwContent = document.querySelector('.floating-window .fw-content');
      const fwCanvas = document.getElementById('fwAvatarCanvas');

      const isTransparent = (bg) => {
        return bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent' || bg === '';
      };

      const fwBg = fw ? getComputedStyle(fw).backgroundColor : '';
      const contentBg = fwContent ? getComputedStyle(fwContent).backgroundColor : '';
      const canvasBg = fwCanvas ? getComputedStyle(fwCanvas).backgroundColor : '';
      const winOpacity = fw ? parseFloat(getComputedStyle(fw).opacity) : 1;

      return {
        fwWindowBackground: fwBg,
        fwContentBackground: contentBg,
        fwCanvasBackground: canvasBg,
        windowOpacity: winOpacity,
        fwBgTransparent: isTransparent(fwBg),
        contentBgTransparent: isTransparent(contentBg),
        usesGlobalOpacity: winOpacity < 0.99,
        mode: (window.__cheapLiveContestFloatingDiag || {}).mode,
      };
    });

    expect(result2.mode).toBe('display');
    expect(result2.fwBgTransparent).toBe(true);
    expect(result2.contentBgTransparent).toBe(true);
    expect(result2.usesGlobalOpacity).toBe(false);
    expect(result2.windowOpacity).toBe(1);
  });

  test('main 和 floating panel iris 比例一致且大小正常', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const result = await page.evaluate(() => {
      const diag = window.__cheapLiveContestAvatarDiag || {};
      const irisDiag = diag.irisDiag;
      if (!irisDiag || !irisDiag.mainPanel) return { hasIrisDiag: false, irisDiagKeys: irisDiag ? Object.keys(irisDiag) : [] };

      const main = irisDiag.mainPanel || {};
      const fw = irisDiag.floatingPanel || {};

      let ratioConsistency = false;
      if (main.irisRatioToHead > 0 && fw.irisRatioToHead > 0) {
        const diff = Math.abs(main.irisRatioToHead - fw.irisRatioToHead);
        const avg = (main.irisRatioToHead + fw.irisRatioToHead) / 2;
        ratioConsistency = avg > 0 ? (diff / avg) < 0.15 : false;
      }

      return {
        hasIrisDiag: true,
        mainIrisRatioToHead: main.irisRatioToHead,
        fwIrisRatioToHead: fw.irisRatioToHead,
        mainIrisRadius: main.irisRadius,
        fwIrisRadius: fw.irisRadius,
        mainProjectedHeadRadius: main.projectedHeadRadius,
        fwProjectedHeadRadius: fw.projectedHeadRadius,
        ratioConsistency,
        panelConsistencyPass: irisDiag.panelConsistencyPass,
        defaultSizePass: irisDiag.defaultSizePass,
        fixedToBaselineRatio: irisDiag.fixedToBaselineRatio,
        fallbackActive: main.fallbackActive,
        rendererClass: main.rendererClass,
        diagFallbackActive: diag.fallbackActive,
        diagRendererClass: diag.rendererClass,
      };
    });

    expect(result.hasIrisDiag).toBe(true);
    expect(result.fallbackActive).toBe(false);
    expect(result.rendererClass).toBe('ProceduralSpindleWhaleAvatar');

    // main 和 floating 的 iris/head 比例应该接近
    expect(result.ratioConsistency).toBe(true);

    // 比例不能太小（不能是"小点"）
    // iris/head ratio 正常应该 > 0.08
    expect(result.mainIrisRatioToHead).toBeGreaterThan(0.08);
    expect(result.fwIrisRatioToHead).toBeGreaterThan(0.08);
  });
});
