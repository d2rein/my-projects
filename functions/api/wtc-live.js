const ICC_STANDINGS_URL = "https://www.icc-cricket.com/tournaments/world-test-championship/standings";

export async function onRequestGet() {
  const checkedAt = new Date().toISOString();

  try {
    const response = await fetch(ICC_STANDINGS_URL, {
      headers: {
        "User-Agent": "my-projects-wtc-sync/1.0"
      }
    });

    if (!response.ok) {
      return json({
        ok: true,
        liveDataAvailable: false,
        checkedAt,
        message: `Seeded snapshot in use. ICC standings check returned ${response.status}.`
      });
    }

    const html = await response.text();
    const hasStandingsWidget = html.includes('data-wdtype="wcstandings"') && html.includes('data-championship-id="8"');

    return json({
      ok: true,
      liveDataAvailable: hasStandingsWidget,
      checkedAt,
      message: hasStandingsWidget
        ? "ICC standings source is reachable. Live parser hook is in place; seeded table remains the fallback if parsing changes."
        : "Seeded snapshot in use. ICC source loaded but the standings widget signature changed."
    });
  } catch (error) {
    return json({
      ok: true,
      liveDataAvailable: false,
      checkedAt,
      message: "Seeded snapshot in use. ICC source could not be reached from the sync check."
    });
  }
}

function json(body) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=900"
    }
  });
}
