const CACHE_VERSION = "speakflow-v2.1.1";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./dual.html",
  "./styles.css",
  "./app-solo.js",
  "./app-dual.js",
  "./manifest-solo.json",
  "./manifest-dual.json",
  "./SpeakFlow192icon.png",
  "./SpeakFlow512icon.png",
  "./shared/i18n.js",
  "./shared/segmenter.js",
  "./shared/pacing.js",
  "./shared/vad.js",
  "./shared/scroll-engine.js",
  "./shared/storage.js",
  "./shared/prompter-core.js",
  "./shared/easter-egg.js",
  "./dual/qr-svg.js",
  "./vendor/peerjs.esm.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  // 跨網域信令連線（如 PeerJS）直接交由網路處理，不經快取攔截
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => {
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
          return new Response("Offline", { status: 503, statusText: "Offline" });
        });
    })
  );
});
