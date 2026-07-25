/* Service worker — Confrérie 7DS (PWA #2)
   Objectif : chargement instantané + hors-ligne du builder, SANS figer la page
   (le bug de cache Safari qu'on a eu). Stratégie :
   - HTML (navigation) : network-first -> toujours frais en ligne, repli cache hors-ligne.
   - autres assets même origine : stale-while-revalidate.
   - Supabase et CDN supabase-js : network-only (jamais mis en cache).
   Bump CACHE à chaque déploiement significatif pour purger l'ancien cache. */
const CACHE = "conf7ds-v1";
const ASSETS = [
  "./", "./index.html",
  "./data.js", "./potentiels.js", "./armures-liees.js",
  "./personnages-meta.js", "./supabase-config.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS).catch(() => {}))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if(req.method !== "GET") return;
  let url;
  try{ url = new URL(req.url); }catch(e){ return; }

  // Ne jamais mettre en cache l'API partagée ni le client Supabase (données live).
  if(/supabase\.co$/.test(url.hostname) || /jsdelivr\.net$/.test(url.hostname)) return;

  // Uniquement notre propre origine.
  if(url.origin !== location.origin) return;

  const isDoc = req.mode === "navigate" ||
    url.pathname.endsWith("/") || url.pathname.endsWith("index.html");

  if(isDoc){
    // network-first : fraîcheur en ligne, repli hors-ligne
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put("./index.html", copy));
        return res;
      }).catch(() => caches.match("./index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  // stale-while-revalidate pour les assets
  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(req);
      const network = fetch(req).then(res => {
        if(res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
