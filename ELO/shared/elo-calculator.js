/**
 * NRL ELO Calculator - single source of truth for:
 * - season reversion
 * - travel/rest/streak adjustments
 * - DR, win expectancy, predicted margin
 * - rating updates
 */

const TEAM_BASES = {
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
  "Gold Coast Titans": [-28.0167, 153.4],
};

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0;
  const toRad = (d) => (d * Math.PI) / 180;
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dphi = toRad(lat2 - lat1);
  const dlmb = toRad(lon2 - lon1);

  const a =
    Math.sin(dphi / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dlmb / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export class ELOCalculator {
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
    this.oddsCoef = 0.002;
    this.drWeighting = 400;
  }

  // ----------------------------
  // STATE (single replay engine)
  // ----------------------------
  createState() {
    return {
      ratings: {},                 // teamName -> rating
      lastYear: null,              // last processed year
      lastRoundPlayed: new Map(),  // teamName -> roundNumber
      streak: new Map(),           // teamName -> streak int
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
    return (homeElo + this.homeAdvantage + travelAdj + restAdj + streakAdj) - awayElo;
  }

  predictMargin(dr) {
    return this.marginCoef * dr;
  }

  calculateWinProbability(dr) {
    const prob = 0.5 + (this.oddsCoef * dr);
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

    const key = Object.keys(finalsMap).find(k =>
      s.toLowerCase().startsWith(k.toLowerCase())
    );

    return key ? finalsMap[key] : null;
  }

  // ----------------------------
  // K FACTOR (your bucket + early)
  // ----------------------------
  calculateNewRating(oldRating, actualResult, expectedResult, margin, roundNumber) {
    const rawBucket = Math.ceil(Math.abs(margin) / 6);
    const idx = Math.max(1, Math.min(rawBucket, 4));

    const table = { 1: 0.5, 2: 1.0, 3: 1.5, 4: 1.75 };
    const term1 = table[idx];
    const term2 = Math.max(idx - 3, 0) / 8;
    const marginAdj = (term1 + term2) - 1.0;

    let early = 0;
    if (roundNumber && roundNumber > 0) {
      early = this.earlyBoost * Math.max(0, 11 - roundNumber);
    }

    const baseK = this.kFactor + early;
    const finalK = baseK * (1.0 + marginAdj);

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

    // travel: away -> home
    const kmAway = this.travelKm(away, home);
    const travelAdj = (kmAway / 1000) * this.travelPer1000km;

    // rest: based on last round played THIS SEASON
    let homeRest = 0;
    let awayRest = 0;

    const prevHome = state.lastRoundPlayed.get(home);
    const prevAway = state.lastRoundPlayed.get(away);

    if (roundNo != null) {
      if (prevHome != null) homeRest = Math.max(0, roundNo - prevHome - 1);
      if (prevAway != null) awayRest = Math.max(0, roundNo - prevAway - 1);
    }

    const restAdj = this.restPerRound * (homeRest - awayRest);

    // streak (pre-match)
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
      streakAdj,
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

    // ----------------------------
    // SEASON REVERSION
    // ----------------------------
    if (state.lastYear !== null && year !== state.lastYear) {
      this.applySeasonReversionToRatings(state);
      state.lastRoundPlayed = new Map();
      state.streak = new Map();
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

    // ----------------------------
    // K FACTOR DECOMPOSED
    // ----------------------------

    const rawBucket = Math.ceil(Math.abs(margin) / 6);
    const idx = Math.max(1, Math.min(rawBucket, 4));

    const table = { 1: 0.5, 2: 1.0, 3: 1.5, 4: 1.75 };

    const term1 = table[idx];
    const term2 = Math.max(idx - 3, 0) / 8;

    const marginAdj = (term1 + term2) - 1.0;

    let early = 0;
    if (adj.roundNo && adj.roundNo > 0) {
      early = this.earlyBoost * Math.max(0, 11 - adj.roundNo);
    }

    const baseK = this.kFactor + early;
    const finalK = baseK * (1.0 + marginAdj);

    const delta = finalK * (actualResult - expected);

    const newHomeElo = homeEloBefore + delta;
    const newAwayElo = awayEloBefore - delta;

    this._setRating(state, home, newHomeElo);
    this._setRating(state, away, newAwayElo);

    // ----------------------------
    // STREAK UPDATE
    // ----------------------------
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
}