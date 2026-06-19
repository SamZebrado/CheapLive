/**
 * CheapLive Face Tracker
 * 基于 MediaPipe Face Landmarker 的浏览器端面部捕捉
 */

// 注意：MediaPipe 改为动态 import，仅在用户点击"启动摄像头"时加载。
// 这样程序化 Avatar 在无网络环境（CI/离线）下仍可渲染。
import { DebugAvatar } from './debug-avatar.js';
import { createAvatar, AVATAR_VERSIONS } from './avatar-versions.js';

class FaceTracker {
  constructor() {
    this.faceLandmarker = null;
    this.webcam = document.getElementById('webcam');
    this.canvas = document.getElementById('output_canvas');
    this.ctx = this.canvas.getContext('2d');
    this.loading = document.getElementById('loading');
    this.status = document.getElementById('status');
    this.startBtn = document.getElementById('startBtn');
    this.stopBtn = document.getElementById('stopBtn');
    this.privacyToggle = document.getElementById('privacyMode');
    this.videoWrapper = document.querySelector('.video-wrapper');

    this.running = false;
    this.privacyMode = false;
    this.mirrorData = true;
    this.lastVideoTime = -1;
    this.fps = 0;
    this.lastFpsTime = 0;
    this.frameCount = 0;

    // 性能控制
    this.perfMode = 'normal'; // 'normal' | 'low' | 'minimal'
    this.frameSkip = 0;       // 跳帧计数器
    this.renderInterval = 0;  // 渲染间隔（ms）
    this.lastRenderTime = 0;  // 上次渲染时间

    // 放大系数（0.5~3.0，1.0=默认，不缩放）
    // 用于增强或减弱各参数的动态范围
    this.scale = {
      eye: 1.5,      // 眼睛开合：放大以使更明显
      mouth: 1.5,    // 嘴开合：放大
      smile: 1.5,    // 微笑：放大
      brow: 1.8,     // 眉毛：放大
      head: 1.0,     // 头姿态：1.0
      pos: 1.0,      // 头位置：1.0
    };

    // 校准值（中性姿态，作为中心基准）
    // 使用校准按钮采集，而非固定 0.5
    this.calibration = {
      eyeLeft: 0.7,      // 眼睛开合的"自然睁眼"基准（高值）
      eyeRight: 0.7,
      mouthOpen: 0.0,    // 嘴的"闭合"基准
      mouthSmile: 0.0,   // 微笑的"中性"基准
      browLeft: 0.0,     // 眉的"自然"基准
      browRight: 0.0,
      headYaw: 0.5,      // 头姿态中心
      headPitch: 0.5,
      headRoll: 0.5,
      headX: 0.5,
      headY: 0.5,
    };

    // 校准状态
    this.calibrating = false;
    this.calibBuffer = [];       // 采集的原始值样本
    this.calibDuration = 3000;   // 3 秒
    this.calibStartTime = 0;

    // 平滑值（用于嘴部等需要平滑的参数）
    this.smoothed = {
      mouthOpen: 0,
      mouthSmile: 0,
    };
    this.smoothFactor = 0.25; // 0=不平滑, 1=完全平滑（不更新）

    // 调试小人
    this.avatar = null;
    this.avatarVersion = 'mesh-spindle-whale';

    // 按需加载的模块（懒加载）
    this.voiceChanger = null;
    this.liveSubtitle = null;
    this.voiceChangerEnabled = false;
    this.subtitleEnabled = false;

    this.setupAvatarControls();
    this.setupSensitivityControls();
    this.setupHelpModal();
    this.setupFeatureToggles();
    this.loadSettings();

    this.init();
  }

  async initAvatar() {
    this.avatar = await createAvatar(this.avatarVersion);
  }

  // 灵敏度/放大系数 UI 控制
  setupSensitivityControls() {
    const sliders = [
      { id: 'sensEye', key: 'eye', label: '眼' },
      { id: 'sensMouth', key: 'mouth', label: '嘴' },
      { id: 'sensSmile', key: 'smile', label: '笑' },
      { id: 'sensBrow', key: 'brow', label: '眉' },
      { id: 'sensHead', key: 'head', label: '头' },
      { id: 'sensPos', key: 'pos', label: '位' },
    ];
    sliders.forEach(({ id, key, label }) => {
      const slider = document.getElementById(id);
      const valEl = document.getElementById(id + 'Val');
      if (slider) {
        slider.addEventListener('input', () => {
          // 将 50~300 的滑块值映射到 0.5~3.0 的 scale 系数
          this.scale[key] = Number(slider.value) / 100;
          if (valEl) valEl.textContent = this.scale[key].toFixed(1) + 'x';
          this.saveSettings();
        });
      }
    });

    // 校准按钮
    const calibBtn = document.getElementById('calibBtn');
    if (calibBtn) {
      calibBtn.addEventListener('click', () => this.startCalibration());
    }
  }

