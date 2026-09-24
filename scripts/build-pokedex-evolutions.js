const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "pokedex-assets", "pokemon-species-reference.csv");
const output = path.join(root, "pokedex-assets", "evolution-data.js");
const predecessor = {};

for (const line of fs.readFileSync(source, "utf8").trim().split(/\r?\n/).slice(1)) {
  const [id, , , parent] = line.split(",");
  if (Number(id) <= 1025 && parent) predecessor[id] = Number(parent);
}

fs.writeFileSync(output,
  `// Generated from PokeAPI pokemon_species.csv by scripts/build-pokedex-evolutions.js.\n` +
  `window.POKEDEX_EVOLUTION_PREDECESSOR = ${JSON.stringify(predecessor, null, 2)};\n`);
console.log(`Wrote ${Object.keys(predecessor).length} evolution links to ${output}`);
