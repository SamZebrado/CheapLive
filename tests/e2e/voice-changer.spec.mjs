import { test, expect } from '@playwright/test';

// ---- 共享 mock 脚本 ----
function sharedMocks() {
  return [
    // Mock AudioContext with native effects support
    () => {
      const mockAudioContext = {
        state: 'running',
        sampleRate: 44100,
        destination: {},
        createGain: () => ({ gain: { value: 0.8 }, connect: () => {}, disconnect: () => {} }),
        createScriptProcessor: () => ({
          onaudioprocess: null,
          connect: () => {},
          disconnect: () => {},
        }),
        createMediaStreamSource: () => ({ connect: () => {}, disconnect: () => {} }),
        createMediaStreamDestination: () => ({ stream: { getAudioTracks: () => [] } }),
        createBiquadFilter: () => ({
          type: 'lowshelf', frequency: { value: 1000 }, Q: { value: 0 }, gain: { value: 0 },
          connect: () => {}, disconnect: () => {},
        }),
        createWaveShaper: () => ({ curve: null, oversample: 'none', connect: () => {}, disconnect: () => {} }),
        createDynamicsCompressor: () => ({
          threshold: { value: -24 }, ratio: { value: 12 }, attack: { value: 0.003 }, release: { value: 0.25 },
          connect: () => {}, disconnect: () => {},
        }),
        resume: async () => {},
        close: async () => {},
      };
      window.AudioContext = function() { return mockAudioContext; };
      window.webkitAudioContext = function() { return mockAudioContext; };
    },
    // Mock getUserMedia
    () => {
      const fakeStream = {
        getAudioTracks: () => [{ kind: 'audio' }],
        getTracks: () => [{ kind: 'audio' }],
        getVideoTracks: () => [],
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      };
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        // Keep original if already mocked
      } else {
        Object.defineProperty(navigator.mediaDevices || {}, 'getUserMedia', {
          value: async () => fakeStream,
          writable: true,
          configurable: true,
        });
      }
    },
  ];
}

// ================================================================
// 基础测试
// ================================================================

test('voice changer panel loads without JS error', async ({ page }) => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));

  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);

  const toggle = await page.$('#voiceChangerToggle');
  expect(toggle).not.toBeNull();

  const panel = await page.$('#voiceChangerPanel');
  expect(panel).not.toBeNull();

  expect(errs.length).toBe(0);
});

test('voice changer toggle exists and is initially unchecked', async ({ page }) => {
  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);

  const toggleChecked = await page.$eval('#voiceChangerToggle', el => el.checked);
  expect(toggleChecked).toBe(false);
});

test('voice changer presets are selectable', async ({ page }) => {
  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);

  const presets = ['normal', 'cute', 'robot', 'deep', 'radio'];
  for (const preset of presets) {
    await page.selectOption('#voiceChangerPreset', preset, { force: true });
    const presetVal = await page.$eval('#voiceChangerPreset', el => el.value);
    expect(presetVal).toBe(preset);
  }
});

test('voice changer monitor mode selection', async ({ page }) => {
  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);

  const modes = ['changed', 'original', 'mute'];
  for (const mode of modes) {
    await page.selectOption('#voiceChangerMonitor', mode, { force: true });
    const monitorVal = await page.$eval('#voiceChangerMonitor', el => el.value);
    expect(monitorVal).toBe(mode);
  }
});

test('voice changer mode selection: realtime and paragraph options exist', async ({ page }) => {
  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);

  const modeSelect = await page.$('#voiceChangerMode');
  expect(modeSelect).not.toBeNull();

  const options = await page.$$eval('#voiceChangerMode option', els => els.map(el => el.value));
  expect(options).toContain('realtime');
  expect(options).toContain('paragraph');
});

test('voice changer paragraph mode toggle activates paragraphControls', async ({ page }) => {
  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);

  const paragraphControls = await page.$('#paragraphControls');
  expect(paragraphControls).not.toBeNull();

  await page.selectOption('#voiceChangerMode', 'paragraph', { force: true });
  await page.waitForTimeout(300);

  const paragraphActive = await page.$eval('#paragraphControls', el => el.classList.contains('active'));
  expect(paragraphActive).toBe(true);

  await page.selectOption('#voiceChangerMode', 'realtime', { force: true });
  await page.waitForTimeout(300);

  const paragraphInactive = await page.$eval('#paragraphControls', el => el.classList.contains('active'));
  expect(paragraphInactive).toBe(false);
});

