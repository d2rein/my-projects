export async function onRequestGet(context) {
  return new Response(
    JSON.stringify({ status: "Pages function working" }),
    { headers: { "Content-Type": "application/json" } }
  );
}
