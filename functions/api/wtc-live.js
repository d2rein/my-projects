const WIKI_PAGE = "2025\u20132027 World Test Championship";
const WIKI_PAGE_URL = "https://en.wikipedia.org/wiki/2025%E2%80%932027_World_Test_Championship";
const WIKI_API_URL = "https://en.wikipedia.org/w/api.php";

const TEAM_NAME_TO_ID = {
  Australia: "AUS",
  Bangladesh: "BAN",
  England: "ENG",
  India: "IND",
  "New Zealand": "NZ",
  Pakistan: "PAK",
  "South Africa": "SA",
  "Sri Lanka": "SL",
  "West Indies": "WI"
};

const TEAM_CODE_TO_ID = {
  AUS: "AUS",
  BAN: "BAN",
  ENG: "ENG",
  IND: "IND",
  NZ: "NZ",
  PAK: "PAK",
  SA: "SA",
  SL: "SL",
  WI: "WI"
};

const SERIES_ID_BY_MATCHUP = {
  "SL|BAN": "2",
  "ENG|IND": "1",
  "WI|AUS": "3",
  "IND|WI": "4",
  "PAK|SA": "5",
  "IND|SA": "6",
  "NZ|WI": "7",
  "AUS|ENG": "8",
  "BAN|PAK": "9",
  "ENG|NZ": "10",
  "WI|SL": "11",
  "WI|PAK": "12",
  "SL|IND": "13",
  "ENG|PAK": "14",
  "AUS|BAN": "15",
  "SA|AUS": "16",
  "BAN|WI": "17",
  "NZ|IND": "18",
  "SA|BAN": "19",
  "PAK|SL": "20",
  "AUS|NZ": "21",
  "SA|ENG": "22",
  "NZ|SL": "23",
  "IND|AUS": "24",
  "BAN|ENG": "25",
  "SL|SA": "26",
  "PAK|NZ": "27"
};

const SERIES_MATCH_COUNTS = {
  "1": 5,
  "2": 2,
  "3": 3,
  "4": 2,
  "5": 2,
  "6": 2,
  "7": 3,
  "8": 5,
  "9": 2,
  "10": 3,
  "11": 2,
  "12": 2,
  "13": 2,
  "14": 3,
  "15": 2,
  "16": 3,
  "17": 2,
  "18": 2,
  "19": 2,
  "20": 2,
  "21": 4,
  "22": 3,
  "23": 2,
  "24": 5,
  "25": 2,
  "26": 2,
  "27": 2
};

const TEAM_ORDER = [
  "Australia",
  "Bangladesh",
  "England",
  "India",
  "New Zealand",
  "Pakistan",
  "South Africa",
  "Sri Lanka",
  "West Indies"
];

export async function onRequestGet() {
  const checkedAt = new Date().toISOString();

  try {
    const { sections, html } = await fetchWikiPageData();
    const leagueTableSection = sections.find((section) => section.line === "League table");
    const seriesSections = sections.filter((section) => {
      const line = section.line || "";
      return line.includes(" v ") || /\([^)]+ v [^)]+\)/.test(line);
    });

    if (!leagueTableSection) {
      throw new Error("League table section not found on Wikipedia page.");
    }

    const liveData = buildLiveData(html, sections, seriesSections);

    return json({
      ok: true,
      liveDataAvailable: true,
      checkedAt,
      liveData,
      message: `Using live Wikipedia WTC data updated through ${liveData.snapshotLabel}.`
    });
  } catch (error) {
    console.error("wtc-live sync failed", error);
    return json({
      ok: true,
      liveDataAvailable: false,
      checkedAt,
      message: "Seeded snapshot in use. Wikipedia live sync could not be parsed right now."
    });
  }
}

async function fetchWikiPageData() {
  const url = new URL(WIKI_API_URL);
  url.searchParams.set("action", "parse");
  url.searchParams.set("page", WIKI_PAGE);
  url.searchParams.set("prop", "text|sections");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("redirects", "1");

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "my-projects-wtc-sync/1.0"
    }
  });
  if (!response.ok) {
    throw new Error(`Wikipedia parse request failed with ${response.status}.`);
  }

  const payload = await response.json();
  return {
    sections: payload.parse?.sections || [],
    html: payload.parse?.text || ""
  };
}

