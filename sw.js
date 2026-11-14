// 發佈紀律：每次修改前端檔案後必須遞增 CACHE_VERSION，
// 以觸發 activate 事件清理舊版快取並釋放瀏覽器儲存配額。
const CACHE_VERSION = "speakflow-v2.0.0";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app-solo.js",
  "./shared/i18n.js",
  "./shared/segmenter.js",
  "./shared/pacing.js",
  "./shared/vad.js",
  "./shared/scroll-engine.js",
  "./shared/storage.js",
  "./shared/prompter-core.js",
  "./manifest-solo.json",
  "./icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      await Promise.allSettled(
        CORE_ASSETS.map((url) =>
          cache.add(url).catch((err) => console.warn("[SW] Core cache miss:", url, err))
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isHtml =
    event.request.mode === "navigate" ||
    event.request.headers.get("accept")?.includes("text/html");

  if (isHtml) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          return new Response(
            `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline | 順住講 SpeakFlow</title></head>
             <body style="background:#000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'PingFang TC',sans-serif;padding:2.5rem 1.5rem;text-align:center;line-height:1.6">
             <h1>🎙️ 順住講 SpeakFlow</h1>
             <p>此頁面尚未離線快取，請連接網路後重新整理。</p>
             <p style="color:#9ca3af;font-size:0.9rem">This page has not been cached yet. Please reconnect and reload.</p>
             </body></html>`,
            { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
          );
        })
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const networkFetch = fetch(event.request)
          .then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
            }
            return res;
          })
          .catch(() => cached);

        return cached || networkFetch;
      })
    );
  }
});