// ================================================================
// SoundTouch absent → native fallback
// ================================================================

test('SoundTouch absent + getUserMedia success → toggle stays on, engineMode=native', async ({ page }) => {
  // No window.soundtouch mock — simulate SoundTouch absent
  await page.addInitScript(() => {
    const mockAudioContext = {
      state: 'running',
      sampleRate: 44100,
      destination: {},
      createGain: () => ({ gain: { value: 0.8 }, connect: () => {}, disconnect: () => {} }),
      createScriptProcessor: () => ({ onaudioprocess: null, connect: () => {}, disconnect: () => {} }),
      createMediaStreamSource: () => ({ connect: () => {}, disconnect: () => {} }),
      createMediaStreamDestination: () => ({ stream: { getAudioTracks: () => [] } }),
      createBiquadFilter: () => ({
        type: 'lowshelf', frequency: { value: 1000 }, Q: { value: 0 }, gain: { value: 0 },
        connect: () => {}, disconnect: () => {},
      }),
      createWaveShaper: () => ({ curve: null, oversample: 'none', connect: () => {}, disconnect: () => {} }),
      createDynamicsCompressor: () => ({
        threshold: { value: -24 }, ratio: { value: 12 }, attack: { value: 0.003 }, release: { value: 0.25 },
        connect: () => {}, disconnect: () => {},
      }),
      resume: async () => {},
      close: async () => {},
    };
    window.AudioContext = function() { return mockAudioContext; };
    window.webkitAudioContext = function() { return mockAudioContext; };

    const fakeStream = {
      getAudioTracks: () => [{ kind: 'audio' }],
      getTracks: () => [{ kind: 'audio' }],
      getVideoTracks: () => [],
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    };
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => fakeStream,
      writable: true,
    });
  });

  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(500);

  // Enable voice changer
  await page.evaluate(() => {
    const toggle = document.getElementById('voiceChangerToggle');
    Object.defineProperty(toggle, 'checked', { value: true, writable: true });
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(1500);

  const result = await page.evaluate(() => {
    const ft = window.faceTracker;
    if (!ft?.voiceChanger) return { ok: false, error: 'no voiceChanger' };
    const vc = ft.voiceChanger;
    const d = vc.getDiagnostics();
    return {
      ok: true,
      vcEnabled: ft.voiceChangerEnabled,
      state: d.state,
      engineMode: d.engine.mode,
      soundTouchUsable: d.engine.soundTouchUsable,
      nativeGraph: d.graph.nativeGraph,
      pitchShift: d.current.pitchShift,
    };
  });

  expect(result.ok).toBe(true);
  expect(result.vcEnabled).toBe(true);
  expect(result.state).toBe('enabled');
  expect(result.engineMode).toBe('native');
  expect(result.soundTouchUsable).toBe(false);
  expect(result.nativeGraph).toBe(true);
  expect(result.pitchShift).toContain('unavailable');
});

// ================================================================
// SoundTouch malformed → native fallback
// ================================================================

