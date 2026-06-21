# CheapLive 信令服务器 — 多设备协作扩展功能

> **状态**: 扩展玩法 / 待开发扩展
> **用途**: 局域网内多设备之间的面部动作捕捉数据同步和 WebRTC 音视频信令
> **适用场景**: 手机作为摄像头 + 电脑显示虚拟形象；多设备联合直播/会议等

---

## 1. 功能概述

CheapLive 的信令服务器是一个轻量级的 Node.js HTTP + SSE 服务，提供：

| 功能 | 描述 |
|------|------|
| **设备注册** | 设备上线时注册自身信息（ID/名称/IP/角色） |
| **设备发现** | 实时查询局域网内所有在线设备 |
| **心跳保活** | 设备定期上报心跳，超时自动从列表移除 |
| **SSE 实时推送** | 服务器主动推送设备列表更新和信令消息 |
| **WebRTC 信令** | 转发 offer/answer/ICE candidate 消息 |

---

## 2. 技术架构

```
┌────────────────────────────────────────────────────────────────────┐
│                      CheapLive Signaling Server                     │
│                 Node.js HTTP Server + Server-Sent Events           │
│                         监听: 0.0.0.0:8766                         │
└────────────────────────────────────┬────────────────────────────────┘
                                     │
                       ┌─────────────┴─────────────┐
                       │                           │
               ┌───────▼────────┐          ┌──────▼────────┐
               │   HTTP API    │          │   SSE Stream  │
               │  RESTful      │          │  /events/:id  │
               │  JSON Body    │          │  Keep-Alive   │
               └────────┬──────┘          └───────┬────────┘
                        │                          │
                ┌───────┴──────────────────────────┴────────┐
                │              Device Registry (Map)          │
                │  ┌─────────────────────────────────────┐   │
                │  │ deviceId -> { id, name, ip, port,   │   │
                │  │              role, lastHeartbeat,   │   │
                │  │              sseClient }             │   │
                │  └─────────────────────────────────────┘   │
                │                                             │
                │  ┌──────────────────────────────────────┐  │
                │  │ HEARTBEAT_INTERVAL: 5s (生产模式)    │  │
                │  │ DEVICE_TTL: 15s                      │  │
                │  │ 定时清理超期设备并广播新列表          │  │
                │  └──────────────────────────────────────┘  │
                └────────────────────────────────────────────┘
                                     │
                       ┌─────────────┴─────────────┐
                       │                           │
              ┌────────▼────────┐         ┌────────▼────────┐
              │   Device A      │         │   Device B      │
              │ (Camera/Capture)│◄───────►│ (Display/Receiver)│
              │   WebRTC Peer   │         │   WebRTC Peer   │
              └─────────────────┘         └─────────────────┘
```

---

## 3. 快速开始

### 3.1 环境要求

- **Node.js**: 18.0 或更高版本
- **操作系统**: macOS / Linux / Windows 均可
- **网络**: 同一局域网内的设备需能互相访问（端口 8766）

### 3.2 启动信令服务器

```bash
# 在项目根目录执行
cd CheapLive
node src/multi-device/signaling-server.js
```

预期输出：

```
CheapLive Signaling Server running on port 8766
Device TTL: 15000ms
Heartbeat interval: 5000ms
```

### 3.3 验证服务运行

在浏览器访问：<http://localhost:8766/devices>

应该返回 JSON 响应：

```json
{"devices":[]}
```

---

## 4. API 参考

### 4.1 设备注册

**POST** `/register`

请求体：

```json
{
  "id": "device-unique-id",
  "name": "My Phone",
  "ip": "192.168.1.100",
  "port": 8765,
  "role": "capture"
}
```

| 字段 | 必填 | 描述 |
|------|------|------|
| id | ✅ | 设备唯一标识符 |
| role | ✅ | 设备角色：`"capture"`（采集端）或 `"receiver"`（接收端） |
| name | ❌ | 设备显示名称，默认 "Unknown" |
| ip | ❌ | 设备 IP 地址，用于诊断 |
| port | ❌ | 设备 HTTP 端口，用于诊断 |

响应（200）：

```json
{"success": true, "ttl": 15000}
```

错误响应（400）：

```json
{"error": "Missing id or role"}
```

---

### 4.2 设备心跳

**POST** `/heartbeat/:deviceId`

定期上报设备在线状态。建议每 3-5 秒发送一次。

响应（200）：

```json
{"success": true}
```

错误响应（404）：

```json
{"error": "Device not found"}
```

---

### 4.3 查询设备列表

**GET** `/devices`

返回所有活跃设备（15秒内有心跳）。

响应（200）：

```json
{
  "devices": [
    {
      "id": "device-a",
      "name": "Phone Camera",
      "ip": "192.168.1.100",
      "port": 8765,
      "role": "capture"
    },
    {
      "id": "device-b",
      "name": "Desktop Display",
      "ip": "192.168.1.50",
      "port": 8765,
      "role": "receiver"
    }
  ]
}
```

---

### 4.4 设备下线

**DELETE** `/unregister/:deviceId`

显式标记设备下线。如果未调用，设备将在 15 秒超时后自动被移除。

响应（200）：

```json
{"success": true}
```

---

### 4.5 信令消息转发

**POST** `/signal/:targetId`

转发 WebRTC 信令消息（offer/answer/ICE candidates）到目标设备。

请求体：

```json
{
  "from": "sender-device-id",
  "payload": {
    "type": "offer",
    "sdp": "v=0\r\no=- 1234567890..."
  }
}
```

