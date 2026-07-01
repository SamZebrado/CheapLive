package com.cheaplive.capture

import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.cheaplive.capture.BuildConfig

/**
 * 应用入口首页 — 参赛 demo 风格，与 MainActivity 视觉统一。
 *
 * 两个主入口：
 * 1. Avatar 离线演示
 * 2. 摄像头面捕 / 多端会话
 */
class HomeActivity : AppCompatActivity() {

    private val cBg = Color.parseColor("#0a0e1a")
    private val cBgCard = Color.parseColor("#1a2236")
    private val cBgSecondary = Color.parseColor("#111827")
    private val cBorder = Color.parseColor("#2a3654")
    private val cText = Color.parseColor("#e8edf5")
    private val cTextSec = Color.parseColor("#8896b3")
    private val cTextMuted = Color.parseColor("#5a6a85")
    private val cAccent = Color.parseColor("#4fc3f7")
    private val cAccent2 = Color.parseColor("#69db7c")
    private val cWarning = Color.parseColor("#ffd43b")
    private val cDanger = Color.parseColor("#ff6b6b")
    private val cPurple = Color.parseColor("#b197fc")
    private val radiusCard = 28f
    private val radiusXs = 12f

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
        scroll.addView(
            root,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.MATCH_PARENT
            )
        )

        buildTopBar(root)
        buildAvatarEntryCard(root)
        buildCaptureEntryCard(root)
        buildAudioEntryCard(root)
        buildInfoCard(root)

        setContentView(scroll)
    }

    private fun buildTopBar(root: LinearLayout) {
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

        val subtitle = TextView(this).apply {
            text = "浏览器端虚拟形象面捕的 Android 参赛版"
            textSize = 13f
            setTextColor(cTextSec)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.topMargin = 20
            layoutParams = lp
        }
        bar.addView(subtitle)

        root.addView(bar)
    }

    private fun buildAvatarEntryCard(root: LinearLayout) {
        val card = makeCard()
        addCardTitle(card, "🎭 Avatar 离线演示", "稳定可用")

        val desc = TextView(this).apply {
            text = "离线程序化 3D 头像演示。球形 / 纺锤鲸鱼 / 多种动物，含表情与动作预览。无需网络与权限。"
            textSize = 12f
            setTextColor(cTextSec)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = 16
            layoutParams = lp
        }
        card.addView(desc)

        val btn = makePrimaryButton("进入 Avatar 演示")
        btn.setOnClickListener {
            startActivity(Intent(this, AvatarDemoActivity::class.java))
        }
        card.addView(btn)

        root.addView(card)
    }

    private fun buildCaptureEntryCard(root: LinearLayout) {
        val card = makeCard()
        addCardTitle(card, "📷 摄像头面捕 / 多端会话", "Testing")

        val desc = TextView(this).apply {
            text = "真实摄像头面捕 + 多端会话 + Web 控制面板。当前为 Testing 阶段，部分功能正在完善。"
            textSize = 12f
            setTextColor(cTextSec)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = 16
            layoutParams = lp
        }
        card.addView(desc)

        val featureList = TextView(this).apply {
            text = buildString {
                append("✓ 本地服务器 & Web 控制面板\n")
                append("✓ Receiver 模拟预览\n")
                append("✓ Avatar / 表情 / 动作控制\n")
                append("✓ 变声 UI & 状态 API\n")
                append("○ 真实摄像头面捕 (Testing)")
            }
            textSize = 11f
            setTextColor(cTextMuted)
            setPadding(20, 12, 20, 12)
            setBackgroundColor(cBgSecondary)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = 16
            layoutParams = lp
        }
        card.addView(featureList)

        val btn = makePrimaryButton("进入参赛控制界面")
        btn.setOnClickListener {
            startActivity(Intent(this, MainActivity::class.java))
        }
        card.addView(btn)

        root.addView(card)
    }

    private fun buildAudioEntryCard(root: LinearLayout) {
        val card = makeCard()
        addCardTitle(card, "🎧 声音输入与变声", "测试")

        val desc = TextView(this).apply {
            text = "麦克风音量检测、局域网 receiver、简单非 AI 变声原型。支持多设备通过 LAN URL 查看音量和变声效果。"
            textSize = 12f
            setTextColor(cTextSec)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = 16
            layoutParams = lp
        }
        card.addView(desc)

        val featureList = TextView(this).apply {
            text = buildString {
                append("✓ 麦克风音量采集与实时监控\n")
                append("✓ 简单变声效果（off / robot / low-pass / monster）\n")
                append("✓ 局域网 LAN URL + QR 二维码\n")
                append("✓ WebSocket 接收端双表显示\n")
                append("○ 完整直播音频路由未完成")
            }
            textSize = 11f
            setTextColor(cTextMuted)
            setPadding(20, 12, 20, 12)
            setBackgroundColor(cBgSecondary)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = 16
            layoutParams = lp
        }
        card.addView(featureList)

        val btn = makeSecondaryButton("开始声音输入测试")
        btn.setOnClickListener {
            startActivity(Intent(this, MainActivity::class.java).putExtra("MODE", "MIN_AUDIO_TEST"))
        }
        card.addView(btn)

        root.addView(card)
    }

    private fun buildInfoCard(root: LinearLayout) {
        val card = makeCard()
        addCardTitle(card, "ℹ️ 关于", "版本信息")

        val info = TextView(this).apply {
            text = buildString {
                append("应用版本: ").append(BuildConfig.VERSION_NAME)
                    append(" (").append(BuildConfig.VERSION_CODE).append(")\n")
                append("Android: ").append(Build.VERSION.RELEASE)
                    append(" (SDK ").append(Build.VERSION.SDK_INT).append(")\n")
                append("型号: ").append(Build.MODEL).append('\n')
                append("品牌: ").append(Build.BRAND).append('\n')
                append("—\n")
                append("参赛期间，Android APK、Android 源代码和 App 端闭源实现暂不公开。")
            }
            textSize = 11f
            setTextColor(cTextSec)
            setPadding(20, 12, 20, 12)
            setBackgroundColor(cBgSecondary)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            layoutParams = lp
        }
        card.addView(info)

        root.addView(card)
    }

    private fun makeCard(): LinearLayout {
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(cBgCard)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.setMargins(32, 12, 32, 12)
            layoutParams = lp
            setPadding(36, 32, 36, 32)
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
            this.text = title
            textSize = 15f
            setTypeface(null, Typeface.BOLD)
            setTextColor(cText)
        }
        row.addView(tv)
        val badgeColor = when (badge) {
            "稳定可用" -> cAccent2
            "Testing" -> cWarning
            "版本信息" -> cPurple
            else -> cAccent
        }
        val badgeView = TextView(this).apply {
            this.text = badge
            textSize = 9f
            setTypeface(null, Typeface.BOLD)
            setTextColor(badgeColor)
            setBackgroundColor(Color.argb(30, Color.red(badgeColor), Color.green(badgeColor), Color.blue(badgeColor)))
            setPadding(12, 4, 12, 4)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.marginStart = 16
            layoutParams = lp
        }
        row.addView(badgeView)
        card.addView(row)
    }

    private fun makePrimaryButton(text: String): Button {
        return Button(this).apply {
            this.text = text
            textSize = 13f
            setTypeface(null, Typeface.BOLD)
            setTextColor(cBg)
            setBackgroundColor(cAccent)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.topMargin = 8
            layoutParams = lp
            setPadding(0, 28, 0, 28)
            background = createRoundedDrawable(cAccent, radiusXs)
        }
    }

    private fun makeSecondaryButton(text: String): Button {
        return Button(this).apply {
            this.text = text
            textSize = 13f
            setTypeface(null, Typeface.BOLD)
            setTextColor(cBg)
            setBackgroundColor(cAccent2)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.topMargin = 8
            layoutParams = lp
            setPadding(0, 28, 0, 28)
            background = createRoundedDrawable(cAccent2, radiusXs)
        }
    }

    private fun createRoundedDrawable(color: Int, radius: Float): android.graphics.drawable.Drawable {
        val shape = android.graphics.drawable.GradientDrawable()
        shape.setColor(color)
        shape.cornerRadius = radius
        return shape
    }
}
