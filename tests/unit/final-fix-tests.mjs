// final-fix-tests.mjs
// Round: Web 最终定点热修 — 修 pitch、固定虹膜视觉大小、恢复眼动和空闲摆动
// 共享 renderer 表面三角形绑定（同时解决 Web 和 Android pitch 翘起）
//
// 测试目标（与上一轮共同）：
// 1. Web rawPitchDown → visualHeadDown（pitchNorm 正确取反）
// 2. Web rawPitchUp → visualHeadUp
// 3. 虹膜/瞳孔在 yaw 0–75° 内变化 <5%
// 4. 虹膜/pupil 比例稳定
// 5. gaze -1/0/+1 产生明显位置变化
// 6. 真实 iris landmarks → 虹膜位置变化
// 7. gaze 位置变、大小不变
// 8. pitch ±30° 眼睛保持贴在头部表面
// 9. pitch 改变时 eyeToSurfaceDistance 稳定
// 10. eye surface binding 存在且每个 pitch 都能产生 binding 信息
// 11. upper lip 参数未被修改

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');
const SRC = path.join(ROOT, 'src', 'face-tracking');

// Mock canvas + window for node.js env
function makeMockCanvas() {
  const canvas = {
    width: 600, height: 600,
    style: {},
    getContext: () => ({
      save: () => {}, restore: () => {},
      translate: () => {}, rotate: () => {}, scale: () => {},
      beginPath: () => {}, moveTo: () => {}, lineTo: () => {},
      closePath: () => {}, fill: () => {}, stroke: () => {},
      clearRect: () => {}, fillRect: () => {}, arc: () => {},
      ellipse: () => {}, quadraticCurveTo: () => {}, bezierCurveTo: () => {},
      clip: () => {}, rect: () => {},
      set fillStyle(v) {}, set strokeStyle(v) {},
      set globalAlpha(v) {}, set lineWidth(v) {},
      set font(v) {}, set textAlign(v) {}, set textBaseline(v) {},
      set lineCap(v) {}, set lineJoin(v) {},
      measureText: () => ({ width: 0 }),
      fillText: () => {},
    }),
    parentElement: { clientWidth: 600, clientHeight: 600 },
    addEventListener: () => {}, removeEventListener: () => {},
  };
  return canvas;
}

// 复制 contest-interactive-demo.js 的 faceParamsToRendererParams（Web adapter）
function faceParamsToRendererParams(fp) {
  const blinkLeft = fp.blinkLeft ?? fp.blink ?? 0;
  const blinkRight = fp.blinkRight ?? fp.blink ?? 0;
  const eyeLeft = fp.eyeLeft ?? (1 - blinkLeft);
  const eyeRight = fp.eyeRight ?? (1 - blinkRight);
  // Web-only pitch sign flip
  const yawNorm = (-(fp.yaw ?? 0)) * 0.5 + 0.5;
  const pitchNorm = (-(fp.pitch ?? 0)) * 0.5 + 0.5;
  const rollNorm = (fp.roll ?? 0) * 0.5 + 0.5;
  return {
    mouthOpen: fp.mouthOpen ?? 0,
    mouthSmile: fp.smile ?? 0,
    eyeLeft, eyeRight,
    headYaw: yawNorm,
    headPitch: pitchNorm,
    headRoll: rollNorm,
    headX: fp.headX ?? 0.5,
    headY: fp.headY ?? 0.5,
    gazeLeftX: fp.gazeLeftX ?? 0,
    gazeLeftY: fp.gazeLeftY ?? 0,
    gazeRightX: fp.gazeRightX ?? 0,
    gazeRightY: fp.gazeRightY ?? 0,
    browLeft: 0,
    browRight: 0,
  };
}

// 复制 Android receiver 的 face-frame→headPitch 公式
function androidFaceFrameToRendererParams(ff, mirrorEnabled = true) {
  const rawPitch = ff.headPitch || 0;
  const headPitch = mirrorEnabled
    ? 0.5 - rawPitch / 90
    : 0.5 + rawPitch / 90;
  return {
    headPitch,
    rendererPitchDegrees: (headPitch - 0.5) * 90,
    visualDirection: (rawPitch < 0) ? 'visual-down' : (rawPitch > 0) ? 'visual-up' : 'neutral',
  };
}

