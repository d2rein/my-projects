const CACHE_NAME = "jefferson-grug-2024-v7";
const ASSETS = [
  "./",
  "./spells.html",
  "./manifest.webmanifest",
  "./alaric-headshot.png",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  const wantsFreshAppShell =
    event.request.mode === "navigate" ||
    event.request.destination === "script" ||
    event.request.destination === "style" ||
    event.request.destination === "worker" ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".json") ||
    url.pathname.endsWith(".webmanifest");

  if (wantsFreshAppShell) {
    const reloadRequest = new Request(event.request, { cache: "reload" });
    event.respondWith(
      fetch(reloadRequest)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(match => match || (event.request.mode === "navigate" ? caches.match("./index.html") : Promise.reject(new Error("offline")))))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
