package com.cheaplive.capture

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    private var webView: WebView? = null
    private var server: LocalServer? = null
    private var session: Session? = null
    private var bridge: CaptureBridge? = null

    private lateinit var tvStatus: TextView
    private lateinit var tvInfo: TextView
    private lateinit var btnStart: Button
    private lateinit var btnStop: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val container = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
        }
        tvStatus = TextView(this).apply { text = "尚未开始" }
        tvInfo = TextView(this).apply { text = "点击开始多端会话"; setPadding(16, 8, 16, 8); textSize = 14f }
        btnStart = Button(this).apply { text = "开始多端会话" }
        btnStop = Button(this).apply { text = "停止会话" }
        val lp = android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        )
        container.addView(tvStatus, lp)
        container.addView(tvInfo, lp)
        container.addView(btnStart, lp)
        container.addView(btnStop, lp)
        webView = WebView(this).apply {
            layoutParams = android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                0
            ).apply { weight = 1f }
        }
        container.addView(webView)
        setContentView(container)

        setupWebView()
        btnStart.setOnClickListener { startSession() }
        btnStop.setOnClickListener { stopSession() }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.CAMERA), REQ_CAMERA)
        } else {
            showCapturePage()
        }
    }

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
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url?.toString() ?: return true
                return !url.startsWith("file:///android_asset/")
            }
        }

        wv.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                val r = request ?: return
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    val wanted = r.resources
                    val allowed = wanted.filter {
                        it == PermissionRequest.RESOURCE_VIDEO_CAPTURE
                    }.toTypedArray()
                    if (allowed.isNotEmpty()) {
                        r.grant(allowed)
                    } else {
                        r.deny()
                    }
                }
            }
        }
    }

    private fun showCapturePage() {
        webView?.loadUrl("file:///android_asset/web/capture/index.html")
    }

    private fun startSession() {
        val ip = PrivateIpPicker.pick()
        if (ip == null) {
            tvStatus.text = "无法获取局域网 IP，请检查 Wi-Fi"
            return
        }
        val newSession = SessionManager.createSession(ip, PORT)
        val srv = LocalServer(this, newSession)
        val actualPort = try { srv.start() } catch (t: Throwable) {
            tvStatus.text = "服务器启动失败：${t.message}"
            return
        }
        session = newSession.copy(port = actualPort)
        server = srv
        val b = bridge ?: CaptureBridge(newSession, srv, { _, _ -> }).also { bridge = it }
        webView?.addJavascriptInterface(b, "CheapLiveBridge")
        val link = "http://${newSession.privateIp}:$actualPort/receiver/?token=${newSession.token}"
        tvStatus.text = "会话已启动：$link"
        tvInfo.text = "在另一设备浏览器打开该链接（同 Wi-Fi）"
    }

    private fun stopSession() {
        try { server?.stop() } catch (_: Throwable) {}
        server = null
        session = null
        tvStatus.text = "已停止会话"
        tvInfo.text = "点击开始重新启动"
    }

    override fun onRequestPermissionsResult(
        requestCode: Int, permissions: Array<out String>, grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQ_CAMERA) {
            if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
                showCapturePage()
            } else {
                tvStatus.text = "需要摄像头权限"
            }
        }
    }

    override fun onDestroy() {
        stopSession()
        try { webView?.destroy() } catch (_: Throwable) {}
        webView = null
        super.onDestroy()
    }

    companion object {
        private const val REQ_CAMERA = 1001
        private const val PORT = 8766
    }
}
