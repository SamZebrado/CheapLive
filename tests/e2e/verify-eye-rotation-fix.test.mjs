import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const page = await context.newPage();

await page.goto('http://localhost:8000', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

// 测试 yaw+pitch 组合
const testCases = [
  { yaw: 0, pitch: 0, label: 'yaw0-pitch0' },
  { yaw: 0, pitch: 30, label: 'yaw0-pitch30' },
  { yaw: 30, pitch: 0, label: 'yaw30-pitch0' },
  { yaw: 30, pitch: 30, label: 'yaw30-pitch30' },
  { yaw: 45, pitch: 15, label: 'yaw45-pitch15' },
  { yaw: 45, pitch: 30, label: 'yaw45-pitch30' },
  { yaw: 60, pitch: 30, label: 'yaw60-pitch30' },
  { yaw: -30, pitch: 30, label: 'yaw-30-pitch30' },
  { yaw: -45, pitch: 30, label: 'yaw-45-pitch30' },
];

const dir = './artifacts/rotation-fix-verification';
fs.mkdirSync(dir, { recursive: true });

// 记录每个测试点的 rightVec 信息
const diagnosticResults = await page.evaluate((testCases) => {
  const results = {};
  const avatar = window.faceTracker.avatar;

  // 测试 rightVec 的屏幕方向
  for (const tc of testCases) {
    const rot = { angleY: tc.yaw, angleX: tc.pitch, angleZ: 0 };

    // 在 avatar 上临时设置一个锚点来测试
    // 使用 computeSphereFaceAnchorXYZ 的简化版本
    // 实际上直接调用 _transformVec 来测试 rightVec 的方向
    const localRightX = 0.95, localRightY = 0, localRightZ = 0.3;
    const r = avatar._transformVec(localRightX, localRightY, localRightZ, rot);
    const angleOnScreen = Math.atan2(r.y, r.x) * 180 / Math.PI;

    results[tc.label] = {
      rightVec: { x: r.x.toFixed(3), y: r.y.toFixed(3), z: r.z.toFixed(3) },
      angleOnScreen: angleOnScreen.toFixed(1),
      magnitude: Math.sqrt(r.x*r.x + r.y*r.y + r.z*r.z).toFixed(3),
    };
  }
  return results;
}, testCases);

console.log('=== yaw+pitch 组合下 rightVec 屏幕方向 ===');
console.log('测试标签 | rightVec(x,y,z) | 屏幕角度 | 幅度');
console.log('---------|-----------------|----------|------');
for (const tc of testCases) {
  const r = diagnosticResults[tc.label];
  console.log(`${tc.label.padEnd(18)} | (${r.rightVec.x}, ${r.rightVec.y}, ${r.rightVec.z}) | ${r.angleOnScreen.padStart(6)}° | ${r.magnitude}`);
}

// 渲染截图：手动为每个测试点设置 avatar 参数并截图
for (let i = 0; i < testCases.length; i++) {
  const tc = testCases[i];
  await page.evaluate((testCase) => {
    // 手动设置参数并触发重绘
    const ft = window.faceTracker;
    const avatar = ft.avatar;
    avatar.params = avatar.params || {};
    avatar.params.headYaw = (testCase.yaw / 120 + 0.5);
    avatar.params.headPitch = (testCase.pitch / 90 + 0.5);
    const canvas = document.querySelector('canvas');
    if (canvas && avatar.draw) avatar.draw(canvas.getContext('2d'));
  }, tc);

  // 等待一帧
  await page.waitForTimeout(100);

  // 截图
  await page.screenshot({
    path: `${dir}/${(i+1).toString().padStart(2, '0')}-${tc.label}.png`,
    clip: { x: 200, y: 100, width: 800, height: 600 }
  });
  console.log(`已保存: ${dir}/${(i+1).toString().padStart(2, '0')}-${tc.label}.png`);
}

await browser.close();
console.log('\n验证完成！');
