import test from 'node:test';
import assert from 'node:assert/strict';
import { createSphereMesh } from '../../src/face-tracking/mesh-sphere.js';
import { radiusScale, radiusScaleDeriv } from '../../src/face-tracking/mesh-spindle-whale.js';

const SPHERE_END = 0.26;
const TAIL_RATIO = 0.035;

test('createSphereMesh: default params produce valid mesh', () => {
  const mesh = createSphereMesh();
  assert.ok(mesh.vertices.length > 0, 'has vertices');
  assert.ok(mesh.faces.length > 0, 'has faces');
  assert.strictEqual(mesh.radius, 80);
  assert.strictEqual(mesh.rings, 16);
  assert.strictEqual(mesh.segments, 24);
  assert.strictEqual(mesh.type, 'sphere');
});

test('createSphereMesh: custom params are applied', () => {
  const mesh = createSphereMesh({ radius: 100, rings: 10, segments: 20 });
  assert.strictEqual(mesh.radius, 100);
  assert.strictEqual(mesh.rings, 10);
  assert.strictEqual(mesh.segments, 20);
});

test('createSphereMesh: vertex positions are on sphere surface', () => {
  const mesh = createSphereMesh({ radius: 50, rings: 8, segments: 12 });
  for (const v of mesh.vertices) {
    const dist = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    assert.ok(Math.abs(dist - 50) < 0.1, `vertex at (${v.x},${v.y},${v.z}) is on sphere`);
  }
});

test('createSphereMesh: normals are unit vectors pointing outward', () => {
  const mesh = createSphereMesh({ radius: 50, rings: 8, segments: 12 });
  for (const v of mesh.vertices) {
    const len = Math.sqrt(v.nx * v.nx + v.ny * v.ny + v.nz * v.nz);
    assert.ok(Math.abs(len - 1) < 0.001, `normal (${v.nx},${v.ny},${v.nz}) is unit length`);
    const dot = v.x * v.nx + v.y * v.ny + v.z * v.nz;
    assert.ok(dot > 0, `normal points outward for vertex (${v.x},${v.y},${v.z})`);
  }
});

test('createSphereMesh: top vertices have negative y', () => {
  const mesh = createSphereMesh({ rings: 8, segments: 12 });
  const topRing = mesh.vertices.slice(0, mesh.segments + 1);
  for (const v of topRing) {
    assert.ok(v.y < 0, `top vertex y=${v.y} should be negative`);
  }
});

test('createSphereMesh: bottom vertices have non-negative y', () => {
  const mesh = createSphereMesh({ rings: 8, segments: 12 });
  const bottomRing = mesh.vertices.slice(-mesh.segments - 1);
  for (const v of bottomRing) {
    assert.ok(v.y >= 0, `bottom vertex y=${v.y} should be non-negative`);
  }
});

test('createSphereMesh: face isTop/isBottom consistent with vertex y', () => {
  const mesh = createSphereMesh({ rings: 8, segments: 12 });
  for (const f of mesh.faces) {
    const avgY = (f.vertices[0].y + f.vertices[1].y + f.vertices[2].y + f.vertices[3].y) * 0.25;
    assert.strictEqual(f.isTop, avgY < 0, 'face isTop matches avgY');
    assert.strictEqual(f.isBottom, avgY >= 0, 'face isBottom matches avgY');
  }
});

test('createSphereMesh: marking spot intensity is between 0 and 1', () => {
  const mesh = createSphereMesh({ rings: 8, segments: 12 });
  for (const v of mesh.vertices) {
    assert.ok(v.spot >= 0 && v.spot <= 1, `spot ${v.spot} in [0,1]`);
  }
});

test('createSphereMesh: marking spot is strongest at center', () => {
  const mesh = createSphereMesh({ rings: 16, segments: 24 });
  const markCenterPhi = Math.PI / 3;
  const markCenterTheta = Math.PI / 4;
  let maxSpot = 0;
  for (const v of mesh.vertices) {
    const dphi = v.phi - markCenterPhi;
    const dthetaRaw = v.theta - markCenterTheta;
    const dtheta = Math.atan2(Math.sin(dthetaRaw), Math.cos(dthetaRaw));
    const dist = Math.sqrt(dphi * dphi + dtheta * dtheta);
    if (dist < 0.2 && v.spot > maxSpot) {
      maxSpot = v.spot;
    }
  }
  assert.ok(maxSpot > 0.5, 'marking spot has noticeable intensity at center');
});

test('createSphereMesh: UV coordinates cover [0,1] range', () => {
  const mesh = createSphereMesh({ rings: 8, segments: 12 });
  let minU = Infinity, maxU = -Infinity;
  let minV = Infinity, maxV = -Infinity;
  for (const v of mesh.vertices) {
    if (v.u < minU) minU = v.u;
    if (v.u > maxU) maxU = v.u;
    if (v.v < minV) minV = v.v;
    if (v.v > maxV) maxV = v.v;
  }
  assert.ok(Math.abs(minU) < 0.001, 'u starts at 0');
  assert.ok(Math.abs(maxU - 1) < 0.001, 'u ends at 1');
  assert.ok(Math.abs(minV) < 0.001, 'v starts at 0');
  assert.ok(Math.abs(maxV - 1) < 0.001, 'v ends at 1');
});

test('createSphereMesh: face indices are valid references', () => {
  const mesh = createSphereMesh({ rings: 8, segments: 12 });
  const maxIndex = mesh.vertices.length - 1;
  for (const f of mesh.faces) {
    for (const idx of f.indices) {
      assert.ok(idx >= 0 && idx <= maxIndex, `index ${idx} is valid`);
    }
  }
});

