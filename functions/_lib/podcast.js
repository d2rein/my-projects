// functions/_lib/podcast.js

// ---------- CONFIG ----------
export const FEEDS = [
  // EXAMPLES — replace these URLs with your real podcast RSS URLs
  {
    name: "History of Rome",
    url: "https://historyofrome.libsyn.com/rss",
    type: "backcatalog",
    batch_size: 2,
    start_at: 111,
  },
//  {
//    name: "High Priority Show",
//    url: "https://example.com/highpriority/feed.xml",
//    type: "high_priority",
//    backup_pool: true,
//  },
//  {
//    name: "Low Priority Show",
//    url: "https://example.com/lowpriority/feed.xml",
//    type: "low_priority",
//    backup_pool: true,
//  },
//  {
//    name: "Selective Show",
//    url: "https://example.com/selective/feed.xml",
//    type: "selective",
//  },
  {
    name: "Outside",
    url: "https://feeds.megaphone.fm/POM5001301518",
    type: "selective",
  },
  {
    name: "Explorers Podcast",
    url: "https://feeds.megaphone.fm/ADL4434397541",
    type: "selective",
  },
  {
    name: "Overdue",
    url: "https://www.omnycontent.com/d/playlist/77bedd50-a734-42aa-9c08-ad86013ca0f9/e7707767-fd61-4887-b6ee-ad88014933e3/b9defaac-c62e-4810-bc36-ad88014933fb/podcast.rss",
    type: "high_priority",
    backup_pool: true,
  },
  {
    name: "Age of Napoleon",
    url: "https://feeds.megaphone.fm/ADL5280986787",
    type: "high_priority",
    backup_pool: true,
  },
  {
    name: "99PI",
    url: "https://feeds.simplecast.com/BqbsxVfO",
    type: "high_priority",
    backup_pool: true,
  },
  {
    name: "If Books Could Kill",
    url: "https://rss.buzzsprout.com/2040953.rss",
    type: "high_priority",
    backup_pool: true,
  },

  {
    name: "The Rest is History",
    url: "https://feeds.megaphone.fm/GLT4787413333",
    type: "selective",
  },
];

export const MAX_QUEUE_SIZE = 50;
export const BACKUP_COUNT = 10;
// Only allow high/low priority episodes after this date
const PRIORITY_CUTOFF = new Date("2026-02-01");


// ---------- KV HELPERS ----------
export async function loadJSON(env, key, fallback) {
  const raw = await env.PODCAST_KV.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function saveJSON(env, key, value) {
  await env.PODCAST_KV.put(key, JSON.stringify(value));
}

// ---------- XML / RSS PARSING (Worker-safe) ----------
// This is intentionally simple and robust enough for most RSS feeds.
// If a particular feed is weird (namespaces, CDATA edge cases), we can upgrade later.
function decodeXmlEntities(s) {
  return String(s)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function getTag(rawItem, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = rawItem.match(re);
  if (!m) return "";
  // strip CDATA if present
  return decodeXmlEntities(m[1].replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/i, "$1").trim());
}

function getEnclosureUrl(rawItem) {
  const m = rawItem.match(/<enclosure[^>]+url="([^"]+)"/i);
  return m ? decodeXmlEntities(m[1]) : "";
}

export async function fetchFeedItems(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "CustomPodcastQueue/1.0" }
    });

    if (!res.ok) {
      console.error("Feed returned non-200:", url, res.status);
      return [];
    }

    const text = await res.text();
    const itemMatches = text.match(/<item>([\s\S]*?)<\/item>/gi) || [];

    return itemMatches.map((rawItem) => {
      const guid = getTag(rawItem, "guid");
      const link = getTag(rawItem, "link");
      const title = getTag(rawItem, "title") || "Untitled";
      const pubDate = getTag(rawItem, "pubDate");
      const enclosure = getEnclosureUrl(rawItem);

      return {
        id: guid || link || title,
        title,
        link,
        published: pubDate,
        audio: enclosure || link,
      };
    });

  } catch (err) {
    console.error("Feed crashed:", url, err);
    return [];
  }
}


