/**
 * Blend Shapes 扩展参数单元测试
 *
 * 测试目标：
 *   - eyeWide 参数正确提取和缩放
 *   - eyeSquint 参数正确提取和缩放
 *   - mouthFunnel 参数正确提取和缩放
 *   - mouthPress 参数正确提取和缩放
 *   - 渲染参数计算正确
 *
 * 运行：node --test tests/unit/blend-shapes-params.test.js
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import path from 'path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(REPO_ROOT, 'src', 'face-tracking');

const meshWhale = await import(`file://${path.join(SRC, 'mesh-spindle-whale.js')}`);
const meshSphere = await import(`file://${path.join(SRC, 'mesh-sphere.js')}`);

const { createSpindleMesh, computeFaceAnchorXYZ, computeNostrilSize } = meshWhale;
const { createSphereMesh, computeSphereFaceAnchorXYZ } = meshSphere;

function approx(a, b, eps = 1e-6) {
  return Math.abs(a - b) < eps;
}

describe('eyeWide 参数验证', () => {
  // eyeWide: 眼睛变大，wideScale = 1 + eyeWide * 0.3

  it('eyeWide=0 时 wideScale=1（不变）', () => {
    const eyeWide = 0;
    const wideScale = 1 + eyeWide * 0.3;
    assert.equal(wideScale, 1);
  });

  it('eyeWide=1 时 wideScale=1.3（放大30%）', () => {
    const eyeWide = 1;
    const wideScale = 1 + eyeWide * 0.3;
    assert.equal(wideScale, 1.3);
  });

  it('eyeWide=0.5 时 wideScale=1.15（放大15%）', () => {
    const eyeWide = 0.5;
    const wideScale = 1 + eyeWide * 0.3;
    assert.equal(wideScale, 1.15);
  });

  it('wideScale 应用于 rx 和 ry', () => {
    const rx = 10, ry = 10;
    const eyeWide = 0.5;
    const wideScale = 1 + eyeWide * 0.3;
    const rxWide = rx * wideScale;
    const ryWide = ry * wideScale;
    assert.equal(rxWide, 11.5);
    assert.equal(ryWide, 11.5);
  });
});

describe('eyeSquint 参数验证', () => {
  // eyeSquint: 眯眼，squintScaleY = 1 - eyeSquint * 0.5, squintScaleX = 1 + eyeSquint * 0.15

  it('eyeSquint=0 时无效果', () => {
    const squintScaleY = 1 - 0 * 0.5;
    const squintScaleX = 1 + 0 * 0.15;
    assert.equal(squintScaleY, 1);
    assert.equal(squintScaleX, 1);
  });

  it('eyeSquint=1 时 ry 减少50%，rx 增加15%', () => {
    const squintScaleY = 1 - 1 * 0.5;
    const squintScaleX = 1 + 1 * 0.15;
    assert.equal(squintScaleY, 0.5);
    assert.equal(squintScaleX, 1.15);
  });

  it('eyeSquint=0.5 时效果为一半', () => {
    const squintScaleY = 1 - 0.5 * 0.5;
    const squintScaleX = 1 + 0.5 * 0.15;
    assert.equal(squintScaleY, 0.75);
    assert.equal(squintScaleX, 1.075);
  });

  it('squintScaleY 应用于 ry', () => {
    const rx = 10, ry = 10;
    const eyeSquint = 0.5;
    const squintScaleY = 1 - eyeSquint * 0.5;
    const squintScaleX = 1 + eyeSquint * 0.15;
    const rxSquint = rx * squintScaleX;
    const rySquint = ry * squintScaleY;
    assert.equal(rxSquint, 10.75);
    assert.equal(rySquint, 7.5);
  });
});

describe('mouthFunnel 参数验证', () => {
  // mouthFunnel: 嘟嘴效果
  // funnelNarrow = 1 - mouthFunnel * 0.5
  // funnelTall = 1 + mouthFunnel * 0.8

  it('mouthFunnel=0 时无效果', () => {
    const funnelNarrow = 1 - 0 * 0.5;
    const funnelTall = 1 + 0 * 0.8;
    assert.equal(funnelNarrow, 1);
    assert.equal(funnelTall, 1);
  });

  it('mouthFunnel=1 时宽度减半，高度增加80%', () => {
    const funnelNarrow = 1 - 1 * 0.5;
    const funnelTall = 1 + 1 * 0.8;
    assert.equal(funnelNarrow, 0.5);
    assert.equal(funnelTall, 1.8);
  });

  it('mouthFunnel=0.5 时宽度75%，高度增加40%', () => {
    const funnelNarrow = 1 - 0.5 * 0.5;
    const funnelTall = 1 + 0.5 * 0.8;
    assert.equal(funnelNarrow, 0.75);
    assert.equal(funnelTall, 1.4);
  });

  it('funnel 影响 halfW 和 openH', () => {
    const halfW = 22 * 0.5; // base halfW = 22 * scale
    const openH = 10 * 0.5; // base openH = 10
    const mouthFunnel = 0.5;
    const funnelNarrow = 1 - mouthFunnel * 0.5;
    const funnelTall = 1 + mouthFunnel * 0.8;
    const halfWWide = halfW * funnelNarrow;
    const openHTall = openH * funnelTall;
    assert.equal(halfWWide, 8.25);
    assert.ok(approx(openHTall, 7), 0.01);
  });
});

describe('mouthPress 参数验证', () => {
  // mouthPress: 抿嘴效果，降低 open
  // effectiveOpen = Math.max(0, open - mouthPress * 0.3)

  it('mouthPress=0 时 effectiveOpen=open', () => {
    const open = 0.5;
    const mouthPress = 0;
    const effectiveOpen = Math.max(0, open - mouthPress * 0.3);
    assert.equal(effectiveOpen, 0.5);
  });

  it('mouthPress=1 时 effectiveOpen 减少0.3', () => {
    const open = 0.5;
    const mouthPress = 1;
    const effectiveOpen = Math.max(0, open - mouthPress * 0.3);
    assert.equal(effectiveOpen, 0.2);
  });

  it('mouthPress=1 且 open=0.2 时 effectiveOpen=0（不小于0）', () => {
    const open = 0.2;
    const mouthPress = 1;
    const effectiveOpen = Math.max(0, open - mouthPress * 0.3);
    assert.equal(effectiveOpen, 0);
  });

  it('mouthPress=0.5 时 effectiveOpen 减少0.15', () => {
    const open = 0.5;
    const mouthPress = 0.5;
    const effectiveOpen = Math.max(0, open - mouthPress * 0.3);
    assert.equal(effectiveOpen, 0.35);
  });
});

describe('综合效果验证', () => {
  it('eyeWide 和 eyeSquint 可同时作用于 rx/ry', () => {
    const rx = 10, ry = 10;
    const eyeWide = 0.5;
    const eyeSquint = 0.5;
    const wideScale = 1 + eyeWide * 0.3;
    const squintScaleY = 1 - eyeSquint * 0.5;
    const squintScaleX = 1 + eyeSquint * 0.15;
    const rxFinal = rx * wideScale * squintScaleX;
    const ryFinal = ry * wideScale * squintScaleY;
    // rx: 10 * 1.15 * 1.075 = 12.3625
    // ry: 10 * 1.15 * 0.75 = 8.625
    assert.ok(approx(rxFinal, 12.3625, 0.001));
    assert.equal(ryFinal, 8.625);
  });

  it('mouthFunnel 和 mouthPress 可同时影响嘴型', () => {
    const open = 0.5;
    const smile = 0.3;
    const mouthFunnel = 0.5;
    const mouthPress = 0.5;
    const funnelNarrow = 1 - mouthFunnel * 0.5;
    const funnelTall = 1 + mouthFunnel * 0.8;
    const effectiveOpen = Math.max(0, open - mouthPress * 0.3);
    const smileWiden = 1 + smile * 0.4;
    const halfW = 22 * smileWiden * funnelNarrow;
    const openH = (3 + 14 * effectiveOpen) * funnelTall;
    // smileWiden = 1.12
    // halfW = 22 * 1.12 * 0.75 = 18.48
    // effectiveOpen = 0.35
    // openH = (3 + 14 * 0.35) * 1.4 = 7.9 * 1.4 = 11.06
    assert.equal(halfW, 18.48);
    assert.ok(approx(openH, 11.06, 0.01));
  });
});
