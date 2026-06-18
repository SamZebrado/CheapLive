package com.cheaplive.capture

import android.webkit.JavascriptInterface
import org.json.JSONObject

class CaptureBridge(
    private val session: Session,
    private val broadcast: CaptureBroadcast,
    private val onStateChange: (String, String) -> Unit,
) {
    private val validAvatarTypes = setOf("mesh-spindle-whale", "mesh-sphere")

    @JavascriptInterface fun getSessionInfo(): String = JSONObject().apply {
        put("sessionId", session.sessionId)
        put("token", session.token)
        put("port", session.port)
        put("privateIp", session.privateIp)
        put("version", FaceFrameValidator.VERSION)
    }.toString()

    @JavascriptInterface fun setAvatarType(type: String): String {
        if (type !in validAvatarTypes) return JSONObject().put("ok", false).put("reason", "invalid avatar type").toString()
        return JSONObject().put("ok", true).put("avatar", type).toString()
    }

    @JavascriptInterface fun publishFaceFrame(json: String): String {
        if (json.length > FaceFrameValidator.MAX_MESSAGE_BYTES) {
            return "{\"ok\":false,\"reason\":\"too large\"}"
        }
        return try {
            val obj = JSONObject(json)
            val type = obj.optString("type", "")
            if (type != "face-frame") return "{\"ok\":false,\"reason\":\"wrong type\"}"
            val ver = obj.optInt("version", 0)
            if (ver != FaceFrameValidator.VERSION) return "{\"ok\":false,\"reason\":\"wrong version\"}"

            val p = obj.getJSONObject("params")
            val frame = FaceFrame(
                sessionId = session.sessionId,
                seq = session.seq++,
                timestamp = obj.optLong("timestamp", System.currentTimeMillis()),
                avatar = obj.optString("avatar", "mesh-spindle-whale"),
                params = FaceParams(
                    eyeLeft = p.optDouble("eyeLeft", 1.0).toFloat(),
                    eyeRight = p.optDouble("eyeRight", 1.0).toFloat(),
                    mouthOpen = p.optDouble("mouthOpen", 0.0).toFloat(),
                    mouthSmile = p.optDouble("mouthSmile", 0.0).toFloat(),
                    browLeft = p.optDouble("browLeft", 0.0).toFloat(),
                    browRight = p.optDouble("browRight", 0.0).toFloat(),
                    headYaw = p.optDouble("headYaw", 0.0).toFloat(),
                    headPitch = p.optDouble("headPitch", 0.0).toFloat(),
                    headRoll = p.optDouble("headRoll", 0.0).toFloat(),
                    positionX = p.optDouble("positionX", 0.0).toFloat(),
                    positionY = p.optDouble("positionY", 0.0).toFloat(),
                    scale = p.optDouble("scale", 1.0).toFloat(),
                    tailPitch = p.optDouble("tailPitch", 0.0).toFloat(),
                    tailYaw = p.optDouble("tailYaw", 0.0).toFloat(),
                    tailWave = p.optDouble("tailWave", 0.0).toFloat(),
                ),
            )
            if (!FaceFrameValidator.validate(frame)) return "{\"ok\":false,\"reason\":\"invalid params\"}"
            session.currentFrame = frame
            val frameJson = JSONObject().apply {
                put("type", "face-frame")
                put("version", FaceFrameValidator.VERSION)
                put("sessionId", frame.sessionId)
                put("seq", frame.seq)
                put("timestamp", frame.timestamp)
                put("avatar", frame.avatar)
                val pp = JSONObject()
                val params = frame.params
                pp.put("eyeLeft", params.eyeLeft)
                pp.put("eyeRight", params.eyeRight)
                pp.put("mouthOpen", params.mouthOpen)
                pp.put("mouthSmile", params.mouthSmile)
                pp.put("browLeft", params.browLeft)
                pp.put("browRight", params.browRight)
                pp.put("headYaw", params.headYaw)
                pp.put("headPitch", params.headPitch)
                pp.put("headRoll", params.headRoll)
                pp.put("positionX", params.positionX)
                pp.put("positionY", params.positionY)
                pp.put("scale", params.scale)
                pp.put("tailPitch", params.tailPitch)
                pp.put("tailYaw", params.tailYaw)
                pp.put("tailWave", params.tailWave)
                put("params", pp)
            }.toString()
            broadcast.broadcastFrame(frameJson)
            "{\"ok\":true,\"seq\":${frame.seq}}"
        } catch (e: Exception) {
            "{\"ok\":false,\"reason\":\"parse\"}"
        }
    }

    @JavascriptInterface fun reportCaptureState(state: String, detail: String) {
        onStateChange(state, detail)
    }
}
