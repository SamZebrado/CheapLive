// Voice effects controller module
// Simple non-AI voice effects using Web Audio API
// Reusable across capture page and control page

export function createVoiceInputController({
  onMicLevel = null,
  onProcessedLevel = null,
  onStateChange = null,
  onError = null
} = {}) {
  let audioContext = null;
  let sourceNode = null;
  let micAnalyser = null;
  let processedAnalyser = null;
  let effectInputGain = null;
  let effectOutputGain = null;
  let effectNodes = [];
  let stream = null;
  let isRunning = false;
  let monitorEnabled = false;
  let levelInterval = null;
  let currentEffectMode = 'original';
  let currentMicLevel = 0;
  let currentProcessedLevel = 0;

  const EFFECT_MODES = ['original', 'cute', 'robot', 'deep', 'radio'];

  function emitState() {
    if (onStateChange) {
      onStateChange(getState());
    }
  }

  function emitError(msg) {
    if (onError) onError(msg);
  }

  function computeLevel(analyser) {
    if (!analyser) return 0;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i];
    const avg = sum / data.length;
    return Math.min(1, avg / 255);
  }

  function makeDistortionCurve(amount) {
    const samples = 256;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  function clearEffectNodes() {
    effectNodes.forEach(n => { try { n.disconnect(); } catch(_) {} });
    effectNodes = [];
  }

  function buildEffectChain(mode) {
    clearEffectNodes();
    if (!audioContext || !effectInputGain || !effectOutputGain) return;

    if (mode === 'original') {
      effectInputGain.connect(effectOutputGain);
      return;
    }

    if (mode === 'cute') {
      const highpass = audioContext.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 500;
      highpass.Q.value = 0.7;

      const gainBoost = audioContext.createGain();
      gainBoost.gain.value = 1.2;

      effectInputGain.connect(highpass);
      highpass.connect(gainBoost);
      gainBoost.connect(effectOutputGain);

      effectNodes = [highpass, gainBoost];
      return;
    }

    if (mode === 'robot') {
      const bandpass = audioContext.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 800;
      bandpass.Q.value = 3;

      const distortion = audioContext.createWaveShaper();
      distortion.curve = makeDistortionCurve(40);

      const tremoloGain = audioContext.createGain();
      tremoloGain.gain.value = 0.7;

      const lfo = audioContext.createOscillator();
      lfo.frequency.value = 20;
      const lfoGain = audioContext.createGain();
      lfoGain.gain.value = 0.3;
      lfo.connect(lfoGain);
      lfoGain.connect(tremoloGain.gain);
      lfo.start();

      effectInputGain.connect(bandpass);
      bandpass.connect(distortion);
      distortion.connect(tremoloGain);
      tremoloGain.connect(effectOutputGain);

      effectNodes = [bandpass, distortion, tremoloGain, lfo, lfoGain];
      return;
    }

    if (mode === 'deep') {
      const lowpass = audioContext.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 500;
      lowpass.Q.value = 1.5;

      const gainBoost = audioContext.createGain();
      gainBoost.gain.value = 1.3;

      effectInputGain.connect(lowpass);
      lowpass.connect(gainBoost);
      gainBoost.connect(effectOutputGain);

      effectNodes = [lowpass, gainBoost];
      return;
    }

    if (mode === 'radio') {
      const highpass = audioContext.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 300;
      highpass.Q.value = 0.5;

      const lowpass = audioContext.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 2500;
      lowpass.Q.value = 0.5;

      const distortion = audioContext.createWaveShaper();
      distortion.curve = makeDistortionCurve(20);

      effectInputGain.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(distortion);
      distortion.connect(effectOutputGain);

      effectNodes = [highpass, lowpass, distortion];
      return;
    }

    effectInputGain.connect(effectOutputGain);
  }

  async function start({ effectMode = 'original' } = {}) {
    if (isRunning) return;
    try {
      if (window.CheapLiveBridge && typeof window.CheapLiveBridge.requestMicrophonePermission === 'function') {
        window.CheapLiveBridge.requestMicrophonePermission();
      }

      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false
      });

      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      sourceNode = audioContext.createMediaStreamSource(stream);

      micAnalyser = audioContext.createAnalyser();
      micAnalyser.fftSize = 256;
      sourceNode.connect(micAnalyser);

      effectInputGain = audioContext.createGain();
      effectInputGain.gain.value = 1.0;
      effectOutputGain = audioContext.createGain();
      effectOutputGain.gain.value = 1.0;
      processedAnalyser = audioContext.createAnalyser();
      processedAnalyser.fftSize = 256;

      sourceNode.connect(effectInputGain);
      effectOutputGain.connect(processedAnalyser);

      currentEffectMode = EFFECT_MODES.includes(effectMode) ? effectMode : 'original';
      buildEffectChain(currentEffectMode);

      isRunning = true;

      levelInterval = setInterval(() => {
        const level = computeLevel(micAnalyser);
        const pLevel = computeLevel(processedAnalyser);
        currentMicLevel = level;
        currentProcessedLevel = pLevel;
        if (onMicLevel) onMicLevel(level);
        if (onProcessedLevel) onProcessedLevel(pLevel);
        sendLevelToBridge(level, pLevel);
      }, 50);

      emitState();
    } catch (e) {
      emitError(e.message || 'start failed');
      stop();
      throw e;
    }
  }

  function sendLevelToBridge(level, processed) {
    if (!window.CheapLiveBridge || !window.CheapLiveBridge.publishAudioLevel) return;
    try {
      const payload = JSON.stringify({
        type: 'audio-level',
        level: level,
        processedLevel: processed,
        audioMode: 'raw-level',
        effectMode: currentEffectMode,
        source: 'microphone',
        timestamp: Date.now(),
      });
      window.CheapLiveBridge.publishAudioLevel(payload);
    } catch (_) {}
  }

  function stop() {
    isRunning = false;
    monitorEnabled = false;
    if (levelInterval) { clearInterval(levelInterval); levelInterval = null; }
    clearEffectNodes();
    if (sourceNode) { try { sourceNode.disconnect(); } catch(_) {} sourceNode = null; }
    micAnalyser = null;
    processedAnalyser = null;
    if (effectInputGain) { try { effectInputGain.disconnect(); } catch(_) {} effectInputGain = null; }
    if (effectOutputGain) { try { effectOutputGain.disconnect(); } catch(_) {} effectOutputGain = null; }
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    if (audioContext) { try { audioContext.close(); } catch(_) {} audioContext = null; }
    currentMicLevel = 0;
    currentProcessedLevel = 0;
    emitState();
  }

  function setEffectMode(mode) {
    if (!EFFECT_MODES.includes(mode)) return;
    currentEffectMode = mode;
    if (isRunning && audioContext) {
      buildEffectChain(mode);
      if (monitorEnabled) {
        try { effectOutputGain.connect(audioContext.destination); } catch(_) {}
      }
    }
    emitState();
  }

  function setMonitorEnabled(enabled) {
    if (!audioContext || !effectOutputGain) return;
    if (enabled) {
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
      }
      try {
        effectOutputGain.connect(audioContext.destination);
        monitorEnabled = true;
      } catch (e) {
        emitError('monitor failed: ' + e.message);
      }
    } else {
      try { effectOutputGain.disconnect(audioContext.destination); } catch(_) {}
      monitorEnabled = false;
    }
    emitState();
  }

  function getState() {
    return {
      running: isRunning,
      effectMode: currentEffectMode,
      micLevel: currentMicLevel,
      processedLevel: currentProcessedLevel,
      monitorEnabled: monitorEnabled,
      hasAudioContext: !!audioContext,
      hasStream: !!stream,
      availableModes: EFFECT_MODES.slice()
    };
  }

  return {
    start,
    stop,
    setEffectMode,
    setMonitorEnabled,
    getState,
    EFFECT_MODES
  };
}