function buildLiveData(fullHtml, sections, seriesSections) {
  const pageText = collapseText(fullHtml);
  const standings = parseStandingsTable(sliceLeagueTableHtml(fullHtml));
  const scheduleMatrixResults = parseScheduleMatrixText(pageText);
  const deductions = {};

  for (const row of standings) {
    deductions[row.teamId] = -Math.abs(row.deductions);
  }

  const snapshotMatch = pageText.match(/Updated to match\(es\) played on ([0-9]{1,2} [A-Za-z]+ 20[0-9]{2})\./);
  const snapshotLabel = snapshotMatch ? snapshotMatch[1] : "latest available date";
  const snapshotDate = snapshotMatch ? toIsoDate(snapshotMatch[1]) : null;

  const leagueStageStart = pageText.indexOf("League stage");
  const seriesActuals = {};

  for (const section of seriesSections) {
    const sectionIndex = sections.findIndex((entry) => entry.index === section.index);
    const seriesMeta = getSeriesMeta(section.line);
    if (!seriesMeta) {
      continue;
    }

    const seriesId = SERIES_ID_BY_MATCHUP[`${seriesMeta.home}|${seriesMeta.away}`];
    if (!seriesId) {
      continue;
    }

    const actual = parseSeriesActuals(
      sliceSectionText(pageText, sections, sectionIndex, leagueStageStart),
      seriesMeta.home,
      seriesMeta.away
    );
    const matches = SERIES_MATCH_COUNTS[seriesId];
    const matrixResult = scheduleMatrixResults[seriesId];

    if (matrixResult && (actual.homeWins + actual.awayWins + actual.draws) < (matrixResult.homeWins + matrixResult.awayWins)) {
      if (matrixResult.homeWins + matrixResult.awayWins === matches) {
        actual.homeWins = matrixResult.homeWins;
        actual.awayWins = matrixResult.awayWins;
        actual.draws = 0;
      }
    }

    const played = actual.homeWins + actual.awayWins + actual.draws;
    seriesActuals[seriesId] = {
      ...actual,
      status: played === 0 ? "upcoming" : (played >= matches ? "completed" : "ongoing"),
      stageLabel: played === 0 ? "Upcoming" : (played >= matches ? "Completed" : "In progress")
    };
  }

  return {
    source: "Wikipedia",
    sourceUrl: WIKI_PAGE_URL,
    snapshotLabel,
    snapshotDate,
    deductions,
    standings,
    seriesActuals
  };
}

function parseStandingsTable(html) {
  const tableHtml = firstTable(html);
  if (!tableHtml) {
    throw new Error("Could not find league table HTML.");
  }

  const rows = [];
  for (const rowHtml of matchAll(tableHtml, /<tr[\s\S]*?<\/tr>/gi)) {
    const cells = matchAll(rowHtml, /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi).map((cellHtml) => cleanCell(cellHtml));
    if (cells.length < 10 || cells[0] === "Pos") {
      continue;
    }

    const teamId = mapTeamNameToId(cells[1]);
    if (!teamId) {
      continue;
    }

    const deductions = parseInt(cells[7], 10);
    rows.push({
      rank: parseInt(cells[0], 10),
      teamId,
      played: parseInt(cells[2], 10),
      wins: parseInt(cells[3], 10),
      losses: parseInt(cells[4], 10),
      draws: parseInt(cells[5], 10),
      rawPoints: parseInt(cells[9], 10) + deductions,
      deductions: -Math.abs(deductions),
      points: parseInt(cells[9], 10),
      pct: parseFloat(cells[10])
    });
  }

  return rows;
}

function parseSeriesActuals(text, homeTeamId, awayTeamId) {
  const actual = { homeWins: 0, awayWins: 0, draws: 0 };

  for (const match of text.matchAll(/Points:\s*([A-Za-z ]+?)\s+(\d+)\s*,\s*([A-Za-z ]+?)\s+(\d+)/g)) {
    const firstTeamId = mapTeamNameToId(match[1]);
    const secondTeamId = mapTeamNameToId(match[3]);
    if (!firstTeamId || !secondTeamId) {
      continue;
    }

    const firstPoints = parseInt(match[2], 10);
    const secondPoints = parseInt(match[4], 10);
    const homePoints = firstTeamId === homeTeamId ? firstPoints : (secondTeamId === homeTeamId ? secondPoints : null);
    const awayPoints = firstTeamId === awayTeamId ? firstPoints : (secondTeamId === awayTeamId ? secondPoints : null);

    if (homePoints === null || awayPoints === null) {
      continue;
    }

    if (homePoints === awayPoints) {
      actual.draws += 1;
    } else if (homePoints > awayPoints) {
      actual.homeWins += 1;
    } else {
      actual.awayWins += 1;
    }
  }

  return actual;
}

function getSeriesMeta(sectionTitle) {
  const bracketedMatch = sectionTitle.match(/\(([^)]+?) v ([^)]+?)\)/);
  if (bracketedMatch) {
    return {
      home: mapTeamNameToId(bracketedMatch[1]),
      away: mapTeamNameToId(bracketedMatch[2])
    };
  }

  const directMatch = sectionTitle.match(/^(.+?) v (.+)$/);
  if (directMatch) {
    return {
      home: mapTeamNameToId(directMatch[1]),
      away: mapTeamNameToId(directMatch[2])
    };
  }

  return null;
}

