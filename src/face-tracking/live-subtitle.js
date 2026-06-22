/**
 * CheapLive Live Subtitle - 本地实时字幕
 *
 * 技术方案：Web Speech API (SpeechRecognition)
 * 纯本地处理，语音数据不上传服务器
 *
 * 功能：
 * - 实时语音识别转文字
 * - 支持中文和英文
 * - 独立应用模式（全屏字幕展示）
 * - 字体大小/颜色可调
 * - 自动断句和标点
 */

class LiveSubtitle {
  constructor(options = {}) {
    this.recognition = null;
    this.isActive = false;
    this.lang = 'zh-CN';
    this.transcript = '';
    this.interimTranscript = '';
    this.onResult = null;
    this.onError = null;
    this.broadcastChannel = null;
    this.isReceiver = false;
    this._window = options.window || (typeof globalThis !== 'undefined' ? globalThis.window : (typeof window !== 'undefined' ? window : undefined));
    this._localStorage = options.localStorage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : (typeof localStorage !== 'undefined' ? localStorage : undefined));

    // 样式设置
    this.style = {
      fontSize: 32,
      fontFamily: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
      color: '#FFFFFF',
      bgColor: 'rgba(0, 0, 0, 0.6)',
      strokeColor: '#000000',
      strokeWidth: 2,
      maxLines: 3,
    };

    this.loadSettings();
    this.initBroadcastChannel();
  }

  loadSettings() {
    try {
      const saved = this._localStorage && this._localStorage.getItem('subtitleSettings');
      if (saved) {
        this.style = { ...this.style, ...JSON.parse(saved) };
      }
    } catch (e) {}
  }

  saveSettings() {
    try {
      this._localStorage && this._localStorage.setItem('subtitleSettings', JSON.stringify(this.style));
    } catch (e) {}
  }

  initBroadcastChannel() {
    if (this._window && 'BroadcastChannel' in this._window) {
      try {
        this.broadcastChannel = new this._window.BroadcastChannel('cheaplive-subtitle');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && this.isReceiver) {
            this.transcript = event.data.final || event.data.transcript || '';
            this.interimTranscript = event.data.interim || '';
            if (this.onResult) {
              this.onResult(this.getDisplayText());
            }
          }
        };
        this.broadcastChannel.onerror = (event) => {
          console.warn('BroadcastChannel error:', event);
        };
      } catch (e) {
        console.warn('BroadcastChannel creation failed:', e);
        this.broadcastChannel = null;
      }
    } else {
      console.warn('BroadcastChannel not supported - cross-tab subtitle sync disabled');
      if (this.onError) {
        this.onError('broadcast-channel-not-supported');
      }
    }
  }

  broadcast() {
    if (this.broadcastChannel && !this.isReceiver) {
      this.broadcastChannel.postMessage({
        interim: this.interimTranscript,
        final: this.transcript,
        timestamp: Date.now(),
      });
    }
  }

  setReceiverMode(isReceiver) {
    this.isReceiver = isReceiver;
  }

  isSupported() {
    return !!(this._window && (this._window.webkitSpeechRecognition || this._window.SpeechRecognition));
  }

  init() {
    if (this.recognition) return;

    const SpeechRecognition =
      this._window?.SpeechRecognition || this._window?.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.lang;

    this.recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      if (final) {
        this.transcript += final + ' ';
        const maxLen = 500;
        if (this.transcript.length > maxLen) {
          this.transcript = this.transcript.slice(-maxLen);
        }
      }

      this.interimTranscript = interim;

      if (this.onResult) {
        this.onResult(this.getDisplayText());
      }

      this.broadcast();
    };

    this.recognition.onerror = (event) => {
      console.warn('语音识别错误:', event.error);
      if (this.onError) this.onError(event.error);

      // 自动重启（网络错误等临时问题）
      if (event.error === 'network' || event.error === 'no-speech') {
        if (this.isActive) {
          setTimeout(() => this.restart(), 1000);
        }
      }
    };

    this.recognition.onend = () => {
      if (this.isActive) {
        this.restart();
      }
    };
  }

  start() {
    if (!this.isSupported()) {
      throw new Error('当前浏览器不支持语音识别（Web Speech API）');
    }

    this.init();
    this.isActive = true;
    this.transcript = '';
    this.interimTranscript = '';

    try {
      this.recognition.start();
    } catch (e) {
      // 可能已经启动了
    }
  }

  stop() {
    this.isActive = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
  }

  restart() {
    if (!this.isActive) return;
    try {
      this.recognition.stop();
      setTimeout(() => {
        if (this.isActive) {
          this.recognition.start();
        }
      }, 200);
    } catch (e) {}
  }

  getDisplayText() {
    return this.transcript + this.interimTranscript;
  }

  clear() {
    this.transcript = '';
    this.interimTranscript = '';
    if (this.onResult) this.onResult('');
  }

  setLang(lang) {
    this.lang = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
      if (this.isActive) {
        this.restart();
      }
    }
  }

  setStyle(key, value) {
    this.style[key] = value;
    this.saveSettings();
  }

  // 绘制字幕到 canvas（用于应用模式全屏展示）
  drawToCanvas(canvas, text) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    if (!text) return;

    const s = this.style;
    const fontSize = Math.min(s.fontSize, h * 0.08);
    ctx.font = `bold ${fontSize}px ${s.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    // 自动换行
    const maxWidth = w * 0.9;
    const lines = this.wrapText(ctx, text, maxWidth, s.maxLines);
    const lineHeight = fontSize * 1.4;
    const startY = h - 40;

    lines.forEach((line, i) => {
      const y = startY - (lines.length - 1 - i) * lineHeight;
      const x = w / 2;

      // 描边
      if (s.strokeWidth > 0) {
        ctx.strokeStyle = s.strokeColor;
        ctx.lineWidth = s.strokeWidth;
        ctx.strokeText(line, x, y);
      }

      // 填充
      ctx.fillStyle = s.color;
      ctx.fillText(line, x, y);
    });
  }

  wrapText(ctx, text, maxWidth, maxLines) {
    const words = text.split('');
    const lines = [];
    let currentLine = '';

    for (const char of words) {
      const testLine = currentLine + char;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = char;
        if (lines.length >= maxLines - 1) break;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.slice(-maxLines);
  }
}

export { LiveSubtitle };
