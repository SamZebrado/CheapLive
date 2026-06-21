import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
const page = await context.newPage();

await page.goto('http://localhost:8000', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

const dir = 'artifacts/gourd-fix-verification';
fs.mkdirSync(dir, { recursive: true });

const testCases = [
  { name: 'front', yaw: 0, pitch: 0, label: '正面' },
  { name: 'side-60', yaw: 60, pitch: 0, label: '侧视60°' },
  { name: 'side-90', yaw: 90, pitch: 0, label: '侧视90°' },
  { name: 'up45-yaw30', yaw: 30, pitch: 45, label: '抬45°+右转30°' },
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
    console.log(`[${tc.label}] ✅ 已保存`);
  } else {
    console.log(`[${tc.label}] ❌ canvas 不存在`);
  }
}

await browser.close();
console.log(`\n截图保存在 ${dir}/`);
