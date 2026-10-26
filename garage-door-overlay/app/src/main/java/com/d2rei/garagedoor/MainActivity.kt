package com.d2rei.garagedoor

import android.Manifest
import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.text.InputType
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Switch
import android.widget.TextView
import java.text.DateFormat
import java.util.Date
import kotlin.math.roundToInt

class MainActivity : Activity() {
    private lateinit var serverInput: EditText
    private lateinit var tokenInput: EditText
    private lateinit var statusView: TextView
    private lateinit var permissionView: TextView
    private lateinit var sleepSwitch: Switch
    private lateinit var alertStatusView: TextView
    private lateinit var pairingCodeInput: EditText
    private val alertSwitches = mutableMapOf<String, Switch>()
    private val handler = Handler(Looper.getMainLooper())
    private val refresh = object : Runnable {
        override fun run() {
            renderStatus()
            handler.postDelayed(this, 2_000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(buildContent())
        handlePairingIntent(intent)
        AlertRegistration.syncActive(this)
        if (AlertRegistration.isPaired(this)) requestNotificationPermissionIfNeeded()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handlePairingIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        handler.post(refresh)
    }

    override fun onPause() {
        handler.removeCallbacks(refresh)
        super.onPause()
    }

    private fun buildContent(): ScrollView {
        val scroll = ScrollView(this)
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(22), dp(20), dp(28))
            setBackgroundColor(Color.rgb(17, 24, 39))
        }
        scroll.addView(content, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

        content.addView(label("Drein Alerts", 30f, Color.WHITE).apply { setTypeface(typeface, 1) })
        content.addView(label("Private notifications for this phone", 15f, Color.rgb(156, 163, 175)))
        alertStatusView = panelText()
        content.addView(alertStatusView, margin(top = 16))
        pairingCodeInput = EditText(this).apply {
            hint = "Six-digit pairing code"
            setTextColor(Color.WHITE)
            setHintTextColor(Color.GRAY)
            inputType = InputType.TYPE_CLASS_NUMBER
            setSingleLine(true)
            setBackgroundColor(Color.rgb(55, 65, 81))
            setPadding(dp(12), dp(10), dp(12), dp(10))
        }
        content.addView(pairingCodeInput, margin(top = 8))
        content.addView(button("Pair this phone") {
            val code = pairingCodeInput.text.toString().trim()
            if (!code.matches(Regex("\\d{6}"))) {
                pairingCodeInput.error = "Enter the six-digit code"
            } else {
                requestNotificationPermissionIfNeeded()
                AlertRegistration.claim(this, code = code) { handler.post { renderStatus() } }
                renderStatus()
            }
        }, margin(top = 8))
        content.addView(label("Notifications sent to this phone", 16f, Color.WHITE), margin(top = 18))
        val savedSubscriptions = AlertRegistration.subscriptions(this)
        val labels = mapOf("garage" to "Garage state", "nrl" to "NRL tips", "nrlw" to "NRLW tips", "pogo" to "Pokémon availability", "system" to "System and tests")
        AlertRegistration.categories.forEach { category ->
            val toggle = Switch(this).apply {
                text = labels[category] ?: category
                textSize = 15f
                setTextColor(Color.WHITE)
                isChecked = savedSubscriptions.getOrDefault(category, true)
                setPadding(dp(6), dp(6), dp(6), dp(6))
                setOnCheckedChangeListener { _, _ ->
                    val values = AlertRegistration.categories.associateWith { key -> alertSwitches[key]?.isChecked ?: true }
                    AlertRegistration.updateSubscriptions(this@MainActivity, values) { handler.post { renderStatus() } }
                }
            }
            alertSwitches[category] = toggle
            content.addView(toggle)
        }

        content.addView(label("Garage Door", 24f, Color.WHITE).apply { setTypeface(typeface, 1) }, margin(top = 26))
        content.addView(label("Local overlay monitor", 15f, Color.rgb(156, 163, 175)))
        statusView = panelText()
        permissionView = panelText()
        content.addView(statusView, margin(top = 20))
        content.addView(permissionView, margin(top = 10))

        content.addView(label("Monitor PC address", 16f, Color.WHITE), margin(top = 22))
        serverInput = EditText(this).apply {
            setText(preferences().getString(GarageMonitorService.KEY_SERVER_URL, GarageMonitorService.DEFAULT_SERVER_URL))
            setTextColor(Color.WHITE)
            setHintTextColor(Color.GRAY)
            setSingleLine(true)
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            setBackgroundColor(Color.rgb(55, 65, 81))
            setPadding(dp(12), dp(10), dp(12), dp(10))
        }
        content.addView(serverInput, margin(top = 6))
        content.addView(label("Access token", 16f, Color.WHITE), margin(top = 14))
        tokenInput = EditText(this).apply {
            setText(preferences().getString(GarageMonitorService.KEY_API_TOKEN, ""))
            setTextColor(Color.WHITE)
            setHintTextColor(Color.GRAY)
            hint = "Copy from the PC setup page"
            setSingleLine(true)
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            setBackgroundColor(Color.rgb(55, 65, 81))
            setPadding(dp(12), dp(10), dp(12), dp(10))
        }
        content.addView(tokenInput, margin(top = 6))
        content.addView(button("Save address") {
            if (persistAddress() && preferences().getBoolean(GarageMonitorService.KEY_ENABLED, false)) pollNow()
        }, margin(top = 8))

        content.addView(button("1. Allow floating overlay") { requestOverlayPermission() }, margin(top = 20))
        content.addView(button("2. Start monitoring") { startMonitoring() }, margin(top = 8))
        val wakeSwitch = Switch(this).apply {
            text = "Wake locked screen when door opens"
            textSize = 16f
            setTextColor(Color.WHITE)
            isChecked = preferences().getBoolean(GarageMonitorService.KEY_WAKE_ALERT, false)
            setPadding(dp(6), dp(10), dp(6), dp(10))
            setOnCheckedChangeListener { _, enabled ->
                preferences().edit().putBoolean(GarageMonitorService.KEY_WAKE_ALERT, enabled).apply()
            }
        }
        content.addView(wakeSwitch, margin(top = 12))
        content.addView(label(
            "When enabled, a newly detected OPEN state can wake the display and show a moving alert over the lock screen. " +
                "A secure Pixel still requires your fingerprint, PIN, or pattern to unlock.",
            13f,
            Color.rgb(156, 163, 175),
        ), margin(top = 4))
        content.addView(button("Preview black alert") {
            startActivity(Intent(this, DoorAlertActivity::class.java).putExtra(DoorAlertActivity.EXTRA_PREVIEW, true))
        }, margin(top = 8))
        sleepSwitch = Switch(this).apply {
            text = "Turn screen off when door closes"
            textSize = 16f
            setTextColor(Color.WHITE)
            isChecked = preferences().getBoolean(GarageMonitorService.KEY_SLEEP_ON_CLOSE, false)
            setPadding(dp(6), dp(10), dp(6), dp(10))
            setOnCheckedChangeListener { _, enabled ->
                preferences().edit().putBoolean(GarageMonitorService.KEY_SLEEP_ON_CLOSE, enabled).apply()
                if (enabled && !isDeviceAdminActive()) requestDeviceAdmin()
            }
        }
        content.addView(sleepSwitch, margin(top = 12))
        content.addView(label(
            "Optional: Android will ask for device-admin force-lock permission. It is used only when CLOSED is detected while the black bouncing alert is still active. Dismissing the alert or manually switching the screen off prevents it.",
            13f,
            Color.rgb(156, 163, 175),
        ), margin(top = 4))
        content.addView(button("Grant screen-off permission") { requestDeviceAdmin() }, margin(top = 8))
        content.addView(button("Check now") { pollNow() }, margin(top = 8))
        content.addView(button("Start overlay") { setOverlayEnabled(true) }, margin(top = 8))
        content.addView(button("Stop overlay", danger = true) { setOverlayEnabled(false) }, margin(top = 8))
        content.addView(button("Pixel app battery settings") { openAppSettings() }, margin(top = 8))
        content.addView(button("Stop monitoring", danger = true) { stopMonitoring() }, margin(top = 8))

        content.addView(label(
            "For best reliability on a Pixel, enable Allow background usage and choose Unrestricted in this app's battery settings. " +
                "The ongoing notification is intentional: Android requires it for a durable foreground monitor. " +
                "If the PC becomes unreachable after an OPEN result, the bubble changes to CHECK and stays visible until CLOSED is confirmed.",
            14f,
            Color.rgb(209, 213, 219),
        ), margin(top = 22))
        return scroll
    }

    private fun persistAddress(): Boolean {
        val value = serverInput.text.toString().trim().trimEnd('/')
        if (!value.startsWith("http://") && !value.startsWith("https://")) {
            serverInput.error = "Start the address with http:// or https://"
            return false
        }
        preferences().edit().putString(GarageMonitorService.KEY_SERVER_URL, value).apply()
        val token = tokenInput.text.toString().trim()
        if (token.isBlank()) {
            tokenInput.error = "Enter the access token shown on the PC"
            return false
        }
        preferences().edit().putString(GarageMonitorService.KEY_API_TOKEN, token).apply()
        return true
    }

    private fun requestOverlayPermission() {
        startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
    }

    private fun startMonitoring() {
        if (!persistAddress()) return
        if (!Settings.canDrawOverlays(this)) {
            requestOverlayPermission()
            return
        }
        requestNotificationPermissionIfNeeded()
        preferences().edit().putBoolean(GarageMonitorService.KEY_ENABLED, true).apply()
        startForegroundService(Intent(this, GarageMonitorService::class.java))
        PushRegistration.register(this)
        renderStatus()
    }

    private fun stopMonitoring() {
        preferences().edit().putBoolean(GarageMonitorService.KEY_ENABLED, false).apply()
        stopService(Intent(this, GarageMonitorService::class.java))
        GarageStatusWidgetProvider.updateAll(this)
        renderStatus()
    }

    private fun setOverlayEnabled(enabled: Boolean) {
        preferences().edit()
            .putBoolean(GarageMonitorService.KEY_OVERLAY_ENABLED, enabled)
            .putBoolean(GarageMonitorService.KEY_OVERLAY_DISMISSED, false)
            .apply()
        if (preferences().getBoolean(GarageMonitorService.KEY_ENABLED, false)) {
            startService(
                Intent(this, GarageMonitorService::class.java).setAction(
                    if (enabled) GarageMonitorService.ACTION_ENABLE_OVERLAY
                    else GarageMonitorService.ACTION_DISABLE_OVERLAY,
                ),
            )
        }
        renderStatus()
    }

    private fun pollNow() {
        if (!preferences().getBoolean(GarageMonitorService.KEY_ENABLED, false)) {
            startMonitoring()
            return
        }
        startService(Intent(this, GarageMonitorService::class.java).setAction(GarageMonitorService.ACTION_POLL))
    }

    private fun openAppSettings() {
        startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")))
    }

    private fun deviceAdminComponent() = ComponentName(this, GarageDeviceAdminReceiver::class.java)

    private fun isDeviceAdminActive(): Boolean =
        getSystemService(DevicePolicyManager::class.java).isAdminActive(deviceAdminComponent())

    private fun requestDeviceAdmin() {
        if (isDeviceAdminActive()) return
        startActivityForResult(
            Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN)
                .putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, deviceAdminComponent())
                .putExtra(
                    DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                    "Allows Garage Door to switch the display off when the bouncing OPEN alert receives a CLOSED status.",
                ),
            REQUEST_DEVICE_ADMIN,
        )
    }

    @Deprecated("Android still returns the device-admin activation result through this callback")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_DEVICE_ADMIN) {
            val active = isDeviceAdminActive()
            if (!active) {
                preferences().edit().putBoolean(GarageMonitorService.KEY_SLEEP_ON_CLOSE, false).apply()
                sleepSwitch.isChecked = false
            }
            renderStatus()
        }
    }

    private fun renderStatus() {
        val prefs = preferences()
        alertStatusView.text = buildString {
            append(if (AlertRegistration.isPaired(this@MainActivity)) "ALERTS CONNECTED" else "ALERTS NOT PAIRED")
            append("\n")
            append(prefs.getString(AlertRegistration.KEY_STATUS, "Use the owner page to create a QR link or six-digit code."))
        }
        val enabled = prefs.getBoolean(GarageMonitorService.KEY_ENABLED, false)
        val state = prefs.getString(GarageMonitorService.KEY_LAST_STATE, "Not checked") ?: "Not checked"
        val confidence = prefs.getFloat(GarageMonitorService.KEY_CONFIDENCE, 0f)
        val pollTime = prefs.getLong(GarageMonitorService.KEY_LAST_POLL, 0)
        val error = prefs.getString(GarageMonitorService.KEY_LAST_ERROR, "").orEmpty()
        val pushStatus = prefs.getString(PushRegistration.KEY_PUSH_STATUS, "Not registered").orEmpty()
        statusView.text = buildString {
            append(if (enabled) "MONITORING" else "STOPPED")
            append("\nState: $state")
            if (confidence > 0f) append(" · ${(confidence * 100).roundToInt()}%")
            if (pollTime > 0) append("\nChecked: ${DateFormat.getTimeInstance(DateFormat.MEDIUM).format(Date(pollTime))}")
            if (error.isNotBlank() && state !in listOf("OPEN", "CLOSED")) append("\n$error")
        }
        permissionView.text = buildString {
            append(if (Settings.canDrawOverlays(this@MainActivity)) "✓ Overlay allowed" else "○ Overlay permission needed")
            if (Build.VERSION.SDK_INT >= 33) {
                append(if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) "\n✓ Notifications allowed" else "\n○ Notification permission needed")
            }
            append(if (isDeviceAdminActive()) "\n✓ Screen-off permission allowed" else "\n○ Screen-off permission optional")
            append("\nPush: $pushStatus")
        }
    }

    private fun panelText() = label("", 16f, Color.WHITE).apply {
        setPadding(dp(14), dp(13), dp(14), dp(13))
        setBackgroundColor(Color.rgb(31, 41, 55))
    }

    private fun button(text: String, danger: Boolean = false, action: () -> Unit) = Button(this).apply {
        this.text = text
        isAllCaps = false
        setTextColor(Color.WHITE)
        setBackgroundColor(if (danger) Color.rgb(185, 28, 28) else Color.rgb(37, 99, 235))
        setOnClickListener { action() }
    }

    private fun label(text: String, size: Float, color: Int) = TextView(this).apply {
        this.text = text
        textSize = size
        setTextColor(color)
        gravity = Gravity.START
    }

    private fun margin(top: Int = 0) = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT,
    ).apply { topMargin = dp(top) }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).roundToInt()
    private fun preferences() = getSharedPreferences(GarageMonitorService.PREFS, Context.MODE_PRIVATE)

    private fun handlePairingIntent(intent: Intent?) {
        val token = intent?.data?.takeIf { it.scheme == "dreinalerts" && it.host == "pair" }
            ?.getQueryParameter("token").orEmpty()
        if (token.isBlank()) return
        requestNotificationPermissionIfNeeded()
        AlertRegistration.claim(this, token = token) { handler.post { renderStatus() } }
        intent?.data = null
        renderStatus()
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 41)
        }
    }

    companion object {
        private const val REQUEST_DEVICE_ADMIN = 42
    }
}
