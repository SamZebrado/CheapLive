/**
 * 完整视觉验证：不同旋转角度 + 不同表情的截图
 * 供 GPT 审阅用
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = './artifacts/visual-review-gpt';
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 900, height: 700 }
});
const page = await context.newPage();

// 1. 先打开页面让内容加载
console.log('正在加载页面...');
await page.goto('http://localhost:8000', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);

// 2. 捕获 7 个不同 yaw 角度
const yawAngles = [0, 15, 30, 45, 60, -30, -60];
for (const yaw of yawAngles) {
  const headYaw = 0.5 + (yaw / 120);
  await page.evaluate((val) => {
    const ft = window._faceTracker;
    if (ft && ft.avatar) ft.avatar.updateParams({ headYaw: val });
  }, headYaw);
  await page.waitForTimeout(500);

  const filename = `spindle-whale-yaw${yaw}.png`;
  await page.screenshot({ path: path.join(OUTPUT_DIR, filename) });
  console.log(`  [yaw=${yaw}°] ${filename}`);
}

// 3. 捕获不同 pitch 角度（抬头/低头）
const pitchAngles = [0, 20, -20, 45, -45];
for (const pitch of pitchAngles) {
  const headPitch = 0.5 + (pitch / 120);
  await page.evaluate((val) => {
    const ft = window._faceTracker;
    if (ft && ft.avatar) ft.avatar.updateParams({ headYaw: 0.5, headPitch: val });
  }, headPitch);
  await page.waitForTimeout(500);

  const filename = `spindle-whale-pitch${pitch}.png`;
  await page.screenshot({ path: path.join(OUTPUT_DIR, filename) });
  console.log(`  [pitch=${pitch}°] ${filename}`);
}

// 4. 恢复正面，检查表情：眨眼/张嘴
await page.evaluate(() => {
  const ft = window._faceTracker;
  if (ft && ft.avatar) ft.avatar.updateParams({ headYaw: 0.5, headPitch: 0.5, eyeLeft: 0, eyeRight: 0 });
});
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(OUTPUT_DIR, 'spindle-whale-eyes-closed.png') });
console.log('  [闭眼] spindle-whale-eyes-closed.png');

await page.evaluate(() => {
  const ft = window._faceTracker;
  if (ft && ft.avatar) ft.avatar.updateParams({ eyeLeft: 1, eyeRight: 1, mouthOpen: 1 });
});
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(OUTPUT_DIR, 'spindle-whale-mouth-open.png') });
console.log('  [张嘴] spindle-whale-mouth-open.png');

await page.evaluate(() => {
  const ft = window._faceTracker;
  if (ft && ft.avatar) ft.avatar.updateParams({ mouthOpen: 0, mouthSmile: 1 });
});
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(OUTPUT_DIR, 'spindle-whale-smile.png') });
console.log('  [微笑] spindle-whale-smile.png');

// 5. 检查球形头像（确保没有被我们的修改破坏）
await page.evaluate(() => {
  const ft = window._faceTracker;
  if (ft && ft.avatar) {
    // 尝试切到 sphere
    if (ft.avatar.setAvatar) ft.avatar.setAvatar('mesh-sphere');
    ft.avatar.updateParams({ headYaw: 0.5, headPitch: 0.5 });
  }
});
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUTPUT_DIR, 'sphere-front.png') });
console.log('  [球体正面] sphere-front.png');

// 球体侧视图
await page.evaluate(() => {
  const ft = window._faceTracker;
  if (ft && ft.avatar) ft.avatar.updateParams({ headYaw: 0.5 + 45/120 });
});
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(OUTPUT_DIR, 'sphere-yaw-45.png') });
console.log('  [球体右转45°] sphere-yaw-45.png');

await browser.close();

console.log(`\n✅ 视觉截图已保存到: ${OUTPUT_DIR}`);
console.log(`   共生成 ${fs.readdirSync(OUTPUT_DIR).length} 张截图`);
