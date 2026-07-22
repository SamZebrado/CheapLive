package com.cheaplive.capture

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.json.JSONObject

/**
 * Phase 1.5: 测试 DemoAvatarBridge 的纯逻辑部分。
 * 注意：测试环境没有真实的 Android Looper，所以我们不启动周期性任务。
 */
class DemoAvatarBridgeTest {

    @Test
    fun `avatar change callback fires`() {
        var received: String? = null
        val bridge = DemoAvatarBridge { a -> received = a }
        bridge.setAvatar("whale")
        assertEquals("whale", received)
        bridge.setAvatar("sphere")
        assertEquals("sphere", received)
        bridge.dispose()
    }

    @Test
    fun `avatar value persisted after setAvatar`() {
        val bridge = DemoAvatarBridge { _ -> }
        assertEquals("sphere", bridge.getAvatar())
        bridge.setAvatar("whale")
        assertEquals("whale", bridge.getAvatar())
        bridge.dispose()
    }

    @Test
    fun `paused flag toggles`() {
        val bridge = DemoAvatarBridge { _ -> }
        assertFalse(bridge.isPaused())
        bridge.setPaused(true)
        assertTrue(bridge.isPaused())
        bridge.setPaused(false)
        assertFalse(bridge.isPaused())
        bridge.dispose()
    }

    @Test
    fun `advanceTick increments tickCount`() {
        val bridge = DemoAvatarBridge { _ -> }
        val t0 = bridge.getTickCount()
        bridge.advanceTick()
        bridge.advanceTick()
        assertEquals(t0 + 2, bridge.getTickCount())
        bridge.dispose()
    }

    @Test
    fun `buildFramePayload produces valid JSON`() {
        val bridge = DemoAvatarBridge { _ -> }
        bridge.setAvatar("whale")
        bridge.advanceTick()
        val payload = bridge.buildFramePayload()
        val obj = JSONObject(payload)
        assertTrue(obj.getBoolean("ok"))
        assertEquals("whale", obj.getString("avatar"))
        assertTrue(obj.getLong("tick") > 0)

        val params = obj.getJSONObject("params")
        // 检查所有参数存在且是数字
        for (key in PARAM_KEYS) {
            assertTrue("missing param $key", params.has(key))
            // 只是确保不是 null，不会抛 JSONException
            params.getDouble(key)
        }
        bridge.dispose()
    }

    @Test
    fun `successive frames have different tick numbers`() {
        val bridge = DemoAvatarBridge { _ -> }
        val p1 = JSONObject(bridge.buildFramePayload()).getLong("tick")
        bridge.advanceTick()
        val p2 = JSONObject(bridge.buildFramePayload()).getLong("tick")
        assertTrue("ticks should advance: $p1 -> $p2", p2 > p1)
        bridge.dispose()
    }

    @Test
    fun `javascript interface methods exist and don't throw`() {
        val bridge = DemoAvatarBridge { _ -> }
        // 直接调用，确保不会 crash
        val avatar = bridge.getAvatar()
        assertNotNull(avatar)
        val tick = bridge.getTickCount()
        assertTrue(tick >= 0L)
        bridge.dispose()
    }

    companion object {
        private val PARAM_KEYS = arrayOf(
            "eyeLeft", "eyeRight", "mouthOpen", "mouthSmile",
            "browLeft", "browRight", "headYaw", "headPitch", "headRoll",
            "positionX", "positionY", "scale",
            "tailPitch", "tailYaw", "tailWave"
        )
    }
}