test('SoundTouch malformed + getUserMedia success → toggle stays on, engineMode=native', async ({ page }) => {
  // Mock malformed SoundTouch (SoundTouch function exists but no Float32AudioBuffer)
  await page.addInitScript(() => {
    window.soundtouch = {
      SoundTouch: function(sr, ch) {
        this.pitch = 1.0; this.tempo = 1.0; this.rate = 1.0;
        this.putSamples = () => {};
        this.receiveSamples = (buf) => buf.vector?.length || 0;
      },
      // NO Float32AudioBuffer
    };
    const mockAudioContext = {
      state: 'running',
      sampleRate: 44100,
      destination: {},
      createGain: () => ({ gain: { value: 0.8 }, connect: () => {}, disconnect: () => {} }),
      createScriptProcessor: () => ({ onaudioprocess: null, connect: () => {}, disconnect: () => {} }),
      createMediaStreamSource: () => ({ connect: () => {}, disconnect: () => {} }),
      createMediaStreamDestination: () => ({ stream: { getAudioTracks: () => [] } }),
      createBiquadFilter: () => ({
        type: 'lowshelf', frequency: { value: 1000 }, Q: { value: 0 }, gain: { value: 0 },
        connect: () => {}, disconnect: () => {},
      }),
      createWaveShaper: () => ({ curve: null, oversample: 'none', connect: () => {}, disconnect: () => {} }),
      createDynamicsCompressor: () => ({
        threshold: { value: -24 }, ratio: { value: 12 }, attack: { value: 0.003 }, release: { value: 0.25 },
        connect: () => {}, disconnect: () => {},
      }),
      resume: async () => {},
      close: async () => {},
    };
    window.AudioContext = function() { return mockAudioContext; };
    window.webkitAudioContext = function() { return mockAudioContext; };

    const fakeStream = {
      getAudioTracks: () => [{ kind: 'audio' }],
      getTracks: () => [{ kind: 'audio' }],
      getVideoTracks: () => [],
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    };
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => fakeStream,
      writable: true,
    });
  });

  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const toggle = document.getElementById('voiceChangerToggle');
    Object.defineProperty(toggle, 'checked', { value: true, writable: true });
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(1500);

  const result = await page.evaluate(() => {
    const ft = window.faceTracker;
    if (!ft?.voiceChanger) return { ok: false, error: 'no voiceChanger' };
    const d = ft.voiceChanger.getDiagnostics();
    return {
      ok: true,
      vcEnabled: ft.voiceChangerEnabled,
      state: d.state,
      engineMode: d.engine.mode,
      soundTouchUsable: d.engine.soundTouchUsable,
      soundTouchDetail: d.engine.soundTouchDetail,
      nativeGraph: d.graph.nativeGraph,
    };
  });

  expect(result.ok).toBe(true);
  expect(result.vcEnabled).toBe(true);
  expect(result.state).toBe('enabled');
  expect(result.engineMode === 'native' || result.engineMode === 'fallback').toBe(true);
  expect(result.soundTouchUsable).toBe(false);
  expect(result.nativeGraph).toBe(true);
});

// ================================================================
// Full SoundTouch mock → engineMode=soundtouch
// ================================================================

