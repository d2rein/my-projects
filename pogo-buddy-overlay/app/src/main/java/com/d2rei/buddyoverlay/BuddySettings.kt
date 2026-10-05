package com.d2rei.buddyoverlay

data class BuddySettings(
    val excitedThresholdEp: Int = BuddyGameplayDefaults.excitedThresholdEp,
    val decayIntervalMinutes: Int = BuddyGameplayDefaults.decayIntervalMinutes,
    val excitedDecayIntervalMinutes: Int = BuddyGameplayDefaults.excitedDecayIntervalMinutes,
    val subsequentDecayIntervalMinutes: Int = BuddyGameplayDefaults.subsequentDecayIntervalMinutes,
    val decayAmountEp: Int = BuddyGameplayDefaults.decayAmountEp,
    val bubbleOpacity: Float = BuddyGameplayDefaults.bubbleOpacity,
    val bubbleSizeDp: Int = BuddyGameplayDefaults.bubbleSizeDp,
    val panelOpacity: Float = BuddyGameplayDefaults.panelOpacity,
    val vibrationEnabled: Boolean = BuddyGameplayDefaults.vibrationEnabled,
    val readyNotificationsEnabled: Boolean = BuddyGameplayDefaults.readyNotificationsEnabled,
    val actionEpMap: Map<BuddyActionType, Int> = BuddyGameplayDefaults.defaultEpByAction,
    val cooldownMinutesMap: Map<BuddyActionType, Int> = BuddyGameplayDefaults.defaultCooldownMinutesByAction,
) {
    fun epFor(action: BuddyActionType): Int = actionEpMap[action] ?: 0
    fun cooldownMsFor(action: BuddyActionType): Long =
        ((cooldownMinutesMap[action] ?: 0) * 60_000L)
}
