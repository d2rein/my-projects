const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const APP_PATH = path.join(ROOT, "pokedex-assets", "app.js");
const SEED_PATH = path.join(ROOT, "pokedex-assets", "seed.csv");
const OUTPUT_PATH = path.join(ROOT, "pokedex-assets", "evolution-review.csv");

const appSource = fs.readFileSync(APP_PATH, "utf8");
const seedCsv = fs.readFileSync(SEED_PATH, "utf8");

const ALT_FORM_SPRITE_SLUGS = parseObjectLiteral("ALT_FORM_SPRITE_SLUGS");
const EXTRA_EVOLUTION_PREDECESSOR = parseObjectLiteral("EXTRA_EVOLUTION_PREDECESSOR");
const EVOLUTION_PREDECESSOR = parseObjectLiteral("EVOLUTION_PREDECESSOR");
const ALL_EVOLUTION_PREDECESSOR = { ...EVOLUTION_PREDECESSOR, ...EXTRA_EVOLUTION_PREDECESSOR };

const SPECIAL_FORM_PREDECESSORS = {
  "galarian:862": 264,
  "galarian:863": 52,
  "galarian:864": 222,
  "galarian:865": 83,
  "galarian:867": 562,
  "hisuian:903": 215,
  "hisuian:904": 211,
  "paldean:980": 194
};

const rows = parseCsv(seedCsv).slice(1).map(buildRawEntry).filter(Boolean);
const speciesGroups = new Map();
for (const row of rows.filter(row => !row.isMega && !row.excludeFromDex)) {
  const key = String(row.dex);
  if (!speciesGroups.has(key)) speciesGroups.set(key, []);
  speciesGroups.get(key).push(row);
}

const canonicalEntries = [];
const altEntries = [];

for (const groupedRows of speciesGroups.values()) {
  const canonicalRow = chooseCanonicalRow(groupedRows);
  const canonicalEntry = toCanonicalEntry(canonicalRow, groupedRows);
  canonicalEntries.push(canonicalEntry);

  const canonicalSignature = signatureForCanonical(canonicalRow);
  groupedRows.forEach((row, idx) => {
    const rowSignature = signatureForCanonical(row);
    if (idx === 0 && rowSignature === canonicalSignature) return;
    if (
      rowSignature === canonicalSignature
      && row.rawName === canonicalRow.rawName
      && row.type1 === canonicalRow.type1
      && row.type2 === canonicalRow.type2
    ) {
      return;
    }
    altEntries.push(toAltEntry(row, canonicalEntry, idx));
  });
}

canonicalEntries.sort((a, b) => a.dex - b.dex);
altEntries.sort((a, b) => a.dex - b.dex || cleanDisplayName(a).localeCompare(cleanDisplayName(b)));

const speciesEntriesByDex = new Map();
canonicalEntries.forEach(entry => {
  speciesEntriesByDex.set(entry.dex, [entry, ...altEntries.filter(candidate => candidate.dex === entry.dex)]);
});

const outputRows = [
  [
    "dex",
    "entry_id",
    "name",
    "form_name",
    "type1",
    "type2",
    "region",
    "is_alt_form",
    "form_family",
    "sprite_slug",
    "inferred_evolves_from_dex",
    "inferred_evolves_from_entry_id",
    "inferred_evolves_from_name",
    "manual_evolves_from_dex",
    "manual_evolves_from_entry_id",
    "notes"
  ]
];

[...canonicalEntries, ...altEntries]
  .sort((a, b) => a.dex - b.dex || Number(a.isAltForm) - Number(b.isAltForm) || cleanDisplayName(a).localeCompare(cleanDisplayName(b)))
  .forEach(entry => {
    const predecessor = getInferredPredecessor(entry, speciesEntriesByDex);
    outputRows.push([
      entry.dex,
      entry.id,
      cleanDisplayName(entry),
      entry.formName || "",
      entry.type1 || "",
      entry.type2 || "",
      entry.region || "",
      entry.isAltForm ? "1" : "0",
      getFormFamilyKey(entry),
      getSpecialSpriteSlug(entry) || "",
      predecessor?.dex ?? "",
      predecessor?.id ?? "",
      predecessor ? cleanDisplayName(predecessor) : "",
      "",
      "",
      ""
    ]);
  });

fs.writeFileSync(OUTPUT_PATH, outputRows.map(toCsvLine).join("\n"), "utf8");
console.log(`Wrote ${OUTPUT_PATH}`);

function parseObjectLiteral(name) {
  const regex = new RegExp(`const ${name} = (\\{[\\s\\S]*?\\n\\});`);
  const match = appSource.match(regex);
  if (!match) {
    throw new Error(`Could not find ${name} in app.js`);
  }
  return Function(`"use strict"; return (${match[1]});`)();
}

