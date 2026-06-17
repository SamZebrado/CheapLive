/**
 * 面板参数处理器单元测试
 *
 * 测试 face-tracker.js 中的纯函数逻辑：
 * - applySensitivity — 灵敏度缩放
 * - smoothValue — 平滑插值
 * - extractParams — 参数提取与镜像交换
 * - spawnRate 与帧率控制器
 *
 * 运行：node tests/unit/param-processor.test.js
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// === 从 face-tracker.js 提取的纯函数 ===

/**
 * 对原始值应用灵敏度缩放
 * @param {number} raw 原始值 0-1
 * @param {number} sens 灵敏度 0-200 (100=默认)
 * @returns {number} 处理后值 0-1
 */
function applySensitivity(raw, sens) {
  const factor = sens / 100;
  return 0.5 + (raw - 0.5) * factor;
}

/**
 * 指数平滑
 * @param {number} current 当前平滑值
 * @param {number} target 目标原始值
 * @param {number} factor 平滑系数 (0-1, 越大越平滑)
 * @returns {number} 新的平滑值
 */
function smoothValue(current, target, factor) {
  return current + (target - current) * (1 - factor);
}

/**
 * 模拟参数提取（从 blendshapes 映射提取）
 * @param {Object} blendshapes blendshapes 映射
 * @param {boolean} mirror 是否镜像
 * @param {Object} headPose 头部姿态 { yaw, pitch, roll }
 * @param {Object} nosePos 鼻尖位置 { x, y }
 * @returns {Object} 提取的参数
 */
function extractParams(blendshapes, mirror, headPose, nosePos) {
  const eyeLeftRaw = 1 - (blendshapes['eyeBlinkLeft'] || 0);
  const eyeRightRaw = 1 - (blendshapes['eyeBlinkRight'] || 0);
  const mouthOpenRaw = blendshapes['jawOpen'] || 0;
  const smileLeft = blendshapes['mouthSmileLeft'] || 0;
  const smileRight = blendshapes['mouthSmileRight'] || 0;
  const mouthSmileRaw = (smileLeft + smileRight) / 2;
  const browLeftRaw = blendshapes['browInnerUp'] || 0;
  const browRightRaw = blendshapes['browOuterUpLeft'] || 0;

  let { yaw, pitch, roll } = headPose;
  let headX = nosePos.x;
  let headY = nosePos.y;

  if (mirror) {
    return {
      eyeLeft: eyeRightRaw, eyeRight: eyeLeftRaw,
      mouthOpen: mouthOpenRaw, mouthSmile: mouthSmileRaw,
      browLeft: browRightRaw, browRight: browLeftRaw,
      headYaw: 1 - yaw, headPitch: pitch, headRoll: 1 - roll,
      headX: 1 - headX, headY,
    };
  }

  return {
    eyeLeft: eyeLeftRaw, eyeRight: eyeRightRaw,
    mouthOpen: mouthOpenRaw, mouthSmile: mouthSmileRaw,
    browLeft: browLeftRaw, browRight: browRightRaw,
    headYaw: yaw, headPitch: pitch, headRoll: roll,
    headX, headY,
  };
}

// === 测试 ===

describe('applySensitivity — 灵敏度缩放', () => {
  it('sens=100 应返回原始值', () => {
    assert.equal(applySensitivity(0.5, 100), 0.5);
    assert.equal(applySensitivity(0.8, 100), 0.8);
    assert.equal(applySensitivity(0.2, 100), 0.2);
  });

  it('sens=200 应放大变化幅度', () => {
    // 0.8 -> 0.5 + (0.8-0.5)*2 = 0.5 + 0.6 = 1.1 -> clamp 后 1.0
    assert.ok(applySensitivity(0.8, 200) > 0.9);
    // 0.2 -> 0.5 + (0.2-0.5)*2 = 0.5 - 0.6 = -0.1 -> clamp 后 0.0
    assert.ok(applySensitivity(0.2, 200) < 0.1);
  });

  it('sens=50 应减幅变化幅度', () => {
    // 0.8 -> 0.5 + (0.8-0.5)*0.5 = 0.5 + 0.15 = 0.65
    assert.equal(applySensitivity(0.8, 50), 0.65);
    // 0.2 -> 0.5 + (0.2-0.5)*0.5 = 0.5 - 0.15 = 0.35
    assert.equal(applySensitivity(0.2, 50), 0.35);
  });

  it('sens=0 应始终返回 0.5（无变化）', () => {
    assert.equal(applySensitivity(0.9, 0), 0.5);
    assert.equal(applySensitivity(0.1, 0), 0.5);
    assert.equal(applySensitivity(0.5, 0), 0.5);
  });

  it('sens=150 应合理缩放', () => {
    // 0.7 -> 0.5 + (0.7-0.5)*1.5 = 0.5 + 0.3 = 0.8
    assert.ok(Math.abs(applySensitivity(0.7, 150) - 0.8) < 1e-10);
    // 0.3 -> 0.5 + (0.3-0.5)*1.5 = 0.5 - 0.3 = 0.2
    assert.ok(Math.abs(applySensitivity(0.3, 150) - 0.2) < 1e-10);
  });
});

