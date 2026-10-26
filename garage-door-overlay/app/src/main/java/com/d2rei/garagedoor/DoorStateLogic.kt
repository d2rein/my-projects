package com.d2rei.garagedoor

enum class BubbleMode { HIDDEN, OPEN, CHECK }

object DoorStateLogic {
    fun bubbleMode(previouslyOpen: Boolean, serverState: String): BubbleMode = when (serverState) {
        "OPEN" -> BubbleMode.OPEN
        "CLOSED" -> BubbleMode.HIDDEN
        else -> if (previouslyOpen) BubbleMode.CHECK else BubbleMode.HIDDEN
    }

    fun remainsOpen(previouslyOpen: Boolean, serverState: String): Boolean = when (serverState) {
        "OPEN" -> true
        "CLOSED" -> false
        else -> previouslyOpen
    }

    fun shouldLaunchWakeAlert(
        wakeEnabled: Boolean,
        serverState: String,
        lockedOrScreenOff: Boolean,
        suppressedForCurrentOpen: Boolean,
        wakeAlertActive: Boolean,
    ): Boolean = wakeEnabled &&
        serverState == "OPEN" &&
        lockedOrScreenOff &&
        !suppressedForCurrentOpen &&
        !wakeAlertActive

    fun visibleBubbleMode(
        requestedMode: BubbleMode,
        lockedOrScreenOff: Boolean,
        wakeAlertActive: Boolean,
    ): BubbleMode = if (lockedOrScreenOff || wakeAlertActive) BubbleMode.HIDDEN else requestedMode

    fun shouldLockOnClose(
        sleepEnabled: Boolean,
        previouslyOpen: Boolean,
        serverState: String,
        wakeAlertActive: Boolean,
        deviceAdminActive: Boolean,
    ): Boolean = sleepEnabled &&
        previouslyOpen &&
        serverState == "CLOSED" &&
        wakeAlertActive &&
        deviceAdminActive
}
