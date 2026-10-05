package com.d2rei.buddyoverlay

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class BattleIndicatorLogicTest {
    private val cooldowns = mapOf(
        BuddyActionType.BATTLE_ROCKET to 12_000L,
        BuddyActionType.BATTLE_LEADER to 40_000L,
        BuddyActionType.BATTLE_GYM_RAID to 8_000L,
        BuddyActionType.BATTLE_PVP to 20_000L,
    )

    @Test fun usesOnlyCheckedBattleTimers() {
        val selected = setOf(BuddyActionType.BATTLE_ROCKET, BuddyActionType.BATTLE_LEADER)
        assertEquals(12_000L, BattleIndicatorLogic.shortestCooldown(cooldowns, selected))
    }

    @Test fun oneCheckedTimerShowsThatTimer() {
        assertEquals(
            40_000L,
            BattleIndicatorLogic.shortestCooldown(cooldowns, setOf(BuddyActionType.BATTLE_LEADER)),
        )
    }

    @Test fun noCheckedTimersHidesIndicator() {
        assertNull(BattleIndicatorLogic.shortestCooldown(cooldowns, emptySet()))
    }
}
