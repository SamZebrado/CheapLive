/**
 * CheapLive Multi-Device - WebRTC P2P Face Data Sync
 * 局域网多端互动：发送端面捕 -> 接收端渲染
 * 
 * 信令服务：HTTP + SSE (signaling-server.js)
 * 数据通道：WebRTC DataChannel (P2P)
 */

import { FaceLandmarker, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/+esm';
import { DebugAvatar } from '../face-tracking/debug-avatar.js';
import { SignalingClient } from './signaling-client.js';

// 将 SignalingClient 暴露到 window，供测试和调试使用
if (typeof window !== 'undefined') {
  window.SignalingClient = SignalingClient;
}

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

// 兼容移动端的复制到剪贴板
function copyToClipboard(text, btnId) {
  const btn = document.getElementById(btnId);
  if (!btn) return;

  // 方案1: navigator.clipboard（现代浏览器）
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showCopyResult(btn, true);
    }).catch(() => {
      // 降级到方案2
      const success = fallbackCopy(text);
      showCopyResult(btn, success);
    });
  } else {
    // 直接降级
    const success = fallbackCopy(text);
    showCopyResult(btn, success);
  }
}

function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
  document.body.appendChild(textarea);

  const selection = document.getSelection();
  const range = document.createRange();
  range.selectNodeContents(textarea);
  selection.removeAllRanges();
  selection.addRange(range);

  let success = false;
  try {
    success = document.execCommand('copy');
  } catch (err) {
    success = false;
  }

  selection.removeAllRanges();
  document.body.removeChild(textarea);
  return success;
}

function showCopyResult(btn, success) {
  if (success) {
    btn.textContent = '已复制';
  } else {
    btn.textContent = '复制失败';
    // 显示手动复制提示
    showManualCopyHint(btn);
  }
  setTimeout(() => {
    btn.textContent = '复制';
  }, 2000);
}

function showManualCopyHint(btn) {
  // 查找或创建提示元素
  let hint = btn.parentElement.querySelector('.copy-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.className = 'copy-hint';
    hint.style.cssText = 'margin-top:4px;font-size:12px;color:#ff6b4a;';
    btn.parentElement.appendChild(hint);
  }
  hint.textContent = '浏览器禁止自动复制，请长按下方地址手动复制';
  setTimeout(() => {
    if (hint) hint.textContent = '';
  }, 5000);
}

// ===================== WebRTC P2P 连接 =====================

class P2PConnection {
  constructor(localId, isInitiator = false) {
    this.localId = localId;
    this.isInitiator = isInitiator;
    this.pc = null;
    this.dataChannel = null;
    this.ondata = null;
    this.onopen = null;
    this.onclose = null;
    this.ontrack = null;
    this.connected = false;
    this.remoteId = null;
    this.latency = 0;
    this.lastPingTime = 0;
    this.pendingCandidates = [];
  }