function mapTeamNameToId(text) {
  const normalized = normalizeText(text);
  if (TEAM_CODE_TO_ID[normalized]) {
    return TEAM_CODE_TO_ID[normalized];
  }

  for (const [teamName, teamId] of Object.entries(TEAM_NAME_TO_ID)) {
    if (normalized.includes(normalizeText(teamName))) {
      return teamId;
    }
  }

  return null;
}

function firstTable(html) {
  const match = html.match(/<table[\s\S]*?<\/table>/i);
  return match ? match[0] : null;
}

function sliceLeagueTableHtml(fullHtml) {
  const start = fullHtml.search(/id="League_table"/i);
  if (start === -1) {
    throw new Error("Could not locate League table heading in HTML.");
  }

  const tableMatch = fullHtml.slice(start).match(/<table[\s\S]*?<\/table>/i);
  if (!tableMatch) {
    throw new Error("Could not locate League table after heading.");
  }

  return tableMatch[0];
}

function parseScheduleMatrixText(pageText) {
  const start = pageText.indexOf("Home \\ Away");
  if (start === -1) {
    return {};
  }

  const end = pageText.indexOf("Updated to match(es) played on", start);
  if (end === -1) {
    return {};
  }

  const snippet = pageText.slice(start, end);
  const results = {};
  let cursor = snippet.indexOf(TEAM_ORDER[0]);

  for (let rowIndex = 0; rowIndex < TEAM_ORDER.length; rowIndex += 1) {
    const homeTeamName = TEAM_ORDER[rowIndex];
    const rowStart = snippet.indexOf(homeTeamName, cursor);
    if (rowStart === -1) {
      continue;
    }

    const rowEnd = rowIndex < TEAM_ORDER.length - 1
      ? snippet.indexOf(TEAM_ORDER[rowIndex + 1], rowStart + homeTeamName.length)
      : snippet.length;
    const rowText = snippet.slice(rowStart + homeTeamName.length, rowEnd);
    cursor = rowEnd;

    const homeTeamId = mapTeamNameToId(homeTeamName);
    const tokens = Array.from(rowText.matchAll(/(\d+[\u2013-]\d+\s*\[\d+\]|\d+\s+matches|\u2014)/g), (match) => match[1]);

    for (let awayIndex = 0; awayIndex < Math.min(tokens.length, TEAM_ORDER.length); awayIndex += 1) {
      const awayTeamId = mapTeamNameToId(TEAM_ORDER[awayIndex]);
      if (!awayTeamId || awayTeamId === homeTeamId) {
        continue;
      }

      const match = tokens[awayIndex].match(/^(\d+)[\u2013-](\d+)\s*\[(\d+)\]$/);
      if (!match) {
        continue;
      }

      const seriesId = SERIES_ID_BY_MATCHUP[`${homeTeamId}|${awayTeamId}`];
      if (!seriesId) {
        continue;
      }

      results[seriesId] = {
        homeWins: parseInt(match[1], 10),
        awayWins: parseInt(match[2], 10),
        matches: parseInt(match[3], 10)
      };
    }
  }

  return results;
}

function sliceSectionText(pageText, sections, sectionIndex, searchFloor) {
  const current = sections[sectionIndex];
  const start = pageText.indexOf(current.line, Math.max(0, searchFloor));
  if (start === -1) {
    return "";
  }

  for (let nextIndex = sectionIndex + 1; nextIndex < sections.length; nextIndex += 1) {
    const end = pageText.indexOf(sections[nextIndex].line, start + current.line.length);
    if (end !== -1) {
      return pageText.slice(start, end);
    }
  }

  return pageText.slice(start);
}

function cleanCell(cellHtml) {
  return normalizeText(decodeEntities(stripTags(cellHtml)))
    .replace(/\[\s*[a-z0-9]+\s*\]$/i, "")
    .trim();
}

function collapseText(html) {
  return normalizeText(
    decodeEntities(
      stripTags(
        html
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/p>/gi, "\n")
          .replace(/<\/li>/gi, "\n")
          .replace(/<\/tr>/gi, "\n")
      )
    )
  );
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeEntities(value) {
  return value
    .replace(/&#8211;|&#x2013;|&ndash;/gi, "\u2013")
    .replace(/&#8212;|&#x2014;|&mdash;/gi, "\u2014")
    .replace(/&#160;|&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&minus;/gi, "-")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function normalizeText(value) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

function toIsoDate(label) {
  const parsed = new Date(`${label} UTC`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
}

function matchAll(value, pattern) {
  return Array.from(value.matchAll(pattern), (match) => match[1] || match[0]);
}

function json(body) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=900"
    }
  });
}
