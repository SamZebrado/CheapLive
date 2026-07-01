package com.cheaplive.capture

import android.content.Context
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.nio.ByteBuffer
import java.nio.charset.StandardCharsets
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.ConcurrentHashMap

class LocalServer(
    private val appContext: Context,
    private val session: Session,
    private val appState: AppState = AppState(),
) : CaptureBroadcast {

    private val serverSocketHolder = java.util.concurrent.atomic.AtomicReference<ServerSocket?>(null)
    private val running = AtomicBoolean(false)
    private val webSocketClients = ConcurrentHashMap.newKeySet<WebSocketPeer>()
    private val sseClients = ConcurrentHashMap.newKeySet<java.io.OutputStream>()

    @Volatile private var acceptThread: Thread? = null

    @Synchronized
    fun start(): Int {
        if (running.get()) return session.port
        val basePort = session.port
        val maxAttempts = 10
        var lastError: Throwable? = null
        for (offset in 0 until maxAttempts) {
            val tryPort = basePort + offset
            try {
                val ss = ServerSocket()
                try {
                    ss.reuseAddress = true
                } catch (_: Throwable) {}
                ss.bind(InetSocketAddress("0.0.0.0", tryPort), 8)
                serverSocketHolder.set(ss)
                running.set(true)
                acceptThread = Thread({ acceptLoop() }, "CheapLive-http-accept").apply {
                    isDaemon = true
                    start()
                }
                return ss.localPort
            } catch (t: Throwable) {
                lastError = t
                continue
            }
        }
        throw java.net.BindException("无法启动服务器：端口 $basePort 至 ${basePort + maxAttempts - 1} 均被占用（${lastError?.message}）")
    }

    @Synchronized
    fun stop() {
        running.set(false)
        try { serverSocketHolder.getAndSet(null)?.close() } catch (_: Throwable) {}
        for (peer in webSocketClients) { try { peer.close() } catch (_: Throwable) {} }
        webSocketClients.clear()
        for (stream in sseClients) { try { stream.close() } catch (_: Throwable) {} }
        sseClients.clear()
    }

    /** 获取 AppState（供 MainActivity 访问） */
    fun getAppState(): AppState = appState

    /** 推送状态变更到所有 SSE 客户端 */
    fun broadcastStateChange() {
        val json = appState.snapshot().toJson()
        val iter = sseClients.iterator()
        while (iter.hasNext()) {
            val stream = iter.next()
            try {
                stream.write("event: state\ndata: $json\n\n".toByteArray(StandardCharsets.UTF_8))
                stream.flush()
            } catch (_: Throwable) {
                iter.remove()
            }
        }
    }

    private fun acceptLoop() {
        val ss = serverSocketHolder.get() ?: return
        while (running.get()) {
            try {
                val client = ss.accept()
                Thread({ handleClient(client) }, "CheapLive-http-peer").apply { isDaemon = true; start() }
            } catch (_: Throwable) {
                break
            }
        }
    }

    private fun handleClient(client: Socket) {
        try {
            client.soTimeout = 60_000
            val input = client.getInputStream()
            val output = client.getOutputStream()

            val header = readHttpHeader(input)
            if (header.isEmpty()) {
                client.close()
                return
            }
            val firstLine = header.first().trim()
            val parts = firstLine.split(" ")
            if (parts.size < 3) {
                client.close(); return
            }
            val method = parts[0].uppercase()
            var path = parts[1]

            val queryStart = path.indexOf('?')
            val query: Map<String, String> = if (queryStart >= 0) {
                parseQuery(path.substring(queryStart + 1))
            } else emptyMap()
            if (queryStart >= 0) path = path.substring(0, queryStart)

            val upgrade = header.any { it.trim().startsWith("Upgrade:", true) } ||
                    header.any { it.trim().startsWith("Upgrade: ", true) } ||
                    header.any { it.trim().lowercase().contains("upgrade: websocket") } ||
                    header.any { it.trim().lowercase().contains("upgrade: ") } && header.any { it.trim().lowercase().contains("websocket") }

            if (method == "GET" && (path == "/ws" || path == "/ws/" || path.startsWith("/ws?") || upgrade)) {
                val providedToken = query["token"] ?: query["Token"]
                if (providedToken != session.token) {
                    writeHttpResponse(output, 403, "Forbidden", "text/plain", "Invalid token".toByteArray())
                    client.close()
                    return
                }
                if (webSocketClients.isNotEmpty()) {
                    writeHttpResponse(output, 429, "Too Many Clients", "text/plain",
                        "Only one receiver allowed per session".toByteArray())
                    client.close()
                    return
                }
                val wsKey = extractWsKey(header)
                val acceptKey = computeWsAcceptKey(wsKey)
                val response =
                    "HTTP/1.1 101 Switching Protocols\r\n" +
                    "Upgrade: websocket\r\n" +
                    "Connection: Upgrade\r\n" +
                    "Sec-WebSocket-Accept: $acceptKey\r\n" +
                    "\r\n"
                output.write(response.toByteArray(StandardCharsets.UTF_8))
                output.flush()
                val peer = WebSocketPeer(client, input, output)
                webSocketClients.add(peer)
                peer.onText = { text ->
                }
                peer.onClose = { webSocketClients.remove(peer) }
                peer.loop()
                return
            }

            when {
                path == "/health" -> {
                    val body = "{\"ok\":true,\"session\":\"${session.sessionId}\",\"port\":${session.port}}".toByteArray(StandardCharsets.UTF_8)
                    writeHttpResponse(output, 200, "OK", "application/json; charset=utf-8", body)
                }
                path == "/api/status" -> {
                    val body = appState.snapshot().toJson().toByteArray(StandardCharsets.UTF_8)
                    writeHttpResponse(output, 200, "OK", "application/json; charset=utf-8", body)
                }
                path == "/api/control" && method == "POST" -> {
                    val bodyBytes = readBody(input, header)
                    val bodyStr = String(bodyBytes, StandardCharsets.UTF_8)
                    val result = handleControlCommand(bodyStr)
                    val respBody = result.toByteArray(StandardCharsets.UTF_8)
                    writeHttpResponse(output, 200, "OK", "application/json; charset=utf-8", respBody)
                    broadcastStateChange()
                }
                path == "/events" -> {
                    // SSE: Server-Sent Events
                    val sseHeader = "HTTP/1.1 200 OK\r\n" +
                        "Content-Type: text/event-stream\r\n" +
                        "Cache-Control: no-cache\r\n" +
                        "Connection: keep-alive\r\n" +
                        "Access-Control-Allow-Origin: *\r\n" +
                        "\r\n"
                    output.write(sseHeader.toByteArray(StandardCharsets.UTF_8))
                    output.flush()
                    sseClients.add(output)
                    // 发送初始状态
                    val initJson = appState.snapshot().toJson()
                    output.write("event: state\ndata: $initJson\n\n".toByteArray(StandardCharsets.UTF_8))
                    output.flush()
                    // 保持连接，直到客户端断开或服务器停止
                    while (running.get()) {
                        try {
                            // 发送心跳注释
                            output.write(": heartbeat\n\n".toByteArray(StandardCharsets.UTF_8))
                            output.flush()
                            Thread.sleep(15000)
                        } catch (_: Throwable) {
                            break
                        }
                    }
                    sseClients.remove(output)
                }
                path == "/" || path == "/receiver" || path == "/receiver/" ||
                    path == "/receiver/index.html" -> {
                    val assetPath = "web/receiver/index.html"
                    serveAsset(output, assetPath, "text/html; charset=utf-8")
                }
                path.startsWith("/receiver/") -> {
                    val relative = path.removePrefix("/receiver/")
                    val mime = guessMime(relative)
                    serveAsset(output, "web/receiver/$relative", mime)
                }
                path == "/control" || path == "/control/" || path == "/control/index.html" -> {
                    serveAsset(output, "web/control/index.html", "text/html; charset=utf-8")
                }
                path.startsWith("/control/") -> {
                    val relative = path.removePrefix("/control/")
                    val mime = guessMime(relative)
                    serveAsset(output, "web/control/$relative", mime)
                }
                path == "/contest" || path == "/contest/" || path == "/contest/index.html" -> {
                    serveAsset(output, "web/control/index.html", "text/html; charset=utf-8")
                }
                path == "/capture" || path == "/capture/" || path == "/capture/index.html" -> {
                    serveAsset(output, "web/capture/index.html", "text/html; charset=utf-8")
                }
                path.startsWith("/capture/") -> {
                    val relative = path.removePrefix("/capture/")
                    val mime = guessMime(relative)
                    serveAsset(output, "web/capture/$relative", mime)
                }
                path == "/black-screen" || path == "/black-screen/" || path == "/black-screen/index.html" -> {
                    serveAsset(output, "web/black-screen/index.html", "text/html; charset=utf-8")
                }
                path.startsWith("/black-screen/") -> {
                    val relative = path.removePrefix("/black-screen/")
                    val mime = guessMime(relative)
                    serveAsset(output, "web/black-screen/$relative", mime)
                }
                path == "/demo" || path == "/demo/" || path == "/demo/demo.html" -> {
                    serveAsset(output, "web/demo/demo.html", "text/html; charset=utf-8")
                }
                path.startsWith("/demo/") -> {
                    val relative = path.removePrefix("/demo/")
                    val mime = guessMime(relative)
                    serveAsset(output, "web/demo/$relative", mime)
                }
                path.startsWith("/assets/") -> {
                    val relative = path.removePrefix("/assets/")
                    val mime = guessMime(relative)
                    serveAsset(output, "web/receiver/$relative", mime)
                }
                path.startsWith("/web/") -> {
                    val relative = path.removePrefix("/web/")
                    val mime = guessMime(relative)
                    serveAsset(output, "web/$relative", mime)
                }
                path == "/min-audio-send" || path == "/min-audio-send/" -> {
                    serveAsset(output, "web/min-audio-send.html", "text/html; charset=utf-8")
                }
                path == "/min-audio-receiver" || path == "/min-audio-receiver/" -> {
                    serveAsset(output, "web/min-audio-receiver.html", "text/html; charset=utf-8")
                }
                else -> {
                    writeHttpResponse(output, 404, "Not Found", "text/plain", "404".toByteArray())
                }
            }
            client.close()
        } catch (_: Throwable) {
            try { client.close() } catch (_: Throwable) {}
        }
    }

    override fun broadcastFrame(frameJson: String) {
        if (!running.get()) return
        val iter = webSocketClients.iterator()
        while (iter.hasNext()) {
            val peer = iter.next()
            try { peer.sendText(frameJson) } catch (_: Throwable) {
                try { peer.close() } catch (_: Throwable) {}
                iter.remove()
            }
        }
    }

    private fun serveAsset(output: java.io.OutputStream, assetPath: String, mime: String) {
        try {
            val stream: InputStream = appContext.assets.open(assetPath)
            val bytes = readAll(stream)
            writeHttpResponse(output, 200, "OK", mime, bytes)
        } catch (_: Throwable) {
            writeHttpResponse(output, 404, "Not Found", "text/plain", "Asset not found: $assetPath".toByteArray())
        }
    }

    /** 解析 POST /api/control 请求体并执行命令 */
    private fun handleControlCommand(bodyStr: String): String {
        return try {
            val obj = org.json.JSONObject(bodyStr)
            val type = obj.optString("type", "")
            val params = mutableMapOf<String, Any?>()
            val keys = obj.keys()
            while (keys.hasNext()) {
                val key = keys.next()
                if (key != "type") params[key] = obj.get(key)
            }
            val result = appState.applyCommand(type, params)
            org.json.JSONObject().apply {
                put("ok", result.ok)
                put("message", result.message)
                put("state", org.json.JSONObject(appState.snapshot().toJson()))
            }.toString()
        } catch (e: Exception) {
            org.json.JSONObject().apply {
                put("ok", false)
                put("message", "parse error: ${e.message}")
            }.toString()
        }
    }

    /** 读取 POST 请求体 */
    private fun readBody(input: InputStream, header: List<String>): ByteArray {
        var contentLength = 0
        for (h in header) {
            val lower = h.trim().lowercase()
            if (lower.startsWith("content-length:")) {
                contentLength = lower.substringAfter(':').trim().toIntOrNull() ?: 0
                break
            }
        }
        if (contentLength <= 0) return ByteArray(0)
        val buf = ByteArray(contentLength)
        var read = 0
        while (read < contentLength) {
            val n = input.read(buf, read, contentLength - read)
            if (n < 0) break
            read += n
        }
        return if (read == contentLength) buf else buf.copyOf(read)
    }

    private fun writeHttpResponse(
        out: java.io.OutputStream,
        status: Int,
        reason: String,
        contentType: String,
        body: ByteArray
    ) {
        val header = "HTTP/1.1 $status $reason\r\n" +
            "Content-Type: $contentType\r\n" +
            "Content-Length: ${body.size}\r\n" +
            "Connection: close\r\n" +
            "\r\n"
        out.write(header.toByteArray(StandardCharsets.UTF_8))
        out.write(body)
        out.flush()
    }

    private fun readHttpHeader(input: InputStream): List<String> {
        val lines = mutableListOf<String>()
        val baos = ByteArrayOutputStream()
        var prev1 = -1; var prev2 = -1
        var b: Int
        while (true) {
            b = input.read()
            if (b < 0) break
            baos.write(b)
            if (prev2 == '\r'.code && prev1 == '\n'.code && b == '\r'.code) {
                val next = input.read()
                if (next == '\n'.code) break
            } else if (prev2 == '\n'.code && prev1 == '\n'.code) break
            prev2 = prev1; prev1 = b
        }
        val text = baos.toString("UTF-8")
        for (line in text.split("\r\n", "\n")) {
            if (line.isBlank()) break
            lines.add(line)
        }
        return lines
    }

    private fun parseQuery(q: String): Map<String, String> {
        val map = mutableMapOf<String, String>()
        for (p in q.split('&')) {
            if (p.isEmpty()) continue
            val idx = p.indexOf('=')
            if (idx < 0) map[p] = "" else map[p.substring(0, idx)] = p.substring(idx + 1)
        }
        return map
    }

    private fun extractWsKey(header: List<String>): String {
        for (h in header) {
            if (h.trim().lowercase().startsWith("sec-websocket-key:")) {
                return h.trim().substringAfter(':').trim()
            }
        }
        return ""
    }

    private fun computeWsAcceptKey(key: String): String {
        val combined = key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
        val md = java.security.MessageDigest.getInstance("SHA-1")
        val sha1 = md.digest(combined.toByteArray(StandardCharsets.UTF_8))
        return java.util.Base64.getEncoder().encodeToString(sha1)
    }

    private fun guessMime(path: String): String {
        val ext = path.substringAfterLast('.').lowercase()
        return when (ext) {
            "html", "htm" -> "text/html; charset=utf-8"
            "js" -> "application/javascript; charset=utf-8"
            "css" -> "text/css; charset=utf-8"
            "json" -> "application/json; charset=utf-8"
            "png" -> "image/png"
            "jpg", "jpeg" -> "image/jpeg"
            "svg" -> "image/svg+xml"
            else -> "application/octet-stream"
        }
    }

    private fun readAll(input: InputStream): ByteArray {
        val out = ByteArrayOutputStream()
        val buf = ByteArray(8192)
        var n: Int
        while (input.read(buf).also { n = it } > 0) out.write(buf, 0, n)
        input.close()
        return out.toByteArray()
    }
}

