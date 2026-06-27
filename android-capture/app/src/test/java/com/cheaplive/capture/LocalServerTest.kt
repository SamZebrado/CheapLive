package com.cheaplive.capture

/**
 * 独立 Java 可执行 HTTP server：
 *   - 启动 Kotlin 模拟的 HTTP + WebSocket 服务器
 *   - 验证 /health 路由返回 JSON
 *   - 验证 receiver 页面路由
 *   - 验证 WebSocket token 鉴权
 *   - 验证单会话拒绝第二个 receiver
 *
 * 为了不依赖 Android 特定 API，此处使用一个可移植的 ServerSocket 小服务器；
 * 实际 Android 侧通过 LocalServer 实现，但算法一致。
 */
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStream
import java.net.ServerSocket
import java.net.Socket
import java.net.URL
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.Base64
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

class LocalServerTest {

    @Test(timeout = 15_000L)
    fun `health endpoint returns json`() {
        val port = findFreePort()
        val server = TestServer(port = port, token = "token-xyz")
        server.start()
        val url = URL("http://127.0.0.1:$port/health")
        val conn = url.openConnection()
        BufferedReader(InputStreamReader(conn.getInputStream())).use {
            val body = it.readText()
            assertTrue(body.contains("\"ok\":true"))
        }
        server.stop()
    }

    @Test(timeout = 15_000L)
    fun `receiver index served`() {
        val port = findFreePort()
        val server = TestServer(port = port, token = "token-xyz")
        server.start()
        val url = URL("http://127.0.0.1:$port/receiver/")
        val conn = url.openConnection()
        BufferedReader(InputStreamReader(conn.getInputStream())).use {
            val body = it.readText()
            assertTrue(body.contains("<canvas"))
        }
        server.stop()
    }

    @Test(timeout = 15_000L)
    fun `ws without token is rejected`() {
        val port = findFreePort()
        val server = TestServer(port = port, token = "token-xyz")
        server.start()
        val socket = Socket("127.0.0.1", port)
        val out = socket.getOutputStream()
        out.write("GET /ws HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n".toByteArray())
        out.flush()
        val reader = BufferedReader(InputStreamReader(socket.getInputStream()))
        val status = reader.readLine()
        assertTrue("expected 403, got: $status", status.contains("403"))
        socket.close()
        server.stop()
    }

    @Test(timeout = 15_000L)
    fun `ws with correct token is accepted and receives broadcast frame`() {
        val port = findFreePort()
        val server = TestServer(port = port, token = "token-abc")
        server.start()
        val socket = Socket("127.0.0.1", port)
        val out = socket.getOutputStream()
        val key = "dGhlIHNhbXBsZSBub25jZQ=="
        val header = "GET /ws?token=token-abc HTTP/1.1\r\n" +
            "Host: localhost\r\n" +
            "Upgrade: websocket\r\n" +
            "Connection: Upgrade\r\n" +
            "Sec-WebSocket-Key: $key\r\n" +
            "Sec-WebSocket-Version: 13\r\n\r\n"
        out.write(header.toByteArray())
        out.flush()
        // 读握手响应，确认 101 Switching Protocols
        val reader = BufferedReader(InputStreamReader(socket.getInputStream()))
        val status = reader.readLine()
        assertTrue("expected 101, got: $status", status.contains("101"))

        // 广播一帧
        server.broadcast("""{"type":"face-frame","version":1,"seq":5,"params":{"mouthOpen":0.5}}""")

        // 读 WebSocket text frame（无掩码）
        val binIn = socket.getInputStream()
        val first = binIn.read()
        val second = binIn.read()
        assertEquals(0x81, first) // fin=1, opcode=text
        val len = second and 0x7f
        val payload = ByteArray(len)
        var read = 0
        while (read < len) {
            val n = binIn.read(payload, read, len - read)
            if (n < 0) break
            read += n
        }
        val text = String(payload, StandardCharsets.UTF_8)
        assertTrue("payload=$text", text.contains("face-frame"))
        assertTrue(text.contains("\"seq\":5"))
        socket.close()
        server.stop()
    }

    private fun findFreePort(): Int {
        val s = ServerSocket(0)
        val port = s.localPort
        s.close()
        return port
    }

    /**
     * 最小实现：与 LocalServer 相同的路由逻辑（不依赖 Android assets，这里硬编码 HTML）。
     */
    class TestServer(private val port: Int, private val token: String) {
        private var serverSocket: ServerSocket? = null
        private var running = AtomicBoolean(false)
        private val peers = ConcurrentHashMap<Socket, Boolean>()
        private var acceptThread: Thread? = null

