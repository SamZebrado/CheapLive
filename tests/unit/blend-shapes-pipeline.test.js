/**
 * Blend Shapes 扩展参数管线测试
 *
 * 测试目标：
 *   - 验证 eyeWideLeft/Right 从 MediaPipe eyeWideLeft/Right 正确提取
 *   - 验证 eyeSquintLeft/Right 从 MediaPipe eyeSquintLeft/Right 正确提取
 *   - 验证 mouthFunnel 从 MediaPipe mouthFunnel 正确提取
 *   - 验证 mouthPress 从 MediaPipe mouthPressLeft/Right 正确提取
 *   - 验证镜像模式下参数正确交换
 *   - 验证现有 eyeBlink/jawOpen/smile/brow 不回退
 *
 * 运行：node --test tests/unit/blend-shapes-pipeline.test.js
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * 模拟 extractBlendShapeParams 函数
 * 从 MediaPipe blendshape categories 提取参数
 */
function extractBlendShapeParams(categories, mirror) {
  const map = {};
  if (categories && Array.isArray(categories)) {
    for (const cat of categories) {
      map[cat.categoryName] = cat.score;
    }
  }

  // eyeBlinkLeft/Right 反转成睁眼度
  const eyeLeftRaw = 1 - (map['eyeBlinkLeft'] || 0);
  const eyeRightRaw = 1 - (map['eyeBlinkRight'] || 0);

  // eyeWide
  const eyeWideLeftRaw = map['eyeWideLeft'] || 0;
  const eyeWideRightRaw = map['eyeWideRight'] || 0;

  // eyeSquint
  const eyeSquintLeftRaw = map['eyeSquintLeft'] || 0;
  const eyeSquintRightRaw = map['eyeSquintRight'] || 0;

  // jawOpen -> mouthOpen
  const mouthOpenRaw = map['jawOpen'] || 0;

  // mouthSmileLeft/Right
  const smileLeft = map['mouthSmileLeft'] || 0;
  const smileRight = map['mouthSmileRight'] || 0;
  const mouthSmileRaw = (smileLeft + smileRight) / 2;

  // mouthFunnel
  const mouthFunnelRaw = map['mouthFunnel'] || 0;

  // mouthPressLeft/Right
  const mouthPressLeftRaw = map['mouthPressLeft'] || 0;
  const mouthPressRightRaw = map['mouthPressRight'] || 0;
  const mouthPressRaw = (mouthPressLeftRaw + mouthPressRightRaw) / 2;

  // browInnerUpLeft/Right + browOuterUpLeft/Right
  const browLeftInner = map['browInnerUpLeft'] || 0;
  const browLeftOuter = map['browOuterUpLeft'] || 0;
  const browRightInner = map['browInnerUpRight'] || 0;
  const browRightOuter = map['browOuterUpRight'] || 0;
  const browLeftRaw = (browLeftInner + browLeftOuter) / 2;
  const browRightRaw = (browRightInner + browRightOuter) / 2;

  if (mirror) {
    return {
      eyeLeft: eyeRightRaw,
      eyeRight: eyeLeftRaw,
      eyeWideLeft: eyeWideRightRaw,
      eyeWideRight: eyeWideLeftRaw,
      eyeSquintLeft: eyeSquintRightRaw,
      eyeSquintRight: eyeSquintLeftRaw,
      mouthOpen: mouthOpenRaw,
      mouthSmile: mouthSmileRaw,
      mouthFunnel: mouthFunnelRaw,
      mouthPress: mouthPressRaw,
      browLeft: browRightRaw,
      browRight: browLeftRaw,
    };
  }

  return {
    eyeLeft: eyeLeftRaw,
    eyeRight: eyeRightRaw,
    eyeWideLeft: eyeWideLeftRaw,
    eyeWideRight: eyeWideRightRaw,
    eyeSquintLeft: eyeSquintLeftRaw,
    eyeSquintRight: eyeSquintRightRaw,
    mouthOpen: mouthOpenRaw,
    mouthSmile: mouthSmileRaw,
    mouthFunnel: mouthFunnelRaw,
    mouthPress: mouthPressRaw,
    browLeft: browLeftRaw,
    browRight: browRightRaw,
  };
}

function makeCategories(obj) {
  return Object.entries(obj).map(([name, score]) => ({ categoryName: name, score }));
}

