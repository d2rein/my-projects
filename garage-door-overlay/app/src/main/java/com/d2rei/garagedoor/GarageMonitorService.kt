package com.d2rei.garagedoor

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.KeyguardManager
import android.app.admin.DevicePolicyManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.widget.TextView
import android.widget.Toast
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit
import kotlin.math.abs
import kotlin.math.roundToInt

class GarageMonitorService : Service() {
    private lateinit var windowManager: WindowManager
    private lateinit var executor: ScheduledExecutorService
    private val mainHandler = Handler(Looper.getMainLooper())
    private var overlay: TextView? = null
    private var overlayParams: WindowManager.LayoutParams? = null
    private val screenOffReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == Intent.ACTION_SCREEN_OFF && preferences().getBoolean(KEY_LAST_OPEN, false)) {
                preferences().edit()
                    .putBoolean(KEY_WAKE_SUPPRESSED, true)
                    .putBoolean(KEY_WAKE_ALERT_ACTIVE, false)
                    .apply()
                mainHandler.post { removeOverlay() }
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        createNotificationChannel()
        startForegroundCompat(buildNotification("Starting local monitor…"))
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(screenOffReceiver, IntentFilter(Intent.ACTION_SCREEN_OFF), Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(screenOffReceiver, IntentFilter(Intent.ACTION_SCREEN_OFF))
        }
        executor = Executors.newSingleThreadScheduledExecutor { runnable ->
            Thread(runnable, "garage-status-poller").apply { isDaemon = true }
        }
        executor.scheduleWithFixedDelay(::pollSafely, 0, POLL_SECONDS, TimeUnit.SECONDS)
        PushRegistration.register(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                preferences().edit().putBoolean(KEY_ENABLED, false).apply()
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_POLL -> executor.execute(::pollSafely)
            ACTION_APPLY_REMOTE_STATE -> applyRemoteState(
                intent.getStringExtra(EXTRA_REMOTE_STATE).orEmpty(),
                intent.getFloatExtra(EXTRA_REMOTE_CONFIDENCE, 0f),
                intent.getStringExtra(EXTRA_REMOTE_OCCURRED_AT).orEmpty(),
            )
            ACTION_HIDE_OVERLAY -> mainHandler.post { removeOverlay() }
            ACTION_DISABLE_OVERLAY -> {
                preferences().edit().putBoolean(KEY_OVERLAY_ENABLED, false).apply()
                mainHandler.post { removeOverlay() }
            }
            ACTION_ENABLE_OVERLAY -> {
                preferences().edit()
                    .putBoolean(KEY_OVERLAY_ENABLED, true)
                    .putBoolean(KEY_OVERLAY_DISMISSED, false)
                    .apply()
                executor.execute(::pollSafely)
            }
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        if (::executor.isInitialized) executor.shutdownNow()
        unregisterReceiver(screenOffReceiver)
        mainHandler.post { removeOverlay() }
        super.onDestroy()
    }

    private fun pollSafely() {
        try {
            val status = fetchStatus()
            val state = status.optString("state", "UNKNOWN").uppercase()
            val confidence = status.optDouble("confidence", 0.0)
            val reason = status.optString("reason", "")
            val lastFrame = status.optString("lastFrame", "")
            val prefs = preferences()
            val wasOpen = prefs.getBoolean(KEY_LAST_OPEN, false)
            val isNewOpenEvent = state == "OPEN" && !wasOpen
            val wakeAlertWasActive = prefs.getBoolean(KEY_WAKE_ALERT_ACTIVE, false)
            val remainsOpen = DoorStateLogic.remainsOpen(wasOpen, state)
            val lockedOrScreenOff = getSystemService(KeyguardManager::class.java).isKeyguardLocked ||
                !getSystemService(PowerManager::class.java).isInteractive
            val shouldWake = DoorStateLogic.shouldLaunchWakeAlert(
                wakeEnabled = prefs.getBoolean(KEY_WAKE_ALERT, false),
                serverState = state,
                lockedOrScreenOff = lockedOrScreenOff,
                suppressedForCurrentOpen = prefs.getBoolean(KEY_WAKE_SUPPRESSED, false),
                wakeAlertActive = wakeAlertWasActive,
            )
            val mode = DoorStateLogic.visibleBubbleMode(
                requestedMode = DoorStateLogic.bubbleMode(wasOpen, state),
                lockedOrScreenOff = lockedOrScreenOff,
                wakeAlertActive = wakeAlertWasActive || shouldWake,
            )
            val devicePolicyManager = getSystemService(DevicePolicyManager::class.java)
            val admin = ComponentName(this, GarageDeviceAdminReceiver::class.java)
            val shouldLockOnClose = DoorStateLogic.shouldLockOnClose(
                sleepEnabled = prefs.getBoolean(KEY_SLEEP_ON_CLOSE, false),
                previouslyOpen = wasOpen,
                serverState = state,
                wakeAlertActive = wakeAlertWasActive,
                deviceAdminActive = devicePolicyManager.isAdminActive(admin),
            )
            prefs.edit()
                .putString(KEY_LAST_STATE, state)
                .putFloat(KEY_CONFIDENCE, confidence.toFloat())
                .putString(KEY_LAST_FRAME, lastFrame)
                .putString(KEY_LAST_ERROR, reason)
                .putBoolean(KEY_LAST_OPEN, remainsOpen)
                .putLong(KEY_LAST_REMOTE_AT, 0L)
                .putLong(KEY_LAST_POLL, System.currentTimeMillis())
                .apply {
                    if (isNewOpenEvent || state == "CLOSED") {
                        putBoolean(KEY_OVERLAY_DISMISSED, false)
                    }
                    if (state == "CLOSED") {
                        putBoolean(KEY_WAKE_SUPPRESSED, false)
                        putBoolean(KEY_WAKE_ALERT_ACTIVE, false)
                    }
                }
                .apply()
            mainHandler.post {
                GarageStatusWidgetProvider.updateAll(this)
                updateNotification(notificationText(state, confidence, lastFrame))
                if (shouldWake) {
                    // Preserve the v0.2 launch path that Pixel allowed from the background:
                    // create the permitted overlay before starting the lock-screen activity.
                    // DoorAlertActivity removes it immediately from onCreate.
                    applyBubbleMode(BubbleMode.OPEN)
                    wakeAndLaunchDoorAlert()
                } else {
                    applyBubbleMode(mode)
                }
                if (shouldLockOnClose) {
                    try {
                        devicePolicyManager.lockNow()
                    } catch (error: SecurityException) {
                        preferences().edit()
                            .putString(KEY_LAST_ERROR, "Could not switch screen off: ${safeMessage(error)}")
                            .apply()
                    }
                }
            }
        } catch (error: Exception) {
            val prefs = preferences()
            val wasOpen = prefs.getBoolean(KEY_LAST_OPEN, false)
            val remoteAt = prefs.getLong(KEY_LAST_REMOTE_AT, 0L)
            val remoteState = prefs.getString(KEY_LAST_REMOTE_STATE, "").orEmpty()
            val remoteIsFresh = remoteState in setOf("OPEN", "CLOSED") &&
                remoteAt > 0L && System.currentTimeMillis() - remoteAt <= REMOTE_STATE_MAX_AGE_MS
            val lockedOrScreenOff = getSystemService(KeyguardManager::class.java).isKeyguardLocked ||
                !getSystemService(PowerManager::class.java).isInteractive
            val wakeAlertActive = prefs.getBoolean(KEY_WAKE_ALERT_ACTIVE, false)
            prefs.edit()
                .putString(KEY_LAST_STATE, if (remoteIsFresh) remoteState else "UNREACHABLE")
                .putString(KEY_LAST_ERROR, if (remoteIsFresh) "Local monitor unreachable; using remote push state" else error.message ?: error.javaClass.simpleName)
                .putBoolean(KEY_LAST_OPEN, if (remoteIsFresh) remoteState == "OPEN" else wasOpen)
                .putLong(KEY_LAST_POLL, System.currentTimeMillis())
                .apply()
            mainHandler.post {
                GarageStatusWidgetProvider.updateAll(this)
                applyBubbleMode(DoorStateLogic.visibleBubbleMode(
                    when {
                        remoteIsFresh && remoteState == "OPEN" -> BubbleMode.OPEN
                        remoteIsFresh && remoteState == "CLOSED" -> BubbleMode.HIDDEN
                        wasOpen -> BubbleMode.CHECK
                        else -> BubbleMode.HIDDEN
                    },
                    lockedOrScreenOff,
                    wakeAlertActive,
                ))
                updateNotification(if (remoteIsFresh) "$remoteState · remote push · local monitor unreachable" else "Monitor unreachable · ${safeMessage(error)}")
            }
        }
    }

    private fun applyRemoteState(stateValue: String, confidence: Float, occurredAt: String) {
        val state = stateValue.uppercase()
        if (state !in setOf("OPEN", "CLOSED")) return
        val prefs = preferences()
        prefs.edit()
            .putString(KEY_LAST_STATE, state)
            .putString(KEY_LAST_REMOTE_STATE, state)
            .putFloat(KEY_CONFIDENCE, confidence)
            .putString(KEY_LAST_FRAME, occurredAt)
            .putString(KEY_LAST_ERROR, "")
            .putBoolean(KEY_LAST_OPEN, state == "OPEN")
            .putLong(KEY_LAST_POLL, System.currentTimeMillis())
            .apply {
                putBoolean(KEY_OVERLAY_DISMISSED, false)
                putBoolean(KEY_WAKE_SUPPRESSED, false)
                if (state == "CLOSED") putBoolean(KEY_WAKE_ALERT_ACTIVE, false)
            }
            .apply()
        mainHandler.post {
            GarageStatusWidgetProvider.updateAll(this)
            updateNotification("$state · remote push")
            applyBubbleMode(if (state == "OPEN") BubbleMode.OPEN else BubbleMode.HIDDEN)
        }
    }

    private fun fetchStatus(): JSONObject {
        val base = preferences().getString(KEY_SERVER_URL, DEFAULT_SERVER_URL)?.trim()?.trimEnd('/')
            ?: DEFAULT_SERVER_URL
        require(base.startsWith("http://") || base.startsWith("https://")) {
            "Server URL must start with http:// or https://"
        }
        val connection = URL("$base/status").openConnection() as HttpURLConnection
        return try {
            connection.connectTimeout = 5_000
            connection.readTimeout = 5_000
            connection.requestMethod = "GET"
            connection.setRequestProperty("Accept", "application/json")
            val token = preferences().getString(KEY_API_TOKEN, "").orEmpty()
            if (token.isNotBlank()) connection.setRequestProperty("Authorization", "Bearer $token")
            val code = connection.responseCode
            if (code !in 200..299) throw IllegalStateException("HTTP $code")
            connection.inputStream.bufferedReader().use { JSONObject(it.readText()) }
        } finally {
            connection.disconnect()
        }
    }

    private fun applyBubbleMode(mode: BubbleMode) {
        val prefs = preferences()
        val overlayEnabled = prefs.getBoolean(KEY_OVERLAY_ENABLED, true)
        val dismissed = prefs.getBoolean(KEY_OVERLAY_DISMISSED, false)
        if (mode == BubbleMode.HIDDEN || !overlayEnabled || dismissed) {
            removeOverlay()
            return
        }
        if (!Settings.canDrawOverlays(this)) {
            removeOverlay()
            updateNotification("Overlay permission required")
            return
        }
        val view = overlay ?: createOverlay().also { overlay = it }
        val isOpen = mode == BubbleMode.OPEN
        view.text = if (isOpen) "DOOR\nOPEN" else "DOOR\nCHECK"
        view.background = circle(if (isOpen) Color.rgb(220, 38, 38) else Color.rgb(217, 119, 6))
        if (view.parent == null) {
            val params = WindowManager.LayoutParams(
                dp(76),
                dp(76),
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                android.graphics.PixelFormat.TRANSLUCENT,
            ).apply {
                gravity = Gravity.TOP or Gravity.START
                x = prefs.getInt(KEY_BUBBLE_X, dp(16))
                y = prefs.getInt(KEY_BUBBLE_Y, dp(160))
            }
            overlayParams = params
            windowManager.addView(view, params)
        }
    }

    @Suppress("DEPRECATION")
    private fun wakeAndLaunchDoorAlert() {
        val wakeLock = getSystemService(PowerManager::class.java).newWakeLock(
            PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "$packageName:garage-door-alert",
        )
        try {
            // A short timeout covers background-activity launch latency. The Activity's
            // KEEP_SCREEN_ON flag takes over once its black alert window is visible.
            wakeLock.acquire(5_000)
            startActivity(
                Intent(this, DoorAlertActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP),
            )
        } catch (error: RuntimeException) {
            preferences().edit().putString(KEY_LAST_ERROR, "Could not show wake alert: ${safeMessage(error)}").apply()
        }
    }

    private fun createOverlay(): TextView {
        val view = TextView(this).apply {
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
            textSize = 13f
            setTypeface(Typeface.DEFAULT, Typeface.BOLD)
            elevation = dp(8).toFloat()
            contentDescription = "Garage door is open"
        }
        var downRawX = 0f
        var downRawY = 0f
        var initialX = 0
        var initialY = 0
        var longPressTriggered = false
        val longPress = Runnable {
            longPressTriggered = true
            preferences().edit().putBoolean(KEY_OVERLAY_DISMISSED, true).apply()
            Toast.makeText(this, "Door alert dismissed until the next open event", Toast.LENGTH_SHORT).show()
            removeOverlay()
        }
        view.setOnTouchListener { _, event ->
            val params = overlayParams ?: return@setOnTouchListener false
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    downRawX = event.rawX
                    downRawY = event.rawY
                    initialX = params.x
                    initialY = params.y
                    longPressTriggered = false
                    mainHandler.postDelayed(longPress, ViewConfiguration.getLongPressTimeout().toLong())
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val deltaX = event.rawX - downRawX
                    val deltaY = event.rawY - downRawY
                    if (abs(deltaX) + abs(deltaY) >= dp(12)) mainHandler.removeCallbacks(longPress)
                    params.x = initialX + deltaX.roundToInt()
                    params.y = initialY + deltaY.roundToInt()
                    windowManager.updateViewLayout(view, params)
                    true
                }
                MotionEvent.ACTION_UP -> {
                    mainHandler.removeCallbacks(longPress)
                    if (longPressTriggered) return@setOnTouchListener true
                    val moved = abs(event.rawX - downRawX) + abs(event.rawY - downRawY)
                    preferences().edit().putInt(KEY_BUBBLE_X, params.x).putInt(KEY_BUBBLE_Y, params.y).apply()
                    if (moved < dp(12)) {
                        startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                    }
                    true
                }
                MotionEvent.ACTION_CANCEL -> {
                    mainHandler.removeCallbacks(longPress)
                    true
                }
                else -> false
            }
        }
        return view
    }

    private fun removeOverlay() {
        overlay?.let { view ->
            if (view.parent != null) windowManager.removeView(view)
        }
        overlay = null
        overlayParams = null
    }

    private fun circle(color: Int) = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(color)
        setStroke(dp(3), Color.WHITE)
    }

    private fun createNotificationChannel() {
        val manager = getSystemService(NotificationManager::class.java)
        val channel = NotificationChannel(CHANNEL_ID, "Garage monitoring", NotificationManager.IMPORTANCE_LOW).apply {
            description = "Keeps the local garage-door monitor active"
            setShowBadge(false)
        }
        manager.createNotificationChannel(channel)
    }

    private fun buildNotification(text: String): Notification {
        val openApp = PendingIntent.getActivity(
            this,
            1,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val stop = PendingIntent.getService(
            this,
            2,
            Intent(this, GarageMonitorService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(com.d2rei.garagedoor.R.drawable.ic_garage)
            .setContentTitle("Garage door monitor")
            .setContentText(text)
            .setContentIntent(openApp)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(Notification.CATEGORY_SERVICE)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .addAction(Notification.Action.Builder(null, "Stop", stop).build())
            .build()
    }

    private fun startForegroundCompat(notification: Notification) {
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun updateNotification(text: String) {
        getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, buildNotification(text))
    }

    private fun notificationText(state: String, confidence: Double, lastFrame: String): String {
        val frame = lastFrame.substringAfter('T', lastFrame).take(8)
        return "$state · ${(confidence * 100).roundToInt()}%" + if (frame.isNotBlank()) " · $frame" else ""
    }

    private fun safeMessage(error: Exception): String =
        (error.message ?: error.javaClass.simpleName).replace(Regex("https?://[^ ]+"), "server")

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).roundToInt()
    private fun preferences() = getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    companion object {
        const val PREFS = "garage_monitor"
        const val KEY_ENABLED = "enabled"
        const val KEY_SERVER_URL = "server_url"
        const val KEY_API_TOKEN = "api_token"
        const val KEY_LAST_STATE = "last_state"
        const val KEY_CONFIDENCE = "confidence"
        const val KEY_LAST_FRAME = "last_frame"
        const val KEY_LAST_ERROR = "last_error"
        const val KEY_LAST_POLL = "last_poll"
        const val KEY_LAST_OPEN = "last_confirmed_open"
        const val KEY_LAST_REMOTE_STATE = "last_remote_state"
        const val KEY_LAST_REMOTE_AT = "last_remote_at"
        const val KEY_WAKE_ALERT = "wake_alert_enabled"
        const val KEY_WAKE_SUPPRESSED = "wake_suppressed_for_current_open"
        const val KEY_WAKE_ALERT_ACTIVE = "wake_alert_active"
        const val KEY_SLEEP_ON_CLOSE = "sleep_on_close_enabled"
        const val KEY_BUBBLE_X = "bubble_x"
        const val KEY_BUBBLE_Y = "bubble_y"
        const val KEY_OVERLAY_ENABLED = "overlay_enabled"
        const val KEY_OVERLAY_DISMISSED = "overlay_dismissed_for_current_open"
        const val ACTION_STOP = "com.d2rei.garagedoor.STOP"
        const val ACTION_POLL = "com.d2rei.garagedoor.POLL"
        const val ACTION_APPLY_REMOTE_STATE = "com.d2rei.garagedoor.APPLY_REMOTE_STATE"
        const val EXTRA_REMOTE_STATE = "remote_state"
        const val EXTRA_REMOTE_CONFIDENCE = "remote_confidence"
        const val EXTRA_REMOTE_OCCURRED_AT = "remote_occurred_at"
        const val ACTION_HIDE_OVERLAY = "com.d2rei.garagedoor.HIDE_OVERLAY"
        const val ACTION_DISABLE_OVERLAY = "com.d2rei.garagedoor.DISABLE_OVERLAY"
        const val ACTION_ENABLE_OVERLAY = "com.d2rei.garagedoor.ENABLE_OVERLAY"
        const val DEFAULT_SERVER_URL = "http://192.168.1.119:8765"
        private const val CHANNEL_ID = "garage_monitor"
        private const val NOTIFICATION_ID = 4101
        private const val POLL_SECONDS = 15L
        private const val REMOTE_STATE_MAX_AGE_MS = 24 * 60 * 60 * 1000L
    }
}
