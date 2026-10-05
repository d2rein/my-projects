package com.d2rei.buddyoverlay

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.d2rei.buddyoverlay.databinding.ItemEventLogBinding
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class EventLogAdapter : RecyclerView.Adapter<EventLogAdapter.EventViewHolder>() {
    private val formatter = SimpleDateFormat("dd MMM yyyy HH:mm:ss", Locale.getDefault())
    private var items: List<ResolvedEvent> = emptyList()

    fun submit(items: List<ResolvedEvent>) {
        this.items = items
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): EventViewHolder {
        val binding = ItemEventLogBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return EventViewHolder(binding, formatter)
    }

    override fun onBindViewHolder(holder: EventViewHolder, position: Int) {
        holder.bind(items[position])
    }

    override fun getItemCount(): Int = items.size

    class EventViewHolder(
        private val binding: ItemEventLogBinding,
        private val formatter: SimpleDateFormat,
    ) : RecyclerView.ViewHolder(binding.root) {
        fun bind(item: ResolvedEvent) {
            binding.eventTitle.text = buildString {
                append(item.event.actionType.displayName)
                if (item.grantedEp > 0) append("  +${item.grantedEp} EP")
                if (item.event.actionType == BuddyActionType.MANUAL_ADJUST) append("  ${item.event.manualEpDelta} EP")
            }
            binding.eventSubtitle.text = buildString {
                append(formatter.format(Date(item.event.occurredAtMs)))
                append(" · decay reset: ")
                append(if (item.decayReset) "yes" else "no")
                if (item.grantedEp == 0 && item.decayReset) append(" · cooldown hit")
            }
        }
    }
}