describe('eyeWide 参数提取', () => {
  it('eyeWide=0 时输出 0', () => {
    const cats = makeCategories({ eyeWideLeft: 0, eyeWideRight: 0 });
    const result = extractBlendShapeParams(cats, false);
    assert.equal(result.eyeWideLeft, 0);
    assert.equal(result.eyeWideRight, 0);
  });

  it('eyeWide=0.7 时输出 0.7', () => {
    const cats = makeCategories({ eyeWideLeft: 0.7, eyeWideRight: 0.5 });
    const result = extractBlendShapeParams(cats, false);
    assert.equal(result.eyeWideLeft, 0.7);
    assert.equal(result.eyeWideRight, 0.5);
  });

  it('镜像模式下 eyeWideLeft/Right 交换', () => {
    const cats = makeCategories({ eyeWideLeft: 0.7, eyeWideRight: 0.3 });
    const result = extractBlendShapeParams(cats, true);
    assert.equal(result.eyeWideLeft, 0.3); // 来自 right
    assert.equal(result.eyeWideRight, 0.7); // 来自 left
  });

  it('缺少 eyeWide 时默认为 0', () => {
    const cats = makeCategories({});
    const result = extractBlendShapeParams(cats, false);
    assert.equal(result.eyeWideLeft, 0);
    assert.equal(result.eyeWideRight, 0);
  });
});

describe('eyeSquint 参数提取', () => {
  it('eyeSquint=0 时输出 0', () => {
    const cats = makeCategories({ eyeSquintLeft: 0, eyeSquintRight: 0 });
    const result = extractBlendShapeParams(cats, false);
    assert.equal(result.eyeSquintLeft, 0);
    assert.equal(result.eyeSquintRight, 0);
  });

  it('eyeSquint=0.5 时输出 0.5', () => {
    const cats = makeCategories({ eyeSquintLeft: 0.5, eyeSquintRight: 0.8 });
    const result = extractBlendShapeParams(cats, false);
    assert.equal(result.eyeSquintLeft, 0.5);
    assert.equal(result.eyeSquintRight, 0.8);
  });

  it('镜像模式下 eyeSquintLeft/Right 交换', () => {
    const cats = makeCategories({ eyeSquintLeft: 0.6, eyeSquintRight: 0.2 });
    const result = extractBlendShapeParams(cats, true);
    assert.equal(result.eyeSquintLeft, 0.2);
    assert.equal(result.eyeSquintRight, 0.6);
  });

  it('缺少 eyeSquint 时默认为 0', () => {
    const cats = makeCategories({});
    const result = extractBlendShapeParams(cats, false);
    assert.equal(result.eyeSquintLeft, 0);
    assert.equal(result.eyeSquintRight, 0);
  });
});

describe('mouthFunnel 参数提取', () => {
  it('mouthFunnel=0 时输出 0', () => {
    const cats = makeCategories({ mouthFunnel: 0 });
    const result = extractBlendShapeParams(cats, false);
    assert.equal(result.mouthFunnel, 0);
  });

  it('mouthFunnel=0.6 时输出 0.6', () => {
    const cats = makeCategories({ mouthFunnel: 0.6 });
    const result = extractBlendShapeParams(cats, false);
    assert.equal(result.mouthFunnel, 0.6);
  });

  it('镜像模式不影响 mouthFunnel（无左右）', () => {
    const cats = makeCategories({ mouthFunnel: 0.4 });
    const result = extractBlendShapeParams(cats, true);
    assert.equal(result.mouthFunnel, 0.4);
  });

  it('缺少 mouthFunnel 时默认为 0', () => {
    const cats = makeCategories({});
    const result = extractBlendShapeParams(cats, false);
    assert.equal(result.mouthFunnel, 0);
  });
});

describe('mouthPress 参数提取', () => {
  it('mouthPressLeft/Right 平均值正确', () => {
    const cats = makeCategories({ mouthPressLeft: 0.4, mouthPressRight: 0.8 });
    const result = extractBlendShapeParams(cats, false);
    assert.equal(result.mouthPress, (0.4 + 0.8) / 2);
  });

  it('mouthPress=0 时输出 0', () => {
    const cats = makeCategories({ mouthPressLeft: 0, mouthPressRight: 0 });
    const result = extractBlendShapeParams(cats, false);
    assert.equal(result.mouthPress, 0);
  });

  it('镜像模式不影响 mouthPress（无左右区分）', () => {
    const cats = makeCategories({ mouthPressLeft: 0.5, mouthPressRight: 0.3 });
    const result = extractBlendShapeParams(cats, true);
    assert.equal(result.mouthPress, 0.4);
  });

  it('缺少 mouthPress 时默认为 0', () => {
    const cats = makeCategories({});
    const result = extractBlendShapeParams(cats, false);
    assert.equal(result.mouthPress, 0);
  });
});

