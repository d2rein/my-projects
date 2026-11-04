const UPSTREAM = "https://openamerica.io/elections/results.json";

export async function onRequestGet(context) {
  const requested = new URL(context.request.url).searchParams.get("office") || "House";
  const office = requested.toLowerCase() === "senate" ? "Senate" : "House";
  const url = new URL(UPSTREAM);
  url.searchParams.set("year", "2026");
  url.searchParams.set("office", office);

  try {
    const upstream = await fetch(url, {
      headers: { "User-Agent": "drein.net/midterms-live election results dashboard" },
      cf: { cacheTtl: 45, cacheEverything: true }
    });
    const contentType = upstream.headers.get("content-type") || "";
    if (!upstream.ok || !contentType.includes("application/json")) {
      throw new Error(`Upstream returned ${upstream.status} ${contentType}`);
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=20, s-maxage=45, stale-while-revalidate=120",
        "X-Results-Source": "Open America"
      }
    });
  } catch (error) {
    return Response.json({ error: "Results feed temporarily unavailable", detail: error.message }, {
      status: 502,
      headers: { "Cache-Control": "no-store" }
    });
  }
}
