import { createReplayEngine } from "./shared/replay-engine.js";

const API_URL = "https://nrl-elo-api.d2-rein.workers.dev";
let matchesCache = null;

let MODEL_PARAMS = null;
let rankingsSort = { key: "rank", dir: "asc" };

async function fetchJsonWithRetry(url, attempts = 3) {
  let lastError = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (e) {
      lastError = e;
      await new Promise(r => setTimeout(r, 250 * (i + 1)));
    }
  }
  throw lastError || new Error(`Failed to fetch ${url}`);
}

async function fetchJsonWithFallback(url, attempts = 3) {
  return fetchJsonWithRetry(url, attempts);
}

async function fetchWithFallback(url, options = {}) {
  return fetch(url, options);
}

async function getMatches(force = false) {
  if (!force && Array.isArray(matchesCache) && matchesCache.length > 0) {
    return matchesCache;
  }
  try {
    const data = await fetchJsonWithFallback(`${API_URL}/api/matches`, 4);
    if (!Array.isArray(data)) throw new Error("Matches payload was not an array");
    matchesCache = data;
    return matchesCache;
  } catch (e) {
    if (Array.isArray(matchesCache) && matchesCache.length > 0) {
      return matchesCache;
    }
    throw e;
  }
}

async function loadModelParams() {
  const rows = await fetchJsonWithFallback(`${API_URL}/api/parameters`);

  // rows expected: [{name: "...", value: "..."}]
  const map = Object.fromEntries(
    rows.map(r => [r.name, Number(r.value)])
  );

  MODEL_PARAMS = {
    kFactor: map.k_factor,
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

function getTeamsInYearFixtures(matches, year) {
  const set = new Set();
  for (const m of matches) {
    if (Number(m.year) !== Number(year)) continue;
    if (m.home_team) set.add(m.home_team);
    if (m.away_team) set.add(m.away_team);
  }
  return set;
}

function getLatestSeasonYear(matches) {
  return Math.max(...matches.map(m => Number(m.year)));
}

async function populateRankingsSelectors() {
  const matches = await getMatches();

  const years = [...new Set(matches.map(m => m.year))].sort();
  const yearSelect = document.getElementById("rankings-year");

  yearSelect.innerHTML = years
    .map(y => `<option value="${y}">${y}</option>`)
    .join("");

  const next = getNextUncompletedRound(matches);
  yearSelect.value = next ? String(next.year) : String(years[years.length - 1]);

  updateRoundDropdown(matches);
  if (next) {
    document.getElementById("rankings-round").value = next.round;
  }
}

function getNextUncompletedRound(matches) {
  const ordered = [...matches].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.match_index - b.match_index;
  });
  return ordered.find(m => m.home_score == null || m.away_score == null) || null;
}

function updateRoundDropdown(matches) {
  const selectedYear = document.getElementById("rankings-year").value;
  const roundSelect = document.getElementById("rankings-round");

  const rounds = matches
    .filter(m => String(m.year) === String(selectedYear))
    .map(m => m.round);

  const uniqueRounds = [];

  for (const m of matches) {
    if (String(m.year) !== String(selectedYear)) continue;
    if (!uniqueRounds.includes(m.round)) {
      uniqueRounds.push(m.round);
    }
  }

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
    try {
      await loadModelParams();
      await loadTeams();
      loadAllGames();
    } catch (e) {
      console.error("Initial preview load failed:", e);
      const el = document.getElementById("games-table");
      if (el) el.innerHTML = `<p>Error loading preview: ${e?.message || e}</p>`;
    }
});

document.addEventListener('change', async (e) => {
  if (e.target.id === "rankings-year") {
    const matches = await getMatches();
    updateRoundDropdown(matches);
    loadRankings();
  }

  if (e.target.id === "rankings-round") {
    loadRankings();
  }
});

document.addEventListener("click", (e) => {
  const th = e.target.closest("#rankings-table th.sortable");
  if (!th) return;

  const key = th.dataset.sortKey;
  if (!key) return;

  if (rankingsSort.key === key) {
    rankingsSort.dir = rankingsSort.dir === "asc" ? "desc" : "asc";
  } else {
    rankingsSort = { key, dir: key === "team" ? "asc" : "desc" };
  }

  const raw = document.getElementById("rankings-table").dataset.rows;
  if (!raw) return;
  renderRankingsTable(JSON.parse(raw));
});


