import test from "node:test";
import assert from "node:assert/strict";
import { missingAvailability, normalizeBrisbaneInstant } from "../src/pogo.js";

test("floating event times are interpreted as Brisbane wall time", () => {
  assert.equal(normalizeBrisbaneInstant("2026-10-26T14:00:00"), "2026-10-26T04:00:00.000Z");
});

test("only missing Pokémon are returned", () => {
  const sections = [{ title: "Event", startsAt: "2026-10-26T14:00:00", entries: [
    { dex: 25, name: "Pikachu", list: "pokemon" }, { dex: 26, name: "Raichu", list: "pokemon" },
  ] }];
  const pokedex = { statuses: { pokemon: { "pokemon::25": "owned" } } };
  const missing = missingAvailability(sections, pokedex);
  assert.equal(missing.length, 1);
  assert.equal(missing[0].dex, 26);
});
