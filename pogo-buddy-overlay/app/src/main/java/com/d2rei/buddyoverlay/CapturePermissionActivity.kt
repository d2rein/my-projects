package com.d2rei.buddyoverlay

import android.app.Activity
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import androidx.core.content.ContextCompat

class CapturePermissionActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (PostcardCaptureService.isSessionActive(this)) {
            PostcardCaptureService.requestCapture(this)
            finish()
            return
        }
        val manager = getSystemService(MediaProjectionManager::class.java)
        startActivityForResult(manager.createScreenCaptureIntent(), REQUEST_CAPTURE)
    }

    @Deprecated("MediaProjection permission still returns through this callback")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQUEST_CAPTURE) return
        if (resultCode == RESULT_OK && data != null) {
            ContextCompat.startForegroundService(
                this,
                Intent(this, PostcardCaptureService::class.java)
                    .setAction(PostcardCaptureService.ACTION_START_SESSION)
                    .putExtra(PostcardCaptureService.EXTRA_RESULT_CODE, resultCode)
                    .putExtra(PostcardCaptureService.EXTRA_RESULT_DATA, data)
                    .putExtra(PostcardCaptureService.EXTRA_CAPTURE_IMMEDIATELY, true),
            )
        } else {
            PostcardCaptureService.broadcastResult(this, false, "Screen capture was cancelled")
        }
        finish()
    }

    companion object {
        private const val REQUEST_CAPTURE = 8201
    }
}
