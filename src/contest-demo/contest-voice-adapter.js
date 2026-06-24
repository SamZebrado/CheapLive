/**
 * Contest Voice Adapter
 *
 * 轻量 adapter，复用主项目 CheapLive 的 Web Audio 变声模块（voice-changer.js）。
 * 不复制第二套变声实现。AI 变声不在此 adapter 范围内（仅真实 App 可用）。
 *
 * 职责：
 * - 包装主项目 VoiceChanger，提供 demo 友好的状态语义
 * - 映射 preset key（demo: original/cute/robot/deep/radio → vc: normal/cute/robot/deep/radio）
 * - 暴露统一状态集：not-loaded / checking-support / requesting-microphone /
 *   enabled / disabled / repairing / unsupported / permission-denied / error
 * - 主项目变声不可用时返回明确原因，不假装启用
 */

import { VoiceChanger } from '../face-tracking/voice-changer.js';

// demo preset key → 主项目 VoiceChanger preset key
const PRESET_MAP = {
  original: 'normal',
  cute: 'cute',
  robot: 'robot',
  deep: 'deep',
  radio: 'radio',
};

// 主项目 vc.state → demo adapter status
const STATE_MAP = {
  'idle': 'not-loaded',
  'checking-support': 'checking-support',
  'loading-engine': 'repairing',
  'requesting-mic': 'requesting-microphone',
  'initializing-audio': 'requesting-microphone',
  'enabled': 'enabled',
  'disabled': 'disabled',
  'error': 'error',
  'unsupported': 'unsupported',
};

export class ContestVoiceAdapter {
  constructor() {
    this._vc = new VoiceChanger();
    this._status = 'not-loaded';
    this._reason = '';
    this._listeners = new Set();
    this._currentPreset = 'original';
    this._syncFromVc();
  }

  /** 当前 adapter 状态 */
  get status() { return this._status; }
  /** 当前不可用原因（若 status 为 error/unsupported/permission-denied/repairing） */
  get reason() { return this._reason; }
  /** 是否处于可听见变声的活跃状态 */
  get isActive() { return this._status === 'enabled'; }
  /** 当前 preset（demo key） */
  get preset() { return this._currentPreset; }

  /** 订阅状态变化 */
  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit() {
    this._listeners.forEach(fn => {
      try { fn(this._status, this._reason); } catch (_) {}
    });
  }

  _syncFromVc() {
    const vcState = this._vc.state;
    let mapped = STATE_MAP[vcState] || 'error';
    // 细分 permission-denied
    const err = this._vc.lastError;
    if (err) {
      const msg = err.message || String(err);
      if (/NotAllowedError|权限被拒绝|permission/i.test(msg)) {
        mapped = 'permission-denied';
      }
      this._reason = msg;
    } else {
      this._reason = '';
    }
    this._status = mapped;
  }

  _setStatus(status, reason = '') {
    this._status = status;
    this._reason = reason;
    this._emit();
  }

  /**
   * 检查主项目变声模块是否受支持（不请求麦克风）。
   * 返回 { supported, reasons }
   */
  checkSupport() {
    const sup = this._vc.isSupported();
    if (!sup.supported) {
      this._setStatus('unsupported', (sup.reasons || []).join('；') || 'unsupported');
    }
    return sup;
  }

  /**
   * 启用普通变声：请求麦克风 → 初始化 → 应用当前 preset。
   * 失败时设置具体状态，不假装启用。
   */
  async enable() {
    if (this._status === 'enabled') return;
    // 先检查支持
    const sup = this.checkSupport();
    if (!sup.supported) {
      this._setStatus('unsupported', this._reason);
      return;
    }
    this._setStatus('checking-support', '');
    try {
      await this._vc.start();
      // 启动后应用 preset
      this.applyPreset(this._currentPreset);
      this._syncFromVc();
      if (this._vc.state !== 'enabled') {
        // start 没有进入 enabled，按 vc 状态映射
        this._syncFromVc();
      } else {
        this._setStatus('enabled', '');
      }
    } catch (e) {
      const msg = (e && e.message) || String(e);
      if (/NotAllowedError|权限被拒绝|permission/i.test(msg)) {
        this._setStatus('permission-denied', msg);
      } else if (/SoundTouch|加载失败|engine/i.test(msg)) {
        this._setStatus('repairing', msg);
      } else if (/不支持|unsupported/i.test(msg)) {
        this._setStatus('unsupported', msg);
      } else {
        this._setStatus('error', msg);
      }
    }
  }

  /** 停止普通变声，释放音频资源 */
  disable() {
    try {
      this._vc.stop();
    } catch (_) {}
    this._setStatus('disabled', '');
  }

  /** 销毁，释放全部资源 */
  destroy() {
    try { this._vc.destroy(); } catch (_) {}
    this._setStatus('not-loaded', '');
  }

  /**
   * 切换 preset（demo key）。
   * 仅在 enabled 时实际生效；否则只记录待应用的 preset。
   */
  applyPreset(demoPreset) {
    if (!(demoPreset in PRESET_MAP)) return;
    this._currentPreset = demoPreset;
    const vcKey = PRESET_MAP[demoPreset];
    try {
      this._vc.applyPreset(vcKey);
    } catch (_) {}
    this._emit();
  }
}

export const CONTEST_VOICE_PRESETS = ['original', 'cute', 'robot', 'deep', 'radio'];
