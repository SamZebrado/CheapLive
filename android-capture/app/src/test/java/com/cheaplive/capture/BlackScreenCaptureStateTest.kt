package com.cheaplive.capture

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class BlackScreenCaptureStateTest {
    private fun saved(
        keepScreenOn: Boolean = false,
        brightness: Float = -1f,
        barsVisible: Boolean = true,
        barsBehavior: Int = 0,
    ) = BlackScreenCaptureState.SavedWindowState(
        keepScreenOn = keepScreenOn,
        screenBrightness = brightness,
        systemBarsVisible = barsVisible,
        systemBarsBehavior = barsBehavior,
        decorSystemUiVisibility = 0,
    )

    private fun activeState(original: BlackScreenCaptureState.SavedWindowState = saved()): BlackScreenCaptureState {
        return BlackScreenCaptureState().also {
            assertTrue(it.enter(original) is BlackScreenCaptureState.Transition.ApplyEnter)
            assertTrue(it.completeEnter())
        }
    }

    @Test fun initialStateIsInactive() {
        assertEquals(BlackScreenCaptureState.State.inactive, BlackScreenCaptureState().state)
    }

    @Test fun enterCompletesToActive() {
        val state = BlackScreenCaptureState()
        state.enter(saved())
        state.completeEnter()
        assertTrue(state.isActive())
    }

    @Test fun repeatedEnterIsIdempotent() {
        val state = activeState()
        assertSame(BlackScreenCaptureState.Transition.NoOp, state.enter(saved(brightness = 0.5f)))
    }

    @Test fun snapshotIsSavedOnlyOnce() {
        val first = saved(brightness = 0.2f)
        val state = activeState(first)
        state.enter(saved(brightness = 0.8f))
        assertEquals(first, state.savedWindowState)
    }

    @Test fun exitCompletesToInactive() {
        val state = activeState()
        state.exit()
        state.completeExit()
        assertEquals(BlackScreenCaptureState.State.inactive, state.state)
    }

    @Test fun repeatedExitIsIdempotent() {
        val state = BlackScreenCaptureState()
        assertSame(BlackScreenCaptureState.Transition.NoOp, state.exit())
    }

    @Test fun originalBrightnessIsSaved() {
        val state = activeState(saved(brightness = 0.42f))
        assertEquals(0.42f, state.savedWindowState?.screenBrightness)
    }

    @Test fun systemBrightnessSentinelIsRestoredUnchanged() {
        val state = activeState(saved(brightness = -1f))
        val exit = state.exit() as BlackScreenCaptureState.Transition.ApplyExit
        assertEquals(-1f, exit.saved.screenBrightness)
    }

    @Test fun extraDimIsFiniteAndPositive() {
        val value = BlackScreenCaptureState().brightnessValueForLevel(
            BlackScreenCaptureState.BrightnessLevel.EXTRA_DIM,
            -1f,
        )
        assertTrue(value.isFinite() && value > 0f)
    }

    @Test fun lowIsFiniteAndBrighterThanExtraDim() {
        val state = BlackScreenCaptureState()
        val dim = state.brightnessValueForLevel(BlackScreenCaptureState.BrightnessLevel.EXTRA_DIM, -1f)
        val low = state.brightnessValueForLevel(BlackScreenCaptureState.BrightnessLevel.LOW, -1f)
        assertTrue(low.isFinite() && low > dim)
    }

    @Test fun systemTierPreservesValidWindowBrightness() {
        val value = BlackScreenCaptureState().brightnessValueForLevel(
            BlackScreenCaptureState.BrightnessLevel.SYSTEM,
            0.37f,
        )
        assertEquals(0.37f, value)
    }

    @Test fun keepScreenOnTrueIsReturnedForRestore() {
        val state = activeState(saved(keepScreenOn = true))
        val exit = state.exit() as BlackScreenCaptureState.Transition.ApplyExit
        assertTrue(exit.saved.keepScreenOn)
    }

    @Test fun keepScreenOnFalseIsReturnedForRestore() {
        val state = activeState(saved(keepScreenOn = false))
        val exit = state.exit() as BlackScreenCaptureState.Transition.ApplyExit
        assertFalse(exit.saved.keepScreenOn)
    }

    @Test fun snapshotIsClearedAfterExitCompletes() {
        val state = activeState()
        state.exit()
        state.completeExit()
        assertEquals(null, state.savedWindowState)
    }

    @Test fun nanBrightnessFallsBackToSystemSentinel() {
        assertEquals(-1f, BlackScreenCaptureState().normalizeWindowBrightness(Float.NaN))
    }

    @Test fun infiniteBrightnessFallsBackToSystemSentinel() {
        assertEquals(-1f, BlackScreenCaptureState().normalizeWindowBrightness(Float.POSITIVE_INFINITY))
    }

    @Test fun coldStartExplicitlyRemainsInactive() {
        val state = BlackScreenCaptureState()
        state.markColdStartInactive()
        assertFalse(state.isActive())
        assertFalse(state.hasOverlay())
    }

    @Test fun activeStateIsNotRestoredByPersistedBrightness() {
        val previous = activeState()
        val cold = BlackScreenCaptureState()
        cold.restoreBrightnessLevel(previous.brightnessLevel)
        assertFalse(cold.isActive())
    }

    @Test fun unknownBrightnessTierFallsBackSafely() {
        assertEquals(
            BlackScreenCaptureState.BrightnessLevel.EXTRA_DIM,
            BlackScreenCaptureState.parseBrightnessLevel("NOT_A_TIER"),
        )
    }

    @Test fun twentyEnterExitCyclesDoNotDrift() {
        val state = BlackScreenCaptureState()
        repeat(20) {
            val enter = state.enter(saved(brightness = -1f)) as BlackScreenCaptureState.Transition.ApplyEnter
            assertTrue(enter.brightness.isFinite())
            assertTrue(state.completeEnter())
            val handle = state.activeOverlayHandle
            assertTrue(handle != null)
            state.exit()
            assertTrue(state.completeExit())
            assertEquals(BlackScreenCaptureState.State.inactive, state.state)
            assertEquals(null, state.savedWindowState)
            assertFalse(state.hasOverlay())
        }
    }

    @Test fun repeatedEnterWhileEnteringDoesNotCreateTransitionOrOverlay() {
        val state = BlackScreenCaptureState()
        state.enter(saved())
        val firstHandle = state.activeOverlayHandle
        assertSame(BlackScreenCaptureState.Transition.NoOp, state.enter(saved(brightness = 0.5f)))
        assertSame(firstHandle, state.activeOverlayHandle)
    }

    @Test fun repeatedExitWhileExitingDoesNotCreateTransition() {
        val state = activeState()
        state.exit()
        assertSame(BlackScreenCaptureState.Transition.NoOp, state.exit())
        assertEquals(BlackScreenCaptureState.State.exiting, state.state)
    }

    @Test fun stateDataHoldsNoAndroidObjects() {
        val androidFields = BlackScreenCaptureState::class.java.declaredFields
            .map { it.type.name }
            .filter { it.startsWith("android.") || it.startsWith("androidx.") }
        assertTrue(androidFields.toString(), androidFields.isEmpty())
    }

    @Test fun everyBrightnessOutputIsFinite() {
        val state = BlackScreenCaptureState()
        val inputs = listOf(-1f, 0f, 0.5f, 1f, -2f, 2f, Float.NaN, Float.NEGATIVE_INFINITY)
        val outputs = inputs.flatMap { input ->
            BlackScreenCaptureState.BrightnessLevel.entries.map { level ->
                state.brightnessValueForLevel(level, input)
            }
        } + inputs.map(state::normalizeWindowBrightness)
        assertTrue(outputs.toString(), outputs.all(Float::isFinite))
    }
}
