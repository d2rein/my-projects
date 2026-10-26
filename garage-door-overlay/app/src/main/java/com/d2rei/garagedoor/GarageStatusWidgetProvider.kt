package com.d2rei.garagedoor

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

class GarageStatusWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, widgetIds: IntArray) {
        widgetIds.forEach { update(context, manager, it) }
    }

    companion object {
        fun updateAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val component = ComponentName(context, GarageStatusWidgetProvider::class.java)
            manager.getAppWidgetIds(component).forEach { update(context, manager, it) }
        }

        private fun update(context: Context, manager: AppWidgetManager, widgetId: Int) {
            val prefs = context.getSharedPreferences(GarageMonitorService.PREFS, Context.MODE_PRIVATE)
            val enabled = prefs.getBoolean(GarageMonitorService.KEY_ENABLED, false)
            val state = prefs.getString(GarageMonitorService.KEY_LAST_STATE, "UNKNOWN").orEmpty().uppercase()
            val (label, background) = when {
                !enabled || state == "UNREACHABLE" -> "OFFLINE" to R.drawable.bg_status_offline
                state == "OPEN" -> "OPEN" to R.drawable.bg_status_open
                state == "CLOSED" -> "CLOSED" to R.drawable.bg_status_closed
                else -> "CHECK" to R.drawable.bg_status_check
            }
            val openApp = PendingIntent.getActivity(
                context,
                31,
                Intent(context, MainActivity::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            val views = RemoteViews(context.packageName, R.layout.widget_garage_status).apply {
                setTextViewText(R.id.garage_status_text, label)
                setInt(R.id.garage_status_text, "setBackgroundResource", background)
                setOnClickPendingIntent(R.id.garage_status_text, openApp)
            }
            manager.updateAppWidget(widgetId, views)
        }
    }
}
