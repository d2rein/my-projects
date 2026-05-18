import { getStore, json, requireSession } from "../_lib/site-auth.js";

const POKEDEX_STATE_KEY = "site-account-state:pokedex";

export async function onRequestGet(context) {
  const auth = await requireSession(context);
  if (!auth.ok) return auth.response;

  const stored = await auth.store.get(POKEDEX_STATE_KEY, "json");
  return json(stored || { updatedAt: null, pokedex: null });
}

export async function onRequestPut(context) {
  const auth = await requireSession(context);
  if (!auth.ok) return auth.response;

  const body = await context.request.json().catch(() => null);
  const pokedex = body?.pokedex;
  if (!pokedex || typeof pokedex !== "object" || !pokedex.statuses) {
    return json({ error: "Invalid Pokedex payload." }, 400);
  }

  const envelope = {
    updatedAt: new Date().toISOString(),
    pokedex
  };

  await auth.store.put(POKEDEX_STATE_KEY, JSON.stringify(envelope));
  return json({ ok: true, updatedAt: envelope.updatedAt });
}