test('voice changer mock success path - toggle/preset/monitor update VoiceChanger instance', async ({ page }) => {
  await page.addInitScript(() => {
    window.soundtouch = {
      SoundTouch: function(sampleRate, channels) {
        this.sampleRate = sampleRate;
        this.channels = channels;
        this.pitch = 1.0;
        this.tempo = 1.0;
        this.rate = 1.0;
        this.putSamples = () => {};
        this.receiveSamples = (buf) => buf.vector?.length || 0;
      },
      Float32AudioBuffer: function(size) {
        this.vector = new Array(size).fill(0);
      },
    };
    const fakeStream = {
      getAudioTracks: () => [{ kind: 'audio' }],
      getTracks: () => [{ kind: 'audio' }],
      getVideoTracks: () => [],
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    };
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => fakeStream,
      writable: true,
    });
    const mockAudioContext = {
      state: 'running',
      sampleRate: 44100,
      destination: {},
      createGain: () => ({ gain: { value: 0.8 }, connect: () => {}, disconnect: () => {} }),
      createScriptProcessor: () => ({ onaudioprocess: null, connect: () => {}, disconnect: () => {} }),
      createMediaStreamSource: () => ({ connect: () => {}, disconnect: () => {} }),
      createMediaStreamDestination: () => ({ stream: { getAudioTracks: () => [] } }),
      createBiquadFilter: () => ({
        type: 'lowshelf', frequency: { value: 1000 }, Q: { value: 0 }, gain: { value: 0 },
        connect: () => {}, disconnect: () => {},
      }),
      createWaveShaper: () => ({ curve: null, oversample: 'none', connect: () => {}, disconnect: () => {} }),
      createDynamicsCompressor: () => ({
        threshold: { value: -24 }, ratio: { value: 12 }, attack: { value: 0.003 }, release: { value: 0.25 },
        connect: () => {}, disconnect: () => {},
      }),
      resume: async () => {},
      close: async () => {},
    };
    window.AudioContext = function() { return mockAudioContext; };
    window.webkitAudioContext = function() { return mockAudioContext; };
  });

  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const toggle = document.getElementById('voiceChangerToggle');
    Object.defineProperty(toggle, 'checked', { value: true, writable: true });
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(1500);

  const result = await page.evaluate(() => {
    const ft = window.faceTracker;
    if (!ft) return { ok: false, error: 'no faceTracker' };
    return {
      ok: true,
      hasVoiceChanger: !!ft.voiceChanger,
      vcEnabled: ft.voiceChangerEnabled,
      panelVisible: !!ft.voiceChanger?.isActive,
    };
  });

  expect(result.ok).toBe(true);
  expect(result.hasVoiceChanger).toBe(true);
  expect(result.vcEnabled).toBe(true);

  // Apply 'cute' preset and verify pitch/tempo change
  await page.selectOption('#voiceChangerPreset', 'cute', { force: true });
  await page.waitForTimeout(300);

  const afterPreset = await page.evaluate(() => {
    const ft = window.faceTracker;
    return {
      pitch: ft.voiceChanger?.pitch,
      tempo: ft.voiceChanger?.tempo,
      monitorMode: ft.voiceChanger?.monitorMode,
    };
  });

  expect(afterPreset.pitch).toBeCloseTo(1.5, 1);
  expect(afterPreset.tempo).toBeCloseTo(1.05, 1);

  // Apply 'deep' preset
  await page.selectOption('#voiceChangerPreset', 'deep', { force: true });
  await page.waitForTimeout(300);

  const afterDeep = await page.evaluate(() => {
    const ft = window.faceTracker;
    return { pitch: ft.voiceChanger?.pitch, tempo: ft.voiceChanger?.tempo };
  });

  expect(afterDeep.pitch).toBeCloseTo(0.7, 1);
  expect(afterDeep.tempo).toBeCloseTo(0.95, 1);

  // Change monitor mode to 'mute'
  await page.selectOption('#voiceChangerMonitor', 'mute', { force: true });
  await page.waitForTimeout(300);

  const afterMute = await page.evaluate(() => {
    const ft = window.faceTracker;
    return { monitorMode: ft.voiceChanger?.monitorMode };
  });
  expect(afterMute.monitorMode).toBe('mute');

  // Change monitor mode to 'original'
  await page.selectOption('#voiceChangerMonitor', 'original', { force: true });
  await page.waitForTimeout(300);

  const afterOriginal = await page.evaluate(() => {
    const ft = window.faceTracker;
    return { monitorMode: ft.voiceChanger?.monitorMode };
  });
  expect(afterOriginal.monitorMode).toBe('original');
});

// ================================================================
// Native preset switching → effectPreset changes in debug panel
// ================================================================

test('native preset switching: cute/robot/deep/radio → effectPreset changes', async ({ page }) => {
  // No SoundTouch mock → native mode
  await page.addInitScript(() => {
    const mockAudioContext = {
      state: 'running',
      sampleRate: 44100,
      destination: {},
      createGain: () => ({ gain: { value: 0.8 }, connect: () => {}, disconnect: () => {} }),
      createScriptProcessor: () => ({ onaudioprocess: null, connect: () => {}, disconnect: () => {} }),
      createMediaStreamSource: () => ({ connect: () => {}, disconnect: () => {} }),
      createMediaStreamDestination: () => ({ stream: { getAudioTracks: () => [] } }),
      createBiquadFilter: () => ({
        type: 'lowshelf', frequency: { value: 1000 }, Q: { value: 0 }, gain: { value: 0 },
        connect: () => {}, disconnect: () => {},
      }),
      createWaveShaper: () => ({ curve: null, oversample: 'none', connect: () => {}, disconnect: () => {} }),
      createDynamicsCompressor: () => ({
        threshold: { value: -24 }, ratio: { value: 12 }, attack: { value: 0.003 }, release: { value: 0.25 },
        connect: () => {}, disconnect: () => {},
      }),
      resume: async () => {},
      close: async () => {},
    };
    window.AudioContext = function() { return mockAudioContext; };
    window.webkitAudioContext = function() { return mockAudioContext; };

    const fakeStream = {
      getAudioTracks: () => [{ kind: 'audio' }],
      getTracks: () => [{ kind: 'audio' }],
      getVideoTracks: () => [],
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    };
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => fakeStream,
      writable: true,
    });
  });

  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const toggle = document.getElementById('voiceChangerToggle');
    Object.defineProperty(toggle, 'checked', { value: true, writable: true });
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(1500);

  // Test each preset
  const presets = ['cute', 'robot', 'deep', 'radio'];
  for (const preset of presets) {
    await page.selectOption('#voiceChangerPreset', preset, { force: true });
    await page.waitForTimeout(300);

    const result = await page.evaluate(() => {
      const ft = window.faceTracker;
      if (!ft?.voiceChanger) return { ok: false };
      const d = ft.voiceChanger.getDiagnostics();
      return {
        ok: true,
        preset: d.current.preset,
        engineMode: d.engine.mode,
        filterType: ft.voiceChanger._nativeEffects?.filterNode?.type,
        hasWaveshaper: ft.voiceChanger._nativeEffects?.waveshaper?.curve !== undefined,
        hasCompressor: !!ft.voiceChanger._nativeEffects?.compressor,
      };
    });

    expect(result.ok).toBe(true);
    expect(result.preset).toBe(preset);
    expect(result.engineMode).toBe('native');
  }
});

