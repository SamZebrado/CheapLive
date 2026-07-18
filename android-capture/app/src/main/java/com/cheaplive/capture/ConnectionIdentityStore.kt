package com.cheaplive.capture

import android.content.Context
import android.content.SharedPreferences
import java.security.SecureRandom
import java.util.Base64

/**
 * 稳定连接身份持久化（SharedPreferences）。
 *
 * 设计原则：
 * - pairing token、sessionId、port 是稳定连接身份，不随 App 重启变化
 * - IP 地址属于动态网络信息，不在此处持久化
 * - 与面捕配置（FaceTrackingConfigStore）使用不同的 SharedPreferences 文件，互不覆盖
 * - 用户主动"重置连接"时才生成新身份
 *
 * 持久化字段：
 * - token: 32 字节 SecureRandom + Base64url
 * - sessionId: 16 字节 SecureRandom + Base64url
 * - port: 默认 8765（用户未主动重置时不变化）
 *
 * 不持久化字段：
 * - privateIp: 每次启动通过 PrivateIpPicker 动态获取
 */
class ConnectionIdentityStore(private val context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private val rng = SecureRandom()

    /**
     * 当前持久化的稳定连接身份。
     * 若任一字段缺失，视为身份未建立，返回 null（调用方应调用 reset() 生成新身份）。
     */
    fun load(): ConnectionIdentity? {
        val token = prefs.getString(KEY_TOKEN, null) ?: return null
        val sessionId = prefs.getString(KEY_SESSION_ID, null) ?: return null
        val port = prefs.getInt(KEY_PORT, -1)
        if (port < 0) return null
        return ConnectionIdentity(
            token = token,
            sessionId = sessionId,
            port = port,
        )
    }

    /**
     * 生成并持久化全新的连接身份。
     * 用于首次运行或用户主动"重置连接"。
     * 不影响面捕配置。
     */
    fun reset(): ConnectionIdentity {
        val newIdentity = ConnectionIdentity(
            token = randomToken(32),
            sessionId = randomToken(16),
            port = DEFAULT_PORT,
        )
        prefs.edit().apply {
            putString(KEY_TOKEN, newIdentity.token)
            putString(KEY_SESSION_ID, newIdentity.sessionId)
            putInt(KEY_PORT, newIdentity.port)
            apply()
        }
        return newIdentity
    }

    /**
     * 仅更新 port（端口因冲突被强制改变时使用，但默认行为是拒绝改变端口）。
     * 当前设计：端口冲突时优先报错而非调用此方法。
     */
    fun updatePort(port: Int) {
        prefs.edit().putInt(KEY_PORT, port).apply()
    }

    private fun randomToken(bytes: Int): String {
        val buf = ByteArray(bytes)
        rng.nextBytes(buf)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(buf)
    }

    companion object {
        private const val PREFS_NAME = "cheaplive_connection_identity"
        private const val KEY_TOKEN = "token"
        private const val KEY_SESSION_ID = "session_id"
        private const val KEY_PORT = "port"

        /** 固定端口：用户未主动重置时不变化 */
        const val DEFAULT_PORT: Int = 8765
    }
}

/**
 * 稳定连接身份（不包含 IP）。
 * IP 由调用方在每次启动时通过 PrivateIpPicker 动态获取。
 */
data class ConnectionIdentity(
    val token: String,
    val sessionId: String,
    val port: Int,
)
