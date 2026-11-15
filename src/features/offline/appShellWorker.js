/* __APP_SHELL_CONFIG__ */

const scope = new URL(self.registration.scope);
const urls = assets.map((asset) => new URL(asset, scope).href);
const shell = new URL("index.html", scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll(urls.map((url) => new Request(url, { cache: "reload" })));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    await Promise.all((await caches.keys()).filter((key) => key.startsWith(cachePrefix) && key !== cacheName)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.headers.has("authorization")) return;
  const url = new URL(request.url);
  if (request.mode === "navigate" && url.origin === scope.origin
    && (url.pathname === scope.pathname || url.pathname === new URL(shell).pathname)) {
    event.respondWith(fetch(request).catch(async () => (await (await caches.open(cacheName)).match(shell)) ?? Response.error()));
  } else if (urls.includes(request.url)) {
    event.respondWith((async () => (await (await caches.open(cacheName)).match(request)) ?? fetch(request))());
  }
});
