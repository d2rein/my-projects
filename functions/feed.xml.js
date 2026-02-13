import { loadJSON, generateRSS } from "./_lib/podcast.js";

export async function onRequestGet(context) {
  const { env } = context;

  const queue = await loadJSON(env, "queue.json", []);
  const rss = generateRSS(queue);

  return new Response(rss, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" }
  });
}
