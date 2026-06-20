// spindle mesh invariants dry-run
// 不依赖任何浏览器 API，仅验证几何/法线/可见面数量
import { createSpindleMesh, deformSpindle } from '../../src/face-tracking/mesh-spindle-whale.js';

function assert(cond, msg) {
  if (!cond) {
    console.error('  ASSERT FAILED:', msg);
    process.exitCode = 1;
  } else {
    console.log('  OK:', msg);
  }
}

function meshSummary(mesh) {
  const nV = mesh.vertices.length;
  const nF = mesh.faces.length;
  let minNz = Infinity, maxNz = -Infinity, avgNz = 0;
  for (const v of mesh.vertices) {
    if (!Number.isFinite(v.nx) || !Number.isFinite(v.ny) || !Number.isFinite(v.nz)) {
      console.error('  NON-FINITE normal at vertex', v);
      process.exitCode = 1;
    }
    minNz = Math.min(minNz, v.nz);
    maxNz = Math.max(maxNz, v.nz);
    avgNz += v.nz;
  }
  avgNz /= nV;
  return { nV, nF, minNz, maxNz, avgNz };
}

function countVisibleAfterDeform(mesh, yawDeg, pitchDeg) {
  const params = {
    angleY: yawDeg,
    angleX: pitchDeg,
    angleZ: 0,
  };
  const deformed = deformSpindle(mesh, params);
  let visible = 0, hidden = 0, degenerate = 0;
  let minFNz = Infinity, maxFNz = -Infinity;
  for (const f of deformed.faces) {
    if (!f.vertices || f.vertices.length < 3) { degenerate++; continue; }
    // 用 face 平均 nz 决定可见性（与 procedural-mesh-renderer 一致）
    let sumNz = 0;
    for (const v of f.vertices) sumNz += v.nz;
    const avgNz = sumNz / f.vertices.length;
    minFNz = Math.min(minFNz, avgNz);
    maxFNz = Math.max(maxFNz, avgNz);
    if (avgNz > -0.05) visible++; else hidden++;
  }
  return { deformed, visible, hidden, degenerate, minFNz, maxFNz };
}

console.log('=== spindle mesh invariants ===');
const mesh = createSpindleMesh();
const s = meshSummary(mesh);
console.log(' static:', s);
assert(s.nV > 300, 'vertex count >= 300 for reasonable surface');
assert(s.nF > 200, 'face count >= 200 for reasonable surface');
assert(s.maxNz > 0.3, 'positive-nz hemisphere exists (front-facing normal)');
assert(s.minNz < -0.3, 'negative-nz hemisphere exists (back-facing normal)');

console.log('\n--- yaw=0 (正面) ---');
const v0 = countVisibleAfterDeform(mesh, 0, 0);
console.log(' visible:', v0.visible, 'hidden:', v0.hidden, 'degenerate:', v0.degenerate);
assert(v0.visible >= 200, 'yaw=0 visible faces >= 200');
assert(v0.hidden >= 20, 'yaw=0 hidden/back faces exist (cullThreshold zone)');

for (const yaw of [30, 45, 60, -30, -45, -60]) {
  const v = countVisibleAfterDeform(mesh, yaw, 0);
  console.log(` yaw=${yaw}: visible=${v.visible}, hidden=${v.hidden}`);
  assert(v.visible >= 150, `yaw=${yaw} visible >= 150`);
  assert(v.degenerate === 0, `yaw=${yaw} no degenerate faces`);
}

console.log('\n--- non-finite input guard ---');
try {
  const weird = createSpindleMesh({ headX: NaN, headY: NaN });
  const sw = meshSummary(weird);
  // 若构造器处理了 NaN，则应该不崩溃且顶点数合理
  console.log(' weird summary:', sw);
} catch (err) {
  console.error('  ERROR on NaN inputs:', err.message);
  process.exitCode = 1;
}

console.log('\n--- nose-tip nz sanity (nose should face +Z toward camera) ---');
// 前几列的 nz 应当以正值为主（鼻端附近朝摄像机）
// 注意：vertex 使用 z（不是 zPos）。鼻端 z ≈ headZ = 50。
let nosePosCount = 0, noseNegCount = 0;
for (const v of mesh.vertices) {
  if (v.z > 40) { // 鼻端附近（headZ=50）
    if (v.nz > 0) nosePosCount++;
    else noseNegCount++;
  }
}
console.log(' nose-zone positive nz:', nosePosCount, 'negative nz:', noseNegCount);
assert(nosePosCount > noseNegCount, 'nose zone has more positive-nz vertices');

console.log('\n--- face polygon diversity (triangle support hint) ---');
// 统计 3 顶点 / 4 顶点 / 其他面数
let tri = 0, quad = 0, other = 0;
for (const f of mesh.faces) {
  const n = f.indices.length;
  if (n === 3) tri++;
  else if (n === 4) quad++;
  else other++;
}
console.log(' triangle faces:', tri, 'quad faces:', quad, 'other:', other);
assert(tri === 4, 'default mesh has 4 tail triangles');
assert(quad === mesh.faces.length - 4, 'remaining faces are quads');

console.log('\n--- flukeEnabled=false: tail ring uses native triangles ---');
const noFluke = createSpindleMesh({ flukeEnabled: false });
let tri2 = 0, quad2 = 0;
for (const f of noFluke.faces) {
  if (f.indices.length === 3) tri2++;
  else if (f.indices.length === 4) quad2++;
}
console.log(' triangle faces:', tri2, 'quad faces:', quad2);
assert(tri2 > 0, 'fluke-disabled mode has native triangles');
// 每一个三角面必须索引不重复且面积>0（边长平方和>0）
for (const f of noFluke.faces) {
  if (f.indices.length !== 3) continue;
  const [a, b, c] = f.indices;
  assert(a !== b && b !== c && a !== c, 'triangle indices unique');
  const va = noFluke.vertices[a], vb = noFluke.vertices[b], vc = noFluke.vertices[c];
  const dab = (va.x - vb.x) ** 2 + (va.y - vb.y) ** 2 + (va.z - vb.z) ** 2;
  const dbc = (vb.x - vc.x) ** 2 + (vb.y - vc.y) ** 2 + (vb.z - vc.z) ** 2;
  const dac = (va.x - vc.x) ** 2 + (va.y - vc.y) ** 2 + (va.z - vc.z) ** 2;
  assert(dab > 0 && dbc > 0 && dac > 0, 'triangle edges non-degenerate');
}

console.log('\n=== done ===');
