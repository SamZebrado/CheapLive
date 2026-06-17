/**
 * Cubism SDK Loader - Live2D Cubism 4 SDK for Web 加载器
 *
 * 负责加载 Live2D Cubism SDK 的两个核心组件：
 *   - Core: live2dcubismcore.min.js（C++ 编译为 JS/WASM）
 *   - Framework: live2dcubismframework.js（TypeScript 框架层）
 *
 * 优先级：
 *   1. 本地文件（vendor/cubism/ 目录）
 *   2. CDN（仅 Core 有官方 CDN，Framework 需要本地）
 *   3. 声明式回退（明确告知缺少哪些文件）
 *
 * 注意：Live2D Cubism SDK 受 Live2D 专有许可协议约束。
 * 你必须从 https://www.live2d.com/download/cubism-sdk/ 接受 EULA 后下载 SDK。
 * 此加载器仅提供运行时集成，不包含 SDK 文件本身。
 *
 * SDK 获取方式：
 *   1. 访问 https://www.live2d.com/download/cubism-sdk/
 *   2. 选择 "Cubism SDK for Web"
 *   3. 接受 EULA 并下载
 *   4. 解压后将以下文件放入项目：
 *      - Core/live2dcubismcore.min.js -> vendor/cubism/live2dcubismcore.min.js
 *      - Framework/dist/live2dcubismframework.js -> vendor/cubism/live2dcubismframework.js
 *      - Framework/dist/live2dcubismframework.js.map -> vendor/cubism/live2dcubismframework.js.map
 */

// ===================== SDK 状态枚举 =====================

export const SDKStatus = {
  NOT_LOADED: 'not_loaded',
  LOADING: 'loading',
  CORE_LOADED: 'core_loaded',       // 仅 Core 已加载
  FRAMEWORK_LOADED: 'framework_loaded', // Core + Framework 均已加载
  ERROR: 'error',
};

// ===================== CDN 地址 =====================

const CDN_URLS = {
  // Live2D 官方 CDN（仅 Core）
  core: 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
  // 备用：无官方 Framework CDN，Framework 必须本地
};

// 本地路径（相对于 index.html）
const LOCAL_PATHS = {
  core: 'vendor/cubism/live2dcubismcore.min.js',
  framework: 'vendor/cubism/live2dcubismframework.js',
};

// ===================== 加载器类 =====================

export class CubismSDKLoader {
  constructor() {
    this._status = SDKStatus.NOT_LOADED;
    this._coreVersion = null;
    this._errors = [];
    this._listeners = [];
  }

  /**
   * 获取当前 SDK 状态
   */
  get status() {
    return this._status;
  }

  /**
   * 获取 Core 版本号（仅 Core 加载后可用）
   */
  get coreVersion() {
    return this._coreVersion;
  }

  /**
   * 获取加载错误列表
   */
  get errors() {
    return [...this._errors];
  }

  /**
   * 注册状态变更监听器
   * @param {function} callback - 回调函数 (status, detail)
   */
  onStatusChange(callback) {
    this._listeners.push(callback);
    // 如果已经加载完成，立即通知
    if (this._status === SDKStatus.FRAMEWORK_LOADED) {
      callback(this._status, { coreVersion: this._coreVersion });
    }
  }

  /**
   * 触发状态变更事件
   */
  _notifyListeners(detail = {}) {
    for (const cb of this._listeners) {
      try {
        cb(this._status, detail);
      } catch (e) {
        console.warn('[CubismLoader] 监听器错误:', e);
      }
    }
  }

  /**
   * 加载 SDK（Core + Framework）
   * @returns {Promise<{status: string, coreVersion: string|null}>}
   */
  async load() {
    if (this._status === SDKStatus.FRAMEWORK_LOADED) {
      return { status: this._status, coreVersion: this._coreVersion };
    }

    if (this._status === SDKStatus.LOADING) {
      // 等待正在进行的加载完成
      return new Promise((resolve) => {
        const checkLoaded = () => {
          if (this._status === SDKStatus.FRAMEWORK_LOADED) {
            resolve({ status: this._status, coreVersion: this._coreVersion });
          } else if (this._status === SDKStatus.ERROR) {
            resolve({ status: this._status, coreVersion: null, errors: this._errors });
          } else {
            setTimeout(checkLoaded, 100);
          }
        };
        checkLoaded();
      });
    }

    this._status = SDKStatus.LOADING;
    this._errors = [];
    this._notifyListeners({ phase: 'loading' });

    // 第一步：加载 Core
    const coreResult = await this._loadCore();
    if (!coreResult.success) {
      this._status = SDKStatus.ERROR;
      this._notifyListeners({ phase: 'core_failed', errors: this._errors });
      return { status: this._status, coreVersion: null, errors: this._errors };
    }

    this._status = SDKStatus.CORE_LOADED;
    this._notifyListeners({ phase: 'core_loaded', coreVersion: this._coreVersion });

    // 第二步：加载 Framework
    const frameworkResult = await this._loadFramework();
    if (!frameworkResult.success) {
      // Framework 加载失败，但 Core 可用
      this._errors.push('Framework 加载失败，仅 Core 可用。部分功能受限。');
      this._notifyListeners({ phase: 'framework_failed', errors: this._errors });
      return { status: this._status, coreVersion: this._coreVersion, errors: this._errors };
    }

    this._status = SDKStatus.FRAMEWORK_LOADED;
    this._notifyListeners({ phase: 'framework_loaded', coreVersion: this._coreVersion });
    return { status: this._status, coreVersion: this._coreVersion };
  }

