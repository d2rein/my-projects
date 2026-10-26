package com.d2rei.garagedoor

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.TextView
import kotlin.math.roundToInt

class DoorAlertActivity : Activity() {
    private var preview = false
    private val handler = Handler(Looper.getMainLooper())
    private val stateWatcher = object : Runnable {
        override fun run() {
            val prefs = getSharedPreferences(GarageMonitorService.PREFS, Context.MODE_PRIVATE)
            val stillOpen = prefs.getBoolean(GarageMonitorService.KEY_LAST_OPEN, false)
            val suppressed = prefs.getBoolean(GarageMonitorService.KEY_WAKE_SUPPRESSED, false)
            if (!preview && (!stillOpen || suppressed)) {
                finish()
            } else {
                handler.postDelayed(this, 500)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        preview = intent.getBooleanExtra(EXTRA_PREVIEW, false)
        if (!preview) {
            getSharedPreferences(GarageMonitorService.PREFS, Context.MODE_PRIVATE)
                .edit()
                .putBoolean(GarageMonitorService.KEY_WAKE_ALERT_ACTIVE, true)
                .apply()
        }
        setShowWhenLocked(true)
        setTurnScreenOn(true)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.statusBarColor = Color.BLACK
        window.navigationBarColor = Color.BLACK
        setContentView(BouncingDoorLayout(this))
        startService(
            android.content.Intent(this, GarageMonitorService::class.java)
                .setAction(GarageMonitorService.ACTION_HIDE_OVERLAY),
        )

        val keyguard = getSystemService(KeyguardManager::class.java)
        if (keyguard.isKeyguardLocked) {
            keyguard.requestDismissKeyguard(this, null)
        }
    }

    override fun onResume() {
        super.onResume()
        handler.post(stateWatcher)
    }

    override fun onPause() {
        handler.removeCallbacks(stateWatcher)
        super.onPause()
    }

    override fun onDestroy() {
        handler.removeCallbacks(stateWatcher)
        if (!preview) {
            val prefs = getSharedPreferences(GarageMonitorService.PREFS, Context.MODE_PRIVATE)
            prefs.edit()
                .putBoolean(GarageMonitorService.KEY_WAKE_ALERT_ACTIVE, false)
                .apply {
                    // Prevent a retry loop after Home/Overview/tap dismissal. A confirmed
                    // CLOSED state clears this suppression in the monitor service.
                    if (prefs.getBoolean(GarageMonitorService.KEY_LAST_OPEN, false) &&
                        !isChangingConfigurations
                    ) {
                        putBoolean(GarageMonitorService.KEY_WAKE_SUPPRESSED, true)
                    }
                }
                .apply()
        }
        super.onDestroy()
    }

    private class BouncingDoorLayout(context: Context) : FrameLayout(context) {
        private val density = resources.displayMetrics.density
        private val button = TextView(context).apply {
            text = "DOOR\nOPEN"
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
            textSize = 15f
            setTypeface(Typeface.DEFAULT, Typeface.BOLD)
            background = android.graphics.drawable.GradientDrawable().apply {
                shape = android.graphics.drawable.GradientDrawable.OVAL
                setColor(Color.rgb(220, 38, 38))
                setStroke((3 * density).roundToInt(), Color.WHITE)
            }
            contentDescription = "Garage door is open. Tap to dismiss this screen."
            setOnClickListener { (context as? Activity)?.finish() }
        }
        private var positionX = 0f
        private var positionY = 0f
        private var velocityX = 17f * density
        private var velocityY = 13f * density
        private var previousNanos = 0L

        init {
            setBackgroundColor(Color.BLACK)
            val size = (88 * density).roundToInt()
            addView(button, LayoutParams(size, size))
        }

        override fun onSizeChanged(width: Int, height: Int, oldWidth: Int, oldHeight: Int) {
            super.onSizeChanged(width, height, oldWidth, oldHeight)
            if (oldWidth == 0 || oldHeight == 0) {
                positionX = (width - button.layoutParams.width) / 2f
                positionY = (height - button.layoutParams.height) / 2f
            }
            previousNanos = 0L
            postInvalidateOnAnimation()
        }

        override fun dispatchDraw(canvas: android.graphics.Canvas) {
            val now = System.nanoTime()
            if (previousNanos != 0L) {
                val elapsed = ((now - previousNanos) / 1_000_000_000f).coerceAtMost(0.05f)
                positionX += velocityX * elapsed
                positionY += velocityY * elapsed
                val maxX = (width - button.width).coerceAtLeast(0).toFloat()
                val maxY = (height - button.height).coerceAtLeast(0).toFloat()
                if (positionX <= 0f || positionX >= maxX) {
                    positionX = positionX.coerceIn(0f, maxX)
                    velocityX = -velocityX
                }
                if (positionY <= 0f || positionY >= maxY) {
                    positionY = positionY.coerceIn(0f, maxY)
                    velocityY = -velocityY
                }
                button.translationX = positionX
                button.translationY = positionY
            }
            previousNanos = now
            super.dispatchDraw(canvas)
            postInvalidateOnAnimation()
        }
    }

    companion object {
        const val EXTRA_PREVIEW = "preview"
    }
}