  async init() {
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    this.pc.onicecandidate = (e) => {
      if (e.candidate && this.signalingClient) {
        this.signalingClient.sendSignal(this.remoteId, {
          type: 'ice',
          candidate: e.candidate,
        });
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

    this.pc.ontrack = (e) => {
      if (e.streams && e.streams[0] && this.ontrack) {
        this.ontrack(e.streams[0]);
      }
    };

    // 处理重新协商：当 addTrack/removeTrack 时触发
    this.pc.onnegotiationneeded = async () => {
      if (!this.isInitiator) return;
      try {
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        if (this.signalingClient && this.remoteId) {
          this.signalingClient.sendSignal(this.remoteId, {
            type: 'offer',
            offer,
          });
        }
      } catch (err) {
        console.warn('[P2P] Renegotiation failed:', err);
      }
    };

    if (this.isInitiator) {
      this.dataChannel = this.pc.createDataChannel('faceData', {
        ordered: false,
        maxRetransmits: 0,
      });
      this.setupDataChannel(this.dataChannel);
    } else {
      this.pc.ondatachannel = (e) => {
        this.dataChannel = e.channel;
        this.setupDataChannel(this.dataChannel);
      };
    }
  }

  setupDataChannel(channel) {
    channel.onopen = () => {
      this.connected = true;
      if (this.onopen) this.onopen();
    };
    channel.onclose = () => {
      this.connected = false;
      if (this.onclose) this.onclose();
    };
    channel.onmessage = (e) => {
      if (this.ondata) this.ondata(JSON.parse(e.data));
    };
  }

  async createOffer() {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  async createAnswer(offer) {
    await this.pc.setRemoteDescription(offer);
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  async setAnswer(answer) {
    await this.pc.setRemoteDescription(answer);
  }

  addIceCandidate(candidate) {
    if (this.pc.remoteDescription) {
      this.pc.addIceCandidate(candidate);
    } else {
      this.pendingCandidates.push(candidate);
    }
  }

  setRemoteDescriptionSet() {
    for (const c of this.pendingCandidates) {
      this.pc.addIceCandidate(c);
    }
    this.pendingCandidates = [];
  }

  send(data) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(data));
    }
  }

  close() {
    if (this.dataChannel) this.dataChannel.close();
    if (this.pc) this.pc.close();
    this.connected = false;
  }
}

// ===================== 发送端 =====================

class Sender {
  constructor() {
    this.id = generateId();
    this.faceLandmarker = null;
    this.webcam = document.getElementById('webcam');
    this.canvas = document.getElementById('output_canvas');
    this.ctx = this.canvas.getContext('2d');
    this.avatar = new DebugAvatar('avatar_canvas');
    this.localIp = null;
    this.running = false;
    this.mirrorData = false;
    this.privacyMode = false;
    this.lastVideoTime = -1;
    this.sendRate = 0;
    this.sendCount = 0;
    this.lastRateTime = 0;
    this.connections = new Map();
    this.audioSyncEnabled = false;
    this.localAudioStream = null;
    this.audioTrackSenders = new Map();
    this.signalingClient = null;
  }

  async init() {
    this.localIp = await getLocalIp();
    document.getElementById('senderId').textContent = this.id;
    document.getElementById('senderIp').textContent = this.localIp || 'unknown';

    this.initUI();
    // 信令注册优先，不阻塞在模型加载上
    this.initSignaling();
    // 模型加载可以异步进行
    this.loadModel().catch(err => {
      console.warn('[Sender] Model load failed:', err);
      document.getElementById('status').textContent = '模型加载失败: ' + err.message;
    });
  }

  initSignaling() {
    this.signalingClient = new SignalingClient(this.id);
    this.signalingClient.onDeviceList = (devices) => {
      // 发送端不需要显示设备列表，但可用于调试
      console.log('[Sender] Device list updated:', devices);
    };
    this.signalingClient.onSignal = (from, payload) => {
      this.handleSignal(from, payload);
    };
    this.signalingClient.onError = (type, msg) => {
      console.warn(`[Sender] Signaling error (${type}):`, msg);
      document.getElementById('status').textContent = `信令错误: ${msg}`;
    };

    // 注册到信令服务
    this.signalingClient.register('CheapLive Sender', this.localIp, 8765, 'sender');
  }

  async handleSignal(from, payload) {
    if (!this.connections.has(from)) {
      // 新的连接请求
      await this.acceptConnection(from);
    }

    const conn = this.connections.get(from);
    if (!conn) return;

    if (payload.type === 'connect_request') {
      // 收到连接请求，作为发起方创建 offer
      const offer = await conn.createOffer();
      this.signalingClient.sendSignal(from, {
        type: 'offer',
        offer,
      });
    } else if (payload.type === 'offer') {
      await conn.createAnswer(payload.offer);
      this.signalingClient.sendSignal(from, {
        type: 'answer',
        answer: conn.pc.localDescription,
      });
      conn.setRemoteDescriptionSet();
    } else if (payload.type === 'answer') {
      await conn.setAnswer(payload.answer);
      conn.setRemoteDescriptionSet();
    } else if (payload.type === 'ice') {
      conn.addIceCandidate(payload.candidate);
    }
  }

