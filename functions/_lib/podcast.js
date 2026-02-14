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
    url: "https://www.outsideonline.com/rss/all/rss.xml",
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
  let queue = existingQueue.slice();
  let lastSpacerFeed = null;

  const addEpisode = (ep) => {
    if (!state.added_guids.includes(ep.id)) state.added_guids.push(ep.id);
    queue.push(ep);
    lastSpacerFeed = ep.feed_url;
  };

  // 1) Approved selective + backup (ids are feedUrl::entryId)
  const allEntriesById = {};

  // Fetch each feed once; build lookup map
  for (const feedCfg of FEEDS) {
    const entries = await fetchFeedItems(feedCfg.url);
    for (const e of entries) {
      const id = `${feedCfg.url}::${e.id}`;
      allEntriesById[id] = { feedCfg, entry: e };
    }
  }

  for (const id of approvedIds) {
    const hit = allEntriesById[id];
    if (!hit) continue;
    addEpisode(makeEpisode(hit.feedCfg, hit.entry));
  }

  async function nextBackcatalog() {
    const eps = [];
    for (const feedCfg of FEEDS) {
      if (feedCfg.type !== "backcatalog") continue;

      let entries = await fetchFeedItems(feedCfg.url);

      // sort oldest -> newest
      entries.sort((a, b) => entryPubDate(a) - entryPubDate(b));

      if (feedCfg.start_at) entries = entries.slice(feedCfg.start_at);

      let count = 0;
      for (const e of entries) {
        const id = `${feedCfg.url}::${e.id}`;
        if (state.added_guids.includes(id) || state.listened_guids.includes(id)) continue;
        eps.push(makeEpisode(feedCfg, e));
        count++;
        if (count >= (feedCfg.batch_size || 2)) break;
      }
    }
    return eps;
  }

  async function nextFromType(feedType) {
    const eps = [];
    for (const feedCfg of FEEDS) {
      if (feedCfg.type !== feedType) continue;

      const entries = await fetchFeedItems(feedCfg.url);
      entries.sort((a, b) => entryPubDate(b) - entryPubDate(a)); // newest first

      for (const e of entries) {
        const id = `${feedCfg.url}::${e.id}`;
        if (state.added_guids.includes(id) || state.listened_guids.includes(id)) continue;
        eps.push(makeEpisode(feedCfg, e));
        break;
      }
    }
    return eps;
  }

  function addSpacer(candidates) {
    if (!candidates.length) return false;

    for (const ep of candidates) {
      if (ep.feed_url !== lastSpacerFeed) {
        addEpisode(ep);
        return true;
      }
    }
    addEpisode(candidates[0]);
    return true;
  }

  while (queue.length < MAX_QUEUE_SIZE) {
    let addedAny = false;

    const back = await nextBackcatalog();
    for (const ep of back) {
      if (queue.length >= MAX_QUEUE_SIZE) break;
      addEpisode(ep);
      addedAny = true;
    }
    if (queue.length >= MAX_QUEUE_SIZE) break;

    const hp = await nextFromType("high_priority");
    if (addSpacer(hp)) addedAny = true;
    if (queue.length >= MAX_QUEUE_SIZE) break;

    const lp = await nextFromType("low_priority");
    if (addSpacer(lp)) addedAny = true;

    if (!addedAny) break;
  }

  return queue;
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
