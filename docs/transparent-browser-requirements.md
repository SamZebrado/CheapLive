# 透明悬浮浏览器需求文档

## 项目背景
CheapLive 是一个纯网页端的虚拟形象直播工具。用户需要在使用其他App（如直播推流软件）的同时，让虚拟形象以透明悬浮窗的形式显示在屏幕上层。

## 核心需求

### 1. 透明背景悬浮窗
- 浏览器窗口背景完全透明（不是白色/黑色）
- 只显示虚拟形象（Canvas渲染的3D模型），不显示任何网页UI元素
- 窗口可拖动调整位置
- 窗口大小可调

### 2. 局域网本地服务器访问权限
- 手机A启动本地HTTP服务器（如 `python -m http.server 8765`）
- 悬浮浏览器需要能访问 `http://192.168.x.x:8765/...` 这样的局域网地址
- 不能有限制本地IP访问的安全策略

### 3. 摄像头/麦克风权限透传
- 网页通过 `getUserMedia()` 请求摄像头和麦克风
- 悬浮浏览器需要正确透传这些权限请求
- 用户只需授权一次，后续自动允许

### 4. WebRTC支持
- 网页使用WebRTC DataChannel进行P2P通信
- 悬浮浏览器需要完整支持WebRTC API
- STUN/TURN服务器连接正常

### 5. 持久化配置
- 记住用户设置的窗口位置、大小
- 记住授权的摄像头/麦克风权限
- 记住访问过的URL（可选）

## 技术方案建议

### Android方案
- 使用 `WebView` 组件，设置：
  ```java
  webView.setBackgroundColor(Color.TRANSPARENT);
  webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
  ```
- 使用 `SYSTEM_ALERT_WINDOW` 权限实现悬浮窗
- 自定义 `WebChromeClient` 处理权限请求

### iOS方案
- 使用 `WKWebView`，设置透明背景
- 使用 `UIView` 的 `layer` 设置透明
- 需要处理iOS的摄像头权限特殊限制

## 验收标准
1. 打开 `http://192.168.x.x:8765/src/face-tracking/index.html` 能正常加载
2. 点击"启动摄像头"能正常获取摄像头画面
3. 开启"应用模式"后，网页UI隐藏，只显示3D虚拟形象
4. 3D模型区域背景完全透明，能看到后面的App内容
5. 窗口可以拖动、缩放
6. 重启后保持窗口位置和大小

## 参考代码
本项目是一个纯静态HTML网站，文件位于：
- 主页面：`src/face-tracking/index.html`
- 多端互动：`src/multi-device/index.html`
- 启动本地服务器：`python3 -m http.server 8765`

## 联系方式
如有疑问，请联系项目开发者。
