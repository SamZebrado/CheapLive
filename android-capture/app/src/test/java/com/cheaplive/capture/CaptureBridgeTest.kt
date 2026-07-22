package com.cheaplive.capture

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.json.JSONObject

class CaptureBridgeTest {

    private class StubBroadcast : CaptureBroadcast {
        val frames = mutableListOf<String>()
        override fun broadcastFrame(json: String) { frames.add(json) }
    }

    private fun makeBridge(token: String = "t1", sessionId: String = "s1", state: AppState? = null): Pair<CaptureBridge, StubBroadcast> {
        val stub = StubBroadcast()
        val fakeSession = Session(sessionId = sessionId, token = token, port = 8766, privateIp = "192.168.1.2")
        return CaptureBridge(
            session = fakeSession,
            broadcast = stub,
            onStateChange = { _, _ -> },
            appState = state,
        ) to stub
    }

    @Test
    fun `getSessionInfo exposes session info via JSON`() {
        val (bridge, _) = makeBridge(sessionId = "session-1", token = "tok-2")
        val info = JSONObject(bridge.getSessionInfo())
        assertEquals("session-1", info.getString("sessionId"))
        assertEquals("tok-2", info.getString("token"))
        assertEquals(1, info.getInt("version"))
        assertTrue(info.has("port"))
    }

    @Test
    fun `valid face-frame is accepted and broadcast with incrementing seq`() {
        val (bridge, stub) = makeBridge()
        val json = JSONObject().apply {
            put("type", "face-frame")
            put("version", 1)
            put("seq", 0)
            put("timestamp", 0)
            put("avatar", "mesh-spindle-whale")
            put("params", JSONObject().apply {
                put("eyeLeft", 1.0); put("eyeRight", 1.0); put("mouthOpen", 0.0); put("mouthSmile", 0.0)
                put("browLeft", 0.0); put("browRight", 0.0); put("headYaw", 0.0); put("headPitch", 0.0); put("headRoll", 0.0)
                put("positionX", 0.0); put("positionY", 0.0); put("scale", 1.0)
                put("tailPitch", 0.0); put("tailYaw", 0.0); put("tailWave", 0.0)
            })
        }.toString()
        val result = bridge.publishFaceFrame(json)
        val obj = JSONObject(result)
        assertTrue(obj.getBoolean("ok"))
        assertEquals(1, stub.frames.size)
    }

    @Test
    fun `wrong version rejected`() {
        val (bridge, stub) = makeBridge()
        val json = JSONObject().apply {
            put("type", "face-frame"); put("version", 2)
            put("params", JSONObject().apply { put("eyeLeft", 1.0) })
        }.toString()
        val result = bridge.publishFaceFrame(json)
        assertFalse(JSONObject(result).getBoolean("ok"))
        assertEquals(0, stub.frames.size)
    }

    @Test
    fun `validate rejects NaN`() {
        val frame = FaceFrame(
            sessionId = "test",
            seq = 1,
            timestamp = 0,
            avatar = "mesh-spindle-whale",
            params = FaceParams(
                eyeLeft = Float.NaN, eyeRight = 1f, mouthOpen = 0f, mouthSmile = 0f,
                browLeft = 0f, browRight = 0f, headYaw = 0f, headPitch = 0f, headRoll = 0f,
                positionX = 0f, positionY = 0f, scale = 1f, tailPitch = 0f, tailYaw = 0f, tailWave = 0f
            )
        )
        assertFalse(FaceFrameValidator.validate(frame))
    }

    @Test
    fun `oversize message rejected`() {
        val (bridge, stub) = makeBridge()
        val big = "x".repeat(8000)
        val json = "{\"type\":\"face-frame\",\"version\":1,\"padding\":\"$big\"}"
        val result = bridge.publishFaceFrame(json)
        assertFalse(JSONObject(result).getBoolean("ok"))
        assertEquals(0, stub.frames.size)
    }

    @Test
    fun `setAvatarType accepts valid avatars`() {
        val (bridge, _) = makeBridge()
        val r1 = JSONObject(bridge.setAvatarType("mesh-spindle-whale"))
        val r2 = JSONObject(bridge.setAvatarType("mesh-sphere"))
        val r3 = JSONObject(bridge.setAvatarType("invalid"))
        assertTrue(r1.getBoolean("ok"))
        assertTrue(r2.getBoolean("ok"))
        assertFalse(r3.getBoolean("ok"))
    }

    private fun validPoseFrame(): JSONObject = JSONObject().apply {
        put("type", "pose-frame")
        put("schemaVersion", 1)
        put("sequence", 7)
        put("timestampMs", 1234.0)
        put("revision", 1)
        put("sourceId", "capture-worker")
        put("tracking", true)
        put("confidence", 0.9)
        put("coordinateSpace", "normalized-camera")
        put("mirrored", true)
        put("landmarks", JSONObject().apply {
            put("nose", JSONObject().put("x", 0.5).put("y", 0.2).put("z", 0.0).put("visibility", 0.9))
            put("leftShoulder", JSONObject().put("x", 0.4).put("y", 0.35).put("z", 0.0).put("visibility", 0.8))
        })
    }

    @Test
    fun `valid pose frame is sanitized broadcast and updates aggregate state`() {
        val state = AppState()
        val (bridge, stub) = makeBridge(state = state)
        val result = JSONObject(bridge.publishPoseFrame(validPoseFrame().toString()))
        assertTrue(result.getBoolean("ok"))
        val output = JSONObject(stub.frames.single())
        assertEquals("pose-frame", output.getString("type"))
        assertEquals(2, output.getJSONObject("landmarks").length())
        assertEquals("tracking", state.poseCaptureStatus)
        assertEquals(0.9, state.poseTrackingConfidence, 0.0001)
    }

    @Test
    fun `pose bridge rejects unknown landmark and non finite coordinate`() {
        val (bridge, stub) = makeBridge()
        val unknown = validPoseFrame().apply {
            getJSONObject("landmarks").put("leftAnkle", JSONObject().put("x", 0.5).put("y", 0.5).put("z", 0.0).put("visibility", 1.0))
        }
        assertFalse(JSONObject(bridge.publishPoseFrame(unknown.toString())).getBoolean("ok"))
        val invalid = validPoseFrame().apply {
            getJSONObject("landmarks").getJSONObject("nose").put("x", 2.0)
        }
        assertFalse(JSONObject(bridge.publishPoseFrame(invalid.toString())).getBoolean("ok"))
        assertEquals(0, stub.frames.size)
    }

    @Test
    fun `pose controls validate profile smoothing and default off`() {
        val state = AppState()
        assertFalse(state.poseCaptureEnabled)
        assertTrue(state.applyCommand("setPosePerformanceProfile", mapOf("profile" to "balanced")).ok)
        assertEquals("balanced", state.posePerformanceProfile)
        assertFalse(state.applyCommand("setPoseSmoothing", mapOf("smoothing" to 2.0)).ok)
        assertTrue(state.applyCommand("setPoseSmoothing", mapOf("smoothing" to 0.6)).ok)
        assertEquals(0.6, state.poseSmoothing, 0.0001)
    }

    @Test
    fun `model readiness remains separate from tracking loss`() {
        val state = AppState()
        val (bridge, _) = makeBridge(state = state)
        bridge.reportPoseStatus("ready", "")
        assertEquals("ready", state.poseModelStatus)
        state.updatePoseTelemetry("tracking-lost", 4.0, 60.0, 0, 0, 0.0, 0)
        assertEquals("tracking-lost", state.poseCaptureStatus)
        assertEquals("ready", state.poseModelStatus)
    }
}