function showTab(tab, btn) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));

  document.getElementById(tab).classList.add('active');
  if (btn) btn.classList.add('active');

  if (tab === 'rankings') {populateRankingsSelectors().then(loadRankings);};
  if (tab === 'season') { populateSeasonYearSelector(); };
  if (tab === 'add') { prepareNextRoundForEntry(); }
  if (tab === 'games') loadAllGames();
  if (tab === 'elo-history') loadEloHistory();
  if (tab === 'settings') evaluateModel();

}


/* ======================================================
   ======== RANKINGS TAB (UPDATED) ======================
   ====================================================== */

async function loadRankings() {
  try {
    const matches = await getMatches();

    const selectedYear = document.getElementById("rankings-year")?.value;
    const selectedRound = document.getElementById("rankings-round")?.value;

    matches.sort((a,b)=>{
      if (a.year !== b.year) return a.year - b.year;
      return a.match_index - b.match_index;
    });

    const engine = createReplayEngine(MODEL_PARAMS, teams);

    const replay = engine.replayMatches(matches, {
      applyByes: true,
      stopAt: selectedYear && selectedRound
        ? { year: selectedYear, round: selectedRound }
        : null
    });

    const teamsInYear = getTeamsInYearFixtures(matches, selectedYear);
    const ladderTable = engine
      .rankLadder(replay.ladder)
      .filter(r => teamsInYear.has(r.team))
      .map((r, i) => ({
        rank: i + 1,
        team: r.team,
        elo: Math.round(replay.state.ratings[r.team] ?? 1500),
        points: r.compPoints,
        pointsFor: r.for,
        pointsAgainst: r.against,
        margin: r.margin
      }));

    renderRankingsTable(ladderTable);
  } catch (e) {
    console.error(e);
  }
}

function renderRankingsTable(rows) {
  const data = [...rows];
  const { key, dir } = rankingsSort;
  const multiplier = dir === "asc" ? 1 : -1;

  data.sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (typeof av === "string" || typeof bv === "string") {
      return String(av).localeCompare(String(bv)) * multiplier;
    }
    return ((Number(av) || 0) - (Number(bv) || 0)) * multiplier;
  });

  const arrowFor = (k) => (k === key ? (dir === "asc" ? "▲" : "▼") : "↕");
  const html = `
    <table class="rankings-table">
      <thead>
        <tr>
          <th class="sortable" data-sort-key="rank">Rank <span class="sort-indicator">${arrowFor("rank")}</span></th>
          <th class="sortable" data-sort-key="team">Team <span class="sort-indicator">${arrowFor("team")}</span></th>
          <th class="sortable" data-sort-key="elo">ELO <span class="sort-indicator">${arrowFor("elo")}</span></th>
          <th class="sortable" data-sort-key="points">Points <span class="sort-indicator">${arrowFor("points")}</span></th>
          <th class="sortable" data-sort-key="pointsFor">For <span class="sort-indicator">${arrowFor("pointsFor")}</span></th>
          <th class="sortable" data-sort-key="pointsAgainst">Against <span class="sort-indicator">${arrowFor("pointsAgainst")}</span></th>
          <th class="sortable" data-sort-key="margin">Margin <span class="sort-indicator">${arrowFor("margin")}</span></th>
        </tr>
      </thead>
      <tbody>
        ${data.map(r => `
          <tr>
            <td>${r.rank}</td>
            <td>${r.team}</td>
            <td>${r.elo}</td>
            <td>${r.points}</td>
            <td>${r.pointsFor}</td>
            <td>${r.pointsAgainst}</td>
            <td>${r.margin}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  document.getElementById("rankings-table").innerHTML = html;
  document.getElementById("rankings-table").dataset.rows = JSON.stringify(rows);
}

