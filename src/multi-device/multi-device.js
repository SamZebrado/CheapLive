/**
 * CheapLive Multi-Device - WebRTC P2P Face Data Sync
 * 局域网多端互动：发送端面捕 -> 接收端渲染
 * 无需服务器，纯浏览器 P2P
 */

import { FaceLandmarker, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/+esm';
import { DebugAvatar } from '../face-tracking/debug-avatar.js';

// ===================== 工具函数 =====================

function generateId() {
  return Math.random().toString(36).substring(2, 6) + '-' +
         Math.random().toString(36).substring(2, 5) + '-' +
         Math.random().toString(36).substring(2, 6);
}

function getLocalIp() {
  return new Promise((resolve) => {
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel('');
    pc.createOffer().then(o => pc.setLocalDescription(o));
    pc.onicecandidate = (ice) => {
      if (!ice || !ice.candidate || !ice.candidate.candidate) {
        resolve(null);
        pc.close();
        return;
      }
      const ipMatch = ice.candidate.candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
      resolve(ipMatch ? ipMatch[1] : null);
      pc.close();
    };
    setTimeout(() => { resolve(null); pc.close(); }, 3000);
  });
}

// ===================== WebRTC 信令（基于 BroadcastChannel + 轮询回退）=====================

class SignalingChannel {
  constructor(id) {
    this.id = id;
    this.onmessage = null;
    this.bc = null;
    this.pollInterval = null;
    this.receivedIds = new Set();

    // 优先使用 BroadcastChannel（同浏览器多标签）
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.bc = new BroadcastChannel('cheaplive_signaling');
        this.bc.onmessage = (e) => {
          if (e.data.to === this.id && this.onmessage) {
            this.onmessage(e.data);
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel 不可用，使用轮询回退');
      }
    }

    // 轮询回退（localStorage 模拟）
    this.startPolling();
  }

  startPolling() {
    const key = 'cheaplive_signal_' + this.id;
    this.pollInterval = setInterval(() => {
      try {
        const data = localStorage.getItem(key);
        if (data) {
          const msg = JSON.parse(data);
          if (!this.receivedIds.has(msg._id)) {
            this.receivedIds.add(msg._id);
            if (this.onmessage) this.onmessage(msg);
          }
          localStorage.removeItem(key);
        }
      } catch (e) {}
    }, 200);
  }

  send(to, data) {
    const msg = { ...data, from: this.id, to, _id: generateId(), _t: Date.now() };

    // BroadcastChannel
    if (this.bc) {
      try { this.bc.postMessage(msg); } catch (e) {}
    }

    // localStorage 回退
    try {
      localStorage.setItem('cheaplive_signal_' + to, JSON.stringify(msg));
    } catch (e) {}
  }

  broadcast(data) {
    const msg = { ...data, from: this.id, _id: generateId(), _t: Date.now() };
    if (this.bc) {
      try { this.bc.postMessage({ ...msg, to: 'all' }); } catch (e) {}
    }
  }

  close() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.bc) this.bc.close();
  }
}

// ===================== WebRTC 连接管理 =====================

class P2PConnection {
  constructor(localId, isInitiator = false) {
    this.localId = localId;
    this.isInitiator = isInitiator;
    this.pc = null;
    this.dataChannel = null;
    this.ondata = null;
    this.onopen = null;
    this.onclose = null;
    this.connected = false;
    this.remoteId = null;
    this.signaling = new SignalingChannel(localId);
    this.signaling.onmessage = (msg) => this.handleSignal(msg);
    this.latency = 0;
    this.lastPingTime = 0;
  }

