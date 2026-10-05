package com.d2rei.buddyoverlay

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update

@Dao
interface BuddyDao {
    @Query("SELECT * FROM buddy_events ORDER BY occurredAtMs ASC, id ASC")
    suspend fun getAllEvents(): List<BuddyEventEntity>

    @Insert
    suspend fun insertEvent(event: BuddyEventEntity): Long

    @Query("DELETE FROM buddy_events WHERE id = :eventId")
    suspend fun deleteEvent(eventId: Long)

    @Query("SELECT * FROM buddy_events ORDER BY occurredAtMs DESC, id DESC LIMIT 1")
    suspend fun getLatestEvent(): BuddyEventEntity?

    @Query("SELECT * FROM buddy_settings WHERE id = 1")
    suspend fun getSettings(): BuddySettingsEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveSettings(settings: BuddySettingsEntity)
}
