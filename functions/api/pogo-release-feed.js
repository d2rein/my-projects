import { NAME_TO_DEX } from "./_pogo-name-map.js";

const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};

const AUTO_CACHE_KEY = "pogo-release-feed-auto-v3";
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

  const eventSections = await parseEvents(eventsHtml);
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

async function parseEvents(html) {
  const current = [];
  const upcoming = [];
  const now = Date.now();
  const regex = /<span\b[^>]*class="[^"]*event-header-item-wrapper[^"]*"([^>]*)>\s*<a\b([^>]*)>([\s\S]*?)<\/a>\s*<\/span>/gi;

  let match;
  while ((match = regex.exec(html))) {
    const spanAttrs = match[1];
    const anchorAttrs = match[2];
    const body = match[3];
    const href = absolutizeUrl(extractAttr(anchorAttrs, "href") || "", FEED_SOURCES.events);
    const isLocalTime = extractAttr(spanAttrs, "data-event-local-time") === "true";
    const startsAt = normalizeIso(
      extractAttr(spanAttrs, "data-event-start-date")
      || extractAttr(spanAttrs, "data-event-start-date-check")
    );
    const endsAt = normalizeIso(extractAttr(spanAttrs, "data-event-end-date"));
    const title = extractTitle(body) || "Event";
    if (/^Example Event Template/i.test(title)) continue;
    const category = extractCategory(body) || "Event";
    const pokemon = extractPokemonMentions(`${title} ${category}`);
    const item = makeCatalogSection({
      id: slugify(`event-${href || title}`),
      category: "Event",
      title,
      subtitle: category,
      startsAt,
      endsAt,
      localTime: isLocalTime,
      source: href,
      sourceLabel: "Leek Duck Events",
      updatedAt: startsAt || endsAt || new Date().toISOString(),
      entries: pokemon.length ? pokemon : []
    });

    const startTime = startsAt ? parseComparableDateValue(startsAt) : Number.POSITIVE_INFINITY;
    const endTime = endsAt ? parseComparableDateValue(endsAt) : Number.POSITIVE_INFINITY;
    if (startTime <= now && endTime >= now) {
      current.push(item);
    } else if (startTime > now) {
      upcoming.push(item);
    }
  }

  const mergedCurrent = mergeSectionsById(current).sort(compareByStart);
  const mergedUpcoming = mergeSectionsById(upcoming).sort(compareByStart);
  await enrichEventSections([...mergedCurrent, ...mergedUpcoming]);

  return {
    current: mergedCurrent,
    upcoming: mergedUpcoming
  };
}

function parseRaidBosses(html) {
  const current = [];
  const updatedAt = extractPageUpdatedAt(html);

  const regularMeta = extractRaidSelectorMeta(html, "regular-raid-selector");
  const shadowMeta = extractRaidSelectorMeta(html, "shadow-raid-selector");

  const regularSlice = sliceBetween(html, '<div class="raid-bosses"', "<h2>Shadow Raids</h2>");
  const shadowSlice = sliceFrom(html, '<div class="shadow-raid-bosses"', 40000);

  const regularEntries = extractRaidEntriesFromContainer(regularSlice);
  if (regularEntries.length) {
    current.push(makeCatalogSection({
      id: "raids",
      category: "Raids",
      title: regularMeta.title || "Current Raids",
      subtitle: regularMeta.description || "Current raid boss pool",
      startsAt: regularMeta.startsAt,
      endsAt: regularMeta.endsAt,
      source: FEED_SOURCES.raidBosses,
      sourceLabel: "Leek Duck Raid Bosses",
      updatedAt,
      entries: regularEntries
    }));
  }

  const shadowEntries = extractRaidEntriesFromContainer(shadowSlice, { shadow: true });
  if (shadowEntries.length) {
    current.push(makeCatalogSection({
      id: "shadow-raids",
      category: "Shadow Raids",
      title: shadowMeta.title || "Current Shadow Raids",
      subtitle: shadowMeta.description || "Catchable from current Shadow Raids",
      startsAt: shadowMeta.startsAt,
      endsAt: shadowMeta.endsAt,
      source: FEED_SOURCES.raidBosses,
      sourceLabel: "Leek Duck Raid Bosses",
      updatedAt,
      entries: shadowEntries
    }));
  }

  return { current };
}

