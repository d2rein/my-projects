const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};

const DEFAULT_RELEASE_FEED = {
  updatedAt: "2026-05-10",
  sources: [
    {
      name: "Official Pokemon GO news",
      url: "https://pokemongolive.com/"
    }
  ],
  releases: [
    {
      id: "sample-may-spotlight",
      title: "Sample Spotlight Hour",
      startsAt: "2026-05-19T18:00:00+10:00",
      endsAt: "2026-05-19T19:00:00+10:00",
      source: "Add official post URL here",
      opportunities: [
        {
          list: "shiny",
          dex: 133,
          label: "Shiny chance featured",
          boost: "boosted odds"
        },
        {
          list: "pokemon",
          dex: 137,
          label: "Wild debut"
        }
      ]
    },
    {
      id: "sample-rocket-rotation",
      title: "Sample Rocket Rotation",
      startsAt: "2026-05-24T10:00:00+10:00",
      endsAt: "2026-06-15T20:00:00+10:00",
      source: "Add official post URL here",
      opportunities: [
        {
          list: "shadow",
          dex: 74,
          label: "Shadow in grunt lineup"
        },
        {
          list: "purified",
          dex: 74,
          label: "Purify after rescue"
        }
      ]
    }
  ]
};

export async function onRequestGet(context) {
  const { env } = context;
  if (!env.POGO_TRACKER_KV) {
    return json(DEFAULT_RELEASE_FEED);
  }
  const saved = await env.POGO_TRACKER_KV.get("pogo-release-feed", "json");
  return json(saved || DEFAULT_RELEASE_FEED);
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
  await env.POGO_TRACKER_KV.put("pogo-release-feed", JSON.stringify(envelope));
  return json({ ok: true, publishedAt: envelope.publishedAt });
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: DEFAULT_HEADERS
  });
}
