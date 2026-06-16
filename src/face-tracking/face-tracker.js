/**
 * CheapLive Face Tracker
 * 基于 MediaPipe Face Landmarker 的浏览器端面部捕捉
 */

import { FaceLandmarker, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/+esm';
import { DebugAvatar } from './debug-avatar.js';

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
    this.mirrorData = false;
    this.lastVideoTime = -1;
    this.fps = 0;
    this.lastFpsTime = 0;
    this.frameCount = 0;

    // 灵敏度（0~200，100=默认）
    this.sensitivity = {
      eye: 100,
      mouth: 100,
      brow: 100,
      head: 100,
      pos: 100,
    };

    // 平滑值（用于嘴部等需要平滑的参数）
    this.smoothed = {
      mouthOpen: 0,
      mouthSmile: 0,
    };
    this.smoothFactor = 0.35; // 0=不平滑, 1=完全平滑（不更新）

    // 调试小人
    this.avatar = new DebugAvatar('avatar_canvas');
    this.setupAvatarControls();
    this.setupSensitivityControls();
    this.loadSettings();

    this.init();
  }

  // 灵敏度控制
  setupSensitivityControls() {
    const sliders = [
      { id: 'sensEye', key: 'eye' },
      { id: 'sensMouth', key: 'mouth' },
      { id: 'sensBrow', key: 'brow' },
      { id: 'sensHead', key: 'head' },
      { id: 'sensPos', key: 'pos' },
    ];
    sliders.forEach(({ id, key }) => {
      const slider = document.getElementById(id);
      const valEl = document.getElementById(id + 'Val');
      if (slider) {
        slider.addEventListener('input', () => {
          this.sensitivity[key] = Number(slider.value);
          if (valEl) valEl.textContent = slider.value + '%';
          this.saveSettings();
        });
      }
    });
  }

  // 应用灵敏度：将原始值（0~1）通过灵敏度映射到输出值（0~1）
  // sens: 0~200，100=默认（线性映射），<100=钝化，>100=放大
  applySensitivity(rawValue, sensKey) {
    const sens = this.sensitivity[sensKey] / 100; // 0~2
    // 以 0.5 为中心进行缩放
    return 0.5 + (rawValue - 0.5) * sens;
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

      // 恢复灵敏度
      if (settings.sensitivity) {
        Object.assign(this.sensitivity, settings.sensitivity);
        const sliderMap = {
          eye: 'sensEye', mouth: 'sensMouth', brow: 'sensBrow',
          head: 'sensHead', pos: 'sensPos',
        };
        for (const [key, id] of Object.entries(sliderMap)) {
          const slider = document.getElementById(id);
          const valEl = document.getElementById(id + 'Val');
          if (slider) slider.value = this.sensitivity[key];
          if (valEl) valEl.textContent = this.sensitivity[key] + '%';
        }
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
        sensitivity: this.sensitivity,
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
  }

  toggleAppModeUI(enabled) {
    // 使用 body.app-mode 类控制 CSS，保持 1:1 长宽比
    document.body.classList.toggle('app-mode', enabled);

    // 触发 avatar 重新调整大小
    if (this.avatar) {
      this.avatar.resize();
    }
  }

  async init() {
    this.startBtn.addEventListener('click', () => this.start());
    this.stopBtn.addEventListener('click', () => this.stop());
    this.privacyToggle.addEventListener('change', (e) => this.togglePrivacy(e.target.checked));

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

    const filesetResolver = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
    );

    this.faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      runningMode: 'VIDEO',
      numFaces: 1,
    });

    this.loading.classList.add('hidden');
    this.status.textContent = '模型加载完成，点击"启动摄像头"开始';
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

    if (this.webcam.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.webcam.currentTime;

      const results = this.faceLandmarker.detectForVideo(this.webcam, now);

      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

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

    // 眼睛：eyeBlinkLeft 是眨眼程度（0=睁眼，1=闭眼），需要反转成睁眼度
    // 镜像模式下交换左右眼数据
    const eyeLeftRaw = 1 - (map['eyeBlinkLeft'] || 0);
    const eyeRightRaw = 1 - (map['eyeBlinkRight'] || 0);
    // 应用眼睛灵敏度
    const eyeLeftSens = this.applySensitivity(eyeLeftRaw, 'eye');
    const eyeRightSens = this.applySensitivity(eyeRightRaw, 'eye');
    this.setParam('eyeLeft', this.mirrorData ? eyeRightSens : eyeLeftSens);
    this.setParam('eyeRight', this.mirrorData ? eyeLeftSens : eyeRightSens);

    // 嘴巴：应用灵敏度 + 平滑插值
    const mouthRaw = map['jawOpen'] || 0;
    const mouthSens = this.applySensitivity(mouthRaw, 'mouth');
    const mouthSmoothed = this.smoothValue('mouthOpen', mouthSens);
    this.setParam('mouthOpen', mouthSmoothed);

    const smileLeft = map['mouthSmileLeft'] || 0;
    const smileRight = map['mouthSmileRight'] || 0;
    const smileRaw = (smileLeft + smileRight) / 2;
    const smileSens = this.applySensitivity(smileRaw, 'mouth');
    const smileSmoothed = this.smoothValue('mouthSmile', smileSens);
    this.setParam('mouthSmile', smileSmoothed);

    // 眉毛：镜像模式下交换 + 应用灵敏度
    const browLeftRaw = map['browInnerUp'] || 0;
    const browRightRaw = map['browOuterUpLeft'] || 0;
    const browLeftSens = this.applySensitivity(browLeftRaw, 'brow');
    const browRightSens = this.applySensitivity(browRightRaw, 'brow');
    this.setParam('browLeft', this.mirrorData ? browRightSens : browLeftSens);
    this.setParam('browRight', this.mirrorData ? browLeftSens : browRightSens);
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

    // 归一化到 0-1 范围
    // 镜像模式下左右翻转 headYaw 和 headRoll
    let headYawNorm = (yaw / Math.PI + 1) / 2;
    let headRollNorm = (roll / Math.PI + 1) / 2;
    let headPitchNorm = (pitch / Math.PI + 1) / 2;
    if (this.mirrorData) {
      headYawNorm = 1 - headYawNorm;
      headRollNorm = 1 - headRollNorm;
    }
    // 应用头部姿态灵敏度
    this.setParam('headYaw', this.applySensitivity(headYawNorm, 'head'));
    this.setParam('headPitch', this.applySensitivity(headPitchNorm, 'head'));
    this.setParam('headRoll', this.applySensitivity(headRollNorm, 'head'));

    // 头部在画面中的位置（基于 landmarks 的鼻子中心点）
    if (landmarks && landmarks.length > 0) {
      // 鼻子中心点索引 1（MediaPipe Face Landmarker）
      const nose = landmarks[1];
      // 镜像模式下水平位置翻转
      const headXRaw = this.mirrorData ? (1 - nose.x) : nose.x;
      const headYRaw = nose.y;
      // 应用位置灵敏度
      this.setParam('headX', this.applySensitivity(headXRaw, 'pos'));
      this.setParam('headY', this.applySensitivity(headYRaw, 'pos'));
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

// 初始化
new FaceTracker();
