package com.d2rei.buddyoverlay

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "buddy_events")
data class BuddyEventEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0L,
    val actionKey: String,
    val occurredAtMs: Long,
    val manualEpDelta: Int = 0,
) {
    fun toModel(): BuddyEvent = BuddyEvent(
        id = id,
        actionType = BuddyActionType.fromStorageKey(actionKey),
        occurredAtMs = occurredAtMs,
        manualEpDelta = manualEpDelta,
    )

    companion object {
        fun fromModel(model: BuddyEvent): BuddyEventEntity = BuddyEventEntity(
            id = if (model.id < 0) 0L else model.id,
            actionKey = model.actionType.storageKey,
            occurredAtMs = model.occurredAtMs,
            manualEpDelta = model.manualEpDelta,
        )
    }
}
