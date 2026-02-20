import { ELOCalculator } from "./elo-calculator.js";
const API_URL = "https://nrl-elo-api.d2-rein.workers.dev";

const MODEL_PARAMS = Object.freeze({
  k: 8.875,
  homeAdvantage: 45,
  travelPer1000km: 0,
  restPerRound: 2,
  streakPts: 0,
  earlyBoost: 0.8,
  reversionWeight: 3.3
});

let teams = [];

 /*   ======== LADDER HELPERS (NEW) ================ */

function initLadderSeeded(teams, previousOrder = null) {
  const ladder = {};
  teams.forEach((t, i) => {
    const idx = previousOrder
        ? previousOrder.indexOf(t.name)
        : -1;

        const seed = idx === -1
        ? 0               // brand new teams start neutral
        : (previousOrder.length - idx) / 1_000_000;


    ladder[t.name] = {
        compPoints: 0,
        seed: seed,
        for: 0,
        against: 0,
        margin: 0
        };

  });
  return ladder;
}


function rankLadder(ladder) {
  return Object.entries(ladder)
    .map(([team, s]) => ({
      team,
      rankingScore:
        s.compPoints +
        s.margin / 10000 +
        s.seed,
      compPoints: s.compPoints,
      for: s.for,
      against: s.against,
      margin: s.margin
    }))
    .sort((a, b) => b.rankingScore - a.rankingScore);
}


function isFinalsRound(round) {
  const s = (round || "").toLowerCase();
  return ["prelim", "preliminary", "qual", "qualifying", "semi", "gf", "grand final"]
    .some(k => s.startsWith(k));
}

function isNewSeason(prevYear, currentYear) {
  return prevYear !== null && prevYear !== currentYear;
}

async function populateRankingsSelectors() {
  const res = await fetch(`${API_URL}/api/matches`);
  const matches = await res.json();

  const years = [...new Set(matches.map(m => m.year))].sort();
  const yearSelect = document.getElementById("rankings-year");

  yearSelect.innerHTML = years
    .map(y => `<option value="${y}">${y}</option>`)
    .join("");

  yearSelect.value = years[years.length - 1]; // default to latest year

  updateRoundDropdown(matches);
}

function updateRoundDropdown(matches) {
  const selectedYear = document.getElementById("rankings-year").value;
  const roundSelect = document.getElementById("rankings-round");

  const rounds = matches
    .filter(m => String(m.year) === String(selectedYear))
    .map(m => m.round);

  const uniqueRounds = [...new Set(rounds)]
    .sort((a, b) => extractRoundNumber(a) - extractRoundNumber(b));

  roundSelect.innerHTML = uniqueRounds
    .map(r => `<option value="${r}">${r}</option>`)
    .join("");

  roundSelect.value = uniqueRounds[uniqueRounds.length - 1]; // latest round
}

    // === SINGLE SHARED FRONTEND REPLAY ENGINE ===
    function makeReplayEngine(params) {
    const eloCalc = new ELOCalculator({
      kFactor: params.k,
      homeAdvantage: params.homeAdvantage,
      initialRating: 1500,
      travelPer1000km: params.travelPer1000km,
      restPerRound: params.restPerRound,
      streakPts: params.streakPts,
      earlyBoost: params.earlyBoost,
      reversionWeight: params.reversionWeight
    });

    let ladderLocked = false;

    // Initialise empty ladder structure
    function makeEmptyLadder() {
        const ladder = {};
        teams.forEach(t => {
        ladder[t.name] = {
            points: 0,
            for: 0,
            against: 0,
            margin: 0
        };
        });
        return ladder;
    }

   return {
    eloCalc,
    makeEmptyLadder,

    step: (elo, ladder, match, lastYear) => {
        // Lock ladder once we hit actual finals
        if (!match.round.startsWith("Rd") &&
            !match.round.toLowerCase().startsWith("qual")) {
        ladderLocked = true;
        }

      // ---- Handle new season reset (with seeding) ----
      if (isNewSeason(lastYear, match.year)) {
        const previousOrder = rankLadder(ladder).map(r => r.team);
        ladder = initLadderSeeded(teams, previousOrder);
        ladderLocked = false; 
      }

      // Apply season reversion once, here
      lastYear = eloCalc.applySeasonReversion(
        elo,
        lastYear,
        match.year,
        eloCalc.reversionWeight
      );

      

      const home = match.home_team;
      const away = match.away_team;

      const eloHomeBefore = elo[home] ?? eloCalc.initialRating;
      const eloAwayBefore = elo[away] ?? eloCalc.initialRating;

      const travelAdj = (match.travel_km ?? 0) / 1000 * eloCalc.travelPer1000km;
      const restAdj = (match.rest_diff ?? 0) * eloCalc.restPerRound;
      const streakAdj = (match.streak_diff ?? 0) * eloCalc.streakPts;

      const dr = eloCalc.getRatingDifference(
        eloHomeBefore,
        eloAwayBefore,
        travelAdj,
        restAdj,
        streakAdj
      );

      const we = eloCalc.calculateWinExpectancy(dr);

      // “Spreadsheet-style” display predictions (these are already in the class)
      const homeWinProb = eloCalc.calculateWinExpectancy(dr);
      const predictedMargin = Math.abs(eloCalc.predictMargin(dr));

      // If no score yet, don’t update ratings
      if (match.home_score == null || match.away_score == null) {
        return { elo, ladder, lastYear, dr, we, homeWinProb, predictedMargin, eloHomeBefore, eloAwayBefore };
      }

      const homeScore = match.home_score;
      const awayScore = match.away_score;      
      const margin = match.home_score - match.away_score;
      const result = match.home_score > match.away_score ? 1 : 0;
      const roundNo = eloCalc.extractRoundNumber(match.round);

      // Canonical rating updates (your spreadsheet K logic is inside calculateNewRating)
      elo[home] = eloCalc.calculateNewRating(eloHomeBefore, result, we, margin, roundNo);
      elo[away] = eloCalc.calculateNewRating(eloAwayBefore, 1 - result, 1 - we, -margin, roundNo);

      

      // === UPDATE OFFICIAL LADDER ===
      if (!ladderLocked) {

        ladder[home].for += homeScore;
        ladder[home].against += awayScore;
        ladder[home].margin = ladder[home].for - ladder[home].against;

        ladder[away].for += awayScore;
        ladder[away].against += homeScore;
        ladder[away].margin = ladder[away].for - ladder[away].against;

        // Base competition points
        if (homeScore > awayScore) {
        ladder[home].compPoints += 2;
        } else if (awayScore > homeScore) {
        ladder[away].compPoints += 2;
        } else {
        ladder[home].compPoints += 1;
        ladder[away].compPoints += 1;
        }

    }

    return { elo, ladder, lastYear, dr, we, homeWinProb, predictedMargin };    }
    };
}


