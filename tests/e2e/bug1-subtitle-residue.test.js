/**
 * Bug 1 验证测试：主页面悬浮字幕关闭后仍残留
 * 
 * 验证目标：
 * - 开启字幕，主页面字幕正常显示
 * - 模拟字幕文本进入
 * - 关闭字幕
 * - 断言主页面所有字幕层都不可见或为空
 * - 特别断言 floating subtitle 不可见且无残留文本
 * - 再次开启字幕，字幕功能可以恢复
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173/src/face-tracking/';

test.describe('Bug 1: 主页面悬浮字幕关闭后清空', () => {
  
  test('字幕关闭后所有字幕层清空', async ({ page }) => {
    await page.goto(BASE_URL + 'index.html');
    await page.waitForTimeout(1000);
    
    // 等待页面加载完成
    await page.waitForLoadState('networkidle');
    
    // 滚动到扩展功能区域
    await page.evaluate(() => {
      const featureGroup = document.querySelector('.feature-group');
      if (featureGroup) featureGroup.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await page.waitForTimeout(500);
    
    // 1. 开启字幕
    const subtitleToggle = page.locator('#subtitleToggle');
    await subtitleToggle.waitFor({ state: 'visible' });
    await subtitleToggle.check({ force: true });  // force: true 允许点击即使元素被遮挡
    await page.waitForTimeout(500);
    
    // 2. 模拟字幕文本进入（通过 updateSubtitle）
    await page.evaluate(() => {
      window.faceTracker.updateSubtitle('测试字幕文本 Test subtitle text');
    });
    await page.waitForTimeout(200);
    
    // 3. 断言字幕显示
    const subtitleDisplay = page.locator('#subtitleDisplay');
    await expect(subtitleDisplay).toHaveText('测试字幕文本 Test subtitle text');
    await expect(subtitleDisplay).toHaveClass(/active/);
    
    // 4. 关闭字幕
    await subtitleToggle.uncheck({ force: true });
    await page.waitForTimeout(500);
    
    // 5. 断言主页面所有字幕层都不可见或为空
    await expect(subtitleDisplay).toHaveText('');
    await expect(subtitleDisplay).not.toHaveClass(/active/);
    
    const subtitleBelow = page.locator('#subtitleBelowAvatar');
    await expect(subtitleBelow).toHaveText('');
    await expect(subtitleBelow).not.toHaveClass(/active/);
    
    // 6. 再次开启字幕，字幕功能可以恢复
    await subtitleToggle.check({ force: true });
    await page.waitForTimeout(500);
    
    await page.evaluate(() => {
      window.faceTracker.updateSubtitle('恢复测试 Recovery test');
    });
    await page.waitForTimeout(200);
    
    await expect(subtitleDisplay).toHaveText('恢复测试 Recovery test');
    await expect(subtitleDisplay).toHaveClass(/active/);
  });
});