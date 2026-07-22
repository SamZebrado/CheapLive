# CheapLive Android 测试环境与版本要求

> 本文档为只读审计结果。最后更新：2026-07-18。

---

## 1. 仓库与工作区

| 项目 | 值 |
|------|-----|
| 仓库根目录（沙箱） | `/sessions/.../workspace/CheapLive` |
| 仓库根目录（本地） | `~/Documents/PersonalCodingLocal/CheapLive` |
| Android 项目根目录 | `android-capture/`（相对于仓库根目录） |
| 当前分支 | `migration/android-source-from-verify` |
| 当前 HEAD | `b674ba8` |
| Remote (GitHub) | `https://github.com/SamZebrado/CheapLive.git` |
| Remote (Gitee) | `https://gitee.com/samzebrado/CheapLive.git` |

## 2. Android 项目真实路径

| 项目 | 路径 | 状态 |
|------|------|------|
| gradlew.bat | `android-capture/gradlew.bat` | CONFIRMED |
| settings.gradle.kts | `android-capture/settings.gradle.kts` | CONFIRMED |
| 根 build.gradle.kts | `android-capture/build.gradle.kts` | CONFIRMED |
| app build.gradle.kts | `android-capture/app/build.gradle.kts` | CONFIRMED |
| gradle-wrapper.properties | `android-capture/gradle/wrapper/gradle-wrapper.properties` | CONFIRMED |
| AndroidManifest.xml | `android-capture/app/src/main/AndroidManifest.xml` | CONFIRMED |
| app module | `android-capture/app/` | CONFIRMED |
| WebView assets | `android-capture/app/src/main/assets/web/` | CONFIRMED |
| 主 Activity | `HomeActivity.kt`（入口）+ `MainActivity.kt` + `ContestDemoActivity.kt` + `AvatarDemoActivity.kt` | CONFIRMED |
| applicationId | `com.cheaplive.capture` | CONFIRMED |

## 3. 版本配置

| 配置项 | 值 | 最低 Android 版本 | 来源文件 | 代码位置 | 状态 |
|--------|-----|------------------|----------|---------|------|
| minSdk | 27 | Android 8.1 (Oreo) | `android-capture/app/build.gradle.kts` | line 12 | CONFIRMED |
| targetSdk | 34 | Android 14 (Upside Down Cake) | `android-capture/app/build.gradle.kts` | line 13 | CONFIRMED |
| compileSdk | 34 | Android 14 | `android-capture/app/build.gradle.kts` | line 8 | CONFIRMED |
| AGP (Android Gradle Plugin) | 8.2.1 | — | `android-capture/build.gradle.kts` | line 3 | CONFIRMED |
| Gradle Wrapper | 8.4 | — | `android-capture/gradle/wrapper/gradle-wrapper.properties` | line 5 | CONFIRMED |
| JDK / Java | 17 | — | `android-capture/app/build.gradle.kts` | lines 32-34, 38 | CONFIRMED |
| Kotlin | 1.9.24 | — | `android-capture/build.gradle.kts` | line 4 | CONFIRMED |
| versionCode | 1 | — | `android-capture/app/build.gradle.kts` | line 15 | CONFIRMED |
| versionName | 0.1.0 | — | `android-capture/app/build.gradle.kts` | line 16 | CONFIRMED |

## 4. Debug 构建命令与 APK 路径

| 项目 | 值 | 状态 |
|------|-----|------|
| Windows Debug 构建命令 | `cd android-capture && gradlew.bat assembleDebug` | CONFIRMED |
| Debug APK 输出路径 | `android-capture/app/build/outputs/apk/debug/app-debug.apk` | CONFIRMED（AGP 8.x 标准路径） |
| 安装命令 | `adb install -r app/build/outputs/apk/debug/app-debug.apk` | CONFIRMED |

## 5. 推荐的唯一低配模拟器配置

基于 minSdk=27 (Android 8.1)，选择 API 34 模拟器以匹配 targetSdk=34。

| 参数 | 推荐值 | 依据 |
|------|--------|------|
| Device Profile | Pixel 6 | 标准 phone，720p+ |
| Android API | 34 (Android 14) | 匹配 targetSdk/compileSdk |
| System Image 类型 | Google APIs | 项目无 Play Store 依赖 |
| 架构 | x86_64 | Windows 模拟器首选，性能最好 |
| 分辨率 | 1080 x 2340 (440 dpi) | Pixel 6 默认，接近 720p 宽度 |
| CPU 核数 | 2 | 低配 Windows 保守选择 |
| 内存 (RAM) | 2048 MB | 低配保守；若 Windows 内存 >= 16GB 可用 3072 MB |
| VM Heap | 256 MB | 2 核默认 |
| Graphics | Automatic | 低配优先让系统决定；若卡顿改 Hardware - GLES 2.0 |
| Internal Storage | 2048 MB | 足够安装 App + WebView assets |
| SD Card | 512 MB | 可选 |
| 是否需要 Google Play | 否 | 项目不依赖 Play Services |
| 横竖屏测试 | 模拟器内旋转 + AVD 复制一份改 Portrait | 同一 API 可建两个 AVD，但优先只维护一个 |

