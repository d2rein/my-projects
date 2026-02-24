var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../shared/elo-calculator.js
var TEAM_BASES = {
  "Melbourne Storm": [-37.8136, 144.9631],
  "Penrith Panthers": [-33.75, 150.7],
  "Sydney Roosters": [-33.8688, 151.2093],
  "Brisbane Broncos": [-27.4698, 153.0251],
  "Cronulla Sharks": [-34.0574, 151.152],
  "Canberra Raiders": [-35.2809, 149.13],
  "Manly Sea Eagles": [-33.7969, 151.2857],
  "Dolphins": [-27.193, 153.026],
  "Canterbury Bulldogs": [-33.8688, 151.2093],
  "New Zealand Warriors": [-36.8485, 174.7633],
  "NQ Cowboys": [-19.2589, 146.8169],
  "South Sydney Rabbitohs": [-33.8688, 151.2093],
  "Parramatta Eels": [-33.815, 151.0011],
  "Newcastle Knights": [-32.9283, 151.7817],
  "St. George Illawarra Dragons": [-34.4278, 150.8931],
  "Wests Tigers": [-33.884, 151.12],
  "Gold Coast Titans": [-28.0167, 153.4]
};
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = /* @__PURE__ */ __name((d) => d * Math.PI / 180, "toRad");
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dphi = toRad(lat2 - lat1);
  const dlmb = toRad(lon2 - lon1);
  const a = Math.sin(dphi / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dlmb / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
__name(haversineKm, "haversineKm");
var ELOCalculator = class {
  static {
    __name(this, "ELOCalculator");
  }
  constructor(params = {}) {
    this.kFactor = Number(params.kFactor ?? 8.875);
    this.homeAdvantage = Number(params.homeAdvantage ?? 45);
    this.initialRating = Number(params.initialRating ?? 1500);
    this.travelPer1000km = Number(params.travelPer1000km ?? 0);
    this.restPerRound = Number(params.restPerRound ?? 2);
    this.streakPts = Number(params.streakPts ?? 0);
    this.reversionWeight = Number(params.reversionWeight ?? 3.3);
    this.earlyBoost = Number(params.earlyBoost ?? 0.8);
    this.marginCoef = 0.048406;
    this.oddsCoef = 2e-3;
    this.drWeighting = 400;
  }
  // ----------------------------
  // STATE (single replay engine)
  // ----------------------------
  createState() {
    return {
      ratings: {},
      // teamName -> rating
      lastYear: null,
      // last processed year
      lastRoundPlayed: /* @__PURE__ */ new Map(),
      // teamName -> roundNumber
      streak: /* @__PURE__ */ new Map()
      // teamName -> streak int
    };
  }
  _getRating(state, teamName) {
    const v = state.ratings[teamName];
    return Number.isFinite(v) ? v : this.initialRating;
  }
  _setRating(state, teamName, rating) {
    state.ratings[teamName] = rating;
  }
  // ----------------------------
  // CORE MATH
  // ----------------------------
  calculateWinExpectancy(dr) {
    return 1 / (Math.pow(10, -dr / this.drWeighting) + 1);
  }
  getRatingDifference(homeElo, awayElo, travelAdj = 0, restAdj = 0, streakAdj = 0) {
    return homeElo + this.homeAdvantage + travelAdj + restAdj + streakAdj - awayElo;
  }
  predictMargin(dr) {
    return this.marginCoef * dr;
  }
  calculateWinProbability(dr) {
    const prob = 0.5 + this.oddsCoef * dr;
    return Math.max(0, Math.min(1, prob));
  }
  // ----------------------------
  // ROUND PARSER (must match your python)
  // ----------------------------
  extractRoundNumber(roundStr) {
    if (!roundStr) return null;
    const s = String(roundStr).trim();
    const rdMatch = s.match(/Rd\s*(\d+)/i);
    if (rdMatch) return parseInt(rdMatch[1], 10);
    const finalsMap = {
      "Prelim": 28,
      "Preliminary": 28,
      "Qual": 29,
      "Qualifying": 29,
      "Semi": 30,
      "Semi Final": 30,
      "GF": 31,
      "Grand Final": 31
    };
    const key = Object.keys(finalsMap).find(
      (k) => s.toLowerCase().startsWith(k.toLowerCase())
    );
    return key ? finalsMap[key] : null;
  }
  // ----------------------------
  // K FACTOR (your bucket + early)
  // ----------------------------
  calculateNewRating(oldRating, actualResult, expectedResult, margin, roundNumber) {
    const rawBucket = Math.ceil(Math.abs(margin) / 6);
    const idx = Math.max(1, Math.min(rawBucket, 4));
    const table = { 1: 0.5, 2: 1, 3: 1.5, 4: 1.75 };
    const term1 = table[idx];
    const term2 = Math.max(idx - 3, 0) / 8;
    const marginAdj = term1 + term2 - 1;
    let early = 0;
    if (roundNumber && roundNumber > 0) {
      early = this.earlyBoost * Math.max(0, 11 - roundNumber);
    }
    const baseK = this.kFactor + early;
    const finalK = baseK * (1 + marginAdj);
    return oldRating + finalK * (actualResult - expectedResult);
  }
  // ----------------------------
  // SEASON REVERSION (single source of truth)
  // ----------------------------
  revertToMean(endOfSeasonElo, w = this.reversionWeight) {
    return (this.initialRating + w * endOfSeasonElo) / (w + 1);
  }
  applySeasonReversionToRatings(state) {
    const w = this.reversionWeight;
    if (!(w > 0)) return;
    for (const team of Object.keys(state.ratings)) {
      const r = state.ratings[team];
      if (Number.isFinite(r) && r !== this.initialRating) {
        state.ratings[team] = this.revertToMean(r, w);
      }
    }
  }
  // ----------------------------
  // ADJUSTMENTS (travel/rest/streak)
  // ----------------------------
  travelKm(awayTeam, homeTeam) {
    const a = TEAM_BASES[awayTeam];
    const h = TEAM_BASES[homeTeam];
    if (!a || !h) return 0;
    return haversineKm(a[0], a[1], h[0], h[1]);
  }
  computeAdjustments(state, match) {
    const home = match.home_team;
    const away = match.away_team;
    const roundNo = this.extractRoundNumber(match.round);
    const kmAway = this.travelKm(away, home);
    const travelAdj = kmAway / 1e3 * this.travelPer1000km;
    let homeRest = 0;
    let awayRest = 0;
    const prevHome = state.lastRoundPlayed.get(home);
    const prevAway = state.lastRoundPlayed.get(away);
    if (roundNo != null) {
      if (prevHome != null) homeRest = Math.max(0, roundNo - prevHome - 1);
      if (prevAway != null) awayRest = Math.max(0, roundNo - prevAway - 1);
    }
    const restAdj = this.restPerRound * (homeRest - awayRest);
    const homeStreak = state.streak.get(home) ?? 0;
    const awayStreak = state.streak.get(away) ?? 0;
    const streakAdj = this.streakPts * (homeStreak - awayStreak);
    return {
      roundNo,
      kmAway,
      homeRest,
      awayRest,
      homeStreak,
      awayStreak,
      travelAdj,
      restAdj,
      streakAdj
    };
  }
  // ----------------------------
  // PREVIEW MATCH (NO STATE MUTATION)
  // ----------------------------
  previewMatch(state, match) {
    const home = match.home_team;
    const away = match.away_team;
    const homeEloBefore = this._getRating(state, home);
    const awayEloBefore = this._getRating(state, away);
    const adj = this.computeAdjustments(state, match);
    const dr = this.getRatingDifference(
      homeEloBefore,
      awayEloBefore,
      adj.travelAdj,
      adj.restAdj,
      adj.streakAdj
    );
    return {
      dr,
      expected: this.calculateWinExpectancy(dr),
      predictedMargin: this.predictMargin(dr),
      homeEloBefore,
      awayEloBefore,
      ...adj
    };
  }
  // ----------------------------
  // SINGLE MATCH STEP (replay engine)
  // ----------------------------
  stepMatch(state, match) {
    const year = Number(match.year);
    const home = match.home_team;
    const away = match.away_team;
    let reversionApplied = false;
    if (state.lastYear !== null && year !== state.lastYear) {
      this.applySeasonReversionToRatings(state);
      state.lastRoundPlayed = /* @__PURE__ */ new Map();
      state.streak = /* @__PURE__ */ new Map();
      reversionApplied = true;
    }
    state.lastYear = year;
    const homeEloBefore = this._getRating(state, home);
    const awayEloBefore = this._getRating(state, away);
    const adj = this.computeAdjustments(state, match);
    const elo_diff = homeEloBefore - awayEloBefore;
    const dr = this.getRatingDifference(
      homeEloBefore,
      awayEloBefore,
      adj.travelAdj,
      adj.restAdj,
      adj.streakAdj
    );
    const expected = this.calculateWinExpectancy(dr);
    const predictedMargin = this.predictMargin(dr);
    const predictedWinProb = this.calculateWinProbability(dr);
    const hasScore = match.home_score != null && match.away_score != null;
    if (!hasScore) {
      return {
        updated: false,
        reversionApplied,
        homeEloBefore,
        awayEloBefore,
        elo_diff,
        dr,
        expected,
        predictedMargin,
        predictedWinProb,
        ...adj
      };
    }
    const margin = Number(match.home_score) - Number(match.away_score);
    const actualResult = margin > 0 ? 1 : 0;
    const rawBucket = Math.ceil(Math.abs(margin) / 6);
    const idx = Math.max(1, Math.min(rawBucket, 4));
    const table = { 1: 0.5, 2: 1, 3: 1.5, 4: 1.75 };
    const term1 = table[idx];
    const term2 = Math.max(idx - 3, 0) / 8;
    const marginAdj = term1 + term2 - 1;
    let early = 0;
    if (adj.roundNo && adj.roundNo > 0) {
      early = this.earlyBoost * Math.max(0, 11 - adj.roundNo);
    }
    const baseK = this.kFactor + early;
    const finalK = baseK * (1 + marginAdj);
    const delta = finalK * (actualResult - expected);
    const newHomeElo = homeEloBefore + delta;
    const newAwayElo = awayEloBefore - delta;
    this._setRating(state, home, newHomeElo);
    this._setRating(state, away, newAwayElo);
    const homeSt = adj.homeStreak;
    const awaySt = adj.awayStreak;
    if (actualResult === 1) {
      state.streak.set(home, Math.max(1, homeSt + 1));
      state.streak.set(away, Math.min(-1, awaySt - 1));
    } else {
      state.streak.set(home, Math.min(-1, homeSt - 1));
      state.streak.set(away, Math.max(1, awaySt + 1));
    }
    if (adj.roundNo != null) {
      state.lastRoundPlayed.set(home, adj.roundNo);
      state.lastRoundPlayed.set(away, adj.roundNo);
    }
    return {
      updated: true,
      reversionApplied,
      homeEloBefore,
      awayEloBefore,
      elo_diff,
      home_advantage: this.homeAdvantage,
      travel_km: adj.kmAway,
      travelAdj: adj.travelAdj,
      rest_diff: adj.homeRest - adj.awayRest,
      restAdj: adj.restAdj,
      streak_diff: adj.homeStreak - adj.awayStreak,
      streakAdj: adj.streakAdj,
      dr,
      expected,
      predictedMargin,
      predictedWinProb,
      margin,
      actualResult,
      rawBucket,
      idx,
      term1,
      term2,
      marginAdj,
      early,
      baseK,
      finalK,
      delta,
      newHomeElo,
      newAwayElo
    };
  }
};

// ../shared/replay-engine.js
function createReplayEngine(modelParams, teams) {
  const teamNames = (teams || []).map((t) => typeof t === "string" ? t : t?.name).filter(Boolean);
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
    reversionWeight: modelParams.reversionWeight
  });
  function initLadderSeeded(previousOrder = null) {
    const ladder = {};
    for (const team of teamNames) {
      const idx = previousOrder ? previousOrder.indexOf(team) : -1;
      const seed = idx === -1 ? 0 : (previousOrder.length - idx) / 1e6;
      ladder[team] = {
        compPoints: 0,
        seed,
        for: 0,
        against: 0,
        margin: 0
      };
    }
    return ladder;
  }
  __name(initLadderSeeded, "initLadderSeeded");
  function rankLadder(ladder) {
    return Object.entries(ladder).map(([team, s]) => ({
      team,
      rankingScore: s.compPoints + s.margin / 1e4 + s.seed,
      compPoints: s.compPoints,
      for: s.for,
      against: s.against,
      margin: s.margin
    })).sort((a, b) => b.rankingScore - a.rankingScore);
  }
  __name(rankLadder, "rankLadder");
  function isFinalsRound(round) {
    const s = String(round || "").toLowerCase();
    return [
      "prelim",
      "preliminary",
      "qual",
      "qualifying",
      "semi",
      "gf",
      "grand final"
    ].some((k) => s.startsWith(k));
  }
  __name(isFinalsRound, "isFinalsRound");
  function isNewSeason(prevYear, currentYear) {
    return prevYear !== null && prevYear !== currentYear;
  }
  __name(isNewSeason, "isNewSeason");
  function applyByesForRound(ladder, roundMatches) {
    const played = /* @__PURE__ */ new Set();
    for (const m of roundMatches || []) {
      played.add(m.home_team);
      played.add(m.away_team);
    }
    for (const team of teamNames) {
      if (!played.has(team)) {
        ladder[team].compPoints += 2;
      }
    }
  }
  __name(applyByesForRound, "applyByesForRound");
  function isLockedRound(round) {
    const r = String(round || "");
    return !r.startsWith("Rd") && !r.toLowerCase().startsWith("qual");
  }
  __name(isLockedRound, "isLockedRound");
  function step(state, ladder, match, ladderLocked) {
    const events = {
      ladderLockedBefore: ladderLocked,
      ladderLockedAfter: ladderLocked,
      seasonReset: false,
      byeApplied: false
      // applied by replayMatches() once per round
    };
    if (isLockedRound(match.round)) {
      ladderLocked = true;
    }
    if (isNewSeason(state.lastYear, match.year)) {
      const previousOrder = rankLadder(ladder).map((r) => r.team);
      ladder = initLadderSeeded(previousOrder);
      ladderLocked = false;
      events.seasonReset = true;
    }
    const out = eloCalc.stepMatch(state, match);
    const home = match.home_team;
    const away = match.away_team;
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
  __name(step, "step");
  function replayMatches(matches, opts = {}) {
    const applyByes = opts.applyByes !== false;
    const stopAt = opts.stopAt || null;
    const state = eloCalc.createState();
    let ladderLocked = false;
    let ladder = initLadderSeeded(null);
    let lastProcessedRound = null;
    const rows = [];
    const roundKey = /* @__PURE__ */ __name((m) => `${m.year}__${m.round}`, "roundKey");
    const roundGroups = /* @__PURE__ */ new Map();
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
        awayRankAfter: rankMap.get(away) ?? null
      });
      if (stopAt && String(m.year) === String(stopAt.year) && String(m.round).toLowerCase() === String(stopAt.round).toLowerCase()) {
        break;
      }
    }
    return { ladder, rows, state, eloCalc };
  }
  __name(replayMatches, "replayMatches");
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
      ""
    ].join("\n");
  }
  __name(diagnosticFormulaBlock, "diagnosticFormulaBlock");
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
    diagnosticFormulaBlock
  };
}
__name(createReplayEngine, "createReplayEngine");

