"use strict";

/* Le moteur OCR doit etre servi depuis le depot.

   Un appel a un CDN casserait le mode hors ligne de la PWA — `sw.js` declare
   deja les CDN en `network-only` — et introduirait une dependance reseau au
   moment precis ou le membre travaille. Ce test existe pour qu'une mise a jour
   du moteur ne reintroduise pas un CDN par megarde. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RACINE = path.resolve(__dirname, "..");
const DOSSIER = path.join(RACINE, "vendor", "tesseract");

/* Poids minimal attendu, en octets. Un fichier tronque par un telechargement
   interrompu passerait un simple test d'existence. */
const ATTENDUS = {
  "tesseract.esm.min.js":50 * 1024,
  "worker.min.js":10 * 1024,
  "tesseract-core-lstm.wasm.js":3 * 1024 * 1024,
  "fra.traineddata":512 * 1024
};

for(const [fichier, minimum] of Object.entries(ATTENDUS)){
  const chemin = path.join(DOSSIER, fichier);
  assert.ok(fs.existsSync(chemin),
    fichier + " doit etre verse dans vendor/tesseract/");
  assert.ok(fs.statSync(chemin).size >= minimum,
    fichier + " parait tronque (" + fs.statSync(chemin).size + " octets)");
}

/* Aucun des scripts ne doit pointer vers un hebergeur externe. */
const HOTES = ["unpkg.com", "cdn.jsdelivr.net", "jsdelivr.net",
  "tessdata.projectnaptha.com", "raw.githubusercontent.com"];
for(const fichier of ["tesseract.esm.min.js", "worker.min.js"]){
  const source = fs.readFileSync(path.join(DOSSIER, fichier), "utf8");
  for(const hote of HOTES){
    assert.ok(!source.includes(hote),
      fichier + " ne doit pas referencer " + hote);
  }
}

/* Le moteur est volontairement ABSENT de CORE_ASSETS : cinq megaoctets
   telecharges par chaque membre, dont la plupart n'importeront jamais de
   capture, couteraient plus qu'ils ne rapportent. Le gestionnaire `fetch` du
   service worker le met en cache le jour ou il est reellement demande. */
const sw = fs.readFileSync(path.join(RACINE, "sw.js"), "utf8");
const coreAssets = sw.slice(sw.indexOf("const CORE_ASSETS"),
  sw.indexOf("const CORE_PATHS"));
assert.ok(!coreAssets.includes("vendor/tesseract"),
  "vendor/tesseract ne doit pas etre precharge par le service worker");

console.log("vendor tesseract : OK");