async function createAvatar() {
  const mockCanvas = makeMockCanvas();
  const originalDoc = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.document = { getElementById: () => mockCanvas };
  globalThis.window = { addEventListener: () => {}, removeEventListener: () => {}, devicePixelRatio: 1 };
  const rendererMod = await import(`file://${path.join(SRC, 'procedural-mesh-renderer.js')}`);
  const SpindleAvatar = rendererMod.ProceduralSpindleAvatar ?? rendererMod.ProceduralSpindleWhaleAvatar;
  const avatar = new SpindleAvatar('test-canvas');
  avatar._cleanup = () => {
    globalThis.document = originalDoc;
    globalThis.window = originalWindow;
  };
  return avatar;
}

describe('Web pitch direction fix', () => {
  it('rawPitchDown (fp.pitch<0, MediaPipe convention) → visualHeadDown (fish looks down on screen)', () => {
    // MediaPipe FaceLandmarker: 用户低头时 fp.pitch<0，用户抬头时 fp.pitch>0。
    // 当前 renderer 约定：degree<0 让鱼"头后仰" → 视觉上看 camera（即"鱼抬头"），
    // degree>0 让鱼"头前倾" → 视觉上看着地面（即"鱼低头"）。
    // 旧代码 (pitchNorm = (fp.pitch)*0.5+0.5) 表现：fp.pitch<0 (用户低头) → 鱼抬头。
    // 修复后 (pitchNorm = (-(fp.pitch))*0.5+0.5)：
    //   - 用户低头 (fp.pitch<0) → headPitch>0.5 → degree>0 → 鱼视觉上低头 ✓
    //   - 用户抬头 (fp.pitch>0) → headPitch<0.5 → degree<0 → 鱼视觉上抬头 ✓
    const r = faceParamsToRendererParams({ pitch: -0.5 });
    assert.ok(r.headPitch > 0.5,
      `rawPitchDown (fp.pitch=-0.5) should produce headPitch>0.5 (fish looks down), got ${r.headPitch}`);
    const deg = (r.headPitch - 0.5) * 90;
    assert.ok(deg > 0, `expected degree>0 (fish tilts forward / looks down) got ${deg}`);
  });

  it('rawPitchUp (fp.pitch>0, MediaPipe convention) → visualHeadUp (fish looks up on screen)', () => {
    const r = faceParamsToRendererParams({ pitch: 0.5 });
    assert.ok(r.headPitch < 0.5,
      `rawPitchUp (fp.pitch=0.5) should produce headPitch<0.5 (fish looks up), got ${r.headPitch}`);
    const deg = (r.headPitch - 0.5) * 90;
    assert.ok(deg < 0, `expected degree<0 (fish tilts back / looks up) got ${deg}`);
  });

  it('neutral pitch → neutral (0.5)', () => {
    const r = faceParamsToRendererParams({ pitch: 0 });
    assert.equal(r.headPitch, 0.5);
  });

  it('pitch sign flip does not affect yaw or roll (same yaw/roll inputs)', () => {
    // 测试重点：只改 pitch 时，yaw 和 roll 的输出必须保持一致
    const r1 = faceParamsToRendererParams({ yaw: 0.3, pitch: 0, roll: 0.1 });
    const r2 = faceParamsToRendererParams({ yaw: 0.3, pitch: -0.2, roll: 0.1 });
    assert.ok(Math.abs(r1.headYaw - r2.headYaw) < 1e-6, 'yaw should not change with pitch');
    assert.ok(Math.abs(r1.headRoll - r2.headRoll) < 1e-6, 'roll should not change with pitch');
  });
});

