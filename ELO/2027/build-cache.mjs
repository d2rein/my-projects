import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const offline = path.join(root, "offline");
const outDir = path.join(here, "data");

function csv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ""; }
    else if (ch === '\n') { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const headers = rows.shift() || [];
  if (headers.length) headers[0] = headers[0].replace(/^\uFEFF/, "");
  return rows.filter(r => r.some(Boolean)).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
}

const readCsv = p => csv(fs.readFileSync(p, "utf8"));
const num = value => value === "" || value == null || !Number.isFinite(Number(value)) ? null : Number(value);
const truth = value => value === true || value === 1 || value === "1" || value === "True" || value === "true";
const key = row => `${row.year}|${String(row.home_team).trim()}|${String(row.away_team).trim()}`;
const isRegular = round => /^Rd\s*\d+/i.test(String(round || ""));
const roundNo = round => num(String(round || "").match(/\d+/)?.[0]) ?? 999;
const canonicalTeam = value => ({
  "Cronulla-Sutherland Sharks":"Cronulla Sharks", Sharks:"Cronulla Sharks",
  Roosters:"Sydney Roosters", Warriors:"New Zealand Warriors", Knights:"Newcastle Knights"
}[String(value).trim()] || String(value).trim());

const matchesPath = path.join(offline, "snapshots", "prod-observed-2026-09-11", "matches.json");
const oddsPath = path.join(offline, "experiments", "EXP-2026-011-odds-review", "all_game_predictions.csv");
const gatePath = path.join(offline, "experiments", "EXP-2026-018-rookie-odds-overlay", "run-002", "game_overlap.csv");
const fixedPath = path.join(offline, "experiments", "EXP-2026-017-rookie-validation", "run-006", "fixed_candidate_predictions.csv");
const selectedMarginPath = path.join(offline, "experiments", "EXP-2026-028-margin-alternative-models", "run-001", "selected_predictions.csv");
const refinedMarginPath = path.join(offline, "experiments", "EXP-2026-028-margin-alternative-models", "run-001", "discrete_refined_predictions.csv");
const finalsPath = path.join(offline, "experiments", "EXP-2026-029-finals-week1-holdout", "run-001", "predictions.csv");
const prospectiveMarketPath = path.join(offline, "experiments", "EXP-2026-021-prospective-signal-archive", "data", "observations", "market_observations.csv");
const recoveredPath = path.join(offline, "experiments", "EXP-2026-031-recovered-historical-models", "run-003", "website_payload.json");
const recovered = JSON.parse(fs.readFileSync(recoveredPath, "utf8"));
const recoveredById = new Map(recovered.ownPredictions.map(r=>[Number(r.id),r]));
const recoveredByYear = new Map(recovered.ownYearly.map(r=>[r.year,r]));

const rawMatches = JSON.parse(fs.readFileSync(matchesPath, "utf8")).sort((a,b) => Number(a.year)-Number(b.year) || Number(a.match_index)-Number(b.match_index));
const odds = readCsv(oddsPath);
const gates = readCsv(gatePath);
const fixed = readCsv(fixedPath);
const selectedMargins = readCsv(selectedMarginPath);
const refinedMargins = readCsv(refinedMarginPath);
const finals = readCsv(finalsPath);
const prospective = fs.existsSync(prospectiveMarketPath) ? readCsv(prospectiveMarketPath) : [];

const oddsById = new Map(odds.map(r => [Number(r.match_id), r]));
const gateById = new Map(gates.filter(r => r.candidate_label === "steps_0_5_20_robust_gate6").map(r => [Number(r.match_id), r]));
const fixedByIndex = new Map(fixed.filter(r => r.candidate_label === "steps_0_5_20_robust_gate6").map(r => [Number(r.elo_index), r]));
const stableById = new Map(selectedMargins.map(r => [Number(r.match_id), r]));
const refinedById = new Map(refinedMargins.map(r => [Number(r.match_id), r]));
const finalsByKey = new Map(finals.map(r => [`2026|${r.home_team}|${r.away_team}`, r]));

// Correct ladder replay: membership and byes are scoped to each season.
const ladderPicks = new Map();
for (const year of [...new Set(rawMatches.map(m => Number(m.year)))]) {
  const season = rawMatches.filter(m => Number(m.year) === year);
  const regular = season.filter(m => isRegular(m.round));
  const active = [...new Set(regular.flatMap(m => [m.home_team, m.away_team]).filter(Boolean))];
  const ladder = Object.fromEntries(active.map(t => [t, { points: 0, for: 0, against: 0 }]));
  const rounds = [...new Set(regular.map(m => m.round))].sort((a,b) => roundNo(a)-roundNo(b));
  for (const round of rounds) {
    const games = regular.filter(m => m.round === round);
    const ranked = active.slice().sort((a,b) => ladder[b].points-ladder[a].points || (ladder[b].for-ladder[b].against)-(ladder[a].for-ladder[a].against) || a.localeCompare(b));
    const rank = new Map(ranked.map((t,i) => [t,i+1]));
    for (const m of games) {
      ladderPicks.set(Number(m.id), rank.get(m.home_team) < rank.get(m.away_team) ? m.home_team : m.away_team);
      if (m.home_score == null || m.away_score == null) continue;
      const h = ladder[m.home_team], a = ladder[m.away_team];
      h.for += Number(m.home_score); h.against += Number(m.away_score);
      a.for += Number(m.away_score); a.against += Number(m.home_score);
      if (m.home_score > m.away_score) h.points += 2;
      else if (m.away_score > m.home_score) a.points += 2;
      else { h.points++; a.points++; }
    }
    const played = new Set(games.flatMap(m => [m.home_team,m.away_team]));
    for (const team of active) if (!played.has(team)) ladder[team].points += 2;
  }
}

