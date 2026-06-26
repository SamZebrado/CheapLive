import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('http://127.0.0.1:8769/src/contest-demo/dual-device-demo.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const info = await page.evaluate(() => {
    const canvas = document.getElementById('avatarCanvas');
    const rect = canvas.getBoundingClientRect();
    return {
      width: canvas.width,
      height: canvas.height,
      cssWidth: rect.width,
      cssHeight: rect.height,
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
    };
  });

  console.log('Canvas info:', JSON.stringify(info, null, 2));

  // 截图看看实际显示
  await page.screenshot({ path: '/tmp/canvas-test.png' });
  console.log('Screenshot saved to /tmp/canvas-test.png');

  await browser.close();
})();
