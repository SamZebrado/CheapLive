/**
 * Cubism Runtime - Live2D Cubism 4 运行时封装
 *
 * 封装 Cubism SDK 的模型加载、参数控制、渲染循环。
 *
 * 支持两种模式：
 *   - framework 模式：使用完整 CubismFramework（需要 framework 加载成功）
 *   - core-only 模式：仅使用 Live2DCubismCore（降级模式，功能受限）
 *
 * 重要架构说明：
 *   - 这是一个独立的 Live2D 运行时，使用真实的 Cubism SDK
 *   - 与项目中的程序化 Canvas 2.5D 网格（procedural-mesh-renderer.js）完全无关
 *   - 不要将 CubismRuntime 与 ProceduralMeshRenderer 混用
 *   - Cubism SDK 需要 .moc3 和 .model3.json 文件，不能使用 Canvas 2D 自定义网格替代
 */

import { getCubismLoader, SDKStatus } from './cubism-loader.js';

// ===================== 运行时状态 =====================

export const RuntimeStatus = {
  IDLE: 'idle',
  SDK_LOADING: 'sdk_loading',
  SDK_READY: 'sdk_ready',
  MODEL_LOADING: 'model_loading',
  MODEL_READY: 'model_ready',
  RENDERING: 'rendering',
  ERROR: 'error',
  DESTROYED: 'destroyed',
};

// ===================== CubismRuntime 类 =====================