const compact = rawMatches.map((m, index) => {
  const o = oddsById.get(Number(m.id));
  const g = gateById.get(Number(m.id));
  const f = fixedByIndex.get(index);
  const s = stableById.get(Number(m.id));
  const r = refinedById.get(Number(m.id));
  const fin = finalsByKey.get(key(m));
  const historicalForecast = recoveredById.get(Number(m.id));
  const bstarP = num(o?.Bstar_home_probability) ?? num(g?.bstar_probability) ?? num(fin?.base_home_probability);
  const candidateP = num(g?.candidate_probability) ?? num(f?.candidate_probability) ?? num(fin?.home_probability) ?? bstarP;
  const candidateDr = num(s?.candidate_dr) ?? num(r?.candidate_dr) ?? num(fin?.candidate_dr) ?? (candidateP == null ? null : -400 * Math.log10(1 / candidateP - 1));
  const explicitHome = num(o?.home_odds_close_explicit);
  const explicitAway = num(o?.away_odds_close_explicit);
  const effectiveHome = num(o?.home_odds_close_effective);
  const effectiveAway = num(o?.away_odds_close_effective);
  return {
    id:Number(m.id), year:Number(m.year), round:m.round, matchIndex:Number(m.match_index), game:Number(m.game_num),
    date:o?.match_date || fin?.match_date_utc || null, home:m.home_team, away:m.away_team,
    hs:num(m.home_score), as:num(m.away_score), venue:m.venue_name || fin?.venue || o?.venue || null,
    productionP:num(o?.B0_home_probability), bstarP, candidateP, candidateDr,
    actualForecastP:historicalForecast?.p ?? null,
    lineupMargin:num(g?.lineup_margin_adjustment) ?? num(f?.lineup_margin_adjustment) ?? num(fin?.capped_lineup_adjustment),
    rookieGate:truth(g?.adjustment_applied) || truth(f?.adjustment_applied) || truth(fin?.gate_applied),
    openHome:num(o?.home_odds_open), openAway:num(o?.away_odds_open),
    closeHome:effectiveHome, closeAway:effectiveAway, explicitClose:explicitHome != null && explicitAway != null,
    closeSource:o?.close_price_source || null, closeHomeP:num(o?.close_home_probability_no_vig), openHomeP:num(o?.open_home_probability_no_vig),
    r1:truth(g?.R1_new_candidate_fires), r2:truth(g?.R2_new_candidate_fires) || truth(o?.high_confidence_close_veto_65), r3:truth(g?.R3_major_move_flag),
    stableMargin:num(s?.["discrete_b1.5_h1000_u0_even"]), refinedMargin:num(r?.prediction) ?? num(fin?.refined_margin),
    generalMargin:candidateDr == null ? null : (Math.abs(candidateDr)<85?4:Math.abs(candidateDr)<185?8:10),
    ladderTip:ladderPicks.get(Number(m.id)) || null
  };
});

function correct(row, tip) {
  if (row.hs == null || row.as == null || !tip) return null;
  if (row.hs === row.as) return true;
  return tip === (row.hs > row.as ? row.home : row.away);
}
function noVigTip(row, which) {
  const p = which === "open" ? row.openHomeP : row.closeHomeP;
  return p == null || p === .5 ? null : p > .5 ? row.home : row.away;
}
const performance = [];
for (const year of [...new Set(compact.map(r=>r.year))].filter(y=>y>=2017)) {
  const rows = compact.filter(r=>r.year===year && r.hs!=null && r.as!=null);
  const metric = selector => { const vals=rows.map(selector).filter(v=>v!==null); return {correct:vals.filter(Boolean).length,games:vals.length}; };
  const margins = rows.filter(r => r.game === 1 && isRegular(r.round) && r.stableMargin != null);
  const marginExact = margins.filter(r => {
    const tipHome = (r.candidateP ?? .5) >= .5;
    const pred = tipHome ? Math.abs(r.stableMargin) : -Math.abs(r.stableMargin);
    return pred === r.hs-r.as;
  }).length;
  const marginError = margins.reduce((sum,r) => {
    const pred=((r.candidateP??.5)>=.5?1:-1)*Math.abs(r.stableMargin); return sum+Math.abs(pred-(r.hs-r.as));
  },0);
  performance.push({year,games:rows.length,
    production:metric(r=>{const p=r.productionP??r.bstarP;return correct(r,p==null?null:p>=.5?r.home:r.away)}),
    bstar:metric(r=>correct(r,r.bstarP==null?null:r.bstarP>=.5?r.home:r.away)),
    candidate:metric(r=>correct(r,r.candidateP==null?null:r.candidateP>=.5?r.home:r.away)),
    ladder:metric(r=>correct(r,r.ladderTip)),open:metric(r=>correct(r,noVigTip(r,"open"))),close:metric(r=>correct(r,noVigTip(r,"close"))),
    actualForecast:year===2026?{correct:130,games:204,status:"observed"}:recoveredByYear.get(year)??null,
    modelUsed:year===2026?"2026 production":recoveredByYear.has(year)?`${year} historical`:null,
    expected:year===2026?.6667:null,
    margin:{exact:marginExact,games:margins.length,error:marginError}
  });
}

