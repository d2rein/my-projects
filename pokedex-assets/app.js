const STORAGE_KEY = "pogo-fresh-pokedex-v2";
const MEDAL_STORAGE_KEY = "pogo-medal-forecast-v2";
const MEDAL_SYNC_SETTINGS_KEY = "pogo-medal-cloud-sync-v1";
const CLOUD_SYNC_API = "/api/pogo-medals-sync";

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
  { id: "regional", label: "Regional" }
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
  "mega::334::Altaria#Mega": "altaria-mega",
  "mega::354::Banette#Mega": "banette-mega",
  "mega::359::Absol#Mega": "absol-mega",
  "mega::362::Glalie#Mega": "glalie-mega",
  "mega::373::Salamence#Mega": "salamence-mega",
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
  "alt::19::1::Rattata::Dark::Normal": "rattata-alolan",
  "alt::20::1::Raticate::Dark::Normal": "raticate-alolan",
  "alt::26::1::Raichu::Electric::Psychic": "raichu-alolan",
  "alt::27::1::Sandshrew::Ice::Steel": "sandshrew-alolan",
  "alt::28::1::Sandslash::Ice::Steel": "sandslash-alolan",
  "alt::37::1::Vulpix::Ice::-": "vulpix-alolan",
  "alt::38::1::Ninetales::Ice::Fairy": "ninetales-alolan",
  "alt::50::1::Diglett::Ground::Steel": "diglett-alolan",
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
  "alt::78::1::Rapidash::Psychic::Fairy": "rapidash-galarian",
  "alt::79::1::Slowpoke::Psychic::-": "slowpoke-galarian",
  "alt::80::1::Slowbro::Poison::Psychic": "slowbro-galarian",
  "alt::83::1::Farfetch'd::Fighting::-": "farfetchd-galarian",
  "alt::88::1::Grimer::Poison::Dark": "grimer-alolan",
  "alt::89::1::Muk::Poison::Dark": "muk-alolan",
  "alt::100::1::Voltorb::Electric::Grass": "voltorb-hisuian",
  "alt::101::1::Electrode::Electric::Grass": "electrode-hisuian",
  "alt::103::1::Exeggutor::Grass::Dragon": "exeggutor-alolan",
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
  "alt::503::1::Samurott::Water::Dark": "samurott-hisuian",
  "alt::554::1::Darumaka::Ice::-": "darumaka-galarian",
  "alt::555::1::Darmanitan::Ice::-": "darmanitan-galarian",
  "alt::562::1::Yamask::Ground::Ghost": "yamask-galarian",
  "alt::618::1::Stunfisk::Ground::Steel": "stunfisk-galarian",
  "alt::628::1::Braviary::Psychic::Flying": "braviary-hisuian",
  "alt::713::1::Avalugg::Ice::Rock": "avalugg-hisuian",
  "alt::720::1::Hoopa::Psychic::Dark": "hoopa-unbound",
  "alt::724::1::Decidueye::Grass::Fighting": "decidueye-hisuian",
  "alt::800::1::Necrozma::Psychic::Steel": "necrozma-dusk-mane",
  "alt::800::2::Necrozma::Psychic::Ghost": "necrozma-dawn-wings",
  "alt::916::1::Oinkologne::Normal::-": "oinkologne-female"
};

