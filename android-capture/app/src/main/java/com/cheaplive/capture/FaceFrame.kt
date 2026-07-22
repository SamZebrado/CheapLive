package com.cheaplive.capture

/**
 * Face-Frame 消息：从 JavaScript 通过 @JavascriptInterface 发布到
 * LocalServer，再通过 WebSocket 分发给接收端浏览器。
 *
 * 参数范围：眼睛 0–1、嘴巴 0–1、头部角度 -90..90，
 * 尾巴参数 -30..30，位置 -1..1。
 */
data class FaceFrame(
    val sessionId: String,
    val seq: Long,
    val timestamp: Long,
    val avatar: String,
    val params: FaceParams,
)

data class FaceParams(
    val eyeLeft: Float,
    val eyeRight: Float,
    val mouthOpen: Float,
    val mouthSmile: Float,
    val browLeft: Float,
    val browRight: Float,
    val headYaw: Float,
    val headPitch: Float,
    val headRoll: Float,
    val positionX: Float,
    val positionY: Float,
    val scale: Float,
    val tailPitch: Float,
    val tailYaw: Float,
    val tailWave: Float,
)
