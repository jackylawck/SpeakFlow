if (isHtml) {
    // HTML 入口（index.html / dual.html）採 Network-First，斷網時回退快取或友善離線提示頁
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
  }
