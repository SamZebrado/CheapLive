// 综合诊断：确认三个问题（眼睛旋转/侧视图/鼻孔位置）
import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 900, height: 700 } });
const page = await context.newPage();

await page.goto('http://localhost:8000', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);

// 分析身体曲线：打印 radiusScale 在多个 s 值处的 rx/ry
const bodyProfile = await page.evaluate(() => {
  // 直接在页面中执行：获取 mesh 参数
  const mesh = window.faceTracker.avatar.spindleMesh;
  const hx = mesh.headX, hy = mesh.headY;

  // 复制 radiusScale 函数（简化版），然后计算曲线
  const HEAD_T_END = 0.22;
  const MID_T = 0.55;
  const smoothstep01 = (t) => { t = Math.max(0, Math.min(1, t)); return t*t*(3-2*t); };
  const radiusScale = (s) => {
    if (s <= HEAD_T_END) {
      const u = s / HEAD_T_END;
      const v = 1 - u;
      return Math.sqrt(Math.max(0, 1 - v * v));
    }
    if (s <= MID_T) {
      const u = (s - HEAD_T_END) / (MID_T - HEAD_T_END);
      return 1.0 * (1 - smoothstep01(u)) + 0.72 * smoothstep01(u);
    }
    const u = (s - MID_T) / (1 - MID_T);
    return 0.72 * (1 - smoothstep01(u)) + 0.04 * smoothstep01(u);
  };

  const samples = [];
  for (let s = 0; s <= 1.001; s += 0.05) {
    const sc = radiusScale(s);
    const rx = hx * sc;
    const ry = hy * sc * (0.88 + 0.12 * sc);
    samples.push({ s: s.toFixed(2), sc: sc.toFixed(3), rx: rx.toFixed(1), ry: ry.toFixed(1), rx_ry_ratio: (rx/ry).toFixed(2) });
  }
  return { samples, hx, hy };
});

console.log(`身体网格参数: headX=${bodyProfile.hx}, headY=${bodyProfile.hy}`);
console.log('\n身体沿主轴的半径曲线（侧视图关注 ry 列）:');
console.log('s     | sc    | rx     | ry     | rx/ry');
console.log('------|-------|--------|--------|------');
for (const s of bodyProfile.samples) {
  console.log(`${s.s} | ${s.sc} | ${s.rx} | ${s.ry} | ${s.rx_ry_ratio}`);
}

// === 测试 1：yaw=pitch=0 正面视图（看鼻孔位置） ===
// === 测试 2：yaw=0, pitch 变化（检查侧脸的高度是否平滑） ===
// === 测试 3：yaw=45, pitch=30（最经典的眼睛横过来问题） ===
const testCases = [
  { name: '01-front-view', yaw: 0, pitch: 0, roll: 0 },
  { name: '02-side-yaw60', yaw: 60, pitch: 0, roll: 0 },
  { name: '03-side-yaw90', yaw: 90, pitch: 0, roll: 0 },
  { name: '04-pitch-down', yaw: 0, pitch: 30, roll: 0 },
  { name: '05-yaw45-pitch30', yaw: 45, pitch: 30, roll: 0 },
  { name: '06-yaw60-pitch30', yaw: 60, pitch: 30, roll: 0 },
];

const dir = 'artifacts/three-issue-diagnosis';
fs.mkdirSync(dir, { recursive: true });

for (let i = 0; i < testCases.length; i++) {
  const tc = testCases[i];
  const result = await page.evaluate((tc) => {
    const ft = window.faceTracker;
    const avatar = ft.avatar;
    const mesh = avatar.spindleMesh;

    // 计算头部 yaw/pitch 参数：0.5 居中，向外扩张
    // headYaw: 0.5 对应 0°；公式 (val - 0.5) * 120
    // 所以要得到 tc.yaw 度，需要 val = tc.yaw/120 + 0.5
    const nyaw = tc.yaw / 120 + 0.5;
    const npitch = tc.pitch / 120 + 0.5;

    // 把参数设到 avatar 上并重绘
    avatar.params = {
      eyeLeft: 1, eyeRight: 1,
      headYaw: nyaw, headPitch: npitch, headRoll: 0.5,
      headX: 0.5, headY: 0.5,
      mouthOpen: 0, mouthSmile: 0,
    };

    const canvas = document.querySelector('canvas');
    if (canvas && avatar.draw) avatar.draw(canvas.getContext('2d'));

    // 同时计算眼睛/鼻孔的锚点位置
    const hx = mesh.headX, hy = mesh.headY;
    const eyeSpacing = hx * 0.31;
    const eyeHeight = -hy * 0.15;
    const nostrilHoriz = hx * 0.08;
    const nostrilVert = -hy * 0.55;
    const mouthHeight = hy * 0.30;

    return {
      eyeY_on_screen: eyeHeight,
      nostrilY_on_screen: nostrilVert,
      mouthY_on_screen: mouthHeight,
      midLineY: 0, // 灰白分界线 = y=0 (从头部中心看)
      hx, hy,
    };
  }, tc);

  // 截图
  await page.screenshot({
    path: `${dir}/${tc.name}.png`,
    clip: { x: 150, y: 80, width: 600, height: 500 }
  });

  console.log(`\n[${tc.name}] yaw=${tc.yaw}°, pitch=${tc.pitch}°`);
  console.log(`  眼睛高度: ${result.eyeY_on_screen.toFixed(1)} (相对中心, 负=上)`);
  console.log(`  鼻孔高度: ${result.nostrilY_on_screen.toFixed(1)} (相对中心, 负=上)`);
  console.log(`  嘴高度: ${result.mouthY_on_screen.toFixed(1)} (相对中心, 正=下)`);
  console.log(`  灰白分界线 (y=0): 0.0`);
  console.log(`  鼻孔与眼睛距离: ${Math.abs(result.nostrilY_on_screen - result.eyeY_on_screen).toFixed(1)}`);
  console.log(`  鼻孔与分界线距离: ${Math.abs(result.nostrilY_on_screen).toFixed(1)}`);
}

await browser.close();
console.log('\n诊断完成。截图保存在 artifacts/three-issue-diagnosis/');
