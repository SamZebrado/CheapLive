/**
 * 手写留言板 (Handwriting Board)
 *
 * 完全本地运行，不依赖网络，不依赖 OCR。
 * 手写轨迹原样保存、排列、展示，不做文字识别。
 *
 * 核心功能：
 * - pointer events 捕获手写笔画
 * - 停笔 900ms 自动提交一个字
 * - 合并上一字修正误分割
 * - 撤销笔画 / 撤销字
 * - 导出 PNG
 */

const DEFAULT_CHAR_IDLE_MS = 900;
const MIN_STROKES_BEFORE_AUTO_COMMIT = 1;

export class HandwritingBoard {
  /**
   * @param {object} options
   * @param {HTMLCanvasElement} options.inputCanvas - 手写输入画布
   * @param {HTMLCanvasElement} options.outputCanvas - 手写输出展示画布
   * @param {number} [options.charIdleMs=900] - 停笔多久算写完一个字 (ms)
   * @param {number} [options.displayHeight=96] - 单字展示高度 (px)
   * @param {string} [options.strokeColor='#ffffff'] - 笔画颜色
   * @param {Function} [options.onCharCommitted] - 字提交回调
   * @param {Function} [options.onStateChange] - 状态变化回调
   */
  constructor(options) {
    this.inputCanvas = options.inputCanvas;
    this.outputCanvas = options.outputCanvas;
    this.inputCtx = this.inputCanvas.getContext('2d');
    this.outputCtx = this.outputCanvas.getContext('2d');

    this.charIdleMs = options.charIdleMs || DEFAULT_CHAR_IDLE_MS;
    this.displayHeight = options.displayHeight || 96;
    this.strokeColor = options.strokeColor || '#ffffff';

    this.onCharCommitted = options.onCharCommitted || null;
    this.onStateChange = options.onStateChange || null;

    // 状态
    this.isActive = false;
    this.currentStrokes = [];       // 当前未提交的笔画组
    this.currentPoints = [];         // 当前正在画的笔画
    this.committedChars = [];        // 已提交的字 [{ id, strokes, bounds, createdAt }]
    this.isDrawing = false;
    this.autoCommitTimer = null;
    this.charIdCounter = 0;

    this._bindEvents();
    this._resizeOutputCanvas();
    this._notifyState();
  }

  // ========== 事件绑定 ==========

  _bindEvents() {
    this.inputCanvas.addEventListener('pointerdown', this._onPointerDown.bind(this));
    this.inputCanvas.addEventListener('pointermove', this._onPointerMove.bind(this));
    this.inputCanvas.addEventListener('pointerup', this._onPointerUp.bind(this));
    this.inputCanvas.addEventListener('pointercancel', this._onPointerCancel.bind(this));
    this.inputCanvas.addEventListener('pointerleave', this._onPointerUp.bind(this));
  }

  _onPointerDown(e) {
    if (!this.isActive) return;
    e.preventDefault();

    // 取消自动提交计时器
    this._cancelAutoCommit();

    const rect = this.inputCanvas.getBoundingClientRect();
    const scaleX = this.inputCanvas.width / rect.width;
    const scaleY = this.inputCanvas.height / rect.height;

    const point = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      t: Date.now(),
      pressure: e.pressure || 0.5
    };

    this.currentPoints = [point];
    this.isDrawing = true;

