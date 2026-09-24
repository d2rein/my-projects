# Evolution data

`pokemon-species-reference.csv` is a copy of PokeAPI's `pokemon_species.csv` (species IDs through 1025). Run `node scripts/build-pokedex-evolutions.js` to regenerate `evolution-data.js`. The browser uses the generated graph rather than a manually maintained predecessor list.

Species links do not specify which regional form evolves. `REGIONAL_ONLY_EVOLUTIONS` in `app.js` handles evolutions such as Galarian Meowth to Perrserker and prevents ordinary Meowth from gaining that path. Basculin is treated as a possible source for Basculegion because the current seed has no separate White-Striped Basculin entry.

The summary's **Unique Missing** counts missing acquisition roots within each displayed region. Missing Shellder and Cloyster count once; missing Caterpie and Metapod with Butterfree owned count once. An owned alternate form makes that species owned for the summary, including shiny regional forms. Run `node scripts/test-pokedex-evolutions.js` to check graph coverage and these cases.

Source: https://github.com/PokeAPI/pokeapi/blob/master/data/v2/csv/pokemon_species.csv
