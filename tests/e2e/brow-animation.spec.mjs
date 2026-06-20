import { test, expect } from '@playwright/test';

// 验证萨卡班甲鱼：默认正面
test('spindle whale: default front', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8792/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: '.automation/artifacts/run-20260620-004/01-spindle-front.png', fullPage: true });
  expect(errs.length).toBe(0);
});

// 验证眉毛抬升：browLeft=1, browRight=1
test('spindle whale: brow raise animation', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8792/src/face-tracking/test-spindle.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  // 设置眉毛参数为最大抬升
  await page.evaluate(() => {
    if (window.avatar) {
      window.avatar.updateParams({ browLeft: 1, browRight: 1 });
    }
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '.automation/artifacts/run-20260620-004/02-spindle-brow-raised.png', fullPage: true });
  expect(errs.length).toBe(0);
});

// 验证球体：默认正面
test('sphere: default front', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8792/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: '.automation/artifacts/run-20260620-004/03-sphere-front.png', fullPage: true });
  expect(errs.length).toBe(0);
});

// 验证球体眉毛抬升：browLeft=1, browRight=1
test('sphere: brow raise animation', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8792/src/face-tracking/test-sphere.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  // 设置眉毛参数为最大抬升
  await page.evaluate(() => {
    if (window.avatar) {
      window.avatar.updateParams({ browLeft: 1, browRight: 1 });
    }
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '.automation/artifacts/run-20260620-004/04-sphere-brow-raised.png', fullPage: true });
  expect(errs.length).toBe(0);
});