响应（200，目标在线且有 SSE 连接）：

```json
{"success": true, "delivered": true}
```

响应（200，目标离线或未建立 SSE 连接）：

```json
{"success": true, "delivered": false, "reason": "Target offline"}
```

---

### 4.6 SSE 事件流

**GET** `/events/:deviceId`

建立 Server-Sent Events 长连接，实时接收：

1. **设备列表更新** — 设备上线/下线时推送
2. **信令消息** — 其他设备发来的 WebRTC 信令

建立后立即发送当前设备列表：

```
data: {"type":"deviceList","devices":[...]}
```

后续事件示例：

```
data: {"type":"deviceList","devices":[...]}

data: {"type":"signal","from":"device-a","payload":{"type":"offer","sdp":"..."}}
```

> **注意**: SSE 连接需要保持长连接。浏览器端可用 `new EventSource('http://server:8766/events/' + deviceId)` 进行订阅。

---

### 4.7 CORS 预检

**OPTIONS** `/*`

服务器对所有路径返回 `204 No Content`，支持跨域请求。

响应头：

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type`

---

## 5. 客户端实现指南

### 5.1 浏览器端 JavaScript 示例

```javascript
// 1. 注册设备
async function registerDevice(id, name, role) {
  const res = await fetch('http://localhost:8766/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, name, role })
  });
  return res.json();
}

// 2. 启动心跳
function startHeartbeat(id) {
  setInterval(() => {
    fetch(`http://localhost:8766/heartbeat/${id}`, { method: 'POST' })
      .catch(e => console.error('Heartbeat failed:', e));
  }, 5000); // 每 5 秒一次
}

// 3. SSE 事件订阅
function subscribeEvents(id, onDeviceList, onSignal) {
  const es = new EventSource(`http://localhost:8766/events/${id}`);
  es.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'deviceList') {
      onDeviceList(data.devices);
    } else if (data.type === 'signal') {
      onSignal(data.from, data.payload);
    }
  };
  es.onerror = (err) => console.error('SSE Error:', err);
  return es;
}

// 4. 发送信令消息
async function sendSignal(targetId, from, payload) {
  const res = await fetch(`http://localhost:8766/signal/${targetId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, payload })
  });
  return res.json();
}
```

---

## 6. 生产部署建议

### 6.1 作为系统服务（Linux - systemd）

```ini
# /etc/systemd/system/cheaplive-signaling.service
[Unit]
Description=CheapLive Signaling Server
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/CheapLive
ExecStart=/usr/bin/node src/multi-device/signaling-server.js
Restart=on-failure
RestartSec=5
Environment=SIGNAL_PORT=8766

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable cheaplive-signaling
sudo systemctl start cheaplive-signaling
```

### 6.2 作为系统服务（macOS - launchd）

```xml
<!-- ~/Library/LaunchAgents/com.cheaplive.signaling.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.cheaplive.signaling</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/path/to/CheapLive/src/multi-device/signaling-server.js</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>
```

```bash
launchctl load ~/Library/LaunchAgents/com.cheaplive.signaling.plist
```

### 6.3 防火墙配置

确保局域网内设备能访问端口 8766：

```bash
# Linux (ufw)
sudo ufw allow 8766/tcp

# macOS
# 在"系统设置 > 网络 > 防火墙"中允许 Node.js 接受传入连接

# Windows
# 在"Windows Defender 防火墙 > 高级设置"中添加入站规则
```

---

## 7. 故障排查

### 7.1 设备无法互相发现

1. 确认信令服务器正在运行：`curl http://server-ip:8766/devices`
2. 检查防火墙是否阻止了端口 8766
3. 确认两台设备在同一局域网内，或者可以通过公网 IP 访问

### 7.2 设备在列表中消失

- 检查设备心跳是否正常发送（每 5 秒一次）
- 网络抖动可能导致心跳超时，设备会在 15 秒后被自动移除
- 重新注册即可恢复

### 7.3 SSE 连接频繁断开

- 检查客户端是否在事件流上正确处理重新连接（EventSource 自动重连）
- 某些代理服务器可能关闭长连接，考虑添加反向代理（Nginx/Apache）并配置长连接超时

### 7.4 CORS 问题

- 信令服务器默认允许所有来源（`Access-Control-Allow-Origin: *`）
- 如果部署在 HTTPS 域名下，前端页面也需要使用 HTTPS（混合内容限制）

---

## 8. 安全提示

⚠️ **此服务设计为局域网内使用，不要暴露到公网**

- 无认证机制：任何知道地址的设备都可注册和发送信令
- 无加密：HTTP 明文传输（WebRTC 自身的媒体流是加密的，但信令消息不是）
- 推荐在受信任的局域网内使用
- 如果需要公网部署，请添加：
  - Token 认证
  - HTTPS 证书
  - IP 白名单
  - 请求速率限制

---

## 9. 可定制参数

通过环境变量配置：

| 变量 | 默认值 | 描述 |
|------|--------|------|
| `SIGNAL_PORT` | 8766 | 服务监听端口 |
| `TEST_MODE` | (未设置) | 测试模式下使用较短的 TTL（8秒/1秒） |

---

## 10. 测试验证

项目内置单元测试，验证所有 API 端点：

```bash
# 运行信令服务器单元测试
node --test tests/unit/signaling-server.test.js
```

测试覆盖：
- 设备注册/心跳/查询/下线
- 信令消息转发（在线/离线场景）
- CORS 预检
- 未知路径返回 404
- 无效 JSON 请求处理
