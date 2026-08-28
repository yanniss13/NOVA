"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");

// 1) index.html référence le manifest, le thème et l'icône Apple + enregistre le SW.
const html = read("index.html");
assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/, "lien manifest manquant");
assert.match(html, /<meta name="theme-color" content="#0e0d12">/, "theme-color manquant");
assert.match(html, /<link rel="apple-touch-icon" href="icons\/apple-touch-icon-180\.png">/, "apple-touch-icon manquant");
assert.match(html, /navigator\.serviceWorker\.register\("sw\.js"\)/, "enregistrement du SW manquant");
assert.doesNotMatch(
  html,
  /<script src="data\/stats-build\.js"><\/script>/,
  "le catalogue chiffré ne doit plus bloquer le premier affichage"
);
assert.doesNotMatch(
  html,
  /<script src="data\/effets-dps\.js"><\/script>/,
  "le catalogue d'effets DPS pèse 1,3 Mo : la fiche de héros l'injecte"
    + " à la demande"
);

// 2) manifest.webmanifest est un JSON valide avec les champs requis + icônes.
const manifest = JSON.parse(read("manifest.webmanifest"));
assert.equal(manifest.display, "standalone");
assert.ok(manifest.name && manifest.short_name, "name/short_name requis");
assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2, "icônes requises");
assert.ok(manifest.icons.some(i => i.sizes === "512x512"), "icône 512 requise");
assert.ok(manifest.icons.some(i => i.purpose === "maskable"), "icône maskable requise");
manifest.icons.forEach(icon => {
  assert.ok(fs.existsSync(path.join(ROOT, icon.src)), "icône absente sur disque : " + icon.src);
});
assert.ok(fs.existsSync(path.join(ROOT, "icons/apple-touch-icon-180.png")), "apple-touch-icon absent");

// 3) sw.js : cache versionné par le commit déployé, mise à jour explicite,
//    et jamais de cache pour Supabase / le CDN (données live).
const sw = read("sw.js");
assert.match(
  sw,
  /const BUILD_VERSION = "__BUILD_VERSION__";/,
  "marqueur de version de déploiement requis"
);
assert.match(
  sw,
  /const CACHE = CACHE_PREFIX \+ BUILD_VERSION;/,
  "le cache doit dépendre du commit déployé"
);
assert.doesNotMatch(
  sw.match(/self\.addEventListener\("install"[\s\S]*?\n\}\);/)?.[0] || "",
  /skipWaiting/,
  "une mise à jour ne doit pas s'activer sans accord"
);
assert.match(sw, /event\.data\.type === "SKIP_WAITING"/);
assert.match(sw, /CORE_PATHS/);
assert.match(sw, /isImage/);
assert.match(sw, /networkFirst/);
assert.match(sw, /staleWhileRevalidate/);
assert.match(sw, /supabase\\.co/, "exclusion Supabase requise");
assert.match(sw, /jsdelivr\\.net/, "exclusion CDN requise");
assert.match(sw, /caches\.keys\(\)/, "purge des anciens caches requise (activate)");
assert.match(sw, /CACHE_BUILD_STATS/, "mise en cache à la première utilisation requise");
assert.doesNotMatch(
  sw,
  /7ds-stats\/.*\.json/,
  "les JSON de référence ne doivent jamais être précachés"
);

const coreAssetsSource = sw.match(
  /const CORE_ASSETS = \[([\s\S]*?)\];/
)?.[1];
assert.ok(coreAssetsSource, "la liste CORE_ASSETS doit rester extractible");
assert.doesNotMatch(
  coreAssetsSource,
  /["']\.\/data\/stats-build\.js["']/,
  "le catalogue chiffré lourd ne doit pas faire partie du précache essentiel"
);
assert.doesNotMatch(
  coreAssetsSource,
  /["']\.\/data\/effets-dps\.js["']/,
  "le catalogue d'effets DPS non plus : il doublerait le poids installé"
);
/* Les modules, eux, sont légers et indispensables dès la première fiche
   ouverte hors ligne. */
assert.match(coreAssetsSource, /["']\.\/js\/metier\/dps-effets\.js["']/);
assert.match(coreAssetsSource, /["']\.\/js\/metier\/dps-simulation\.js["']/);
const coreAssets = [...coreAssetsSource.matchAll(/["']([^"']+)["']/g)]
  .map(match => match[1]);
assert.ok(coreAssets.length > 0, "CORE_ASSETS ne doit pas être vide");
coreAssets.forEach(asset => {
  assert.ok(
    asset.startsWith("./"),
    "une ressource essentielle doit être un chemin local : " + asset
  );
  const relative = asset === "./" ? "." : asset.slice(2);
  assert.ok(
    fs.existsSync(path.join(ROOT, relative)),
    "ressource essentielle absente sur disque : " + asset
  );
});

/* 4) La cle de cache d'un document.

   `networkFirst(request, fallbackKey)` fait `cache.put(fallbackKey || request)`.
   Tant que TOUTE navigation partait avec "./index.html", ouvrir une seconde page
   servie a la racine — akumu.html — rangeait son HTML sous la cle de
   l'application : le membre revenu hors ligne recevait la fiche a la place du
   site. La decision est donc isolee dans une fonction pure, testee ici. */
const cleSource = sw.match(
  /function documentCacheKey\(([\s\S]*?)\n\}/
)?.[0];
assert.ok(cleSource, "documentCacheKey doit rester extractible de sw.js");
const documentCacheKey = new Function(
  cleSource + "; return documentCacheKey;"
)();

const cle = (chemin, mode) => documentCacheKey(new URL("https://x.dev" + chemin), mode);

assert.equal(cle("/NOVA/", "navigate"), "./index.html",
  "la racine reste l'application");
assert.equal(cle("/NOVA/index.html", "navigate"), "./index.html",
  "index.html aussi");
assert.equal(cle("/NOVA/akumu.html", "navigate"), null,
  "une autre page servie a la racine doit se cacher sous SA propre cle,"
  + " sinon elle remplace l'application hors ligne");
assert.equal(cle("/NOVA/css/base.css", "no-cors"), undefined,
  "une ressource n'est pas un document");

console.log("PASS PWA : manifest, icônes, cycle de mise à jour explicite du service worker");
