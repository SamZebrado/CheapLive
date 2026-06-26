import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const OUT = '/tmp/vs-pose-check';
mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto('http://127.0.0.1:8769/src/contest-demo/dual-device-demo.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  async function snap(name) {
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${name}.png` });
  }

  // 1. 切换到猫
  console.log('1. Switching to cat...');
  await page.locator('.avatar-btn:has-text("猫")').click();
  await page.waitForTimeout(500);
  await snap('01-cat-neutral');

  // 2. 打开 Pose Capture
  console.log('2. Opening Pose Capture...');
  await page.evaluate(() => {
    document.getElementById('poseCaptureToggle')?.click();
  });
  await page.waitForTimeout(300);
  await snap('02-cat-pose-on');

  // 3. 点击 idle
  console.log('3. Clicking idle...');
  await page.locator('#actionGrid .ctrl-btn:has-text("待机")').click();
  await page.waitForTimeout(500);
  await snap('03-cat-idle');

  // 4. 点击 paw_left
  console.log('4. Clicking paw_left...');
  await page.locator('#actionGrid .ctrl-btn:has-text("抬左爪")').click();
  await page.waitForTimeout(500);
  await snap('04-cat-paw-left');

  // 5. 点击 lean_left
  console.log('5. Clicking lean_left...');
  await page.locator('#actionGrid .ctrl-btn:has-text("左倾")').click();
  await page.waitForTimeout(500);
  await snap('05-cat-lean-left');

  // 6. 点击 crouch
  console.log('6. Clicking crouch...');
  await page.locator('#actionGrid .ctrl-btn:has-text("蹲下")').click();
  await page.waitForTimeout(500);
  await snap('06-cat-crouch');

  // 7. 点击 tail_wag
  console.log('7. Clicking tail_wag...');
  await page.locator('#actionGrid .ctrl-btn:has-text("摇尾巴")').click();
  await page.waitForTimeout(500);
  await snap('07-cat-tail-wag');

  console.log('\nDone. Screenshots saved to', OUT);
  await browser.close();
})();
