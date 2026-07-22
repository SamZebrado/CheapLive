# CheapLive Capture Android App

基于 Android WebView 的面部捕捉客户端。通过局域网向直播端浏览器发送面捕参数。

---

## 功能特性

- 🔹 **本地 HTTP 服务器**：运行在端口 8765，提供 REST API 和 SSE 事件流
- 🔹 **Token 鉴权**：所有敏感端点需要有效的 session token
- 🔹 **面部捕捉**：基于 MediaPipe Face Landmarker，实时提取 478 个面部关键点
- 🔹 **虚拟形象渲染**：程序化 Avatar（球形头像、纺锤鲸鱼、3D 萨卡班甲鱼）
- 🔹 **后台服务**：支持后台运行，锁屏状态下仍可工作
- 🔹 **双端协同**：Capture 页面负责捕捉，Receiver 页面负责渲染

---

## 快速开始

### 环境要求

- JDK 17+（推荐使用 `openjdk@17`）
- Android SDK API 27+（Android 8.1）
- Gradle 8.4（项目自带 wrapper）

### 构建 APK

```bash
cd android-capture

# 检查 Java 版本
java -version

# 设置 JAVA_HOME（如需要）
export JAVA_HOME=/path/to/java17

# 构建 Debug APK
./gradlew assembleDebug

# 构建 Release APK（需要签名配置）
./gradlew assembleRelease
```

### 安装到设备

```bash
# 安装 Debug APK
adb install -r app/build/outputs/apk/debug/app-debug.apk

# 卸载（如需）
adb uninstall com.cheaplive.capture
```

### 启动应用

1. 打开 CheapLive Capture App
2. 点击 "开始捕捉" 按钮
3. 授权摄像头权限
4. 查看本地 IP 和端口（默认 8765）
5. 在另一台设备的浏览器中访问 Receiver 页面

---

## API 接口

### 基础信息

- 服务地址：`http://<设备IP>:8765`
- Token：每次启动自动生成，显示在 App 首页

### 端点列表

| 端点 | 方法 | 鉴权 | 说明 |
|------|------|------|------|
| `/health` | GET | 否 | 健康检查 |
| `/api/status` | GET | 是 | 获取服务状态 |
| `/api/control` | POST | 是 | 控制命令（重置连接等） |
| `/events` | GET | 是 | SSE 事件流（面捕参数） |
| `/capture/` | GET | 是 | Capture 页面 |
| `/receiver/` | GET | 是 | Receiver 页面 |

### 示例请求

```bash
# 健康检查
curl http://192.168.1.100:8765/health

# 获取状态（需要 token）
curl "http://192.168.1.100:8765/api/status?token=your-token-here"

# 订阅事件流
curl -N "http://192.168.1.100:8765/events?token=your-token-here"
```

---

## 项目结构

```
android-capture/
├── app/
│   ├── src/main/java/com/cheaplive/capture/
│   │   ├── MainActivity.kt          # 主活动，管理页面切换
│   │   ├── HomeActivity.kt          # 首页，显示状态和控制按钮
│   │   ├── LocalServer.kt           # 本地 HTTP 服务器
│   │   ├── SessionManager.kt        # Session 和 Token 管理
│   │   ├── AppState.kt              # 应用状态管理
│   │   └── CaptureBridge.kt         # 面捕数据桥接
│   ├── src/main/assets/web/
│   │   ├── capture/                 # Capture 页面（面捕）
│   │   ├── receiver/                # Receiver 页面（渲染）
│   │   └── contest-demo/            # 参赛 Demo 页面
│   └── src/main/AndroidManifest.xml # Android 配置
├── build.gradle.kts                 # 项目构建配置
├── settings.gradle.kts              # 模块配置
└── gradle/wrapper/                  # Gradle Wrapper
```

---

## 核心组件

### LocalServer

基于 NanoHTTPD 的轻量级 HTTP 服务器。负责：
- 处理 API 请求
- 管理 SSE 连接
- 提供静态资源服务

### SessionManager

管理 session 和 token：
- 生成随机 token
- 验证 token 有效性
- 重置连接身份

### CaptureBridge

桥接 WebView 和本地代码：
- 接收 WebView 发送的面捕数据
- 通过 SSE 推送给 Receiver

---

## 开发指南

### 运行单元测试

```bash
./gradlew testDebugUnitTest
```

### 查看日志

```bash
# 过滤 CheapLive 相关日志
adb logcat | grep CheapLive

# 保存日志到文件
adb logcat -d > logcat.txt
```

### 调试 WebView

在 Chrome 中访问：`chrome://inspect/#devices`

---

## 已知限制

- 后台运行时可能被系统省电策略限制
- 部分 Android 设备 WebView 对 MediaPipe 支持有限
- 摄像头权限需要用户手动授权

---

## 许可证

MIT License

---

> **注意**：本项目源码已于 2026-07-22 开源。详见根目录 [docs/POST_CONTEST_OPEN_SOURCE_DECISION.md](../docs/POST_CONTEST_OPEN_SOURCE_DECISION.md)。