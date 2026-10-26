import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const snapshotsDir = path.join(dataDir, "snapshots");
const PF = "https://www.pollingforecast.com";
const READER = "https://r.jina.ai/";
const RATING_SOURCES = {
  cookHouse: "https://www.cookpolitical.com/ratings/house-race-ratings",
  cookSenate: "https://www.cookpolitical.com/ratings/senate-race-ratings",
  rcpHouse: "https://www.realclearpolling.com/maps/house/2026/toss-up",
  rcpSenate: "https://www.realclearpolling.com/maps/senate/2026/toss-up",
  insideHouse: "https://insideelections.com/office/house/",
  insideSenate: "https://insideelections.com/office/senate/",
  rcpSenateChanges: "https://www.realclearpolling.com/maps/senate/2026/toss-up/race-changes"
};

const stateNames = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming"
};
const stateCodes = Object.fromEntries(Object.entries(stateNames).map(([code, name]) => [name.toLowerCase(), code]));
const senateKey = code => code === "FL" || code === "OH" ? `${code}-S` : code;

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "user-agent": "midterm26-personal-dashboard/0.1" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function fetchReader(url) {
  const response = await fetch(`${READER}${url}`, { headers: { "user-agent": "midterm26-personal-dashboard/0.2" } });
  if (!response.ok) throw new Error(`${response.status} reader for ${url}`);
  const text = await response.text();
  const marker = text.indexOf("Markdown Content:");
  return marker >= 0 ? text.slice(marker + 17).trim() : text;
}

async function fetchReaderJson(url) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const text = await fetchReader(url);
      const objectAt = text.search(/[\[{]/);
      if (objectAt < 0) throw new Error(`No JSON in ${url}`);
      return JSON.parse(text.slice(objectAt));
    } catch (error) { lastError = error; }
  }
  throw lastError;
}

async function mapLimit(items, limit, fn) {
  const output = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      try { output[index] = await fn(items[index], index); }
      catch (error) { console.warn(error.message); output[index] = null; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return output;
}

function keyFromCompact(raw) {
  const match = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").match(/^([A-Z]{2})(AL|\d{1,2})$/);
  if (!match) return null;
  return `${match[1]}-${match[2] === "AL" ? "00" : match[2].padStart(2, "0")}`;
}

function parseCook(text, chamber) {
  const rows = {};
  let rating = null;
  const heading = /^(Solid D|Likely D|Lean D|Toss Up|Lean R|Likely R|Solid R)\s/;
  for (const line of text.split(/\r?\n/)) {
    const headingMatch = line.match(heading);
    if (headingMatch) rating = headingMatch[1];
    const item = line.match(/^\*\s+\[([^\]]+)\]\((https:\/\/www\.cookpolitical\.com\/(?:house|senate)\/race\/[^)]+)\)/);
    if (!rating || !item) continue;
    const label = item[1];
    const key = chamber === "house" ? keyFromCompact(label.split(/\s+/)[0]) : senateKey(label.match(/^([A-Z]{2})\b/)?.[1]);
    if (key) rows[key] = { source: "Cook", rating, url: item[2] };
  }
  return rows;
}

function parseInside(text, chamber) {
  const rows = {};
  const ratings = "Solid D|Likely D|Lean D|Tilt D|Toss-up|Tilt R|Lean R|Likely R|Solid R";
  for (const line of text.split(/\r?\n/)) {
    const item = line.match(new RegExp(`^\\*\\s+\\[([^\\]]+?) (${ratings})\\]\\((https:\\/\\/insideelections\\.com\\/[^)]+)\\)`));
    if (!item) continue;
    const code = item[3].match(/state-district=([a-z]{2})/i)?.[1].toUpperCase();
    const key = chamber === "house" ? keyFromCompact(item[1].split(/\s+/)[0]) : senateKey(code);
    if (key) rows[key] = { source: "Inside Elections", rating: item[2], url: item[3] };
  }
  return rows;
}

