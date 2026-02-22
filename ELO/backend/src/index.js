import { ELOCalculator } from '../../shared/elo-calculator.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    try {
      let response;

      // IMPORTANT: use env.DB (matches your wrangler.toml binding)
      const db = env.DB;

      if (path === '/api/teams' && request.method === 'GET') {
        response = await handleGetTeams(db);
      } else if (path === '/api/matches' && request.method === 'GET') {
        response = await handleGetMatches(db, url.searchParams);
      } else if (path === '/api/tips' && request.method === 'POST') {
        response = await handleUpdateTips(request, env);
      } else if (path === '/api/matches/bulk-update' && request.method === 'POST') {
        response = await handleUpdateScores(db, request);
      } else if (path === '/api/predictions' && request.method === 'GET') {
        response = await handleGetPredictions(db);
      } else if (path === '/api/parameters' && request.method === 'GET') {
        response = await handleGetParameters(db);
      } else if (path === '/api/export' && request.method === 'GET') {
        response = await handleExport(db);
      } else if (path === '/api/diagnostic' && request.method === 'GET') {
        response = await handleDiagnostic(db);
      } else if (path === '/api/calculate' && request.method === 'POST') {
        response = await handleRecalculate(db, request);
      } else {
        response = new Response('Not Found', { status: 404 });
      }

      // apply CORS to all responses
      Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
      return response;
    } catch (error) {
      console.error('Error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  },
};

async function handleUpdateTips(request, env) {
  const body = await request.json();
  const { id, odds_tip, user_tip } = body;

  if (typeof id !== "number") {
    return new Response("Missing id", { status: 400 });
  }

  const stmt = env.DB.prepare(`
    UPDATE matches
    SET odds_tip = ?, user_tip = ?
    WHERE id = ?
  `).bind(odds_tip ?? null, user_tip ?? null, id);

  const result = await stmt.run();

  return new Response(JSON.stringify({
    ok: true,
    changes: result.meta?.changes ?? 0
  }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

async function handleGetTeams(db) {
  const params = await getParameters(db);
  const calculator = new ELOCalculator(params);

  const teams = await db.prepare(`
    SELECT id, name, short_name
    FROM teams
    WHERE active = 1
  `).all();

  const ratingsByTeamId = await computeRatingsByTeamId(db, calculator);

  // build ranking list
  const rows = (teams.results || []).map(t => ({
    id: t.id,
    name: t.name,
    short_name: t.short_name,
    rating: ratingsByTeamId.get(t.id) ?? params.initialRating ?? 1500,
  }));

  rows.sort((a, b) => b.rating - a.rating);
  rows.forEach((r, i) => (r.rank = i + 1));

  return jsonResponse(rows);
}

async function handleGetMatches(db, searchParams) {
  // default big enough to cover all history; you can tune later
  const limit = Number(searchParams?.get("limit") ?? 10000);
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 20000)) : 10000;

  const { results } = await db.prepare(`
    SELECT
      m.id,
      m.year,
      m.round,
      m.game_num,
      m.home_score,
      m.away_score,
      m.completed,
      m.odds_tip,
      m.user_tip,
      ht.id as home_team_id,
      ht.name as home_team,
      at.id as away_team_id,
      at.name as away_team
    FROM matches m
    JOIN teams ht ON m.home_team_id = ht.id
    JOIN teams at ON m.away_team_id = at.id
    ORDER BY
      m.year ASC,
      -- puts "Rd 1".."Rd 27" before finals (Qual/Semi/Prelim/GF -> null)
      CASE
        WHEN m.round LIKE 'Rd %' THEN CAST(TRIM(REPLACE(m.round, 'Rd', '')) AS INTEGER)
        ELSE 99
      END ASC,
      m.game_num ASC,
      m.id ASC
    LIMIT ?
  `).bind(safeLimit).all();

  return jsonResponse(results || []);
}

async function handleUpdateScores(db, request) {
  const body = await request.json();

    // Allow both formats
    const updates = Array.isArray(body) ? body : body.updates;

    if (!Array.isArray(updates)) {
      return jsonResponse(
        { error: "Expected an array of updates (or { updates: [...] })" },
        400
      );
    }


  const stmt = db.prepare(`
    UPDATE matches
    SET home_score = ?, away_score = ?, completed = 1
    WHERE id = ?
  `);

  for (const u of updates) {
    if (!u.game_id) continue;

    await stmt
      .bind(
        u.home_score !== "" ? Number(u.home_score) : null,
        u.away_score !== "" ? Number(u.away_score) : null,
        Number(u.game_id)
      )
      .run();
  }

  return jsonResponse({ success: true, updated: updates.length });
}

async function handleGetPredictions(db) {
  const params = await getParameters(db);
  const calculator = new ELOCalculator(params);

  // Compute current ratings from all completed matches
  const ratingsByTeamId = await computeRatingsByTeamId(db, calculator);

  const { results } = await db.prepare(`
    SELECT
      m.id,
      m.year,
      m.round,
      m.game_num,
      ht.id as home_team_id,
      ht.name as home_team,
      at.id as away_team_id,
      at.name as away_team
    FROM matches m
    JOIN teams ht ON m.home_team_id = ht.id
    JOIN teams at ON m.away_team_id = at.id
    WHERE m.completed = 0
    ORDER BY m.year, m.round, m.game_num;
  `).all();

  const upcoming = results || [];

  for (const match of upcoming) {
    const homeRating =
      ratingsByTeamId.get(match.home_team_id) ??
      params.initialRating ??
      1500;

    const awayRating =
      ratingsByTeamId.get(match.away_team_id) ??
      params.initialRating ??
      1500;

    const prediction = calculator.predictMatch(homeRating, awayRating);

    match.home_win_probability = prediction.homeWinProbability;
    match.predicted_margin = prediction.predictedMargin;
    match.home_odds = prediction.homeOdds;
    match.predicted_winner =
      prediction.predictedWinner === "home"
        ? match.home_team
        : match.away_team;
  }

  return jsonResponse(upcoming);
}


async function handleGetParameters(db) {
  const { results } = await db.prepare('SELECT * FROM parameters ORDER BY name').all();
  return jsonResponse(results || []);
}

async function handleRecalculate(db, request) {
  // Note: this updates DEFAULT parameters globally.
  // That’s OK for now; later we can add “presets” or query-param overrides.
  const newParams = await request.json();

  for (const [key, value] of Object.entries(newParams || {})) {
    // Only allow numeric values
    const num = Number(value);
    if (Number.isFinite(num)) {
      await db.prepare('UPDATE parameters SET value = ? WHERE name = ?')
        .bind(num, key).run();
    }
  }

  return jsonResponse({ success: true, message: 'Parameters updated' });
}

/**
 * Replays all completed matches (ordered) and returns a Map(teamId -> rating).
 * This is the core change: ratings are derived, not stored.
 */
async function computeRatingsByTeamId(db, calculator) {
  const initial = calculator.initialRating ?? 1500;

  const { results } = await db.prepare(`
    SELECT
      m.id,
      m.year,
      m.round,
      m.game_num,
      m.home_team_id,
      m.away_team_id,
      m.home_score,
      m.away_score
    FROM matches m
    WHERE m.completed = 1
      AND m.home_score IS NOT NULL
      AND m.away_score IS NOT NULL
    ORDER BY m.year ASC, m.round ASC, m.game_num ASC, m.id ASC
  `).all();

  const matches = (results || []).slice().sort((a, b) => {
    const ay = a.year - b.year;
    if (ay) return ay;

    const ar = calculator.extractRoundNumber(a.round);
    const br = calculator.extractRoundNumber(b.round);
    if (ar !== br) return ar - br;

    const ag = (a.game_num ?? 0) - (b.game_num ?? 0);
    if (ag) return ag;

    return a.id - b.id;
  });

  const ratings = new Map();
  const get = (teamId) => (ratings.has(teamId) ? ratings.get(teamId) : initial);
  const set = (teamId, rating) => ratings.set(teamId, rating);

  let lastYear = null;

  for (const m of matches) {
    // Season reversion (Map version)
    if (lastYear !== null && m.year !== lastYear) {
      const w = calculator.reversionWeight ?? 2;
      for (const [teamId, r] of ratings.entries()) {
        if (r !== initial) ratings.set(teamId, calculator.revertToMean(r, w));
      }
    }
    lastYear = m.year;

    const homeElo = get(m.home_team_id);
    const awayElo = get(m.away_team_id);

    const result = calculator.processMatch({
      homeElo,
      awayElo,
      homeScore: m.home_score,
      awayScore: m.away_score,
      roundNumber: calculator.extractRoundNumber(m.round),
    });

    set(m.home_team_id, result.homeElo);
    set(m.away_team_id, result.awayElo);
  }

  return ratings;
}


async function getParameters(db) {
  const { results } = await db.prepare('SELECT name, value FROM parameters').all();
  const params = {};

  (results || []).forEach(p => {
    const key = p.name.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    params[key] = p.value;
  });

  // Ensure defaults exist even if table is empty
  if (!Number.isFinite(params.initialRating)) params.initialRating = 1500;
  if (!Number.isFinite(params.kFactor)) params.kFactor = 11;
  if (!Number.isFinite(params.homeAdvantage)) params.homeAdvantage = 45;

  return params;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
function escapeCsv(value) {
  const s = String(value ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

function toCsv(headers, rows) {
  const headerLine = headers.join(",");
  const lines = rows.map(r => r.map(escapeCsv).join(","));
  return [headerLine, ...lines].join("\n");
}

async function handleExport(db) {
  const { results } = await db.prepare(`
    SELECT *
    FROM matches
    ORDER BY year ASC, round ASC, game_num ASC, id ASC
  `).all();

  if (!results || results.length === 0) {
    return new Response("No matches found", { status: 404 });
  }

  const headers = Object.keys(results[0]);
  const rows = results.map(r => headers.map(h => r[h]));

  const csv = toCsv(headers, rows);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=matches.csv",
    }
  });
}
async function handleDiagnostic(db) {
  const params = await getParameters(db);
  const calculator = new ELOCalculator(params);

  
  // Pull all completed matches with team names
  // NOTE: include extra columns if your DB has them (travel_km/rest_diff/streak_diff)
  const { results } = await db.prepare(`
    SELECT
      m.id,
      m.year,
      m.round,
      m.game_num,
      m.home_score,
      m.away_score,
      ht.id AS home_team_id,
      ht.name AS home_team,
      at.id AS away_team_id,
      at.name AS away_team
    FROM matches m
    JOIN teams ht ON m.home_team_id = ht.id
    JOIN teams at ON m.away_team_id = at.id
    WHERE m.completed = 1
      AND m.home_score IS NOT NULL
      AND m.away_score IS NOT NULL
    ORDER BY m.year ASC, m.round ASC, m.game_num ASC, m.id ASC
  `).all();

  const matches = (results || []).slice().sort((a, b) => {
    const ay = a.year - b.year;
    if (ay) return ay;

    const ar = calculator.extractRoundNumber(a.round);
    const br = calculator.extractRoundNumber(b.round);
    if (ar !== br) return ar - br;

    const ag = (a.game_num ?? 0) - (b.game_num ?? 0);
    if (ag) return ag;

    return a.id - b.id;
  });

  // Build team list + initial ratings
  const { results: teams } = await db.prepare(`
    SELECT id, name
    FROM teams
  `).all();

  const initial = calculator.initialRating ?? 1500;

  const ratings = new Map();
  const get = (id) => (ratings.has(id) ? ratings.get(id) : initial);
  const set = (id, v) => ratings.set(id, v);

  // CSV output
  const headers = [
  "year","round","game_num","match_id",
  "home_team","away_team",
  "home_elo_before","away_elo_before",
  "elo_diff",
  "home_advantage",
  "dr","win_expectancy","predicted_margin_linear",
  "home_score","away_score","actual_result","actual_margin",
  "rawBucket","idx","term1","term2","marginAdj",
  "early","baseK","finalK",
  "home_elo_after","away_elo_after"
];

  const rows = [];

  for (const m of matches) {
    const homeEloBefore = get(m.home_team_id);
    const awayEloBefore = get(m.away_team_id);

    const diag = calculator.processMatchDiagnostic({
      homeElo: homeEloBefore,
      awayElo: awayEloBefore,
      homeScore: m.home_score,
      awayScore: m.away_score,
      roundNumber: calculator.extractRoundNumber(m.round)
    });

    // persist new ratings (match your real replay)
    set(m.home_team_id, diag.newHomeElo);
    set(m.away_team_id, diag.newAwayElo);

    const eloDiff = homeEloBefore - awayEloBefore;

    rows.push([
      m.year, m.round, m.game_num, m.id,
      m.home_team, m.away_team,
      homeEloBefore, awayEloBefore,
      eloDiff,
      calculator.homeAdvantage,
      diag.dr, diag.expected, diag.predictedMargin,
      m.home_score, m.away_score, diag.actualResult, diag.margin,
      diag.rawBucket, diag.idx, diag.term1, diag.term2, diag.marginAdj,
      diag.early, diag.baseK, diag.finalK,
      diag.newHomeElo, diag.newAwayElo
    ]);
    }

  // parameter block at top of CSV (comment lines)
  const p = calculator.params || {};
  const paramBlock = [
    `# initialRating=${p.initialRating ?? 1500}`,
    `# kFactor=${p.kFactor ?? ""}`,
    `# homeAdvantage=${p.homeAdvantage ?? ""}`,
    `# travelPer1000km=${p.travelPer1000km ?? ""}`,
    `# restPerRound=${p.restPerRound ?? ""}`,
    `# streakPts=${p.streakPts ?? ""}`,
    `# earlyBoost=${p.earlyBoost ?? ""}`,
    `# marginCoef=${calculator.marginCoef ?? ""}`,
    `# drWeighting=${calculator.drWeighting ?? ""}`,
    `# formula: newElo = old + finalK*(actual - expected)`,
    ``
  ].join("\n");

  const csv = paramBlock + toCsv(headers, rows);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=diagnostic.csv",
    }
  });
}