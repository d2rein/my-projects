import { loadJSON, saveJSON, buildNewQueue, generateRSS } from "../_lib/podcast.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  const formData = await request.formData();
  const listenedIds = formData.getAll("listened_ids") || [];

  let state = await loadJSON(env, "state.json", { listened_guids: [], added_guids: [] });
  let queue = await loadJSON(env, "queue.json", []);

  // Remove listened episodes
  if (queue.length && listenedIds.length) {
    const listened = queue.filter(ep => listenedIds.includes(ep.id));
    const remaining = queue.filter(ep => !listenedIds.includes(ep.id));

    for (const ep of listened) {
      if (!state.listened_guids.includes(ep.id)) {
        state.listened_guids.push(ep.id);
      }
    }

    queue = remaining;
  }

  const approvedIds = formData.getAll("approve_selective") || [];
  const newQueue = await buildNewQueue(env, state, queue, approvedIds);

  await saveJSON(env, "state.json", state);
  await saveJSON(env, "queue.json", newQueue);

  // Optional: also store RSS in KV if you want, but /feed.xml can generate live
  await env.PODCAST_KV.put("feed.xml", generateRSS(newQueue));

  return new Response("OK", { status: 200 });
}