function parseRcp(text, chamber) {
  const rows = {};
  let rating = null;
  for (const line of text.split(/\r?\n/)) {
    const heading = line.trim().match(/^(Likely Dem|Leans Dem|Toss Up|Leans GOP|Likely GOP|Solid Democrats|Solid Republicans)(?:\s*\([^)]*\))?$/);
    if (heading) {
      rating = ({"Solid Democrats":"Solid D","Solid Republicans":"Solid R","Likely Dem":"Likely D","Leans Dem":"Lean D","Toss Up":"Toss-up","Leans GOP":"Lean R","Likely GOP":"Likely R"})[heading[1]];
      continue;
    }
    if (!rating) continue;
    for (const item of line.matchAll(/\[([^\]]+)\]\((https:\/\/www\.realclearpolling\.com\/[^)]+)\)/g)) {
      const rawLabel = item[1];
      const label = rawLabel.split(":")[0];
      const code = rawLabel.match(/^([A-Z]{2}):/)?.[1];
      const key = chamber === "house" ? keyFromCompact(label) : senateKey(code);
      if (key && !rows[key]) rows[key] = { source: "RCP", rating, url: item[2].replace("realclearpolling.comhttps//", "realclearpolling.com/") };
    }
  }
  return rows;
}

function parseRcpSenateChanges(text) {
  const changes = [];
  const pattern = /^\|\s*(\d{1,2}\/\d{1,2})\s*\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*([^|]+?)\s*\|[^|]*\|\s*([^|]+?)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|/;
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(pattern);
    if (!match) continue;
    const [month, day] = match[1].split("/").map(Number);
    const key = senateKey(stateCodes[match[2].trim().toLowerCase()]);
    if (key) changes.push({ date: `2026-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`, key, previous: match[4].trim(), rating: match[5].trim(), dem: +match[6], tossup: +match[7], rep: +match[8], url: match[3] });
  }
  return changes;
}

async function fetchRatings(previous) {
  try {
    const [cookHouse, cookSenate, rcpHouse, rcpSenate, insideHouse, insideSenate, rcpSenateChanges] = await Promise.all(Object.values(RATING_SOURCES).map(fetchReader));
    const sources = {
      cookHouse: parseCook(cookHouse, "house"), cookSenate: parseCook(cookSenate, "senate"),
      rcpHouse: parseRcp(rcpHouse, "house"), rcpSenate: parseRcp(rcpSenate, "senate"),
      insideHouse: parseInside(insideHouse, "house"), insideSenate: parseInside(insideSenate, "senate")
    };
    const raceRatings = {};
    for (const map of Object.values(sources)) for (const [key, row] of Object.entries(map)) (raceRatings[key] ||= []).push(row);
    return { fetchedAt: new Date().toISOString(), sourceUrls: RATING_SOURCES, raceRatings, rcpSenateChanges: parseRcpSenateChanges(rcpSenateChanges) };
  } catch (error) {
    console.warn(`Ratings refresh failed; keeping prior cache: ${error.message}`);
    return previous?.ratings || { fetchedAt: null, sourceUrls: RATING_SOURCES, raceRatings: {}, rcpSenateChanges: [] };
  }
}

function unflatten(values) {
  const hydrated = new Array(values.length);
  const seen = new Array(values.length).fill(false);
  function deref(index) {
    if (index === -1) return undefined;
    if (index === -2) return NaN;
    if (index === -3) return Infinity;
    if (index === -4) return -Infinity;
    if (index === -5) return -0;
    if (index === -6) return 0n;
    if (seen[index]) return hydrated[index];
    const source = values[index];
    if (source === null || typeof source !== "object") { seen[index] = true; return hydrated[index] = source; }
    const target = Array.isArray(source) ? [] : {};
    hydrated[index] = target;
    seen[index] = true;
    if (Array.isArray(source)) source.forEach(ref => target.push(typeof ref === "number" ? deref(ref) : ref));
    else Object.entries(source).forEach(([key, ref]) => target[key] = typeof ref === "number" ? deref(ref) : ref);
    return target;
  }
  return deref(0);
}

