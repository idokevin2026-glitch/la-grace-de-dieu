// NATHAN KIDS — Service Worker : coquille hors-ligne (app shell)
// Stratégie : cache-first pour les fichiers statiques de l'app ; le RÉSEAU
// n'est jamais mis en cache pour les appels API (données = toujours frais /
// gérés par l'outbox côté app). Voir js/api.js.
const CACHE = "nk-shell-v1";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./js/api.js",
  "./js/app.js",
  "./config.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      // addAll échoue si un fichier manque (ex. config.js absent) → on tolère.
      Promise.allSettled(SHELL.map((u) => c.add(u))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return; // écritures : jamais interceptées
  const url = new URL(req.url);
  // Appels API (Supabase) : réseau direct, pas de cache.
  if (/supabase\.co|\/rest\/v1\/|\/functions\/v1\//.test(url.href)) return;
  // Statique : cache d'abord, repli réseau (et mise en cache au passage).
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          })
          .catch(() => caches.match("./index.html")),
    ),
  );
});
