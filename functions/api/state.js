export async function onRequestGet(context) {
  const { env } = context;

  // Try reading a test key
  let value = await env.PODCAST_KV.get("test");

  if (!value) {
    value = "KV is working";
    await env.PODCAST_KV.put("test", value);
  }

  return new Response(
    JSON.stringify({ kv_value: value }),
    { headers: { "Content-Type": "application/json" } }
  );
}