const EVOLUTION_PREDECESSOR = {
  2: 1, 3: 2, 5: 4, 6: 5, 8: 7, 9: 8, 11: 10, 12: 11, 14: 13, 15: 14, 17: 16, 18: 17, 20: 19,
  22: 21, 24: 23, 26: 25, 28: 27, 30: 29, 31: 30, 33: 32, 34: 33, 36: 35, 38: 37, 40: 39, 42: 41,
  44: 43, 45: 44, 47: 46, 49: 48, 51: 50, 53: 52, 55: 54, 57: 56, 59: 58, 61: 60, 62: 61, 64: 63,
  65: 64, 67: 66, 68: 67, 70: 69, 71: 70, 73: 72, 75: 74, 76: 75, 78: 77, 80: 79, 82: 81, 85: 84,
  87: 86, 89: 88, 91: 90, 93: 92, 94: 93, 97: 96, 99: 98, 101: 100, 103: 102, 105: 104, 110: 109,
  112: 111, 117: 116, 119: 118, 121: 120, 130: 129, 134: 133, 135: 133, 136: 133, 139: 138, 141: 140,
  148: 147, 149: 148, 153: 152, 154: 153, 156: 155, 157: 156, 159: 158, 160: 159, 162: 161, 164: 163,
  166: 165, 168: 167, 171: 170, 176: 175, 178: 177, 180: 179, 181: 180, 184: 183, 188: 187, 189: 188,
  192: 191, 195: 194, 196: 133, 197: 133, 205: 204, 210: 209, 212: 123, 217: 216, 219: 218, 221: 220,
  229: 228, 230: 117, 232: 231, 242: 113, 247: 246, 248: 247, 253: 252, 254: 253, 256: 255, 257: 256,
  259: 258, 260: 259, 262: 261, 264: 263, 266: 265, 267: 266, 268: 265, 269: 268, 271: 270, 272: 271,
  274: 273, 275: 274, 281: 280, 282: 281, 284: 283, 286: 285, 288: 287, 289: 288, 291: 290, 294: 293,
  295: 294, 301: 300, 305: 304, 306: 305, 308: 307, 310: 309, 317: 316, 319: 318, 321: 320, 323: 322,
  326: 325, 329: 328, 330: 329, 332: 331, 334: 333, 340: 339, 342: 341, 344: 343, 346: 345, 348: 347,
  350: 349, 354: 353, 356: 355, 362: 361, 364: 363, 365: 364, 367: 366, 368: 366, 372: 371, 373: 372,
  375: 374, 376: 375, 388: 387, 389: 388, 391: 390, 392: 391, 394: 393, 395: 394, 397: 396, 398: 397,
  400: 399, 402: 401, 404: 403, 405: 404, 407: 315, 409: 408, 411: 410, 413: 412, 414: 412, 416: 415,
  419: 418, 421: 420, 423: 422, 424: 190, 426: 425, 428: 427, 435: 434, 437: 436, 445: 444, 448: 447,
  450: 449, 452: 451, 454: 453, 457: 456, 460: 459, 461: 215, 464: 112, 465: 114, 466: 125, 467: 126,
  468: 176, 469: 193, 470: 133, 471: 133, 473: 221, 475: 281, 477: 356, 478: 361, 497: 496, 500: 499,
  502: 501, 503: 502, 505: 504, 507: 506, 508: 507, 510: 509, 512: 511, 514: 513, 516: 515, 520: 519,
  521: 520, 523: 522, 525: 524, 526: 525, 528: 527, 530: 529, 533: 532, 534: 533, 536: 535, 537: 536,
  541: 540, 542: 541, 544: 543, 545: 544, 547: 546, 549: 548, 552: 551, 553: 552, 555: 554, 558: 557,
  560: 559, 563: 562, 565: 564, 567: 566, 569: 568, 571: 570, 573: 572, 575: 574, 576: 575, 578: 577,
  579: 578, 581: 580, 583: 582, 584: 583, 586: 585, 589: 588, 591: 590, 593: 592, 596: 595, 598: 597,
  600: 599, 601: 600, 603: 602, 604: 603, 606: 605, 608: 607, 609: 608, 611: 610, 612: 611, 614: 613,
  617: 616, 620: 619, 623: 622, 625: 624, 628: 627, 634: 633, 635: 634, 637: 636, 651: 650, 652: 651,
  654: 653, 655: 654, 657: 656, 658: 657, 660: 659, 665: 664, 666: 665, 670: 669, 671: 670, 673: 672,
  675: 674, 680: 679, 681: 680, 683: 682, 685: 684, 687: 686, 689: 688, 691: 690, 693: 692, 695: 694,
  697: 696, 699: 698, 705: 704, 706: 705, 709: 708, 711: 710, 713: 712, 715: 714, 723: 722, 724: 723,
  726: 725, 727: 726, 729: 728, 730: 729, 732: 731, 733: 732, 735: 734, 738: 737, 740: 739, 743: 742,
  745: 744, 748: 747, 750: 749, 752: 751, 754: 753, 756: 755, 758: 757, 760: 759, 762: 761, 763: 762,
  768: 767, 770: 769, 783: 782, 784: 783, 790: 789, 791: 790, 792: 790, 804: 803, 811: 810, 812: 811,
  814: 813, 815: 814, 817: 816, 818: 817, 820: 819, 822: 821, 823: 822, 825: 824, 826: 825, 828: 827,
  830: 829, 832: 831, 834: 833, 836: 835, 838: 837, 839: 838, 841: 840, 842: 840, 849: 848, 851: 850,
  855: 854, 857: 856, 858: 857, 860: 859, 861: 860, 867: 562, 873: 872, 879: 878, 886: 885, 887: 886,
  901: 217, 903: 215, 907: 906, 908: 907, 910: 909, 911: 910, 913: 912, 914: 913, 916: 915, 918: 917,
  920: 919, 922: 921, 923: 922, 925: 924, 927: 926, 929: 928, 930: 929, 933: 932, 934: 933, 936: 935,
  939: 938, 945: 944, 949: 948, 956: 955, 958: 957, 959: 958, 961: 960, 966: 965, 970: 969, 972: 971,
  975: 974, 980: 194, 983: 624, 997: 996, 998: 997, 1012: 1011, 1013: 1012, 1019: 1011
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
  summaryTitle: document.querySelector("#summaryTitle"),
  summaryPills: document.querySelector("#summaryPills"),
  summaryTableBody: document.querySelector("#summaryTableBody"),
  summaryTableFoot: document.querySelector("#summaryTableFoot"),
  availabilityTitle: document.querySelector("#availabilityTitle"),
  availabilityLegend: document.querySelector("#availabilityLegend"),
  cardGrid: document.querySelector("#cardGrid"),
  gridTitle: document.querySelector("#gridTitle"),
  gridCountNote: document.querySelector("#gridCountNote"),
  cloudSyncBtn: document.querySelector("#cloudSyncBtn")
};

