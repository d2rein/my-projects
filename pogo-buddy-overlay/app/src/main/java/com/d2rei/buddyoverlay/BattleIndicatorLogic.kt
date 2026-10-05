package com.d2rei.buddyoverlay

object BattleIndicatorLogic {
    fun shortestCooldown(
        battleBreakdown: Map<BuddyActionType, Long>,
        includedActions: Set<BuddyActionType>,
    ): Long? = BuddyActionType.battleActions
        .filter(includedActions::contains)
        .map { battleBreakdown[it] ?: 0L }
        .minOrNull()
}