async function fetchFiftyPlusOne(chamber) {
  const payload = await fetchJson(`https://fiftyplusone.news/forecast/${chamber}/__data.json`);
  if (payload.nodes?.[0]?.data?.[1] !== false) throw new Error("Expected the public logged-out 50+1 payload");
  return {
    visual: unflatten(payload.nodes[1].data),
    forecast: unflatten(payload.nodes[2].data)
  };
}

async function fetchFiftyPlusOnePolls(pathname) {
  const payload = await fetchJson(`https://fiftyplusone.news${pathname}/__data.json`);
  const page = unflatten(payload.nodes.findLast(node => node?.data)?.data);
  if (!page?.chartData?.length) throw new Error(`No 50+1 polling average at ${pathname}`);
  return page.chartData;
}

function currentTerm(person) {
  return [...person.terms].reverse().find(term => term.type === "sen");
}

function caucusParty(party) {
  if (party === "Democrat") return "D";
  if (party === "Republican") return "R";
  return "IND(D)";
}

function summaryValue(rows, chamber, metric) {
  return rows.find(row => row.chamber === chamber && row.race_id == null && row.variable === "seats" && row.metric === metric && row.party === "DEM")?.value ?? null;
}

function ratingFromChance(chance) {
  const favorite = Math.max(chance, 1 - chance);
  const party = chance >= .5 ? "D" : "R";
  return `${favorite < .60 ? "Toss-up" : favorite < .80 ? "Lean" : favorite < .95 ? "Likely" : "Safe"} ${party}`;
}

function normalizeHouseFiftyPlusOne(summary, metadata) {
  const byKey = new Map(metadata.map(row => [row.key, row]));
  const grouped = new Map();
  for (const row of summary.filter(row => row.race_id != null && row.variable === "race vote")) {
    const atLarge = byKey.has(`${row.state_abb}-00`);
    const key = `${row.state_abb}-${atLarge ? "00" : String(row.seat_number).padStart(2, "0")}`;
    const entry = grouped.get(key) || {};
    entry[`${row.party}_${row.metric}`] = row.value;
    entry.race_id = row.race_id;
    grouped.set(key, entry);
  }
  return metadata.map(row => {
    const fpo = grouped.get(row.key);
    if ((!fpo || fpo.DEM_p_win == null) && row.only_one_party) {
      const chance = row.only_one_party === "D" ? 1 : 0;
      return {
        ...row,
        polling_forecast_chance: row.chance_left,
        chance_left: chance,
        winner: row.only_one_party,
        rating: `Settled ${row.only_one_party}`,
        best_bet_margin: chance ? 100 : -100,
        range80_low: chance ? 100 : -100,
        range80_high: chance ? 100 : -100,
        model_source: "Ballot settled",
        model_source_url: row.page ? `${PF}${row.page}` : null
      };
    }
    if (!fpo || fpo.DEM_p_win == null) {
      return {
        ...row,
        polling_forecast_chance: row.chance_left,
        model_source: "Polling Forecast fallback",
        model_source_url: row.page ? `${PF}${row.page}` : null,
        source_note: "50+1 does not publish a two-party probability for this ballot format"
      };
    }
    const chance = fpo.DEM_p_win;
    return {
      ...row,
      polling_forecast_chance: row.chance_left,
      chance_left: chance,
      winner: chance >= .5 ? "D" : "R",
      rating: ratingFromChance(chance),
      best_bet_margin: (fpo.DEM_median - fpo.REP_median) * 100,
      range80_low: (fpo.DEM_lower - fpo.REP_upper) * 100,
      range80_high: (fpo.DEM_upper - fpo.REP_lower) * 100,
      model_source: "FiftyPlusOne",
      model_source_url: "https://fiftyplusone.news/forecast/house",
      fpo_race_id: fpo.race_id
    };
  });
}

