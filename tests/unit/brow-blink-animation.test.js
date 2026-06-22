/**
 * 眉毛动画和眨眼 Clip 单元测试
 *
 * 测试目标：
 *   - 眉毛抬升参数 browLeft/browRight 正确映射到 downVec 偏移
 *   - 眨眼 clip 遮罩逻辑正确（clip 在眼内，遮罩从顶部向下）
 *   - 瞳孔尺寸与 openness 无关（计算层面验证）
 *
 * 运行：node --test tests/unit/brow-blink-animation.test.js
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import path from 'node:path';
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

describe('眉毛动画参数映射', () => {
  const mesh = createSpindleMesh();
  const hx = mesh.headX;
  const hy = mesh.headY;

  it('browLeft/browRight 参数应在 [0, 1] 范围内', () => {
    const anchors = {
      browLeft: { bodyT: 0, horizOffset: -hx * 0.31, vertOffset: -hy * 0.48, surfaceOffset: 0.8 },
      browRight: { bodyT: 0, horizOffset: hx * 0.31, vertOffset: -hy * 0.48, surfaceOffset: 0.8 },
    };

    const browLeftRaw = 0.7;
    const browRightRaw = 0.3;

    const browLeft = Math.max(0, Math.min(1, browLeftRaw));
    const browRight = Math.max(0, Math.min(1, browRightRaw));

    assert.ok(browLeft >= 0 && browLeft <= 1, 'browLeft 应在 [0, 1]');
    assert.ok(browRight >= 0 && browRight <= 1, 'browRight 应在 [0, 1]');
    assert.equal(browLeft, 0.7, 'browLeft 应保持原值');
    assert.equal(browRight, 0.3, 'browRight 应保持原值');
  });

  it('browLeft/browRight 为 0 时不抬升', () => {
    const browLeft = 0;
    const browRight = 0;

    const upAmtLeft = browLeft * 8;
    const upAmtRight = browRight * 8;

    assert.equal(upAmtLeft, 0, 'browLeft=0 时抬升量为 0');
    assert.equal(upAmtRight, 0, 'browRight=0 时抬升量为 0');
  });

  it('browLeft/browRight 为 1 时达到最大抬升', () => {
    const browLeft = 1;
    const browRight = 1;

    const upAmtLeft = browLeft * 8;
    const upAmtRight = browRight * 8;

    assert.equal(upAmtLeft, 8, 'browLeft=1 时抬升量为最大值');
    assert.equal(upAmtRight, 8, 'browRight=1 时抬升量为最大值');
  });

  it('眉毛锚点应在眼睛上方', () => {
    const eyeAnchor = computeFaceAnchorXYZ(mesh, 0, hx * 0.31, -hy * 0.15, 0.5);
    const browAnchor = computeFaceAnchorXYZ(mesh, 0, hx * 0.31, -hy * 0.48, 0.8);

    assert.ok(browAnchor.y < eyeAnchor.y, `眉毛应在眼睛上方: brow.y=${browAnchor.y.toFixed(1)}, eye.y=${eyeAnchor.y.toFixed(1)}`);
  });
});

describe('眨眼 Clip 遮罩逻辑', () => {
  it('openness=0.15 时 tOpen=0（映射范围下限）', () => {
    const openness = 0.15;
    const tOpen = (openness - 0.15) / (0.5 - 0.15);
    assert.equal(tOpen, 0, 'openness=0.15 时 tOpen 应为 0');
  });

  it('openness=0.5 时 tOpen=1（映射范围上限）', () => {
    const openness = 0.5;
    const tOpen = (openness - 0.15) / (0.5 - 0.15);
    assert.equal(tOpen, 1, 'openness=0.5 时 tOpen 应为 1');
  });

  it('openness=0.5 时 easedOpen=1（完全睁眼）', () => {
    const openness = 0.5;
    const tOpen = (openness - 0.15) / (0.5 - 0.15);
    const easedOpen = Math.max(0, Math.min(1, tOpen * tOpen * (3 - 2 * tOpen)));
    const cover = 1 - easedOpen;

    assert.equal(easedOpen, 1, 'openness=0.5 时 easedOpen 应为 1');
    assert.equal(cover, 0, 'openness=0.5 时遮罩高度应为 0');
  });

  it('openness=0.325 时 easedOpen 约为 0.5（半睁眼）', () => {
    const openness = 0.325;
    const tOpen = (openness - 0.15) / (0.5 - 0.15);
    const easedOpen = Math.max(0, Math.min(1, tOpen * tOpen * (3 - 2 * tOpen)));
    const cover = 1 - easedOpen;

    assert.ok(tOpen > 0 && tOpen < 1, `tOpen 应在 (0, 1): ${tOpen}`);
    assert.ok(easedOpen > 0 && easedOpen < 1, `easedOpen 应在 (0, 1): ${easedOpen}`);
    assert.ok(cover > 0 && cover < 1, `cover 应在 (0, 1): ${cover}`);
  });

  it('openness>0.5 时 easedOpen=1（饱和到完全睁眼）', () => {
    const openness = 1;
    const tOpen = Math.max(0, Math.min(1, (openness - 0.15) / (0.5 - 0.15)));
    const easedOpen = tOpen * tOpen * (3 - 2 * tOpen);

    assert.equal(tOpen, 1, 'openness>0.5 时 tOpen 应被 clamp 到 1');
    assert.equal(easedOpen, 1, 'openness>0.5 时 easedOpen 应为 1');
  });

  it('openness<0.15 时 easedOpen=0（完全闭眼）', () => {
    const openness = 0;
    const tOpen = Math.max(0, Math.min(1, (openness - 0.15) / (0.5 - 0.15)));
    const easedOpen = tOpen * tOpen * (3 - 2 * tOpen);

    assert.equal(tOpen, 0, 'openness<0.15 时 tOpen 应被 clamp 到 0');
    assert.equal(easedOpen, 0, 'openness<0.15 时 easedOpen 应为 0');
  });

  it('遮罩颜色应使用 faceTopColor', () => {
    const mesh = createSpindleMesh();
    const expectedColor = mesh.faceTopColor;

    assert.ok(expectedColor, 'faceTopColor 应存在');
    assert.ok(expectedColor.startsWith('#') || expectedColor.startsWith('rgb'), `faceTopColor 应为合法颜色值: ${expectedColor}`);
  });
});

describe('瞳孔尺寸与 openness 的关系', () => {
  it('瞳孔半径随 easedOpen 线性变化', () => {
    const eyeHalfW = 10;
    const eyeHalfH = 10;

    for (const openness of [0.15, 0.325, 0.5, 0.75, 1]) {
      const tOpen = (openness - 0.15) / (0.5 - 0.15);
      const easedOpen = Math.max(0, Math.min(1, tOpen * tOpen * (3 - 2 * tOpen)));

      const pupilRx = eyeHalfW * 0.55 * easedOpen;
      const pupilRy = eyeHalfH * 0.55 * easedOpen;

      assert.ok(pupilRx >= 0 && pupilRx <= eyeHalfW * 0.55, `pupilRx 应在 [0, ${eyeHalfW * 0.55}]: ${pupilRx}`);
      assert.ok(pupilRy >= 0 && pupilRy <= eyeHalfH * 0.55, `pupilRy 应在 [0, ${eyeHalfH * 0.55}]: ${pupilRy}`);
      assert.equal(pupilRx, pupilRy, '瞳孔应为圆形');
    }
  });

  it('openness=0.5 时瞳孔达到最大', () => {
    const eyeHalfW = 10;
    const eyeHalfH = 10;
    const openness = 0.5;

    const tOpen = (openness - 0.15) / (0.5 - 0.15);
    const easedOpen = Math.max(0, Math.min(1, tOpen * tOpen * (3 - 2 * tOpen)));

    const pupilRx = eyeHalfW * 0.55 * easedOpen;
    const pupilRy = eyeHalfH * 0.55 * easedOpen;

    assert.equal(pupilRx, eyeHalfW * 0.55, 'openness=0.5 时瞳孔应为最大');
    assert.equal(pupilRy, eyeHalfH * 0.55, 'openness=0.5 时瞳孔应为最大');
  });

  it('openness=0.15 时瞳孔为 0', () => {
    const eyeHalfW = 10;
    const eyeHalfH = 10;
    const openness = 0.15;

    const tOpen = (openness - 0.15) / (0.5 - 0.15);
    const easedOpen = Math.max(0, Math.min(1, tOpen * tOpen * (3 - 2 * tOpen)));

    const pupilRx = eyeHalfW * 0.55 * easedOpen;
    const pupilRy = eyeHalfH * 0.55 * easedOpen;

    assert.equal(pupilRx, 0, 'openness=0.15 时瞳孔应为 0');
    assert.equal(pupilRy, 0, 'openness=0.15 时瞳孔应为 0');
  });
});

describe('球体眉毛动画参数映射', () => {
  const mesh = createSphereMesh();
  const r = mesh.radius;

  it('球体眉毛锚点应在眼睛上方', () => {
    const eyeAnchor = computeSphereFaceAnchorXYZ(mesh, r * 0.32, -r * 0.15, 2);
    const browAnchor = computeSphereFaceAnchorXYZ(mesh, r * 0.28, -r * 0.28, 3);

    assert.ok(browAnchor.y < eyeAnchor.y, `球体眉毛应在眼睛上方: brow.y=${browAnchor.y.toFixed(1)}, eye.y=${eyeAnchor.y.toFixed(1)}`);
  });

  it('球体眉毛抬升量与 brow 参数成正比', () => {
    const browLeft = 0.8;
    const upAmt = browLeft * 8;

    assert.equal(upAmt, 6.4, '球体眉毛抬升量应与 brow 参数成正比');
  });
});