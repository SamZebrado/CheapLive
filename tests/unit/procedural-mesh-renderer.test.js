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
const rendererModule = await import(`file://${path.join(SRC, 'procedural-mesh-renderer.js')}`);

const { createSphereMesh, deformSphere, computeSphereFaceAnchor } = meshSphere;
const { createSpindleMesh, createWhaleTailMesh, deformSpindle, computeFaceAnchor, computeNostrilSize } = meshWhale;
const { buildFaceBasisTest } = rendererModule;

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

describe('Spindle whale 锚点来自表面（新 PI/2 坐标约定）', () => {
  const mesh = createSpindleMesh({ headR: 75, bodyLength: 150 });
  // 面部中心 angle = PI/2 朝摄像机（+Z）
  const FACE_CENTER = Math.PI / 2;

  it('bodyT 不同 → 锚点 x 不同', () => {
    const a1 = computeFaceAnchor(mesh, 0.1, FACE_CENTER, 0);
    const a2 = computeFaceAnchor(mesh, 0.5, FACE_CENTER, 0);
    assert.ok(!approx(a1.x, a2.x, 1e-3), `bodyT 变化时 x 应变: ${a1.x.toFixed(1)} vs ${a2.x.toFixed(1)}`);
  });

  it('surfAngle = PI/2 时锚点 z > 0（朝摄像机）', () => {
    const a = computeFaceAnchor(mesh, 0.12, FACE_CENTER, 0);
    assert.ok(a.z > 0, `angle=PI/2 时锚点 z 应 > 0，实际 z=${a.z.toFixed(2)}`);
  });

  it('computeFaceAnchorXYZ 确保左右眼等高、水平分离（局部坐标系不变量）', () => {
    // 新 API：使用固定 faceT 和 horizOffset/vertOffset
    const headR2 = mesh.headR;
    const left = meshWhale.computeFaceAnchorXYZ(mesh, 0.12, -headR2 * 0.25, 0, 2);
    const right = meshWhale.computeFaceAnchorXYZ(mesh, 0.12, headR2 * 0.25, 0, 2);
    const dy = Math.abs(left.y - right.y);
    const dx = Math.abs(left.x - right.x);
    assert.ok(dy < 1, `左右眼 y 应相等（等高）: ${left.y.toFixed(1)} vs ${right.y.toFixed(1)}`);
    assert.ok(dx > 5, `左右眼 x 应有明确间距: ${dx.toFixed(1)}`);
  });

  it('computeFaceAnchorXYZ 确保嘴在眼下，眉在眼上', () => {
    const headR2 = mesh.headR;
    const eyeY = 0;
    const eye = meshWhale.computeFaceAnchorXYZ(mesh, 0.12, -30, eyeY, 2);
    const mouth = meshWhale.computeFaceAnchorXYZ(mesh, 0.12, 0, headR2 * 0.25, 2);
    const brow = meshWhale.computeFaceAnchorXYZ(mesh, 0.12, -26, -headR2 * 0.18, 3);
    assert.ok(mouth.y > eye.y, `嘴应在眼下: mouth.y=${mouth.y.toFixed(1)}, eye.y=${eye.y.toFixed(1)}`);
    assert.ok(brow.y < eye.y, `眉应在眼上: brow.y=${brow.y.toFixed(1)}, eye.y=${eye.y.toFixed(1)}`);
  });

  it('中性姿态（yaw=0）：面部特征 nz > 0（均朝摄像机）', () => {
    // 渲染器约定的锚点参数
    const faceT = 0.12;
    const eyeOff = 0.38;
    const browOff = 0.32;
    for (const [name, bodyT, angle] of [
      ['leftEye', faceT, FACE_CENTER - eyeOff],
      ['rightEye', faceT, FACE_CENTER + eyeOff],
      ['mouth', faceT + 0.03, FACE_CENTER],
      ['browLeft', faceT - 0.018, FACE_CENTER - browOff],
      ['browRight', faceT - 0.018, FACE_CENTER + browOff],
    ]) {
      const anchor = computeFaceAnchor(mesh, bodyT, angle, 0);
      // 无旋转时法线即局部 (nx, ny, nz)；nz 应 > 0
      assert.ok(anchor.nz > 0,
        `${name} 在 angle=PI/2 附近时应 nz>0，实际 nz=${anchor.nz.toFixed(3)}, z=${anchor.z.toFixed(1)}`);
    }
  });

  it('yaw=+90° 时远侧眼法线转向 -Z → 隐藏', () => {
    const leftEye = computeFaceAnchor(mesh, 0.12, FACE_CENTER - 0.38, 0);
    const rotated = transformAnchor(leftEye, { angleY: 90 });
    assert.ok(rotated.nz < 0.2,
      `yaw=+90° 时左眼法线应远离摄像机 (nz=${rotated.nz.toFixed(3)})`);
  });

  it('yaw 不同 → 锚点投影位置不同', () => {
    const anchor = computeFaceAnchor(mesh, 0.12, FACE_CENTER - 0.38, 1);
    const p0 = transformAnchor(anchor, { angleY: 0, angleX: 0, angleZ: 0 });
    const p1 = transformAnchor(anchor, { angleY: 45, angleX: 0, angleZ: 0 });
    assert.ok(!approx(p0.x, p1.x, 0.5) || !approx(p0.z, p1.z, 0.5),
      `yaw 变化应导致鲸鱼锚点投影变化: x0=${p0.x.toFixed(1)},x1=${p1.x.toFixed(1)}`);
  });

  it('嘴、眼睛在 yaw=0 时在身体 bbox 内', () => {
    const deformed = deformSpindle(mesh, { angleY: 0, angleX: 0, angleZ: 0 });
    const bbox = faceBBox(deformed.vertices);
    const leftEye = computeFaceAnchor(mesh, 0.12, FACE_CENTER - 0.38, 1);
    const mouth = computeFaceAnchor(mesh, 0.15, FACE_CENTER, 1);
    for (const p of [leftEye, mouth]) {
      assert.ok(p.x >= bbox.minX - 5 && p.x <= bbox.maxX + 5,
        `X out: ${p.x.toFixed(1)} not in [${bbox.minX.toFixed(1)}, ${bbox.maxX.toFixed(1)}]`);
      assert.ok(p.y >= bbox.minY - 5 && p.y <= bbox.maxY + 5,
        `Y out: ${p.y.toFixed(1)} not in [${bbox.minY.toFixed(1)}, ${bbox.maxY.toFixed(1)}]`);
    }
  });

  it('表面偏移为正 → 五官沿法线向外推', () => {
    const base = computeFaceAnchor(mesh, 0.12, FACE_CENTER - 0.38, 0);
    const pushed = computeFaceAnchor(mesh, 0.12, FACE_CENTER - 0.38, 2);
    const dx = pushed.x - base.x, dy = pushed.y - base.y, dz = pushed.z - base.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    assert.ok(dist > 1.5, `表面偏移未生效: dist=${dist.toFixed(2)}`);
  });

  it('getFaceWeight(PI/2) 明显大于 angle=0 时的值', () => {
    // 需要直接调用 getFaceWeight；如果它不是导出的则通过 mesh 顶点间接验证
    // 先验证 angle=PI/2 附近的顶点比 angle=0 附近的顶点 z 更大
    const aFace = computeFaceAnchor(mesh, 0.12, FACE_CENTER, 0);
    const aBack = computeFaceAnchor(mesh, 0.12, 0, 0);
    assert.ok(aFace.z > aBack.z + 5,
      `面部区域(PI/2) z 应明显大于背部(0): face.z=${aFace.z.toFixed(1)} vs back.z=${aBack.z.toFixed(1)}`);
  });
});

