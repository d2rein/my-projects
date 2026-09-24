const STORAGE_KEY = "pogo-fresh-pokedex-v3";
const LEGACY_POKEDEX_STORAGE_KEYS = ["pogo-fresh-pokedex-v2"];
const MEDAL_STORAGE_KEY = "pogo-medal-forecast-v2";
const ACCOUNT_SYNC_PREFS_KEY = "pogo-account-sync-prefs-v1";
const ACCOUNT_SESSION_API = "/api/site-auth/session";
const ACCOUNT_LOGIN_API = "/api/site-auth/login";
const ACCOUNT_LOGOUT_API = "/api/site-auth/logout";
const POGO_DEX_STATE_API = "/api/pogo-dex-account-state";

const DEX_MODES = [
  { id: "pokemon", label: "Pokemon" },
  { id: "shiny", label: "Shiny" },
  { id: "lucky", label: "Lucky" },
  { id: "xxl", label: "XXL" },
  { id: "xxs", label: "XXS" },
  { id: "gmax", label: "GMAX" },
  { id: "mega", label: "Mega" },
  { id: "shadow", label: "Shadow" },
  { id: "purified", label: "Purified" },
  { id: "perfect", label: "100%" }
];

const STANDARD_COLLECTION_MODES = ["pokemon", "shiny", "lucky", "xxl", "xxs", "shadow", "purified", "perfect"];

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "owned", label: "Owned" },
  { id: "unowned", label: "Unowned" },
  { id: "can-evolve", label: "Can evolve" },
  { id: "missing", label: "Missing" },
  { id: "unreleased", label: "Unreleased" },
  { id: "regional", label: "Regional" },
  { id: "mega", label: "Mega" }
];

const REGIONS = ["Kanto", "Johto", "Hoenn", "Sinnoh", "Unova", "Kalos", "Alola", "Galar", "Hisui", "Paldea", "Unidentified"];

const FALLBACK_SPECIES_METADATA = {
  772: { name: "Type: Null", region: "Alola" },
  778: { name: "Mimikyu", region: "Alola", type1: "Ghost", type2: "Fairy" },
  807: { name: "Zeraora", region: "Alola", type1: "Electric" },
  808: { region: "Unidentified" },
  809: { region: "Unidentified" }
};

const INCLUDE_SPECIAL_DEX = new Set([808, 809]);

const GMAX_SPECIES = new Map([
  [3, "Venusaur"], [6, "Charizard"], [9, "Blastoise"], [12, "Butterfree"], [25, "Pikachu"], [52, "Meowth"],
  [68, "Machamp"], [94, "Gengar"], [99, "Kingler"], [131, "Lapras"], [133, "Eevee"], [143, "Snorlax"],
  [569, "Garbodor"], [809, "Melmetal"], [812, "Rillaboom"], [815, "Cinderace"], [818, "Inteleon"],
  [823, "Corviknight"], [826, "Orbeetle"], [834, "Drednaw"], [839, "Coalossal"], [841, "Flapple"],
  [842, "Appletun"], [844, "Sandaconda"], [849, "Toxtricity"], [851, "Centiskorch"], [858, "Hatterene"],
  [861, "Grimmsnarl"], [869, "Alcremie"], [879, "Copperajah"], [884, "Duraludon"], [892, "Urshifu"]
]);

const MAINSTREAM_MEGA_FORMS = [
  { dex: 3, rawName: "Venusaur#Mega" },
  { dex: 6, rawName: "Charizard#Mega X", type1: "Fire", type2: "Dragon" },
  { dex: 6, rawName: "Charizard#Mega Y" },
  { dex: 9, rawName: "Blastoise#Mega" },
  { dex: 15, rawName: "Beedrill#Mega" },
  { dex: 18, rawName: "Pidgeot#Mega" },
  { dex: 65, rawName: "Alakazam#Mega" },
  { dex: 80, rawName: "Slowbro#Mega" },
  { dex: 94, rawName: "Gengar#Mega" },
  { dex: 115, rawName: "Kangaskhan#Mega" },
  { dex: 127, rawName: "Pinsir#Mega", type1: "Bug", type2: "Flying" },
  { dex: 130, rawName: "Gyarados#Mega", type1: "Water", type2: "Dark" },
  { dex: 142, rawName: "Aerodactyl#Mega" },
  { dex: 150, rawName: "Mewtwo#Mega X", type1: "Psychic", type2: "Fighting" },
  { dex: 150, rawName: "Mewtwo#Mega Y" },
  { dex: 181, rawName: "Ampharos#Mega", type1: "Electric", type2: "Dragon" },
  { dex: 208, rawName: "Steelix#Mega" },
  { dex: 212, rawName: "Scizor#Mega" },
  { dex: 214, rawName: "Heracross#Mega" },
  { dex: 229, rawName: "Houndoom#Mega" },
  { dex: 248, rawName: "Tyranitar#Mega" },
  { dex: 254, rawName: "Sceptile#Mega", type1: "Grass", type2: "Dragon" },
  { dex: 257, rawName: "Blaziken#Mega" },
  { dex: 260, rawName: "Swampert#Mega" },
  { dex: 282, rawName: "Gardevoir#Mega" },
  { dex: 302, rawName: "Sableye#Mega" },
  { dex: 303, rawName: "Mawile#Mega" },
  { dex: 306, rawName: "Aggron#Mega", type1: "Steel", type2: "" },
  { dex: 308, rawName: "Medicham#Mega" },
  { dex: 310, rawName: "Manectric#Mega" },
  { dex: 319, rawName: "Sharpedo#Mega" },
  { dex: 323, rawName: "Camerupt#Mega" },
  { dex: 334, rawName: "Altaria#Mega", type1: "Dragon", type2: "Fairy" },
  { dex: 354, rawName: "Banette#Mega" },
  { dex: 359, rawName: "Absol#Mega" },
  { dex: 362, rawName: "Glalie#Mega" },
  { dex: 373, rawName: "Salamence#Mega" },
  { dex: 376, rawName: "Metagross#Mega" },
  { dex: 380, rawName: "Latias#Mega" },
  { dex: 381, rawName: "Latios#Mega" },
  { dex: 382, rawName: "Kyogre#Primal" },
  { dex: 383, rawName: "Groudon#Primal", type1: "Ground", type2: "Fire" },
  { dex: 384, rawName: "Rayquaza#Mega" },
  { dex: 428, rawName: "Lopunny#Mega", type1: "Normal", type2: "Fighting" },
  { dex: 445, rawName: "Garchomp#Mega" },
  { dex: 448, rawName: "Lucario#Mega" },
  { dex: 460, rawName: "Abomasnow#Mega" },
  { dex: 475, rawName: "Gallade#Mega" },
  { dex: 531, rawName: "Audino#Mega", type1: "Normal", type2: "Fairy" },
  { dex: 719, rawName: "Diancie#Mega" }
];

const SPECIAL_SPRITE_SLUGS = {
  "mega::3::Venusaur#Mega": "venusaur-mega",
  "mega::6::Charizard#Mega X": "charizard-mega-x",
  "mega::6::Charizard#Mega Y": "charizard-mega-y",
  "mega::9::Blastoise#Mega": "blastoise-mega",
  "mega::15::Beedrill#Mega": "beedrill-mega",
  "mega::18::Pidgeot#Mega": "pidgeot-mega",
  "mega::65::Alakazam#Mega": "alakazam-mega",
  "mega::80::Slowbro#Mega": "slowbro-mega",
  "mega::94::Gengar#Mega": "gengar-mega",
  "mega::115::Kangaskhan#Mega": "kangaskhan-mega",
  "mega::127::Pinsir#Mega": "pinsir-mega",
  "mega::130::Gyarados#Mega": "gyarados-mega",
  "mega::142::Aerodactyl#Mega": "aerodactyl-mega",
  "mega::150::Mewtwo#Mega X": "mewtwo-mega-x",
  "mega::150::Mewtwo#Mega Y": "mewtwo-mega-y",
  "mega::181::Ampharos#Mega": "ampharos-mega",
  "mega::208::Steelix#Mega": "steelix-mega",
  "mega::212::Scizor#Mega": "scizor-mega",
  "mega::214::Heracross#Mega": "heracross-mega",
  "mega::229::Houndoom#Mega": "houndoom-mega",
  "mega::248::Tyranitar#Mega": "tyranitar-mega",
  "mega::254::Sceptile#Mega": "sceptile-mega",
  "mega::257::Blaziken#Mega": "blaziken-mega",
  "mega::260::Swampert#Mega": "swampert-mega",
  "mega::282::Gardevoir#Mega": "gardevoir-mega",
  "mega::302::Sableye#Mega": "sableye-mega",
  "mega::303::Mawile#Mega": "mawile-mega",
  "mega::306::Aggron#Mega": "aggron-mega",
  "mega::308::Medicham#Mega": "medicham-mega",
  "mega::310::Manectric#Mega": "manectric-mega",
  "mega::319::Sharpedo#Mega": "sharpedo-mega",
  "mega::323::Camerupt#Mega": "camerupt-mega",
  "mega::334::Altaria#Mega": "altaria-mega",
  "mega::354::Banette#Mega": "banette-mega",
  "mega::359::Absol#Mega": "absol-mega",
  "mega::362::Glalie#Mega": "glalie-mega",
  "mega::373::Salamence#Mega": "salamence-mega",
  "mega::376::Metagross#Mega": "metagross-mega",
  "mega::380::Latias#Mega": "latias-mega",
  "mega::381::Latios#Mega": "latios-mega",
  "mega::382::Kyogre#Primal": "kyogre-primal",
  "mega::383::Groudon#Primal": "groudon-primal",
  "mega::384::Rayquaza#Mega": "rayquaza-mega",
  "mega::428::Lopunny#Mega": "lopunny-mega",
  "mega::445::Garchomp#Mega": "garchomp-mega",
  "mega::448::Lucario#Mega": "lucario-mega",
  "mega::460::Abomasnow#Mega": "abomasnow-mega",
  "mega::475::Gallade#Mega": "gallade-mega",
  "mega::531::Audino#Mega": "audino-mega",
  "mega::719::Diancie#Mega": "diancie-mega"
};

