package com.d2rei.buddyoverlay

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.util.AttributeSet
import android.view.View
import androidx.core.content.ContextCompat
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

class BubbleStatusView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : View(context, attrs) {
    private val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
    }
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textAlign = Paint.Align.CENTER
        isFakeBoldText = true
    }
    private val badgePaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val badgeTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textAlign = Paint.Align.CENTER
        isFakeBoldText = true
    }

    private val arcRect = RectF()

    private var state: BuddyUiState? = null
    private var settings: BuddySettings? = null
    private var selectedBattleCooldownMs: Long? = null

    fun bind(state: BuddyUiState, settings: BuddySettings, selectedBattleCooldownMs: Long? = state.shortestBattleCooldownMs) {
        this.state = state
        this.settings = settings
        this.selectedBattleCooldownMs = selectedBattleCooldownMs
        alpha = settings.bubbleOpacity.coerceIn(0.2f, 1f)
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val state = state ?: return
        val settings = settings ?: return
        val w = width.toFloat()
        val h = height.toFloat()
        val size = min(w, h)
        val radius = size / 2f
        val pulse = pulseFactor(state.decayRemainingMs)

        val urgencyColor = when {
            state.decayRemainingMs <= 5 * 60_000L -> ContextCompat.getColor(context, R.color.accentDanger)
            state.decayRemainingMs <= 10 * 60_000L -> ContextCompat.getColor(context, R.color.accentWarm)
            else -> ContextCompat.getColor(context, R.color.accentReady)
        }

        bgPaint.color = urgencyColor
        bgPaint.alpha = (145 * pulse).toInt().coerceIn(80, 220)
        canvas.drawCircle(w / 2f, h / 2f, radius * 0.92f, bgPaint)

        ringPaint.color = Color.WHITE
        ringPaint.strokeWidth = radius * 0.11f
        ringPaint.alpha = 55
        arcRect.set(w / 2f - radius * 0.82f, h / 2f - radius * 0.82f, w / 2f + radius * 0.82f, h / 2f + radius * 0.82f)
        canvas.drawArc(arcRect, 0f, 360f, false, ringPaint)

        ringPaint.alpha = 220
        val progress = if (state.decayIntervalMs > 0) state.decayRemainingMs.toFloat() / state.decayIntervalMs.toFloat() else 0f
        canvas.drawArc(arcRect, -90f, 360f * progress, false, ringPaint)

        textPaint.textSize = radius * 0.72f
        canvas.drawText(state.ep.toString(), w / 2f, h / 2f + radius * 0.23f, textPaint)

        drawBadge(canvas, radius * 0.30f, h / 2f, radius * 0.24f, state.careCooldownMs, "C")
        selectedBattleCooldownMs?.let { remainingMs ->
            drawBadge(canvas, w - radius * 0.30f, h / 2f, radius * 0.24f, remainingMs, "B")
        }

        if (settings.readyNotificationsEnabled && state.excited) {
            ringPaint.strokeWidth = radius * 0.05f
            ringPaint.color = ContextCompat.getColor(context, R.color.accent)
            ringPaint.alpha = (180 * pulse).toInt().coerceIn(100, 255)
            canvas.drawCircle(w / 2f, h / 2f, radius * 0.98f, ringPaint)
        }
    }

    private fun drawBadge(canvas: Canvas, cx: Float, cy: Float, r: Float, remainingMs: Long, fallback: String) {
        val ready = remainingMs <= 0L
        badgePaint.color = if (ready) {
            ContextCompat.getColor(context, R.color.accentReady)
        } else {
            ContextCompat.getColor(context, R.color.badgeBg)
        }
        badgePaint.alpha = if (ready) 220 else 190
        canvas.drawCircle(cx, cy, r, badgePaint)

        badgeTextPaint.textSize = r * 0.95f
        val text = if (ready) fallback else kotlin.math.ceil(remainingMs / 60_000.0).toInt().toString()
        canvas.drawText(text, cx, cy + r * 0.32f, badgeTextPaint)
    }

    private fun pulseFactor(remainingMs: Long): Float {
        if (remainingMs > 5 * 60_000L) return 1f
        val oscillation = ((sin(System.currentTimeMillis() / 250.0) + 1.0) / 2.0).toFloat()
        return max(0.82f, min(1.18f, 0.82f + oscillation * 0.36f))
    }
}