function normalizeSenateFiftyPlusOne(tableData, metadata) {
  const byLabel = new Map(tableData.map(row => [row.district_label || row.state, row]));
  return metadata.map(row => {
    const fpo = byLabel.get(row.key) || byLabel.get(row.state);
    if (!fpo || fpo.dem_chance == null) throw new Error(`No 50+1 Senate forecast for ${row.key}`);
    const dem = fpo.candidates?.find(candidate => candidate.party === "DEM");
    const rep = fpo.candidates?.find(candidate => candidate.party === "REP");
    return {
      ...row,
      polling_forecast_chance: row.chance_left,
      left_candidate: dem?.candidate || row.left_candidate,
      rep_candidate: rep?.candidate || row.rep_candidate,
      chance_left: fpo.dem_chance,
      winner: fpo.dem_chance >= .5 ? "D" : "R",
      rating: fpo.rating || ratingFromChance(fpo.dem_chance),
      model_source: "FiftyPlusOne",
      model_source_url: "https://fiftyplusone.news/forecast/senate",
      fpo_race_id: fpo.race_id,
      independent_chance: fpo.ind_chance || 0
    };
  });
}

function normalizePolls(rows, kind) {
  return rows
    .filter(row => row.kind?.toLowerCase() === kind.toLowerCase())
    .map(row => {
      if (kind !== "Approval") return row;
      const approve = row.figures?.match(/APPROVE[^\d]*(\d+(?:\.\d+)?)/i)?.[1];
      const disapprove = row.figures?.match(/DISAPPROVE[^\d]*(\d+(?:\.\d+)?)/i)?.[1];
      return { ...row, net_approval: approve != null && disapprove != null ? +approve - +disapprove : null };
    })
    .sort((a, b) => String(a.fieldwork_end).localeCompare(String(b.fieldwork_end)));
}

function parseStringArray(value) {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value || "[]"); } catch { return []; }
}