function parseRocketLineups(html) {
  const encounters = [];
  const profiles = extractBlocksByStartRegex(html, /<div\b[^>]*class="[^"]*\brocket-profile\b[^"]*"[^>]*>/gi);

  for (const profileHtml of profiles) {
    const profileName = extractProfileName(profileHtml) || "Rocket";
    const slotHtmlBlocks = extractRocketSlotBlocks(profileHtml);
    for (const encounterHtml of slotHtmlBlocks) {
      if (!isCatchableRocketSlot(encounterHtml)) {
        continue;
      }
      const nameRegex = /<span\b[^>]*class="[^"]*\bshadow-pokemon\b[^"]*"[^>]*data-pokemon="([^"]+)"/gi;
      let nameMatch;
      while ((nameMatch = nameRegex.exec(encounterHtml))) {
        const name = decodeHtml(nameMatch[1]).replace(/^Shadow\s+/i, "").trim();
        const base = makeEntryFromName(name, "shadow", {
          details: [profileName],
          matchingLists: ["shadow", "purified"],
          shiny: /class="[^"]*\bshiny-icon\b/i.test(nameMatch[0])
        });
        if (base) encounters.push(base);
      }
    }
  }

  return makeCatalogSection({
    id: "rocket-catchable-shadows",
    category: "Rocket",
    title: "Current Rocket Catchables",
    subtitle: "Only catchable Shadow encounters from leaders, Giovanni, and grunts",
    source: FEED_SOURCES.rocket,
    sourceLabel: "Leek Duck Rocket Lineups",
    updatedAt: extractPageUpdatedAt(html),
    entries: mergeEntries(encounters),
    checksAgainstLists: ["shadow", "purified"]
  });
}

function extractRocketSlotBlocks(html) {
  return [...html.matchAll(/<div\b[^>]*class="[^"]*\bslot\b[^"]*"[^>]*>[\s\S]*?<\/div>/gi)]
    .map(match => match[0]);
}

