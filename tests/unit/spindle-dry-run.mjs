// spindle mesh dry-run: 多 yaw 下可见性、退化面、鼻端 nz 等不变量。
// 作为持续监测工具，不依赖浏览器；也可直接在 CI 运行。
import { createSpindleMesh, deformSpindle } from '../../src/face-tracking/mesh-spindle-whale.js';

let exitCode = 0;
function fail(msg) {
  console.error('  FAIL:', msg);
  exitCode = 1;
}

function analyze(mesh, yawDeg, pitchDeg) {
  const deformed = deformSpindle(mesh, {
    angleY: yawDeg,
    angleX: pitchDeg,
    angleZ: 0,
  });
  let visible = 0, hidden = 0, degenerate = 0;
  let nzMin = Infinity, nzMax = -Infinity;
  let indexOutOfRange = 0;
  for (const f of deformed.faces) {
    if (!f.vertices || f.vertices.length < 3) { degenerate++; continue; }
    let sumNz = 0;
    for (const v of f.vertices) {
      if (!Number.isFinite(v.nz)) { degenerate++; sumNz = NaN; break; }
      sumNz += v.nz;
    }
    if (!Number.isFinite(sumNz)) continue;
    const avgNz = sumNz / f.vertices.length;
    if (avgNz < nzMin) nzMin = avgNz;
    if (avgNz > nzMax) nzMax = avgNz;
    if (avgNz > -0.05) visible++; else hidden++;
  }
  for (const f of deformed.faces) {
    for (const i of f.indices) {
      if (i < 0 || i >= deformed.vertices.length) indexOutOfRange++;
    }
  }
  return { visible, hidden, degenerate, nzMin, nzMax, indexOutOfRange };
}

console.log('=== spindle dry-run ===');
const mesh = createSpindleMesh();
console.log(' vertices:', mesh.vertices.length, 'faces:', mesh.faces.length);

const cases = [0, -30, 30, -45, 45, -60, 60];
for (const y of cases) {
  const r = analyze(mesh, y, 0);
  console.log(` yaw=${y}: visible=${r.visible}, hidden=${r.hidden}, degenerate=${r.degenerate}, nzMin=${r.nzMin.toFixed(2)}, nzMax=${r.nzMax.toFixed(2)}`);
  if (r.visible < 150) fail(`yaw=${y} visible<150`);
  if (r.degenerate !== 0) fail(`yaw=${y} degenerate>0`);
  if (r.indexOutOfRange !== 0) fail(`yaw=${y} index out of range`);
}

console.log('=== fluke mode: triangle count ===');
const withFluke = createSpindleMesh();
const noFluke = createSpindleMesh({ flukeEnabled: false });
function countShapes(m) {
  let tri = 0, quad = 0, other = 0;
  for (const f of m.faces) {
    const n = f.indices.length;
    if (n === 3) tri++;
    else if (n === 4) quad++;
    else other++;
  }
  return { tri, quad, other };
}
console.log(' with fluke:', countShapes(withFluke));
console.log(' without fluke:', countShapes(noFluke));

console.log('=== nose-tip nz direction ===');
let pos = 0, neg = 0;
for (const v of mesh.vertices) {
  if (v.z > 40) { if (v.nz > 0) pos++; else neg++; }
}
console.log(' nose-zone positive:', pos, 'negative:', neg);
if (pos <= neg) fail('nose-zone not dominated by positive nz');

console.log('SPINDLE_DRY_RUN_OK=' + (exitCode === 0));
process.exit(exitCode);
