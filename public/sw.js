// Only the application shell is cached here. Business data remains in IndexedDB.
const CACHE = "digital-invoice-shell-v2";
const cacheable = (url) => url.origin === self.location.origin && url.pathname.startsWith("/assets/");
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const visited = new Set();
    async function store(url) {
      if (visited.has(url)) return;
      visited.add(url);
      const response = await fetch(url, { cache: "reload" });
      if (!response.ok) throw new Error("Shell asset unavailable");
      await cache.put(url, response.clone());
      if (!/\.(woff2?|png|svg)$/.test(new URL(url).pathname)) {
        const source = await response.text();
        const resources = [...source.matchAll(/["'(]([^"'()\s]+\.(?:js|css|woff2?))["')]/g)];
        await Promise.all(resources.map(async ([, path]) => {
          const asset = new URL(path.startsWith("assets/") ? "/" + path : path, url);
          if (cacheable(asset)) await store(asset.href);
        }));
      }
    }
    await store(new URL("/index.html", self.location.origin).href);
    await cache.addAll(["/qaansheeg-mark.svg", "/qaansheeg-mono.svg"]);
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", (event) => event.waitUntil((async () => {
  for (const key of await caches.keys()) {
    if (key.startsWith("digital-invoice-shell-") && key !== CACHE) await caches.delete(key);
  }
  await self.clients.claim();
})()));
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/index.html")));
  } else if (cacheable(url) || url.pathname.endsWith(".svg")) {
    event.respondWith(caches.match(event.request, { ignoreVary: true }).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(event.request, copy)); }
      return response;
    })));
  }
});
