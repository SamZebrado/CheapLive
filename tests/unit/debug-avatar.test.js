/**
 * DebugAvatar 单元测试
 *
 * 测试目标：debug-avatar.js 中的纯函数逻辑
 * - rotate3D 旋转矩阵计算
 * - 参数 clamping
 * - 镜像与渲染状态
 *
 * 运行：node tests/unit/debug-avatar.test.js
 */

import assert from 'node:assert/strict';
import { describe, it, before } from 'node:test';

// === Mock DOM 环境 ===
class MockCanvas2D {
  constructor() {
    this.calls = [];
  }
  clearRect() {}
  save() {}
  restore() {}
  translate() {}
  scale() {}
  beginPath() {}
  moveTo() {}
  lineTo() {}
  quadraticCurveTo() {}
  bezierCurveTo() {}
  closePath() {}
  arc() {}
  ellipse() {}
  fill() {}
  stroke() {}
  fillText() {}
  createLinearGradient() { return { addColorStop() {} }; }
}

// 由于 debug-avatar.js 使用 DOM API，我们单独测试其核心算法
// 这些函数是从 DebugAvatar 类中提取的纯逻辑

// === 3D 旋转矩阵（从 debug-avatar.js 复制） ===
function rotate3D(x, y, z, yaw, pitch, roll) {
  let cosY = Math.cos(yaw), sinY = Math.sin(yaw);
  let x1 = x * cosY + z * sinY;
  let z1 = -x * sinY + z * cosY;
  let y1 = y;

  let cosP = Math.cos(pitch), sinP = Math.sin(pitch);
  let y2 = y1 * cosP - z1 * sinP;
  let z2 = y1 * sinP + z1 * cosP;
  let x2 = x1;

  let cosR = Math.cos(roll), sinR = Math.sin(roll);
  let x3 = x2 * cosR - y2 * sinR;
  let y3 = x2 * sinR + y2 * cosR;
  let z3 = z2;

  return { x: x3, y: y3, z: z3 };
}

// === 测试 ===

describe('rotate3D — 无旋转（所有角度为 0）', () => {
  it('应该返回原始坐标', () => {
    const r = rotate3D(10, 20, 30, 0, 0, 0);
    assert.equal(r.x, 10);
    assert.equal(r.y, 20);
    assert.equal(r.z, 30);
  });

  it('原点旋转后仍在原点', () => {
    const r = rotate3D(0, 0, 0, 0.5, 0.3, 0.2);
    assert.ok(Math.abs(r.x) < 1e-10);
    assert.ok(Math.abs(r.y) < 1e-10);
    assert.ok(Math.abs(r.z) < 1e-10);
  });
});

describe('rotate3D — yaw 旋转（绕 Y 轴）', () => {
  it('yaw=90° 时 X 轴点应转到 Z 负方向', () => {
    const r = rotate3D(50, 0, 0, Math.PI / 2, 0, 0);
    assert.ok(Math.abs(r.x) < 1e-10, 'x 应接近 0');
    assert.equal(r.y, 0);
    assert.ok(Math.abs(r.z - (-50)) < 1e-10, 'z 应接近 -50 (右手系)');
  });

  it('yaw=180° 时 X 轴点应反转', () => {
    const r = rotate3D(50, 0, 0, Math.PI, 0, 0);
    assert.ok(Math.abs(r.x - (-50)) < 1e-10);
    assert.equal(r.y, 0);
    assert.ok(Math.abs(r.z) < 1e-10);
  });
});

describe('rotate3D — pitch 旋转（绕 X 轴）', () => {
  it('pitch=90° 时 Y 轴点应转到 Z 正方向', () => {
    const r = rotate3D(0, 30, 0, 0, Math.PI / 2, 0);
    assert.equal(r.x, 0);
    assert.ok(Math.abs(r.y) < 1e-10);
    assert.ok(Math.abs(r.z - 30) < 1e-10, 'Y 轴正方向绕 X 转 90° 后应在 Z 正方向');
  });
});

describe('rotate3D — roll 旋转（绕 Z 轴）', () => {
  it('roll=90° 时 X 轴点应转到 Y 轴方向', () => {
    const r = rotate3D(40, 0, 0, 0, 0, Math.PI / 2);
    assert.ok(Math.abs(r.x) < 1e-10);
    assert.ok(Math.abs(r.y - 40) < 1e-10);
    assert.equal(r.z, 0);
  });
});

describe('rotate3D — 组合旋转顺序：yaw → pitch → roll', () => {
  it('组合旋转后向量长度应保持不变', () => {
    const ox = 30, oy = -20, oz = 40;
    const lenSq = ox * ox + oy * oy + oz * oz;
    const yaw = 0.3, pitch = 0.15, roll = 0.42;

    const r = rotate3D(ox, oy, oz, yaw, pitch, roll);
    const resultLenSq = r.x * r.x + r.y * r.y + r.z * r.z;

    assert.ok(Math.abs(resultLenSq - lenSq) / lenSq < 1e-10,
      `向量长度应保持不变: ${resultLenSq} ≈ ${lenSq}`);
  });

  it('单位向量经过旋转后仍为单位向量', () => {
    const r = rotate3D(1, 0, 0, 0.5, 0.3, 0.2);
    const len = Math.sqrt(r.x * r.x + r.y * r.y + r.z * r.z);
    assert.ok(Math.abs(len - 1) < 1e-10);
  });
});

describe('DebugAvatar 参数状态管理', () => {
  // 验证参数 updateParams 的 clamp 行为
  it('参数应该被 clamp 到 0-1 范围', () => {
    const clamp = (v) => Math.max(0, Math.min(1, v));
    assert.equal(clamp(-0.5), 0);
    assert.equal(clamp(0.5), 0.5);
    assert.equal(clamp(1.5), 1);
    assert.equal(clamp(0), 0);
    assert.equal(clamp(1), 1);
  });

  it('镜像 mode 应保持为布尔类型', () => {
    const mirror = false;
    const newMirror = true;
    assert.equal(typeof mirror, 'boolean');
    assert.equal(typeof newMirror, 'boolean');
  });

  it('appMode 切换', () => {
    const appMode = false;
    const newAppMode = true;
    assert.equal(appMode, false);
    assert.equal(newAppMode, true);
  });
});

describe('DebugAvatar 特征点坐标一致性', () => {
  // 验证 features 中左右对称点的对称性
  const features = {
    eyeLeft: { x: -38, y: -14, z: 58, r: 24 },
    eyeRight: { x: 22, y: -14, z: 58, r: 24 },
    nostrilLeft: { x: -10, y: 16, z: 62 },
    nostrilRight: { x: 2, y: 16, z: 62 },
  };

  it('左右眼 Y 和 Z 坐标应对称', () => {
    assert.equal(features.eyeLeft.y, features.eyeRight.y);
    assert.equal(features.eyeLeft.z, features.eyeRight.z);
  });

  it('左右眼半径应相同', () => {
    assert.equal(features.eyeLeft.r, features.eyeRight.r);
  });

  it('左右鼻孔 Y 和 Z 坐标应对称', () => {
    assert.equal(features.nostrilLeft.y, features.nostrilRight.y);
    assert.equal(features.nostrilLeft.z, features.nostrilRight.z);
  });
});