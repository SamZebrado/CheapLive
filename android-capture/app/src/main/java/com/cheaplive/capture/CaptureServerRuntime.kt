package com.cheaplive.capture

import android.content.Context

data class CaptureServerHandle(
    val server: LocalServer,
    val session: Session,
    val appState: AppState,
)

/** Process-local server owner retained independently of Activity recreation. */
object CaptureServerRuntime {
    private val resource = IdempotentResource<CaptureServerHandle> { handle ->
        handle.appState.setField("serverRunning", false)
        handle.appState.setField("viewerConnected", false)
        handle.server.stop()
    }

    fun ensureStarted(
        context: Context,
        requestedSession: Session,
        requestedState: AppState,
    ): CaptureServerHandle = resource.getOrStart {
        val server = LocalServer(context.applicationContext, requestedSession, requestedState)
        var actualPort = -1
        var lastError: Throwable? = null
        for (retry in 0..5) {
            try {
                actualPort = server.start()
                break
            } catch (error: Throwable) {
                lastError = error
                if (retry < 5) Thread.sleep((300 + retry * 200).toLong())
            }
        }
        if (actualPort < 0) {
            throw IllegalStateException("LocalServer could not bind its configured port", lastError)
        }
        val activeSession = requestedSession.copy(port = actualPort)
        requestedState.setField("serverRunning", true)
        CaptureServerHandle(server, activeSession, requestedState)
    }

    fun current(): CaptureServerHandle? = resource.peek()

    fun stop(): Boolean = resource.stop()
}
