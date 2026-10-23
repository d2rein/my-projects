const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("../iss-tracker/node_modules/playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route(/^https?:/, route => route.abort());
    await page.goto(`file:///${path.join(__dirname, "..", "pokedex.html").replace(/\\/g, "/")}`);

    const audit = await page.evaluate(() => {
      const excludedDexes = [25, 681, 716, 774, 778, 845, 877, 890];
      const groups = window.POKEDEX_FORM_CATALOG.map(group => {
        const entries = altEntries.filter(entry => entry.dex === group.dex && entry.catalogFormName);
        return {
          dex: group.dex,
          expected: (group.existing || []).length + (group.add || []).length,
          actual: entries.length,
          names: entries.map(cleanDisplayName),
          ids: entries.map(entry => entry.id)
        };
      });
      const form = (dex, name) => altEntries.find(entry => entry.dex === dex && cleanDisplayName(entry).endsWith(name));
      const whiteBasculin = form(550, "White-Striped Form");
      const ordinaryBasculin = canonicalEntries.find(entry => entry.dex === 550);
      const armored = form(150, "Armored");
      const spinda10 = form(327, "Pattern 10");
      const spinda9 = form(327, "Pattern 9");
      const castform = form(351, "Sunny");
      const unownA = form(201, " A");
      state.statuses.pokemon[castform.id] = "owned";
      state.statuses.pokemon[unownA.id] = "owned";
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return {
        groups,
        canonicalCount: canonicalEntries.length,
        excluded: excludedDexes.filter(dex => altEntries.some(entry => entry.dex === dex)),
        spinda10Unreleased: isCurrentlyUnreleased(spinda10),
        spinda9Unreleased: isCurrentlyUnreleased(spinda9),
        spindaSpeciesUnreleased: isCurrentlyUnreleased(canonicalEntries.find(entry => entry.dex === 327)),
        whiteBasculinEvolves: getEvolutionTargets(whiteBasculin).some(entry => entry.dex === 902),
        ordinaryBasculinEvolves: getEvolutionTargets(ordinaryBasculin).some(entry => entry.dex === 902),
        armoredId: armored.id,
        castformId: castform.id,
        unownId: unownA.id,
        correctedNames: [669, 892, 931].map(dex => cleanDisplayName(canonicalEntries.find(entry => entry.dex === dex)))
      };
    });

    assert.equal(audit.canonicalCount, 1025);
    assert.equal(audit.groups.length, 50);
    for (const group of audit.groups) {
      assert.equal(group.actual, group.expected, `Incorrect form count for #${group.dex}`);
      assert.equal(new Set(group.names).size, group.names.length, `Duplicate form name for #${group.dex}`);
      assert.equal(new Set(group.ids).size, group.ids.length, `Duplicate form ID for #${group.dex}`);
    }
    assert.deepEqual(audit.excluded, []);
    assert.equal(audit.spinda10Unreleased, true);
    assert.equal(audit.spinda9Unreleased, false);
    assert.equal(audit.spindaSpeciesUnreleased, false);
    assert.equal(audit.whiteBasculinEvolves, true);
    assert.equal(audit.ordinaryBasculinEvolves, false);
    assert.deepEqual(audit.correctedNames, ["Flabébé", "Urshifu", "Squawkabilly"]);
    assert.equal(audit.castformId, "alt::351::1::Castform::Fire::-");

    await page.reload();
    const retained = await page.evaluate(ids => {
      state.activeMode = "pokemon";
      state.search = "Unown A";
      state.showAltForms = true;
      render();
      return {
        existingStatus: state.statuses.pokemon[ids.castformId],
        newStatus: state.statuses.pokemon[ids.unownId],
        visible: getVisibleEntries().map(cleanDisplayName)
      };
    }, audit);
    assert.deepEqual(retained, { existingStatus: "owned", newStatus: "owned", visible: ["Unown A"] });
    assert.deepEqual(errors, []);
    console.log("Validated 50 form groups, exclusions, release states, evolution paths, and saved status IDs.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