  async acceptConnection(remoteId) {
    if (this.connections.has(remoteId)) return;

    const conn = new P2PConnection(this.id, true);
    conn.remoteId = remoteId;
    conn.signalingClient = this.signalingClient;
    await conn.init();

    conn.onopen = () => {
      this.updateConnectionStatus();
      document.getElementById('status').textContent = `设备 ${remoteId.substring(0, 8)} 已连接`;
      if (this.audioSyncEnabled) {
        this.addAudioTrackToConnection(conn, remoteId);
      }
    };
    conn.onclose = () => {
      this.connections.delete(remoteId);
      this.audioTrackSenders.delete(remoteId);
      this.updateConnectionStatus();
    };

    // 创建 offer
    const offer = await conn.createOffer();
    this.signalingClient.sendSignal(remoteId, {
      type: 'offer',
      offer,
    });

    this.connections.set(remoteId, conn);
    this.updateConnectionStatus();
  }

  initUI() {
    document.getElementById('copySenderId').addEventListener('click', () => {
      copyToClipboard(this.id, 'copySenderId');
    });

    document.getElementById('copySenderIp').addEventListener('click', () => {
      if (!this.localIp) return;
      const url = `http://${this.localIp}:8765/src/multi-device/index.html`;
      copyToClipboard(url, 'copySenderIp');
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

    document.getElementById('audioSyncToggle').addEventListener('change', (e) => {
      this.audioSyncEnabled = e.target.checked;
      if (this.audioSyncEnabled && this.running) {
        this.startAudioSync();
      } else {
        this.stopAudioSync();
      }
    });
  }

  async startAudioSync() {
    if (this.localAudioStream) return;
    try {
      this.localAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const [remoteId, conn] of this.connections) {
        this.addAudioTrackToConnection(conn, remoteId);
      }
    } catch (err) {
      console.warn('麦克风获取失败:', err);
      document.getElementById('status').textContent = '麦克风获取失败: ' + err.message;
    }
  }

  stopAudioSync() {
    // 先移除所有 connection 中的 audio sender
    for (const [remoteId, sender] of this.audioTrackSenders) {
      try {
        const conn = this.connections.get(remoteId);
        if (conn && conn.pc) {
          conn.pc.removeTrack(sender);
        }
      } catch (e) {
        console.warn('[Audio] removeTrack failed:', e.message);
      }
    }
    this.audioTrackSenders.clear();

    // 停止本地麦克风流
    if (this.localAudioStream) {
      this.localAudioStream.getTracks().forEach(t => t.stop());
      this.localAudioStream = null;
    }
  }

  addAudioTrackToConnection(conn, remoteId) {
    if (!this.localAudioStream || !conn.pc) return;
    const audioTrack = this.localAudioStream.getAudioTracks()[0];
    if (!audioTrack) return;

    // 防止重复添加：如果已有 sender，尝试替换 track
    if (this.audioTrackSenders.has(remoteId)) {
      const sender = this.audioTrackSenders.get(remoteId);
      try {
        sender.replaceTrack(audioTrack);
      } catch (e) {
        // replaceTrack 不支持时，移除旧 sender 重新添加
        console.warn('[Audio] replaceTrack failed, re-adding:', e.message);
        conn.pc.removeTrack(sender);
        this.audioTrackSenders.delete(remoteId);
        const newSender = conn.pc.addTrack(audioTrack, this.localAudioStream);
        this.audioTrackSenders.set(remoteId, newSender);
      }
      return;
    }

    const sender = conn.pc.addTrack(audioTrack, this.localAudioStream);
    this.audioTrackSenders.set(remoteId, sender);
  }

  async loadModel() {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
    );
    this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      outputFaceBlendshapes: true,
      runningMode: 'VIDEO',
      numFaces: 1,
    });
    document.getElementById('loading').style.display = 'none';
  }

  async start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      this.webcam.srcObject = stream;
      await this.webcam.play();
      this.running = true;
      this.predictWebcam();
      document.getElementById('startBtn').disabled = true;
      document.getElementById('stopBtn').disabled = false;
      document.getElementById('status').textContent = '运行中';
    } catch (err) {
      document.getElementById('status').textContent = '摄像头启动失败: ' + err.message;
    }
  }

  stop() {
    this.running = false;
    const stream = this.webcam.srcObject;
    if (stream) stream.getTracks().forEach(t => t.stop());
    this.webcam.srcObject = null;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
    document.getElementById('status').textContent = '已停止';
  }

  predictWebcam() {
    if (!this.running) return;

    if (this.webcam.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.webcam.currentTime;
      const results = this.faceLandmarker.detectForVideo(this.webcam, performance.now());

      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        this.drawFace(results.faceLandmarks[0]);
        const params = this.extractParams(results);
        this.avatar.updateParams(params);
        this.broadcast(params);
      }
    }

    requestAnimationFrame(() => this.predictWebcam());
  }

  drawFace(landmarks) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(0, 255, 136, 0.15)';
    for (const p of landmarks) {
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  extractParams(results) {
    const bs = results.faceBlendshapes && results.faceBlendshapes.length > 0
      ? results.faceBlendshapes[0].categories
      : [];
    const getB = (name) => {
      const f = bs.find(b => b.categoryName === name);
      return f ? f.score : 0;
    };

    let eyeLeft = 1 - getB('eyeBlinkLeft');
    let eyeRight = 1 - getB('eyeBlinkRight');
    if (this.mirrorData) [eyeLeft, eyeRight] = [eyeRight, eyeLeft];

    let headYaw = 0.5 + getB('headYaw') * 0.5;
    if (this.mirrorData) headYaw = 1 - headYaw;

    return {
      eyeLeft: Math.max(0, Math.min(1, eyeLeft)),
      eyeRight: Math.max(0, Math.min(1, eyeRight)),
      mouthOpen: getB('jawOpen'),
      mouthSmile: (getB('mouthSmileLeft') + getB('mouthSmileRight')) / 2,
      browLeft: getB('browInnerUp'),
      browRight: getB('browInnerUp'),
      headYaw: Math.max(0, Math.min(1, headYaw)),
      headPitch: 0.5 + getB('headPitch') * 0.5,
      headRoll: 0.5 + getB('headRoll') * 0.5,
      headX: 0.5 + getB('headYaw') * 0.3,
      headY: 0.5 + getB('headPitch') * 0.3,
    };
  }

  broadcast(params) {
    this.sendCount++;
    const now = performance.now();
    if (now - this.lastRateTime > 1000) {
      this.sendRate = this.sendCount;
      this.sendCount = 0;
      this.lastRateTime = now;
      document.getElementById('sendRate').textContent = this.sendRate;
    }

    for (const [id, conn] of this.connections) {
      conn.send({ type: 'face', params, t: now });
    }
  }

  updateConnectionStatus() {
    const count = this.connections.size;
    document.getElementById('connectedCount').textContent = count;
    const status = document.getElementById('senderStatus');
    if (count > 0) {
      status.textContent = `${count} 个设备已连接`;
      status.className = 'status-badge connected';
    } else {
      status.textContent = '等待连接';
      status.className = 'status-badge';
    }
  }

  destroy() {
    this.stop();
    this.stopAudioSync();
    for (const [id, conn] of this.connections) {
      conn.close();
    }
    this.connections.clear();
    if (this.signalingClient) {
      this.signalingClient.unregister();
    }
  }
}

