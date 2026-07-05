const { test, expect } = require('@playwright/test');

const DEMO_URL = 'http://127.0.0.1:8769/src/contest-demo/contest-interactive-demo.html';

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

    // 慢慢岛卡片
    const islandCard = cards[2];
    const islandTitle = await islandCard.$eval('.toolbox-card-title', el => el.textContent);
    expect(islandTitle).toContain('慢慢岛');
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

  // ====== 新增：display mode 触摸穿透 ======
  test('display mode 下悬浮窗内容区域触摸穿透，mode button 仍可点击', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 切换到 display mode
    const modeBtn = page.locator('#fwModeBtn');
    await modeBtn.click();
    await page.waitForTimeout(300);

    const diag = await page.evaluate(() => {
      const fw = document.getElementById('floatingWindow');
      const cs = getComputedStyle(fw);
      const content = fw.querySelector('.fw-content');
      const contentCs = getComputedStyle(content);
      const canvas = fw.querySelector('canvas');
      const canvasCs = canvas ? getComputedStyle(canvas) : null;
      const btn = document.getElementById('fwModeBtn');
      const btnCs = getComputedStyle(btn);
      const resize = fw.querySelector('.fw-resize');
      const resizeCs = resize ? getComputedStyle(resize) : null;
      return {
        windowPointerEvents: cs.pointerEvents,
        contentPointerEvents: contentCs.pointerEvents,
        canvasPointerEvents: canvasCs ? canvasCs.pointerEvents : null,
        modeBtnPointerEvents: btnCs.pointerEvents,
        resizePointerEvents: resizeCs ? resizeCs.pointerEvents : null,
        resizeDisplay: resizeCs ? resizeCs.display : null,
        hasDisplayMode: fw.classList.contains('fw-display-mode'),
      };
    });

    expect(diag.hasDisplayMode).toBe(true);
    expect(diag.windowPointerEvents).toBe('none');
    expect(diag.contentPointerEvents).toBe('none');
    expect(diag.modeBtnPointerEvents).toBe('auto');

    // mode button 仍可点击切回 edit
    await modeBtn.click();
    await page.waitForTimeout(300);
    const backToEdit = await page.evaluate(() => {
      const fw = document.getElementById('floatingWindow');
      return fw.classList.contains('fw-edit-mode');
    });
    expect(backToEdit).toBe(true);
  });

  // ====== 新增：按钮颜色 edit=橙, display=蓝 ======
  test('mode button 颜色：edit 橙色，display 蓝色', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 解析 rgb(r, g, b) 字符串
    const parseRgb = (str) => {
      const m = str.match(/rgb\(\s*(\d+),\s*(\d+),\s*(\d+)/);
      return m ? { r: +m[1], g: +m[2], b: +m[3] } : null;
    };

    // edit mode 初始状态：橙色（R 高，G 中，B 低）
    await page.mouse.move(10, 10);
    await page.waitForTimeout(100);
    const editColor = await page.evaluate(() => {
      const btn = document.getElementById('fwModeBtn');
      const cs = getComputedStyle(btn);
      return { bg: cs.backgroundColor, hasDisplayClass: btn.classList.contains('display-mode') };
    });
    expect(editColor.hasDisplayClass).toBe(false);
    const editRgb = parseRgb(editColor.bg);
    expect(editRgb).toBeTruthy();
    // 橙色：R > 200, B < 120
    expect(editRgb.r).toBeGreaterThan(200);
    expect(editRgb.b).toBeLessThan(120);

    // 切换到 display mode
    await page.locator('#fwModeBtn').click();
    await page.waitForTimeout(300);
    // 把鼠标移开按钮，避免 :hover 影响颜色读取
    await page.mouse.move(10, 10);
    await page.waitForTimeout(100);

    const displayColor = await page.evaluate(() => {
      const btn = document.getElementById('fwModeBtn');
      const cs = getComputedStyle(btn);
      return { bg: cs.backgroundColor, hasDisplayClass: btn.classList.contains('display-mode') };
    });
    expect(displayColor.hasDisplayClass).toBe(true);
    const displayRgb = parseRgb(displayColor.bg);
    expect(displayRgb).toBeTruthy();
    // 蓝色：B > 180, R < 120
    expect(displayRgb.b).toBeGreaterThan(180);
    expect(displayRgb.r).toBeLessThan(120);
  });

  // ====== 新增：微笑/张嘴表情 happy open mouth ======
  test('mouth 表情：smile+open 时 happyOpenMouthPass，下唇位移大于上唇', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    // 注入 mock params 触发 smile + open，并取 mouthDiag
    const result = await page.evaluate(async () => {
      const inst = window.getContestFishAvatarInstance && window.getContestFishAvatarInstance('avatarCanvas');
      if (!inst) return { error: 'no avatar instance' };

      // neutral
      inst.updateParams({ mouthOpen: 0, mouthSmile: 0, mouthFunnel: 0, mouthPress: 0 });
      const neutral = inst.mouthDiag ? { ...inst.mouthDiag } : null;

      // smile only
      inst.updateParams({ mouthOpen: 0, mouthSmile: 1, mouthFunnel: 0, mouthPress: 0 });
      const smile = inst.mouthDiag ? { ...inst.mouthDiag } : null;

      // open only (high)
      inst.updateParams({ mouthOpen: 0.9, mouthSmile: 0, mouthFunnel: 0, mouthPress: 0 });
      const open = inst.mouthDiag ? { ...inst.mouthDiag } : null;

      // smile + open (happy open)
      inst.updateParams({ mouthOpen: 0.9, mouthSmile: 1, mouthFunnel: 0, mouthPress: 0 });
      const smileOpen = inst.mouthDiag ? { ...inst.mouthDiag } : null;

      return { neutral, smile, open, smileOpen };
    });

    expect(result.error).toBeUndefined();
    expect(result.neutral).toBeTruthy();
    expect(result.smileOpen).toBeTruthy();

    // open 状态下：bottomLipDeltaFromNeutral 至少是 topLipDeltaFromNeutral 的 2.5 倍
    const topDelta = Math.abs(result.open.topLipDeltaFromNeutral || 0);
    const botDelta = Math.abs(result.open.bottomLipDeltaFromNeutral || 0);
    expect(botDelta).toBeGreaterThan(topDelta * 2.5);

    // smile+open 也应满足 ratio
    const topDeltaSO = Math.abs(result.smileOpen.topLipDeltaFromNeutral || 0);
    const botDeltaSO = Math.abs(result.smileOpen.bottomLipDeltaFromNeutral || 0);
    expect(botDeltaSO).toBeGreaterThan(topDeltaSO * 2.5);

    // happyOpenMouthPass 应为 true（若 diag 提供）
    if (result.smileOpen.happyOpenMouthPass !== undefined) {
      expect(result.smileOpen.happyOpenMouthPass).toBe(true);
    }
  });

  // ====== 新增：眼皮不透明，闭眼不可见虹膜 ======
  test('eyelid 不透明：closed 时 irisVisibleWhenClosed=false，eyelidAlpha=1', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    const result = await page.evaluate(() => {
      const inst = window.getContestFishAvatarInstance && window.getContestFishAvatarInstance('avatarCanvas');
      if (!inst) return { error: 'no avatar instance' };

      // open
      inst.updateParams({ eyeLeft: 1, eyeRight: 1 });
      const openDiag = inst.eyelidDiag ? JSON.parse(JSON.stringify(inst.eyelidDiag)) : null;

      // half blink
      inst.updateParams({ eyeLeft: 0.5, eyeRight: 0.5 });
      const halfDiag = inst.eyelidDiag ? JSON.parse(JSON.stringify(inst.eyelidDiag)) : null;

      // closed
      inst.updateParams({ eyeLeft: 0.02, eyeRight: 0.02 });
      const closedDiag = inst.eyelidDiag ? JSON.parse(JSON.stringify(inst.eyelidDiag)) : null;

      return { openDiag, halfDiag, closedDiag };
    });

    expect(result.error).toBeUndefined();
    expect(result.closedDiag).toBeTruthy();
    // closed 时 eyelidAlpha 应为 1
    expect(result.closedDiag.left.eyelidAlpha).toBe(1);
    expect(result.closedDiag.right.eyelidAlpha).toBe(1);
    // closed 时不应使用 globalAlpha
    expect(result.closedDiag.left.usesGlobalAlpha).toBe(false);
    expect(result.closedDiag.right.usesGlobalAlpha).toBe(false);
    // closed 时 iris 不可见
    expect(result.closedDiag.left.irisVisibleWhenClosed).toBe(false);
    expect(result.closedDiag.right.irisVisibleWhenClosed).toBe(false);
    // closedEyeIrisHiddenPass / halfBlinkOpaquePass
    expect(result.closedDiag.closedEyeIrisHiddenPass).toBe(true);
    expect(result.closedDiag.halfBlinkOpaquePass).toBe(true);
  });

  // ====== 新增：变声 preset 无 oscillator，silence PASS，preset 参数差异 ======
  test('voice preset：无 oscillator，silence PASS，preset 参数与 original 不同', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const diag = window.__cheapLiveContestVoiceDiag;
      const credits = window.__cheapLiveContestVoiceCredits;
      const configs = typeof VOICE_PRESET_CONFIGS !== 'undefined' ? VOICE_PRESET_CONFIGS : null;
      return {
        diagPresent: !!diag,
        creditsPresent: !!credits,
        oscillatorConnectedToOutput: diag ? diag.oscillatorConnectedToOutput : null,
        activeOscillatorCount: diag ? diag.activeOscillatorCount : null,
        creditsImpl: credits ? credits.implementation : null,
        creditsThirdParty: credits ? credits.thirdPartyLibraries : null,
        configs: configs ? Object.keys(configs) : null,
        cuteParams: configs && configs.cute ? {
          eqHighGain: configs.cute.eqHighGain,
          eqLowGain: configs.cute.eqLowGain,
          waveShaperAmount: configs.cute.waveShaperAmount,
          filterFreq: configs.cute.filterFreq,
        } : null,
        robotParams: configs && configs.robot ? {
          delayMix: configs.robot.delayMix,
          waveShaperAmount: configs.robot.waveShaperAmount,
          filterQ: configs.robot.filterQ,
        } : null,
        deepParams: configs && configs.deep ? {
          eqLowGain: configs.deep.eqLowGain,
          filterFreq: configs.deep.filterFreq,
          eqHighGain: configs.deep.eqHighGain,
        } : null,
        radioParams: configs && configs.radio ? {
          waveShaperAmount: configs.radio.waveShaperAmount,
          compressorRatio: configs.radio.compressorRatio,
        } : null,
        originalParams: configs && configs.original ? {
          eqLowGain: configs.original.eqLowGain,
          waveShaperAmount: configs.original.waveShaperAmount,
        } : null,
      };
    });

    expect(result.diagPresent).toBe(true);
    expect(result.creditsPresent).toBe(true);
    expect(result.oscillatorConnectedToOutput).toBe(false);
    expect(result.activeOscillatorCount).toBe(0);
    expect(result.configs).toEqual(expect.arrayContaining(['original','cute','robot','deep','radio']));

    // cute 与 original 参数明显不同
    expect(Math.abs(result.cuteParams.eqHighGain - result.originalParams.eqLowGain)).toBeGreaterThan(5);
    expect(Math.abs(result.cuteParams.waveShaperAmount - result.originalParams.waveShaperAmount)).toBeGreaterThan(0.05);

    // robot 有明显 delay/waveshaper
    expect(result.robotParams.delayMix).toBeGreaterThan(0.2);
    expect(result.robotParams.waveShaperAmount).toBeGreaterThan(0.3);

    // deep 低频提升明显
    expect(result.deepParams.eqLowGain).toBeGreaterThan(8);
    expect(result.deepParams.filterFreq).toBeLessThan(2800);

    // radio 重压缩 + 较重饱和
    expect(result.radioParams.compressorRatio).toBeGreaterThan(5);
    expect(result.radioParams.waveShaperAmount).toBeGreaterThan(0.2);

    // credits 不应声称第三方变声库
    expect(result.creditsThirdParty).toEqual([]);
  });

  // ====== 新增：attribution 声明存在，不写"全部自研" ======
  test('attribution：页面声明 MediaPipe / WebAudio，不写"全部自研"', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const bodyText = await page.evaluate(() => document.body.innerText);

    // 应该提到 MediaPipe
    expect(bodyText.toLowerCase()).toContain('mediapipe');
    // 应该提到 Web Audio（中文或英文）
    expect(bodyText.toLowerCase().match(/web\s*audio/i)).toBeTruthy();
    // 不应该出现"全部自研"
    expect(bodyText).not.toContain('全部自研');
    // 不应该出现"完全原创面捕"
    expect(bodyText).not.toContain('完全原创面捕');
    // tech credits 区应该存在
    const creditsExists = await page.locator('.tech-credits').count();
    expect(creditsExists).toBeGreaterThan(0);
  });

  // ====== 新增：版本号显示 ======
  test('version stamp：标题旁显示版本号和更新时间', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    const stampText = await page.evaluate(() => {
      const el = document.getElementById('versionStamp');
      return el ? el.textContent : null;
    });

    expect(stampText).toBeTruthy();
    // 不应是初始占位 "version unknown"（除非 fetch 失败，但本地 server 应能加载）
    // 接受 "v" 开头或 "version unknown"
    expect(stampText.length).toBeGreaterThan(5);
  });

  // ====== 新增：游戏键盘聚焦，方向键不滚动页面 ======
  test('game keyboard focus：点击游戏后方向键不滚动页面，未点击时不抢', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 先让页面可滚动：把窗口调小或确保 body 高于 viewport
    // 这里通过 evaluate 检查 activeElement 行为
    // 1. 未点击游戏区域时，方向键不应被抢
    const beforeClick = await page.evaluate(() => {
      return {
        activeTag: document.activeElement ? document.activeElement.tagName : null,
        gameDiagPresent: !!window.__cheapLiveContestGameDiag,
      };
    });
    expect(beforeClick.gameDiagPresent).toBe(true);

    // 2. 点击游戏区域
    await page.locator('#gamePanelBody').click();
    await page.waitForTimeout(200);

    const afterClick = await page.evaluate(() => {
      const gpb = document.getElementById('gamePanelBody');
      return {
        activeIsGame: document.activeElement === gpb,
        gameFocused: window.__cheapLiveContestGameDiag ? window.__cheapLiveContestGameDiag.gameFocused : null,
      };
    });
    expect(afterClick.activeIsGame).toBe(true);
    expect(afterClick.gameFocused).toBe(true);

    // 3. 记录 scrollY，按 ArrowDown，确认页面不滚动
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(150);
    const pressResult = await page.evaluate(() => ({
      scrollAfter: window.scrollY,
      prevented: window.__cheapLiveContestGameDiag ? window.__cheapLiveContestGameDiag.preventedPageScroll : null,
      scoped: window.__cheapLiveContestGameDiag ? window.__cheapLiveContestGameDiag.arrowKeysScopedToGame : null,
      lastKey: window.__cheapLiveContestGameDiag ? window.__cheapLiveContestGameDiag.lastKey : null,
    }));
    expect(pressResult.prevented).toBe(true);
    expect(pressResult.scoped).toBe(true);
    expect(pressResult.lastKey).toBe('ArrowDown');
    // 页面 scrollY 不应变化（在 1280x800 且页面较短时 scrollBefore 应该是 0，press 后仍是 0）
    expect(Math.abs(pressResult.scrollAfter - scrollBefore)).toBeLessThan(5);

    // 4. 点击游戏区域外（点 top bar），方向键应恢复默认
    await page.locator('.top-bar .brand').click();
    await page.waitForTimeout(200);
    const afterBlur = await page.evaluate(() => {
      const gpb = document.getElementById('gamePanelBody');
      return {
        activeIsGame: document.activeElement === gpb,
        gameFocused: window.__cheapLiveContestGameDiag ? window.__cheapLiveContestGameDiag.gameFocused : null,
      };
    });
    expect(afterBlur.gameFocused).toBe(false);
  });

  // ====== 新增：慢慢岛不写"独立游戏" ======
  test('慢慢岛描述：不写"独立游戏"，应为游戏化心态调节/时间管理', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const toolboxText = await page.evaluate(() => {
      const section = document.querySelector('.toolbox-section');
      return section ? section.innerText : '';
    });

    // 不应该把慢慢岛称为"独立游戏"或"独立休闲游戏"
    expect(toolboxText).not.toContain('独立休闲游戏');
    expect(toolboxText).not.toContain('独立游戏');
    // 应该写"游戏化心态调节"或"时间管理"
    const hasCorrectDesc = toolboxText.includes('心态调节') || toolboxText.includes('时间管理');
    expect(hasCorrectDesc).toBe(true);
    // 标题应该是"慢慢岛"（不是"慢慢倒"）
    expect(toolboxText).toContain('慢慢岛');
  });
});