  async createConnection() {
    this.pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    this.pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.signaling.send(this.remoteId, { type: 'ice', candidate: e.candidate });
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc.connectionState === 'connected') {
        this.connected = true;
        if (this.onopen) this.onopen();
      } else if (['disconnected', 'failed', 'closed'].includes(this.pc.connectionState)) {
        this.connected = false;
        if (this.onclose) this.onclose();
      }
    };

    if (this.isInitiator) {
      this.dataChannel = this.pc.createDataChannel('facedata', {
        ordered: false,
        maxRetransmits: 0,
      });
      this.setupDataChannel();
    } else {
      this.pc.ondatachannel = (e) => {
        this.dataChannel = e.channel;
        this.setupDataChannel();
      };
    }
  }

  setupDataChannel() {
    this.dataChannel.onopen = () => {
      this.connected = true;
      if (this.onopen) this.onopen();
    };
    this.dataChannel.onclose = () => {
      this.connected = false;
      if (this.onclose) this.onclose();
    };
    this.dataChannel.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'ping') {
          this.sendRaw(JSON.stringify({ type: 'pong', t: data.t }));
        } else if (data.type === 'pong') {
          this.latency = Date.now() - data.t;
        } else if (this.ondata) {
          this.ondata(data);
        }
      } catch (err) {}
    };
  }

  async connect(remoteId) {
    this.remoteId = remoteId;
    await this.createConnection();

    if (this.isInitiator) {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      this.signaling.send(remoteId, { type: 'offer', sdp: offer });
    }
  }

  async handleSignal(msg) {
    if (!this.pc) await this.createConnection();

    if (msg.type === 'offer') {
      this.remoteId = msg.from;
      await this.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      this.signaling.send(msg.from, { type: 'answer', sdp: answer });
    } else if (msg.type === 'answer') {
      await this.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
    } else if (msg.type === 'ice' && msg.candidate) {
      await this.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
    }
  }

  send(data) {
    if (this.connected && this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(data));
    }
  }

  sendRaw(str) {
    if (this.connected && this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(str);
    }
  }

  ping() {
    this.lastPingTime = Date.now();
    this.send({ type: 'ping', t: this.lastPingTime });
  }

  close() {
    this.connected = false;
    if (this.dataChannel) this.dataChannel.close();
    if (this.pc) this.pc.close();
    this.signaling.close();
  }
}

// ===================== 发送端 =====================

class Sender {
  constructor() {
    this.id = generateId();
    this.localIp = null;
    this.faceLandmarker = null;
    this.webcam = document.getElementById('webcam');
    this.canvas = document.getElementById('output_canvas');
    this.ctx = this.canvas.getContext('2d');
    this.avatar = new DebugAvatar('avatar_canvas');

    this.running = false;
    this.mirrorData = false;
    this.privacyMode = false;
    this.lastVideoTime = -1;
    this.fps = 0;
    this.lastFpsTime = 0;
    this.frameCount = 0;

    this.connections = new Map(); // remoteId -> P2PConnection
    this.sendRate = 0;
    this.sendCount = 0;
    this.lastRateTime = 0;

    this.initUI();
    this.initNetwork();
    this.loadModel();
  }

  initUI() {
    document.getElementById('senderId').textContent = this.id;

    document.getElementById('copySenderId').addEventListener('click', () => {
      navigator.clipboard.writeText(this.id).then(() => {
        const btn = document.getElementById('copySenderId');
        btn.textContent = '已复制';
        setTimeout(() => btn.textContent = '复制', 1500);
      });
    });

    document.getElementById('backFromSender').addEventListener('click', () => {
      this.stop();
      showModeSelect();
    });

    document.getElementById('startBtn').addEventListener('click', () => this.start());
    document.getElementById('stopBtn').addEventListener('click', () => this.stop());

    document.getElementById('mirrorMode').addEventListener('change', (e) => {
      this.mirrorData = e.target.checked;
    });

    document.getElementById('privacyMode').addEventListener('change', (e) => {
      this.privacyMode = e.target.checked;
      document.querySelector('.video-wrapper').classList.toggle('privacy-active', this.privacyMode);
    });
  }

  async initNetwork() {
    this.localIp = await getLocalIp();

    // 广播存在（用于局域网发现）
    this.beacon = new SignalingChannel(this.id);
    this.beaconInterval = setInterval(() => {
      this.beacon.broadcast({
        type: 'beacon',
        id: this.id,
        ip: this.localIp,
        role: 'sender',
      });
    }, 2000);

    // 监听连接请求
    this.beacon.onmessage = (msg) => {
      if (msg.type === 'connect_request') {
        this.acceptConnection(msg.from);
      }
    };
  }

