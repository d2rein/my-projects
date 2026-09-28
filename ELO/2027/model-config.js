export const SYSTEMS = Object.freeze({
  elo: { id: "ELO_v1.1", label: "Base 2027 ELO", development: "B* / actual-rest baseline; neutral grand final" },
  rookie: { id: "RA_v1.0", label: "Rookie Adjustment", development: "Gate 6 / steps_0_5_20_robust_gate6" },
  lineup: { id: "LA_v1.0", label: "Lineup Adjustment", development: "Stage 4C / minutes_rookie_role5 / tip_selected / config 41" },
  market: { id: "MS_v1.0", label: "Market Swap", development: "Protected 10-point confidence-gap rule" },
  playerFull: { id: "Player_Profile_Full_v1.0", label: "Full Player Profile", development: "O10_full" },
  playerCore: { id: "Player_Profile_Core_v1.0", label: "Core Player Profile", development: "O9_no_error" },
  creation: { id: "Creation_Profile_v1.0", label: "Creation Profile", development: "C1_creation_gate4" }
});

export const MODELS = Object.freeze({
  production2026: {
    id: "prod-observed-2026-09-11", label: "2026 production", shortLabel: "2026", status: "historical control",
    parameters: {
      initialRating: 1500, k: 9.455, homeAdvantage: 40, travelPer1000km: 15,
      restPerRound: 3.2, streakPts: 2.15, earlyBoost: 0.95, reversionWeight: 3,
      divisor: 400, marginCoefficient: 0.048406
    }
  },
  website2027v100: { id: "2027_v1.0.0", label: "2027 v1.0.0 - B* + Rookie Gate 6", status: "superseded preview" },
  candidate2027: {
    id: "2027_v1.1.1", label: "2027 ELO v1.1.1", shortLabel: "2027 ELO", status: "deployed 2027 preview baseline",
    systems: Object.values(SYSTEMS).map(system => system.id),
    parameters: {
      initialRating: 1500, k: 9.455, homeAdvantage: 40, travelPer1000km: 15,
      actualRestPerWeek: 5, streakPts: 2.15, earlyBoost: 0.95, reversionWeight: 3,
      divisor: 400, marginCoefficient: 0.048406, rookieWindowYears: 8, rookieRidge: 300,
      rookieCapMargin: 18, rookieGateMargin: 6, lineupOriginalConfidenceGate: 0.10,
      marketConfidenceGap: 0.10, neutralGrandFinal: true
    }
  }
});

export const ACTIVE_MODEL = MODELS.candidate2027;

export const TIPPING_POLICY = Object.freeze([
  "Start with the displayed 2027 ELO tip (Base ELO plus the selected team-list adjustment).",
  "Follow an active Market Swap when it opposes the model and is at least 10 percentage points more confident.",
  "Do not follow a grey Market Swap: a protected Lineup Adjustment or Full Player Profile signal has superseded it.",
  "A yellow Player Alert overrides the displayed tip and any Market Swap, but is a manual-review decision.",
  "A green Player Consensus is the same reversal supported by Full, Core and Creation profiles; follow it with higher confidence."
]);

export const MARKET_RULES = Object.freeze({
  confidenceSwap: { marketOverModel: 0.10 }, adverseMovement: { movement: 0.10 }
});

export const MARGIN_MODELS = Object.freeze({
  stable: { id: "stable-discrete-l1-v1", label: "Stable discrete L1", bandwidth: 1.5, halfLifeGames: 1000, actions: [2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32] },
  refined: { id: "refined-discrete-2026-regime-v1", label: "Refined 2026-regime shadow", bandwidth: 3, halfLifeGames: 125, exactUtility: 150, actions: [2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32] },
  general: { id: "general-4-8-10", label: "General 4 / 8 / 10", thresholds: [85, 185] }
});

export const CACHE_VERSION = "2026-09-25-v2";
export const CURRENT_SEASON = 2026;
export const API_URL = "https://nrl-elo-api.d2-rein.workers.dev";