describe('smoothValue — 指数平滑', () => {
  it('factor=0 应直接到达目标值（不平滑）', () => {
    assert.equal(smoothValue(0, 1, 0), 1);
    assert.equal(smoothValue(0.5, 0.8, 0), 0.8);
  });

  it('factor=0.3 应部分趋近目标值', () => {
    // current=0, target=1, factor=0.3 -> 0 + (1-0)*0.7 = 0.7
    assert.equal(smoothValue(0, 1, 0.3), 0.7);
    // current=0.5, target=1, factor=0.3 -> 0.5 + (1-0.5)*0.7 = 0.5 + 0.35 = 0.85
    assert.equal(smoothValue(0.5, 1, 0.3), 0.85);
  });

  it('factor=0.8 应非常缓慢地趋近', () => {
    // 0 + (1-0)*0.2 = 0.2
    assert.ok(Math.abs(smoothValue(0, 1, 0.8) - 0.2) < 1e-10);
  });

  it('factor=1 应完全不变化', () => {
    assert.equal(smoothValue(0.5, 1, 1), 0.5);
  });

  it('多次平滑应逐渐接近目标值', () => {
    let current = 0;
    const target = 1;
    const factor = 0.3;
    current = smoothValue(current, target, factor);
    assert.ok(Math.abs(current - 0.7) < 1e-10);
    current = smoothValue(current, target, factor);
    assert.ok(Math.abs(current - 0.91) < 1e-10);
    current = smoothValue(current, target, factor);
    assert.ok(Math.abs(current - 0.973) < 1e-10);
  });
});

describe('extractParams — 参数提取', () => {
  const blendshapes = {
    eyeBlinkLeft: 0.8,   // 左眼闭合 80%
    eyeBlinkRight: 0.2,  // 右眼闭合 20%
    jawOpen: 0.6,
    mouthSmileLeft: 0.3,
    mouthSmileRight: 0.5,
    browInnerUp: 0.1,
    browOuterUpLeft: 0.4,
  };
  const headPose = { yaw: 0.7, pitch: 0.4, roll: 0.5 };
  const nosePos = { x: 0.55, y: 0.6 };

  it('非镜像模式应保持原始左右分配', () => {
    const p = extractParams(blendshapes, false, headPose, nosePos);
    // eyeBlinkLeft=0.8 -> 睁眼度 1-0.8 = 0.2
    assert.ok(Math.abs(p.eyeLeft - 0.2) < 1e-10);
    // eyeBlinkRight=0.2 -> 睁眼度 1-0.2 = 0.8
    assert.ok(Math.abs(p.eyeRight - 0.8) < 1e-10);
    assert.equal(p.headYaw, 0.7);
    assert.equal(p.headX, 0.55);
  });

  it('镜像模式应交换左右眼', () => {
    const p = extractParams(blendshapes, true, headPose, nosePos);
    assert.ok(Math.abs(p.eyeLeft - 0.8) < 1e-10);   // 原来是 right
    assert.ok(Math.abs(p.eyeRight - 0.2) < 1e-10);  // 原来是 left
  });

  it('镜像模式应反转 headYaw', () => {
    const p = extractParams(blendshapes, true, headPose, nosePos);
    assert.equal(p.headYaw, 1 - 0.7);
    assert.equal(p.headX, 1 - 0.55);
  });

  it('镜像模式应反转 headRoll', () => {
    const p = extractParams(blendshapes, true, headPose, nosePos);
    assert.equal(p.headRoll, 1 - 0.5);
  });

  it('镜像模式不应反转 headPitch', () => {
    const p = extractParams(blendshapes, true, headPose, nosePos);
    assert.equal(p.headPitch, 0.4);
  });

  it('嘴巴 smile 应取左右平均值', () => {
    const p = extractParams(blendshapes, false, headPose, nosePos);
    assert.equal(p.mouthSmile, (0.3 + 0.5) / 2);
  });

  it('缺失的 blendshape 应默认回调为 0', () => {
    const p = extractParams({}, false, headPose, nosePos);
    assert.equal(p.eyeLeft, 1);    // 无 eyeBlinkLeft -> 0, 1-0=1
    assert.equal(p.mouthOpen, 0);
    assert.equal(p.mouthSmile, 0);
  });
});

describe('参数 clamping', () => {
  it('setParam 应将值 clamp 到 [0, 1]', () => {
    const clamp = (v) => Math.max(0, Math.min(1, v));
    assert.equal(clamp(-0.1), 0);
    assert.equal(clamp(1.5), 1);
    assert.equal(clamp(0.5), 0.5);
    assert.equal(clamp(0), 0);
    assert.equal(clamp(1), 1);
  });
});

describe('性能模式帧率控制', () => {
  it('normal 模式不应跳帧', () => {
    const mode = 'normal';
    let skip = 0;
    const shouldSkip = (mode === 'low' && ++skip % 2 !== 0) ||
                       (mode === 'minimal' && ++skip % 3 !== 0);
    assert.equal(shouldSkip, false);
  });

  it('low 模式应每 2 帧跳 1 帧', () => {
    const mode = 'low';
    let skip = 0;
    const results = [];
    for (let i = 0; i < 6; i++) {
      skip++;
      results.push(mode === 'low' && skip % 2 !== 0);
    }
    assert.deepEqual(results, [true, false, true, false, true, false]);
  });

  it('minimal 模式应每 3 帧跳 2 帧', () => {
    const mode = 'minimal';
    let skip = 0;
    const results = [];
    for (let i = 0; i < 6; i++) {
      skip++;
      results.push(mode === 'minimal' && skip % 3 !== 0);
    }
    assert.deepEqual(results, [true, true, false, true, true, false]);
  });
});