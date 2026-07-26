/**
 * CheapLive Signaling Client - 局域网设备发现和信令客户端
 *
 * 连接到本地 HTTP 信令服务器 (signaling-server.js)
 * 使用 SSE 接收实时设备列表更新
 */

class SignalingClient {
  constructor(deviceId, serverUrl, options = {}) {
    if (serverUrl && typeof serverUrl === 'object') {
      options = serverUrl;
      serverUrl = options.serverUrl;
    }
    this.deviceId = deviceId;
    this.serverUrl = serverUrl || this.detectServerUrl();
    this.token = options.token || '';
    this.room = options.room || 'default';
    this.signalSequence = 0;
    this.eventSource = null;
    this.heartbeatTimer = null;
    this.onDeviceList = null;
    this.onSignal = null;
    this.onError = null;
    this.connected = false;
  }

  authHeaders(includeJson = false) {
    const headers = {};
    if (includeJson) headers['Content-Type'] = 'application/json';
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    return headers;
  }

  detectServerUrl() {
    // 优先读取测试配置（供 E2E 测试使用）
    if (typeof window !== 'undefined' && window.__TEST_SIGNAL_PORT) {
      return `http://localhost:${window.__TEST_SIGNAL_PORT}`;
    }
    // 默认使用当前页面的 host，端口 8766
    const host = window.location.hostname;
    return `http://${host}:8766`;
  }

  async register(name, ip, port, role) {
    try {
      const res = await fetch(`${this.serverUrl}/register`, {
        method: 'POST',
        headers: this.authHeaders(true),
        body: JSON.stringify({
          id: this.deviceId,
          name: name || 'CheapLive Device',
          ip: ip || 'unknown',
          port: port || 8765,
          role,
          room: this.room,
        }),
      });
      const data = await res.json();
      if (data.success) {
        this.startHeartbeat();
        this.connectSSE();
      }
      return data;
    } catch (err) {
      if (this.onError) this.onError('register', err.message);
      return { error: err.message };
    }
  }

  startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      fetch(`${this.serverUrl}/heartbeat/${encodeURIComponent(this.deviceId)}`, {
        method: 'POST',
        headers: this.authHeaders(),
      })
        .catch(err => {
          console.warn('[Heartbeat] Failed:', err.message);
          if (this.onError) this.onError('heartbeat', err.message);
        });
    }, 5000);
  }

  connectSSE() {
    if (this.eventSource) {
      this.eventSource.close();
    }

    try {
      const tokenQuery = this.token ? `?token=${encodeURIComponent(this.token)}` : '';
      this.eventSource = new EventSource(
        `${this.serverUrl}/events/${encodeURIComponent(this.deviceId)}${tokenQuery}`,
      );
      this.connected = true;

      this.eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'deviceList' && this.onDeviceList) {
            this.onDeviceList(data.devices);
          } else if (data.type === 'signal' && this.onSignal) {
            this.onSignal(data.from, data.payload);
          }
        } catch (err) {
          console.warn('[SSE] Parse error:', err);
        }
      };

      this.eventSource.onerror = (err) => {
        console.warn('[SSE] Connection error');
        this.connected = false;
        if (this.onError) this.onError('sse', 'Connection lost');
      };
    } catch (err) {
      console.warn('[SSE] Failed to connect:', err.message);
      this.connected = false;
      if (this.onError) this.onError('sse', err.message);
    }
  }

  async sendSignal(targetId, payload) {
    try {
      const res = await fetch(`${this.serverUrl}/signal/${targetId}`, {
        method: 'POST',
        headers: this.authHeaders(true),
        body: JSON.stringify({
          from: this.deviceId,
          sequence: ++this.signalSequence,
          payload,
        }),
      });
      return await res.json();
    } catch (err) {
      if (this.onError) this.onError('signal', err.message);
      return { error: err.message };
    }
  }

  async unregister() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.connected = false;

    try {
      await fetch(`${this.serverUrl}/unregister/${encodeURIComponent(this.deviceId)}`, {
        method: 'DELETE',
        headers: this.authHeaders(),
      });
    } catch (err) {
      console.warn('[Unregister] Failed:', err.message);
    }
  }

  async fetchDeviceList() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const roomQuery = `?room=${encodeURIComponent(this.room)}`;
      const res = await fetch(`${this.serverUrl}/devices${roomQuery}`, {
        signal: controller.signal,
        headers: this.authHeaders(),
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      return data.devices || [];
    } catch (err) {
      clearTimeout(timeoutId);
      if (this.onError) this.onError('fetch', err.message);
      throw err;
    }
  }
}

export { SignalingClient };