  // 启动 3 秒校准：采集中性姿态平均值
  startCalibration() {
    if (!this.running) {
      const statusEl = document.getElementById('status');
      if (statusEl) statusEl.textContent = '请先启动摄像头再校准';
      return;
    }
    this.calibrating = true;
    this.calibBuffer = [];
    this.calibStartTime = performance.now();
    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.textContent = '校准中...请保持自然姿态 3 秒';
    const btn = document.getElementById('calibBtn');
    if (btn) { btn.disabled = true; btn.textContent = '校准中...'; }
  }

  // finishCalibration: 对采集的样本取平均，作为新的校准基准
  finishCalibration(sample) {
    // sample: { eyeLeft, eyeRight, mouthOpen, mouthSmile, browLeft, browRight, headYaw, headPitch, headRoll, headX, headY }
    if (!sample) return;
    for (const k in sample) {
      if (k in this.calibration) {
        this.calibration[k] = sample[k];
      }
    }
    this.calibrating = false;
    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.textContent = '校准完成';
    const btn = document.getElementById('calibBtn');
    if (btn) { btn.disabled = false; btn.textContent = '重新校准'; }
    this.saveSettings();
  }

  // 程度型参数缩放：从 0 开始的量（嘴开合、微笑、眉毛抬起、眼睛开合从闭合态算）
  // raw: 原始值；calib: 中性基准值；scaleFactor: 放大系数；invert: 是否反转方向
  applyMagnitudeScale(raw, calib, scaleFactor, invert = false) {
    let delta;
    if (invert) {
      // 对于眼睛，calib 是"自然睁眼"的高值，值低于 calib 表示闭眼程度
      delta = calib - raw;  // >0 表示闭眼程度
    } else {
      // 对于嘴/眉/微笑，calib 是"放松"的低值，值高于 calib 表示程度
      delta = raw - calib;  // >0 表示动作程度
    }
    // 放大偏差后映射回 0~1
    const scaledDelta = delta * scaleFactor;
    let result;
    if (invert) {
      // 输出：1 = 完全睁眼, 0 = 完全闭眼
      result = 1.0 - Math.max(0, scaledDelta);
    } else {
      // 输出：0 = 中性, 1 = 完全动作
      result = Math.max(0, Math.min(1, scaledDelta));
    }
    return result;
  }

  // 位置型参数缩放：围绕中心值的量（头姿态、位置）
  applyCenterScale(raw, center, scaleFactor) {
    const delta = raw - center;
    const scaled = delta * scaleFactor;
    return Math.max(0, Math.min(1, center + scaled));
  }

  // 平滑插值：避免嘴部动作跳变
  smoothValue(key, target) {
    const current = this.smoothed[key] || 0;
    this.smoothed[key] = current + (target - current) * (1 - this.smoothFactor);
    return this.smoothed[key];
  }
  loadSettings() {
    try {
      const settings = JSON.parse(localStorage.getItem('cheaplive_settings') || '{}');

      // 恢复隐私模式
      if (settings.privacyMode) {
        this.privacyToggle.checked = true;
        this.togglePrivacy(true);
      }

      // 恢复镜像
      if (settings.mirrorData) {
        const mirrorToggle = document.getElementById('mirrorMode');
        if (mirrorToggle) {
          mirrorToggle.checked = true;
          this.mirrorData = true;
        }
      }

      // 恢复应用模式
      if (settings.appMode) {
        const appModeToggle = document.getElementById('appMode');
        if (appModeToggle) {
          appModeToggle.checked = true;
          this.avatar.setAppMode(true);
          this.toggleAppModeUI(true);
        }
      }

      // 恢复放大系数（替代旧的 sensitivity）
      if (settings.scale) {
        Object.assign(this.scale, settings.scale);
      } else if (settings.sensitivity) {
        // 兼容旧版：sensitivity 百分比转换为 scale 系数
        for (const k in settings.sensitivity) {
          if (this.scale[k] !== undefined) {
            this.scale[k] = settings.sensitivity[k] / 100;
          }
        }
      }
      const sliderMap = {
        eye: 'sensEye', mouth: 'sensMouth', smile: 'sensSmile',
        brow: 'sensBrow', head: 'sensHead', pos: 'sensPos',
      };
      for (const [key, id] of Object.entries(sliderMap)) {
        const slider = document.getElementById(id);
        const valEl = document.getElementById(id + 'Val');
        if (slider) slider.value = Math.round(this.scale[key] * 100);
        if (valEl) valEl.textContent = this.scale[key].toFixed(1) + 'x';
      }

      // 恢复校准值
      if (settings.calibration) {
        Object.assign(this.calibration, settings.calibration);
      }

      // 恢复性能模式
      if (settings.perfMode) {
        this.perfMode = settings.perfMode;
        const perfRadio = document.querySelector(`input[name="perfMode"][value="${settings.perfMode}"]`);
        if (perfRadio) perfRadio.checked = true;
      }
    } catch (e) {
      console.warn('加载设置失败:', e);
    }
  }

  saveSettings() {
    try {
      const settings = {
        privacyMode: this.privacyMode,
        mirrorData: this.mirrorData,
        appMode: this.avatar ? this.avatar.appMode : false,
        scale: this.scale,
        calibration: this.calibration,
        perfMode: this.perfMode,
      };
      localStorage.setItem('cheaplive_settings', JSON.stringify(settings));
    } catch (e) {
      console.warn('保存设置失败:', e);
    }
  }