const ALT_FORM_SPRITE_SLUGS = {
  "alt::26::0::Raichu::Electric::-": "raichu",
  "alt::19::1::Rattata::Dark::Normal": "rattata-alolan",
  "alt::20::1::Raticate::Dark::Normal": "raticate-alolan",
  "alt::26::1::Raichu::Electric::Psychic": "raichu-alolan",
  "alt::27::1::Sandshrew::Ice::Steel": "sandshrew-alolan",
  "alt::28::0::Sandslash::Ground::-": "sandslash",
  "alt::28::1::Sandslash::Ice::Steel": "sandslash-alolan",
  "alt::37::1::Vulpix::Ice::-": "vulpix-alolan",
  "alt::38::1::Ninetales::Ice::Fairy": "ninetales-alolan",
  "alt::50::1::Diglett::Ground::Steel": "diglett-alolan",
  "alt::51::0::Dugtrio::Ground::-": "dugtrio",
  "alt::51::1::Dugtrio::Ground::Steel": "dugtrio-alolan",
  "alt::52::1::Meowth::Dark::-": "meowth-alolan",
  "alt::52::2::Meowth::Steel::-": "meowth-galarian",
  "alt::53::1::Persian::Dark::-": "persian-alolan",
  "alt::58::1::Growlithe::Fire::Rock": "growlithe-hisuian",
  "alt::59::1::Arcanine::Fire::Rock": "arcanine-hisuian",
  "alt::74::1::Geodude::Rock::Electric": "geodude-alolan",
  "alt::75::1::Graveler::Rock::Electric": "graveler-alolan",
  "alt::76::1::Golem::Rock::Electric": "golem-alolan",
  "alt::77::1::Ponyta::Psychic::-": "ponyta-galarian",
  "alt::78::0::Rapidash::Fire::-": "rapidash",
  "alt::78::1::Rapidash::Psychic::Fairy": "rapidash-galarian",
  "alt::79::1::Slowpoke::Psychic::-": "slowpoke-galarian",
  "alt::80::1::Slowbro::Poison::Psychic": "slowbro-galarian",
  "alt::83::1::Farfetch'd::Fighting::-": "farfetchd-galarian",
  "alt::88::1::Grimer::Poison::Dark": "grimer-alolan",
  "alt::89::1::Muk::Poison::Dark": "muk-alolan",
  "alt::100::1::Voltorb::Electric::Grass": "voltorb-hisuian",
  "alt::101::1::Electrode::Electric::Grass": "electrode-hisuian",
  "alt::103::1::Exeggutor::Grass::Dragon": "exeggutor-alolan",
  "alt::105::0::Marowak::Ground::-": "marowak",
  "alt::105::1::Marowak::Fire::Ghost": "marowak-alolan",
  "alt::110::1::Weezing::Poison::Fairy": "weezing-galarian",
  "alt::122::1::Mr. Mime::Ice::Psychic": "mr-mime-galarian",
  "alt::128::1::Tauros::Fighting::-": "tauros-paldean-combat-breed",
  "alt::128::2::Tauros::Fighting::Fire": "tauros-paldean-blaze-breed",
  "alt::128::3::Tauros::Fighting::Water": "tauros-paldean-aqua-breed",
  "alt::144::1::Articuno::Psychic::Flying": "articuno-galarian",
  "alt::145::1::Zapdos::Fighting::Flying": "zapdos-galarian",
  "alt::146::1::Moltres::Dark::Flying": "moltres-galarian",
  "alt::157::1::Typhlosion::Fire::Ghost": "typhlosion-hisuian",
  "alt::194::1::Wooper::Poison::Ground": "wooper-paldean",
  "alt::199::1::Slowking::Poison::Psychic": "slowking-galarian",
  "alt::211::1::Qwilfish::Dark::Poison": "qwilfish-hisuian",
  "alt::215::1::Sneasel::Fighting::Poison": "sneasel-hisuian",
  "alt::222::1::Corsola::Ghost::-": "corsola-galarian",
  "alt::263::1::Zigzagoon::Dark::Normal": "zigzagoon-galarian",
  "alt::264::1::Linoone::Dark::Normal": "linoone-galarian",
  "alt::351::1::Castform::Fire::-": "castform-sunny",
  "alt::351::2::Castform::Water::-": "castform-rainy",
  "alt::351::3::Castform::Ice::-": "castform-snowy",
  "alt::479::1::Rotom::Electric::Fire": "rotom-heat",
  "alt::479::2::Rotom::Electric::Water": "rotom-wash",
  "alt::479::3::Rotom::Electric::Ice": "rotom-frost",
  "alt::479::4::Rotom::Electric::Flying": "rotom-fan",
  "alt::479::5::Rotom::Electric::Grass": "rotom-mow",
  "alt::492::1::Shaymin::Grass::Flying": "shaymin-sky",
  "alt::503::0::Samurott::Water::-": "samurott",
  "alt::503::1::Samurott::Water::Dark": "samurott-hisuian",
  "alt::554::1::Darumaka::Ice::-": "darumaka-galarian",
  "alt::555::1::Darmanitan::Ice::-": "darmanitan-galarian",
  "alt::562::1::Yamask::Ground::Ghost": "yamask-galarian",
  "alt::618::1::Stunfisk::Ground::Steel": "stunfisk-galarian",
  "alt::628::0::Braviary::Normal::Flying": "braviary",
  "alt::628::1::Braviary::Psychic::Flying": "braviary-hisuian",
  "alt::713::0::Avalugg::Ice::-": "avalugg",
  "alt::713::1::Avalugg::Ice::Rock": "avalugg-hisuian",
  "alt::720::0::Hoopa::Psychic::Ghost": "hoopa",
  "alt::720::1::Hoopa::Psychic::Dark": "hoopa-unbound",
  "alt::724::1::Decidueye::Grass::Fighting": "decidueye-hisuian",
  "alt::800::1::Necrozma::Psychic::Steel": "necrozma-dusk-mane",
  "alt::800::2::Necrozma::Psychic::Ghost": "necrozma-dawn-wings",
  "alt::916::1::Oinkologne::Normal::-": "oinkologne-female"
};


const els = {
  dexModeBar: document.querySelector("#dexModeBar"),
  regionFilterBar: document.querySelector("#regionFilterBar"),
  statusFilterBar: document.querySelector("#statusFilterBar"),
  searchInput: document.querySelector("#searchInput"),
  autoEvolveToggle: document.querySelector("#autoEvolveToggle"),
  showAltFormsToggle: document.querySelector("#showAltFormsToggle"),
  editUnreleasedToggle: document.querySelector("#editUnreleasedToggle"),
  showUnavailableToggle: document.querySelector("#showUnavailableToggle"),
  showAllPokemonToggle: document.querySelector("#showAllPokemonToggle"),
  summaryTitle: document.querySelector("#summaryTitle"),
  summaryPills: document.querySelector("#summaryPills"),
  summaryTableBody: document.querySelector("#summaryTableBody"),
  summaryTableFoot: document.querySelector("#summaryTableFoot"),
  availabilityTitle: document.querySelector("#availabilityTitle"),
  availabilityLegend: document.querySelector("#availabilityLegend"),
  cardGrid: document.querySelector("#cardGrid"),
  gridTitle: document.querySelector("#gridTitle"),
  gridCountNote: document.querySelector("#gridCountNote"),
  backupAllBtn: document.querySelector("#backupAllBtn"),
  importAllInput: document.querySelector("#importAllInput"),
  cloudSyncBtn: document.querySelector("#cloudSyncBtn")
  ,accountRefreshBtn: document.querySelector("#accountRefreshBtn")
  ,syncPauseBtn: document.querySelector("#syncPauseBtn")
};

const state = loadState();

let rawRows = [];
let canonicalEntries = [];
let altEntries = [];
let megaEntries = [];
let gmaxEntries = [];
let megaExpandedEntries = [];
let gmaxExpandedEntries = [];
let entriesByMode = new Map();
let speciesEntriesByDex = new Map();
let stickyVisibleEntryIds = new Set();
let stickyFilterKey = "";
let cloudSyncTimer = null;
let cloudSyncDirty = false;
let longPressTimer = null;
let suppressNextStatusClickId = "";
let accountSyncPollTimer = null;
let accountSessionState = { loggedIn: false, configured: false, username: "owner" };
let accountSyncPrefs = loadAccountSyncPrefs();

const ALL_EVOLUTION_PREDECESSOR = window.POKEDEX_EVOLUTION_PREDECESSOR || {};
const REGIONAL_ONLY_EVOLUTIONS = {
  862: "galarian", 863: "galarian", 864: "galarian", 865: "galarian", 866: "galarian",
  867: "galarian", 902: "white-striped", 903: "hisuian", 904: "hisuian",
  980: "paldean"
};

initialize();

function initialize() {
  const csv = typeof window.POKEDEX_SEED_CSV === "string"
    ? window.POKEDEX_SEED_CSV
    : (window.POKEDEX_SEED_CSV?.value || "");
  rawRows = parseCsv(csv).map(buildRawEntry).filter(Boolean);
  buildCollections();
  migrateLegacyEntryIds();
  seedStateFromData();
  buildControls();
  bindEvents();
  render();
  initializeCloudSync();
}

