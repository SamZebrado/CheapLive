package com.cheaplive.capture

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.cheaplive.capture.BuildConfig

/**
 * 应用入口主页。
 *
 * 设计目标：
 * 1. 首屏可见开发状态信息，避免用户把未完成功能当成可交付功能
 * 2. 提供离线 Avatar 演示入口：这是当前 APK 已经可稳定运行的功能
 * 3. 多端协作/摄像头面捕保持为入口但明确标注"开发中/待真机验证"
 * 4. 开发者诊断面板默认折叠，不遮挡主要交互
 */
class HomeActivity : AppCompatActivity() {

    private var diagnosticOpen = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val scroll = ScrollView(this).apply {
            isFillViewport = true
        }
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 24, 32, 32)
        }
        scroll.addView(
            root,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.MATCH_PARENT
            )
        )

        // 标题
        val title = TextView(this).apply {
            text = "CheapLive Capture"
            textSize = 22f
        }
        root.addView(title, matchWrap())

        val subtitle = TextView(this).apply {
            text = "浏览器端虚拟形象面捕的 Android 演示版"
            textSize = 13f
            setPadding(0, 4, 0, 12)
        }
        root.addView(subtitle, matchWrap())

        // 开发状态
        val status = TextView(this).apply {
            text = "🚧 当前处于积极开发阶段。真实设备多端链路和摄像头面捕尚未验证。"
            textSize = 13f
            setPadding(0, 0, 0, 12)
        }
        root.addView(status, matchWrap())

        // 版本信息
        val version = TextView(this).apply {
            text = buildString {
                append("应用版本: ").append(BuildConfig.VERSION_NAME)
                append(" (").append(BuildConfig.VERSION_CODE).append(")\n")
                append("Android: ").append(Build.VERSION.RELEASE).append(" (SDK ")
                append(Build.VERSION.SDK_INT).append(")")
            }
            textSize = 12f
            setPadding(0, 0, 0, 16)
        }
        root.addView(version, matchWrap())

        // === 主要入口 ===
        val sectionPrimary = TextView(this).apply {
            text = "当前可体验"
            textSize = 15f
            setPadding(0, 8, 0, 8)
        }
        root.addView(sectionPrimary, matchWrap())

        val btnAvatarDemo = Button(this).apply {
            text = "🎭 Avatar 离线演示 (球形 / 纺锤鲸鱼)"
        }
        btnAvatarDemo.setOnClickListener {
            startActivity(Intent(this, AvatarDemoActivity::class.java))
        }
        root.addView(btnAvatarDemo, matchWrap())

        // === 开发中入口 ===
        val sectionDev = TextView(this).apply {
            text = "开发中 / 待真机验证"
            textSize = 15f
            setPadding(0, 16, 0, 8)
        }
        root.addView(sectionDev, matchWrap())

        val btnCameraCapture = Button(this).apply {
            text = "📷 摄像头面捕 (开发中)"
            isEnabled = true
        }
        btnCameraCapture.setOnClickListener {
            startActivity(Intent(this, MainActivity::class.java))
        }
        root.addView(btnCameraCapture, matchWrap())

        val btnMultiDevice = Button(this).apply {
            text = "🔗 多端会话托管 (开发中)"
            isEnabled = true
        }
        btnMultiDevice.setOnClickListener {
            val intent = Intent(this, MainActivity::class.java)
            intent.putExtra("focus_multi_device", true)
            startActivity(intent)
        }
        root.addView(btnMultiDevice, matchWrap())

        // === 规划中入口 ===
        val sectionPlan = TextView(this).apply {
            text = "规划中 (当前不可用)"
            textSize = 15f
            setPadding(0, 16, 0, 8)
        }
        root.addView(sectionPlan, matchWrap())

        val btnLive2D = Button(this).apply {
            text = "🎨 Live2D Cubism (规划中)"
            isEnabled = false
        }
        root.addView(btnLive2D, matchWrap())

        // === 开发者诊断面板 ===
        val sectionDiagnostic = TextView(this).apply {
            text = "开发者诊断"
            textSize = 15f
            setPadding(0, 16, 0, 8)
        }
        root.addView(sectionDiagnostic, matchWrap())

        val btnToggle = Button(this).apply {
            text = "展开 / 收起诊断面板"
        }
        val diagnosticView = TextView(this).apply {
            text = "点击上方按钮查看诊断信息"
            textSize = 12f
            setPadding(8, 8, 8, 8)
            visibility = View.GONE
        }
        btnToggle.setOnClickListener {
            diagnosticOpen = !diagnosticOpen
            diagnosticView.visibility = if (diagnosticOpen) View.VISIBLE else View.GONE
            if (diagnosticOpen) {
                diagnosticView.text = buildDiagnosticReport()
            }
        }
        root.addView(btnToggle, matchWrap())
        root.addView(diagnosticView, matchWrap())

        setContentView(scroll)
    }

    private fun matchWrap(): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            setMargins(0, 4, 0, 4)
        }

    private fun buildDiagnosticReport(): String {
        return buildString {
            append("应用包: ").append(packageName).append('\n')
            append("构建版本: ").append(BuildConfig.VERSION_NAME)
                append('(').append(BuildConfig.VERSION_CODE).append(")\n")
            append("Android SDK: ").append(Build.VERSION.SDK_INT).append('\n')
            append("型号: ").append(Build.MODEL).append('\n')
            append("品牌: ").append(Build.BRAND).append('\n')
            append("指纹: ").append(Build.FINGERPRINT).append('\n')
            append("---\n")
            append("备注: 本地 APK 以开发调试为目标，多端链路和摄像头面捕待真机验证。")
        }
    }
}
