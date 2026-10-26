const STATE_KEY = "pogo-availability-monitor-v1";
const POKEDEX_KEY = "site-account-state:pokedex";

export async function runPogoMonitor(env, publish) {
  if (!env.POGO_TRACKER_KV) return { skipped: "POGO_TRACKER_KV is not bound" };
  const now = new Date();
  const state = await loadState(env);
  const brisbaneDate = formatBrisbaneDate(now);
  const due = (state.scheduledStarts || []).some(value => {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) && timestamp <= now.getTime() && !state.handledStarts?.includes(value);
  });
  const dailyDue = state.lastDailyDate !== brisbaneDate && brisbaneHour(now) >= 5;
  if (!dailyDue && !due) return { skipped: "Nothing due", next: nextStart(state) };

  const feedUrl = String(env.POGO_FEED_URL || "https://drein.net/api/pogo-release-feed");
  const url = new URL(feedUrl);
  url.searchParams.set("refresh", "1");
  const response = await fetch(url, { headers: { "User-Agent": "Drein-Alerts-Pogo/1.0" } });
  if (!response.ok) throw new Error(`Pokémon feed refresh failed: HTTP ${response.status}`);
  const feed = await response.json();
  const account = await env.POGO_TRACKER_KV.get(POKEDEX_KEY, "json");
  const pokedex = account?.pokedex || null;
  if (!pokedex) throw new Error("Synced Pokédex state is unavailable");

  const active = missingAvailability(feed?.catalog?.current || [], pokedex);
  const previousKeys = new Set(state.activeKeys || []);
  const activeKeys = active.map(item => item.key);
  const initialized = Boolean(state.lastRefreshAt);
  if (initialized) {
    for (const item of active) {
      if (previousKeys.has(item.key)) continue;
      await publish({
        id: `pogo:${item.key}`,
        category: "pogo",
        action: "upsert",
        title: `${item.name} is now available`,
        body: `${item.name} is missing from your ${item.list} collection and is available via ${item.source}.`,
        url: "https://drein.net/pogo-availability.html",
        priority: "normal",
        sticky: false,
        expiresAt: item.endsAt || undefined,
        data: { dex: item.dex, list: item.list, source: item.source, startsAt: item.startsAt, endsAt: item.endsAt },
      });
    }
    for (const key of previousKeys) {
      if (activeKeys.includes(key)) continue;
      await publish({ id: `pogo:${key}`, category: "pogo", action: "resolve", title: "Pokémon availability ended", body: "This availability window has ended." });
    }
  }

  const scheduledStarts = collectUpcomingStarts(feed?.catalog?.upcoming || [], now);
  const handledStarts = [...new Set([...(state.handledStarts || []), ...(state.scheduledStarts || []).filter(value => Date.parse(value) <= now.getTime())])]
    .filter(value => Date.parse(value) > now.getTime() - 7 * 86_400_000);
  await saveState(env, {
    lastDailyDate: dailyDue ? brisbaneDate : state.lastDailyDate,
    lastRefreshAt: now.toISOString(),
    feedGeneratedAt: feed.generatedAt || null,
    scheduledStarts,
    handledStarts,
    activeKeys,
  });
  return { refreshed: true, baseline: !initialized, newAlerts: initialized ? active.filter(item => !previousKeys.has(item.key)).length : 0, scheduledStarts };
}

export function missingAvailability(sections, pokedex) {
  const result = [];
  for (const section of sections || []) {
    for (const entry of section.entries || []) {
      const lists = entry.matchingLists || [entry.list || "pokemon"];
      if (!isMissing(entry.dex, lists, pokedex)) continue;
      const list = lists.includes("shadow") || lists.includes("purified") ? "shadow" : lists.includes("mega") ? "mega" : lists.includes("gmax") ? "gmax" : "pokemon";
      const source = (entry.details || []).filter(Boolean).join(" | ") || section.subtitle || section.title || "Pokémon GO";
      const startsAt = normalizeBrisbaneInstant(section.startsAt);
      const endsAt = normalizeBrisbaneInstant(section.endsAt);
      const key = [list, entry.dex, slug(source), startsAt || "current", endsAt || "open"].join(":");
      result.push({ key, dex: Number(entry.dex), name: entry.name || `#${entry.dex}`, list, source, startsAt, endsAt });
    }
  }
  return dedupe(result, item => item.key);
}

export function normalizeBrisbaneInstant(value) {
  if (!value) return null;
  const raw = String(value);
  const floating = raw.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)$/);
  const timestamp = Date.parse(floating ? `${floating[1]}+10:00` : raw);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function collectUpcomingStarts(sections, now) {
  return [...new Set((sections || []).map(section => normalizeBrisbaneInstant(section.startsAt)).filter(value => {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) && timestamp > now.getTime();
  }))].sort();
}

function isMissing(dex, lists, pokedex) {
  const statuses = pokedex?.statuses || {};
  if (lists.includes("shadow") || lists.includes("purified")) return !bucketOwned(statuses.shadow, dex) && !bucketOwned(statuses.purified, dex);
  if (lists.includes("mega")) return !anyOwned(statuses.mega, key => key.startsWith(`mega::${dex}::`));
  if (lists.includes("gmax")) return !anyOwned(statuses.gmax, key => key.startsWith(`gmax::${dex}`));
  return !bucketOwned(statuses.pokemon, dex);
}
function bucketOwned(bucket, dex) { return anyOwned(bucket, key => key === `pokemon::${dex}` || key.startsWith(`alt::${dex}::`)); }
function anyOwned(bucket, predicate) { return Object.entries(bucket || {}).some(([key, value]) => predicate(key) && ["owned", "can-evolve", "trade"].includes(value)); }
function dedupe(values, keyFor) { return [...new Map(values.map(value => [keyFor(value), value])).values()]; }
function slug(value) { return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80); }
function formatBrisbaneDate(date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Brisbane", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
function brisbaneHour(date) { return Number(new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Brisbane", hour: "2-digit", hourCycle: "h23" }).format(date)); }
function nextStart(state) { return (state.scheduledStarts || []).find(value => !(state.handledStarts || []).includes(value)) || null; }
async function loadState(env) { const row = await env.ALERTS_DB.prepare("SELECT value_json FROM monitor_state WHERE key=?").bind(STATE_KEY).first(); try { return JSON.parse(row?.value_json || "{}"); } catch { return {}; } }
async function saveState(env, value) { await env.ALERTS_DB.prepare(`INSERT INTO monitor_state(key,value_json,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at`).bind(STATE_KEY, JSON.stringify(value), new Date().toISOString()).run(); }
