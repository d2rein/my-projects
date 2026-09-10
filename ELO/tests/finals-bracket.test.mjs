import assert from "node:assert/strict";
import test from "node:test";
import { buildFinalsBracket } from "../shared/finals-bracket.js";
import { createReplayEngine } from "../shared/replay-engine.js";

const seeds = ["1", "2", "3", "4", "5", "6", "7", "8"];
const higherSeed = match => Number(match.home_team) < Number(match.away_team)
  ? match.home_team
  : match.away_team;

test("projects the complete NRL top-eight bracket", () => {
  const bracket = buildFinalsBracket({ year: 2026, seeds, pickWinner: higherSeed });
  assert.equal(bracket.length, 9);
  assert.deepEqual(
    bracket.map(match => [match.finals_label, match.home_team, match.away_team]),
    [
      ["Qualifying Final 1", "1", "4"],
      ["Qualifying Final 2", "2", "3"],
      ["Elimination Final 1", "5", "8"],
      ["Elimination Final 2", "6", "7"],
      ["Semi Final 1", "4", "5"],
      ["Semi Final 2", "3", "6"],
      ["Preliminary Final 1", "1", "3"],
      ["Preliminary Final 2", "2", "4"],
      ["Grand Final", "1", "2"],
    ]
  );
  assert.ok(bracket.every(match => match.projected && !match.confirmed));
});

test("actual results replace Elo projections in downstream fixtures", () => {
  const confirmedMatches = [
    { id: 1, year: 2026, round: "Finals Wk 1", game_num: 1, home_team: "1", away_team: "4", home_score: 10, away_score: 20 },
    { id: 2, year: 2026, round: "Finals Wk 1", game_num: 2, home_team: "2", away_team: "3", home_score: 20, away_score: 10 },
    { id: 3, year: 2026, round: "Finals Wk 1", game_num: 3, home_team: "5", away_team: "8", home_score: 10, away_score: 20 },
    { id: 4, year: 2026, round: "Finals Wk 1", game_num: 4, home_team: "6", away_team: "7", home_score: 20, away_score: 10 },
  ];
  const bracket = buildFinalsBracket({ year: 2026, seeds, confirmedMatches, pickWinner: higherSeed });
  assert.deepEqual(
    bracket.slice(4, 6).map(match => [match.home_team, match.away_team]),
    [["1", "8"], ["3", "6"]]
  );
  assert.ok(bracket.slice(0, 4).every(match => match.confirmed && !match.projected));
  assert.ok(bracket.slice(4).every(match => match.projected));
});

test("the ladder locks before every finals format", () => {
  const engine = createReplayEngine({}, seeds);
  const matches = [
    { year: 2026, round: "Rd 1", home_team: "1", away_team: "2", home_score: 20, away_score: 10 },
    { year: 2026, round: "Finals Wk 1", home_team: "2", away_team: "1", home_score: 40, away_score: 0 },
  ];
  const replay = engine.replayMatches(matches, { applyByes: false });
  assert.equal(replay.ladder["1"].compPoints, 2);
  assert.equal(replay.ladder["2"].compPoints, 0);
});
