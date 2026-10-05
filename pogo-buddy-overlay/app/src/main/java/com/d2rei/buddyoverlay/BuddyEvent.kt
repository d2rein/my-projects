package com.d2rei.buddyoverlay

data class BuddyEvent(
    val id: Long,
    val actionType: BuddyActionType,
    val occurredAtMs: Long,
    val manualEpDelta: Int = 0,
)

data class ResolvedEvent(
    val event: BuddyEvent,
    val grantedEp: Int,
    val decayReset: Boolean,
)

data class ActionCooldownState(
    val actionType: BuddyActionType,
    val remainingMs: Long,
    val eligible: Boolean,
    val lastTappedAtMs: Long?,
    val lastGrantedAtMs: Long?,
) {
    val remainingMinutes: Int
        get() = kotlin.math.ceil(remainingMs / 60_000.0).toInt().coerceAtLeast(0)
}

data class BuddyUiState(
    val ep: Int,
    val excitedThresholdEp: Int,
    val excited: Boolean,
    val lastDecayResetAtMs: Long?,
    val decayRemainingMs: Long,
    val decayIntervalMs: Long,
    val battleBreakdown: Map<BuddyActionType, Long>,
    val cooldowns: Map<BuddyActionType, ActionCooldownState>,
    val shortestBattleCooldownMs: Long,
    val careCooldownMs: Long,
    val events: List<ResolvedEvent>,
) {
    val epToThreshold: Int
        get() = (excitedThresholdEp - ep).coerceAtLeast(0)
}
