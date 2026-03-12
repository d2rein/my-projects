import { ELOCalculator } from '../../shared/elo-calculator.js';
import { createReplayEngine } from '../../shared/replay-engine.js';

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
      }  else if (path === '/api/parity' && request.method === 'GET') {
        response = await handleParity(db);
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

async function handleParity(db) {

  const params = await getParameters(db);
  const calculator = new ELOCalculator(params);

  const stateA = calculator.createState();
  const stateB = calculator.createState();

  const { results } = await db.prepare(`
    SELECT
      m.year,
      m.round,
      m.home_score,
      m.away_score,
      ht.name as home_team,
      at.name as away_team
    FROM matches m
    JOIN teams ht ON m.home_team_id = ht.id
    JOIN teams at ON m.away_team_id = at.id
    WHERE m.completed = 1
      AND m.home_score IS NOT NULL
      AND m.away_score IS NOT NULL
    ORDER BY
      m.year ASC,
      m.match_index ASC
  `).all();

  for (const m of results || []) {
    calculator.stepMatch(stateA, m);
  }

  // second replay for verification
  for (const m of results || []) {
    calculator.stepMatch(stateB, m);
  }

  const mismatches = [];

  for (const team of Object.keys(stateA.ratings)) {
    const a = stateA.ratings[team];
    const b = stateB.ratings[team];
    if (Math.abs(a - b) > 0.0001) {
      mismatches.push({ team, a, b });
    }
  }

  return jsonResponse({
    ok: mismatches.length === 0,
    mismatchCount: mismatches.length,
    mismatches
  });
}

async function handleUpdateTips(request, env) {
  const body = await request.json();
  const { id, odds_tip, user_tip } = body;

  if (typeof id !== "number") {
    return new Response("Missing id", { status: 400 });
  }

  const stmt = env.DB.prepare(`
    UPDATE matches
    SET
      odds_tip = COALESCE(?, odds_tip),
      user_tip = COALESCE(?, user_tip)
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
      m.year,
      m.round,
      m.match_index,
      m.game_num,
      m.id,

      m.home_team_id,
      m.away_team_id,

      m.home_score,
      m.away_score,
      m.completed,
      m.odds_tip,
      m.user_tip,

      m.venue_name,
      m.primary_home_venue,

      m.home_odds,
      m.away_odds,
      m.home_odds_open,
      m.away_odds_open,
      m.home_odds_close,
      m.away_odds_close,

      ht.name as home_team,
      at.name as away_team
    FROM matches m
    JOIN teams ht ON m.home_team_id = ht.id
    JOIN teams at ON m.away_team_id = at.id
    ORDER BY
      m.year ASC,
      m.match_index ASC
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
    SET
      home_score = ?,
      away_score = ?,
      completed =
        CASE
          WHEN ? IS NOT NULL AND ? IS NOT NULL
          THEN 1
          ELSE 0
        END
    WHERE id = ?
  `);

  for (const u of updates) {
    if (!u.game_id) continue;

    await stmt
      .bind(
        u.home_score !== "" ? Number(u.home_score) : null,
        u.away_score !== "" ? Number(u.away_score) : null,
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
      m.match_index,
      m.game_num,
      ht.id as home_team_id,
      ht.name as home_team,
      at.id as away_team_id,
      at.name as away_team
    FROM matches m
    JOIN teams ht ON m.home_team_id = ht.id
    JOIN teams at ON m.away_team_id = at.id
    WHERE m.home_score IS NULL
    ORDER BY
      m.year ASC,
      m.match_index ASC
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

  const state = calculator.createState();

  const { results } = await db.prepare(`
    SELECT
      m.year,
      m.round,
      m.home_score,
      m.away_score,
      ht.name as home_team,
      at.name as away_team
    FROM matches m
    JOIN teams ht ON m.home_team_id = ht.id
    JOIN teams at ON m.away_team_id = at.id
    WHERE m.completed = 1
      AND m.home_score IS NOT NULL
      AND m.away_score IS NOT NULL
    ORDER BY
      m.year ASC,
      m.match_index ASC
  `).all();

  for (const m of results || []) {
    calculator.stepMatch(state, m);
  }

  // convert state.ratings (teamName -> rating) to Map(teamId -> rating)
  const { results: teams } = await db.prepare(`
    SELECT id, name FROM teams
  `).all();

  const map = new Map();

  for (const t of teams || []) {
    map.set(t.id, state.ratings[t.name] ?? calculator.initialRating);
  }

  return map;
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
    FROM matches m
    ORDER BY
      m.year ASC,
      m.match_index ASC
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

  // Fetch full team list (REQUIRED for replay-engine)
  const { results: teamRows } = await db.prepare(`
    SELECT name FROM teams
  `).all();

  const teams = (teamRows || []).map(t => t.name);

  const engine = createReplayEngine(
    {
      k: params.kFactor,
      homeAdvantage: params.homeAdvantage,
      travelPer1000km: params.travelPer1000km,
      restPerRound: params.restPerRound,
      streakPts: params.streakPts,
      earlyBoost: params.earlyBoost,
      reversionWeight: params.reversionWeight,
      initialRating: params.initialRating
    },
    teams
  );

  const { results } = await db.prepare(`
    SELECT
      m.year,
      m.round,
      m.match_index,
      m.game_num,
      m.id,

      m.venue_name,
      m.primary_home_venue,

      m.home_odds,
      m.away_odds,
      m.home_odds_open,
      m.away_odds_open,
      m.home_odds_close,
      m.away_odds_close,

      m.home_score,
      m.away_score,

      ht.name as home_team,
      at.name as away_team
    FROM matches m
    JOIN teams ht ON m.home_team_id = ht.id
    JOIN teams at ON m.away_team_id = at.id
    WHERE m.completed = 1
      AND m.home_score IS NOT NULL
      AND m.away_score IS NOT NULL
    ORDER BY
      m.year ASC,
      m.match_index ASC
  `).all();

  const replay = engine.replayMatches(results || [], { applyByes: true });

  const headers = [
    "year","round","game_num","match_id",
    "home_team","away_team",

    "home_elo_before","away_elo_before",

    "venue_name",
    "primary_home_venue",

    "home_odds","away_odds",
    "home_odds_open","away_odds_open",
    "home_odds_close","away_odds_close",
    
    "round_no",
    "travel_km","travelAdj",

    "home_rest","away_rest","rest_diff","restAdj",
    "home_streak","away_streak","streak_diff","streakAdj",

    "dr",
    "win_expectancy",
    "predicted_margin",
    "predicted_win_prob",

    "home_score","away_score",
    "actual_result","actual_margin",

    "rawBucket","idx","term1","term2",
    "early","baseK","finalK",
    "delta",

    "home_elo_after","away_elo_after",

    "ladder_locked_before",
    "ladder_locked_after",
    "season_reset",
    "bye_applied_this_match",

    "home_pts_after","away_pts_after",
    "home_margin_after","away_margin_after",
    "home_rank_before_round","away_rank_before_round",
    "homeRankingScore_before_round","awayRankingScore_before_round",
    "homeRankingScore_after_match","awayRankingScore_after_match"
  ];

  const rows = replay.rows.map(r => {
    const m = r.match;
    const out = r.out;

    return [
      m.year,
      m.round,
      m.match_index,
      m.game_num,
      m.id,
      m.home_team,
      m.away_team,

      out.homeEloBefore,
      out.awayEloBefore,

      m.venue_name ?? "",
      m.primary_home_venue ?? "",

      m.home_odds ?? "",
      m.away_odds ?? "",
      m.home_odds_open ?? "",
      m.away_odds_open ?? "",
      m.home_odds_close ?? "",
      m.away_odds_close ?? "",
      out.effectiveRound,
      out.travel_km,
      out.travelAdj,

      out.homeRest ?? "",
      out.awayRest ?? "",
      out.rest_diff ?? "",
      out.restAdj ?? "",

      out.homeStreak ?? "",
      out.awayStreak ?? "",
      out.streak_diff ?? "",
      out.streakAdj ?? "",

      out.dr,
      out.expected,
      out.predictedMargin,
      out.predictedWinProb,

      m.home_score,
      m.away_score,
      out.actualResult,
      out.margin,

      out.rawBucket,
      out.idx,
      out.term1,
      out.term2,
      
      out.early,
      out.baseK,
      out.finalK,

      out.delta,

      out.newHomeElo,
      out.newAwayElo,

      r.events.ladderLockedBefore,
      r.events.ladderLockedAfter,
      r.events.seasonReset,
      r.events.byeApplied,

      r.ladderAfter?.[m.home_team]?.compPoints ?? "",
      r.ladderAfter?.[m.away_team]?.compPoints ?? "",
      r.ladderAfter?.[m.home_team]?.margin ?? "",
      r.ladderAfter?.[m.away_team]?.margin ?? "",
      r.homeRankBeforeRound ?? "",
      r.awayRankBeforeRound ?? "",
      r.homeRankingScore_before_round ?? "",
      r.awayRankingScore_before_round ?? "",
      r.homeRankingScore_after_match ?? "",
      r.awayRankingScore_after_match ?? ""
    ];
  });

  const csv =
    engine.diagnosticFormulaBlock() +
    toCsv(headers, rows);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=diagnostic.csv",
    }
  });
}