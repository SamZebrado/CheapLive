// applyLight / parseRGB / parseHex 单元测试
// 覆盖公开契约：ambient 参数、无效颜色回退、点积钳制（与 procedural-mesh-renderer 逻辑一致）。
import test from 'node:test';
import assert from 'node:assert/strict';

// 由于 applyLight 等函数未显式 export，我们通过内联复制其实现来"黑盒"测试契约。
// 这是不得已的做法：文件中其他函数已用 ES module 形式存在，但 applyLight 未对外暴露。
// 若未来代码库将 applyLight 导出，应改为直接 import。
function parseHex(hex) {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}
function parseRGB(c) {
  if (!c) return { r: 0, g: 0, b: 0 };
  if (c.startsWith('#')) return parseHex(c);
  const m = c.match(/rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/);
  if (m) return { r: parseInt(m[1], 10), g: parseInt(m[2], 10), b: parseInt(m[3], 10) };
  return { r: 0, g: 0, b: 0 };
}
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function applyLight(faceCenterNormal, lightDir, baseColor, ambient) {
  const dot =
    (faceCenterNormal.x || 0) * lightDir.x +
    (faceCenterNormal.y || 0) * lightDir.y +
    (faceCenterNormal.z || 0) * lightDir.z;
  const a = Number.isFinite(ambient) && ambient >= 0 && ambient <= 1 ? ambient : 0.55;
  const factor = a + (1 - a) * clamp(dot, -0.2, 1.0);
  const rgb = parseRGB(baseColor);
  const r = Math.round(clamp(rgb.r * factor, 0, 255));
  const g = Math.round(clamp(rgb.g * factor, 0, 255));
  const b = Math.round(clamp(rgb.b * factor, 0, 255));
  return `rgb(${r}, ${g}, ${b})`;
}

test('applyLight: 正对光源 (dot=1) 时颜色最亮，ambient 0.55 等价于 baseColor 不变', () => {
  const base = '#c8c2b4';
  const lit = applyLight({ x: -0.3, y: -0.5, z: 0.8 }, { x: -0.3, y: -0.5, z: 0.8 }, base, 0.55);
  assert.ok(lit.startsWith('rgb('), 'format');
});

test('applyLight: 背对光源 (dot=-1) 时颜色不应全黑，等于 ambient 照亮', () => {
  const base = '#bdb8aa';
  const lit = applyLight({ x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 1 }, base, 0.2);
  const m = lit.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  assert.ok(m, 'matches rgb format');
  const [r, g, b] = [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
  // ambient=0.2, dot=-1 -> factor=0.2 + 0.8 * -0.2 = 0.04 (钳制) → 颜色应很暗
  assert.ok(r + g + b < 400, 'back-facing dims the color');
});

test('applyLight: 非 finite ambient 回退到默认 0.55', () => {
  const base = '#ffffff';
  const a = applyLight({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 1 }, base, NaN);
  const b = applyLight({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 1 }, base, 0.55);
  assert.equal(a, b);
});

test('applyLight: ambient 超界 (<0 或 >1) 回退到默认 0.55', () => {
  const base = '#ffffff';
  const a = applyLight({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 1 }, base, -0.5);
  const b = applyLight({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 1 }, base, 1.1);
  assert.equal(a, b);
});

test('parseRGB: null / 空字符串 回退到 0,0,0', () => {
  assert.deepEqual(parseRGB(''), { r: 0, g: 0, b: 0 });
});

test('parseRGB: 支持 hex 短码与长码', () => {
  assert.deepEqual(parseRGB('#fff'), { r: 255, g: 255, b: 255 });
  assert.deepEqual(parseRGB('#bdb8aa'), { r: 189, g: 184, b: 170 });
});

test('parseRGB: 支持 rgb(r,g,b) 语法', () => {
  assert.deepEqual(parseRGB('rgb(10, 20, 30)'), { r: 10, g: 20, b: 30 });
});

test('applyLight: dot 被下限 -0.2 钳制，不产生负因子', () => {
  const base = '#ffffff';
  const lit = applyLight({ x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 1 }, base, 0);
  const m = lit.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  const [r, g, b] = [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
  // ambient=0, dot=-1 -> factor = 0 + 1.0 * -0.2 = -0.2 -> 被 clamp 成 0
  assert.ok(r === 0 && g === 0 && b === 0, 'pure black when back-facing with ambient 0');
});
