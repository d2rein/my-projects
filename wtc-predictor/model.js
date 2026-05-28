(function () {
  const CATEGORY_GROUPS = [
    { key: "dominating", label: "Dominating", rank: 4 },
    { key: "strong", label: "Strong", rank: 3 },
    { key: "favoured", label: "Favoured", rank: 2 },
    { key: "slight", label: "Slight", rank: 1 },
    { key: "even", label: "Even", rank: 0 }
  ];

  const CATEGORY_OPTIONS = [
    { key: "dominating_home", label: "Dominating home", orientation: "home", strength: "dominating", short: "DH" },
    { key: "strong_home", label: "Strong home", orientation: "home", strength: "strong", short: "SH" },
    { key: "favoured_home", label: "Favoured home", orientation: "home", strength: "favoured", short: "FH" },
    { key: "slight_home", label: "Slight home", orientation: "home", strength: "slight", short: "sH" },
    { key: "even", label: "Even", orientation: "even", strength: "even", short: "EV" },
    { key: "slight_away", label: "Slight away", orientation: "away", strength: "slight", short: "sA" },
    { key: "favoured_away", label: "Favoured away", orientation: "away", strength: "favoured", short: "FA" },
    { key: "strong_away", label: "Strong away", orientation: "away", strength: "strong", short: "SA" },
    { key: "dominating_away", label: "Dominating away", orientation: "away", strength: "dominating", short: "DA" }
  ];

  const DISTRIBUTIONS = {
    2: {
      dominating: { homeWin: 0.66, draw: 0.22, awayWin: 0.12 },
      strong: { homeWin: 0.55, draw: 0.25, awayWin: 0.20 },
      favoured: { homeWin: 0.47, draw: 0.28, awayWin: 0.25 },
      slight: { homeWin: 0.41, draw: 0.29, awayWin: 0.30 },
      even: { homeWin: 0.35, draw: 0.30, awayWin: 0.35 }
    },
    3: {
      dominating: { homeWin: 0.67, draw: 0.20, awayWin: 0.13 },
      strong: { homeWin: 0.57, draw: 0.22, awayWin: 0.21 },
      favoured: { homeWin: 0.49, draw: 0.24, awayWin: 0.27 },
      slight: { homeWin: 0.43, draw: 0.25, awayWin: 0.32 },
      even: { homeWin: 0.37, draw: 0.26, awayWin: 0.37 }
    },
    4: {
      dominating: { homeWin: 0.68, draw: 0.18, awayWin: 0.14 },
      strong: { homeWin: 0.58, draw: 0.20, awayWin: 0.22 },
      favoured: { homeWin: 0.50, draw: 0.22, awayWin: 0.28 },
      slight: { homeWin: 0.44, draw: 0.23, awayWin: 0.33 },
      even: { homeWin: 0.385, draw: 0.23, awayWin: 0.385 }
    },
    5: {
      dominating: { homeWin: 0.69, draw: 0.17, awayWin: 0.14 },
      strong: { homeWin: 0.59, draw: 0.19, awayWin: 0.22 },
      favoured: { homeWin: 0.51, draw: 0.21, awayWin: 0.28 },
      slight: { homeWin: 0.45, draw: 0.22, awayWin: 0.33 },
      even: { homeWin: 0.39, draw: 0.22, awayWin: 0.39 }
    }
  };

  const FACTORIAL = [1, 1, 2, 6, 24, 120];

  function getCategoryOption(key) {
    return CATEGORY_OPTIONS.find((item) => item.key === key) || CATEGORY_OPTIONS[4];
  }

  function getPerMatchDistribution(matchCount, categoryKey) {
    const category = getCategoryOption(categoryKey);
    const distributionSet = DISTRIBUTIONS[matchCount] || DISTRIBUTIONS[5];
    const base = distributionSet[category.strength] || distributionSet.even;
    if (category.orientation === "away") {
      return {
        homeWin: base.awayWin,
        draw: base.draw,
        awayWin: base.homeWin
      };
    }
    if (category.orientation === "even") {
      return distributionSet.even;
    }
    return base;
  }

  function getExpectedRecord(matchCount, categoryKey) {
    const dist = getPerMatchDistribution(matchCount, categoryKey);
    return {
      homeWins: dist.homeWin * matchCount,
      draws: dist.draw * matchCount,
      awayWins: dist.awayWin * matchCount
    };
  }

  function getScorelineProbabilities(matchCount, categoryKey) {
    const dist = getPerMatchDistribution(matchCount, categoryKey);
    const rows = [];
    for (let homeWins = 0; homeWins <= matchCount; homeWins += 1) {
      for (let draws = 0; draws <= matchCount - homeWins; draws += 1) {
        const awayWins = matchCount - homeWins - draws;
        const combinations = FACTORIAL[matchCount] / (FACTORIAL[homeWins] * FACTORIAL[draws] * FACTORIAL[awayWins]);
        const probability = combinations
          * (dist.homeWin ** homeWins)
          * (dist.draw ** draws)
          * (dist.awayWin ** awayWins);
        rows.push({
          homeWins,
          draws,
          awayWins,
          probability
        });
      }
    }
    rows.sort((a, b) => {
      if (b.probability !== a.probability) {
        return b.probability - a.probability;
      }
      if (b.homeWins !== a.homeWins) {
        return b.homeWins - a.homeWins;
      }
      if (a.awayWins !== b.awayWins) {
        return a.awayWins - b.awayWins;
      }
      return b.draws - a.draws;
    });
    return rows;
  }

  function getMostLikelyScoreline(matchCount, categoryKey) {
    return getScorelineProbabilities(matchCount, categoryKey)[0];
  }

  function simulateSeries(matchCount, categoryKey, randomFn) {
    const dist = getPerMatchDistribution(matchCount, categoryKey);
    const random = randomFn || Math.random;
    let homeWins = 0;
    let awayWins = 0;
    let draws = 0;

    for (let index = 0; index < matchCount; index += 1) {
      const roll = random();
      if (roll < dist.homeWin) {
        homeWins += 1;
      } else if (roll < dist.homeWin + dist.draw) {
        draws += 1;
      } else {
        awayWins += 1;
      }
    }

    return { homeWins, awayWins, draws };
  }

  window.WTC_MODEL = {
    CATEGORY_GROUPS,
    CATEGORY_OPTIONS,
    DISTRIBUTIONS,
    getCategoryOption,
    getPerMatchDistribution,
    getExpectedRecord,
    getScorelineProbabilities,
    getMostLikelyScoreline,
    simulateSeries
  };
})();