const jokerRows = compact.filter(r=>r.year===2026 && isRegular(r.round));
const joker = [...new Set(jokerRows.map(r=>r.round))].sort((a,b)=>roundNo(a)-roundNo(b)).map(round=>{
  const rows=jokerRows.filter(r=>r.round===round), stats={round,c10:0,c15:0,c20:0,c25:0,c30:0,eloEv:0,broncosEv:0,actual:0,games:rows.length,selected:false};
  for(const r of rows){const p=r.productionP??r.bstarP??.5,f=Math.max(p,1-p); if(f>=.6)stats.c10++;if(f>=.65)stats.c15++;if(f>=.7)stats.c20++;if(f>=.75)stats.c25++;if(f>=.8)stats.c30++;stats.eloEv+=f;const fav=p>=.5?r.home:r.away;const pick=[r.home,r.away].includes("Brisbane Broncos")?"Brisbane Broncos":fav;stats.broncosEv+=pick===r.home?p:1-p;if(correct(r,pick))stats.actual++;}
  return stats;
});
const selectedJokers=[...joker].sort((a,b)=>b.broncosEv-a.broncosEv).slice(0,2).map(r=>r.round); joker.forEach(r=>r.selected=selectedJokers.includes(r.round));

// Current displayed line: one bookmaker, one timestamp, one paired H2H market.
// It is intentionally not an average or a best-price synthetic market.
const sportsbetGroups = new Map();
for (const row of prospective.filter(r => r.market_type === "h2h" && r.bookmaker === "Sportsbet")) {
  row.home_team = canonicalTeam(row.home_team); row.away_team = canonicalTeam(row.away_team); row.selection = canonicalTeam(row.selection);
  const eventKey = `${row.home_team}|${row.away_team}`;
  if (!sportsbetGroups.has(eventKey)) sportsbetGroups.set(eventKey, []);
  sportsbetGroups.get(eventKey).push(row);
}
const currentMarkets = [];
for (const rows of sportsbetGroups.values()) {
  const timestamps = [...new Set(rows.map(r => r.observed_at_utc))].sort();
  const pairAt = stamp => {
    const block = rows.filter(r => r.observed_at_utc === stamp), home = block.find(r => r.selection === r.home_team), away = block.find(r => r.selection === r.away_team);
    return home && away ? { home: num(home.decimal_odds), away: num(away.decimal_odds) } : null;
  };
  const firstStamp = timestamps.find(t => pairAt(t));
  const lastStamp = [...timestamps].reverse().find(t => pairAt(t));
  if (!firstStamp || !lastStamp) continue;
  const sample = rows[0], first = pairAt(firstStamp), last = pairAt(lastStamp);
  currentMarkets.push({home:sample.home_team,away:sample.away_team,kickoff:sample.kickoff_utc,bookmaker:"Sportsbet",source:"sportsbet_public_listing",openingObservedAt:firstStamp,openingHome:first.home,openingAway:first.away,lastObservedAt:lastStamp,lastHome:last.home,lastAway:last.away});
}

fs.mkdirSync(outDir,{recursive:true});
const payload={meta:{version:"2026-09-15-v1",builtAt:new Date().toISOString(),cutoff:"2026 regular season plus frozen Finals Week 1 predictions",historicalYears:[1998,2025],odds:"Historical: explicit single-book close when present, otherwise OddsPortal survey fallback. Current: latest paired Sportsbet H2H observation; never averaged. Market gates require paired prices."},matches:compact,currentMarkets,performance,joker:{"2026":{model:"prod-observed-2026-09-11",selected:selectedJokers,rows:joker}}};
fs.writeFileSync(path.join(outDir,"historical-cache.json"),JSON.stringify(payload));
fs.writeFileSync(path.join(outDir,"historical-model-comparison.json"),JSON.stringify({meta:recovered.meta,models:recovered.models,yearly:recovered.yearly,periods:recovered.periods,ownYearly:recovered.ownYearly}));
console.log(`Wrote ${compact.length} matches, ${performance.length} performance years, ${joker.length} joker rounds.`);
