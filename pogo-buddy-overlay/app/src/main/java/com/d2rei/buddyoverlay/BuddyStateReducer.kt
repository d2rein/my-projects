package com.d2rei.buddyoverlay

import kotlin.math.max

object BuddyStateReducer {
    private const val EP_CAP = 32

    fun reduce(
        events: List<BuddyEvent>,
        settings: BuddySettings,
        nowMs: Long,
    ): BuddyUiState {
        val sorted = events.sortedBy { it.occurredAtMs }
        val sessionStartIndex = sorted.indexOfLast { it.actionType == BuddyActionType.RESET_SESSION }
        val activeEvents = if (sessionStartIndex >= 0) sorted.drop(sessionStartIndex + 1) else sorted

        val lastTapAt = mutableMapOf<BuddyActionType, Long>()
        val lastGrantedAt = mutableMapOf<BuddyActionType, Long>()
        val resolvedEvents = mutableListOf<ResolvedEvent>()
        val decayAmountEp = settings.decayAmountEp

        var ep = 0
        var lastDecayResetAt: Long? = null
        var currentDecayIntervalMs = decayIntervalMsFor(settings, ep)

        activeEvents.forEach { event ->
            val decayApplied = applyDecayUntil(
                ep = ep,
                lastDecayResetAt = lastDecayResetAt,
                targetTimeMs = event.occurredAtMs,
                currentDecayIntervalMs = currentDecayIntervalMs,
                settings = settings,
                decayAmountEp = decayAmountEp,
            )
            ep = decayApplied.ep
            lastDecayResetAt = decayApplied.lastDecayResetAt
            currentDecayIntervalMs = decayApplied.currentDecayIntervalMs

            when (event.actionType) {
                BuddyActionType.MANUAL_ADJUST -> {
                    ep = (ep + event.manualEpDelta).coerceIn(0, EP_CAP)
                    currentDecayIntervalMs = decayIntervalMsFor(settings, ep)
                    resolvedEvents += ResolvedEvent(event, event.manualEpDelta, decayReset = false)
                }

                BuddyActionType.RESET_SESSION -> Unit

                else -> {
                    val cooldownMs = settings.cooldownMsFor(event.actionType)
                    val lastGrant = lastGrantedAt[event.actionType]
                    val eligible = lastGrant == null || cooldownMs <= 0 || event.occurredAtMs >= lastGrant + cooldownMs
                    val granted = if (eligible) settings.epFor(event.actionType) else 0
                    if (eligible) {
                        lastGrantedAt[event.actionType] = event.occurredAtMs
                    }
                    lastTapAt[event.actionType] = event.occurredAtMs
                    lastDecayResetAt = event.occurredAtMs
                    ep = (ep + granted).coerceAtMost(EP_CAP)
                    currentDecayIntervalMs = decayIntervalMsFor(settings, ep)
                    resolvedEvents += ResolvedEvent(event, granted, decayReset = true)
                }
            }
        }

        val decayRemainingMs: Long

        if (lastDecayResetAt == null || currentDecayIntervalMs <= 0L || decayAmountEp <= 0) {
            decayRemainingMs = currentDecayIntervalMs
        } else {
            val decayApplied = applyDecayUntil(
                ep = ep,
                lastDecayResetAt = lastDecayResetAt,
                targetTimeMs = nowMs,
                currentDecayIntervalMs = currentDecayIntervalMs,
                settings = settings,
                decayAmountEp = decayAmountEp,
            )
            ep = decayApplied.ep
            lastDecayResetAt = decayApplied.lastDecayResetAt
            currentDecayIntervalMs = decayApplied.currentDecayIntervalMs
            val anchor = lastDecayResetAt
            if (anchor == null || currentDecayIntervalMs <= 0L) {
                decayRemainingMs = currentDecayIntervalMs
            } else {
                val elapsed = max(0L, nowMs - anchor)
                val remainder = elapsed % currentDecayIntervalMs
                decayRemainingMs = if (remainder == 0L) currentDecayIntervalMs else currentDecayIntervalMs - remainder
            }
        }

        val cooldownStates = BuddyActionType.trackableActions.associateWith { action ->
            val cooldownMs = settings.cooldownMsFor(action)
            val grantedAt = lastGrantedAt[action]
            val remaining = if (cooldownMs <= 0L || grantedAt == null) {
                0L
            } else {
                max(0L, grantedAt + cooldownMs - nowMs)
            }
            ActionCooldownState(
                actionType = action,
                remainingMs = remaining,
                eligible = remaining <= 0L,
                lastTappedAtMs = lastTapAt[action],
                lastGrantedAtMs = grantedAt,
            )
        }

        val shortestBattleCooldownMs = BuddyActionType.battleActions
            .mapNotNull { cooldownStates[it]?.remainingMs }
            .minOrNull() ?: 0L

        val battleBreakdown = BuddyActionType.battleActions.associateWith { action ->
            cooldownStates[action]?.remainingMs ?: 0L
        }

        val careCooldownMs = cooldownStates[BuddyActionType.CARE]?.remainingMs ?: 0L

        return BuddyUiState(
            ep = ep,
            excitedThresholdEp = settings.excitedThresholdEp,
            excited = ep >= settings.excitedThresholdEp,
            lastDecayResetAtMs = lastDecayResetAt,
            decayRemainingMs = decayRemainingMs,
            decayIntervalMs = currentDecayIntervalMs,
            battleBreakdown = battleBreakdown,
            cooldowns = cooldownStates,
            shortestBattleCooldownMs = shortestBattleCooldownMs,
            careCooldownMs = careCooldownMs,
            events = resolvedEvents,
        )
    }

    private fun applyDecayUntil(
        ep: Int,
        lastDecayResetAt: Long?,
        targetTimeMs: Long,
        currentDecayIntervalMs: Long,
        settings: BuddySettings,
        decayAmountEp: Int,
    ): DecayProgress {
        if (lastDecayResetAt == null || currentDecayIntervalMs <= 0L || decayAmountEp <= 0) {
            return DecayProgress(ep = ep, lastDecayResetAt = lastDecayResetAt, currentDecayIntervalMs = currentDecayIntervalMs)
        }

        var currentEp = ep
        var currentAnchor = lastDecayResetAt
        var activeDecayIntervalMs = currentDecayIntervalMs

        while (currentAnchor != null && activeDecayIntervalMs > 0L) {
            val nextDecayAt = currentAnchor + activeDecayIntervalMs
            if (nextDecayAt > targetTimeMs) break
            currentEp = max(0, currentEp - decayAmountEp)
            currentAnchor = nextDecayAt
            activeDecayIntervalMs = decayIntervalMsFor(settings, currentEp, hasDecayed = true)
        }

        return DecayProgress(
            ep = currentEp,
            lastDecayResetAt = currentAnchor,
            currentDecayIntervalMs = activeDecayIntervalMs,
        )
    }

    private fun decayIntervalMsFor(settings: BuddySettings, ep: Int, hasDecayed: Boolean = false): Long {
        val minutes = when {
            ep >= settings.excitedThresholdEp -> settings.excitedDecayIntervalMinutes
            hasDecayed -> settings.subsequentDecayIntervalMinutes
            else -> settings.decayIntervalMinutes
        }
        return minutes.coerceAtLeast(0) * 60_000L
    }

    private data class DecayProgress(
        val ep: Int,
        val lastDecayResetAt: Long?,
        val currentDecayIntervalMs: Long,
    )
}