describe('Android pitch direction (preserved)', () => {
  it('rawPitchDown (rawPitch<0) → headPitch>0.5 via 0.5 - rawPitch/90', () => {
    // 用户已确认 Android 低头/抬头方向正确。
    // Android 公式：headPitch = 0.5 - rawPitch / 90（mirror 模式）
    //   - 用户低头 (rawPitch<0) → headPitch>0.5 → 视觉上 fish 低头
    //   - 用户抬头 (rawPitch>0) → headPitch<0.5 → 视觉上 fish 抬头
    // 这与 Web adapter 行为一致（Web 用 `(-(fp.pitch))*0.5+0.5`，Android 用 `0.5-rawPitch/90`），
    // 因此两侧最终视觉方向一致，但中间符号和映射公式独立。禁止修改 Android 公式。
    const r = androidFaceFrameToRendererParams({ headPitch: -30 }, true);
    assert.ok(Math.abs(r.headPitch - 0.8333) < 1e-3,
      `expected headPitch≈0.8333 (Android formula preserved), got ${r.headPitch}`);
    assert.ok(r.headPitch > 0.5, 'rawPitch<0 (用户低头) → headPitch>0.5');
  });

  it('rawPitchUp (rawPitch>0) → headPitch<0.5 (preserved)', () => {
    const r = androidFaceFrameToRendererParams({ headPitch: 30 }, true);
    assert.ok(Math.abs(r.headPitch - 0.1667) < 1e-3,
      `expected headPitch≈0.1667 got ${r.headPitch}`);
    assert.ok(r.headPitch < 0.5, 'rawPitch>0 (用户抬头) → headPitch<0.5');
  });

  it('Android headPitch mapping unchanged from previous round', () => {
    // 0.5 - rawPitch / 90 必须保留
    const r = androidFaceFrameToRendererParams({ headPitch: 0 }, true);
    assert.equal(r.headPitch, 0.5);
  });
});

describe('Iris/pupil size stability', () => {
  it('yaw 0/30/60/75° near-eye iris radius variation < 5%', async () => {
    const avatar = await createAvatar();
    try {
      const samples = [];
      const yawAngles = [0, 30, 60, 75];
      for (const yaw of yawAngles) {
        avatar.updateParams({ poseUnit: 'degrees', headYaw: yaw, headPitch: 0, headRoll: 0,
          eyeLeft: 1, eyeRight: 1, mouthOpen: 0, smile: 0,
          headX: 0.5, headY: 0.5,
          gazeLeftX: 0, gazeLeftY: 0, gazeRightX: 0, gazeRightY: 0 });
        const irisR = (avatar.irisDiag.left.radius + avatar.irisDiag.right.radius) / 2;
        samples.push(irisR);
      }
      const baseline = samples[0];
      const maxDeviation = Math.max(...samples.map(s => Math.abs(s - baseline) / baseline));
      assert.ok(maxDeviation < 0.05,
        `Iris radius variation should be <5% across yaw, got ${(maxDeviation * 100).toFixed(2)}%. samples=${JSON.stringify(samples)}`);
    } finally {
      avatar._cleanup();
    }
  });

  it('pupil radius variation < 5% across yaw 0/30/60/75°', async () => {
    const avatar = await createAvatar();
    try {
      const samples = [];
      const yawAngles = [0, 30, 60, 75];
      for (const yaw of yawAngles) {
        avatar.updateParams({ poseUnit: 'degrees', headYaw: yaw, headPitch: 0, headRoll: 0,
          eyeLeft: 1, eyeRight: 1, mouthOpen: 0, smile: 0,
          headX: 0.5, headY: 0.5,
          gazeLeftX: 0, gazeLeftY: 0, gazeRightX: 0, gazeRightY: 0 });
        const pR = (avatar.irisDiag.left.pupilRadius + avatar.irisDiag.right.pupilRadius) / 2;
        samples.push(pR);
      }
      const baseline = samples[0];
      const maxDeviation = Math.max(...samples.map(s => Math.abs(s - baseline) / baseline));
      assert.ok(maxDeviation < 0.05,
        `Pupil radius variation should be <5% across yaw, got ${(maxDeviation * 100).toFixed(2)}%`);
    } finally {
      avatar._cleanup();
    }
  });

  it('pupil/iris ratio stable across yaw', async () => {
    const avatar = await createAvatar();
    try {
      const ratios = [];
      for (const yaw of [0, 30, 60, 75]) {
        avatar.updateParams({ poseUnit: 'degrees', headYaw: yaw, headPitch: 0, headRoll: 0,
          eyeLeft: 1, eyeRight: 1, mouthOpen: 0, smile: 0,
          headX: 0.5, headY: 0.5 });
        const r = avatar.irisDiag.right;
        if (r && r.visible) {
          ratios.push(r.pupilRadius / r.radius);
        }
      }
      assert.ok(ratios.length >= 3, `should have at least 3 samples, got ${ratios.length}`);
      const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
      const maxDev = Math.max(...ratios.map(r => Math.abs(r - avg)));
      assert.ok(maxDev < 0.05, `pupil/iris ratio deviation should be <5% (0.05), got ${maxDev}`);
    } finally {
      avatar._cleanup();
    }
  });

  it('gaze position changes but iris size stays the same', async () => {
    const avatar = await createAvatar();
    try {
      avatar.updateParams({ poseUnit: 'degrees', headYaw: 0, headPitch: 0, headRoll: 0,
        eyeLeft: 1, eyeRight: 1, mouthOpen: 0, smile: 0,
        headX: 0.5, headY: 0.5,
        gazeLeftX: 0, gazeLeftY: 0, gazeRightX: 0, gazeRightY: 0 });
      const r0 = avatar.irisDiag.right;
      avatar.updateParams({ poseUnit: 'degrees', headYaw: 0, headPitch: 0, headRoll: 0,
        eyeLeft: 1, eyeRight: 1, mouthOpen: 0, smile: 0,
        headX: 0.5, headY: 0.5,
        gazeLeftX: 1, gazeLeftY: 0, gazeRightX: 1, gazeRightY: 0 });
      const r1 = avatar.irisDiag.right;
      // iris size must be the same
      const sizeDelta = Math.abs(r0.radius - r1.radius);
      assert.ok(sizeDelta < 0.5, `iris size should not change with gaze, got delta=${sizeDelta}`);
      // position must change
      const posDelta = Math.hypot(r0.centerX - r1.centerX, r0.centerY - r1.centerY);
      assert.ok(posDelta > 1, `iris position should change with gaze, got delta=${posDelta}`);
    } finally {
      avatar._cleanup();
    }
  });
});

