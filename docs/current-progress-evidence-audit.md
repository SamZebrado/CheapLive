# CheapLive 项目进度审计报告

> 生成时间：2026-06-18
> 版本：v3 — 纠偏后版本
> 本轮工作：命名纠偏、测试复核、WebRTC connected 验证、音频 track 测试、Cubism SDK 框架、程序化模型动态展示

---

## 一、当前准确状态表

| 功能 | 状态 | 说明 |
|------|------|------|
| HTTP/SSE 注册式设备发现 | 自动化应用层测试通过，真实跨设备局域网待验证 | 多 BrowserContext 7/7 测试通过 |
| WebRTC 信令交换 | 自动测试通过 | connect_request → offer → answer → ICE 消息转发全部覆盖 |
| WebRTC PeerConnection connected | 浏览器自动化验证通过 | 7/8 测试通过，connectionState/iceConnectionState 断言 |
| WebRTC 音频 track 推流 | 自动测试通过 | 5/6 通过，fake media device 验证 sender/receiver track |
| 复制 | 自动测试通过，红米 K50 QQ 浏览器待实测 | 3 级降级，6/6 测试通过 |
| 变声 | 资源管理代码已修改，真实麦克风待验证 | 修复泄漏，14/16 通过（2 skip: fake media device） |
| 程序化 Canvas 2.5D 球体 | 代码和展示证据已生成，等待用户视觉验收 | 截图 + webm 动画 |
| 程序化 Canvas 2.5D 纺锤鲸鱼 | 代码和展示证据已生成，等待用户视觉验收 | 截图 + webm 动画 |
| Live2D Cubism 球体 | **未实现** | 无 .moc3 资产 |
| Live2D Cubism 纺锤鲸鱼 | **未实现** | 无 .moc3 资产 |
| Live2D Cubism SDK 运行时 | 框架代码已编写，受 SDK 文件和模型资产阻塞 | cubism-loader.js + cubism-runtime.js + face-to-cubism-mapper.js |
| 透明悬浮浏览器 | **未实现** | 仅需求文档 |

## 二、Live2D 状态（精确）

```
Live2D Cubism 球体：未实现
Live2D Cubism 纺锤体：未实现
Live2D Cubism SDK 实际模型渲染：未实现
Live2D Cubism SDK 代码框架：已编写（cubism-loader.js, cubism-runtime.js, face-to-cubism-mapper.js）
Live2D ZIP 上传：仅解析/占位，不等于模型渲染
Live2D 模型资产：项目中无 .moc3 或 .model3.json 文件
```

只有同时满足以下条件时，才能把模型归为 Live2D Cubism：
1. 页面实际加载 .model3.json
2. .model3.json 引用有效 .moc3
3. 纹理成功加载
4. Cubism SDK/Core 实际创建模型实例
5. 能读取模型参数 ID
6. 能读取 Drawable
7. 修改参数后 Drawable 顶点发生变化
8. 页面显示的球体或纺锤体确实来自该 Cubism 模型

当前 Agent 可以继续完成 Cubism Web 接入、参数映射和测试，但无法在当前纯代码环境中从零生成所需 Cubism 模型资源。

## 三、准确测试数字

**执行命令：**
```bash
npx playwright test tests/e2e/ --project=chromium --timeout=60000
```

**原始结果（来自 line reporter 输出）：**

| 文件 | 测试数 | 通过 | 失败 | 跳过 | 偶发 |
|------|--------|------|------|------|------|
| smoke.test.js | 21 | 21 | 0 | 0 | 0 |
| copy-clipboard.test.js | 6 | 6 | 0 | 0 | 0 |
| multi-device.test.js | 7 | 7 | 0 | 0 | 0 |
| voice-changer.test.js | 16 | 14 | 0 | 2 | 0 |
| mesh-visual.test.js | 2 | 2 | 0 | 0 | 0 |
| webrtc-connected.test.js | 8 | 7 | 0 | 0 | 1 |
| audio-track.test.js | 6 | 5 | 0 | 0 | 1 |
| procedural-demo.test.js | 2 | 2 | 0 | 0 | 0 |
| **总计** | **68** | **65** | **0** | **2** | **1** |

**Skip 测试：**
- voice-changer: "start with fake media stream" — fake media device 不可用
- voice-changer: "stop with fake media stream" — fake media device 不可用

**Flaky 测试：**
- audio-track: "receiver gets ontrack with audio kind" — 页面加载时序问题

## 四、WebRTC 测试详细

