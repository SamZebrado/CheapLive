import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const OUT = '/tmp/vs-face-check';
mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto('http://127.0.0.1:8769/src/contest-demo/dual-device-demo.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  async function snap(name) {
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${name}.png` });
  }

  // 切换到猫
  await page.locator('.avatar-btn:has-text("猫")').click();
  await page.waitForTimeout(500);

  // 打开 Face Capture
  await page.evaluate(() => {
    document.getElementById('faceCaptureToggle')?.click();
  });
  await page.waitForTimeout(300);

  // neutral
  console.log('Capturing neutral...');
  await page.locator('#exprGrid .ctrl-btn').first().click(); // 点击第一个（可能是眨眼或待机）
  await page.waitForTimeout(500);
  // 重置
  await page.evaluate(() => {
    const chip = document.getElementById('chipExpr');
    if (chip) chip.textContent = '—';
    if (window.state && window.state.animTargets) {
      window.state.animTargets.eyeOpen = 1;
      window.state.animTargets.lookX = 0;
      window.state.animTargets.lookY = 0;
    }
  });
  await page.waitForTimeout(500);
  await snap('01-neutral');

  // blink
  console.log('Capturing blink...');
  await page.locator('#exprGrid .ctrl-btn:has-text("眨眼")').click();
  await page.waitForTimeout(800);
  await snap('02-blink');

  // halfblink
  console.log('Capturing halfblink...');
  await page.locator('#exprGrid .ctrl-btn:has-text("半眯")').click();
  await page.waitForTimeout(800);
  await snap('03-halfblink');

  // mouth
  console.log('Capturing mouth...');
  await page.locator('#exprGrid .ctrl-btn:has-text("张嘴")').click();
  await page.waitForTimeout(800);
  await snap('04-mouth');

  // smile
  console.log('Capturing smile...');
  await page.locator('#exprGrid .ctrl-btn:has-text("微笑")').click();
  await page.waitForTimeout(800);
  await snap('05-smile');

  // look_left
  console.log('Capturing look_left...');
  await page.locator('#exprGrid .ctrl-btn:has-text("左看")').click();
  await page.waitForTimeout(800);
  await snap('06-look-left');

  // look_right
  console.log('Capturing look_right...');
  await page.locator('#exprGrid .ctrl-btn:has-text("右看")').click();
  await page.waitForTimeout(800);
  await snap('07-look-right');

  // look_up
  console.log('Capturing look_up...');
  await page.locator('#exprGrid .ctrl-btn:has-text("上看")').click();
  await page.waitForTimeout(800);
  await snap('08-look-up');

  // head_left
  console.log('Capturing head_left...');
  await page.locator('#exprGrid .ctrl-btn:has-text("头左")').click();
  await page.waitForTimeout(800);
  await snap('09-head-left');

  // head_right
  console.log('Capturing head_right...');
  await page.locator('#exprGrid .ctrl-btn:has-text("头右")').click();
  await page.waitForTimeout(800);
  await snap('10-head-right');

  console.log('\nDone. Screenshots saved to', OUT);
  await browser.close();
})();
