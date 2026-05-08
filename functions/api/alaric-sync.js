function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type":"application/json", ...(init.headers || {}) },
    status: init.status || 200
  });
}

function getStore(env) {
  if (!env || !env.PODCAST_KV) {
    return null;
  }
  return env.PODCAST_KV;
}

function getKey(request) {
  const url = new URL(request.url);
  const id = (url.searchParams.get("id") || "").trim();
  if (!id) return "";
  return `alaric-sync:${id}`;
}

export async function onRequestGet(context) {
  const store = getStore(context.env);
  if (!store) {
    return json({ error:"Cloud storage binding is not configured." }, { status:500 });
  }
  const key = getKey(context.request);
  if (!key) {
    return json({ error:"Missing sync id." }, { status:400 });
  }
  const raw = await store.get(key);
  if (!raw) {
    return json({ error:"Sync id not found." }, { status:404 });
  }
  return new Response(raw, { headers:{ "Content-Type":"application/json" } });
}

export async function onRequestPut(context) {
  const store = getStore(context.env);
  if (!store) {
    return json({ error:"Cloud storage binding is not configured." }, { status:500 });
  }
  const key = getKey(context.request);
  if (!key) {
    return json({ error:"Missing sync id." }, { status:400 });
  }
  const payload = await context.request.json().catch(() => null);
  if (!payload || typeof payload !== "object" || !payload.data) {
    return json({ error:"Invalid save payload." }, { status:400 });
  }
  const wrapped = {
    payload,
    updatedAt:new Date().toISOString()
  };
  await store.put(key, JSON.stringify(wrapped));
  return json({ ok:true, updatedAt:wrapped.updatedAt });
}
