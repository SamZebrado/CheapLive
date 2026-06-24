package com.cheaplive.capture

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.common.BitMatrix
import com.google.zxing.qrcode.QRCodeWriter

class MainActivity : AppCompatActivity() {

    private var webView: WebView? = null
    private var server: LocalServer? = null
    private var session: Session? = null
    private var bridge: CaptureBridge? = null
    private var qrImageView: ImageView? = null
    private var currentSessionUrl: String = ""
    private var isServerRunning: Boolean = false
    private var appState: AppState? = null

    private lateinit var tvStatus: TextView
    private lateinit var tvInfo: TextView
    private lateinit var btnStart: Button
    private lateinit var btnStop: Button
    private lateinit var tvStatePanel: TextView
    private lateinit var btnOpenControl: Button
    private lateinit var btnOpenDemo: Button

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

        // === 参赛控制面板入口 ===
        val sectionControl = TextView(this).apply {
            text = "参赛 Web 控制"
            textSize = 14f
            setPadding(16, 16, 16, 4)
        }
        container.addView(sectionControl, lp)

        btnOpenControl = Button(this).apply { text = "打开 Web 控制面板" }
        btnOpenControl.setOnClickListener {
            val s = session ?: return@setOnClickListener
            val url = "http://${s.privateIp}:${s.port}/control/"
            val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url))
            try {
                startActivity(intent)
            } catch (_: Throwable) {
                Toast.makeText(this@MainActivity, "没有浏览器可用", Toast.LENGTH_SHORT).show()
            }
        }
        container.addView(btnOpenControl, lp)

        btnOpenDemo = Button(this).apply { text = "打开 Receiver 演示页" }
        btnOpenDemo.setOnClickListener {
            val s = session ?: return@setOnClickListener
            val url = "http://${s.privateIp}:${s.port}/receiver/?token=${s.token}"
            val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url))
            try {
                startActivity(intent)
            } catch (_: Throwable) {
                Toast.makeText(this@MainActivity, "没有浏览器可用", Toast.LENGTH_SHORT).show()
            }
        }
        container.addView(btnOpenDemo, lp)

        // === 状态面板 ===
        val sectionState = TextView(this).apply {
            text = "App 状态面板"
            textSize = 14f
            setPadding(16, 16, 16, 4)
        }
        container.addView(sectionState, lp)

        tvStatePanel = TextView(this).apply {
            text = "服务器未启动"
            textSize = 11f
            setPadding(16, 8, 16, 8)
            setBackgroundColor(0x1A2A3654.toInt())
        }
        container.addView(tvStatePanel, lp)

        qrImageView = ImageView(this).apply {
            layoutParams = android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                600
            ).apply { topMargin = 16; bottomMargin = 16 }
            scaleType = ImageView.ScaleType.FIT_CENTER
            setBackgroundColor(Color.WHITE)
            visibility = android.view.View.GONE
        }
        container.addView(qrImageView)

        val btnCopy = Button(this).apply {
            text = "复制链接"
            layoutParams = android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = 8 }
        }
        btnCopy.setOnClickListener {
            if (currentSessionUrl.isNotEmpty()) {
                @Suppress("DEPRECATION")
                val clip = getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
                clip?.setPrimaryClip(ClipData.newPlainText("CheapLive Session URL", currentSessionUrl))
                Toast.makeText(this@MainActivity, "链接已复制到剪贴板", Toast.LENGTH_SHORT).show()
            }
        }
        container.addView(btnCopy)

        val btnResetQr = Button(this).apply {
            text = "刷新二维码/链接"
            layoutParams = android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = 8 }
        }
        btnResetQr.setOnClickListener { resetSession() }
        container.addView(btnResetQr)

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

        // 进入页面时提前生成 session/token/二维码，便于用户"还没开始就扫码"。
        // 注意：此时服务器尚未启动，仅 URL 已固定；点击"开始"后才启动服务器，并复用此 session。
        val initialIp = PrivateIpPicker.pick()
        if (initialIp != null && session == null) {
            val s = SessionManager.createSession(initialIp, PORT)
            session = s
            val previewLink = "http://${s.privateIp}:${s.port}/receiver/?token=${s.token}"
            currentSessionUrl = previewLink
            qrImageView?.apply {
                visibility = android.view.View.VISIBLE
                setImageBitmap(generateQRCode(previewLink, 600))
            }
            tvStatus.text = "会话已就绪（服务器未启动）"
            tvInfo.text = "链接与二维码已固定；点击「开始多端会话」启动服务器"
        }

        val needsCamera = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED
        val needsAudio = ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED
        if (needsCamera || needsAudio) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO), REQ_PERMISSIONS)
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
                        it == PermissionRequest.RESOURCE_VIDEO_CAPTURE ||
                        it == PermissionRequest.RESOURCE_AUDIO_CAPTURE
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
        // 关键语义：token 和二维码一旦生成就永不改变，除非用户显式点击"刷新二维码"。
        // 仅服务器进程可能因"停止"或错误而重启；重启时复用原有 token/sessionId/URL。
        if (isServerRunning) {
            tvStatus.text = "服务器已在运行中（链接与二维码不变）"
            return
        }
        val ip = PrivateIpPicker.pick()
        if (ip == null) {
            tvStatus.text = "无法获取局域网 IP，请检查 Wi-Fi"
            return
        }
        val existingSession = session
        val baseSession = existingSession ?: SessionManager.createSession(ip, PORT)
        val srv = LocalServer(this, baseSession)
        val actualPort = try { srv.start() } catch (t: Throwable) {
            tvStatus.text = "服务器启动失败：${t.message}"
            return
        }
        // 如果是新 session，复制为携带实际 port 的版本；如果复用，保持原 token/sessionId 不变，只更新 port/ip
        val finalSession = baseSession.copy(port = actualPort, privateIp = ip)
        session = finalSession
        server = srv
        appState = srv.getAppState()
        appState?.setField("serverRunning", true)
        appState?.setField("viewerConnected", true)
        isServerRunning = true

        // 监听状态变更，更新 UI 面板
        appState?.addListener { snap ->
            runOnUiThread { updateStatePanel(snap) }
        }

        val b = bridge ?: CaptureBridge(finalSession, srv, { _, _ -> }).also { bridge = it }
        webView?.addJavascriptInterface(b, "CheapLiveBridge")
        val link = "http://${finalSession.privateIp}:$actualPort/receiver/?token=${finalSession.token}"
        currentSessionUrl = link
        tvStatus.text = if (existingSession == null) "会话已启动" else "会话已重启（链接与二维码不变）"
        tvInfo.text = "扫描二维码或点击「复制链接」"
        qrImageView?.apply {
            visibility = android.view.View.VISIBLE
            setImageBitmap(generateQRCode(link, 600))
        }
    }

    private fun resetSession() {
        // 用户明确请求新二维码：先停止，再清除一切 session/token/URL 状态。
        // 下次点击"开始多端会话"时会生成全新的 token 和二维码。
        try { server?.stop() } catch (_: Throwable) {}
        server = null
        isServerRunning = false
        session = null
        bridge = null
        currentSessionUrl = ""
        qrImageView?.visibility = android.view.View.GONE
        tvStatus.text = "已重置会话"
        tvInfo.text = "点击「开始多端会话」使用新链接"
    }

    private fun stopSession() {
        // 仅停止服务器；保留 session/token/二维码，下一次 startSession 会复用。
        try { server?.stop() } catch (_: Throwable) {}
        appState?.setField("serverRunning", false)
        appState?.setField("viewerConnected", false)
        server = null
        isServerRunning = false
        tvStatus.text = "已停止服务器（链接与二维码保留）"
        tvInfo.text = "点击开始再次启动（复用同一链接）"
        tvStatePanel.text = "服务器已停止"
    }

    /** 更新状态面板 UI */
    private fun updateStatePanel(snap: AppStateSnapshot) {
        val sb = StringBuilder()
        sb.append("Server: ").append(if (snap.serverRunning) "Running" else "Stopped").append('\n')
        sb.append("URL: ").append(currentSessionUrl).append('\n')
        sb.append("Face Capture: ").append(if (snap.faceCaptureEnabled) "ON" else "OFF").append('\n')
        sb.append("Voice Changer: ").append(if (snap.voiceChangerEnabled) "ON" else "OFF")
            .append(" [").append(snap.voicePreset).append("]\n")
        sb.append("Capture Mode: ").append(snap.captureMode).append('\n')
        sb.append("Subtitle: ").append(if (snap.subtitleEnabled) "ON" else "OFF").append('\n')
        sb.append("Viewer: ").append(if (snap.viewerConnected) "Connected" else "Disconnected").append('\n')
        sb.append("Frames: ").append(snap.frameCount).append("  Latency: ").append(snap.latencyMs).append("ms\n")
        sb.append("Last Cmd: ").append(snap.lastCommand.ifEmpty { "--" }).append('\n')
        if (snap.lastError.isNotEmpty()) sb.append("Error: ").append(snap.lastError).append('\n')
        sb.append("Updated: ").append(java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.US).format(java.util.Date(snap.updatedAt)))
        tvStatePanel.text = sb.toString()
    }

    private fun generateQRCode(text: String, size: Int): Bitmap? {
        return try {
            val hints = mapOf(
                EncodeHintType.MARGIN to 2,
                EncodeHintType.CHARACTER_SET to "UTF-8"
            )
            val writer = QRCodeWriter()
            val bitMatrix: BitMatrix = writer.encode(text, BarcodeFormat.QR_CODE, size, size, hints)
            val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
            for (x in 0 until size) {
                for (y in 0 until size) {
                    bitmap.setPixel(x, y, if (bitMatrix[x, y]) Color.BLACK else Color.WHITE)
                }
            }
            bitmap
        } catch (_: Throwable) {
            null
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int, permissions: Array<out String>, grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQ_PERMISSIONS) {
            val cameraGranted = grantResults.getOrNull(0) == PackageManager.PERMISSION_GRANTED
            val audioGranted = grantResults.getOrNull(1) == PackageManager.PERMISSION_GRANTED
            if (cameraGranted) {
                showCapturePage()
                val audioStatus = if (audioGranted) "（麦克风已授权）" else "（麦克风未授权，变声功能受限）"
                tvStatus.text = "权限已获取$audioStatus"
            } else {
                tvStatus.text = "需要摄像头权限"
            }
        }
    }

    override fun onStop() {
        super.onStop()
        stopSession()
    }

    override fun onDestroy() {
        stopSession()
        try { webView?.destroy() } catch (_: Throwable) {}
        webView = null
        super.onDestroy()
    }

    companion object {
        private const val REQ_PERMISSIONS = 1001
        private const val PORT = 8766
    }
}
