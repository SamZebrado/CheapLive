package com.cheaplive.capture

import android.content.Context

/**
 * Persists only the user's chosen brightness tier for Black Screen Capture.
 *
 * Privacy contract:
 * - Stores a single string preference (the [BlackScreenCaptureState.BrightnessLevel] name).
 * - Does NOT persist "is the device currently in black-screen mode".
 *   Cold starts must not auto-enter black-screen mode; see
 *   [BlackScreenCaptureState.markColdStartInactive].
 * - Does NOT store tokens, IPs, camera frames, or any user content.
 */
class BlackScreenBrightnessStore(context: Context) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun load(): BlackScreenCaptureState.BrightnessLevel {
        val raw = prefs.getString(KEY_LEVEL, BlackScreenCaptureState.BrightnessLevel.EXTRA_DIM.name)
        return BlackScreenCaptureState.parseBrightnessLevel(raw)
    }

    fun save(level: BlackScreenCaptureState.BrightnessLevel) {
        prefs.edit().putString(KEY_LEVEL, level.name).apply()
    }

    companion object {
        private const val PREFS_NAME = "cheaplive_black_screen_capture"
        private const val KEY_LEVEL = "brightness_level"
    }
}