async function loadTeams() {
    try {
        const data = await fetchJsonWithFallback(`${API_URL}/api/teams`);
        teams = data;
    } catch (e) {
        console.error('Error loading teams:', e);
        try {
          const matches = await getMatches();
          const uniqueNames = Array.from(
            new Set(matches.flatMap(m => [m.home_team, m.away_team]).filter(Boolean))
          );
          teams = uniqueNames.map(name => ({ name }));
        } catch {
          teams = [];
        }
    }
}


async function loadPredictions() {
    try {
        const data = await fetchJsonWithFallback(`${API_URL}/api/predictions`);
        
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

async function prepareNextRoundForEntry() {
  try {
    const matches = await getMatches();

    matches.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.match_index - b.match_index;
    });

    const next = getNextUncompletedRound(matches);
    const fallback = matches[matches.length - 1];
    const target = next || fallback;
    if (!target) return;

    document.getElementById("round-year").value = target.year;
    document.getElementById("round-name").value = target.round;
    await loadRoundForEntry();
  } catch (e) {
    console.error("Failed to default next round", e);
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
    const matches = await getMatches();

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
    matches.sort((a,b)=>{
      if (a.year !== b.year) return a.year - b.year;
      return a.match_index - b.match_index;
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
    const res = await fetchWithFallback(`${API_URL}/api/matches/bulk-update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates })
    });

    if (!res.ok) throw new Error("Failed to save scores");

    document.getElementById("add-message").innerHTML =
      '<div class="message success">Scores saved successfully.</div>';

    matchesCache = null;
    // Refresh the All Games table so you see the changes immediately
    await loadAllGames();

  } catch (e) {
    console.error(e);
    document.getElementById("add-message").innerHTML =
      '<div class="message error">Failed to save scores.</div>';
  }
}


async function updateSettingsAndEvaluate(e) {
    if (e?.preventDefault) e.preventDefault();
    document.getElementById('settings-message').innerHTML =
      '<div class="message error">Live parameter updates are disabled on this page. Update model inputs in code and redeploy.</div>';
    await evaluateModel();
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

function buildRoundJokerStats(matches, replayRows, year) {
  const rowsById = new Map(replayRows.map(r => [r.match.id, r]));
  const seasonMatches = matches
    .filter(m => Number(m.year) === Number(year))
    .sort((a, b) => a.match_index - b.match_index);

  const perRound = new Map();

  for (const m of seasonMatches) {
    const rr = rowsById.get(m.id);
    if (!rr) continue;

    const round = m.round;
    if (!perRound.has(round)) {
      perRound.set(round, {
        round,
        c10: 0,
        c15: 0,
        c20: 0,
        c25: 0,
        c30: 0,
        eloEv: 0,
        broncosEv: 0,
        actual: 0,
        games: 0
      });
    }

    const stats = perRound.get(round);
    const pHome = rr.out.expected;
    const pAway = 1 - pHome;
    const favProb = Math.max(pHome, pAway);
    const favTeam = pHome >= pAway ? m.home_team : m.away_team;

    stats.games += 1;
    if (favProb >= 0.60) stats.c10 += 1;
    if (favProb >= 0.65) stats.c15 += 1;
    if (favProb >= 0.70) stats.c20 += 1;
    if (favProb >= 0.75) stats.c25 += 1;
    if (favProb >= 0.80) stats.c30 += 1;

    stats.eloEv += favProb;

    const broncosInGame =
      m.home_team === "Brisbane Broncos" || m.away_team === "Brisbane Broncos";
    const broncosPick = broncosInGame ? "Brisbane Broncos" : favTeam;
    const broncosPickProb = broncosPick === m.home_team ? pHome : pAway;
    stats.broncosEv += broncosPickProb;

    const completed = m.home_score != null && m.away_score != null;
    if (completed) {
      const margin = Number(m.home_score) - Number(m.away_score);
      const winner = margin > 0 ? m.home_team : margin < 0 ? m.away_team : "DRAW";
      if (winner === "DRAW" || broncosPick === winner) {
        stats.actual += 1;
      }
    }
  }

  return Array.from(perRound.values()).sort(
    (a, b) => extractRoundNumber(a.round) - extractRoundNumber(b.round)
  );
}

function heatClassForCount(v) {
  if (v <= 0) return "heat-red";
  if (v <= 1) return "heat-yellow";
  return "heat-green";
}

function heatClassForEv(ev, games) {
  const ratio = games > 0 ? ev / games : 0;
  if (ratio < 0.56) return "heat-red";
  if (ratio < 0.62) return "heat-yellow";
  return "heat-green";
}

function renderJokerTable(stats) {
  const topTwoBroncos = new Set(
    [...stats]
      .sort((a, b) => b.broncosEv - a.broncosEv)
      .slice(0, 2)
      .map(s => s.round)
  );

  const html = `
    <table class="joker-table">
      <thead>
        <tr>
          <th>Round</th>
          <th>10%</th>
          <th>15%</th>
          <th>20%</th>
          <th>25%</th>
          <th>30%</th>
          <th>Elo Pick</th>
          <th>Broncos Pick</th>
          <th>Actual</th>
          <th>Games</th>
        </tr>
      </thead>
      <tbody>
        ${stats.map(s => `
          <tr>
            <td>${s.round}</td>
            <td class="${heatClassForCount(s.c10)}">${s.c10}</td>
            <td class="${heatClassForCount(s.c15)}">${s.c15}</td>
            <td class="${heatClassForCount(s.c20)}">${s.c20}</td>
            <td class="${heatClassForCount(s.c25)}">${s.c25}</td>
            <td class="${heatClassForCount(s.c30)}">${s.c30}</td>
            <td class="${heatClassForEv(s.eloEv, s.games)}">${s.eloEv.toFixed(2)}</td>
            <td class="${heatClassForEv(s.broncosEv, s.games)} ${topTwoBroncos.has(s.round) ? "top-broncos" : ""}">${s.broncosEv.toFixed(2)}</td>
            <td>${s.actual}</td>
            <td>${s.games}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
  document.getElementById("joker-table").innerHTML = html;
}

async function evaluateModel() {
  try {
    const matches = await getMatches();

    // --- Sort chronologically ---
    matches.sort((a,b)=>{
      if (a.year !== b.year) return a.year - b.year;
      return a.match_index - b.match_index;
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

      const margin = m.home_score - m.away_score;

      // who would be the winner if not a draw
      const actualWinner = margin > 0 ? home : away;

      // tipping-comp rule: draw is always correct
      const isDraw = (margin === 0);

      const homeWinProb = out.expected;
      const eloPick = homeWinProb >= 0.5 ? home : away;

      // correctness booleans (draw => true)
      const eloCorrect   = isDraw ? true : (eloPick === actualWinner);
      const ladderCorrect= isDraw ? true : (ladderPick === actualWinner);

      const homeOdds = Number(m.home_odds);
      const awayOdds = Number(m.away_odds);
      let oddsPick = eloPick;
      if (Number.isFinite(homeOdds) && Number.isFinite(awayOdds)) {
        if (homeOdds < awayOdds) oddsPick = home;
        else if (awayOdds < homeOdds) oddsPick = away;
      } else if (Number.isFinite(homeOdds)) {
        oddsPick = home;
      } else if (Number.isFinite(awayOdds)) {
        oddsPick = away;
      }
      const oddsCorrect  = isDraw ? true : (oddsPick === actualWinner);

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

      // --- Score ladder accuracy ---
      if (ladderCorrect) {
        overall.ladder++;
        yearly[year].ladder++;
        if (year >= last3Cutoff) last3.ladder++;
      }

      // --- overall ---
      overall.games++;
      yearly[year].games++;
      if (year >= last3Cutoff) last3.games++;

      // --- ELO accuracy ---
      if (eloCorrect) {
        overall.elo++;
        yearly[year].elo++;
        if (year >= last3Cutoff) last3.elo++;
      }

      // --- odds accuracy ---
      if (oddsCorrect) {
        overall.odds++;
        yearly[year].odds++;
        if (year >= last3Cutoff) last3.odds++;
      }

      // --- Proper Brier ---
      const actual = isDraw ? 0.5 : (actualWinner === home ? 1 : 0);
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

    const jokerStats = buildRoundJokerStats(matches, replay.rows, latestYear);
    if (document.getElementById("joker-table")) {
      renderJokerTable(jokerStats);
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
    if (actualWinner === "DRAW") {
      css += " success";
    } else if (pick === actualWinner) {
      css += " success";
    } else if (eloPick === actualWinner) {
      css += " error";
    } else {
      css += " warning";
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
    if (actualWinner === "DRAW") {
      cls = "pip success";
    } else if (ladderPick === actualWinner) {
      cls = "pip success";
    } else if (eloPick !== actualWinner) {
      cls = "pip warning";
    } else {
      cls = "pip error";
    }
  }

  return `<div class="${cls}"></div>`;
}

async function loadAllGames() {
    try {
        const matches = await getMatches();

        if (!Array.isArray(teams) || teams.length === 0) {
          await loadTeams();
        }
        if (!Array.isArray(teams) || teams.length === 0) {
          const uniqueTeams = Array.from(
            new Set(matches.flatMap(m => [m.home_team, m.away_team]).filter(Boolean))
          );
          teams = uniqueTeams.map(name => ({ name }));
        }

        // Sort matches chronologically before replaying ELO
        matches.sort((a,b)=>{
          if (a.year !== b.year) return a.year - b.year;
          return a.match_index - b.match_index;
        });

        const engine = createReplayEngine(MODEL_PARAMS, teams);
        const replay = engine.replayMatches(matches, { applyByes: true });

        // Starting ELO
        let rows = "";

        let lastRoundKey = null;
        let roundToggle = false;
        console.log("MODEL_PARAMS used:", MODEL_PARAMS);
        
        for (const r of replay.rows) {

            const m = r.match;
            const out = r.out;

            const home = m.home_team;
            const away = m.away_team;

            const dr = out.dr;
            const homeWinProb = out.expected;
            const drAbs = Math.abs(dr);
            const tipPoints = drAbs < 30 ? 2 : drAbs < 70 ? 4 : 8;
            const marginPred = `${Math.abs(out.predictedMargin).toFixed(1)} (${tipPoints})`;
            const eloHomeBefore = out.homeEloBefore;
            const eloAwayBefore = out.awayEloBefore;

            const homeWinPct = (homeWinProb * 100).toFixed(1) + "%";

            const rankHome = r.homeRankBeforeRound;
            const rankAway = r.awayRankBeforeRound;

            const ladderPick = rankHome < rankAway ? home : away;
            const eloPick = homeWinProb >= 0.5 ? home : away;
            const isCompleted = (m.home_score != null && m.away_score != null);

            let actualWinner = null;
            let isDraw = false;

            if (isCompleted) {
              const margin = m.home_score - m.away_score;
              if (margin === 0) {
                isDraw = true;
                actualWinner = "DRAW";
              } else {
                actualWinner = margin > 0 ? home : away;
              }
            }

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
                if (!isCompleted) return "";

                if (isDraw) return "success";   // draw = correct for everyone

                if (pick === actualWinner) return "success";
                if (pick === eloPick) return "warning";
                return "error";
            };

            const highlightTeamClass = (teamName) => {
              if (teamName !== eloPick) return "";
              if (!isCompleted) return "team-pick-green";
              if (isDraw) return "team-pick-yellow";
              return actualWinner === eloPick ? "team-pick-green" : "team-pick-red";
            };

            rows += `
            <tr class="${roundClass} ${isCompleted ? 'completed-game' : ''}"
                data-home-team="${home}"
                data-away-team="${away}"
                data-elo-pick="${eloPick}">
              <td class="col-narrow">${m.year}</td>
              <td class="col-narrow">${m.round}</td>
              <td class="col-team ${highlightTeamClass(home)}">${displayTeamName(home)}</td>
              <td class="col-team ${highlightTeamClass(away)}">${displayTeamName(away)}</td>
              <td class="col-narrow">${homeWinPct}</td>
              <td class="col-narrow">${m.home_score}</td>
              <td class="col-narrow">${m.away_score}</td>
              <td class="col-narrow">${marginPred}</td>
              <td class="col-narrow">${Math.round(eloHomeBefore)}</td>
              <td class="col-narrow">${Math.round(eloAwayBefore)}</td>
              <td class="col-narrow">${rankHome}</td>
              <td class="col-narrow">${rankAway}</td>
              <td class="${colourFor(eloPick)} col-pick">
                ${displayTeamName(eloPick)} (${tipPoints})
              </td>
              <td class="col-pip tip-cell">
                ${renderRankPip(ladderPick, eloPick, actualWinner, isCompleted)}
              </td>
              <td class="col-pip tip-cell">
                ${renderPip(m.id, "odds", m.odds_tip, eloPick, actualWinner, isCompleted)}
              </td>
              <td class="col-pip tip-cell">
                ${renderPip(m.id, "user", m.user_tip, eloPick, actualWinner, isCompleted)}
              </td>
              <td class="col-pick">
                ${actualWinner === "DRAW" ? "DRAW" : displayTeamName(actualWinner)}
              </td>
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
              <th class="col-narrow">Home<br>Win %</th>
              <th class="col-narrow">Home<br>Score</th>
              <th class="col-narrow">Away<br>Score</th>
              <th class="col-narrow">Pred<br>Margin</th>
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
            `<p>Error loading games: ${e?.message || e}</p>`;
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

  const matches = await getMatches();

  const selectedYear = Number(document.getElementById("season-year").value);

  matches.sort((a,b)=>{
    if (a.year !== b.year) return a.year - b.year;
    return a.match_index - b.match_index;
  });

  const engine = createReplayEngine(MODEL_PARAMS, teams);
  const replay = engine.replayMatches(matches, { applyByes: true });

  const seasonMatches = matches
    .filter(m => Number(m.year) === selectedYear)
    .sort((a, b) => a.match_index - b.match_index);

  const yearTeams = Array.from(getTeamsInYearFixtures(matches, selectedYear));
  const rowsById = new Map(replay.rows.map(r => [r.match.id, r]));
  const rounds = Array.from(new Set(seasonMatches.map(m => m.round))).sort(
    (a, b) => extractRoundNumber(a) - extractRoundNumber(b)
  );

  const cumulativePoints = {};
  yearTeams.forEach(team => { cumulativePoints[team] = 0; });

  const roundPoints = {};
  rounds.forEach(round => { roundPoints[round] = {}; });

  for (const round of rounds) {
    const roundMatches = seasonMatches.filter(m => m.round === round);
    const playedThisRound = new Set();

    for (const m of roundMatches) {
      playedThisRound.add(m.home_team);
      playedThisRound.add(m.away_team);

      const r = rowsById.get(m.id);
      if (!r) continue;

      const pHome = r.out.expected;
      const pAway = 1 - pHome;
      const completed = m.home_score != null && m.away_score != null;

      let homePts = 0;
      let awayPts = 0;
      let homeType = "pred-loss";
      let awayType = "pred-loss";

      if (completed) {
        if (m.home_score > m.away_score) {
          homePts = 2;
          awayPts = 0;
          homeType = "win";
          awayType = "loss";
        } else if (m.away_score > m.home_score) {
          homePts = 0;
          awayPts = 2;
          homeType = "loss";
          awayType = "win";
        } else {
          homePts = 1;
          awayPts = 1;
          homeType = "draw";
          awayType = "draw";
        }
      } else {
        homePts = 2 * pHome;
        awayPts = 2 * pAway;
        homeType = pHome >= 0.5 ? "pred-win" : "pred-loss";
        awayType = pAway >= 0.5 ? "pred-win" : "pred-loss";
      }

      cumulativePoints[m.home_team] += homePts;
      cumulativePoints[m.away_team] += awayPts;

      roundPoints[round][m.home_team] = {
        pts: cumulativePoints[m.home_team],
        type: homeType,
        opponent: m.away_team
      };
      roundPoints[round][m.away_team] = {
        pts: cumulativePoints[m.away_team],
        type: awayType,
        opponent: m.home_team
      };
    }

    const isRegularRound = /^Rd\s*\d+/i.test(round);
    const isFinalsRound = /^(qual|elim|semi|prelim|grand|gf)/i.test(round);
    if (isRegularRound && !isFinalsRound) {
      for (const team of yearTeams) {
        if (playedThisRound.has(team)) continue;
        cumulativePoints[team] += 2;
        roundPoints[round][team] = {
          pts: cumulativePoints[team],
          type: "bye",
          opponent: null
        };
      }
    }
  }

  const currentLadder = yearTeams
    .map(team => ({
      team,
      compPoints: cumulativePoints[team] ?? 0,
      rating: Math.round(replay.state.ratings[team] ?? 1500)
    }))
    .sort((a, b) => {
      if (b.compPoints !== a.compPoints) return b.compPoints - a.compPoints;
      if (b.rating !== a.rating) return b.rating - a.rating;
      return a.team.localeCompare(b.team);
    });

  const currentRankMap = {};
  currentLadder.forEach((r, i) => { currentRankMap[r.team] = i + 1; });

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
      <td><img class="team-logo" src="${logoPath(team)}" alt="">${team}</td>
      <td>${currentRankMap[team]}</td>
      <td>${row.rating}</td>`;

    for (const r of rounds) {
      const cell = roundPoints[r][team];

      if (!cell) {
        html += `<td></td>`;
      } else {
        const rounded = Math.abs(cell.pts - Math.round(cell.pts)) < 0.001
          ? Number(cell.pts).toFixed(0)
          : Number(cell.pts).toFixed(2);
        const oppLogo = cell.opponent
          ? `<img class="matrix-opponent-logo" src="${logoPath(cell.opponent)}" alt="">`
          : "";
        html += `<td class="${cell.type}">${rounded}${oppLogo}</td>`;
      }
    }

    html += `</tr>`;
  }

  html += `</tbody></table>`;

  document.getElementById("season-matrix-table").innerHTML = html;
}

async function populateSeasonYearSelector() {

  const matches = await getMatches();

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

function fadeHexColor(hex, alpha) {
  if (typeof hex !== "string" || !hex.startsWith("#") || (hex.length !== 7 && hex.length !== 4)) {
    return hex;
  }
  let full = hex;
  if (hex.length === 4) {
    full = "#" + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }
  const r = parseInt(full.slice(1, 3), 16);
  const g = parseInt(full.slice(3, 5), 16);
  const b = parseInt(full.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

async function loadEloHistory() {

  await loadTeams();

  const matches = await getMatches();

  matches.sort((a,b)=>{
    if (a.year !== b.year) return a.year - b.year;
    return a.match_index - b.match_index;
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

  const highlightSelect = document.getElementById("elo-highlight");
  const currentHighlight = highlightSelect?.value || "Any";
  if (highlightSelect) {
    highlightSelect.innerHTML = `
      <option value="Any">Any</option>
      ${teams.map(t => `<option value="${t.name}">${t.name}</option>`).join("")}
    `;
    highlightSelect.value = teams.some(t => t.name === currentHighlight) ? currentHighlight : "Any";
  }
  const selectedHighlight = highlightSelect?.value || "Any";

  const datasets = teams.map(t => {
    const baseColor = getTeamColor(t.name);
    const highlighted = selectedHighlight !== "Any" && t.name === selectedHighlight;
    const dimOthers = selectedHighlight !== "Any" && !highlighted;
    return {
      label: t.name,
      data: teamHistory[t.name],
      borderWidth: highlighted ? 3 : 1.5,
      pointRadius: 0,
      tension: 0,
      borderColor: dimOthers ? fadeHexColor(baseColor, 0.18) : baseColor
    };
  });

  const canvas = document.getElementById("elo-history-chart");
  const minWidth = Math.max(1400, labels.length * 24);
  canvas.width = minWidth;
  canvas.height = 420;
  const ctx = canvas.getContext("2d");

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
    responsive: false,
    maintainAspectRatio: false,
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

  const home = row.dataset.homeTeam;
  const away = row.dataset.awayTeam;
  const eloPick = row.dataset.eloPick;

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
    await fetchWithFallback(API_URL + "/api/tips", {
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

