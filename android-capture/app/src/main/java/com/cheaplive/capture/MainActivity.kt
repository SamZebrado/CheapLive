package com.cheaplive.capture

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.text.TextUtils
import android.view.Gravity
import android.view.View
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.HorizontalScrollView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter

/**
 * 参赛版主控制页 — 向 public demo 视觉和功能结构对齐。
 *
 * 产品化布局：
 * 1. 顶部产品区：CheapLive 标题 + 参赛 badge + 服务器状态
 * 2. Avatar 模块：6 种 avatar 选择 + 表情/动作控制
 * 3. 普通变声模块：开关 + 5 种 preset + 权限状态
 * 4. AI 变声模块：Experimental / Real App Only
 * 5. App-Web 控制模块：Local Server + Web 控制面板入口
 * 6. 状态面板：全字段实时显示
 *
 * 视觉风格：深色背景、卡片、圆角、状态 badge、高亮色 — 与 demo 一致。
 */
class MainActivity : AppCompatActivity() {

    // === Dev Flags (audio 开发线，默认关闭，不影响 demo) ===
    private val devAudioEnabled = false
    private val devFaceDebugEnabled = false // 默认关闭正式面捕调试

    private var isMinFaceTestMode = false
    private var isMinAudioTestMode = false

    private var webView: WebView? = null
    private var server: LocalServer? = null
    private var session: Session? = null
    private var bridge: CaptureBridge? = null
    private var qrImageView: ImageView? = null
    private var currentSessionUrl: String = ""
    private var isServerRunning: Boolean = false
    private var appState: AppState? = null
    private var configStore: FaceTrackingConfigStore? = null
    private var connectionStore: ConnectionIdentityStore? = null
    @Volatile private var lastPersistedConfigRevision: Long = -1L

    // === Design Tokens (对齐 demo) ===
    private val cBg = Color.parseColor("#0a0e1a")
    private val cBgCard = Color.parseColor("#1a2236")
    private val cBgCardHover = Color.parseColor("#1f2a42")
    private val cBgSecondary = Color.parseColor("#111827")
    private val cBorder = Color.parseColor("#2a3654")
    private val cBorderSoft = Color.parseColor("#1f2a42")
    private val cText = Color.parseColor("#e8edf5")
    private val cTextSec = Color.parseColor("#8896b3")
    private val cTextMuted = Color.parseColor("#5a6a85")
    private val cAccent = Color.parseColor("#4fc3f7")
    private val cAccent2 = Color.parseColor("#69db7c")
    private val cWarning = Color.parseColor("#ffd43b")
    private val cDanger = Color.parseColor("#ff6b6b")
    private val cPurple = Color.parseColor("#b197fc")
    private val cPink = Color.parseColor("#ff8cc8")
    private val radiusCard = 28f
    private val radiusSm = 20f
    private val radiusXs = 12f

    // === UI refs ===
    private lateinit var tvServerStatus: TextView
    private lateinit var tvServerBadge: TextView
    private lateinit var tvSessionInfo: TextView
    private lateinit var btnStart: Button
    private lateinit var btnStop: Button
    private lateinit var btnOpenControl: Button
    private lateinit var btnOpenDemo: Button
    private lateinit var tvStatePanel: TextView
    private lateinit var tvAvatarCurrent: TextView
    private lateinit var tvExprCurrent: TextView
    private lateinit var tvActionCurrent: TextView
    private lateinit var tvVoiceStatus: TextView
    private lateinit var tvAiVoiceStatus: TextView
    private lateinit var avatarButtons: MutableList<Button>
    private lateinit var exprButtons: MutableList<Button>
    private lateinit var actionButtons: MutableList<Button>
    private lateinit var presetButtons: MutableList<Button>

    // === Data ===
    private val avatars = listOf("sacabambaspis3d" to "🐟 3D 萨卡班甲鱼", "sacabambaspis" to "🐟 萨卡班甲鱼 (经典)", "cat" to "🐱 猫", "dog" to "🐶 狗", "rabbit" to "🐰 兔子", "fox" to "🦊 狐狸", "bear" to "🐻 小熊")
    private val expressions = listOf("blink" to "😉 眨眼", "mouth" to "😮 张嘴", "smile" to "😊 微笑", "wide" to "😲 惊讶")
    private val actions = listOf("nod" to "🙆 点头", "look" to "👀 左右看", "tail" to "🐾 摇尾巴", "bounce" to "⬆️ 弹跳")
    private val presets = listOf("original" to "原声", "cute" to "可爱", "robot" to "机器人", "deep" to "低沉", "radio" to "电台")
    private val poseModes = listOf("simulated" to "模拟姿态", "real-camera" to "真实摄像头")
    private val bodyPoses = listOf("idle" to "站立", "lean_left" to "左倾", "lean_right" to "右倾", "paw_left" to "左前爪", "paw_right" to "右前爪", "crouch" to "蹲伏", "jump" to "跳跃", "tail_wag" to "摆尾", "bounce" to "弹跳")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        isMinFaceTestMode = intent.getStringExtra("MODE") == "MIN_FACE_TEST"
        isMinAudioTestMode = intent.getStringExtra("MODE") == "MIN_AUDIO_TEST"

