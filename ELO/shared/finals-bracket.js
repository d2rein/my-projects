// Reusable NRL top-eight finals bracket.
// A fixture is "confirmed" only once it has been written to the matches table.

export const FINALS_ROUNDS = [
  { key: "week1", label: "Finals Wk 1", roundNumber: 28, games: 4 },
  { key: "week2", label: "Finals Wk 2", roundNumber: 29, games: 2 },
  { key: "week3", label: "Finals Wk 3", roundNumber: 30, games: 2 },
  { key: "grandFinal", label: "Grand Final", roundNumber: 31, games: 1 },
];

export function isRegularSeasonRound(round) {
  return /^Rd\s*\d+$/i.test(String(round || "").trim());
}

export function finalsRoundFor(round) {
  const value = String(round || "").trim().toLowerCase();
  return FINALS_ROUNDS.find((item) => item.label.toLowerCase() === value) || null;
}

function resultFor(match, pickWinner) {
  const homeScore = match?.home_score;
  const awayScore = match?.away_score;
  if (homeScore != null && awayScore != null && Number(homeScore) !== Number(awayScore)) {
    return Number(homeScore) > Number(awayScore)
      ? { winner: match.home_team, loser: match.away_team }
      : { winner: match.away_team, loser: match.home_team };
  }

  const winner = pickWinner(match);
  return {
    winner,
    loser: winner === match.home_team ? match.away_team : match.home_team,
  };
}

/**
 * Builds all nine finals fixtures. Stored fixtures win over projections, while
 * unconfirmed downstream teams are advanced using the supplied Elo picker.
 */
export function buildFinalsBracket({ year, seeds, confirmedMatches = [], pickWinner }) {
  if (!Array.isArray(seeds) || seeds.length < 8) return [];
  const choose = typeof pickWinner === "function"
    ? pickWinner
    : (match) => match.home_team;
  const stored = new Map(
    confirmedMatches
      .filter((match) => finalsRoundFor(match.round))
      .map((match) => [`${finalsRoundFor(match.round).key}:${Number(match.game_num)}`, match])
  );
  const fixtures = [];
  const outcomes = new Map();

  function add(roundKey, gameNum, home, away, gameLabel) {
    const round = FINALS_ROUNDS.find((item) => item.key === roundKey);
    const saved = stored.get(`${roundKey}:${gameNum}`);
    const match = saved || {
      id: null,
      year: Number(year),
      round: round.label,
      game_num: gameNum,
      home_team: home,
      away_team: away,
      home_score: null,
      away_score: null,
      completed: 0,
      projected: true,
    };
    match.finals_key = `${roundKey}:${gameNum}`;
    match.finals_label = gameLabel;
    match.confirmed = Boolean(saved);
    match.projected = !saved;
    fixtures.push(match);
    outcomes.set(match.finals_key, resultFor(match, choose));
    return outcomes.get(match.finals_key);
  }

  const qf1 = add("week1", 1, seeds[0], seeds[3], "Qualifying Final 1");
  const qf2 = add("week1", 2, seeds[1], seeds[2], "Qualifying Final 2");
  const ef1 = add("week1", 3, seeds[4], seeds[7], "Elimination Final 1");
  const ef2 = add("week1", 4, seeds[5], seeds[6], "Elimination Final 2");
  const sf1 = add("week2", 1, qf1.loser, ef1.winner, "Semi Final 1");
  const sf2 = add("week2", 2, qf2.loser, ef2.winner, "Semi Final 2");
  const pf1 = add("week3", 1, qf1.winner, sf2.winner, "Preliminary Final 1");
  const pf2 = add("week3", 2, qf2.winner, sf1.winner, "Preliminary Final 2");
  add("grandFinal", 1, pf1.winner, pf2.winner, "Grand Final");

  return fixtures;
}
