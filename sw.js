/* Service worker — Confrérie 7DS (PWA #3)
   Objectif : builder utilisable hors ligne, sans jamais figer la page ni activer
   une nouvelle version dans le dos du membre. En ligne, les fichiers applicatifs
   sont volontairement relus sur le réseau : c'est ce qui évite de mélanger un
   nouveau document avec d'anciens scripts. Stratégie :
   - navigation : network-first -> toujours frais en ligne, repli cache hors-ligne.
   - fichiers applicatifs (CORE_PATHS) : network-first, pour ne jamais mélanger un
     nouveau document avec d'anciens scripts.
   - images locales : stale-while-revalidate (noms stables, sans logique JS).
   - Supabase et CDN supabase-js : network-only (jamais mis en cache).
   La version du cache vient du commit déployé : `__BUILD_VERSION__` est remplacé
   par le SHA dans la copie publiée par l'Action GitHub Pages. Le fichier source
   du dépôt garde le marqueur littéral — ne pas le remplacer à la main.
   Une nouvelle version reste en attente jusqu'au message `SKIP_WAITING` envoyé
   par le bandeau de mise à jour d'index.html. */
const BUILD_VERSION = "__BUILD_VERSION__";
const CACHE_PREFIX = "conf7ds-";
const CACHE = CACHE_PREFIX + BUILD_VERSION;
/* Seule la petite icône est préchargée. La 512 (350 Ko) ne sert qu'à
   l'installation sur l'écran d'accueil : la faire télécharger par chaque membre
   au premier chargement coûtait plus qu'elle ne rapportait. Le gestionnaire
   `fetch` la met en cache le jour où elle est réellement demandée. */
const CORE_ASSETS = [
  "./", "./index.html",
  "./data.js", "./stats-build.js", "./potentiels.js", "./armures-liees.js",
  "./personnages-meta.js", "./supabase-config.js",
  "./js/constantes.js", "./js/session.js", "./js/supabase-client.js", "./js/dom.js", "./js/equipement.js", "./js/roster-profils.js", "./js/toast.js", "./js/dispos-logique.js", "./js/modal-stack.js", "./js/picker.js", "./js/boss-logique.js",
  "./js/boss-store.js", "./js/app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png"
];
const CORE_PATHS = new Set(
  CORE_ASSETS.map(asset => new URL(asset, self.registration.scope).pathname)
);

/* Mise en cache fichier par fichier : `addAll` est atomique, donc un seul 404
   laisserait un cache VIDE — et le mode hors ligne avec lui, puisque le cache
   change désormais à chaque commit. */
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(CORE_ASSETS.map(asset => cache.add(asset)))
    )
  );
});

/* Activation choisie par le membre : le bandeau d'index.html est le seul
   déclencheur. Aucun autre message ne doit court-circuiter l'attente. */
self.addEventListener("message", event => {
  if(event.data && event.data.type === "SKIP_WAITING"){
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

/* Fraîcheur d'abord, cache en secours. `fallbackKey` sert au document : la
   réponse est stockée sous une clé stable plutôt que sous l'URL navigée.
   L'écriture en cache reste HORS du chemin de réponse : un `put` refusé (206,
   `Vary: *`, quota) ne doit jamais transformer un succès réseau en erreur. */
async function networkFirst(request, fallbackKey){
  const cache = await caches.open(CACHE);
  try{
    const response = await fetch(request);
    if(response && response.ok && !response.redirected){
      cache.put(fallbackKey || request, response.clone()).catch(() => {});
    }
    return response;
  }catch(error){
    const cached = await cache.match(request);
    if(cached) return cached;
    if(fallbackKey){
      const fallback = await cache.match(fallbackKey);
      if(fallback) return fallback;
    }
    return Response.error();
  }
}

/* Cache d'abord, sans aller-retour réseau. Réservé aux fichiers dont la
   fraîcheur est déjà garantie par le nom du cache : celui-ci contient le SHA du
   commit déployé et les caches des versions précédentes sont supprimés à
   l'activation. Une entrée trouvée ici appartient donc forcément à la version
   courante — la revalider coûterait un téléchargement pour rien. */
async function cacheFirst(request){
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if(cached) return cached;
  try{
    const response = await fetch(request);
    if(response && response.ok && !response.redirected){
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  }catch(error){
    return Response.error();
  }
}

/* Réponse immédiate depuis le cache, rafraîchissement en arrière-plan. */
function staleWhileRevalidate(event, request){
  const cachePromise = caches.open(CACHE);
  const network = fetch(request).then(response => {
    if(response && response.ok){
      const copy = response.clone();
      cachePromise.then(cache => cache.put(request, copy)).catch(() => {});
    }
    return response;
  });
  event.waitUntil(network.catch(() => {}));
  return (async () => {
    const cache = await cachePromise;
    const cached = await cache.match(request);
    if(cached) return cached;
    try{ return await network; }
    catch(error){ return Response.error(); }
  })();
}

function isImage(request, url){
  return request.destination === "image" ||
    /\.(webp|png|jpg|jpeg|gif|svg|ico)$/i.test(url.pathname);
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if(request.method !== "GET") return;
  let url;
  try{ url = new URL(request.url); }catch(error){ return; }

  // Ne jamais mettre en cache l'API partagée ni le client Supabase (données live).
  if(/supabase\.co$/.test(url.hostname) || /jsdelivr\.net$/.test(url.hostname)) return;

  // Uniquement notre propre origine.
  if(url.origin !== location.origin) return;

  const isDoc = request.mode === "navigate" ||
    url.pathname.endsWith("/") || url.pathname.endsWith("index.html");
  if(isDoc){
    event.respondWith(networkFirst(request, "./index.html"));
    return;
  }

  // Le document reste en `networkFirst` au-dessus : c'est lui qui fait découvrir
  // un nouveau déploiement. Les fichiers versionnés, eux, sont servis depuis le
  // cache sans requête : mesuré à 2,3 Mo retéléchargés inutilement par visite.
  if(CORE_PATHS.has(url.pathname)){
    event.respondWith(cacheFirst(request));
    return;
  }

  if(isImage(request, url)){
    event.respondWith(staleWhileRevalidate(event, request));
    return;
  }

  event.respondWith(networkFirst(request));
});