export class CubismRuntime {
  /**
   * @param {string} canvasId - Canvas 元素 ID
   */
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      throw new Error(`CubismRuntime: Canvas 元素 "${canvasId}" 未找到`);
    }

    this._status = RuntimeStatus.IDLE;
    this._loader = getCubismLoader();

    // 模型数据
    this._model = null;           // CubismModel (framework) 或 Live2DCubismCore.Model (core-only)
    this._moc = null;             // Live2DCubismCore.Moc
    this._modelJson = null;       // .model3.json 解析结果
    this._modelPath = null;       // .model3.json 路径
    this._mocPath = null;         // .moc3 路径
    this._textures = [];          // 纹理信息 [{id, image, path}]
    this._textureCount = 0;

    // 参数信息
    this._parameterIds = [];      // 参数 ID 列表
    this._parameterValues = null; // Float32Array 参数值（core-only）
    this._parameterMinValues = null;
    this._parameterMaxValues = null;
    this._parameterDefaultValues = null;

    // 部件信息
    this._partIds = [];           // 部件 ID 列表
    this._partOpacities = null;   // 部件不透明度

    // Drawable 信息
    this._drawableIds = [];
    this._drawableCount = 0;

    // 渲染参数
    this._pixelsPerUnit = 2.0;
    this._scale = 1.0;
    this._offsetX = 0;
    this._offsetY = 0;

    // 帧率
    this._lastFrameTime = 0;
    this._fps = 0;
    this._frameCount = 0;
    this._lastFpsTime = 0;

    // 动画循环
    this._animationFrameId = null;
    this._running = false;

    // 错误信息
    this._errors = [];
    this._loadError = null;

    // 诊断信息
    this._diagnostics = {
      sdkStatus: SDKStatus.NOT_LOADED,
      coreVersion: null,
      frameworkAvailable: false,
      modelPath: null,
      mocPath: null,
      textureCount: 0,
      parameterCount: 0,
      parameterIds: [],
      drawableCount: 0,
      drawableIds: [],
      fps: 0,
      loadErrors: [],
    };

    // 调整大小
    this._resizeHandler = () => this._resizeCanvas();
    this._resizeCanvas();
    window.addEventListener('resize', this._resizeHandler);
  }

  // ===================== 属性 =====================

  get status() {
    return this._status;
  }

  get diagnostics() {
    return { ...this._diagnostics };
  }

  get loadError() {
    return this._loadError;
  }

  get modelPath() {
    return this._modelPath;
  }

  get mocPath() {
    return this._mocPath;
  }

  // ===================== SDK 初始化 =====================

  /**
   * 初始化 SDK
   * @returns {Promise<{success: boolean, status: string}>}
   */
  async initSDK() {
    if (this._status === RuntimeStatus.DESTROYED) {
      return { success: false, status: this._status, error: '运行时已销毁' };
    }

    this._status = RuntimeStatus.SDK_LOADING;
    this._updateDiagnostics();

    const result = await this._loader.load();

    if (result.status === SDKStatus.ERROR) {
      this._status = RuntimeStatus.ERROR;
      this._errors = result.errors || [];
      this._loadError = 'SDK 加载失败';
      this._updateDiagnostics();
      return { success: false, status: this._status, error: this._loadError, details: result.errors };
    }

    this._status = RuntimeStatus.SDK_READY;
    this._updateDiagnostics();
    return { success: true, status: this._status };
  }

  // ===================== 模型加载 =====================

  /**
   * 从 .model3.json 加载模型
   * @param {string} model3JsonPath - .model3.json 文件的 URL 或路径
   * @param {Object} [fileMap] - 可选的文件映射 {relativePath: Blob|File}，用于 ZIP 上传
   * @returns {Promise<{success: boolean, modelInfo: Object|null}>}
   */
  async loadModel(model3JsonPath, fileMap = null) {
    if (this._status === RuntimeStatus.DESTROYED) {
      return { success: false, error: '运行时已销毁' };
    }

    if (this._status !== RuntimeStatus.SDK_READY && this._status !== RuntimeStatus.MODEL_READY) {
      return { success: false, error: `SDK 未就绪，当前状态: ${this._status}` };
    }

    this._status = RuntimeStatus.MODEL_LOADING;
    this._loadError = null;
    this._modelPath = model3JsonPath;
    this._updateDiagnostics();

    try {
      // 1. 获取 .model3.json 内容
      let modelJson;
      if (fileMap) {
        modelJson = await this._resolveModelJsonFromFileMap(model3JsonPath, fileMap);
      } else {
        modelJson = await this._fetchModelJson(model3JsonPath);
      }

      if (!modelJson) {
        throw new Error('无法读取 .model3.json 文件');
      }

      this._modelJson = modelJson;

      // 2. 解析 .moc3 路径
      const baseDir = this._getBaseDir(model3JsonPath);
      this._mocPath = this._resolvePath(baseDir, modelJson.FileReferences?.Moc || modelJson.FileReferences?.Moc3 || '');

      if (!this._mocPath || this._mocPath === baseDir + '/') {
        throw new Error('.model3.json 中未找到 .moc3 引用');
      }

      // 3. 加载 .moc3 数据
      let mocData;
      if (fileMap) {
        mocData = await this._resolveFileFromFileMap(this._mocPath, fileMap);
      } else {
        mocData = await this._fetchBinary(this._mocPath);
      }

      if (!mocData) {
        throw new Error(`无法加载 .moc3 文件: ${this._mocPath}`);
      }

      // 4. 创建 Moc 和 Model
      if (this._loader.status === SDKStatus.FRAMEWORK_LOADED) {
        await this._createModelWithFramework(mocData, modelJson, fileMap, baseDir);
      } else {
        await this._createModelCoreOnly(mocData, modelJson, fileMap, baseDir);
      }

      // 5. 加载纹理
      await this._loadTextures(modelJson, fileMap, baseDir);

      // 6. 收集参数和部件信息
      this._collectModelInfo();

      this._status = RuntimeStatus.MODEL_READY;
      this._updateDiagnostics();

      return {
        success: true,
        modelInfo: {
          modelPath: this._modelPath,
          mocPath: this._mocPath,
          textureCount: this._textureCount,
          parameterCount: this._parameterIds.length,
          parameterIds: this._parameterIds,
          drawableCount: this._drawableCount,
          version: modelJson.Version || 'unknown',
        },
      };
    } catch (err) {
      this._status = RuntimeStatus.ERROR;
      this._loadError = err.message;
      this._errors.push(err.message);
      this._updateDiagnostics();
      console.error('[CubismRuntime] 模型加载失败:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * 从 fileMap 查找 .model3.json 文件
   */
  async _resolveModelJsonFromFileMap(path, fileMap) {
    // 尝试精确匹配
    const exactKey = Object.keys(fileMap).find(k => k === path || k.endsWith('/' + path.split('/').pop()));
    if (exactKey && fileMap[exactKey]) {
      return this._readFileAsJson(fileMap[exactKey]);
    }

    // 尝试查找任何 .model3.json 文件
    const jsonKey = Object.keys(fileMap).find(k => k.endsWith('.model3.json'));
    if (jsonKey && fileMap[jsonKey]) {
      return this._readFileAsJson(fileMap[jsonKey]);
    }

    return null;
  }

  /**
   * 从 fileMap 查找文件
   */
  async _resolveFileFromFileMap(path, fileMap) {
    const exactKey = Object.keys(fileMap).find(k => k === path || k.endsWith('/' + path.split('/').pop()));
    if (exactKey && fileMap[exactKey]) {
      return this._readFileAsArrayBuffer(fileMap[exactKey]);
    }

    // 尝试递归搜索
    const fileName = path.split('/').pop();
    const matchingKey = Object.keys(fileMap).find(k => k.endsWith('/' + fileName) || k === fileName);
    if (matchingKey && fileMap[matchingKey]) {
      return this._readFileAsArrayBuffer(fileMap[matchingKey]);
    }

    return null;
  }

  /**
   * 从 URL 获取 .model3.json
   */
  async _fetchModelJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${url}`);
    }
    return response.json();
  }

  /**
   * 从 URL 获取二进制数据
   */
  async _fetchBinary(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${url}`);
    }
    return response.arrayBuffer();
  }

  /**
   * 读取 File/Blob 为 JSON
   */
  async _readFileAsJson(file) {
    const text = await this._readFileAsText(file);
    return JSON.parse(text);
  }

  /**
   * 读取 File/Blob 为 ArrayBuffer
   */
  async _readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('FileReader 读取失败'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * 读取 File/Blob 为文本
   */
  async _readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('FileReader 读取失败'));
      reader.readAsText(file);
    });
  }

  /**
   * 获取基础目录
   */
  _getBaseDir(path) {
    const lastSlash = path.lastIndexOf('/');
    return lastSlash >= 0 ? path.substring(0, lastSlash) : '.';
  }

  /**
   * 解析相对路径
   */
  _resolvePath(baseDir, relativePath) {
    if (!relativePath) return '';
    if (relativePath.startsWith('/') || relativePath.startsWith('http')) {
      return relativePath;
    }
    return `${baseDir}/${relativePath}`;
  }

  /**
   * 使用 Framework 创建模型
   */
  async _createModelWithFramework(mocData, modelJson, fileMap, baseDir) {
    // 初始化 Cubism Framework
    if (!CubismFramework.isStarted()) {
      CubismFramework.start();
    }

    // 创建 Moc
    const moc = Live2DCubismCore.Moc.fromArrayBuffer(mocData);
    if (!moc) {
      throw new Error('无法创建 Moc：数据无效');
    }
    this._moc = moc;

    // 创建 Model
    const model = Live2DCubismCore.Model.fromMoc(moc);
    if (!model) {
      throw new Error('无法创建 Model');
    }

    // 注意：完整的 Framework 模式需要更多的初始化步骤
    // 包括 CubismModelMatrix, CubismRenderer, CubismMotionManager 等
    // 这里先创建基础 Model，完整渲染需要额外的 Framework 集成
    this._model = model;
  }

  /**
   * 使用 Core-only 模式创建模型
   */
  async _createModelCoreOnly(mocData, modelJson, fileMap, baseDir) {
    if (typeof Live2DCubismCore === 'undefined') {
      throw new Error('Live2DCubismCore 不可用');
    }

    const moc = Live2DCubismCore.Moc.fromArrayBuffer(mocData);
    if (!moc) {
      throw new Error('无法创建 Moc：数据无效');
    }
    this._moc = moc;

    const model = Live2DCubismCore.Model.fromMoc(moc);
    if (!model) {
      throw new Error('无法创建 Model');
    }
    this._model = model;

    // 在 core-only 模式下，我们需要手动管理参数
    const paramCount = Live2DCubismCore.getParameterCount(model);
    this._parameterValues = new Float32Array(paramCount);
    this._parameterMinValues = new Float32Array(paramCount);
    this._parameterMaxValues = new Float32Array(paramCount);
    this._parameterDefaultValues = new Float32Array(paramCount);

    for (let i = 0; i < paramCount; i++) {
      this._parameterMinValues[i] = Live2DCubismCore.getParameterMinimumValue(model, i);
      this._parameterMaxValues[i] = Live2DCubismCore.getParameterMaximumValue(model, i);
      this._parameterDefaultValues[i] = Live2DCubismCore.getParameterDefaultValue(model, i);
      this._parameterValues[i] = this._parameterDefaultValues[i];
    }
  }

  /**
   * 加载纹理
   */
  async _loadTextures(modelJson, fileMap, baseDir) {
    const textureRefs = modelJson.FileReferences?.Textures || [];
    this._textures = [];

    for (let i = 0; i < textureRefs.length; i++) {
      const texturePath = this._resolvePath(baseDir, textureRefs[i]);
      try {
        let imageBlob;
        if (fileMap) {
          const blob = await this._resolveFileFromFileMap(texturePath, fileMap);
          if (blob) {
            imageBlob = new Blob([blob]);
          }
        }

        if (!imageBlob && texturePath) {
          imageBlob = await fetch(texturePath).then(r => r.blob());
        }

        if (imageBlob) {
          const url = URL.createObjectURL(imageBlob);
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => reject(new Error(`纹理加载失败: ${texturePath}`));
            img.src = url;
          });
          this._textures.push({ id: i, image: img, path: texturePath, url });
        }
      } catch (err) {
        console.warn(`[CubismRuntime] 纹理 ${i} 加载失败:`, err.message);
        this._textures.push({ id: i, image: null, path: texturePath, error: err.message });
      }
    }
    this._textureCount = this._textures.length;
  }

  /**
   * 收集模型信息
   */
  _collectModelInfo() {
    if (!this._model) return;

    if (this._loader.status === SDKStatus.FRAMEWORK_LOADED) {
      this._collectModelInfoFramework();
    } else {
      this._collectModelInfoCoreOnly();
    }
  }

  _collectModelInfoFramework() {
    // Framework 模式下的信息收集
    // 需要 CubismModel 实例的方法
    const model = this._model;
    if (model && typeof model.getParameterCount === 'function') {
      const paramCount = model.getParameterCount();
      this._parameterIds = [];
      for (let i = 0; i < paramCount; i++) {
        this._parameterIds.push(model.getParameterId(i) || `param_${i}`);
      }

      const partCount = model.getPartCount();
      this._partIds = [];
      for (let i = 0; i < partCount; i++) {
        this._partIds.push(model.getPartId(i) || `part_${i}`);
      }

      const drawableCount = model.getDrawableCount();
      this._drawableIds = [];
      for (let i = 0; i < drawableCount; i++) {
        this._drawableIds.push(model.getDrawableId(i) || `drawable_${i}`);
      }
      this._drawableCount = drawableCount;
    }
  }

  _collectModelInfoCoreOnly() {
    const model = this._model;
    if (!model) return;

    const paramCount = Live2DCubismCore.getParameterCount(model);
    this._parameterIds = [];
    for (let i = 0; i < paramCount; i++) {
      this._parameterIds.push(Live2DCubismCore.getParameterId(model, i) || `param_${i}`);
    }

    const partCount = Live2DCubismCore.getPartCount(model);
    this._partIds = [];
    this._partOpacities = new Float32Array(partCount);
    for (let i = 0; i < partCount; i++) {
      this._partIds.push(Live2DCubismCore.getPartId(model, i) || `part_${i}`);
      this._partOpacities[i] = Live2DCubismCore.getPartOpacity(model, i);
    }

    const drawableCount = Live2DCubismCore.getDrawableCount(model);
    this._drawableIds = [];
    for (let i = 0; i < drawableCount; i++) {
      this._drawableIds.push(Live2DCubismCore.getDrawableId(model, i) || `drawable_${i}`);
    }
    this._drawableCount = drawableCount;
  }

  // ===================== 参数控制 =====================

  /**
   * 设置模型参数值
   * @param {string} paramId - 参数 ID
   * @param {number} value - 参数值（自动 clamp 到模型定义的范围）
   */
  setParameter(paramId, value) {
    if (!this._model) return;

    if (this._loader.status === SDKStatus.FRAMEWORK_LOADED) {
      this._setParameterFramework(paramId, value);
    } else {
      this._setParameterCoreOnly(paramId, value);
    }
  }

  /**
   * 批量设置参数
   * @param {Object} paramMap - {paramId: value}
   */
  setParameters(paramMap) {
    for (const [id, value] of Object.entries(paramMap)) {
      this.setParameter(id, value);
    }
  }

  _setParameterFramework(paramId, value) {
    const model = this._model;
    if (model && typeof model.setParameterValueById === 'function') {
      model.setParameterValueById(paramId, value);
    }
  }

  _setParameterCoreOnly(paramId, value) {
    const model = this._model;
    if (!model) return;

    const idx = this._parameterIds.indexOf(paramId);
    if (idx < 0) {
      // 尝试查找参数
      const paramCount = this._parameterIds.length;
      for (let i = 0; i < paramCount; i++) {
        if (Live2DCubismCore.getParameterId(model, i) === paramId) {
          this._parameterIds[i] = paramId;
          const clamped = Math.max(this._parameterMinValues[i], Math.min(this._parameterMaxValues[i], value));
          this._parameterValues[i] = clamped;
          Live2DCubismCore.setParameterValueById(model, paramId, clamped);
          return;
        }
      }
      return;
    }

    const clamped = Math.max(this._parameterMinValues[idx], Math.min(this._parameterMaxValues[idx], value));
    this._parameterValues[idx] = clamped;
    Live2DCubismCore.setParameterValueById(model, paramId, clamped);
  }

  /**
   * 获取所有参数 ID 和值
   * @returns {Array<{id: string, value: number, min: number, max: number, default: number}>}
   */
  getParameters() {
    if (!this._model) return [];

    const result = [];
    for (let i = 0; i < this._parameterIds.length; i++) {
      const id = this._parameterIds[i];
      let value = 0;
      let min = 0, max = 1, def = 0;

      if (this._loader.status === SDKStatus.FRAMEWORK_LOADED) {
        if (this._model && typeof this._model.getParameterValueByIndex === 'function') {
          value = this._model.getParameterValueByIndex(i);
          min = this._model.getParameterMinimumValue(i);
          max = this._model.getParameterMaximumValue(i);
          def = this._model.getParameterDefaultValue(i);
        }
      } else {
        value = this._parameterValues ? this._parameterValues[i] : 0;
        min = this._parameterMinValues ? this._parameterMinValues[i] : 0;
        max = this._parameterMaxValues ? this._parameterMaxValues[i] : 1;
        def = this._parameterDefaultValues ? this._parameterDefaultValues[i] : 0;
      }

      result.push({ id, value, min, max, default: def });
    }
    return result;
  }

  /**
   * 获取所有 Drawable 信息
   * @returns {Array<{id: string, index: number}>}
   */
  getDrawables() {
    return this._drawableIds.map((id, i) => ({ id, index: i }));
  }

  // ===================== 更新与渲染 =====================

  /**
   * 更新模型（物理、姿态等）
   * @param {number} deltaTimeSeconds - 时间增量（秒）
   */
  update(deltaTimeSeconds) {
    if (!this._model) return;

    if (this._loader.status === SDKStatus.FRAMEWORK_LOADED) {
      // Framework 模式下，更新由 Phoenix 或自定义循环处理
      if (this._model && typeof this._model.update === 'function') {
        this._model.update();
      }
    } else {
      // Core-only 模式：更新参数到模型
      if (this._parameterValues) {
        for (let i = 0; i < this._parameterValues.length; i++) {
          Live2DCubismCore.setParameterValueByIndex(this._model, i, this._parameterValues[i]);
        }
      }
      Live2DCubismCore.updateModel(this._model);
    }
  }

  /**
   * 渲染到 Canvas
   * 注意：完整的渲染需要 WebGL 上下文和 CubismRenderer
   * 当前实现为基础框架，完整渲染需要 Framework 集成
   */
  draw() {
    if (!this._model || !this.canvas) return;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    // 清除画布
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 目前仅绘制纹理图像（占位渲染）
    // 完整的 Live2D 渲染需要使用 WebGL + CubismRenderer
    if (this._textures.length > 0 && this._textures[0].image) {
      const img = this._textures[0].image;
      const scale = Math.min(
        this.canvas.width / img.width,
        this.canvas.height / img.height
      ) * 0.8;
      const x = (this.canvas.width - img.width * scale) / 2;
      const y = (this.canvas.height - img.height * scale) / 2;
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
    }

    // 绘制状态叠加层
    this._drawStatusOverlay(ctx);
  }

  /**
   * 绘制状态叠加层（诊断信息）
   */
  _drawStatusOverlay(ctx) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.save();
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';

    const lines = [
      `SDK: ${this._diagnostics.sdkStatus}`,
      `Core: ${this._diagnostics.coreVersion || 'N/A'}`,
      `Framework: ${this._diagnostics.frameworkAvailable ? 'yes' : 'no'}`,
      `Model: ${this._modelPath || 'N/A'}`,
      `Moc: ${this._mocPath || 'N/A'}`,
      `Params: ${this._parameterIds.length}`,
      `Drawables: ${this._drawableCount}`,
      `FPS: ${this._fps}`,
    ];

    // 半透明背景
    const maxWidth = Math.max(...lines.map(l => ctx.measureText(l).width));
    const lineHeight = 14;
    const totalHeight = lines.length * lineHeight + 8;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(4, 4, maxWidth + 12, totalHeight);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    lines.forEach((line, i) => {
      ctx.fillText(line, 10, 18 + i * lineHeight);
    });

    ctx.restore();
  }

  /**
   * 启动渲染循环
   */
  startRendering() {
    if (this._running) return;
    this._running = true;
    this._lastFrameTime = performance.now() / 1000;
    this._renderLoop();
  }

  /**
   * 停止渲染循环
   */
  stopRendering() {
    this._running = false;
    if (this._animationFrameId) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }
  }

  /**
   * 渲染循环
   */
  _renderLoop() {
    if (!this._running) return;

    const now = performance.now() / 1000;
    let deltaTime = now - this._lastFrameTime;
    this._lastFrameTime = now;

    // 限制最大 deltaTime 防止大跳帧
    if (deltaTime > 0.1) deltaTime = 0.1;

    // FPS 计算
    this._frameCount++;
    if (now - this._lastFpsTime >= 1) {
      this._fps = this._frameCount;
      this._frameCount = 0;
      this._lastFpsTime = now;
      this._diagnostics.fps = this._fps;
    }

    this.update(deltaTime);
    this.draw();

    this._animationFrameId = requestAnimationFrame(() => this._renderLoop());
  }

  // ===================== Canvas 调整 =====================

  _resizeCanvas() {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    if (parent) {
      const rect = parent.getBoundingClientRect();
      this.canvas.width = rect.width;
      this.canvas.height = rect.height;
    }
  }

  // ===================== 诊断更新 =====================

  _updateDiagnostics() {
    const loaderStatus = this._loader.getStatusSummary();
    this._diagnostics = {
      sdkStatus: loaderStatus.status,
      coreVersion: loaderStatus.coreVersion,
      frameworkAvailable: loaderStatus.frameworkAvailable,
      modelPath: this._modelPath,
      mocPath: this._mocPath,
      textureCount: this._textureCount,
      parameterCount: this._parameterIds.length,
      parameterIds: this._parameterIds.slice(0, 20), // 限制列表长度
      drawableCount: this._drawableCount,
      drawableIds: this._drawableIds.slice(0, 10),
      fps: this._fps,
      loadErrors: this._errors.slice(-5),
      runtimeStatus: this._status,
    };
  }

  // ===================== 销毁 =====================

  /**
   * 释放所有资源
   */
  destroy() {
    this.stopRendering();

    // 释放纹理 URL
    for (const tex of this._textures) {
      if (tex.url) {
        URL.revokeObjectURL(tex.url);
      }
    }

    // 释放模型
    if (this._model) {
      if (this._loader.status === SDKStatus.FRAMEWORK_LOADED) {
        if (typeof this._model.delete === 'function') {
          this._model.delete();
        }
      } else {
        if (typeof Live2DCubismCore !== 'undefined') {
          Live2DCubismCore.deleteModel(this._model);
        }
      }
      this._model = null;
    }

    // 释放 Moc
    if (this._moc) {
      if (typeof Live2DCubismCore !== 'undefined') {
        Live2DCubismCore.deleteMoc(this._moc);
      }
      this._moc = null;
    }

    window.removeEventListener('resize', this._resizeHandler);

    this._textures = [];
    this._parameterIds = [];
    this._parameterValues = null;
    this._drawableIds = [];
    this._status = RuntimeStatus.DESTROYED;
  }
}

// ===================== 便捷工厂函数 =====================

/**
 * 创建 CubismRuntime 实例并初始化 SDK
 * @param {string} canvasId
 * @returns {Promise<CubismRuntime>}
 */
export async function createCubismRuntime(canvasId) {
  const runtime = new CubismRuntime(canvasId);
  const initResult = await runtime.initSDK();
  if (!initResult.success) {
    console.warn('[CubismRuntime] SDK 初始化失败，运行时已创建但功能受限:', initResult.error);
  }
  return runtime;
}