function isCatchableRocketSlot(html) {
  return /class="[^"]*\bslot\b[^"]*\bencounter\b/i.test(html)
    || /class="[^"]*\bencounter-icon\b[^"]*"[\s\S]*?#poke-ball/i.test(html);
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
      subtitle: "All currently listed encounter rewards and tasks",
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
    const entries = extractNamesFromCardBlock(match[3])
      .map(name => makeEntryFromName(name, "pokemon", { details: [title] }))
      .filter(Boolean);
    if (!entries.length) continue;
    current.push(makeCatalogSection({
      id: slugify(`eggs-${title}`),
      category: "Eggs",
      title,
      subtitle: "Current hatch pool",
      source: FEED_SOURCES.eggs,
      sourceLabel: "Leek Duck Eggs",
      updatedAt: extractPageUpdatedAt(html),
      entries: mergeEntries(entries)
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

function extractResearchRewards(html) {
  const entries = [];
  const taskBlocks = extractBlocksByStartRegex(html, /<li\b[^>]*class="[^"]*\btask-item\b[^"]*"[^>]*>/gi);
  for (const taskHtml of taskBlocks) {
    const taskText = decodeHtml(extractByClass(taskHtml, "task-text")).replace(/\s+/g, " ").trim();
    const rewardBlocks = extractBlocksByStartRegex(taskHtml, /<li\b[^>]*class="[^"]*\breward\b[^"]*"[^>]*data-reward-type="encounter"[^>]*>/gi);
    for (const rewardHtml of rewardBlocks) {
      const nameMatch = rewardHtml.match(/<span\b[^>]*class="[^"]*\breward-label\b[^"]*"[^>]*>\s*<span[^>]*>([^<]+)<\/span>/i);
      if (!nameMatch) continue;
      const name = decodeHtml(nameMatch[1]).trim();
      const entry = makeEntryFromName(name, "pokemon", {
        details: taskText ? [taskText] : [],
        shiny: /class="[^"]*\bshiny-icon\b/i.test(rewardHtml)
      });
      if (entry) entries.push(entry);
    }
  }
  return mergeEntries(entries);
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

function extractRaidSelectorMeta(html, selectorId) {
  const marker = `id="${selectorId}"`;
  const index = html.indexOf(marker);
  if (index === -1) {
    return {
      title: "",
      description: "",
      startsAt: null,
      endsAt: null
    };
  }

  const chunk = html.slice(index, index + 8000);
  return {
    title: decodeHtml(extractByClass(chunk, "title-text")).trim(),
    description: decodeHtml(extractByClass(chunk, "raid-description")).trim(),
    startsAt: normalizeIso(extractLabeledTime(chunk, "Starts:")),
    endsAt: normalizeIso(extractLabeledTime(chunk, "Ends:"))
  };
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

function extractByClass(html, className) {
  const regex = new RegExp(`<[^>]*class="[^"]*${escapeRegex(className)}[^"]*"[^>]*>([\\s\\S]*?)<\\/[^>]+>`, "i");
  const match = html.match(regex);
  return match ? stripTags(match[1]) : "";
}

function extractLabeledTime(html, label) {
  const regex = new RegExp(`${escapeRegex(label)}<\\/span><span[^>]*class="[^"]*time-value[^"]*"[^>]*>([^<]+)<`, "i");
  const match = html.match(regex);
  return match ? decodeHtml(match[1]).trim() : null;
}

function makeCatalogSection(section) {
  return {
    id: section.id,
    category: section.category,
    title: section.title,
    subtitle: section.subtitle || "",
    startsAt: section.startsAt || null,
    endsAt: section.endsAt || null,
    localTime: !!section.localTime,
    source: section.source || "",
    sourceLabel: section.sourceLabel || "",
    updatedAt: section.updatedAt || null,
    entries: mergeEntries(section.entries || []),
    checksAgainstLists: section.checksAgainstLists || null
  };
}

function makeEntryFromName(name, list, extras = {}) {
  const cleaned = cleanLeekDuckName(name);
  const dex = findDexByName(cleaned);
  if (!dex) return null;
  return {
    name: cleaned,
    dex,
    list,
    details: extras.details || [],
    matchingLists: extras.matchingLists || [list],
    shiny: !!extras.shiny
  };
}

function makeRaidEntry(name) {
  const list = /^Mega\s+/i.test(name) ? "mega" : "pokemon";
  return makeEntryFromName(name, list);
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
        list: inferListFromText(text),
        details: [],
        matchingLists: [inferListFromText(text)],
        shiny: false
      });
    }
  }
  return mergeEntries(hits);
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

function extractNamesFromParagraphs(html) {
  const names = [];
  const regex = /<p\b[^>]*class="[^"]*\bname\b[^"]*"[^>]*>([^<]+)<\/p>/gi;
  let match;
  while ((match = regex.exec(html))) {
    const value = decodeHtml(match[1]).trim();
    if (value) names.push(value);
  }
  return [...new Set(names)];
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
  const raw = String(value).trim();
  const floating = normalizeFloatingLocalDateTime(raw);
  if (floating) return floating;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseComparableDateValue(value) {
  if (!value) return Number.NaN;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(String(value))) {
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return Number.NaN;
    const [, year, month, day, hour, minute, second = "00"] = match;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)).getTime();
  }
  return Date.parse(value);
}

function normalizeFloatingLocalDateTime(raw) {
  if (!raw || hasExplicitTimeZone(raw)) return null;

  const isoLike = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (isoLike) {
    const [, year, month, day, hour, minute, second = "00"] = isoLike;
    return `${year}-${month}-${day}T${String(hour).padStart(2, "0")}:${minute}:${second}`;
  }

  const monthLike = raw.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4}),\s*(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (monthLike) {
    const [, monthName, day, year, hourText, minute, meridiem] = monthLike;
    const month = monthNameToNumber(monthName);
    if (!month) return null;
    let hour = Number(hourText);
    const upperMeridiem = meridiem.toUpperCase();
    if (upperMeridiem === "AM" && hour === 12) hour = 0;
    if (upperMeridiem === "PM" && hour !== 12) hour += 12;
    return `${year}-${month}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${minute}:00`;
  }

  return null;
}

