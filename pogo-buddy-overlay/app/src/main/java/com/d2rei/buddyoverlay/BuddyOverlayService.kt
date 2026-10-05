package com.d2rei.buddyoverlay

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.widget.Button
import android.widget.CheckBox
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.widget.AppCompatImageButton
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

class BuddyOverlayService : LifecycleService() {
    private lateinit var windowManager: WindowManager
    private lateinit var repository: BuddyRepository
    private lateinit var prefs: android.content.SharedPreferences

    private var bubbleView: BubbleStatusView? = null
    private var snapView: TextView? = null
    private var expandedView: View? = null
    private var menuView: View? = null
    private var bubbleParams: WindowManager.LayoutParams? = null
    private var expandedParams: WindowManager.LayoutParams? = null
    private var menuParams: WindowManager.LayoutParams? = null
    private var tickJob: Job? = null
    private var captureRestoreJob: Job? = null
    private var lastUiState: OverlayUiState? = null
    private var excitedNotified = false
    private val captureResultReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            captureRestoreJob?.cancel()
            if (isSnapMode()) ensureSnapBubble()
            if (intent?.action == PostcardCaptureService.ACTION_CAPTURED) return
            val success = intent?.getBooleanExtra(PostcardCaptureService.EXTRA_SUCCESS, false) == true
            val message = intent?.getStringExtra(PostcardCaptureService.EXTRA_MESSAGE)
                ?: if (success) "Postcard sent" else "Postcard capture failed"
            Toast.makeText(this@BuddyOverlayService, message, Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        repository = BuddyRepository.get(this)
        prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        ensureNotificationChannel()
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(
                captureResultReceiver,
                captureIntentFilter(),
                Context.RECEIVER_NOT_EXPORTED,
            )
        } else {
            registerReceiver(captureResultReceiver, captureIntentFilter())
        }
    }

    private fun captureIntentFilter() = IntentFilter(PostcardCaptureService.ACTION_RESULT).apply {
        addAction(PostcardCaptureService.ACTION_CAPTURED)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action ?: ACTION_START) {
            ACTION_START -> {
                if (!Settings.canDrawOverlays(this)) {
                    stopSelf()
                    return START_NOT_STICKY
                }
                startForeground(NOTIFICATION_ID, buildNotification())
                ensureCurrentBubble()
                startTicker()
            }

            ACTION_STOP -> stopSelf()
            ACTION_SNAP_MODE -> {
                startForeground(NOTIFICATION_ID, buildNotification())
                startTicker()
                enterSnapMode()
            }
            ACTION_BUDDY_MODE -> {
                startForeground(NOTIFICATION_ID, buildNotification())
                startTicker()
                returnToBuddyMode()
            }
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        tickJob?.cancel()
        captureRestoreJob?.cancel()
        unregisterReceiver(captureResultReceiver)
        stopService(Intent(this, PostcardCaptureService::class.java))
        removeMenu()
        removeExpanded()
        removeBubble()
        super.onDestroy()
    }

    private fun startTicker() {
        tickJob?.cancel()
        tickJob = lifecycleScope.launch {
            while (true) {
                refreshState()
                delay(1_000L)
            }
        }
    }

    private suspend fun refreshState() {
        val now = System.currentTimeMillis()
        val state = repository.currentState(now)
        val settings = repository.loadSettings()
        val uiState = OverlayUiState(state, settings)
        lastUiState = uiState
        bubbleView?.bind(state, settings, selectedBattleCooldownMs(state))
        refreshExpanded(uiState)
        refreshBattleBreakdown(uiState)
        maybeNotifyExcited(uiState)
    }

    private fun maybeNotifyExcited(uiState: OverlayUiState) {
        if (uiState.settings.readyNotificationsEnabled && uiState.buddyState.excited && !excitedNotified) {
            getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, buildNotification("Buddy excited"))
            excitedNotified = true
        } else if (!uiState.buddyState.excited) {
            excitedNotified = false
        }
    }

    private fun recordOverlayAction(actionType: BuddyActionType) {
        lifecycleScope.launch {
            val now = System.currentTimeMillis()
            val before = repository.currentState(now)
            repository.recordAction(actionType, now)
            val after = repository.currentState(now)
            val lastResolved = after.events.lastOrNull()
            val strongGain = lastResolved?.grantedEp?.let { it > 0 } == true && after.ep > before.ep
            animateBubble(strongGain)
            if ((lastUiState?.settings?.vibrationEnabled == true) && strongGain) {
                bubbleView?.performHapticFeedback(android.view.HapticFeedbackConstants.KEYBOARD_TAP)
            }
        }
    }

    private fun animateBubble(strongGain: Boolean) {
        val bubble = bubbleView ?: return
        val grow = if (strongGain) 1.16f else 1.06f
        val duration = if (strongGain) 120L else 80L
        bubble.animate()
            .scaleX(grow)
            .scaleY(grow)
            .setDuration(duration)
            .withEndAction {
                bubble.animate().scaleX(1f).scaleY(1f).setDuration(duration + 80L).start()
            }
            .start()
    }

    private fun ensureBubble() {
        if (bubbleView != null || isSnapMode()) return
        val bubble = BubbleStatusView(this)
        val size = dp(lastUiState?.settings?.bubbleSizeDp ?: BuddyGameplayDefaults.bubbleSizeDp)
        val defaultX = (resources.displayMetrics.widthPixels - size - dp(24)).coerceAtLeast(0)
        val defaultY = (resources.displayMetrics.heightPixels / 3).coerceAtLeast(0)
        val rawX = prefs.getInt(KEY_BUBBLE_X, defaultX)
        val rawY = prefs.getInt(KEY_BUBBLE_Y, defaultY)
        val clampedX = rawX.coerceIn(0, (resources.displayMetrics.widthPixels - size).coerceAtLeast(0))
        val clampedY = rawY.coerceIn(0, (resources.displayMetrics.heightPixels - size).coerceAtLeast(0))
        val params = WindowManager.LayoutParams(
            size,
            size,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = clampedX
            y = clampedY
        }
        bubble.setOnTouchListener(BubbleTouchListener())
        windowManager.addView(bubble, params)
        bubbleView = bubble
        bubbleParams = params
        if (rawX != clampedX || rawY != clampedY) {
            prefs.edit().putInt(KEY_BUBBLE_X, clampedX).putInt(KEY_BUBBLE_Y, clampedY).apply()
        }
    }

    private fun ensureCurrentBubble() {
        if (isSnapMode()) ensureSnapBubble() else ensureBubble()
    }

    private fun ensureSnapBubble() {
        if (snapView != null || !isSnapMode()) return
        val size = dp(lastUiState?.settings?.bubbleSizeDp ?: BuddyGameplayDefaults.bubbleSizeDp)
        val defaultX = (resources.displayMetrics.widthPixels - size - dp(24)).coerceAtLeast(0)
        val defaultY = (resources.displayMetrics.heightPixels / 3).coerceAtLeast(0)
        val rawX = prefs.getInt(KEY_BUBBLE_X, defaultX)
        val rawY = prefs.getInt(KEY_BUBBLE_Y, defaultY)
        val params = WindowManager.LayoutParams(
            size,
            size,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = rawX.coerceIn(0, (resources.displayMetrics.widthPixels - size).coerceAtLeast(0))
            y = rawY.coerceIn(0, (resources.displayMetrics.heightPixels - size).coerceAtLeast(0))
        }
        val snap = TextView(this).apply {
            text = "SNAP"
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
            textSize = 11f
            setTypeface(Typeface.DEFAULT, Typeface.BOLD)
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.rgb(220, 38, 38))
                setStroke(dp(2), Color.WHITE)
            }
            elevation = dp(6).toFloat()
            contentDescription = "Capture postcard. Long press to return to buddy tracker."
            setOnTouchListener(SnapTouchListener())
        }
        windowManager.addView(snap, params)
        snapView = snap
        bubbleParams = params
    }

    private fun ensureExpanded(uiState: OverlayUiState) {
        if (expandedView != null) {
            refreshExpanded(uiState)
            return
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = ContextCompat.getDrawable(this@BuddyOverlayService, R.drawable.bg_panel)
            alpha = 1f
            setPadding(dp(10), dp(10), dp(10), dp(10))
        }

        val topRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val statusView = TextView(this).apply {
            tag = STATUS_TAG
            textSize = 14f
            setTextColor(ContextCompat.getColor(this@BuddyOverlayService, R.color.textPrimary))
            setPadding(dp(6), dp(4), dp(12), dp(4))
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            setOnTouchListener(OverlayDragTouchListener())
        }
        val undoButton = overlayIconButton(android.R.drawable.ic_menu_revert, "Undo") {
            lifecycleScope.launch { repository.undoLatest() }
        }
        val minimiseButton = overlayIconButton(android.R.drawable.arrow_down_float, "Minimise") {
            removeExpanded()
        }
        val cameraButton = overlayIconButton(android.R.drawable.ic_menu_camera, "Postcard capture") {
            enterSnapMode()
        }
        topRow.addView(statusView)
        topRow.addView(cameraButton)
        topRow.addView(undoButton)
        topRow.addView(minimiseButton)
        root.addView(topRow)

        val grid = android.widget.GridLayout(this).apply {
            columnCount = 3
            rowCount = 3
            useDefaultMargins = true
            tag = GRID_TAG
        }
        BuddyActionType.trackableActions.forEach { actionType ->
            val tile = ActionTileView(this).apply {
                tag = actionType.storageKey
                setOnClickListener {
                    recordOverlayAction(actionType)
                }
            }
            grid.addView(tile, android.widget.GridLayout.LayoutParams().apply {
                width = dp(62)
                height = dp(62)
            })
        }
        root.addView(grid)

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = max(0, (bubbleParams?.x ?: 0) - dp(78))
            y = max(0, (bubbleParams?.y ?: 0) - dp(86))
        }

        windowManager.addView(root, params)
        expandedView = root
        expandedParams = params
        refreshExpanded(uiState)
    }

    private fun refreshExpanded(uiState: OverlayUiState) {
        val root = expandedView as? LinearLayout ?: return
        root.alpha = 1f
        root.findViewWithTag<TextView>(STATUS_TAG)?.text = buildExpandedStatus(uiState)
        val grid = root.findViewWithTag<android.widget.GridLayout>(GRID_TAG) ?: return
        BuddyActionType.trackableActions.forEachIndexed { index, actionType ->
            val tile = grid.getChildAt(index) as? ActionTileView ?: return@forEachIndexed
            tile.bind(
                actionType = actionType,
                cooldownState = uiState.buddyState.cooldowns.getValue(actionType),
                totalCooldownMs = uiState.settings.cooldownMsFor(actionType),
            )
        }
    }

    private fun buildExpandedStatus(uiState: OverlayUiState): String {
        val state = uiState.buddyState
        val decayMinutes = kotlin.math.ceil(state.decayRemainingMs / 60_000.0).toInt().coerceAtLeast(0)
        return buildString {
            append(state.ep)
            append("/")
            append(state.excitedThresholdEp)
            append(" EP")
            append("  ")
            append(decayMinutes)
            append("m")
        }
    }

    private fun enterSnapMode() {
        prefs.edit().putBoolean(KEY_SNAP_MODE, true).apply()
        removeMenu()
        removeExpanded()
        removeBubble()
        ensureSnapBubble()
    }

    private fun returnToBuddyMode() {
        prefs.edit().putBoolean(KEY_SNAP_MODE, false).apply()
        captureRestoreJob?.cancel()
        stopService(Intent(this, PostcardCaptureService::class.java))
        removeMenu()
        removeExpanded()
        removeBubble()
        ensureBubble()
    }

    private fun requestPostcardCapture() {
        removeBubble()
        captureRestoreJob?.cancel()
        captureRestoreJob = lifecycleScope.launch {
            delay(60_000L)
            if (isSnapMode()) ensureSnapBubble()
        }
        if (PostcardCaptureService.isSessionActive(this)) {
            PostcardCaptureService.requestCapture(this)
        } else {
            startActivity(
                Intent(this, CapturePermissionActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
        }
    }

    private fun isSnapMode(): Boolean = prefs.getBoolean(KEY_SNAP_MODE, false)

    private fun showMenu() {
        if (menuView != null) {
            removeMenu()
            return
        }
        val anchor = bubbleParams ?: return
        val menu = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = ContextCompat.getDrawable(this@BuddyOverlayService, R.drawable.bg_panel)
            setPadding(dp(8), dp(8), dp(8), dp(8))
            alpha = 0.92f
        }
        menu.addView(menuButton("Dismiss overlay") { stopSelf() })
        menu.addView(menuButton("Reset session") {
            lifecycleScope.launch { repository.recordAction(BuddyActionType.RESET_SESSION, System.currentTimeMillis()) }
            removeMenu()
        })
        menu.addView(menuButton("Undo") {
            lifecycleScope.launch { repository.undoLatest() }
            removeMenu()
        })
        menu.addView(menuButton("View log") {
            startActivity(Intent(this, EventLogActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            removeMenu()
        })
        menu.addView(menuButton("Settings") {
            startActivity(Intent(this, SettingsActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            removeMenu()
        })

        val params = WindowManager.LayoutParams(
            dp(180),
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = max(0, anchor.x - dp(112))
            y = max(0, anchor.y - dp(160))
        }
        windowManager.addView(menu, params)
        menuView = menu
        menuParams = params
    }

    private fun showBattleBreakdown() {
        if (menuView != null) {
            removeMenu()
        }
        val anchor = bubbleParams ?: return
        val uiState = lastUiState ?: return
        val menu = LinearLayout(this).apply {
            tag = BATTLE_MENU_TAG
            orientation = LinearLayout.VERTICAL
            background = ContextCompat.getDrawable(this@BuddyOverlayService, R.drawable.bg_panel)
            setPadding(dp(10), dp(10), dp(10), dp(10))
            alpha = 1f
        }
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        header.addView(menuLabel("Battle timers").apply {
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        })
        header.addView(overlayIconButton(android.R.drawable.arrow_down_float, "Minimise") {
            removeMenu()
        })
        menu.addView(header)
        BuddyActionType.battleActions.forEach { action ->
            val remainingMs = uiState.buddyState.battleBreakdown[action] ?: 0L
            val minutes = kotlin.math.ceil(remainingMs / 60_000.0).toInt().coerceAtLeast(0)
            val value = if (remainingMs <= 0L) "Ready" else "${minutes}m"
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
            }
            val checkBox = CheckBox(this).apply {
                isChecked = isBattleIncluded(action)
                contentDescription = "Include ${action.displayName} in collapsed timer"
                buttonTintList = android.content.res.ColorStateList.valueOf(
                    ContextCompat.getColor(this@BuddyOverlayService, R.color.textPrimary),
                )
                setOnCheckedChangeListener { _, checked ->
                    prefs.edit().putBoolean(battlePreferenceKey(action), checked).apply()
                    val current = lastUiState ?: return@setOnCheckedChangeListener
                    bubbleView?.bind(
                        current.buddyState,
                        current.settings,
                        selectedBattleCooldownMs(current.buddyState),
                    )
                }
            }
            val timer = menuLabel("${action.displayName}: $value").apply {
                tag = battleTimerTag(action)
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            }
            row.addView(checkBox, LinearLayout.LayoutParams(dp(40), dp(40)))
            row.addView(timer)
            menu.addView(row)
        }

        val params = WindowManager.LayoutParams(
            dp(190),
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = max(0, anchor.x - dp(112))
            y = max(0, anchor.y - dp(180))
        }
        windowManager.addView(menu, params)
        menuView = menu
        menuParams = params
    }

    private fun refreshBattleBreakdown(uiState: OverlayUiState) {
        val menu = menuView as? LinearLayout ?: return
        if (menu.tag != BATTLE_MENU_TAG) return
        BuddyActionType.battleActions.forEach { action ->
            val remainingMs = uiState.buddyState.battleBreakdown[action] ?: 0L
            val minutes = kotlin.math.ceil(remainingMs / 60_000.0).toInt().coerceAtLeast(0)
            val value = if (remainingMs <= 0L) "Ready" else "${minutes}m"
            menu.findViewWithTag<TextView>(battleTimerTag(action))?.text = "${action.displayName}: $value"
        }
    }

    private fun selectedBattleCooldownMs(state: BuddyUiState): Long? =
        BattleIndicatorLogic.shortestCooldown(
            battleBreakdown = state.battleBreakdown,
            includedActions = BuddyActionType.battleActions.filter(::isBattleIncluded).toSet(),
        )

    private fun isBattleIncluded(action: BuddyActionType): Boolean =
        prefs.getBoolean(battlePreferenceKey(action), true)

    private fun battlePreferenceKey(action: BuddyActionType) = "battle_indicator_${action.storageKey}"

    private fun battleTimerTag(action: BuddyActionType) = "battle_timer_${action.storageKey}"

    private fun toggleExpanded() {
        val uiState = lastUiState ?: return
        if (expandedView == null) ensureExpanded(uiState) else removeExpanded()
    }

    private fun overlayMiniButton(text: String, action: () -> Unit): Button =
        Button(this).apply {
            this.text = text
            isAllCaps = false
            textSize = 10f
            minHeight = 0
            minimumHeight = 0
            setPadding(dp(8), dp(4), dp(8), dp(4))
            setTextColor(ContextCompat.getColor(this@BuddyOverlayService, R.color.textPrimary))
            background = ContextCompat.getDrawable(this@BuddyOverlayService, R.drawable.bg_chip)
            setOnClickListener { action() }
        }

    private fun overlayIconButton(iconRes: Int, description: String, action: () -> Unit): AppCompatImageButton =
        AppCompatImageButton(this).apply {
            contentDescription = description
            background = ContextCompat.getDrawable(this@BuddyOverlayService, R.drawable.bg_chip)
            setImageResource(iconRes)
            imageTintList = android.content.res.ColorStateList.valueOf(
                ContextCompat.getColor(this@BuddyOverlayService, R.color.textPrimary),
            )
            scaleType = android.widget.ImageView.ScaleType.CENTER_INSIDE
            minimumWidth = 0
            minimumHeight = 0
            layoutParams = LinearLayout.LayoutParams(dp(40), dp(30)).apply {
                marginStart = dp(4)
            }
            setPadding(dp(8), dp(6), dp(8), dp(6))
            setOnClickListener { action() }
        }

    private fun menuButton(text: String, action: () -> Unit): Button =
        Button(this).apply {
            this.text = text
            isAllCaps = false
            setTextColor(ContextCompat.getColor(this@BuddyOverlayService, R.color.textPrimary))
            background = ContextCompat.getDrawable(this@BuddyOverlayService, R.drawable.bg_chip)
            setOnClickListener { action() }
        }

    private fun menuLabel(text: String): TextView =
        TextView(this).apply {
            this.text = text
            setTextColor(ContextCompat.getColor(this@BuddyOverlayService, R.color.textPrimary))
            textSize = 13f
            setPadding(dp(6), dp(6), dp(6), dp(6))
        }

    private fun removeBubble() {
        bubbleView?.let { windowManager.removeView(it) }
        snapView?.let { windowManager.removeView(it) }
        bubbleView = null
        snapView = null
        bubbleParams = null
    }

    private fun removeExpanded() {
        expandedView?.let { windowManager.removeView(it) }
        expandedView = null
        expandedParams = null
    }

    private fun removeMenu() {
        menuView?.let { windowManager.removeView(it) }
        menuView = null
        menuParams = null
    }

    private fun updateOverlayPosition(newX: Int, newY: Int) {
        val bubble = bubbleView ?: snapView
        val bubbleParams = bubbleParams
        if (bubble != null && bubbleParams != null) {
            bubbleParams.x = newX
            bubbleParams.y = newY
            windowManager.updateViewLayout(bubble, bubbleParams)
        }

        val expanded = expandedView
        val expandedParams = expandedParams
        if (expanded != null && expandedParams != null) {
            expandedParams.x = max(0, newX - dp(78))
            expandedParams.y = max(0, newY - dp(86))
            windowManager.updateViewLayout(expanded, expandedParams)
        }

        removeMenu()
        prefs.edit().putInt(KEY_BUBBLE_X, newX).putInt(KEY_BUBBLE_Y, newY).apply()
    }

    private fun buildNotification(extraText: String? = null): Notification {
        val openApp = PendingIntent.getActivity(
            this,
            10,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val stopIntent = PendingIntent.getService(
            this,
            11,
            Intent(this, BuddyOverlayService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_popup_sync)
            .setContentTitle(getString(R.string.notification_title))
            .setContentText(extraText ?: getString(R.string.notification_text))
            .setContentIntent(openApp)
            .setOngoing(true)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", stopIntent)
            .build()
    }

    private fun ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(CHANNEL_ID, "Buddy overlay", NotificationManager.IMPORTANCE_LOW)
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private inner class BubbleTouchListener : View.OnTouchListener {
        private var downRawX = 0f
        private var downRawY = 0f
        private var startX = 0
        private var startY = 0
        private var downTime = 0L
        private var moved = false

        override fun onTouch(v: View, event: MotionEvent): Boolean {
            val params = bubbleParams ?: return false
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    downRawX = event.rawX
                    downRawY = event.rawY
                    startX = params.x
                    startY = params.y
                    downTime = System.currentTimeMillis()
                    moved = false
                    return true
                }

                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - downRawX
                    val dy = event.rawY - downRawY
                    if (abs(dx) > 8 || abs(dy) > 8) moved = true
                    val nextX = min(max(0, startX + dx.toInt()), resources.displayMetrics.widthPixels - v.width)
                    val nextY = min(max(0, startY + dy.toInt()), resources.displayMetrics.heightPixels - v.height)
                    updateOverlayPosition(nextX, nextY)
                    return true
                }

                MotionEvent.ACTION_UP -> {
                    val heldLong = System.currentTimeMillis() - downTime >= ViewConfiguration.getLongPressTimeout()
                    when {
                        !moved && heldLong -> showMenu()
                        !moved && event.x >= v.width * 0.64f -> showBattleBreakdown()
                        !moved -> toggleExpanded()
                    }
                    return true
                }
            }
            return false
        }
    }

    private inner class SnapTouchListener : View.OnTouchListener {
        private var downRawX = 0f
        private var downRawY = 0f
        private var startX = 0
        private var startY = 0
        private var downTime = 0L
        private var moved = false

        override fun onTouch(v: View, event: MotionEvent): Boolean {
            val params = bubbleParams ?: return false
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    downRawX = event.rawX
                    downRawY = event.rawY
                    startX = params.x
                    startY = params.y
                    downTime = System.currentTimeMillis()
                    moved = false
                    return true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - downRawX
                    val dy = event.rawY - downRawY
                    if (abs(dx) > 8 || abs(dy) > 8) moved = true
                    val nextX = min(max(0, startX + dx.toInt()), resources.displayMetrics.widthPixels - v.width)
                    val nextY = min(max(0, startY + dy.toInt()), resources.displayMetrics.heightPixels - v.height)
                    updateOverlayPosition(nextX, nextY)
                    return true
                }
                MotionEvent.ACTION_UP -> {
                    val heldLong = System.currentTimeMillis() - downTime >= ViewConfiguration.getLongPressTimeout()
                    if (!moved && heldLong) returnToBuddyMode()
                    else if (!moved) requestPostcardCapture()
                    return true
                }
            }
            return false
        }
    }

    private inner class OverlayDragTouchListener : View.OnTouchListener {
        private var downRawX = 0f
        private var downRawY = 0f
        private var startX = 0
        private var startY = 0
        private var moved = false

        override fun onTouch(v: View, event: MotionEvent): Boolean {
            val params = bubbleParams ?: return false
            val bubble = bubbleView ?: return false
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    downRawX = event.rawX
                    downRawY = event.rawY
                    startX = params.x
                    startY = params.y
                    moved = false
                    return true
                }

                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - downRawX
                    val dy = event.rawY - downRawY
                    if (abs(dx) > 8 || abs(dy) > 8) moved = true
                    val nextX = min(max(0, startX + dx.toInt()), resources.displayMetrics.widthPixels - bubble.width)
                    val nextY = min(max(0, startY + dy.toInt()), resources.displayMetrics.heightPixels - bubble.height)
                    updateOverlayPosition(nextX, nextY)
                    return true
                }

                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> return moved
            }
            return false
        }
    }

    companion object {
        private const val CHANNEL_ID = "buddy_overlay"
        private const val NOTIFICATION_ID = 7101
        const val PREFS = "buddy_overlay_ui"
        private const val KEY_BUBBLE_X = "bubble_x"
        private const val KEY_BUBBLE_Y = "bubble_y"
        private const val GRID_TAG = "action_grid"
        private const val STATUS_TAG = "expanded_status"
        private const val BATTLE_MENU_TAG = "battle_timer_menu"
        const val KEY_SNAP_MODE = "snap_mode"

        const val ACTION_START = "com.d2rei.buddyoverlay.START"
        const val ACTION_STOP = "com.d2rei.buddyoverlay.STOP"
        const val ACTION_SNAP_MODE = "com.d2rei.buddyoverlay.SNAP_MODE"
        const val ACTION_BUDDY_MODE = "com.d2rei.buddyoverlay.BUDDY_MODE"

        fun resetSavedPosition(context: Context) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .remove(KEY_BUBBLE_X)
                .remove(KEY_BUBBLE_Y)
                .apply()
        }
    }
}
