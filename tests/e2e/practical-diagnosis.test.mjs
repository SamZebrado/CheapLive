/**
 * 实用诊断：
 * 1) 检查不同旋转角度下的实际渲染效果和可见面数
 * 2) 检查尾鳍几何参数
 * 3) 生成视觉截图
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = './artifacts/practical-diagnosis';
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 900, height: 700 } });
const page = await context.newPage();

console.log('正在加载页面...');
await page.goto('http://localhost:8000', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);

// 等待 avatar 初始化完成
let attempts = 0;
while (attempts < 10) {
  const hasAvatar = await page.evaluate(() => window.faceTracker && window.faceTracker.avatar);
  if (hasAvatar) break;
  await page.waitForTimeout(500);
  attempts++;
}
console.log('✅ Avatar 初始化完成');

// ===== 1. 运行 mesh 诊断 =====
const result = await page.evaluate(() => {
  const ft = window.faceTracker;
  const out = {};

  // ---- 尾鳍几何检查 ----
  if (ft.avatar.spindleMesh) {
    const mesh = ft.avatar.spindleMesh;
    const cols = mesh.columns;
    const flukeVerts = mesh.vertices.filter(v => v.col >= cols + 1);
    out.spindleMesh = {
      totalVerts: mesh.vertices.length,
      totalFaces: mesh.faces.length,
      flukeVertCount: flukeVerts.length,
    };

    if (flukeVerts.length > 0) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const v of flukeVerts) {
        if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
        if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
        if (v.z < minZ) minZ = v.z; if (v.z > maxZ) maxZ = v.z;
      }
      out.flukeBoundingBox = {
        width: (maxX - minX).toFixed(1),
        height: (maxY - minY).toFixed(1),
        depth: (maxZ - minZ).toFixed(1),
        widthRatio: ((maxX - minX) / (mesh.headX * 2)).toFixed(2),
        heightRatio: ((maxY - minY) / (mesh.headY * 2)).toFixed(2),
      };
    }

    // 统计双面面数
    let doubleSidedCount = 0;
    let triangleCount = 0;
    let quadCount = 0;
    for (const f of mesh.faces) {
      if (f.doubleSided) doubleSidedCount++;
      if (f.indices.length === 3) triangleCount++;
      if (f.indices.length === 4) quadCount++;
    }
    out.faceStats = {
      doubleSidedCount,
      triangleCount,
      quadCount,
      total: mesh.faces.length,
    };
  }

  // ---- 旋转角度下的面部可见性测试 ----
  out.yawTests = {};
  const yawAngles = [0, 15, 30, 45, 60, -15, -30, -45, -60];

  for (const yaw of yawAngles) {
    ft.avatar.updateParams({ headYaw: 0.5 + yaw / 120, headPitch: 0.5 });
    ft.avatar.draw();

    const mesh = ft.avatar.spindleMesh;
    const cosY = Math.cos(yaw * Math.PI / 180);
    const sinY = Math.sin(yaw * Math.PI / 180);

    let headFront = 0, headTotal = 0;
    let faceFront = 0, faceTotal = 0;
    const cullThreshold = -0.15;  // 与 renderer 中一致

    for (const f of mesh.faces) {
      // 计算平均法线并旋转
      const idxs = f.indices;
      const n = idxs.length;
      let avgX = 0, avgZ = 0, avgRotZ = 0;
      let avgOrigZ = 0;
      for (const i of idxs) {
        const v = mesh.vertices[i];
        avgX += v.nx; avgZ += v.nz;
        avgOrigZ += v.z;
      }
      avgX /= n; avgZ /= n; avgOrigZ /= n;
      avgRotZ = -sinY * avgX + cosY * avgZ;

      // 是否可见（不剔除双面）
      const visible = f.doubleSided || avgRotZ > cullThreshold;

      if (avgOrigZ > 40) { headTotal++; if (visible) headFront++; }
      // 面部区域：前 5% 的 z 值（接近鼻端）
      if (avgOrigZ > 0) { faceTotal++; if (visible) faceFront++; }
    }

    out.yawTests[`yaw_${yaw}`] = {
      headVisibleRatio: headTotal > 0 ? (headFront / headTotal * 100).toFixed(1) + '%' : 'N/A',
      faceVisibleRatio: faceTotal > 0 ? (faceFront / faceTotal * 100).toFixed(1) + '%' : 'N/A',
    };
  }

  // ---- 球体 avatar 测试（验证没有被 spindle 代码破坏）----
  if (ft.avatar.mesh) {
    out.sphereMesh = { radius: ft.avatar.mesh.radius };
  }

  return out;
});

console.log('\n=== 诊断结果 ===\n');
console.log(JSON.stringify(result, null, 2));

// ===== 2. 生成视觉截图 =====
console.log('\n=== 生成视觉截图 ===');

// 重置到正面
await page.evaluate(() => {
  window.faceTracker.avatar.updateParams({ headYaw: 0.5, headPitch: 0.5 });
  window.faceTracker.avatar.draw();
});
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(OUTPUT_DIR, '01-yaw-0.png') });
console.log('  yaw=0°');

// 关键角度截图
for (const yaw of [30, 45, 60, -45, -60]) {
  await page.evaluate((val) => {
    window.faceTracker.avatar.updateParams({ headYaw: 0.5 + val / 120, headPitch: 0.5 });
    window.faceTracker.avatar.draw();
  }, yaw);
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUTPUT_DIR, `02-yaw-${yaw}.png`) });
  console.log(`  yaw=${yaw}°`);
}

// 俯仰角测试
for (const pitch of [30, -30]) {
  await page.evaluate((val) => {
    window.faceTracker.avatar.updateParams({ headYaw: 0.5, headPitch: 0.5 + val / 120 });
    window.faceTracker.avatar.draw();
  }, pitch);
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUTPUT_DIR, `03-pitch-${pitch}.png`) });
  console.log(`  pitch=${pitch}°`);
}

// 表情测试
await page.evaluate(() => {
  window.faceTracker.avatar.updateParams({ headYaw: 0.5, headPitch: 0.5, mouthOpen: 1 });
  window.faceTracker.avatar.draw();
});
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(OUTPUT_DIR, '04-mouth-open.png') });
console.log('  张嘴');

await browser.close();
console.log('\n✅ 诊断完成！截图保存在:', OUTPUT_DIR);
