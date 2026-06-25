import { test, expect } from '@playwright/test';

// CheapLive 参赛公开 Demo smoke 测试
// 验证：中文默认、英文切换、Avatar 可交互、普通变声入口、AI 变声 App-only 边界

const DEMO_URL = 'http://127.0.0.1:8769/src/contest-demo/dual-device-demo.html';

test('contest demo: 默认中文 + 无 JS error', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  // 默认中文：标题含 "参赛演示 Demo"
  await expect(page.locator('.tag')).toContainText('参赛演示');
  // demo notice 可见
  await expect(page.locator('#noticeText')).toContainText('本公开 Demo');
  expect(errs.length).toBe(0);
});

test('contest demo: English 切换可用', async ({ page }) => {
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  // 点击 English
  await page.click('.lang-btn[data-lang="en"]');
  await page.waitForTimeout(200);
  await expect(page.locator('.tag')).toContainText('Contest Demo');
  await expect(page.locator('#noticeText')).toContainText('public demo');
  // 切回中文
  await page.click('.lang-btn[data-lang="zh"]');
  await page.waitForTimeout(200);
  await expect(page.locator('.tag')).toContainText('参赛演示');
  expect(errs.length).toBe(0);
});

test('contest demo: 默认 Avatar 是萨卡班甲鱼 + 可切换动物', async ({ page }) => {
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  // 默认 chip 显示萨卡班甲鱼
  await expect(page.locator('#chipAvatar')).toContainText('萨卡班甲鱼');
  // avatar grid 至少 4 个按钮
  const avatarBtns = page.locator('.avatar-btn');
  await expect(avatarBtns).toHaveCount(6);
  // 切换到猫
  await page.click('.avatar-btn:has-text("猫")');
  await page.waitForTimeout(200);
  await expect(page.locator('#chipAvatar')).toContainText('猫');
  expect(errs.length).toBe(0);
});

test('contest demo: 表情/动作控制有可见效果', async ({ page }) => {
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  // 先打开 Face Capture 和 Pose Capture
  await page.evaluate(() => {
    document.getElementById('faceCaptureToggle').click();
    document.getElementById('poseCaptureToggle').click();
  });
  await page.waitForTimeout(200);
  // 点击微笑
  await page.click('.ctrl-btn:has-text("微笑")');
  await page.waitForTimeout(200);
  await expect(page.locator('#chipExpr')).toContainText('微笑');
  // 点击摇尾巴
  await page.click('.ctrl-btn:has-text("摇尾巴")');
  await page.waitForTimeout(200);
  await expect(page.locator('#chipAction')).toContainText('摇尾巴');
  expect(errs.length).toBe(0);
});

test('contest demo: 普通变声与 AI 变声文案不同', async ({ page }) => {
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  // 普通变声 badge = 网页 Demo 可用
  await expect(page.locator('.voice-badge.web')).toContainText('网页 Demo');
  // 普通变声描述含"主项目"
  await expect(page.locator('.voice-card:not(.ai) .voice-desc')).toContainText('主项目');
  // AI 变声 badge = 仅真实 App 可用
  await expect(page.locator('.voice-badge.app-only')).toContainText('仅真实 App');
  // AI 变声按钮文案
  await expect(page.locator('#aiVoiceBtn')).toContainText('AI 变声');
  await expect(page.locator('#aiVoiceBtn')).toContainText('仅真实 App');
  expect(errs.length).toBe(0);
});

test('contest demo: 点击 AI 变声只显示 App-only 说明，不假装启用', async ({ page }) => {
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  // 点击 AI 变声按钮
  await page.click('#aiVoiceBtn');
  await page.waitForTimeout(200);
  // 弹窗显示
  await expect(page.locator('#aiModalMask')).toHaveClass(/show/);
  // 弹窗文案含"真实 Android App"
  await expect(page.locator('#aiModalText')).toContainText('真实 Android App');
  // AI 变声状态仍为 App-only
  await expect(page.locator('#aiVoiceStatusText')).toContainText('仅真实 App');
  // 关闭弹窗
  await page.click('#aiModalClose');
  await page.waitForTimeout(200);
  await expect(page.locator('#aiModalMask')).not.toHaveClass(/show/);
  expect(errs.length).toBe(0);
});

test('contest demo: Viewer 远程控制同步到 App', async ({ page }) => {
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  // 先打开 Face Capture
  await page.evaluate(() => {
    document.getElementById('faceCaptureToggle').click();
  });
  await page.waitForTimeout(200);
  // Viewer 端远程触发微笑按钮
  const viewerBtn = page.locator('#viewerState button:has-text("微笑")');
  await viewerBtn.click();
  await page.waitForTimeout(200);
  await expect(page.locator('#chipExpr')).toContainText('微笑');
  // 日志含 "Viewer 远程触发表情"
  await expect(page.locator('#logList')).toContainText('Viewer');
  expect(errs.length).toBe(0);
});

test('contest demo: 普通变声 preset 存在', async ({ page }) => {
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  // web preset 按钮至少 5 个
  const webPresets = page.locator('#webPresetRow .preset-btn');
  await expect(webPresets).toHaveCount(5);
  // 含"原声"
  await expect(page.locator('#webPresetRow')).toContainText('原声');
  // AI preset 按钮全部 disabled
  const aiPresets = page.locator('#aiPresetRow .preset-btn');
  const count = await aiPresets.count();
  for (let i = 0; i < count; i++) {
    await expect(aiPresets.nth(i)).toBeDisabled();
  }
  expect(errs.length).toBe(0);
});
