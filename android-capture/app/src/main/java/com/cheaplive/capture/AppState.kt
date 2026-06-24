package com.cheaplive.capture

import java.util.concurrent.CopyOnWriteArrayList

/**
 * 参赛版 App-Web 控制状态的单一来源。
 *
 * 所有控制命令（来自 App 本地 UI 或 Web 远程）都通过 [applyCommand] 修改状态，
 * 所有状态读取（API、UI、SSE）都通过 [snapshot] 获取一致快照。
 *
 * 状态变更后通过 [listeners] 通知订阅者（用于 SSE 推送和 App UI 刷新）。
 */
class AppState {

    @Volatile var serverRunning: Boolean = false
    @Volatile var faceCaptureEnabled: Boolean = false
    @Volatile var voiceChangerEnabled: Boolean = false
    @Volatile var voicePreset: String = "original"
    @Volatile var captureMode: String = "simulated" // simulated | real-camera
    @Volatile var subtitleEnabled: Boolean = false
    @Volatile var viewerConnected: Boolean = false
    @Volatile var frameCount: Long = 0L
    @Volatile var latencyMs: Int = 0
    @Volatile var lastCommand: String = ""
    @Volatile var lastError: String = ""
    @Volatile var updatedAt: Long = System.currentTimeMillis()

    private val listeners = CopyOnWriteArrayList<(AppStateSnapshot) -> Unit>()

    /** 添加状态变更监听器，立即返回当前快照 */
    fun addListener(listener: (AppStateSnapshot) -> Unit) {
        listeners.add(listener)
        listener(snapshot())
    }

    fun removeListener(listener: (AppStateSnapshot) -> Unit) {
        listeners.remove(listener)
    }

    /** 生成当前状态的不可变快照 */
    fun snapshot(): AppStateSnapshot = AppStateSnapshot(
        serverRunning = serverRunning,
        faceCaptureEnabled = faceCaptureEnabled,
        voiceChangerEnabled = voiceChangerEnabled,
        voicePreset = voicePreset,
        captureMode = captureMode,
        subtitleEnabled = subtitleEnabled,
        viewerConnected = viewerConnected,
        frameCount = frameCount,
        latencyMs = latencyMs,
        lastCommand = lastCommand,
        lastError = lastError,
        updatedAt = updatedAt,
    )

    /** 应用控制命令，返回成功/失败信息 */
    fun applyCommand(type: String, params: Map<String, Any?>): CommandResult {
        val result = when (type) {
            "setFaceCapture" -> {
                val enabled = params["enabled"] as? Boolean ?: false
                faceCaptureEnabled = enabled
                lastCommand = "setFaceCapture($enabled)"
                CommandResult(true, "face capture set to $enabled")
            }
            "setVoiceChanger" -> {
                val enabled = params["enabled"] as? Boolean ?: false
                voiceChangerEnabled = enabled
                lastCommand = "setVoiceChanger($enabled)"
                CommandResult(true, "voice changer set to $enabled")
            }
            "setVoicePreset" -> {
                val preset = params["preset"] as? String ?: "original"
                val validPresets = setOf("original", "chipmunk", "robot", "deep", "alien", "echo")
                if (preset !in validPresets) {
                    lastError = "invalid preset: $preset"
                    CommandResult(false, "invalid preset: $preset")
                } else {
                    voicePreset = preset
                    lastCommand = "setVoicePreset($preset)"
                    lastError = ""
                    CommandResult(true, "preset set to $preset")
                }
            }
            "setCaptureMode" -> {
                val mode = params["mode"] as? String ?: "simulated"
                if (mode != "simulated" && mode != "real-camera") {
                    lastError = "invalid capture mode: $mode"
                    CommandResult(false, "invalid capture mode: $mode")
                } else {
                    captureMode = mode
                    lastCommand = "setCaptureMode($mode)"
                    lastError = ""
                    CommandResult(true, "capture mode set to $mode")
                }
            }
            "setSubtitle" -> {
                val enabled = params["enabled"] as? Boolean ?: false
                subtitleEnabled = enabled
                lastCommand = "setSubtitle($enabled)"
                CommandResult(true, "subtitle set to $enabled")
            }
            "ping" -> {
                lastCommand = "ping"
                CommandResult(true, "pong")
            }
            else -> {
                lastError = "unknown command: $type"
                CommandResult(false, "unknown command: $type")
            }
        }

        updatedAt = System.currentTimeMillis()
        notifyListeners()
        return result
    }

    /** 直接设置字段（供 App 本地 UI 使用，不经过命令解析） */
    fun setField(field: String, value: Any?) {
        when (field) {
            "serverRunning" -> serverRunning = value as? Boolean ?: false
            "viewerConnected" -> viewerConnected = value as? Boolean ?: false
            "frameCount" -> frameCount = value as? Long ?: 0L
            "latencyMs" -> latencyMs = value as? Int ?: 0
            "faceCaptureEnabled" -> faceCaptureEnabled = value as? Boolean ?: false
            "voiceChangerEnabled" -> voiceChangerEnabled = value as? Boolean ?: false
        }
        updatedAt = System.currentTimeMillis()
        notifyListeners()
    }

    private fun notifyListeners() {
        val snap = snapshot()
        for (listener in listeners) {
            try { listener(snap) } catch (_: Throwable) {}
        }
    }
}

/** 不可变状态快照，用于序列化为 JSON */
data class AppStateSnapshot(
    val serverRunning: Boolean,
    val faceCaptureEnabled: Boolean,
    val voiceChangerEnabled: Boolean,
    val voicePreset: String,
    val captureMode: String,
    val subtitleEnabled: Boolean,
    val viewerConnected: Boolean,
    val frameCount: Long,
    val latencyMs: Int,
    val lastCommand: String,
    val lastError: String,
    val updatedAt: Long,
)

/** 命令执行结果 */
data class CommandResult(
    val ok: Boolean,
    val message: String,
)

/** 将 AppStateSnapshot 序列化为 JSON 字符串 */
fun AppStateSnapshot.toJson(): String {
    val sb = StringBuilder()
    sb.append('{')
    sb.append("\"serverRunning\":$serverRunning")
    sb.append(",\"faceCaptureEnabled\":$faceCaptureEnabled")
    sb.append(",\"voiceChangerEnabled\":$voiceChangerEnabled")
    sb.append(",\"voicePreset\":\"").append(escapeJson(voicePreset)).append('"')
    sb.append(",\"captureMode\":\"").append(escapeJson(captureMode)).append('"')
    sb.append(",\"subtitleEnabled\":$subtitleEnabled")
    sb.append(",\"viewerConnected\":$viewerConnected")
    sb.append(",\"frameCount\":$frameCount")
    sb.append(",\"latencyMs\":$latencyMs")
    sb.append(",\"lastCommand\":\"").append(escapeJson(lastCommand)).append('"')
    sb.append(",\"lastError\":\"").append(escapeJson(lastError)).append('"')
    sb.append(",\"updatedAt\":$updatedAt")
    sb.append('}')
    return sb.toString()
}

private fun escapeJson(s: String): String {
    val sb = StringBuilder()
    for (c in s) {
        when (c) {
            '"' -> sb.append("\\\"")
            '\\' -> sb.append("\\\\")
            '\n' -> sb.append("\\n")
            '\r' -> sb.append("\\r")
            '\t' -> sb.append("\\t")
            else -> sb.append(c)
        }
    }
    return sb.toString()
}
