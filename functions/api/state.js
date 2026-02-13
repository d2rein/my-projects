import { loadJSON, getSelectiveCandidates, getBackupCandidates, MAX_QUEUE_SIZE } from "../_lib/podcast.js";

export async function onRequestGet(context) {
  const { env } = context;

  const state = await loadJSON(env, "state.json", { listened_guids: [], added_guids: [] });
  const queue = await loadJSON(env, "queue.json", []);

  const selective = await getSelectiveCandidates(state);
  const backup = await getBackupCandidates(state);

  return new Response(
    JSON.stringify({
      queue,
      selective_candidates: selective,
      backup_candidates: backup,
      max_size: MAX_QUEUE_SIZE
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
