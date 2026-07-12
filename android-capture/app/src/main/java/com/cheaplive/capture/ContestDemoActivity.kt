package com.cheaplive.capture

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class ContestDemoActivity : AppCompatActivity() {

    private var webView: WebView? = null

    private lateinit var tvStatus: TextView

    private val CAMERA_PERMISSION_REQUEST = 101
    private val MICROPHONE_PERMISSION_REQUEST = 102

    private var cameraPermissionGranted = false
    private var microphonePermissionGranted = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }

        tvStatus = TextView(this).apply {
            text = "加载中..."
            textSize = 12f
            setPadding(16, 8, 16, 8)
        }

        webView = WebView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0
            ).apply { weight = 1f }
        }

        root.addView(tvStatus)
        root.addView(webView)
        setContentView(root)

        requestPermissions()
        setupWebView()

        loadContestDemo()
    }

    private fun requestPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val cameraNeeded = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED
            val micNeeded = ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED

            if (cameraNeeded || micNeeded) {
                val permissions = mutableListOf<String>()
                if (cameraNeeded) permissions.add(Manifest.permission.CAMERA)
                if (micNeeded) permissions.add(Manifest.permission.RECORD_AUDIO)
                ActivityCompat.requestPermissions(this, permissions.toTypedArray(), CAMERA_PERMISSION_REQUEST)
            } else {
                cameraPermissionGranted = true
                microphonePermissionGranted = true
            }
        } else {
            cameraPermissionGranted = true
            microphonePermissionGranted = true
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        var idx = 0
        for (perm in permissions) {
            if (perm == Manifest.permission.CAMERA) {
                cameraPermissionGranted = grantResults.getOrNull(idx) == PackageManager.PERMISSION_GRANTED
            } else if (perm == Manifest.permission.RECORD_AUDIO) {
                microphonePermissionGranted = grantResults.getOrNull(idx) == PackageManager.PERMISSION_GRANTED
            }
            idx++
        }
        updateStatus()
    }

    private fun updateStatus() {
        tvStatus.text = buildString {
            append("Camera: ").append(if (cameraPermissionGranted) "GRANTED" else "DENIED").append(" | ")
            append("Mic: ").append(if (microphonePermissionGranted) "GRANTED" else "DENIED")
        }
    }

    private fun setupWebView() {
        val wv = webView ?: return
        val settings: WebSettings = wv.settings

        settings.javaScriptEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.domStorageEnabled = true
        settings.cacheMode = WebSettings.LOAD_NO_CACHE
        settings.setSupportMultipleWindows(false)
        settings.allowFileAccessFromFileURLs = true
        settings.allowUniversalAccessFromFileURLs = true
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true

        wv.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url?.toString() ?: return true
                if (url.startsWith("file:///android_asset/")) {
                    return false
                }
                return true
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                Log.i("ContestDemo", "Page finished: $url")
                updateStatus()
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                super.onReceivedError(view, request, error)
                if (request.isForMainFrame) {
                    val failingUrl = request.url?.toString() ?: "unknown"
                    val errDesc = error.description?.toString() ?: "error code ${error.errorCode}"
                    Log.w("ContestDemo", "Main frame error: $failingUrl - $errDesc")
                    tvStatus.text = "加载失败: $errDesc"
                }
            }

            override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, errorResponse: WebResourceResponse) {
                super.onReceivedHttpError(view, request, errorResponse)
                if (request.isForMainFrame) {
                    val failingUrl = request.url?.toString() ?: "unknown"
                    val statusCode = errorResponse.statusCode
                    Log.w("ContestDemo", "Main frame HTTP error $statusCode: $failingUrl")
                }
            }
        }

        wv.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
                val msg = consoleMessage.message()
                val line = consoleMessage.lineNumber()
                val sourceId = consoleMessage.sourceId()
                when (consoleMessage.messageLevel()) {
                    ConsoleMessage.MessageLevel.ERROR -> Log.e("ContestDemoJS", "[$sourceId:$line] $msg")
                    ConsoleMessage.MessageLevel.WARNING -> Log.w("ContestDemoJS", "[$sourceId:$line] $msg")
                    else -> Log.d("ContestDemoJS", "[$sourceId:$line] $msg")
                }
                return super.onConsoleMessage(consoleMessage)
            }

            override fun onPermissionRequest(request: android.webkit.PermissionRequest) {
                Log.i("ContestDemo", "Permission request: ${request.resources.contentToString()}")
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    request.grant(request.resources)
                }
            }
        }
    }

    private fun loadContestDemo() {
        val url = "file:///android_asset/web/contest-demo/contest-interactive-demo.html"
        Log.i("ContestDemo", "Loading: $url")
        webView?.loadUrl(url)
    }

    override fun onPause() {
        webView?.onPause()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        webView?.onResume()
    }

    override fun onDestroy() {
        try { webView?.destroy() } catch (_: Throwable) {}
        webView = null
        super.onDestroy()
    }
}
