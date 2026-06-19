/**
 * CheapLive voice-changer 基础 API 冒烟测试
 *
 * 范围：构造、preset、setPitch/setTempo/setRate、监听模式切换
 * 注意：实际 Web Audio / SoundTouchJS 变声效果需要真实浏览器 + 麦克风
 */
const assert = require('assert');

// ====== 从 voice-changer.js 中提取纯逻辑的最小类 ======
class VoiceChanger {
  constructor() {
    this.pitch = 1.0;
    this.tempo = 1.0;
    this.rate = 1.0;
    this.monitorMode = 'changed';
    this.started = false;
    this.presets = {
      normal: { pitch: 1.0, tempo: 1.0 },
      loli:   { pitch: 1.5, tempo: 1.05 },
      uncle:  { pitch: 0.7, tempo: 0.95 },
      robot:  { pitch: 1.0, tempo: 1.0 },
      monster:{ pitch: 0.5, tempo: 0.8 },
    };
  }
  setPitch(v) { this.pitch = v; }
  setTempo(v) { this.tempo = v; }
  setRate(v) { this.rate = v; }
  applyPreset(k) {
    const p = this.presets[k];
    if (!p) return;
    this.setPitch(p.pitch);
    this.setTempo(p.tempo);
  }
  setMonitorMode(m) { this.monitorMode = m; }
  start() { this.started = true; }
  stop() { this.started = false; }
}

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓', name); pass++; }
  catch (e) { console.log('  ✗', name, '\n   ', e.message); fail++; }
}

console.log('--- voice-changer API 冒烟测试 ---');

test('初始状态：pitch=1.0, tempo=1.0, rate=1.0, monitor=changed, started=false', () => {
  const vc = new VoiceChanger();
  assert.strictEqual(vc.pitch, 1.0);
  assert.strictEqual(vc.tempo, 1.0);
  assert.strictEqual(vc.rate, 1.0);
  assert.strictEqual(vc.monitorMode, 'changed');
  assert.strictEqual(vc.started, false);
});

test('applyPreset("loli") → pitch=1.5, tempo=1.05', () => {
  const vc = new VoiceChanger();
  vc.applyPreset('loli');
  assert.strictEqual(vc.pitch, 1.5);
  assert.strictEqual(vc.tempo, 1.05);
});

test('applyPreset("uncle") → pitch=0.7', () => {
  const vc = new VoiceChanger();
  vc.applyPreset('uncle');
  assert.strictEqual(vc.pitch, 0.7);
});

test('单独 setPitch/setTempo/setRate', () => {
  const vc = new VoiceChanger();
  vc.setPitch(2.0);
  vc.setTempo(0.85);
  vc.setRate(1.1);
  assert.strictEqual(vc.pitch, 2.0);
  assert.strictEqual(vc.tempo, 0.85);
  assert.strictEqual(vc.rate, 1.1);
});

test('未知 preset 会被忽略（保持原有值）', () => {
  const vc = new VoiceChanger();
  vc.applyPreset('loli');
  vc.applyPreset('does-not-exist');
  assert.strictEqual(vc.pitch, 1.5, '未知预设不应改变 pitch');
  assert.strictEqual(vc.tempo, 1.05, '未知预设不应改变 tempo');
});

test('monitorMode 支持 changed / original / mute', () => {
  const vc = new VoiceChanger();
  ['changed', 'original', 'mute'].forEach(m => {
    vc.setMonitorMode(m);
    assert.strictEqual(vc.monitorMode, m);
  });
});

test('start → started=true；stop → started=false', () => {
  const vc = new VoiceChanger();
  vc.start();
  assert.strictEqual(vc.started, true);
  vc.stop();
  assert.strictEqual(vc.started, false);
});

console.log(`--- 结果: pass ${pass}, fail ${fail} ---`);
if (fail > 0) process.exit(1);
