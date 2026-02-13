export async function onRequestGet(context) {
  const { env } = context;

  const stateRaw = await env.PODCAST_KV.get("state.json");
  const queueRaw = await env.PODCAST_KV.get("queue.json");

  const state = stateRaw
    ? JSON.parse(stateRaw)
    : { listened_guids: [], added_guids: [] };

  const queue = queueRaw ? JSON.parse(queueRaw) : [];

  return new Response(
    JSON.stringify({
      queue,
      selective_candidates: [],
      backup_candidates: [],
      max_size: 50
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
