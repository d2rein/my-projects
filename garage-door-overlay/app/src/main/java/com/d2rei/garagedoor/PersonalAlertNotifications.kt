package com.d2rei.garagedoor

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import org.json.JSONObject
import java.time.Instant

object PersonalAlertNotifications {
    private val channels = mapOf(
        "garage" to Triple("alerts_garage_v1", "Garage alerts", NotificationManager.IMPORTANCE_HIGH),
        "nrl" to Triple("alerts_nrl_v1", "NRL tip alerts", NotificationManager.IMPORTANCE_HIGH),
        "nrlw" to Triple("alerts_nrlw_v1", "NRLW tip alerts", NotificationManager.IMPORTANCE_HIGH),
        "pogo" to Triple("alerts_pogo_v1", "Pokémon availability", NotificationManager.IMPORTANCE_DEFAULT),
        "system" to Triple("alerts_system_v1", "Alert system", NotificationManager.IMPORTANCE_LOW),
    )

    fun apply(context: Context, data: Map<String, String>) {
        val alertId = data["alertId"].orEmpty()
        if (alertId.isBlank()) return
        val manager = context.getSystemService(NotificationManager::class.java)
        val notificationId = stableId(alertId)
        applyGarageState(context, data)
        if (data["action"] == "resolve") {
            manager.cancel(notificationId)
            forget(context, alertId)
            return
        }
        val category = data["category"].orEmpty().ifBlank { "system" }
        if (!AlertRegistration.subscriptions(context).getOrDefault(category, true)) return
        val channel = channels[category] ?: channels.getValue("system")
        manager.createNotificationChannel(NotificationChannel(channel.first, channel.second, channel.third).apply {
            description = "Messages delivered by Drein Alerts"
            enableVibration(channel.third >= NotificationManager.IMPORTANCE_DEFAULT)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        })
        val target = data["url"].orEmpty().takeIf { it.startsWith("https://") || it.startsWith("http://") }
        val contentIntent = PendingIntent.getActivity(
            context,
            notificationId,
            (target?.let { Intent(Intent.ACTION_VIEW, Uri.parse(it)) } ?: Intent(context, MainActivity::class.java))
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val dismissIntent = PendingIntent.getBroadcast(
            context,
            notificationId,
            Intent(context, AlertDismissReceiver::class.java)
                .putExtra(AlertDismissReceiver.EXTRA_ALERT_ID, alertId)
                .putExtra(AlertDismissReceiver.EXTRA_NOTIFICATION_ID, notificationId),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val sticky = data["sticky"].equals("true", ignoreCase = true)
        manager.notify(
            notificationId,
            Notification.Builder(context, channel.first)
                .setSmallIcon(R.drawable.ic_garage)
                .setContentTitle(data["title"].orEmpty().ifBlank { "Drein Alerts" })
                .setContentText(data["body"].orEmpty())
                .setStyle(Notification.BigTextStyle().bigText(data["body"].orEmpty()))
                .setContentIntent(contentIntent)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setCategory(if (category == "garage") Notification.CATEGORY_ALARM else Notification.CATEGORY_REMINDER)
                .setOngoing(sticky)
                .setAutoCancel(!sticky)
                .setOnlyAlertOnce(false)
                .addAction(Notification.Action.Builder(null, "Dismiss", dismissIntent).build())
                .build(),
        )
        remember(context, alertId, category)
    }

    fun cancelCategory(context: Context, category: String) {
        val manager = context.getSystemService(NotificationManager::class.java)
        val active = active(context)
        val keys = active.keys().asSequence().toList()
        keys.filter { active.optString(it) == category }.forEach {
            manager.cancel(stableId(it))
            active.remove(it)
        }
        saveActive(context, active)
    }

    private fun applyGarageState(context: Context, data: Map<String, String>) {
        if (data["category"] != "garage") return
        val detail = runCatching { JSONObject(data["data"].orEmpty()) }.getOrNull() ?: return
        val state = detail.optString("state").uppercase()
        if (state !in setOf("OPEN", "CLOSED")) return
        val occurredAt = detail.optString("occurredAt")
        val occurredAtMs = runCatching { Instant.parse(occurredAt).toEpochMilli() }.getOrDefault(System.currentTimeMillis())
        val prefs = context.getSharedPreferences(GarageMonitorService.PREFS, Context.MODE_PRIVATE)
        if (occurredAtMs < prefs.getLong(GarageMonitorService.KEY_LAST_REMOTE_AT, 0L)) return
        prefs.edit()
            .putString(GarageMonitorService.KEY_LAST_REMOTE_STATE, state)
            .putLong(GarageMonitorService.KEY_LAST_REMOTE_AT, occurredAtMs)
            .apply()
        runCatching {
            context.startForegroundService(
                Intent(context, GarageMonitorService::class.java)
                    .setAction(GarageMonitorService.ACTION_APPLY_REMOTE_STATE)
                    .putExtra(GarageMonitorService.EXTRA_REMOTE_STATE, state)
                    .putExtra(GarageMonitorService.EXTRA_REMOTE_CONFIDENCE, detail.optDouble("confidence", 0.0).toFloat())
                    .putExtra(GarageMonitorService.EXTRA_REMOTE_OCCURRED_AT, occurredAt),
            )
        }
    }

    private fun stableId(value: String): Int {
        var hash = 0
        value.forEach { hash = hash * 31 + it.code }
        return if (hash == Int.MIN_VALUE) 1 else kotlin.math.abs(hash).coerceAtLeast(1)
    }

    private fun remember(context: Context, alertId: String, category: String) {
        saveActive(context, active(context).put(alertId, category))
    }

    private fun forget(context: Context, alertId: String) {
        saveActive(context, active(context).apply { remove(alertId) })
    }

    private fun active(context: Context): JSONObject {
        val raw = context.getSharedPreferences(GarageMonitorService.PREFS, Context.MODE_PRIVATE)
            .getString(KEY_ACTIVE_ALERTS, "{}").orEmpty()
        return runCatching { JSONObject(raw) }.getOrDefault(JSONObject())
    }

    private fun saveActive(context: Context, active: JSONObject) {
        context.getSharedPreferences(GarageMonitorService.PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY_ACTIVE_ALERTS, active.toString()).apply()
    }

    private const val KEY_ACTIVE_ALERTS = "personal_alerts_active"
}
