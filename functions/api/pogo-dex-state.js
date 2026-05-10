const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};

export async function onRequestGet(context) {
  const { env } = context;
  if (!env.POGO_TRACKER_KV) {
    return json({ error: "POGO_TRACKER_KV binding is not configured." }, 501);
  }

  const saved = await env.POGO_TRACKER_KV.get("pogo-dex-state", "json");
  return json(saved || { lists: {}, releaseFeed: null, publishedAt: null });
}

export async function onRequestPost(context) {
  const { env, request } = context;
  if (!env.POGO_TRACKER_KV) {
    return json({ error: "POGO_TRACKER_KV binding is not configured." }, 501);
  }

  if (env.POGO_TRACKER_TOKEN) {
    const provided = request.headers.get("x-pogo-token");
    if (provided !== env.POGO_TRACKER_TOKEN) {
      return json({ error: "Missing or invalid publish token." }, 401);
    }
  }

  const payload = await request.json();
  const envelope = {
    ...payload,
    publishedAt: new Date().toISOString()
  };
  await env.POGO_TRACKER_KV.put("pogo-dex-state", JSON.stringify(envelope));
  return json({ ok: true, publishedAt: envelope.publishedAt });
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: DEFAULT_HEADERS
  });
}
