package com.cheaplive.capture

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FaceFrameValidatorTest {
    private fun frame(params: FaceParams = goodParams()) =
        FaceFrame(sessionId = "s", seq = 1L, timestamp = 0, avatar = "mesh-sphere", params = params)

    private fun goodParams() = FaceParams(
        eyeLeft = 1f, eyeRight = 1f, mouthOpen = 0f, mouthSmile = 0f,
        browLeft = 0f, browRight = 0f, headYaw = 0f, headPitch = 0f, headRoll = 0f,
        positionX = 0f, positionY = 0f, scale = 1f, tailPitch = 0f, tailYaw = 0f, tailWave = 0f,
    )

    @Test
    fun `good frame validates`() {
        assertTrue(FaceFrameValidator.validate(frame()))
    }

    @Test
    fun `NaN params rejected`() {
        assertFalse(FaceFrameValidator.validate(frame(goodParams().copy(headYaw = Float.NaN))))
        assertFalse(FaceFrameValidator.validate(frame(goodParams().copy(scale = Float.POSITIVE_INFINITY))))
    }

    @Test
    fun `out-of-range params rejected`() {
        assertFalse(FaceFrameValidator.validate(frame(goodParams().copy(eyeLeft = 1.5f))))
        assertFalse(FaceFrameValidator.validate(frame(goodParams().copy(eyeLeft = -0.1f))))
        assertFalse(FaceFrameValidator.validate(frame(goodParams().copy(headYaw = 100f))))
        assertFalse(FaceFrameValidator.validate(frame(goodParams().copy(headYaw = -100f))))
        assertFalse(FaceFrameValidator.validate(frame(goodParams().copy(scale = 3f))))
        assertFalse(FaceFrameValidator.validate(frame(goodParams().copy(scale = 0.1f))))
        assertFalse(FaceFrameValidator.validate(frame(goodParams().copy(tailPitch = 40f))))
    }

    @Test
    fun `boundary values accepted`() {
        assertTrue(FaceFrameValidator.validate(frame(goodParams().copy(eyeLeft = 1.0f, eyeRight = 1.0f))))
        assertTrue(FaceFrameValidator.validate(frame(goodParams().copy(headYaw = 90f))))
        assertTrue(FaceFrameValidator.validate(frame(goodParams().copy(headYaw = -90f))))
        assertTrue(FaceFrameValidator.validate(frame(goodParams().copy(scale = 0.5f))))
        assertTrue(FaceFrameValidator.validate(frame(goodParams().copy(scale = 2.0f))))
        assertTrue(FaceFrameValidator.validate(frame(goodParams().copy(positionX = 1f))))
        assertTrue(FaceFrameValidator.validate(frame(goodParams().copy(positionY = -1f))))
    }
}
