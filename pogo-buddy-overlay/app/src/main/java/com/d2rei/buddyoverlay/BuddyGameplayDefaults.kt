package com.d2rei.buddyoverlay

/**
 * All gameplay-facing defaults live here so they can be tuned in one place.
 *
 * These defaults are intentionally conservative and user-editable because the
 * live Pokemon GO buddy excitement rules can change over time.
 */
object BuddyGameplayDefaults {
    const val excitedThresholdEp = 32
    const val decayIntervalMinutes = 25
    const val excitedDecayIntervalMinutes = 40
    const val subsequentDecayIntervalMinutes = 10
    const val decayAmountEp = 1

    const val bubbleOpacity = 0.58f
    const val bubbleSizeDp = 58
    const val panelOpacity = 1f

    const val vibrationEnabled = true
    const val readyNotificationsEnabled = false
    const val readySoonMinutes = 5

    const val homeRingVolumePercent = 25
    const val awayRingVolumePercent = 75

    val defaultEpByAction = mapOf(
        BuddyActionType.SWAP to 2,
        BuddyActionType.GIFT to 2,
        BuddyActionType.CARE to 6,
        BuddyActionType.ROUTE to 2,
        BuddyActionType.WALK_2KM to 4,
        BuddyActionType.BATTLE_ROCKET to 2,
        BuddyActionType.BATTLE_LEADER to 2,
        BuddyActionType.BATTLE_GYM_RAID to 2,
        BuddyActionType.BATTLE_PVP to 2,
    )

    val defaultCooldownMinutesByAction = mapOf(
        BuddyActionType.SWAP to 30,
        BuddyActionType.GIFT to 30,
        BuddyActionType.CARE to 30,
        BuddyActionType.ROUTE to 30,
        BuddyActionType.WALK_2KM to 30,
        BuddyActionType.BATTLE_ROCKET to 30,
        BuddyActionType.BATTLE_LEADER to 30,
        BuddyActionType.BATTLE_GYM_RAID to 30,
        BuddyActionType.BATTLE_PVP to 30,
    )
}
