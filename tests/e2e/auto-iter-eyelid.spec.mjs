import { test, expect } from '@playwright/test';

// 验证萨卡班甲鱼：默认正面 + 眨眼效果
test('spindle whale: default front + blinking mask color', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8790/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: '.automation/artifacts/run-20260620-002/01-spindle-front.png', fullPage: true });
  expect(errs.length).toBe(0);
});

// 验证球体：默认正面 + 眨眼
test('sphere: default front + blinking mask color', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8790/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: '.automation/artifacts/run-20260620-002/02-sphere-front.png', fullPage: true });
  expect(errs.length).toBe(0);
});

// 旋转角度验证：右转45°、抬头20°
test('spindle whale: rotate 45 right + pitch 20 up', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8790/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  // 执行转头/抬头 JS（如果有测试按钮则点击按钮）
  try {
    await page.evaluate(() => {
      if (window.testYawRight) window.testYawRight();
      if (window.testPitchUp) window.testPitchUp();
    });
  } catch (e) { /* 无测试按钮，继续 */ }
  await page.waitForTimeout(500);
  await page.screenshot({ path: '.automation/artifacts/run-20260620-002/03-spindle-rotated.png', fullPage: true });
  expect(errs.length).toBe(0);
});

// 眨眼效果验证：触发眨眼后截图
test('spindle whale: blink animation', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8790/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  try {
    await page.evaluate(() => { if (window.testBlink) window.testBlink(); });
  } catch (e) { /* 无测试按钮，继续 */ }
  await page.waitForTimeout(600);
  await page.screenshot({ path: '.automation/artifacts/run-20260620-002/04-spindle-blinking.png', fullPage: true });
  expect(errs.length).toBe(0);
});

// 经典脚本（procedural-avatar-classic.js）验证
test('classic avatar: renders without error', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  // 用 index.html 如果引用了 classic；否则使用一个简单测试页面
  try {
    await page.goto('http://127.0.0.1:8790/src/face-tracking/index.html', { waitUntil: 'networkidle' });
  } catch (e) { errs.push('nav-fail: ' + e.message); }
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '.automation/artifacts/run-20260620-002/05-classic-avatar.png', fullPage: true });
  expect(errs.length).toBe(0);
});