// ========== NEW: BYE HANDLING ========================
function applyByesForRound(ladder, roundMatches) {
  const played = new Set();

  roundMatches.forEach(m => {
    played.add(m.home_team);
    played.add(m.away_team);
  });

  teams.forEach(t => {
    if (!played.has(t.name)) {
      ladder[t.name].compPoints += 2; // bye = 2 points
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
    loadTeams();
    loadAllGames();
});

document.addEventListener('change', async (e) => {
  if (e.target.id === "rankings-year") {
    const res = await fetch(`${API_URL}/api/matches`);
    const matches = await res.json();
    updateRoundDropdown(matches);
    loadRankings();
  }

  if (e.target.id === "rankings-round") {
    loadRankings();
  }
});


function showTab(tab, btn) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));

  document.getElementById(tab).classList.add('active');
  if (btn) btn.classList.add('active');

  if (tab === 'rankings') {populateRankingsSelectors().then(loadRankings);};
  if (tab === 'season') { populateSeasonYearSelector(); };
  if (tab === 'games') loadAllGames();
  if (tab === 'elo-history') loadEloHistory();
  if (tab === 'settings') evaluateModel();

}


/* ======================================================
   ======== RANKINGS TAB (UPDATED) ======================
   ====================================================== */

async function loadRankings() {
  try {
    const res = await fetch(`${API_URL}/api/matches`);
    const matches = await res.json();

    matches.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return extractRoundNumber(a.round) - extractRoundNumber(b.round);
    });

    let elo = {};
    let ladder = initLadderSeeded(teams);
    let lastYear = null;
    const engine = makeReplayEngine(MODEL_PARAMS);

    const selectedYear = document.getElementById("rankings-year")?.value;
    const selectedRound = document.getElementById("rankings-round")?.value?.trim();

    for (const m of matches) {
      if (m.home_score != null && m.away_score != null) {
        ({ elo, ladder, lastYear } = engine.step(elo, ladder, m, lastYear));
      }
      // Stop after selected year/round (if provided)
    if (selectedYear && selectedRound &&
        String(m.year) === String(selectedYear) &&
        String(m.round).toLowerCase() === selectedRound.toLowerCase()) {
        break;}
    }

    const ladderTable = rankLadder(ladder);

    const POINTS_DECIMALS = 6; // change to 0 later

    const html = `
    <table class="rankings-table">
        <thead>
            <tr>
                <th class="col-rank">Rank</th>
                <th class="col-team">Team</th>
                <th class="col-elo">ELO</th>
                <th class="col-points">Points</th>
                <th class="col-for">For</th>
                <th class="col-against">Against</th>
                <th class="col-margin">Margin</th>
            </tr>
            </thead>

        <tbody>
        ${ladderTable.map((r, i) => `
          <tr>
            <td class="col-rank">${i + 1}</td>
            <td class="col-team">${r.team}</td>
            <td class="col-elo">${Math.round(elo[r.team] || 1500)}</td>
            <td class="col-points">${r.compPoints}</td>
            <td class="col-for">${r.for}</td>
            <td class="col-against">${r.against}</td>
            <td class="col-margin">${r.margin}</td>
            </tr>
        `).join("")}
        </tbody>
      </table>
    `;

    document.getElementById("rankings-table").innerHTML = html;

  } catch (e) {
    console.error(e);
    document.getElementById("rankings-table").innerHTML =
      "<p>Error loading rankings</p>";
  }
}

async function loadTeams() {
    try {
        const res = await fetch(`${API_URL}/api/teams`);
        const data = await res.json();
        teams = data;
    } catch (e) {
        console.error('Error loading teams:', e);
    }
}


