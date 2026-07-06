/* Service worker minimal pour rendre l'appli installable (PWA).
   Réseau d'abord (pas de cache agressif) pour toujours servir la dernière
   version ; repli sur le cache seulement si hors-ligne. */
const CACHE = "dimaprono-v1";
const SHELL = ["/", "/index.html", "/assets/styles.css", "/assets/app.js", "/assets/logo.svg", "/manifest.json"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;                    // jamais l'API (POST) ni le reste
  if (req.url.includes("/api/")) return;               // /api toujours en direct
  e.respondWith(
    fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy).catch(() => {}));
      return res;
    }).catch(() => caches.match(req))                  // hors-ligne -> cache
  );
});
