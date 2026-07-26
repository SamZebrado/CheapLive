package com.cheaplive.capture

import android.app.Activity
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.Window
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.TextView
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

/** Applies black-screen window effects without touching the WebView or capture pipeline. */
class BlackScreenCaptureController(
    private val activity: Activity,
    private val state: BlackScreenCaptureState = BlackScreenCaptureState(),
    private val brightnessStore: BlackScreenBrightnessStore = BlackScreenBrightnessStore(activity),
) {
    private val handler = Handler(Looper.getMainLooper())
    private var overlayView: BlackScreenOverlayView? = null
    private var hideHintRunnable: Runnable? = null
    private var restoreSystemBarsRunnable: Runnable? = null
    private var activeChangedListener: ((Boolean) -> Unit)? = null
    private var pendingRestoredSystemBars: Triple<Boolean, Int, Int>? = null
    private var destroyed = false

    init {
        state.restoreBrightnessLevel(brightnessStore.load())
    }

    fun isActive(): Boolean = state.isActive()

    fun setOnActiveChangedListener(listener: ((Boolean) -> Unit)?) {
        requireMainThread()
        activeChangedListener = listener
        listener?.invoke(isActive())
    }

    /** Idempotently enter using a one-time snapshot of the current Activity window. */
    fun enter() {
        requireMainThread()
        if (destroyed) return
        cancelPendingSystemBarsRestore()
        when (val transition = state.enter(captureWindowState(activity.window))) {
            BlackScreenCaptureState.Transition.NoOp -> Unit
            is BlackScreenCaptureState.Transition.ApplyEnter -> {
                try {
                    applyKeepScreenOn(activity.window, true)
                    applyBrightness(activity.window, transition.brightness)
                    hideSystemBars(activity.window)
                    attachOverlay()
                    check(state.completeEnter()) { "Black-screen enter transition was not pending" }
                    activeChangedListener?.invoke(true)
                } catch (error: Throwable) {
                    Log.e(TAG, "Failed to enter black-screen capture; restoring window", error)
                    rollbackFailedEnter()
                }
            }
            is BlackScreenCaptureState.Transition.ApplyExit -> Unit
        }
    }

    /** Idempotently exit and restore the exact captured window state. */
    fun exit() {
        requireMainThread()
        when (val transition = state.exit()) {
            BlackScreenCaptureState.Transition.NoOp -> detachOverlay()
            is BlackScreenCaptureState.Transition.ApplyExit -> {
                try {
                    restoreWindowState(activity.window, transition.saved)
                } finally {
                    state.completeExit()
                    activeChangedListener?.invoke(false)
                }
            }
            is BlackScreenCaptureState.Transition.ApplyEnter -> Unit
        }
    }

    fun setBrightnessLevel(level: BlackScreenCaptureState.BrightnessLevel) {
        requireMainThread()
        state.setBrightnessLevel(level)
        brightnessStore.save(level)
        state.savedWindowState?.takeIf { isActive() }?.let { saved ->
            applyBrightness(
                activity.window,
                state.brightnessValueForLevel(level, saved.screenBrightness),
            )
        }
    }

    fun currentBrightnessLevel(): BlackScreenCaptureState.BrightnessLevel = state.brightnessLevel

    /** A recreated Activity gets a fresh window snapshot; a cold launch remains inactive. */
    fun restoreOnCreate(savedInstanceStateActive: Boolean) {
        requireMainThread()
        if (savedInstanceStateActive) {
            enter()
        } else {
            state.markColdStartInactive()
            // A killed/updated process can leave an OEM window transition with
            // the previous immersive request still visible. A normal cold
            // launch is never black-screen mode, so establish a deterministic
            // visible-bars baseline before any future session snapshot.
            showSystemBarsForColdStart(activity.window)
        }
    }

    fun handleBackPress(): Boolean {
        requireMainThread()
        if (!isActive()) return false
        exit()
        return true
    }

    /** Re-hide transient bars if window focus returns while the mode is active. */
    fun onWindowFocusChanged(hasFocus: Boolean) {
        requireMainThread()
        if (hasFocus && isActive()) hideSystemBars(activity.window)
    }

    /** Release callbacks and restore the host window without touching capture resources. */
    fun destroy() {
        requireMainThread()
        if (destroyed) return
        if (isActive()) exit() else detachOverlay()
        destroyed = true
        activeChangedListener = null
        handler.removeCallbacksAndMessages(null)
    }

    private fun captureWindowState(window: Window): BlackScreenCaptureState.SavedWindowState {
        val attrs = window.attributes
        val keepScreenOn = attrs.flags and WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON != 0
        val insetsController = WindowInsetsControllerCompat(window, window.decorView)
        val legacyVisibility = window.decorView.systemUiVisibility
        val appRequestedFullscreen = attrs.flags and WindowManager.LayoutParams.FLAG_FULLSCREEN != 0 ||
            legacyVisibility and (View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION) != 0
        // MIUI can report stale RootWindowInsets visibility for several seconds
        // after an insets animation. Snapshot the app's own window request
        // instead: this is the authoritative state that the controller owns.
        val requestedBarsVisible = !appRequestedFullscreen
        // Insets visibility is updated asynchronously after show(). A rapid
        // enter -> exit -> enter cycle must not snapshot the transient hidden
        // value and then incorrectly keep bars hidden after the next exit.
        val restoredBars = pendingRestoredSystemBars
        pendingRestoredSystemBars = null
        Log.i(
            TAG,
            "capture window barsVisible=$requestedBarsVisible restored=${restoredBars?.first} " +
                "behavior=${insetsController.systemBarsBehavior} legacy=$legacyVisibility",
        )
        return BlackScreenCaptureState.SavedWindowState(
            keepScreenOn = keepScreenOn,
            screenBrightness = state.normalizeWindowBrightness(attrs.screenBrightness),
            systemBarsVisible = restoredBars?.first ?: requestedBarsVisible,
            systemBarsBehavior = restoredBars?.second ?: insetsController.systemBarsBehavior,
            decorSystemUiVisibility = restoredBars?.third ?: legacyVisibility,
        )
    }

    private fun rollbackFailedEnter() {
        val transition = state.exit()
        if (transition is BlackScreenCaptureState.Transition.ApplyExit) {
            try {
                restoreWindowState(activity.window, transition.saved)
            } finally {
                state.completeExit()
            }
        } else {
            detachOverlay()
        }
        activeChangedListener?.invoke(false)
    }

    private fun restoreWindowState(
        window: Window,
        saved: BlackScreenCaptureState.SavedWindowState,
    ) {
        detachOverlay()
        applyKeepScreenOn(window, saved.keepScreenOn)
        applyBrightness(window, saved.screenBrightness)
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        Log.i(
            TAG,
            "restore window barsVisible=${saved.systemBarsVisible} " +
                "behavior=${saved.systemBarsBehavior} legacy=${saved.decorSystemUiVisibility}",
        )
        controller.systemBarsBehavior = saved.systemBarsBehavior
        // Restore legacy visibility first, then the compat controller. On some
        // OEM Android builds the hide animation finishes after exit() and can
        // otherwise overwrite a single synchronous show() request.
        window.decorView.systemUiVisibility = saved.decorSystemUiVisibility
        if (saved.systemBarsVisible) {
            controller.show(WindowInsetsCompat.Type.systemBars())
            scheduleSystemBarsRestore(window, saved)
        } else {
            cancelPendingSystemBarsRestore()
            controller.hide(WindowInsetsCompat.Type.systemBars())
        }
        pendingRestoredSystemBars = Triple(
            saved.systemBarsVisible,
            saved.systemBarsBehavior,
            saved.decorSystemUiVisibility,
        )
    }

    private fun scheduleSystemBarsRestore(
        window: Window,
        saved: BlackScreenCaptureState.SavedWindowState,
    ) {
        cancelPendingSystemBarsRestore()
        val runnable = Runnable {
            restoreSystemBarsRunnable = null
            if (destroyed || isActive()) return@Runnable
            window.decorView.systemUiVisibility = saved.decorSystemUiVisibility
            WindowInsetsControllerCompat(window, window.decorView).apply {
                systemBarsBehavior = saved.systemBarsBehavior
                show(WindowInsetsCompat.Type.systemBars())
            }
        }
        restoreSystemBarsRunnable = runnable
        handler.postDelayed(runnable, SYSTEM_BARS_RESTORE_DELAY_MS)
    }

    private fun cancelPendingSystemBarsRestore() {
        restoreSystemBarsRunnable?.let(handler::removeCallbacks)
        restoreSystemBarsRunnable = null
    }

    private fun applyKeepScreenOn(window: Window, enabled: Boolean) {
        if (enabled) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }

    private fun applyBrightness(window: Window, value: Float) {
        val attrs = window.attributes
        attrs.screenBrightness = state.normalizeWindowBrightness(value)
        window.attributes = attrs
    }

    private fun hideSystemBars(window: Window) {
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    private fun showSystemBarsForColdStart(window: Window) {
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE
        WindowInsetsControllerCompat(window, window.decorView).show(
            WindowInsetsCompat.Type.systemBars(),
        )
    }

    private fun attachOverlay() {
        if (overlayView != null) return
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
            ?: error("Activity content root is unavailable")
        val overlay = BlackScreenOverlayView(activity).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
            setOnLongPressListener { exit() }
        }
        overlayView = overlay
        content.addView(overlay)
        showEnterHint(overlay)
    }

    private fun detachOverlay() {
        hideHintRunnable?.let(handler::removeCallbacks)
        hideHintRunnable = null
        val overlay = overlayView ?: return
        overlay.setOnLongPressListener(null)
        (overlay.parent as? ViewGroup)?.removeView(overlay)
        overlayView = null
    }

    private fun showEnterHint(overlay: BlackScreenOverlayView) {
        val hint = TextView(activity).apply {
            text = "黑屏采集已开启\n长按屏幕或按返回键退出"
            setTextColor(Color.WHITE)
            textSize = 14f
            gravity = Gravity.CENTER
            setBackgroundColor(Color.TRANSPARENT)
            importantForAccessibility = TextView.IMPORTANT_FOR_ACCESSIBILITY_NO
        }
        overlay.addView(
            hint,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            ),
        )
        val runnable = Runnable {
            if (hint.parent === overlay) overlay.removeView(hint)
            hideHintRunnable = null
        }
        hideHintRunnable = runnable
        handler.postDelayed(runnable, ENTER_HINT_MS)
    }

    private fun requireMainThread() {
        check(Looper.myLooper() == Looper.getMainLooper()) {
            "BlackScreenCaptureController must run on the main thread"
        }
    }

    companion object {
        private const val TAG = "BlackScreenCapture"
        private const val ENTER_HINT_MS = 3000L
        private const val SYSTEM_BARS_RESTORE_DELAY_MS = 250L
    }
}
