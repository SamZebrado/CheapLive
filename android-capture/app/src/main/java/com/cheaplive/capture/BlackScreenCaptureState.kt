package com.cheaplive.capture

/**
 * Pure-JVM testable state machine for Black Screen Capture Mode.
 *
 * This class holds no Android objects. The Android-specific side effects
 * (Window flags, system bars, overlay View, brightness) are applied by
 * [BlackScreenCaptureController], which delegates the state transitions
 * and bookkeeping to this class.
 *
 * Single source of truth for:
 * - current [State]
 * - [SavedWindowState] captured at enter time and restored at exit time
 * - persisted [BrightnessLevel]
 * - the [OverlayHandle] that proves at most one overlay is attached
 *
 * Idempotence contract:
 * - [enter] in [State.active] is a no-op (does not create a second overlay,
 *   does not re-save window state, does not re-register listeners).
 * - [exit] in [State.inactive] is a no-op (does not crash, does not
 *   double-restore window state).
 */
class BlackScreenCaptureState {

    /** Lifecycle states. */
    enum class State { inactive, entering, active, exiting }

    /**
     * Brightness tiers. Values are deliberately bounded and recoverable.
     *
     * - [EXTRA_DIM]: very dim, safe for OLED, still non-zero to avoid
     *   fully-black frame buffers that some panels auto-suspend.
     * - [LOW]: low but readable in bright ambient.
     * - [SYSTEM]: do not touch window brightness; follow system default.
     */
    enum class BrightnessLevel { EXTRA_DIM, LOW, SYSTEM }

    /**
     * Snapshot of the window/system state captured at enter time.
     *
     * `keepScreenOn` reflects whether FLAG_KEEP_SCREEN_ON was already set
     * by other features; `screenBrightness` is the raw
     * `Window.attributes.screenBrightness` value (-1f means system default).
     */
    data class SavedWindowState(
        val keepScreenOn: Boolean,
        val screenBrightness: Float,
        val systemBarsVisible: Boolean,
        val systemBarsBehavior: Int,
        val decorSystemUiVisibility: Int,
    )

    /**
     * Result returned to the controller so it can decide which side effects
     * to apply. The state machine never touches Android objects directly.
     */
    sealed class Transition {
        /** No-op transition (idempotent call). */
        object NoOp : Transition()
        /** Apply enter side effects: add overlay, set flags, set brightness, hide bars, show hint. */
        data class ApplyEnter(
            val saved: SavedWindowState,
            val brightness: Float,
            val level: BrightnessLevel,
        ) : Transition()
        /** Apply exit side effects: remove overlay, restore flags, restore brightness, restore bars. */
        data class ApplyExit(val saved: SavedWindowState) : Transition()
    }

    /**
     * Opaque handle returned to the controller when an overlay is attached.
     * The controller must retain it and pass it back to [exit] so the state
     * can verify the same overlay is being removed. The handle is referentially
     * unique per attachment; comparing identity proves "at most one overlay".
     */
    data class OverlayHandle(val id: Long)

    @Volatile var state: State = State.inactive
        private set

    @Volatile var savedWindowState: SavedWindowState? = null
        private set

    @Volatile var brightnessLevel: BrightnessLevel = BrightnessLevel.EXTRA_DIM
        private set

    @Volatile var activeOverlayHandle: OverlayHandle? = null
        private set

    private var nextOverlayId: Long = 1L

    /**
     * Begin a black-screen capture session.
     *
     * Idempotent: if [state] is already [State.active] or [State.entering],
     * returns [Transition.NoOp] without re-saving window state or allocating
     * a new overlay handle.
     */
    fun enter(original: SavedWindowState): Transition {
        synchronized(this) {
            when (state) {
                State.active, State.entering -> return Transition.NoOp
                State.exiting, State.inactive -> {
                    state = State.entering
                    val normalized = original.copy(
                        screenBrightness = normalizeWindowBrightness(original.screenBrightness),
                    )
                    savedWindowState = normalized
                    val overlay = OverlayHandle(nextOverlayId++)
                    activeOverlayHandle = overlay
                    val brightness = brightnessValueForLevel(brightnessLevel, normalized.screenBrightness)
                    return Transition.ApplyEnter(normalized, brightness, brightnessLevel)
                }
            }
        }
    }