function normalizedName(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function marketCandidate(question) {
  return question?.match(/^Will (.+?) win (?:the )?/i)?.[1] || null;
}

function summarizeRaceMarket(event, race) {
  const target = normalizedName(race.left_candidate);
  const last = target.split(" ").at(-1);
  const markets = (event.markets || []).map(market => {
    const outcomes = parseStringArray(market.outcomes);
    const prices = parseStringArray(market.outcomePrices).map(Number);
    const tokens = parseStringArray(market.clobTokenIds);
    return { candidate: marketCandidate(market.question), current: prices[outcomes.indexOf("Yes")], token: tokens[outcomes.indexOf("Yes")], volume: Number(market.volume || 0) };
  }).filter(row => row.candidate && Number.isFinite(row.current) && !/^Candidate [A-Z]$/i.test(row.candidate));
  const demParty = markets.find(row => /\bDemocrat(?:s|ic)?\b/i.test(row.candidate));
  const dem = demParty || markets.find(row => {
    const name = normalizedName(row.candidate);
    return name === target || (last?.length > 2 && name.split(" ").at(-1) === last);
  });
  if (!dem) return null;
  return {
    currentDem: dem.current,
    token: dem.token,
    history: [],
    volume: Number(event.volume || markets.reduce((sum, row) => sum + row.volume, 0)),
    url: `https://polymarket.com/event/${event.slug}`,
    title: event.title,
    outcomes: markets.sort((a,b) => b.current-a.current).slice(0,4).map(({candidate,current}) => ({ candidate, current }))
  };
}

function summarizeChamberMarket(event) {
  const market = event?.markets?.find(row => /Democratic Party control/i.test(row.question));
  if (!market) return null;
  const outcomes = parseStringArray(market.outcomes), prices = parseStringArray(market.outcomePrices).map(Number), tokens = parseStringArray(market.clobTokenIds);
  const yes = outcomes.indexOf("Yes");
  return { currentDem: prices[yes], token: tokens[yes], history: [], volume: Number(event.volume || market.volume || 0), url: `https://polymarket.com/event/${event.slug}`, title: event.title };
}

async function fetchPriceHistory(token) {
  if (!token) return [];
  const url = `https://clob.polymarket.com/prices-history?market=${token}&interval=max&fidelity=720`;
  const payload = await fetchReaderJson(url);
  return (payload.history || []).map(row => ({ t: row.t, p: row.p })).filter(row => Number.isFinite(row.t) && Number.isFinite(row.p));
}

async function fetchPolymarket(houseRows, senateRows, previous) {
  try {
    const query = "active=true&closed=false&end_date_min=2026-11-01T00:00:00Z&end_date_max=2026-11-10T00:00:00Z";
    const pages = await mapLimit([0,100,200,300,400,500], 2, offset => fetchReaderJson(`https://gamma-api.polymarket.com/events?limit=100&offset=${offset}&${query}`));
    const events = pages.flat().filter(Boolean);
    const bySlug = new Map(events.map(event => [event.slug, event]));
    const chambers = {
      house: summarizeChamberMarket(bySlug.get("which-party-will-win-the-house-in-2026")),
      senate: summarizeChamberMarket(bySlug.get("which-party-will-win-the-senate-in-2026"))
    };
    if (!chambers.house || !chambers.senate) throw new Error("Chamber-control markets missing from Polymarket batch");
    const races = {};
    for (const race of houseRows) {
      const slug = `${race.key.toLowerCase().replace("-00", "-al")}-house-election-winner`;
      const event = bySlug.get(slug);
      if (event) { const summary = summarizeRaceMarket(event, race); if (summary) races[race.key] = summary; }
    }
    for (const race of senateRows) {
      const slug = `${stateNames[race.state].toLowerCase().replace(/\s+/g,"-")}-senate-election-winner`;
      const event = bySlug.get(slug);
      if (event) { const summary = summarizeRaceMarket(event, race); if (summary) races[race.key] = summary; }
    }
    for (const [name, row] of Object.entries(chambers)) {
      const old = previous?.polymarket?.chambers?.[name];
      if (old?.token === row?.token && old.history?.length) row.history = old.history;
    }
    for (const [key, row] of Object.entries(races)) {
      const old = previous?.polymarket?.races?.[key];
      if (old?.token === row.token && old.history?.length) row.history = old.history;
    }
    const historyTargets = [chambers.house, chambers.senate, ...Object.values(races).sort((a,b) => Math.abs(a.currentDem-.5)-Math.abs(b.currentDem-.5) || b.volume-a.volume)]
      .filter(row => row && !row.history.length).slice(0,12);
    const histories = await mapLimit(historyTargets, 5, row => fetchPriceHistory(row?.token));
    historyTargets.forEach((row, index) => { if (row && histories[index]?.length) row.history = histories[index]; });
    return { fetchedAt: new Date().toISOString(), chambers, races, sourceUrl: "https://polymarket.com/", note: "Current prices are cached for every matched race. Historical exchange series are added in small batches to respect the free endpoint; daily local snapshots extend every race trend." };
  } catch (error) {
    console.warn(`Polymarket refresh failed; keeping prior cache: ${error.message}`);
    return previous?.polymarket || { fetchedAt: null, chambers: {}, races: {}, sourceUrl: "https://polymarket.com/", note: "No cached market data." };
  }
}

await mkdir(snapshotsDir, { recursive: true });

const currentPath = path.join(dataDir, "current.json");
let previous = null;
try { previous = JSON.parse(await readFile(currentPath, "utf8")); } catch {}

const [houseMetadata, senateMetadata, polls, legislators, fpoHouse, fpoSenate, fpoGeneric, fpoApproval] = await Promise.all([
  fetchJson(`${PF}/api/us/house`),
  fetchJson(`${PF}/api/us/senate`),
  fetchJson(`${PF}/api/us/polls?since=2026-01-01`),
  fetchJson("https://unitedstates.github.io/congress-legislators/legislators-current.json"),
  fetchFiftyPlusOne("house"),
  fetchFiftyPlusOne("senate"),
  fetchFiftyPlusOnePolls("/polls/generic-ballot/generic-ballot"),
  fetchFiftyPlusOnePolls("/polls/approval/president")
]);

const houseRows = normalizeHouseFiftyPlusOne(fpoHouse.forecast.summary, houseMetadata.rows);
const senateRows = normalizeSenateFiftyPlusOne(fpoSenate.forecast.tableData, senateMetadata.rows);
const modelDate = fpoHouse.forecast.summary[0]?.model_date;
const headline = {
  source: "FiftyPlusOne",
  sourceUrl: "https://fiftyplusone.news/forecast/house",
  senateSourceUrl: "https://fiftyplusone.news/forecast/senate",
  asOf: modelDate,
  houseDemControl: summaryValue(fpoHouse.forecast.summary, "house", "p_win") * 100,
  senateDemControl: summaryValue(fpoSenate.forecast.summary, "senate", "p_win") * 100,
  houseDemSeats: summaryValue(fpoHouse.forecast.summary, "house", "median"),
  senateDemSeats: summaryValue(fpoSenate.forecast.summary, "senate", "median"),
  houseRange: [summaryValue(fpoHouse.forecast.summary, "house", "lower"), summaryValue(fpoHouse.forecast.summary, "house", "upper")],
  senateRange: [summaryValue(fpoSenate.forecast.summary, "senate", "lower"), summaryValue(fpoSenate.forecast.summary, "senate", "upper")]
};

const [ratings, polymarket] = await Promise.all([
  fetchRatings(previous),
  fetchPolymarket(houseRows, senateRows, previous)
]);

const specialStates = new Set(senateRows.filter(row => row.special).map(row => row.state));
const holds = legislators
  .map(person => ({ person, term: currentTerm(person) }))
  .filter(({ term }) => term && term.class !== 2 && !(term.class === 3 && specialStates.has(term.state)))
  .map(({ person, term }) => ({
    key: `${term.state}-${term.class}-${person.id.bioguide}`,
    state: term.state,
    name: `${term.state} Senate hold`,
    senator: person.name.official_full || `${person.name.first} ${person.name.last}`,
    party: caucusParty(term.party),
    caucus: term.party === "Republican" ? "R" : "D",
    class: term.class,
    notUp: true,
    chance_left: term.party === "Republican" ? 0 : 1,
    source_url: term.url || "https://www.senate.gov/senators/"
  }));

if (houseRows.length !== 435) throw new Error(`Expected 435 House races, got ${houseRows.length}`);
if (senateRows.length !== 35) throw new Error(`Expected 35 Senate races, got ${senateRows.length}`);
if (holds.length !== 65) throw new Error(`Expected 65 Senate holds, got ${holds.length}`);

const payload = {
  schemaVersion: 1,
  fetchedAt: new Date().toISOString(),
  asOf: modelDate,
  headline,
  house: houseRows,
  senate: senateRows,
  senateHolds: holds,
  ratings,
  polymarket,
  nationalClimate: {
    source: "FiftyPlusOne",
    genericUrl: "https://fiftyplusone.news/polls/generic-ballot/generic-ballot",
    approvalUrl: "https://fiftyplusone.news/polls/approval/president",
    generic: fpoGeneric,
    approval: fpoApproval
  },
  polls: {
    generic: normalizePolls(polls.rows, "Generic"),
    approval: normalizePolls(polls.rows, "Approval")
  },
  attribution: {
    forecast: "FiftyPlusOne public logged-out forecast pages (personal offline cache)",
    forecastUrl: "https://fiftyplusone.news/forecast/house",
    metadata: houseMetadata.attribution,
    metadataLicence: houseMetadata.licence,
    legislators: "UnitedStates/congress-legislators (public domain)",
    legislatorsUrl: "https://github.com/unitedstates/congress-legislators"
  }
};

if (previous?.asOf && previous.asOf !== payload.asOf) {
  await writeFile(path.join(snapshotsDir, `${previous.asOf}.json`), `${JSON.stringify(previous, null, 2)}\n`);
}
await writeFile(currentPath, `${JSON.stringify(payload, null, 2)}\n`);
await writeFile(path.join(snapshotsDir, `${payload.asOf}.json`), `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Saved ${payload.asOf}: 435 House, 35 Senate races, 65 Senate holds, ${Object.keys(ratings.raceRatings).length} rated seats, ${Object.keys(polymarket.races).length} matched markets.`);
