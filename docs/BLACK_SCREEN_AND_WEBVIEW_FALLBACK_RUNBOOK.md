# Black Screen & WebView Fallback Runbook

本文档记录 CheapLive 黑屏页与 WebView 错误兜底的操作规范与验证流程。

适用范围：
- Android 真机测试后的屏幕保护
- WebView 加载失败时的错误兜底
- 黑屏页相关的截图与验证规范

---

## 1. Black Screen Fullscreen Screenshot Rule

> 黑屏页打开后默认不一定是 fullscreen。必须点击页面一次，触发 `requestFullscreen`，再截图和计算黑色像素比例。

### 1.1 为什么需要点击

CheapLive 黑屏页（`black-screen/index.html`）设计为：
- 页面初始加载时，浏览器地址栏、标签栏、系统状态栏仍然可见；
- 用户点击页面一次后，调用 `requestFullscreen()` 进入网页全屏；
- 全屏后主体内容区域为纯黑，无任何 UI 元素。

如果不点击直接截图，浏览器/系统 UI 会占用约 15-20% 屏幕面积，导致黑色像素比例偏低，不能作为"黑屏验证通过"的证据。

### 1.2 标准验证流程

```text
1. Open black screen page
2. Tap once to enter fullscreen
3. Wait 0.5–1s
4. Take screenshot
5. Compute black pixel ratio
6. Record whether screenshot includes browser/system UI
```

### 1.3 Android 真机命令示例

```bash
# 打开黑屏页（GitHub Pages 稳定版）
adb shell am start -a android.intent.action.VIEW \
  -d "https://samzebrado.github.io/CheapLive/src/black-screen/index.html" \
  com.android.chrome

# 等待页面加载
sleep 5

# 获取屏幕尺寸
W=$(adb shell wm size | grep -oE "[0-9]+x[0-9]+" | cut -d'x' -f1)
H=$(adb shell wm size | grep -oE "[0-9]+x[0-9]+" | cut -d'x' -f2)
CX=$((W / 2))
CY=$((H / 2))

# 点击屏幕中央，触发 fullscreen
adb shell input tap $CX $CY

# 等待全屏动画完成
sleep 1

# 截图
adb exec-out screencap -p > /tmp/black-screen-verify.png

# 计算黑色像素比例
python3 -c "
from PIL import Image
import numpy as np
img = Image.open('/tmp/black-screen-verify.png')
arr = np.array(img)
h, w = arr.shape[0], arr.shape[1]
pure_black = np.sum(np.all(arr[:,:,:3] == 0, axis=2))
ratio = pure_black / (h * w) * 100
print(f'黑色像素比例: {ratio:.2f}%')
print(f'是否含浏览器/系统 UI: 是（Chrome 地址栏 + 状态栏）')
print('结果: ' + ('PASS' if ratio >= 80 else 'FAIL'))
"
```

### 1.4 证据命名与标签规则

| 场景 | 截图命名示例 | 可宣称的状态 |
|------|-------------|-------------|
| 黑屏页已打开，但未点击 fullscreen | `black-screen-page-opened.png` | "page opened"，**不能**写 "fullscreen blackscreen verified" |
| 点击后进入 fullscreen 的黑屏 | `black-screen-fullscreen.png` | "fullscreen blackscreen verified" |
| WebView fallback 触发后的黑屏 | `webview-fallback-black-screen.png` | 内容必须真的显示黑屏；否则必须改名 |

### 1.5 黑色像素比例参考值

| 场景 | 预期黑色像素比例 | 说明 |
|------|-----------------|------|
| 纯黑图片（无任何 UI） | ~100% | 理想状态 |
| Chrome 全屏网页 + Android 状态栏 | ~80-90% | 状态栏约占 5%，地址栏可能隐藏 |
| Chrome 非全屏（地址栏 + 标签栏 + 状态栏） | ~65-75% | 系统 UI 占比较大 |
| WebView 全屏（无系统栏） | ~95%+ | 沉浸式模式下 |