function parseCsv(text) {
  const parsedRows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        cell += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      cell = "";
      if (row.some(value => value.trim() !== "")) parsedRows.push(row);
      row = [];
      continue;
    }

    cell += char;
  }

  if (cell.length || row.length) {
    row.push(cell);
    if (row.some(value => value.trim() !== "")) parsedRows.push(row);
  }

  return parsedRows;
}

function buildRawEntry(parts) {
  const dex = Number((parts[1] || "").trim());
  const rawName = (parts[2] || "").trim();
  if (!dex || !rawName) return null;

  const type1 = normalizeType(parts[3]);
  const type2 = normalizeType(parts[4]);
  const region = (parts[5] || "").trim();
  const rawCode = String(parts[6] || "").trim();
  const note = (parts[7] || "").trim();
  const baseName = rawName.split("#")[0].trim();
  const formName = rawName.includes("#") ? rawName.split("#")[1].trim() : "";

  return {
    dex,
    rawName,
    baseName,
    formName,
    type1,
    type2,
    region,
    note,
    rawCode,
    seedStatus: mapSeedCode(rawCode),
    isMega: /#Mega|#Primal/i.test(rawName),
    excludeFromDex: /not in pokedex/i.test(note) && ![808, 809].includes(dex)
  };
}

function normalizeType(value) {
  const clean = String(value || "").trim();
  return clean && clean !== "0" ? clean : "";
}

function mapSeedCode(code) {
  if (code === "1") return "owned";
  if (code === "2") return "can-evolve";
  if (code === "9") return "missing";
  if (code === "10") return "owned-alt";
  return "";
}

function chooseCanonicalRow(groupedRows) {
  const plain = groupedRows.find(row => !row.formName);
  if (plain) return plain;
  return groupedRows[0];
}

function toCanonicalEntry(row, groupRows) {
  return {
    id: `pokemon::${row.dex}`,
    dex: row.dex,
    rawName: row.baseName,
    baseName: row.baseName,
    formName: "",
    type1: row.type1,
    type2: row.type2,
    region: row.region,
    isAltForm: false,
    note: groupRows.map(item => item.note).filter(Boolean).join(" | ")
  };
}

function toAltEntry(row, canonicalEntry, idx) {
  const fallbackFormName = row.formName || buildAltLabel(row, canonicalEntry);
  return {
    id: `alt::${row.dex}::${idx}::${row.rawName}::${row.type1 || "-"}::${row.type2 || "-"}`,
    dex: row.dex,
    rawName: row.rawName,
    baseName: row.baseName,
    formName: fallbackFormName,
    type1: row.type1,
    type2: row.type2,
    region: row.region,
    isAltForm: true,
    note: row.note
  };
}

function buildAltLabel(row, canonicalEntry) {
  if (row.region === canonicalEntry.region && row.type1 === canonicalEntry.type1 && row.type2 === canonicalEntry.type2) {
    return "Alt form";
  }
  const parts = [];
  if (row.type1 && row.type1 !== canonicalEntry.type1) parts.push(row.type1);
  if (row.type2 && row.type2 !== canonicalEntry.type2) parts.push(row.type2);
  return parts.join(" / ") || "Alt form";
}

function signatureForCanonical(row) {
  return `${row.rawName}|${row.type1}|${row.type2}|${row.region}`;
}

function cleanDisplayName(entry) {
  return entry.rawName.replaceAll("#", " ");
}

function getSpecialSpriteSlug(entry) {
  if (entry.isAltForm) {
    return ALT_FORM_SPRITE_SLUGS[entry.id] || "";
  }
  return "";
}

function getFormFamilyKey(entry) {
  const slug = getSpecialSpriteSlug(entry);
  if (!slug) return "";
  if (slug.includes("-alolan")) return "alolan";
  if (slug.includes("-galarian")) return "galarian";
  if (slug.includes("-hisuian")) return "hisuian";
  if (slug.includes("-paldean")) return "paldean";
  return "";
}

function getInferredPredecessor(entry, entriesByDex) {
  const familyKey = getFormFamilyKey(entry);
  const specialKey = familyKey ? `${familyKey}:${entry.dex}` : "";
  const predecessorDex = specialKey && Object.prototype.hasOwnProperty.call(SPECIAL_FORM_PREDECESSORS, specialKey)
    ? SPECIAL_FORM_PREDECESSORS[specialKey]
    : ALL_EVOLUTION_PREDECESSOR[entry.dex];

  if (!predecessorDex) return null;

  const candidates = entriesByDex.get(Number(predecessorDex)) || [];
  if (!candidates.length) return null;

  if (entry.isAltForm && familyKey) {
    return candidates.find(candidate => getFormFamilyKey(candidate) === familyKey) || candidates.find(candidate => !candidate.isAltForm) || candidates[0];
  }

  return candidates.find(candidate => !candidate.isAltForm) || candidates[0];
}

function toCsvLine(values) {
  return values.map(value => {
    const text = String(value ?? "");
    if (!/[\",\n]/.test(text)) return text;
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }).join(",");
}