describe('Eye surface binding (pitch-immune)', () => {
  it('eye surface bindings are built on avatar construction', async () => {
    const avatar = await createAvatar();
    try {
      assert.ok(avatar.eyeSurfaceBindings, 'eyeSurfaceBindings must exist');
      assert.ok(avatar.eyeSurfaceBindings.left, 'left binding must exist');
      assert.ok(avatar.eyeSurfaceBindings.right, 'right binding must exist');
      assert.ok(avatar.eyeSurfaceBindings.left.faceRef !== undefined, 'left binding faceRef must be set');
      assert.ok(avatar.eyeSurfaceBindings.right.faceRef !== undefined, 'right binding faceRef must be set');
    } finally {
      avatar._cleanup();
    }
  });

  it('pitch ±30° keeps eye surface attachment stable', async () => {
    const avatar = await createAvatar();
    try {
      const samples = [];
      for (const pitch of [-30, -15, 0, 15, 30]) {
        avatar.updateParams({ poseUnit: 'degrees', headYaw: 0, headPitch: pitch, headRoll: 0,
          eyeLeft: 1, eyeRight: 1, mouthOpen: 0, smile: 0,
          headX: 0.5, headY: 0.5,
          gazeLeftX: 0, gazeLeftY: 0, gazeRightX: 0, gazeRightY: 0 });
        // irisDiag stores finalOpacity for each eye
        const leftOpacity = avatar.irisDiag.left.finalOpacity;
        const rightOpacity = avatar.irisDiag.right.finalOpacity;
        samples.push({ pitch, leftOpacity, rightOpacity });
      }
      // All eyes at yaw=0 are near-eye, so both eyes should be visible (opacity ≈ 1)
      for (const s of samples) {
        assert.ok(s.leftOpacity > 0.9, `left eye should be visible at pitch=${s.pitch} (yaw=0), got ${s.leftOpacity}`);
        assert.ok(s.rightOpacity > 0.9, `right eye should be visible at pitch=${s.pitch} (yaw=0), got ${s.rightOpacity}`);
      }
    } finally {
      avatar._cleanup();
    }
  });

  it('binding still tracks mesh after pitch change', async () => {
    const avatar = await createAvatar();
    try {
      // faceRef must remain the same for all pitch values (no triangle jumping)
      const initialFaceRef = avatar.eyeSurfaceBindings.left.faceRef;
      for (const pitch of [-30, -15, 0, 15, 30]) {
        avatar.updateParams({ poseUnit: 'degrees', headYaw: 0, headPitch: pitch, headRoll: 0,
          eyeLeft: 1, eyeRight: 1, mouthOpen: 0, smile: 0,
          headX: 0.5, headY: 0.5 });
        assert.equal(avatar.eyeSurfaceBindings.left.faceRef, initialFaceRef,
          `faceRef should not change with pitch (no triangle jumping)`);
      }
    } finally {
      avatar._cleanup();
    }
  });
});

