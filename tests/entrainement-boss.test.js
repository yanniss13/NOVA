"use strict";

/* Les règles de l'entraînement du boss, lues sur le module isolé : il n'a
   aucun import, on le charge seul dans un contexte `vm`. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { plain } = require("./helpers/load-app");

const source = fs
  .readFileSync(path.join(__dirname, "..", "js", "metier", "entrainement-boss.js"), "utf8")
  .replace(/export\s*\{[^}]*\};?/, "");
const contexte = {};
vm.runInNewContext(source + `
this.__api = { ENTRAINEMENT_MAX_PARTICIPANTS, ENTRAINEMENT_NOTE_MAX,
  dateParisEntrainement, validerSaisieEntrainement, cleCompositionEntrainement,
  trierRunsEntrainement, serieProgressionEntrainement,
  resumeProgressionEntrainement, topRunsEntrainement,
  comparaisonEquipesEntrainement, echelleProgressionEntrainement };`, contexte, { filename:"entrainement-boss.js" });
const api = contexte.__api;

/* ---------- date de Paris ---------- */
/* 23h30 UTC le 21 septembre = 1h30 le 22 à Paris (heure d'été). */
assert.equal(api.dateParisEntrainement(new Date("2026-09-21T23:30:00Z")), "2026-09-22");

/* ---------- validation ---------- */
const base = { auteurId:"a", participants:["a","b"], score:"1500000",
  note:"", playedOn:"2026-09-20", aujourdhui:"2026-09-22" };
const erreur = changes => api.validerSaisieEntrainement(Object.assign({}, base, changes)).erreur;
assert.equal(api.validerSaisieEntrainement(base).ok, true);
assert.deepEqual(plain(api.validerSaisieEntrainement(base).valeur),
  { participants:["a","b"], score:"1500000", note:"", playedOn:"2026-09-20" });
assert.equal(erreur({ participants:[] }), "PARTICIPANTS_VIDES");
assert.equal(erreur({ participants:["a","b","c","d","e","f"] }), "TROP_DE_PARTICIPANTS");
assert.equal(erreur({ participants:["b","c"] }), "AUTEUR_ABSENT");
assert.equal(erreur({ participants:["a","b","b"] }), "PARTICIPANT_EN_DOUBLE");
assert.equal(erreur({ score:"0" }), "SCORE_INVALIDE");
assert.equal(erreur({ score:"-3" }), "SCORE_INVALIDE");
assert.equal(erreur({ score:"12,5" }), "SCORE_INVALIDE");
/* Un point n'est pas un separateur de milliers : ".5" ne doit pas etre
   silencieusement avale et "12.5" ne doit pas devenir "125". */
assert.equal(erreur({ score:"12.5" }), "SCORE_INVALIDE");
assert.equal(erreur({ score:"" }), "SCORE_INVALIDE");
assert.equal(erreur({ note:"x".repeat(1001) }), "NOTE_TROP_LONGUE");
assert.equal(erreur({ playedOn:"20/09/2026" }), "DATE_INVALIDE");
assert.equal(erreur({ playedOn:"2026-09-23" }), "DATE_FUTURE");
/* Les espaces et séparateurs de milliers saisis sont tolérés et retirés. */
assert.equal(api.validerSaisieEntrainement(Object.assign({}, base,
  { score:" 1 500 000 " })).valeur.score, "1500000");
/* La note est rognée. */
assert.equal(api.validerSaisieEntrainement(Object.assign({}, base,
  { note:"  bien  " })).valeur.note, "bien");

/* ---------- composition ---------- */
const snap = chars => ({ data:{ heroes:chars.map(char => ({ char })) } });
assert.equal(api.cleCompositionEntrainement(snap(["merlin","ban",null,"diane"])), "ban|diane|merlin");
assert.equal(api.cleCompositionEntrainement(snap(["diane","merlin","ban"])), "ban|diane|merlin");
assert.equal(api.cleCompositionEntrainement(null), null);
assert.equal(api.cleCompositionEntrainement(snap([null,null])), null);

/* ---------- jeu de runs ---------- */
const run = (id, playedOn, score, equipes, createdAt) => ({
  id, playedOn, score, note:"", participants:Object.keys(equipes),
  equipes, createdAt:createdAt || playedOn+"T20:00:00Z", updatedAt:"t"
});
const eq = chars => ({ pseudo:"x", teamId:"t", snapshot:snap(chars) });
const runs = [
  run("r1", "2026-09-10", "9007199254740993", { a:eq(["ban","diane"]), b:eq(["merlin"]) }),
  run("r2", "2026-09-12", "9007199254740992", { a:eq(["diane","ban"]) }),
  run("r3", "2026-09-12", "100", { b:eq(["merlin"]) }, "2026-09-12T21:00:00Z"),
  run("r4", "2026-09-15", "300", { a:{ pseudo:"x", teamId:null, snapshot:null } }),
  run("r5", "2026-09-16", "200", { a:eq(["king"]) })
];

assert.deepEqual(plain(api.trierRunsEntrainement(runs).map(r => r.id)),
  ["r5","r4","r3","r2","r1"]);

/* Progression : chronologique ; filtrée sur un membre. */
assert.deepEqual(plain(api.serieProgressionEntrainement(runs, null).map(p => p.id)),
  ["r1","r2","r3","r4","r5"]);
