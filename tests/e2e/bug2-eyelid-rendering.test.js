/**
 * Bug 2 验证测试：眼皮/眼睛渲染观感修复
 * 
 * 验证目标：
 * - 不再出现 45° 斜线
 * - 眼皮不再飘到眉毛上方
 * - 眼皮不再盖住眉毛
 * - eyeWide 视觉上明显增大眼睛
 * - 眼睛变小时不是"整眼缩小"
 * - 实现了"上眼皮从上往下盖下来"的效果
 */

import { test, expect } from '@playwright/test';
import path from 'path';

const BASE_URL = 'http://localhost:5173/src/face-tracking/';

test.describe('Bug 2: 眼皮/眼睛渲染观感修复', () => {
  
  test.describe.configure({ mode: 'parallel' });

  // Sphere avatar 测试
  test('sphere baseline', async ({ page }) => {
    await page.goto(BASE_URL + 'test-sphere.html');
    await page.waitForTimeout(500);
    
    // 设置默认参数：睁眼
    await page.evaluate(() => {
      window.avatar.updateParams({ eyeLeft: 1, eyeRight: 1 });
    });
    await page.waitForTimeout(200);
    
    const screenshot = await page.screenshot({ fullPage: false });
    await expect(screenshot).toMatchSnapshot('sphere-baseline.png');
  });

  test('sphere eyeWide', async ({ page }) => {
    await page.goto(BASE_URL + 'test-sphere.html');
    await page.waitForTimeout(500);
    
    await page.evaluate(() => {
      window.avatar.updateParams({ eyeLeft: 1, eyeRight: 1, eyeWideLeft: 1, eyeWideRight: 1 });
    });
    await page.waitForTimeout(200);
    
    const screenshot = await page.screenshot({ fullPage: false });
    await expect(screenshot).toMatchSnapshot('sphere-eyewide.png');
  });

  test('sphere eyeSquint', async ({ page }) => {
    await page.goto(BASE_URL + 'test-sphere.html');
    await page.waitForTimeout(500);
    
    await page.evaluate(() => {
      window.avatar.updateParams({ eyeLeft: 1, eyeRight: 1, eyeSquintLeft: 1, eyeSquintRight: 1 });
    });
    await page.waitForTimeout(200);
    
    const screenshot = await page.screenshot({ fullPage: false });
    await expect(screenshot).toMatchSnapshot('sphere-eyesquint.png');
  });

  test('sphere half blink', async ({ page }) => {
    await page.goto(BASE_URL + 'test-sphere.html');
    await page.waitForTimeout(500);
    
    await page.evaluate(() => {
      window.avatar.updateParams({ eyeLeft: 0.5, eyeRight: 0.5 });
    });
    await page.waitForTimeout(200);
    
    const screenshot = await page.screenshot({ fullPage: false });
    await expect(screenshot).toMatchSnapshot('sphere-half-blink.png');
  });

  test('sphere half blink + eyeWide', async ({ page }) => {
    await page.goto(BASE_URL + 'test-sphere.html');
    await page.waitForTimeout(500);
    
    await page.evaluate(() => {
      window.avatar.updateParams({ eyeLeft: 0.5, eyeRight: 0.5, eyeWideLeft: 1, eyeWideRight: 1 });
    });
    await page.waitForTimeout(200);
    
    const screenshot = await page.screenshot({ fullPage: false });
    await expect(screenshot).toMatchSnapshot('sphere-half-blink-eyewide.png');
  });

  test('sphere half blink + eyeSquint', async ({ page }) => {
    await page.goto(BASE_URL + 'test-sphere.html');
    await page.waitForTimeout(500);
    
    await page.evaluate(() => {
      window.avatar.updateParams({ eyeLeft: 0.5, eyeRight: 0.5, eyeSquintLeft: 1, eyeSquintRight: 1 });
    });
    await page.waitForTimeout(200);
    
    const screenshot = await page.screenshot({ fullPage: false });
    await expect(screenshot).toMatchSnapshot('sphere-half-blink-eyesquint.png');
  });

  // Spindle whale avatar 测试
  test('spindle baseline', async ({ page }) => {
    await page.goto(BASE_URL + 'test-spindle.html');
    await page.waitForTimeout(500);
    
    await page.evaluate(() => {
      window.avatar.updateParams({ eyeLeft: 1, eyeRight: 1 });
    });
    await page.waitForTimeout(200);
    
    const screenshot = await page.screenshot({ fullPage: false });
    await expect(screenshot).toMatchSnapshot('spindle-baseline.png');
  });

  test('spindle eyeWide', async ({ page }) => {
    await page.goto(BASE_URL + 'test-spindle.html');
    await page.waitForTimeout(500);
    
    await page.evaluate(() => {
      window.avatar.updateParams({ eyeLeft: 1, eyeRight: 1, eyeWideLeft: 1, eyeWideRight: 1 });
    });
    await page.waitForTimeout(200);
    
    const screenshot = await page.screenshot({ fullPage: false });
    await expect(screenshot).toMatchSnapshot('spindle-eyewide.png');
  });

  test('spindle eyeSquint', async ({ page }) => {
    await page.goto(BASE_URL + 'test-spindle.html');
    await page.waitForTimeout(500);
    
    await page.evaluate(() => {
      window.avatar.updateParams({ eyeLeft: 1, eyeRight: 1, eyeSquintLeft: 1, eyeSquintRight: 1 });
    });
    await page.waitForTimeout(200);
    
    const screenshot = await page.screenshot({ fullPage: false });
    await expect(screenshot).toMatchSnapshot('spindle-eyesquint.png');
  });

  test('spindle half blink', async ({ page }) => {
    await page.goto(BASE_URL + 'test-spindle.html');
    await page.waitForTimeout(500);
    
    await page.evaluate(() => {
      window.avatar.updateParams({ eyeLeft: 0.5, eyeRight: 0.5 });
    });
    await page.waitForTimeout(200);
    
    const screenshot = await page.screenshot({ fullPage: false });
    await expect(screenshot).toMatchSnapshot('spindle-half-blink.png');
  });

  test('spindle half blink + eyeWide', async ({ page }) => {
    await page.goto(BASE_URL + 'test-spindle.html');
    await page.waitForTimeout(500);
    
    await page.evaluate(() => {
      window.avatar.updateParams({ eyeLeft: 0.5, eyeRight: 0.5, eyeWideLeft: 1, eyeWideRight: 1 });
    });
    await page.waitForTimeout(200);
    
    const screenshot = await page.screenshot({ fullPage: false });
    await expect(screenshot).toMatchSnapshot('spindle-half-blink-eyewide.png');
  });

  test('spindle half blink + eyeSquint', async ({ page }) => {
    await page.goto(BASE_URL + 'test-spindle.html');
    await page.waitForTimeout(500);
    
    await page.evaluate(() => {
      window.avatar.updateParams({ eyeLeft: 0.5, eyeRight: 0.5, eyeSquintLeft: 1, eyeSquintRight: 1 });
    });
    await page.waitForTimeout(200);
    
    const screenshot = await page.screenshot({ fullPage: false });
    await expect(screenshot).toMatchSnapshot('spindle-half-blink-eyesquint.png');
  });

  // yaw ±30° 下的 half blink，检查是否仍有斜线/漂移
  test('spindle yaw -30 half blink', async ({ page }) => {
    await page.goto(BASE_URL + 'test-spindle.html');
    await page.waitForTimeout(500);
    
    await page.evaluate(() => {
      window.avatar.updateParams({ eyeLeft: 0.5, eyeRight: 0.5, headYaw: 0.35 });
    });
    await page.waitForTimeout(200);
    
    const screenshot = await page.screenshot({ fullPage: false });
    await expect(screenshot).toMatchSnapshot('spindle-yaw-30-half-blink.png');
  });

  test('spindle yaw +30 half blink', async ({ page }) => {
    await page.goto(BASE_URL + 'test-spindle.html');
    await page.waitForTimeout(500);
    
    await page.evaluate(() => {
      window.avatar.updateParams({ eyeLeft: 0.5, eyeRight: 0.5, headYaw: 0.65 });
    });
    await page.waitForTimeout(200);
    
    const screenshot = await page.screenshot({ fullPage: false });
    await expect(screenshot).toMatchSnapshot('spindle-yaw-30-half-blink-right.png');
  });
});