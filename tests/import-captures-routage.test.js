"use strict";

/* L'aiguillage de la vue ne depend que du Lv. lu dans l'en-tete : une arme
   n'est jamais soumise a la deduction de piece, qui ne connait pas son nom. */

const assert = require("node:assert/strict");
const { loadApp, plain } = require("./helpers/load-app");

const { hooks } = loadApp();
const { analyserCaptures, __remplacerLecteur, detailDuChoix } = hooks;
assert.equal(typeof analyserCaptures, "function",
  "analyserCaptures doit etre exposable pour couvrir son aiguillage");
assert.equal(typeof __remplacerLecteur, "function",
  "le lecteur doit etre remplacable dans le test de routage");
assert.equal(typeof detailDuChoix, "function",
  "le detail de recapitulatif doit etre testable sans DOM");

const BAGUETTE = "7ds-armes/Baguette/Baguette des ailes de la flamme noire.webp";
const CEINTURE = "7ds-armures-ssr/Ceinture/Ceinture du souverain cupide.webp";

__remplacerLecteur(async fichier => fichier === "baguette.png" ? {
  statut:"ok",
  entete:{ nom:"Baguette des ailes de la flamme noire", niveau:50 },
  passif:7,
  stats:[
    { libelle:"Attaque de l'équipement", valeur:"4 731", section:null },
    { libelle:"Dégâts crit.", valeur:"48.82%", section:null },
    { libelle:"Augmentation des dégâts de Foudre", valeur:"16.80%", section:"Perle" },
    { libelle:"Dégâts crit.", valeur:"16.81%", section:"Perle" },
    { libelle:"Augmentation des dégâts, compétence normale", valeur:"20.45%", section:"Perle" },
    { libelle:"Augmentation des dégâts, compétence de relève", valeur:"27.22%", section:"Perle" }
  ]
} : {
  statut:"ok",
  entete:{ nom:"Ceinture du souverain cupide", niveau:null },
  passif:null,
  stats:[{ libelle:"PV de l'équipement", valeur:"12 560", section:null }]
});

(async () => {
  const lignes = plain(await analyserCaptures(["baguette.png", "ceinture.png"], "merlin"));
  assert.equal(lignes.length, 2, "une ligne par capture");

  const arme = lignes[0];
  assert.equal(arme.statut, "unique", "la Baguette doit etre deduite comme arme");
  assert.equal(arme.choix.fichier, BAGUETTE);
  assert.equal(arme.choix.slot, "Arme");
  assert.equal(arme.choix.enchantments.length, 4);
  assert.equal(arme.choix.elementSuppose, false);

  const piece = lignes[1];
  assert.equal(piece.statut, "unique", "la deduction des pieces ne doit pas regresser");
  assert.equal(piece.choix.fichier, CEINTURE);
  assert.equal(piece.choix.slot, "Ceinture");
  assert.equal(piece.choix.level, 159);
  assert.equal(piece.choix.reinforce, 5);

  const gravee = {
    slot:"Armure liee",
    level:130,
    reinforce:5,
    enchantments:[
      { slot:0, stat:"Normalskill_Damadd_Rate", value:1766 },
      null,
      { slot:2, stat:"C_Critical_Rate", value:450 }
    ]
  };
  assert.match(detailDuChoix(gravee), /2 enchantements remplis/,
    "une piece gravee affiche ses enchantements remplis dans le recapitulatif");

  console.log("import-captures routage : OK");
})().catch(erreur => {
  console.error(erreur);
  process.exit(1);
});
