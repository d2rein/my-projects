const HORIZONS_URL = "https://ssd.jpl.nasa.gov/api/horizons.api";
const CACHE_KEY = "orrery:moon-elements:v1";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const MOONS = [
  { name: "Moon", target: "301", center: "399" },
  { name: "Phobos", target: "401", center: "499" },
  { name: "Deimos", target: "402", center: "499" },
  { name: "Io", target: "501", center: "599" },
  { name: "Europa", target: "502", center: "599" },
  { name: "Ganymede", target: "503", center: "599" },
  { name: "Callisto", target: "504", center: "599" },
  { name: "Mimas", target: "601", center: "699" },
  { name: "Enceladus", target: "602", center: "699" },
  { name: "Tethys", target: "603", center: "699" },
  { name: "Dione", target: "604", center: "699" },
  { name: "Rhea", target: "605", center: "699" },
  { name: "Titan", target: "606", center: "699" },
  { name: "Hyperion", target: "607", center: "699" },
  { name: "Iapetus", target: "608", center: "699" },
  { name: "Miranda", target: "701", center: "799" },
  { name: "Ariel", target: "702", center: "799" },
  { name: "Umbriel", target: "703", center: "799" },
  { name: "Titania", target: "704", center: "799" },
  { name: "Oberon", target: "705", center: "799" },
  { name: "Triton", target: "801", center: "899" },
  { name: "Nereid", target: "802", center: "899" }
];

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300"
    }
  });
}

function parseElementsResult(resultText) {
  const clean = (resultText || "").replace(/\r/g, "");
  const soeIdx = clean.indexOf("$$SOE");
  const eoeIdx = clean.indexOf("$$EOE");
  if (soeIdx === -1 || eoeIdx === -1 || eoeIdx <= soeIdx) {
    throw new Error("Horizons response missing element block");
  }
  const block = clean.slice(soeIdx, eoeIdx);
  const getNum = (key) => {
    const match = block.match(new RegExp(`(?:^|\\s)${key}\\s*=\\s*([-+0-9.E]+)`));
    if (!match) throw new Error(`Missing ${key} in Horizons block`);
    return Number(match[1]);
  };
  return {
    A_km: getNum("A"),
    EC: getNum("EC"),
    IN_deg: getNum("IN"),
    OM_deg: getNum("OM"),
    W_deg: getNum("W"),
    MA_deg: getNum("MA"),
    N_deg_per_sec: getNum("N"),
    QR_km: getNum("QR"),
    AD_km: getNum("AD"),
    PR_sec: getNum("PR")
  };
}

async function fetchMoonElementsAtJD(moon, jd) {
  const params = new URLSearchParams({
    format: "json",
    OBJ_DATA: "NO",
    MAKE_EPHEM: "YES",
    EPHEM_TYPE: "ELEMENTS",
    REF_PLANE: "ECLIPTIC",
    CENTER: `500@${moon.center}`,
    COMMAND: `'${moon.target}'`,
    TLIST: `'${jd.toFixed(9)}'`
  });
  const res = await fetch(`${HORIZONS_URL}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Horizons HTTP ${res.status} for ${moon.name}`);
  }
  const data = await res.json();
  if (!data || typeof data.result !== "string") {
    throw new Error(`Unexpected Horizons payload for ${moon.name}`);
  }
  const el = parseElementsResult(data.result);
  return {
    name: moon.name,
    target: moon.target,
    center: moon.center,
    epoch_jd: jd.toFixed(9),
    ...el
  };
}

async function buildSnapshot() {
  const jd = Date.now() / 86400000 + 2440587.5;
  const moons = [];
  for (const moon of MOONS) {
    const row = await fetchMoonElementsAtJD(moon, jd);
    moons.push(row);
  }
  return {
    generated_at_utc: new Date().toISOString(),
    generated_at_ms: Date.now(),
    epoch_jd: jd.toFixed(9),
    moons
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";
  const kv = env?.PODCAST_KV;

  let cached = null;
  if (kv) {
    const raw = await kv.get(CACHE_KEY, "text");
    if (raw) {
      try {
        cached = JSON.parse(raw);
      } catch (_err) {
        cached = null;
      }
    }
  }

  if (!force && cached && cached.generated_at_ms && Date.now() - cached.generated_at_ms < WEEK_MS) {
    return jsonResponse({ ...cached, cached: true, cache_age_ms: Date.now() - cached.generated_at_ms });
  }

  try {
    const fresh = await buildSnapshot();
    if (kv) {
      await kv.put(CACHE_KEY, JSON.stringify(fresh));
    }
    return jsonResponse({ ...fresh, cached: false, cache_age_ms: 0 });
  } catch (err) {
    if (cached) {
      return jsonResponse({
        ...cached,
        cached: true,
        stale: true,
        error: err.message
      });
    }
    return jsonResponse({ error: "Failed to fetch moon elements", detail: err.message }, 502);
  }
}
