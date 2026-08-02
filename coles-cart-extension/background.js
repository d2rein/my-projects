const JOB_KEY = "drein-coles-cart-job";
const COLES_HOME = "https://www.coles.com.au/";
const PRELOAD_COUNT = 2;

function getJob() {
  return chrome.storage.local.get(JOB_KEY).then((stored) => stored[JOB_KEY] || null);
}

function putJob(job) {
  return chrome.storage.local.set({ [JOB_KEY]: job });
}

function sendToGrocery(job, type, extra = {}) {
  if (!job.sourceTabId) return;
  chrome.tabs.sendMessage(job.sourceTabId, { type, jobId: job.id, ...extra }).catch(() => {});
}

function currentItem(job) {
  return job.items[job.currentIndex] || null;
}

function itemProgress(job, shoppingKey) {
  return {
    completed: job.results.filter((result) => result.shoppingKey === shoppingKey).length,
    total: job.items.filter((item) => item.shoppingKey === shoppingKey).length
  };
}

async function showCurrentItem(job) {
  const item = currentItem(job);
  if (!item) return finishJob(job);
  await putJob(job);
  chrome.tabs.sendMessage(job.colesTabId, {
    type: "coles-guided-current",
    item,
    currentIndex: job.currentIndex,
    total: job.items.length
  }).catch(() => {});
}

async function preloadUpcomingItems(job) {
  job.preloadTabs = Array.isArray(job.preloadTabs) ? job.preloadTabs : [];
  job.preloadTabs = job.preloadTabs.filter((entry) => entry && entry.url && entry.tabId);
  const knownUrls = new Set([currentItem(job)?.url, ...job.preloadTabs.map((entry) => entry.url)]);
  for (let offset = 1; job.preloadTabs.length < PRELOAD_COUNT; offset += 1) {
    const item = job.items[job.currentIndex + offset];
    if (!item) break;
    if (knownUrls.has(item.url)) continue;
    const tab = await chrome.tabs.create({ url: item.url, active: false });
    job.preloadTabs.push({ tabId: tab.id, url: item.url });
    knownUrls.add(item.url);
  }
  await putJob(job);
}

async function moveToCurrentProduct(job) {
  const item = currentItem(job);
  if (!item) return finishJob(job);

  const preloaded = (job.preloadTabs || []).find((entry) => entry.url === item.url);
  if (preloaded) {
    const previousTabId = job.colesTabId;
    job.colesTabId = preloaded.tabId;
    job.preloadTabs = job.preloadTabs.filter((entry) => entry.tabId !== preloaded.tabId);
    await chrome.tabs.update(job.colesTabId, { active: true });
    if (previousTabId && previousTabId !== job.colesTabId) chrome.tabs.remove(previousTabId).catch(() => {});
  } else {
    await chrome.tabs.update(job.colesTabId, { url: item.url, active: true });
  }
  await preloadUpcomingItems(job);
  await showCurrentItem(job);
}

async function finishJob(job) {
  job.status = "complete";
  await putJob(job);
  sendToGrocery(job, "coles-cart-complete", { results: job.results });
  for (const preload of job.preloadTabs || []) chrome.tabs.remove(preload.tabId).catch(() => {});
  job.preloadTabs = [];
  await putJob(job);
}

async function recordCurrentResult(job, message) {
  const item = currentItem(job);
  if (!item) return;
  const result = {
    shoppingKey: item.shoppingKey,
    name: item.name,
    url: item.url,
    quantity: item.quantity,
    ok: Boolean(message.ok),
    error: message.error || "",
    price: Number.isFinite(message.price) ? message.price : null,
    priceText: message.priceText || "",
    observedAt: new Date().toISOString()
  };
  job.results.push(result);
  job.currentIndex += 1;
  const progress = itemProgress(job, item.shoppingKey);
  await putJob(job);
  sendToGrocery(job, "coles-cart-progress", {
    result,
    shoppingKeyComplete: result.ok && progress.completed === progress.total,
    shoppingKeyProgress: progress,
    currentIndex: job.currentIndex,
    total: job.items.length
  });
  await moveToCurrentProduct(job);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "coles-cart-request") {
    const items = Array.isArray(message.items) ? message.items.filter((item) => item?.url && item?.shoppingKey) : [];
    if (!items.length || !sender.tab?.id) {
      sendResponse({ ok: false, error: "No mapped Coles products were supplied." });
      return;
    }
    chrome.tabs.create({ url: COLES_HOME, active: true }).then(async (tab) => {
      const job = {
        id: crypto.randomUUID(), status: "awaiting-login", sourceTabId: sender.tab.id,
        colesTabId: tab.id, currentIndex: 0, items, results: [], preloadTabs: []
      };
      await putJob(job);
      sendToGrocery(job, "coles-cart-ready", { total: items.length });
      sendResponse({ ok: true, jobId: job.id });
    }).catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "coles-page-ready" && sender.tab?.id) {
    getJob().then((job) => {
      if (!job || job.colesTabId !== sender.tab.id || job.status === "complete") return;
      if (job.status === "awaiting-login") {
        chrome.tabs.sendMessage(sender.tab.id, { type: "coles-awaiting-login" }).catch(() => {});
      } else if (job.status === "guided") {
        showCurrentItem(job);
      }
    });
    return;
  }

  if (message?.type === "coles-start-guided" && sender.tab?.id) {
    getJob().then(async (job) => {
      if (!job || job.colesTabId !== sender.tab.id || job.status !== "awaiting-login") return;
      job.status = "guided";
      await moveToCurrentProduct(job);
    });
    return;
  }

  if ((message?.type === "coles-guided-next" || message?.type === "coles-guided-skip") && sender.tab?.id) {
    getJob().then(async (job) => {
      if (!job || job.colesTabId !== sender.tab.id || job.status !== "guided") return;
      await recordCurrentResult(job, {
        ok: message.type === "coles-guided-next",
        error: message.type === "coles-guided-skip" ? "Skipped by shopper." : "",
        price: message.price,
        priceText: message.priceText
      });
    });
  }
});
