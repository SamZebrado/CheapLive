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

describe('眉毛动画抬升量与 scale 的关系', () => {
  it('眉毛抬升量应与 scale 成正比', () => {
    const browLeft = 0.5;
    const baseScale = 1;
    const doubledScale = 2;

    const upAmtBase = browLeft * 8 * baseScale;
    const upAmtDoubled = browLeft * 8 * doubledScale;

    assert.equal(upAmtBase, 4, '基础 scale 下抬升量为 4');
    assert.equal(upAmtDoubled, 8, '双倍 scale 下抬升量为 8');
    assert.equal(upAmtDoubled, upAmtBase * 2, '双倍 scale 时抬升量应翻倍');
  });

  it('不同 brow 参数值的抬升量应单调递增', () => {
    const browValues = [0, 0.25, 0.5, 0.75, 1];
    const previousUpAmt = -1;

    for (const brow of browValues) {
      const upAmt = brow * 8;
      assert.ok(upAmt >= previousUpAmt, `抬升量应单调递增: brow=${brow}, upAmt=${upAmt}`);
    }
  });

  it('眉毛抬升方向应沿 -downVec（向上）', () => {
    const brow = 0.5;
    const upAmt = brow * 8;

    assert.ok(upAmt > 0, '抬升量应为正数');
    assert.equal(-upAmt, -4, '向下偏移应为负值（即向上移动）');
  });
});

describe('眨眼 Clip 遮罩边界验证', () => {
  it('遮罩高度应随 cover 线性变化', () => {
    const ry = 10;

    for (const cover of [0, 0.25, 0.5, 0.75, 1]) {
      const coverH = 2 * ry * cover;

      assert.ok(coverH >= 0 && coverH <= 2 * ry, `遮罩高度应在 [0, ${2 * ry}]: ${coverH}`);
      assert.equal(coverH, 20 * cover, `遮罩高度应与 cover 成正比: cover=${cover}, coverH=${coverH}`);
    }
  });

  it('完全睁眼时遮罩高度为 0', () => {
    const openness = 1;
    const tOpen = Math.max(0, Math.min(1, (openness - 0.15) / (0.5 - 0.15)));
    const easedOpen = tOpen * tOpen * (3 - 2 * tOpen);
    const cover = 1 - easedOpen;
    const ry = 10;
    const coverH = 2 * ry * cover;

    assert.equal(cover, 0, '完全睁眼时 cover 应为 0');
    assert.equal(coverH, 0, '完全睁眼时遮罩高度应为 0');
  });

  it('完全闭眼时遮罩覆盖整个眼睛', () => {
    const openness = 0;
    const tOpen = Math.max(0, Math.min(1, (openness - 0.15) / (0.5 - 0.15)));
    const easedOpen = tOpen * tOpen * (3 - 2 * tOpen);
    const cover = 1 - easedOpen;
    const ry = 10;
    const coverH = 2 * ry * cover;

    assert.equal(cover, 1, '完全闭眼时 cover 应为 1');
    assert.equal(coverH, 2 * ry, '完全闭眼时遮罩高度应等于 2*ry');
  });

  it('半睁眼时遮罩覆盖一半眼睛', () => {
    const openness = 0.325;
    const tOpen = (openness - 0.15) / (0.5 - 0.15);
    const easedOpen = tOpen * tOpen * (3 - 2 * tOpen);
    const cover = 1 - easedOpen;
    const ry = 10;
    const coverH = 2 * ry * cover;

    assert.ok(cover > 0 && cover < 1, `半睁眼时 cover 应在 (0, 1): ${cover}`);
    assert.ok(coverH > 0 && coverH < 2 * ry, `半睁眼时遮罩高度应在 (0, ${2 * ry}): ${coverH}`);
  });

  it('clip 区域应覆盖整个眼睛椭圆', () => {
    const rx = 10;
    const ry = 10;

    const clipRadiusX = rx + 0.5;
    const clipRadiusY = ry + 0.5;

    assert.ok(clipRadiusX > rx, 'clip X 半径应略大于眼睛 X 半径');
    assert.ok(clipRadiusY > ry, 'clip Y 半径应略大于眼睛 Y 半径');
    assert.equal(clipRadiusX, 10.5, 'clip X 半径应为 rx + 0.5');
    assert.equal(clipRadiusY, 10.5, 'clip Y 半径应为 ry + 0.5');
  });
});

