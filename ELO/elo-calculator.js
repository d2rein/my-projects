/**
 * NRL ELO Calculator - aligned with your spreadsheet logic
 * Defaults: K=11, Home Advantage=45, DR weighting=400
 */

export class ELOCalculator {
  constructor(params = {}) {
    this.kFactor = Number(params.kFactor ?? 8.875);
    this.homeAdvantage = Number(params.homeAdvantage ?? 45);
    this.initialRating = Number(params.initialRating ?? 1500);

    this.travelPer1000km = Number(params.travelPer1000km ?? 0);
    this.restPerRound = Number(params.restPerRound ?? 2);
    this.streakPts = Number(params.streakPts ?? 0);
    this.reversionWeight = Number(params.reversionWeight ?? 3.3);
    this.earlyBoost = Number(params.earlyBoost ?? 0.800);

    this.marginCoef = 0.048406;
    this.oddsCoef = 0.002;
    this.drWeighting = 400;
  }

  /** Expected result: 1 / (10^(-dr/400) + 1) */
  calculateWinExpectancy(ratingDiff) {
    return 1 / (Math.pow(10, -ratingDiff / this.drWeighting) + 1);
  }

  /** Rating difference = (Home + homeAdvantage) - Away */
  getRatingDifference(homeElo, awayElo, travelAdj = 0, restAdj = 0, streakAdj = 0) {
    return (homeElo + this.homeAdvantage + travelAdj + restAdj + streakAdj) - awayElo;
  }

  /**Spreadsheet-style end-of-season reversion to the mean Rd 1 Elo = (1500 + w * endOfSeasonElo) / (w + 1)
   */
  revertToMean(endOfSeasonElo, w) {
  return (this.initialRating + w * endOfSeasonElo) / (w + 1);
}

    applySeasonReversion(elo, lastYear, currentYear, w = 2) {
    if (lastYear !== null && currentYear !== lastYear) {
      for (const team in elo) {
        if (elo[team] !== this.initialRating) {
          elo[team] = this.revertToMean(elo[team], w);
        }
      }
    }
    return currentYear;
  }

calculateNewRating(oldRating, actualResult, expectedResult, margin, roundNumber) {

  // ----- margin bucket -----
  const rawBucket = Math.ceil(Math.abs(margin) / 6);
  const idx = Math.max(1, Math.min(rawBucket, 4));

  const table = {
    1: 0.5,
    2: 1.0,
    3: 1.5,
    4: 1.75
  };

  const term1 = table[idx];
  const term2 = Math.max(idx - 3, 0) / 8;

  const marginAdj = (term1 + term2) - 1.0;

  // ----- early effect (ADDITIVE, like Python) -----
  let early = 0;
  if (roundNumber && roundNumber > 0) {
    early = this.earlyBoost * Math.max(0, 11 - roundNumber);
  }

  const baseK = this.kFactor + early;

  const finalK = baseK * (1.0 + marginAdj);

  return oldRating + finalK * (actualResult - expectedResult);
}

  /** Predicted margin = 0 + marginCoef * dr */
  predictMargin(ratingDiff) {
    return this.marginCoef * ratingDiff;
  }

  /**
   * Spreadsheet-style win probability:
   *   0.5 + oddsCoef * dr, clipped to [0,1]
   */
  calculateWinProbability(ratingDiff) {
    const prob = 0.5 + (this.oddsCoef * ratingDiff);
    return Math.max(0, Math.min(1, prob));
  }

  /**
   * Process a played match and return updated ELOs
   */
  processMatch(match) {
    const {
      homeElo,
      awayElo,
      homeScore,
      awayScore,
      roundNumber
    } = match;

    const dr = this.getRatingDifference(homeElo, awayElo);
    const homeExpectancy = this.calculateWinExpectancy(dr);

    const homeWon = homeScore > awayScore ? 1 : 0;
    const awayWon = awayScore > homeScore ? 1 : 0;
    const margin = homeScore - awayScore;

    const newHomeElo = this.calculateNewRating(
      homeElo,
      homeWon,
      homeExpectancy,
      margin,
      roundNumber
    );

    const newAwayElo = this.calculateNewRating(
      awayElo,
      awayWon,
      1 - homeExpectancy,
      -margin,
      roundNumber
    );

    return {
      homeElo: newHomeElo,
      awayElo: newAwayElo,
      homeExpectancy,
      margin,
      winner: homeWon ? "home" : "away"
    };
  }

  /**
   * Predict an upcoming match
   */
  predictMatch(homeElo, awayElo) {
    const dr = this.getRatingDifference(homeElo, awayElo);
    const homeWinProb = this.calculateWinProbability(dr);
    const predictedMargin = this.predictMargin(dr);

    return {
      ratingDifference: dr,
      homeWinProbability: homeWinProb,
      awayWinProbability: 1 - homeWinProb,
      predictedMargin: Math.round(predictedMargin),
      homeOdds: (1 / homeWinProb).toFixed(2),
      awayOdds: (1 / (1 - homeWinProb)).toFixed(2),
      predictedWinner: predictedMargin > 0 ? "home" : "away"
    };
  }

  /**
   * Convert "Rd 1", "Rd 27", "Qual", "Semi", "Prelim", "GF"
   * into a sortable round number.
   */
  extractRoundNumber(roundStr) {
    if (!roundStr) return null;

    const s = roundStr.trim();

    // Regular season: "Rd 1" -> 1, "Rd 27" -> 27
    const rdMatch = s.match(/Rd\s*(\d+)/i);
    if (rdMatch) return parseInt(rdMatch[1], 10);

    // Finals mapping (adjust numbers if you prefer)
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
}