**备选降级方案（若 API 34 模拟器卡顿）：**
- API 30 (Android 11) x86_64，其余参数不变
- 或降低分辨率为 720 x 1280

## 6. 检查命令与信息来源

| 检查项 | 命令 / 来源 | 状态 |
|--------|-----------|------|
| minSdk / targetSdk | 读取 `android-capture/app/build.gradle.kts` | CONFIRMED |
| AGP 版本 | 读取 `android-capture/build.gradle.kts` | CONFIRMED |
| Gradle 版本 | 读取 `gradle-wrapper.properties` | CONFIRMED |
| JDK 版本 | 读取 `app/build.gradle.kts` compileOptions | CONFIRMED |
| Kotlin 版本 | 读取根 `build.gradle.kts` plugins | CONFIRMED |
| applicationId | 读取 `app/build.gradle.kts` defaultConfig | CONFIRMED |
| Windows 硬件 | 用户本地 PowerShell 执行（见下方命令） | UNKNOWN（需本地执行） |
| Android Studio 版本 | 用户本地检查 | UNKNOWN（需本地执行） |
| ADB 版本 | 用户本地 `adb version` | UNKNOWN（需本地执行） |
| 已安装 SDK Platform | 用户本地 `sdkmanager --list` | UNKNOWN（需本地执行） |
| 已安装 System Image | 用户本地 `sdkmanager --list` | UNKNOWN（需本地执行） |
| 已存在 AVD | 用户本地 `emulator -list-avds` | UNKNOWN（需本地执行） |
| CPU 虚拟化 | 用户本地 `systeminfo` | UNKNOWN（需本地执行） |

---

## 7. Windows 本地环境检查命令（需用户在 Windows PowerShell 中执行）

```powershell
# === 系统信息 ===
Write-Host "=== Windows Version ==="
[System.Environment]::OSVersion
(Get-CimInstance Win32_OperatingSystem).Caption
(Get-CimInstance Win32_OperatingSystem).Version

Write-Host "`n=== CPU ==="
Get-CimInstance Win32_Processor | Select-Object Name, NumberOfCores, NumberOfLogicalProcessors

Write-Host "`n=== Memory ==="
$os = Get-CimInstance Win32_OperatingSystem
[Math]::Round($os.TotalVisibleMemorySize / 1MB, 2)

Write-Host "`n=== Disk Free Space ==="
Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID, @{N='FreeGB';E={[Math]::Round($_.FreeSpace/1GB,2)}}, @{N='TotalGB';E={[Math]::Round($_.Size/1GB,2)}}

Write-Host "`n=== CPU Virtualization ==="
(Get-CimInstance Win32_Processor).VirtualizationFirmwareEnabled

# === Android Studio ===
Write-Host "`n=== Android Studio ==="
$asPath = "${env:LOCALAPPDATA}\Android\Studio\bin\studio64.exe"
if (Test-Path $asPath) { Write-Host "Installed: $asPath" } else { Write-Host "NOT FOUND at default path" }

# === ADB ===
Write-Host "`n=== ADB ==="
$adbPaths = @(
    "${env:LOCALAPPDATA}\Android\Sdk\platform-tools\adb.exe",
    "${env:USERPROFILE}\AppData\Local\Android\Sdk\platform-tools\adb.exe"
)
foreach ($p in $adbPaths) {
    if (Test-Path $p) {
        Write-Host "Found: $p"
        & $p version
    }
}

# === SDK Manager ===
Write-Host "`n=== Installed SDK Platforms ==="
$sdkManager = "${env:LOCALAPPDATA}\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat"
if (Test-Path $sdkManager) {
    & $sdkManager --list_installed 2>$null | Select-String "platforms;android"
} else { Write-Host "sdkmanager.bat NOT FOUND" }

Write-Host "`n=== Installed System Images ==="
if (Test-Path $sdkManager) {
    & $sdkManager --list_installed 2>$null | Select-String "system-images"
}

# === Emulator ===
Write-Host "`n=== Existing AVDs ==="
$emulator = "${env:LOCALAPPDATA}\Android\Sdk\emulator\emulator.exe"
if (Test-Path $emulator) {
    & $emulator -list-avds
} else { Write-Host "emulator.exe NOT FOUND" }

Write-Host "`n=== JAVA_HOME ==="
$env:JAVA_HOME
java -version 2>&1 | Select-Object -First 1
```

---

## 8. 日期与验证状态

| 项目 | 值 |
|------|-----|
| 审计日期 | 2026-07-18 |
| 执行环境 | TRAE 沙箱 (Linux VM) — 只读文件审计 |
| Windows 环境检查 | 待用户本地执行 |
| 验证状态 | 项目版本配置全部 CONFIRMED；Windows 硬件/Android Studio/SDK 状态 UNKNOWN |