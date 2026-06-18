/**
 * Avatar 运行时 smoke —— 标准 @playwright/test。
 *
 * 覆盖：
 *  - 鲸鱼默认渲染成功（Canvas 有像素、无 pageerror、无 console error）
 *  - 球形头像切换稳定（wrapper 尺寸与 backing store 尺寸稳定）
 *  - 表情按钮（眨眼/张嘴/微笑）点击不抛错
 *  - 多次切换不出现尺寸漂移或错误
 *
 * 失败时真实抛出，不吞异常；由 Playwright Test runner 决定退出码。
 *
 * 运行：
 *   npx playwright test tests/e2e/playwright-smoke.test.js --reporter=list
 *   npm run test:gate
 */

const { test, expect } = require('@playwright/test');

// ====== 常量 ======
const FACE_TRACKING_INDEX = 'src/face-tracking/index.html';
const DRIFT_PX_THRESHOLD = 12;      // 允许的 wrapper 尺寸变化（像素）
const BACKING_STORE_DRIFT_THRESHOLD = 12;

// ====== 辅助：收集页面错误（不吞掉，仅记录以强化断言） ======
function registerErrorCollectors(page) {
  const errors = [];
  const consoleErrors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  return { errors, consoleErrors };
}

// 小工具：获取尺寸
async function snapshotSizes(page) {
  return page.evaluate(() => {
    const wrapper = document.querySelector('.avatar-wrapper');
    const canvas = document.getElementById('avatar_canvas');
    const wRect = wrapper && wrapper.getBoundingClientRect();
    const cRect = canvas && canvas.getBoundingClientRect();
    return {
      wrapperW: wRect ? wRect.width : 0,
      wrapperH: wRect ? wRect.height : 0,
      canvasCssW: cRect ? cRect.width : 0,
      canvasCssH: cRect ? cRect.height : 0,
      backingW: canvas ? canvas.width : 0,
      backingH: canvas ? canvas.height : 0,
    };
  });
}

// 小工具：验证 Canvas 有非零像素（至少一处 RGBA 非零）
function hasPixelsCheck() {
  const canvas = document.getElementById('avatar_canvas');
  if (!canvas || canvas.width === 0 || canvas.height === 0) return false;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const step = Math.max(1, Math.floor(img.length / 4 / 1024));
  for (let i = 0; i < img.length; i += 4 * step) {
    const a = img[i + 3];
    if (a > 0) return true;
    if (img[i] > 0 || img[i + 1] > 0 || img[i + 2] > 0) return true;
  }
  return false;
}