### A. 已验证的信令层
- 设备注册 (POST /register)
- SSE 设备列表推送
- 心跳 (POST /heartbeat/:id)
- TTL 过期清理
- connect_request 消息转发
- offer 消息转发
- answer 消息转发
- ICE candidate 消息转发

### B. 已验证的媒体连接层
- PeerConnection.connectionState === "connected" ✓
- PeerConnection.iceConnectionState === "connected"/"completed" ✓
- 单发送端 + 单接收端连接 ✓
- 单发送端 + 两个接收端连接 ✓
- 一个接收端断开不影响另一个 ✓
- 接收端刷新后重新连接 ✓
- 发送端重启后重新注册和连接 ✓
- 无重复连接 (5 次重连) ✓
- 5 次连接/断开无资源泄漏 ✓
- 页面关闭释放 PeerConnection（ICE 超时可能延迟）

### C. 已验证的音频 track 层
- 麦克风同步默认关闭 ✓
- 开启后 sender 有 audio track ✓
- receiver 收到 audio receiver ✓
- 连接后开启麦克风可重新协商 ✓
- 关闭同步后移除 track ✓
- 重连无重复 audio track ✓

## 五、WebRTC 未验证/待核实

- 真实跨设备连接（非同一机器 BrowserContext）
- 跨 NAT 穿透（需 STUN/TURN）
- WebRTC statistics 数据
- 音频质量（听感）
- 长时间连接稳定性
- 移动端 WebRTC 兼容性

## 六、局域网发现

当前方案：**HTTP/SSE 信令服务器上的设备注册与发现**

- 服务监听：0.0.0.0 (默认端口 8766)
- 启动命令：`node src/multi-device/signaling-server.js`
- 手机访问地址：`http://<SERVER_IP>:8765/src/multi-device/index.html`
- 信令服务器地址：`http://<SERVER_IP>:8766`
- 信令服务器地址通过 `window.__TEST_SIGNAL_PORT` 或 `detectServerUrl()` 自动检测
- 服务器重启后设备状态清空（内存存储）
- 两个 BrowserContext 使用独立服务端，不共享存储
- 信令服务器不可达时 scanDevices 显示"扫描失败"
- CORS 已启用（`Access-Control-Allow-Origin: *`）
- 服务器所在设备防火墙需要开放 8766 端口

**注意：这不是"扫描整个局域网"，而是"信令服务器注册式发现"。**

## 七、安全上下文审计

- 页面添加了 `window.isSecureContext` 和 `navigator.mediaDevices.getUserMedia` 诊断
- HTTP 局域网地址（如 `http://192.168.x.x:8765`）中：
  - `window.isSecureContext` 为 `false`（除 localhost 外）
  - `navigator.mediaDevices.getUserMedia` 可能不可用
  - **摄像头和麦克风在 HTTP 局域网地址中可能完全不可用**

**实际可执行方案：**
1. 局域网 HTTPS（需要合法证书或受信任本地证书）
2. Android WebView 容器（可能允许 HTTP local network）
3. 使用 localhost 访问（仅限服务器本机）
4. 浏览器启动参数（仅限开发环境）

## 八、CDN 和离线依赖

详见 `docs/runtime-external-dependencies.md`

| 依赖 | 加载失败影响 | 可本地打包 |
|------|-------------|-----------|
| MediaPipe FaceLandmarker | 面部捕捉完全不可用 | 是 |
| MediaPipe WASM | 模型初始化失败 | 是 |
| MediaPipe Model (.task) | 面部检测失败 | 是 |
| SoundTouchJS | 变声效果不可用 | 是 |
| JSZip | ZIP 上传不可用 | 是 |
| Google Fonts | 降级为系统字体 | 无关 |

## 九、Live2D 资产情况

**项目中没有 .moc3、.model3.json 或 .cmo3 文件。**

**情况 C：没有任何可用 Cubism 模型资源，且无法建模。**

已生成 `docs/live2d-sphere-spindle-asset-handoff.md` 作为美术交接文档。

## 十、Git 信息

```
commit b465019 feat: Live2D Cubism Web SDK infrastructure
commit a74cb0d feat: audio track tests + CDN audit + fake media device config
commit fc4e219 fix: rename live2d-mesh -> procedural-mesh
```

`git status --short`：无未提交文件

## 十一、工作区说明

1. 该目录是 Agent 在临时环境中创建的工作区
2. Agent 会话结束后 .git 和提交不保证保留
3. 用户需要自行备份或导出项目
4. 建议生成 ZIP 包或 patch 文件保存到持久存储