import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const OUT = process.argv[2] || '/tmp/vs';
mkdirSync(`${OUT}/public`, { recursive: true });
mkdirSync(`${OUT}/logs`, { recursive: true });

const DEMO_URL = 'http://127.0.0.1:8769/src/contest-demo/dual-device-demo.html?test=1';

const animals = [
    { id: 'sacabambaspis', label: '萨卡班甲鱼' },
    { id: 'cat', label: '猫' },
    { id: 'dog', label: '狗' },
    { id: 'rabbit', label: '兔子' },
    { id: 'fox', label: '狐狸' },
    { id: 'bear', label: '小熊' },
  ];

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));

  console.log('=== Public Demo Visual Selfcheck v5 ===\n');

  await page.goto(DEMO_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const hookAvailable = await page.evaluate(() => typeof window.__cheapLiveTest !== 'undefined');
  console.log('Test hook available:', hookAvailable);

  async function snap(name) {
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/public/${name}.png` });
    console.log(`  saved: ${name}.png`);
  }

  // ===== 1. Animal neutral screenshots =====
  console.log('1. Animal neutral screenshots...');
  for (const a of animals) {
    await page.locator(`.avatar-btn:has-text("${a.label}")`).click();
    await page.waitForTimeout(800);
    await snap(`01-${a.id}-neutral`);
  }

  // ===== 2. Face states (cat) =====
  console.log('\n2. Face states (cat)...');
  await page.locator('.avatar-btn:has-text("猫")').click();
  await page.waitForTimeout(500);

  // Neutral baseline: reset face first, wait, then snapshot
  await page.evaluate(() => window.__cheapLiveTest?.resetFace());
  await page.waitForTimeout(700);
  const neutralSt = await page.evaluate(() => window.__cheapLiveTest?.getState());
  console.log(`  neutral: eyeOpen=${neutralSt?.animTargets?.eyeOpen?.toFixed(3)} lookX=${neutralSt?.animTargets?.lookX?.toFixed(3)}`);
  await snap('10-neutral');

  const faceTests = ['blink', 'halfblink', 'mouth', 'smile', 'look_left', 'look_right', 'look_up', 'brow_raise', 'head_left', 'head_right'];
  for (const f of faceTests) {
    // reset first, then set, then immediately snap (before reset clears it)
    await page.evaluate(() => window.__cheapLiveTest?.resetFace());
    await page.waitForTimeout(300);
    await page.evaluate((ff) => window.__cheapLiveTest?.setFace(ff), f);
    await page.waitForTimeout(800);
    const st = await page.evaluate(() => window.__cheapLiveTest?.getState());
    console.log(`  ${f}: eyeOpen=${st?.animTargets?.eyeOpen?.toFixed(3)} lookX=${st?.animTargets?.lookX?.toFixed(3)} lookY=${st?.animTargets?.lookY?.toFixed(3)} headTilt=${st?.animTargets?.headTilt?.toFixed(3)}`);
    await page.screenshot({ path: `${OUT}/public/10-${f}.png` });
    console.log(`  saved: 10-${f}.png`);
  }

  // ===== 3. Pose states (cat) =====
  console.log('\n3. Pose states (cat)...');
  await page.evaluate(() => window.__cheapLiveTest?.resetPose());
  await page.waitForTimeout(700);
  await snap('20-idle');

  const poseTests = ['paw_left', 'paw_right', 'lean_left', 'lean_right', 'crouch', 'jump', 'tail_wag', 'bounce'];
  for (const p of poseTests) {
    await page.evaluate(() => window.__cheapLiveTest?.resetPose());
    await page.waitForTimeout(300);
    await page.evaluate((pp) => window.__cheapLiveTest?.setPose(pp), p);
    await page.waitForTimeout(800);
    const st = await page.evaluate(() => window.__cheapLiveTest?.getState());
    console.log(`  ${p}: pawLeft=${st?.animTargets?.pawLeft?.toFixed(3)} bodyLean=${st?.animTargets?.bodyLean?.toFixed(3)} bodyCrouch=${st?.animTargets?.bodyCrouch?.toFixed(3)} bounceY=${st?.animTargets?.bounceY?.toFixed(3)} tailWag=${st?.animTargets?.tailWag?.toFixed(3)}`);
    await page.screenshot({ path: `${OUT}/public/20-${p}.png` });
    console.log(`  saved: 20-${p}.png`);
  }

  // ===== 4. Combo =====
  console.log('\n4. Combo states...');
  await page.evaluate(() => { window.__cheapLiveTest?.resetFace(); window.__cheapLiveTest?.resetPose(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { window.__cheapLiveTest?.setFace('smile'); window.__cheapLiveTest?.setPose('paw_left'); });
  await page.waitForTimeout(800);
  await snap('30-combo-cat-smile-paw-left');

  await page.locator('.avatar-btn:has-text("狗")').click();
  await page.waitForTimeout(500);
  await page.evaluate(() => { window.__cheapLiveTest?.resetFace(); window.__cheapLiveTest?.resetPose(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { window.__cheapLiveTest?.setFace('mouth'); window.__cheapLiveTest?.setPose('lean_left'); });
  await page.waitForTimeout(800);
  await snap('31-combo-dog-mouth-lean-left');

  // ===== 5. Toggle states =====
  console.log('\n5. Toggle states...');
  await page.evaluate(() => {
    const fc = document.getElementById('faceCaptureToggle');
    const pc = document.getElementById('poseCaptureToggle');
    if (fc?.checked) fc.click();
    if (pc?.checked) pc.click();
  });
  await page.waitForTimeout(300);
  await snap('40-toggles-off');

  await page.evaluate(() => {
    const fc = document.getElementById('faceCaptureToggle');
    const pc = document.getElementById('poseCaptureToggle');
    if (fc) fc.click();
    if (pc) pc.click();
  });
  await page.waitForTimeout(300);
  await snap('41-toggles-on');

  // ===== 6. Voice + notice =====
  console.log('\n6. Voice module...');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  await snap('42-voice-module');

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await snap('43-source-notice');

  console.log('\n=== JS Errors ===');
  console.log('Total:', errs.length);
  errs.slice(0, 10).forEach(e => console.log('  -', e.substring(0, 120)));

  const fs = await import('fs');
  fs.writeFileSync(`${OUT}/logs/browser-console.log`, errs.join('\n'));

  await browser.close();
  console.log('\n=== Done ===');
  const files = fs.readdirSync(`${OUT}/public`).filter(f => f.endsWith('.png'));
  console.log('Screenshots:', files.length);
})();
