/**
 * 辅助沟通页面主逻辑 (Accessibility Communication)
 *
 * 连接字幕模块、手写模块、模型清单和 UI。
 * 不混入 face-tracking 面捕逻辑。
 */

import { HandwritingBoard } from './handwriting-board.js';
import { SpeechCaption } from './speech-caption.js';
import { ASR_MODEL_MANIFEST, getPreferredModel } from './asr-model-manifest.js';

class AccessibilityCommunication {
  constructor() {
    this.handwriting = null;
    this.speech = null;
    this.fontSize = 64;
    this.handwritingOpen = false;
    this.lastCaptionText = '';
    this.captionHistory = [];

    this._initDOMRefs();
    this._initSpeech();
    this._initHandwriting();
    this._bindUI();
    this._updateStatusBar();
    this._updateModelStatus();

    // 监听网络状态变化
    window.addEventListener('online', () => this._updateStatusBar());
    window.addEventListener('offline', () => this._updateStatusBar());
  }

  _initDOMRefs() {
    this.$ = (id) => document.getElementById(id);

    // 字幕
    this.captionFinal = this.$('caption-final');
    this.captionInterim = this.$('caption-interim');
    this.captionHistoryEl = this.$('caption-history');

    // 按钮
    this.btnStartCaption = this.$('btn-start-caption');
    this.btnStopCaption = this.$('btn-stop-caption');
    this.btnClearCaption = this.$('btn-clear-caption');
    this.btnCopyCaption = this.$('btn-copy-caption');
    this.btnExportText = this.$('btn-export-text');
    this.btnFontSizeUp = this.$('btn-font-size-up');
    this.btnFontSizeDown = this.$('btn-font-size-down');
    this.btnFullscreen = this.$('btn-fullscreen');

    // 手写
    this.btnToggleHandwriting = this.$('btn-toggle-handwriting');
    this.handwritingSection = this.$('handwriting-section');
    this.handwritingInput = this.$('handwriting-input');
    this.handwritingOutput = this.$('handwriting-output');
    this.btnUndoStroke = this.$('btn-undo-stroke');
    this.btnUndoChar = this.$('btn-undo-char');
    this.btnMergePrev = this.$('btn-merge-prev');
    this.btnCommitChar = this.$('btn-commit-char');
    this.btnSpace = this.$('btn-space');
    this.btnNewline = this.$('btn-newline');
    this.btnClearHandwriting = this.$('btn-clear-handwriting');
    this.btnExportImage = this.$('btn-export-image');

    // 状态栏
    this.statusMic = this.$('status-mic');
    this.statusEngine = this.$('status-engine');
    this.statusOffline = this.$('status-offline');
    this.statusHandwriting = this.$('status-handwriting');
    this.statusNetwork = this.$('status-network');
    this.statusCaptionDetail = this.$('status-caption-detail');
    this.statusModelInfo = this.$('status-model-info');

    // 手写设置
    this.handwritingSize = this.$('handwriting-size');
    this.charIdleSelect = this.$('char-idle-select');
    this.strokeColorSelect = this.$('stroke-color-select');

    // 字号显示
    this.fontSizeDisplay = this.$('font-size-display');
  }

  _initSpeech() {
    this.speech = new SpeechCaption({
      onInterimResult: (text) => {
        this.captionInterim.textContent = text;
        this.captionInterim.style.display = text ? 'block' : 'none';
      },
      onFinalResult: (text) => {
        this.lastCaptionText = text;
        this.captionFinal.textContent = text;
        this.captionInterim.textContent = '';
        this.captionInterim.style.display = 'none';

        // 添加到历史
        this.captionHistory.push(text);
        this._renderHistory();
      },
      onStatusChange: () => this._updateStatusBar(),
      onError: (msg) => {
        this._showError(msg);
        this._updateStatusBar();
      }
    });
  }

  _initHandwriting() {
    this.handwriting = new HandwritingBoard({
      inputCanvas: this.handwritingInput,
      outputCanvas: this.handwritingOutput,
      charIdleMs: 900,
      displayHeight: 96,
      strokeColor: '#ffffff',
      onCharCommitted: () => {
        // 字提交后不做额外操作
      },
      onStateChange: (state) => {
        this._updateHandwritingButtons(state);
      }
    });
    this.handwriting.setActive(false);
  }

  _bindUI() {
    // 字幕按钮
    this.btnStartCaption.addEventListener('click', () => this.speech.start());
    this.btnStopCaption.addEventListener('click', () => this.speech.stop());
    this.btnClearCaption.addEventListener('click', () => this._clearCaption());
    this.btnCopyCaption.addEventListener('click', () => {
      const text = this.speech.copyText();
      if (text) this._showToast('已复制到剪贴板');
    });
    this.btnExportText.addEventListener('click', () => this.speech.exportText());
    this.btnFontSizeUp.addEventListener('click', () => this._adjustFontSize(8));
    this.btnFontSizeDown.addEventListener('click', () => this._adjustFontSize(-8));
    this.btnFullscreen.addEventListener('click', () => this._toggleFullscreen());

    // 手写开关
    this.btnToggleHandwriting.addEventListener('click', () => this._toggleHandwriting());

    // 手写操作
    this.btnUndoStroke.addEventListener('click', () => this.handwriting.undoStroke());
    this.btnUndoChar.addEventListener('click', () => this.handwriting.undoChar());
    this.btnMergePrev.addEventListener('click', () => this.handwriting.mergePreviousChar());
    this.btnCommitChar.addEventListener('click', () => this.handwriting.commitCurrentChar());
    this.btnSpace.addEventListener('click', () => this._addHandwritingSpace());
    this.btnNewline.addEventListener('click', () => this._addHandwritingNewline());
    this.btnClearHandwriting.addEventListener('click', () => this.handwriting.clearAll());
    this.btnExportImage.addEventListener('click', () => this._exportImage());

    // 手写设置
    this.handwritingSize.addEventListener('change', () => {
      this.handwriting.setDisplayHeight(parseInt(this.handwritingSize.value));
    });
    this.charIdleSelect.addEventListener('change', () => {
      this.handwriting.setCharIdleMs(parseInt(this.charIdleSelect.value));
    });
    this.strokeColorSelect.addEventListener('change', () => {
      this.handwriting.setStrokeColor(this.strokeColorSelect.value);
    });
  }