// ===================== 接收端 =====================

class Receiver {
  constructor() {
    this.id = generateId();
    this.avatar = new DebugAvatar('receiver_avatar_canvas');
    this.conn = null;
    this.signalingClient = null;
    this.recvRate = 0;
    this.recvCount = 0;
    this.lastRateTime = 0;
    this.lastParams = null;
    this.smoothed = {};
    this.smoothFactor = 0.3;
    this.remoteAudio = null;
    this.audioElement = null;
    this.discoveredDevices = [];
  }

  init() {
    this.initUI();
    this.initSignaling();
  }

  initSignaling() {
    this.signalingClient = new SignalingClient(this.id);
    this.signalingClient.onDeviceList = (devices) => {
      this.discoveredDevices = devices.filter(d => d.role === 'sender');
      this.updateDeviceList();
    };
    this.signalingClient.onSignal = (from, payload) => {
      this.handleSignal(from, payload);
    };
    this.signalingClient.onError = (type, msg) => {
      console.warn(`[Receiver] Signaling error (${type}):`, msg);
      document.getElementById('receiverStatus').textContent = '信令服务不可用';
    };

    // 注册为接收端
    this.signalingClient.register('CheapLive Receiver', null, null, 'receiver');
  }

  updateDeviceList() {
    const listEl = document.getElementById('scanResults');
    if (!listEl) return;

    if (this.discoveredDevices.length === 0) {
      listEl.innerHTML = '<div class="device-empty">未发现在线设备</div>';
      return;
    }

    listEl.innerHTML = this.discoveredDevices.map(d => `
      <div class="device-item" data-id="${d.id}">
        <span class="device-name">${d.name || '发送端'}</span>
        <span class="device-ip">${d.ip}:${d.port}</span>
        <button class="btn-connect" data-id="${d.id}">连接</button>
      </div>
    `).join('');

    listEl.querySelectorAll('.btn-connect').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.id;
        this.connectToSender(targetId);
      });
    });
  }

  async handleSignal(from, payload) {
    if (!this.conn || this.conn.remoteId !== from) return;

    if (payload.type === 'offer') {
      const answer = await this.conn.createAnswer(payload.offer);
      this.signalingClient.sendSignal(from, {
        type: 'answer',
        answer,
      });
      this.conn.setRemoteDescriptionSet();
    } else if (payload.type === 'answer') {
      await this.conn.setAnswer(payload.answer);
      this.conn.setRemoteDescriptionSet();
    } else if (payload.type === 'ice') {
      this.conn.addIceCandidate(payload.candidate);
    }
  }

  initUI() {
    document.getElementById('backFromReceiver').addEventListener('click', () => {
      this.disconnect();
      showModeSelect();
    });

    document.getElementById('connectBtn').addEventListener('click', () => {
      const targetId = document.getElementById('targetId').value.trim();
      const targetIp = document.getElementById('targetIp').value.trim();
      if (targetId) {
        this.connectToSender(targetId);
      } else if (targetIp) {
        // 通过 IP 直接连接（需要对方 ID）
        document.getElementById('receiverStatus').textContent = '请同时输入发送端 ID';
      }
    });

    document.getElementById('disconnectBtn').addEventListener('click', () => this.disconnect());

    document.getElementById('scanBtn').addEventListener('click', () => this.scanDevices());
  }

  async scanDevices() {
    const scanResults = document.getElementById('scanResults');
    if (scanResults) scanResults.textContent = '扫描中...';
    let fetchError = null;
    try {
      const devices = await this.signalingClient.fetchDeviceList();
      this.discoveredDevices = devices.filter(d => d.role === 'sender');
      this.updateDeviceList();
      if (scanResults && this.discoveredDevices.length === 0) {
        scanResults.innerHTML = '<div class="device-empty">未发现设备</div>';
      }
    } catch (err) {
      fetchError = err;
      if (scanResults) {
        scanResults.innerHTML = `<div class="device-empty">扫描失败: ${err.message}</div>`;
      }
    }
    // 如果 fetchDeviceList 返回空数组但发生了错误（通过 onError 回调），也显示错误
    if (!fetchError && scanResults && this.discoveredDevices.length === 0) {
      const statusText = scanResults.textContent;
      if (!statusText.includes('未发现')) {
        scanResults.innerHTML = '<div class="device-empty">未发现设备</div>';
      }
    }
  }

  async connectToSender(remoteId) {
    document.getElementById('receiverStatus').textContent = '连接中...';

    this.conn = new P2PConnection(this.id, false);
    this.conn.remoteId = remoteId;
    this.conn.signalingClient = this.signalingClient;
    await this.conn.init();

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
      this.stopRemoteAudio();
      this.resetDisplay();
    };
    this.conn.ondata = (data) => this.handleData(data);
    this.conn.ontrack = (stream) => this.playRemoteAudio(stream);

    // 发送连接请求（让对方创建 offer）
    this.signalingClient.sendSignal(remoteId, {
      type: 'connect_request',
      from: this.id,
    });
  }

  playRemoteAudio(stream) {
    this.stopRemoteAudio();
    this.audioElement = document.createElement('audio');
    this.audioElement.srcObject = stream;
    this.audioElement.autoplay = true;
    this.audioElement.volume = 0.8;

    // 移动浏览器自动播放限制处理
    this.audioElement.play().catch(() => {
      // 显示点击播放按钮
      this.showAudioPlayButton();
    });

    document.body.appendChild(this.audioElement);
  }

  showAudioPlayButton() {
    let btn = document.getElementById('audioPlayBtn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'audioPlayBtn';
      btn.className = 'btn-primary';
      btn.textContent = '🔊 点击播放声音';
      btn.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:1000;';
      btn.addEventListener('click', () => {
        if (this.audioElement) {
          this.audioElement.play();
          btn.remove();
        }
      });
      document.body.appendChild(btn);
    }
  }

  stopRemoteAudio() {
    const btn = document.getElementById('audioPlayBtn');
    if (btn) btn.remove();

    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.srcObject = null;
      this.audioElement.remove();
      this.audioElement = null;
    }
  }

  handleData(data) {
    if (data.type === 'face') {
      this.recvCount++;
      const now = performance.now();
      if (now - this.lastRateTime > 1000) {
        this.recvRate = this.recvCount;
        this.recvCount = 0;
        this.lastRateTime = now;
        document.getElementById('recvRate').textContent = this.recvRate;
      }

      const params = data.params;
      this.smoothed.mouthOpen = this.smoothed.mouthOpen || 0;
      this.smoothed.mouthSmile = this.smoothed.mouthSmile || 0;
      this.smoothed.mouthOpen += (params.mouthOpen - this.smoothed.mouthOpen) * (1 - this.smoothFactor);
      this.smoothed.mouthSmile += (params.mouthSmile - this.smoothed.mouthSmile) * (1 - this.smoothFactor);

      this.avatar.updateParams({
        ...params,
        mouthOpen: this.smoothed.mouthOpen,
        mouthSmile: this.smoothed.mouthSmile,
      });
    }
  }

  resetDisplay() {
    this.avatar.updateParams({
      eyeLeft: 1, eyeRight: 1, mouthOpen: 0, mouthSmile: 0,
      browLeft: 0, browRight: 0,
      headYaw: 0.5, headPitch: 0.5, headRoll: 0.5,
      headX: 0.5, headY: 0.5,
    });
    document.getElementById('recvRate').textContent = '0';
  }

  disconnect() {
    this.stopRemoteAudio();
    if (this.conn) {
      this.conn.close();
      this.conn = null;
    }
    this.resetDisplay();
    document.getElementById('connectionSetup').classList.remove('hidden');
    document.getElementById('receiverInfo').classList.add('hidden');
    document.getElementById('receiverStatus').textContent = '等待连接';
    document.getElementById('receiverStatus').className = 'status-badge';
  }

  destroy() {
    this.disconnect();
    if (this.signalingClient) {
      this.signalingClient.unregister();
    }
  }
}

