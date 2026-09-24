const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("../iss-tracker/node_modules/playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 850, height: 900 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route(/^https?:/, route => route.abort());
    await page.goto(`file:///${path.join(__dirname, "..", "pokedex.html").replace(/\\/g, "/")}`);

    const hoenn = await page.evaluate(() => {
      state.activeMode = "shiny";
      state.regionFilter = "Hoenn";
      state.statusFilter = "regional";
      state.search = "";
      state.showAltForms = false;
      for (const dex of [336, 357]) {
        const entry = canonicalEntries.find(candidate => candidate.dex === dex);
        setEntryStatus("shiny", entry.id, "owned");
      }
      render();
      return {
        count: els.filterBreakdownCount.textContent,
        names: [...document.querySelectorAll(".dex-card .pokemon-name")].map(node => node.textContent)
      };
    });
    assert.equal(hoenn.count, "3/3");
    assert.deepEqual(hoenn.names, ["Seviper", "Tropius", "Relicanth"]);
    await page.locator('[data-visible-filter="owned"]').uncheck();
    assert.equal(await page.locator("#filterBreakdownCount").textContent(), "1/3");
    assert.deepEqual(await page.locator(".dex-card .pokemon-name").allTextContents(), ["Relicanth"]);
    await page.reload();
    assert.equal(await page.locator("#filterBreakdownCount").textContent(), "1/3");
    assert.equal(await page.locator('[data-visible-filter="owned"]').isChecked(), false);

    const unique = await page.evaluate(() => {
      state.regionFilter = "Kanto";
      state.statusFilter = "unique";
      state.visibleFilters.owned = true;
      for (const dex of [10, 11, 12, 90, 91]) {
        setEntryStatus("shiny", canonicalEntries.find(entry => entry.dex === dex).id, "missing");
      }
      setEntryStatus("shiny", canonicalEntries.find(entry => entry.dex === 12).id, "owned");
      const galarZapdos = (speciesEntriesByDex.get(145) || []).find(entry => entry.isAltForm && getFormFamilyKey(entry) === "galarian");
      setEntryStatus("shiny", canonicalEntries.find(entry => entry.dex === 145).id, "missing");
      setEntryStatus("shiny", galarZapdos.id, "owned");
      render();
      return {
        examples: getVisibleEntries().filter(entry => [10, 11, 12, 90, 91, 145].includes(entry.dex)).map(entry => entry.dex),
        visible: getVisibleEntries().length,
        summary: computeCounts(canonicalEntries.filter(entry => entry.region === "Kanto")).uniqueMissing
      };
    });
    assert.deepEqual(unique.examples, [10, 90]);
    assert.equal(unique.visible, unique.summary);

    const mega = await page.evaluate(() => {
      state.regionFilter = "all";
      state.statusFilter = "mega";
      state.visibleFilters.owned = false;
      state.visibleFilters["can-evolve"] = false;
      const available = canonicalEntries.filter(entry => getAvailableMegaDexes().has(entry.dex) && !isCurrentlyUnreleased(entry)).slice(0, 3);
      setEntryStatus("shiny", available[0].id, "owned");
      setEntryStatus("shiny", available[1].id, "can-evolve");
      setEntryStatus("shiny", available[2].id, "missing");
      render();
      return {
        onlyInaccessible: getVisibleEntries().every(entry => !["owned", "can-evolve", "trade"].includes(getEffectiveStatus(entry, "shiny"))),
        count: els.filterBreakdownCount.textContent,
        available: available.map(entry => entry.dex)
      };
    });
    assert(mega.onlyInaccessible);
    assert.equal(mega.available.length, 3);
    const [shown, eligible] = mega.count.split("/").map(Number);
    assert.equal(shown, eligible - 2);

    for (const width of [1440, 850, 780]) {
      await page.setViewportSize({ width, height: 900 });
      const layout = await page.evaluate(() => {
        const table = document.querySelector(".stats-panel .table-wrap").getBoundingClientRect();
        const panel = document.querySelector(".summary-filter-panel").getBoundingClientRect();
        return { tableRight: table.right, panelLeft: panel.left, topDelta: Math.abs(table.top - panel.top), pageWidth: document.documentElement.scrollWidth };
      });
      assert(layout.panelLeft >= layout.tableRight, `Checklist overlaps table at ${width}px`);
      assert(layout.topDelta < 20, `Checklist dropped below table at ${width}px`);
      assert(layout.pageWidth <= width, `Page overflows at ${width}px`);
    }
    for (const width of [720, 600, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const layout = await page.evaluate(() => ({ pageWidth: document.documentElement.scrollWidth,
        tableWidth: document.querySelector(".stats-panel .table-wrap").clientWidth }));
      assert(layout.pageWidth <= width, `Page overflows at ${width}px`);
      assert(layout.tableWidth <= width, `Summary table exceeds viewport at ${width}px`);
    }
    assert.deepEqual(errors, []);
    console.log("Validated Hoenn 3/3 to 1/3, Unique roots, Shiny Mega exclusions, and responsive layout.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