async function loadPredictions() {
    try {
        const res = await fetch(`${API_URL}/api/predictions`);
        const data = await res.json();
        
        if (data.length === 0) {
            document.getElementById('predictions-list').innerHTML = '<p>No upcoming matches</p>';
            return;
        }
        
        const html = data.map(p => `
            <div class="card" style="border-left: 4px solid #1a1a2e;">
                <div style="margin-bottom: 10px;">
                    <strong>${p.round}</strong> (Game ${p.game_num})
                </div>
                <div style="font-size: 18px; margin-bottom: 10px;">
                    ${p.home_team} vs ${p.away_team}
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                    <div><small>Win Prob</small><br><strong>${(p.home_win_probability * 100).toFixed(1)}%</strong></div>
                    <div><small>Margin</small><br><strong>${Math.abs(p.predicted_margin)} pts</strong></div>
                    <div><small>Odds</small><br><strong>$${p.home_odds}</strong></div>
                </div>
                <div style="margin-top: 10px; color: #2e7d32;">
                    Predicted: <strong>${p.predicted_winner}</strong>
                </div>
            </div>
        `).join('');
        
        document.getElementById('predictions-list').innerHTML = html;
    } catch (e) {
        document.getElementById('predictions-list').innerHTML = '<p>Error loading predictions</p>';
    }
}

async function loadRoundForEntry() {
  const year = document.getElementById("round-year").value;
  const round = document.getElementById("round-name").value.trim();

  if (!year || !round) {
    document.getElementById("add-message").innerHTML =
      '<div class="message error">Please enter both year and round.</div>';
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/matches`);
    const matches = await res.json();

    // Filter to this round + year
    const roundGames = matches.filter(m =>
      String(m.year) === String(year) &&
      String(m.round).toLowerCase() === round.toLowerCase()
    );

    if (roundGames.length === 0) {
      document.getElementById("round-entry-table").innerHTML =
        `<p>No games found for ${round} (${year}).</p>`;
      document.getElementById("save-round-btn").disabled = true;
      return;
    }

    // ---- Make a tiny replay engine just for predictions ----
    const engine = makeReplayEngine(MODEL_PARAMS);

    // Replay ELO up to (but NOT including) this round so we get correct pre-game ELO
    matches.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return extractRoundNumber(a.round) - extractRoundNumber(b.round);
    });

    let elo = {};
    let ladder = initLadderSeeded(teams);
    teams.forEach(t => elo[t.name] = 1500);
    let lastYear = null;

    for (const m of matches) {
    // Stop replay BEFORE the selected round
    if (String(m.year) === String(year) &&
        String(m.round).toLowerCase() === round.toLowerCase()) {
        break;
    }
    ({ elo, ladder, lastYear } = engine.step(elo, ladder, m, lastYear));
    }


    // Build table
    let rows = roundGames.map(m => {
        const eloHomeBefore = elo[m.home_team] ?? 1500;
        const eloAwayBefore = elo[m.away_team] ?? 1500;
        const travelAdj = (m.travel_km ?? 0) / 1000 * engine.eloCalc.travelPer1000km;
        const restAdj = (m.rest_diff ?? 0) * engine.eloCalc.restPerRound;
        const streakAdj = (m.streak_diff ?? 0) * engine.eloCalc.streakPts;

        const dr = engine.eloCalc.getRatingDifference(
          eloHomeBefore,
          eloAwayBefore,
          travelAdj,
          restAdj,
          streakAdj
        );
        const winPct = (engine.eloCalc.calculateWinExpectancy(dr) * 100).toFixed(1);
        const predMargin = Math.abs(engine.eloCalc.predictMargin(dr)).toFixed(1);

      return `
        <tr data-game-id="${m.id}">
        <td class="col-game">${m.game_num ?? ""}</td>
        <td class="col-team">${m.home_team}</td>
        <td class="col-team">${m.away_team}</td>
        <td class="col-med">${winPct}%</td>
        <td class="col-med">${predMargin}</td>
        <td class="col-score">
            <input type="number" class="home-score-input"
                    value="${m.home_score ?? ""}" min="0">
        </td>
        <td class="col-score">
            <input type="number" class="away-score-input"
                    value="${m.away_score ?? ""}" min="0">
        </td>
        </tr>
        `;
    }).join("");

        const tableHtml = `
        <table class="round-entry">
            <colgroup>
            <col class="col-game">
            <col class="col-team">
            <col class="col-team">
            <col class="col-med">
            <col class="col-med">
            <col class="col-score">
            <col class="col-score">
            </colgroup>

            <thead>
            <tr>
                <th>Game #</th>
                <th>Home</th>
                <th>Away</th>
                <th>Pred Win %</th>
                <th>Pred Margin</th>
                <th>Home Score</th>
                <th>Away Score</th>
            </tr>
            </thead>

            <tbody>
            ${rows}
            </tbody>
        </table>
        `;

    document.getElementById("round-entry-table").innerHTML = tableHtml;
    document.getElementById("save-round-btn").disabled = false;

  } catch (e) {
    console.error(e);
    document.getElementById("add-message").innerHTML =
      '<div class="message error">Failed to load round.</div>';
  }
}

function changeRound(delta) {
  const input = document.getElementById("round-name");
  let current = input.value.trim();

  const match = current.match(/Rd\s*(\d+)/i);
  let num = match ? parseInt(match[1], 10) : 1;

  num = Math.max(1, num + delta); // never go below 1
  input.value = `Rd ${num}`;
}


async function saveRoundResults() {
  const table = document.querySelector("#round-entry-table table");
  if (!table) return;

  const rows = Array.from(table.querySelectorAll("tbody tr"));

  const updates = rows.map(row => {
    return {
      game_id: row.dataset.gameId,
      home_score: row.querySelector(".home-score-input").value || null,
      away_score: row.querySelector(".away-score-input").value || null
    };
  });

  try {
    const res = await fetch(`${API_URL}/api/matches/bulk-update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates })
    });

    if (!res.ok) throw new Error("Failed to save scores");

    document.getElementById("add-message").innerHTML =
      '<div class="message success">Scores saved successfully.</div>';

    // Refresh the All Games table so you see the changes immediately
    await loadAllGames();

  } catch (e) {
    console.error(e);
    document.getElementById("add-message").innerHTML =
      '<div class="message error">Failed to save scores.</div>';
  }
}