describe('现有参数不回退', () => {
  it('eyeBlinkLeft/Right 反转正确', () => {
    const cats = makeCategories({ eyeBlinkLeft: 0.2, eyeBlinkRight: 0.3 });
    const result = extractBlendShapeParams(cats, false);
    assert.equal(result.eyeLeft, 0.8); // 1 - 0.2
    assert.equal(result.eyeRight, 0.7); // 1 - 0.3
  });

  it('jawOpen -> mouthOpen 正确', () => {
    const cats = makeCategories({ jawOpen: 0.5 });
    const result = extractBlendShapeParams(cats, false);
    assert.equal(result.mouthOpen, 0.5);
  });

  it('mouthSmileLeft/Right 平均值正确', () => {
    const cats = makeCategories({ mouthSmileLeft: 0.6, mouthSmileRight: 0.4 });
    const result = extractBlendShapeParams(cats, false);
    assert.equal(result.mouthSmile, 0.5);
  });

  it('brow 参数正确', () => {
    const cats = makeCategories({
      browInnerUpLeft: 0.3, browOuterUpLeft: 0.5,
      browInnerUpRight: 0.4, browOuterUpRight: 0.6
    });
    const result = extractBlendShapeParams(cats, false);
    assert.equal(result.browLeft, (0.3 + 0.5) / 2);
    assert.equal(result.browRight, (0.4 + 0.6) / 2);
  });
});

describe('综合多参数同时存在', () => {
  it('所有新参数同时提取正确', () => {
    const cats = makeCategories({
      eyeBlinkLeft: 0.1,
      eyeBlinkRight: 0.2,
      eyeWideLeft: 0.8,
      eyeWideRight: 0.6,
      eyeSquintLeft: 0.3,
      eyeSquintRight: 0.4,
      jawOpen: 0.5,
      mouthSmileLeft: 0.7,
      mouthSmileRight: 0.9,
      mouthFunnel: 0.2,
      mouthPressLeft: 0.3,
      mouthPressRight: 0.5,
    });
    const result = extractBlendShapeParams(cats, false);
    assert.equal(result.eyeLeft, 0.9);
    assert.equal(result.eyeRight, 0.8);
    assert.equal(result.eyeWideLeft, 0.8);
    assert.equal(result.eyeWideRight, 0.6);
    assert.equal(result.eyeSquintLeft, 0.3);
    assert.equal(result.eyeSquintRight, 0.4);
    assert.equal(result.mouthOpen, 0.5);
    assert.equal(result.mouthSmile, 0.8);
    assert.equal(result.mouthFunnel, 0.2);
    assert.equal(result.mouthPress, 0.4);
  });

  it('镜像模式下所有参数正确交换', () => {
    const cats = makeCategories({
      eyeBlinkLeft: 0.1,
      eyeBlinkRight: 0.2,
      eyeWideLeft: 0.8,
      eyeWideRight: 0.6,
      eyeSquintLeft: 0.3,
      eyeSquintRight: 0.4,
      jawOpen: 0.5,
      mouthSmileLeft: 0.7,
      mouthSmileRight: 0.9,
      mouthFunnel: 0.2,
      mouthPressLeft: 0.3,
      mouthPressRight: 0.5,
      browInnerUpLeft: 0.3,
      browOuterUpLeft: 0.5,
      browInnerUpRight: 0.4,
      browOuterUpRight: 0.6,
    });
    const result = extractBlendShapeParams(cats, true);
    // 镜像交换
    assert.equal(result.eyeLeft, 0.8);
    assert.equal(result.eyeRight, 0.9);
    assert.equal(result.eyeWideLeft, 0.6);
    assert.equal(result.eyeWideRight, 0.8);
    assert.equal(result.eyeSquintLeft, 0.4);
    assert.equal(result.eyeSquintRight, 0.3);
    assert.equal(result.browLeft, 0.5); // 来自 original right: (0.4+0.6)/2
    assert.equal(result.browRight, 0.4); // 来自 original left: (0.3+0.5)/2
    // 非镜像
    assert.equal(result.mouthOpen, 0.5);
    assert.equal(result.mouthSmile, 0.8);
    assert.equal(result.mouthFunnel, 0.2);
    assert.equal(result.mouthPress, 0.4);
  });
});
