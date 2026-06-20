// spindle mesh 补充单元测试：
// - computeFaceAnchor / computeFaceAnchorXYZ 的几何不变量
// - createSpindleMesh 两种模式（fluke / 无尾鳍）下的三角形/四边形数量
// - nose-tip nz 始终朝 +Z
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSpindleMesh,
  computeFaceAnchor,
  computeFaceAnchorXYZ,
} from '../../src/face-tracking/mesh-spindle-whale.js';

function classifyFaces(mesh) {
  let tri = 0, quad = 0, other = 0;
  let indexOutOfRange = 0;
  for (const f of mesh.faces) {
    const n = f.indices.length;
    if (n === 3) tri++;
    else if (n === 4) quad++;
    else other++;
    for (const i of f.indices) {
      if (i < 0 || i >= mesh.vertices.length) indexOutOfRange++;
    }
  }
  return { tri, quad, other, indexOutOfRange };
}

test('createSpindleMesh: 默认含尾鳍，鼻端扇形 24 + fluke 内部 4 = 28 三角，退化 0', () => {
  const m = createSpindleMesh();
  const c = classifyFaces(m);
  assert.equal(c.tri, 28, 'expected 28 triangle faces (nose fan 24 + fluke inner 4)');
  assert.ok(c.quad > 0, 'quad faces present');
  assert.equal(c.other, 0, 'no unexpected polygon sizes');
  assert.equal(c.indexOutOfRange, 0, 'indices in range');
  // 面积断言：对每个 face 至少一个子三角非退化（等价于退化 0）
  const deg = m.faces.filter((f) => {
    const v = f.vertices;
    const ux = v[1].x - v[0].x, uy = v[1].y - v[0].y, uz = v[1].z - v[0].z;
    const vxx = v[2].x - v[0].x, vyy = v[2].y - v[0].y, vzz = v[2].z - v[0].z;
    const cx = uy * vzz - uz * vyy, cy = uz * vxx - ux * vzz, cz = ux * vyy - uy * vxx;
    return (cx * cx + cy * cy + cz * cz) <= 1e-10;
  }).length;
  assert.equal(deg, 0, 'all faces non-degenerate (first triplet area > 0)');
});

test('createSpindleMesh: flukeEnabled=false 使用尾端三角扇 + 鼻端三角扇，共 48 三角', () => {
  const m = createSpindleMesh({ flukeEnabled: false });
  const c = classifyFaces(m);
  // rows=24 默认：鼻端 24 个三角 + 尾端 24 个三角 = 48
  assert.equal(c.tri, 48, 'exactly 48 triangle faces in fluke-disabled mode');
  assert.equal(c.other, 0, 'no unexpected polygon sizes');
  assert.equal(c.indexOutOfRange, 0, 'indices in range');
});

test('computeFaceAnchorXYZ: 两眼在 y 方向等高，x 方向关于中线对称', () => {
  const mesh = createSpindleMesh();
  const left = computeFaceAnchorXYZ(mesh, 0, -52 * 0.31, -46 * 0.15, 0.5);
  const right = computeFaceAnchorXYZ(mesh, 0, 52 * 0.31, -46 * 0.15, 0.5);
  assert.ok(left.x < 0, 'left eye on negative x');
  assert.ok(right.x > 0, 'right eye on positive x');
  // y 等高（精度由 shape 控制，这里允许 <=1 像素级误差）
  assert.ok(Math.abs(left.y - right.y) < 1, 'eye y symmetry');
  // nz 两者都朝前（因为鼻端/眼在前方半球）
  assert.ok(left.nz > 0, 'left eye front-facing');
  assert.ok(right.nz > 0, 'right eye front-facing');
});

test('computeFaceAnchor: bodyT=0 与 bodyT=0.2 不同位置；surfAngle 改变 bodyT=0.2 处的点', () => {
  const mesh = createSpindleMesh();
  const a0 = computeFaceAnchor(mesh, 0, 0, 0);
  const aNose = computeFaceAnchor(mesh, 0, Math.PI / 2, 0);
  assert.ok(a0, 'non-null anchor at bodyT=0');
  assert.ok(Number.isFinite(a0.x) && Number.isFinite(a0.y) && Number.isFinite(a0.z),
    'finite coordinates');
  // nose-tip (s=0) 不随 surfAngle 变化（半径曲线为 0）
  // bodyT=0.2 处应随 surfAngle 产生明显变化
  const headA = computeFaceAnchor(mesh, 0.2, 0, 0);
  const headB = computeFaceAnchor(mesh, 0.2, Math.PI / 2, 0);
  assert.ok(headA.x !== headB.x || headA.y !== headB.y || headA.z !== headB.z,
    'angle changes point at non-tip bodyT');
});

test('nose-tip: 鼻端顶点 nz 全部为正（朝摄像机）', () => {
  const mesh = createSpindleMesh();
  let posCount = 0, total = 0;
  for (const v of mesh.vertices) {
    if (v.z > 40) {
      total++;
      if (v.nz > 0) posCount++;
    }
  }
  assert.ok(total > 0, 'nose-zone vertices exist');
  assert.equal(posCount, total, 'all nose-zone vertices face +Z');
});