async function updateSettingsAndEvaluate(e) {
    e.preventDefault();

    const params = {
        k_factor: parseFloat(document.getElementById('k-factor').value),
        home_advantage: parseFloat(document.getElementById('home-adv').value),
        margin_coef: parseFloat(document.getElementById('margin-coef').value),
        early_boost: parseFloat(document.getElementById('early-boost').value)
    };

    try {
        const res = await fetch(`${API_URL}/api/calculate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });

        if (!res.ok) throw new Error("Failed to update parameters");

        document.getElementById('settings-message').innerHTML =
            '<div class="message success">Recalculated — updating evaluation…</div>';

        await evaluateModel(); // <-- NEW PART

    } catch (e) {
        document.getElementById('settings-message').innerHTML =
            '<div class="message error">Error updating settings</div>';
        console.error(e);
    }
}


// --------- Helper to sort rounds correctly (regular season + finals) ---------
function extractRoundNumber(roundStr) {
    if (!roundStr) return 999;

    const s = roundStr.trim();

    // Regular season: "Rd 1" -> 1, "Rd 27" -> 27
    const rdMatch = s.match(/Rd\s*(\d+)/i);
    if (rdMatch) return parseInt(rdMatch[1], 10);

    // Finals ordering (correct chronological order)
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

    return key ? finalsMap[key] : 999; // unknown rounds go last
}

async function evaluateModel() {
  try {
    const res = await fetch(`${API_URL}/api/matches`);
    const matches = await res.json();

    // --- Sort chronologically ---
    matches.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      const ra = extractRoundNumber(a.round);
      const rb = extractRoundNumber(b.round);
      if (ra !== rb) return ra - rb;
      return (a.game_num || 0) - (b.game_num || 0);
    });

    // --- Replay setup ---
    let elo = {};
    let ladder = initLadderSeeded(teams);
    teams.forEach(t => elo[t.name] = 1500);
    let lastYear = null;

    const engine = makeReplayEngine(MODEL_PARAMS);

    const latestYear = Math.max(...matches.map(m => m.year));
    const last3Cutoff = latestYear - 2;

    // ---- METRICS ----
    let overall = { games: 0, elo: 0, ladder: 0, odds: 0 };
    let last3 = { games: 0, elo: 0, ladder: 0, odds: 0 };

    let yearly = {};  // { year: {games, elo, ladder, odds} }

    let brierSum = 0;
    let brierCount = 0;

    let bins = Array(10).fill(0).map(() => ({ games: 0, wins: 0 }));

    // ---- LOOP ----
    for (const m of matches) {

      if (m.home_score == null || m.away_score == null) continue;

      const home = m.home_team;
      const away = m.away_team;
      const year = m.year;

      if (!yearly[year]) {
        yearly[year] = { games: 0, elo: 0, ladder: 0, odds: 0 };
      }

      const eloHomeBefore = elo[home] ?? 1500;
      const eloAwayBefore = elo[away] ?? 1500;

      const travelAdj = (m.travel_km ?? 0) / 1000 * engine.eloCalc.travelPer1000km;
      const restAdj = (m.rest_diff ?? 0) * engine.eloCalc.restPerRound;
      const streakAdj = (m.streak_diff ?? 0) * engine.eloCalc.streakPts;

      const dr = engine.eloCalc.getRatingDifference(
        eloHomeBefore,
        eloAwayBefore,
        travelAdj,
        restAdj,
        streakAdj
      );

      const homeWinProb = engine.eloCalc.calculateWinExpectancy(dr);

      const eloPick = homeWinProb >= 0.5 ? home : away;
      const actualWinner = m.home_score > m.away_score ? home : away;

      // --- overall ---
      overall.games++;
      yearly[year].games++;

      if (year >= last3Cutoff) last3.games++;

      if (eloPick === actualWinner) {
        overall.elo++;
        yearly[year].elo++;
        if (year >= last3Cutoff) last3.elo++;
      }

      // --- ladder pick ---
      const ladderTable = rankLadder(ladder);
      const rankHome = 1 + ladderTable.findIndex(r => r.team === home);
      const rankAway = 1 + ladderTable.findIndex(r => r.team === away);
      const ladderPick = rankHome < rankAway ? home : away;

      if (ladderPick === actualWinner) {
        overall.ladder++;
        yearly[year].ladder++;
        if (year >= last3Cutoff) last3.ladder++;
      }

      // --- odds pick (same as elo for now) ---
      const oddsPick = eloPick;
      if (oddsPick === actualWinner) {
        overall.odds++;
        yearly[year].odds++;
        if (year >= last3Cutoff) last3.odds++;
      }

      // --- Proper Brier ---
      const actual = actualWinner === home ? 1 : 0;
      brierSum += Math.pow(homeWinProb - actual, 2);
      brierCount++;

      // --- Calibration bins ---
      let p = Math.min(0.999, Math.max(0.001, homeWinProb));
      let bin = Math.floor(p * 10);
      bins[bin].games++;
      if (actual === 1) bins[bin].wins++;

      // --- Update ratings ---
      ({ elo, ladder, lastYear } = engine.step(elo, ladder, m, lastYear));
    }

    const overallAcc = (100 * overall.elo / overall.games).toFixed(1);
    const last3Acc = last3.games > 0
      ? (100 * last3.elo / last3.games).toFixed(1)
      : "—";

    const brier = (brierSum / brierCount).toFixed(4);

    // ---- UI OUTPUT ----

    document.getElementById('metric-elo-accuracy').innerText =
      `${overallAcc}% (Overall)`;

    document.getElementById('metric-ladder-accuracy').innerText =
      `${(100 * overall.ladder / overall.games).toFixed(1)}%`;

    document.getElementById('metric-odds-accuracy').innerText =
      `${(100 * overall.odds / overall.games).toFixed(1)}%`;

    document.getElementById('metric-brier').innerText = brier;

    // Add last 3 display (create an element in HTML if needed)
    if (document.getElementById('metric-last3')) {
      document.getElementById('metric-last3').innerText =
        `${last3Acc}% (Last 3 yrs)`;
    }

    // ---- Yearly Breakdown Table ----
    const yearsSorted = Object.keys(yearly).sort();

    let yearlyHtml = `
      <table class="yearly-breakdown">
      <thead>
        <tr>
          <th>Year</th>
          <th>Games</th>
          <th>ELO</th>
          <th>Ladder</th>
          <th>Odds</th>
        </tr>
      </thead><tbody>
    `;

    for (const y of yearsSorted) {
      const row = yearly[y];
      yearlyHtml += `
        <tr>
          <td>${y}</td>
          <td>${row.games}</td>
          <td>${row.elo} (${(100 * row.elo / row.games).toFixed(1)}%)</td>
          <td>${row.ladder} (${(100 * row.ladder / row.games).toFixed(1)}%)</td>
          <td>${row.odds} (${(100 * row.odds / row.games).toFixed(1)}%)</td>
        </tr>
      `;
    }

    yearlyHtml += "</tbody></table>";

    if (document.getElementById("yearly-breakdown")) {
      document.getElementById("yearly-breakdown").innerHTML = yearlyHtml;
    }

    drawCalibrationChart(bins);

  } catch (e) {
    console.error("Evaluation failed", e);
  }
}

function drawCalibrationChart(bins) {
    const ctx = document.getElementById('calibration-chart').getContext('2d');

    const labels = bins.map((_, i) => `${i * 10}-${i * 10 + 10}%`);
    const observed = bins.map(b =>
        b.games > 0 ? (100 * b.wins / b.games) : 0
    );

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: "Observed Win %",
                data: observed
            }]
        },
        options: {
            scales: {
                y: { beginAtZero: true, max: 100 }
            }
        }
    });
}

function drawAccuracyByRound(roundBuckets) {
    const ctx = document.getElementById('accuracy-by-round-chart').getContext('2d');

    // Convert to array so we can sort properly
    let rounds = Object.keys(roundBuckets);

    // Custom ordering function using your extractRoundNumber helper
    rounds.sort((a, b) => extractRoundNumber(a) - extractRoundNumber(b));

    const acc = rounds.map(r =>
        100 * roundBuckets[r].correct / roundBuckets[r].games
    );

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: rounds,
            datasets: [{
                label: "ELO Accuracy by Round",
                data: acc
            }]
        },
        options: {
            scales: {
                y: { beginAtZero: true, max: 100 }
            }
        }
    });
}

function drawMarginScatter(actualMargins, predictedMargins) {
    const ctx = document.getElementById('margin-scatter-chart').getContext('2d');

    // Prepare scatter data
    const points = actualMargins.map((a, i) => ({
        x: a,
        y: predictedMargins[i]
    }));

    // Compute simple linear trendline (least squares)
    const n = points.length;
    const sumX = points.reduce((s, p) => s + p.x, 0);
    const sumY = points.reduce((s, p) => s + p.y, 0);
    const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
    const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Define x-range for lines
    const maxMargin = Math.max(...actualMargins, ...predictedMargins, 40);
    const xLine = [0, maxMargin];

    const trendline = xLine.map(x => ({ x, y: slope * x + intercept }));
    const fortyFiveLine = xLine.map(x => ({ x, y: x }));

    new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: "Games",
                    data: points
                },
                {
                    label: "Trendline",
                    data: trendline,
                    type: 'line',
                    fill: false
                },
                {
                    label: "45° Target",
                    data: fortyFiveLine,
                    type: 'line',
                    fill: false
                }
            ]
        },
        options: {
            scales: {
                x: {
                    title: { display: true, text: "Actual Margin" }
                },
                y: {
                    title: { display: true, text: "Predicted Margin" }
                }
            }
        }
    });
}


async function loadAllGames() {
    if (!Array.isArray(teams) || teams.length === 0) {
    await loadTeams(); // ensure teams are loaded
    }

    try {
        const res = await fetch(`${API_URL}/api/matches`);
        const matches = await res.json();

        // Get parameters (K-factor, home adv, etc.)
        const engine = makeReplayEngine(MODEL_PARAMS);

        // Sort matches chronologically before replaying ELO
        matches.sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;

            const ra = extractRoundNumber(a.round);
            const rb = extractRoundNumber(b.round);

            if (ra !== rb) return ra - rb;

            // Within the same round, sort by game number
            return (a.game_num || 0) - (b.game_num || 0);
        });


        // Starting ELO
        let elo = {};
        teams.forEach(t => elo[t.name] = 1500);
        let ladder = initLadderSeeded(teams);
        let lastYear = null;
        let lastProcessedRound = null;
        let rows = "";
        
        for (const m of matches) {
            const home = m.home_team;
            const away = m.away_team;

            const eloHomeBefore = elo[home] ?? 1500;
            const eloAwayBefore = elo[away] ?? 1500;
            
            const travelAdj = (m.travel_km ?? 0) / 1000 * engine.eloCalc.travelPer1000km;
            const restAdj = (m.rest_diff ?? 0) * engine.eloCalc.restPerRound;
            const streakAdj = (m.streak_diff ?? 0) * engine.eloCalc.streakPts;

            const dr = engine.eloCalc.getRatingDifference(
              eloHomeBefore,
              eloAwayBefore,
              travelAdj,
              restAdj,
              streakAdj
            );
            const marginPred = Math.abs(engine.eloCalc.predictMargin(dr)).toFixed(1);
            const oddsPred = (engine.eloCalc.calculateWinExpectancy(dr) * 100).toFixed(1) + "%";

            const ladderTable = rankLadder(ladder);
            
                const rankHome = 1 + ladderTable.findIndex(r => r.team === home);
                const rankAway = 1 + ladderTable.findIndex(r => r.team === away);

            const ladderPick = rankHome < rankAway ? home : away;
            const eloPick = engine.eloCalc.calculateWinExpectancy(dr) >= 0.5 ? home : away;
            const actualWinner = m.home_score > m.away_score ? home : away;

            //LOG ELO
            if (m.year === 2009 && m.round === "Rd 1" && m.home_team === "Cronulla Sharks") {
              console.log("Before Rd1:", eloHomeBefore, eloAwayBefore);
            }

            // ELO update
            ({ elo, ladder, lastYear } = engine.step(elo, ladder, m, lastYear));
            
            //LOG ELO
            if (m.year === 2009 && m.round === "Rd 1" && m.home_team === "Cronulla Sharks") {
              console.log("After Rd1:", elo["Cronulla Sharks"]);
            }

            // Apply byes ONCE per round (regular season only)
            if (m.round !== lastProcessedRound && m.round.startsWith("Rd")) {
            const thisRoundGames = matches.filter(
                x => x.year === m.year && x.round === m.round
            );
            if (!isFinalsRound(m.round)) {
            applyByesForRound(ladder, thisRoundGames);
            lastProcessedRound = m.round;
            }
            }

            // Colour logic
            const colourFor = (pick) => {
                if (pick === actualWinner) return "success";
                if (pick === eloPick) return "warning";
                return "error";
            };

            const isCompleted = (m.home_score != null && m.away_score != null);

            rows += `
                <tr ${isCompleted ? 'class="completed-game"' : ''}>
                <td class="col-narrow">${m.year}</td>
                <td class="col-narrow">${m.round}</td>
                <td class="col-wide">${home}</td>
                <td class="col-wide">${away}</td>
                <td class="col-narrow">${m.home_score}</td>
                <td class="col-narrow">${m.away_score}</td>
                <td class="col-narrow">${marginPred}</td>
                <td class="col-narrow">${oddsPred}</td>
                <td class="col-narrow">${Math.round(eloHomeBefore)}</td>
                <td class="col-narrow">${Math.round(eloAwayBefore)}</td>
                <td class="col-narrow">${rankHome}</td>
                <td class="col-narrow">${rankAway}</td>
                <td class="${colourFor(ladderPick)} col-wide">${ladderPick}</td>
                <td class="editable col-wide">${ladderPick}</td>
                <td class="${colourFor(eloPick)} col-wide">${eloPick}</td>
                <td class="editable col-wide">${eloPick}</td>
                <td class="col-wide">${actualWinner}</td>
            </tr>`;
        }

        const html = `
        <table>
          <thead>
            <tr>
              <th class="col-narrow">Year</th>
              <th class="col-narrow">Round</th>
              <th class="col-wide">Home</th>
              <th class="col-wide">Away</th>
              <th class="col-narrow">Home<br>Score</th>
              <th class="col-narrow">Away<br>Score</th>
              <th class="col-narrow">Pred<br>Margin</th>
              <th class="col-narrow">Home<br>Win %</th>
              <th class="col-narrow">ELO (H)</th>
              <th class="col-narrow">ELO (A)</th>
              <th class="col-narrow">Rank (H)</th>
              <th class="col-narrow">Rank (A)</th>
              <th class="col-wide">Rank</th>
              <th class="col-wide">Odds</th>
              <th class="col-wide">ELO</th>
              <th class="col-wide">Tip</th>
              <th class="col-wide">Actual</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;

        setTimeout(() => {
            const completedGames = document.querySelectorAll(".completed-game");
            if (completedGames.length > 0) {
                const lastCompleted = completedGames[completedGames.length - 1];
                lastCompleted.scrollIntoView({ block: "center" });
            }
        }, 100);

        document.getElementById("games-table").innerHTML = html;
        
    } catch (e) {
        console.error(e);
        document.getElementById("games-table").innerHTML =
            "<p>Error loading games</p>";
    }
}

// ===== MAKE FUNCTIONS AVAILABLE TO HTML INLINE HANDLERS =====
window.showTab = showTab;
window.updateSettingsAndEvaluate = updateSettingsAndEvaluate;
window.loadRoundForEntry = loadRoundForEntry;
window.saveRoundResults = saveRoundResults;
window.changeRound = changeRound;
window.loadAllGames = loadAllGames;
window.loadRankings = loadRankings;
window.loadEloHistory = loadEloHistory;


/* ======================================================
   ======== SEASON MATRIX TAB ===========================
   ====================================================== */

function logoPath(name) {
  return "logos/" +
    name.toLowerCase()
        .replace(/\./g, "")
        .replace(/\s+/g, "-") +
    ".png";
}

async function loadSeasonMatrix() {

  await loadTeams();

  console.log("Teams from API:", teams.map(t => t.name));

  const res = await fetch(`${API_URL}/api/matches`);
  const matches = await res.json();

  const engine = makeReplayEngine(MODEL_PARAMS);

  const selectedYear = Number(document.getElementById("season-year").value);
  const latestYear = Math.max(...matches.map(m => m.year));
  const isCurrentSeason = selectedYear === latestYear;

  // Sort all matches chronologically
  const allSorted = matches.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return extractRoundNumber(a.round) - extractRoundNumber(b.round);
  });

  // ---- Replay prior seasons to build proper ELO ----
  let elo = {};
  teams.forEach(t => elo[t.name] = 1500);

  let ladder = initLadderSeeded(teams);
  let lastYear = null;

  for (const m of allSorted) {
    if (m.year < selectedYear && m.home_score != null && m.away_score != null) {
      ({ elo, ladder, lastYear } = engine.step(elo, ladder, m, lastYear));
    }
  }

  // ---- Isolate selected season ----
  const seasonMatches = allSorted.filter(m => m.year === selectedYear);

  const rounds = [...new Set(seasonMatches.map(m => m.round))]
    .sort((a, b) => extractRoundNumber(a) - extractRoundNumber(b));

  const cumulativePoints = {};
  teams.forEach(t => cumulativePoints[t.name] = 0);

  const roundPoints = {};
  rounds.forEach(r => roundPoints[r] = {});

  let lastCompletedRound = null;

  // ---- Process completed games ----
  for (const m of seasonMatches) {

    if (m.home_score != null && m.away_score != null) {

      lastCompletedRound = m.round;

      ({ elo, ladder, lastYear } = engine.step(elo, ladder, m, lastYear));

      const home = m.home_team;
      const away = m.away_team;

      const homePts =
        m.home_score > m.away_score ? 2 :
        m.home_score < m.away_score ? 0 : 1;

      const awayPts =
        m.away_score > m.home_score ? 2 :
        m.away_score < m.home_score ? 0 : 1;

      cumulativePoints[home] += homePts;
      cumulativePoints[away] += awayPts;

      roundPoints[m.round][home] = {
        pts: cumulativePoints[home],
        type: homePts === 2 ? "win" : homePts === 1 ? "draw" : "loss"
      };

      roundPoints[m.round][away] = {
        pts: cumulativePoints[away],
        type: awayPts === 2 ? "win" : awayPts === 1 ? "draw" : "loss"
      };
    }
  }

  const currentLadder = rankLadder(ladder);
  const currentElo = { ...elo };

  // ---- Projection (Frozen ELO) ----
  if (isCurrentSeason && lastCompletedRound) {

    const frozenElo = { ...elo };

    for (const m of seasonMatches) {

      if (m.home_score != null) continue;

      const home = m.home_team;
      const away = m.away_team;

      const travelAdj = (m.travel_km ?? 0) / 1000 * engine.eloCalc.travelPer1000km;
      const restAdj = (m.rest_diff ?? 0) * engine.eloCalc.restPerRound;
      const streakAdj = (m.streak_diff ?? 0) * engine.eloCalc.streakPts;

      const dr = engine.eloCalc.getRatingDifference(
        frozenElo[home],
        frozenElo[away],
        travelAdj,
        restAdj,
        streakAdj
      );

      const winProb = engine.eloCalc.calculateWinExpectancy(dr);

      const homePred = 2 * winProb;
      const awayPred = 2 * (1 - winProb);

      cumulativePoints[home] += homePred;
      cumulativePoints[away] += awayPred;

      roundPoints[m.round][home] = {
        pts: cumulativePoints[home].toFixed(2),
        type: winProb >= 0.5 ? "pred-win" : "pred-loss"
      };

      roundPoints[m.round][away] = {
        pts: cumulativePoints[away].toFixed(2),
        type: winProb < 0.5 ? "pred-win" : "pred-loss"
      };
    }
  }

  const predictedRanking = rankLadder(ladder);

  const currentRankMap = {};
  currentLadder.forEach((r, i) => currentRankMap[r.team] = i + 1);

  const predictedRankMap = {};
  predictedRanking.forEach((r, i) => predictedRankMap[r.team] = i + 1);

  let html = `<table class="matrix-table"><thead><tr>
    <th class="matrix-team">Team</th>
    <th class="matrix-rank">Curr</th>
    <th class="matrix-rank">Pred</th>
    <th class="matrix-elo">ELO</th>`;

  for (const r of rounds) {
    const divider = (r === lastCompletedRound) ? "current-round-divider" : "";
    html += `<th class="round-col ${divider}">${r}</th>`;
  }

  html += `</tr></thead><tbody>`;

  const displayOrder = isCurrentSeason ? predictedRanking : currentLadder;

  for (const row of displayOrder) {

    const team = row.team;
    const currRank = currentRankMap[team];
    const predRank = predictedRankMap[team];
    const delta = currRank - predRank;

    let arrow = "";
    if (delta > 0) arrow = ` <span class="arrow-up">▲${delta}</span>`;
    if (delta < 0) arrow = ` <span class="arrow-down">▼${Math.abs(delta)}</span>`;

    html += `<tr>
      <td class="matrix-team">
        <img src="${logoPath(team)}"style="height:18px; vertical-align:middle; margin-right:6px;">
        ${team}
      </td>
      <td class="matrix-rank">${currRank}</td>
      <td class="matrix-rank">${predRank}${arrow}</td>
      <td class="matrix-elo">${Math.round(currentElo[team] || 1500)}</td>`;

    for (const r of rounds) {

      const cell = roundPoints[r][team];

      const match = seasonMatches.find(
        x => x.round === r &&
        (x.home_team === team || x.away_team === team)
      );

      let opponentLogo = "";
        if (match) {
        const opponent = match.home_team === team
            ? match.away_team
            : match.home_team;

        opponentLogo = `<img src="${logoPath(opponent)}"
                            style="height:14px;"><br>`;
        }


      if (!cell) {
        html += `<td class="round-col"></td>`;
      } else {
        html += `<td class="round-col ${cell.type}">
          ${opponentLogo}
          ${cell.pts}
        </td>`;
      }
    }

    html += `</tr>`;
  }

  html += `</tbody></table>`;

  document.getElementById("season-matrix-table").innerHTML = html;
}

