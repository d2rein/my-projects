import { ELOCalculator } from "./shared/elo-calculator.js";
import { createReplayEngine } from "./shared/replay-engine.js";

const API_URL = "https://nrl-elo-api.d2-rein.workers.dev";

let MODEL_PARAMS = null;

async function loadModelParams() {
  const res = await fetch(`${API_URL}/api/parameters`);
  const rows = await res.json();

  // rows expected: [{name: "...", value: "..."}]
  const map = Object.fromEntries(
    rows.map(r => [r.name, Number(r.value)])
  );

  MODEL_PARAMS = {
    k: map.k_factor,
    homeAdvantage: map.home_advantage,
    travelPer1000km: map.travel_per1000km,
    restPerRound: map.rest_per_round,
    streakPts: map.streak_pts,
    earlyBoost: map.early_boost,
    reversionWeight: map.reversion_weight,
    initialRating: map.initial_rating
  };

  console.log("Loaded model params:", MODEL_PARAMS);
}

let teams = [];

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
// ===== Team name display helper (full / short / code) =====
const TEAM_DISPLAY_MODE = window.matchMedia("(max-width: 768px)").matches ? "code" : "full";
// options: "full", "short", "code"

const TEAM_SHORT = {
  "Brisbane Broncos": "Broncos",
  "Canberra Raiders": "Raiders",
  "Canterbury Bulldogs": "Bulldogs",
  "Cronulla Sharks": "Sharks",
  "Dolphins": "Dolphins",
  "Gold Coast Titans": "Titans",
  "Manly Sea Eagles": "Sea Eagles",
  "Melbourne Storm": "Storm",
  "Newcastle Knights": "Knights",
  "New Zealand Warriors": "Warriors",
  "NQ Cowboys": "Cowboys",
  "Parramatta Eels": "Eels",
  "Penrith Panthers": "Panthers",
  "South Sydney Rabbitohs": "Rabbitohs",
  "St. George Illawarra Dragons": "Dragons",
  "Sydney Roosters": "Roosters",
  "Wests Tigers": "Wests Tigers"
};

const TEAM_CODE = {
  "Brisbane Broncos": "BRI",
  "Canberra Raiders": "CAN",
  "Canterbury Bulldogs": "CBY",
  "Cronulla Sharks": "CRO",
  "Dolphins": "DOL",
  "Gold Coast Titans": "GLD",
  "Manly Sea Eagles": "MAN",
  "Melbourne Storm": "MEL",
  "Newcastle Knights": "NEW",
  "New Zealand Warriors": "NZW",
  "NQ Cowboys": "NQL",
  "Parramatta Eels": "PAR",
  "Penrith Panthers": "PEN",
  "South Sydney Rabbitohs": "SOU",
  "St. George Illawarra Dragons": "SGI",
  "Sydney Roosters": "SYD",
  "Wests Tigers": "WST"
};

