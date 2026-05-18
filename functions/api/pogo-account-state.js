import { getStateKey, json, requireSession } from "../_lib/site-auth.js";

export async function onRequestGet(context) {
  const auth = await requireSession(context);
  if (!auth.ok) return auth.response;

  const stored = await auth.store.get(getStateKey(), "json");
  return json(stored || emptyState());
}

export async function onRequestPut(context) {
  const auth = await requireSession(context);
  if (!auth.ok) return auth.response;

  const body = await context.request.json().catch(() => null);
  const payload = body?.payload || {};
  const hasMedals = Object.prototype.hasOwnProperty.call(payload, "medals");
  const hasPokedex = Object.prototype.hasOwnProperty.call(payload, "pokedex");
  const medals = hasMedals ? payload.medals : undefined;
  const pokedex = hasPokedex ? payload.pokedex : undefined;

  if (!hasMedals && !hasPokedex) {
    return json({ error: "Invalid state payload." }, 400);
  }

  const existing = await auth.store.get(getStateKey(), "json");
  const current = existing || emptyState();

  const nextState = {
    revision: current.revision + 1,
    updatedAt: new Date().toISOString(),
    medals: hasMedals ? chooseNewerSection(current.medals, medals) : (current.medals ?? null),
    pokedex: hasPokedex ? chooseNewerSection(current.pokedex, pokedex) : (current.pokedex ?? null)
  };

  await auth.store.put(getStateKey(), JSON.stringify(nextState));
  return json({ ok: true, state: nextState });
}

function chooseNewerSection(currentValue, incomingValue) {
  if (incomingValue == null) return currentValue ?? null;
  if (currentValue == null) return incomingValue;
  return getModifiedAt(incomingValue) >= getModifiedAt(currentValue) ? incomingValue : currentValue;
}

function getModifiedAt(value) {
  return String(value?._meta?.lastModifiedAt || "");
}

function emptyState() {
  return {
    revision: 0,
    updatedAt: null,
    medals: null,
    pokedex: null
  };
}
