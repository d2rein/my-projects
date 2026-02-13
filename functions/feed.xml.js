function generateRSS(queue) {
  const items = queue.map(ep => `
    <item>
      <title>${ep.title}</title>
      <guid>${ep.id}</guid>
      <pubDate>${new Date(ep.pubdate).toUTCString()}</pubDate>
      <enclosure url="${ep.audio_url}" type="audio/mpeg" />
    </item>
  `).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Custom Queue</title>
    <description>Algorithmic podcast queue</description>
    ${items}
  </channel>
</rss>`;
}

export async function onRequestGet(context) {
  const { env } = context;

  const queueRaw = await env.PODCAST_KV.get("queue.json");
  const queue = queueRaw ? JSON.parse(queueRaw) : [];

  const rss = generateRSS(queue);

  return new Response(rss, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" }
  });
}