function parseCsv(text) {
  const rows = [];
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
      if (row.some(value => value.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    cell += char;
  }

  if (cell.length || row.length) {
    row.push(cell);
    if (row.some(value => value.trim() !== "")) rows.push(row);
  }

  return rows;
}

function buildRawEntry(parts, index) {
  if (index === 0) return null;
  const dexLabel = (parts[0] || "").trim();
  const dex = Number((parts[1] || "").trim());
  const fallback = FALLBACK_SPECIES_METADATA[dex] || {};
  const rawName = (parts[2] || "").trim() || fallback.name || "";
  if (!dex || !rawName) return null;

  const type1 = normalizeType(parts[3]) || fallback.type1 || "";
  const type2 = normalizeType(parts[4]) || fallback.type2 || "";
  const region = (parts[5] || "").trim() || fallback.region || "";
  const rawCode = String(parts[6] || "").trim();
  const note = (parts[7] || "").trim();
  const baseName = rawName.split("#")[0].trim();
  const formName = rawName.includes("#") ? rawName.split("#")[1].trim() : "";
  const isMega = /#Mega|#Primal/i.test(rawName);
  const excludeFromDex = /not in pokedex/i.test(note) && !INCLUDE_SPECIAL_DEX.has(dex);

  return {
    id: `raw::${dex}::${rawName}::${type1 || "-"}::${type2 || "-"}`,
    dex,
    dexLabel,
    rawName,
    baseName,
    formName,
    type1,
    type2,
    region,
    note,
    rawCode,
    seedStatus: mapSeedCode(rawCode),
    isMega,
    isRegional: /regional/i.test(note),
    isUnreleased: /unreleased/i.test(note),
    excludeFromDex,
    releasedDateNote: /\d/.test(note) && !/regional|unreleased|not in pokedex/i.test(note) ? note : "",
    spriteHint: buildSpriteHint(rawName, formName)
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

function buildSpriteHint(rawName, formName) {
  if (/mega/i.test(rawName)) return "Mega";
  if (/primal/i.test(rawName)) return "Primal";
  return formName || "";
}

function buildCollections() {
  const built = buildSpeciesCollections(chooseCanonicalRow);
  canonicalEntries = built.canonicalEntries;
  altEntries = built.altEntries;
  megaEntries = buildMainstreamMegaEntries(built.megaEntries);
  speciesEntriesByDex = new Map();
  canonicalEntries.forEach(entry => {
    speciesEntriesByDex.set(entry.dex, [entry, ...altEntries.filter(candidate => candidate.dex === entry.dex)]);
  });

  gmaxEntries = [...GMAX_SPECIES.entries()].map(([dex, name]) => {
    const base = canonicalEntries.find(entry => entry.dex === dex);
    return {
      id: `gmax::${dex}`,
      dex,
      dexLabel: `#${String(dex).padStart(4, "0")}`,
      rawName: `${name}#GMAX`,
      baseName: name,
      formName: "GMAX",
      type1: base?.type1 || "",
      type2: base?.type2 || "",
      region: base?.region || "",
      note: "",
      isRegional: false,
      isUnreleased: false,
      spriteHint: "GMAX"
    };
  });

  megaExpandedEntries = buildExpandedAvailabilityEntries("mega", megaEntries);
  gmaxExpandedEntries = buildExpandedAvailabilityEntries("gmax", gmaxEntries);

  entriesByMode = new Map([
    ["pokemon", canonicalEntries],
    ["shiny", canonicalEntries],
    ["lucky", canonicalEntries],
    ["xxl", canonicalEntries],
    ["xxs", canonicalEntries],
    ["shadow", canonicalEntries],
    ["purified", canonicalEntries],
    ["perfect", canonicalEntries],
    ["mega", megaEntries],
    ["gmax", gmaxEntries]
  ]);
}

function buildMainstreamMegaEntries(existingEntries) {
  const byKey = new Map(existingEntries.map(entry => [`${entry.dex}|${entry.rawName}`, entry]));
  const merged = existingEntries.slice();
  for (const form of MAINSTREAM_MEGA_FORMS) {
    const key = `${form.dex}|${form.rawName}`;
    if (byKey.has(key)) continue;
    merged.push(buildMainstreamMegaPlaceholder(form));
  }
  merged.sort((a, b) => a.dex - b.dex || cleanDisplayName(a).localeCompare(cleanDisplayName(b)));
  return merged;
}

function buildMainstreamMegaPlaceholder(form) {
  const base = canonicalEntries.find(entry => entry.dex === form.dex);
  const formName = form.rawName.includes("#") ? form.rawName.split("#")[1].trim() : "Mega";
  return {
    id: `mega::${form.dex}::${form.rawName}`,
    dex: form.dex,
    dexLabel: `#${String(form.dex).padStart(4, "0")}`,
    rawName: form.rawName,
    baseName: form.rawName.split("#")[0].trim(),
    formName,
    type1: form.type1 || base?.type1 || "",
    type2: Object.prototype.hasOwnProperty.call(form, "type2") ? (form.type2 || "") : (base?.type2 || ""),
    region: base?.region || "",
    note: "Main series Mega/Primal form",
    isRegional: false,
    isUnreleased: false,
    spriteHint: buildSpriteHint(form.rawName, formName),
    importedBaseStatus: "missing"
  };
}

function buildExpandedAvailabilityEntries(mode, knownEntries) {
  const knownDexes = new Set(knownEntries.map(entry => entry.dex));
  const placeholders = canonicalEntries
    .filter(entry => !knownDexes.has(entry.dex))
    .map(entry => buildAvailabilityPlaceholderEntry(entry, mode));
  return [...knownEntries, ...placeholders].sort((a, b) => a.dex - b.dex || cleanDisplayName(a).localeCompare(cleanDisplayName(b)));
}

function buildAvailabilityPlaceholderEntry(entry, mode) {
  const label = mode === "mega" ? "Mega" : "GMAX";
  return {
    id: `${mode}-manual::${entry.dex}`,
    dex: entry.dex,
    dexLabel: entry.dexLabel,
    rawName: `${entry.baseName}#${label}`,
    baseName: entry.baseName,
    formName: label,
    type1: entry.type1,
    type2: entry.type2,
    region: entry.region,
    note: `Manual ${label} placeholder`,
    isRegional: false,
    isUnreleased: false,
    spriteHint: label,
    isManualAvailabilityPlaceholder: true,
    importedBaseStatus: "missing"
  };
}

function buildSpeciesCollections(canonicalSelector) {
  const speciesGroups = new Map();
  const regularRows = rawRows.filter(row => !row.isMega && !row.excludeFromDex);
  const builtMegaEntries = rawRows.filter(row => row.isMega && !row.excludeFromDex).map(row => toMegaEntry(row));

  for (const row of regularRows) {
    const key = String(row.dex);
    if (!speciesGroups.has(key)) speciesGroups.set(key, []);
    speciesGroups.get(key).push(row);
  }

  const builtCanonicalEntries = [];
  const builtAltEntries = [];

  for (const [dexKey, rows] of speciesGroups.entries()) {
    const canonicalRow = canonicalSelector(rows);
    const canonicalEntry = toCanonicalEntry(canonicalRow, rows);
    builtCanonicalEntries.push(canonicalEntry);

    const canonicalSignature = signatureForCanonical(canonicalRow);
    rows.forEach((row, idx) => {
      const rowSignature = signatureForCanonical(row);
      if (idx === 0 && rowSignature === canonicalSignature) return;
      if (rowSignature === canonicalSignature && row.rawName === canonicalRow.rawName && row.type1 === canonicalRow.type1 && row.type2 === canonicalRow.type2) return;
      builtAltEntries.push(toAltEntry(row, canonicalEntry, idx));
    });
  }

  builtCanonicalEntries.sort((a, b) => a.dex - b.dex);
  builtAltEntries.sort((a, b) => a.dex - b.dex || cleanDisplayName(a).localeCompare(cleanDisplayName(b)));
  builtMegaEntries.sort((a, b) => a.dex - b.dex || cleanDisplayName(a).localeCompare(cleanDisplayName(b)));

  return {
    canonicalEntries: builtCanonicalEntries,
    altEntries: builtAltEntries,
    megaEntries: builtMegaEntries
  };
}

function chooseCanonicalRow(rows) {
  const plain = rows.find(row => !row.formName);
  if (plain) return plain;
  return rows[0];
}

function chooseLegacyCanonicalRow(rows) {
  const preferred = rows.find(row => ["owned", "can-evolve"].includes(row.seedStatus) && !row.formName);
  if (preferred) return preferred;
  const plain = rows.find(row => !row.formName);
  if (plain) return plain;
  return rows[0];
}

function migrateLegacyEntryIds() {
  const legacy = buildSpeciesCollections(chooseLegacyCanonicalRow);
  const currentEntries = [...canonicalEntries, ...altEntries];
  const legacyEntries = [...legacy.canonicalEntries, ...legacy.altEntries];
  const signatureToCurrentId = new Map(currentEntries.map(entry => [entrySignature(entry), entry.id]));
  const remap = new Map();

  legacyEntries.forEach(entry => {
    const currentId = signatureToCurrentId.get(entrySignature(entry));
    if (currentId && currentId !== entry.id) {
      remap.set(entry.id, currentId);
    }
  });

  if (!remap.size) return;

  DEX_MODES.forEach(mode => {
    state.statuses[mode.id] = remapStatusBucket(state.statuses[mode.id] || {}, remap);
    state.statusMeta[mode.id] = remapMetaBucket(state.statusMeta[mode.id] || {}, remap);
    state.availability[mode.id] = remapAvailabilityBucket(state.availability[mode.id] || {}, remap);
  });
  state.unreleasedOverrides = remapBooleanBucket(state.unreleasedOverrides || {}, remap);
}

function entrySignature(entry) {
  return [entry.dex, entry.rawName, entry.type1 || "", entry.type2 || "", entry.region || ""].join("::");
}

function remapStatusBucket(bucket, remap) {
  const next = {};
  Object.entries(bucket || {}).forEach(([key, value]) => {
    const targetKey = remap.get(key) || key;
    if (!Object.prototype.hasOwnProperty.call(next, targetKey)) {
      next[targetKey] = value;
      return;
    }
    next[targetKey] = compareStatusPriority(next[targetKey], value) >= 0 ? next[targetKey] : value;
  });
  return next;
}

function remapMetaBucket(bucket, remap) {
  const next = {};
  Object.entries(bucket || {}).forEach(([key, value]) => {
    const targetKey = remap.get(key) || key;
    next[targetKey] = { ...(next[targetKey] || {}), ...(value || {}) };
  });
  return next;
}

function remapAvailabilityBucket(bucket, remap) {
  const next = {};
  Object.entries(bucket || {}).forEach(([key, value]) => {
    const targetKey = remap.get(key) || key;
    next[targetKey] = !!next[targetKey] || !!value;
  });
  return next;
}

function remapBooleanBucket(bucket, remap) {
  const next = {};
  Object.entries(bucket || {}).forEach(([key, value]) => {
    const targetKey = remap.get(key) || key;
    if (!Object.prototype.hasOwnProperty.call(next, targetKey)) {
      next[targetKey] = value;
    }
  });
  return next;
}

function compareStatusPriority(left, right) {
  const priority = {
    "": 0,
    "missing": 1,
    "missing-lock": 2,
    "can-evolve": 3,
    "trade": 4,
    "owned": 5
  };
  return (priority[left] || 0) - (priority[right] || 0);
}

function getEntryChangedAt(snapshot, mode, entryId) {
  return String(snapshot?.statusMeta?.[mode]?.[entryId]?.changedAt || snapshot?._meta?.lastModifiedAt || "");
}

function toCanonicalEntry(row, groupRows) {
  return {
    id: `pokemon::${row.dex}`,
    dex: row.dex,
    dexLabel: row.dexLabel,
    rawName: row.baseName,
    baseName: row.baseName,
    formName: "",
    type1: row.type1,
    type2: row.type2,
    region: row.region,
    note: row.note,
    isRegional: groupRows.some(item => item.isRegional),
    isUnreleased: groupRows.some(item => item.isUnreleased),
    spriteHint: "",
    familyGroup: row.region,
    importedBaseStatus: aggregateCanonicalStatus(groupRows)
  };
}

function toAltEntry(row, canonicalEntry, idx) {
  const fallbackFormName = row.formName || buildAltLabel(row, canonicalEntry);
  return {
    id: `alt::${row.dex}::${idx}::${row.rawName}::${row.type1 || "-"}::${row.type2 || "-"}`,
    dex: row.dex,
    dexLabel: row.dexLabel,
    rawName: row.rawName,
    baseName: row.baseName,
    formName: fallbackFormName,
    type1: row.type1,
    type2: row.type2,
    region: row.region,
    note: row.note,
    isRegional: row.isRegional,
    isUnreleased: row.isUnreleased,
    isAltForm: true,
    spriteHint: fallbackFormName,
    importedBaseStatus: row.seedStatus === "owned-alt" ? "owned" : row.seedStatus || "missing"
  };
}

function toMegaEntry(row) {
  return {
    id: `mega::${row.dex}::${row.rawName}`,
    dex: row.dex,
    dexLabel: row.dexLabel,
    rawName: row.rawName,
    baseName: row.baseName,
    formName: row.formName || "Mega",
    type1: row.type1,
    type2: row.type2,
    region: row.region,
    note: row.note,
    isRegional: row.isRegional,
    isUnreleased: row.isUnreleased,
    spriteHint: buildSpriteHint(row.rawName, row.formName),
    importedBaseStatus: row.seedStatus === "owned-alt" ? "owned" : row.seedStatus || "missing"
  };
}

function aggregateCanonicalStatus(rows) {
  const baseRows = rows.filter(row => row.seedStatus !== "owned-alt" && row.seedStatus !== "missing");
  if (baseRows.some(row => row.seedStatus === "owned")) return "owned";
  if (baseRows.some(row => row.seedStatus === "can-evolve")) return "can-evolve";
  if (rows.some(row => row.isUnreleased)) return "unreleased";
  if (rows.some(row => row.seedStatus === "missing")) return "missing";
  return "missing";
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

function seedStateFromData() {
  const fallback = {
    activeMode: "pokemon",
    statusFilter: "all",
    search: "",
    regionFilter: "all",
    autoEvolve: true,
    showAltForms: true,
    editUnreleased: false,
    showUnavailable: false,
    statuses: {},
    availability: {},
    unreleasedOverrides: {},
    statusMeta: {}
  };

  const existing = structuredClone(state);
  Object.assign(state, fallback, existing);

  let changed = false;

  for (const mode of DEX_MODES) {
    state.statuses[mode.id] ||= {};
    state.availability[mode.id] ||= {};
    state.statusMeta[mode.id] ||= {};
  }
  if (state.showAllPokemon == null) {
    state.showAllPokemon = false;
  }

  canonicalEntries.forEach(entry => {
    if (state.statuses.pokemon[entry.id] == null) {
      state.statuses.pokemon[entry.id] = entry.importedBaseStatus || "missing";
      changed = true;
    }
    for (const mode of STANDARD_COLLECTION_MODES.filter(mode => mode !== "pokemon")) {
      if (state.statuses[mode][entry.id] == null) {
        state.statuses[mode][entry.id] = "missing";
        changed = true;
      }
    }
  });

  altEntries.forEach(entry => {
    if (state.statuses.pokemon[entry.id] == null) {
      state.statuses.pokemon[entry.id] = entry.importedBaseStatus || "missing";
      changed = true;
    }
    for (const mode of STANDARD_COLLECTION_MODES.filter(mode => mode !== "pokemon")) {
      if (state.statuses[mode][entry.id] == null) {
        state.statuses[mode][entry.id] = "missing";
        changed = true;
      }
    }
  });

  megaEntries.forEach(entry => {
    if (state.statuses.mega[entry.id] == null) {
      state.statuses.mega[entry.id] = entry.importedBaseStatus || "missing";
      changed = true;
    }
    if (state.availability.mega[entry.id] == null) {
      state.availability.mega[entry.id] = entry.importedBaseStatus === "owned";
      changed = true;
    }
  });

  gmaxEntries.forEach(entry => {
    if (state.statuses.gmax[entry.id] == null) {
      state.statuses.gmax[entry.id] = "missing";
      changed = true;
    }
    if (state.availability.gmax[entry.id] == null) {
      state.availability.gmax[entry.id] = false;
      changed = true;
    }
  });

  changed = ensureAvailabilityEntriesSeeded(megaExpandedEntries, "mega") || changed;
  changed = ensureAvailabilityEntriesSeeded(gmaxExpandedEntries, "gmax") || changed;

}

function ensureAvailabilityEntriesSeeded(entries, mode) {
  let changed = false;
  for (const entry of entries) {
    if (state.statuses[mode][entry.id] == null) {
      state.statuses[mode][entry.id] = entry.importedBaseStatus || "missing";
      changed = true;
    }
    if (state.availability[mode][entry.id] == null) {
      state.availability[mode][entry.id] = !!(entry.importedBaseStatus === "owned");
      changed = true;
    }
  }
  return changed;
}

function loadState() {
  const saved = chooseCurrentPokedexStorageValue();
  if (!saved) {
    return {
      activeMode: "pokemon",
      statusFilter: "all",
      search: "",
      regionFilter: "all",
      autoEvolve: true,
      showAltForms: true,
      editUnreleased: false,
      showUnavailable: false,
      showAllPokemon: false,
      statuses: {},
      availability: {},
      unreleasedOverrides: {},
      statusMeta: {}
    };
  }

  try {
    return JSON.parse(saved);
  } catch {
    return {
      activeMode: "pokemon",
      statusFilter: "all",
      search: "",
      regionFilter: "all",
      autoEvolve: true,
      showAltForms: true,
      editUnreleased: false,
      showUnavailable: false,
      showAllPokemon: false,
      statuses: {},
      availability: {},
      unreleasedOverrides: {},
      statusMeta: {}
    };
  }
}

function chooseCurrentPokedexStorageValue() {
  const candidates = [
    localStorage.getItem(STORAGE_KEY),
    ...LEGACY_POKEDEX_STORAGE_KEYS.map(key => localStorage.getItem(key))
  ]
    .filter(Boolean)
    .map(raw => safeJsonParse(raw))
    .filter(Boolean);

  if (!candidates.length) return null;
  let best = candidates[0];
  let bestTime = getModifiedAt(best);
  for (const candidate of candidates.slice(1)) {
    const time = getModifiedAt(candidate);
    if (time > bestTime) {
      best = candidate;
      bestTime = time;
    }
  }
  return JSON.stringify(best);
}

function loadLegacyPokedexState() {
  for (const key of LEGACY_POKEDEX_STORAGE_KEYS) {
    const value = localStorage.getItem(key);
    if (value) return value;
  }
  return null;
}

function persistPokedexLocalState(serialized) {
  localStorage.setItem(STORAGE_KEY, serialized);
  for (const key of LEGACY_POKEDEX_STORAGE_KEYS) {
    localStorage.setItem(key, serialized);
  }
}

function saveState(options = {}) {
  state._meta = { ...(state._meta || {}), lastModifiedAt: new Date().toISOString() };
  persistPokedexLocalState(JSON.stringify(state));
  if (options.sync !== false) {
    cloudSyncDirty = true;
    scheduleCloudPush();
  }
}

function buildControls() {
  els.dexModeBar.innerHTML = DEX_MODES.map(mode => (
    `<button class="mode-btn ${mode.id === state.activeMode ? "active" : ""}" data-mode="${mode.id}">${mode.label}</button>`
  )).join("");

  els.regionFilterBar.innerHTML = [`<button class="filter-btn ${state.regionFilter === "all" ? "active" : ""}" data-region-filter="all">All regions</button>`]
    .concat(REGIONS.map(region => `<button class="filter-btn ${region === state.regionFilter ? "active" : ""}" data-region-filter="${region}">${region}</button>`))
    .join("");

  els.statusFilterBar.innerHTML = STATUS_FILTERS.map(filter => (
    `<button class="filter-btn ${filter.id === state.statusFilter ? "active" : ""}" data-filter="${filter.id}">${filter.label}</button>`
  )).join("");

  els.searchInput.value = state.search;
  els.autoEvolveToggle.checked = state.autoEvolve;
  els.showAltFormsToggle.checked = state.showAltForms;
  els.editUnreleasedToggle.checked = state.editUnreleased;
  els.showUnavailableToggle.checked = state.showUnavailable;
  els.showAllPokemonToggle.checked = state.showAllPokemon;
}

function applyRegionFilter(region) {
  state.regionFilter = region;
  clearStickyVisibility();
  saveState({ sync: false });
  buildControls();
  render();
}

function renderRegionFilterControl(region, label = region) {
  const isActive = state.regionFilter === region;
  return `<button class="filter-btn summary-region-btn ${isActive ? "active" : ""}" data-region-filter="${escapeAttribute(region)}">${escapeHtml(label)}</button>`;
}

function bindEvents() {
  els.dexModeBar.addEventListener("click", event => {
    const button = event.target.closest("[data-mode]");
    if (!button) return;
    state.activeMode = button.dataset.mode;
    clearStickyVisibility();
    saveState({ sync: false });
    buildControls();
    render();
  });

  els.statusFilterBar.addEventListener("click", event => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    state.statusFilter = button.dataset.filter;
    clearStickyVisibility();
    saveState({ sync: false });
    buildControls();
    render();
  });

  els.regionFilterBar.addEventListener("click", event => {
    const button = event.target.closest("[data-region-filter]");
    if (!button) return;
    applyRegionFilter(button.dataset.regionFilter);
  });

  els.summaryTableBody.addEventListener("click", event => {
    const button = event.target.closest("[data-region-filter]");
    if (!button) return;
    applyRegionFilter(button.dataset.regionFilter);
  });

  els.summaryTableFoot.addEventListener("click", event => {
    const button = event.target.closest("[data-region-filter]");
    if (!button) return;
    applyRegionFilter(button.dataset.regionFilter);
  });

  els.searchInput.addEventListener("input", () => {
    state.search = els.searchInput.value;
    clearStickyVisibility();
    saveState({ sync: false });
    render();
  });

  els.autoEvolveToggle.addEventListener("change", () => {
    state.autoEvolve = els.autoEvolveToggle.checked;
    clearStickyVisibility();
    saveState({ sync: false });
    render();
  });

  els.showAltFormsToggle.addEventListener("change", () => {
    state.showAltForms = els.showAltFormsToggle.checked;
    clearStickyVisibility();
    saveState({ sync: false });
    render();
  });

  els.editUnreleasedToggle.addEventListener("change", () => {
    state.editUnreleased = els.editUnreleasedToggle.checked;
    clearStickyVisibility();
    saveState({ sync: false });
    render();
  });

  els.showUnavailableToggle.addEventListener("change", () => {
    state.showUnavailable = els.showUnavailableToggle.checked;
    if (!state.showUnavailable && state.showAllPokemon) {
      state.showAllPokemon = false;
      els.showAllPokemonToggle.checked = false;
    }
    clearStickyVisibility();
    saveState({ sync: false });
    render();
  });

  els.showAllPokemonToggle.addEventListener("change", () => {
    state.showAllPokemon = els.showAllPokemonToggle.checked;
    if (state.showAllPokemon) {
      state.showUnavailable = true;
      els.showUnavailableToggle.checked = true;
    }
    clearStickyVisibility();
    saveState({ sync: false });
    render();
  });

  els.cardGrid.addEventListener("click", event => {
    const statusTarget = event.target.closest("[data-cycle-status]");
    if (statusTarget) {
      if (suppressNextStatusClickId === statusTarget.dataset.entryId) {
        suppressNextStatusClickId = "";
        return;
      }
      cycleStatus(statusTarget.dataset.entryId);
      return;
    }

    const availabilityTarget = event.target.closest("[data-toggle-availability]");
    if (availabilityTarget) {
      toggleAvailability(availabilityTarget.dataset.entryId);
      return;
    }

    const unreleasedTarget = event.target.closest("[data-toggle-unreleased]");
    if (unreleasedTarget) {
      toggleUnreleased(unreleasedTarget.dataset.entryId);
    }
  });

  els.cardGrid.addEventListener("contextmenu", event => {
    const statusTarget = event.target.closest("[data-cycle-status]");
    if (!statusTarget) return;
    event.preventDefault();
    setTradeStatus(statusTarget.dataset.entryId);
  });

  els.cardGrid.addEventListener("pointerdown", event => {
    const statusTarget = event.target.closest("[data-cycle-status]");
    if (!statusTarget) return;
    clearLongPressTimer();
    longPressTimer = setTimeout(() => {
      suppressNextStatusClickId = statusTarget.dataset.entryId;
      setTradeStatus(statusTarget.dataset.entryId);
      longPressTimer = null;
    }, 500);
  });

  ["pointerup", "pointerleave", "pointercancel"].forEach(eventName => {
    els.cardGrid.addEventListener(eventName, clearLongPressTimer);
  });

  els.cloudSyncBtn?.addEventListener("click", openCloudSyncDialog);
  els.accountRefreshBtn?.addEventListener("click", handleManualRefreshClick);
  els.syncPauseBtn?.addEventListener("click", toggleSyncPause);
  els.backupAllBtn?.addEventListener("click", openBackupDialog);
  els.importAllInput?.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    await handleCombinedImport(file);
    event.target.value = "";
  });

  window.addEventListener("pagehide", flushCloudPushOnPageHide);
}

function render() {
  reconcileAutoEvolveStatuses();
  renderModeVisibility();
  renderSummary();
  renderAvailabilityLegend();
  renderGrid();
}

function renderModeVisibility() {
  const isAvailabilityMode = ["mega", "gmax"].includes(state.activeMode);
  document.querySelectorAll(".mode-availability").forEach(node => {
    node.classList.toggle("visible", isAvailabilityMode);
  });
}

function renderSummary() {
  const mode = DEX_MODES.find(item => item.id === state.activeMode);
  const entries = getSummaryEntries();
  const totals = computeCounts(entries);

  els.summaryTitle.textContent = `${mode.label} Dex`;
  if (els.gridTitle) {
    els.gridTitle.textContent = `${mode.label} Cards`;
  }
  els.availabilityTitle.textContent = `${mode.label} availability`;
  if (els.summaryPills) {
    els.summaryPills.innerHTML = "";
  }

  els.summaryTableBody.innerHTML = "";
  REGIONS.forEach(region => {
    const regionEntries = entries.filter(entry => entry.region === region);
    const counts = computeCounts(regionEntries);
    const tr = document.createElement("tr");
    const rowClass = getSummaryRowClass(counts);
    if (rowClass) tr.classList.add(rowClass);
    tr.innerHTML = `
      <td>${renderRegionFilterControl(region)}</td>
      <td>${counts.total}</td>
      <td>${counts.owned}</td>
      <td>${counts.evolutions}</td>
      <td>${counts.missing}</td>
      <td>${counts.uniqueMissing}</td>
      <td>${counts.unreleased}</td>
    `;
    els.summaryTableBody.append(tr);
  });

  els.summaryTableFoot.innerHTML = `
    <tr>
      <td>${renderRegionFilterControl("all", "All Regions")}</td>
      <td>${totals.total}</td>
      <td>${totals.owned}</td>
      <td>${totals.evolutions}</td>
      <td>${totals.missing}</td>
      <td>${totals.uniqueMissing}</td>
      <td>${totals.unreleased}</td>
    </tr>
  `;
}

function getSummaryRowClass(counts) {
  if (!counts.total) return "";
  if (counts.unreleased === 0 && counts.missing === 0 && counts.evolutions === 0) return "summary-complete";
  if (counts.unreleased === 0) return "summary-completable";
  return "";
}

function renderAvailabilityLegend() {
  if (!["mega", "gmax"].includes(state.activeMode)) {
    els.availabilityLegend.innerHTML = "";
    return;
  }

  const entries = getAvailabilityEntriesForMode(state.activeMode);
  const available = entries.filter(entry => isAvailable(entry)).length;
  const unavailable = entries.length - available;
  els.availabilityLegend.innerHTML = `
    <span class="availability-pill">Available ${available}</span>
    <span class="availability-pill">Unavailable ${unavailable}</span>
    ${state.showAllPokemon ? `<span class="availability-pill">All Pokemon view</span>` : ""}
  `;
}

function renderGrid() {
  const entries = getVisibleEntries();
  if (els.gridCountNote) {
    els.gridCountNote.textContent = "";
  }

  if (!entries.length) {
    els.cardGrid.innerHTML = `<div class="empty-state">No entries match the current tab, search, and filters.</div>`;
    return;
  }

  els.cardGrid.innerHTML = entries.map(renderCard).join("");
}

function renderCard(entry) {
  const status = getEffectiveStatus(entry, state.activeMode);
  const { primary, fallbacks } = getSpriteSources(entry, state.activeMode);
  const tags = [];
  if (entry.isRegional) tags.push(`<span class="tag regional">Regional</span>`);
  if (isCurrentlyUnreleased(entry)) tags.push(`<span class="tag unreleased">Unreleased</span>`);
  else if (entry.isUnreleased) tags.push(`<span class="tag dismissed">Released</span>`);
  if (entry.isAltForm) tags.push(`<span class="tag alt">Alt form</span>`);
  if (entry.releasedDateNote) tags.push(`<span class="tag">${escapeHtml(entry.releasedDateNote)}</span>`);

  return `
    <article class="dex-card">
      <div class="card-head">
        <div class="dex-number">${escapeHtml(entry.dexLabel)}</div>
        <div class="tag-row">${tags.join("")}</div>
      </div>
      <div class="sprite-wrap">
        <img src="${escapeAttribute(primary)}" alt="${escapeAttribute(cleanDisplayName(entry))}" loading="lazy" onerror="handleDexSpriteError(this)" data-fallbacks="${escapeAttribute(fallbacks.join("|"))}">
        ${entry.spriteHint ? `<span class="sprite-badge">${escapeHtml(entry.spriteHint)}</span>` : ""}
      </div>
      <div class="card-body">
        <div class="pokemon-name">${escapeHtml(cleanDisplayName(entry))}</div>
        <div class="subline">${escapeHtml(buildSubline(entry))}</div>
        <button class="status-btn ${statusClassName(status)}" data-cycle-status data-entry-id="${escapeAttribute(entry.id)}" title="Click to cycle status. Long press or right-click to mark Trade.">${statusLabel(status)}</button>
        ${shouldShowUnreleasedButton(entry) ? renderUnreleasedButton(entry) : ""}
        ${["mega", "gmax"].includes(state.activeMode) ? renderAvailabilityButton(entry) : ""}
      </div>
    </article>
  `;
}

function renderAvailabilityButton(entry) {
  const available = isAvailable(entry);
  return `<button class="availability-btn ${available ? "available" : "unavailable"}" data-toggle-availability data-entry-id="${escapeAttribute(entry.id)}">${available ? "Available" : "Unavailable"}</button>`;
}

function renderUnreleasedButton(entry) {
  const unreleased = isCurrentlyUnreleased(entry);
  return `<button class="release-btn ${unreleased ? "is-unreleased" : "is-released"}" data-toggle-unreleased data-entry-id="${escapeAttribute(entry.id)}">${unreleased ? "Dismiss unreleased" : "Mark unreleased"}</button>`;
}

function shouldShowUnreleasedButton(entry) {
  return state.editUnreleased || isCurrentlyUnreleased(entry) || Object.prototype.hasOwnProperty.call(state.unreleasedOverrides, entry.id);
}

function getSummaryEntries() {
  if (state.activeMode === "mega") {
    return filterByAvailability(getAvailabilityEntriesForMode("mega"));
  }

  if (state.activeMode === "gmax") {
    return filterByAvailability(getAvailabilityEntriesForMode("gmax"));
  }

  return canonicalEntries.slice();
}

function filterByAvailability(entries) {
  return state.showUnavailable ? entries.slice() : entries.filter(entry => isAvailable(entry));
}

function getEntriesForMode(mode) {
  if (mode === "mega" || mode === "gmax") {
    return getAvailabilityEntriesForMode(mode);
  }
  return entriesByMode.get(mode) || [];
}

function getAvailabilityEntriesForMode(mode) {
  const expandedEntries = mode === "mega" ? megaExpandedEntries : mode === "gmax" ? gmaxExpandedEntries : [];
  if (mode === "mega") {
    return state.showAllPokemon ? megaExpandedEntries : expandedEntries.filter(entry => shouldIncludeCollapsedAvailabilityEntry(entry, mode));
  }
  if (mode === "gmax") {
    return state.showAllPokemon ? gmaxExpandedEntries : expandedEntries.filter(entry => shouldIncludeCollapsedAvailabilityEntry(entry, mode));
  }
  return [];
}

function shouldIncludeCollapsedAvailabilityEntry(entry, mode) {
  if (!entry?.isManualAvailabilityPlaceholder) return true;
  if (isEffectivelyAvailableInMode(mode, entry)) return true;
  if (Object.prototype.hasOwnProperty.call(state.unreleasedOverrides || {}, entry.id)) return true;
  const storedStatus = state.statuses?.[mode]?.[entry.id];
  return !!storedStatus && storedStatus !== "missing" && storedStatus !== "missing-lock";
}

function getVisibleEntries() {
  const search = state.search.trim().toLowerCase();
  let entries = STANDARD_COLLECTION_MODES.includes(state.activeMode)
    ? getStandardEntriesInDisplayOrder()
    : getEntriesForMode(state.activeMode).slice();
  const activeStickyKey = getStickyFilterKey();
  const keepEditedVisible = stickyFilterKey === activeStickyKey ? stickyVisibleEntryIds : new Set();
  const availableMegaDexes = state.statusFilter === "mega" ? getAvailableMegaDexes() : null;

  if (["mega", "gmax"].includes(state.activeMode) && !state.showUnavailable) {
    entries = entries.filter(entry => isAvailable(entry));
  }

  return entries.filter(entry => {
    if (keepEditedVisible.has(entry.id)) return true;
    const status = getEffectiveStatus(entry, state.activeMode);
    if (state.regionFilter !== "all" && entry.region !== state.regionFilter) return false;
    if (state.statusFilter === "unreleased" && !isCurrentlyUnreleased(entry)) return false;
    else if (state.statusFilter === "regional" && !entry.isRegional) return false;
    else if (state.statusFilter === "mega" && !availableMegaDexes?.has(entry.dex)) return false;
    else if (state.statusFilter === "unowned" && !["missing", "can-evolve", "trade", "unreleased"].includes(status)) return false;
    else if (!["all", "unreleased", "regional", "mega", "unowned"].includes(state.statusFilter) && status !== state.statusFilter) return false;
    if (!search) return true;
    return cleanDisplayName(entry).toLowerCase().includes(search) || String(entry.dex).includes(search);
  });
}

function getAvailableMegaDexes() {
  const megaEntriesToCheck = getAvailabilityEntriesForMode("mega");
  return new Set(
    megaEntriesToCheck
      .filter(entry => isEffectivelyAvailableInMode("mega", entry))
      .map(entry => Number(entry.dex))
      .filter(Number.isFinite)
  );
}

function getStandardEntriesInDisplayOrder() {
  const groupedAlts = new Map();
  altEntries.forEach(entry => {
    if (!groupedAlts.has(entry.dex)) groupedAlts.set(entry.dex, []);
    groupedAlts.get(entry.dex).push(entry);
  });

  const out = [];
  canonicalEntries.forEach(entry => {
    out.push(entry);
    if (state.showAltForms && groupedAlts.has(entry.dex)) {
      out.push(...groupedAlts.get(entry.dex));
    }
  });
  return out;
}

function computeCounts(entries) {
  const counts = { total: 0, owned: 0, evolutions: 0, missing: 0, uniqueMissing: 0, unreleased: 0 };
  const missingDexes = new Set();
  for (const entry of entries) {
    counts.total += 1;
    const status = shouldUseSpeciesSummaryLogic(state.activeMode)
      ? getSpeciesSummaryStatus(entry.dex, state.activeMode)
      : getEffectiveStatus(entry, state.activeMode);
    if (status === "unreleased") {
      counts.unreleased += 1;
      continue;
    }
    if (status === "owned") counts.owned += 1;
    else if (["can-evolve", "trade"].includes(status)) counts.evolutions += 1;
    else {
      counts.missing += 1;
      missingDexes.add(entry.dex);
    }
  }
  // Count one acquisition for each missing branch, not each missing evolution stage.
  counts.uniqueMissing = [...missingDexes].filter(dex => !missingDexes.has(ALL_EVOLUTION_PREDECESSOR[dex])).length;
  return counts;
}

function getEffectiveStatus(entry, mode) {
  const stored = state.statuses[mode]?.[entry.id];
  if (["owned", "can-evolve", "trade"].includes(stored)) return stored;
  if (stored === "missing-lock") return "missing";
  if (isCurrentlyUnreleased(entry)) return "unreleased";
  if (stored === "unreleased") return "missing";

  if (STANDARD_COLLECTION_MODES.includes(mode) && mode !== "pokemon") {
    return (stored && stored !== "unreleased" ? stored : "missing");
  }

  const baseStatus = stored || entry.importedBaseStatus || "missing";
  return baseStatus === "unreleased" ? "missing" : baseStatus;
}

function cycleStatus(entryId) {
  const entry = getEntryById(entryId);
  if (!entry) return;
  const current = getEffectiveStatus(entry, state.activeMode);
  if (current === "unreleased") return;
  const autoDerived = isAutoDerivedCanEvolve(state.activeMode, entryId);
  let next = "missing";
  if (current === "missing") next = "owned";
  else if (current === "owned") next = "can-evolve";
  else if (current === "trade") next = "owned";
  else if (current === "can-evolve") next = autoDerived ? "owned" : "missing";
  setEntryStatus(state.activeMode, entryId, next, { autoDerived: false });
  registerStickyVisible(entryId);
  if (["owned", "trade"].includes(next) && state.autoEvolve) {
    propagateOwnedForward(entryId, state.activeMode);
  }
  saveState();
  render();
}

function propagateOwnedForward(entryId, mode) {
  const entry = getEntryById(entryId);
  if (!entry || ["mega", "gmax"].includes(mode)) return;
  const descendants = getEvolutionTargets(entry);
  descendants.forEach(desc => {
    const stored = state.statuses[mode][desc.id];
    if (!isCurrentlyUnreleased(desc) && (!stored || stored === "missing")) {
      setEntryStatus(mode, desc.id, "can-evolve", { autoDerived: true });
      registerStickyVisible(desc.id);
    }
  });
}

function reconcileAutoEvolveStatuses() {
  for (const mode of STANDARD_COLLECTION_MODES) {
    const derived = new Set();
    if (state.autoEvolve) {
      for (const entry of [...canonicalEntries, ...altEntries]) {
        if (!["owned", "trade"].includes(state.statuses[mode]?.[entry.id])) continue;
        getEvolutionTargets(entry).forEach(target => {
          if (!isCurrentlyUnreleased(target)) derived.add(target.id);
        });
      }
    }
    for (const [id, meta] of Object.entries(state.statusMeta[mode] || {})) {
      if (!meta.autoDerivedCanEvolve || derived.has(id)) continue;
      if (state.statuses[mode][id] === "can-evolve") state.statuses[mode][id] = "missing";
      delete state.statusMeta[mode][id];
    }
    for (const id of derived) {
      if (![undefined, "missing"].includes(state.statuses[mode][id])) continue;
      state.statuses[mode][id] = "can-evolve";
      state.statusMeta[mode][id] = { autoDerivedCanEvolve: true, changedAt: new Date().toISOString() };
    }
  }
}

function shouldUseSpeciesSummaryLogic(mode) {
  return STANDARD_COLLECTION_MODES.includes(mode);
}

function getSpeciesSummaryStatus(dex, mode) {
  const speciesEntries = speciesEntriesByDex.get(Number(dex)) || [];
  if (!speciesEntries.length) return "missing";
  if (speciesEntries.some(entry => getEffectiveStatus(entry, mode) === "owned")) return "owned";
  if (speciesEntries.some(entry => ["can-evolve", "trade"].includes(getEffectiveStatus(entry, mode)))) return "can-evolve";
  if (speciesEntries.every(entry => isCurrentlyUnreleased(entry))) return "unreleased";
  return "missing";
}

function getEvolutionTargets(entry) {
  const targets = [];
  const queue = [entry];
  const seen = new Set([entry.id]);
  while (queue.length) {
    const current = queue.shift();
    getDirectEvolutionTargets(current).forEach(target => {
      if (seen.has(target.id)) return;
      seen.add(target.id);
      targets.push(target);
      queue.push(target);
    });
  }
  return targets;
}

function getDirectEvolutionTargets(entry) {
  const sourceFamily = getFormFamilyKey(entry);
  const targets = [];
  for (const [dexText, predecessor] of Object.entries(ALL_EVOLUTION_PREDECESSOR)) {
    if (predecessor !== entry.dex) continue;
    const dex = Number(dexText);
    const requiredFamily = REGIONAL_ONLY_EVOLUTIONS[dex];
    if (requiredFamily && sourceFamily !== requiredFamily && !(dex === 902 && !entry.isAltForm)) continue;
    const forms = speciesEntriesByDex.get(dex) || [];
    const ordinary = forms.find(candidate => !candidate.isAltForm);
    const matching = forms.find(candidate => getFormFamilyKey(candidate) === sourceFamily && candidate.isAltForm);
    if (requiredFamily) {
      if (ordinary) targets.push(ordinary);
    } else if (entry.isAltForm && sourceFamily) {
      if (matching) targets.push(matching);
    } else {
      if (ordinary) targets.push(ordinary);
      if (!entry.isAltForm) {
        forms.filter(candidate => candidate.isAltForm && getFormFamilyKey(candidate) &&
          !(speciesEntriesByDex.get(entry.dex) || []).some(parent =>
            parent.isAltForm && getFormFamilyKey(parent) === getFormFamilyKey(candidate)))
          .forEach(candidate => targets.push(candidate));
      }
    }
  }
  return targets;
}

function getFormFamilyKey(entry) {
  const slug = getSpecialSpriteSlug(entry, "pokemon");
  if (!slug) return "";
  if (slug.includes("-alolan")) return "alolan";
  if (slug.includes("-galarian")) return "galarian";
  if (slug.includes("-hisuian")) return "hisuian";
  if (slug.includes("-paldean")) return "paldean";
  return "";
}

function setEntryStatus(mode, entryId, nextStatus, options = {}) {
  state.statuses[mode] ||= {};
  state.statusMeta[mode] ||= {};
  const changedAt = new Date().toISOString();

  if (nextStatus === "missing") {
    state.statuses[mode][entryId] = "missing-lock";
    state.statusMeta[mode][entryId] = { changedAt };
    return;
  }

  state.statuses[mode][entryId] = nextStatus;
  if (nextStatus === "can-evolve" && options.autoDerived) {
    state.statusMeta[mode][entryId] = { autoDerivedCanEvolve: true, changedAt };
  } else {
    state.statusMeta[mode][entryId] = { changedAt };
  }
}

function isAutoDerivedCanEvolve(mode, entryId) {
  return !!state.statusMeta?.[mode]?.[entryId]?.autoDerivedCanEvolve;
}

function getEntryById(entryId) {
  const all = [...canonicalEntries, ...altEntries, ...megaExpandedEntries, ...gmaxExpandedEntries];
  return all.find(entry => entry.id === entryId) || null;
}

function setTradeStatus(entryId) {
  const entry = getEntryById(entryId);
  if (!entry || isCurrentlyUnreleased(entry)) return;
  setEntryStatus(state.activeMode, entryId, "trade", { autoDerived: false });
  registerStickyVisible(entryId);
  if (state.autoEvolve) {
    propagateOwnedForward(entryId, state.activeMode);
  }
  saveState();
  render();
}

function clearLongPressTimer() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

function toggleUnreleased(entryId) {
  const entry = getEntryById(entryId);
  if (!entry) return;
  const current = isCurrentlyUnreleased(entry);
  if (!state.unreleasedOverrides) {
    state.unreleasedOverrides = {};
  }
  state.unreleasedOverrides[entryId] = !current;
  if (current && state.statuses?.[state.activeMode]?.[entryId] === "unreleased") {
    setEntryStatus(state.activeMode, entryId, "missing", { autoDerived: false });
  }
  saveState();
  render();
}

function isCurrentlyUnreleased(entry) {
  if (Object.prototype.hasOwnProperty.call(state.unreleasedOverrides, entry.id)) {
    return !!state.unreleasedOverrides[entry.id];
  }
  return !!entry.isUnreleased;
}

function toggleAvailability(entryId) {
  const mode = state.activeMode;
  state.availability[mode][entryId] = !state.availability[mode][entryId];
  saveState();
  render();
}

function isAvailable(entry) {
  return isEffectivelyAvailableInMode(state.activeMode, entry);
}

function isAvailableInMode(mode, entry) {
  return !!state.availability?.[mode]?.[entry.id];
}

function isEffectivelyAvailableInMode(mode, entry) {
  if (isAvailableInMode(mode, entry)) return true;
  if (!entry?.isManualAvailabilityPlaceholder) return false;
  if (isCurrentlyUnreleased(entry)) return false;
  const storedStatus = state.statuses?.[mode]?.[entry.id];
  return !!storedStatus && storedStatus !== "missing" && storedStatus !== "missing-lock";
}

function safeJsonParse(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function buildPokedexBackup() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      pokedex: state
    }
  };
}

