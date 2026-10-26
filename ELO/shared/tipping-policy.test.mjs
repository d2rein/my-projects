import test from "node:test";
import assert from "node:assert/strict";
import { finalTipRecommendation, marketSignalsForRow } from "./tipping-policy.js";

test("market swap fires only when the market is ten points more confident", () => {
  const row = { home: "Home", away: "Away", candidateP: 0.55, liveOdds: true, liveHome: 4, liveAway: 1.3 };
  assert.equal(marketSignalsForRow(row).flip, true);
  assert.equal(finalTipRecommendation(row).recommendedTip, "Away");
});

test("player alert takes precedence over a market swap", () => {
  const row = { home: "Home", away: "Away", candidateP: 0.55, o10P: 0.40, playerAlert: true, playerConsensus: true,
    liveOdds: true, liveHome: 1.3, liveAway: 4 };
  const result = finalTipRecommendation(row);
  assert.equal(result.recommendedTip, "Away");
  assert.equal(result.reason, "Player Consensus");
});

test("NRLW market disagreements remain review-only", () => {
  const row = { home: "Home", away: "Away", candidateP: 0.55, liveOdds: true, liveHome: 4, liveAway: 1.3 };
  assert.equal(finalTipRecommendation(row, "NRLW").actionable, false);
});