const state = loadState();

let rawRows = [];
let canonicalEntries = [];
let altEntries = [];
let megaEntries = [];
let gmaxEntries = [];
let entriesByMode = new Map();
let stickyVisibleEntryIds = new Set();
let stickyFilterKey = "";
let cloudSyncTimer = null;

initialize();

function initialize() {
  const csv = typeof window.POKEDEX_SEED_CSV === "string"
    ? window.POKEDEX_SEED_CSV
    : (window.POKEDEX_SEED_CSV?.value || "");
  rawRows = parseCsv(csv).map(buildRawEntry).filter(Boolean);
  buildCollections();
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
  const speciesGroups = new Map();
  const regularRows = rawRows.filter(row => !row.isMega && !row.excludeFromDex);
  megaEntries = rawRows.filter(row => row.isMega && !row.excludeFromDex).map(row => toMegaEntry(row));

  for (const row of regularRows) {
    const key = String(row.dex);
    if (!speciesGroups.has(key)) speciesGroups.set(key, []);
    speciesGroups.get(key).push(row);
  }

  canonicalEntries = [];
  altEntries = [];

  for (const [dexKey, rows] of speciesGroups.entries()) {
    const canonicalRow = chooseCanonicalRow(rows);
    const canonicalEntry = toCanonicalEntry(canonicalRow, rows);
    canonicalEntries.push(canonicalEntry);

    const canonicalSignature = signatureForCanonical(canonicalRow);
    rows.forEach((row, idx) => {
      const rowSignature = signatureForCanonical(row);
      if (idx === 0 && rowSignature === canonicalSignature) return;
      if (rowSignature === canonicalSignature && row.rawName === canonicalRow.rawName && row.type1 === canonicalRow.type1 && row.type2 === canonicalRow.type2) return;
      altEntries.push(toAltEntry(row, canonicalEntry, idx));
    });
  }

  canonicalEntries.sort((a, b) => a.dex - b.dex);
  altEntries.sort((a, b) => a.dex - b.dex || cleanDisplayName(a).localeCompare(cleanDisplayName(b)));
  megaEntries.sort((a, b) => a.dex - b.dex || cleanDisplayName(a).localeCompare(cleanDisplayName(b)));

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

function chooseCanonicalRow(rows) {
  const preferred = rows.find(row => ["owned", "can-evolve"].includes(row.seedStatus) && !row.formName);
  if (preferred) return preferred;
  const plain = rows.find(row => !row.formName);
  if (plain) return plain;
  return rows[0];
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
    unreleasedOverrides: {}
  };

  Object.assign(state, fallback, state);

  for (const mode of DEX_MODES) {
    state.statuses[mode.id] ||= {};
    state.availability[mode.id] ||= {};
  }

  canonicalEntries.forEach(entry => {
    state.statuses.pokemon[entry.id] ??= entry.importedBaseStatus || "missing";
    for (const mode of STANDARD_COLLECTION_MODES.filter(mode => mode !== "pokemon")) {
      state.statuses[mode][entry.id] ??= "missing";
    }
  });

  altEntries.forEach(entry => {
    state.statuses.pokemon[entry.id] ??= entry.importedBaseStatus || "missing";
    for (const mode of STANDARD_COLLECTION_MODES.filter(mode => mode !== "pokemon")) {
      state.statuses[mode][entry.id] ??= "missing";
    }
  });

  megaEntries.forEach(entry => {
    state.statuses.mega[entry.id] ??= entry.importedBaseStatus || "missing";
    state.availability.mega[entry.id] ??= entry.importedBaseStatus === "owned";
  });

  gmaxEntries.forEach(entry => {
    state.statuses.gmax[entry.id] ??= "missing";
    state.availability.gmax[entry.id] ??= false;
  });

  saveState();
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
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
      statuses: {},
      availability: {},
      unreleasedOverrides: {}
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
      statuses: {},
      availability: {},
      unreleasedOverrides: {}
    };
  }
}

