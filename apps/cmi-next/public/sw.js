// Minimal service worker for CMI PWA installability.
// Deliberately conservative: it only intercepts same-origin GET requests and is
// network-first, so it never serves stale dashboard data or interferes with auth
// cookies, API POSTs, or streaming. Its presence + a fetch handler is what makes
// the app installable; offline falls back to the browser cache when available.
const CACHE = "cmi-runtime-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// ── Web Push ────────────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Constructed Matter", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Constructed Matter";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || undefined,
    data: { url: data.url || "/dashboard" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        // Focus an existing tab if one is already open.
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try { await client.navigate(url); } catch { /* cross-origin or blocked */ }
          }
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(url);
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache API responses — they are user/session specific.
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        // Cache successful static/page GETs for offline fallback.
        if (response.ok && (request.mode === "navigate" || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/brand/"))) {
          const cache = await caches.open(CACHE);
          cache.put(request, response.clone());
        }
        return response;
      } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        return Response.error();
      }
    })(),
  );
});
