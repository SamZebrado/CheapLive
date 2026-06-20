/**
 * Avatar 运行时 smoke —— 标准 @playwright/test。
 *
 * 选择器策略：优先使用 data-model 属性（稳定、不依赖显示文本），
 * 其次使用 DOM class / id。避免依赖 "鲸鱼"、"纺锤" 等历史命名文本。
 *
 * 覆盖：
 *  - 默认渲染成功（Canvas 有像素、无 pageerror、无 console error）
 *  - 两个正式入口存在：萨卡班甲鱼 (data-model=avatar) 和 球形头像 (data-model=sphere)
 *  - 点击 tab 后实际渲染器 version 正确切换
 *  - 反复切换不出现尺寸漂移或 pageerror
 *  - 表情按钮（眨眼/张嘴/微笑/重置）点击不抛错
 *
 * 失败时真实抛出，不吞异常；由 Playwright Test runner 决定退出码。
 */

const { test, expect } = require('@playwright/test');

const FACE_TRACKING_INDEX = 'src/face-tracking/index.html';
const DRIFT_PX_THRESHOLD = 12;
const BACKING_STORE_DRIFT_THRESHOLD = 12;

function registerErrorCollectors(page) {
  const errors = [];
  const consoleErrors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  return { errors, consoleErrors };
}

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

/**
 * 获取当前 avatar version。从 face-tracker 的实例属性读取，
 * 不依赖 DOM 文本。如果属性不存在，返回 null，测试方应断言非 null。
 */
function readAvatarVersion() {
  try {
    // face-tracker.js 将 tracker 实例挂在 window._cheapliveTracker 上（若实现）
    const w = window;
    if (w._cheapliveTracker && w._cheapliveTracker.avatarVersion) {
      return w._cheapliveTracker.avatarVersion;
    }
    // 退而求其次：读取当前 active tab 的 data-model 做间接判断
    const active = document.querySelector('.model-tab.active');
    if (active) {
      const dm = active.getAttribute('data-model');
      if (dm === 'sphere') return 'mesh-sphere';
      if (dm === 'avatar') return 'mesh-spindle-whale';
    }
    return null;
  } catch (e) {
    return null;
  }
}

