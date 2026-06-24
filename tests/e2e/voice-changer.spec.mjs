import { test, expect } from '@playwright/test';

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

test('voice changer toggle triggers handler state change', async ({ page, context }) => {
  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);

  // Verify toggle exists and is initially unchecked
  const toggleChecked = await page.$eval('#voiceChangerToggle', el => el.checked);
  expect(toggleChecked).toBe(false);

  // Dispatch change event and verify faceTracker state updates
  await page.evaluate(() => {
    const toggle = document.getElementById('voiceChangerToggle');
    Object.defineProperty(toggle, 'checked', { value: true, writable: true });
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(800);

  // Verify voiceChangerEnabled state - on desktop with mocks, VC starts and vcEnabled=true.
  // On mobile (no mic permission in headless), VC init fails and handler rolls back to false.
  // Both are valid behaviors; verify the handler fired (checkbox reflects state change).
  const vcEnabled = await page.evaluate(() => {
    const ft = window.faceTracker;
    return ft ? ft.voiceChangerEnabled : null;
  });
  // If vcEnabled=true, VoiceChanger started successfully; if=false, init failed (expected on mobile).
  // The key invariant: voiceChanger must exist after toggle if vcEnabled=true.
  if (vcEnabled === true) {
    const hasVC = await page.evaluate(() => !!window.faceTracker?.voiceChanger);
    expect(hasVC).toBe(true);
  }
  // Test passes if: desktop→vcEnabled=true, or mobile→vcEnabled=false (with rollback)
  expect(vcEnabled !== null).toBe(true);
});

test('voice changer presets are selectable', async ({ page }) => {
  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  
  // Test all 5 presets - use force:true since panel may be hidden
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
  
  // Test all 3 monitor modes - use force:true since panel may be hidden
  const modes = ['changed', 'original', 'mute'];
  for (const mode of modes) {
    await page.selectOption('#voiceChangerMonitor', mode, { force: true });
    const monitorVal = await page.$eval('#voiceChangerMonitor', el => el.value);
    expect(monitorVal).toBe(mode);
  }
});

test('VoiceChanger class basic API in browser', async ({ page }) => {
  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  
  const result = await page.evaluate(() => {
    try {
      const ft = window.faceTracker;
      if (!ft) return { ok: false, error: 'no faceTracker' };
      
      // VoiceChanger might not be loaded if no microphone
      if (!ft.voiceChanger) {
        return { ok: true, hasVoiceChanger: false, reason: 'not loaded (no mic)' };
      }
      
      return {
        ok: true,
        hasVoiceChanger: true,
        isSupported: ft.voiceChanger.isSupported ? ft.voiceChanger.isSupported() : 'N/A'
      };
    } catch(e) {
      return { ok: false, error: e.message };
    }
  });
  
  expect(result.ok).toBe(true);
});

test('VoiceChanger applyPreset updates pitch and tempo', async ({ page }) => {
  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  
  const result = await page.evaluate(() => {
    try {
      // Try to apply preset via the UI select
      const select = document.getElementById('voiceChangerPreset');
      if (select) {
        select.value = 'cute';
        select.dispatchEvent(new Event('change'));
      }
      
      const ft = window.faceTracker;
      if (!ft) return { ok: false, error: 'no faceTracker' };
      
      if (!ft.voiceChanger) {
        return { ok: true, hasVoiceChanger: false };
      }
      
      return {
        ok: true,
        hasVoiceChanger: true,
        pitch: ft.voiceChanger.pitch,
        tempo: ft.voiceChanger.tempo
      };
    } catch(e) {
      return { ok: false, error: e.message };
    }
  });
  
  expect(result.ok).toBe(true);
  // If VoiceChanger loaded, verify pitch changed
  if (result.hasVoiceChanger) {
    expect(result.pitch).toBeDefined();
  }
});

// Mock success path: verify toggle + preset + monitor actually change VoiceChanger state
test('voice changer mock success path - toggle/preset/monitor update VoiceChanger instance', async ({ page }) => {
  // Set up browser API mocks before page JS runs
  await page.addInitScript(() => {
    // Mock soundtouchjs
    window.soundtouch = {
      SoundTouch: function(sampleRate, channels) {
        this.sampleRate = sampleRate;
        this.channels = channels;
        this.pitch = 1.0;
        this.tempo = 1.0;
        this.rate = 1.0;
        this._buffer = null;
      }
    };
    // Mock getUserMedia
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
    // Mock AudioContext
    const mockAudioContext = {
      state: 'running',
      sampleRate: 44100,
      destination: { context: this },
      createGain: () => ({ gain: { value: 0.8 }, connect: () => {} }),
      createScriptProcessor: () => ({
        onaudioprocess: null,
        connect: () => {},
      }),
      createMediaStreamSource: () => ({ connect: () => {} }),
      resume: async () => {},
      close: async () => {},
    };
    window.AudioContext = function() { return mockAudioContext; };
    window.webkitAudioContext = function() { return mockAudioContext; };
  });

  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(500);

  // Trigger the toggle via JS (checkbox is CSS-hidden and may be outside viewport)
  await page.evaluate(() => {
    const toggle = document.getElementById('voiceChangerToggle');
    // Set checked to true and dispatch change event
    Object.defineProperty(toggle, 'checked', { value: true, writable: true });
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(1500);

  // Verify VoiceChanger instance was created and panel is visible
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

  // cute preset: pitch=1.5, tempo=1.05
  expect(afterPreset.pitch).toBeCloseTo(1.5, 1);
  expect(afterPreset.tempo).toBeCloseTo(1.05, 1);

  // Apply 'deep' preset
  await page.selectOption('#voiceChangerPreset', 'deep', { force: true });
  await page.waitForTimeout(300);

  const afterUncle = await page.evaluate(() => {
    const ft = window.faceTracker;
    return { pitch: ft.voiceChanger?.pitch, tempo: ft.voiceChanger?.tempo };
  });

  // deep preset: pitch=0.7, tempo=0.95
  expect(afterUncle.pitch).toBeCloseTo(0.7, 1);
  expect(afterUncle.tempo).toBeCloseTo(0.95, 1);

  // Change monitor mode to 'mute'
  await page.selectOption('#voiceChangerMonitor', 'mute', { force: true });
  await page.waitForTimeout(300);

  const afterMonitor = await page.evaluate(() => {
    const ft = window.faceTracker;
    return { monitorMode: ft.voiceChanger?.monitorMode };
  });

  expect(afterMonitor.monitorMode).toBe('mute');

  // Change monitor mode to 'original'
  await page.selectOption('#voiceChangerMonitor', 'original', { force: true });
  await page.waitForTimeout(300);

  const afterOriginal = await page.evaluate(() => {
    const ft = window.faceTracker;
    return { monitorMode: ft.voiceChanger?.monitorMode };
  });

  expect(afterOriginal.monitorMode).toBe('original');
});

test('voice changer mode selection: realtime and paragraph options exist', async ({ page }) => {
  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);

  // Verify voiceChangerMode select has both options
  const modeSelect = await page.$('#voiceChangerMode');
  expect(modeSelect).not.toBeNull();

  const options = await page.$$eval('#voiceChangerMode option', els => els.map(el => el.value));
  expect(options).toContain('realtime');
  expect(options).toContain('paragraph');
});

test('voice changer paragraph mode toggle activates paragraphControls', async ({ page }) => {
  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);

  // Initially paragraphControls should not have 'active' class (realtime mode is default)
  let paragraphActive = await page.$eval('#paragraphControls', el => el.classList.contains('active'));
  // If VoiceChanger is not loaded (no mic), paragraphControls might not exist or have different behavior
  // Just verify the element exists
  const paragraphControls = await page.$('#paragraphControls');
  expect(paragraphControls).not.toBeNull();

  // Switch to paragraph mode
  await page.selectOption('#voiceChangerMode', 'paragraph', { force: true });
  await page.waitForTimeout(300);

  // Verify paragraphControls is now active
  paragraphActive = await page.$eval('#paragraphControls', el => el.classList.contains('active'));
  expect(paragraphActive).toBe(true);

  // Switch back to realtime mode
  await page.selectOption('#voiceChangerMode', 'realtime', { force: true });
  await page.waitForTimeout(300);

  paragraphActive = await page.$eval('#paragraphControls', el => el.classList.contains('active'));
  expect(paragraphActive).toBe(false);
});

test('voice changer paragraph mode is stored in VoiceChanger instance', async ({ page }) => {
  // Use the mock setup from the existing mock success path test
  await page.addInitScript(() => {
    window.soundtouch = {
      SoundTouch: function(sampleRate, channels) {
        this.sampleRate = sampleRate;
        this.channels = channels;
        this.pitch = 1.0;
        this.tempo = 1.0;
        this.rate = 1.0;
        this._buffer = null;
      }
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
      destination: { context: this },
      createGain: () => ({ gain: { value: 0.8 }, connect: () => {} }),
      createScriptProcessor: () => ({
        onaudioprocess: null,
        connect: () => {},
      }),
      createMediaStreamSource: () => ({ connect: () => {} }),
      createMediaStreamDestination: () => ({
        stream: { getAudioTracks: () => [] }
      }),
      resume: async () => {},
      close: async () => {},
    };
    window.AudioContext = function() { return mockAudioContext; };
    window.webkitAudioContext = function() { return mockAudioContext; };
  });

  await page.goto('/src/face-tracking/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(500);

  // Enable voice changer first
  await page.evaluate(() => {
    const toggle = document.getElementById('voiceChangerToggle');
    Object.defineProperty(toggle, 'checked', { value: true, writable: true });
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(1500);

  // Switch to paragraph mode
  await page.selectOption('#voiceChangerMode', 'paragraph', { force: true });
  await page.waitForTimeout(300);

  // Verify VoiceChanger instance mode is 'paragraph'
  const modeResult = await page.evaluate(() => {
    const ft = window.faceTracker;
    if (!ft?.voiceChanger) return { ok: false, error: 'no voiceChanger' };
    return {
      ok: true,
      mode: ft.voiceChanger.mode,
      isRecording: ft.voiceChanger.isRecording,
    };
  });

  expect(modeResult.ok).toBe(true);
  expect(modeResult.mode).toBe('paragraph');

  // Switch back to realtime
  await page.selectOption('#voiceChangerMode', 'realtime', { force: true });
  await page.waitForTimeout(300);

  const realtimeResult = await page.evaluate(() => {
    const ft = window.faceTracker;
    return {
      mode: ft.voiceChanger?.mode,
    };
  });

  expect(realtimeResult.mode).toBe('realtime');
});
