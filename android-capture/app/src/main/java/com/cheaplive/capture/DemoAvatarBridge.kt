package com.cheaplive.capture

import android.os.Handler
import android.os.Looper
import android.webkit.WebView
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

/**
 * 为 Android WebView 中演示页面提供程序化面部参数。
 *
 * 为了让这个类可以被 JUnit 单元测试（没有 Android runtime），核心逻辑（参数
 * 生成、tick 计数、暂停状态、avatar 状态回调）都被抽到纯 Kotlin 层；只有
 * "真正向 WebView 注入 JS" 的部分依赖 Android API。
 */
class DemoAvatarBridge(private val onAvatarChanged: (String) -> Unit) {

    private val paused = AtomicBoolean(false)
    private val tickCount = AtomicLong(0L)
    @Volatile private var avatar: String = "sphere"
    @Volatile private var webView: WebView? = null

    // 仅当在 Android 环境启动时才构造 Handler；测试环境可以不启动 ticker。
    private var ticker: Ticker? = null

    init {
        // 仅当 Android Looper 可用时才启动周期性任务；纯 JVM 测试环境中跳过。
        ticker = try {
            val looper = Looper.getMainLooper()
            if (looper != null) Ticker { emitFrame() } else null
        } catch (_: Throwable) {
            null
        }
    }

    /** 测试环境专用：不启动 ticker，只测试纯逻辑。 */
    constructor(onAvatarChanged: (String) -> Unit, skipTicker: Boolean) : this(onAvatarChanged) {
        if (skipTicker) {
            ticker?.dispose()
            ticker = null
        }
    }

    fun attachWebView(wv: WebView) {
        webView = wv
    }

    fun setAvatar(kind: String) {
        avatar = kind
        onAvatarChanged(kind)
    }

    fun getAvatar(): String = avatar

    fun getTickCount(): Long = tickCount.get()

    fun setPaused(p: Boolean) {
        paused.set(p)
    }

    fun isPaused(): Boolean = paused.get()

    /**
     * 以当前 tick 为基础生成一帧参数。这个函数是 "纯函数"：没有 Android 依赖，
     * 可在单元测试中直接调用以验证参数生成逻辑。
     */
    fun buildFramePayload(): String {
        val t = tickCount.get() * (TICK_MS / 1000.0)
        val headYaw = Math.sin(t / YAW_PERIOD)
        val headPitch = Math.sin(t / PITCH_PERIOD) * 0.5
        val headRoll = Math.sin(t / ROLL_PERIOD) * 0.3
        val blinkCycle = ((t % BLINK_EVERY) / BLINK_EVERY)
        val eyeOpen = if (blinkCycle < 0.15 || blinkCycle > 0.85) 0.2 else 1.0
        val mouthOpen = 0.5 + 0.5 * Math.sin(t * 1.5)
        val mouthSmile = if ((t.toInt() % 4) < 2) 0.6 * (0.5 + 0.5 * Math.sin(t)) else 0.0
        val browLeft = 0.3 * Math.sin(t / 3)
        val browRight = browLeft
        val positionX = 0.1 * Math.sin(t / 4)
        val tailPitch = Math.sin(t / 2.5)
        val tailYaw = Math.sin(t / 3.5)
        val tailWave = Math.sin(t / 1.5)
        val sb = StringBuilder(256)
        sb.append("{\"ok\":true,")
        sb.append("\"avatar\":\"").append(avatar).append("\",")
        sb.append("\"tick\":").append(tickCount.get()).append(',')
        sb.append("\"params\":{")
        sb.append("\"eyeLeft\":").append(fmt(eyeOpen)).append(',')
        sb.append("\"eyeRight\":").append(fmt(eyeOpen)).append(',')
        sb.append("\"mouthOpen\":").append(fmt(mouthOpen)).append(',')
        sb.append("\"mouthSmile\":").append(fmt(mouthSmile)).append(',')
        sb.append("\"browLeft\":").append(fmt(browLeft)).append(',')
        sb.append("\"browRight\":").append(fmt(browRight)).append(',')
        sb.append("\"headYaw\":").append(fmt(headYaw)).append(',')
        sb.append("\"headPitch\":").append(fmt(headPitch)).append(',')
        sb.append("\"headRoll\":").append(fmt(headRoll)).append(',')
        sb.append("\"positionX\":").append(fmt(positionX)).append(',')
        sb.append("\"positionY\":").append(fmt(0.0)).append(',')
        sb.append("\"scale\":").append(fmt(1.0)).append(',')
        sb.append("\"tailPitch\":").append(fmt(tailPitch)).append(',')
        sb.append("\"tailYaw\":").append(fmt(tailYaw)).append(',')
        sb.append("\"tailWave\":").append(fmt(tailWave)).append("}}")
        return sb.toString()
    }

    /** 推进一次 tick，使参数 "前进" 一步。供 Android 主循环和测试使用。 */
    fun advanceTick() {
        tickCount.incrementAndGet()
    }

    fun startTicking() {
        if (ticker == null) {
            ticker = try {
                val looper = Looper.getMainLooper()
                if (looper != null) Ticker { emitFrame() } else null
            } catch (_: Throwable) {
                null
            }
        }
    }

    fun dispose() {
        ticker?.dispose()
        ticker = null
        webView = null
    }

    private fun emitFrame() {
        if (paused.get()) return
        advanceTick()
        val payload = buildFramePayload()
        val wv = webView ?: return
        val js = "javascript:if (window.CheapLiveDemo && typeof window.CheapLiveDemo.onFrame === 'function') { try { window.CheapLiveDemo.onFrame($payload); } catch (e) {} }"
        wv.post {
            try {
                @Suppress("DEPRECATION")
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.KITKAT) {
                    wv.evaluateJavascript(js, null)
                } else {
                    wv.loadUrl(js)
                }
            } catch (_: Throwable) {}
        }
    }

    private fun fmt(v: Double): String {
        return String.format("%.4f", v)
    }

    /**
     * 简单的周期性执行器。基于 Android Handler；对测试而言可安全跳过。
     */
    private class Ticker(private val onTick: () -> Unit) {
        private val handler = Handler(Looper.getMainLooper())
        private val running = AtomicBoolean(true)
        private val task = object : Runnable {
            override fun run() {
                if (!running.get()) return
                try { onTick() } catch (_: Throwable) {}
                handler.postDelayed(this, TICK_MS)
            }
        }

        init {
            handler.postDelayed(task, START_DELAY_MS)
        }

        fun dispose() {
            running.set(false)
            try { handler.removeCallbacks(task) } catch (_: Throwable) {}
        }
    }

    companion object {
        private const val TICK_MS = 80L
        private const val START_DELAY_MS = 500L
        private const val YAW_PERIOD = 2.0
        private const val PITCH_PERIOD = 3.0
        private const val ROLL_PERIOD = 5.0
        private const val BLINK_EVERY = 3.0
    }
}
