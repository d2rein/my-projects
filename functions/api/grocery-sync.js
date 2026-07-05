function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

function getStore(env) {
  return env?.POGO_TRACKER_KV || null;
}

function getKey(request) {
  const url = new URL(request.url);
  const code = String(url.searchParams.get("code") || "").trim().toLowerCase();
  return {
    code: code || "default",
    key: "grocery-sync:" + (code || "default")
  };
}

async function sha256(text) {
  const encoded = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readRecord(store, key) {
  const raw = await store.get(key);
  return raw ? JSON.parse(raw) : null;
}

function isValidPayload(payload) {
  return payload && typeof payload === "object" && payload.state && payload.done;
}

export async function onRequestGet(context) {
  const store = getStore(context.env);
  if (!store) {
    return json({ error: "Cloud storage binding is not configured." }, 500);
  }

  const info = getKey(context.request);
  const record = await readRecord(store, info.key);
  if (!record) {
    return json({ error: "No synced grocery list found." }, 404);
  }

  return json({
    code: info.code,
    updatedAt: record.updatedAt,
    payload: record.payload
  });
}

export async function onRequestPut(context) {
  const store = getStore(context.env);
  if (!store) {
    return json({ error: "Cloud storage binding is not configured." }, 500);
  }

  const info = getKey(context.request);
  const body = await context.request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return json({ error: "Invalid request body." }, 400);
  }

  if (!isValidPayload(body.payload)) {
    return json({ error: "Invalid grocery payload." }, 400);
  }

  const existing = await readRecord(store, info.key);

  const lastKnownUpdatedAt = body.lastKnownUpdatedAt || null;
  if (existing && lastKnownUpdatedAt && existing.updatedAt !== lastKnownUpdatedAt) {
    return json({ error: "Cloud copy changed since your last refresh." }, 409);
  }

  if (existing && !lastKnownUpdatedAt && existing.updatedAt) {
    return json({ error: "Refresh cloud before overwriting an existing synced list." }, 409);
  }

  const record = {
    code: info.code,
    updatedAt: new Date().toISOString(),
    payload: body.payload
  };

  await store.put(info.key, JSON.stringify(record));

  return json({
    ok: true,
    code: info.code,
    updatedAt: record.updatedAt
  });
}