function saveState() {
  state._meta = { ...(state._meta || {}), lastModifiedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  scheduleCloudPush();
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
}

function bindEvents() {
  els.dexModeBar.addEventListener("click", event => {
    const button = event.target.closest("[data-mode]");
    if (!button) return;
    state.activeMode = button.dataset.mode;
    clearStickyVisibility();
    saveState();
    buildControls();
    render();
  });

  els.statusFilterBar.addEventListener("click", event => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    state.statusFilter = button.dataset.filter;
    clearStickyVisibility();
    saveState();
    buildControls();
    render();
  });

  els.regionFilterBar.addEventListener("click", event => {
    const button = event.target.closest("[data-region-filter]");
    if (!button) return;
    state.regionFilter = button.dataset.regionFilter;
    clearStickyVisibility();
    saveState();
    buildControls();
    render();
  });

  els.searchInput.addEventListener("input", () => {
    state.search = els.searchInput.value;
    clearStickyVisibility();
    saveState();
    render();
  });

  els.autoEvolveToggle.addEventListener("change", () => {
    state.autoEvolve = els.autoEvolveToggle.checked;
    clearStickyVisibility();
    saveState();
    render();
  });

  els.showAltFormsToggle.addEventListener("change", () => {
    state.showAltForms = els.showAltFormsToggle.checked;
    clearStickyVisibility();
    saveState();
    render();
  });

  els.editUnreleasedToggle.addEventListener("change", () => {
    state.editUnreleased = els.editUnreleasedToggle.checked;
    clearStickyVisibility();
    saveState();
    render();
  });

  els.showUnavailableToggle.addEventListener("change", () => {
    state.showUnavailable = els.showUnavailableToggle.checked;
    clearStickyVisibility();
    saveState();
    render();
  });

  els.cardGrid.addEventListener("click", event => {
    const statusTarget = event.target.closest("[data-cycle-status]");
    if (statusTarget) {
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

  els.cloudSyncBtn?.addEventListener("click", openCloudSyncDialog);
}

function render() {
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
  els.gridTitle.textContent = `${mode.label} Cards`;
  els.availabilityTitle.textContent = `${mode.label} availability`;
  els.summaryPills.innerHTML = [
    summaryPill(`Total ${totals.total}`),
    summaryPill(`Owned ${totals.owned}`),
    summaryPill(`Evolutions ${totals.evolutions}`),
    summaryPill(`Missing ${totals.missing}`),
    summaryPill(`Unreleased ${totals.unreleased}`)
  ].join("");

  els.summaryTableBody.innerHTML = "";
  REGIONS.forEach(region => {
    const regionEntries = entries.filter(entry => entry.region === region);
    const counts = computeCounts(regionEntries);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${region}</td>
      <td>${counts.total}</td>
      <td>${counts.owned}</td>
      <td>${counts.evolutions}</td>
      <td>${counts.missing}</td>
      <td>${counts.unreleased}</td>
    `;
    els.summaryTableBody.append(tr);
  });

  els.summaryTableFoot.innerHTML = `
    <tr>
      <td>Total</td>
      <td>${totals.total}</td>
      <td>${totals.owned}</td>
      <td>${totals.evolutions}</td>
      <td>${totals.missing}</td>
      <td>${totals.unreleased}</td>
    </tr>
  `;
}

function renderAvailabilityLegend() {
  if (!["mega", "gmax"].includes(state.activeMode)) {
    els.availabilityLegend.innerHTML = "";
    return;
  }

  const entries = getEntriesForMode(state.activeMode);
  const available = entries.filter(entry => isAvailable(entry)).length;
  const unavailable = entries.length - available;
  els.availabilityLegend.innerHTML = `
    <span class="availability-pill">Available ${available}</span>
    <span class="availability-pill">Unavailable ${unavailable}</span>
  `;
}

function renderGrid() {
  const entries = getVisibleEntries();
  els.gridCountNote.textContent = `${entries.length.toLocaleString()} cards shown`;

  if (!entries.length) {
    els.cardGrid.innerHTML = `<div class="empty-state">No entries match the current tab, search, and filters.</div>`;
    return;
  }

  els.cardGrid.innerHTML = entries.map(renderCard).join("");
}

function renderCard(entry) {
  const status = getEffectiveStatus(entry, state.activeMode);
  const { primary, fallback } = getSpriteSources(entry, state.activeMode);
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
        <img src="${escapeAttribute(primary)}" alt="${escapeAttribute(cleanDisplayName(entry))}" loading="lazy" onerror="if(this.src!==this.dataset.fallback)this.src=this.dataset.fallback" data-fallback="${escapeAttribute(fallback)}">
        ${entry.spriteHint ? `<span class="sprite-badge">${escapeHtml(entry.spriteHint)}</span>` : ""}
      </div>
      <div class="card-body">
        <div class="pokemon-name">${escapeHtml(cleanDisplayName(entry))}</div>
        <div class="subline">${escapeHtml(buildSubline(entry))}</div>
        <button class="status-btn ${statusClassName(status)}" data-cycle-status data-entry-id="${escapeAttribute(entry.id)}">${statusLabel(status)}</button>
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
    return filterByAvailability(megaEntries);
  }

  if (state.activeMode === "gmax") {
    return filterByAvailability(gmaxEntries);
  }

  return canonicalEntries.slice();
}

function filterByAvailability(entries) {
  return state.showUnavailable ? entries.slice() : entries.filter(entry => isAvailable(entry));
}

function getEntriesForMode(mode) {
  return entriesByMode.get(mode) || [];
}

function getVisibleEntries() {
  const search = state.search.trim().toLowerCase();
  let entries = STANDARD_COLLECTION_MODES.includes(state.activeMode)
    ? getStandardEntriesInDisplayOrder()
    : getEntriesForMode(state.activeMode).slice();
  const activeStickyKey = getStickyFilterKey();
  const keepEditedVisible = stickyFilterKey === activeStickyKey ? stickyVisibleEntryIds : new Set();

  if (["mega", "gmax"].includes(state.activeMode) && !state.showUnavailable) {
    entries = entries.filter(entry => isAvailable(entry));
  }

  return entries.filter(entry => {
    if (keepEditedVisible.has(entry.id)) return true;
    const status = getEffectiveStatus(entry, state.activeMode);
    if (state.regionFilter !== "all" && entry.region !== state.regionFilter) return false;
    if (state.statusFilter === "unreleased" && !isCurrentlyUnreleased(entry)) return false;
    else if (state.statusFilter === "regional" && !entry.isRegional) return false;
    else if (state.statusFilter === "unowned" && !["missing", "can-evolve"].includes(status)) return false;
    else if (!["all", "unreleased", "regional", "unowned"].includes(state.statusFilter) && status !== state.statusFilter) return false;
    if (!search) return true;
    return cleanDisplayName(entry).toLowerCase().includes(search) || String(entry.dex).includes(search);
  });
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
  const counts = { total: 0, owned: 0, evolutions: 0, missing: 0, unreleased: 0 };
  for (const entry of entries) {
    counts.total += 1;
    if (isCurrentlyUnreleased(entry)) {
      counts.unreleased += 1;
      continue;
    }
    const status = getEffectiveStatus(entry, state.activeMode);
    if (status === "owned") counts.owned += 1;
    else if (status === "can-evolve") counts.evolutions += 1;
    else counts.missing += 1;
  }
  return counts;
}

function getEffectiveStatus(entry, mode) {
  const stored = state.statuses[mode]?.[entry.id];
  if (stored === "owned" || stored === "can-evolve") return stored;
  if (stored === "missing-lock") return "missing";
  if (isCurrentlyUnreleased(entry)) return "unreleased";

  if (STANDARD_COLLECTION_MODES.includes(mode) && mode !== "pokemon") {
    return stored || "missing";
  }

  return stored || entry.importedBaseStatus || "missing";
}

function cycleStatus(entryId) {
  const bucket = state.statuses[state.activeMode];
  const entry = getEntryById(entryId);
  if (!entry) return;
  const current = getEffectiveStatus(entry, state.activeMode);
  const order = ["missing", "owned", "can-evolve"];
  const next = order[(order.indexOf(current) + 1 + order.length) % order.length];
  bucket[entryId] = next === "missing" ? "missing-lock" : next;
  registerStickyVisible(entryId);
  if (next === "owned" && state.autoEvolve) {
    propagateOwnedForward(entryId, state.activeMode);
  }
  saveState();
  render();
}

function propagateOwnedForward(entryId, mode) {
  const entry = getEntryById(entryId);
  if (!entry || entry.isAltForm || ["mega", "gmax"].includes(mode)) return;
  const descendants = getDescendants(entry.dex);
  descendants.forEach(descDex => {
    const desc = canonicalEntries.find(candidate => candidate.dex === descDex);
    if (!desc) return;
    const current = state.statuses[mode][desc.id] || desc.importedBaseStatus || "missing";
    if (current === "missing") {
      state.statuses[mode][desc.id] = "can-evolve";
      registerStickyVisible(desc.id);
    }
  });
}

function getDescendants(startDex) {
  const out = [];
  const queue = [startDex];
  const seen = new Set(queue);

  while (queue.length) {
    const current = queue.shift();
    const nextEntries = canonicalEntries.filter(candidate => EVOLUTION_PREDECESSOR[candidate.dex] === current);
    nextEntries.forEach(candidate => {
      if (seen.has(candidate.dex)) return;
      seen.add(candidate.dex);
      out.push(candidate.dex);
      queue.push(candidate.dex);
    });
  }

  return out;
}

function getEntryById(entryId) {
  const all = [...canonicalEntries, ...altEntries, ...megaEntries, ...gmaxEntries];
  return all.find(entry => entry.id === entryId) || null;
}

function toggleUnreleased(entryId) {
  const entry = getEntryById(entryId);
  if (!entry) return;
  const current = isCurrentlyUnreleased(entry);
  if (!state.unreleasedOverrides) {
    state.unreleasedOverrides = {};
  }
  state.unreleasedOverrides[entryId] = !current;
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
  return !!state.availability[state.activeMode]?.[entry.id];
}

function safeJsonParse(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getCloudSyncSettings() {
  return safeJsonParse(localStorage.getItem(MEDAL_SYNC_SETTINGS_KEY));
}

function normalizeSyncCode(value) {
  return String(value || "").trim().replace(/\s+/g, "-");
}

function getCurrentMedalState() {
  return safeJsonParse(localStorage.getItem(MEDAL_STORAGE_KEY));
}

function getModifiedAt(source) {
  return String(source?._meta?.lastModifiedAt || "");
}

function mergePokedexStates(localState, remoteState) {
  if (!localState && !remoteState) return null;
  if (!localState) return remoteState;
  if (!remoteState) return localState;
  return getModifiedAt(remoteState) > getModifiedAt(localState) ? remoteState : localState;
}

function mergeMedalStates(localState, remoteState) {
  if (!localState && !remoteState) return null;
  if (!localState) return remoteState;
  if (!remoteState) return localState;
  return getModifiedAt(remoteState) > getModifiedAt(localState) ? remoteState : localState;
}

async function fetchCloudBundle(settings = getCloudSyncSettings()) {
  if (!settings?.code || !settings?.pin) throw new Error("Cloud sync is not configured.");
  const response = await fetch(`${CLOUD_SYNC_API}?code=${encodeURIComponent(settings.code)}`, {
    headers: { "x-sync-pin": settings.pin }
  });
  if (response.status === 404) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Cloud download failed.");
  return data;
}

async function pushCloudBundle(settings = getCloudSyncSettings()) {
  if (!settings?.code || !settings?.pin) throw new Error("Cloud sync is not configured.");
  const response = await fetch(`${CLOUD_SYNC_API}?code=${encodeURIComponent(settings.code)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pin: settings.pin,
      payload: {
        medals: getCurrentMedalState(),
        pokedex: state
      }
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Cloud upload failed.");
  return data;
}

function scheduleCloudPush(delay = 1200) {
  const settings = getCloudSyncSettings();
  if (!settings?.autoSync || !settings?.code || !settings?.pin) return;
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(() => {
    pushCloudBundle(settings).catch(error => console.warn("Pokedex cloud sync upload failed:", error));
  }, delay);
}

function applyRemotePokedexState(nextState) {
  if (!nextState) return;
  Object.keys(state).forEach(key => { delete state[key]; });
  Object.assign(state, loadState(), nextState);
}

async function pullCloudBundleAndApply(options = {}) {
  const remote = await fetchCloudBundle();
  if (!remote?.payload) return false;
  const remotePokedex = remote.payload.pokedex || null;
  const remoteMedals = remote.payload.medals || null;
  const localPokedex = safeJsonParse(localStorage.getItem(STORAGE_KEY)) || state;
  const localMedals = getCurrentMedalState();
  const mergedPokedex = mergePokedexStates(localPokedex, remotePokedex);
  const mergedMedals = mergeMedalStates(localMedals, remoteMedals);
  if (mergedPokedex) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedPokedex));
    applyRemotePokedexState(mergedPokedex);
  }
  if (mergedMedals) {
    localStorage.setItem(MEDAL_STORAGE_KEY, JSON.stringify(mergedMedals));
  }
  buildControls();
  render();
  if (!options.silent) {
    await window.Swal.fire({ icon: "success", title: "Cloud sync complete", text: "The Pokédex and medal data on this device have been refreshed from cloud storage.", timer: 1600, showConfirmButton: false, background: "#121c34", color: "#eef4ff" });
  }
  return true;
}

async function openCloudSyncDialog() {
  const existing = getCloudSyncSettings() || { code: "", pin: "", autoSync: true };
  const result = await window.Swal.fire({
    title: "Pokemon GO Cloud Sync",
    html: `
      <div style="display:grid; gap:10px; text-align:left;">
        <label style="display:grid; gap:4px;">
          <span style="font-size:12px; color:#9fb2d9;">Sync code</span>
          <input id="syncCodeInput" class="swal2-input" value="${escapeHtml(existing.code || "")}" placeholder="e.g. pogo-main" style="margin:0; width:100%;">
        </label>
        <label style="display:grid; gap:4px;">
          <span style="font-size:12px; color:#9fb2d9;">4-digit PIN</span>
          <input id="syncPinInput" class="swal2-input" inputmode="numeric" maxlength="4" value="${escapeHtml(existing.pin || "")}" placeholder="1234" style="margin:0; width:100%;">
        </label>
        <label style="display:grid; gap:4px;">
          <span style="font-size:12px; color:#9fb2d9;">Action</span>
          <select id="syncActionSelect" class="swal2-input" style="margin:0; width:100%;">
            <option value="upload">Upload this device to cloud</option>
            <option value="download">Load cloud data onto this device</option>
          </select>
        </label>
        <label style="display:flex; gap:8px; align-items:center;">
          <input id="syncAutoToggle" type="checkbox" ${existing.autoSync !== false ? "checked" : ""}>
          <span style="font-size:12px; color:#9fb2d9;">Auto-sync medal and Pokédex saves on this device</span>
        </label>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Run",
    cancelButtonText: "Cancel",
    background: "#121c34",
    color: "#eef4ff",
    preConfirm: () => {
      const code = normalizeSyncCode(document.getElementById("syncCodeInput").value);
      const pin = String(document.getElementById("syncPinInput").value || "").trim();
      const action = document.getElementById("syncActionSelect").value;
      const autoSync = document.getElementById("syncAutoToggle").checked;
      if (!code) {
        window.Swal.showValidationMessage("A sync code is required.");
        return false;
      }
      if (!/^\d{4}$/.test(pin)) {
        window.Swal.showValidationMessage("Use a 4-digit PIN.");
        return false;
      }
      return { code, pin, action, autoSync };
    }
  });
  if (!result.isConfirmed) return;
  const settings = result.value;
  localStorage.setItem(MEDAL_SYNC_SETTINGS_KEY, JSON.stringify({
    code: settings.code,
    pin: settings.pin,
    autoSync: settings.autoSync
  }));
  try {
    if (settings.action === "upload") {
      await pushCloudBundle(settings);
      await window.Swal.fire({ icon: "success", title: "Uploaded to cloud", text: "This device's Pokédex and medal data are now stored online.", timer: 1500, showConfirmButton: false, background: "#121c34", color: "#eef4ff" });
    } else {
      await pullCloudBundleAndApply({ silent: false });
    }
  } catch (error) {
    await window.Swal.fire({ icon: "error", title: "Cloud sync failed", text: error.message || "The cloud sync request failed.", background: "#121c34", color: "#eef4ff" });
  }
}

async function initializeCloudSync() {
  const settings = getCloudSyncSettings();
  if (!settings?.code || !settings?.pin) return;
  try {
    await pullCloudBundleAndApply({ silent: true });
  } catch (error) {
    console.warn("Initial pokedex cloud sync failed:", error);
  }
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

  if (mode === "shiny") {
    if (legacyAltSlug) {
      return {
        primary: `https://img.pokemondb.net/sprites/black-white/shiny/${legacyAltSlug}.png`,
        fallback: `https://img.pokemondb.net/sprites/black-white/normal/${legacyAltSlug}.png`
      };
    }
    return {
      primary: classicShiny,
      fallback: classic
    };
  }

  if (entry.isAltForm && legacyAltSlug) {
    return {
      primary: `https://img.pokemondb.net/sprites/black-white/normal/${legacyAltSlug}.png`,
      fallback: classic
    };
  }

  if (mode === "mega" || mode === "gmax") {
    const slug = getSpecialSpriteSlug(entry, mode);
    if (slug) {
      return {
        primary: `https://img.pokemondb.net/sprites/home/normal/${slug}.png`,
        fallback: classic
      };
    }
  }

  return { primary: classic, fallback: official };
}

function getSpecialSpriteSlug(entry, mode) {
  if (entry.isAltForm) {
    return ALT_FORM_SPRITE_SLUGS[entry.id] || "";
  }
  if (mode === "gmax") {
    return `${slugify(entry.baseName)}-gmax`;
  }
  return SPECIAL_SPRITE_SLUGS[entry.id] || "";
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
  if (status === "unreleased") return "status-unreleased";
  return "status-missing";
}

function statusLabel(status) {
  if (status === "owned") return "Owned";
  if (status === "can-evolve") return "Can evolve";
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
