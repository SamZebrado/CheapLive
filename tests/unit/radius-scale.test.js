import test from 'node:test';
import assert from 'node:assert/strict';

function smoothstep01(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

const SPHERE_END = 0.26;

function radiusScale(s) {
  if (s <= SPHERE_END) {
    const rel = SPHERE_END - s;
    const r2 = SPHERE_END * SPHERE_END - rel * rel;
    return Math.sqrt(Math.max(0, r2)) / SPHERE_END;
  }
  const TAIL_RATIO = 0.035;
  const t = (s - SPHERE_END) / (1 - SPHERE_END) * (Math.PI / 2);
  return TAIL_RATIO + (1 - TAIL_RATIO) * Math.cos(t);
}

function radiusScaleDeriv(s) {
  const h = 0.002;
  if (s <= h) return (radiusScale(s + h) - radiusScale(s)) / h;
  if (s >= 1 - h) return (radiusScale(s) - radiusScale(s - h)) / h;
  return (radiusScale(s + h) - radiusScale(s - h)) / (2 * h);
}

test('radiusScale: nose tip (s=0) has r=0', () => {
  assert.ok(Math.abs(radiusScale(0)) < 1e-10, 'r(0) = 0');
});

test('radiusScale: maximum at SPHERE_END (s=0.26) has r=1', () => {
  assert.ok(Math.abs(radiusScale(SPHERE_END) - 1) < 1e-10, 'r(SPHERE_END) = 1');
});

test('radiusScale: tail end (s=1) has r=TAIL_RATIO=0.035', () => {
  assert.ok(Math.abs(radiusScale(1) - 0.035) < 1e-10, 'r(1) = 0.035');
});

test('radiusScale: head region is hemispherical (s <= SPHERE_END)', () => {
  for (let i = 0; i <= 10; i++) {
    const s = (i / 10) * SPHERE_END;
    const expected = Math.sqrt(1 - Math.pow((SPHERE_END - s) / SPHERE_END, 2));
    assert.ok(Math.abs(radiusScale(s) - expected) < 1e-10, `r(${s}) matches hemisphere`);
  }
});

test('radiusScale: body region is cosine decay (s > SPHERE_END)', () => {
  for (let i = 1; i <= 10; i++) {
    const s = SPHERE_END + (i / 10) * (1 - SPHERE_END);
    const TAIL_RATIO = 0.035;
    const t = (s - SPHERE_END) / (1 - SPHERE_END) * (Math.PI / 2);
    const expected = TAIL_RATIO + (1 - TAIL_RATIO) * Math.cos(t);
    assert.ok(Math.abs(radiusScale(s) - expected) < 1e-10, `r(${s}) matches cosine decay`);
  }
});

test('radiusScale: monotonic decreasing after SPHERE_END', () => {
  for (let i = 0; i < 50; i++) {
    const s1 = SPHERE_END + (i / 50) * (1 - SPHERE_END);
    const s2 = SPHERE_END + ((i + 1) / 50) * (1 - SPHERE_END);
    assert.ok(radiusScale(s2) <= radiusScale(s1), `r(${s2}) <= r(${s1})`);
  }
});

test('radiusScale: continuous at SPHERE_END boundary', () => {
  const left = radiusScale(SPHERE_END - 1e-8);
  const right = radiusScale(SPHERE_END + 1e-8);
  assert.ok(Math.abs(left - right) < 1e-5, 'continuous at boundary');
});

test('radiusScaleDeriv: nose tip derivative is positive (expanding)', () => {
  const deriv = radiusScaleDeriv(0);
  assert.ok(deriv > 0, 'dr/ds > 0 at nose tip');
});

test('radiusScaleDeriv: derivative at SPHERE_END is zero (smooth shoulder)', () => {
  const deriv = radiusScaleDeriv(SPHERE_END);
  assert.ok(Math.abs(deriv) < 0.1, 'dr/ds ≈ 0 at SPHERE_END');
});

test('radiusScaleDeriv: derivative at tail is negative (contracting)', () => {
  const deriv = radiusScaleDeriv(0.9);
  assert.ok(deriv < 0, 'dr/ds < 0 at tail region');
});

test('radiusScaleDeriv: all derivatives are finite', () => {
  for (let i = 0; i <= 100; i++) {
    const s = i / 100;
    const deriv = radiusScaleDeriv(s);
    assert.ok(Number.isFinite(deriv), `derivative at s=${s} is finite, got ${deriv}`);
  }
});

test('radiusScale: values are always in [0, 1] range', () => {
  for (let i = 0; i <= 100; i++) {
    const s = i / 100;
    const r = radiusScale(s);
    assert.ok(r >= 0, `r(${s}) >= 0`);
    assert.ok(r <= 1, `r(${s}) <= 1`);
  }
});

test('radiusScale: values at boundary extremes are valid', () => {
  const rNeg = radiusScale(-0.5);
  assert.ok(Number.isFinite(rNeg), 'negative s produces finite result');
  const rOver = radiusScale(1.5);
  assert.ok(Number.isFinite(rOver), 's > 1 produces finite result');
});