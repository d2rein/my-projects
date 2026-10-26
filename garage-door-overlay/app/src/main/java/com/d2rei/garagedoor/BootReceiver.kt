package com.d2rei.garagedoor

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        AlertRegistration.syncActive(context)
        val enabled = context.getSharedPreferences(GarageMonitorService.PREFS, Context.MODE_PRIVATE)
            .getBoolean(GarageMonitorService.KEY_ENABLED, false)
        if (enabled) {
            try {
                context.startForegroundService(Intent(context, GarageMonitorService::class.java))
            } catch (_: RuntimeException) {
                // Android can defer background starts; opening the app or its notification restarts monitoring.
            }
        }
    }
}

