package com.d2rei.buddyoverlay

enum class BuddyActionType(val storageKey: String, val displayName: String) {
    SWAP("swap", "Swap"),
    GIFT("gift", "Gift"),
    CARE("care", "Care"),
    ROUTE("route", "Route"),
    WALK_2KM("walk_2km", "Walk 2 km"),
    BATTLE_ROCKET("battle_rocket", "Rocket"),
    BATTLE_LEADER("battle_leader", "Leader"),
    BATTLE_GYM_RAID("battle_gym_raid", "Gym/Raid"),
    BATTLE_PVP("battle_pvp", "PvP"),
    MANUAL_ADJUST("manual_adjust", "Manual adjustment"),
    RESET_SESSION("reset_session", "Reset session");

    companion object {
        val trackableActions = entries.filter {
            it != MANUAL_ADJUST && it != RESET_SESSION
        }

        val battleActions = listOf(
            BATTLE_ROCKET,
            BATTLE_LEADER,
            BATTLE_GYM_RAID,
            BATTLE_PVP,
        )

        fun fromStorageKey(value: String): BuddyActionType =
            entries.firstOrNull { it.storageKey == value } ?: MANUAL_ADJUST
    }
}
