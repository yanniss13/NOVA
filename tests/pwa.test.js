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

// 3) sw.js : ne met JAMAIS en cache Supabase / le CDN (données live) et gère un cache versionné.
const sw = read("sw.js");
assert.match(sw, /const CACHE = "conf7ds-v\d+";/, "cache versionné requis");
assert.match(sw, /supabase\\.co/, "exclusion Supabase requise");
assert.match(sw, /jsdelivr\\.net/, "exclusion CDN requise");
assert.match(sw, /caches\.keys\(\)/, "purge des anciens caches requise (activate)");

console.log("PASS PWA : manifest, icônes, service worker");