// ================================================================
// Monitor mode switching
// ================================================================

test('monitor mode changed/original/mute switching', async ({ page }) => {
  await page.addInitScript(() => {
    const mockAudioContext = {
      state: 'running',
      sampleRate: 44100,
      destination: {},
      createGain: () => ({ gain: { value: 0.8 }, connect: () => {}, disconnect: () => {} }),
      createScriptProcessor: () => ({ onaudioprocess: null, connect: () => {}, disconnect: () => {} }),
      createMediaStreamSource: () => ({ connect: () => {}, disconnect: () => {} }),
      createMediaStreamDestination: () => ({ stream: { getAudioTracks: () => [] } }),
      createBiquadFilter: () => ({
        type: 'lowshelf', frequency: { value: 1000 }, Q: { value: 0 }, gain: { value: 0 },
        connect: () => {}, disconnect: () => {},
      }),
      createWaveShaper: () => ({ curve: null, oversample: 'none', connect: () => {}, disconnect: () => {} }),
      createDynamicsCompressor: () => ({
        threshold: { value: -24 }, ratio: { value: 12 }, attack: { value: 0.003 }, release: { value: 0.25 },
        connect: () => {}, disconnect: () => {},
      }),
      resume: async () => {},
      close: async () => {},
    };
    window.AudioContext = function() { return mockAudioContext; };
    window.webkitAudioContext = function() { return mockAudioContext; };

    const fakeStream = {
      getAudioTracks: () => [{ kind: 'audio' }],
      getTracks: () => [{ kind: 'audio' }],
      getVideoTracks: () => [],
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    };
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => fakeStream,
      writable: true,
    });
  });

  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const toggle = document.getElementById('voiceChangerToggle');
    Object.defineProperty(toggle, 'checked', { value: true, writable: true });
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(1500);

  // Test monitor modes
  const modes = ['changed', 'original', 'mute'];
  for (const mode of modes) {
    await page.selectOption('#voiceChangerMonitor', mode, { force: true });
    await page.waitForTimeout(300);

    const result = await page.evaluate(() => {
      const ft = window.faceTracker;
      if (!ft?.voiceChanger) return { ok: false };
      return { ok: true, monitorMode: ft.voiceChanger.monitorMode };
    });

    expect(result.ok).toBe(true);
    expect(result.monitorMode).toBe(mode);
  }
});

// ================================================================
// Debug panel shows engine fields
// ================================================================

