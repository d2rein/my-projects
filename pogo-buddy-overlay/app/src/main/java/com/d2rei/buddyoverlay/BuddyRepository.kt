package com.d2rei.buddyoverlay

import android.content.Context

class BuddyRepository private constructor(
    private val dao: BuddyDao,
    private val prefs: android.content.SharedPreferences,
) {
    suspend fun loadSettings(): BuddySettings {
        val existing = dao.getSettings()
        if (existing != null) return withExtraSettings(existing.toModel())
        val defaults = BuddySettings()
        dao.saveSettings(BuddySettingsEntity.fromModel(defaults))
        return withExtraSettings(defaults)
    }

    suspend fun saveSettings(settings: BuddySettings) {
        dao.saveSettings(BuddySettingsEntity.fromModel(settings))
        prefs.edit()
            .putInt(KEY_EXCITED_DECAY_INTERVAL_MINUTES, settings.excitedDecayIntervalMinutes)
            .putInt(KEY_SUBSEQUENT_DECAY_INTERVAL_MINUTES, settings.subsequentDecayIntervalMinutes)
            .apply()
    }

    suspend fun loadEvents(): List<BuddyEvent> = dao.getAllEvents().map { it.toModel() }

    suspend fun recordAction(
        actionType: BuddyActionType,
        occurredAtMs: Long,
        manualEpDelta: Int = 0,
    ) {
        dao.insertEvent(
            BuddyEventEntity(
                actionKey = actionType.storageKey,
                occurredAtMs = occurredAtMs,
                manualEpDelta = manualEpDelta,
            ),
        )
    }

    suspend fun undoLatest() {
        dao.getLatestEvent()?.let { dao.deleteEvent(it.id) }
    }

    suspend fun currentState(nowMs: Long): BuddyUiState {
        val settings = loadSettings()
        val events = loadEvents()
        return BuddyStateReducer.reduce(events, settings, nowMs)
    }

    suspend fun currentEventsWithSettings(nowMs: Long): Triple<BuddyUiState, BuddySettings, List<BuddyEvent>> {
        val settings = loadSettings()
        val events = loadEvents()
        val state = BuddyStateReducer.reduce(events, settings, nowMs)
        return Triple(state, settings, events)
    }

    private fun withExtraSettings(base: BuddySettings): BuddySettings = base.copy(
        excitedDecayIntervalMinutes = prefs.getInt(
            KEY_EXCITED_DECAY_INTERVAL_MINUTES,
            base.excitedDecayIntervalMinutes,
        ),
        subsequentDecayIntervalMinutes = prefs.getInt(
            KEY_SUBSEQUENT_DECAY_INTERVAL_MINUTES,
            base.subsequentDecayIntervalMinutes,
        ),
    )

    companion object {
        @Volatile
        private var instance: BuddyRepository? = null

        private const val PREFS_NAME = "buddy_overlay_settings_extras"
        private const val KEY_EXCITED_DECAY_INTERVAL_MINUTES = "excited_decay_interval_minutes"
        private const val KEY_SUBSEQUENT_DECAY_INTERVAL_MINUTES = "subsequent_decay_interval_minutes"

        fun get(context: Context): BuddyRepository =
            instance ?: synchronized(this) {
                instance ?: BuddyRepository(
                    BuddyDatabase.get(context).buddyDao(),
                    context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE),
                ).also { instance = it }
            }
    }
}
