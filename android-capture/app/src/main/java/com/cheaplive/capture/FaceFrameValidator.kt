package com.cheaplive.capture

/**
 * Face-Frame 校验：
 * - 数字有限（NaN、Infinity）
 * - 眼睛/嘴巴 0..1
 * - 头部 -90..90
 * - 尾巴 -30..30
 * - 位置/缩放 -1..1、0.5..2
 * - max 消息大小 ~ 4 KB
 */
object FaceFrameValidator {
    const val MAX_MESSAGE_BYTES = 4096
    const val VERSION = 1

    fun validate(frame: FaceFrame): Boolean {
        if (frame.sessionId.isBlank()) return false
        val p = frame.params
        if (!p.eyeLeft.isFinite() || !p.eyeRight.isFinite()) return false
        if (!p.mouthOpen.isFinite() || !p.mouthSmile.isFinite()) return false
        if (!p.headYaw.isFinite() || !p.headPitch.isFinite() || !p.headRoll.isFinite()) return false
        if (!p.positionX.isFinite() || !p.positionY.isFinite() || !p.scale.isFinite()) return false
        if (!p.tailPitch.isFinite() || !p.tailYaw.isFinite() || !p.tailWave.isFinite()) return false

        if (p.eyeLeft < 0f || p.eyeLeft > 1f) return false
        if (p.eyeRight < 0f || p.eyeRight > 1f) return false
        if (p.mouthOpen < 0f || p.mouthOpen > 1f) return false
        if (p.mouthSmile < -1f || p.mouthSmile > 1f) return false
        if (p.browLeft < 0f || p.browLeft > 1f) return false
        if (p.browRight < 0f || p.browRight > 1f) return false
        if (p.headYaw < -90f || p.headYaw > 90f) return false
        if (p.headPitch < -90f || p.headPitch > 90f) return false
        if (p.headRoll < -90f || p.headRoll > 90f) return false
        if (p.positionX < -1f || p.positionX > 1f) return false
        if (p.positionY < -1f || p.positionY > 1f) return false
        if (p.scale < 0.5f || p.scale > 2f) return false
        if (p.tailPitch < -30f || p.tailPitch > 30f) return false
        if (p.tailYaw < -30f || p.tailYaw > 30f) return false
        if (p.tailWave < -1f || p.tailWave > 1f) return false
        return true
    }
}