**注意**：计算黑色像素比例时，必须注明截图是否包含浏览器/系统 UI。不能把含地址栏的截图和纯 WebView 截图混为一谈。

---

## 2. WebView Fallback 机制

### 2.1 设计目标

当 WebView 主 frame 加载失败时，自动跳转到内置黑屏页，防止白屏或系统默认错误页影响 demo 体验。

### 2.2 实现位置

- `MainActivity.kt` — `setupWebView()` 中的 `WebViewClient`
- `AvatarDemoActivity.kt` — `setupWebView()` 中的 `WebViewClient`

### 2.3 Fallback 触发条件

仅在以下条件同时满足时触发：
1. `request.isForMainFrame` 为 `true`（主 frame，非子资源）
2. `onReceivedError` 或 `onReceivedHttpError` 被调用
3. 不在 fallback 冷却期内（防止无限循环）

### 2.4 Fallback 目标 URL

```
file:///android_asset/web/black-screen/index.html
```

使用内置 asset 黑屏页，不依赖网络或本地服务器。

### 2.5 防循环机制

- `isInFallback` 标志位：fallback 期间忽略新的错误
- 3 秒冷却期：fallback 加载后 3 秒内不再触发新的 fallback
- 日志标签：`CheapLiveWebView`，方便排查

### 2.6 日志示例

```
W/CheapLiveWebView: Main frame error: http://127.0.0.1:8765/receiver/ - net::ERR_CONNECTION_REFUSED
I/CheapLiveWebView: Loading black-screen fallback, reason=onReceivedError: net::ERR_CONNECTION_REFUSED
```

---

## 3. 真机 Fallback 验证方法（待实现）

当前架构下 WebView 只加载 `file:///android_asset/` URL，因此难以安全触发主 frame 加载失败。

### 3.1 计划中的验证方案

**方案：Debug-only intent extra**

1. 在 `MainActivity` 或 `AvatarDemoActivity` 中添加调试支持：
   - 读取 intent extra `debug_url`
   - 如果存在且为 debug 构建，用该 URL 初始化 WebView
2. 通过 adb 启动并指定一个不存在的 URL：
   ```bash
   adb shell am start -n com.cheaplive.capture/.MainActivity \
     --es debug_url "http://127.0.0.1:9999/nonexistent"
   ```
3. 观察 WebView 是否触发 `onReceivedError` 并自动跳转到黑屏页
4. 点击进入 fullscreen
5. 截图并验证黑色像素比例 >= 95%（排除系统 UI 的话）

### 3.2 验证标准

- [ ] WebView 加载失败 URL
- [ ] `onReceivedError` 被调用（logcat 可验证）
- [ ] WebView 自动加载 `file:///android_asset/web/black-screen/index.html`
- [ ] 点击后进入 fullscreen
- [ ] 黑色像素比例 >= 95%（或 >= 80% 含系统 UI）
- [ ] logcat 无 FATAL EXCEPTION
- [ ] 无无限循环 fallback

---

## 4. 黑屏页资源位置

| 环境 | 路径 |
|------|------|
| GitHub Pages | `https://samzebrado.github.io/CheapLive/src/black-screen/index.html` |
| Android asset | `file:///android_asset/web/black-screen/index.html` |
| 本地源码 | `src/black-screen/index.html` |
| Android 源码 | `android-capture/app/src/main/assets/web/black-screen/index.html` |

---

## 5. 历史教训

- **2026-06-29**: Android WebView fallback smoke 测试中，`tablet-webview-fallback-black-screen.png` 实际是参赛控制界面截图，不是黑屏。证据命名必须与内容一致。
- **2026-06-29**: 多次忘记黑屏页需要点击才能进入 fullscreen，直接截图导致黑色像素比例偏低，不能作为 fullscreen 验证证据。
