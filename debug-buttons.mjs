import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8769/src/contest-demo/dual-device-demo.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 获取所有 avatar 按钮
  const buttons = await page.locator('.avatar-btn').all();
  console.log('Total avatar buttons:', buttons.length);

  for (const btn of buttons) {
    const text = await btn.textContent();
    const cls = await btn.getAttribute('class');
    console.log(`  - "${text.trim()}" class="${cls}"`);
  }

  // 尝试点击第一个按钮
  console.log('\nClicking first button...');
  await buttons[0].click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/after-click-first.png' });

  // 尝试点击文本包含"猫"的按钮
  console.log('Clicking button with text containing 猫...');
  await page.locator('.avatar-btn:has-text("猫")').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/after-click-cat.png' });

  await browser.close();
})();