class WebSocketPeer(private val socket: Socket, private val input: InputStream, private val output: java.io.OutputStream) {
    var onText: (String) -> Unit = {}
    var onClose: () -> Unit = {}

    fun sendText(text: String) {
        val payload = text.toByteArray(StandardCharsets.UTF_8)
        val out = output
        out.write(0x81)
        if (payload.size < 126) {
            out.write(payload.size)
        } else if (payload.size < 65536) {
            out.write(126)
            out.write((payload.size shr 8) and 0xff)
            out.write(payload.size and 0xff)
        } else {
            out.write(127)
            val bb = ByteBuffer.allocate(8)
            bb.putLong(payload.size.toLong())
            out.write(bb.array())
        }
        out.write(payload)
        out.flush()
    }

    fun loop() {
        try {
            while (!socket.isClosed) {
                val b1 = input.read()
                if (b1 < 0) break
                val b2 = input.read()
                if (b2 < 0) break
                val masked = (b2 and 0x80) != 0
                var len = b2 and 0x7f
                if (len == 126) {
                    val hi = input.read(); val lo = input.read()
                    if (hi < 0 || lo < 0) break
                    len = (hi shl 8) or lo
                } else if (len == 127) {
                    val longBuf = ByteArray(8)
                    var read = 0
                    while (read < 8) {
                        val n = input.read(longBuf, read, 8 - read)
                        if (n < 0) break
                        read += n
                    }
                    if (read < 8) break
                    val high = (longBuf[0].toInt() and 0xff shl 24) or
                            (longBuf[1].toInt() and 0xff shl 16) or
                            (longBuf[2].toInt() and 0xff shl 8) or
                            (longBuf[3].toInt() and 0xff)
                    val low = (longBuf[4].toInt() and 0xff shl 24) or
                            (longBuf[5].toInt() and 0xff shl 16) or
                            (longBuf[6].toInt() and 0xff shl 8) or
                            (longBuf[7].toInt() and 0xff)
                    val combined = (high.toLong() shl 32) or (low.toLong() and 0xffffffffL)
                    if (combined > 32768L) break
                    len = combined.toInt() and 0x7fffffff
                }
                val mask = if (masked) {
                    val m = ByteArray(4); input.read(m); m
                } else null
                val payload = ByteArray(len)
                var read = 0
                while (read < len) {
                    val n = input.read(payload, read, len - read)
                    if (n < 0) break
                    read += n
                }
                if (mask != null) for (i in 0 until len) payload[i] = (payload[i].toInt() xor mask[i and 3].toInt()).toByte()
                if (b1 and 0x0f == 0x8) continue
                if (b1 and 0x0f == 0x1) {
                    try { onText(String(payload, StandardCharsets.UTF_8)) } catch (_: Throwable) {}
                }
            }
        } catch (_: Throwable) {
        } finally {
            try { onClose() } catch (_: Throwable) {}
            try { socket.close() } catch (_: Throwable) {}
        }
    }

    fun close() {
        try { socket.close() } catch (_: Throwable) {}
    }
}