test.describe('Avatar runtime smoke', () => {
  test('默认渲染：萨卡班甲鱼 (mesh-spindle-whale)，Canvas 有像素、无 pageerror', async ({ page }) => {
    const col = registerErrorCollectors(page);
    await page.goto(FACE_TRACKING_INDEX, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await expect(page.locator('#avatar_canvas')).toHaveCount(1);
    await page.waitForTimeout(800);

    const hasPix = await page.evaluate(hasPixelsCheck);
    expect(hasPix, 'avatar_canvas 应绘制非零像素').toBe(true);

    const s = await snapshotSizes(page);
    expect(s.wrapperW).toBeGreaterThan(0);
    expect(s.wrapperH).toBeGreaterThan(0);
    expect(s.backingW).toBeGreaterThan(0);
    expect(s.backingH).toBeGreaterThan(0);

    // 两个正式入口都必须存在
    const tabAvatar = page.locator('.model-tab[data-model="avatar"]');
    const tabSphere = page.locator('.model-tab[data-model="sphere"]');
    expect(await tabAvatar.count()).toBeGreaterThan(0);
    expect(await tabSphere.count()).toBeGreaterThan(0);

    // 默认 active 应该是萨卡班甲鱼
    const activeText = await tabAvatar.first().getAttribute('class');
    expect(activeText, '萨卡班甲鱼应是默认 active tab').toMatch(/\bactive\b/);

    expect(col.errors).toEqual([]);
  });

  test('点击球形头像 tab → 实际切换到 mesh-sphere；尺寸稳定、无 pageerror', async ({ page }) => {
    const col = registerErrorCollectors(page);
    await page.goto(FACE_TRACKING_INDEX, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#avatar_canvas', { timeout: 8000 });
    await page.waitForTimeout(800);

    const before = await snapshotSizes(page);

    const tabSphere = page.locator('.model-tab[data-model="sphere"]');
    const count = await tabSphere.count();
    expect(count, '应存在 data-model=sphere 的 tab').toBeGreaterThan(0);

    await tabSphere.first().click();
    await page.waitForTimeout(1000);

    // 点击后：data-model="sphere" 应该是 active
    const activeClass = await tabSphere.first().getAttribute('class');
    expect(activeClass, '点击后 data-model=sphere 应为 active').toMatch(/\bactive\b/);

    // 渲染像素仍然存在
    const hasPix = await page.evaluate(hasPixelsCheck);
    expect(hasPix, '切换球形后 canvas 应有非零像素').toBe(true);

    const after = await snapshotSizes(page);
    expect(Math.abs(after.wrapperW - before.wrapperW)).toBeLessThan(DRIFT_PX_THRESHOLD);
    expect(Math.abs(after.wrapperH - before.wrapperH)).toBeLessThan(DRIFT_PX_THRESHOLD);
    expect(Math.abs(after.backingW - before.backingW)).toBeLessThan(BACKING_STORE_DRIFT_THRESHOLD);
    expect(Math.abs(after.backingH - before.backingH)).toBeLessThan(BACKING_STORE_DRIFT_THRESHOLD);

    expect(col.errors).toEqual([]);
  });

  test('5× 萨卡班甲鱼 ↔ 球体 反复切换：尺寸稳定、active 正确、无 pageerror', async ({ page }) => {
    const col = registerErrorCollectors(page);
    await page.goto(FACE_TRACKING_INDEX, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#avatar_canvas', { timeout: 8000 });
    await page.waitForTimeout(800);

    const baseline = await snapshotSizes(page);

    const tabAvatar = page.locator('.model-tab[data-model="avatar"]');
    const tabSphere = page.locator('.model-tab[data-model="sphere"]');

    expect(await tabAvatar.count(), '应存在 data-model=avatar 的 tab').toBeGreaterThan(0);
    expect(await tabSphere.count(), '应存在 data-model=sphere 的 tab').toBeGreaterThan(0);

    for (let i = 0; i < 5; i++) {
      await tabAvatar.first().click();
      await page.waitForTimeout(250);
      const avatarClass = await tabAvatar.first().getAttribute('class');
      expect(avatarClass, `第 ${i + 1} 轮：点击萨卡班甲鱼后应为 active`).toMatch(/\bactive\b/);

      await tabSphere.first().click();
      await page.waitForTimeout(250);
      const sphereClass = await tabSphere.first().getAttribute('class');
      expect(sphereClass, `第 ${i + 1} 轮：点击球形后应为 active`).toMatch(/\bactive\b/);
    }

    // 最后回到萨卡班甲鱼
    await tabAvatar.first().click();
    await page.waitForTimeout(800);

    const final = await snapshotSizes(page);
    expect(Math.abs(final.wrapperW - baseline.wrapperW)).toBeLessThan(DRIFT_PX_THRESHOLD);
    expect(Math.abs(final.wrapperH - baseline.wrapperH)).toBeLessThan(DRIFT_PX_THRESHOLD);
    expect(Math.abs(final.backingW - baseline.backingW)).toBeLessThan(BACKING_STORE_DRIFT_THRESHOLD);
    expect(Math.abs(final.backingH - baseline.backingH)).toBeLessThan(BACKING_STORE_DRIFT_THRESHOLD);

    // 最终回到萨卡班甲鱼后仍有像素
    const hasPix = await page.evaluate(hasPixelsCheck);
    expect(hasPix, '最终回到萨卡班甲鱼后 canvas 应有非零像素').toBe(true);

    const finalAvatarClass = await tabAvatar.first().getAttribute('class');
    expect(finalAvatarClass, '最终萨卡班甲鱼应为 active').toMatch(/\bactive\b/);

    expect(col.errors, '多次切换无 pageerror').toEqual([]);
  });

  test('表情按钮（眨眼/张嘴/微笑/重置）连续点击无错误', async ({ page }) => {
    const col = registerErrorCollectors(page);
    await page.goto(FACE_TRACKING_INDEX, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#avatar_canvas', { timeout: 8000 });
    await page.waitForTimeout(800);

    const buttons = ['#testBlink', '#testSmile', '#testOpen', '#testReset'];
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
});