  async acceptConnection(remoteId) {
    if (this.connections.has(remoteId)) return;

    const conn = new P2PConnection(this.id, true);
    conn.onopen = () => {
      this.updateConnectionStatus();
      document.getElementById('status').textContent = `设备 ${remoteId.substring(0, 8)} 已连接`;
    };
    conn.onclose = () => {
      this.connections.delete(remoteId);
      this.updateConnectionStatus();
    };
    await conn.connect(remoteId);
    this.connections.set(remoteId, conn);
    this.updateConnectionStatus();
  }

  updateConnectionStatus() {
    const count = this.connections.size;
    document.getElementById('connectedCount').textContent = count;
    const badge = document.getElementById('senderStatus');
    if (count > 0) {
      badge.textContent = `${count} 个设备已连接`;
      badge.className = 'status-badge connected';
    } else {
      badge.textContent = '等待连接';
      badge.className = 'status-badge';
    }
  }

  async loadModel() {
    document.getElementById('status').textContent = '正在加载 MediaPipe 模型...';
    try {
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
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('status').textContent = '模型加载完成，点击"启动摄像头"开始';
    } catch (err) {
      document.getElementById('status').textContent = '模型加载失败: ' + err.message;
    }
  }

  async start() {
    if (!this.faceLandmarker) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      this.webcam.srcObject = stream;
      await this.webcam.play();
      this.canvas.width = this.webcam.videoWidth;
      this.canvas.height = this.webcam.videoHeight;
      this.running = true;
      document.getElementById('startBtn').disabled = true;
      document.getElementById('stopBtn').disabled = false;
      document.getElementById('status').textContent = '面捕运行中，等待接收端连接...';
      this.predictWebcam();
    } catch (err) {
      document.getElementById('status').textContent = '摄像头启动失败: ' + err.message;
    }
  }

  stop() {
    this.running = false;
    const stream = this.webcam.srcObject;
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      this.webcam.srcObject = null;
    }
    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
    document.getElementById('status').textContent = '已停止';
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
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

        const params = this.extractParams(results, landmarks);
        this.updateAvatar(params);
        this.broadcastParams(params);
        this.updateUI(params);
      }
    }

    requestAnimationFrame(() => this.predictWebcam());
  }

  drawLandmarks(landmarks) {
    this.ctx.fillStyle = '#4ECDC4';
    for (const p of landmarks) {
      const x = p.x * this.canvas.width;
      const y = p.y * this.canvas.height;
      this.ctx.beginPath();
      this.ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  extractParams(results, landmarks) {
    const map = {};
    if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
      for (const cat of results.faceBlendshapes[0].categories) {
        map[cat.categoryName] = cat.score;
      }
    }

    let headYaw = 0.5, headPitch = 0.5, headRoll = 0.5;
    if (results.facialTransformationMatrixes && results.facialTransformationMatrixes.length > 0) {
      const m = results.facialTransformationMatrixes[0].data;
      const sy = Math.sqrt(m[0] * m[0] + m[4] * m[4]);
      if (sy > 0.001) {
        const yaw = Math.atan2(m[8], m[10]);
        const pitch = Math.atan2(-m[9], sy);
        const roll = Math.atan2(m[1], m[0]);
        headYaw = (yaw / Math.PI + 1) / 2;
        headPitch = (pitch / Math.PI + 1) / 2;
        headRoll = (roll / Math.PI + 1) / 2;
      }
    }

    let headX = 0.5, headY = 0.5;
    if (landmarks && landmarks.length > 0) {
      headX = landmarks[1].x;
      headY = landmarks[1].y;
    }

    const eyeLeftRaw = 1 - (map['eyeBlinkLeft'] || 0);
    const eyeRightRaw = 1 - (map['eyeBlinkRight'] || 0);
    const mouthOpenRaw = map['jawOpen'] || 0;
    const smileLeft = map['mouthSmileLeft'] || 0;
    const smileRight = map['mouthSmileRight'] || 0;
    const mouthSmileRaw = (smileLeft + smileRight) / 2;
    const browLeftRaw = map['browInnerUp'] || 0;
    const browRightRaw = map['browOuterUpLeft'] || 0;

    if (this.mirrorData) {
      return {
        eyeLeft: eyeRightRaw, eyeRight: eyeLeftRaw,
        mouthOpen: mouthOpenRaw, mouthSmile: mouthSmileRaw,
        browLeft: browRightRaw, browRight: browLeftRaw,
        headYaw: 1 - headYaw, headPitch, headRoll: 1 - headRoll,
        headX: 1 - headX, headY,
      };
    }

    return {
      eyeLeft: eyeLeftRaw, eyeRight: eyeRightRaw,
      mouthOpen: mouthOpenRaw, mouthSmile: mouthSmileRaw,
      browLeft: browLeftRaw, browRight: browRightRaw,
      headYaw, headPitch, headRoll,
      headX, headY,
    };
  }

  updateAvatar(params) {
    this.avatar.updateParams(params);
  }

  broadcastParams(params) {
    const data = { type: 'facedata', params, t: Date.now() };
    for (const conn of this.connections.values()) {
      conn.send(data);
    }
    this.sendCount++;
    const now = Date.now();
    if (now - this.lastRateTime >= 1000) {
      this.sendRate = this.sendCount;
      this.sendCount = 0;
      this.lastRateTime = now;
      document.getElementById('sendRate').textContent = this.sendRate;
      // 更新延迟显示（取第一个连接的延迟）
      const firstConn = this.connections.values().next().value;
      if (firstConn) {
        document.getElementById('latency').textContent = firstConn.latency || '-';
        firstConn.ping();
      }
    }
  }

  updateUI(params) {
    const ids = ['eyeLeft', 'eyeRight', 'mouthOpen', 'mouthSmile', 'browLeft', 'browRight', 'headYaw', 'headPitch', 'headRoll'];
    for (const id of ids) {
      const val = params[id] || 0;
      const fill = document.getElementById(id);
      const valEl = document.getElementById(id + 'Val');
      if (fill) fill.style.width = (Math.max(0, Math.min(1, val)) * 100) + '%';
      if (valEl) valEl.textContent = val.toFixed(2);
    }
  }

  destroy() {
    this.stop();
    if (this.beaconInterval) clearInterval(this.beaconInterval);
    if (this.beacon) this.beacon.close();
    for (const conn of this.connections.values()) conn.close();
    this.connections.clear();
  }
}

