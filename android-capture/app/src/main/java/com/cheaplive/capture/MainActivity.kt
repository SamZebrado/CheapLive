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

    private var webView: WebView? = null
    private var server: LocalServer? = null
    private var session: Session? = null
    private var bridge: CaptureBridge? = null
    private var qrImageView: ImageView? = null
    private var currentSessionUrl: String = ""
    private var isServerRunning: Boolean = false
    private var appState: AppState? = null

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
    private val avatars = listOf("sacabambaspis" to "🐟 萨卡班甲鱼", "cat" to "🐱 猫", "dog" to "🐶 狗", "rabbit" to "🐰 兔子", "fox" to "🦊 狐狸", "bear" to "🐻 小熊")
    private val expressions = listOf("blink" to "😉 眨眼", "mouth" to "😮 张嘴", "smile" to "😊 微笑", "wide" to "😲 惊讶")
    private val actions = listOf("nod" to "🙆 点头", "look" to "👀 左右看", "tail" to "🐾 摇尾巴", "bounce" to "⬆️ 弹跳")
    private val presets = listOf("original" to "原声", "cute" to "可爱", "robot" to "机器人", "deep" to "低沉", "radio" to "电台")
    private val poseModes = listOf("simulated" to "模拟姿态", "real-camera" to "真实摄像头")
    private val bodyPoses = listOf("idle" to "站立", "lean_left" to "左倾", "lean_right" to "右倾", "paw_left" to "左前爪", "paw_right" to "右前爪", "crouch" to "蹲伏", "jump" to "跳跃", "tail_wag" to "摆尾", "bounce" to "弹跳")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val scroll = ScrollView(this).apply {
            setBackgroundColor(cBg)
            isFillViewport = true
        }
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, 0, 0, 48)
        }
        scroll.addView(root, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.MATCH_PARENT))

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

        webView = WebView(this).apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0).apply { weight = 0f; height = 1 }
            visibility = View.GONE
        }
        root.addView(webView)

        setContentView(scroll)
        setupWebView()
        btnStart.setOnClickListener { safeStartSession() }
        btnStop.setOnClickListener { safeStopSession() }

        // 进入页面时立即初始化 appState，避免 null 导致的崩溃
        if (appState == null) {
            appState = AppState()
        }

        // 进入页面时提前生成 session/token/二维码
        val initialIp = PrivateIpPicker.pick()
        if (initialIp != null && session == null) {
            val s = SessionManager.createSession(initialIp, PORT)
            session = s
            val previewLink = "http://${s.privateIp}:${s.port}/receiver/?token=${s.token}"
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
        showCapturePage()
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
            val url = "http://${s.privateIp}:${s.port}/receiver/?token=${s.token}"
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
        root.addView(card)
    }

    // ============================================================
    // 二维码区
    // ============================================================
    private fun buildQrSection(root: LinearLayout) {
        val card = makeCard()
        addCardTitle(card, "📱 会话链接", "扫码连接")

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
        val current = appState?.avatar ?: "sacabambaspis"
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

        wv.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url?.toString() ?: return true
                return !url.startsWith("file:///android_asset/")
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
                    val allowed = wanted.filter {
                        it == PermissionRequest.RESOURCE_VIDEO_CAPTURE ||
                        it == PermissionRequest.RESOURCE_AUDIO_CAPTURE
                    }.toTypedArray()
                    if (allowed.isNotEmpty()) r.grant(allowed) else r.deny()
                }
            }
        }
    }

    private fun showCapturePage() {
        webView?.loadUrl("file:///android_asset/web/capture/index.html")
    }

    private fun startSession() {
        if (isServerRunning) {
            tvServerStatus.text = "服务器已在运行中（链接与二维码不变）"
            return
        }
        val ip = PrivateIpPicker.pick()
        if (ip == null) {
            tvServerStatus.text = "无法获取局域网 IP，请检查 Wi-Fi"
            return
        }
        val existingSession = session
        val baseSession = existingSession ?: SessionManager.createSession(ip, PORT)
        val srv = LocalServer(this, baseSession)
        val actualPort = try { srv.start() } catch (t: Throwable) {
            tvServerStatus.text = "服务器启动失败：${t.message}"
            return
        }
        val finalSession = baseSession.copy(port = actualPort, privateIp = ip)
        session = finalSession
        server = srv
        // 保存本地已设置的状态，替换到新 AppState 中
        val prevSnap = appState?.snapshot()
        appState = srv.getAppState()
        if (prevSnap != null) {
            appState?.let { s ->
                s.avatar = prevSnap.avatar
                s.avatarExpression = prevSnap.avatarExpression
                s.avatarAction = prevSnap.avatarAction
                s.voicePreset = prevSnap.voicePreset
                s.voiceChangerEnabled = prevSnap.voiceChangerEnabled
                s.faceCaptureEnabled = prevSnap.faceCaptureEnabled
                s.subtitleEnabled = prevSnap.subtitleEnabled
                s.captureMode = prevSnap.captureMode
                s.voicePermission = prevSnap.voicePermission
                s.cameraPermission = prevSnap.cameraPermission
            }
        }
        appState?.setField("serverRunning", true)
        appState?.setField("viewerConnected", true)
        // set voice permission based on current state
        val hasAudio = ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        appState?.setField("voicePermission", if (hasAudio) "granted" else "denied")
        isServerRunning = true

        // 监听状态变更，更新 UI 面板
        appState?.addListener { snap ->
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
            }
        }

        val b = bridge ?: CaptureBridge(finalSession, srv, { _, _ -> }).also { bridge = it }
        webView?.addJavascriptInterface(b, "CheapLiveBridge")
        val link = "http://${finalSession.privateIp}:$actualPort/receiver/?token=${finalSession.token}"
        currentSessionUrl = link
        tvServerStatus.text = if (existingSession == null) "会话已启动" else "会话已重启（链接与二维码不变）"
        tvSessionInfo.text = "扫描二维码或点击「复制链接」"
        qrImageView?.apply {
            visibility = View.VISIBLE
            setImageBitmap(generateQRCode(link, 600))
        }
    }

    private fun resetSession() {
        try { server?.stop() } catch (_: Throwable) {}
        server = null
        isServerRunning = false
        session = null
        bridge = null
        currentSessionUrl = ""
        qrImageView?.visibility = View.GONE
        tvServerStatus.text = "已重置会话"
        tvSessionInfo.text = "点击「开始多端会话」使用新链接"
    }

    private fun stopSession() {
        try { server?.stop() } catch (_: Throwable) {}
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
                    if (granted) {
                        appState?.applyCommand("setFaceCapture", mapOf("enabled" to true))
                        appState?.applyCommand("setCaptureMode", mapOf("mode" to "real-camera"))
                    } else {
                        appState?.applyCommand("setFaceCapture", mapOf("enabled" to false))
                        appState?.applyCommand("setCaptureMode", mapOf("mode" to "simulated"))
                        appState?.setField("lastError", "camera permission denied")
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
    }
}
