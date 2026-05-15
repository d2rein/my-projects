function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...(init.headers || {}) },
    status: init.status || 200
  });
}

function getStore(env) {
  if (!env || !env.POGO_TRACKER_KV) return null;
  return env.POGO_TRACKER_KV;
}

function normalizeCode(value) {
  return String(value || "").trim().replace(/\s+/g, "-");
}

function getKey(request) {
  const url = new URL(request.url);
  const code = normalizeCode(url.searchParams.get("code") || "");
  if (!code) return null;
  return { code, key: `pogo-medals-sync:${code.toLowerCase()}` };
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function readRecord(store, key) {
  const raw = await store.get(key);
  if (!raw) return null;
  return JSON.parse(raw);
}

export async function onRequestGet(context) {
  const store = getStore(context.env);
  if (!store) return json({ error: "Cloud storage binding is not configured." }, { status: 500 });
  const info = getKey(context.request);
  if (!info) return json({ error: "Missing sync code." }, { status: 400 });

  const record = await readRecord(store, info.key);
  if (!record) return json({ error: "Sync code not found." }, { status: 404 });

  const pin = String(context.request.headers.get("x-sync-pin") || "").trim();
  if (!pin) return json({ error: "A 4-digit sync PIN is required." }, { status: 401 });
  const pinHash = await sha256(pin);
  if (record.pinHash !== pinHash) {
    return json({ error: "Incorrect sync PIN." }, { status: 403 });
  }

  return json({
    code: record.code || info.code,
    updatedAt: record.updatedAt,
    payload: record.payload
  });
}

export async function onRequestPut(context) {
  const store = getStore(context.env);
  if (!store) return json({ error: "Cloud storage binding is not configured." }, { status: 500 });
  const info = getKey(context.request);
  if (!info) return json({ error: "Missing sync code." }, { status: 400 });

  const body = await context.request.json().catch(() => null);
  const payload = body?.payload;
  const medals = payload?.medals;
  const pokedex = payload?.pokedex;
  const hasValidMedals = !!medals && Array.isArray(medals.snapshots) && Array.isArray(medals.medals);
  const hasValidPokedex = !!pokedex && typeof pokedex === "object" && !!pokedex.statuses;
  if (!body || typeof body !== "object" || !payload || (!hasValidMedals && !hasValidPokedex)) {
    return json({ error: "Invalid sync payload." }, { status: 400 });
  }

  const pin = String(body.pin || "").trim();
  if (!/^\d{4}$/.test(pin)) {
    return json({ error: "A 4-digit sync PIN is required." }, { status: 400 });
  }

  const pinHash = await sha256(pin);
  const existing = await readRecord(store, info.key);
  if (existing && existing.pinHash !== pinHash) {
    return json({ error: "Incorrect sync PIN." }, { status: 403 });
  }

  const record = {
    code: info.code,
    pinHash,
    payload,
    updatedAt: new Date().toISOString()
  };
  await store.put(info.key, JSON.stringify(record));
  return json({ ok: true, updatedAt: record.updatedAt, code: info.code });
}
