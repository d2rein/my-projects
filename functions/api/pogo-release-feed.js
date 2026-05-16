import { NAME_TO_DEX } from "./_pogo-name-map.js";

const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};

const AUTO_CACHE_KEY = "pogo-release-feed-auto-v1";
const MANUAL_KEY = "pogo-release-feed-manual";
const CACHE_MS = 30 * 60 * 1000;

const FEED_SOURCES = {
  events: "https://leekduck.com/events/",
  raidBosses: "https://leekduck.com/raid-bosses/",
  rocket: "https://leekduck.com/rocket-lineups/",
  research: "https://leekduck.com/research/",
  eggs: "https://leekduck.com/eggs/"
};

const NORMALIZED_NAME_ENTRIES = Object.entries(NAME_TO_DEX)
  .map(([name, dex]) => ({
    name,
    dex,
    normalized: normalizeName(name)
  }))
  .sort((a, b) => b.normalized.length - a.normalized.length);

const FALLBACK_FEED = {
  updatedAt: null,
  generatedAt: null,
  generatedFrom: "fallback",
  sources: Object.entries(FEED_SOURCES).map(([name, url]) => ({ name, url })),
  releases: [],
  catalog: {
    current: [],
    upcoming: []
  }
};

export async function onRequestGet(context) {
  const { env, request } = context;
  const requestUrl = new URL(request.url);
  const forceRefresh = requestUrl.searchParams.get("refresh") === "1";

  if (!forceRefresh && env.POGO_TRACKER_KV) {
    const cached = await env.POGO_TRACKER_KV.get(AUTO_CACHE_KEY, "json");
    if (cached?.generatedAt && Date.now() - Date.parse(cached.generatedAt) < CACHE_MS) {
      return json(cached);
    }
  }

  try {
    const feed = await buildAutomaticFeed();
    if (env.POGO_TRACKER_KV) {
      await env.POGO_TRACKER_KV.put(AUTO_CACHE_KEY, JSON.stringify(feed));
    }
    return json(feed);
  } catch (error) {
    if (env.POGO_TRACKER_KV) {
      const manual = await env.POGO_TRACKER_KV.get(MANUAL_KEY, "json");
      if (manual) {
        return json({
          ...manual,
          warning: `Automatic feed refresh failed: ${error.message}`
        });
      }
      const stale = await env.POGO_TRACKER_KV.get(AUTO_CACHE_KEY, "json");
      if (stale) {
        return json({
          ...stale,
          warning: `Serving stale cached feed because refresh failed: ${error.message}`
        });
      }
    }

    return json(
      {
        ...FALLBACK_FEED,
        error: `Automatic feed refresh failed: ${error.message}`
      },
      200
    );
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  if (!env.POGO_TRACKER_KV) {
    return json({ error: "POGO_TRACKER_KV binding is not configured." }, 501);
  }

  if (env.POGO_TRACKER_TOKEN) {
    const provided = request.headers.get("x-pogo-token");
    if (provided !== env.POGO_TRACKER_TOKEN) {
      return json({ error: "Missing or invalid publish token." }, 401);
    }
  }

  const payload = await request.json();
  const envelope = {
    ...payload,
    publishedAt: new Date().toISOString(),
    mode: "manual"
  };
  await env.POGO_TRACKER_KV.put(MANUAL_KEY, JSON.stringify(envelope));
  return json({ ok: true, publishedAt: envelope.publishedAt });
}

async function buildAutomaticFeed() {
  const [eventsHtml, raidsHtml, rocketHtml, researchHtml, eggsHtml] = await Promise.all([
    fetchText(FEED_SOURCES.events),
    fetchText(FEED_SOURCES.raidBosses),
    fetchText(FEED_SOURCES.rocket),
    fetchText(FEED_SOURCES.research),
    fetchText(FEED_SOURCES.eggs)
  ]);

  const eventSections = parseEvents(eventsHtml);
  const raidSections = parseRaidBosses(raidsHtml);
  const rocketSection = parseRocketLineups(rocketHtml);
  const researchSections = parseResearch(researchHtml);
  const eggSections = parseEggs(eggsHtml);

  const currentCatalog = [
    ...eventSections.current,
    ...raidSections.current,
    rocketSection,
    ...researchSections.current,
    ...eggSections.current
  ].filter(Boolean);

  const upcomingCatalog = [...eventSections.upcoming];

  const releases = [
    ...buildEventReleases(eventSections),
    ...buildSectionReleases([...raidSections.current, rocketSection, ...researchSections.current, ...eggSections.current])
  ];

  const updatedAtCandidates = [
    ...currentCatalog.map(section => section.updatedAt).filter(Boolean),
    ...upcomingCatalog.map(section => section.updatedAt).filter(Boolean)
  ];

  return {
    updatedAt: updatedAtCandidates.sort().at(-1) || new Date().toISOString(),
    generatedAt: new Date().toISOString(),
    generatedFrom: "leekduck",
    sources: Object.entries(FEED_SOURCES).map(([name, url]) => ({ name, url })),
    releases,
    catalog: {
      current: currentCatalog,
      upcoming: upcomingCatalog
    }
  };
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "pogo-tracker-feed-bot/1.0 (+https://my-projects-cqs.pages.dev/)"
    }
  });
  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status}`);
  }
  return await response.text();
}

function parseEvents(html) {
  const current = [];
  const upcoming = [];
  const now = Date.now();
  const regex = /<a\b[^>]*class="[^"]*event-item-link[^"]*"[^>]*href="([^"]+)"[^>]*data-event-start-date="([^"]*)"[^>]*data-event-end-date="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

  let match;
  while ((match = regex.exec(html))) {
    const href = absolutizeUrl(match[1], FEED_SOURCES.events);
    const startsAt = normalizeIso(match[2]);
    const endsAt = normalizeIso(match[3]);
    const body = match[4];
    const title = extractTitle(body) || "Event";
    const category = extractCategory(body) || "Event";
    const pokemon = extractPokemonMentions(`${title} ${category}`);
    const item = makeCatalogSection({
      id: slugify(`event-${title}-${startsAt || "tba"}`),
      category: "Event",
      title,
      subtitle: category,
      startsAt,
      endsAt,
      source: href,
      sourceLabel: "Leek Duck Events",
      updatedAt: startsAt || endsAt || new Date().toISOString(),
      entries: pokemon.length ? pokemon : []
    });

    const startTime = startsAt ? Date.parse(startsAt) : Number.POSITIVE_INFINITY;
    const endTime = endsAt ? Date.parse(endsAt) : Number.POSITIVE_INFINITY;
    if (startTime <= now && endTime >= now) {
      current.push(item);
    } else if (startTime > now) {
      upcoming.push(item);
    }
  }

  current.sort(compareByStart);
  upcoming.sort(compareByStart);
  return { current, upcoming };
}

function parseRaidBosses(html) {
  const current = [];
  const blocks = [
    {
      key: "raids",
      label: "Current Raids",
      className: "raid-bosses",
      list: "pokemon",
      source: FEED_SOURCES.raidBosses
    },
    {
      key: "shadow-raids",
      label: "Current Shadow Raids",
      className: "shadow-raid-bosses",
      list: "shadow",
      source: FEED_SOURCES.raidBosses
    }
  ];

  for (const block of blocks) {
    const entries = parseNamedCardsFromContainer(html, block.className)
      .map(name => makeEntryFromName(name, block.list))
      .filter(Boolean);

    if (!entries.length) continue;
    current.push(makeCatalogSection({
      id: block.key,
      category: block.label,
      title: block.label,
      subtitle: block.list === "shadow" ? "Catchable from current Shadow Raids" : "Current raid boss pool",
      source: block.source,
      sourceLabel: "Leek Duck Raid Bosses",
      updatedAt: extractPageUpdatedAt(html),
      entries
    }));
  }

  return { current };
}

function parseRocketLineups(html) {
  const encounters = [];
  const regex = /<div\b[^>]*class="[^"]*\bslot encounter\b[^"]*"[^>]*>[\s\S]*?<span\b[^>]*class="[^"]*\bshadow-pokemon\b[^"]*"[^>]*data-pokemon="([^"]+)"/gi;
  let match;
  while ((match = regex.exec(html))) {
    const name = decodeHtml(match[1]).replace(/^Shadow\s+/i, "").trim();
    const base = makeEntryFromName(name, "shadow");
    if (base) encounters.push(base);
    const purified = makeEntryFromName(name, "purified");
    if (purified) encounters.push(purified);
  }

  return makeCatalogSection({
    id: "rocket-catchable-shadows",
    category: "Rocket",
    title: "Current Rocket Catchables",
    subtitle: "Only catchable Shadow encounters from leaders, Giovanni, and grunts",
    source: FEED_SOURCES.rocket,
    sourceLabel: "Leek Duck Rocket Lineups",
    updatedAt: extractPageUpdatedAt(html),
    entries: dedupeEntries(encounters)
  });
}

function parseResearch(html) {
  const current = [];
  const eventRegex = /<(section|div)\b[^>]*data-event-end="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;

  while ((match = eventRegex.exec(html))) {
    const body = match[3];
    const title = extractHeading(body);
    const entries = extractResearchRewards(body);
    if (!title || !entries.length) continue;
    current.push(makeCatalogSection({
      id: slugify(`research-${title}`),
      category: "Field Research",
      title,
      subtitle: "Event field research encounters",
      endsAt: normalizeIso(match[2]),
      source: FEED_SOURCES.research,
      sourceLabel: "Leek Duck Research",
      updatedAt: extractPageUpdatedAt(html),
      entries
    }));
  }

  const bodyEntries = extractResearchRewards(html);
  if (bodyEntries.length) {
    current.unshift(makeCatalogSection({
      id: "research-monthly",
      category: "Field Research",
      title: "Current Field Research Encounters",
      subtitle: "All currently listed encounter rewards",
      source: FEED_SOURCES.research,
      sourceLabel: "Leek Duck Research",
      updatedAt: extractPageUpdatedAt(html),
      entries: bodyEntries
    }));
  }

  return { current: dedupeSections(current) };
}

function parseEggs(html) {
  const current = [];
  const sectionRegex = /<(h2|h3)[^>]*>([^<]*Eggs[^<]*)<\/\1>([\s\S]*?)(?=<(h2|h3)\b|$)/gi;
  let match;

  while ((match = sectionRegex.exec(html))) {
    const title = decodeHtml(stripTags(match[2])).trim();
    const entries = extractNamesFromCardBlock(match[3]).map(name => makeEntryFromName(name, "pokemon")).filter(Boolean);
    if (!entries.length) continue;
    current.push(makeCatalogSection({
      id: slugify(`eggs-${title}`),
      category: "Eggs",
      title,
      subtitle: "Current hatch pool",
      source: FEED_SOURCES.eggs,
      sourceLabel: "Leek Duck Eggs",
      updatedAt: extractPageUpdatedAt(html),
      entries: dedupeEntries(entries)
    }));
  }

  return { current };
}

function buildEventReleases(eventSections) {
  const releases = [];
  for (const section of [...eventSections.current, ...eventSections.upcoming]) {
    releases.push({
      id: section.id,
      title: section.title,
      startsAt: section.startsAt || null,
      endsAt: section.endsAt || null,
      source: section.source,
      opportunities: (section.entries || []).map(entry => ({
        list: entry.list,
        dex: entry.dex,
        label: `${section.category}${section.subtitle ? ` - ${section.subtitle}` : ""}`
      }))
    });
  }
  return releases;
}

function buildSectionReleases(sections) {
  return sections
    .filter(section => (section.entries || []).length)
    .map(section => ({
      id: section.id,
      title: section.title,
      startsAt: section.startsAt || section.updatedAt || null,
      endsAt: section.endsAt || null,
      source: section.source,
      opportunities: section.entries.map(entry => ({
        list: entry.list,
        dex: entry.dex,
        label: section.category
      }))
    }));
}

function parseNamedCardsFromContainer(html, className) {
  const containerRegex = new RegExp(`<div\\b[^>]*class="[^"]*\\b${escapeRegex(className)}\\b[^"]*"[^>]*>`, "gi");
  const results = [];
  let match;
  while ((match = containerRegex.exec(html))) {
    const chunk = html.slice(match.index, match.index + 40000);
    results.push(...extractNamesFromCardBlock(chunk));
  }
  return [...new Set(results)];
}

function extractResearchRewards(html) {
  const names = [];
  const regex = /<li\b[^>]*class="[^"]*\breward\b[^"]*"[^>]*data-reward-type="encounter"[^>]*>[\s\S]*?<span\b[^>]*class="[^"]*\breward-label\b[^"]*"[^>]*>\s*<span[^>]*>([^<]+)<\/span>/gi;
  let match;
  while ((match = regex.exec(html))) {
    names.push(decodeHtml(match[1]).trim());
  }
  return dedupeEntries(names.map(name => makeEntryFromName(name, "pokemon")).filter(Boolean));
}

function extractNamesFromCardBlock(html) {
  const names = [];
  const regex = /<span\b[^>]*class="[^"]*\bname\b[^"]*"[^>]*>([^<]+)<\/span>/gi;
  let match;
  while ((match = regex.exec(html))) {
    const value = decodeHtml(match[1]).trim();
    if (value) names.push(value);
  }
  return names;
}

function extractTitle(html) {
  return extractTagText(html, "h2") || extractTagText(html, "h3") || extractTagText(html, "strong");
}

function extractCategory(html) {
  return extractTagTextWithClass(html, "event-type") || extractTagTextWithClass(html, "tag");
}

function extractHeading(html) {
  return extractTagText(html, "h2") || extractTagText(html, "h3");
}

function extractPageUpdatedAt(html) {
  const match = html.match(/<div\b[^>]*class="[^"]*\bpage-date\b[^"]*"[^>]*>[\s\S]*?<time[^>]*datetime="([^"]+)"/i)
    || html.match(/<time[^>]*datetime="([^"]+)"/i);
  return match ? normalizeIso(match[1]) : null;
}

function extractTagText(html, tagName) {
  const regex = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = html.match(regex);
  return match ? decodeHtml(stripTags(match[1])).trim() : "";
}

function extractTagTextWithClass(html, className) {
  const regex = new RegExp(`<[^>]*class="[^"]*${escapeRegex(className)}[^"]*"[^>]*>([\\s\\S]*?)<\\/[^>]+>`, "i");
  const match = html.match(regex);
  return match ? decodeHtml(stripTags(match[1])).trim() : "";
}

function makeCatalogSection(section) {
  return {
    id: section.id,
    category: section.category,
    title: section.title,
    subtitle: section.subtitle || "",
    startsAt: section.startsAt || null,
    endsAt: section.endsAt || null,
    source: section.source || "",
    sourceLabel: section.sourceLabel || "",
    updatedAt: section.updatedAt || null,
    entries: dedupeEntries(section.entries || [])
  };
}

function makeEntryFromName(name, list) {
  const cleaned = cleanLeekDuckName(name);
  const dex = findDexByName(cleaned);
  if (!dex) return null;
  return {
    name: cleaned,
    dex,
    list
  };
}

function extractPokemonMentions(text) {
  const normalizedText = normalizeName(text);
  const hits = [];
  for (const entry of NORMALIZED_NAME_ENTRIES) {
    if (!entry.normalized) continue;
    if (normalizedText.includes(entry.normalized)) {
      hits.push({
        name: entry.name,
        dex: entry.dex,
        list: inferListFromText(text)
      });
    }
  }
  return dedupeEntries(hits);
}

function inferListFromText(text) {
  const value = normalizeName(text);
  if (value.includes("mega")) return "mega";
  if (value.includes("shadow")) return "shadow";
  return "pokemon";
}

function findDexByName(name) {
  const exact = NAME_TO_DEX[name];
  if (exact) return exact;

  const normalized = normalizeName(name);
  const entry = NORMALIZED_NAME_ENTRIES.find(candidate => candidate.normalized === normalized);
  return entry?.dex || null;
}

function cleanLeekDuckName(name) {
  return decodeHtml(name)
    .replace(/^Shadow\s+/i, "")
    .replace(/^Mega\s+/i, "")
    .replace(/^Primal\s+/i, "")
    .replace(/\s+\(.*?\)\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&amp;/gi, "&")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function normalizeIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function dedupeEntries(entries) {
  const seen = new Set();
  return entries.filter(entry => {
    const key = `${entry.list}:${entry.dex}`;
    if (!entry?.dex || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeSections(sections) {
  const seen = new Set();
  return sections.filter(section => {
    if (!section?.id || seen.has(section.id)) return false;
    seen.add(section.id);
    return true;
  });
}

function compareByStart(a, b) {
  return new Date(a.startsAt || a.updatedAt || 0) - new Date(b.startsAt || b.updatedAt || 0);
}

function slugify(value) {
  return normalizeName(value).replace(/\s+/g, "-");
}

function stripTags(value) {
  return String(value || "").replace(/<[^>]+>/g, " ");
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function absolutizeUrl(href, base) {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: DEFAULT_HEADERS
  });
}
