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
    this.mirrorData = false; // 镜像：交换左右面部数据
    this.lastVideoTime = -1;
    this.fps = 0;
    this.lastFpsTime = 0;
    this.frameCount = 0;

    // 调试小人
    this.avatar = new DebugAvatar('avatar_canvas');
    this.setupAvatarControls();

    this.init();
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
      });
    }

    // 应用模式开关
    const appModeToggle = document.getElementById('appMode');
    if (appModeToggle) {
      appModeToggle.addEventListener('change', (e) => {
        this.avatar.setAppMode(e.target.checked);
        this.toggleAppModeUI(e.target.checked);
      });
    }
  }

  toggleAppModeUI(enabled) {
    // 隐藏/显示调试面板
    const dataPanel = document.querySelector('.data-panel');
    const paramPanel = document.querySelector('.param-panel');
    const avatarControls = document.querySelector('.avatar-controls');
    const mirrorToggle = document.querySelector('.mirror-toggle');
    const privacyToggle = document.querySelector('.privacy-toggle');
    const controls = document.querySelector('.controls');
    const status = document.getElementById('status');
    const fps = document.getElementById('fps');

    if (enabled) {
      if (dataPanel) dataPanel.style.display = 'none';
      if (paramPanel) paramPanel.style.display = 'none';
      if (avatarControls) avatarControls.style.display = 'none';
      if (mirrorToggle) mirrorToggle.style.display = 'none';
      if (privacyToggle) privacyToggle.style.display = 'none';
      if (controls) controls.style.display = 'none';
      if (status) status.style.display = 'none';
      if (fps) fps.style.display = 'none';

      // 扩大 avatar 区域
      const avatarSection = document.querySelector('.avatar-section');
      if (avatarSection) {
        avatarSection.style.gridColumn = '1 / -1';
        avatarSection.style.maxWidth = '100%';
      }
      const avatarWrapper = document.querySelector('.avatar-wrapper');
      if (avatarWrapper) {
        avatarWrapper.style.height = '70vh';
      }
    } else {
      if (dataPanel) dataPanel.style.display = '';
      if (paramPanel) paramPanel.style.display = '';
      if (avatarControls) avatarControls.style.display = '';
      if (mirrorToggle) mirrorToggle.style.display = '';
      if (privacyToggle) privacyToggle.style.display = '';
      if (controls) controls.style.display = '';
      if (status) status.style.display = '';
      if (fps) fps.style.display = '';

      const avatarSection = document.querySelector('.avatar-section');
      if (avatarSection) {
        avatarSection.style.gridColumn = '';
        avatarSection.style.maxWidth = '';
      }
      const avatarWrapper = document.querySelector('.avatar-wrapper');
      if (avatarWrapper) {
        avatarWrapper.style.height = '';
      }
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
    this.setParam('eyeLeft', this.mirrorData ? eyeRightRaw : eyeLeftRaw);
    this.setParam('eyeRight', this.mirrorData ? eyeLeftRaw : eyeRightRaw);

    // 嘴巴
    this.setParam('mouthOpen', map['jawOpen'] || 0);
    const smileLeft = map['mouthSmileLeft'] || 0;
    const smileRight = map['mouthSmileRight'] || 0;
    this.setParam('mouthSmile', (smileLeft + smileRight) / 2);

    // 眉毛：镜像模式下交换
    const browLeftRaw = map['browInnerUp'] || 0;
    const browRightRaw = map['browOuterUpLeft'] || 0;
    this.setParam('browLeft', this.mirrorData ? browRightRaw : browLeftRaw);
    this.setParam('browRight', this.mirrorData ? browLeftRaw : browRightRaw);
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
    if (this.mirrorData) {
      headYawNorm = 1 - headYawNorm;
      headRollNorm = 1 - headRollNorm;
    }
    this.setParam('headYaw', headYawNorm);
    this.setParam('headPitch', (pitch / Math.PI + 1) / 2);
    this.setParam('headRoll', headRollNorm);

    // 头部在画面中的位置（基于 landmarks 的鼻子中心点）
    if (landmarks && landmarks.length > 0) {
      // 鼻子中心点索引 1（MediaPipe Face Landmarker）
      const nose = landmarks[1];
      // 镜像模式下水平位置翻转
      const headX = this.mirrorData ? (1 - nose.x) : nose.x;
      this.setParam('headX', headX);
      this.setParam('headY', nose.y);
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