  setupAvatarControls() {
    document.getElementById('testBlink').addEventListener('click', () => {
      this.avatar.updateParams({ eyeLeft: 0, eyeRight: 0 });
      setTimeout(() => this.avatar.updateParams({ eyeLeft: 1, eyeRight: 1 }), 200);
    });
    document.getElementById('testSmile').addEventListener('click', () => {
      this.avatar.updateParams({ mouthSmile: 1 });
      setTimeout(() => this.avatar.updateParams({ mouthSmile: 0 }), 1000);
    });
    document.getElementById('testOpen').addEventListener('click', () => {
      this.avatar.updateParams({ mouthOpen: 1 });
      setTimeout(() => this.avatar.updateParams({ mouthOpen: 0 }), 1000);
    });
    document.getElementById('testReset').addEventListener('click', () => {
      this.avatar.updateParams({
        eyeLeft: 1, eyeRight: 1, mouthOpen: 0, mouthSmile: 0,
        browLeft: 0, browRight: 0, headYaw: 0.5, headPitch: 0.5, headRoll: 0.5,
        headX: 0.5, headY: 0.5
      });
    });

    // 头部姿态测试按钮（方便在不启用摄像头时查看侧面形状）
    // headYaw/Pitch/Roll 范围都是 0~1，0.5 为正中。
    const POSE_STEP = 0.15; // 每次点击调整幅度（约 ±18° yaw / ±13.5° pitch / ±12° roll
    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    const getCurrentPose = () => ({
      yaw: this.avatar.params.headYaw ?? 0.5,
      pitch: this.avatar.params.headPitch ?? 0.5,
      roll: this.avatar.params.headRoll ?? 0.5,
    });

    document.getElementById('testYawLeft').addEventListener('click', () => {
      const p = getCurrentPose(); this.avatar.updateParams({ headYaw: clamp01(p.yaw - POSE_STEP) });
    });
    document.getElementById('testYawRight').addEventListener('click', () => {
      const p = getCurrentPose(); this.avatar.updateParams({ headYaw: clamp01(p.yaw + POSE_STEP) });
    });
    document.getElementById('testPitchUp').addEventListener('click', () => {
      const p = getCurrentPose(); this.avatar.updateParams({ headPitch: clamp01(p.pitch - POSE_STEP) });
    });
    document.getElementById('testPitchDown').addEventListener('click', () => {
      const p = getCurrentPose(); this.avatar.updateParams({ headPitch: clamp01(p.pitch + POSE_STEP) });
    });
    document.getElementById('testRollLeft').addEventListener('click', () => {
      const p = getCurrentPose(); this.avatar.updateParams({ headRoll: clamp01(p.roll - POSE_STEP) });
    });
    document.getElementById('testRollRight').addEventListener('click', () => {
      const p = getCurrentPose(); this.avatar.updateParams({ headRoll: clamp01(p.roll + POSE_STEP) });
    });
    document.getElementById('testPoseReset').addEventListener('click', () => {
      this.avatar.updateParams({ headYaw: 0.5, headPitch: 0.5, headRoll: 0.5 });
    });

    // 镜像开关：交换左右面部数据，而非翻转图形
    const mirrorToggle = document.getElementById('mirrorMode');
    if (mirrorToggle) {
      mirrorToggle.addEventListener('change', (e) => {
        this.mirrorData = e.target.checked;
        this.saveSettings();
      });
    }

    // 应用模式开关
    const appModeToggle = document.getElementById('appMode');
    if (appModeToggle) {
      appModeToggle.addEventListener('change', (e) => {
        this.avatar.setAppMode(e.target.checked);
        this.toggleAppModeUI(e.target.checked);
        this.saveSettings();
      });
    }

    // 应用模式退出按钮
    const exitAppMode = document.getElementById('exitAppMode');
    if (exitAppMode) {
      exitAppMode.addEventListener('click', () => {
        this.avatar.setAppMode(false);
        this.toggleAppModeUI(false);
        if (appModeToggle) appModeToggle.checked = false;
        this.saveSettings();
      });
    }

    // 性能模式开关
    const perfRadios = document.querySelectorAll('input[name="perfMode"]');
    perfRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.perfMode = e.target.value;
        this.frameSkip = 0;
        this.saveSettings();
      });
    });

    // 模型切换
    this.setupModelSwitch();
  }

  setupModelSwitch() {
    const tabs = document.querySelectorAll('.model-tab');
    const live2dImport = document.getElementById('live2dImport');
    const modelFolder = document.getElementById('modelFolder');
    const modelStatus = document.getElementById('modelStatus');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const model = tab.dataset.model;
        if (model === 'sphere') {
          this.switchAvatarVersion('mesh-sphere');
        } else {
          this.switchAvatarVersion('mesh-spindle-whale');
        }
      });
    });

    // Live2D 模型 ZIP 上传
    const modelZip = document.getElementById('modelZip');
    if (modelZip) {
      modelZip.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          this.handleLive2DZipUpload(file, modelStatus);
        }
      });
    }

    // Live2D 模型文件夹上传（兼容方案）
    if (modelFolder) {
      modelFolder.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
          this.handleLive2DFolderUpload(files, modelStatus);
        }
      });
    }
  }

  async switchAvatarVersion(version) {
    this.avatarVersion = version;
    // 保存当前参数
    const currentParams = this.avatar ? { ...this.avatar.params } : null;
    // 销毁旧 avatar
    if (this.avatar) {
      // 清理事件监听
      window.removeEventListener('resize', this.avatar._resizeHandler);
    }
    // 创建新 avatar
    this.avatar = await createAvatar(version);
    // 恢复参数
    if (currentParams) {
      this.avatar.updateParams(currentParams);
    }
    // 恢复应用模式状态
    const appModeToggle = document.getElementById('appMode');
    if (appModeToggle && appModeToggle.checked) {
      this.avatar.setAppMode(true);
    }
    this.saveSettings();
  }

  async handleLive2DZipUpload(file, statusEl) {
    if (!file || !file.name.endsWith('.zip')) {
      statusEl.textContent = '请选择 .zip 格式的模型压缩包';
      return;
    }

    statusEl.textContent = '正在解压 ZIP 文件...';

    try {
      // 动态加载 JSZip
      const JSZip = await this.loadJSZip();
      const zip = await JSZip.loadAsync(file);

      // 查找 .model3.json
      let modelJsonFile = null;
      let modelJsonName = '';
      zip.forEach((path, zipEntry) => {
        if (path.endsWith('.model3.json') && !modelJsonFile) {
          modelJsonFile = zipEntry;
          modelJsonName = path;
        }
      });

      if (!modelJsonFile) {
        statusEl.textContent = '错误：ZIP 中未找到 .model3.json 文件';
        return;
      }

      const jsonText = await modelJsonFile.async('text');
      const modelJson = JSON.parse(jsonText);
      statusEl.textContent = `模型解析成功: ${modelJsonName}`;

      // 创建文件映射
      this.live2dFiles = {};
      const filePromises = [];
      zip.forEach((path, zipEntry) => {
        if (!zipEntry.dir) {
          filePromises.push(
            zipEntry.async('blob').then(blob => {
              this.live2dFiles[path] = new File([blob], path.split('/').pop(), { type: blob.type || 'application/octet-stream' });
            })
          );
        }
      });
      await Promise.all(filePromises);

      this.avatarMode = 'live2d';
      this.live2dModelJson = modelJson;

      // 尝试加载 Live2D SDK
      await this.loadLive2DModel(modelJson, statusEl);

    } catch (err) {
      statusEl.textContent = '解压失败: ' + err.message;
      console.error(err);
    }
  }

  async loadJSZip() {
    if (window.JSZip) return window.JSZip;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
      script.onload = () => resolve(window.JSZip);
      script.onerror = () => reject(new Error('JSZip 加载失败'));
      document.head.appendChild(script);
    });
  }

  async loadLive2DModel(modelJson, statusEl) {
    // 检查 Live2D Cubism SDK 是否可用
    if (typeof Live2DCubismCore === 'undefined') {
      statusEl.textContent = 'Live2D SDK 未加载。请下载 Cubism SDK 并放置到项目目录中';
      return;
    }

    statusEl.textContent = 'Live2D 模型已就绪（SDK 集成待完善）';
  }

  async handleLive2DFolderUpload(files, statusEl) {
    if (!files || files.length === 0) {
      statusEl.textContent = '未选择文件';
      return;
    }

    statusEl.textContent = `已选择 ${files.length} 个文件，正在解析...`;

    // 查找 .model3.json 文件
    const modelJsonFile = Array.from(files).find(f => f.name.endsWith('.model3.json'));
    if (!modelJsonFile) {
      statusEl.textContent = '错误：未找到 .model3.json 文件';
      return;
    }

    try {
      const jsonText = await modelJsonFile.text();
      const modelJson = JSON.parse(jsonText);
      statusEl.textContent = `模型解析成功: ${modelJsonFile.name}`;

      // 创建文件映射
      this.live2dFiles = {};
      for (const file of files) {
        this.live2dFiles[file.name] = file;
      }

      this.avatarMode = 'live2d';
      this.live2dModelJson = modelJson;
      await this.loadLive2DModel(modelJson, statusEl);
    } catch (err) {
      statusEl.textContent = '解析失败: ' + err.message;
      console.error(err);
    }
  }

  setupHelpModal() {
    const modal = document.getElementById('helpModal');
    const body = document.getElementById('helpModalBody');
    const closeBtn = modal.querySelector('.help-modal-close');
    const overlay = modal.querySelector('.help-modal-overlay');

    const helpContents = {
      camera: {
        title: '摄像头与隐私',
        body: `
          <p>你的摄像头画面<strong>仅在本地浏览器中处理</strong>，不会上传到任何服务器。</p>
          <p>面部特征数据由 MediaPipe 模型在本地实时计算，所有数据都留在你的设备上。</p>
          <p>开启"隐私保护模式"后，摄像头画面将被隐藏，仅显示虚拟形象，进一步保护隐私。</p>
          <p>关闭页面或停止摄像头后，所有数据会自动清除。</p>
          <div class="privacy-badge">🔒 纯本地处理 · 无数据上传</div>
        `,
      },
      upload: {
        title: '模型上传与隐私',
        body: `
          <p>你上传的 Live2D 模型文件<strong>仅在本地浏览器中解压和使用</strong>，不会上传到任何服务器。</p>
          <p>模型文件会被缓存在浏览器内存中，刷新页面后会自动清除。</p>
          <p>支持两种上传方式：</p>
          <p><strong>ZIP 文件</strong>：将模型文件夹打包为 .zip 后上传（推荐）</p>
          <p><strong>文件夹</strong>：直接选择模型文件夹（部分浏览器支持）</p>
          <div class="privacy-badge">🔒 模型不离开你的设备</div>
        `,
      },
    };

    document.querySelectorAll('.help-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.help;
        const content = helpContents[key];
        if (content) {
          body.innerHTML = `<h3>${content.title}</h3>${content.body}`;
          modal.classList.remove('hidden');
        }
      });
    });

    const closeModal = () => modal.classList.add('hidden');
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  }

  toggleAppModeUI(enabled) {
    // 使用 body.app-mode 类控制 CSS，保持 1:1 长宽比
    document.body.classList.toggle('app-mode', enabled);

    // 触发 avatar 重新调整大小
    if (this.avatar) {
      this.avatar.resize();
    }
  }

  // 按需加载开关：变声 / 字幕
  setupFeatureToggles() {
    const vcToggle = document.getElementById('voiceChangerToggle');
    const subToggle = document.getElementById('subtitleToggle');
    const vcPreset = document.getElementById('voiceChangerPreset');
    const vcMonitor = document.getElementById('voiceChangerMonitor');

    if (vcToggle) {
      vcToggle.addEventListener('change', async (e) => {
        this.voiceChangerEnabled = e.target.checked;
        if (this.voiceChangerEnabled) {
          if (!this.voiceChanger) {
            const { VoiceChanger } = await import('./voice-changer.js');
            this.voiceChanger = new VoiceChanger();
          }
          // 关键修复：真正调用 start() 来请求麦克风并启动音频处理
          try {
            await this.voiceChanger.start();
            this.status.textContent = '变声已开启';
          } catch (err) {
            this.status.textContent = '变声启动失败: ' + err.message;
            vcToggle.checked = false;
            this.voiceChangerEnabled = false;
            if (this.voiceChanger) {
              this.voiceChanger.stop();
            }
            return;
          }
          // 显示变声控制面板
          const panel = document.getElementById('voiceChangerPanel');
          if (panel) panel.classList.remove('hidden');
        } else {
          if (this.voiceChanger) {
            this.voiceChanger.stop();
          }
          const panel = document.getElementById('voiceChangerPanel');
          if (panel) panel.classList.add('hidden');
          this.status.textContent = '变声已关闭';
        }
      });
    }

    if (vcPreset) {
      vcPreset.addEventListener('change', (e) => {
        if (this.voiceChanger) {
          this.voiceChanger.applyPreset(e.target.value);
          this.status.textContent = `变声预设: ${e.target.options[e.target.selectedIndex].text}`;
        }
      });
    }

    if (vcMonitor) {
      vcMonitor.addEventListener('change', (e) => {
        if (this.voiceChanger) {
          this.voiceChanger.setMonitorMode(e.target.value);
          const labels = { original: '原声监听', changed: '变声监听', mute: '静音监听' };
          this.status.textContent = `监听模式: ${labels[e.target.value]}`;
        }
      });
    }

    if (subToggle) {
      subToggle.addEventListener('change', async (e) => {
        this.subtitleEnabled = e.target.checked;
        if (this.subtitleEnabled) {
          // 先检查浏览器支持
          const supported =
            'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
          if (!supported) {
            this.status.textContent =
              '字幕不可用: 当前浏览器不支持 Web Speech API（仅 Chrome/Edge/QQ浏览器 部分支持）';
            subToggle.checked = false;
            this.subtitleEnabled = false;
            return;
          }
          if (!this.liveSubtitle) {
            const { LiveSubtitle } = await import('./live-subtitle.js');
            this.liveSubtitle = new LiveSubtitle();
            this.liveSubtitle.onResult = (text) => this.updateSubtitle(text);
          }
          try {
            this.liveSubtitle.start();
            this.status.textContent = '字幕已开启（基于浏览器语音识别服务）';
          } catch (err) {
            this.status.textContent = '字幕开启失败: ' + err.message;
            subToggle.checked = false;
            this.subtitleEnabled = false;
          }
        } else {
          if (this.liveSubtitle) this.liveSubtitle.stop();
          this.status.textContent = '字幕已关闭';
        }
      });
    }
  }

  updateSubtitle(text) {
    const subtitleDisplay = document.getElementById('subtitleDisplay');
    if (subtitleDisplay) {
      subtitleDisplay.textContent = text;
    }
  }

  async init() {
    this.startBtn.addEventListener('click', () => this.start());
    this.stopBtn.addEventListener('click', () => this.stop());
    this.privacyToggle.addEventListener('change', (e) => this.togglePrivacy(e.target.checked));

    // 初始化 avatar（异步懒加载）
    try {
      await this.initAvatar();
    } catch (err) {
      console.warn('Avatar 初始化失败:', err);
    }

    try {
      await this.loadModel();
    } catch (err) {
      this.status.textContent = '模型加载失败: ' + err.message;
      console.error(err);
    }
  }

  togglePrivacy(enabled) {
    this.privacyMode = enabled;
    if (this.videoWrapper) {
      this.videoWrapper.classList.toggle('privacy-active', enabled);
    }
    this.status.textContent = enabled ? '隐私保护模式已启用 - 摄像头画面已隐藏' : '隐私保护模式已关闭';
    this.saveSettings();
  }

  async loadModel() {
    this.status.textContent = '正在加载 MediaPipe 模型...';

    // 本地文件路径（与本 index.html 同目录的 mediapipe 子目录）
    const localBase = './mediapipe';
    const localWasmUrl = `${localBase}/wasm`;
    const localModelUrl = `${localBase}/face_landmarker.task`;

    const resolveMod = (mod) => {
      const m = mod || {};
      return {
        FaceLandmarker: m.FaceLandmarker || (m.default && m.default.FaceLandmarker),
        FilesetResolver: m.FilesetResolver || (m.default && m.default.FilesetResolver),
      };
    };

    let FaceLandmarker = null;
    let FilesetResolver = null;
    let wasmBaseUrl = '';
    let modelAssetPath = '';

    // 直接尝试从本地加载；如果本地文件不存在或无法识别，再回退到 CDN。
    // 这样避免了 fetch HEAD/Range 对某些静态服务器或大文件的兼容性问题。
    try {
      const mod = resolveMod(await import('./mediapipe/vision_bundle.mjs'));
      FaceLandmarker = mod.FaceLandmarker;
      FilesetResolver = mod.FilesetResolver;
      if (!FaceLandmarker || !FilesetResolver) {
        throw new Error('本地模块缺少预期导出');
      }
      wasmBaseUrl = localWasmUrl;
      modelAssetPath = localModelUrl;
      this.status.textContent = '加载本地模型（不依赖 CDN）...';
    } catch (err) {
      console.warn('本地模型加载失败，回退到 CDN:', err);
      this.status.textContent = '从 CDN 加载模型（首次加载较慢，约 12MB）...';
      const mod = resolveMod(await import(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/+esm'
      ));
      FaceLandmarker = mod.FaceLandmarker;
      FilesetResolver = mod.FilesetResolver;
      wasmBaseUrl = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm';
      modelAssetPath =
        'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
    }

    const filesetResolver = await FilesetResolver.forVisionTasks(wasmBaseUrl);

    this.faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: modelAssetPath,
        delegate: 'GPU',
      },
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      runningMode: 'VIDEO',
      numFaces: 1,
    });

    this.loading.classList.add('hidden');
    this.status.textContent = `模型加载完成，点击"启动摄像头"开始`;
  }

  async start() {
    if (!this.faceLandmarker) {
      this.status.textContent = '模型尚未加载完成';
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
      });

      this.webcam.srcObject = stream;
      await this.webcam.play();

      // 设置 canvas 尺寸
      this.canvas.width = this.webcam.videoWidth;
      this.canvas.height = this.webcam.videoHeight;

      this.running = true;
      this.startBtn.disabled = true;
      this.stopBtn.disabled = false;
      this.status.textContent = '面部捕捉运行中...';

      this.predictWebcam();
    } catch (err) {
      this.status.textContent = '摄像头启动失败: ' + err.message;
      console.error(err);
    }
  }

  stop() {
    this.running = false;

    const stream = this.webcam.srcObject;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      this.webcam.srcObject = null;
    }

    this.startBtn.disabled = false;
    this.stopBtn.disabled = true;
    this.status.textContent = '已停止';

    // 清空画布
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 重置参数显示
    this.resetParams();
  }

  resetParams() {
    const ids = ['eyeLeft', 'eyeRight', 'mouthOpen', 'mouthSmile', 'browLeft', 'browRight', 'headYaw', 'headPitch', 'headRoll', 'headX', 'headY'];
    ids.forEach(id => {
      const fill = document.getElementById(id);
      const val = document.getElementById(id + 'Val');
      if (fill) fill.style.width = '0%';
      if (val) val.textContent = '0.00';
    });
  }

  async predictWebcam() {
    if (!this.running) return;

    const now = performance.now();
    this.frameCount++;
    if (now - this.lastFpsTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsTime = now;
      document.getElementById('fps').textContent = this.fps;
    }

    // 性能模式：跳帧控制
    let shouldDetect = true;
    let shouldRender = true;

    if (this.perfMode === 'low') {
      // 低性能模式：每 2 帧检测一次，渲染间隔 33ms (30fps)
      this.frameSkip++;
      if (this.frameSkip % 2 !== 0) shouldDetect = false;
      if (now - this.lastRenderTime < 33) shouldRender = false;
    } else if (this.perfMode === 'minimal') {
      // 最低性能模式：每 3 帧检测一次，渲染间隔 50ms (20fps)
      this.frameSkip++;
      if (this.frameSkip % 3 !== 0) shouldDetect = false;
      if (now - this.lastRenderTime < 50) shouldRender = false;
    }

    if (shouldDetect && this.webcam.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.webcam.currentTime;

      const results = this.faceLandmarker.detectForVideo(this.webcam, now);

      if (shouldRender) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.lastRenderTime = now;

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          const landmarks = results.faceLandmarks[0];
          this.drawLandmarks(landmarks);

          if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
            this.updateBlendshapes(results.faceBlendshapes[0]);
          }

          if (results.facialTransformationMatrixes && results.facialTransformationMatrixes.length > 0) {
            this.updateHeadPose(results.facialTransformationMatrixes[0], landmarks);
          }
        }
      } else {
        // 不渲染画面，但仍在后台更新 blendshapes（保持 avatar 动画）
        if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
          this.updateBlendshapes(results.faceBlendshapes[0]);
        }
        if (results.facialTransformationMatrixes && results.facialTransformationMatrixes.length > 0) {
          this.updateHeadPose(results.facialTransformationMatrixes[0], results.faceLandmarks[0]);
        }
      }
    }

    requestAnimationFrame(() => this.predictWebcam());
  }

  drawLandmarks(landmarks) {
    this.ctx.fillStyle = '#4ECDC4';
    this.ctx.strokeStyle = '#FF6B4A';
    this.ctx.lineWidth = 1;

    // 绘制关键点
    for (const point of landmarks) {
      const x = point.x * this.canvas.width;
      const y = point.y * this.canvas.height;
      this.ctx.beginPath();
      this.ctx.arc(x, y, 1.5, 0, 2 * Math.PI);
      this.ctx.fill();
    }

    // 绘制面部轮廓
    this.drawContour(landmarks, [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]);
    // 左眼
    this.drawContour(landmarks, [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7]);
    // 右眼
    this.drawContour(landmarks, [362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382]);
    // 嘴巴
    this.drawContour(landmarks, [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146]);
  }

  drawContour(landmarks, indices) {
    this.ctx.beginPath();
    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      const x = landmarks[idx].x * this.canvas.width;
      const y = landmarks[idx].y * this.canvas.height;
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.closePath();
    this.ctx.stroke();
  }

  updateBlendshapes(blendshapes) {
    const categories = blendshapes.categories;
    if (!categories) return;

    const map = {};
    for (const cat of categories) {
      map[cat.categoryName] = cat.score;
    }

    // === 眼睛：eyeBlinkLeft/Right 是眨眼程度（0=睁眼，1=闭眼），需要反转成睁眼度
    const eyeLeftRaw = 1 - (map['eyeBlinkLeft'] || 0);
    const eyeRightRaw = 1 - (map['eyeBlinkRight'] || 0);
    // 以"自然睁眼"的校准值为基准，低于此值表示闭眼
    const eyeLeftOut = this.applyMagnitudeScale(eyeLeftRaw, this.calibration.eyeLeft, this.scale.eye, true);
    const eyeRightOut = this.applyMagnitudeScale(eyeRightRaw, this.calibration.eyeRight, this.scale.eye, true);
    this.setParam('eyeLeft', this.mirrorData ? eyeRightOut : eyeLeftOut);
    this.setParam('eyeRight', this.mirrorData ? eyeLeftOut : eyeRightOut);

    // === 嘴巴：jawOpen 是嘴张开程度（0=闭合，1=最大）
    const mouthRaw = map['jawOpen'] || 0;
    const mouthOut = this.applyMagnitudeScale(mouthRaw, this.calibration.mouthOpen, this.scale.mouth, false);
    const mouthSmoothed = this.smoothValue('mouthOpen', mouthOut);
    this.setParam('mouthOpen', mouthSmoothed);

    // === 微笑：mouthSmileLeft/Right （0=中性，1=大笑）
    const smileLeft = map['mouthSmileLeft'] || 0;
    const smileRight = map['mouthSmileRight'] || 0;
    const smileRaw = (smileLeft + smileRight) / 2;
    const smileOut = this.applyMagnitudeScale(smileRaw, this.calibration.mouthSmile, this.scale.smile, false);
    const smileSmoothed = this.smoothValue('mouthSmile', smileOut);
    this.setParam('mouthSmile', smileSmoothed);

    // === 眉毛：browInnerUpLeft/Right + browOuterUpLeft/Right （0=放松，1=抬起）
    // MediaPipe 使用明确的 Left/Right 后缀
    const browLeftInner = map['browInnerUpLeft'] || 0;
    const browLeftOuter = map['browOuterUpLeft'] || 0;
    const browRightInner = map['browInnerUpRight'] || 0;
    const browRightOuter = map['browOuterUpRight'] || 0;
    const browLeftRaw = (browLeftInner + browLeftOuter) / 2;
    const browRightRaw = (browRightInner + browRightOuter) / 2;
    const browLeftOut = this.applyMagnitudeScale(browLeftRaw, this.calibration.browLeft, this.scale.brow, false);
    const browRightOut = this.applyMagnitudeScale(browRightRaw, this.calibration.browRight, this.scale.brow, false);
    // 镜像：用户抬起他的左眉 → 在屏幕右侧，对应头像的右眉
    this.setParam('browLeft', this.mirrorData ? browRightOut : browLeftOut);
    this.setParam('browRight', this.mirrorData ? browLeftOut : browRightOut);

    // === 校准：如果在校准模式，记录原始数据并在超时后取平均
    if (this.calibrating) {
      this.calibBuffer.push({
        eyeLeft: eyeLeftRaw,
        eyeRight: eyeRightRaw,
        mouthOpen: mouthRaw,
        mouthSmile: smileRaw,
        browLeft: browLeftRaw,
        browRight: browRightRaw,
        headYaw: 0.5, headPitch: 0.5, headRoll: 0.5,
        headX: 0.5, headY: 0.5,
      });
      const elapsed = performance.now() - this.calibStartTime;
      if (elapsed >= this.calibDuration && this.calibBuffer.length > 0) {
        const avg = {};
        const keys = ['eyeLeft', 'eyeRight', 'mouthOpen', 'mouthSmile', 'browLeft', 'browRight',
                      'headYaw', 'headPitch', 'headRoll', 'headX', 'headY'];
        for (const k of keys) {
          avg[k] = this.calibBuffer.reduce((s, v) => s + (v[k] || 0), 0) / this.calibBuffer.length;
        }
        this.finishCalibration(avg);
      }
    }
  }

  updateHeadPose(matrix, landmarks) {
    // 从 4x4 变换矩阵提取欧拉角
    const m = matrix.data;
    const sy = Math.sqrt(m[0] * m[0] + m[4] * m[4]);

    let yaw, pitch, roll;
    if (sy > 0.001) {
      yaw = Math.atan2(m[8], m[10]);
      pitch = Math.atan2(-m[9], sy);
      roll = Math.atan2(m[1], m[0]);
    } else {
      yaw = Math.atan2(-m[2], m[0]);
      pitch = Math.atan2(-m[9], sy);
      roll = 0;
    }

    // 反向 pitch 和 roll，使 avatar 动作方向与用户面部动作一致
    // MediaPipe 坐标约定与渲染器约定在俯仰、倾斜上反向
    pitch = -pitch;
    roll = -roll;

    // 归一化到 0-1 范围
    // 镜像模式下左右翻转 headYaw 和 headRoll
    let headYawNorm = (yaw / Math.PI + 1) / 2;
    let headRollNorm = (roll / Math.PI + 1) / 2;
    let headPitchNorm = (pitch / Math.PI + 1) / 2;
    if (this.mirrorData) {
      headYawNorm = 1 - headYawNorm;
      headRollNorm = 1 - headRollNorm;
    }

    // 应用头部姿态：围绕校准中心值放大
    this.setParam('headYaw', this.applyCenterScale(headYawNorm, this.calibration.headYaw, this.scale.head));
    this.setParam('headPitch', this.applyCenterScale(headPitchNorm, this.calibration.headPitch, this.scale.head));
    this.setParam('headRoll', this.applyCenterScale(headRollNorm, this.calibration.headRoll, this.scale.head));

    // 头部在画面中的位置（基于 landmarks 的鼻子中心点）
    let headXRaw = 0.5, headYRaw = 0.5;
    if (landmarks && landmarks.length > 0) {
      const nose = landmarks[1];
      headXRaw = this.mirrorData ? (1 - nose.x) : nose.x;
      headYRaw = nose.y;
    }
    // 应用位置缩放：围绕校准中心
    this.setParam('headX', this.applyCenterScale(headXRaw, this.calibration.headX, this.scale.pos));
    this.setParam('headY', this.applyCenterScale(headYRaw, this.calibration.headY, this.scale.pos));

    // 校准：记录头部姿态原始值（用于下次 finishCalibration 时合并）
    if (this.calibrating) {
      const lastSample = this.calibBuffer[this.calibBuffer.length - 1];
      if (lastSample) {
        lastSample.headYaw = headYawNorm;
        lastSample.headPitch = headPitchNorm;
        lastSample.headRoll = headRollNorm;
        lastSample.headX = headXRaw;
        lastSample.headY = headYRaw;
      }
    }
  }

  setParam(id, value) {
    const clamped = Math.max(0, Math.min(1, value));
    const fill = document.getElementById(id);
    const val = document.getElementById(id + 'Val');
    if (fill) fill.style.width = (clamped * 100) + '%';
    if (val) val.textContent = clamped.toFixed(2);

    // 同步更新调试小人
    if (this.avatar) {
      const paramMap = {
        eyeLeft: 'eyeLeft', eyeRight: 'eyeRight',
        mouthOpen: 'mouthOpen', mouthSmile: 'mouthSmile',
        browLeft: 'browLeft', browRight: 'browRight',
        headYaw: 'headYaw', headPitch: 'headPitch', headRoll: 'headRoll',
        headX: 'headX', headY: 'headY'
      };
      if (paramMap[id]) {
        this.avatar.updateParams({ [paramMap[id]]: clamped });
      }
    }
  }
}

// 初始化并暴露到 window
const faceTracker = new FaceTracker();
if (typeof window !== 'undefined') {
  window.faceTracker = faceTracker;
}
