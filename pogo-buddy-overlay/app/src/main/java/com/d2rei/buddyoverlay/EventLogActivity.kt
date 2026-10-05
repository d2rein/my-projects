package com.d2rei.buddyoverlay

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.d2rei.buddyoverlay.databinding.ActivityEventLogBinding
import kotlinx.coroutines.launch

class EventLogActivity : AppCompatActivity() {
    private lateinit var binding: ActivityEventLogBinding
    private lateinit var repository: BuddyRepository
    private val adapter = EventLogAdapter()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityEventLogBinding.inflate(layoutInflater)
        setContentView(binding.root)
        repository = BuddyRepository.get(this)
        binding.logRecycler.layoutManager = LinearLayoutManager(this)
        binding.logRecycler.adapter = adapter
    }

    override fun onResume() {
        super.onResume()
        lifecycleScope.launch {
            val (state, _, _) = repository.currentEventsWithSettings(System.currentTimeMillis())
            binding.logSummary.text = "Resolved events in current session: ${state.events.size}"
            adapter.submit(state.events.reversed())
        }
    }
}