// src/index.js
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }
    try {
      let response;
      const db = env.DB;
      if (path === "/api/teams" && request.method === "GET") {
        response = await handleGetTeams(db);
      } else if (path === "/api/matches" && request.method === "GET") {
        response = await handleGetMatches(db, url.searchParams);
      } else if (path === "/api/tips" && request.method === "POST") {
        response = await handleUpdateTips(request, env);
      } else if (path === "/api/matches/bulk-update" && request.method === "POST") {
        response = await handleUpdateScores(db, request);
      } else if (path === "/api/predictions" && request.method === "GET") {
        response = await handleGetPredictions(db);
      } else if (path === "/api/parameters" && request.method === "GET") {
        response = await handleGetParameters(db);
      } else if (path === "/api/export" && request.method === "GET") {
        response = await handleExport(db);
      } else if (path === "/api/diagnostic" && request.method === "GET") {
        response = await handleDiagnostic(db);
      } else if (path === "/api/calculate" && request.method === "POST") {
        response = await handleRecalculate(db, request);
      } else if (path === "/api/parity" && request.method === "GET") {
        response = await handleParity(db);
      } else {
        response = new Response("Not Found", { status: 404 });
      }
      Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
      return response;
    } catch (error) {
      console.error("Error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
  }
};
async function handleParity(db) {
  const params = await getParameters(db);
  const calculator = new ELOCalculator(params);
  const stateA = calculator.createState();
  const stateB = calculator.createState();
  const { results } = await db.prepare(`
    SELECT
      m.year,
      m.round,
      m.home_score,
      m.away_score,
      ht.name as home_team,
      at.name as away_team
    FROM matches m
    JOIN teams ht ON m.home_team_id = ht.id
    JOIN teams at ON m.away_team_id = at.id
    WHERE m.completed = 1
      AND m.home_score IS NOT NULL
      AND m.away_score IS NOT NULL
    ORDER BY
      m.year ASC,
      CASE
        WHEN m.round LIKE 'Rd %'
          THEN CAST(TRIM(REPLACE(m.round, 'Rd', '')) AS INTEGER)
        ELSE 99
      END ASC,
      m.game_num ASC,
      m.id ASC
  `).all();
  for (const m of results || []) {
    calculator.stepMatch(stateA, m);
  }
  for (const m of results || []) {
    calculator.stepMatch(stateB, m);
  }
  const mismatches = [];
  for (const team of Object.keys(stateA.ratings)) {
    const a = stateA.ratings[team];
    const b = stateB.ratings[team];
    if (Math.abs(a - b) > 1e-4) {
      mismatches.push({ team, a, b });
    }
  }
  return jsonResponse({
    ok: mismatches.length === 0,
    mismatchCount: mismatches.length,
    mismatches
  });
}
__name(handleParity, "handleParity");
async function handleUpdateTips(request, env) {
  const body = await request.json();
  const { id, odds_tip, user_tip } = body;
  if (typeof id !== "number") {
    return new Response("Missing id", { status: 400 });
  }
  const stmt = env.DB.prepare(`
    UPDATE matches
    SET odds_tip = ?, user_tip = ?
    WHERE id = ?
  `).bind(odds_tip ?? null, user_tip ?? null, id);
  const result = await stmt.run();
  return new Response(JSON.stringify({
    ok: true,
    changes: result.meta?.changes ?? 0
  }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(handleUpdateTips, "handleUpdateTips");
async function handleGetTeams(db) {
  const params = await getParameters(db);
  const calculator = new ELOCalculator(params);
  const teams = await db.prepare(`
    SELECT id, name, short_name
    FROM teams
    WHERE active = 1
  `).all();
  const ratingsByTeamId = await computeRatingsByTeamId(db, calculator);
  const rows = (teams.results || []).map((t) => ({
    id: t.id,
    name: t.name,
    short_name: t.short_name,
    rating: ratingsByTeamId.get(t.id) ?? params.initialRating ?? 1500
  }));
  rows.sort((a, b) => b.rating - a.rating);
  rows.forEach((r, i) => r.rank = i + 1);
  return jsonResponse(rows);
}
__name(handleGetTeams, "handleGetTeams");
async function handleGetMatches(db, searchParams) {
  const limit = Number(searchParams?.get("limit") ?? 1e4);
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 2e4)) : 1e4;
  const { results } = await db.prepare(`
    SELECT
      m.id,
      m.year,
      m.round,
      m.game_num,
      m.home_score,
      m.away_score,
      m.completed,
      m.odds_tip,
      m.user_tip,
      ht.id as home_team_id,
      ht.name as home_team,
      at.id as away_team_id,
      at.name as away_team
    FROM matches m
    JOIN teams ht ON m.home_team_id = ht.id
    JOIN teams at ON m.away_team_id = at.id
    ORDER BY
      m.year ASC,
      -- puts "Rd 1".."Rd 27" before finals (Qual/Semi/Prelim/GF -> null)
      CASE
        WHEN m.round LIKE 'Rd %' THEN CAST(TRIM(REPLACE(m.round, 'Rd', '')) AS INTEGER)
        ELSE 99
      END ASC,
      m.game_num ASC,
      m.id ASC
    LIMIT ?
  `).bind(safeLimit).all();
  return jsonResponse(results || []);
}
__name(handleGetMatches, "handleGetMatches");
async function handleUpdateScores(db, request) {
  const body = await request.json();
  const updates = Array.isArray(body) ? body : body.updates;
  if (!Array.isArray(updates)) {
    return jsonResponse(
      { error: "Expected an array of updates (or { updates: [...] })" },
      400
    );
  }
  const stmt = db.prepare(`
    UPDATE matches
    SET home_score = ?, away_score = ?, completed = 1
    WHERE id = ?
  `);
  for (const u of updates) {
    if (!u.game_id) continue;
    await stmt.bind(
      u.home_score !== "" ? Number(u.home_score) : null,
      u.away_score !== "" ? Number(u.away_score) : null,
      Number(u.game_id)
    ).run();
  }
  return jsonResponse({ success: true, updated: updates.length });
}
__name(handleUpdateScores, "handleUpdateScores");
async function handleGetPredictions(db) {
  const params = await getParameters(db);
  const calculator = new ELOCalculator(params);
  const ratingsByTeamId = await computeRatingsByTeamId(db, calculator);
  const { results } = await db.prepare(`
    SELECT
      m.id,
      m.year,
      m.round,
      m.game_num,
      ht.id as home_team_id,
      ht.name as home_team,
      at.id as away_team_id,
      at.name as away_team
    FROM matches m
    JOIN teams ht ON m.home_team_id = ht.id
    JOIN teams at ON m.away_team_id = at.id
    WHERE m.completed = 0
    ORDER BY
      m.year ASC,
      CASE
        WHEN m.round LIKE 'Rd %'
          THEN CAST(TRIM(REPLACE(m.round, 'Rd', '')) AS INTEGER)
        ELSE 99
      END ASC,
      m.game_num ASC,
      m.id ASC
  `).all();
  const upcoming = results || [];
  for (const match of upcoming) {
    const homeRating = ratingsByTeamId.get(match.home_team_id) ?? params.initialRating ?? 1500;
    const awayRating = ratingsByTeamId.get(match.away_team_id) ?? params.initialRating ?? 1500;
    const prediction = calculator.predictMatch(homeRating, awayRating);
    match.home_win_probability = prediction.homeWinProbability;
    match.predicted_margin = prediction.predictedMargin;
    match.home_odds = prediction.homeOdds;
    match.predicted_winner = prediction.predictedWinner === "home" ? match.home_team : match.away_team;
  }
  return jsonResponse(upcoming);
}
__name(handleGetPredictions, "handleGetPredictions");
async function handleGetParameters(db) {
  const { results } = await db.prepare("SELECT * FROM parameters ORDER BY name").all();
  return jsonResponse(results || []);
}
__name(handleGetParameters, "handleGetParameters");
async function handleRecalculate(db, request) {
  const newParams = await request.json();
  for (const [key, value] of Object.entries(newParams || {})) {
    const num = Number(value);
    if (Number.isFinite(num)) {
      await db.prepare("UPDATE parameters SET value = ? WHERE name = ?").bind(num, key).run();
    }
  }
  return jsonResponse({ success: true, message: "Parameters updated" });
}
__name(handleRecalculate, "handleRecalculate");
async function computeRatingsByTeamId(db, calculator) {
  const state = calculator.createState();
  const { results } = await db.prepare(`
    SELECT
      m.year,
      m.round,
      m.home_score,
      m.away_score,
      ht.name as home_team,
      at.name as away_team
    FROM matches m
    JOIN teams ht ON m.home_team_id = ht.id
    JOIN teams at ON m.away_team_id = at.id
    WHERE m.completed = 1
      AND m.home_score IS NOT NULL
      AND m.away_score IS NOT NULL
    ORDER BY
      m.year ASC,
      CASE
        WHEN m.round LIKE 'Rd %'
          THEN CAST(TRIM(REPLACE(m.round, 'Rd', '')) AS INTEGER)
        ELSE 99
      END ASC,
      m.game_num ASC,
      m.id ASC
  `).all();
  for (const m of results || []) {
    calculator.stepMatch(state, m);
  }
  const { results: teams } = await db.prepare(`
    SELECT id, name FROM teams
  `).all();
  const map = /* @__PURE__ */ new Map();
  for (const t of teams || []) {
    map.set(t.id, state.ratings[t.name] ?? calculator.initialRating);
  }
  return map;
}
__name(computeRatingsByTeamId, "computeRatingsByTeamId");
async function getParameters(db) {
  const { results } = await db.prepare("SELECT name, value FROM parameters").all();
  const params = {};
  (results || []).forEach((p) => {
    const key = p.name.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    params[key] = p.value;
  });
  if (!Number.isFinite(params.initialRating)) params.initialRating = 1500;
  if (!Number.isFinite(params.kFactor)) params.kFactor = 11;
  if (!Number.isFinite(params.homeAdvantage)) params.homeAdvantage = 45;
  return params;
}
__name(getParameters, "getParameters");
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
__name(jsonResponse, "jsonResponse");
function escapeCsv(value) {
  const s = String(value ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}
__name(escapeCsv, "escapeCsv");
function toCsv(headers, rows) {
  const headerLine = headers.join(",");
  const lines = rows.map((r) => r.map(escapeCsv).join(","));
  return [headerLine, ...lines].join("\n");
}
__name(toCsv, "toCsv");
async function handleExport(db) {
  const { results } = await db.prepare(`
    SELECT *
    FROM matches
    ORDER BY
      m.year ASC,
      CASE
        WHEN m.round LIKE 'Rd %'
          THEN CAST(TRIM(REPLACE(m.round, 'Rd', '')) AS INTEGER)
        ELSE 99
      END ASC,
      m.game_num ASC,
      m.id ASC
  `).all();
  if (!results || results.length === 0) {
    return new Response("No matches found", { status: 404 });
  }
  const headers = Object.keys(results[0]);
  const rows = results.map((r) => headers.map((h) => r[h]));
  const csv = toCsv(headers, rows);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=matches.csv"
    }
  });
}
__name(handleExport, "handleExport");
async function handleDiagnostic(db) {
  const params = await getParameters(db);
  const { results: teamRows } = await db.prepare(`
    SELECT name FROM teams
  `).all();
  const teams = (teamRows || []).map((t) => t.name);
  const engine = createReplayEngine(
    {
      k: params.kFactor,
      homeAdvantage: params.homeAdvantage,
      travelPer1000km: params.travelPer1000km,
      restPerRound: params.restPerRound,
      streakPts: params.streakPts,
      earlyBoost: params.earlyBoost,
      reversionWeight: params.reversionWeight,
      initialRating: params.initialRating
    },
    teams
  );
  const { results } = await db.prepare(`
    SELECT
      m.year,
      m.round,
      m.game_num,
      m.id,
      m.home_score,
      m.away_score,
      ht.name as home_team,
      at.name as away_team
    FROM matches m
    JOIN teams ht ON m.home_team_id = ht.id
    JOIN teams at ON m.away_team_id = at.id
    WHERE m.completed = 1
      AND m.home_score IS NOT NULL
      AND m.away_score IS NOT NULL
    ORDER BY
      m.year ASC,
      CASE
        WHEN m.round LIKE 'Rd %'
          THEN CAST(TRIM(REPLACE(m.round, 'Rd', '')) AS INTEGER)
        ELSE 99
      END ASC,
      m.game_num ASC,
      m.id ASC
  `).all();
  const replay = engine.replayMatches(results || [], { applyByes: true });
  const headers = [
    "year",
    "round",
    "game_num",
    "match_id",
    "home_team",
    "away_team",
    "home_elo_before",
    "away_elo_before",
    "round_no",
    "travel_km",
    "travelAdj",
    "rest_diff",
    "restAdj",
    "streak_diff",
    "streakAdj",
    "dr",
    "win_expectancy",
    "predicted_margin",
    "predicted_win_prob",
    "home_score",
    "away_score",
    "actual_result",
    "actual_margin",
    "rawBucket",
    "idx",
    "term1",
    "term2",
    "marginAdj",
    "early",
    "baseK",
    "finalK",
    "delta",
    "home_elo_after",
    "away_elo_after",
    "ladder_locked_before",
    "ladder_locked_after",
    "season_reset",
    "bye_applied_this_match",
    "home_pts_after",
    "away_pts_after",
    "home_margin_after",
    "away_margin_after",
    "home_rank_after",
    "away_rank_after"
  ];
  const rows = replay.rows.map((r) => {
    const m = r.match;
    const out = r.out;
    return [
      m.year,
      m.round,
      m.game_num,
      m.id,
      m.home_team,
      m.away_team,
      out.homeEloBefore,
      out.awayEloBefore,
      out.roundNo,
      out.kmAway,
      out.travelAdj,
      out.homeRest - out.awayRest,
      out.restAdj,
      out.homeStreak - out.awayStreak,
      out.streakAdj,
      out.dr,
      out.expected,
      out.predictedMargin,
      out.predictedWinProb,
      m.home_score,
      m.away_score,
      out.actualResult,
      out.margin,
      out.rawBucket,
      out.idx,
      out.term1,
      out.term2,
      out.marginAdj,
      out.early,
      out.baseK,
      out.finalK,
      out.delta,
      out.newHomeElo,
      out.newAwayElo,
      r.events.ladderLockedBefore,
      r.events.ladderLockedAfter,
      r.events.seasonReset,
      r.events.byeApplied,
      r.homeLadderAfter?.compPoints ?? "",
      r.awayLadderAfter?.compPoints ?? "",
      r.homeLadderAfter?.margin ?? "",
      r.awayLadderAfter?.margin ?? "",
      r.homeRankAfter ?? "",
      r.awayRankAfter ?? ""
    ];
  });
  const csv = engine.diagnosticFormulaBlock() + toCsv(headers, rows);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=diagnostic.csv"
    }
  });
}
__name(handleDiagnostic, "handleDiagnostic");
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
