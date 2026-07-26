const JOB_KEY = "drein-coles-cart-job";
const COLES_HOME = "https://www.coles.com.au/";

function getJob() {
  return chrome.storage.local.get(JOB_KEY).then((stored) => stored[JOB_KEY] || null);
}

function putJob(job) {
  return chrome.storage.local.set({ [JOB_KEY]: job });
}

function sendToGrocery(job, type, extra = {}) {
  if (!job.sourceTabId) return;
  chrome.tabs.sendMessage(job.sourceTabId, {
    type,
    jobId: job.id,
    ...extra
  }).catch(() => {});
}

function currentItem(job) {
  return job.items[job.currentIndex] || null;
}

async function finishJob(job) {
  job.status = "complete";
  await putJob(job);
  sendToGrocery(job, "coles-cart-complete", { results: job.results });
  await chrome.tabs.update(job.colesTabId, { url: COLES_HOME }).catch(() => {});
}

async function moveToCurrentProduct(job) {
  const item = currentItem(job);
  if (!item) {
    await finishJob(job);
    return;
  }
  await putJob(job);
  await chrome.tabs.update(job.colesTabId, { url: item.url });
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
        id: crypto.randomUUID(),
        status: "awaiting-login",
        sourceTabId: sender.tab.id,
        colesTabId: tab.id,
        currentIndex: 0,
        items,
        results: []
      };
      await putJob(job);
      sendToGrocery(job, "coles-cart-ready");
      sendResponse({ ok: true, jobId: job.id });
    }).catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "coles-page-ready" && sender.tab?.id) {
    getJob().then((job) => {
      if (!job || job.colesTabId !== sender.tab.id || job.status === "complete") return;
      if (job.status === "awaiting-login") {
        chrome.tabs.sendMessage(sender.tab.id, { type: "coles-awaiting-login" }).catch(() => {});
      } else if (job.status === "running") {
        const item = currentItem(job);
        if (item) chrome.tabs.sendMessage(sender.tab.id, { type: "coles-add-current", item }).catch(() => {});
      }
    });
    return;
  }

  if (message?.type === "coles-start" && sender.tab?.id) {
    getJob().then(async (job) => {
      if (!job || job.colesTabId !== sender.tab.id || job.status !== "awaiting-login") return;
      job.status = "running";
      await moveToCurrentProduct(job);
    });
    return;
  }

  if (message?.type === "coles-product-result" && sender.tab?.id) {
    getJob().then(async (job) => {
      if (!job || job.colesTabId !== sender.tab.id || job.status !== "running") return;
      const item = currentItem(job);
      if (!item || message.url !== item.url) return;
      job.results.push({
        shoppingKey: item.shoppingKey,
        name: item.name,
        url: item.url,
        ok: Boolean(message.ok),
        error: message.error || ""
      });
      job.currentIndex += 1;
      await moveToCurrentProduct(job);
    });
  }
});
