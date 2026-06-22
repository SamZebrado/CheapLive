import test from 'node:test';
import assert from 'node:assert/strict';
import { applyLightTest, parseRGBTest, parseHexTest } from '../../src/face-tracking/procedural-mesh-renderer.js';

test('applyLight: 正对光源 (dot=1) 时颜色最亮，ambient 0.55 等价于 baseColor 不变', () => {
  const base = '#c8c2b4';
  const lit = applyLightTest({ x: -0.3, y: -0.5, z: 0.8 }, { x: -0.3, y: -0.5, z: 0.8 }, base, 0.55);
  assert.equal(lit, 'rgb(198, 192, 178)', 'exact output matches baseColor');
});

test('applyLight: 背对光源 (dot=-1) 时颜色不应全黑，等于 ambient 照亮', () => {
  const base = '#bdb8aa';
  const lit = applyLightTest({ x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 1 }, base, 0.2);
  const m = lit.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  assert.ok(m, 'matches rgb format');
  const [r, g, b] = [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
  assert.ok(r + g + b < 400, 'back-facing dims the color');
  const factor = 0.2 + 0.8 * (-0.2);
  assert.ok(Math.abs(r - Math.round(189 * factor)) < 2, 'r matches expected');
  assert.ok(Math.abs(g - Math.round(184 * factor)) < 2, 'g matches expected');
  assert.ok(Math.abs(b - Math.round(170 * factor)) < 2, 'b matches expected');
});

test('applyLight: 非 finite ambient 回退到默认 0.55', () => {
  const base = '#ffffff';
  const a = applyLightTest({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 1 }, base, NaN);
  const b = applyLightTest({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 1 }, base, 0.55);
  assert.equal(a, b);
});

test('applyLight: ambient 超界 (<0 或 >1) 回退到默认 0.55', () => {
  const base = '#ffffff';
  const a = applyLightTest({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 1 }, base, -0.5);
  const b = applyLightTest({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 1 }, base, 1.1);
  assert.equal(a, b);
});

test('parseRGB: null / 空字符串 回退到 0,0,0', () => {
  assert.deepEqual(parseRGBTest(''), { r: 0, g: 0, b: 0 });
});

test('parseRGB: 支持 hex 短码与长码', () => {
  assert.deepEqual(parseRGBTest('#fff'), { r: 255, g: 255, b: 255 });
  assert.deepEqual(parseRGBTest('#bdb8aa'), { r: 189, g: 184, b: 170 });
});

test('parseRGB: 支持 rgb(r,g,b) 语法', () => {
  assert.deepEqual(parseRGBTest('rgb(10, 20, 30)'), { r: 10, g: 20, b: 30 });
});

test('applyLight: dot 被下限 -0.2 钳制，不产生负因子', () => {
  const base = '#ffffff';
  const lit = applyLightTest({ x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 1 }, base, 0);
  const m = lit.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  const [r, g, b] = [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
  assert.ok(r === 0 && g === 0 && b === 0, 'pure black when back-facing with ambient 0');
});

test('parseHex: 短码转换正确', () => {
  assert.deepEqual(parseHexTest('#f00'), { r: 255, g: 0, b: 0 });
  assert.deepEqual(parseHexTest('#0f0'), { r: 0, g: 255, b: 0 });
  assert.deepEqual(parseHexTest('#00f'), { r: 0, g: 0, b: 255 });
});

test('parseHex: 长码转换正确', () => {
  assert.deepEqual(parseHexTest('#ff0000'), { r: 255, g: 0, b: 0 });
  assert.deepEqual(parseHexTest('#00ff00'), { r: 0, g: 255, b: 0 });
  assert.deepEqual(parseHexTest('#0000ff'), { r: 0, g: 0, b: 255 });
  assert.deepEqual(parseHexTest('#bdb8aa'), { r: 189, g: 184, b: 170 });
});

test('parseHex: 无 # 前缀也能解析', () => {
  assert.deepEqual(parseHexTest('bdb8aa'), { r: 189, g: 184, b: 170 });
});

test('applyLight: exact output for ambient=0.55, dot=1, white', () => {
  const result = applyLightTest({ x: 1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, '#ffffff', 0.55);
  assert.equal(result, 'rgb(255, 255, 255)', 'white stays white');
});

test('applyLight: exact output for ambient=0.55, dot=0, white', () => {
  const result = applyLightTest({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, '#ffffff', 0.55);
  assert.equal(result, 'rgb(140, 140, 140)', 'ambient only: 255 * 0.55');
});

test('applyLight: exact output for ambient=0.55, dot=-0.2, white', () => {
  const result = applyLightTest({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }, '#ffffff', 0.55);
  const factor = 0.55 + 0.45 * (-0.2);
  const expected = Math.round(255 * factor);
  assert.ok(result.includes(`rgb(${expected}, ${expected}, ${expected})`), 'clamped dot product');
});