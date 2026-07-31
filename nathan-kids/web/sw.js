// NATHAN KIDS — Service Worker : coquille hors-ligne (app shell)
// Stratégie : RÉSEAU D'ABORD (network-first) pour les fichiers de l'app →
// quand il y a internet, l'utilisateur reçoit TOUJOURS la dernière version
// déployée (fini le cache figé). Hors ligne, on sert la dernière copie mise en
// cache. Les appels API (Supabase) ne sont jamais interceptés (données gérées
// par l'outbox côté app). Voir js/api.js.
const CACHE = "nk-shell-v6";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./js/api.js",
  "./js/barcode.js",
  "./js/export.js",
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
  // Fichiers de l'app : RÉSEAU D'ABORD (met à jour le cache au passage),
  // repli sur le cache si hors ligne, puis sur index.html en dernier recours.
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html"))),
  );
});
