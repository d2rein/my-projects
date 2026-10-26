package com.d2rei.garagedoor

import android.content.Context
import android.os.Build
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

object PushRegistration {
    const val KEY_PUSH_STATUS = "push_status"
    const val KEY_PUSH_REGISTERED_AT = "push_registered_at"
    private val executor = Executors.newSingleThreadExecutor()

    fun register(context: Context) {
        val application = context.applicationContext
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (!task.isSuccessful || task.result.isNullOrBlank()) {
                saveStatus(application, "Push registration unavailable")
                return@addOnCompleteListener
            }
            registerToken(application, task.result)
        }
    }

    fun registerToken(context: Context, token: String) {
        val application = context.applicationContext
        executor.execute {
            val prefs = application.getSharedPreferences(GarageMonitorService.PREFS, Context.MODE_PRIVATE)
            val base = prefs.getString(GarageMonitorService.KEY_SERVER_URL, GarageMonitorService.DEFAULT_SERVER_URL)
                ?.trim()?.trimEnd('/').orEmpty()
            val apiToken = prefs.getString(GarageMonitorService.KEY_API_TOKEN, "").orEmpty()
            if (base.isBlank() || apiToken.isBlank()) {
                saveStatus(application, "Save the PC address to enable push")
                return@execute
            }
            try {
                val connection = URL("$base/api/push/register").openConnection() as HttpURLConnection
                try {
                    connection.connectTimeout = 8_000
                    connection.readTimeout = 8_000
                    connection.requestMethod = "POST"
                    connection.doOutput = true
                    connection.setRequestProperty("Authorization", "Bearer $apiToken")
                    connection.setRequestProperty("Content-Type", "application/json")
                    connection.setRequestProperty("Accept", "application/json")
                    val body = JSONObject()
                        .put("token", token)
                        .put("device", "${Build.MANUFACTURER} ${Build.MODEL}".trim())
                        .put("appVersion", application.packageManager.getPackageInfo(application.packageName, 0).versionName)
                        .toString().toByteArray(Charsets.UTF_8)
                    connection.outputStream.use { it.write(body) }
                    val code = connection.responseCode
                    if (code !in 200..299) throw IllegalStateException("PC returned HTTP $code")
                    prefs.edit()
                        .putString(KEY_PUSH_STATUS, "Registered")
                        .putLong(KEY_PUSH_REGISTERED_AT, System.currentTimeMillis())
                        .apply()
                } finally {
                    connection.disconnect()
                }
            } catch (error: Exception) {
                saveStatus(application, "Registration failed: ${safeMessage(error)}")
            }
        }
    }

    private fun saveStatus(context: Context, status: String) {
        context.getSharedPreferences(GarageMonitorService.PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY_PUSH_STATUS, status).apply()
    }

    private fun safeMessage(error: Exception): String =
        (error.message ?: error.javaClass.simpleName).replace(Regex("https?://[^ ]+"), "PC")
}
