export async function onRequestPost(context) {
  const { request, env } = context;

  const formData = await request.formData();
  const title = formData.get("title");

  if (!title) {
    return new Response("Missing title", { status: 400 });
  }

  const queueRaw = await env.PODCAST_KV.get("queue.json");
  const queue = queueRaw ? JSON.parse(queueRaw) : [];

  queue.push({
    id: crypto.randomUUID(),
    title: title,
    audio_url: "https://example.com/audio.mp3",
    pubdate: new Date().toISOString()
  });

  await env.PODCAST_KV.put("queue.json", JSON.stringify(queue));

  return new Response("Added", { status: 200 });
}