test('createSphereMesh: face vertices match indices', () => {
  const mesh = createSphereMesh({ rings: 8, segments: 12 });
  for (const f of mesh.faces) {
    for (let i = 0; i < 4; i++) {
      const idx = f.indices[i];
      const v = f.vertices[i];
      assert.strictEqual(v.originalIndex, idx, 'face vertex matches index');
    }
  }
});

test('radiusScale: nose tip (s=0) has r=0', () => {
  const r = radiusScale(0);
  assert.ok(Math.abs(r) < 1e-10, 'nose tip r=0');
});

test('radiusScale: maximum at SPHERE_END (s=0.26) has r=1', () => {
  const r = radiusScale(SPHERE_END);
  assert.ok(Math.abs(r - 1) < 1e-10, 'maximum at SPHERE_END is 1');
});

test('radiusScale: tail end (s=1) has r=TAIL_RATIO=0.035', () => {
  const r = radiusScale(1);
  assert.ok(Math.abs(r - TAIL_RATIO) < 1e-6, 'tail end r=TAIL_RATIO');
});

test('radiusScale: head region is hemispherical (s <= SPHERE_END)', () => {
  for (let s = 0; s <= SPHERE_END; s += 0.01) {
    const expected = Math.sqrt(Math.max(0, SPHERE_END * SPHERE_END - Math.pow(SPHERE_END - s, 2))) / SPHERE_END;
    const actual = radiusScale(s);
    assert.ok(Math.abs(actual - expected) < 1e-10, `hemispherical at s=${s}`);
  }
});

test('radiusScale: body region is cosine decay (s > SPHERE_END)', () => {
  for (let s = SPHERE_END + 0.01; s <= 1; s += 0.05) {
    const t = (s - SPHERE_END) / (1 - SPHERE_END) * (Math.PI / 2);
    const expected = TAIL_RATIO + (1 - TAIL_RATIO) * Math.cos(t);
    const actual = radiusScale(s);
    assert.ok(Math.abs(actual - expected) < 1e-10, `cosine decay at s=${s}`);
  }
});

test('radiusScale: monotonic decreasing after SPHERE_END', () => {
  let prev = radiusScale(SPHERE_END);
  for (let s = SPHERE_END + 0.01; s <= 1; s += 0.01) {
    const curr = radiusScale(s);
    assert.ok(curr <= prev, `monotonic decreasing at s=${s}`);
    prev = curr;
  }
});

test('radiusScale: continuous at SPHERE_END boundary', () => {
  const rLeft = radiusScale(SPHERE_END - 0.0001);
  const rRight = radiusScale(SPHERE_END + 0.0001);
  const rCenter = radiusScale(SPHERE_END);
  assert.ok(Math.abs(rLeft - rCenter) < 1e-6, 'left continuous');
  assert.ok(Math.abs(rRight - rCenter) < 1e-6, 'right continuous');
});

test('radiusScaleDeriv: nose tip derivative is positive (expanding)', () => {
  const deriv = radiusScaleDeriv(0);
  assert.ok(deriv > 0, 'nose tip expanding');
});

test('radiusScaleDeriv: derivative at SPHERE_END is zero (smooth shoulder)', () => {
  const deriv = radiusScaleDeriv(SPHERE_END);
  assert.ok(Math.abs(deriv) < 0.01, 'smooth shoulder at SPHERE_END');
});

test('radiusScaleDeriv: derivative at tail is negative (contracting)', () => {
  const deriv = radiusScaleDeriv(1);
  assert.ok(deriv < 0, 'tail contracting');
});

test('radiusScaleDeriv: all derivatives are finite', () => {
  for (let s = 0; s <= 1; s += 0.01) {
    const deriv = radiusScaleDeriv(s);
    assert.ok(Number.isFinite(deriv), `derivative at s=${s} is finite`);
    assert.ok(!Number.isNaN(deriv), `derivative at s=${s} is not NaN`);
  }
});

test('radiusScale: values are always in [0, 1] range for s in [0,1]', () => {
  for (let s = 0; s <= 1; s += 0.01) {
    const r = radiusScale(s);
    assert.ok(r >= 0 && r <= 1, `radiusScale(${s}) = ${r} in [0,1]`);
  }
});

test('radiusScale: values at boundary extremes are valid', () => {
  const r0 = radiusScale(0);
  const r1 = radiusScale(1);
  assert.ok(Number.isFinite(r0), 'r(0) is finite');
  assert.ok(Number.isFinite(r1), 'r(1) is finite');
});

test('radiusScaleDeriv: finite difference approximation is accurate', () => {
  const h = 0.0001;
  for (let s = 0.01; s < 0.99; s += 0.1) {
    const numerical = (radiusScale(s + h) - radiusScale(s - h)) / (2 * h);
    const analytical = radiusScaleDeriv(s);
    assert.ok(Math.abs(numerical - analytical) < 0.1, `finite difference at s=${s}`);
  }
});

test('radiusScaleDeriv: boundary points use forward/backward difference', () => {
  const h = 0.002;
  const deriv0 = radiusScaleDeriv(0);
  const expected0 = (radiusScale(h) - radiusScale(0)) / h;
  assert.ok(Math.abs(deriv0 - expected0) < 1e-10, 'forward difference at s=0');

  const deriv1 = radiusScaleDeriv(1);
  const expected1 = (radiusScale(1) - radiusScale(1 - h)) / h;
  assert.ok(Math.abs(deriv1 - expected1) < 1e-10, 'backward difference at s=1');
});