function downloadPokedexBackup() {
  const payload = buildPokedexBackup();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const stamp = payload.exportedAt.slice(0, 19).replace(/[:T]/g, "-");
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `pogo-pokedex-backup-${stamp}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function openBackupDialog() {
  const result = await window.Swal.fire({
    title: "Backup / Restore",
    html: "Download a Pokedex-only backup file, or restore the Pokedex from a previous backup.",
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonText: "Download backup",
    denyButtonText: "Restore backup",
    cancelButtonText: "Cancel",
    confirmButtonColor: "#6ef0ab",
    denyButtonColor: "#7fd4ff",
    background: "#121c34",
    color: "#eef4ff"
  });
  if (result.isConfirmed) {
    downloadPokedexBackup();
    return;
  }
  if (result.isDenied) {
    els.importAllInput?.click();
  }
}

async function handleCombinedImport(file) {
  if (!file) return;
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    await window.Swal.fire({ icon: "error", title: "Invalid backup", text: "That file is not valid JSON.", background: "#121c34", color: "#eef4ff" });
    return;
  }
  const pokedex = parsed?.data?.pokedex;
  if (!pokedex) {
    await window.Swal.fire({ icon: "error", title: "Invalid backup", text: "That file is missing Pokedex data.", background: "#121c34", color: "#eef4ff" });
    return;
  }
  const confirm = await window.Swal.fire({
    icon: "warning",
    title: "Restore Pokedex?",
    text: "This will overwrite the current Pokedex local data on this device.",
    showCancelButton: true,
    confirmButtonText: "Restore",
    cancelButtonText: "Cancel",
    background: "#121c34",
    color: "#eef4ff"
  });
  if (!confirm.isConfirmed) return;
  persistPokedexLocalState(JSON.stringify(pokedex));
  await window.Swal.fire({ icon: "success", title: "Pokedex restored", text: "Reloading with the restored data now.", timer: 1400, showConfirmButton: false, background: "#121c34", color: "#eef4ff" });
  location.reload();
}

function loadAccountSyncPrefs() {
  return {
    paused: !!safeJsonParse(localStorage.getItem(ACCOUNT_SYNC_PREFS_KEY))?.paused
  };
}

function saveAccountSyncPrefs() {
  localStorage.setItem(ACCOUNT_SYNC_PREFS_KEY, JSON.stringify(accountSyncPrefs));
}

function getCloudSyncSettings() {
  return null;
}

function normalizeSyncCode(value) {
  return String(value || "").trim();
}

function getModifiedAt(source) {
  return String(source?._meta?.lastModifiedAt || "");
}

async function fetchCloudBundle() {
  const response = await fetch(ACCOUNT_SESSION_API, { credentials: "same-origin" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 401 && response.status !== 503) {
    throw new Error(data.error || "Could not check account session.");
  }
  accountSessionState = {
    loggedIn: !!data.loggedIn,
    configured: !!data.configured,
    username: data.username || "owner"
  };
  refreshCloudSyncButton();
  return accountSessionState;
}

async function fetchAccountState() {
  const response = await fetch(POGO_DEX_STATE_API, { credentials: "same-origin" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Could not load account data.");
  return data;
}

async function pushCloudBundle() {
  const response = await fetch(POGO_DEX_STATE_API, {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pokedex: state })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Account save failed.");
  cloudSyncDirty = false;
  return data;
}

function scheduleCloudPush(delay = 3000) {
  if (!accountSessionState.loggedIn || accountSyncPrefs.paused) return;
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(() => {
    pushCloudBundle().catch(error => console.warn("Pokedex account sync upload failed:", error));
  }, delay);
}

function applyRemotePokedexState(nextState) {
  if (!nextState) return;
  Object.keys(state).forEach(key => { delete state[key]; });
  Object.assign(state, loadState(), nextState);
}

function applyRemoteBundle(remoteState) {
  const remotePokedex = remoteState?.pokedex || null;
  if (!remotePokedex) return false;
  persistPokedexLocalState(JSON.stringify(remotePokedex));
  applyRemotePokedexState(remotePokedex);
  return true;
}

function hasMeaningfulLocalPokedexState() {
  const statuses = state?.statuses || {};
  return Object.values(statuses).some(bucket =>
    bucket && Object.values(bucket).some(value => ["owned", "can-evolve", "trade", "missing-lock"].includes(value))
  );
}

async function bootstrapAccountFromLocalIfEmpty() {
  const remote = await fetchAccountState();
  const remoteIsEmpty = !remote || !remote.pokedex;
  if (!remoteIsEmpty || !hasMeaningfulLocalPokedexState()) return false;
  await pushCloudBundle();
  return true;
}

async function syncPokedexOnLoginOrLoad() {
  const seeded = await bootstrapAccountFromLocalIfEmpty().catch(() => false);
  if (!seeded) {
    await pullCloudBundleAndApply({ silent: true }).catch(() => false);
  }
}

async function pullCloudBundleAndApply(options = {}) {
  const remote = await fetchAccountState();
  const applied = applyRemoteBundle(remote);
  buildControls();
  render();
  if (!options.silent) {
    if (applied) {
      await window.Swal.fire({ icon: "success", title: "Account sync complete", text: "This device is now aligned with your live Pokedex data.", timer: 1600, showConfirmButton: false, background: "#121c34", color: "#eef4ff" });
    } else {
      await window.Swal.fire({ icon: "info", title: "No live Pokedex data yet", text: "There is no saved cloud Pokedex state for this account yet.", timer: 1800, showConfirmButton: false, background: "#121c34", color: "#eef4ff" });
    }
  }
  return applied;
}

async function openCloudSyncDialog() {
  await fetchCloudBundle().catch(() => null);
  if (!accountSessionState.configured) {
    await window.Swal.fire({
      icon: "info",
      title: "Login not configured yet",
      text: "The new sitewide account login needs the owner username and password configured before it can go live.",
      background: "#121c34",
      color: "#eef4ff"
    });
    return;
  }

  if (accountSessionState.loggedIn) {
    const result = await window.Swal.fire({
      title: "Site Account",
      html:         '<div style="display:grid; gap:10px; text-align:left;">' +
        '<div style="font-size:13px; color:#9fb2d9;">Signed in as <strong>' + escapeHtml(accountSessionState.username) + '</strong>.</div>' +
        '<div style="font-size:12px; color:#9fb2d9;">This session is sitewide. Use <strong>Refresh live</strong> to pull server changes on demand.</div>' +
        '<div style="font-size:12px; color:#9fb2d9;">Auto upload is currently <strong>' + (accountSyncPrefs.paused ? 'paused' : 'active') + '</strong>.</div>' +
        '</div>',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: "Refresh from server",
      denyButtonText: "Sign out",
      cancelButtonText: "Close",
      background: "#121c34",
      color: "#eef4ff"
    });
    if (result.isConfirmed) {
      await pullCloudBundleAndApply({ silent: false });
      return;
    }
    if (result.isDenied) {
      await fetch(ACCOUNT_LOGOUT_API, { method: "POST", credentials: "same-origin" });
      accountSessionState.loggedIn = false;
      stopAccountSyncPolling();
      refreshCloudSyncButton();
      await window.Swal.fire({ icon: "success", title: "Signed out", timer: 1200, showConfirmButton: false, background: "#121c34", color: "#eef4ff" });
    }
    return;
  }

  const result = await window.Swal.fire({
    title: "Site Account Login",
    html:       '<form id="siteAccountLoginForm" style="display:grid; gap:10px; text-align:left;" autocomplete="on">' +
      '<label style="display:grid; gap:4px;">' +
      '<span style="font-size:12px; color:#9fb2d9;">Username</span>' +
      '<input id="loginUsernameInput" class="swal2-input" name="username" autocomplete="username" value="' + escapeHtml(accountSessionState.username || "owner") + '" style="margin:0; width:100%;">' +
      '</label>' +
      '<label style="display:grid; gap:4px;">' +
      '<span style="font-size:12px; color:#9fb2d9;">Password</span>' +
      '<input id="loginPasswordInput" class="swal2-input" name="password" type="password" autocomplete="current-password" style="margin:0; width:100%;">' +
      '</label>' +
      '</form>',
    showCancelButton: true,
    confirmButtonText: "Sign in",
    cancelButtonText: "Cancel",
    background: "#121c34",
    color: "#eef4ff",
    preConfirm: () => {
      const username = String(document.getElementById("loginUsernameInput").value || "").trim();
      const password = String(document.getElementById("loginPasswordInput").value || "");
      if (!username) {
        window.Swal.showValidationMessage("A username is required.");
        return false;
      }
      if (!password) {
        window.Swal.showValidationMessage("A password is required.");
        return false;
      }
      return { username, password };
    }
  });
  if (!result.isConfirmed) return;
  try {
    const response = await fetch(ACCOUNT_LOGIN_API, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result.value)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Could not sign in.");
    }
    await fetchCloudBundle();
    await syncPokedexOnLoginOrLoad().catch(() => null);
    await window.Swal.fire({ icon: "success", title: "Signed in", text: "This device now has live sitewide access.", timer: 1600, showConfirmButton: false, background: "#121c34", color: "#eef4ff" });
  } catch (error) {
    await window.Swal.fire({ icon: "error", title: "Login failed", text: error.message || "The account login failed.", background: "#121c34", color: "#eef4ff" });
  }
}

async function initializeCloudSync() {
  try {
    await fetchCloudBundle();
    if (accountSessionState.loggedIn) {
      await syncPokedexOnLoginOrLoad().catch(() => null);
    }
  } catch (error) {
    console.warn("Initial pokedex account sync failed:", error);
  }
}

function refreshCloudSyncButton() {
  if (!els.cloudSyncBtn) return;
  if (!accountSessionState.configured) {
    els.cloudSyncBtn.textContent = "Account Setup";
  } else {
    els.cloudSyncBtn.textContent = accountSessionState.loggedIn ? "Account Live" : "Account Login";
  }
  if (els.accountRefreshBtn) {
    els.accountRefreshBtn.disabled = !accountSessionState.loggedIn;
    els.accountRefreshBtn.textContent = "Refresh live";
  }
  if (els.syncPauseBtn) {
    els.syncPauseBtn.disabled = !accountSessionState.loggedIn;
    els.syncPauseBtn.textContent = accountSyncPrefs.paused ? "Resume sync" : "Pause sync";
  }
}

function stopAccountSyncPolling() {
  if (accountSyncPollTimer) {
    clearInterval(accountSyncPollTimer);
    accountSyncPollTimer = null;
  }
}

async function handleManualRefreshClick() {
  if (!accountSessionState.loggedIn) {
    await openCloudSyncDialog();
    return;
  }
  await pullCloudBundleAndApply({ silent: false });
}

async function toggleSyncPause() {
  if (!accountSessionState.loggedIn) {
    await openCloudSyncDialog();
    return;
  }
  accountSyncPrefs.paused = !accountSyncPrefs.paused;
  saveAccountSyncPrefs();
  refreshCloudSyncButton();
  if (!accountSyncPrefs.paused) {
    scheduleCloudPush(100);
    await window.Swal.fire({ icon: "success", title: "Auto sync resumed", text: "Local changes will upload again from this device.", timer: 1400, showConfirmButton: false, background: "#121c34", color: "#eef4ff" });
    return;
  }
  clearTimeout(cloudSyncTimer);
  await window.Swal.fire({ icon: "info", title: "Auto sync paused", text: "Use this while doing bulk edits. Your changes stay local until you resume sync.", timer: 1700, showConfirmButton: false, background: "#121c34", color: "#eef4ff" });
}

function flushCloudPushOnPageHide() {
  if (!cloudSyncDirty || !accountSessionState.loggedIn || accountSyncPrefs.paused) return;
  const payload = JSON.stringify({ pokedex: state });
  try {
    fetch(POGO_DEX_STATE_API, {
      method: "PUT",
      credentials: "same-origin",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: payload
    }).catch(() => null);
  } catch {}
}

function getStickyFilterKey() {
  return JSON.stringify({
    mode: state.activeMode,
    statusFilter: state.statusFilter,
    regionFilter: state.regionFilter,
    search: state.search,
    showAltForms: state.showAltForms,
    showUnavailable: state.showUnavailable
  });
}

function registerStickyVisible(entryId) {
  const key = getStickyFilterKey();
  if (stickyFilterKey !== key) {
    stickyFilterKey = key;
    stickyVisibleEntryIds = new Set();
  }
  if (state.statusFilter !== "all" || state.regionFilter !== "all" || state.search.trim()) {
    stickyVisibleEntryIds.add(entryId);
  }
}

function clearStickyVisibility() {
  stickyVisibleEntryIds = new Set();
  stickyFilterKey = "";
}

function getSpriteSources(entry, mode) {
  const dex = Number(entry.dex);
  const classic = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dex}.png`;
  const classicShiny = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${dex}.png`;
  const official = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${dex}.png`;
  const legacyAltSlug = entry.isAltForm ? getSpecialSpriteSlug(entry, mode) : "";
  const familyKey = entry.isAltForm ? getFormFamilyKey(entry) : "";

  if (mode === "shiny") {
    if (legacyAltSlug) {
      const candidates = getAltSpriteCandidates(entry, legacyAltSlug, "shiny");
      return {
        primary: candidates[0],
        fallbacks: uniqueSpriteUrls([
          ...candidates.slice(1),
          ...getAltSpriteCandidates(entry, legacyAltSlug, "normal"),
          classicShiny,
          classic
        ])
      };
    }
    return {
      primary: classicShiny,
      fallbacks: [classic]
    };
  }

  if (entry.isAltForm && legacyAltSlug) {
    const candidates = getAltSpriteCandidates(entry, legacyAltSlug, "normal");
    return {
      primary: candidates[0],
      fallbacks: uniqueSpriteUrls([
        ...candidates.slice(1),
        classic,
        official
      ])
    };
  }

  if (mode === "mega" || mode === "gmax") {
    const slug = getSpecialSpriteSlug(entry, mode);
    if (slug) {
      return {
        primary: `https://img.pokemondb.net/sprites/home/normal/${slug}.png`,
        fallbacks: [classic, official]
      };
    }
  }

  return { primary: classic, fallbacks: [official] };
}

