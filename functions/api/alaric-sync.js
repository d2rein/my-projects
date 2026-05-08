function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type":"application/json", ...(init.headers || {}) },
    status: init.status || 200
  });
}

function getStore(env) {
  if (!env || !env.PODCAST_KV) return null;
  return env.PODCAST_KV;
}

function normalizeCode(value) {
  return String(value || "").trim().replace(/\s+/g, "-");
}

function getKey(request) {
  const url = new URL(request.url);
  const code = normalizeCode(url.searchParams.get("code") || "");
  if (!code) return "";
  return { code, key:`alaric-sync:${code.toLowerCase()}` };
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
  if (!store) return json({ error:"Cloud storage binding is not configured." }, { status:500 });
  const info = getKey(context.request);
  if (!info) return json({ error:"Missing character code." }, { status:400 });
  const record = await readRecord(store, info.key);
  if (!record) return json({ error:"Character code not found." }, { status:404 });
  return json({
    payload:record.payload,
    updatedAt:record.updatedAt,
    code:record.code || info.code
  });
}

export async function onRequestPut(context) {
  const store = getStore(context.env);
  if (!store) return json({ error:"Cloud storage binding is not configured." }, { status:500 });
  const info = getKey(context.request);
  if (!info) return json({ error:"Missing character code." }, { status:400 });
  const body = await context.request.json().catch(() => null);
  if (!body || typeof body !== "object" || !body.payload || !body.payload.data) {
    return json({ error:"Invalid save payload." }, { status:400 });
  }
  const pin = String(body.pin || "").trim();
  if (!/^\d{4}$/.test(pin)) {
    return json({ error:"A 4-digit push PIN is required." }, { status:400 });
  }
  const pinHash = await sha256(pin);
  const existing = await readRecord(store, info.key);
  if (existing && existing.pinHash !== pinHash) {
    return json({ error:"Incorrect push PIN." }, { status:403 });
  }
  const record = {
    code:info.code,
    pinHash,
    payload:body.payload,
    updatedAt:new Date().toISOString()
  };
  await store.put(info.key, JSON.stringify(record));
  return json({ ok:true, updatedAt:record.updatedAt, code:info.code });
}
