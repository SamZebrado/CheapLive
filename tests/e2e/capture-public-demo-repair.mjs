import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';

const DEMO_URL = 'http://127.0.0.1:8790/src/contest-demo/dual-device-demo.html';
const OUT = '/tmp/cheaplive-public-demo-repair';
mkdirSync(OUT, { recursive: true });

const consoleErrors = [];
const consoleLogs = [];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  
  page.on('console', m => {
    if (m.type() === 'error') consoleErrors.push(m.text());
    consoleLogs.push(`[${m.type()}] ${m.text()}`);
  });
  page.on('pageerror', e => consoleErrors.push(e.message));
  
  await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  async function snap(name) {
    await page.waitForTimeout(300);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${OUT}/${name}.png`, clip: { x: 0, y: 0, width: 1280, height: 650 } });
    console.log(`  saved: ${name}.png`);
  }

  const controls = page.locator('.controls');

  console.log('Generating screenshots...');

  // 01 default
  await snap('01-default-saca');

  // turn on face + pose capture
  await page.evaluate(() => {
    const faceToggle = document.getElementById('faceCaptureToggle');
    const poseToggle = document.getElementById('poseCaptureToggle');
    faceToggle.checked = true;
    poseToggle.checked = true;
    faceToggle.dispatchEvent(new Event('change', { bubbles: true }));
    poseToggle.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(300);

  // 02 cat paw_left + smile
  await controls.locator('.avatar-btn:has-text("猫")').click();
  await page.waitForTimeout(250);
  await controls.locator('.action-grid .ctrl-btn:has-text("抬左爪")').click();
  await page.waitForTimeout(150);
  await controls.locator('.expr-grid .ctrl-btn:has-text("微笑")').click();
  await snap('02-cat-paw-left-smile');

  // 03 dog mouth open + lean left
  await controls.locator('.avatar-btn:has-text("狗")').click();
  await page.waitForTimeout(250);
  await controls.locator('.expr-grid .ctrl-btn:has-text("张嘴")').click();
  await page.waitForTimeout(150);
  await controls.locator('.action-grid .ctrl-btn:has-text("左倾")').click();
  await snap('03-dog-mouth-open-lean-left');

  // 04 rabbit crouch + look up
  await controls.locator('.avatar-btn:has-text("兔子")').click();
  await page.waitForTimeout(250);
  await controls.locator('.action-grid .ctrl-btn:has-text("蹲下")').click();
  await page.waitForTimeout(150);
  await controls.locator('.expr-grid .ctrl-btn:has-text("向上看")').click();
  await snap('04-rabbit-crouch-look-up');

  // 05 fox tail wag + look left
  await controls.locator('.avatar-btn:has-text("狐狸")').click();
  await page.waitForTimeout(250);
  await controls.locator('.action-grid .ctrl-btn:has-text("摇尾巴")').click();
  await page.waitForTimeout(150);
  await controls.locator('.expr-grid .ctrl-btn:has-text("向左看")').click();
  await snap('05-fox-tail-wag-look-left');

  // 06 bear bounce + brow raise
  await controls.locator('.avatar-btn:has-text("小熊")').click();
  await page.waitForTimeout(250);
  await controls.locator('.action-grid .ctrl-btn:has-text("弹跳")').click();
  await page.waitForTimeout(150);
  await controls.locator('.expr-grid .ctrl-btn:has-text("挑眉")').click();
  await snap('06-bear-bounce-brow-raise');

  // 07 sacabambaspis mouth open
  await controls.locator('.avatar-btn:has-text("萨卡班甲鱼")').click();
  await page.waitForTimeout(250);
  await controls.locator('.expr-grid .ctrl-btn:has-text("张嘴")').click();
  await snap('07-sacabambaspis-mouth-open');

  // 08 look comparisons (cat)
  await controls.locator('.avatar-btn:has-text("猫")').click();
  await page.waitForTimeout(250);
  await controls.locator('.expr-grid .ctrl-btn:has-text("向左看")').click();
  await page.waitForTimeout(300);
  await snap('08a-look-left');
  await controls.locator('.expr-grid .ctrl-btn:has-text("向右看")').click();
  await page.waitForTimeout(300);
  await snap('08b-look-right');
  await controls.locator('.expr-grid .ctrl-btn:has-text("向上看")').click();
  await page.waitForTimeout(300);
  await snap('08c-look-up');

  // 09 head comparisons
  await controls.locator('.expr-grid .ctrl-btn:has-text("头左转")').click();
  await page.waitForTimeout(300);
  await snap('09a-head-left');
  await controls.locator('.expr-grid .ctrl-btn:has-text("头右转")').click();
  await page.waitForTimeout(300);
  await snap('09b-head-right');

  // 10 toggles on
  await snap('10-face-pose-toggles-on');

  // 11 voice module
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/11-voice-module-state.png`, fullPage: false });
  console.log('  saved: 11-voice-module-state.png');

  // 12 source notice
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await snap('12-source-notice-clean');

  // all animals neutral
  await controls.locator('.avatar-btn:has-text("萨卡班甲鱼")').click();
  await page.waitForTimeout(200);
  await snap('13a-saca-neutral');
  await controls.locator('.avatar-btn:has-text("猫")').click();
  await page.waitForTimeout(200);
  await snap('13b-cat-neutral');
  await controls.locator('.avatar-btn:has-text("狗")').click();
  await page.waitForTimeout(200);
  await snap('13c-dog-neutral');
  await controls.locator('.avatar-btn:has-text("兔子")').click();
  await page.waitForTimeout(200);
  await snap('13d-rabbit-neutral');
  await controls.locator('.avatar-btn:has-text("狐狸")').click();
  await page.waitForTimeout(200);
  await snap('13e-fox-neutral');
  await controls.locator('.avatar-btn:has-text("小熊")').click();
  await page.waitForTimeout(200);
  await snap('13f-bear-neutral');

  // Save logs
  writeFileSync(`${OUT}/browser-console.log`, consoleLogs.join('\n'));
  writeFileSync(`${OUT}/js-errors.log`, consoleErrors.join('\n'));
  
  console.log(`\nDone. Screenshots saved to ${OUT}`);
  console.log(`JS errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    consoleErrors.forEach(e => console.log(`  - ${e}`));
  }

  await browser.close();
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
