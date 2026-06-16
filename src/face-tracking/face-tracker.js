/**
 * CheapLive Face Tracker
 * 基于 MediaPipe Face Landmarker 的浏览器端面部捕捉
 */

import { FaceLandmarker, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/+esm';

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

    this.running = false;
    this.lastVideoTime = -1;
    this.fps = 0;
    this.lastFpsTime = 0;
    this.frameCount = 0;

    this.init();
  }

  async init() {
    this.startBtn.addEventListener('click', () => this.start());
    this.stopBtn.addEventListener('click', () => this.stop());

    try {
      await this.loadModel();
    } catch (err) {
      this.status.textContent = '模型加载失败: ' + err.message;
      console.error(err);
    }
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
    const ids = ['eyeLeft', 'eyeRight', 'mouthOpen', 'mouthSmile', 'browLeft', 'browRight', 'headYaw', 'headPitch', 'headRoll'];
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
          this.updateHeadPose(results.facialTransformationMatrixes[0]);
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

    // 眼睛
    this.setParam('eyeLeft', map['eyeBlinkLeft'] || 0);
    this.setParam('eyeRight', map['eyeBlinkRight'] || 0);

    // 嘴巴
    this.setParam('mouthOpen', map['jawOpen'] || 0);
    const smileLeft = map['mouthSmileLeft'] || 0;
    const smileRight = map['mouthSmileRight'] || 0;
    this.setParam('mouthSmile', (smileLeft + smileRight) / 2);

    // 眉毛
    this.setParam('browLeft', map['browInnerUp'] || 0);
    this.setParam('browRight', map['browOuterUpLeft'] || 0);
  }

  updateHeadPose(matrix) {
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
    this.setParam('headYaw', (yaw / Math.PI + 1) / 2);
    this.setParam('headPitch', (pitch / Math.PI + 1) / 2);
    this.setParam('headRoll', (roll / Math.PI + 1) / 2);
  }

  setParam(id, value) {
    const clamped = Math.max(0, Math.min(1, value));
    const fill = document.getElementById(id);
    const val = document.getElementById(id + 'Val');
    if (fill) fill.style.width = (clamped * 100) + '%';
    if (val) val.textContent = clamped.toFixed(2);
  }
}

// 初始化
new FaceTracker();