async function populateSeasonYearSelector() {

  const res = await fetch(`${API_URL}/api/matches`);
  const matches = await res.json();

  const years = [...new Set(matches.map(m => m.year))].sort();
  const select = document.getElementById("season-year");

  select.innerHTML = years
    .map(y => `<option value="${y}">${y}</option>`)
    .join("");

  select.value = Math.max(...years);

  loadSeasonMatrix();
}

document.addEventListener("change", e => {
  if (e.target.id === "season-year") {
    loadSeasonMatrix();
  }
});

/* ======================================================
   ======== ELO HISTORY GRAPH ===========================
   ====================================================== */
function getTeamColor(name) {
  const colors = {
    "Melbourne Storm": "#4B0082",
    "Penrith Panthers": "#000000",
    "Sydney Roosters": "#E4002B",
    "Brisbane Broncos": "#6F263D",
    "Cronulla Sharks": "#0085CA",
    "Canberra Raiders": "#00A651",
    "Manly Sea Eagles": "#800000",
    "Dolphins": "#FF69B4",
    "Canterbury Bulldogs": "#0057B8",
    "New Zealand Warriors": "#0066CC",
    "NQ Cowboys": "#003366",
    "South Sydney Rabbitohs": "#006400",
    "Parramatta Eels": "#003DA5",
    "Newcastle Knights": "#002B5C",
    "St. George Illawarra Dragons": "#CC0000",
    "Wests Tigers": "#F15A22",
    "Gold Coast Titans": "#00B2A9"
  };

  return colors[name] || "#888";
}

