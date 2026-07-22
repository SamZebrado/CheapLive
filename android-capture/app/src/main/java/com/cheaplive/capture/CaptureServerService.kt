package com.cheaplive.capture

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

/** Visible lifetime owner for the LAN receiver server. Camera and microphone remain Activity-owned. */
class CaptureServerService : Service() {
    override fun onCreate() {
        super.onCreate()
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "CheapLive local receiver", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Keeps the user-started LAN receiver available"
            }
        )
        val stopIntent = Intent(this, CaptureServerService::class.java).setAction(ACTION_STOP)
        val stopPendingIntent = PendingIntent.getService(
            this,
            0,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_sync_noanim)
            .setContentTitle("CheapLive receiver is available")
            .setContentText("Local network server running")
            .setOngoing(true)
            .setSilent(true)
            .addAction(0, "Stop", stopPendingIntent)
            .build()
        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            notification,
            ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE,
        )
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            CaptureServerRuntime.stop()
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }
        if (!ensureServerRuntime()) {
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }
        return START_STICKY
    }

    override fun onDestroy() {
        CaptureServerRuntime.stop()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    /** Rebuilds the process-local server after Android recreates this sticky service. */
    private fun ensureServerRuntime(): Boolean {
        if (CaptureServerRuntime.current() != null) return true
        return try {
            val identityStore = ConnectionIdentityStore(this)
            val identity = identityStore.load() ?: identityStore.reset()
            val state = AppState().apply {
                faceTrackingConfig = FaceTrackingConfigStore(this@CaptureServerService).load()
            }
            MotionCaptureSettingsStore(this).applyTo(state)
            val session = Session(
                sessionId = identity.sessionId,
                token = identity.token,
                port = identity.port,
                privateIp = PrivateIpPicker.pick() ?: "127.0.0.1",
            )
            CaptureServerRuntime.ensureStarted(this, session, state)
            Log.i(TAG, "Local receiver runtime active")
            true
        } catch (error: Throwable) {
            Log.e(TAG, "Local receiver runtime start failed: ${error.javaClass.simpleName}")
            false
        }
    }

    companion object {
        private const val CHANNEL_ID = "cheaplive_receiver_server"
        private const val NOTIFICATION_ID = 8765
        private const val TAG = "CaptureServerService"
        private const val ACTION_START = "com.cheaplive.capture.action.START_SERVER"
        private const val ACTION_STOP = "com.cheaplive.capture.action.STOP_SERVER"

        fun start(context: Context) {
            val intent = Intent(context, CaptureServerService::class.java).setAction(ACTION_START)
            ContextCompat.startForegroundService(context, intent)
        }

        fun stop(context: Context) {
            CaptureServerRuntime.stop()
            context.stopService(Intent(context, CaptureServerService::class.java))
        }
    }
}