test('debug panel shows engineMode, soundTouchUsable, nativeGraph fields', async ({ page }) => {
  // No SoundTouch → native mode
  await page.addInitScript(() => {
    const mockAudioContext = {
      state: 'running',
      sampleRate: 44100,
      destination: {},
      createGain: () => ({ gain: { value: 0.8 }, connect: () => {}, disconnect: () => {} }),
      createScriptProcessor: () => ({ onaudioprocess: null, connect: () => {}, disconnect: () => {} }),
      createMediaStreamSource: () => ({ connect: () => {}, disconnect: () => {} }),
      createMediaStreamDestination: () => ({ stream: { getAudioTracks: () => [] } }),
      createBiquadFilter: () => ({
        type: 'lowshelf', frequency: { value: 1000 }, Q: { value: 0 }, gain: { value: 0 },
        connect: () => {}, disconnect: () => {},
      }),
      createWaveShaper: () => ({ curve: null, oversample: 'none', connect: () => {}, disconnect: () => {} }),
      createDynamicsCompressor: () => ({
        threshold: { value: -24 }, ratio: { value: 12 }, attack: { value: 0.003 }, release: { value: 0.25 },
        connect: () => {}, disconnect: () => {},
      }),
      resume: async () => {},
      close: async () => {},
    };
    window.AudioContext = function() { return mockAudioContext; };
    window.webkitAudioContext = function() { return mockAudioContext; };

    const fakeStream = {
      getAudioTracks: () => [{ kind: 'audio' }],
      getTracks: () => [{ kind: 'audio' }],
      getVideoTracks: () => [],
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    };
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => fakeStream,
      writable: true,
    });
  });

  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const toggle = document.getElementById('voiceChangerToggle');
    Object.defineProperty(toggle, 'checked', { value: true, writable: true });
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(1500);

  const panelHtml = await page.$eval('#vcDebugPanel', el => el.innerHTML);

  expect(panelHtml).toContain('engineMode');
  expect(panelHtml).toContain('native');
  expect(panelHtml).toContain('soundTouchUsable');
  expect(panelHtml).toContain('soundTouchKeys');
  expect(panelHtml).toContain('nativeGraph');
  expect(panelHtml).toContain('pitchShift');
  expect(panelHtml).toContain('effectPreset');
  expect(panelHtml).toContain('dryMix');
  expect(panelHtml).toContain('filterType');
  expect(panelHtml).toContain('filterFreq');
  expect(panelHtml).toContain('compressorRatio');
});

// ================================================================
// Robot preset → debug panel + graph + state
// ================================================================

test('robot preset: debug panel shows effectPreset robot + nativeGraph connected', async ({ page }) => {
  await page.addInitScript(() => {
    const mockAudioContext = {
      state: 'running',
      sampleRate: 44100,
      destination: {},
      createGain: () => ({ gain: { value: 0.8 }, connect: () => {}, disconnect: () => {} }),
      createScriptProcessor: () => ({ onaudioprocess: null, connect: () => {}, disconnect: () => {} }),
      createMediaStreamSource: () => ({ connect: () => {}, disconnect: () => {} }),
      createMediaStreamDestination: () => ({ stream: { getAudioTracks: () => [] } }),
      createBiquadFilter: () => ({
        type: 'lowshelf', frequency: { value: 1000 }, Q: { value: 0 }, gain: { value: 0 },
        connect: () => {}, disconnect: () => {},
      }),
      createWaveShaper: () => ({ curve: null, oversample: 'none', connect: () => {}, disconnect: () => {} }),
      createDynamicsCompressor: () => ({
        threshold: { value: -24 }, ratio: { value: 12 }, attack: { value: 0.003 }, release: { value: 0.25 },
        connect: () => {}, disconnect: () => {},
      }),
      resume: async () => {},
      close: async () => {},
    };
    window.AudioContext = function() { return mockAudioContext; };
    window.webkitAudioContext = function() { return mockAudioContext; };

    const fakeStream = {
      getAudioTracks: () => [{ kind: 'audio' }],
      getTracks: () => [{ kind: 'audio' }],
      getVideoTracks: () => [],
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    };
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => fakeStream,
      writable: true,
    });
  });

  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const toggle = document.getElementById('voiceChangerToggle');
    Object.defineProperty(toggle, 'checked', { value: true, writable: true });
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(1500);

  // Switch to robot
  await page.selectOption('#voiceChangerPreset', 'robot', { force: true });
  await page.waitForTimeout(500);

  const result = await page.evaluate(() => {
    const ft = window.faceTracker;
    if (!ft?.voiceChanger) return { ok: false };
    const d = ft.voiceChanger.getDiagnostics();
    return {
      ok: true,
      state: d.state,
      engineMode: d.engine.mode,
      effectPreset: d.current.preset,
      nativeGraph: d.graph.nativeGraph,
      dryMix: d.current.dryMix,
      filterType: d.current.filterType,
      filterFreq: d.current.filterFreq,
      filterQ: d.current.filterQ,
      compressorRatio: d.current.compressorRatio,
    };
  });

  expect(result.ok).toBe(true);
  expect(result.state).toBe('enabled');
  expect(result.effectPreset).toBe('robot');
  expect(result.nativeGraph).toBe(true);
  expect(result.dryMix).toBe(0.7);
  expect(result.filterType).toBe('bandpass');
  expect(result.filterFreq).toBe(1200);
});