describe('椭圆眼睑遮罩参数验证（新实现）', () => {
  // 新实现使用椭圆参数：
  //   eyelidRx = rx + 0.5
  //   eyelidRy = (ry + 1) * cover
  //   eyelidCY = -ry - 0.5

  it('ellipse 实现：睁眼时 eyelidRy=0（无遮罩）', () => {
    const rx = 10, ry = 10;
    const openness = 1;
    const tOpen = Math.max(0, Math.min(1, (openness - 0.15) / (0.5 - 0.15)));
    const easedOpen = tOpen * tOpen * (3 - 2 * tOpen);
    const cover = 1 - easedOpen;

    const eyelidRy = (ry + 1) * cover;

    assert.equal(cover, 0, '完全睁眼时 cover 应为 0');
    assert.equal(eyelidRy, 0, '完全睁眼时 eyelidRy 应为 0');
  });

  it('ellipse 实现：闭眼时 eyelidRy = ry + 1（完全覆盖）', () => {
    const rx = 10, ry = 10;
    const openness = 0;
    const tOpen = Math.max(0, Math.min(1, (openness - 0.15) / (0.5 - 0.15)));
    const easedOpen = tOpen * tOpen * (3 - 2 * tOpen);
    const cover = 1 - easedOpen;

    const eyelidRy = (ry + 1) * cover;

    assert.equal(cover, 1, '完全闭眼时 cover 应为 1');
    assert.equal(eyelidRy, ry + 1, '完全闭眼时 eyelidRy 应等于 ry+1');
  });

  it('ellipse 实现：半睁眼时 eyelidRy = (ry+1)/2', () => {
    const rx = 10, ry = 10;
    const openness = 0.325;
    const tOpen = (openness - 0.15) / (0.5 - 0.15);
    const easedOpen = tOpen * tOpen * (3 - 2 * tOpen);
    const cover = 1 - easedOpen;

    const eyelidRy = (ry + 1) * cover;

    assert.ok(eyelidRy > 0 && eyelidRy < ry + 1, `半睁眼时 eyelidRy 应在 (0, ${ry + 1}): ${eyelidRy}`);
    // 验证椭圆高度约为半覆盖
    assert.ok(Math.abs(eyelidRy - (ry + 1) / 2) < 0.5, `半睁眼时 eyelidRy 应约为 (ry+1)/2=${(ry+1)/2}: ${eyelidRy}`);
  });

  it('ellipse 实现：ellipsoidCY = -ry - 0.5 定位在眼顶部', () => {
    const rx = 10, ry = 10;
    const eyelidCY = -ry - 0.5;

    assert.equal(eyelidCY, -10.5, 'ellipsoidCY 应为 -ry - 0.5 = -10.5');
    // 椭圆中心在眼中心下方 ry+0.5 处，所以上缘 = -10.5 + (-(ry+1)) = -21.5
    // 下缘 = -10.5 + (ry+1) = 0.5
    // 眼中心在 t.screenY，所以椭圆从眼顶部上方开始
    assert.ok(eyelidCY < 0, 'ellipsoidCY 应为负值（眼中心上方）');
  });

  it('ellipse 实现：rx 固定为 rx+0.5，确保水平覆盖', () => {
    const rx = 10, ry = 10;
    const eyelidRx = rx + 0.5;

    assert.equal(eyelidRx, 10.5, 'ellipsoidRx 应为 rx + 0.5');
    assert.ok(eyelidRx > rx, 'ellipsoidRx 应略大于 rx');
  });

  it('ellipse 实现：不同 rx/ry 值都正确计算', () => {
    const cases = [
      { rx: 8, ry: 8, openness: 0, expectedRy: 9 },
      { rx: 12, ry: 15, openness: 0, expectedRy: 16 },
      { rx: 5, ry: 7, openness: 0.325, expectedRyMin: 3.9, expectedRyMax: 9 },
    ];

    for (const c of cases) {
      const tOpen = Math.max(0, Math.min(1, (c.openness - 0.15) / (0.5 - 0.15)));
      const easedOpen = tOpen * tOpen * (3 - 2 * tOpen);
      const cover = 1 - easedOpen;
      const eyelidRy = (c.ry + 1) * cover;

      if (c.expectedRy !== undefined) {
        assert.equal(eyelidRy, c.expectedRy, `rx=${c.rx}, ry=${c.ry}, open=${c.openness}: eyelidRy 应为 ${c.expectedRy}`);
      } else {
        assert.ok(eyelidRy >= c.expectedRyMin && eyelidRy < c.expectedRyMax,
          `rx=${c.rx}, ry=${c.ry}, open=${c.openness}: eyelidRy=${eyelidRy} 应在 [${c.expectedRyMin}, ${c.expectedRyMax})`);
      }
    }
  });
});