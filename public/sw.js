/* StockSignalPro Service Worker — Full Offline PWA Support */
const CACHE_NAME = "ssp-v2";
const STATIC_ASSETS = ["/", "/index.html", "/manifest.json"];

/* Install: pre-cache static shell */
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

/* Activate: clear old caches */
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* Fetch: network-first for API, cache-first for assets */
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  /* API calls: network first, fall back to last cached response */
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(e.request.clone())
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  /* Static assets: cache first */
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        if (res.ok) {
          caches.open(CACHE_NAME).then((c) => c.put(e.request, res.clone()));
        }
        return res;
      });
    })
  );
});

/* Push notifications from backend */
self.addEventListener("push", (e) => {
  const data = e.data?.json() || {};
  const title = data.title || "StockSignalPro Signal";
  const options = {
    body: data.body || "New signal available",
    icon: "/icon-192.png",
    badge: "/icon-96.png",
    data: { url: data.url || "/" },
    actions: [
      { action: "view", title: "View Signal" },
      { action: "dismiss", title: "Dismiss" },
    ],
    requireInteraction: data.score >= 85,
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

/* Notification click */
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  if (e.action === "view" || !e.action) {
    e.waitUntil(
      clients.matchAll({ type: "window" }).then((cs) => {
        const existing = cs.find((c) => c.url.includes(self.registration.scope));
        if (existing) return existing.focus();
        return clients.openWindow(e.notification.data?.url || "/");
      })
    );
  }
});