test('cute/deep/radio preset: debug panel effectPreset changes', async ({ page }) => {
  await page.addInitScript(() => {
    const mockAudioContext = {
      state: 'running',
      sampleRate: 44100,
      destination: {},
      createGain: () => ({ gain: { value: 0.8 }, connect: () => {}, disconnect: () => {} }),
      createScriptProcessor: () => ({ onaudioprocess: null, connect: () => {}, disconnect: () => {} }),
      createMediaStreamSource: () => ({ connect: () => {}, disconnect: () => {} }),
      createMediaStreamDestination: () => ({ stream: { getAudioTracks: () => [] } }),
      createBiquadFilter: () => ({
        type: 'lowshelf', frequency: { value: 1000 }, Q: { value: 0 }, gain: { value: 0 },
        connect: () => {}, disconnect: () => {},
      }),
      createWaveShaper: () => ({ curve: null, oversample: 'none', connect: () => {}, disconnect: () => {} }),
      createDynamicsCompressor: () => ({
        threshold: { value: -24 }, ratio: { value: 12 }, attack: { value: 0.003 }, release: { value: 0.25 },
        connect: () => {}, disconnect: () => {},
      }),
      resume: async () => {},
      close: async () => {},
    };
    window.AudioContext = function() { return mockAudioContext; };
    window.webkitAudioContext = function() { return mockAudioContext; };

    const fakeStream = {
      getAudioTracks: () => [{ kind: 'audio' }],
      getTracks: () => [{ kind: 'audio' }],
      getVideoTracks: () => [],
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    };
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => fakeStream,
      writable: true,
    });
  });

  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const toggle = document.getElementById('voiceChangerToggle');
    Object.defineProperty(toggle, 'checked', { value: true, writable: true });
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(1500);

  const presets = ['cute', 'deep', 'radio'];
  for (const preset of presets) {
    await page.selectOption('#voiceChangerPreset', preset, { force: true });
    await page.waitForTimeout(300);

    const result = await page.evaluate(() => {
      const ft = window.faceTracker;
      if (!ft?.voiceChanger) return { ok: false };
      const d = ft.voiceChanger.getDiagnostics();
      return {
        ok: true,
        effectPreset: d.current.preset,
        state: d.state,
        nativeGraph: d.graph.nativeGraph,
        dryMix: d.current.dryMix,
      };
    });

    expect(result.ok).toBe(true);
    expect(result.effectPreset).toBe(preset);
    expect(result.state).toBe('enabled');
    expect(result.nativeGraph).toBe(true);
    expect(result.dryMix).toBe(0);
  }
});

// ================================================================
// getUserMedia failure → toggle off + error
// ================================================================

