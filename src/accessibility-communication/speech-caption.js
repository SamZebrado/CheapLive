/**
 * 语音字幕模块 (Speech Caption)
 *
 * 使用浏览器 Web Speech API 进行语音识别。
 * 诚实标注：Web Speech API 可能使用服务端识别，不保证离线。
 *
 * 分层：
 * - Level 0：无识别 / 手动输入（始终可用，完全离线）
 * - Level 1：浏览器 Web Speech API（可用则启用，不保证离线）
 * - Level 2：Android 系统 on-device SpeechRecognizer（仅 Android App/WebView 中评估）
 * - Level 3：内置离线 ASR 模型（sherpa-onnx / Vosk / whisper.cpp，本轮不集成）
 */

const MAX_RESTART_ATTEMPTS = 3;
const RESTART_DELAY_MS = 1000;

export class SpeechCaption {
  /**
   * @param {object} options
   * @param {Function} options.onInterimResult - 临时结果回调 (text)
   * @param {Function} options.onFinalResult - 最终结果回调 (text)
   * @param {Function} options.onStatusChange - 状态变化回调 (status)
   * @param {Function} options.onError - 错误回调 (error)
   */
  constructor(options) {
    this.onInterimResult = options.onInterimResult || null;
    this.onFinalResult = options.onFinalResult || null;
    this.onStatusChange = options.onStatusChange || null;
    this.onError = options.onError || null;

    this.recognition = null;
    this.isListening = false;
    this.isSupported = false;
    this.engineType = 'unknown';
    this.restartAttempts = 0;
    this.interimText = '';
    this.finalTextHistory = [];
    this._initialized = false;

    this._detectSupport();
    this._initialized = true;
  }

  // ========== 能力检测 ==========

  _detectSupport() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      this.isSupported = true;
      this.engineType = 'browser-webspeech';
      this._notifyStatus('browser_webspeech_available');
    } else {
      this.isSupported = false;
      this.engineType = 'unavailable';
      this._notifyStatus('speech_api_unavailable');
    }
  }

  /**
   * 获取当前引擎状态信息
   */
  getStatus() {
    const online = typeof navigator !== 'undefined' ? navigator.onLine : true;

    return {
      isSupported: this.isSupported,
      isListening: this.isListening,
      engineType: this.engineType,
      isOnline: online,
      isOfflineGuaranteed: false, // Web Speech API 不保证离线
      modelInstalled: false,      // 本轮未集成离线模型
      description: this._getStatusDescription()
    };
  }

  _getStatusDescription() {
    const online = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (!this.isSupported) {
      return {
        engineLabel: '不可用',
        offlineLabel: '不适用',
        detail: '字幕识别暂不可用，请使用手写留言板。'
      };
    }

    if (this.isListening) {
      return {
        engineLabel: '浏览器语音识别',
        offlineLabel: '未保证',
        detail: online
          ? '当前识别可能由浏览器服务处理。'
          : '当前没有网络，识别效果可能受限。'
      };
    }

    return {
      engineLabel: '浏览器语音识别（已就绪）',
      offlineLabel: '未保证',
      detail: online
        ? '点击"开始字幕"后请求麦克风权限。识别可能由浏览器服务处理。'
        : '当前没有网络，识别效果可能受限。离线模型尚未安装。'
    };
  }

  // ========== 开始/停止 ==========

  /**
   * 开始语音识别
   */
  start() {
    if (!this.isSupported) {
      this._onError('浏览器不支持语音识别');
      return;
    }

    if (this.isListening) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'zh-CN';
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.restartAttempts = 0;

    this.recognition.onresult = this._onResult.bind(this);
    this.recognition.onerror = this._onRecognitionError.bind(this);
    this.recognition.onend = this._onRecognitionEnd.bind(this);

    try {
      this.recognition.start();
      this.isListening = true;
      this._notifyStatus('listening');
    } catch (err) {
      this._onError(`启动语音识别失败：${err.message}`);
    }
  }

  /**
   * 停止语音识别
   */
  stop() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // 可能已经停止
      }
    }
    this.isListening = false;
    this.recognition = null;
    this._notifyStatus('stopped');
  }

  // ========== 事件处理 ==========

  _onResult(event) {
    let interim = '';
    let final = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        final += result[0].transcript;
      } else {
        interim += result[0].transcript;
      }
    }

    if (final) {
      this.finalTextHistory.push(final);
      if (this.onFinalResult) {
        this.onFinalResult(final);
      }
    }

    if (interim) {
      this.interimText = interim;
      if (this.onInterimResult) {
        this.onInterimResult(interim);
      }
    }

    // 有 final 结果时清除 interim
    if (final) {
      this.interimText = '';
    }
  }

  _onRecognitionError(event) {
    const error = event.error;

    // 'no-speech' 和 'aborted' 不算严重错误，尝试重启
    if (error === 'no-speech' || error === 'aborted') {
      this._tryRestart();
      return;
    }

    // 'not-allowed' 表示权限被拒绝
    if (error === 'not-allowed') {
      this.isListening = false;
      this._notifyStatus('permission_denied');
      this._onError('麦克风权限被拒绝');
      return;
    }

    // 'network' 错误：网络不可用
    if (error === 'network') {
      this.isListening = false;
      this._notifyStatus('network_error');
      this._onError('网络不可用，语音识别无法工作。您仍可使用手写留言板。');
      return;
    }

    // 其他错误尝试重启
    this._tryRestart();
  }

  _onRecognitionEnd() {
    // 如果仍标记为 listening 但 recognition 结束了，尝试重启
    if (this.isListening && this.restartAttempts < MAX_RESTART_ATTEMPTS) {
      this.restartAttempts++;
      setTimeout(() => {
        if (this.isListening) {
          this._restartRecognition();
        }
      }, RESTART_DELAY_MS);
    } else if (this.restartAttempts >= MAX_RESTART_ATTEMPTS) {
      this.isListening = false;
      this._notifyStatus('max_restart_exceeded');
      this._onError('语音识别多次中断，已停止。请手动重新开始。');
    }
  }

  _tryRestart() {
    if (this.restartAttempts >= MAX_RESTART_ATTEMPTS) {
      this.isListening = false;
      this._notifyStatus('max_restart_exceeded');
      return;
    }
    this.restartAttempts++;
    setTimeout(() => {
      if (this.isListening) {
        this._restartRecognition();
      }
    }, RESTART_DELAY_MS);
  }

  _restartRecognition() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) { /* ignore */ }
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'zh-CN';
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.onresult = this._onResult.bind(this);
    this.recognition.onerror = this._onRecognitionError.bind(this);
    this.recognition.onend = this._onRecognitionEnd.bind(this);

    try {
      this.recognition.start();
    } catch (err) {
      this.isListening = false;
      this._onError(`重启语音识别失败：${err.message}`);
    }
  }

  // ========== 操作 ==========

  clearHistory() {
    this.interimText = '';
    this.finalTextHistory = [];
  }

  copyText() {
    const text = this.finalTextHistory.join('\n');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {
        // fallback: 忽略
      });
    }
    return text;
  }

  exportText() {
    const text = this.finalTextHistory.join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.download = `caption-${ts}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ========== 通知 ==========

  _notifyStatus(status) {
    if (!this._initialized) return;
    if (this.onStatusChange) {
      this.onStatusChange(this.getStatus());
    }
  }

  _onError(message) {
    if (this.onError) {
      this.onError(message);
    }
  }
}