    this.inputCtx.beginPath();
    this.inputCtx.moveTo(point.x, point.y);
    this.inputCtx.strokeStyle = this.strokeColor;
    this.inputCtx.lineWidth = Math.max(2, (e.pressure || 0.5) * 6);
    this.inputCtx.lineCap = 'round';
    this.inputCtx.lineJoin = 'round';
  }

  _onPointerMove(e) {
    if (!this.isActive || !this.isDrawing) return;
    e.preventDefault();

    const rect = this.inputCanvas.getBoundingClientRect();
    const scaleX = this.inputCanvas.width / rect.width;
    const scaleY = this.inputCanvas.height / rect.height;

    const point = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      t: Date.now(),
      pressure: e.pressure || 0.5
    };

    this.currentPoints.push(point);

    const prev = this.currentPoints[this.currentPoints.length - 2];
    this.inputCtx.lineWidth = Math.max(2, (e.pressure || 0.5) * 6);
    this.inputCtx.lineTo(point.x, point.y);
    this.inputCtx.stroke();
    this.inputCtx.beginPath();
    this.inputCtx.moveTo(point.x, point.y);
  }

  _onPointerUp(e) {
    if (!this.isActive || !this.isDrawing) return;
    e.preventDefault();

    this.isDrawing = false;

    if (this.currentPoints.length > 0) {
      // 完成当前笔画，加入当前笔画组
      this.currentStrokes.push({
        points: [...this.currentPoints]
      });
      this.currentPoints = [];
    }

    // 启动自动提交计时器
    this._startAutoCommit();
    this._notifyState();
  }

  _onPointerCancel(e) {
    this._onPointerUp(e);
  }

  // ========== 自动提交逻辑 ==========

  _startAutoCommit() {
    this._cancelAutoCommit();
    if (this.currentStrokes.length >= MIN_STROKES_BEFORE_AUTO_COMMIT) {
      this.autoCommitTimer = setTimeout(() => {
        this._commitCurrentChar();
      }, this.charIdleMs);
    }
  }

  _cancelAutoCommit() {
    if (this.autoCommitTimer) {
      clearTimeout(this.autoCommitTimer);
      this.autoCommitTimer = null;
    }
  }

  /**
   * 提交当前笔画组为一个字
   */
  _commitCurrentChar() {
    if (this.currentStrokes.length === 0) return;

    const bounds = this._computeBounds(this.currentStrokes);
    const char = {
      id: ++this.charIdCounter,
      strokes: [...this.currentStrokes],
      bounds,
      createdAt: Date.now()
    };

    this.committedChars.push(char);
    this.currentStrokes = [];
    this._clearInputCanvas();
    this._renderOutput();
    this._notifyState();

    if (this.onCharCommitted) {
      this.onCharCommitted(char);
    }
  }

  /**
   * 手动提交当前字
   */
  commitCurrentChar() {
    this._cancelAutoCommit();
    this._commitCurrentChar();
  }

  // ========== 合并上一字 ==========

  /**
   * 将最后一个已提交的字的笔画合并到当前笔画组
   */
  mergePreviousChar() {
    if (this.committedChars.length === 0) return;

    const prevChar = this.committedChars.pop();
    // 将上一字的笔画追加到当前笔画组前面
    this.currentStrokes = [...prevChar.strokes, ...this.currentStrokes];
    this._cancelAutoCommit();
    this._startAutoCommit();
    this._renderOutput();
    this._notifyState();
  }

  // ========== 撤销操作 ==========

  /**
   * 撤销当前字的最后一笔
   */
  undoStroke() {
    if (this.currentStrokes.length > 0) {
      this.currentStrokes.pop();
      this._redrawInput();
      this._cancelAutoCommit();
      this._startAutoCommit();
      this._notifyState();
    }
  }

  /**
   * 撤销最后一个已提交的字
   */
  undoChar() {
    if (this.committedChars.length > 0) {
      this.committedChars.pop();
      this._renderOutput();
      this._notifyState();
    }
  }

  // ========== 清空 ==========

  clearAll() {
    this.currentStrokes = [];
    this.currentPoints = [];
    this.committedChars = [];
    this._cancelAutoCommit();
    this._clearInputCanvas();
    this._renderOutput();
    this._notifyState();
  }

  // ========== 渲染 ==========

  _clearInputCanvas() {
    this.inputCtx.clearRect(0, 0, this.inputCanvas.width, this.inputCanvas.height);
  }

  _redrawInput() {
    this._clearInputCanvas();
    for (const stroke of this.currentStrokes) {
      this._drawStroke(this.inputCtx, stroke);
    }
  }

  _drawStroke(ctx, stroke) {
    if (stroke.points.length === 0) return;
    ctx.beginPath();
    ctx.strokeStyle = this.strokeColor;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const first = stroke.points[0];
    ctx.moveTo(first.x, first.y);

    for (let i = 1; i < stroke.points.length; i++) {
      const p = stroke.points[i];
      ctx.lineWidth = Math.max(2, p.pressure * 6);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    }
  }

  _computeBounds(strokes) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const stroke of strokes) {
      for (const p of stroke.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * 渲染已提交的字到输出画布
   */
  _renderOutput() {
    const ctx = this.outputCtx;
    const canvas = this.outputCanvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (this.committedChars.length === 0) return;

    const padding = 8;
    const lineHeight = this.displayHeight + padding;
    let x = padding;
    let y = padding;

    for (const char of this.committedChars) {
      const charWidth = this._scaleCharWidth(char);
      const totalWidth = charWidth + padding;

      // 换行检查
      if (x + totalWidth > canvas.width - padding) {
        x = padding;
        y += lineHeight;
      }

      // 缩放并绘制这个字
      this._renderCharAt(ctx, char, x, y, this.displayHeight);

      x += totalWidth;
    }
  }

  _scaleCharWidth(char) {
    if (char.bounds.height <= 0) return this.displayHeight;
    const scale = this.displayHeight / char.bounds.height;
    return char.bounds.width * scale;
  }

  _renderCharAt(ctx, char, x, y, targetHeight) {
    if (char.bounds.height <= 0) return;

    const scale = targetHeight / char.bounds.height;
    const offsetX = char.bounds.x;
    const offsetY = char.bounds.y;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.translate(-offsetX, -offsetY);

    for (const stroke of char.strokes) {
      this._drawStroke(ctx, stroke);
    }

    ctx.restore();
  }

  _resizeOutputCanvas() {
    // 设置输出画布尺寸以匹配其 CSS 显示尺寸
    const rect = this.outputCanvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this.outputCanvas.width = rect.width * (window.devicePixelRatio || 1);
      this.outputCanvas.height = rect.height * (window.devicePixelRatio || 1);
      this.outputCtx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    }
  }

  // ========== 导出 ==========

  /**
   * 导出沟通板为 PNG
   * @param {object} options
   * @param {string} [options.captionText] - 当前字幕文字
   * @param {string[]} [options.historyTexts] - 历史字幕
   * @param {boolean} [options.includeTimestamp=true] - 是否包含时间戳
   * @returns {Promise<Blob>}
   */
  async exportToPNG(options = {}) {
    const { captionText = '', historyTexts = [], includeTimestamp = true } = options;

    // 创建离屏 canvas
    const offscreen = document.createElement('canvas');
    const width = 800;
    const padding = 24;

    // 计算高度
    let height = padding * 2;

    // 标题
    height += 32;

    // 字幕区
    if (captionText) {
      height += 24 + this._estimateTextHeight(captionText, width - padding * 2, 36);
    }

    // 分隔线
    if (captionText) height += 24;

    // 手写区
    if (this.committedChars.length > 0) {
      const charRows = this._estimateCharRows(width - padding * 2);
      height += charRows * (this.displayHeight + 8);
    }

    // 时间戳
    if (includeTimestamp) height += 32;

    offscreen.width = width;
    offscreen.height = height;

    const ctx = offscreen.getContext('2d');

    // 背景 - 深色
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    let y = padding;

    // 标题
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px "Noto Sans SC", sans-serif';
    ctx.fillText('辅助沟通记录', padding, y + 24);
    y += 40;

    // 字幕
    if (captionText) {
      ctx.fillStyle = '#888888';
      ctx.font = '14px "Noto Sans SC", sans-serif';
      ctx.fillText('字幕', padding, y);
      y += 24;

      ctx.fillStyle = '#ffffff';
      y = this._wrapText(ctx, captionText, padding, y, width - padding * 2, 36);
      y += 12;

      // 分隔线
      ctx.strokeStyle = '#333355';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
      y += 24;
    }

    // 手写区
    if (this.committedChars.length > 0) {
      ctx.fillStyle = '#888888';
      ctx.font = '14px "Noto Sans SC", sans-serif';
      ctx.fillText('手写留言', padding, y);
      y += 24;

      let cx = padding;
      const lineHeight = this.displayHeight + 8;

      for (const char of this.committedChars) {
        const charWidth = this._scaleCharWidth(char);
        if (cx + charWidth > width - padding) {
          cx = padding;
          y += lineHeight;
        }
        this._renderCharAt(ctx, char, cx, y, this.displayHeight);
        cx += charWidth + 8;
      }
      y += lineHeight;
    }

    // 时间戳
    if (includeTimestamp) {
      ctx.fillStyle = '#555577';
      ctx.font = '12px "Noto Sans SC", sans-serif';
      const ts = new Date().toLocaleString('zh-CN');
      ctx.fillText(`导出时间：${ts}`, padding, y + 16);
    }

    return new Promise((resolve) => {
      offscreen.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    });
  }

  /**
   * 导出并触发下载
   */
  async downloadPNG(options = {}) {
    const blob = await this.exportToPNG(options);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.download = `communication-board-${ts}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  _estimateTextHeight(text, maxWidth, fontSize) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = `${fontSize}px "Noto Sans SC", sans-serif`;
    const words = text.split('');
    let line = '';
    let lines = 1;
    for (const char of words) {
      const testLine = line + char;
      if (ctx.measureText(testLine).width > maxWidth && line.length > 0) {
        lines++;
        line = char;
      } else {
        line = testLine;
      }
    }
    return lines * (fontSize + 4);
  }

  _wrapText(ctx, text, x, y, maxWidth, fontSize) {
    ctx.font = `${fontSize}px "Noto Sans SC", sans-serif`;
    const words = text.split('');
    let line = '';
    let currentY = y;
    for (const char of words) {
      const testLine = line + char;
      if (ctx.measureText(testLine).width > maxWidth && line.length > 0) {
        ctx.fillText(line, x, currentY);
        currentY += fontSize + 4;
        line = char;
      } else {
        line = testLine;
      }
    }
    if (line.length > 0) {
      ctx.fillText(line, x, currentY);
      currentY += fontSize + 4;
    }
    return currentY;
  }

  _estimateCharRows(maxWidth) {
    let cx = 0;
    let rows = 1;
    for (const char of this.committedChars) {
      const charWidth = this._scaleCharWidth(char) + 8;
      if (cx + charWidth > maxWidth) {
        rows++;
        cx = charWidth;
      } else {
        cx += charWidth;
      }
    }
    return rows;
  }

  // ========== 状态通知 ==========

  _notifyState() {
    if (this.onStateChange) {
      this.onStateChange({
        isActive: this.isActive,
        currentStrokeCount: this.currentStrokes.length,
        committedCharCount: this.committedChars.length,
        hasUncommittedStrokes: this.currentStrokes.length > 0
      });
    }
  }

  // ========== 公开 API ==========

  setActive(active) {
    this.isActive = active;
    this._notifyState();
  }

  setStrokeColor(color) {
    this.strokeColor = color;
  }

  setDisplayHeight(height) {
    this.displayHeight = height;
    this._renderOutput();
  }

  setCharIdleMs(ms) {
    this.charIdleMs = ms;
  }

  getState() {
    return {
      isActive: this.isActive,
      currentStrokeCount: this.currentStrokes.length,
      committedCharCount: this.committedChars.length
    };
  }
}