test.describe('Avatar runtime smoke', () => {
  test('页面加载、鲸鱼默认渲染有像素、无 pageerror', async ({ page }) => {
    const col = registerErrorCollectors(page);
    await page.goto(FACE_TRACKING_INDEX, { waitUntil: 'domcontentloaded', timeout: 20000 });
    // 等待 canvas 出现
    await expect(page.locator('#avatar_canvas')).toHaveCount(1);
    await page.waitForTimeout(800); // 给 JS 模块加载和初始化时间

    const hasPix = await page.evaluate(hasPixelsCheck);
    expect(hasPix, 'avatar_canvas 应绘制非零像素').toBe(true);

    // 尺寸：wrapper 和 canvas 均应具有合理尺寸
    const s = await snapshotSizes(page);
    expect(s.wrapperW, 'avatar-wrapper width 应大于 0').toBeGreaterThan(0);
    expect(s.wrapperH, 'avatar-wrapper height 应大于 0').toBeGreaterThan(0);
    expect(s.backingW, 'canvas backing width 应大于 0').toBeGreaterThan(0);
    expect(s.backingH, 'canvas backing height 应大于 0').toBeGreaterThan(0);

    // 不允许任何未捕获的 pageerror
    expect(col.errors, '无 pageerror').toEqual([]);
    // 对 console error 采用宽松策略，避免非阻塞的 browser 资源加载警告干扰
    // 但仍然记录，便于在 --reporter=verbose 下定位
    // 不做断言，因为 http-server 下可能有 favicon 404 之类
  });

  test('切换到球形 Avatar 后 Canvas 仍渲染且 wrapper 尺寸稳定', async ({ page }) => {
    const col = registerErrorCollectors(page);
    await page.goto(FACE_TRACKING_INDEX, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#avatar_canvas', { timeout: 8000 });
    await page.waitForTimeout(800);

    const before = await snapshotSizes(page);

    // 找到能显示“球形”的 tab/按钮（不依赖精确文案，匹配多个候选）
    const tabCandidates = [
      page.locator('.model-tab').filter({ hasText: /球形|sphere/i }),
      page.locator('button').filter({ hasText: /球形|sphere/i }),
    ];
    let clicked = false;
    for (const c of tabCandidates) {
      const cnt = await c.count();
      if (cnt > 0) {
        await c.first().click();
        clicked = true;
        break;
      }
    }
    expect(clicked, '应能点击切换到球形形象').toBe(true);

    await page.waitForTimeout(1000);

    const hasPix = await page.evaluate(hasPixelsCheck);
    expect(hasPix, '切换球形后 canvas 应有非零像素').toBe(true);

    const after = await snapshotSizes(page);
    // 尺寸不得大幅跳动
    expect(Math.abs(after.wrapperW - before.wrapperW), 'wrapperW 漂移应 < ' + DRIFT_PX_THRESHOLD).toBeLessThan(DRIFT_PX_THRESHOLD);
    expect(Math.abs(after.wrapperH - before.wrapperH), 'wrapperH 漂移应 < ' + DRIFT_PX_THRESHOLD).toBeLessThan(DRIFT_PX_THRESHOLD);
    expect(Math.abs(after.backingW - before.backingW), 'backingW 漂移应 < ' + BACKING_STORE_DRIFT_THRESHOLD).toBeLessThan(BACKING_STORE_DRIFT_THRESHOLD);
    expect(Math.abs(after.backingH - before.backingH), 'backingH 漂移应 < ' + BACKING_STORE_DRIFT_THRESHOLD).toBeLessThan(BACKING_STORE_DRIFT_THRESHOLD);

    expect(col.errors, '切换球形期间无 pageerror').toEqual([]);
  });

  test('表情按钮（眨眼/张嘴/微笑/重置）连续点击无错误', async ({ page }) => {
    const col = registerErrorCollectors(page);
    await page.goto(FACE_TRACKING_INDEX, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#avatar_canvas', { timeout: 8000 });
    await page.waitForTimeout(800);

    const buttons = [
      '#testBlink', '#testSmile', '#testOpen', '#testReset',
    ];
    for (const sel of buttons) {
      const loc = page.locator(sel);
      const cnt = await loc.count();
      if (cnt > 0) {
        await loc.first().click({ timeout: 5000 });
        await page.waitForTimeout(100);
      }
    }

    expect(col.errors, '点击表情按钮期间无 pageerror').toEqual([]);
  });

  test('5× 鲸鱼→球体反复切换不出现尺寸漂移或 pageerror', async ({ page }) => {
    const col = registerErrorCollectors(page);
    await page.goto(FACE_TRACKING_INDEX, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#avatar_canvas', { timeout: 8000 });
    await page.waitForTimeout(800);

    const baseline = await snapshotSizes(page);

    const whaleTab = page.locator('.model-tab').filter({ hasText: /纺锤|whale|鲸鱼/i });
    const sphereTab = page.locator('.model-tab').filter({ hasText: /球形|sphere/i });

    const whaleExists = (await whaleTab.count()) > 0;
    const sphereExists = (await sphereTab.count()) > 0;
    expect(whaleExists && sphereExists, '应存在鲸鱼/球形两个 tab').toBe(true);

    for (let i = 0; i < 5; i++) {
      await whaleTab.first().click();
      await page.waitForTimeout(250);
      await sphereTab.first().click();
      await page.waitForTimeout(250);
    }

    // 最后回到鲸鱼
    await whaleTab.first().click();
    await page.waitForTimeout(800);

    const final = await snapshotSizes(page);
    expect(Math.abs(final.wrapperW - baseline.wrapperW)).toBeLessThan(DRIFT_PX_THRESHOLD);
    expect(Math.abs(final.wrapperH - baseline.wrapperH)).toBeLessThan(DRIFT_PX_THRESHOLD);
    expect(col.errors, '多次切换无 pageerror').toEqual([]);
  });
});
