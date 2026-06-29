package com.cheaplive.capture

import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

/**
 * Avatar 离线自检演示。
 *
 * 思路：
 * - 从 Android 侧通过 JavaScript Bridge 注入程序化的面部参数
 * - WebView 侧的 demo.html 读取这些参数并驱动球形/纺锤鲸鱼
 * - 不依赖任何网络资源，所有代码在 APK 内
 */
class AvatarDemoActivity : AppCompatActivity() {

    private var webView: WebView? = null
    private var demoBridge: DemoAvatarBridge? = null

    private lateinit var tvInfo: TextView
    private lateinit var btnSphere: Button
    private lateinit var btnWhale: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(16, 16, 16, 16)
        }

        tvInfo = TextView(this).apply {
            text = "Avatar 离线演示：合成参数驱动程序化模型"
            textSize = 14f
            setPadding(0, 0, 0, 8)
        }

        btnSphere = Button(this).apply { text = "球形头像" }
        btnWhale = Button(this).apply { text = "纺锤鲸鱼" }

        webView = WebView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0
            ).apply { weight = 1f }
        }

        root.addView(tvInfo, matchWrap())
        root.addView(btnSphere, matchWrap())
        root.addView(btnWhale, matchWrap())
        root.addView(webView, matchWeight1())
        setContentView(root)

        setupWebView()

        // 默认加载球形
        // Debug only: 允许通过 intent extra 指定 WebView 初始 URL，用于 fallback 测试
        val debugUrl = if (BuildConfig.DEBUG) {
            intent.getStringExtra("debug_webview_url")
        } else {
            null
        }
        if (!debugUrl.isNullOrEmpty()) {
            android.util.Log.i("CheapLiveWebView", "Debug WebView URL override: $debugUrl")
            // Debug 模式下：隐藏其他 UI，让 WebView 占满全屏，便于 fallback 验证
            tvInfo.visibility = View.GONE
            btnSphere.visibility = View.GONE
            btnWhale.visibility = View.GONE
            root.setPadding(0, 0, 0, 0)
            webView?.loadUrl(debugUrl)
        } else {
            loadAvatarDemo("sphere")
        }

        btnSphere.setOnClickListener { loadAvatarDemo("sphere") }
        btnWhale.setOnClickListener { loadAvatarDemo("whale") }
    }

    private fun matchWrap(): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        )

    private fun matchWeight1(): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            0
        ).apply { weight = 1f }

    private fun setupWebView() {
        val wv = webView ?: return
        val settings: WebSettings = wv.settings
        settings.javaScriptEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.domStorageEnabled = true
        settings.cacheMode = WebSettings.LOAD_NO_CACHE
        settings.setSupportMultipleWindows(false)

        wv.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val url = request.url?.toString() ?: return true
                // 始终允许 asset URL
                if (url.startsWith("file:///android_asset/")) {
                    return false
                }
                // Debug only: 允许 127.0.0.1 的 URL，用于 fallback 测试
                if (BuildConfig.DEBUG && url.startsWith("http://127.0.0.1")) {
                    return false
                }
                return true
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                super.onReceivedError(view, request, error)
                if (request.isForMainFrame) {
                    val failingUrl = request.url?.toString() ?: "unknown"
                    val errDesc = error.description?.toString() ?: "error code ${error.errorCode}"
                    android.util.Log.w("CheapLiveWebView", "AvatarDemo main frame error: $failingUrl - $errDesc")
                    loadBlackScreenFallback(view, "onReceivedError: $errDesc")
                }
            }

            override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, errorResponse: WebResourceResponse) {
                super.onReceivedHttpError(view, request, errorResponse)
                if (request.isForMainFrame) {
                    val failingUrl = request.url?.toString() ?: "unknown"
                    val statusCode = errorResponse.statusCode
                    android.util.Log.w("CheapLiveWebView", "AvatarDemo main frame HTTP error $statusCode: $failingUrl")
                    loadBlackScreenFallback(view, "onReceivedHttpError: HTTP $statusCode")
                }
            }

            private var isInFallback = false
            private fun loadBlackScreenFallback(view: WebView, reason: String) {
                if (isInFallback) return
                isInFallback = true
                android.util.Log.i("CheapLiveWebView", "AvatarDemo loading black-screen fallback, reason=$reason")
                view.post {
                    try {
                        view.loadUrl("file:///android_asset/web/black-screen/index.html")
                    } catch (t: Throwable) {
                        android.util.Log.e("CheapLiveWebView", "AvatarDemo failed to load fallback: ${t.message}")
                    }
                }
                view.postDelayed({ isInFallback = false }, 3000)
            }
        }

        wv.webChromeClient = object : WebChromeClient() {}

        val bridge = DemoAvatarBridge { newAvatar ->
            tvInfo.text = "当前演示：$newAvatar（合成参数周期性刷新）"
        }
        demoBridge = bridge
        bridge.attachWebView(wv)
        wv.addJavascriptInterface(bridge, "CheapLiveDemo")
    }

    private fun loadAvatarDemo(kind: String) {
        demoBridge?.setAvatar(kind)
        val safeKind = if (kind == "whale" || kind == "sphere") kind else "sphere"
        webView?.loadUrl("file:///android_asset/web/demo/demo.html?avatar=$safeKind")
    }

    override fun onPause() {
        demoBridge?.setPaused(true)
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        demoBridge?.setPaused(false)
    }

    override fun onDestroy() {
        demoBridge?.dispose()
        demoBridge = null
        try { webView?.destroy() } catch (_: Throwable) {}
        webView = null
        super.onDestroy()
    }

    companion object {
        // 占位保留，供后续扩展使用
    }
}