function getAltSpriteUrl(style, slug, variant) {
  const normalizedVariant = variant === "shiny" ? "shiny" : "normal";
  return `https://img.pokemondb.net/sprites/${style}/${normalizedVariant}/${slug}.png`;
}

function getAltSpriteCandidates(entry, slug, variant) {
  const familyKey = getFormFamilyKey(entry);
  const styles = getPreferredAltSpriteStyles(entry, slug, familyKey, variant);
  return uniqueSpriteUrls(styles.map(style => getAltSpriteUrl(style, slug, variant)));
}

function getPreferredAltSpriteStyles(entry, slug, familyKey, variant) {
  const key = `${entry.dex}:${slug}`;
  const specialStyles = {
    "646:kyurem-white": ["x-y", "omega-ruby-alpha-sapphire", "sun-moon", "scarlet-violet", "black-white", "home"],
    "646:kyurem-black": ["x-y", "omega-ruby-alpha-sapphire", "sun-moon", "scarlet-violet", "black-white", "home"],
    "800:necrozma-dawn-wings": ["bank", "sun-moon", "scarlet-violet", "home"],
    "800:necrozma-dusk-mane": ["bank", "sun-moon", "scarlet-violet", "home"]
  };
  if (specialStyles[key]) {
    return specialStyles[key];
  }
  if (familyKey === "alolan") {
    return ["sun-moon", "x-y", "omega-ruby-alpha-sapphire", "scarlet-violet", "black-white", "home"];
  }
  if (familyKey === "galarian" || familyKey === "hisuian" || familyKey === "paldean") {
    return ["scarlet-violet", "sun-moon", "bank", "omega-ruby-alpha-sapphire", "x-y", "black-white", "home"];
  }
  return ["sun-moon", "bank", "omega-ruby-alpha-sapphire", "x-y", "scarlet-violet", "black-white", "home"];
}

