package com.d2rei.buddyoverlay

import androidx.annotation.ColorRes
import androidx.annotation.DrawableRes

data class BuddyActionVisual(
    @DrawableRes val drawableRes: Int,
    @ColorRes val tintRes: Int,
    val shortLabel: String,
)

object BuddyActionVisuals {
    private val visualMap = mapOf(
        BuddyActionType.SWAP to BuddyActionVisual(R.drawable.ic_buddy_swap, R.color.accent, "Swap"),
        BuddyActionType.GIFT to BuddyActionVisual(R.drawable.ic_buddy_gift, R.color.accentWarm, "Gift"),
        BuddyActionType.CARE to BuddyActionVisual(R.drawable.ic_buddy_care, R.color.accentReady, "Care"),
        BuddyActionType.ROUTE to BuddyActionVisual(R.drawable.ic_buddy_route, R.color.accent, "Route"),
        BuddyActionType.WALK_2KM to BuddyActionVisual(R.drawable.ic_buddy_walk, R.color.accentReady, "Walk"),
        BuddyActionType.BATTLE_ROCKET to BuddyActionVisual(R.drawable.ic_buddy_rocket, R.color.accentDanger, "Rkt"),
        BuddyActionType.BATTLE_LEADER to BuddyActionVisual(R.drawable.ic_buddy_leader, R.color.accentWarm, "Lead"),
        BuddyActionType.BATTLE_GYM_RAID to BuddyActionVisual(R.drawable.ic_buddy_gym_raid, R.color.accent, "Gym"),
        BuddyActionType.BATTLE_PVP to BuddyActionVisual(R.drawable.ic_buddy_pvp, R.color.accentDanger, "PvP"),
    )

    fun forAction(actionType: BuddyActionType): BuddyActionVisual = visualMap.getValue(actionType)
}
