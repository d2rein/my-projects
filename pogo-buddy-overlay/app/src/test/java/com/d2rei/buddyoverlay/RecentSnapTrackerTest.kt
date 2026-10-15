package com.d2rei.buddyoverlay

import org.junit.Assert.assertEquals
import org.junit.Test

class RecentSnapTrackerTest {
    @Test
    fun keepsOnlyAcknowledgementsFromTheLastHour() {
        val now = 10 * RecentSnapTracker.WINDOW_MS
        val timestamps = listOf(
            now - RecentSnapTracker.WINDOW_MS,
            now - RecentSnapTracker.WINDOW_MS + 1,
            now - 15_000L,
            now + 1,
        )

        assertEquals(2, RecentSnapTracker.recent(timestamps, now).size)
    }

    @Test
    fun labelFallsBackToSnapAtZero() {
        assertEquals("SNAP", RecentSnapTracker.label(0))
        assertEquals("7", RecentSnapTracker.label(7))
    }
}
