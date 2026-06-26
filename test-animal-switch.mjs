import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8769/src/contest-demo/dual-device-demo.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 检查初始状态
  const initial = await page.evaluate(() => window.state?.avatar);
  console.log('Initial avatar:', initial);

  // 点击猫按钮
  await page.locator('.avatar-btn:has-text("猫")').click();
  await page.waitForTimeout(500);

  // 检查切换后状态
  const afterCat = await page.evaluate(() => window.state?.avatar);
  console.log('After clicking cat:', afterCat);

  // 截图
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/after-cat-click.png' });
  console.log('Screenshot saved');

  // 点击萨卡班甲鱼
  await page.locator('.avatar-btn:has-text("萨卡")').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/after-saca-click.png' });
  console.log('After saca click saved');

  await browser.close();
})();
