package com.cheaplive.capture

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONObject

/**
 * 面部追踪配置持久化（SharedPreferences）。
 *
 * 设计选择：
 * - 使用 SharedPreferences（轻量、同步可读、Android 原生）
 * - 配置整体以 JSON 字符串形式保存为一个 key，简化读写
 * - 同时保留 revision 字段单独读写，便于启动时快速判断是否需要迁移
 *
 * 调用线程：建议主线程或单线程；SharedPreferences 本身线程安全但跨线程写入需注意。
 */
class FaceTrackingConfigStore(private val context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /** 当前持久化的配置（若不存在则返回默认） */
    fun load(): FaceTrackingConfig {
        val json = prefs.getString(KEY_CONFIG, null) ?: return FaceTrackingConfig()
        return try {
            FaceTrackingConfig.fromJson(json)
        } catch (_: Throwable) {
            // 损坏的 JSON 不影响应用启动，回退默认
            FaceTrackingConfig()
        }
    }

    /** 完整写入配置 */
    fun save(config: FaceTrackingConfig) {
        prefs.edit().apply {
            putString(KEY_CONFIG, config.toJson())
            putLong(KEY_REVISION, config.revision)
            apply()
        }
    }

    /** 仅更新 revision（用于轻量冲突检测） */
    fun updateRevision(rev: Long) {
        prefs.edit().putLong(KEY_REVISION, rev).apply()
    }

    /** 当前 revision（不解析整个 JSON，快速读取） */
    fun currentRevision(): Long = prefs.getLong(KEY_REVISION, 0L)

    /** 清空持久化配置（仅用于调试或用户主动重置） */
    fun clear() {
        prefs.edit().clear().apply()
    }

    /**
     * 合并 patch：仅更新指定字段。
     * patch 格式：{ "offset": {"eyeLeft": 0.1}, "scale": {"eyeLeft": 1.5} }
     * 未指定字段保留原值。
     */
    fun mergePatch(patch: JSONObject): FaceTrackingConfig {
        val current = load()
        val merged = mergePatchIntoConfig(current, patch)
        save(merged)
        return merged
    }

    companion object {
        private const val PREFS_NAME = "cheaplive_face_tracking_config"
        private const val KEY_CONFIG = "config_json"
        private const val KEY_REVISION = "revision"

        /**
         * 将 patch 合并进现有 config，并自增 revision。
         * 仅支持 offset / scale / calibrationEnabled / enableSmoothing 等顶层字段的合并。
         * calibration 由 triggerCalibration 流程单独写入，不走 patch 路径。
         */
        fun mergePatchIntoConfig(current: FaceTrackingConfig, patch: JSONObject): FaceTrackingConfig {
            var newConfig = current

            // offset
            val offsetPatch = patch.optJSONObject("offset")
            if (offsetPatch != null) {
                val mergedOffset = mergeOffset(current.offset, offsetPatch)
                newConfig = newConfig.copy(offset = mergedOffset)
            }

            // scale
            val scalePatch = patch.optJSONObject("scale")
            if (scalePatch != null) {
                val mergedScale = mergeScale(current.scale, scalePatch)
                newConfig = newConfig.copy(scale = mergedScale)
            }

            // 顶层布尔
            if (patch.has("calibrationEnabled")) {
                newConfig = newConfig.copy(calibrationEnabled = patch.optBoolean("calibrationEnabled"))
            }
            if (patch.has("enableSmoothing")) {
                newConfig = newConfig.copy(enableSmoothing = patch.optBoolean("enableSmoothing"))
            }
            if (patch.has("autoBlinkDetection")) {
                newConfig = newConfig.copy(autoBlinkDetection = patch.optBoolean("autoBlinkDetection"))
            }
            if (patch.has("smoothingFactor")) {
                newConfig = newConfig.copy(smoothingFactor = patch.optDouble("smoothingFactor", 0.2).toFloat())
            }
            if (patch.has("deadZone")) {
                newConfig = newConfig.copy(deadZone = patch.optDouble("deadZone", 0.02).toFloat())
            }

            // 自增 revision
            return newConfig.nextRevision()
        }

        private fun mergeOffset(current: OffsetData, patch: JSONObject): OffsetData {
            return current.copy(
                eyeLeft = patch.optDouble("eyeLeft", current.eyeLeft.toDouble()).toFloat(),
                eyeRight = patch.optDouble("eyeRight", current.eyeRight.toDouble()).toFloat(),
                mouthOpen = patch.optDouble("mouthOpen", current.mouthOpen.toDouble()).toFloat(),
                mouthSmile = patch.optDouble("mouthSmile", current.mouthSmile.toDouble()).toFloat(),
                browLeft = patch.optDouble("browLeft", current.browLeft.toDouble()).toFloat(),
                browRight = patch.optDouble("browRight", current.browRight.toDouble()).toFloat(),
                headYaw = patch.optDouble("headYaw", current.headYaw.toDouble()).toFloat(),
                headPitch = patch.optDouble("headPitch", current.headPitch.toDouble()).toFloat(),
                headRoll = patch.optDouble("headRoll", current.headRoll.toDouble()).toFloat(),
                positionX = patch.optDouble("positionX", current.positionX.toDouble()).toFloat(),
                positionY = patch.optDouble("positionY", current.positionY.toDouble()).toFloat(),
            )
        }

        private fun mergeScale(current: ScaleData, patch: JSONObject): ScaleData {
            return current.copy(
                eyeLeft = patch.optDouble("eyeLeft", current.eyeLeft.toDouble()).toFloat(),
                eyeRight = patch.optDouble("eyeRight", current.eyeRight.toDouble()).toFloat(),
                mouthOpen = patch.optDouble("mouthOpen", current.mouthOpen.toDouble()).toFloat(),
                mouthSmile = patch.optDouble("mouthSmile", current.mouthSmile.toDouble()).toFloat(),
                browLeft = patch.optDouble("browLeft", current.browLeft.toDouble()).toFloat(),
                browRight = patch.optDouble("browRight", current.browRight.toDouble()).toFloat(),
                headYaw = patch.optDouble("headYaw", current.headYaw.toDouble()).toFloat(),
                headPitch = patch.optDouble("headPitch", current.headPitch.toDouble()).toFloat(),
                headRoll = patch.optDouble("headRoll", current.headRoll.toDouble()).toFloat(),
                positionX = patch.optDouble("positionX", current.positionX.toDouble()).toFloat(),
                positionY = patch.optDouble("positionY", current.positionY.toDouble()).toFloat(),
            )
        }
    }
}
