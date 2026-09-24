const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("../iss-tracker/node_modules/playwright");

const root = path.resolve(__dirname, "..");
const reference = fs.readFileSync(path.join(root, "pokedex-assets/pokemon-species-reference.csv"), "utf8")
  .trim().split(/\r?\n/).slice(1).map(row => row.split(","));

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route(/^https?:/, route => route.abort());
    await page.goto(`file:///${path.join(root, "pokedex.html").replace(/\\/g, "/")}`);
    assert.deepEqual(errors, []);
    const result = await page.evaluate(() => {
      const targets = id => getEvolutionTargets(canonicalEntries.find(entry => entry.dex === id)).map(entry => entry.dex);
      const alt = (dex, family) => (speciesEntriesByDex.get(dex) || []).find(entry => entry.isAltForm && getFormFamilyKey(entry) === family);
      const altTargets = (dex, family) => getEvolutionTargets(alt(dex, family)).map(entry => entry.dex);
      const check = [25, 26, 90, 91, 10, 11, 12, 52, 53, 863, 840, 1011, 1012, 1013, 1019]
        .map(dex => [dex, Boolean(canonicalEntries.find(entry => entry.dex === dex))]);
      state.activeMode = "shiny";
      const missing = dex => setEntryStatus("shiny", canonicalEntries.find(entry => entry.dex === dex).id, "missing");
      const owned = dex => setEntryStatus("shiny", canonicalEntries.find(entry => entry.dex === dex).id, "owned");
      [10, 11, 12, 90, 91].forEach(missing);
      owned(12);
      const examples = computeCounts([10, 11, 12, 90, 91].map(dex => canonicalEntries.find(entry => entry.dex === dex)));
      missing(12);
      const allMissing = computeCounts([10, 11, 12].map(dex => canonicalEntries.find(entry => entry.dex === dex)));
      const altRaichu = alt(26, "alolan");
      if (altRaichu) setEntryStatus("shiny", altRaichu.id, "owned");
      missing(26);
      const galarZapdos = alt(145, "galarian");
      if (galarZapdos) setEntryStatus("shiny", galarZapdos.id, "owned");
      missing(145);
      const disconnected = Object.entries(ALL_EVOLUTION_PREDECESSOR).filter(([child, parent]) => {
        const sources = speciesEntriesByDex.get(parent) || [];
        return !sources.some(source => getDirectEvolutionTargets(source).some(target => target.dex === Number(child)));
      }).map(([child, parent]) => `${parent}->${child}`);
      const perrserker = canonicalEntries.find(entry => entry.dex === 863);
      state.statuses.shiny[perrserker.id] = "can-evolve";
      state.statusMeta.shiny[perrserker.id] = { autoDerivedCanEvolve: true };
      owned(52);
      reconcileAutoEvolveStatuses();
      return {
        links: Object.entries(ALL_EVOLUTION_PREDECESSOR),
        targets: { caterpie: targets(10), meowth: targets(52), mrMime: targets(122),
          dipplin: targets(1011), poltchageist: targets(1012),
          galarMeowth: altTargets(52, "galarian"), galarMrMime: altTargets(122, "galarian") },
        examples, allMissing, altRaichu: Boolean(altRaichu), raichu: getSpeciesSummaryStatus(26, "shiny"),
        galarZapdos: Boolean(galarZapdos), zapdos: getSpeciesSummaryStatus(145, "shiny"), check, disconnected,
        stalePerrserker: getEffectiveStatus(perrserker, "shiny"),
        columns: document.querySelectorAll(".summary-table thead th").length
      };
    });
    const expected = Object.fromEntries(reference.filter(row => +row[0] <= 1025 && row[3]).map(row => [row[0], +row[3]]));
    assert.deepEqual(Object.fromEntries(result.links), expected);
    assert.deepEqual(result.disconnected, []);
    assert(result.check.every(([, exists]) => exists));
    assert(result.targets.caterpie.includes(12));
    assert(result.targets.meowth.includes(53));
    assert(!result.targets.meowth.includes(863));
    assert(result.targets.galarMeowth.includes(863));
    assert(!result.targets.galarMeowth.includes(53));
    assert(!result.targets.mrMime.includes(866));
    assert(result.targets.galarMrMime.includes(866));
    assert(result.targets.dipplin.includes(1019));
    assert(!result.targets.dipplin.includes(1012));
    assert(result.targets.poltchageist.includes(1013));
    assert.equal(result.examples.uniqueMissing, 2);
    assert.equal(result.allMissing.uniqueMissing, 1);
    assert(result.altRaichu);
    assert.equal(result.raichu, "owned");
    assert(result.galarZapdos);
    assert.equal(result.zapdos, "owned");
    assert.equal(result.stalePerrserker, "missing");
    assert.equal(result.columns, 7);
    console.log(`Validated ${result.links.length} evolution links, regional paths, examples, and alternate-form summary.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
