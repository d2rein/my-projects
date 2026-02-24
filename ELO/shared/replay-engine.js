// shared/replay-engine.js
// ESM, Cloudflare Workers compatible
//
// SINGLE SOURCE OF TRUTH for:
// - ladder init / seeding
// - ladder ranking score
// - season boundary ladder reset
// - finals ladder locking
// - bye awarding (exact frontend ordering: applied once per "Rd" round, after the first match is processed)
// - replay helpers to guarantee diagnostic CSV == frontend replay output
//
// Elo math remains in shared/elo-calculator.js (unchanged).

import { ELOCalculator } from "./elo-calculator.js";

/**
 * Create a replay engine that wraps ELOCalculator with ladder/season/bye logic.
 *
 * IMPORTANT:
 * - Must be constructed with the FULL team list to ensure byes/ladder logic is correct.
 *
 * @param {object} modelParams - expects frontend-style keys:
 *   { k, homeAdvantage, travelPer1000km, restPerRound, streakPts, earlyBoost, reversionWeight, initialRating? }
 * @param {Array<string|{name:string}>} teams - team list (strings or objects with .name)
 */
export function createReplayEngine(modelParams, teams) {
  const teamNames = (teams || [])
    .map((t) => (typeof t === "string" ? t : t?.name))
    .filter(Boolean);

  if (!teamNames.length) {
    throw new Error("ReplayEngine requires a full team list (non-empty).");
  }

  const initialRating = modelParams?.initialRating ?? 1500;

  const eloCalc = new ELOCalculator({
    // KEEP Elo math unchanged; only map param names.
    kFactor: modelParams.k,
    homeAdvantage: modelParams.homeAdvantage,
    initialRating,
    travelPer1000km: modelParams.travelPer1000km,
    restPerRound: modelParams.restPerRound,
    streakPts: modelParams.streakPts,
    earlyBoost: modelParams.earlyBoost,
    reversionWeight: modelParams.reversionWeight,
  });

  // ----------------------------
  // LADDER HELPERS (moved from app.js)
  // ----------------------------

  function initLadderSeeded(previousOrder = null) {
    const ladder = {};
    for (const team of teamNames) {
      const idx = previousOrder ? previousOrder.indexOf(team) : -1;

      // EXACT frontend behaviour:
      // - new teams: seed 0
      // - existing teams: tiny tiebreak value based on last season order
      const seed =
        idx === -1 ? 0 : (previousOrder.length - idx) / 1_000_000;

      ladder[team] = {
        compPoints: 0,
        seed,
        for: 0,
        against: 0,
        margin: 0,
      };
    }
    return ladder;
  }

  function rankLadder(ladder) {
    return Object.entries(ladder)
      .map(([team, s]) => ({
        team,
        rankingScore: s.compPoints + s.margin / 10000 + s.seed,
        compPoints: s.compPoints,
        for: s.for,
        against: s.against,
        margin: s.margin,
      }))
      .sort((a, b) => b.rankingScore - a.rankingScore);
  }

  function isFinalsRound(round) {
    const s = String(round || "").toLowerCase();
    return [
      "prelim",
      "preliminary",
      "qual",
      "qualifying",
      "semi",
      "gf",
      "grand final",
    ].some((k) => s.startsWith(k));
  }

  function isNewSeason(prevYear, currentYear) {
    return prevYear !== null && prevYear !== currentYear;
  }

  function applyByesForRound(ladder, roundMatches) {
    // EXACT frontend behaviour: "played" means appeared in the fixture for that round,
    // not "has a score".
    const played = new Set();
    for (const m of roundMatches || []) {
      played.add(m.home_team);
      played.add(m.away_team);
    }

    for (const team of teamNames) {
      if (!played.has(team)) {
        ladder[team].compPoints += 2; // bye = 2 points
      }
    }
  }

  function isLockedRound(round) {
    // EXACT frontend behaviour:
    // lock when NOT "Rd" and NOT "qual*"
    const r = String(round || "");
    return !r.startsWith("Rd") && !r.toLowerCase().startsWith("qual");
  }

  // ----------------------------
  // STEP: Elo + Ladder + Season + Finals Lock (state is explicit)
  // ----------------------------
  function step(state, ladder, match, ladderLocked) {
    const events = {
      ladderLockedBefore: ladderLocked,
      ladderLockedAfter: ladderLocked,
      seasonReset: false,
      byeApplied: false, // applied by replayMatches() once per round
    };

    // finals locking: EXACT frontend logic
    if (isLockedRound(match.round)) {
      ladderLocked = true;
    }

    // ladder season reset: BEFORE Elo step (frontend behaviour)
    if (isNewSeason(state.lastYear, match.year)) {
      const previousOrder = rankLadder(ladder).map((r) => r.team);
      ladder = initLadderSeeded(previousOrder);
      ladderLocked = false;
      events.seasonReset = true;
    }

    // Elo stepMatch is authoritative for all Elo math and season reversion
    const out = eloCalc.stepMatch(state, match);

    const home = match.home_team;
    const away = match.away_team;

    // Update ladder only if the game was played AND ladder is not locked
    if (out.updated && !ladderLocked) {
      const homeScore = match.home_score;
      const awayScore = match.away_score;

      ladder[home].for += homeScore;
      ladder[home].against += awayScore;
      ladder[home].margin = ladder[home].for - ladder[home].against;

      ladder[away].for += awayScore;
      ladder[away].against += homeScore;
      ladder[away].margin = ladder[away].for - ladder[away].against;

      if (homeScore > awayScore) ladder[home].compPoints += 2;
      else if (awayScore > homeScore) ladder[away].compPoints += 2;
      else {
        ladder[home].compPoints += 1;
        ladder[away].compPoints += 1;
      }
    }

    events.ladderLockedAfter = ladderLocked;

    return { ladder, out, events, ladderLocked };
  }

  // ----------------------------
  // FULL REPLAY (guarantees diagnostic parity)
  // ----------------------------
  /**
   * Replay a match list using EXACT frontend ordering for byes:
   * - For each match: step() (Elo + ladder update)
   * - Then, once per "Rd" round, applyByesForRound for that round
   *
   * State is replay-local => engine instance can be reused safely.
   *
   * @param {Array<object>} matches
   * @param {object} opts
   *  - applyByes: boolean (default true)
   *  - stopAt: {year, round} optional
   *
   * @returns {object} { ladder, rows, state, eloCalc }
   */
  function replayMatches(matches, opts = {}) {
    const applyByes = opts.applyByes !== false;
    const stopAt = opts.stopAt || null;

    // REPLAY-LOCAL state: safe to reuse engine instance
    const state = eloCalc.createState();

    // REPLAY-LOCAL ladder lock: safe to reuse engine instance
    let ladderLocked = false;

    let ladder = initLadderSeeded(null);
    let lastProcessedRound = null;

    const rows = [];

    // Pre-group by (year, round) to match frontend semantics without O(n^2)
    const roundKey = (m) => `${m.year}__${m.round}`;
    const roundGroups = new Map();
    for (const m of matches || []) {
      const k = roundKey(m);
      if (!roundGroups.has(k)) roundGroups.set(k, []);
      roundGroups.get(k).push(m);
    }

    for (const m of matches || []) {
      const home = m.home_team;
      const away = m.away_team;

      const homeBefore = ladder[home] ? { ...ladder[home] } : null;
      const awayBefore = ladder[away] ? { ...ladder[away] } : null;

      const stepped = step(state, ladder, m, ladderLocked);
      ladder = stepped.ladder;
      ladderLocked = stepped.ladderLocked;

      const events = stepped.events;
      const out = stepped.out;

      // Apply byes ONCE per round (regular season only) — EXACT frontend ordering:
      // executed after step(), and guarded by:
      //   if (m.round !== lastProcessedRound && m.round.startsWith("Rd"))
      if (applyByes && m.round !== lastProcessedRound && String(m.round).startsWith("Rd")) {
        const thisRoundGames = roundGroups.get(roundKey(m)) || [];
        if (!isFinalsRound(m.round)) {
          applyByesForRound(ladder, thisRoundGames);
          lastProcessedRound = m.round;
          events.byeApplied = true;
        }
      }

      const homeAfter = ladder[home] ? { ...ladder[home] } : null;
      const awayAfter = ladder[away] ? { ...ladder[away] } : null;

      // ranks after this match (+ bye application if triggered)
      const ranked = rankLadder(ladder);
      const rankMap = new Map(ranked.map((r, i) => [r.team, i + 1]));

      rows.push({
        match: m,
        out,
        events,

        // Full state snapshots for frontend parity
        stateAfter: {
            ratings: { ...state.ratings }
        },

        ladderAfter: JSON.parse(JSON.stringify(ladder)),

        homeLadderBefore,
        awayLadderBefore,
        homeLadderAfter,
        awayLadderAfter,
        homeRankAfter: rankMap.get(home) ?? null,
        awayRankAfter: rankMap.get(away) ?? null,
        });

      if (
        stopAt &&
        String(m.year) === String(stopAt.year) &&
        String(m.round).toLowerCase() === String(stopAt.round).toLowerCase()
      ) {
        break;
      }
    }

    return { ladder, rows, state, eloCalc };
  }

  // ----------------------------
  // FORMULA DOCUMENTATION (for diagnostic CSV)
  // ----------------------------
  function diagnosticFormulaBlock() {
    return [
      "# =====================================================================",
      "# NRL ELO + REPLAY ENGINE DIAGNOSTIC (single-source shared engine)",
      "# =====================================================================",
      "",
      "# ----- MODEL PARAMETERS (as configured) -----",
      `# initialRating=${eloCalc.initialRating}`,
      `# kFactor=${eloCalc.kFactor}`,
      `# homeAdvantage=${eloCalc.homeAdvantage}`,
      `# travelPer1000km=${eloCalc.travelPer1000km}`,
      `# restPerRound=${eloCalc.restPerRound}`,
      `# streakPts=${eloCalc.streakPts}`,
      `# earlyBoost=${eloCalc.earlyBoost}`,
      `# reversionWeight=${eloCalc.reversionWeight}`,
      `# marginCoef=${eloCalc.marginCoef}`,
      `# oddsCoef=${eloCalc.oddsCoef}`,
      `# drWeighting=${eloCalc.drWeighting}`,
      "",
      "# ----- ELO CORE EQUATIONS (from shared/elo-calculator.js) -----",
      "# Adjustments (computed pre-match):",
      "#   kmAway = haversineKm(awayBase, homeBase)  (0 if base missing)",
      "#   travelAdj = (kmAway / 1000) * travelPer1000km",
      "#",
      "#   roundNo = extractRoundNumber(round)  (Rd N; finals mapped to 28..31; else null)",
      "#   homeRest = max(0, roundNo - prevHomeRound - 1)  (season-only; if roundNo null -> 0)",
      "#   awayRest = max(0, roundNo - prevAwayRound - 1)",
      "#   restAdj = restPerRound * (homeRest - awayRest)",
      "#",
      "#   homeStreak = state.streak.get(home) ?? 0",
      "#   awayStreak = state.streak.get(away) ?? 0",
      "#   streakAdj = streakPts * (homeStreak - awayStreak)",
      "#",
      "# Rating difference:",
      "#   dr = (homeElo + homeAdvantage + travelAdj + restAdj + streakAdj) - awayElo",
      "#",
      "# Win expectancy (logistic):",
      "#   expected = 1 / (1 + 10^(-dr / drWeighting))",
      "#",
      "# Predicted margin:",
      "#   predictedMargin = marginCoef * dr",
      "#",
      "# Match result encoding:",
      "#   actualResult = (homeScore - awayScore) > 0 ? 1 : 0",
      "#   (draw counts as 0 here, matching current Elo math)",
      "",
      "# ----- K-FACTOR / MARGIN MULTIPLIER (from shared/elo-calculator.js) -----",
      "# marginBucket:",
      "#   rawBucket = ceil(|margin| / 6)",
      "#   idx = clamp(rawBucket, 1..4)",
      "#",
      "# marginAdj terms:",
      "#   table = {1:0.5, 2:1.0, 3:1.5, 4:1.75}",
      "#   term1 = table[idx]",
      "#   term2 = max(idx - 3, 0) / 8",
      "#   marginAdj = (term1 + term2) - 1.0",
      "#",
      "# early season boost:",
      "#   early = earlyBoost * max(0, 11 - roundNo)   (only if roundNo > 0)",
      "#",
      "# finalK:",
      "#   baseK = kFactor + early",
      "#   finalK = baseK * (1.0 + marginAdj)",
      "#",
      "# rating update:",
      "#   newRating = oldRating + finalK * (actualResult - expectedResult)",
      "",
      "# ----- SEASON REVERSION (from shared/elo-calculator.js) -----",
      "# At year boundary (when match.year != state.lastYear):",
      "#   rating := (initialRating + reversionWeight * rating) / (reversionWeight + 1)",
      "#   then reset season-only state:",
      "#     state.lastRoundPlayed = new Map()",
      "#     state.streak = new Map()",
      "",
      "# ----- LADDER RULES (from shared/replay-engine.js) -----",
      "# Ladder state per team:",
      "#   compPoints, for, against, margin (= for - against), seed",
      "#",
      "# Match ladder update (only if out.updated AND ladder is not locked):",
      "#   for/against accumulate actual scores",
      "#   win=+2 pts, loss=+0, draw=+1 each",
      "#",
      "# Bye handling (regular season rounds only):",
      "#   Once per 'Rd N' round, AFTER the first match in that round is processed:",
      "#   Any team not appearing as home/away in that round's fixture gets +2 compPoints",
      "#",
      "# Finals locking (exact frontend behaviour):",
      "#   If round does NOT start with 'Rd' AND does NOT start with 'qual' (case-insensitive),",
      "#   ladderLocked becomes true and ladder stops updating for subsequent matches.",
      "#",
      "# Season boundary ladder reset (separate from Elo reversion):",
      "#   BEFORE processing the first match of a new year:",
      "#     previousOrder = rankLadder(ladder).map(team)",
      "#     ladder = initLadderSeeded(previousOrder)",
      "#     ladderLocked = false",
      "#",
      "# Ladder ranking formula:",
      "#   rankingScore = compPoints + (margin / 10000) + seed",
      "#",
      "# Seed formula (tiny stable tiebreaker across resets):",
      "#   seed = 0 for teams not found in previousOrder",
      "#   else seed = (previousOrder.length - indexOf(team)) / 1_000_000",
      "",
      "# =====================================================================",
      "",
    ].join("\n");
  }

  return {
    eloCalc,

    // ladder API (no duplication elsewhere)
    initLadderSeeded,
    rankLadder,
    isFinalsRound,
    isNewSeason,
    applyByesForRound,

    // replay API
    step,
    replayMatches,

    // docs
    diagnosticFormulaBlock,
  };
}