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
  const baseRevision = Number(body?.baseRevision || 0);
  const payload = body?.payload || {};
  const medals = payload?.medals || null;
  const pokedex = payload?.pokedex || null;

  if (!medals && !pokedex) {
    return json({ error: "Invalid state payload." }, 400);
  }

  const existing = await auth.store.get(getStateKey(), "json");
  const current = existing || emptyState();
  if (current.revision !== baseRevision) {
    return json({
      error: "State conflict. Reload server data first.",
      state: current
    }, 409);
  }

  const nextState = {
    revision: current.revision + 1,
    updatedAt: new Date().toISOString(),
    medals: medals ?? current.medals ?? null,
    pokedex: pokedex ?? current.pokedex ?? null
  };

  await auth.store.put(getStateKey(), JSON.stringify(nextState));
  return json({ ok: true, state: nextState });
}

function emptyState() {
  return {
    revision: 0,
    updatedAt: null,
    medals: null,
    pokedex: null
  };
}
