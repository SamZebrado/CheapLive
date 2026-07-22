package com.cheaplive.capture

import android.content.Context
import org.json.JSONObject

data class MotionCaptureSettings(
    val enabled: Boolean = false,
    val mode: String = "real-camera",
    val performanceProfile: String = "low",
    val smoothing: Double = 0.35,
    val mirrored: Boolean = true,
    val debugSkeleton: Boolean = false,
) {
    fun toJson(): String = JSONObject().apply {
        put("enabled", enabled)
        put("mode", mode)
        put("performanceProfile", performanceProfile)
        put("smoothing", smoothing)
        put("mirrored", mirrored)
        put("debugSkeleton", debugSkeleton)
    }.toString()

    companion object {
        fun fromState(state: AppState) = MotionCaptureSettings(
            enabled = state.poseCaptureEnabled,
            mode = state.poseMode,
            performanceProfile = state.posePerformanceProfile,
            smoothing = state.poseSmoothing,
            mirrored = state.poseMirrored,
            debugSkeleton = state.poseDebugSkeleton,
        )
    }
}

/** Persists settings only. Pose frames, landmarks, and telemetry are deliberately excluded. */
class MotionCaptureSettingsStore(context: Context) {
    private val prefs = context.getSharedPreferences("cheaplive_motion_capture", Context.MODE_PRIVATE)

    fun load(): MotionCaptureSettings {
        val profile = prefs.getString("performanceProfile", "low") ?: "low"
        val mode = prefs.getString("mode", "real-camera") ?: "real-camera"
        return MotionCaptureSettings(
            enabled = prefs.getBoolean("enabled", false),
            mode = mode.takeIf { it == "simulated" || it == "real-camera" } ?: "real-camera",
            performanceProfile = profile.takeIf { it in setOf("low", "balanced", "high") } ?: "low",
            smoothing = prefs.getFloat("smoothing", 0.35f).toDouble().coerceIn(0.0, 1.0),
            mirrored = prefs.getBoolean("mirrored", true),
            debugSkeleton = prefs.getBoolean("debugSkeleton", false),
        )
    }

    fun save(settings: MotionCaptureSettings) {
        prefs.edit()
            .putBoolean("enabled", settings.enabled)
            .putString("mode", settings.mode)
            .putString("performanceProfile", settings.performanceProfile)
            .putFloat("smoothing", settings.smoothing.toFloat())
            .putBoolean("mirrored", settings.mirrored)
            .putBoolean("debugSkeleton", settings.debugSkeleton)
            .apply()
    }

    fun applyTo(state: AppState, settings: MotionCaptureSettings = load()) {
        state.poseCaptureEnabled = settings.enabled
        state.poseMode = settings.mode
        state.posePerformanceProfile = settings.performanceProfile
        state.poseSmoothing = settings.smoothing
        state.poseMirrored = settings.mirrored
        state.poseDebugSkeleton = settings.debugSkeleton
        state.poseCaptureStatus = if (settings.enabled) "loading" else "off"
        state.poseModelStatus = if (settings.enabled) "loading" else "off"
    }
}
