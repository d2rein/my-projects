package com.d2rei.buddyoverlay

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BuddyStateReducerTest {
    private val settings = BuddySettings()

    @Test
    fun grantsEpWhenEligible() {
        val now = 1_000_000L
        val state = BuddyStateReducer.reduce(
            listOf(
                BuddyEvent(1, BuddyActionType.GIFT, now),
            ),
            settings,
            now,
        )

        assertEquals(2, state.ep)
        assertTrue(state.cooldowns.getValue(BuddyActionType.GIFT).remainingMs > 0)
    }

    @Test
    fun cooldownTapResetsDecayWithoutGrantingEp() {
        val t0 = 0L
        val t1 = 10 * 60_000L
        val t2 = 20 * 60_000L
        val state = BuddyStateReducer.reduce(
            listOf(
                BuddyEvent(1, BuddyActionType.GIFT, t0),
                BuddyEvent(2, BuddyActionType.GIFT, t1),
            ),
            settings,
            t2,
        )

        assertEquals(2, state.ep)
        assertTrue(state.decayRemainingMs > 0)
        assertEquals(t1, state.lastDecayResetAtMs)
    }

    @Test
    fun decayUsesAbsoluteTimestamps() {
        val t0 = 0L
        val now = 60 * 60_000L
        val state = BuddyStateReducer.reduce(
            listOf(BuddyEvent(1, BuddyActionType.CARE, t0)),
            settings,
            now,
        )

        assertEquals(2, state.ep)
    }

    @Test
    fun battleCooldownsStaySeparate() {
        val t0 = 0L
        val now = 5 * 60_000L
        val state = BuddyStateReducer.reduce(
            listOf(
                BuddyEvent(1, BuddyActionType.BATTLE_ROCKET, t0),
                BuddyEvent(2, BuddyActionType.BATTLE_PVP, now),
            ),
            settings,
            now,
        )

        assertTrue(state.cooldowns.getValue(BuddyActionType.BATTLE_ROCKET).remainingMs > 0)
        assertTrue(state.cooldowns.getValue(BuddyActionType.BATTLE_PVP).remainingMs > 0)
        assertFalse(state.cooldowns.getValue(BuddyActionType.BATTLE_LEADER).remainingMs > 0)
    }

    @Test
    fun resetSessionDropsEarlierEvents() {
        val state = BuddyStateReducer.reduce(
            listOf(
                BuddyEvent(1, BuddyActionType.GIFT, 0L),
                BuddyEvent(2, BuddyActionType.RESET_SESSION, 10L),
                BuddyEvent(3, BuddyActionType.GIFT, 20L),
            ),
            settings,
            20L,
        )

        assertEquals(2, state.ep)
        assertEquals(1, state.events.size)
    }
}
