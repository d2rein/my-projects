package com.d2rei.buddyoverlay

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import android.util.AttributeSet
import android.view.View
import androidx.core.content.ContextCompat
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

class ActionTileView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : View(context, attrs) {
    private val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val overlayPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val arcPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
    }
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textAlign = Paint.Align.CENTER
        isFakeBoldText = true
    }
    private val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textAlign = Paint.Align.CENTER
        isFakeBoldText = true
    }
    private val rect = RectF()

    private var actionType: BuddyActionType = BuddyActionType.GIFT
    private var cooldownState: ActionCooldownState? = null
    private var totalCooldownMs: Long = 0L

    fun bind(actionType: BuddyActionType, cooldownState: ActionCooldownState, totalCooldownMs: Long) {
        this.actionType = actionType
        this.cooldownState = cooldownState
        this.totalCooldownMs = totalCooldownMs
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val visual = BuddyActionVisuals.forAction(actionType)
        val cooldownState = cooldownState
        val ready = cooldownState?.eligible != false
        val w = width.toFloat()
        val h = height.toFloat()
        rect.set(0f, 0f, w, h)

        bgPaint.color = ContextCompat.getColor(context, if (ready) R.color.surfaceGlass else R.color.surfaceOverlay)
        bgPaint.alpha = if (ready) readyAlpha() else coolingAlpha(cooldownState?.remainingMs ?: 0L)
        canvas.drawRoundRect(rect, dp(14f), dp(14f), bgPaint)

        val drawable = ContextCompat.getDrawable(context, visual.drawableRes) ?: return
        val iconSize = min(w, h) * 0.46f
        val iconRect = Rect(
            ((w - iconSize) / 2f).toInt(),
            ((h - iconSize) / 2f - dp(6f)).toInt(),
            ((w + iconSize) / 2f).toInt(),
            ((h + iconSize) / 2f - dp(6f)).toInt(),
        )
        drawable.bounds = iconRect
        drawable.setTint(ContextCompat.getColor(context, if (ready) visual.tintRes else R.color.iconMuted))
        drawable.alpha = if (ready) 255 else 150
        drawable.draw(canvas)

        labelPaint.textSize = dp(9.5f)
        labelPaint.alpha = if (ready) 230 else 170
        canvas.drawText(visual.shortLabel, w / 2f, h - dp(20f), labelPaint)

        if (!ready && cooldownState != null) {
            overlayPaint.color = 0x66000000
            canvas.drawRoundRect(rect, dp(14f), dp(14f), overlayPaint)

            arcPaint.color = ContextCompat.getColor(context, if (cooldownState.remainingMs <= BuddyGameplayDefaults.readySoonMinutes * 60_000L) R.color.accentWarm else R.color.panelStroke)
            arcPaint.strokeWidth = dp(3f)
            val inset = dp(4f)
            rect.set(inset, inset, w - inset, h - inset)
            val sweep = if (totalCooldownMs > 0L) 360f * (1f - cooldownState.remainingMs.toFloat() / totalCooldownMs.toFloat()) else 360f
            canvas.drawArc(rect, -90f, sweep, false, arcPaint)
        }

        if (cooldownState != null && cooldownState.remainingMs > 0L) {
            textPaint.textSize = dp(11f)
            textPaint.color = Color.WHITE
            canvas.drawText(cooldownState.remainingMinutes.toString(), w / 2f, h - dp(10f), textPaint)
        }
    }

    private fun readyAlpha(): Int = 210

    private fun coolingAlpha(remainingMs: Long): Int {
        if (remainingMs > BuddyGameplayDefaults.readySoonMinutes * 60_000L) return 190
        val pulse = ((sin(System.currentTimeMillis() / 430.0) + 1.0) / 2.0).toFloat()
        return (180 + pulse * 35).roundToInt().coerceIn(180, 220)
    }

    private fun dp(value: Float): Float = value * resources.displayMetrics.density
}