export function entryPubDate(entry) {
  if (entry.published) {
    const d = new Date(entry.published);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date(0); // unknown dates sort oldest
}

export function makeEpisode(feedCfg, entry) {
  return {
    id: `${feedCfg.url}::${entry.id}`,
    feed_name: feedCfg.name,
    feed_url: feedCfg.url,
    title: entry.title,
    audio_url: entry.audio,
    pubdate: entryPubDate(entry).toISOString(),
  };
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- CANDIDATES ----------
export async function getSelectiveCandidates(state) {
  const out = [];
  for (const feedCfg of FEEDS) {
    if (feedCfg.type !== "selective") continue;
    const entries = await fetchFeedItems(feedCfg.url);
    for (const e of entries) {
      const id = `${feedCfg.url}::${e.id}`;
      if (state.added_guids.includes(id) || state.listened_guids.includes(id)) continue;
      out.push(makeEpisode(feedCfg, e));
    }
  }
  out.sort((a, b) => (a.pubdate < b.pubdate ? 1 : -1));
  return out.slice(0, 50);
}

export async function getBackupCandidates(state) {
  const out = [];
  for (const feedCfg of FEEDS) {
    if (!feedCfg.backup_pool) continue;

    const entries = await fetchFeedItems(feedCfg.url);
    const pool = entries.filter((e) => {
      const id = `${feedCfg.url}::${e.id}`;
      return !state.added_guids.includes(id) && !state.listened_guids.includes(id);
    });

    if (!pool.length) continue;
    const chosen = shuffle(pool).slice(0, BACKUP_COUNT);
    for (const e of chosen) out.push(makeEpisode(feedCfg, e));
  }
  return out;
}

// ---------- QUEUE BUILDING ----------
export async function buildNewQueue(env, state, existingQueue, approvedIds) {
  let queue = [];
  let lastFeed = null;

  const addEpisode = (ep) => {
    if (!state.added_guids.includes(ep.id)) state.added_guids.push(ep.id);
    queue.push(ep);
    lastFeed = ep.feed_url;
  };

  // ---------------------------
  // 1) Fetch all feeds once
  // ---------------------------
  const feedCache = {};
  for (const feedCfg of FEEDS) {
    feedCache[feedCfg.url] = await fetchFeedItems(feedCfg.url);
  }

  // Build a lookup for "feedUrl::entryId" -> episode object
  const episodeById = {};
  for (const feedCfg of FEEDS) {
    const entries = feedCache[feedCfg.url] || [];
    for (const e of entries) {
      const ep = makeEpisode(feedCfg, e);
      episodeById[ep.id] = ep;
    }
  }

  // ---------------------------
  // 2) Pools
  // ---------------------------
  const backcatalogPool = [];
  const highPriorityPool = [];
  const approvedOtherPool = []; // approved selectives + low_priority (equal priority)
  const backupPool = [];

  for (const feedCfg of FEEDS) {
    const entries = feedCache[feedCfg.url] || [];

    // BACKCATALOG: build from oldest -> newest, applying start_at once
    if (feedCfg.type === "backcatalog") {
      let processed = entries.slice().sort((a, b) => entryPubDate(a) - entryPubDate(b));
      if (feedCfg.start_at) processed = processed.slice(feedCfg.start_at);

      for (const e of processed) {
        const ep = makeEpisode(feedCfg, e);
        if (state.added_guids.includes(ep.id) || state.listened_guids.includes(ep.id)) continue;
        backcatalogPool.push(ep);
      }
      continue;
    }

    // HIGH PRIORITY: include all (newest-first later), but apply cutoff
    if (feedCfg.type === "high_priority") {
      for (const e of entries) {
        const ep = makeEpisode(feedCfg, e);
        if (state.added_guids.includes(ep.id) || state.listened_guids.includes(ep.id)) continue;

        const pub = new Date(ep.pubdate);
        if (pub >= PRIORITY_CUTOFF) highPriorityPool.push(ep);
      }
    }

    // LOW PRIORITY (if you add any later): treat as "approvedOtherPool" BUT cutoff applies
    if (feedCfg.type === "low_priority") {
      for (const e of entries) {
        const ep = makeEpisode(feedCfg, e);
        if (state.added_guids.includes(ep.id) || state.listened_guids.includes(ep.id)) continue;

        const pub = new Date(ep.pubdate);
        if (pub >= PRIORITY_CUTOFF) approvedOtherPool.push(ep);
      }
    }

    // BACKUP filler pool (optional): cutoff applies (matches your earlier intent)
    if (feedCfg.backup_pool) {
      for (const e of entries) {
        const ep = makeEpisode(feedCfg, e);
        if (state.added_guids.includes(ep.id) || state.listened_guids.includes(ep.id)) continue;

        const pub = new Date(ep.pubdate);
        if (pub >= PRIORITY_CUTOFF) backupPool.push(ep);
      }
    }
  }

  // APPROVED IDS: only these selectives get into "others"
  // (and they join low_priority at equal priority)
  for (const id of (approvedIds || [])) {
    const ep = episodeById[id];
    if (!ep) continue;
    if (state.added_guids.includes(ep.id) || state.listened_guids.includes(ep.id)) continue;

    // Only allow approved selectives + approved low_priority here
    // (high_priority should never come from approvals)
    const feedCfg = FEEDS.find(f => f.url === ep.feed_url);
    if (!feedCfg) continue;

    if (feedCfg.type === "selective" || feedCfg.type === "low_priority") {
      approvedOtherPool.push(ep);
    }
  }

  // ---------------------------
  // 3) Sort pools
  // ---------------------------
  // backcatalog oldest first
  backcatalogPool.sort((a, b) => a.pubdate.localeCompare(b.pubdate));

  // All priority types now oldest first
  highPriorityPool.sort((a, b) => a.pubdate.localeCompare(b.pubdate));
  selectivePool.sort((a, b) => a.pubdate.localeCompare(b.pubdate));
  backupPool.sort((a, b) => a.pubdate.localeCompare(b.pubdate));

  // ---------------------------
  // 4) Build queue: 2 backcatalog, 2 others repeating
  // ---------------------------
  const takeFromPoolNoAdj = (pool) => {
    if (!pool.length) return null;

    // enforce "no two from same podcast in a row" for OTHERS
    let pickIdx = pool.findIndex(ep => ep.feed_url !== lastFeed);
    if (pickIdx === -1) pickIdx = 0;

    const [ep] = pool.splice(pickIdx, 1);
    return ep;
  };

  while (queue.length < MAX_QUEUE_SIZE) {
    // --- 2x BACKCATALOG ---
    for (let i = 0; i < 2; i++) {
      if (queue.length >= MAX_QUEUE_SIZE) break;
      if (!backcatalogPool.length) break;

      // IMPORTANT: do NOT enforce adjacency here (you *want* 2 in a row)
      const ep = backcatalogPool.shift();
      addEpisode(ep);
    }

    if (queue.length >= MAX_QUEUE_SIZE) break;

    // --- 2x OTHERS ---
    for (let i = 0; i < 2; i++) {
      if (queue.length >= MAX_QUEUE_SIZE) break;

      let ep =
        takeFromPoolNoAdj(highPriorityPool) ||
        takeFromPoolNoAdj(approvedOtherPool) ||
        takeFromPoolNoAdj(backupPool);

      if (!ep) break;
      addEpisode(ep);
    }

    if (
      !backcatalogPool.length &&
      !highPriorityPool.length &&
      !approvedOtherPool.length &&
      !backupPool.length
    ) {
      break;
    }
  }

  return queue.slice(0, MAX_QUEUE_SIZE);
}


// ---------- RSS ----------
function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function generateRSS(queue) {
  const items = queue.map((ep) => `
    <item>
      <title>${escapeXml(ep.title)}</title>
      <guid>${escapeXml(ep.id)}</guid>
      <pubDate>${new Date(ep.pubdate).toUTCString()}</pubDate>
      <enclosure url="${escapeXml(ep.audio_url)}" type="audio/mpeg" />
    </item>
  `).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Custom Queue</title>
    <description>Algorithmic + curated podcast queue</description>
    ${items}
  </channel>
</rss>`;
}
