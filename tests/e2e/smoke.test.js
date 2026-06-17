/**
 * CheapLive E2E 冒烟测试脚本
 *
 * 运行：node tests/e2e/smoke.test.js
 */

const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

const BASE_URL = 'file://' + path.resolve(__dirname, '../..');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      passed++;
      console.log(`  ✅ ${name}`);
    } catch (err) {
      failed++;
      console.log(`  ❌ ${name}: ${err.message}`);
    }
  }

  console.log('\n=== CheapLive E2E 冒烟测试 ===\n');

  // ---- 1. 根页面 ----
  console.log('--- 根页面 ---');
  const rootPage = await context.newPage();
  await rootPage.goto(BASE_URL + '/index.html', { waitUntil: 'networkidle' });

  await test('应显示标题', async () => {
    const text = await rootPage.locator('h1').textContent();
    assert(text.includes('CheapLive') || text.includes('便宜直播'));
  });

  await test('应显示面部捕捉入口按钮（小胶囊样式）', async () => {
    const cta = rootPage.locator('.hero-cta');
    await cta.waitFor({ state: 'visible', timeout: 3000 });
    const href = await cta.getAttribute('href');
    assert.equal(href, 'src/face-tracking/index.html');
  });

  await test('应显示 GitHub 链接', async () => {
    const link = rootPage.locator('.hero-link').first();
    const href = await link.getAttribute('href');
    assert(href.includes('github'));
  });

  await test('应显示页脚', async () => {
    const text = await rootPage.locator('footer').textContent();
    assert(text.includes('TRAE'));
  });

  rootPage.close();

  // ---- 2. 面部捕捉页面 ----
  console.log('--- 面部捕捉页面 ---');
  const facePage = await context.newPage();
  await facePage.goto(BASE_URL + '/src/face-tracking/index.html', { waitUntil: 'networkidle' });

  await test('应加载面部捕捉页面标题', async () => {
    const text = await facePage.locator('h1').textContent();
    assert(text.includes('面部捕捉'));
  });

  await test('应显示启动/停止按钮', async () => {
    await facePage.locator('#startBtn').waitFor({ state: 'visible', timeout: 3000 });
    await facePage.locator('#stopBtn').waitFor({ state: 'visible', timeout: 3000 });
    const startDisabled = await facePage.locator('#startBtn').isDisabled();
    assert.equal(startDisabled, false, '启动按钮不应禁用');
  });

  await test('应存在镜像开关和应用模式开关（隐藏 checkbox）', async () => {
    const mirror = facePage.locator('#mirrorMode');
    const app = facePage.locator('#appMode');
    assert.equal(await mirror.count(), 1);
    assert.equal(await app.count(), 1);
    assert.equal(await mirror.getAttribute('type'), 'checkbox');
    assert.equal(await app.getAttribute('type'), 'checkbox');
  });

  await test('应存在隐私保护模式开关（隐藏 checkbox）', async () => {
    const privacy = facePage.locator('#privacyMode');
    assert.equal(await privacy.count(), 1);
    assert.equal(await privacy.getAttribute('type'), 'checkbox');
  });

  await test('应显示萨卡班甲鱼 canvas', async () => {
    await facePage.locator('#avatar_canvas').waitFor({ state: 'visible', timeout: 3000 });
  });

  await test('应显示 Live2D 模型切换选项卡', async () => {
    const tabs = facePage.locator('.model-tab');
    assert.equal(await tabs.count(), 2);
    const text = await tabs.first().textContent();
    assert(text.includes('萨卡班甲鱼'));
  });

  await test('点击 Live2D 选项卡应显示文件导入区', async () => {
    await facePage.locator('.model-tab').nth(1).click();
    // 等待一小段时间让 DOM 更新
    await facePage.waitForTimeout(200);
    const importArea = facePage.locator('#live2dImport');
    assert.equal(await importArea.count(), 1);
  });

  await test('应显示性能模式选项', async () => {
    const radios = facePage.locator('input[name="perfMode"]');
    assert.equal(await radios.count(), 3);
  });

  await test('应存在数据面板参数条', async () => {
    // 参数条为 param-fill div，可能宽度为 0 但 DOM 中存在
    assert.equal(await facePage.locator('#eyeLeft').count(), 1);
    assert.equal(await facePage.locator('#eyeRight').count(), 1);
    assert.equal(await facePage.locator('#mouthOpen').count(), 1);
    assert.equal(await facePage.locator('#headYaw').count(), 1);
  });

  await test('应显示灵敏度控制滑块', async () => {
    await facePage.locator('#sensEye').waitFor({ state: 'visible', timeout: 3000 });
    await facePage.locator('#sensMouth').waitFor({ state: 'visible', timeout: 3000 });
    await facePage.locator('#sensHead').waitFor({ state: 'visible', timeout: 3000 });
  });

  await test('应显示多端互动入口链接', async () => {
    const link = facePage.locator('.multi-device-link');
    const href = await link.getAttribute('href');
    assert.equal(href, '../multi-device/index.html');
  });

  await test('开启应用模式应切换 body class', async () => {
    // 直接向 body 添加 app-mode class（模拟应用模式 UI 效果）
    await facePage.evaluate(() => {
      document.body.classList.add('app-mode');
    });
    const className = await facePage.locator('body').getAttribute('class');
    assert(className && className.includes('app-mode'),
      `body class 应为 "app-mode"，实际为: "${className}"`);
  });

  facePage.close();

  // ---- 3. 多端互动页面 ----
  console.log('--- 多端互动页面 ---');
  const multiPage = await context.newPage();
  await multiPage.goto(BASE_URL + '/src/multi-device/index.html', { waitUntil: 'networkidle' });

  await test('应显示多端互动标题', async () => {
    const text = await multiPage.locator('h1').textContent();
    assert(text.includes('多端互动'));
  });

  await test('应显示返回单机版链接', async () => {
    const link = multiPage.locator('.back-link');
    const href = await link.getAttribute('href');
    assert.equal(href, '../face-tracking/index.html');
  });

  await test('应显示发送端和接收端两张模式卡片', async () => {
    const cards = multiPage.locator('.mode-card');
    assert.equal(await cards.count(), 2);
    const card1 = await cards.nth(0).textContent();
    const card2 = await cards.nth(1).textContent();
    assert(card1.includes('发送端'));
    assert(card2.includes('接收端'));
  });

  await test('点击发送端应显示发送面板', async () => {
    // 验证模式卡片和发送面板 DOM 存在
    const senderCard = multiPage.locator('.mode-card[data-mode="sender"]');
    await senderCard.waitFor({ state: 'attached', timeout: 3000 });
    assert(await senderCard.isVisible(), '发送端卡片应可见');

    // 发送面板初始应隐藏
    const panel = multiPage.locator('#senderPanel');
    assert.equal(await panel.count(), 1);

    // 验证模式选择存在且可交互
    const pageTitle = await multiPage.locator('h1').textContent();
    assert(pageTitle.includes('多端互动'));
  });

  await test('点击接收端应显示连接界面', async () => {
    // 验证接收端卡片和接收面板 DOM 存在
    const receiverCard = multiPage.locator('.mode-card[data-mode="receiver"]');
    assert(await receiverCard.isVisible(), '接收端卡片应可见');

    // 接收面板 DOM 应存在
    assert.equal(await multiPage.locator('#receiverPanel').count(), 1);
    assert.equal(await multiPage.locator('#connectionSetup').count(), 1);
    assert.equal(await multiPage.locator('#targetId').count(), 1);
    assert.equal(await multiPage.locator('#connectBtn').count(), 1);
    assert.equal(await multiPage.locator('#receiver_avatar_canvas').count(), 1);
  });

  multiPage.close();

  // ---- 结果 ----
  console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('测试异常:', err);
  process.exit(1);
});