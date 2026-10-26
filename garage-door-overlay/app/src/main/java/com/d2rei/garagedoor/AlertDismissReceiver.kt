package com.d2rei.garagedoor

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class AlertDismissReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val alertId = intent.getStringExtra(EXTRA_ALERT_ID).orEmpty()
        val notificationId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, 0)
        if (notificationId != 0) context.getSystemService(NotificationManager::class.java).cancel(notificationId)
        if (alertId.isNotBlank()) AlertRegistration.acknowledge(context, alertId)
    }

    companion object {
        const val EXTRA_ALERT_ID = "alert_id"
        const val EXTRA_NOTIFICATION_ID = "notification_id"
    }
}