function displayTeamName(name) {
  if (!name) return "";
  if (TEAM_DISPLAY_MODE === "short") return TEAM_SHORT[name] || name;
  if (TEAM_DISPLAY_MODE === "code") return TEAM_CODE[name] || name;
  return name; // "full"
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadModelParams();
    await loadTeams();
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

    const selectedYear = document.getElementById("rankings-year")?.value;
    const selectedRound = document.getElementById("rankings-round")?.value;

    matches.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return extractRoundNumber(a.round) - extractRoundNumber(b.round);
    });

    const engine = createReplayEngine(MODEL_PARAMS, teams);

    const replay = engine.replayMatches(matches, {
      applyByes: true,
      stopAt: selectedYear && selectedRound
        ? { year: selectedYear, round: selectedRound }
        : null
    });

    const ladderTable = engine.rankLadder(replay.ladder);

    const html = `
      <table class="rankings-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Team</th>
            <th>ELO</th>
            <th>Points</th>
            <th>For</th>
            <th>Against</th>
            <th>Margin</th>
          </tr>
        </thead>
        <tbody>
          ${ladderTable
            .map(
              (r, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${r.team}</td>
              <td>${Math.round(replay.state.ratings[r.team] ?? 1500)}</td>
              <td>${r.compPoints}</td>
              <td>${r.for}</td>
              <td>${r.against}</td>
              <td>${r.margin}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    `;

    document.getElementById("rankings-table").innerHTML = html;
  } catch (e) {
    console.error(e);
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

    // Replay ELO up to (but NOT including) this round so we get correct pre-game ELO
    matches.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return extractRoundNumber(a.round) - extractRoundNumber(b.round);
    });

    const engine = createReplayEngine(MODEL_PARAMS, teams);

    const replay = engine.replayMatches(matches, {
      applyByes: true,
      stopAt: { year, round }
    });

        // Build table
    let rows = roundGames.map(m => {
        const out = engine.eloCalc.previewMatch(replay.state, m);
        const winPct = (out.expected * 100).toFixed(1);
        const predMargin = Math.abs(out.predictedMargin).toFixed(1);

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
        travel_per1000km: parseFloat(document.getElementById('travel-per-1000km').value),
        rest_per_round: parseFloat(document.getElementById('rest-per-round').value),
        streak_pts: parseFloat(document.getElementById('streak-pts').value),
        reversion_weight: parseFloat(document.getElementById('reversion-weight').value),
        initial_rating: parseFloat(document.getElementById('initial-rating').value),
        early_boost: parseFloat(document.getElementById('early-boost').value)
    };
    

    try {
        const res = await fetch(`${API_URL}/api/calculate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });

        if (!res.ok) throw new Error("Failed to update parameters");

        await loadModelParams();

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
    const engine = createReplayEngine(MODEL_PARAMS, teams);
    const replay = engine.replayMatches(matches, { applyByes: true });

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
    for (const r of replay.rows) {

      const m = r.match;
      const out = r.out;

      if (m.home_score == null || m.away_score == null) continue;

      const home = m.home_team;
      const away = m.away_team;
      const year = m.year;

      if (!yearly[year]) yearly[year] = { games: 0, elo: 0, ladder: 0, odds: 0 };

      const ladderPick = r.homeRankBeforeRound < r.awayRankBeforeRound ? home : away;

      const actualWinner =
        m.home_score > m.away_score ? home : away;

      const homeWinProb = out.expected;
      const eloPick = homeWinProb >= 0.5 ? home : away;

      // --- PRE-MATCH ladder pick ---
//      const ladderTable = rankLadder(ladder);
//      const rankHome = 1 + ladderTable.findIndex(r => r.team === home);
//      const rankAway = 1 + ladderTable.findIndex(r => r.team === away);
//      const ladderPick = rankHome < rankAway ? home : away;

      // --- ACTUAL WINNER ---
//      const actualWinner =
//        m.home_score > m.away_score ? home : away;

      // --- STEP MATCH (updates Elo + ladder) ---
//      const stepRes = engine.step(ladder, m);
//      ladder = stepRes.ladder;
//      const out = stepRes.out;

//      const homeWinProb = out.expected;
//      const eloPick = homeWinProb >= 0.5 ? home : away;

      // --- Score ladder accuracy AFTER actualWinner defined ---
      if (ladderPick === actualWinner) {
        overall.ladder++;
        yearly[year].ladder++;
        if (year >= last3Cutoff) last3.ladder++;
      }
      
      // --- overall ---
      overall.games++;
      yearly[year].games++;

      if (year >= last3Cutoff) last3.games++;

      if (eloPick === actualWinner) {
        overall.elo++;
        yearly[year].elo++;
        if (year >= last3Cutoff) last3.elo++;
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

function renderPip(id, type, selected, eloPick, actualWinner, completed) {

  // DEFAULT behaviour
  const pick = selected ?? eloPick;

  let css = "pip";

  // BEFORE MATCH
  if (!completed) {
    css += (pick === eloPick)
      ? " success"     // green = matches Elo
      : " warning";    // bright yellow = toggled
  }

  // AFTER MATCH
  else {
    if (pick === actualWinner) {
      css += " success";     // correct
    } else if (eloPick === actualWinner) {
      css += " error";       // Elo right, you wrong
    } else {
      css += " warning";     // both wrong
    }
  }

  return `
    <div class="${css}"
         data-id="${id}"
         data-type="${type}">
    </div>
  `;
}

function renderRankPip(ladderPick, eloPick, actualWinner, completed) {

  let cls = "pip neutral";

  if (!completed) {
    // Before match: does ladder agree with Elo?
    cls = ladderPick === eloPick ? "pip success" : "pip error";
  } else {
    // After match:
    if (ladderPick === actualWinner) {
      cls = "pip success";
    } else if (eloPick !== actualWinner) {
      // both wrong
      cls = "pip warning";
    } else {
      // ladder wrong, elo right
      cls = "pip error";
    }
  }

  return `<div class="${cls}"></div>`;
}

async function loadAllGames() {
    if (!Array.isArray(teams) || teams.length === 0) {
    await loadTeams(); // ensure teams are loaded
    }

    try {
        const res = await fetch(`${API_URL}/api/matches`);
        const matches = await res.json();

        // Sort matches chronologically before replaying ELO
        matches.sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;

            const ra = extractRoundNumber(a.round);
            const rb = extractRoundNumber(b.round);

            if (ra !== rb) return ra - rb;

            // Within the same round, sort by game number
            return (a.game_num || 0) - (b.game_num || 0);
        });

        const engine = createReplayEngine(MODEL_PARAMS, teams);
        const replay = engine.replayMatches(matches, { applyByes: true });

        // Starting ELO
        let rows = "";

        let lastRoundKey = null;
        let roundToggle = false;
        
        for (const r of replay.rows) {

            const m = r.match;
            const out = r.out;

            const home = m.home_team;
            const away = m.away_team;

            const dr = out.dr;
            const homeWinProb = out.expected;
            const marginPred = Math.abs(out.predictedMargin);
            const eloHomeBefore = out.homeEloBefore;
            const eloAwayBefore = out.awayEloBefore;

            const oddsPred = (out.predictedWinProb * 100).toFixed(1) + "%";

            const rankHome = r.homeRankBeforeRound;
            const rankAway = r.awayRankBeforeRound;

            const ladderPick = rankHome < rankAway ? home : away;
            const eloPick = homeWinProb >= 0.5 ? home : away;
            const actualWinner = m.home_score > m.away_score ? home : away;

            const roundKey = `${m.year}-${m.round}`;
            let isNewRound = false;

            if (roundKey !== lastRoundKey) {
              roundToggle = !roundToggle;
              lastRoundKey = roundKey;
              isNewRound = true;
            }

            const roundClass =
              (roundToggle ? "round-a" : "round-b") +
              (isNewRound ? " round-start" : "");

            const oddsTip = m.odds_tip ?? eloPick;
            const userTip = m.user_tip ?? eloPick;

            // Colour logic
            const colourFor = (pick) => {
                if (pick === actualWinner) return "success";
                if (pick === eloPick) return "warning";
                return "error";
            };

            const isCompleted = (m.home_score != null && m.away_score != null);

            rows += `
            <tr class="${roundClass} ${isCompleted ? 'completed-game' : ''}">
            <td class="col-narrow">${m.year}</td>
            <td class="col-narrow">${m.round}</td>
            <td class="col-team">${displayTeamName(home)}</td>
            <td class="col-team">${displayTeamName(away)}</td>
            <td class="col-narrow">${m.home_score}</td>
            <td class="col-narrow">${m.away_score}</td>
            <td class="col-narrow">${marginPred}</td>
            <td class="col-narrow">${oddsPred}</td>
            <td class="col-narrow">${Math.round(eloHomeBefore)}</td>
            <td class="col-narrow">${Math.round(eloAwayBefore)}</td>
            <td class="col-narrow">${rankHome}</td>
            <td class="col-narrow">${rankAway}</td>
            <td class="${colourFor(eloPick)} col-pick">${displayTeamName(eloPick)}</td>
            <td class="col-pip tip-cell">
              ${renderRankPip(ladderPick, eloPick, actualWinner, isCompleted)}
            </td>
            <td class="col-pip tip-cell">
              ${renderPip(m.id, "odds", m.odds_tip, eloPick, actualWinner, isCompleted)}
            </td>
            <td class="col-pip tip-cell">
              ${renderPip(m.id, "user", m.user_tip, eloPick, actualWinner, isCompleted)}
            </td>
            <td class="col-pick">${displayTeamName(actualWinner)}</td>
            </tr>`;
        }

        const html = `
        <div class="games-scroll">
        <table class="games-table">
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
              <th class="col-wide">ELO</th>
              <th class="col-wide">Rank</th>
              <th class="col-wide">Odds</th>
              <th class="col-wide">Tip</th>
              <th class="col-wide">Actual</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
          </table>
          </div>`;

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

window.downloadDbCsv = () => window.open(API_URL + "/api/export");
window.downloadDiagnosticCsv = () => window.open(API_URL + "/api/diagnostic");

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

  const res = await fetch(`${API_URL}/api/matches`);
  const matches = await res.json();

  const selectedYear = Number(document.getElementById("season-year").value);

  matches.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return extractRoundNumber(a.round) - extractRoundNumber(b.round);
  });

  const engine = createReplayEngine(MODEL_PARAMS, teams);
  const replay = engine.replayMatches(matches, { applyByes: true });

  // ---- Isolate selected season ----
  const seasonMatches = matches.filter(m => m.year === selectedYear);

  const rounds = [...new Set(seasonMatches.map(m => m.round))]
    .sort((a, b) => extractRoundNumber(a) - extractRoundNumber(b));

  const cumulativePoints = {};
  teams.forEach(t => cumulativePoints[t.name] = 0);

  const roundPoints = {};
  rounds.forEach(r => roundPoints[r] = {});

  let lastCompletedRound = null;

  // ---- Process completed games in season ----
  for (const m of seasonMatches) {

    if (m.home_score == null || m.away_score == null) continue;

    lastCompletedRound = m.round;

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

  const seasonRows = replay.rows.filter(r => r.match.year === selectedYear);

  const ladderAtSeasonEnd =
    seasonRows.length > 0
      ? seasonRows[seasonRows.length - 1].ladderAfter
      : replay.ladder;

  const currentLadder = engine.rankLadder(ladderAtSeasonEnd);

  const currentRankMap = {};
  currentLadder.forEach((r, i) => currentRankMap[r.team] = i + 1);

  let html = `<table class="matrix-table"><thead><tr>
    <th>Team</th>
    <th>Rank</th>
    <th>ELO</th>`;

  for (const r of rounds) {
    html += `<th>${r}</th>`;
  }

  html += `</tr></thead><tbody>`;

  for (const row of currentLadder) {

    const team = row.team;

    html += `<tr>
      <td>${team}</td>
      <td>${currentRankMap[team]}</td>
      <td>${Math.round(
        (seasonRows.length > 0
          ? seasonRows[seasonRows.length - 1].stateAfter.ratings[team]
          : replay.state.ratings[team]) ?? 1500
      )}</td>`;

    for (const r of rounds) {
      const cell = roundPoints[r][team];

      if (!cell) {
        html += `<td></td>`;
      } else {
        html += `<td class="${cell.type}">${cell.pts}</td>`;
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

  matches.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return extractRoundNumber(a.round) - extractRoundNumber(b.round);
  });

  const startYear = parseInt(document.getElementById("elo-start-year")?.value || 2009);
  const endYear = parseInt(document.getElementById("elo-end-year")?.value || 2026);

  const engine = createReplayEngine(MODEL_PARAMS, teams);
  const replay = engine.replayMatches(matches, { applyByes: true });

  const labels = [];
  const teamHistory = {};
  teams.forEach(t => teamHistory[t.name] = []);

  for (const r of replay.rows) {

    const m = r.match;

    if (m.home_score == null || m.away_score == null) continue;

    if (m.year >= startYear && m.year <= endYear) {

      labels.push([m.year, m.round]);

      teams.forEach(t => {
        teamHistory[t.name].push(
          r.stateAfter.ratings[t.name] ?? 1500
        );
      });
    }
  }

  const datasets = teams.map(t => ({
    label: t.name,
    data: teamHistory[t.name],
    borderWidth: 1.5,
    pointRadius: 0,
    tension: 0,
    borderColor: getTeamColor(t.name)
  }));

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

document.addEventListener("click", async (e) => {

  const pip = e.target.closest(".pip");
  if (!pip) return;

  // Prevent clicks on completed games
  if (pip.closest(".completed-game")) return;

  const id = Number(pip.dataset.id);
  const type = pip.dataset.type;

  const row = pip.closest("tr");

  const home = row.children[2].innerText;
  const away = row.children[3].innerText;
  const eloPick = row.children[12].innerText;

  // Determine current selection from colour
  const isMatchingElo = pip.classList.contains("success");

  // Toggle selection
  const newPick = isMatchingElo
    ? (eloPick === home ? away : home)
    : eloPick;

  // === INSTANT UI UPDATE ===
  pip.classList.remove("success", "warning");
  pip.classList.add(newPick === eloPick ? "success" : "warning");

  // === SEND TO SERVER IN BACKGROUND ===
  try {
    await fetch(API_URL + "/api/tips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        odds_tip: type === "odds" ? newPick : undefined,
        user_tip: type === "user" ? newPick : undefined
      })
    });
  } catch (err) {
    console.error("Failed to update tip", err);
  }
});

document.getElementById("elo-highlight")?.addEventListener("change", () => {
  loadEloHistory();
});
