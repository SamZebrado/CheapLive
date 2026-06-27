package com.cheaplive.capture

import android.os.Build
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
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
        loadAvatarDemo("sphere")

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
                return !url.startsWith("file:///android_asset/")
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
