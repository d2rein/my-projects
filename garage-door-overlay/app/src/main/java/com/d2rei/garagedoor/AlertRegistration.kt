package com.d2rei.garagedoor

import android.content.Context
import android.os.Build
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

object AlertRegistration {
    const val KEY_DEVICE_ID = "alert_device_id"
    const val KEY_DEVICE_SECRET = "alert_device_secret"
    const val KEY_STATUS = "alert_registration_status"
    const val KEY_SUBSCRIPTIONS = "alert_subscriptions"
    const val BROKER_URL = "https://personal-alerts.d2-rein.workers.dev"
    val categories = listOf("garage", "nrl", "nrlw", "pogo", "system")
    private val executor = Executors.newSingleThreadExecutor()

    fun claim(context: Context, token: String? = null, code: String? = null, finished: (() -> Unit)? = null) {
        val application = context.applicationContext
        saveStatus(application, "Pairing…")
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (!task.isSuccessful || task.result.isNullOrBlank()) {
                saveStatus(application, "Pairing failed: Firebase token unavailable")
                finished?.invoke()
                return@addOnCompleteListener
            }
            executor.execute {
                try {
                    val body = JSONObject()
                        .put("token", token.orEmpty())
                        .put("code", code.orEmpty())
                        .put("fcmToken", task.result)
                        .put("name", "${Build.MANUFACTURER} ${Build.MODEL}".trim())
                        .put("appVersion", appVersion(application))
                    val response = request("/api/devices/claim", "POST", body)
                    preferences(application).edit()
                        .putString(KEY_DEVICE_ID, response.getString("deviceId"))
                        .putString(KEY_DEVICE_SECRET, response.getString("deviceSecret"))
                        .putString(KEY_SUBSCRIPTIONS, response.optJSONObject("subscriptions")?.toString() ?: "{}")
                        .putString(KEY_STATUS, "Paired as ${response.optString("name", "phone")}")
                        .apply()
                } catch (error: Exception) {
                    saveStatus(application, "Pairing failed: ${safeMessage(error)}")
                } finally {
                    finished?.invoke()
                }
            }
        }
    }

    fun refreshToken(context: Context, fcmToken: String) {
        val application = context.applicationContext
        if (!isPaired(application)) return
        executor.execute {
            try {
                authorizedRequest(application, "/api/devices/token", "PUT", JSONObject()
                    .put("fcmToken", fcmToken)
                    .put("appVersion", appVersion(application)))
                saveStatus(application, "Connected")
            } catch (error: Exception) {
                saveStatus(application, "Token update pending: ${safeMessage(error)}")
            }
        }
    }

    fun updateSubscriptions(context: Context, subscriptions: Map<String, Boolean>, finished: (() -> Unit)? = null) {
        val application = context.applicationContext
        subscriptions.filterValues { !it }.keys.forEach { PersonalAlertNotifications.cancelCategory(application, it) }
        preferences(application).edit().putString(KEY_SUBSCRIPTIONS, JSONObject(subscriptions).toString()).apply()
        if (!isPaired(application)) {
            finished?.invoke()
            return
        }
        executor.execute {
            try {
                val response = authorizedRequest(application, "/api/devices/config", "PUT", JSONObject()
                    .put("subscriptions", JSONObject(subscriptions)))
                preferences(application).edit()
                    .putString(KEY_SUBSCRIPTIONS, response.optJSONObject("subscriptions")?.toString() ?: JSONObject(subscriptions).toString())
                    .putString(KEY_STATUS, "Connected")
                    .apply()
            } catch (error: Exception) {
                saveStatus(application, "Settings sync pending: ${safeMessage(error)}")
            } finally {
                finished?.invoke()
            }
        }
    }

    fun acknowledge(context: Context, alertId: String, action: String = "dismiss") {
        val application = context.applicationContext
        if (!isPaired(application)) return
        executor.execute {
            runCatching {
                authorizedRequest(application, "/api/devices/ack", "POST", JSONObject()
                    .put("alertId", alertId)
                    .put("action", action))
            }
        }
    }

    fun syncActive(context: Context) {
        val application = context.applicationContext
        if (!isPaired(application)) return
        executor.execute {
            try {
                val config = authorizedRequest(application, "/api/devices/config", "GET")
                val syncedSubscriptions = config.optJSONObject("subscriptions") ?: JSONObject()
                preferences(application).edit().putString(KEY_SUBSCRIPTIONS, syncedSubscriptions.toString()).apply()
                categories.filter { !syncedSubscriptions.optBoolean(it, false) }
                    .forEach { PersonalAlertNotifications.cancelCategory(application, it) }
                val response = authorizedRequest(application, "/api/devices/active", "GET")
                val alerts = response.optJSONArray("alerts") ?: return@execute
                for (index in 0 until alerts.length()) {
                    val alert = alerts.optJSONObject(index) ?: continue
                    val data = linkedMapOf(
                        "kind" to "personal-alert",
                        "action" to "upsert",
                        "alertId" to alert.optString("id"),
                        "revision" to alert.optString("revision"),
                        "category" to alert.optString("category", "system"),
                        "title" to alert.optString("title", "Drein Alerts"),
                        "body" to alert.optString("body"),
                        "url" to alert.optString("url"),
                        "sticky" to alert.optBoolean("sticky", false).toString(),
                        "expiresAt" to alert.optString("expiresAt"),
                        "data" to (alert.optJSONObject("data")?.toString() ?: "{}"),
                    )
                    PersonalAlertNotifications.apply(application, data)
                }
                saveStatus(application, "Connected")
            } catch (error: Exception) {
                saveStatus(application, "Alert sync pending: ${safeMessage(error)}")
            }
        }
    }

    fun subscriptions(context: Context): Map<String, Boolean> {
        val raw = preferences(context).getString(KEY_SUBSCRIPTIONS, "{}").orEmpty()
        val json = runCatching { JSONObject(raw) }.getOrDefault(JSONObject())
        return categories.associateWith { json.optBoolean(it, true) }
    }

    fun isPaired(context: Context): Boolean =
        !preferences(context).getString(KEY_DEVICE_ID, "").isNullOrBlank() &&
            !preferences(context).getString(KEY_DEVICE_SECRET, "").isNullOrBlank()

    private fun authorizedRequest(context: Context, path: String, method: String, body: JSONObject? = null): JSONObject {
        val prefs = preferences(context)
        return request(path, method, body, prefs.getString(KEY_DEVICE_ID, "").orEmpty(), prefs.getString(KEY_DEVICE_SECRET, "").orEmpty())
    }

    private fun request(path: String, method: String, body: JSONObject? = null, deviceId: String = "", secret: String = ""): JSONObject {
        val connection = URL("$BROKER_URL$path").openConnection() as HttpURLConnection
        try {
            connection.connectTimeout = 10_000
            connection.readTimeout = 10_000
            connection.requestMethod = method
            connection.doOutput = body != null
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Accept", "application/json")
            if (secret.isNotBlank()) connection.setRequestProperty("Authorization", "Bearer $secret")
            if (deviceId.isNotBlank()) connection.setRequestProperty("X-Device-ID", deviceId)
            if (body != null) connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val stream = if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            val response = runCatching { JSONObject(text) }.getOrDefault(JSONObject())
            if (connection.responseCode !in 200..299) throw IllegalStateException(response.optString("error", "HTTP ${connection.responseCode}"))
            return response
        } finally {
            connection.disconnect()
        }
    }

    private fun appVersion(context: Context): String =
        context.packageManager.getPackageInfo(context.packageName, 0).versionName.orEmpty()

    private fun preferences(context: Context) = context.getSharedPreferences(GarageMonitorService.PREFS, Context.MODE_PRIVATE)
    private fun saveStatus(context: Context, status: String) = preferences(context).edit().putString(KEY_STATUS, status).apply()
    private fun safeMessage(error: Exception) = (error.message ?: error.javaClass.simpleName).replace(Regex("https?://[^ ]+"), "broker")
}