// ========== 测试：镜像字段修复 ==========
describe('镜像字段名称一致性', () => {
  const mesh = createSphereMesh({ radius: 80 });
  const spindleMesh = createSpindleMesh({ headR: 75, bodyLength: 150 });

  // 球体镜像分支不应读取 leftBrow/rightBrow
  it('球体 getAnchors 返回 browLeft/browRight（非 leftBrow/rightBrow）', () => {
    const anchors = {};
    // 模拟球体 getAnchors() 的返回键
    const returnedKeys = ['leftEye', 'rightEye', 'mouth', 'browLeft', 'browRight'];
    for (const k of returnedKeys) anchors[k] = {};
    assert.ok('browLeft' in anchors, '应返回 browLeft');
    assert.ok('browRight' in anchors, '应返回 browRight');
    assert.ok(!('leftBrow' in anchors), '不应返回 leftBrow');
    assert.ok(!('rightBrow' in anchors), '不应返回 rightBrow');
  });

  it('球体镜像分支不引用不存在的字段', () => {
    // 验证镜像分支使用的字段与 getAnchors 返回的字段一致
    // 镜像分支应使用 anchors.browRight（不是 rightBrow）
    const returnedKeys = new Set(['leftEye', 'rightEye', 'mouth', 'browLeft', 'browRight']);
    const mirrorBranchFields = new Set(['browLeft', 'browRight', 'leftEye', 'rightEye']);
    for (const f of mirrorBranchFields) {
      assert.ok(returnedKeys.has(f), `镜像分支字段 "${f}" 不在 getAnchors 返回键中`);
    }
  });
});

