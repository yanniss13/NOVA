"use strict";

/* Le bouton « Tout au maximum ».

   Un membre a demande ce bouton parce que regler onze emplacements un par un,
   niveau puis renforcement, est le geste le plus repetitif du site.

   Ce que ce test garde, dans l'ordre d'importance :

   1. LES ENCHANTEMENTS NE BOUGENT PAS. C'est la seule facon de perdre une
      donnee ici : un enchantement est une saisie a la main ou par l'OCR, pas
      un niveau, et le jeu ne le « monte » pas. Si un jour quelqu'un decide de
      les remplir aussi, ce test doit casser et le faire discuter.
   2. Les valeurs posees sont VALIDES pour le catalogue - c'est gearConfigStatus
      et weaponConfigStatus qui l'arbitrent, pas une borne recopiee ici.
   3. Une arme sans configuration reste dehors, et le compte-rendu le DIT. Sans
      cela, un membre croirait son arme montee alors qu'elle ne l'est pas. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { loadApp, plain } = require("./helpers/load-app");

const app = loadApp();
const hooks = app.hooks || {};
const {
  porterAuMaximum, messageDuMaximum,
  gearConfigAuMaximum, weaponConfigAuMaximum
} = hooks;

for(const [nom, fn] of Object.entries({
  porterAuMaximum, messageDuMaximum, gearConfigAuMaximum, weaponConfigAuMaximum
})){
  assert.equal(typeof fn, "function", "hook manquant : " + nom);
}

/* Le catalogue se lit a la source : loadApp ne l'expose pas, et le recopier
   ici figerait des valeurs que le generateur fait bouger. */
const bacCatalogue = { window:{} };
vm.runInNewContext(
  fs.readFileSync(
    path.join(__dirname, "..", "data", "stats-build.js"), "utf8"
  ),
  bacCatalogue
);
const BUILD = bacCatalogue.window.SEVEN_DS_BUILD_STATS;
/* Une piece qui porte VRAIMENT des emplacements d'enchantement : c'est la
   seule sur laquelle la garde principale ait un sens. Beaucoup n'en ont
   aucun, et le premier venu du catalogue est de ceux-la. */
const [fichierPiece, definition] = Object.entries(BUILD.gearByFile).find(
  ([, item]) => item && item.randomOptions
    && Number(item.randomOptions.slots) > 0
) || [];
assert.ok(definition,
  "le catalogue doit porter au moins une piece a enchantements");

/* ---- une piece ---- */
const auMax = plain(gearConfigAuMaximum(fichierPiece, null));
assert.equal(auMax.level, definition.qualityMax,
  "le niveau doit monter au plafond de qualite de la piece");
assert.equal(auMax.reinforce, definition.reinforceMax,
  "le renforcement doit monter a son maximum");
assert.equal(typeof hooks.gearConfigStatus, "function",
  "hook manquant : gearConfigStatus");
/* Les emplacements d'enchantement restent VIDES ici, donc le catalogue rend
   « incomplete » : c'est l'etat attendu, et surtout pas « incompatible », qui
   signalerait une valeur hors bornes. */
assert.notEqual(hooks.gearConfigStatus(fichierPiece, auMax), "incompatible",
  "les valeurs posees doivent rester dans les bornes du catalogue");

/* LA GARDE PRINCIPALE : un enchantement saisi survit a la montee. */
const avecEnchantement = plain(gearConfigAuMaximum(fichierPiece, {
  version:1,
  level:definition.qualityMin,
  reinforce:0,
  enchantments:[{ slot:0, stat:"C_Critical_Rate", value:123 }],
  passiveLevel:null
}));
assert.deepEqual(
  avecEnchantement.enchantments[0],
  { slot:0, stat:"C_Critical_Rate", value:123 },
  "monter au maximum ne doit JAMAIS toucher un enchantement saisi"
);

/* ---- un heros entier ---- */
const heros = {
  weapon:null,
  weaponConfig:null,
  armor:{ Haut:fichierPiece },
  armorConfig:{},
  jewel:{},
  jewelConfig:{}
};
const bilanSansArme = plain(porterAuMaximum(heros));
assert.equal(bilanSansArme.armeIgnoree, false,
  "sans arme equipee, il n'y a rien a signaler");
assert.ok(bilanSansArme.montees >= 1,
  "la piece d'armure doit avoir ete montee, recu " + bilanSansArme.montees);

/* Une arme equipee mais NON CONFIGUREE : son grade est inconnu, donc elle
   reste dehors — et le compte-rendu doit le dire, sinon le membre croit son
   arme montee. */
const fichierArme = Object.keys(BUILD.weaponsByFile)[0];
const sansGrade = plain(porterAuMaximum({
  weapon:fichierArme, weaponConfig:null,
  armor:{}, armorConfig:{}, jewel:{}, jewelConfig:{}
}));
assert.equal(sansGrade.armeIgnoree, true,
  "une arme sans configuration ne peut pas etre montee");
assert.match(messageDuMaximum(sansGrade), /arme/i,
  "le compte-rendu doit nommer l'arme laissee de cote");

/* Une arme configuree monte jusqu'au dernier palier de promotion. */
const gameId = Object.keys(BUILD.weaponsByFile[fichierArme].gradesByGameId)[0];
const grade = BUILD.weaponsByFile[fichierArme].gradesByGameId[gameId];
const armeMax = plain(weaponConfigAuMaximum(fichierArme, {
  version:1, gradeGameId:gameId, level:0, promotion:0, overlimit:0,
  enchantments:[]
}));
assert.equal(armeMax.promotion, grade.promotionSteps.length,
  "la promotion doit aller au dernier palier");
assert.equal(
  armeMax.level,
  Number(grade.promotionSteps[grade.promotionSteps.length - 1].reinforceMax),
  "le niveau doit atteindre le plafond du dernier palier"
);

/* Rien a monter : le message ne doit pas mentir en annoncant un succes. */
assert.match(
  messageDuMaximum({ montees:0, armeIgnoree:false }), /Rien/i,
  "un heros nu ne doit pas recevoir un message de reussite"
);

console.log("tout-au-maximum.test.js OK (niveau "
  + auMax.level + ", renforcement +" + auMax.reinforce
  + ", arme jusqu'au niveau " + armeMax.level + ")");
