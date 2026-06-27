package com.cheaplive.capture

/**
 * 会话：生成安全随机 sessionId 和 token；
 * 保持当前 seq、面捕帧、服务器端口、关联 token。
 */
import java.security.SecureRandom
import java.util.Base64

data class Session(
    val sessionId: String,
    val token: String,
    val port: Int,
    val privateIp: String,
    @Volatile var currentFrame: FaceFrame? = null,
    @Volatile var seq: Long = 0L,
)

object SessionManager {
    private val rng = SecureRandom()

    fun createSession(privateIp: String, port: Int): Session {
        val sessionId = randomToken(16)
        val token = randomToken(32)
        return Session(
            sessionId = sessionId,
            token = token,
            port = port,
            privateIp = privateIp,
        )
    }

    private fun randomToken(bytes: Int): String {
        val buf = ByteArray(bytes)
        rng.nextBytes(buf)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(buf)
    }
}