// ===================== 接收端 =====================

class Receiver {
  constructor() {
    this.id = generateId();
    this.avatar = new DebugAvatar('receiver_avatar_canvas');
    this.conn = null;
    this.recvRate = 0;
    this.recvCount = 0;
    this.lastRateTime = 0;
    this.lastParams = null;
    this.smoothed = {};
    this.smoothFactor = 0.3;

    this.initUI();
  }

  initUI() {
    document.getElementById('backFromReceiver').addEventListener('click', () => {
      this.disconnect();
      showModeSelect();
    });

    document.getElementById('connectBtn').addEventListener('click', () => this.connect());
    document.getElementById('scanBtn').addEventListener('click', () => this.scan());
    document.getElementById('disconnectBtn').addEventListener('click', () => this.disconnect());

    document.getElementById('targetId').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.connect();
    });
  }

  async scan() {
    const resultsEl = document.getElementById('scanResults');
    resultsEl.innerHTML = '<div style="color:var(--text-muted)">扫描中...</div>';

    const found = new Map();
    const scanner = new SignalingChannel(this.id);

    scanner.onmessage = (msg) => {
      if (msg.type === 'beacon' && msg.role === 'sender' && !found.has(msg.id)) {
        found.set(msg.id, msg);
        this.renderScanResults(found);
      }
    };

    // 等待 3 秒收集 beacon
    await new Promise(r => setTimeout(r, 3000));
    scanner.close();

    if (found.size === 0) {
      resultsEl.innerHTML = '<div style="color:var(--text-muted)">未找到局域网设备，请手动输入 ID 连接</div>';
    }
  }

  renderScanResults(found) {
    const resultsEl = document.getElementById('scanResults');
    resultsEl.innerHTML = '';
    for (const [id, info] of found) {
      const item = document.createElement('div');
      item.className = 'scan-result-item';
      item.innerHTML = `
        <div>
          <div class="device-id">${id}</div>
          <div class="device-ip">${info.ip || 'IP 未知'}</div>
        </div>
        <button class="btn-small">连接</button>
      `;
      item.querySelector('button').addEventListener('click', () => {
        document.getElementById('targetId').value = id;
        this.connect();
      });
      resultsEl.appendChild(item);
    }
  }

  async connect() {
    const targetId = document.getElementById('targetId').value.trim();
    const targetIp = document.getElementById('targetIp').value.trim();

    if (!targetId && !targetIp) {
      alert('请输入发送端 ID 或 IP 地址');
      return;
    }

    const remoteId = targetId || targetIp;

    document.getElementById('receiverStatus').textContent = '连接中...';
    document.getElementById('receiverStatus').className = 'status-badge connecting';

    this.conn = new P2PConnection(this.id, false);
    this.conn.onopen = () => {
      document.getElementById('receiverStatus').textContent = '已连接';
      document.getElementById('receiverStatus').className = 'status-badge connected';
      document.getElementById('sourceId').textContent = remoteId;
      document.getElementById('connectionSetup').classList.add('hidden');
      document.getElementById('receiverInfo').classList.remove('hidden');
    };
    this.conn.onclose = () => {
      document.getElementById('receiverStatus').textContent = '已断开';
      document.getElementById('receiverStatus').className = 'status-badge';
      this.resetDisplay();
    };
    this.conn.ondata = (data) => this.handleData(data);

    await this.conn.connect(remoteId);

    // 发送连接请求
    const req = new SignalingChannel(this.id);
    req.send(remoteId, { type: 'connect_request', from: this.id });
    setTimeout(() => req.close(), 1000);
  }

  handleData(data) {
    if (data.type !== 'facedata' || !data.params) return;

    const params = data.params;
    this.lastParams = params;

    // 平滑处理
    const smoothed = {};
    for (const [key, val] of Object.entries(params)) {
      const current = this.smoothed[key] || val;
      smoothed[key] = current + (val - current) * (1 - this.smoothFactor);
      this.smoothed[key] = smoothed[key];
    }

    this.avatar.updateParams(smoothed);
    this.updateUI(smoothed);

    this.recvCount++;
    const now = Date.now();
    if (now - this.lastRateTime >= 1000) {
      this.recvRate = this.recvCount;
      this.recvCount = 0;
      this.lastRateTime = now;
      document.getElementById('recvRate').textContent = this.recvRate;
    }
  }

  updateUI(params) {
    const ids = ['eyeLeft', 'eyeRight', 'mouthOpen', 'mouthSmile', 'headYaw', 'headPitch', 'headRoll'];
    for (const id of ids) {
      const val = params[id] || 0;
      const fill = document.getElementById('r_' + id);
      if (fill) fill.style.width = (Math.max(0, Math.min(1, val)) * 100) + '%';
    }
  }

  resetDisplay() {
    document.getElementById('connectionSetup').classList.remove('hidden');
    document.getElementById('receiverInfo').classList.add('hidden');
    this.avatar.updateParams({
      eyeLeft: 1, eyeRight: 1, mouthOpen: 0, mouthSmile: 0,
      browLeft: 0, browRight: 0, headYaw: 0.5, headPitch: 0.5, headRoll: 0.5,
      headX: 0.5, headY: 0.5,
    });
  }

  disconnect() {
    if (this.conn) {
      this.conn.close();
      this.conn = null;
    }
    this.resetDisplay();
  }

  destroy() {
    this.disconnect();
  }
}

// ===================== 页面路由 =====================

let currentSender = null;
let currentReceiver = null;

function showModeSelect() {
  document.getElementById('modeSelect').classList.remove('hidden');
  document.getElementById('senderPanel').classList.add('hidden');
  document.getElementById('receiverPanel').classList.add('hidden');

  if (currentSender) { currentSender.destroy(); currentSender = null; }
  if (currentReceiver) { currentReceiver.destroy(); currentReceiver = null; }
}

function showSender() {
  document.getElementById('modeSelect').classList.add('hidden');
  document.getElementById('senderPanel').classList.remove('hidden');
  currentSender = new Sender();
}

function showReceiver() {
  document.getElementById('modeSelect').classList.add('hidden');
  document.getElementById('receiverPanel').classList.remove('hidden');
  currentReceiver = new Receiver();
}

// 模式选择事件
document.querySelectorAll('.mode-card').forEach(card => {
  card.addEventListener('click', () => {
    const mode = card.dataset.mode;
    if (mode === 'sender') showSender();
    else showReceiver();
  });
});