async function loadEloHistory() {

  await loadTeams();

  const res = await fetch(`${API_URL}/api/matches`);
  const matches = await res.json();

  const engine = makeReplayEngine(MODEL_PARAMS);

  matches.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return extractRoundNumber(a.round) - extractRoundNumber(b.round);
  });

    const startInput = document.getElementById("elo-start-year");
    const endInput = document.getElementById("elo-end-year");

    if (!startInput.value) startInput.value = 2009;
    if (!endInput.value) endInput.value = 2026;

    const startYear = parseInt(startInput.value);
    const endYear = parseInt(endInput.value);

  let elo = {};
  teams.forEach(t => elo[t.name] = 1500);
  let ladder = initLadderSeeded(teams);
  let lastYear = null;
    const labels = [];
    const teamHistory = {};
    teams.forEach(t => teamHistory[t.name] = []);

    for (const m of matches) {

    if (m.home_score == null || m.away_score == null) continue;

    ({ elo, ladder, lastYear } = engine.step(elo, ladder, m, lastYear));

    if (m.year >= startYear && m.year <= endYear) {

        // Two-line label
        labels.push([m.year, m.round]);

        teams.forEach(t => {
        teamHistory[t.name].push(elo[t.name] ?? 1500);
        });
    }
    }



 // ---- Highlight selector ----
    const highlightSelect = document.getElementById("elo-highlight");

    // Populate dropdown once
    if (highlightSelect && highlightSelect.options.length === 0) {
    highlightSelect.innerHTML =
        '<option value="">None</option>' +
        teams.map(t => `<option value="${t.name}">${t.name}</option>`).join("");
    }

    // Current highlight value
    const highlight = highlightSelect ? highlightSelect.value : "";

    // ---- Build datasets ----
    const datasets = teams.map(t => {
        const isHighlight = highlight && t.name === highlight;

        return {
            label: t.name,
            data: teamHistory[t.name],
            borderWidth: isHighlight ? 3 : 1.5,
            pointRadius: 0,
            tension: 0,
            borderColor: isHighlight
            ? getTeamColor(t.name)
            : getTeamColor(t.name) + "66"   // adds transparency but keeps colour
        };
    });


  const ctx = document.getElementById("elo-history-chart").getContext("2d");

  if (window.eloHistoryChart) {
    window.eloHistoryChart.destroy();
  }

Chart.register(ChartZoom);

window.eloHistoryChart = new Chart(ctx, {
  type: "line",
  data: {
    labels,
    datasets
  },
  options: {
    responsive: true,
    animation: false,
    interaction: { mode: "nearest", intersect: false },

    plugins: {
      zoom: {
        pan: {
          enabled: true,
          mode: "x",
          modifierKey: null
        },
        zoom: {
          wheel: { enabled: true },
          drag: { enabled: false },
          pinch: { enabled: true },
          mode: "x"
        }
      }
    },

    scales: {
      x: {
        type: "category",
        ticks: {
          maxTicksLimit: 30,
          autoSkip: true
        }
      },
      y: {
        title: { display: true, text: "ELO Rating" }
      }
    }
  }
});
}
document.getElementById("elo-highlight")?.addEventListener("change", () => {
  loadEloHistory();
});