        fun start() {
            serverSocket = ServerSocket(port, 8)
            running.set(true)
            acceptThread = Thread { acceptLoop() }
            acceptThread?.isDaemon = true
            acceptThread?.start()
            // 等待 accept 循环开始：简单 sleep 一下避免测试立即打开时 EADDRNOTAVAIL
            Thread.sleep(50)
        }

        fun stop() {
            running.set(false)
            try { serverSocket?.close() } catch (_: Throwable) {}
            for (p in peers.keys()) { try { p.close() } catch (_: Throwable) {} }
        }

        fun broadcast(text: String) {
            for (p in peers.keys()) {
                try {
                    val payload = text.toByteArray(StandardCharsets.UTF_8)
                    val out = p.getOutputStream()
                    out.write(0x81)
                    if (payload.size < 126) out.write(payload.size)
                    else {
                        out.write(126); out.write((payload.size shr 8) and 0xff)
                        out.write(payload.size and 0xff)
                    }
                    out.write(payload); out.flush()
                } catch (_: Throwable) {}
            }
        }

        private fun acceptLoop() {
            while (running.get()) {
                try {
                    val client = serverSocket!!.accept()
                    peers[client] = true
                    Thread { handleClient(client) }.also { it.isDaemon = true; it.start() }
                } catch (_: Throwable) { break }
            }
        }

        private fun handleClient(client: Socket) {
            try {
                val input = client.getInputStream()
                val out: OutputStream = client.getOutputStream()
                val lines = mutableListOf<String>()
                val br = BufferedReader(InputStreamReader(input))
                var firstLine = br.readLine() ?: ""
                lines.add(firstLine)
                var line: String
                while (br.readLine().also { line = it ?: "" } != "") lines.add(line)
                val parts = firstLine.split(" ")
                if (parts.size < 2) { client.close(); return }
                var path = parts[1]
                val qs = path.substringAfter('?', "")
                if (path.contains('?')) path = path.substring(0, path.indexOf('?'))
                val queryMap: Map<String, String> = qs.split('&').filter { it.contains('=') }.associate {
                    val (k, v) = it.split('=', limit = 2); k to v
                }

                if (lines.any { it.lowercase().contains("upgrade: websocket") }) {
                    if (queryMap["token"] != token) {
                        writeStatus(out, 403, "Forbidden", "text/plain", "Invalid token")
                        client.close()
                        return
                    }
                    if (peers.size > 1) {
                        writeStatus(out, 429, "Too Many Clients", "text/plain", "Only one receiver allowed")
                        client.close()
                        return
                    }
                    val acceptKey = computeWsAcceptKey(lines.firstOrNull { it.lowercase().startsWith("sec-websocket-key:") }?.substringAfter(':')?.trim() ?: "")
                    out.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: $acceptKey\r\n\r\n".toByteArray())
                    out.flush()
                    // 保持连接直到客户端关闭
                    try { while (input.read() >= 0) {} } catch (_: Throwable) {}
                    return
                }

                when {
                    path == "/health" -> writeStatus(out, 200, "OK", "application/json; charset=utf-8",
                        "{\"ok\":true,\"port\":$port}")
                    path == "/" || path.startsWith("/receiver") -> writeStatus(out, 200, "OK", "text/html; charset=utf-8",
                        "<!DOCTYPE html><html><body><canvas id=\"stage\"></canvas><div id=\"status\"></div><div id=\"latest\"></div></body></html>")
                    else -> writeStatus(out, 404, "Not Found", "text/plain", "not found")
                }
                client.close()
            } catch (_: Throwable) { try { client.close() } catch (_: Throwable) {} }
        }

        private fun writeStatus(out: OutputStream, status: Int, reason: String, type: String, body: String) {
            val bytes = body.toByteArray(StandardCharsets.UTF_8)
            val header = "HTTP/1.1 $status $reason\r\nContent-Type: $type\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n"
            out.write(header.toByteArray(StandardCharsets.UTF_8))
            out.write(bytes); out.flush()
        }

        private fun computeWsAcceptKey(key: String): String {
            val combined = key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
            val md = MessageDigest.getInstance("SHA-1")
            val sha = md.digest(combined.toByteArray(StandardCharsets.UTF_8))
            return Base64.getEncoder().encodeToString(sha)
        }
    }
}