function hasExplicitTimeZone(raw) {
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)
    || /\b(?:UTC|GMT)\b/i.test(raw);
}

function monthNameToNumber(name) {
  const key = String(name || "").trim().toLowerCase();
  return {
    january: "01",
    february: "02",
    march: "03",
    april: "04",
    may: "05",
    june: "06",
    july: "07",
    august: "08",
    september: "09",
    october: "10",
    november: "11",
    december: "12"
  }[key] || null;
}

function mergeEntries(entries) {
  const map = new Map();
  for (const entry of entries) {
    if (!entry?.dex || !entry?.list) continue;
    const key = `${entry.list}:${entry.dex}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        ...entry,
        details: uniqueStrings(entry.details || []),
        matchingLists: uniqueStrings(entry.matchingLists || [entry.list]),
        shiny: !!entry.shiny
      });
      continue;
    }

    existing.details = uniqueStrings([...(existing.details || []), ...(entry.details || [])]);
    existing.matchingLists = uniqueStrings([...(existing.matchingLists || [existing.list]), ...(entry.matchingLists || [])]);
    existing.shiny = existing.shiny || !!entry.shiny;
  }
  return [...map.values()];
}

function dedupeSections(sections) {
  const seen = new Set();
  return sections.filter(section => {
    if (!section?.id || seen.has(section.id)) return false;
    seen.add(section.id);
    return true;
  });
}

function mergeSectionsById(sections) {
  const map = new Map();
  for (const section of sections) {
    if (!section?.id) continue;
    const existing = map.get(section.id);
    if (!existing) {
      map.set(section.id, section);
      continue;
    }
    const existingScore = sectionCompletenessScore(existing);
    const nextScore = sectionCompletenessScore(section);
    if (nextScore > existingScore) {
      map.set(section.id, section);
    }
  }
  return [...map.values()];
}

function sectionCompletenessScore(section) {
  return [
    section.endsAt ? 4 : 0,
    section.startsAt ? 2 : 0,
    (section.entries || []).length ? 1 : 0
  ].reduce((sum, value) => sum + value, 0);
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

async function enrichEventSections(sections) {
  await Promise.all(sections.map(async section => {
    if (!section?.source) return;
    try {
      const html = await fetchText(section.source);
      const detailedEntries = extractEventArticleEntries(html);
      if (detailedEntries.length) {
        section.entries = mergeEntries([...(section.entries || []), ...detailedEntries]);
      }
      const articleUpdatedAt = extractPageUpdatedAt(html);
      if (articleUpdatedAt) {
        section.updatedAt = articleUpdatedAt;
      }
    } catch {
      // Keep the lightweight list-page section if the detail page fails.
    }
  }));
}

function extractEventArticleEntries(html) {
  const entries = [];
  const sectionRegex = /<(h2|h3)\b[^>]*>([\s\S]*?)<\/\1>([\s\S]*?)(?=<(h2|h3)\b|$)/gi;
  let match;

  while ((match = sectionRegex.exec(html))) {
    const heading = decodeHtml(stripTags(match[2])).replace(/\s+/g, " ").trim();
    const body = match[3];
    if (!heading) continue;

    const names = new Set([
      ...extractNamesFromClass(body, "pkmn-name"),
      ...extractRewardLabelNames(body),
      ...extractNamesFromClass(body, "name")
    ]);

    for (const name of names) {
      const list = inferListFromText(heading);
      const entry = makeEntryFromName(name, list, {
        details: [heading],
        matchingLists: list === "shadow" ? ["shadow", "purified"] : [list],
        shiny: /class="[^"]*\bshiny-icon\b/i.test(body)
      });
      if (entry) entries.push(entry);
    }
  }

  return mergeEntries(entries);
}

function extractNamesFromClass(html, className) {
  const names = [];
  const regex = new RegExp(`<[^>]*class="[^"]*${escapeRegex(className)}[^"]*"[^>]*>([\\s\\S]*?)<\\/[^>]+>`, "gi");
  let match;
  while ((match = regex.exec(html))) {
    const value = decodeHtml(stripTags(match[1])).replace(/\s+/g, " ").trim();
    if (value) names.push(value);
  }
  return names;
}

function extractRewardLabelNames(html) {
  const names = [];
  const regex = /<span\b[^>]*class="[^"]*\breward-label\b[^"]*"[^>]*>\s*<span[^>]*>([^<]+)<\/span>/gi;
  let match;
  while ((match = regex.exec(html))) {
    const value = decodeHtml(match[1]).replace(/\s+/g, " ").trim();
    if (value) names.push(value);
  }
  return names;
}

function extractRaidEntriesFromContainer(html, options = {}) {
  const entries = [];
  const tiers = extractBlocksByStartRegex(html, /<div\b[^>]*class="[^"]*\btier\b[^"]*"[^>]*>/gi);
  for (const tierHtml of tiers) {
    const tierLabel = decodeHtml(extractByClass(tierHtml, "tier-label")).replace(/\s+/g, " ").trim() || (options.shadow ? "Shadow Raids" : "Raids");
    const cards = extractBlocksByStartRegex(tierHtml, /<div\b[^>]*class="[^"]*\bcard\b[^"]*"[^>]*>/gi);
    for (const cardHtml of cards) {
      const name = decodeHtml(extractTagTextWithClass(cardHtml, "name")).trim();
      if (!name) continue;
      const list = options.shadow ? "shadow" : (/^Mega\s+/i.test(name) ? "mega" : "pokemon");
      const cleanedName = options.shadow ? name.replace(/^Shadow\s+/i, "") : name;
      const entry = makeEntryFromName(cleanedName, list, {
        details: [tierLabel],
        matchingLists: options.shadow ? ["shadow", "purified"] : [list],
        shiny: /class="[^"]*\bshiny-icon\b/i.test(cardHtml)
      });
      if (entry) entries.push(entry);
    }
  }
  return mergeEntries(entries);
}

function extractProfileName(html) {
  const nameMatch = html.match(/<div\b[^>]*class="[^"]*\bname\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  return nameMatch ? decodeHtml(stripTags(nameMatch[1])).replace(/\s+/g, " ").trim() : "";
}

function extractProfileTitle(html) {
  const titleMatch = html.match(/<div\b[^>]*class="[^"]*\btitle\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  return titleMatch ? decodeHtml(stripTags(titleMatch[1])).replace(/\s+/g, " ").trim() : "";
}

function extractEncounterNumber(html) {
  const numberMatch = html.match(/<span\b[^>]*class="[^"]*\bnumber\b[^"]*"[^>]*>(\d+)<\/span>/i);
  return numberMatch ? Number(numberMatch[1]) : null;
}

function getCatchableEncounterNumber(profileTitle) {
  const normalized = normalizeName(profileTitle);
  if (normalized.includes("team go rocket leader")) return 1;
  if (normalized.includes("team go rocket boss")) return 3;
  return null;
}

function uniqueStrings(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function extractBlocksByStartRegex(html, startRegex) {
  const starts = [...html.matchAll(startRegex)]
    .map(match => match.index)
    .filter(index => Number.isInteger(index));

  if (!starts.length) return [];

  return starts.map((start, index) => {
    const end = starts[index + 1] ?? html.length;
    return html.slice(start, end);
  });
}

function absolutizeUrl(href, base) {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function extractAttr(attrs, name) {
  const regex = new RegExp(`${escapeRegex(name)}="([^"]*)"`, "i");
  const match = attrs.match(regex);
  return match ? decodeHtml(match[1]) : "";
}

function sliceBetween(html, startMarker, endMarker) {
  const start = html.indexOf(startMarker);
  if (start === -1) return "";
  const end = html.indexOf(endMarker, start);
  return end === -1 ? html.slice(start) : html.slice(start, end);
}

function sliceFrom(html, startMarker, length) {
  const start = html.indexOf(startMarker);
  if (start === -1) return "";
  return html.slice(start, start + length);
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
