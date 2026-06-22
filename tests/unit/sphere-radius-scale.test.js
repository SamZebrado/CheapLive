import test from 'node:test';
import assert from 'node:assert/strict';
import { createSphereMesh } from '../../src/face-tracking/mesh-sphere.js';

function computeSphereRadiusScale(mesh, s) {
  const rings = mesh.rings;
  const phi = (Math.floor(s * rings) / rings) * Math.PI;
  const sinPhi = Math.sin(phi);
  return sinPhi;
}

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