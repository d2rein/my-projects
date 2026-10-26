package com.d2rei.garagedoor

import org.junit.Assert.assertEquals
import org.junit.Test

class DoorStateLogicTest {
    @Test fun openShowsBubble() {
        assertEquals(BubbleMode.OPEN, DoorStateLogic.bubbleMode(false, "OPEN"))
    }

    @Test fun closedHidesBubble() {
        assertEquals(BubbleMode.HIDDEN, DoorStateLogic.bubbleMode(true, "CLOSED"))
    }

    @Test fun unknownKeepsSafetyBubbleAfterOpen() {
        assertEquals(BubbleMode.CHECK, DoorStateLogic.bubbleMode(true, "UNKNOWN"))
        assertEquals(true, DoorStateLogic.remainsOpen(true, "UNREACHABLE"))
    }

    @Test fun unknownDoesNotCreateBubbleAtStartup() {
        assertEquals(BubbleMode.HIDDEN, DoorStateLogic.bubbleMode(false, "UNKNOWN"))
    }

    @Test fun wakeAlertRetriesUntilActiveOrDeliberatelySuppressed() {
        assertEquals(true, DoorStateLogic.shouldLaunchWakeAlert(true, "OPEN", true, false, false))
        assertEquals(false, DoorStateLogic.shouldLaunchWakeAlert(true, "OPEN", false, false, false))
        assertEquals(false, DoorStateLogic.shouldLaunchWakeAlert(true, "OPEN", true, true, false))
        assertEquals(false, DoorStateLogic.shouldLaunchWakeAlert(true, "OPEN", true, false, true))
        assertEquals(false, DoorStateLogic.shouldLaunchWakeAlert(false, "OPEN", true, false, false))
        assertEquals(false, DoorStateLogic.shouldLaunchWakeAlert(true, "CLOSED", true, false, false))
    }

    @Test fun floatingBubbleIsHiddenOnLockScreenOrDuringWakeAlert() {
        assertEquals(BubbleMode.OPEN, DoorStateLogic.visibleBubbleMode(BubbleMode.OPEN, false, false))
        assertEquals(BubbleMode.HIDDEN, DoorStateLogic.visibleBubbleMode(BubbleMode.OPEN, true, false))
        assertEquals(BubbleMode.HIDDEN, DoorStateLogic.visibleBubbleMode(BubbleMode.OPEN, false, true))
        assertEquals(BubbleMode.HIDDEN, DoorStateLogic.visibleBubbleMode(BubbleMode.CHECK, true, false))
    }

    @Test fun closeLocksOnlyForAnActiveOptedInWakeAlert() {
        assertEquals(true, DoorStateLogic.shouldLockOnClose(true, true, "CLOSED", true, true))
        assertEquals(false, DoorStateLogic.shouldLockOnClose(false, true, "CLOSED", true, true))
        assertEquals(false, DoorStateLogic.shouldLockOnClose(true, true, "CLOSED", false, true))
        assertEquals(false, DoorStateLogic.shouldLockOnClose(true, true, "CLOSED", true, false))
        assertEquals(false, DoorStateLogic.shouldLockOnClose(true, true, "OPEN", true, true))
    }
}
