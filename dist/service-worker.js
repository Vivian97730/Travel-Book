const CACHE_NAME = "travel-book-prototype-v9";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=20261113a",
  "./app.js?v=20261113b",
  "./manifest.webmanifest",
  "./assets/hero-winter-pine.jpg",
  "./icons/app-icon-192.png",
  "./icons/app-icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => Promise.all([
            cache.put("./", copy.clone()),
            cache.put("./index.html", copy),
          ]));
          return response;
        })
        .catch(() => caches.match("./index.html").then((cached) => cached || caches.match("./"))),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    }))
  );
});
