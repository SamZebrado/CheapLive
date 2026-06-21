import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
const page = await context.newPage();

await page.goto('http://localhost:8000', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

const dir = 'artifacts/nostril-fix-verification';
fs.mkdirSync(dir, { recursive: true });

// 测试正面视角，重点看鼻孔位置
const testCases = [
  { name: 'front', yaw: 0, pitch: 0, label: '正面 - 鼻孔位置' },
  { name: 'slight-up', yaw: 0, pitch: -20, label: '微微抬头 - 鼻孔位置' },
  { name: 'side', yaw: 60, pitch: 0, label: '侧面 - 整体五官' },
];

for (let i = 0; i < testCases.length; i++) {
  const tc = testCases[i];
  const dataUrl = await page.evaluate((tc) => {
    const ft = window.faceTracker;
    if (!ft || !ft.avatar) return null;
    const avatar = ft.avatar;
    avatar.params = {
      eyeLeft: 1, eyeRight: 1,
      headYaw: tc.yaw / 120 + 0.5,
      headPitch: tc.pitch / 90 + 0.5,
      headRoll: 0.5,
      headX: 0.5, headY: 0.5,
      mouthOpen: 0, mouthSmile: 0,
    };
    if (avatar.canvas && avatar.draw) {
      avatar.draw(avatar.canvas.getContext('2d'));
      return avatar.canvas.toDataURL('image/png');
    }
    return null;
  }, tc);

  if (dataUrl) {
    const base64 = dataUrl.split(',')[1];
    const buf = Buffer.from(base64, 'base64');
    fs.writeFileSync(`${dir}/${(i+1).toString().padStart(2, '0')}-${tc.name}.png`, buf);
    console.log(`[${tc.label}] ✅`);
  }
}

// 诊断五官相对位置
const positions = await page.evaluate(() => {
  const mesh = window.faceTracker.avatar.spindleMesh;
  const hx = mesh.headX, hy = mesh.headY;
  return {
    eyebrow: (-hy * 0.48).toFixed(1),
    eye: (-hy * 0.15).toFixed(1),
    nostril: (-hy * 0.08).toFixed(1),  // 新值
    nostril_old: (-hy * 0.55).toFixed(1), // 旧值
    grayWhiteBoundary: 0,
    mouth: (hy * 0.30).toFixed(1),
    hx, hy,
  };
});
console.log('\n五官垂直位置（相对头部中心）:');
console.log(`  眉毛: y=${positions.eyebrow}`);
console.log(`  眼睛: y=${positions.eye}`);
console.log(`  鼻孔（新）: y=${positions.nostril} ← 应在分界线 y=0 附近`);
console.log(`  鼻孔（旧）: y=${positions.nostril_old} ← 太高！`);
console.log(`  灰白分界线: y=${positions.grayWhiteBoundary}`);
console.log(`  嘴巴: y=${positions.mouth}`);

await browser.close();
console.log(`\n截图保存在 ${dir}/`);
