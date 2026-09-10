function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type":"application/json", ...(init.headers || {}) },
    status: init.status || 200
  });
}

function getStore(env) {
  return env?.POGO_TRACKER_KV || env?.PODCAST_KV || null;
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
  const response = {
    payload:record.payload,
    updatedAt:record.updatedAt,
    revision:Number(record.revision || 1),
    code:record.code || info.code
  };
  const url = new URL(context.request.url);
  if (url.searchParams.get("history") === "1") {
    response.history = Array.isArray(record.history) ? record.history : [];
  }
  return json(response);
}

export async function onRequestPost(context) {
  const store = getStore(context.env);
  if (!store) return json({ error:"Cloud storage binding is not configured." }, { status:500 });
  const info = getKey(context.request);
  if (!info) return json({ error:"Missing character code." }, { status:400 });
  const body = await context.request.json().catch(() => null);
  const pin = String(body?.pin || "").trim();
  if (body?.action !== "verify" || !/^\d{4}$/.test(pin)) {
    return json({ error:"A 4-digit push PIN is required." }, { status:400 });
  }
  const existing = await readRecord(store, info.key);
  if (!existing) return json({ error:"Character code not found." }, { status:404 });
  if (existing.pinHash !== await sha256(pin)) {
    return json({ error:"Incorrect push PIN." }, { status:403 });
  }
  return json({ ok:true, updatedAt:existing.updatedAt, revision:Number(existing.revision || 1) });
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
  if (body.createOnly && existing) {
    return json({ error:"A live copy already exists. Choose Use Existing Live Copy instead." }, { status:409 });
  }
  const currentRevision = existing ? Number(existing.revision || 1) : 0;
  if (Object.prototype.hasOwnProperty.call(body, "expectedRevision") && Number(body.expectedRevision) !== currentRevision) {
    return json({
      error:"The live copy changed on another device.",
      revision:currentRevision,
      updatedAt:existing?.updatedAt || null
    }, { status:409 });
  }
  const history = Array.isArray(existing?.history) ? existing.history.slice() : [];
  if (existing?.payload) {
    history.unshift({
      payload:existing.payload,
      updatedAt:existing.updatedAt,
      revision:currentRevision
    });
  }
  const record = {
    code:info.code,
    pinHash,
    payload:body.payload,
    revision:currentRevision + 1,
    updatedAt:new Date().toISOString(),
    history:history.slice(0, 20)
  };
  await store.put(info.key, JSON.stringify(record));
  return json({ ok:true, updatedAt:record.updatedAt, revision:record.revision, code:info.code });
}
