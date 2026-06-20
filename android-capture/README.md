# CheapLive Capture (Android)

> ⚠️ **本模块开发已暂停**（2026-06-20）
>
> Android APP 功能已移交参赛项目独立开发。主项目不再更新此目录。
> 比赛结束后酌情决定是否恢复开发。
>
> 以下为历史文档，仅供参考。

---

> 低成本浏览器端虚拟形象面捕项目的 Android 演示 APK。

## 当前状态

- **Phase 1.5 (当前)**：可安装演示原型完成
  - 内置离线 Avatar 演示（球形头像 / 纺锤鲸鱼）
  - 合成 face-frame 参数周期性驱动，无需摄像头或网络
  - Android 主页 + 演示页 + 开发者诊断面板
  - 单元测试通过；`assembleDebug` 成功生成 APK

- **Phase 2 (计划)**：真实摄像头面捕 & 局域网多端链路
  - 待真机验证后继续开发

## 构建

```bash
cd android-capture
./gradlew clean
./gradlew testDebugUnitTest
./gradlew assembleDebug
```

输出 APK 位于：
```
app/build/outputs/apk/debug/app-debug.apk
```

## 安装和运行

```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

启动后会进入 **CheapLive Capture 主页**：
1. 点击 **🎭 Avatar 离线演示 (球形 / 纺锤鲸鱼)** 进入核心演示
2. 其他入口当前为"开发中"占位，真实摄像头和多端链路尚未完成

## 离线演示

离线演示使用与主网页端相同的程序化模型参数接口：

| 字段 | 说明 |
|------|------|
| headYaw | 头部左右转动（-1..1）|
| headPitch | 头部上下转动 |
| headRoll | 头部倾斜 |
| eyeLeft / eyeRight | 眨眼 (0..1) |
| mouthOpen | 嘴巴张开幅度 (0..1) |
| mouthSmile | 笑容 (0..1) |
| browLeft / browRight | 眉毛位置 |
| positionX / positionY | 模型偏移 |
| scale | 模型缩放 |
| tailPitch / tailYaw / tailWave | 鲸鱼尾巴摆动 |

参数由 Android 侧的 `DemoAvatarBridge` 每 80ms 合成一次，通过 JavaScript 接口注入到 WebView 中。

## 多端会话（开发中）

当前保留多端会话骨架 (`LocalServer`, `CaptureBridge`)，用于后续局域网面捕参数托管。真实设备联调尚未进行，不建议作为主要功能介绍。

## 单元测试

```bash
./gradlew testDebugUnitTest
```

测试覆盖：
- FaceFrameValidator：参数范围校验
- DemoAvatarBridge：状态回调、暂停/恢复、JS 接口可调用
- CaptureBridge：有效 face-frame 通过；NaN 和超尺寸消息拒绝
- LocalServer：启动、停止、端口号；会话 token 等基本行为
- PrivateIpPicker：WLAN IP 选择逻辑
- SessionManager：会话创建和 idempotent

## 文件结构

```
android-capture/
├── build.gradle.kts
├── gradle.properties
├── settings.gradle.kts
├── app/
│   ├── build.gradle.kts
│   └── src/
│       ├── main/
│       │   ├── AndroidManifest.xml
│       │   ├── java/com/cheaplive/capture/
│       │   │   ├── HomeActivity.kt
│       │   │   ├── AvatarDemoActivity.kt
│       │   │   ├── DemoAvatarBridge.kt
│       │   │   ├── MainActivity.kt (面捕 / 多端会话: 开发中)
│       │   │   ├── CaptureBridge.kt
│       │   │   ├── CaptureBroadcast.kt
│       │   │   ├── LocalServer.kt
│       │   │   ├── SessionManager.kt
│       │   │   ├── Session.kt
│       │   │   ├── FaceFrame.kt
│       │   │   ├── FaceFrameValidator.kt
│       │   │   └── PrivateIpPicker.kt
│       │   └── assets/web/demo/demo.html (程序化 Avatar 演示)
│       └── test/java/com/cheaplive/capture/ (JUnit 单元测试)
└── README.md (本文件)
```

## 注意

- 摄像头权限 (`android.permission.CAMERA`) 仅为未来摄像头面捕预留；当前离线演示不使用。
- 相机硬件标记为 `required="false"`，即使没有相机设备也能安装。
- APK 不依赖外部网络服务；纯离线运行。