// ===================== 页面路由 =====================

let sender = null;
let receiver = null;

function showModeSelect() {
  document.getElementById('modeSelect').classList.remove('hidden');
  document.getElementById('senderPanel').classList.add('hidden');
  document.getElementById('receiverPanel').classList.add('hidden');
}

function showSender() {
  document.getElementById('modeSelect').classList.add('hidden');
  document.getElementById('senderPanel').classList.remove('hidden');
  sender = new Sender();
  window.sender = sender;
  sender.init();
}

function showReceiver() {
  document.getElementById('modeSelect').classList.add('hidden');
  document.getElementById('receiverPanel').classList.remove('hidden');
  receiver = new Receiver();
  window.receiver = receiver;
  receiver.init();
}

// 将核心函数和实例暴露到 window，供测试和外部调用
window.showSender = showSender;
window.showReceiver = showReceiver;

// 绑定模式卡片点击事件（适配 HTML 中的 .mode-card 结构）
// 使用 DOMContentLoaded 确保 DOM 已就绪
function bindModeCards() {
  document.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', () => {
      const mode = card.dataset.mode;
      if (mode === 'sender') showSender();
      else if (mode === 'receiver') showReceiver();
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindModeCards);
} else {
  bindModeCards();
}

// 页面关闭时清理
window.addEventListener('beforeunload', () => {
  if (sender) sender.destroy();
  if (receiver) receiver.destroy();
});