  /**
   * 加载 Core
   * 尝试顺序：本地文件 -> CDN
   */
  async _loadCore() {
    // 如果已经加载
    if (typeof Live2DCubismCore !== 'undefined') {
      this._coreVersion = this._detectCoreVersion();
      return { success: true, source: 'already_loaded' };
    }

    // 尝试本地文件
    const localResult = await this._loadScript(LOCAL_PATHS.core, 'Live2DCubismCore');
    if (localResult.success) {
      this._coreVersion = this._detectCoreVersion();
      console.log('[CubismLoader] Core 从本地加载成功:', this._coreVersion);
      return { success: true, source: 'local' };
    }

    // 尝试 CDN
    const cdnResult = await this._loadScript(CDN_URLS.core, 'Live2DCubismCore');
    if (cdnResult.success) {
      this._coreVersion = this._detectCoreVersion();
      console.log('[CubismLoader] Core 从 CDN 加载成功:', this._coreVersion);
      return { success: true, source: 'cdn' };
    }

    this._errors.push(
      'Live2D Cubism Core 加载失败。请从 https://www.live2d.com/download/cubism-sdk/ 下载 SDK，' +
      '并将 Core/live2dcubismcore.min.js 放入 vendor/cubism/ 目录。'
    );
    return { success: false };
  }

  /**
   * 加载 Framework
   * 仅支持本地文件（无官方 CDN）
   */
  async _loadFramework() {
    // 如果已经加载
    if (typeof CubismFramework !== 'undefined') {
      return { success: true, source: 'already_loaded' };
    }

    // 仅尝试本地文件
    const result = await this._loadScript(LOCAL_PATHS.framework, 'CubismFramework');
    if (result.success) {
      console.log('[CubismLoader] Framework 从本地加载成功');
      return { success: true, source: 'local' };
    }

    this._errors.push(
      'Live2D Cubism Framework 加载失败。请从 SDK 中将 Framework/dist/live2dcubismframework.js 放入 vendor/cubism/ 目录。'
    );
    return { success: false };
  }

  /**
   * 动态加载 script 标签
   * @param {string} url - 脚本 URL
   * @param {string} globalName - 验证全局变量名
   * @returns {Promise<{success: boolean}>}
   */
  _loadScript(url, globalName) {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = true;

      const timeout = setTimeout(() => {
        script.onload = null;
        script.onerror = null;
        if (script.parentNode) script.parentNode.removeChild(script);
        resolve({ success: false, error: `加载超时: ${url}` });
      }, 15000);

      script.onload = () => {
        clearTimeout(timeout);
        if (typeof window[globalName] !== 'undefined') {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: `全局变量 ${globalName} 未定义: ${url}` });
        }
      };

      script.onerror = () => {
        clearTimeout(timeout);
        if (script.parentNode) script.parentNode.removeChild(script);
        resolve({ success: false, error: `加载失败: ${url}` });
      };

      document.head.appendChild(script);
    });
  }

  /**
   * 检测 Core 版本
   */
  _detectCoreVersion() {
    try {
      if (typeof Live2DCubismCore !== 'undefined') {
        // Cubism Core 4.x 通常有 Version 属性
        if (Live2DCubismCore.Version) {
          return Live2DCubismCore.Version;
        }
        // 尝试通过 csmGetVersion 函数获取
        if (typeof Live2DCubismCore._csmGetVersion === 'function') {
          return Live2DCubismCore._csmGetVersion();
        }
        return '4.x (unknown)';
      }
    } catch (e) {
      return 'unknown';
    }
    return null;
  }

  /**
   * 获取 SDK 加载状态摘要
   */
  getStatusSummary() {
    return {
      status: this._status,
      coreVersion: this._coreVersion,
      coreAvailable: typeof Live2DCubismCore !== 'undefined',
      frameworkAvailable: typeof CubismFramework !== 'undefined',
      errors: this._errors,
    };
  }
}

// ===================== 单例 =====================

let _instance = null;

/**
 * 获取 Cubism SDK 加载器单例
 * @returns {CubismSDKLoader}
 */
export function getCubismLoader() {
  if (!_instance) {
    _instance = new CubismSDKLoader();
  }
  return _instance;
}

/**
 * 便捷函数：加载并等待 SDK 就绪
 * @returns {Promise<{status: string, coreVersion: string|null}>}
 */
export async function ensureCubismSDK() {
  const loader = getCubismLoader();
  return loader.load();
}