export function isNumber(value) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
}

export function noVig(home, away) {
  const homeValue = Number(home), awayValue = Number(away);
  return homeValue > 1 && awayValue > 1 ? (1 / homeValue) / ((1 / homeValue) + (1 / awayValue)) : null;
}

export function marketSignalsForRow(row, modelProbability = row.candidateP) {
  const home = row.liveOdds ? row.liveHome : row.closeHome;
  const away = row.liveOdds ? row.liveAway : row.closeAway;
  const current = noVig(home, away);
  const opening = noVig(row.openHome, row.openAway);
  const model = isNumber(modelProbability) ? Number(modelProbability) : null;
  if (current == null || model == null) return { home, away, current, opening, flip: false, adverseMove: false };
  const modelHome = model >= 0.5, marketHome = current > 0.5;
  const modelConfidence = Math.abs(model - 0.5), marketConfidence = Math.abs(current - 0.5);
  const confidenceGap = marketConfidence - modelConfidence;
  const flip = modelHome !== marketHome && confidenceGap >= 0.10 - 1e-9;
  const comparableMove = row.liveOdds || row.explicitClose || row.closeSource === "explicit_single_book_close";
  const movement = opening == null ? null : current - opening;
  const adverse = modelHome ? -(movement ?? 0) : (movement ?? 0);
  const adverseMove = Boolean(comparableMove && movement != null && adverse >= 0.10 - 1e-9);
  return { home, away, current, opening, model, modelHome, marketHome, modelConfidence, marketConfidence, confidenceGap, flip, movement, adverseMove };
}

export function policyMarketSignalsForRow(row, competition = "NRL", modelProbability = row.candidateP) {
  const base = marketSignalsForRow(row, modelProbability);
  const rawFlip = base.flip;
  const protectedBy = [];
  const flagOnly = competition === "NRLW" && rawFlip;
  if (row.lineupGate) protectedBy.push("Lineup Adjustment");
  if (row.playerAlert) protectedBy.push(row.playerConsensus ? "Player Consensus" : "Player Alert");
  return {
    ...base,
    rawFlip,
    flagOnly,
    flip: rawFlip && !protectedBy.length && !flagOnly,
    greyFlip: rawFlip && Boolean(protectedBy.length),
    protectedBy,
    adverseMove: Boolean(base.adverseMove && base.modelHome !== base.marketHome),
  };
}

export function finalTipRecommendation(row, competition = "NRL") {
  if (!isNumber(row.candidateP)) return { baseTip: null, recommendedTip: null, actionable: false, reason: "Forecast unavailable" };
  const baseTip = Number(row.candidateP) >= 0.5 ? row.home : row.away;
  if (competition !== "NRLW" && row.playerAlert && isNumber(row.o10P)) {
    const playerTip = Number(row.o10P) >= 0.5 ? row.home : row.away;
    if (playerTip !== baseTip) {
      return { baseTip, recommendedTip: playerTip, actionable: true,
        reason: row.playerConsensus ? "Player Consensus" : "Player Alert" };
    }
  }
  const market = policyMarketSignalsForRow(row, competition);
  if (market.flip) {
    return { baseTip, recommendedTip: market.marketHome ? row.home : row.away, actionable: true,
      reason: "Market Swap", market };
  }
  return { baseTip, recommendedTip: baseTip, actionable: false,
    reason: market.rawFlip ? (market.flagOnly ? "Review flag only" : `Protected by ${market.protectedBy.join(" + ")}`) : "No active change", market };
}
