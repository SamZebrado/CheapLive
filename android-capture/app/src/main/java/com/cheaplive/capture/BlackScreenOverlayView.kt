package com.cheaplive.capture

import android.content.Context
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.view.MotionEvent
import android.view.ViewConfiguration
import android.widget.FrameLayout
import kotlin.math.max

/**
 * Opaque content overlay used by black-screen capture mode.
 *
 * A tap is deliberately consumed without exiting. A stationary press held for
 * [longPressThresholdMs] invokes the exit callback once. Every pending callback
 * is removed when the gesture is cancelled or the view leaves the hierarchy.
 */
class BlackScreenOverlayView(
    context: Context,
    private val longPressThresholdMs: Long = DEFAULT_LONG_PRESS_MS,
    slopPx: Float = DEFAULT_SLOP_PX,
) : FrameLayout(context) {

    private val handler = Handler(Looper.getMainLooper())
    private val allowedSlopPx = max(slopPx, ViewConfiguration.get(context).scaledTouchSlop.toFloat())
    private var longPressListener: (() -> Unit)? = null
    private var pendingLongPress: Runnable? = null
    private var pointerDown = false
    private var callbackFired = false
    private var downX = 0f
    private var downY = 0f

    init {
        setBackgroundColor(Color.BLACK)
        isClickable = true
        isFocusable = true
        isLongClickable = true
        contentDescription = "黑屏采集。长按退出。Black Screen Capture. Long press to exit."
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_YES
    }

    fun setOnLongPressListener(listener: (() -> Unit)?) {
        longPressListener = listener
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                cancelPendingLongPress()
                pointerDown = true
                callbackFired = false
                downX = event.x
                downY = event.y
                scheduleLongPress()
                return true
            }

            MotionEvent.ACTION_MOVE -> {
                val dx = event.x - downX
                val dy = event.y - downY
                if (dx * dx + dy * dy > allowedSlopPx * allowedSlopPx) {
                    cancelGesture()
                }
                return true
            }

            MotionEvent.ACTION_POINTER_DOWN,
            MotionEvent.ACTION_POINTER_UP,
            MotionEvent.ACTION_CANCEL -> {
                cancelGesture()
                return true
            }

            MotionEvent.ACTION_UP -> {
                val fired = callbackFired
                cancelGesture()
                if (!fired) performClick()
                return true
            }
        }
        return true
    }

    override fun performClick(): Boolean {
        super.performClick()
        return true
    }

    override fun performLongClick(): Boolean {
        if (!pointerDown || callbackFired) return false
        callbackFired = true
        cancelPendingLongPress()
        longPressListener?.invoke()
        return true
    }

    override fun onDetachedFromWindow() {
        cancelGesture()
        longPressListener = null
        super.onDetachedFromWindow()
    }

    private fun scheduleLongPress() {
        val runnable = Runnable {
            pendingLongPress = null
            if (pointerDown && !callbackFired && isAttachedToWindow) {
                performLongClick()
            }
        }
        pendingLongPress = runnable
        handler.postDelayed(runnable, longPressThresholdMs)
    }

    private fun cancelGesture() {
        pointerDown = false
        cancelPendingLongPress()
    }

    private fun cancelPendingLongPress() {
        pendingLongPress?.let(handler::removeCallbacks)
        pendingLongPress = null
    }

    companion object {
        const val DEFAULT_LONG_PRESS_MS = 1500L
        private const val DEFAULT_SLOP_PX = 24f
    }
}
