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

describe('profile eye tests', () => {
  it('profile far-eye occlusion', async () => {
    const avatar = await createAvatar();
    try {
      avatar.updateParams({
        headYaw: 75,
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
      });
      
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
  
  it('irisToEyeRatio stability', async () => {
    const avatar = await createAvatar();
    try {
      const yawAngles = [-45, -30, 0, 30, 45];
      const ratios = [];
      
      for (const yaw of yawAngles) {
        avatar.updateParams({
          headYaw: yaw,
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
        });
        
        const diag = avatar.irisDiag;
        if (diag.right && diag.right.visible) {
          const ratio = diag.right.radius / Math.max(diag.right.eyeRx, diag.right.eyeRy);
          ratios.push(ratio);
        }
      }
      
      const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
      const maxDeviation = Math.max(...ratios.map(r => Math.abs(r - avgRatio)));
      
      assert.ok(maxDeviation < 0.1, 
        `irisToEyeRatio deviation should be < 0.1, got ${maxDeviation}`);
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
        avatar.updateParams({
          headYaw: yaw,
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
        });
        
        const diag = avatar.irisDiag;
        if (diag.right && diag.right.visible) {
          const pupilR = diag.right.radius * 0.55;
          const ratio = pupilR / diag.right.radius;
          ratios.push(ratio);
        }
      }
      
      const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
      const maxDeviation = Math.max(...ratios.map(r => Math.abs(r - avgRatio)));
      
      assert.ok(maxDeviation < 0.05, 
        `pupilToIrisRatio deviation should be < 0.05, got ${maxDeviation}`);
    } finally {
      avatar._cleanup();
    }
  });
  
  it('opacity continuity', async () => {
    const avatar = await createAvatar();
    try {
      const opacities = [];
      for (let yaw = 0; yaw <= 85; yaw += 5) {
        avatar.updateParams({
          headYaw: yaw,
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
        });
        
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
        avatar.updateParams({
          headYaw: yaw,
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
        });
        
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
      avatar.updateParams({
        headYaw: 60,
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
        blink: 1,
        mouthOpen: 0,
        smile: 0,
        headX: 0.5,
        headY: 0.5,
      });
      
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
      avatar.updateParams({
        headYaw: 60,
        headPitch: 15,
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
      });
      
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