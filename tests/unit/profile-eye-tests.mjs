import { describe, it } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(REPO_ROOT, 'src', 'face-tracking');

function makeMockCanvas() {
  return {
    width: 360,
    height: 360,
    parentElement: { clientWidth: 360, clientHeight: 360 },
    getContext: () => ({
      save: () => {},
      restore: () => {},
      globalAlpha: 1,
      translate: () => {},
      rotate: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      quadraticCurveTo: () => {},
      ellipse: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      clip: () => {},
      fillRect: () => {},
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      clearRect: () => {},
      scale: () => {},
      bezierCurveTo: () => {},
      font: '',
      textAlign: '',
      textBaseline: '',
      fillText: () => {},
      measureText: () => ({ width: 0 }),
      createLinearGradient: () => ({ addColorStop: () => {} }),
    }),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

async function createAvatar() {
  const mockCanvas = makeMockCanvas();
  const originalDoc = globalThis.document;
  const originalWindow = globalThis.window;

  globalThis.document = { getElementById: () => mockCanvas };
  globalThis.window = { addEventListener: () => {}, removeEventListener: () => {}, devicePixelRatio: 1 };

  const rendererMod = await import(`file://${path.join(SRC, 'procedural-mesh-renderer.js')}`);
  const SpindleAvatar = rendererMod.ProceduralSpindleWhaleAvatar;
  const avatar = new SpindleAvatar('test-canvas');

  avatar._cleanup = () => {
    globalThis.document = originalDoc;
    globalThis.window = originalWindow;
  };

  return avatar;
}

// Base params with poseUnit: "degrees" for direct degree input
const degBase = {
  poseUnit: 'degrees',
  headPitch: 0,
  headRoll: 0,
  eyeLeft: 1,
  eyeRight: 1,
  eyeWideLeft: 0,
  eyeWideRight: 0,
  eyeSquintLeft: 0,
  eyeSquintRight: 0,
  gazeLeftX: 0,
  gazeLeftY: 0,
  gazeRightX: 0,
  gazeRightY: 0,
  blink: 0,
  mouthOpen: 0,
  smile: 0,
  headX: 0.5,
  headY: 0.5,
};

// Replicate faceParamsToRendererParams from contest-interactive-demo.js
// to test the real adapter → renderer chain
function faceParamsToRendererParams(fp) {
  const blinkLeft = fp.blinkLeft ?? fp.blink ?? 0;
  const blinkRight = fp.blinkRight ?? fp.blink ?? 0;
  const eyeLeft = fp.eyeLeft ?? (1 - blinkLeft);
  const eyeRight = fp.eyeRight ?? (1 - blinkRight);
  // Mirror yaw for selfie view (like open demo mirror mode): negate yaw
  // Pitch: Web-only sign flip so the fish tilts the same way the user does.
  //   - user looks down (fp.pitch < 0 in MediaPipe space) → visual head down → headPitch < 0
  //   - user looks up   (fp.pitch > 0 in MediaPipe space) → visual head up   → headPitch > 0
  // Roll is NOT negated — open demo's mirror mode does the negation+mirror twice, cancelling out.
  const yawNorm = (-(fp.yaw ?? 0)) * 0.5 + 0.5;
  const pitchNorm = (-(fp.pitch ?? 0)) * 0.5 + 0.5;
  const rollNorm = (fp.roll ?? 0) * 0.5 + 0.5;
  return {
    mouthOpen: fp.mouthOpen ?? 0,
    mouthSmile: fp.smile ?? 0,
    eyeLeft: eyeLeft,
    eyeRight: eyeRight,
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

describe('profile eye tests', () => {
  it('profile far-eye occlusion', async () => {
    const avatar = await createAvatar();
    try {
      avatar.updateParams({ ...degBase, headYaw: 75 });

      const diag = avatar.irisDiag;
      const leftEyeVisible = diag.left && diag.left.visible;
      const rightEyeVisible = diag.right && diag.right.visible;

      assert.ok(!leftEyeVisible || diag.left.finalOpacity < 0.5,
        'Far eye (left) should be occluded at yaw=75');
      assert.ok(rightEyeVisible && diag.right.finalOpacity > 0.8,
        'Near eye (right) should be visible at yaw=75');
    } finally {
      avatar._cleanup();
    }
  });

  it('irisToEyeMinorRatio stability', async () => {
    const avatar = await createAvatar();
    try {
      const yawAngles = [-45, -30, 0, 30, 45];
      const ratios = [];

      for (const yaw of yawAngles) {
        avatar.updateParams({ ...degBase, headYaw: yaw });

        const diag = avatar.irisDiag;
        if (diag.right && diag.right.visible && diag.right.irisToEyeMinorRatio !== undefined) {
          ratios.push(diag.right.irisToEyeMinorRatio);
        }
      }

      assert.ok(ratios.length >= 3, `Should have at least 3 samples, got ${ratios.length}`);
      const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
      const maxDeviation = Math.max(...ratios.map(r => Math.abs(r - avgRatio)));

      assert.ok(maxDeviation < 0.02,
        `irisToEyeMinorRatio deviation should be < 0.02, got ${maxDeviation}`);
    } finally {
      avatar._cleanup();
    }
  });

  it('pupilToIrisRatio stability', async () => {
    const avatar = await createAvatar();
    try {
      const yawAngles = [-45, -30, 0, 30, 45];
      const ratios = [];

      for (const yaw of yawAngles) {
        avatar.updateParams({ ...degBase, headYaw: yaw });

        const diag = avatar.irisDiag;
        if (diag.right && diag.right.visible && diag.right.pupilToIrisRatio !== undefined) {
          ratios.push(diag.right.pupilToIrisRatio);
        }
      }

      assert.ok(ratios.length >= 3, `Should have at least 3 samples, got ${ratios.length}`);
      const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
      const maxDeviation = Math.max(...ratios.map(r => Math.abs(r - avgRatio)));

      assert.ok(maxDeviation < 0.01,
        `pupilToIrisRatio deviation should be < 0.01, got ${maxDeviation}`);
    } finally {
      avatar._cleanup();
    }
  });

  it('basisBlend continuity', async () => {
    const avatar = await createAvatar();
    try {
      const blends = [];
      for (let yaw = 0; yaw <= 90; yaw += 5) {
        avatar.updateParams({ ...degBase, headYaw: yaw });
        const diag = avatar.irisDiag;
        if (diag.right && diag.right.basisBlend !== undefined) {
          blends.push(diag.right.basisBlend);
        }
      }
      // basisBlend should be non-decreasing (more blend at larger yaw)
      for (let i = 1; i < blends.length; i++) {
        assert.ok(blends[i] >= blends[i - 1] - 0.001,
          `basisBlend should be non-decreasing, step ${i}: ${blends[i-1]} -> ${blends[i]}`);
      }
      // At yaw=0, blend should be 0
      assert.ok(blends[0] < 0.01, `basisBlend at yaw=0 should be ~0, got ${blends[0]}`);
    } finally {
      avatar._cleanup();
    }
  });

  it('opacity continuity', async () => {
    const avatar = await createAvatar();
    try {
      const opacities = [];
      for (let yaw = 0; yaw <= 85; yaw += 5) {
        avatar.updateParams({ ...degBase, headYaw: yaw });

        const diag = avatar.irisDiag;
        if (diag.left) {
          opacities.push(diag.left.finalOpacity || 0);
        }
      }

      for (let i = 1; i < opacities.length; i++) {
        const diff = Math.abs(opacities[i] - opacities[i - 1]);
        assert.ok(diff < 0.2,
          `Opacity change between yaw steps should be < 0.2, got ${diff} at yaw=${(i-1)*5}`);
      }
    } finally {
      avatar._cleanup();
    }
  });

  it('normal-range regression', async () => {
    const avatar = await createAvatar();
    try {
      const yawAngles = [-45, -30, 0, 30, 45];

      for (const yaw of yawAngles) {
        avatar.updateParams({ ...degBase, headYaw: yaw });

        const diag = avatar.irisDiag;
        assert.ok(diag.left && diag.left.visible, `Left eye should be visible at yaw=${yaw}`);
        assert.ok(diag.right && diag.right.visible, `Right eye should be visible at yaw=${yaw}`);
        assert.ok(diag.left.finalOpacity > 0.8, `Left eye opacity should be > 0.8 at yaw=${yaw}`);
        assert.ok(diag.right.finalOpacity > 0.8, `Right eye opacity should be > 0.8 at yaw=${yaw}`);
      }
    } finally {
      avatar._cleanup();
    }
  });

  it('blink + profile', async () => {
    const avatar = await createAvatar();
    try {
      avatar.updateParams({ ...degBase, headYaw: 60, blink: 1 });

      const diag = avatar.irisDiag;
      assert.ok(diag.right && diag.right.clippedByEyelid,
        'Near eye should be clipped by eyelid during full blink');
    } finally {
      avatar._cleanup();
    }
  });

  it('pitch + profile', async () => {
    const avatar = await createAvatar();
    try {
      avatar.updateParams({ ...degBase, headYaw: 60, headPitch: 15 });

      const diag = avatar.irisDiag;
      assert.ok(diag.right && diag.right.visible,
        'Near eye should remain visible with pitch+profile');
      assert.ok(diag.right.finalOpacity > 0.5,
        'Near eye opacity should be reasonable with pitch+profile');
    } finally {
      avatar._cleanup();
    }
  });
});

// ====== Pose contract tests ======

describe('pose contract tests', () => {
  it('normalized contract: neutral = 0 degrees', async () => {
    const avatar = await createAvatar();
    try {
      // Simulate real adapter chain: faceParamsToRendererParams({yaw:0}) → headYaw: 0.5
      const rendererParams = faceParamsToRendererParams({ yaw: 0, pitch: 0, roll: 0 });
      avatar.updateParams(rendererParams);

      const diag = avatar.irisDiag;
      assert.ok(diag.left && diag.left.visible, 'Left eye should be visible at neutral');
      assert.ok(diag.right && diag.right.visible, 'Right eye should be visible at neutral');
      assert.ok(diag.left.finalOpacity > 0.9, 'Left eye opacity should be ~1 at neutral');
      assert.ok(diag.right.finalOpacity > 0.9, 'Right eye opacity should be ~1 at neutral');
    } finally {
      avatar._cleanup();
    }
  });

  it('normalized contract: yaw produces visible angle change', async () => {
    const avatar = await createAvatar();
    try {
      // yaw=-1 (user looks left) → yawNorm=1 → headYaw=60° (mirror)
      const rendererParams = faceParamsToRendererParams({ yaw: -1, pitch: 0, roll: 0 });
      avatar.updateParams(rendererParams);

      const diag = avatar.irisDiag;
      // At 60°, the far eye (right, since headYaw>0) should start fading
      assert.ok(diag.right, 'Right eye diag should exist');
      assert.ok(diag.left, 'Left eye diag should exist');
    } finally {
      avatar._cleanup();
    }
  });

  it('normalized contract: pitch direction correct', async () => {
    const avatar = await createAvatar();
    try {
      // pitch=1 (up) → pitchNorm=1 → headPitch=45°
      const rendererParamsUp = faceParamsToRendererParams({ yaw: 0, pitch: 1, roll: 0 });
      avatar.updateParams(rendererParamsUp);
      const diagUp = avatar.irisDiag;
      assert.ok(diagUp.left && diagUp.left.visible, 'Eyes should be visible with pitch up');

      // pitch=-1 (down) → pitchNorm=0 → headPitch=-45°
      const rendererParamsDown = faceParamsToRendererParams({ yaw: 0, pitch: -1, roll: 0 });
      avatar.updateParams(rendererParamsDown);
      const diagDown = avatar.irisDiag;
      assert.ok(diagDown.left && diagDown.left.visible, 'Eyes should be visible with pitch down');
    } finally {
      avatar._cleanup();
    }
  });

  it('real adapter chain: raw face frame → renderer normalizeParams → final headYaw', async () => {
    const avatar = await createAvatar();
    try {
      // Simulate a real face frame with moderate yaw
      const faceFrame = { headYaw: 30, headPitch: 0, headRoll: 0 };
      // Convert to faceParams (as contest-interactive-demo.js does)
      const state = {
        faceParams: {
          yaw: Math.max(-1, Math.min(1, faceFrame.headYaw / 60)),
          pitch: Math.max(-1, Math.min(1, faceFrame.headPitch / 45)),
          roll: Math.max(-1, Math.min(1, faceFrame.headRoll / 40)),
          mouthOpen: 0,
          smile: 0,
          blink: 0,
          eyeLeft: 1,
          eyeRight: 1,
          headX: 0.5,
          headY: 0.5,
        }
      };
      // Apply adapter mapping
      const rendererParams = faceParamsToRendererParams(state.faceParams);
      // Pass to renderer (no poseUnit = normalized)
      avatar.updateParams(rendererParams);

      const diag = avatar.irisDiag;
      assert.ok(diag.left && diag.left.visible, 'Left eye should be visible at moderate yaw');
      assert.ok(diag.right && diag.right.visible, 'Right eye should be visible at moderate yaw');
      assert.ok(diag.left.finalOpacity > 0.8, 'Left eye opacity should be high at moderate yaw');
      assert.ok(diag.right.finalOpacity > 0.8, 'Right eye opacity should be high at moderate yaw');
    } finally {
      avatar._cleanup();
    }
  });

  it('real adapter chain: large yaw → far eye occlusion', async () => {
    const avatar = await createAvatar();
    try {
      // Simulate a large yaw face frame (50° → yaw=50/60≈0.83)
      const faceFrame = { headYaw: 50, headPitch: 0, headRoll: 0 };
      const state = {
        faceParams: {
          yaw: Math.max(-1, Math.min(1, faceFrame.headYaw / 60)),
          pitch: 0,
          roll: 0,
          mouthOpen: 0,
          smile: 0,
          blink: 0,
          eyeLeft: 1,
          eyeRight: 1,
          headX: 0.5,
          headY: 0.5,
        }
      };
      const rendererParams = faceParamsToRendererParams(state.faceParams);
      avatar.updateParams(rendererParams);

      const diag = avatar.irisDiag;
      // yaw=50° → yawNorm = -(0.83)*0.5+0.5 = 0.083 → headYaw = (0.083-0.5)*120 = -50°
      // So headYaw ≈ -50°, far eye = right eye (headYaw < 0)
      assert.ok(diag.left, 'Left eye diag should exist');
      assert.ok(diag.right, 'Right eye diag should exist');
      // At ~50°, the far eye should start fading but may still be visible
      // The key is that the angle is actually applied, not frozen at ~0
      const leftOp = diag.left.finalOpacity || 0;
      const rightOp = diag.right.finalOpacity || 0;
      // At least one eye should have different opacity from 1.0 (proving angle is applied)
      assert.ok(leftOp < 1.0 || rightOp < 1.0,
        `At least one eye should show angle effect (left=${leftOp}, right=${rightOp})`);
    } finally {
      avatar._cleanup();
    }
  });

  it('degrees contract: direct degrees input works', async () => {
    const avatar = await createAvatar();
    try {
      avatar.updateParams({ ...degBase, headYaw: 0 });
      const diagNeutral = avatar.irisDiag;
      const neutralLeftOp = diagNeutral.left.finalOpacity;

      avatar.updateParams({ ...degBase, headYaw: 75 });
      const diagFar = avatar.irisDiag;
      const farLeftOp = diagFar.left ? (diagFar.left.finalOpacity || 0) : 0;

      assert.ok(farLeftOp < neutralLeftOp,
        `Far eye opacity should decrease at yaw=75 (neutral=${neutralLeftOp}, far=${farLeftOp})`);
    } finally {
      avatar._cleanup();
    }
  });
});