    /**
     * End a black-screen capture session.
     *
     * Idempotent: if [state] is [State.inactive] or [State.exiting],
     * returns [Transition.NoOp] without restoring window state twice.
     */
    fun exit(): Transition {
        synchronized(this) {
            when (state) {
                State.inactive, State.exiting -> return Transition.NoOp
                State.active, State.entering -> {
                    state = State.exiting
                    val saved = savedWindowState
                    return if (saved != null) Transition.ApplyExit(saved) else Transition.NoOp
                }
            }
        }
    }

    /** Confirm that the controller applied every enter side effect. */
    fun completeEnter(): Boolean {
        synchronized(this) {
            if (state != State.entering) return false
            state = State.active
            return true
        }
    }

    /** Confirm that the controller restored the window and removed the overlay. */
    fun completeExit(): Boolean {
        synchronized(this) {
            if (state != State.exiting) return false
            activeOverlayHandle = null
            savedWindowState = null
            state = State.inactive
            return true
        }
    }

    /**
     * Persist a brightness tier. Persisting this value does NOT imply the
     * current session is active; "is the device currently in black-screen
     * mode" is intentionally NOT persisted across cold starts.
     */
    fun setBrightnessLevel(level: BrightnessLevel) {
        synchronized(this) { brightnessLevel = level }
    }

    /** True only when [state] == [State.active]. */
    fun isActive(): Boolean = state == State.active

    /** True only when an overlay handle has been issued and not yet released. */
    fun hasOverlay(): Boolean = activeOverlayHandle != null

    /**
     * Convert a tier to a concrete window brightness float.
     *
     * - EXTRA_DIM: 0.02f (very dim, non-zero, recoverable)
     * - LOW: 0.08f
     * - SYSTEM: returns [systemDefault] verbatim (typically -1f)
     *
     * Returns a finite value in [0.0, 1.0] when the tier is EXTRA_DIM or LOW.
     * For SYSTEM, the caller is responsible for restoring the original raw
     * float (which may be -1f).
     */
    fun brightnessValueForLevel(level: BrightnessLevel, systemDefault: Float): Float {
        return when (level) {
            BrightnessLevel.EXTRA_DIM -> 0.02f
            BrightnessLevel.LOW -> 0.08f
            BrightnessLevel.SYSTEM -> {
                if (systemDefault.isFinite() && systemDefault in 0.0f..1.0f) systemDefault else -1f
            }
        }.let { value ->
            // Hard guard: never return NaN/Infinity or out-of-range non-sentinel values.
            if (value.isNaN() || value.isInfinite()) -1f else value
        }
    }

    /** Preserve the system sentinel and finite Android brightness range only. */
    fun normalizeWindowBrightness(value: Float): Float =
        if (value.isFinite() && (value == -1f || value in 0f..1f)) value else -1f

    /**
     * Restore the persisted brightness tier from storage. Used at controller
     * construction time so the user's last choice is preserved across cold
     * starts. Does NOT change [state]; entering black-screen mode still
     * requires an explicit [enter] call.
     */
    fun restoreBrightnessLevel(level: BrightnessLevel?) {
        if (level != null) {
            synchronized(this) { brightnessLevel = level }
        }
    }

    /**
     * Cold-start guard: explicitly mark this state as inactive. Called by
     * the controller when there is no savedInstanceState, to make the
     * "no auto-enter on cold start" contract explicit and testable.
     */
    fun markColdStartInactive() {
        synchronized(this) {
            state = State.inactive
            activeOverlayHandle = null
            savedWindowState = null
        }
    }

    companion object {
        fun parseBrightnessLevel(raw: String?): BrightnessLevel =
            runCatching { BrightnessLevel.valueOf(raw.orEmpty()) }
                .getOrDefault(BrightnessLevel.EXTRA_DIM)
    }
}
