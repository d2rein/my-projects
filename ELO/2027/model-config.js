export const MODELS = Object.freeze({
  production2026: {
    id: "prod-observed-2026-09-11",
    label: "2026 production",
    shortLabel: "2026",
    status: "historical control",
    parameters: {
      initialRating: 1500, k: 9.455, homeAdvantage: 40,
      travelPer1000km: 15, restPerRound: 3.2, streakPts: 2.15,
      earlyBoost: 0.95, reversionWeight: 3, divisor: 400,
      marginCoefficient: 0.048406
    }
  },
  candidate2027: {
    id: "2027-candidate-bstar-rookie-gate6-v1",
    label: "2027 candidate — B* + Rookie Gate 6",
    shortLabel: "2027 candidate",
    status: "mock / prospective candidate",
    parameters: {
      initialRating: 1500, k: 9.455, homeAdvantage: 40,
      travelPer1000km: 15, actualRestPerWeek: 5, streakPts: 2.15,
      earlyBoost: 0.95, reversionWeight: 3, divisor: 400,
      marginCoefficient: 0.048406,
      rookieWindowYears: 8, rookieRidge: 300,
      rookieCapMargin: 18, rookieGateMargin: 6
    },
    rookie: {
      features: ["debutants", "under 5 NRL matches", "under 20 NRL matches"],
      note: "Nested counts; fitted annually using only earlier seasons."
    }
  }
});

export const ACTIVE_MODEL = MODELS.candidate2027;

export const MARKET_RULES = Object.freeze({
  confidenceSwap: { marketOverModel: 0.10 },
  adverseMovement: { movement: 0.10 }
});

export const MARGIN_MODELS = Object.freeze({
  stable: {
    id: "stable-discrete-l1-v1",
    label: "Stable discrete L1",
    bandwidth: 1.5,
    halfLifeGames: 1000,
    actions: [2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32]
  },
  refined: {
    id: "refined-discrete-2026-regime-v1",
    label: "Refined 2026-regime shadow",
    bandwidth: 3,
    halfLifeGames: 125,
    exactUtility: 150,
    actions: [2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32]
  },
  general: { id: "general-4-8-10", label: "General 4 / 8 / 10", thresholds: [85, 185] }
});

export const CACHE_VERSION = "2026-09-15-v1";
export const CURRENT_SEASON = 2026;
export const API_URL = "https://nrl-elo-api.d2-rein.workers.dev";
