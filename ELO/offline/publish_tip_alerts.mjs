import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { finalTipRecommendation } from "../shared/tipping-policy.js";

const args = parseArgs(process.argv.slice(2));
const season = Number(args.season || new Date().getFullYear());
const apiUrl = String(args["api-url"] || "https://nrl-elo-api.d2-rein.workers.dev").replace(/\/$/, "");
const brokerUrl = String(args["broker-url"] || process.env.ALERT_BROKER_URL || "").replace(/\/$/, "");
const keyFile = args["broker-key-file"];
const stateFile = path.resolve(args["state-file"] || "ELO/offline/experiments/EXP-2026-021-prospective-signal-archive/data/service/tip_alert_state.json");
const key = keyFile ? (await fs.readFile(path.resolve(keyFile), "utf8")).trim() : String(process.env.ALERT_NRL_KEY || "").trim();
const dryRun = Boolean(args["dry-run"] || !brokerUrl || !key);

const [forecastResponse, marketResponse] = await Promise.all([
  fetch(`${apiUrl}/api/prospective/forecasts?season=${season}`, { cache: "no-store" }),
  fetch(`${apiUrl}/api/prospective/markets?season=${season}&competition=NRL`, { cache: "no-store" }),
]);
if (!forecastResponse.ok || !marketResponse.ok) throw new Error(`Elo alert inputs unavailable: forecasts=${forecastResponse.status}, markets=${marketResponse.status}`);
const forecastPayload = await forecastResponse.json();
const markets = await marketResponse.json();
const previous = await readJson(stateFile, { alerts: {} });
const next = { generatedAt: new Date().toISOString(), alerts: { ...previous.alerts } };
const actions = [];

for (const forecast of forecastPayload.forecasts || []) {
  const kickoff = Date.parse(forecast.kickoff || "");
  if (Number.isFinite(kickoff) && kickoff <= Date.now()) continue;
  const market = selectMarket(markets, forecast);
  const row = market ? {
    ...forecast,
    liveOdds: true,
    liveHome: market.lastHome,
    liveAway: market.lastAway,
    openHome: market.openingHome,
    openAway: market.openingAway,
    closeSource: market.source,
  } : forecast;
  const decision = finalTipRecommendation(row, "NRL");
  const alertId = `nrl:${season}:${forecast.nrl_match_id}`;
  const signature = decision.actionable ? `${decision.recommendedTip}|${decision.reason}` : "resolved";
  if (!decision.actionable && !previous.alerts?.[alertId]) {
    next.alerts[alertId] = { signature, updatedAt: next.generatedAt };
    continue;
  }
  if (previous.alerts?.[alertId]?.signature === signature) continue;
  const alert = decision.actionable ? {
    id: alertId,
    category: "nrl",
    action: "upsert",
    title: "Consider changing your NRL tip",
    body: `${forecast.home} v ${forecast.away}: ${decision.baseTip} → ${decision.recommendedTip} (${decision.reason})`,
    url: "https://drein.net/ELO/2027/",
    priority: "high",
    sticky: true,
    expiresAt: Number.isFinite(kickoff) ? new Date(kickoff).toISOString() : undefined,
    data: { matchId: forecast.nrl_match_id, baseTip: decision.baseTip, recommendedTip: decision.recommendedTip, reason: decision.reason },
  } : {
    id: alertId,
    category: "nrl",
    action: "resolve",
    title: "NRL tip review cleared",
    body: `${forecast.home} v ${forecast.away} no longer has an active tip-change recommendation`,
    data: { matchId: forecast.nrl_match_id },
  };
  actions.push(alert);
  next.alerts[alertId] = { signature, updatedAt: next.generatedAt };
}

for (const alert of actions) {
  if (!dryRun) await publish(alert);
  process.stdout.write(`${dryRun ? "DRY RUN" : "PUBLISHED"} ${alert.action} ${alert.id}: ${alert.body}\n`);
}
if (!dryRun) {
  await fs.mkdir(path.dirname(stateFile), { recursive: true });
  const temporary = `${stateFile}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(next, null, 2) + "\n", "utf8");
  await fs.rename(temporary, stateFile);
}
process.stdout.write(JSON.stringify({ ok: true, dryRun, evaluated: (forecastPayload.forecasts || []).length, actions: actions.length }) + "\n");

async function publish(alert) {
  const response = await fetch(`${brokerUrl}/api/alerts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(alert),
  });
  if (!response.ok) throw new Error(`Alert broker HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`);
}

function selectMarket(rows, forecast) {
  return (rows || []).filter(row => canonical(row.home) === canonical(forecast.home) && canonical(row.away) === canonical(forecast.away))
    .sort((a, b) => scoreMarket(b) - scoreMarket(a))[0] || null;
}
function scoreMarket(row) { const observed = Date.parse(row.lastObservedAt || ""); return (row.bookmaker === "Sportsbet" ? 10 : 0) + (String(row.source).includes("sportsbet_public_listing") ? 5 : 0) + (Number.isFinite(observed) ? observed / 1e15 : 0); }
function canonical(value) { return String(value || "").toLowerCase().replace(/cronulla-sutherland|cronulla/g, "sharks").replace(/north queensland|nq/g, "cowboys").replace(/new zealand/g, "").replace(/south sydney/g, "").replace(/canterbury-bankstown/g, "").replace(/st\.? george illawarra/g, "dragons").replace(/sydney /g, "").replace(/newcastle /g, "").replace(/penrith /g, "").replace(/brisbane /g, "").replace(/canberra /g, "").replace(/gold coast /g, "").replace(/manly-warringah /g, "").replace(/melbourne /g, "").replace(/parramatta /g, "").replace(/wests /g, "").trim(); }
function parseArgs(values) { const out = {}; for (let i = 0; i < values.length; i += 1) { const value = values[i]; if (!value.startsWith("--")) continue; const key = value.slice(2); if (values[i + 1] && !values[i + 1].startsWith("--")) out[key] = values[++i]; else out[key] = true; } return out; }
async function readJson(file, fallback) { try { return JSON.parse(await fs.readFile(file, "utf8")); } catch { return fallback; } }
