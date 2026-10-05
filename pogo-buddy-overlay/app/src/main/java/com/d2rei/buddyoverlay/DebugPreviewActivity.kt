package com.d2rei.buddyoverlay

import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.d2rei.buddyoverlay.databinding.ActivityDebugPreviewBinding
import kotlinx.coroutines.launch

class DebugPreviewActivity : AppCompatActivity() {
    private lateinit var binding: ActivityDebugPreviewBinding
    private lateinit var repository: BuddyRepository
    private var offsetMinutes: Int = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityDebugPreviewBinding.inflate(layoutInflater)
        setContentView(binding.root)
        repository = BuddyRepository.get(this)

        binding.offsetSeek.progress = 0
        binding.offsetSeek.setOnSeekBarChangeListener(SimpleSeekListener { progress ->
            offsetMinutes = progress
            render()
        })

        BuddyActionType.trackableActions.forEach { actionType ->
            binding.debugActionContainer.addView(
                Button(this).apply {
                    text = "Log ${actionType.displayName}"
                    setOnClickListener {
                        lifecycleScope.launch {
                            repository.recordAction(actionType, simulatedNow())
                            render()
                        }
                    }
                },
            )
        }

        binding.debugActionContainer.addView(
            Button(this).apply {
                text = "Manual +1 EP"
                setOnClickListener {
                    lifecycleScope.launch {
                        repository.recordAction(BuddyActionType.MANUAL_ADJUST, simulatedNow(), 1)
                        render()
                    }
                }
            },
        )
    }

    override fun onResume() {
        super.onResume()
        render()
    }

    private fun render() {
        lifecycleScope.launch {
            val settings = repository.loadSettings()
            val events = repository.loadEvents()
            val state = BuddyStateReducer.reduce(events, settings, simulatedNow())
            binding.offsetLabel.text = "Simulated offset: +$offsetMinutes minutes"
            binding.debugSummary.text = buildString {
                appendLine("Simulated EP: ${state.ep}/${state.excitedThresholdEp}")
                appendLine("Excited: ${state.excited}")
                appendLine("Decay remaining: ${state.decayRemainingMs / 60_000}m ${(state.decayRemainingMs % 60_000) / 1000}s")
                appendLine("Care ready in: ${state.careCooldownMs / 60_000}m")
                append("Shortest battle ready in: ${state.shortestBattleCooldownMs / 60_000}m")
            }
        }
    }

    private fun simulatedNow(): Long = System.currentTimeMillis() + offsetMinutes * 60_000L
}

private class SimpleSeekListener(
    private val onChange: (Int) -> Unit,
) : android.widget.SeekBar.OnSeekBarChangeListener {
    override fun onProgressChanged(seekBar: android.widget.SeekBar?, progress: Int, fromUser: Boolean) {
        onChange(progress)
    }

    override fun onStartTrackingTouch(seekBar: android.widget.SeekBar?) = Unit
    override fun onStopTrackingTouch(seekBar: android.widget.SeekBar?) = Unit
}
