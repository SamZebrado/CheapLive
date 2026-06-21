/**
 * 详细诊断：分析渲染后的关键视觉指标
 * - 面部可见区域占比
 * - 五官锚点是否在正面（nz > 0）
 * - 尾鳍形状是否合理
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = './artifacts/detailed-diagnosis';
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 900, height: 700 } });
const page = await context.newPage();

console.log('正在加载页面...');
await page.goto('http://localhost:8000', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);

// 在浏览器侧执行完整诊断
const result = await page.evaluate(() => {
  const ft = window._faceTracker;
  if (!ft || !ft.avatar) return { error: 'avatar not initialized' };

  const results = {};
  const testAngles = [0, 30, 45, 60, -30, -60];

  // 1) 测试每个 yaw 角度
  for (const yaw of testAngles) {
    const headYaw = 0.5 + (yaw / 120);
    ft.avatar.updateParams({ headYaw, headPitch: 0.5 });
    ft.avatar.render(performance.now());

    // 获取当前网格
    const mesh = ft.avatar.mesh;
    if (!mesh || !mesh.faces) continue;

    const faces = mesh.faces;
    let totalFaces = 0, frontFaces = 0;
    let headFacesTotal = 0, headFacesFront = 0;
    let tailFacesTotal = 0, tailFacesFront = 0;

    for (const f of faces) {
      const idxs = f.indices;
      const verts = idxs.map(i => mesh.vertices[i]);
      const avgNz = verts.reduce((s, v) => s + v.nz, 0) / verts.length;
      const avgNx = verts.reduce((s, v) => s + (v.nx || 0), 0) / verts.length;

      totalFaces++;
      if (avgNz > -0.25) frontFaces++; // 与渲染器同阈值

      // 头部区域：顶点 z > 0（靠近摄像机）
      const avgZ = verts.reduce((s, v) => s + (v.tz !== undefined ? v.tz : v.z), 0) / verts.length;
      if (avgZ > 50) {
        headFacesTotal++;
        if (avgNz > -0.25) headFacesFront++;
      }
      // 尾巴区域：顶点 z < -50
      if (avgZ < -50) {
        tailFacesTotal++;
        if (avgNz > -0.25) tailFacesFront++;
      }
    }

    results[`yaw_${yaw}`] = {
      totalFaces,
      frontFaces,
      frontFaceRatio: (frontFaces / totalFaces * 100).toFixed(1),
      headFacesTotal,
      headFacesFront,
      headFrontRatio: headFacesTotal > 0 ? (headFacesFront / headFacesTotal * 100).toFixed(1) : 'N/A',
      tailFacesTotal,
      tailFacesFront,
      tailFrontRatio: tailFacesTotal > 0 ? (tailFacesFront / tailFacesTotal * 100).toFixed(1) : 'N/A',
    };
  }

  // 2) 检查锚点可见性（五官）
  ft.avatar.updateParams({ headYaw: 0.5, headPitch: 0.5 });
  ft.avatar.render(performance.now());

  const anchors = ft.avatar.faceAnchors || {};
  const anchorResults = {};
  for (const [name, a] of Object.entries(anchors)) {
    anchorResults[name] = {
      screenX: a.screenX?.toFixed(1),
      screenY: a.screenY?.toFixed(1),
      nz: a.nz?.toFixed(3),
      visible: (a.nz || 0) > -0.2,
    };
  }
  results.anchors = anchorResults;

  // 3) 检查 mesh 顶点范围（用于诊断尾鳍尺寸）
  const finalMesh = ft.avatar.mesh;
  if (finalMesh && finalMesh.vertices) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (const v of finalMesh.vertices) {
      const z = v.tz !== undefined ? v.tz : v.z;
      const x = v.tx !== undefined ? v.tx : v.x;
      const y = v.ty !== undefined ? v.ty : v.y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    results.boundingBox = {
      x: `${minX.toFixed(0)} ~ ${maxX.toFixed(0)}`,
      xWidth: (maxX - minX).toFixed(0),
      y: `${minY.toFixed(0)} ~ ${maxY.toFixed(0)}`,
      yHeight: (maxY - minY).toFixed(0),
      z: `${minZ.toFixed(0)} ~ ${maxZ.toFixed(0)}`,
      zLength: (maxZ - minZ).toFixed(0),
    };
  }

  return results;
});

console.log('\n=== 渲染诊断结果 ===\n');
console.log(JSON.stringify(result, null, 2));

await browser.close();
console.log('\n✅ 诊断完成');