        val scroll = ScrollView(this).apply {
            setBackgroundColor(cBg)
            isFillViewport = true
        }
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, 0, 0, 48)
        }
        scroll.addView(root, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.MATCH_PARENT))

        if (isMinFaceTestMode) {
            buildMinFaceTopBar(root)
            buildMinFaceStatusCard(root)
            buildMinFaceQrSection(root)
        } else if (isMinAudioTestMode) {
            buildMinAudioTopBar(root)
            buildMinAudioStatusCard(root)
            buildMinAudioQrSection(root)
        } else {
            buildTopBar(root)
            buildServerCard(root)
            buildAvatarCard(root)
            buildFaceCaptureCard(root)
            buildPoseCaptureCard(root)
            buildVoiceCard(root)
            buildAiVoiceCard(root)
            buildControlCard(root)
            buildStateCard(root)
            buildQrSection(root)
        }

        webView = WebView(this).apply {
            val h = if (isMinFaceTestMode || isMinAudioTestMode) {
                (400 * resources.displayMetrics.density).toInt()
            } else {
                (320 * resources.displayMetrics.density).toInt()
            }
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, h).apply { weight = 0f }
            visibility = View.VISIBLE
        }
        root.addView(webView)

        setContentView(scroll)
        setupWebView()

        if (isMinFaceTestMode) {
            setupMinFaceMode()
        } else if (isMinAudioTestMode) {
            setupMinAudioMode()
        } else {
            btnStart.setOnClickListener { safeStartSession() }
            btnStop.setOnClickListener { safeStopSession() }

            // 进入页面时立即初始化 appState，避免 null 导致的崩溃
            if (appState == null) {
                appState = AppState()
            }
            // 加载持久化的面部追踪配置（在 ensureServerStarted 之前完成，保证 SSE 初始推送包含配置）
            if (configStore == null) {
                configStore = FaceTrackingConfigStore(this)
            }
            // 加载持久化的稳定连接身份（token/sessionId/port 不随重启变化）
            if (connectionStore == null) {
                connectionStore = ConnectionIdentityStore(this)
            }
            appState?.let { s ->
                if (s.faceTrackingConfig.revision == 0L) {
                    s.faceTrackingConfig = configStore!!.load()
                    lastPersistedConfigRevision = s.faceTrackingConfig.revision
                    android.util.Log.i("CheapLiveCapture", "Loaded faceTrackingConfig rev=${s.faceTrackingConfig.revision} from prefs")
                }
            }

            // 进入页面时提前生成 session/token/二维码
            // 使用持久化的稳定连接身份（token/sessionId/port），仅 IP 动态获取
            val initialIp = PrivateIpPicker.pick()
            if (initialIp != null && session == null) {
                val existingIdentity = connectionStore!!.load()
                val identity = existingIdentity ?: connectionStore!!.reset().also {
                    android.util.Log.i("CheapLiveCapture", "First run: created new connection identity (token/sessionId/port)")
                }
                if (existingIdentity != null) {
                    android.util.Log.i("CheapLiveCapture", "Restored connection identity from prefs (token/sessionId/port kept stable)")
                }
                val s = Session(
                    sessionId = identity.sessionId,
                    token = identity.token,
                    port = identity.port,
                    privateIp = initialIp,
                )
                session = s
                val previewLink = "http://${s.privateIp}:${s.port}/receiver/?token=${s.token}&v=${BuildConfig.VERSION_NAME}"
                currentSessionUrl = previewLink
                qrImageView?.apply {
                    visibility = View.VISIBLE
                    setImageBitmap(generateQRCode(previewLink, 600))
                }
                tvServerStatus.text = "会话已就绪（服务器未启动）"
                tvSessionInfo.text = "链接与二维码已固定；点击「开始多端会话」启动服务器"
            }

            // 仅检查权限状态并反映到 UI，不自动请求麦克风/摄像头权限。
            val hasAudio = ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
            val hasCamera = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
            appState?.setField("voicePermission", if (hasAudio) "granted" else "not_requested")
            appState?.setField("cameraPermission", if (hasCamera) "granted" else "not_requested")
            updateVoiceStatus()
            updateFaceCaptureStatus()
            refreshAllButtons()

            // 提前启动 LocalServer，供 WebView capture 页面通过 loopback 加载 MediaPipe 资源
            ensureServerStarted()
            showCapturePage()
        }
    }

    // ============================================================
    // Min Face Test 模式 UI
    // ============================================================
    private lateinit var tvMinFaceServerStatus: TextView
    private lateinit var tvMinFaceToken: TextView
    private lateinit var tvMinFaceReceiverUrl: TextView
    private lateinit var tvMinFaceStatus: TextView
    private lateinit var btnMinFaceStart: Button
    private lateinit var btnMinFaceStop: Button

    private fun buildMinFaceTopBar(root: LinearLayout) {
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#111827"))
            setPadding(48, 56, 48, 40)
        }
        val titleRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val logo = TextView(this).apply {
            text = "🧪"
            textSize = 24f
            gravity = Gravity.CENTER
            val lp = LinearLayout.LayoutParams(76, 76)
            lp.marginEnd = 24
            layoutParams = lp
        }
        titleRow.addView(logo)
        val titleCol = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val title = TextView(this).apply {
            text = "Min Face Transport Test"
            textSize = 20f
            setTypeface(null, Typeface.BOLD)
            setTextColor(cText)
        }
        titleCol.addView(title)
        val badge = TextView(this).apply {
            text = "Isolated Testing"
            textSize = 10f
            setTypeface(null, Typeface.BOLD)
            setTextColor(cWarning)
            setBackgroundColor(Color.argb(30, 255, 212, 59))
            setPadding(16, 6, 16, 6)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.topMargin = 6
            layoutParams = lp
        }
        titleCol.addView(badge)
        titleRow.addView(titleCol)
        bar.addView(titleRow)
        val subtitle = TextView(this).apply {
            text = "验证真实面部参数从 Android App 到电脑浏览器的传输链路"
            textSize = 12f
            setTextColor(cTextSec)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.topMargin = 16
            layoutParams = lp
        }
        bar.addView(subtitle)
        root.addView(bar)
    }

    private fun buildMinFaceStatusCard(root: LinearLayout) {
        val card = makeMinFaceCard()
        addMinFaceCardTitle(card, "📡 服务器状态", "Server")

        tvMinFaceServerStatus = TextView(this).apply {
            text = "服务器状态: 启动中..."
            textSize = 13f
            setTextColor(cTextSec)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = 8
            layoutParams = lp
        }
        card.addView(tvMinFaceServerStatus)

        tvMinFaceToken = TextView(this).apply {
            text = "token: -"
            textSize = 12f
            setTextColor(cTextMuted)
            setPadding(16, 12, 16, 12)
            setBackgroundColor(cBgSecondary)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = 8
            layoutParams = lp
        }
        card.addView(tvMinFaceToken)

        tvMinFaceReceiverUrl = TextView(this).apply {
            text = "receiver URL: -"
            textSize = 11f
            setTextColor(cTextMuted)
            setPadding(16, 12, 16, 12)
            setBackgroundColor(cBgSecondary)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = 16
            layoutParams = lp
        }
        card.addView(tvMinFaceReceiverUrl)

        // 控制按钮
        val btnRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = 16
            layoutParams = lp
        }
        btnMinFaceStart = Button(this).apply {
            text = "启动摄像头"
            textSize = 13f
            setTypeface(null, Typeface.BOLD)
            setTextColor(cBg)
            setBackgroundColor(cAccent2)
            val lp = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            lp.marginEnd = 8
            layoutParams = lp
            setPadding(0, 24, 0, 24)
            background = createRoundedDrawable(cAccent2, 12f)
        }
        btnMinFaceStart.setOnClickListener { startMinFaceCamera() }
        btnRow.addView(btnMinFaceStart)

        btnMinFaceStop = Button(this).apply {
            text = "停止"
            textSize = 13f
            setTypeface(null, Typeface.BOLD)
            setTextColor(cText)
            setBackgroundColor(cBgCard)
            val lp = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            lp.marginStart = 8
            layoutParams = lp
            setPadding(0, 24, 0, 24)
            background = createRoundedDrawable(cBgCard, 12f)
            isEnabled = false
            alpha = 0.5f
        }
        btnMinFaceStop.setOnClickListener { stopMinFaceCamera() }
        btnRow.addView(btnMinFaceStop)
        card.addView(btnRow)

        // 状态显示
        tvMinFaceStatus = TextView(this).apply {
            text = "等待启动..."
            textSize = 12f
            setTextColor(cTextMuted)
            setPadding(16, 12, 16, 12)
            setBackgroundColor(cBgSecondary)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            layoutParams = lp
        }
        card.addView(tvMinFaceStatus)

        root.addView(card)
    }

    private fun buildMinFaceQrSection(root: LinearLayout) {
        val card = makeMinFaceCard()
        addMinFaceCardTitle(card, "📱 Receiver 连接", "QR Code")

        val desc = TextView(this).apply {
            text = "手机扫码或电脑浏览器打开 LAN URL。Debug URL 需要 adb forward。"
            textSize = 12f
            setTextColor(cTextSec)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = 16
            layoutParams = lp
        }
        card.addView(desc)

        qrImageView = ImageView(this).apply {
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.gravity = Gravity.CENTER_HORIZONTAL
            lp.bottomMargin = 12
            layoutParams = lp
        }
        card.addView(qrImageView)

        root.addView(card)
    }

    private fun makeMinFaceCard(): LinearLayout {
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(cBgCard)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.setMargins(32, 12, 32, 12)
            layoutParams = lp
            setPadding(32, 28, 32, 28)
            background = createRoundedDrawable(cBgCard, 24f)
        }
    }

    private fun addMinFaceCardTitle(card: LinearLayout, title: String, badge: String) {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = 16
            layoutParams = lp
        }
        val tv = TextView(this).apply {
            this.text = title
            textSize = 14f
            setTypeface(null, Typeface.BOLD)
            setTextColor(cText)
        }
        row.addView(tv)
        val badgeView = TextView(this).apply {
            this.text = badge
            textSize = 9f
            setTypeface(null, Typeface.BOLD)
            setTextColor(cAccent)
            setBackgroundColor(Color.argb(30, 79, 195, 247))
            setPadding(10, 4, 10, 4)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.marginStart = 12
            layoutParams = lp
        }
        row.addView(badgeView)
        card.addView(row)
    }

    private fun setupMinFaceMode() {
        // 初始化 appState
        if (appState == null) {
            appState = AppState()
        }

        // 创建 session
        val initialIp = PrivateIpPicker.pick()
        if (initialIp != null && session == null) {
            val s = SessionManager.createSession(initialIp, PORT)
            session = s
            val receiverLink = "http://127.0.0.1:${s.port}/min-face-receiver?token=${s.token}"
            currentSessionUrl = receiverLink
            tvMinFaceToken.text = "token: ${s.token.take(12)}..."
            tvMinFaceReceiverUrl.text = "receiver URL: $receiverLink"
            qrImageView?.apply {
                visibility = View.VISIBLE
                setImageBitmap(generateQRCode(receiverLink, 500))
            }
        }

        // 启动服务器
        ensureServerStarted()

        session?.let { active ->
            val receiverLink = "http://127.0.0.1:${active.port}/min-face-receiver?token=${active.token}"
            currentSessionUrl = receiverLink
            tvMinFaceToken.text = "token: ${active.token.take(12)}..."
            tvMinFaceReceiverUrl.text = "receiver URL: $receiverLink"
            qrImageView?.setImageBitmap(generateQRCode(receiverLink, 500))
        }

        // 加载 min-face-send 页面
        showMinFaceSendPage()

        tvMinFaceServerStatus.text = "服务器状态: 运行中 ✓"
        tvMinFaceServerStatus.setTextColor(cAccent2)
        tvMinFaceStatus.text = "服务器就绪，点击「启动摄像头」开始面捕"
    }

    private fun showMinFaceSendPage() {
        val s = session
        val url = if (s != null && isServerRunning) {
            "http://127.0.0.1:${s.port}/min-face-send?token=${s.token}"
        } else {
            "file:///android_asset/web/min-face-send.html"
        }
        android.util.Log.i("CheapLiveCapture", "showMinFaceSendPage: loading local test route")
        webView?.loadUrl(url)
    }

    private fun startMinFaceCamera() {
        val hasCamera = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        if (!hasCamera) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.CAMERA), REQ_CAMERA)
            tvMinFaceStatus.text = "请求摄像头权限中..."
            return
        }
        webView?.evaluateJavascript(
            "(function() { if (window.MinFaceSend && window.MinFaceSend.startCamera) { window.MinFaceSend.startCamera(); return 'started'; } else { return 'api-not-ready'; } })()"
        ) { result ->
            android.util.Log.i("CheapLiveCapture", "startMinFaceCamera result: $result")
            btnMinFaceStart.isEnabled = false
            btnMinFaceStart.alpha = 0.5f
            btnMinFaceStop.isEnabled = true
            btnMinFaceStop.alpha = 1f
            tvMinFaceStatus.text = "摄像头启动中..."
        }
    }

    private fun stopMinFaceCamera() {
        webView?.evaluateJavascript(
            "(function() { if (window.MinFaceSend && window.MinFaceSend.stopCamera) { window.MinFaceSend.stopCamera(); return 'stopped'; } else { return 'api-not-ready'; } })()"
        ) { result ->
            android.util.Log.i("CheapLiveCapture", "stopMinFaceCamera result: $result")
            btnMinFaceStart.isEnabled = true
            btnMinFaceStart.alpha = 1f
            btnMinFaceStop.isEnabled = false
            btnMinFaceStop.alpha = 0.5f
            tvMinFaceStatus.text = "已停止"
        }
    }

    // ============================================================
    // Min Audio Test 模式 UI
    // ============================================================
    private lateinit var tvMinAudioServerStatus: TextView
    private lateinit var tvMinAudioToken: TextView
    private lateinit var tvMinAudioReceiverUrl: TextView
    private lateinit var tvMinAudioStatus: TextView
    private lateinit var btnMinAudioStart: Button
    private lateinit var btnMinAudioStop: Button

    private fun buildMinAudioTopBar(root: LinearLayout) {
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#111827"))
            setPadding(48, 56, 48, 40)
        }
        val titleRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val logo = TextView(this).apply {
            text = "🎙"
            textSize = 24f
            gravity = Gravity.CENTER
            val lp = LinearLayout.LayoutParams(76, 76)
            lp.marginEnd = 24
            layoutParams = lp
        }
        titleRow.addView(logo)
        val titleCol = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val title = TextView(this).apply {
            text = "Min Audio Transport Test"
            textSize = 20f
            setTypeface(null, Typeface.BOLD)
            setTextColor(cText)
        }
        titleCol.addView(title)
        val badge = TextView(this).apply {
            text = "Isolated Testing"
            textSize = 10f
            setTypeface(null, Typeface.BOLD)
            setTextColor(cWarning)
            setBackgroundColor(Color.argb(30, 255, 212, 59))
            setPadding(16, 6, 16, 6)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.topMargin = 6
            layoutParams = lp
        }
        titleCol.addView(badge)
        titleRow.addView(titleCol)
        bar.addView(titleRow)
        val subtitle = TextView(this).apply {
            text = "验证麦克风音量从 Android App 到电脑浏览器的传输链路"
            textSize = 12f
            setTextColor(cTextSec)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.topMargin = 16
            layoutParams = lp
        }
        bar.addView(subtitle)
        root.addView(bar)
    }

    private fun buildMinAudioStatusCard(root: LinearLayout) {
        val card = makeMinAudioCard()
        addMinAudioCardTitle(card, "📡 服务器状态", "Server")

        tvMinAudioServerStatus = TextView(this).apply {
            text = "服务器状态: 启动中..."
            textSize = 13f
            setTextColor(cTextSec)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = 8
            layoutParams = lp
        }
        card.addView(tvMinAudioServerStatus)

        tvMinAudioToken = TextView(this).apply {
            text = "token: -"
            textSize = 12f
            setTextColor(cTextMuted)
            setPadding(16, 12, 16, 12)
            setBackgroundColor(cBgSecondary)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = 8
            layoutParams = lp
        }
        card.addView(tvMinAudioToken)

        tvMinAudioReceiverUrl = TextView(this).apply {
            text = "receiver URL: -"
            textSize = 11f
            setTextColor(cTextMuted)
            setPadding(16, 12, 16, 12)
            setBackgroundColor(cBgSecondary)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = 16
            layoutParams = lp
        }
        card.addView(tvMinAudioReceiverUrl)

        val btnRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = 16
            layoutParams = lp
        }
        btnMinAudioStart = Button(this).apply {
            text = "启动麦克风"
            textSize = 13f
            setTypeface(null, Typeface.BOLD)
            setTextColor(cBg)
            setBackgroundColor(cAccent2)
            val lp = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            lp.marginEnd = 8
            layoutParams = lp
            setPadding(0, 24, 0, 24)
            background = createRoundedDrawable(cAccent2, 12f)
        }
        btnMinAudioStart.setOnClickListener { startMinAudioMicrophone() }
        btnRow.addView(btnMinAudioStart)

        btnMinAudioStop = Button(this).apply {
            text = "停止"
            textSize = 13f
            setTypeface(null, Typeface.BOLD)
            setTextColor(cText)
            setBackgroundColor(cBgCard)
            val lp = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            lp.marginStart = 8
            layoutParams = lp
            setPadding(0, 24, 0, 24)
            background = createRoundedDrawable(cBgCard, 12f)
            isEnabled = false
            alpha = 0.5f
        }
        btnMinAudioStop.setOnClickListener { stopMinAudioMicrophone() }
        btnRow.addView(btnMinAudioStop)
        card.addView(btnRow)

        tvMinAudioStatus = TextView(this).apply {
            text = "等待启动..."
            textSize = 12f
            setTextColor(cTextMuted)
            setPadding(16, 12, 16, 12)
            setBackgroundColor(cBgSecondary)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            layoutParams = lp
        }
        card.addView(tvMinAudioStatus)

        root.addView(card)
    }

    private fun buildMinAudioQrSection(root: LinearLayout) {
        val card = makeMinAudioCard()
        addMinAudioCardTitle(card, "📱 Receiver 连接", "QR Code")

        val desc = TextView(this).apply {
            text = "手机扫码或电脑浏览器打开 LAN URL。Debug URL 需要 adb forward。"
            textSize = 12f
            setTextColor(cTextSec)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = 16
            layoutParams = lp
        }
        card.addView(desc)

        val qrImg = ImageView(this).apply {
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.gravity = Gravity.CENTER_HORIZONTAL
            lp.bottomMargin = 12
            layoutParams = lp
        }
        card.addView(qrImg)
        qrImageView = qrImg

        root.addView(card)
    }

    private fun makeMinAudioCard(): LinearLayout {
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(cBgCard)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.setMargins(32, 12, 32, 12)
            layoutParams = lp
            setPadding(32, 28, 32, 28)
            background = createRoundedDrawable(cBgCard, 24f)
        }
    }

    private fun addMinAudioCardTitle(card: LinearLayout, title: String, badge: String) {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = 16
            layoutParams = lp
        }
        val tv = TextView(this).apply {
            this.text = title
            textSize = 14f
            setTypeface(null, Typeface.BOLD)
            setTextColor(cText)
        }
        row.addView(tv)
        val badgeView = TextView(this).apply {
            this.text = badge
            textSize = 9f
            setTypeface(null, Typeface.BOLD)
            setTextColor(cAccent)
            setBackgroundColor(Color.argb(30, 79, 195, 247))
            setPadding(10, 4, 10, 4)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.marginStart = 12
            layoutParams = lp
        }
        row.addView(badgeView)
        card.addView(row)
    }

    private fun setupMinAudioMode() {
        if (appState == null) {
            appState = AppState()
        }

        val initialIp = PrivateIpPicker.pick()
        if (initialIp != null && session == null) {
            val s = SessionManager.createSession(initialIp, PORT)
            session = s
            val debugLink = "http://127.0.0.1:${s.port}/min-audio-receiver?token=${s.token}"
            val lanLink = "http://${s.privateIp}:${s.port}/min-audio-receiver?token=${s.token}"
            currentSessionUrl = lanLink
            tvMinAudioToken.text = "token: ${s.token.take(12)}..."
            tvMinAudioReceiverUrl.text = "LAN: $lanLink\nDebug: $debugLink (requires adb forward)"
            qrImageView?.apply {
                visibility = View.VISIBLE
                setImageBitmap(generateQRCode(lanLink, 500))
            }
        }

        ensureServerStarted()
        session?.let { active ->
            val debugLink = "http://127.0.0.1:${active.port}/min-audio-receiver?token=${active.token}"
            val lanLink = "http://${active.privateIp}:${active.port}/min-audio-receiver?token=${active.token}"
            currentSessionUrl = lanLink
            tvMinAudioToken.text = "token: ${active.token.take(12)}..."
            tvMinAudioReceiverUrl.text = "LAN: $lanLink\nDebug: $debugLink (requires adb forward)"
            qrImageView?.setImageBitmap(generateQRCode(lanLink, 500))
        }
        showMinAudioSendPage()

        tvMinAudioServerStatus.text = "服务器状态: 运行中 ✓"
        tvMinAudioServerStatus.setTextColor(cAccent2)
        tvMinAudioStatus.text = "服务器就绪，点击「启动麦克风」开始音频采集"
    }

    private fun showMinAudioSendPage() {
        val s = session
        val url = if (s != null && isServerRunning) {
            "http://127.0.0.1:${s.port}/min-audio-send?token=${s.token}"
        } else {
            "file:///android_asset/web/min-audio-send.html"
        }
        android.util.Log.i("CheapLiveCapture", "showMinAudioSendPage: loading local test route")
        webView?.loadUrl(url)
    }

    private fun startMinAudioMicrophone() {
        val hasAudio = ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        if (!hasAudio) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.RECORD_AUDIO), REQ_AUDIO)
            tvMinAudioStatus.text = "请求麦克风权限中..."
            return
        }
        webView?.evaluateJavascript(
            "(function() { if (window.MinAudioSend && window.MinAudioSend.startMicrophone) { window.MinAudioSend.startMicrophone(); return 'started'; } else { return 'api-not-ready'; } })()"
        ) { result ->
            android.util.Log.i("CheapLiveCapture", "startMinAudioMicrophone result: $result")
            btnMinAudioStart.isEnabled = false
            btnMinAudioStart.alpha = 0.5f
            btnMinAudioStop.isEnabled = true
            btnMinAudioStop.alpha = 1f
            tvMinAudioStatus.text = "麦克风启动中..."
        }
    }

    private fun stopMinAudioMicrophone() {
        webView?.evaluateJavascript(
            "(function() { if (window.MinAudioSend && window.MinAudioSend.stopMicrophone) { window.MinAudioSend.stopMicrophone(); return 'stopped'; } else { return 'api-not-ready'; } })()"
        ) { result ->
            android.util.Log.i("CheapLiveCapture", "stopMinAudioMicrophone result: $result")
            btnMinAudioStart.isEnabled = true
            btnMinAudioStart.alpha = 1f
            btnMinAudioStop.isEnabled = false
            btnMinAudioStop.alpha = 0.5f
            tvMinAudioStatus.text = "已停止"
        }
    }

    // ============================================================
    // 顶部产品区
    // ============================================================
    private fun buildTopBar(root: LinearLayout) {
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#111827"))
            setPadding(48, 56, 48, 40)
        }
        // gradient overlay effect via padding
        val titleRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        // logo block
        val logo = TextView(this).apply {
            text = "C"
            textSize = 18f
            setTypeface(null, Typeface.BOLD)
            setTextColor(cBg)
            gravity = Gravity.CENTER
            setBackgroundColor(cAccent)
            val lp = LinearLayout.LayoutParams(76, 76)
            lp.marginEnd = 24
            layoutParams = lp
        }
        titleRow.addView(logo)

        val titleCol = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val title = TextView(this).apply {
            text = "CheapLive Capture"
            textSize = 22f
            setTypeface(null, Typeface.BOLD)
            setTextColor(cText)
        }
        titleCol.addView(title)
        val badge = TextView(this).apply {
            text = "参赛演示版 · CONTEST"
            textSize = 10f
            setTypeface(null, Typeface.BOLD)
            setTextColor(cAccent)
            setBackgroundColor(Color.argb(30, 79, 195, 247))
            setPadding(16, 6, 16, 6)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.topMargin = 6
            layoutParams = lp
        }
        titleCol.addView(badge)
        titleRow.addView(titleCol)
        bar.addView(titleRow)

        val statusRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.topMargin = 28
            layoutParams = lp
        }
        tvServerStatus = TextView(this).apply {
            text = "尚未开始"
            textSize = 14f
            setTextColor(cTextSec)
        }
        statusRow.addView(tvServerStatus)
        tvServerBadge = TextView(this).apply {
            text = "OFFLINE"
            textSize = 9f
            setTypeface(null, Typeface.BOLD)
            setTextColor(cDanger)
            setBackgroundColor(Color.argb(30, 255, 107, 107))
            setPadding(12, 4, 12, 4)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.marginStart = 16
            layoutParams = lp
        }
        statusRow.addView(tvServerBadge)
        bar.addView(statusRow)

        tvSessionInfo = TextView(this).apply {
            text = "点击开始多端会话"
            textSize = 12f
            setTextColor(cTextMuted)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.topMargin = 8
            layoutParams = lp
        }
        bar.addView(tvSessionInfo)

        root.addView(bar)
    }

    // ============================================================
    // 服务器卡片
    // ============================================================
    private fun buildServerCard(root: LinearLayout) {
        val card = makeCard()
        addCardTitle(card, "📡 Local Server", "服务器")
        btnStart = makeButton("开始多端会话", cAccent, cBg)
        btnStop = makeButton("停止会话", cBgSecondary, cText)
        card.addView(btnStart)
        card.addView(btnStop)
        root.addView(card)
    }

    // ============================================================
    // Avatar 模块
    // ============================================================
    private fun buildAvatarCard(root: LinearLayout) {
        val card = makeCard()
        addCardTitle(card, "🎭 Avatar 模块", "形象选择")

        // current avatar display
        tvAvatarCurrent = TextView(this).apply {
            text = "当前: 萨卡班甲鱼"
            textSize = 13f
            setTextColor(cAccent)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = 12
            layoutParams = lp
        }
        card.addView(tvAvatarCurrent)

        addSectionLabel(card, "选择 Avatar")
        avatarButtons = mutableListOf()
        val avatarGrid = makeGrid(3)
        for ((av, label) in avatars) {
            val btn = makeChipButton(label)
            btn.setOnClickListener {
                appState?.applyCommand("setAvatar", mapOf("avatar" to av))
                refreshAvatarButtons()
                updateAvatarDisplay()
            }
            avatarButtons.add(btn)
            avatarGrid.addView(btn)
        }
        card.addView(avatarGrid)

        addSectionLabel(card, "表情")
        tvExprCurrent = TextView(this).apply {
            text = "当前表情: —"
            textSize = 11f
            setTextColor(cTextMuted)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = 8
            layoutParams = lp
        }
        card.addView(tvExprCurrent)
        exprButtons = mutableListOf()
        val exprGrid = makeGrid(4)
        for ((ex, label) in expressions) {
            val btn = makeChipButton(label)
            btn.setOnClickListener {
                appState?.applyCommand("setAvatarExpression", mapOf("expression" to ex))
                // auto-clear after 1.2s
                android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                    if (appState?.avatarExpression == ex) {
                        appState?.applyCommand("setAvatarExpression", mapOf("expression" to ""))
                        refreshExprButtons()
                        updateAvatarDisplay()
                    }
                }, 1200)
                refreshExprButtons()
                updateAvatarDisplay()
            }
            exprButtons.add(btn)
            exprGrid.addView(btn)
        }
        card.addView(exprGrid)

        addSectionLabel(card, "动作")
        tvActionCurrent = TextView(this).apply {
            text = "当前动作: —"
            textSize = 11f
            setTextColor(cTextMuted)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = 8
            layoutParams = lp
        }
        card.addView(tvActionCurrent)
        actionButtons = mutableListOf()
        val actionGrid = makeGrid(4)
        for ((ac, label) in actions) {
            val btn = makeChipButton(label)
            btn.setOnClickListener {
                appState?.applyCommand("setAvatarAction", mapOf("action" to ac))
                android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                    if (appState?.avatarAction == ac) {
                        appState?.applyCommand("setAvatarAction", mapOf("action" to ""))
                        refreshActionButtons()
                        updateAvatarDisplay()
                    }
                }, 1500)
                refreshActionButtons()
                updateAvatarDisplay()
            }
            actionButtons.add(btn)
            actionGrid.addView(btn)
        }
        card.addView(actionGrid)

        root.addView(card)
    }

    // ============================================================
    // Face Capture 模块
    // ============================================================
    private lateinit var tvFaceCaptureStatus: TextView
    private lateinit var btnFaceToggle: Button
    private lateinit var tvPoseCaptureStatus: TextView
    private lateinit var btnPoseToggle: Button
    private lateinit var poseModeButtons: MutableList<Button>
    private lateinit var bodyPoseButtons: MutableList<Button>

    private fun buildFaceCaptureCard(root: LinearLayout) {
        val card = makeCard()
        addCardTitle(card, "📷 Face Capture", "面捕")

        val desc = TextView(this).apply {
            text = "真实摄像头面捕驱动 Avatar 表情。需要摄像头权限。当前为 Testing 阶段。"
            textSize = 11f
            setTextColor(cTextSec)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = 12
            layoutParams = lp
        }
        card.addView(desc)

        // toggle button
        btnFaceToggle = makeButton("启用面捕", cAccent2, cBg)
        btnFaceToggle.setOnClickListener {
            safeToggleFaceCapture()
        }
        card.addView(btnFaceToggle)

        // status
        tvFaceCaptureStatus = TextView(this).apply {
            text = "状态: 未启用 | 权限未请求"
            textSize = 11f
            setTextColor(cTextMuted)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.topMargin = 8
            layoutParams = lp
        }
        card.addView(tvFaceCaptureStatus)

        root.addView(card)
    }

    private fun safeToggleFaceCapture() {
        try {
            val current = appState?.faceCaptureEnabled ?: false
            if (!current) {
                // 开启前检查权限
                val hasCamera = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
                if (!hasCamera) {
                    // 请求摄像头权限
                    ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.CAMERA), REQ_CAMERA)
                    appState?.setField("lastError", "requesting camera permission")
                    updateFaceCaptureStatus()
                    return
                }
            }
            appState?.applyCommand("setFaceCapture", mapOf("enabled" to !current))
            btnFaceToggle.text = if (!current) "停止面捕" else "启用面捕"
            updateFaceCaptureStatus()

            if (!current) {
                // 启动 WebView 中的 camera
                webView?.evaluateJavascript(
                    "(function() { if (window.CheapLiveCapture && window.CheapLiveCapture.startCamera) { window.CheapLiveCapture.startCamera('android-button'); return 'startCamera-dispatched'; } else { return 'api-not-ready'; } })()"
                ) { result ->
                    android.util.Log.i("CheapLiveCapture", "startCamera dispatch result: $result")
                }
            } else {
                // 停止 WebView 中的 camera
                // 如果姿态捕捉也关了，真正停止摄像头硬件
                val poseOn = appState?.poseCaptureEnabled ?: false
                val stopHardware = !poseOn
                val stopJs = if (stopHardware) {
                    "(function() { if (window.CheapLiveCapture && window.CheapLiveCapture.stopCamera) { return JSON.stringify(window.CheapLiveCapture.stopCamera('android-button', true)); } else { return JSON.stringify({ok:false,error:'CheapLiveCapture API not ready'}); } })()"
                } else {
                    "(function() { if (window.CheapLiveCapture && window.CheapLiveCapture.stopCamera) { return JSON.stringify(window.CheapLiveCapture.stopCamera('android-button')); } else { return JSON.stringify({ok:false,error:'CheapLiveCapture API not ready'}); } })()"
                }
                webView?.evaluateJavascript(stopJs) { result ->
                    android.util.Log.i("CheapLiveCapture", "stopCamera (hardware=$stopHardware) result: $result")
                }
            }
        } catch (e: Throwable) {
            appState?.setField("lastError", "face capture toggle error: ${e.message}")
            updateFaceCaptureStatus()
        }
    }

    private fun updateFaceCaptureStatus() {
        val snap = appState?.snapshot() ?: return
        val permText = when (snap.cameraPermission) {
            "granted" -> "权限已授予"
            "denied" -> "权限被拒绝"
            else -> "权限未请求"
        }
        val stateText = if (snap.faceCaptureEnabled) "已启用" else "未启用"
        val errorText = if (snap.lastError.isNotEmpty() && snap.lastError.contains("face", ignoreCase = true)) " | 错误: ${snap.lastError}" else ""
        tvFaceCaptureStatus.text = "状态: $stateText | $permText$errorText"
    }

    // ============================================================
    // 姿态捕捉模块
    // ============================================================
    private fun buildPoseCaptureCard(root: LinearLayout) {
        val card = makeCard()
        addCardTitle(card, "🏃 姿态捕捉", "Body Pose")

        val desc = TextView(this).apply {
            text = "模拟姿态可用，真实姿态捕捉待接入。"
            textSize = 11f
            setTextColor(cTextSec)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = 12
            layoutParams = lp
        }
        card.addView(desc)

        // toggle button
        btnPoseToggle = makeButton("启用姿态捕捉", cAccent2, cBg)
        btnPoseToggle.setOnClickListener {
            safeTogglePoseCapture()
        }
        card.addView(btnPoseToggle)

        // status
        tvPoseCaptureStatus = TextView(this).apply {
            text = "状态: off | 模式: simulated | 姿态: idle"
            textSize = 11f
            setTextColor(cTextMuted)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.topMargin = 8
            layoutParams = lp
        }
        card.addView(tvPoseCaptureStatus)

        addSectionLabel(card, "模式")
        poseModeButtons = mutableListOf()
        val modeRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = 12
            layoutParams = lp
        }
        for ((mode, label) in poseModes) {
            val btn = makeChipButton(label)
            btn.tag = mode
            btn.setOnClickListener {
                safeSetPoseMode(mode)
            }
            poseModeButtons.add(btn)
            modeRow.addView(btn)
        }
        card.addView(modeRow)

        addSectionLabel(card, "身体姿态")
        bodyPoseButtons = mutableListOf()
        val poseGrid = makeGrid(3)
        for ((pose, label) in bodyPoses) {
            val btn = makeChipButton(label)
            btn.tag = pose
            btn.setOnClickListener {
                safeSetBodyPose(pose)
            }
            bodyPoseButtons.add(btn)
            poseGrid.addView(btn)
        }
        card.addView(poseGrid)

        root.addView(card)
    }

    private fun safeTogglePoseCapture() {
        try {
            val current = appState?.poseCaptureEnabled ?: false
            appState?.applyCommand("setPoseCapture", mapOf("enabled" to !current))
            btnPoseToggle.text = if (!current) "停止姿态捕捉" else "启用姿态捕捉"
            updatePoseCaptureStatus()
        } catch (e: Throwable) {
            appState?.setField("lastError", "pose capture toggle error: ${e.message}")
            updatePoseCaptureStatus()
        }
    }

    private fun safeSetPoseMode(mode: String) {
        try {
            appState?.applyCommand("setPoseMode", mapOf("mode" to mode))
            refreshPoseModeButtons()
            updatePoseCaptureStatus()
        } catch (e: Throwable) {
            appState?.setField("lastError", "pose mode error: ${e.message}")
            updatePoseCaptureStatus()
        }
    }

    private fun safeSetBodyPose(pose: String) {
        try {
            appState?.applyCommand("setBodyPose", mapOf("pose" to pose))
            refreshBodyPoseButtons()
            updatePoseCaptureStatus()
        } catch (e: Throwable) {
            appState?.setField("lastError", "body pose error: ${e.message}")
            updatePoseCaptureStatus()
        }
    }

    private fun refreshPoseModeButtons() {
        val current = appState?.poseMode ?: "simulated"
        for ((btn, mode) in poseModeButtons.zip(poseModes.map { it.first })) {
            btn.setBackgroundColor(if (btn.tag == current) cAccent2 else cBgSecondary)
            btn.setTextColor(if (btn.tag == current) cBg else cText)
        }
    }

    private fun refreshBodyPoseButtons() {
        val current = appState?.bodyPose ?: "idle"
        for (btn in bodyPoseButtons) {
            val isActive = btn.tag == current
            btn.setBackgroundColor(if (isActive) cAccent2 else cBgSecondary)
            btn.setTextColor(if (isActive) cBg else cText)
        }
    }

    private fun updatePoseCaptureStatus() {
        val snap = appState?.snapshot() ?: return
        val stateText = if (snap.poseCaptureEnabled) "enabled" else "off"
        val modeText = snap.poseMode
        val poseText = snap.bodyPose
        tvPoseCaptureStatus.text = "状态: $stateText | 模式: $modeText | 姿态: $poseText"
        refreshPoseModeButtons()
        refreshBodyPoseButtons()
    }

    // ============================================================
    // 普通变声模块
    // ============================================================
    private fun buildVoiceCard(root: LinearLayout) {
        val card = makeCard()
        addCardTitle(card, "🎙 普通变声", "变声预设")

        val desc = TextView(this).apply {
            text = "App 侧基础变声。需要麦克风权限。preset: 原声/可爱/机器人/低沉/电台。"
            textSize = 11f
            setTextColor(cTextSec)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = 12
            layoutParams = lp
        }
        card.addView(desc)

        // preset chips
        presetButtons = mutableListOf()
        val presetScroll = HorizontalScrollView(this)
        val presetRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = 12
            layoutParams = lp
        }
        for ((p, label) in presets) {
            val btn = makeChipButton(label)
            btn.setOnClickListener {
                safeSetVoicePreset(p)
            }
            presetButtons.add(btn)
            presetRow.addView(btn)
        }
        presetScroll.addView(presetRow)
        card.addView(presetScroll)

        // toggle button
        val toggleBtn = makeButton("启用变声", cAccent, cBg)
        toggleBtn.setOnClickListener {
            safeToggleVoiceChanger(toggleBtn)
        }
        card.addView(toggleBtn)

        // status
        tvVoiceStatus = TextView(this).apply {
            text = "状态: 未启用 | 权限未请求 | preset=original"
            textSize = 11f
            setTextColor(cTextMuted)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.topMargin = 8
            layoutParams = lp
        }
        card.addView(tvVoiceStatus)

        root.addView(card)
    }

    private fun safeSetVoicePreset(preset: String) {
        try {
            appState?.applyCommand("setVoicePreset", mapOf("preset" to preset))
            refreshPresetButtons()
            updateVoiceStatus()
        } catch (e: Throwable) {
            appState?.setField("lastError", "preset error: ${e.message}")
            updateVoiceStatus()
        }
    }

    private fun safeToggleVoiceChanger(toggleBtn: Button) {
        try {
            val newState = !(appState?.voiceChangerEnabled ?: false)
            appState?.applyCommand("setVoiceChanger", mapOf("enabled" to newState))
            toggleBtn.text = if (newState) "停止变声" else "启用变声"
            updateVoiceStatus()
        } catch (e: Throwable) {
            appState?.setField("lastError", "voice toggle error: ${e.message}")
            updateVoiceStatus()
        }
    }

    // ============================================================
    // AI 变声模块
    // ============================================================
    private fun buildAiVoiceCard(root: LinearLayout) {
        val card = makeCard()
        addCardTitle(card, "🤖 AI 变声", "Real App Only")

        val desc = TextView(this).apply {
            text = "AI 变声仅在真实 Android App 中可用。当前为 Experimental，模型未捆绑。"
            textSize = 11f
            setTextColor(cTextSec)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = 12
            layoutParams = lp
        }
        card.addView(desc)

        tvAiVoiceStatus = TextView(this).apply {
            text = "状态: real_app_only / model not bundled / experimental"
            textSize = 11f
            setTextColor(cPurple)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.topMargin = 8
            layoutParams = lp
        }
        card.addView(tvAiVoiceStatus)

        val infoBtn = makeButton("查看说明", cBgSecondary, cPurple)
        infoBtn.setOnClickListener {
            Toast.makeText(this, "AI 变声仅在真实 Android App 中可用。当前为 Experimental，模型未捆绑，coming later。", Toast.LENGTH_LONG).show()
        }
        card.addView(infoBtn)

        root.addView(card)
    }

    // ============================================================
    // App-Web 控制模块
    // ============================================================
    private fun buildControlCard(root: LinearLayout) {
        val card = makeCard()
        addCardTitle(card, "🌐 App-Web 控制", "远程控制")

        btnOpenControl = makeButton("打开 Web 控制面板", cAccent, cBg)
        btnOpenControl.setOnClickListener {
            val s = session ?: return@setOnClickListener
            val url = "http://${s.privateIp}:${s.port}/control/"
            try {
                startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url)))
            } catch (_: Throwable) {
                Toast.makeText(this, "没有浏览器可用", Toast.LENGTH_SHORT).show()
            }
        }
        card.addView(btnOpenControl)

        btnOpenDemo = makeButton("打开 Receiver 演示页", cBgSecondary, cText)
        btnOpenDemo.setOnClickListener {
            val s = session ?: return@setOnClickListener
            val url = "http://${s.privateIp}:${s.port}/receiver/?token=${s.token}&v=${BuildConfig.VERSION_NAME}"
            try {
                startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url)))
            } catch (_: Throwable) {
                Toast.makeText(this, "没有浏览器可用", Toast.LENGTH_SHORT).show()
            }
        }
        card.addView(btnOpenDemo)

        root.addView(card)
    }

    // ============================================================
    // 状态面板
    // ============================================================
    private fun buildStateCard(root: LinearLayout) {
        val card = makeCard()
        addCardTitle(card, "📊 App 状态面板", "实时")

        tvStatePanel = TextView(this).apply {
            text = "服务器未启动"
            textSize = 11f
            setTextColor(cTextSec)
            setPadding(16, 16, 16, 16)
            setBackgroundColor(cBgSecondary)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.topMargin = 8
            layoutParams = lp
        }
        card.addView(tvStatePanel)

        // Debug: Audio Probe button (only visible when devAudioEnabled = true)
        if (devAudioEnabled) {
            val btnAudioProbe = makeButton("🔍 打开 Audio Probe（调试）", cPurple, cBg).apply {
                setOnClickListener {
                    val s = session ?: return@setOnClickListener
                    val probeUrl = "http://127.0.0.1:${s.port}/audio-probe/?token=${s.token}&autostart=1&devAudio=1"
                    webView?.apply {
                        visibility = View.VISIBLE
                        layoutParams = LinearLayout.LayoutParams(
                            LinearLayout.LayoutParams.MATCH_PARENT,
                            (resources.displayMetrics.heightPixels * 0.6).toInt()
                        )
                        loadUrl(probeUrl)
                    }
                }
            }
            card.addView(btnAudioProbe)
        }

        root.addView(card)
    }

    // ============================================================
    // 二维码区
    // ============================================================
    private fun buildQrSection(root: LinearLayout) {
        val card = makeCard()
        addCardTitle(card, "📱 接收端链接", "扫码连接")

        val hint = TextView(this).apply {
            text = "此二维码用于打开接收/播放端页面，不是手机采集端。\n请在电脑或展示设备浏览器中打开，用于接收本机采集的头像/声音数据。\n面部、动作和声音采集请在本 Android App 内完成。"
            setTextColor(cTextSec)
            textSize = 13f
            setPadding(0, 4, 0, 12)
            lineHeight = (19 * resources.displayMetrics.density).toInt()
        }
        card.addView(hint)

        qrImageView = ImageView(this).apply {
            setBackgroundColor(Color.WHITE)
            visibility = View.GONE
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 600)
            lp.topMargin = 12
            lp.bottomMargin = 12
            layoutParams = lp
            scaleType = ImageView.ScaleType.FIT_CENTER
        }
        card.addView(qrImageView)

        val btnCopy = makeButton("复制链接", cBgSecondary, cText)
        btnCopy.setOnClickListener {
            if (currentSessionUrl.isNotEmpty()) {
                @Suppress("DEPRECATION")
                val clip = getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
                clip?.setPrimaryClip(ClipData.newPlainText("CheapLive Session URL", currentSessionUrl))
                Toast.makeText(this, "链接已复制到剪贴板", Toast.LENGTH_SHORT).show()
            }
        }
        card.addView(btnCopy)

        val btnResetQr = makeButton("刷新二维码/链接", cBgSecondary, cText)
        btnResetQr.setOnClickListener { resetSession() }
        card.addView(btnResetQr)

        // 重置连接：生成新 token/sessionId，旧二维码失效（面捕配置不受影响）
        val btnResetConnection = makeButton("重置连接（旧二维码失效）", cBgSecondary, cDanger)
        btnResetConnection.setOnClickListener {
            android.app.AlertDialog.Builder(this)
                .setTitle("重置连接？")
                .setMessage("重置后，之前的二维码、书签和已打开的 Receiver 页面将失效。\n\n面捕个体化设置不会被清除。\n\n确认重置连接身份？")
                .setPositiveButton("重置") { _, _ ->
                    resetConnectionIdentity()
                    Toast.makeText(this, "连接已重置，请使用新二维码", Toast.LENGTH_LONG).show()
                }
                .setNegativeButton("取消", null)
                .show()
        }
        card.addView(btnResetConnection)

        root.addView(card)
    }

    // ============================================================
    // UI helpers
    // ============================================================
    private fun makeCard(): LinearLayout {
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(cBgCard)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.setMargins(32, 12, 32, 12)
            layoutParams = lp
            setPadding(36, 32, 36, 32)
            // rounded background
            background = createRoundedDrawable(cBgCard, radiusCard)
        }
    }

    private fun addCardTitle(card: LinearLayout, title: String, badge: String) {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = 16
            layoutParams = lp
        }
        val dot = View(this).apply {
            setBackgroundColor(cAccent2)
            val lp = LinearLayout.LayoutParams(16, 16)
            lp.marginEnd = 12
            layoutParams = lp
        }
        row.addView(dot)
        val tv = TextView(this).apply {
            text = title
            textSize = 15f
            setTypeface(null, Typeface.BOLD)
            setTextColor(cText)
        }
        row.addView(tv)
        val badgeView = TextView(this).apply {
            text = badge
            textSize = 9f
            setTypeface(null, Typeface.BOLD)
            setTextColor(cAccent2)
            setBackgroundColor(Color.argb(30, 105, 219, 124))
            setPadding(12, 4, 12, 4)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.marginStart = 16
            layoutParams = lp
        }
        row.addView(badgeView)
        card.addView(row)
    }

    private fun addSectionLabel(card: LinearLayout, text: String) {
        val tv = TextView(this).apply {
            this.text = text
            textSize = 11f
            setTypeface(null, Typeface.BOLD)
            setTextColor(cTextMuted)
            setPadding(0, 16, 0, 8)
        }
        card.addView(tv)
    }

    private fun makeButton(text: String, bgColor: Int, textColor: Int): Button {
        return Button(this).apply {
            this.text = text
            textSize = 13f
            setTypeface(null, Typeface.BOLD)
            setTextColor(textColor)
            setBackgroundColor(bgColor)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.topMargin = 8
            layoutParams = lp
            setPadding(0, 24, 0, 24)
            background = createRoundedDrawable(bgColor, radiusXs)
        }
    }

    private fun makeChipButton(text: String): Button {
        return Button(this).apply {
            this.text = text
            textSize = 11f
            setTypeface(null, Typeface.BOLD)
            setTextColor(cTextSec)
            setBackgroundColor(cBgSecondary)
            setPadding(8, 16, 8, 16)
            background = createRoundedDrawable(cBgSecondary, radiusXs)
            val lp = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            lp.setMargins(4, 4, 4, 4)
            layoutParams = lp
        }
    }

    private fun makeGrid(columns: Int): LinearLayout {
        // simple grid: horizontal row that wraps — for simplicity use vertical rows of `columns`
        return LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            layoutParams = lp
        }
    }

    private fun createRoundedDrawable(color: Int, radius: Float): android.graphics.drawable.Drawable {
        val shape = android.graphics.drawable.GradientDrawable()
        shape.setColor(color)
        shape.cornerRadius = radius
        return shape
    }

    // ============================================================
    // State refresh
    // ============================================================
    private fun refreshAvatarButtons() {
        val current = appState?.avatar ?: "sacabambaspis3d"
        for (i in avatars.indices) {
            val (av, _) = avatars[i]
            val active = av == current
            avatarButtons[i].setTextColor(if (active) cAccent else cTextSec)
            avatarButtons[i].background = createRoundedDrawable(
                if (active) Color.argb(30, 79, 195, 247) else cBgSecondary, radiusXs
            )
        }
    }

    private fun refreshExprButtons() {
        val current = appState?.avatarExpression ?: ""
        for (i in expressions.indices) {
            val (ex, _) = expressions[i]
            val active = ex == current
            exprButtons[i].setTextColor(if (active) cAccent2 else cTextSec)
            exprButtons[i].background = createRoundedDrawable(
                if (active) Color.argb(30, 105, 219, 124) else cBgSecondary, radiusXs
            )
        }
    }

    private fun refreshActionButtons() {
        val current = appState?.avatarAction ?: ""
        for (i in actions.indices) {
            val (ac, _) = actions[i]
            val active = ac == current
            actionButtons[i].setTextColor(if (active) cAccent2 else cTextSec)
            actionButtons[i].background = createRoundedDrawable(
                if (active) Color.argb(30, 105, 219, 124) else cBgSecondary, radiusXs
            )
        }
    }

    private fun refreshPresetButtons() {
        val current = appState?.voicePreset ?: "original"
        for (i in presets.indices) {
            val (p, _) = presets[i]
            val active = p == current
            presetButtons[i].setTextColor(if (active) cAccent else cTextSec)
            presetButtons[i].background = createRoundedDrawable(
                if (active) Color.argb(30, 79, 195, 247) else cBgSecondary, radiusXs
            )
        }
    }

    private fun updateAvatarDisplay() {
        val snap = appState?.snapshot() ?: return
        val avLabel = avatars.find { it.first == snap.avatar }?.second ?: snap.avatar
        tvAvatarCurrent.text = "当前: $avLabel"
        tvExprCurrent.text = "当前表情: ${if (snap.avatarExpression.isEmpty()) "—" else expressions.find { it.first == snap.avatarExpression }?.second ?: snap.avatarExpression}"
        tvActionCurrent.text = "当前动作: ${if (snap.avatarAction.isEmpty()) "—" else actions.find { it.first == snap.avatarAction }?.second ?: snap.avatarAction}"
    }

    private fun updateVoiceStatus() {
        val snap = appState?.snapshot() ?: return
        val permText = when (snap.voicePermission) {
            "granted" -> "权限已授予"
            "denied" -> "权限被拒绝"
            else -> "权限未请求"
        }
        val stateText = if (snap.voiceChangerEnabled) "已启用" else "未启用"
        tvVoiceStatus.text = "状态: $stateText | $permText | preset=${snap.voicePreset}"
    }

    private fun updateStatePanel(snap: AppStateSnapshot) {
        val sb = StringBuilder()
        sb.append("Server: ").append(if (snap.serverRunning) "Running" else "Stopped").append('\n')
        sb.append("URL: ").append(currentSessionUrl).append('\n')
        sb.append("Avatar: ").append(snap.avatar).append('\n')
        sb.append("Expression: ").append(snap.avatarExpression.ifEmpty { "—" }).append('\n')
        sb.append("Action: ").append(snap.avatarAction.ifEmpty { "—" }).append('\n')
        sb.append("Voice: ").append(if (snap.voiceChangerEnabled) "ON" else "OFF")
            .append(" [").append(snap.voicePreset).append("]\n")
        sb.append("Voice Perm: ").append(snap.voicePermission).append('\n')
        sb.append("AI Voice: ").append(snap.aiVoiceStatus).append('\n')
        sb.append("Web Voice: ").append(snap.webVoiceStatus).append('\n')
        sb.append("Capture Mode: ").append(snap.captureMode).append('\n')
        sb.append("Face Capture: ").append(if (snap.faceCaptureEnabled) "ON" else "OFF").append('\n')
        sb.append("Subtitle: ").append(if (snap.subtitleEnabled) "ON" else "OFF").append('\n')
        sb.append("Viewer: ").append(if (snap.viewerConnected) "Connected" else "Disconnected").append('\n')
        sb.append("Frames: ").append(snap.frameCount).append("  Latency: ").append(snap.latencyMs).append("ms\n")
        sb.append("Last Cmd: ").append(snap.lastCommand.ifEmpty { "--" }).append('\n')
        if (snap.lastError.isNotEmpty()) sb.append("Error: ").append(snap.lastError).append('\n')
        sb.append("Updated: ").append(java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.US).format(java.util.Date(snap.updatedAt)))
        tvStatePanel.text = sb.toString()
    }

    // ============================================================
    // Session management
    // ============================================================
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
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

        wv.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url?.toString() ?: return true
                return !url.startsWith("file:///android_asset/") &&
                    !url.startsWith("http://127.0.0.1:")
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                android.util.Log.i("CheapLiveWebView", "onPageFinished: $url")
                // capture 页面加载完成后立即初始化 AppState listener（不需要等待 viewer 连接）
                if (url?.contains("capture") == true || url?.startsWith("file:///android_asset/") == true) {
                    setupAppStateListener()
                }
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                super.onReceivedError(view, request, error)
                if (request.isForMainFrame) {
                    val failingUrl = request.url?.toString() ?: "unknown"
                    val errDesc = error.description?.toString() ?: "error code ${error.errorCode}"
                    android.util.Log.w("CheapLiveWebView", "Main frame error: $failingUrl - $errDesc")
                    loadBlackScreenFallback(view, "onReceivedError: $errDesc")
                }
            }

            override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, errorResponse: WebResourceResponse) {
                super.onReceivedHttpError(view, request, errorResponse)
                if (request.isForMainFrame) {
                    val failingUrl = request.url?.toString() ?: "unknown"
                    val statusCode = errorResponse.statusCode
                    android.util.Log.w("CheapLiveWebView", "Main frame HTTP error $statusCode: $failingUrl")
                    loadBlackScreenFallback(view, "onReceivedHttpError: HTTP $statusCode")
                }
            }

            private var isInFallback = false
            private fun loadBlackScreenFallback(view: WebView, reason: String) {
                if (isInFallback) return
                isInFallback = true
                android.util.Log.i("CheapLiveWebView", "Loading black-screen fallback, reason=$reason")
                view.post {
                    try {
                        view.loadUrl("file:///android_asset/web/black-screen/index.html")
                    } catch (t: Throwable) {
                        android.util.Log.e("CheapLiveWebView", "Failed to load fallback: ${t.message}")
                    }
                }
                view.postDelayed({ isInFallback = false }, 3000)
            }
        }

        wv.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                val r = request ?: return
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    val wanted = r.resources
                    android.util.Log.i("CheapLiveWebView", "onPermissionRequest: resources=[${wanted.joinToString()}]")
                    val allowed = wanted.filter {
                        it == PermissionRequest.RESOURCE_VIDEO_CAPTURE ||
                        it == PermissionRequest.RESOURCE_AUDIO_CAPTURE
                    }.toTypedArray()
                    if (allowed.isNotEmpty()) {
                        android.util.Log.i("CheapLiveWebView", "onPermissionRequest: granting [${allowed.joinToString()}]")
                        r.grant(allowed)
                    } else {
                        android.util.Log.w("CheapLiveWebView", "onPermissionRequest: denying all")
                        r.deny()
                    }
                }
            }

            override fun onConsoleMessage(consoleMessage: android.webkit.ConsoleMessage?): Boolean {
                val cm = consoleMessage ?: return super.onConsoleMessage(consoleMessage)
                val level = cm.messageLevel()
                val text = cm.message()
                val src = cm.sourceId()
                val line = cm.lineNumber()
                val tag = "CheapLiveWebView"
                when (level) {
                    android.webkit.ConsoleMessage.MessageLevel.ERROR ->
                        android.util.Log.e(tag, "[JS ERROR] $text ($src:$line)")
                    android.webkit.ConsoleMessage.MessageLevel.WARNING ->
                        android.util.Log.w(tag, "[JS WARN] $text ($src:$line)")
                    else ->
                        android.util.Log.d(tag, "[JS] $text ($src:$line)")
                }
                return true
            }
        }
    }

    private fun ensureServerStarted() {
        val ip = PrivateIpPicker.pick() ?: "127.0.0.1"
        if (connectionStore == null) connectionStore = ConnectionIdentityStore(this)
        val identity = connectionStore!!.load() ?: connectionStore!!.reset()
        val baseSession = session ?: Session(
            sessionId = identity.sessionId,
            token = identity.token,
            port = identity.port,
            privateIp = ip,
        ).also { session = it }
        val requestedState = appState ?: AppState()
        val handle = try {
            CaptureServerRuntime.ensureStarted(this, baseSession, requestedState)
        } catch (error: Throwable) {
            android.util.Log.e("CheapLiveCapture", "LocalServer start failed: ${error.javaClass.simpleName}")
            runOnUiThread {
                tvServerStatus?.text = "服务器启动失败：端口 ${identity.port} 被占用"
            }
            return
        }
        CaptureServerService.start(this)
        session = handle.session.copy(privateIp = ip)
        server = handle.server
        appState = handle.appState
        isServerRunning = true
        appState?.setField("serverRunning", true)
        appState?.onResetConnectionIdentity = { resetConnectionIdentity() }
        android.util.Log.i("CheapLiveCapture", "LocalServer foreground owner active")

        val b = bridge ?: CaptureBridge(
            session = session!!,
            broadcast = handle.server,
            onStateChange = { _, _ -> },
            appState = appState,
            configStore = configStore,
        ).also { bridge = it }
        runOnUiThread {
            webView?.addJavascriptInterface(b, "CheapLiveBridge")
        }
    }

    private fun showCapturePage() {
        val s = session
        val url = if (s != null && isServerRunning) {
            val devParam = if (devAudioEnabled) "&devAudio=1" else ""
            val page = if (devFaceDebugEnabled) "min-face-send" else "capture/"
            "http://127.0.0.1:${s.port}/$page?token=${s.token}$devParam"
        } else {
            "file:///android_asset/web/capture/index.html"
        }
        android.util.Log.i("CheapLiveCapture", "showCapturePage: loading local capture route")
        webView?.loadUrl(url)
    }

    private fun setupAppStateListener() {
        // 防止重复注册
        if (appStateListenerRegistered) return
        appStateListenerRegistered = true

        // 追踪上一次的 camera 需要状态，避免重复调用
        var lastCameraNeeded = false
        var lastVoiceEnabled = false
        var lastVoicePreset = ""
        var lastConfigRevision = appState?.faceTrackingConfig?.revision ?: 0L
        // 注册前补漏：如果 /api/control 在 listener 注册前调用了 resetFaceTrackingConfig，
        // appState.faceTrackingConfig 已是 reset 后的新值，但 prefs 仍是旧值。
        // 通过 lastPersistedConfigRevision（onCreate 中加载后设置）对比当前 rev，发现差异立即同步 save。
        val persistedRev = lastPersistedConfigRevision
        val currentRevAtInit = appState?.faceTrackingConfig?.revision ?: 0L
        if (currentRevAtInit != persistedRev) {
            android.util.Log.i("CheapLiveCapture", "setupAppStateListener: detected pending config change (currentRev=$currentRevAtInit, persistedRev=$persistedRev), saving now")
            val store = configStore
            val config = appState?.faceTrackingConfig
            if (store != null && config != null) {
                try {
                    store.save(config)
                    lastPersistedConfigRevision = config.revision
                } catch (t: Throwable) {
                    android.util.Log.w("CheapLiveCapture", "setupAppStateListener: immediate save failed: ${t.message}")
                }
            }
        }
        var lastCalibrationInProgress = appState?.calibrationStatus?.inProgress ?: false
        var lastCalibrationSampleCount = 0

        val listener: (AppStateSnapshot) -> Unit = { snap ->
            runOnUiThread {
                updateStatePanel(snap)
                updateAvatarDisplay()
                updateVoiceStatus()
                updateFaceCaptureStatus()
                refreshAvatarButtons()
                refreshExprButtons()
                refreshActionButtons()
                refreshPresetButtons()
                // update server badge
                tvServerBadge.text = if (snap.serverRunning) "ONLINE" else "OFFLINE"
                tvServerBadge.setTextColor(if (snap.serverRunning) cAccent2 else cDanger)
                tvServerBadge.setBackgroundColor(if (snap.serverRunning) Color.argb(30, 105, 219, 124) else Color.argb(30, 255, 107, 107))

                // 面部追踪配置变更 → 持久化 + 推送给 WebView（capture 页面应用新参数）
                val currentRev = appState?.faceTrackingConfig?.revision ?: 0L
                if (currentRev != lastConfigRevision) {
                    lastConfigRevision = currentRev
                    val configJson = appState?.faceTrackingConfig?.toJson() ?: "{}"
                    // 异步持久化（避免阻塞 UI 线程）
                    val store = configStore
                    val config = appState?.faceTrackingConfig
                    if (store != null && config != null) {
                        Thread({
                            try {
                                store.save(config)
                                // 同步更新 lastPersistedConfigRevision，避免下次 setupAppStateListener 误判为 pending change
                                lastPersistedConfigRevision = config.revision
                                android.util.Log.i("CheapLiveCapture", "Persisted faceTrackingConfig rev=${config.revision} to prefs")
                            } catch (t: Throwable) {
                                android.util.Log.w("CheapLiveCapture", "Failed to persist faceTrackingConfig rev=${config?.revision}: ${t.message}")
                            }
                        }, "CheapLive-config-persist").start()
                    }
                    // 推送给 WebView（capture 页面应用新参数）
                    webView?.evaluateJavascript(
                        "(function() { if (window.CheapLiveCapture && window.CheapLiveCapture.applyFaceTrackingConfig) { return JSON.stringify(window.CheapLiveCapture.applyFaceTrackingConfig('$configJson')); } else { return JSON.stringify({ok:false,error:'applyFaceTrackingConfig not ready'}); } })()"
                    ) { result ->
                        android.util.Log.i("CheapLiveCapture", "applyFaceTrackingConfig rev=$currentRev result: $result")
                    }
                }

                // 校准状态变更 → 推送给 WebView（capture 页面开始/停止采样）
                val calibrationInProgress = snap.calibrationInProgress
                val sampleCount = snap.calibrationSampleCount
                if (calibrationInProgress != lastCalibrationInProgress || sampleCount != lastCalibrationSampleCount) {
                    lastCalibrationInProgress = calibrationInProgress
                    lastCalibrationSampleCount = sampleCount
                    val action = if (calibrationInProgress) "start" else "stop"
                    // 构造完整的校准状态 JSON 对象，与 CaptureBridge.getCalibrationStatus() 格式一致
                    val statusJson = "{\"inProgress\":$calibrationInProgress,\"sampleCount\":$sampleCount,\"targetSamples\":${snap.calibrationTargetSamples},\"lastError\":\"${snap.calibrationLastError ?: ""}\"}"
                    webView?.evaluateJavascript(
                        "(function() { if (window.CheapLiveCapture && window.CheapLiveCapture.onCalibrationStatusChange) { return JSON.stringify(window.CheapLiveCapture.onCalibrationStatusChange(${org.json.JSONObject.quote(statusJson)})); } else { return JSON.stringify({ok:false,error:'onCalibrationStatusChange not ready'}); } })()"
                    ) { result ->
                        android.util.Log.i("CheapLiveCapture", "onCalibrationStatusChange($action,$sampleCount) result: $result")
                    }
                }

                // camera 需要状态：面捕或姿态捕捉任一启用就需要 camera
                val cameraNeeded = snap.faceCaptureEnabled || snap.poseCaptureEnabled
                if (cameraNeeded != lastCameraNeeded) {
                    lastCameraNeeded = cameraNeeded
                    if (cameraNeeded) {
                        // 需要 camera → 启动
                        webView?.evaluateJavascript(
                            "(function() { if (window.CheapLiveCapture && window.CheapLiveCapture.startCamera) { window.CheapLiveCapture.startCamera('state-change'); return 'startCamera-dispatched'; } else { return 'api-not-ready'; } })()"
                        ) { result ->
                            android.util.Log.i("CheapLiveCapture", "startCamera (state-change) result: $result")
                        }
                    } else {
                        // 都不需要 → 真正停止 camera 硬件
                        webView?.evaluateJavascript(
                            "(function() { if (window.CheapLiveCapture && window.CheapLiveCapture.stopCamera) { return JSON.stringify(window.CheapLiveCapture.stopCamera('all-stopped', true)); } else { return JSON.stringify({ok:false,error:'CheapLiveCapture API not ready'}); } })()"
                        ) { result ->
                            android.util.Log.i("CheapLiveCapture", "stopCamera (hardware) result: $result")
                        }
                    }
                }

                // voice 需要状态：voiceChangerEnabled 变化时联动 WebView
                val voiceEnabled = snap.voiceChangerEnabled
                if (voiceEnabled != lastVoiceEnabled) {
                    lastVoiceEnabled = voiceEnabled
                    if (voiceEnabled) {
                        webView?.evaluateJavascript(
                            "(function() { if (window.CheapLiveCapture && window.CheapLiveCapture.startVoiceCapture) { return JSON.stringify(window.CheapLiveCapture.startVoiceCapture('state-change')); } else { return JSON.stringify({ok:false,error:'CheapLiveCapture API not ready'}); } })()"
                        ) { result ->
                            android.util.Log.i("CheapLiveCapture", "startVoiceCapture (state-change) result: $result")
                        }
                    } else {
                        webView?.evaluateJavascript(
                            "(function() { if (window.CheapLiveCapture && window.CheapLiveCapture.stopVoiceCapture) { return JSON.stringify(window.CheapLiveCapture.stopVoiceCapture('state-change')); } else { return JSON.stringify({ok:false,error:'CheapLiveCapture API not ready'}); } })()"
                        ) { result ->
                            android.util.Log.i("CheapLiveCapture", "stopVoiceCapture (state-change) result: $result")
                        }
                    }
                }

                // voice preset 变化时联动 WebView
                val voicePreset = snap.voicePreset
                if (voicePreset != lastVoicePreset) {
                    lastVoicePreset = voicePreset
                    webView?.evaluateJavascript(
                        "(function() { if (window.CheapLiveCapture && window.CheapLiveCapture.setVoicePreset) { return JSON.stringify(window.CheapLiveCapture.setVoicePreset('$voicePreset')); } else { return JSON.stringify({ok:false,error:'CheapLiveCapture API not ready'}); } })()"
                    ) { result ->
                        android.util.Log.i("CheapLiveCapture", "setVoicePreset (state-change) result: $result")
                    }
                }
            }
        }
        appStateListener = listener
        appState?.addListener(listener)
        android.util.Log.i("CheapLiveCapture", "AppState listener registered")
    }

    private var appStateListenerRegistered = false
    private var appStateListener: ((AppStateSnapshot) -> Unit)? = null

    override fun onDestroy() {
        appStateListener?.let { listener -> appState?.removeListener(listener) }
        appStateListener = null
        appStateListenerRegistered = false
        webView?.evaluateJavascript(
            "(function(){if(window.CheapLiveCapture){window.CheapLiveCapture.stopCamera('activity-destroy',true);window.CheapLiveCapture.stopVoiceCapture('activity-destroy');}})()",
            null,
        )
        webView?.removeJavascriptInterface("CheapLiveBridge")
        webView?.destroy()
        webView = null
        super.onDestroy()
    }

    private fun startSession() {
        ensureServerStarted()
        val finalSession = session
        val activeServer = server
        if (!isServerRunning || finalSession == null || activeServer == null || appState == null) {
            tvServerStatus.text = "服务器启动失败，请检查端口状态"
            return
        }
        appState?.setField("serverRunning", true)
        appState?.setField("viewerConnected", true)
        appState?.onResetConnectionIdentity = { resetConnectionIdentity() }
        val hasAudio = ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        appState?.setField("voicePermission", if (hasAudio) "granted" else "denied")
        val b = bridge ?: CaptureBridge(
            session = finalSession,
            broadcast = activeServer,
            onStateChange = { _, _ -> },
            appState = appState,
            configStore = configStore,
        ).also { bridge = it }
        webView?.addJavascriptInterface(b, "CheapLiveBridge")
        val link = "http://${finalSession.privateIp}:${finalSession.port}/receiver/?token=${finalSession.token}&v=${BuildConfig.VERSION_NAME}"
        currentSessionUrl = link
        tvServerStatus.text = "会话已启动"
        tvSessionInfo.text = "扫描二维码在接收端打开（电脑/展示设备浏览器）"
        qrImageView?.apply {
            visibility = View.VISIBLE
            setImageBitmap(generateQRCode(link, 600))
        }
    }

    private fun resetSession() {
        // 停止服务器，但保留持久化连接身份（token/sessionId/port）
        // 用户重新点击"开始"会复用同一身份生成相同 URL
        CaptureServerService.stop(this)
        server = null
        isServerRunning = false
        // 不清 session：保留 token/sessionId/port，仅清运行时状态
        // session = null  // 已注释：保留身份
        bridge = null
        // 不清 currentSessionUrl：UI 仍显示二维码供用户参考
        // currentSessionUrl = ""  // 已注释：保留 URL 显示
        // qrImageView?.visibility = View.GONE  // 已注释：保留二维码显示
        tvServerStatus.text = "会话已停止（链接与二维码保持不变）"
        tvSessionInfo.text = "点击「开始多端会话」使用同一链接重启"
    }

    /**
     * 用户主动重置连接身份：生成新 token/sessionId，旧二维码失效。
     * 不清除面捕配置（FaceTrackingConfigStore 独立存储，互不影响）。
     * 需要二次确认（由调用方在 UI 层处理）。
     */
    private fun resetConnectionIdentity() {
        android.util.Log.i("CheapLiveCapture", "resetConnectionIdentity called")
        CaptureServerService.stop(this)
        server = null
        isServerRunning = false
        bridge = null
        if (connectionStore == null) {
            connectionStore = ConnectionIdentityStore(this)
        }
        val newIdentity = connectionStore!!.reset()
        android.util.Log.i("CheapLiveCapture", "Connection identity reset: new token/sessionId generated, port kept=${newIdentity.port}")
        val ip = PrivateIpPicker.pick()
        if (ip != null) {
            val s = Session(
                sessionId = newIdentity.sessionId,
                token = newIdentity.token,
                port = newIdentity.port,
                privateIp = ip,
            )
            session = s
            val link = "http://${s.privateIp}:${s.port}/receiver/?token=${s.token}&v=${BuildConfig.VERSION_NAME}"
            currentSessionUrl = link
            runOnUiThread {
                qrImageView?.apply {
                    visibility = View.VISIBLE
                    setImageBitmap(generateQRCode(link, 600))
                }
                tvServerStatus.text = "连接已重置（旧二维码已失效）"
                tvSessionInfo.text = "使用新二维码重新连接接收端"
            }
        } else {
            runOnUiThread {
                tvServerStatus.text = "连接已重置（旧二维码已失效）"
                tvSessionInfo.text = "使用新二维码重新连接接收端"
            }
        }
        Thread {
            Thread.sleep(500)
            ensureServerStarted()
        }.start()
    }

    private fun stopSession() {
        CaptureServerService.stop(this)
        appState?.setField("serverRunning", false)
        appState?.setField("viewerConnected", false)
        server = null
        isServerRunning = false
        tvServerStatus.text = "已停止服务器（链接与二维码保留）"
        tvSessionInfo.text = "点击开始再次启动（复用同一链接）"
        tvStatePanel.text = "服务器已停止"
    }

    private fun safeStartSession() {
        try {
            startSession()
        } catch (e: Throwable) {
            appState?.setField("lastError", "start session error: ${e.message}")
            tvServerStatus.text = "启动失败：${e.message}"
        }
    }

    private fun safeStopSession() {
        try {
            stopSession()
        } catch (e: Throwable) {
            appState?.setField("lastError", "stop session error: ${e.message}")
        }
    }

    private fun refreshAllButtons() {
        try {
            refreshAvatarButtons()
            refreshExprButtons()
            refreshActionButtons()
            refreshPresetButtons()
            updateFaceCaptureStatus()
            updateVoiceStatus()
            appState?.snapshot()?.let { updateStatePanel(it) }
        } catch (_: Throwable) {}
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        try {
            when (requestCode) {
                REQ_CAMERA -> {
                    val granted = grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
                    appState?.setField("cameraPermission", if (granted) "granted" else "denied")
                    if (isMinFaceTestMode) {
                        if (granted) {
                            startMinFaceCamera()
                        } else {
                            tvMinFaceStatus.text = "摄像头权限被拒绝"
                        }
                    } else if (granted) {
                        appState?.applyCommand("setFaceCapture", mapOf("enabled" to true))
                        appState?.applyCommand("setCaptureMode", mapOf("mode" to "real-camera"))
                        webView?.evaluateJavascript(
                            "(function() { if (window.CheapLiveCapture && window.CheapLiveCapture.startCamera) { window.CheapLiveCapture.startCamera('android-permission-result'); return 'startCamera-dispatched'; } else { return 'api-not-ready'; } })()"
                        ) { result ->
                            android.util.Log.i("CheapLiveCapture", "startCamera dispatch (from permission): $result")
                        }
                    } else {
                        appState?.applyCommand("setFaceCapture", mapOf("enabled" to false))
                        appState?.applyCommand("setCaptureMode", mapOf("mode" to "simulated"))
                        appState?.setField("lastError", "camera permission denied")
                        btnFaceToggle.text = "启用面捕"
                    }
                    refreshAllButtons()
                    updateFaceCaptureStatus()
                }
                REQ_AUDIO -> {
                    val granted = grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
                    appState?.setField("voicePermission", if (granted) "granted" else "denied")
                    if (isMinAudioTestMode) {
                        if (granted) {
                            startMinAudioMicrophone()
                        } else {
                            tvMinAudioStatus.text = "麦克风权限被拒绝"
                        }
                    }
                    refreshAllButtons()
                }
                REQ_PERMISSIONS -> {
                    val hasAudio = grantResults.isNotEmpty() &&
                            permissions.indexOf(Manifest.permission.RECORD_AUDIO).let { idx ->
                                idx >= 0 && grantResults[idx] == PackageManager.PERMISSION_GRANTED
                            }
                    appState?.setField("voicePermission", if (hasAudio) "granted" else "denied")
                    refreshAllButtons()
                }
            }
        } catch (e: Throwable) {
            appState?.setField("lastError", "permission result error: ${e.message}")
        }
    }


    private fun generateQRCode(text: String, size: Int): Bitmap? {
        return try {
            val hints = mapOf(
                EncodeHintType.MARGIN to 2,
                EncodeHintType.CHARACTER_SET to "UTF-8"
            )
            val writer = QRCodeWriter()
            val bitMatrix: com.google.zxing.common.BitMatrix = writer.encode(text, BarcodeFormat.QR_CODE, size, size, hints)
            val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.RGB_565)
            for (x in 0 until size) {
                for (y in 0 until size) {
                    bmp.setPixel(x, y, if (bitMatrix.get(x, y)) Color.BLACK else Color.WHITE)
                }
            }
            bmp
        } catch (_: Throwable) { null }
    }

    companion object {
        private const val PORT = 8765
        private const val REQ_PERMISSIONS = 1001
        private const val REQ_CAMERA = 1002
        private const val REQ_AUDIO = 1003
    }
}