function uniqueSpriteUrls(urls) {
  return [...new Set(urls.filter(Boolean))];
}

function handleDexSpriteError(img) {
  const remaining = String(img.dataset.fallbacks || "")
    .split("|")
    .filter(Boolean);
  if (!remaining.length) {
    img.onerror = null;
    return;
  }
  const next = remaining.shift();
  img.dataset.fallbacks = remaining.join("|");
  img.src = next;
}

function getSpecialSpriteSlug(entry, mode) {
  if (entry.isAltForm) {
    return ALT_FORM_SPRITE_SLUGS[entry.id] || getHeuristicAltSpriteSlug(entry);
  }
  if (mode === "gmax") {
    return `${slugify(entry.baseName)}-gmax`;
  }
  return SPECIAL_SPRITE_SLUGS[entry.id] || "";
}

function getHeuristicAltSpriteSlug(entry) {
  const index = Number(entry.id.split("::")[2] || 0);
  const slugSets = {
    386: ["deoxys-attack", "deoxys-defense", "deoxys-speed"],
    483: ["dialga-origin"],
    484: ["palkia-origin"],
    487: ["giratina-origin"],
    492: ["shaymin-sky"],
    641: ["tornadus-therian"],
    642: ["thundurus-therian"],
    645: ["landorus-therian"],
    646: ["kyurem-white", "kyurem-black"],
    710: ["pumpkaboo-small", "pumpkaboo-large", "pumpkaboo-super"],
    711: ["gourgeist-small", "gourgeist-large", "gourgeist-super"],
    718: ["zygarde-10", "zygarde-complete"],
    745: ["lycanroc-midnight", "lycanroc-dusk"]
  };
  const candidates = slugSets[entry.dex];
  if (!candidates?.length) return "";
  return candidates[index - 1] || "";
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replaceAll("♀", "-f")
    .replaceAll("♂", "-m")
    .replaceAll(".", "")
    .replaceAll("'", "")
    .replaceAll("é", "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanDisplayName(entry) {
  return entry.rawName.replaceAll("#", " ");
}

function buildSubline(entry) {
  const bits = [];
  const types = [entry.type1, entry.type2].filter(Boolean).join(" / ");
  if (types) bits.push(types);
  if (entry.region) bits.push(entry.region);
  return bits.join(" • ") || "Pokemon GO";
}

function statusClassName(status) {
  if (status === "owned") return "status-owned";
  if (status === "can-evolve") return "status-can-evolve";
  if (status === "trade") return "status-trade";
  if (status === "unreleased") return "status-unreleased";
  return "status-missing";
}

function statusLabel(status) {
  if (status === "owned") return "Owned";
  if (status === "can-evolve") return "Can evolve";
  if (status === "trade") return "Trade";
  if (status === "unreleased") return "Unreleased";
  return "Missing";
}

function summaryPill(label) {
  return `<span class="mini-pill">${escapeHtml(label)}</span>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}
