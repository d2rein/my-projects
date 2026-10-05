package com.d2rei.buddyoverlay

import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.Image
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class PostcardCaptureService : Service() {
    private var projection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var imageReader: ImageReader? = null
    private lateinit var imageThread: HandlerThread
    private lateinit var imageHandler: Handler
    private val uploadExecutor = Executors.newSingleThreadExecutor()
    private val captureRequested = AtomicBoolean(false)

    override fun onCreate() {
        super.onCreate()
        preferences().edit().putBoolean(KEY_SESSION_ACTIVE, false).apply()
        imageThread = HandlerThread("postcard-screen-capture").apply { start() }
        imageHandler = Handler(imageThread.looper)
        createNotificationChannel()
        uploadExecutor.execute { drainUploadQueue() }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START_SESSION -> startSession(intent)
            ACTION_CAPTURE -> requestNextFrame()
            ACTION_STOP -> stopSelf()
        }
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        captureRequested.set(false)
        imageReader?.setOnImageAvailableListener(null, null)
        virtualDisplay?.release()
        imageReader?.close()
        projection?.stop()
        imageThread.quitSafely()
        uploadExecutor.shutdownNow()
        preferences().edit().putBoolean(KEY_SESSION_ACTIVE, false).apply()
        super.onDestroy()
    }

    private fun startSession(intent: Intent) {
        val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, Activity.RESULT_CANCELED)
        @Suppress("DEPRECATION")
        val resultData = intent.getParcelableExtra<Intent>(EXTRA_RESULT_DATA)
        if (resultCode != Activity.RESULT_OK || resultData == null) {
            broadcastResult(this, false, "Screen capture permission was not granted")
            stopSelf()
            return
        }
        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            buildNotification(),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION,
        )
        try {
            projection = getSystemService(MediaProjectionManager::class.java)
                .getMediaProjection(resultCode, resultData)
                .also { mediaProjection ->
                    mediaProjection.registerCallback(object : MediaProjection.Callback() {
                        override fun onStop() {
                            stopSelf()
                        }
                    }, imageHandler)
                }
            createVirtualDisplay()
            preferences().edit().putBoolean(KEY_SESSION_ACTIVE, true).apply()
            if (intent.getBooleanExtra(EXTRA_CAPTURE_IMMEDIATELY, false)) requestNextFrame()
        } catch (error: RuntimeException) {
            broadcastResult(this, false, error.message ?: "Could not start screen capture")
            stopSelf()
        }
    }

    private fun createVirtualDisplay() {
        val metrics = resources.displayMetrics
        val width = metrics.widthPixels
        val height = metrics.heightPixels
        val reader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 3)
        reader.setOnImageAvailableListener({ source ->
            val image = source.acquireLatestImage() ?: return@setOnImageAvailableListener
            if (!captureRequested.compareAndSet(true, false)) {
                image.close()
                return@setOnImageAvailableListener
            }
            try {
                val jpeg = try {
                    imageToJpeg(image, width, height)
                } finally {
                    image.close()
                }
                broadcastCaptured(this)
                uploadExecutor.execute { enqueueUpload(jpeg) }
            } catch (error: Exception) {
                broadcastResult(this, false, error.message ?: "Could not capture postcard")
            }
        }, imageHandler)
        imageReader = reader
        virtualDisplay = projection?.createVirtualDisplay(
            "Pokemon postcard capture",
            width,
            height,
            metrics.densityDpi,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            reader.surface,
            null,
            imageHandler,
        )
    }

    private fun requestNextFrame() {
        if (projection == null || imageReader == null) {
            broadcastResult(this, false, "Capture session is not active")
            return
        }
        imageHandler.postDelayed({ captureRequested.set(true) }, 300L)
    }

    private fun imageToJpeg(image: Image, targetWidth: Int, targetHeight: Int): ByteArray {
        val plane = image.planes[0]
        val pixelStride = plane.pixelStride
        val rowStride = plane.rowStride
        val rowPadding = rowStride - pixelStride * targetWidth
        val paddedWidth = targetWidth + rowPadding / pixelStride
        val padded = Bitmap.createBitmap(paddedWidth, targetHeight, Bitmap.Config.ARGB_8888)
        padded.copyPixelsFromBuffer(plane.buffer)
        val cropped = Bitmap.createBitmap(padded, 0, 0, targetWidth, targetHeight)
        if (cropped !== padded) padded.recycle()
        return ByteArrayOutputStream().use { output ->
            cropped.compress(Bitmap.CompressFormat.JPEG, 92, output)
            cropped.recycle()
            output.toByteArray()
        }
    }

    private fun enqueueUpload(jpeg: ByteArray) {
        val directory = File(filesDir, UPLOAD_QUEUE_DIRECTORY).apply { mkdirs() }
        val queued = File(directory, "${System.currentTimeMillis()}-${System.nanoTime()}.jpg")
        val temporary = File(directory, "${queued.name}.tmp")
        temporary.writeBytes(jpeg)
        if (!temporary.renameTo(queued)) {
            temporary.copyTo(queued, overwrite = true)
            temporary.delete()
        }
        drainUploadQueue()
    }

    private fun drainUploadQueue() {
        val directory = File(filesDir, UPLOAD_QUEUE_DIRECTORY)
        directory.listFiles { file -> file.extension.equals("jpg", ignoreCase = true) }
            ?.sortedBy { it.name }
            ?.forEach { queued ->
                if (upload(queued.readBytes())) queued.delete() else return
            }
    }

    private fun upload(jpeg: ByteArray): Boolean {
        val prefs = preferences()
        val endpoint = prefs.getString(KEY_UPLOAD_URL, DEFAULT_UPLOAD_URL).orEmpty().trim()
        val token = DEFAULT_UPLOAD_PIN
        try {
            require(endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
                "Invalid postcard receiver URL"
            }
            val connection = URL(endpoint).openConnection() as HttpURLConnection
            try {
                connection.connectTimeout = 8_000
                connection.readTimeout = 45_000
                connection.requestMethod = "POST"
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "image/jpeg")
                connection.setRequestProperty("Content-Length", jpeg.size.toString())
                if (token.isNotBlank()) connection.setRequestProperty("Authorization", "Bearer $token")
                connection.setRequestProperty(
                    "X-Postcard-Source",
                    prefs.getString(KEY_SOURCE_ID, DEFAULT_SOURCE_ID).orEmpty().ifBlank { DEFAULT_SOURCE_ID },
                )
                connection.outputStream.use { it.write(jpeg) }
                val code = connection.responseCode
                val response = (if (code in 200..299) connection.inputStream else connection.errorStream)
                    ?.bufferedReader()?.use { it.readText() }.orEmpty()
                if (code !in 200..299) error("Receiver returned HTTP $code${if (response.isBlank()) "" else ": $response"}")
                broadcastResult(this, true, if (response.isBlank()) "Postcard sent" else response)
                return true
            } finally {
                connection.disconnect()
            }
        } catch (error: Exception) {
            broadcastResult(this, false, error.message ?: "Could not send postcard")
            return false
        }
    }

    private fun buildNotification() = NotificationCompat.Builder(this, CHANNEL_ID)
        .setSmallIcon(android.R.drawable.ic_menu_camera)
        .setContentTitle(getString(R.string.capture_notification_title))
        .setContentText(getString(R.string.capture_notification_text))
        .setOngoing(true)
        .setContentIntent(
            PendingIntent.getActivity(
                this,
                92,
                Intent(this, MainActivity::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            ),
        )
        .addAction(
            android.R.drawable.ic_menu_close_clear_cancel,
            "Stop",
            PendingIntent.getService(
                this,
                93,
                Intent(this, PostcardCaptureService::class.java).setAction(ACTION_STOP),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            ),
        )
        .build()

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Postcard capture", NotificationManager.IMPORTANCE_LOW),
        )
    }

    private fun preferences() = getSharedPreferences(CAPTURE_PREFS, Context.MODE_PRIVATE)

    companion object {
        const val ACTION_START_SESSION = "com.d2rei.buddyoverlay.capture.START"
        const val ACTION_CAPTURE = "com.d2rei.buddyoverlay.capture.SNAP"
        const val ACTION_STOP = "com.d2rei.buddyoverlay.capture.STOP"
        const val ACTION_CAPTURED = "com.d2rei.buddyoverlay.capture.CAPTURED"
        const val ACTION_RESULT = "com.d2rei.buddyoverlay.capture.RESULT"
        const val EXTRA_RESULT_CODE = "result_code"
        const val EXTRA_RESULT_DATA = "result_data"
        const val EXTRA_CAPTURE_IMMEDIATELY = "capture_immediately"
        const val EXTRA_SUCCESS = "success"
        const val EXTRA_MESSAGE = "message"
        const val CAPTURE_PREFS = "postcard_capture"
        const val KEY_UPLOAD_URL = "upload_url"
        const val KEY_UPLOAD_TOKEN = "upload_token"
        const val KEY_SOURCE_ID = "source_id"
        private const val KEY_SESSION_ACTIVE = "session_active"
        const val DEFAULT_UPLOAD_URL = "http://192.168.1.119:8766/upload"
        const val DEFAULT_UPLOAD_PIN = "3497"
        const val DEFAULT_SOURCE_ID = "1"
        private const val CHANNEL_ID = "postcard_capture"
        private const val NOTIFICATION_ID = 7201
        private const val UPLOAD_QUEUE_DIRECTORY = "postcard-upload-queue"

        fun isSessionActive(context: Context): Boolean =
            context.getSharedPreferences(CAPTURE_PREFS, Context.MODE_PRIVATE)
                .getBoolean(KEY_SESSION_ACTIVE, false)

        fun requestCapture(context: Context) {
            context.startService(Intent(context, PostcardCaptureService::class.java).setAction(ACTION_CAPTURE))
        }

        private fun broadcastCaptured(context: Context) {
            context.sendBroadcast(Intent(ACTION_CAPTURED).setPackage(context.packageName))
        }

        fun broadcastResult(context: Context, success: Boolean, message: String) {
            context.sendBroadcast(
                Intent(ACTION_RESULT)
                    .setPackage(context.packageName)
                    .putExtra(EXTRA_SUCCESS, success)
                    .putExtra(EXTRA_MESSAGE, message),
            )
        }
    }
}
