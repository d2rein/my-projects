package com.d2rei.buddyoverlay

import android.content.Context

object RecentSnapTracker {
    const val WINDOW_MS = 60 * 60_000L
    private const val KEY_RECEIVED_TIMESTAMPS = "received_snap_timestamps"

    fun count(context: Context, nowMs: Long = System.currentTimeMillis()): Int =
        recent(parse(context.capturePreferences().getString(KEY_RECEIVED_TIMESTAMPS, null)), nowMs).size

    fun record(context: Context, nowMs: Long = System.currentTimeMillis()): Int {
        val timestamps = recent(
            parse(context.capturePreferences().getString(KEY_RECEIVED_TIMESTAMPS, null)),
            nowMs,
        ) + nowMs
        context.capturePreferences().edit()
            .putString(KEY_RECEIVED_TIMESTAMPS, timestamps.joinToString(","))
            .apply()
        return timestamps.size
    }

    internal fun recent(timestamps: List<Long>, nowMs: Long): List<Long> =
        timestamps.filter { it > nowMs - WINDOW_MS && it <= nowMs }

    internal fun label(count: Int): String = if (count > 0) count.toString() else "SNAP"

    private fun parse(value: String?): List<Long> =
        value.orEmpty().split(',').mapNotNull(String::toLongOrNull)

    private fun Context.capturePreferences() =
        getSharedPreferences(PostcardCaptureService.CAPTURE_PREFS, Context.MODE_PRIVATE)
}
