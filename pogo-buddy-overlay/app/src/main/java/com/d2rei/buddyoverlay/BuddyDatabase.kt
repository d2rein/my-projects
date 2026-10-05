package com.d2rei.buddyoverlay

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [BuddyEventEntity::class, BuddySettingsEntity::class],
    version = 1,
    exportSchema = false,
)
abstract class BuddyDatabase : RoomDatabase() {
    abstract fun buddyDao(): BuddyDao

    companion object {
        @Volatile
        private var instance: BuddyDatabase? = null

        fun get(context: Context): BuddyDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    BuddyDatabase::class.java,
                    "buddy_overlay.db",
                ).build().also { instance = it }
            }
    }
}