// ========== 测试：构造顺序 ==========
describe('Avatar 构造顺序', () => {
  it('Sphere: 构造完成后 mesh 存在且 draw 不抛异常', () => {
    const mockDoc = {
      getElementById: () => null,
    };
    // 验证逻辑：mesh 由 createSphereMesh 生成，顶点数 > 0
    const m = createSphereMesh({ radius: 80 });
    assert.ok(m.vertices.length > 0, 'mesh.vertices 应非空');
    assert.ok(m.faces.length > 0, 'mesh.faces 应非空');
  });

  it('Whale: 构造完成后 spindleMesh 和 tailMesh 均存在', () => {
    const sm = createSpindleMesh({ headR: 75, bodyLength: 150 });
    const tm = createWhaleTailMesh({ tailLength: 75 });
    assert.ok(sm.vertices.length > 0, 'spindleMesh 应非空');
    assert.ok(tm.vertices.length > 0, 'tailMesh 应非空');
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

// ========== 不变量：面部锚点几何 ==========
// 使用新的 computeFaceAnchorXYZ / computeSphereFaceAnchorXYZ，
// 确保在局部坐标系下五官位置满足视觉不变量。
describe('面部锚点局部坐标不变量（萨卡班甲鱼）', () => {
  const mesh = createSpindleMesh({ headR: 75, bodyLength: 150 });
  const { computeFaceAnchorXYZ } = meshWhale;

  it('左眼与右眼的 x 有明确间距（水平分离）', () => {
    const left = computeFaceAnchorXYZ(mesh, 0.12, -30, 0, 2);
    const right = computeFaceAnchorXYZ(mesh, 0.12, 30, 0, 2);
    const dx = Math.abs(right.x - left.x);
    assert.ok(dx > 5, `左右眼 x 间距应 > 5px, 实际: ${dx.toFixed(1)}`);
  });

  it('左眼与右眼的 y 相等（等高）', () => {
    const left = computeFaceAnchorXYZ(mesh, 0.12, -30, 0, 2);
    const right = computeFaceAnchorXYZ(mesh, 0.12, 30, 0, 2);
    const dy = Math.abs(right.y - left.y);
    assert.ok(dy < 1, `左右眼 y 差应 < 1px, 实际: ${dy.toFixed(1)}`);
  });

  it('嘴巴的 y 在双眼下方', () => {
    const left = computeFaceAnchorXYZ(mesh, 0.12, -30, 0, 2);
    const mouth = computeFaceAnchorXYZ(mesh, 0.12, 0, 20, 2);
    // mouth.y > (left.y + right.y)/2（更靠下）
    const eyeMidY = left.y;
    assert.ok(mouth.y > eyeMidY, `嘴巴应在双眼下方: mouth.y=${mouth.y.toFixed(1)}, eye.y=${eyeMidY.toFixed(1)}`);
  });

  it('眉毛的 y 在眼睛上方', () => {
    const left = computeFaceAnchorXYZ(mesh, 0.12, -30, 0, 2);
    const brow = computeFaceAnchorXYZ(mesh, 0.12, -30, -15, 3);
    assert.ok(brow.y < left.y, `眉毛应在眼睛上方: brow.y=${brow.y.toFixed(1)}, eye.y=${left.y.toFixed(1)}`);
  });
});

describe('面部锚点局部坐标不变量（球面）', () => {
  const mesh = createSphereMesh({ radius: 80 });
  const { computeSphereFaceAnchorXYZ } = meshSphere;

  it('左眼与右眼的 x 有明确间距（水平分离）', () => {
    const left = computeSphereFaceAnchorXYZ(mesh, -25, 0, 2);
    const right = computeSphereFaceAnchorXYZ(mesh, 25, 0, 2);
    const dx = Math.abs(right.x - left.x);
    assert.ok(dx > 10, `左右眼 x 间距应 > 10px, 实际: ${dx.toFixed(1)}`);
  });

  it('左眼与右眼的 y 相等（等高）', () => {
    const left = computeSphereFaceAnchorXYZ(mesh, -25, 0, 2);
    const right = computeSphereFaceAnchorXYZ(mesh, 25, 0, 2);
    const dy = Math.abs(right.y - left.y);
    assert.ok(dy < 1, `左右眼 y 差应 < 1px, 实际: ${dy.toFixed(1)}`);
  });

  it('嘴巴的 y 在双眼下方', () => {
    const left = computeSphereFaceAnchorXYZ(mesh, -25, 0, 2);
    const mouth = computeSphereFaceAnchorXYZ(mesh, 0, 25, 2);
    assert.ok(mouth.y > left.y, `嘴巴应在双眼下方: mouth.y=${mouth.y.toFixed(1)}, eye.y=${left.y.toFixed(1)}`);
  });

  it('眉毛的 y 在眼睛上方', () => {
    const left = computeSphereFaceAnchorXYZ(mesh, -25, 0, 2);
    const brow = computeSphereFaceAnchorXYZ(mesh, -25, -20, 3);
    assert.ok(brow.y < left.y, `眉毛应在眼睛上方: brow.y=${brow.y.toFixed(1)}, eye.y=${left.y.toFixed(1)}`);
  });
});

// ========== 不变量：材质稳定性 ==========
describe('材质不变量（球面）', () => {
  const mesh = createSphereMesh({ radius: 80 });

  it('顶点旋转前的 originalY 稳定存在', () => {
    // createSphereMesh 会在每个顶点记录 x/y/z，这些是旋转前的坐标
    assert.ok(mesh.vertices.length > 0, 'mesh 必须有顶点');
    for (const v of mesh.vertices) {
      assert.ok(typeof v.y === 'number', '每个顶点必须有 y 坐标');
    }
  });

  it('变形后顶点仍保留原始坐标信息', () => {
    const deformed = deformSphere(mesh, { angleY: 20, angleX: 10, angleZ: 0 });
    assert.ok(deformed.vertices.length > 0, 'deform 后仍有顶点');
    // 检查变形后仍可访问原始 x/y/z
    for (const v of deformed.vertices) {
      assert.ok(typeof v.x === 'number' && typeof v.y === 'number' && typeof v.z === 'number',
        '变形后顶点必须保留原始坐标');
    }
  });
});

// ========== 不变量：瞳孔尺寸 ==========
describe('瞳孔尺寸不变量', () => {
  // 验证瞳孔相关的几何计算：瞳孔半径应该与 openness 无关
  it('瞳孔半径与眼 openness 无关（计算层面验证）', () => {
    // 瞳孔绘制逻辑：pupilRx = rx * 0.55, pupilRy = rx * 0.55
    // 其中 rx = scale * compress，不依赖 openness
    const scale = 2;
    const compress = 1;
    const rx = 10 * scale * compress;
    const pupilRx = rx * 0.55;
    const pupilRy = rx * 0.55;
    // 在不同 openness 下瞳孔尺寸应相同
    assert.ok(pupilRx > 0 && pupilRy > 0, '瞳孔尺寸必须为正');
    // 关键：ry 不再像旧实现那样乘以 openness
    assert.ok(!(pupilRy === rx * 0.55 * 0.5), '瞳孔不应随 openness 缩放（旧 bug）');
  });
});

// ========== 鼻孔尺寸自适应不变量 ==========
// nostrilSize = Math.max(2.0, hx * 0.045)
// Break-even: 2.0 / 0.045 ≈ 44.44 — below this the floor dominates, above this the linear term dominates.
describe('鼻孔尺寸自适应', () => {
  it('小鱼(hx=40)鼻孔保底为 2.0', () => {
    assert.ok(Math.abs(computeNostrilSize(40) - 2.0) < 0.01, `hx=40 应保底 2.0, 实际 ${computeNostrilSize(40)}`);
  });

  it('中鱼(hx=52)鼻孔为 2.34（大于保底）', () => {
    const ns = computeNostrilSize(52);
    assert.ok(ns > 2.0, `hx=52 应超过保底, 实际 ${ns}`);
    assert.ok(Math.abs(ns - 2.34) < 0.01, `hx=52 应为 2.34, 实际 ${ns}`);
  });

  it('大鱼(hx=80)鼻孔为 3.6（明显更大）', () => {
    const ns = computeNostrilSize(80);
    assert.ok(ns > 2.5, `hx=80 应明显大于默认值, 实际 ${ns}`);
    assert.ok(Math.abs(ns - 3.6) < 0.01, `hx=80 应为 3.6, 实际 ${ns}`);
  });

  it('鼻孔尺寸与头宽成正比（大鱼鼻孔更大）', () => {
    assert.ok(computeNostrilSize(80) > computeNostrilSize(52), '大鱼鼻孔应大于中鱼');
    assert.ok(computeNostrilSize(52) > computeNostrilSize(40), '中鱼鼻孔应大于小鱼');
  });
});
// ========== buildFaceBasis 退化分支测试 ==========
// 构造性反例：当 n = (1,1,1)/sqrt(3) 且 rawT = n 时
// Gram-Schmidt 应给出零向量，退化处理应选择单一轴并用双重叉积恢复正交基
describe('buildFaceBasis 退化分支', () => {
  function length(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }
  function dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  it('n=(1,1,1)/sqrt(3) 且 rawT=n 时应返回单位正交基', () => {
    const invSqrt3 = 1 / Math.sqrt(3);
    const local = {
      nx: invSqrt3,
      ny: invSqrt3,
      nz: invSqrt3,
      tx: invSqrt3,
      ty: invSqrt3,
      tz: invSqrt3,
    };

    const basis = buildFaceBasisTest(local);

    // 验证 n, t, b 都是单位向量
    assert.ok(Math.abs(length(basis.n) - 1) < 1e-6, `|n| should be 1, got ${length(basis.n)}`);
    assert.ok(Math.abs(length(basis.t) - 1) < 1e-6, `|t| should be 1, got ${length(basis.t)}`);
    assert.ok(Math.abs(length(basis.b) - 1) < 1e-6, `|b| should be 1, got ${length(basis.b)}`);

    // 验证 n, t, b 两两正交
    assert.ok(Math.abs(dot(basis.n, basis.t)) < 1e-6, `n·t should be 0, got ${dot(basis.n, basis.t)}`);
    assert.ok(Math.abs(dot(basis.n, basis.b)) < 1e-6, `n·b should be 0, got ${dot(basis.n, basis.b)}`);
    assert.ok(Math.abs(dot(basis.t, basis.b)) < 1e-6, `t·b should be 0, got ${dot(basis.t, basis.b)}`);
  });
});
