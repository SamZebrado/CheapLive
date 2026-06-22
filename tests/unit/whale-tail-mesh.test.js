import test from 'node:test';
import assert from 'node:assert/strict';
import { createWhaleTailMesh } from '../../src/face-tracking/mesh-spindle-whale.js';

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

test('createWhaleTailMesh: default configuration produces valid mesh', () => {
  const mesh = createWhaleTailMesh();
  assert.ok(mesh.vertices, 'vertices array exists');
  assert.ok(mesh.faces, 'faces array exists');
  assert.ok(mesh.vertices.length > 0, 'has vertices');
  assert.ok(mesh.faces.length > 0, 'has faces');
  assert.equal(mesh.type, 'whaleTail', 'type is whaleTail');
});

test('createWhaleTailMesh: default has 6 vertices and 4 triangle faces', () => {
  const mesh = createWhaleTailMesh();
  assert.equal(mesh.vertices.length, 6, 'default has 6 vertices');
  const c = classifyFaces(mesh);
  assert.equal(c.tri, 4, 'default has 4 triangle faces');
  assert.equal(c.quad, 0, 'no quad faces');
  assert.equal(c.other, 0, 'no other polygon types');
});

test('createWhaleTailMesh: vertex positions are finite', () => {
  const mesh = createWhaleTailMesh();
  for (const v of mesh.vertices) {
    assert.ok(Number.isFinite(v.x), `x is finite, got ${v.x}`);
    assert.ok(Number.isFinite(v.y), `y is finite, got ${v.y}`);
    assert.ok(Number.isFinite(v.z), `z is finite, got ${v.z}`);
    assert.ok(Number.isFinite(v.nx), `nx is finite, got ${v.nx}`);
    assert.ok(Number.isFinite(v.ny), `ny is finite, got ${v.ny}`);
    assert.ok(Number.isFinite(v.nz), `nz is finite, got ${v.nz}`);
  }
});

test('createWhaleTailMesh: tail tip extends in -Z direction', () => {
  const mesh = createWhaleTailMesh({ tailLength: 60 });
  const vR = mesh.vertices[0];
  const vT = mesh.vertices[5];
  assert.ok(vT.z < vR.z, 'tail tip is behind base');
  assert.equal(vT.z, -60, 'tail tip at expected Z position');
});

test('createWhaleTailMesh: top vertex is above base (-Y), bottom is below (+Y)', () => {
  const mesh = createWhaleTailMesh({ flukeHalfHeight: 28 });
  const vR = mesh.vertices[0];
  const vA = mesh.vertices[1];
  const vC = mesh.vertices[2];
  assert.ok(vA.y < vR.y, 'top vertex (A) is above base');
  assert.ok(vC.y > vR.y, 'bottom vertex (C) is below base');
  assert.equal(vA.y, -28, 'top vertex at expected Y');
  assert.equal(vC.y, 28, 'bottom vertex at expected Y');
});

test('createWhaleTailMesh: left vertex is at -X, right at +X', () => {
  const mesh = createWhaleTailMesh({ baseHalfWidth: 12 });
  const vR = mesh.vertices[0];
  const vBL = mesh.vertices[3];
  const vBR = mesh.vertices[4];
  assert.ok(vBL.x < vR.x, 'left vertex (BL) is left of base');
  assert.ok(vBR.x > vR.x, 'right vertex (BR) is right of base');
});

test('createWhaleTailMesh: all face indices are valid', () => {
  const mesh = createWhaleTailMesh();
  const c = classifyFaces(mesh);
  assert.equal(c.indexOutOfRange, 0, 'all indices are within range');
});

test('createWhaleTailMesh: all faces are non-degenerate (positive area)', () => {
  const mesh = createWhaleTailMesh();
  for (const f of mesh.faces) {
    if (f.indices.length !== 3) continue;
    const [a, b, c] = f.indices;
    const va = mesh.vertices[a], vb = mesh.vertices[b], vc = mesh.vertices[c];
    const ux = vb.x - va.x, uy = vb.y - va.y, uz = vb.z - va.z;
    const vx = vc.x - va.x, vy = vc.y - va.y, vz = vc.z - va.z;
    const cx = uy * vz - uz * vy;
    const cy = uz * vx - ux * vz;
    const cz = ux * vy - uy * vx;
    const areaSq = cx * cx + cy * cy + cz * cz;
    assert.ok(areaSq > 1e-10, `face ${f.indices} has positive area`);
  }
});

test('createWhaleTailMesh: custom options are respected', () => {
  const mesh = createWhaleTailMesh({
    tailLength: 80,
    flukeHalfWidth: 30,
    flukeHalfHeight: 35,
    baseHalfWidth: 15,
    baseHalfHeight: 18,
  });
  const vT = mesh.vertices[5];
  assert.equal(vT.z, -80, 'custom tailLength respected');
  assert.equal(mesh.tailLength, 80, 'tailLength property set');
  assert.equal(mesh.tailWidth, 60, 'tailWidth is twice flukeHalfWidth');
});

test('createWhaleTailMesh: color option defaults to gray', () => {
  const mesh = createWhaleTailMesh();
  assert.equal(mesh.color, '#bdb8aa', 'default color is gray');
});

test('createWhaleTailMesh: custom color option is respected', () => {
  const mesh = createWhaleTailMesh({ color: '#ff0000' });
  assert.equal(mesh.color, '#ff0000', 'custom color respected');
});

test('createWhaleTailMesh: face properties are correctly set', () => {
  const mesh = createWhaleTailMesh();
  for (const f of mesh.faces) {
    assert.ok(f.doubleSided, 'all tail faces are double-sided');
    assert.ok(f.vertices && f.vertices.length === 3, 'each face has 3 vertices');
  }
});