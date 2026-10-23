# Pokemon GO form catalog

`form-data.js` audits the [Bulbapedia Pokemon GO form-differences list](https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_with_form_differences_in_Pok%C3%A9mon_GO) as of 23 October 2026. It covers the Alternate forms section, including Paldean Tauros and Armored Mewtwo, but not the separate Mega, Fusion, Gigantamax, Shadow, or event-costume sections.

Pikachu costumes and battle-only forms of Aegislash, Xerneas, Minior, Mimikyu, Cramorant, Morpeko, and Eternatus are intentionally excluded. The generic species card remains the species-level record; named form cards are additional records. Existing visible form IDs and saved statuses stay intact. New named forms start unowned. Spinda patterns 10-20 are marked unreleased; patterns 1-9 are released.

The seed CSV contains some duplicate rows for forms with identical names and typing. `applyFormCatalog()` labels these before catalog construction so they are no longer collapsed. Run `node scripts/test-pokedex-forms.js` alongside the existing filter and evolution tests after changing the list.