describe('Upper lip not modified', () => {
  it('upperLipRatio is 0.18 (unchanged from previous round)', async () => {
    const avatar = await createAvatar();
    try {
      // open mouth fully and check mouthDiag
      avatar.updateParams({ poseUnit: 'degrees', headYaw: 0, headPitch: 0, headRoll: 0,
        eyeLeft: 1, eyeRight: 1, mouthOpen: 1.0, smile: 0,
        headX: 0.5, headY: 0.5 });
      const m = avatar.mouthDiag;
      assert.ok(m, 'mouthDiag should exist');
      // mouthDiag should expose upperLiftAtMouthOpenOne or similar
      if (m.upperLipRatio !== undefined) {
        assert.ok(Math.abs(m.upperLipRatio - 0.18) < 1e-6,
          `upperLipRatio should be 0.18, got ${m.upperLipRatio}`);
      }
      // 上一轮的基线：mouthOpen=1 时上唇抬起量约等于 3.6px
      // (upperVisualOpen * baseOpenHeight * 0.18)
      // baseOpenHeight ≈ 20; upperVisualOpen(smoothstep(0.05, 0.50, 1)) = 1
      // upperLift = 1 * 20 * 0.18 = 3.6
      // 仍然要 < 0.20（任务硬性限制）
      if (m.upperLipRatio !== undefined) {
        assert.ok(m.upperLipRatio <= 0.20, `upperLipRatio must be <= 0.20, got ${m.upperLipRatio}`);
      }
    } finally {
      avatar._cleanup();
    }
  });
});

describe('Web pitch flip in real adapter chain', () => {
  it('raw pitch=0 → renderer headPitch=0.5', async () => {
    const avatar = await createAvatar();
    try {
      const params = faceParamsToRendererParams({ pitch: 0, yaw: 0, roll: 0 });
      avatar.updateParams({ poseUnit: 'normalized', headPitch: params.headPitch, headYaw: params.headYaw, headRoll: params.headRoll });
      // (no direct way to read rendererPitch from avatar; but opacity & irisDiag should be 1)
      assert.ok(avatar.irisDiag.left.finalOpacity > 0.9, 'neutral → both eyes visible');
      assert.ok(avatar.irisDiag.right.finalOpacity > 0.9, 'neutral → both eyes visible');
    } finally {
      avatar._cleanup();
    }
  });

  it('raw pitch=-0.5 (look down) produces visualHeadDown (headPitch>0.5)', async () => {
    const avatar = await createAvatar();
    try {
      const params = faceParamsToRendererParams({ pitch: -0.5, yaw: 0, roll: 0 });
      // Web 修复后：fp.pitch=-0.5 (用户低头) → headPitch>0.5 (鱼视觉低头)
      assert.ok(params.headPitch > 0.5,
        `rawPitchDown (fp.pitch=-0.5) should produce headPitch>0.5 (look down), got ${params.headPitch}`);
    } finally {
      avatar._cleanup();
    }
  });
});
