package com.cheaplive.capture

import android.webkit.JavascriptInterface
import org.json.JSONObject

class CaptureBridge(
    private val session: Session,
    private val broadcast: CaptureBroadcast,
    private val onStateChange: (String, String) -> Unit,
    private val appState: AppState? = null,
    private val configStore: FaceTrackingConfigStore? = null,
) {
    private val validAvatarTypes = setOf("mesh-spindle-whale", "mesh-sphere", "sacabambaspis", "sacabambaspis3d")

    private fun logDebug(tag: String, message: String) {
        runCatching { android.util.Log.d(tag, message) }
    }

    private fun logInfo(tag: String, message: String) {
        runCatching { android.util.Log.i(tag, message) }
    }

    private fun logWarn(tag: String, message: String) {
        runCatching { android.util.Log.w(tag, message) }
    }

    private fun logError(tag: String, message: String) {
        runCatching { android.util.Log.e(tag, message) }
    }

    @JavascriptInterface fun getSessionInfo(): String = JSONObject().apply {
        put("sessionId", session.sessionId)
        put("token", session.token)
        put("port", session.port)
        put("privateIp", session.privateIp)
        put("version", FaceFrameValidator.VERSION)
        put("serverRunning", true)
        put("wsClientCount", 0)
        put("receiverUrl", "http://127.0.0.1:${session.port}/min-face-receiver?token=${session.token}")
        put("audioReceiverUrl", "http://127.0.0.1:${session.port}/min-audio-receiver?token=${session.token}")
        put("audioReceiverUrlDebug", "http://127.0.0.1:${session.port}/min-audio-receiver?token=${session.token}")
        put("audioReceiverUrlLan", "http://${session.privateIp}:${session.port}/min-audio-receiver?token=${session.token}")
    }.toString()

    @JavascriptInterface fun setAvatarType(type: String): String {
        if (type !in validAvatarTypes) return JSONObject().put("ok", false).put("reason", "invalid avatar type").toString()
        return JSONObject().put("ok", true).put("avatar", type).toString()
    }

    @JavascriptInterface fun publishFaceFrame(json: String): String {
        logDebug("CheapLiveCapture", "publishFaceFrame received: ${json.take(120)}...")
        if (json.length > FaceFrameValidator.MAX_MESSAGE_BYTES) {
            logWarn("CheapLiveCapture", "publishFaceFrame rejected: too large (${json.length} bytes)")
            return "{\"ok\":false,\"reason\":\"too large\"}"
        }
        return try {
            val obj = JSONObject(json)
            val type = obj.optString("type", "")
            if (type != "face-frame") {
                logWarn("CheapLiveCapture", "publishFaceFrame rejected: wrong type=$type")
                return "{\"ok\":false,\"reason\":\"wrong type\"}"
            }
            val ver = obj.optInt("version", 0)
            if (ver != FaceFrameValidator.VERSION) {
                logWarn("CheapLiveCapture", "publishFaceFrame rejected: wrong version=$ver")
                return "{\"ok\":false,\"reason\":\"wrong version\"}"
            }
            val source = obj.optString("source", "unknown")
            logInfo("CheapLiveCapture", "publishFaceFrame: source=$source, seq=${obj.optLong("seq")}, avatar=${obj.optString("avatar")}")

            val p = obj.getJSONObject("params")
            val frame = FaceFrame(
                sessionId = session.sessionId,
                seq = session.seq++,
                timestamp = obj.optLong("timestamp", System.currentTimeMillis()),
                avatar = obj.optString("avatar", "sacabambaspis3d"),
                params = FaceParams(
                    eyeLeft = p.optDouble("eyeLeft", 1.0).toFloat(),
                    eyeRight = p.optDouble("eyeRight", 1.0).toFloat(),
                    mouthOpen = p.optDouble("mouthOpen", 0.0).toFloat(),
                    mouthSmile = p.optDouble("mouthSmile", 0.0).toFloat(),
                    browLeft = p.optDouble("browLeft", 0.0).toFloat(),
                    browRight = p.optDouble("browRight", 0.0).toFloat(),
                    headYaw = p.optDouble("headYaw", 0.0).toFloat(),
                    headPitch = p.optDouble("headPitch", 0.0).toFloat(),
                    headRoll = p.optDouble("headRoll", 0.0).toFloat(),
                    positionX = p.optDouble("positionX", 0.0).toFloat(),
                    positionY = p.optDouble("positionY", 0.0).toFloat(),
                    scale = p.optDouble("scale", 1.0).toFloat(),
                    tailPitch = p.optDouble("tailPitch", 0.0).toFloat(),
                    tailYaw = p.optDouble("tailYaw", 0.0).toFloat(),
                    tailWave = p.optDouble("tailWave", 0.0).toFloat(),
                ),
            )
            if (!FaceFrameValidator.validate(frame)) return "{\"ok\":false,\"reason\":\"invalid params\"}"
            session.currentFrame = frame
            val frameJson = JSONObject().apply {
                put("type", "face-frame")
                put("version", FaceFrameValidator.VERSION)
                put("sessionId", frame.sessionId)
                put("seq", frame.seq)
                put("timestamp", frame.timestamp)
                put("source", source)
                put("avatar", frame.avatar)
                val pp = JSONObject()
                val params = frame.params
                pp.put("eyeLeft", params.eyeLeft)
                pp.put("eyeRight", params.eyeRight)
                pp.put("mouthOpen", params.mouthOpen)
                pp.put("mouthSmile", params.mouthSmile)
                pp.put("browLeft", params.browLeft)
                pp.put("browRight", params.browRight)
                pp.put("headYaw", params.headYaw)
                pp.put("headPitch", params.headPitch)
                pp.put("headRoll", params.headRoll)
                pp.put("positionX", params.positionX)
                pp.put("positionY", params.positionY)
                pp.put("scale", params.scale)
                pp.put("tailPitch", params.tailPitch)
                pp.put("tailYaw", params.tailYaw)
                pp.put("tailWave", params.tailWave)
                put("params", pp)
            }.toString()
            broadcast.broadcastFrame(frameJson)
            "{\"ok\":true,\"seq\":${frame.seq}}"
        } catch (e: Exception) {
            "{\"ok\":false,\"reason\":\"parse\"}"
        }
    }

    @JavascriptInterface fun reportCaptureState(state: String, detail: String) {
        onStateChange(state, detail)
    }

    @JavascriptInterface fun requestMicrophonePermission(): String {
        onStateChange("request_microphone_permission", "")
        return "{\"ok\":true,\"requested\":true}"
    }

    @JavascriptInterface fun publishAudioLevel(json: String): String {
        return try {
            val obj = JSONObject(json)
            val type = obj.optString("type", "")
            if (type != "audio-level") {
                return "{\"ok\":false,\"reason\":\"wrong type\"}"
            }
            val level = obj.optDouble("level", 0.0).coerceIn(0.0, 1.0)
            val processedLevel = obj.optDouble("processedLevel", level).coerceIn(0.0, 1.0)
            val seq = session.seq++
            val frameJson = JSONObject().apply {
                put("type", "audio-level")
                put("version", 1)
                put("sessionId", session.sessionId)
                put("seq", seq)
                put("timestamp", System.currentTimeMillis())
                put("source", "microphone")
                put("level", level)
                put("processedLevel", processedLevel)
                put("audioMode", obj.optString("audioMode", "raw-level"))
                put("effectMode", obj.optString("effectMode", "off"))
            }.toString()
            broadcast.broadcastFrame(frameJson)
            "{\"ok\":true,\"seq\":$seq}"
        } catch (e: Exception) {
            "{\"ok\":false,\"reason\":\"parse\"}"
        }
    }

    @JavascriptInterface fun publishAudioChunk(json: String): String {
        return try {
            val obj = JSONObject(json)
            val type = obj.optString("type", "")
            if (type != "audio-chunk") {
                return "{\"ok\":false,\"reason\":\"wrong type\"}"
            }
            val seq = obj.optLong("seq", session.seq++)
            val timestamp = obj.optLong("timestamp", System.currentTimeMillis())
            val effectMode = obj.optString("effectMode", "original")
            val mimeType = obj.optString("mimeType", "audio/webm")
            val data = obj.optString("data", "")
            if (data.isEmpty()) {
                return "{\"ok\":false,\"reason\":\"empty data\"}"
            }
            logInfo("CheapLiveAudio", "publishAudioChunk: seq=$seq, effectMode=$effectMode, mimeType=$mimeType, dataSize=${data.length}")
            val frameJson = JSONObject().apply {
                put("type", "audio-chunk")
                put("version", 1)
                put("sessionId", session.sessionId)
                put("seq", seq)
                put("timestamp", timestamp)
                put("source", "microphone")
                put("effectMode", effectMode)
                put("mimeType", mimeType)
                put("data", data)
            }.toString()
            broadcast.broadcastFrame(frameJson)
            "{\"ok\":true,\"seq\":$seq}"
        } catch (e: Exception) {
            logError("CheapLiveAudio", "publishAudioChunk error: ${e.message}")
            "{\"ok\":false,\"reason\":\"parse\"}"
        }
    }

    // ============================================================
    // 面部追踪个体化配置（Capture App 是唯一权威来源）
    // ============================================================

    /** 返回当前配置 JSON（供 WebView capture 页面初始化时读取） */
    @JavascriptInterface fun getFaceTrackingConfig(): String {
        val config = appState?.faceTrackingConfig ?: FaceTrackingConfig()
        return config.toJson()
    }

    /** 返回当前校准状态 JSON */
    @JavascriptInterface fun getCalibrationStatus(): String {
        val s = appState?.calibrationStatus ?: CalibrationStatus()
        return JSONObject().apply {
            put("inProgress", s.inProgress)
            put("sampleCount", s.sampleCount)
            put("targetSamples", s.targetSamples)
            put("lastError", s.lastError)
        }.toString()
    }

    /**
     * WebView 上报一帧校准样本。
     * 期望 json: { "eyeLeft":0.7, "eyeRight":0.7, "mouthOpen":0.0, ... }
     * 返回 { ok, sampleCount, targetSamples, done }
     */
    @JavascriptInterface fun submitCalibrationSample(json: String): String {
        val state = appState ?: return "{\"ok\":false,\"reason\":\"no appState\"}"
        return try {
            val s = state.calibrationStatus
            if (!s.inProgress) {
                return "{\"ok\":false,\"reason\":\"not in progress\"}"
            }
            val obj = JSONObject(json)
            // 累加到 sums
            s.sums.eyeLeft += obj.optDouble("eyeLeft", 1.0)
            s.sums.eyeRight += obj.optDouble("eyeRight", 1.0)
            s.sums.mouthOpen += obj.optDouble("mouthOpen", 0.0)
            s.sums.mouthSmile += obj.optDouble("mouthSmile", 0.0)
            s.sums.browLeft += obj.optDouble("browLeft", 0.0)
            s.sums.browRight += obj.optDouble("browRight", 0.0)
            s.sums.headYaw += obj.optDouble("headYaw", 0.0)
            s.sums.headPitch += obj.optDouble("headPitch", 0.0)
            s.sums.headRoll += obj.optDouble("headRoll", 0.0)
            s.sums.positionX += obj.optDouble("positionX", 0.0)
            s.sums.positionY += obj.optDouble("positionY", 0.0)
            s.sampleCount += 1

            val done = s.sampleCount >= s.targetSamples
            if (done) {
                // 完成校准：计算均值，更新 faceTrackingConfig.calibration（保留 offset/scale）
                val avg = s.sums.average(s.sampleCount)
                val currentConfig = state.faceTrackingConfig
                state.faceTrackingConfig = currentConfig.copy(
                    calibration = avg,
                    calibrationEnabled = true,
                    revision = currentConfig.revision + 1L,
                )
                // 持久化（异步由 MainActivity listener 处理，这里同步触发一次保证及时落盘）
                val store = configStore
                val cfg = state.faceTrackingConfig
                if (store != null && cfg != null) {
                    try { store.save(cfg) } catch (_: Throwable) {}
                }
                // 重置校准状态
                state.calibrationStatus = CalibrationStatus()
                // 触发 SSE 广播（onStateChange 由 setField/applyCommand 触发；
                // 这里直接修改了字段，需要主动触发广播）
                state.setField("lastCommand", "calibrationCompleted(samples=${avg.sampleCount})")
            } else {
                // 更新进度（触发 SSE 广播给 Receiver）
                state.setField("lastCommand", "calibrationSample(${s.sampleCount}/${s.targetSamples})")
            }
            "{\"ok\":true,\"sampleCount\":${s.sampleCount},\"targetSamples\":${s.targetSamples},\"done\":$done}"
        } catch (e: Exception) {
            "{\"ok\":false,\"reason\":\"${e.message ?: "parse"}\"}"
        }
    }

    /**
     * Capture App 本地 UI（如 capture 页面的设置面板）直接提交完整配置 patch。
     * 与 Receiver 走 /api/control 不同，这里直接修改 appState 并广播。
     * 期望 json: { "baseRevision": N, "patch": { "offset": {...}, "scale": {...} } }
     */
    @JavascriptInterface fun updateFaceTrackingConfig(json: String): String {
        val state = appState ?: return "{\"ok\":false,\"reason\":\"no appState\"}"
        return try {
            val obj = JSONObject(json)
            val baseRevision = obj.optLong("baseRevision", -1L)
            val currentRevision = state.faceTrackingConfig.revision
            if (baseRevision >= 0 && baseRevision != currentRevision) {
                // 旧 revision，拒绝并返回当前配置
                return "{\"ok\":false,\"reason\":\"stale revision\",\"currentRevision\":$currentRevision,\"config\":${state.faceTrackingConfig.toJson()}}"
            }
            val patch = obj.optJSONObject("patch") ?: JSONObject()
            val newConfig = FaceTrackingConfigStore.mergePatchIntoConfig(state.faceTrackingConfig, patch)
            state.faceTrackingConfig = newConfig
            // 持久化（异步由 MainActivity listener 处理，这里同步触发一次保证及时落盘）
            val store = configStore
            if (store != null) {
                try { store.save(newConfig) } catch (_: Throwable) {}
            }
            // 触发 SSE 广播
            state.setField("lastCommand", "updateFaceTrackingConfig(rev=${newConfig.revision})")
            "{\"ok\":true,\"revision\":${newConfig.revision},\"config\":${newConfig.toJson()}}"
        } catch (e: Exception) {
            "{\"ok\":false,\"reason\":\"${e.message ?: "parse"}\"}"
        }
    }

    /**
     * Capture App 本地触发校准（如设置面板的"开始校准"按钮）。
     * action: "start" | "cancel"
     */
    @JavascriptInterface fun triggerCalibration(action: String): String {
        val state = appState ?: return "{\"ok\":false,\"reason\":\"no appState\"}"
        val result = state.applyCommand("triggerCalibration", mapOf("action" to action))
        return JSONObject().apply {
            put("ok", result.ok)
            put("message", result.message)
            put("inProgress", state.calibrationStatus.inProgress)
            put("sampleCount", state.calibrationStatus.sampleCount)
            put("targetSamples", state.calibrationStatus.targetSamples)
        }.toString()
    }
}
