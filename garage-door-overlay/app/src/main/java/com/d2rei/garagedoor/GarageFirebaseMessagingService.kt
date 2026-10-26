package com.d2rei.garagedoor

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import java.time.Instant
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class GarageFirebaseMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        PushRegistration.registerToken(this, token)
        AlertRegistration.refreshToken(this, token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        if (message.data["kind"] == "personal-alert") {
            PersonalAlertNotifications.apply(this, message.data)
            return
        }
        val state = message.data["state"]?.uppercase() ?: return
        if (state == "TEST") {
            showTestAlert()
            val prefs = getSharedPreferences(GarageMonitorService.PREFS, Context.MODE_PRIVATE)
            if (prefs.getBoolean(GarageMonitorService.KEY_ENABLED, false)) {
                try {
                    startForegroundService(Intent(this, GarageMonitorService::class.java))
                } catch (_: RuntimeException) {
                    // The visible test notification still proves that push delivery worked.
                }
            }
            PushRegistration.register(this)
            return
        }
        if (state !in setOf("OPEN", "CLOSED")) return

        val prefs = getSharedPreferences(GarageMonitorService.PREFS, Context.MODE_PRIVATE)
        val confidence = message.data["confidence"]?.toFloatOrNull() ?: 0f
        val occurredAt = message.data["occurredAt"].orEmpty()
        val enabledBeforePush = prefs.getBoolean(GarageMonitorService.KEY_ENABLED, false)
        val occurredAtMs = runCatching { Instant.parse(occurredAt).toEpochMilli() }.getOrDefault(System.currentTimeMillis())
        val previousRemoteAt = prefs.getLong(GarageMonitorService.KEY_LAST_REMOTE_AT, 0L)
        if (occurredAtMs < previousRemoteAt) return
        prefs.edit()
            .putBoolean(GarageMonitorService.KEY_ENABLED, enabledBeforePush || state == "OPEN")
            .putString(GarageMonitorService.KEY_LAST_STATE, state)
            .putFloat(GarageMonitorService.KEY_CONFIDENCE, confidence)
            .putString(GarageMonitorService.KEY_LAST_FRAME, occurredAt)
            .putString(GarageMonitorService.KEY_LAST_ERROR, "")
            .putLong(GarageMonitorService.KEY_LAST_POLL, System.currentTimeMillis())
            .putBoolean(GarageMonitorService.KEY_LAST_OPEN, state == "OPEN")
            .putString(GarageMonitorService.KEY_LAST_REMOTE_STATE, state)
            .putLong(GarageMonitorService.KEY_LAST_REMOTE_AT, occurredAtMs)
            .apply {
                if (state == "OPEN") {
                    putBoolean(GarageMonitorService.KEY_OVERLAY_DISMISSED, false)
                    putBoolean(GarageMonitorService.KEY_WAKE_SUPPRESSED, false)
                } else {
                    putBoolean(GarageMonitorService.KEY_WAKE_ALERT_ACTIVE, false)
                }
            }
            .apply()

        if (state == "OPEN" && !AlertRegistration.isPaired(this)) {
            showOpenAlert(occurredAt)
        } else {
            getSystemService(NotificationManager::class.java).cancel(ALERT_NOTIFICATION_ID)
        }
        GarageStatusWidgetProvider.updateAll(this)

        if (state == "OPEN" || enabledBeforePush) {
            try {
                startForegroundService(
                    Intent(this, GarageMonitorService::class.java)
                        .setAction(GarageMonitorService.ACTION_APPLY_REMOTE_STATE)
                        .putExtra(GarageMonitorService.EXTRA_REMOTE_STATE, state)
                        .putExtra(GarageMonitorService.EXTRA_REMOTE_CONFIDENCE, confidence)
                        .putExtra(GarageMonitorService.EXTRA_REMOTE_OCCURRED_AT, occurredAt),
                )
            } catch (error: RuntimeException) {
                prefs.edit().putString(
                    PushRegistration.KEY_PUSH_STATUS,
                    "Push received; Android blocked monitor restart: ${error.javaClass.simpleName}",
                ).apply()
            }
        }
        PushRegistration.register(this)
    }

    private fun showOpenAlert(occurredAt: String) {
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(ALERT_CHANNEL_ID, "Garage door alerts", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Urgent alerts sent by the garage-door monitor PC"
                enableVibration(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            },
        )
        val openApp = PendingIntent.getActivity(
            this,
            10,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val time = occurredAt.substringAfter('T', occurredAt).take(8)
        val detail = if (time.isBlank()) "The PC reports that the garage door is open" else "Open since $time"
        manager.notify(
            ALERT_NOTIFICATION_ID,
            Notification.Builder(this, ALERT_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_garage)
                .setContentTitle("GARAGE DOOR OPEN")
                .setContentText(detail)
                .setContentIntent(openApp)
                .setCategory(Notification.CATEGORY_ALARM)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setOnlyAlertOnce(false)
                .build(),
        )
    }

    private fun showTestAlert() {
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(ALERT_CHANNEL_ID, "Garage door alerts", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Urgent alerts sent by the garage-door monitor PC"
                enableVibration(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            },
        )
        manager.notify(
            TEST_NOTIFICATION_ID,
            Notification.Builder(this, ALERT_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_garage)
                .setContentTitle("Garage push test received")
                .setContentText("Push notifications from the monitor PC are working")
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_STATUS)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .build(),
        )
    }

    companion object {
        private const val ALERT_CHANNEL_ID = "garage_door_alerts_v1"
        private const val ALERT_NOTIFICATION_ID = 4102
        private const val TEST_NOTIFICATION_ID = 4103
    }
}
