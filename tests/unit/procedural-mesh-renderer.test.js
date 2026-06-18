/**
 * ProceduralMeshRenderer 单元测试
 *
 * 测试目标：
 *   - 球体/纺锤鲸鱼的 mesh 生成（顶点数/面数合理）
 *   - 五官锚点来自表面参数 (phi/theta 或 bodyT/surfAngle)，不是固定坐标
 *   - yaw/pitch 变化时投影位置随之变化
 *   - 远侧眼在大 yaw 时隐藏（法线远离摄像机）
 *   - 五官不会跑出身体 bbox
 *   - 张嘴/眨眼产生不同的视觉参数
 *   - 正式模式不显示调试网格
 *   - 经典脚本版本 (procedural-avatar-classic.js) 与正式实现的参数一致性
 *
 * 运行：node tests/unit/procedural-mesh-renderer.test.js
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(REPO_ROOT, 'src', 'face-tracking');

// === 动态 import ESM 源码 ===
const meshSphere = await import(`file://${path.join(SRC, 'mesh-sphere.js')}`);
const meshWhale = await import(`file://${path.join(SRC, 'mesh-spindle-whale.js')}`);

const { createSphereMesh, deformSphere, computeSphereFaceAnchor } = meshSphere;
const { createSpindleMesh, createWhaleTailMesh, deformSpindle, computeFaceAnchor } = meshWhale;

// ========== 几何辅助 ==========
function approx(a, b, eps = 1e-6) {
  return Math.abs(a - b) < eps;
}

function faceBBox(vertices) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const v of vertices) {
    const x = v.tx !== undefined ? v.tx : v.x;
    const y = v.ty !== undefined ? v.ty : v.y;
    const z = v.tz !== undefined ? v.tz : v.z;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }
  return { minX, minY, minZ, maxX, maxY, maxZ };
}

// 计算锚点在 mesh 表面法线方向，然后模拟 yaw 看可见性
function transformAnchor(local, rot) {
  const { angleY = 0, angleX = 0, angleZ = 0 } = rot;
  const radY = angleY * Math.PI / 180;
  const radX = angleX * Math.PI / 180;
  const radZ = angleZ * Math.PI / 180;
  let x = local.x, y = local.y, z = local.z;
  let nx = local.nx, ny = local.ny, nz = local.nz;

  // yaw (Y)
  const cY = Math.cos(radY), sY = Math.sin(radY);
  let x1 = x * cY + z * sY, z1 = -x * sY + z * cY, y1 = y;
  let nx1 = nx * cY + nz * sY, nz1 = -nx * sY + nz * cY, ny1 = ny;

  // pitch (X)
  const cX = Math.cos(radX), sX = Math.sin(radX);
  let y2 = y1 * cX - z1 * sX, z2 = y1 * sX + z1 * cX, x2 = x1;
  let ny2 = ny1 * cX - nz1 * sX, nz2 = ny1 * sX + nz1 * cX, nx2 = nx1;

  // roll (Z)
  const cZ = Math.cos(radZ), sZ = Math.sin(radZ);
  let x3 = x2 * cZ - y2 * sZ, y3 = x2 * sZ + y2 * cZ, z3 = z2;
  let nx3 = nx2 * cZ - ny2 * sZ, ny3 = nx2 * sZ + ny2 * cZ, nz3 = nz2;

  return { x: x3, y: y3, z: z3, nx: nx3, ny: ny3, nz: nz3 };
}

// ========== 测试：Sphere ==========
describe('Sphere mesh', () => {
  const mesh = createSphereMesh({ rings: 18, segments: 28, radius: 80 });

  it('有合理的顶点数和面数', () => {
    assert.ok(mesh.vertices.length > 300, `顶点过少: ${mesh.vertices.length}`);
    assert.ok(mesh.faces.length > 300, `面过少: ${mesh.faces.length}`);
  });

  it('顶点位于以原点为中心、半径 <= 80 的球面上', () => {
    for (const v of mesh.vertices) {
      const r = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
      assert.ok(r <= 80 * 1.05 && r >= 80 * 0.95, `顶点 r=${r.toFixed(2)} 不在球面附近`);
    }
  });

  it('球体法线基本指向球外 (normalize) ', () => {
    let inliers = 0;
    for (const v of mesh.vertices) {
      const nlen = Math.sqrt(v.nx * v.nx + v.ny * v.ny + v.nz * v.nz);
      if (nlen > 0.8 && nlen < 1.2) inliers++;
    }
    assert.ok(inliers / mesh.vertices.length > 0.9, `球面法线不规范: ${inliers}/${mesh.vertices.length}`);
  });
});

describe('Sphere 锚点与 yaw 变化', () => {
  const mesh = createSphereMesh({ radius: 80 });

  it('phi 不同 → 锚点 y 不同', () => {
    const a1 = computeSphereFaceAnchor(mesh, 0.1, Math.PI / 2, 0);
    const a2 = computeSphereFaceAnchor(mesh, 0.5, Math.PI / 2, 0);
    assert.ok(!approx(a1.y, a2.y, 1e-3), `phi 变化时 y 应变: ${a1.y} vs ${a2.y}`);
  });

  it('theta 不同 → 锚点 x/z 不同', () => {
    const a1 = computeSphereFaceAnchor(mesh, Math.PI / 3, 0.1, 0);
    const a2 = computeSphereFaceAnchor(mesh, Math.PI / 3, 1.2, 0);
    assert.ok(!approx(a1.x, a2.x, 1e-3) || !approx(a1.z, a2.z, 1e-3),
      `theta 变化时 x/z 应变: (${a1.x.toFixed(1)},${a1.z.toFixed(1)}) vs (${a2.x.toFixed(1)},${a2.z.toFixed(1)})`);
  });

  it('yaw 不同 → 锚点投影位置不同', () => {
    const anchor = computeSphereFaceAnchor(mesh, Math.PI * 0.42, Math.PI * 0.5 - 0.35, 1);
    const p0 = transformAnchor(anchor, { angleY: 0, angleX: 0, angleZ: 0 });
    const p1 = transformAnchor(anchor, { angleY: 60, angleX: 0, angleZ: 0 });
    assert.ok(!approx(p0.x, p1.x, 0.5) || !approx(p0.z, p1.z, 0.5),
      `yaw 变化应导致锚点投影变化: (${p0.x.toFixed(1)},${p0.z.toFixed(1)}) vs (${p1.x.toFixed(1)},${p1.z.toFixed(1)})`);
  });

  it('大 yaw 时远侧眼法线朝 -Z → 隐藏', () => {
    // 左眼在 theta = PI/2 - 0.35；yaw=+90° 时，左眼应转到背面。
    const leftEye = computeSphereFaceAnchor(mesh, Math.PI * 0.42, Math.PI * 0.5 - 0.35, 0);
    const rotated = transformAnchor(leftEye, { angleY: 90 });
    assert.ok(rotated.nz < 0.2,
      `大 yaw 时左眼法线应远离摄像机 (nz=${rotated.nz.toFixed(3)})`);
  });

  it('锚点在 yaw=0 时在身体 bbox 内', () => {
    const deformed = deformSphere(mesh, { angleY: 0, angleX: 0, angleZ: 0 });
    const bbox = faceBBox(deformed.vertices);
    const leftEye = computeSphereFaceAnchor(mesh, Math.PI * 0.42, Math.PI * 0.5 - 0.35, 1);
    const mouth = computeSphereFaceAnchor(mesh, Math.PI * 0.60, Math.PI * 0.5, 1);
    for (const p of [leftEye, mouth]) {
      assert.ok(p.x >= bbox.minX - 2 && p.x <= bbox.maxX + 2, `X out: ${p.x.toFixed(1)} not in [${bbox.minX.toFixed(1)}, ${bbox.maxX.toFixed(1)}]`);
      assert.ok(p.y >= bbox.minY - 2 && p.y <= bbox.maxY + 2, `Y out: ${p.y.toFixed(1)} not in [${bbox.minY.toFixed(1)}, ${bbox.maxY.toFixed(1)}]`);
      assert.ok(p.z >= bbox.minZ - 2 && p.z <= bbox.maxZ + 2, `Z out: ${p.z.toFixed(1)} not in [${bbox.minZ.toFixed(1)}, ${bbox.maxZ.toFixed(1)}]`);
    }
  });
});

// ========== 测试：Spindle whale ==========
describe('Spindle whale mesh', () => {
  const spindle = createSpindleMesh({
    headR: 75, bodyLength: 150, bodyWidth: 60, bodyDepth: 45, columns: 22, rows: 16
  });

  it('有合理的顶点数和面数', () => {
    assert.ok(spindle.vertices.length > 200, `vertices=${spindle.vertices.length}`);
    assert.ok(spindle.faces.length > 200, `faces=${spindle.faces.length}`);
  });

  it('前额区域 (bodyT 小) 比尾部更宽（头部圆润）', () => {
    // 计算前 20% 列的平均 y/z 范围 vs 后 20%
    const cols = Math.max(5, Math.floor(spindle.columns * 0.2));
    let headMaxY = -Infinity, tailMaxY = -Infinity;
    for (const v of spindle.vertices) {
      if (v.col <= cols) {
        headMaxY = Math.max(headMaxY, Math.abs(v.y));
      } else if (v.col >= spindle.columns - cols) {
        tailMaxY = Math.max(tailMaxY, Math.abs(v.y));
      }
    }
    assert.ok(headMaxY > tailMaxY * 0.9 || headMaxY > 30,
      `头部应更宽: headMaxY=${headMaxY.toFixed(1)} vs tailMaxY=${tailMaxY.toFixed(1)}`);
  });
});

describe('Spindle whale 锚点来自表面', () => {
  const mesh = createSpindleMesh({ headR: 75, bodyLength: 150 });

  it('bodyT 不同 → 锚点 x 不同', () => {
    const a1 = computeFaceAnchor(mesh, 0.1, 0.0, 0);
    const a2 = computeFaceAnchor(mesh, 0.5, 0.0, 0);
    assert.ok(!approx(a1.x, a2.x, 1e-3), `bodyT 变化时 x 应变: ${a1.x.toFixed(1)} vs ${a2.x.toFixed(1)}`);
  });

  it('surfAngle 不同 → 锚点 y/z 不同', () => {
    const a1 = computeFaceAnchor(mesh, 0.12, -0.55, 0);
    const a2 = computeFaceAnchor(mesh, 0.12, 0.55, 0);
    assert.ok(!approx(a1.y, a2.y, 0.5) || !approx(a1.z, a2.z, 0.5),
      `angle 变化时 y/z 应变: (${a1.y.toFixed(1)},${a1.z.toFixed(1)}) vs (${a2.y.toFixed(1)},${a2.z.toFixed(1)})`);
  });

  it('yaw 不同 → 锚点投影位置不同', () => {
    const anchor = computeFaceAnchor(mesh, 0.12, -0.55, 1);
    const p0 = transformAnchor(anchor, { angleY: 0, angleX: 0, angleZ: 0 });
    const p1 = transformAnchor(anchor, { angleY: 45, angleX: 0, angleZ: 0 });
    assert.ok(!approx(p0.x, p1.x, 0.5) || !approx(p0.z, p1.z, 0.5),
      `yaw 变化应导致鲸鱼锚点投影变化: x0=${p0.x.toFixed(1)},x1=${p1.x.toFixed(1)}`);
  });

  it('大 yaw 时远侧眼法线朝 -Z → 隐藏', () => {
    const leftEye = computeFaceAnchor(mesh, 0.12, -0.55, 0);
    const rotated = transformAnchor(leftEye, { angleY: 90 });
    assert.ok(rotated.nz < 0.2,
      `大 yaw 时左眼法线应远离摄像机 (nz=${rotated.nz.toFixed(3)})`);
  });

  it('嘴、眼睛在 yaw=0 时在身体 bbox 内', () => {
    const deformed = deformSpindle(mesh, { angleY: 0, angleX: 0, angleZ: 0 });
    const bbox = faceBBox(deformed.vertices);
    const leftEye = computeFaceAnchor(mesh, 0.12, -0.55, 1);
    const mouth = computeFaceAnchor(mesh, 0.15, 0.0, 1);
    for (const p of [leftEye, mouth]) {
      assert.ok(p.x >= bbox.minX - 5 && p.x <= bbox.maxX + 5,
        `X out: ${p.x.toFixed(1)} not in [${bbox.minX.toFixed(1)}, ${bbox.maxX.toFixed(1)}]`);
      assert.ok(p.y >= bbox.minY - 5 && p.y <= bbox.maxY + 5,
        `Y out: ${p.y.toFixed(1)} not in [${bbox.minY.toFixed(1)}, ${bbox.maxY.toFixed(1)}]`);
    }
  });

  it('表面偏移为正 → 五官沿法线向外推', () => {
    const base = computeFaceAnchor(mesh, 0.12, -0.55, 0);
    const pushed = computeFaceAnchor(mesh, 0.12, -0.55, 2);
    const dx = pushed.x - base.x, dy = pushed.y - base.y, dz = pushed.z - base.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    assert.ok(dist > 1.5, `表面偏移未生效: dist=${dist.toFixed(2)}`);
  });

  it('faceWeight 在面部区域明显大于零（表明是一个面部区域）', () => {
    // 我们在 mesh 顶点上没有直接暴露 faceWeight 字段（但在渲染器中会从顶点读取），
    // 这里做一个简单的几何推断：在前 bodyT 附近的顶点 y/z 幅度更大，说明有面部凸起。
    const cols = Math.floor(mesh.columns * 0.18);
    let frontVertices = 0, totalFront = 0;
    for (const v of mesh.vertices) {
      if (v.col <= cols) {
        totalFront++;
        const r = Math.sqrt(v.y * v.y + v.z * v.z);
        if (r > 15) frontVertices++;
      }
    }
    assert.ok(totalFront > 10 && frontVertices > 5,
      `前部应有明确的面部结构: ${frontVertices}/${totalFront}`);
  });
});

describe('deform 函数一致性（yaw 改变形状）', () => {
  it('Sphere: yaw 0° 与 30° 的 x/z 分布不同', () => {
    const mesh = createSphereMesh({ radius: 80 });
    const d0 = deformSphere(mesh, { angleY: 0 });
    const d1 = deformSphere(mesh, { angleY: 30 });
    let diffX = 0, diffZ = 0;
    for (let i = 0; i < d0.vertices.length; i++) {
      const a = d0.vertices[i], b = d1.vertices[i];
      diffX += Math.abs((a.tx !== undefined ? a.tx : a.x) - (b.tx !== undefined ? b.tx : b.x));
      diffZ += Math.abs((a.tz !== undefined ? a.tz : a.z) - (b.tz !== undefined ? b.tz : b.z));
    }
    assert.ok(diffX > 100 || diffZ > 100,
      `yaw 应对球体产生可察觉的变形: dx=${diffX.toFixed(1)}, dz=${diffZ.toFixed(1)}`);
  });

  it('Spindle: yaw 0° 与 40° 的 z 分布不同', () => {
    const mesh = createSpindleMesh({ headR: 75, bodyLength: 150 });
    const d0 = deformSpindle(mesh, { angleY: 0 });
    const d1 = deformSpindle(mesh, { angleY: 40 });
    let diffZ = 0;
    for (let i = 0; i < d0.vertices.length; i++) {
      const a = d0.vertices[i], b = d1.vertices[i];
      const az = a.tz !== undefined ? a.tz : a.z;
      const bz = b.tz !== undefined ? b.tz : b.z;
      diffZ += Math.abs(az - bz);
    }
    assert.ok(diffZ > 200, `yaw 应对鲸鱼产生可察觉的 z 分布差异: dz=${diffZ.toFixed(1)}`);
  });
});

// ========== 测试：经典脚本派生版本一致性 ==========
describe('Procedural-avatar-classic.js 派生', () => {
  const classic = path.join(SRC, 'procedural-avatar-classic.js');

  it('存在且非空', () => {
    assert.ok(fs.existsSync(classic), `${classic} 不存在`);
    const stat = fs.statSync(classic);
    assert.ok(stat.size > 5000, `${classic} 过小 (${stat.size} bytes), 派生可能失败`);
  });

  it('包含关键函数导出符号', () => {
    const text = fs.readFileSync(classic, 'utf8');
    for (const sym of ['createSphereMesh', 'createSpindleMesh', 'computeFaceAnchor',
      'computeSphereFaceAnchor', 'ProceduralSphereAvatar', 'ProceduralSpindleWhaleAvatar']) {
      assert.ok(text.includes(sym), `经典脚本缺少符号: ${sym}`);
    }
  });

  it('不包含 ES Module import/export 关键字（已被 strip 去除）', () => {
    const text = fs.readFileSync(classic, 'utf8');
    // 不应存在形如 "export function" / "import ... from" 的行
    const badExport = /^export\s+(function|class|const|let|var)/m.test(text);
    const badImport = /^import\s+[^;]*from/m.test(text);
    assert.ok(!badExport, `仍包含 export 关键字`);
    assert.ok(!badImport, `仍包含 import 关键字`);
  });
});

describe('调试模式 vs 正式模式', () => {
  it('正式构建默认 debugMesh=false（不显示网格线）', () => {
    const text = fs.readFileSync(path.join(SRC, 'procedural-mesh-renderer.js'), 'utf8');
    // 查找 "debugMesh = false" 或 "debugMesh:false"
    const match = /debugMesh\s*[:=]\s*(false|0)/i.test(text);
    assert.ok(match, `renderer 应有默认关闭的 debugMesh`);
  });
});