assert.deepEqual(plain(api.serieProgressionEntrainement(runs, "b").map(p => p.id)),
  ["r1","r3"]);
assert.deepEqual(plain(api.resumeProgressionEntrainement(
  api.serieProgressionEntrainement(runs, "a"))),
  { meilleur:"9007199254740993", dernier:"200", ecart:"-9007199254740793" });
assert.equal(api.resumeProgressionEntrainement([]), null);

/* ---------- échelle de la courbe ---------- */
/* LA RÈGLE QUI COMPTE : elle ne part pas de zéro.

   Une confrérie progresse par paliers de quelques pour cent. Cadrée sur
   zéro, cette série s'écrase en un filet plat dans le haut du cadre et la
   progression qu'on vient consulter devient invisible. C'est le défaut qui
   a motivé cette fonction ; sans cette assertion, un « max(0, …) » de trop
   la ferait silencieusement revenir. */
const serrees = ["212000","218500","216000","231000","240500","255500"];
const echelle = plain(api.echelleProgressionEntrainement(serrees));
assert.ok(echelle.bas > 200000,
  "l'échelle doit se cadrer sur les données, pas sur zéro (bas=" + echelle.bas + ")");
/* …tout en contenant réellement les données : un cadrage serré qui coupe
   un point serait pire que le vide qu'on vient de supprimer. */
assert.ok(echelle.bas < 212000 && echelle.haut > 255500,
  "l'échelle doit contenir toute la série");
/* La courbe doit occuper l'essentiel de sa hauteur, sinon rien n'est gagné. */
assert.ok((255500 - 212000) / (echelle.haut - echelle.bas) > 0.6,
  "la série doit occuper plus de 60 % de la hauteur");
/* Graduations : des ENTIERS multiples du pas — formatBossScore() les relit
   en BigInt et rendrait « — » sur une décimale. */
assert.ok(echelle.graduations.length >= 2, "au moins deux graduations");
echelle.graduations.forEach(valeur => {
  assert.ok(Number.isInteger(valeur), "graduation entière : " + valeur);
  assert.equal(valeur % echelle.pas, 0, "graduation sur le pas : " + valeur);
  assert.ok(valeur >= echelle.bas && valeur <= echelle.haut,
    "graduation dans le cadre : " + valeur);
});

/* Séries sans étendue : une seule run, ou deux fois le même score. Sans
   garde, l'amplitude vaut zéro et toute division rend NaN — la courbe
   disparaîtrait au lieu d'afficher son point. */
[["188000"], ["188000","188000","188000"]].forEach(plate => {
  const cadre = plain(api.echelleProgressionEntrainement(plate));
  assert.ok(cadre.haut > cadre.bas, "une série plate garde une hauteur");
  assert.ok(cadre.bas < 188000 && cadre.haut > 188000, "le point reste dans le cadre");
  assert.ok(cadre.graduations.every(Number.isInteger), "graduations entières");
});
assert.equal(api.echelleProgressionEntrainement([]), null);

/* Top : au-delà de 2^53 sans perte, égalité → la plus ancienne d'abord. */
const top = api.topRunsEntrainement(runs, 3);
assert.deepEqual(plain(top.map(t => [t.rang, t.run.id])),
  [[1,"r1"],[2,"r2"],[3,"r4"]]);
assert.equal(api.topRunsEntrainement(runs).length, 5);

/* Ce cas précis n'a de dents que si le tri passe par BigInt : les deux
   scores DIFFÈRENT au-delà de 2^53 mais s'ÉCRASENT sur le même Number, et
   la date la plus ancienne porte volontairement le score le plus FAIBLE.
   Une comparaison en Number verrait les deux scores égaux et retomberait
   sur le départage par date, qui rendrait alors l'ordre INVERSE de celui
   qu'impose le vrai score. */
const grandPresque2_53 = run("grand-2-53", "2026-09-10", "9007199254740997", { a:eq(["ban"]) });
const petitPresque2_53 = run("petit-2-53", "2026-09-05", "9007199254740995", { a:eq(["diane"]) });
assert.equal(Number(grandPresque2_53.score), Number(petitPresque2_53.score),
  "le fixture doit écraser les deux scores sur le même Number pour avoir des dents");
assert.deepEqual(
  plain(api.topRunsEntrainement([grandPresque2_53, petitPresque2_53], 2).map(t => t.run.id)),
  ["grand-2-53", "petit-2-53"],
  "le tri doit départager par BigInt, pas par Number ni par la date");

/* Comparaison : par composition du membre, équipe manquante exclue,
   médiane sur un nombre pair = moyenne entière des deux centrales. */
const comparaison = plain(api.comparaisonEquipesEntrainement(runs, "a"));
assert.deepEqual(comparaison, [
  { cle:"ban|diane", heros:["ban","diane"], runs:2,
    meilleur:"9007199254740993", mediane:"9007199254740992" },
  { cle:"king", heros:["king"], runs:1, meilleur:"200", mediane:"200" }
]);
assert.deepEqual(plain(api.comparaisonEquipesEntrainement(runs, "inconnu")), []);

console.log("entrainement-boss : ok");