  // ========== 字幕操作 ==========

  _clearCaption() {
    this.captionFinal.textContent = '';
    this.captionInterim.textContent = '';
    this.captionInterim.style.display = 'none';
    this.captionHistory = [];
    this.lastCaptionText = '';
    this.speech.clearHistory();
    this._renderHistory();
  }

  _renderHistory() {
    this.captionHistoryEl.innerHTML = this.captionHistory
      .map((text, i) => `<div class="history-item">${this._escapeHtml(text)}</div>`)
      .join('');
    this.captionHistoryEl.scrollTop = this.captionHistoryEl.scrollHeight;
  }

  _adjustFontSize(delta) {
    this.fontSize = Math.max(24, Math.min(120, this.fontSize + delta));
    this.captionFinal.style.fontSize = `${this.fontSize}px`;
    this.fontSizeDisplay.textContent = `${this.fontSize}px`;
  }

  _toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  }

  // ========== 手写操作 ==========

  _toggleHandwriting() {
    this.handwritingOpen = !this.handwritingOpen;
    this.handwritingSection.style.display = this.handwritingOpen ? 'block' : 'none';
    this.handwriting.setActive(this.handwritingOpen);
    this.btnToggleHandwriting.textContent = this.handwritingOpen ? '收起手写' : '开启手写';
    this.btnToggleHandwriting.classList.toggle('active', this.handwritingOpen);
    this._updateStatusBar();
  }

  _addHandwritingSpace() {
    // 空格：先提交当前字，然后添加一个空占位
    this.handwriting.commitCurrentChar();
    // 在输出区加空格效果通过提交一个空白"字"
    this.captionHistory.push(' ');
    this._renderHistory();
  }

  _addHandwritingNewline() {
    this.handwriting.commitCurrentChar();
    this.captionHistory.push('\n');
    this._renderHistory();
  }

  _updateHandwritingButtons(state) {
    this.btnUndoStroke.disabled = state.currentStrokeCount === 0;
    this.btnMergePrev.disabled = state.committedCharCount === 0;
    this.btnUndoChar.disabled = state.committedCharCount === 0;
    this.btnCommitChar.disabled = !state.hasUncommittedStrokes;
  }

  async _exportImage() {
    try {
      await this.handwriting.downloadPNG({
        captionText: this.lastCaptionText,
        historyTexts: this.captionHistory,
        includeTimestamp: true
      });
      this._showToast('图片已导出');
    } catch (err) {
      this._showError(`导出失败：${err.message}`);
    }
  }

  // ========== 状态栏 ==========

  _updateStatusBar() {
    const speechStatus = this.speech.getStatus();
    const online = navigator.onLine;

    // 麦克风状态
    if (!speechStatus.isSupported) {
      this.statusMic.textContent = '不可用';
      this.statusMic.className = 'status-value status-error';
      this.statusCaptionDetail.textContent = '字幕识别暂不可用，请使用手写留言板。';
    } else if (speechStatus.isListening) {
      this.statusMic.textContent = '已开启';
      this.statusMic.className = 'status-value status-ok';
    } else {
      this.statusMic.textContent = '未开启';
      this.statusMic.className = 'status-value status-idle';
    }

    // 引擎
    this.statusEngine.textContent = speechStatus.description.engineLabel;
    this.statusEngine.className = 'status-value';

    // 离线状态
    this.statusOffline.textContent = speechStatus.description.offlineLabel;
    this.statusOffline.className = 'status-value status-warn';

    // 网络状态
    this.statusNetwork.textContent = online ? '在线' : '离线';
    this.statusNetwork.className = online ? 'status-value status-ok' : 'status-value status-warn';

    // 手写
    this.statusHandwriting.textContent = this.handwritingOpen ? '开启' : '关闭';
    this.statusHandwriting.className = this.handwritingOpen ? 'status-value status-ok' : 'status-value status-idle';

    // 详细说明
    const detail = speechStatus.description.detail;
    if (!online && !speechStatus.isListening) {
      this.statusCaptionDetail.textContent = '当前没有网络，识别效果可能受限。离线模型尚未安装。你仍可使用手写留言板。';
    } else if (speechStatus.isSupported) {
      this.statusCaptionDetail.textContent = detail;
    }
  }

  _updateModelStatus() {
    const preferred = getPreferredModel('zhCN');
    if (preferred) {
      this.statusModelInfo.textContent = `离线模型候选：${preferred.id}（${preferred.sizeMB}MB, ${preferred.license}，可再分发）`;
      this.statusModelInfo.className = 'status-model-info';
    } else {
      this.statusModelInfo.textContent = '离线模型尚未安装';
      this.statusModelInfo.className = 'status-model-info status-warn';
    }
  }

  // ========== 工具 ==========

  _showError(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-error';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  _showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-success';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// 启动 - module script 已延迟执行，DOM 已就绪
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new AccessibilityCommunication();
  });
} else {
  new AccessibilityCommunication();
}