test('getUserMedia failure → toggle off + specific error message', async ({ page }) => {
  await page.addInitScript(() => {
    const mockAudioContext = {
      state: 'suspended',
      sampleRate: 44100,
      destination: {},
      createGain: () => ({ gain: { value: 0.8 }, connect: () => {} }),
      createScriptProcessor: () => ({ onaudioprocess: null, connect: () => {} }),
      resume: async () => {},
      close: async () => {},
    };
    window.AudioContext = function() { return mockAudioContext; };
    window.webkitAudioContext = function() { return mockAudioContext; };

    // Mock getUserMedia to throw NotAllowedError
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => { throw { name: 'NotAllowedError', message: 'Permission denied' }; },
      writable: true,
    });
  });

  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Wait for the FaceTracker model to finish loading so it doesn't overwrite status
  await page.waitForTimeout(2000);

  await page.evaluate(() => {
    const toggle = document.getElementById('voiceChangerToggle');
    Object.defineProperty(toggle, 'checked', { value: true, writable: true });
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(1500);

  const result = await page.evaluate(() => {
    const ft = window.faceTracker;
    const toggle = document.getElementById('voiceChangerToggle');
    return {
      vcEnabled: ft?.voiceChangerEnabled,
      toggleChecked: toggle.checked,
      lastVcFailure: ft?._lastVcFailure,
    };
  });

  expect(result.vcEnabled).toBe(false);
  expect(result.toggleChecked).toBe(false);
  expect(result.lastVcFailure).not.toBeNull();
  expect(result.lastVcFailure.errorName).toBe('Error');
  // Check error from voice changer diagnostics, not DOM status (race condition with model load)
  expect(result.lastVcFailure.errorMessage).toContain('权限被拒绝');
});

// ================================================================
// Paragraph mode with mock
// ================================================================

test('voice changer paragraph mode is stored in VoiceChanger instance', async ({ page }) => {
  await page.addInitScript(() => {
    window.soundtouch = {
      SoundTouch: function(sampleRate, channels) {
        this.sampleRate = sampleRate;
        this.channels = channels;
        this.pitch = 1.0;
        this.tempo = 1.0;
        this.rate = 1.0;
        this.putSamples = () => {};
        this.receiveSamples = (buf) => buf.vector?.length || 0;
      },
      Float32AudioBuffer: function(size) {
        this.vector = new Array(size).fill(0);
      },
    };
    const fakeStream = {
      getAudioTracks: () => [{ kind: 'audio' }],
      getTracks: () => [{ kind: 'audio' }],
      getVideoTracks: () => [],
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    };
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => fakeStream,
      writable: true,
    });
    const mockAudioContext = {
      state: 'running',
      sampleRate: 44100,
      destination: {},
      createGain: () => ({ gain: { value: 0.8 }, connect: () => {}, disconnect: () => {} }),
      createScriptProcessor: () => ({ onaudioprocess: null, connect: () => {}, disconnect: () => {} }),
      createMediaStreamSource: () => ({ connect: () => {}, disconnect: () => {} }),
      createMediaStreamDestination: () => ({ stream: { getAudioTracks: () => [] } }),
      createBiquadFilter: () => ({
        type: 'lowshelf', frequency: { value: 1000 }, Q: { value: 0 }, gain: { value: 0 },
        connect: () => {}, disconnect: () => {},
      }),
      createWaveShaper: () => ({ curve: null, oversample: 'none', connect: () => {}, disconnect: () => {} }),
      createDynamicsCompressor: () => ({
        threshold: { value: -24 }, ratio: { value: 12 }, attack: { value: 0.003 }, release: { value: 0.25 },
        connect: () => {}, disconnect: () => {},
      }),
      resume: async () => {},
      close: async () => {},
    };
    window.AudioContext = function() { return mockAudioContext; };
    window.webkitAudioContext = function() { return mockAudioContext; };
  });

  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const toggle = document.getElementById('voiceChangerToggle');
    Object.defineProperty(toggle, 'checked', { value: true, writable: true });
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(1500);

  await page.selectOption('#voiceChangerMode', 'paragraph', { force: true });
  await page.waitForTimeout(300);

  const modeResult = await page.evaluate(() => {
    const ft = window.faceTracker;
    if (!ft?.voiceChanger) return { ok: false, error: 'no voiceChanger' };
    return { ok: true, mode: ft.voiceChanger.mode, isRecording: ft.voiceChanger.isRecording };
  });

  expect(modeResult.ok).toBe(true);
  expect(modeResult.mode).toBe('paragraph');

  await page.selectOption('#voiceChangerMode', 'realtime', { force: true });
  await page.waitForTimeout(300);

  const realtimeResult = await page.evaluate(() => {
    const ft = window.faceTracker;
    return { mode: ft.voiceChanger?.mode };
  });

  expect(realtimeResult.mode).toBe('realtime');
});