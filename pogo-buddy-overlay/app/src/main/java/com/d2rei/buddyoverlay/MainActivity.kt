package com.d2rei.buddyoverlay

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.d2rei.buddyoverlay.databinding.ActivityMainBinding
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private lateinit var repository: BuddyRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        repository = BuddyRepository.get(this)

        binding.overlayPermissionButton.setOnClickListener {
            startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION))
        }
        binding.startOverlayButton.setOnClickListener {
            ContextCompat.startForegroundService(
                this,
                Intent(this, BuddyOverlayService::class.java).setAction(BuddyOverlayService.ACTION_START),
            )
        }
        binding.stopOverlayButton.setOnClickListener {
            stopService(Intent(this, BuddyOverlayService::class.java).setAction(BuddyOverlayService.ACTION_STOP))
        }
        binding.resetBubbleButton.setOnClickListener {
            BuddyOverlayService.resetSavedPosition(this)
            stopService(Intent(this, BuddyOverlayService::class.java).setAction(BuddyOverlayService.ACTION_STOP))
            ContextCompat.startForegroundService(
                this,
                Intent(this, BuddyOverlayService::class.java).setAction(BuddyOverlayService.ACTION_START),
            )
        }
        binding.settingsButton.setOnClickListener { startActivity(Intent(this, SettingsActivity::class.java)) }
        binding.debugButton.setOnClickListener { startActivity(Intent(this, DebugPreviewActivity::class.java)) }
        binding.logButton.setOnClickListener { startActivity(Intent(this, EventLogActivity::class.java)) }
        binding.manualPlusButton.setOnClickListener {
            lifecycleScope.launch { repository.recordAction(BuddyActionType.MANUAL_ADJUST, System.currentTimeMillis(), 1) }
        }
        binding.manualMinusButton.setOnClickListener {
            lifecycleScope.launch { repository.recordAction(BuddyActionType.MANUAL_ADJUST, System.currentTimeMillis(), -1) }
        }
    }

    override fun onResume() {
        super.onResume()
        renderStatus()
    }

    private fun renderStatus() {
        lifecycleScope.launch {
            val state = repository.currentState(System.currentTimeMillis())
            val settings = repository.loadSettings()
            binding.statusText.text = buildString {
                appendLine("Overlay permission: ${if (Settings.canDrawOverlays(this@MainActivity)) "granted" else "missing"}")
                appendLine("EP: ${state.ep}/${state.excitedThresholdEp}")
                appendLine("Decay in: ${state.decayRemainingMs / 60_000}m ${(state.decayRemainingMs % 60_000) / 1000}s")
                appendLine("Events in current session: ${state.events.size}")
                appendLine("Bubble size ${settings.bubbleSizeDp}dp, opacity ${(settings.bubbleOpacity * 100).toInt()}%")
                append("If the bubble disappears, tap Reset bubble position.")
            }
        }
    }
}
