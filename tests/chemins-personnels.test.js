"use strict";

/* AUCUN CHEMIN DE DOSSIER PERSONNEL DANS LE DEPOT.

   Ce depot est public. Trente outils de fabrication ecrivaient en dur le
   chemin du poste du proprietaire — dossier utilisateur, bureau, et meme un
   dossier temporaire de session — pour trouver la racine du depot. Un audit
   qui ne lisait que les lignes ajoutees par une branche ne les a pas vus :
   ils dataient d'avant elle.

   Ce garde lit TOUS les fichiers suivis (`git ls-files`), pas un diff, et
   refuse un chemin absolu vers un dossier utilisateur, Windows ou Unix. Un
   outil trouve la racine par son propre emplacement (`__dirname`), les
   donnees du jeu par `DONNEES_JEU`, un fichier de travail par un argument ou
   une variable d'environnement.

   Un exemple de documentation qui montre un GABARIT — `<nom>`, `{nom}`,
   `%USERNAME%`, `$HOME` — reste permis : il ne designe le poste de personne.
   `vendor/` est du code tiers repris tel quel (Emscripten y pose un
   `HOME` fictif pour son systeme de fichiers virtuel), il n'est pas scanne. */

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const RACINE = path.resolve(__dirname, "..");

const EXCLUS = [/^vendor\//];
const BINAIRES = /\.(png|webp|jpe?g|gif|ico|wasm|ttf|otf|woff2?|pdf|zip|gz|mp3|mp4|webm|traineddata)$/i;

/* Separateur : une ou deux barres, obliques ou inverses (echappees en JSON).
   Le segment qui suit « Users » / « home » est le nom d'un compte ; un gabarit
   commence par <, {, %, $ ou ~ et ne compte pas. */
const SEP = "[\\\\/]{1,2}";
const COMPTE = "(?![<{%$~])[^\\\\/\\s'\"`<>{}]+";
const MOTIFS = [
  new RegExp("\\b[A-Za-z]:" + SEP + "(?:Users|Documents and Settings)" + SEP + COMPTE, "i"),
  new RegExp("(?:^|[\\s'\"`(=:,\\[])" + "/(?:home|Users)/" + COMPTE)
];

function fichiersSuivis(){
  return execFileSync("git", ["ls-files", "-z"], { cwd:RACINE, encoding:"utf8", maxBuffer:64 << 20 })
    .split("\0")
    .filter(Boolean)
    .filter(f => !EXCLUS.some(motif => motif.test(f)) && !BINAIRES.test(f));
}

function trouver(texte){
  const trouves = [];
  texte.split(/\r?\n/).forEach((ligne, rang) => {
    for(const motif of MOTIFS){
      const m = ligne.match(motif);
      if(m){ trouves.push({ ligne:rang + 1, extrait:m[0].trim() }); break; }
    }
  });
  return trouves;
}

/* Les dents du garde, eprouvees sur des chaines construites ici : aucun
   chemin reel n'est ecrit dans ce fichier. */
const lecteur = "C:" + "/Us" + "ers/quelqu" + "un/Desktop/depot";
assert.equal(trouver("const RACINE = '" + lecteur + "';").length, 1, "chemin Windows a barres obliques");
assert.equal(trouver("\"" + lecteur.replace(/\//g, "\\\\") + "\"").length, 1, "chemin Windows echappe en JSON");
assert.equal(trouver("cd " + "/ho" + "me/quelqu" + "un/depot").length, 1, "chemin Linux");
assert.equal(trouver("open '" + "/Us" + "ers/quelqu" + "un/depot'").length, 1, "chemin macOS");
for(const permis of [
  "C:" + "\\Us" + "ers\\<nom>\\Downloads",
  "C:" + "/Us" + "ers/{utilisateur}/depot",
  "%USERPROFILE%\\Desktop",
  "$HOME/depot",
  "Yannis",
  "https://example.test/Users/liste",
  "la navigation desktop"
]){
  assert.deepEqual(trouver(permis), [], "faux positif sur : " + permis);
}

const fautes = [];
for(const fichier of fichiersSuivis()){
  const absolu = path.join(RACINE, fichier);
  let contenu;
  try{ contenu = fs.readFileSync(absolu); }catch{ continue; }
  if(contenu.includes(0)) continue;
  for(const t of trouver(contenu.toString("utf8"))){
    fautes.push(fichier + ":" + t.ligne + "  " + t.extrait);
  }
}

assert.deepEqual(fautes, [],
  "Chemin de dossier personnel dans un fichier suivi — resoudre depuis __dirname, "
    + "DONNEES_JEU ou un argument :\n  " + fautes.join("\n  "));

console.log("chemins-personnels : aucun chemin de dossier utilisateur dans les fichiers suivis");
