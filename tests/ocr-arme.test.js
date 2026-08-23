"use strict";

/* L'inversion d'une arme part de son nom et de ses chiffres reels : le site
   conserve une configuration, jamais les totaux affiches par le jeu. */

const assert = require("node:assert/strict");
const { loadApp, plain } = require("./helpers/load-app");

const { hooks } = loadApp();
const { deduireArme, weaponConfigStatus } = hooks;
assert.equal(typeof deduireArme, "function",
  "deduireArme doit etre expose par js/metier/ocr-arme.js");

const BAGUETTE = "7ds-armes/Baguette/Baguette des ailes de la flamme noire.webp";
const RAPIERE = "7ds-armes/Rapiere/Rapière de l'âme vorace.webp";

/* Les deux totaux natifs sont releves sur la capture de la Baguette. Les
   quatre lignes de perle sont une section distincte : elles ne doivent donc
   jamais participer au filtrage des stats natives. */
const baguette = plain(deduireArme({
  nom:"Baguette des ailes de la flamme noire",
  niveau:50,
  passif:7,
  herosSlug:"merlin",
  stats:[
    { libelle:"Attaque de l'équipement", valeur:"4 731", section:null },
    { libelle:"Dégâts crit.", valeur:"48.82%", section:null },
    { libelle:"Augmentation des dégâts de Foudre", valeur:"16.80%", section:"Perle" },
    { libelle:"Dégâts crit.", valeur:"16.81%", section:"Perle" },
    { libelle:"Augmentation des dégâts, compétence normale", valeur:"20.45%", section:"Perle" },
    { libelle:"Augmentation des dégâts, compétence de relève", valeur:"27.22%", section:"Perle" }
  ]
}));
assert.equal(baguette.statut, "unique");
assert.equal(baguette.candidats.length, 1);
assert.equal(baguette.candidats[0].fichier, BAGUETTE);
assert.equal(baguette.candidats[0].gradeGameId, "131065005");
assert.equal(baguette.candidats[0].level, 50);
assert.equal(baguette.candidats[0].promotion, 4);
assert.equal(baguette.candidats[0].overlimit, 6);
assert.equal(baguette.candidats[0].slot, "Arme");
assert.equal(baguette.candidats[0].elementSuppose, false);
assert.equal(baguette.candidats[0].enchantments.length, 4);
assert.equal(weaponConfigStatus(BAGUETTE, {
  version:1,
  ...baguette.candidats[0]
}), "valid", "la candidate importee doit rester une vraie configuration");

/* La Rapiere ne lit aucune statistique elementaire de perle. L'element Vent
   natif departage la configuration retenue, mais la supposition doit rester
   visible au membre. */
const rapiere = plain(deduireArme({
  nom:"Rapière de l'âme vorace",
  niveau:50,
  passif:1,
  stats:[
    /* La capture ultrawide affiche aussi cette stat du heros. Elle n'est pas
       portee par l'arme et ne doit pas rejeter ses deux stats natives utiles. */
    { libelle:"Attaque de Vent", valeur:"3 453", section:null },
    { libelle:"Attaque de l'équipement", valeur:"3 291", section:null },
    { libelle:"Efficacité de Déluge de Vent", valeur:"43.17%", section:null },
    { libelle:"Dégâts crit.", valeur:"11.71%", section:"Perle" },
    { libelle:"Chances crit.", valeur:"9.53%", section:"Perle" },
    { libelle:"Augmentation des dégâts d'attaque normale", valeur:"18.56%", section:"Perle" }
  ]
}));
assert.equal(rapiere.statut, "unique");
assert.equal(rapiere.candidats[0].fichier, RAPIERE);
assert.equal(rapiere.candidats[0].gradeGameId, "131085010");
assert.equal(rapiere.candidats[0].elementSuppose, true);
assert.equal(rapiere.candidats[0].enchantments[0].element, "wind");

/* Un nom absent, une arme non compatible et un chiffre mal lu ne doivent
   jamais produire une candidate approximative. */
assert.deepEqual(plain(deduireArme({
  nom:"Arme inexistante", niveau:50, passif:null, stats:[]
})), { statut:"aucun", candidats:[] });
assert.deepEqual(plain(deduireArme({
  nom:"Rapière de l'âme vorace", niveau:50, passif:null,
  herosSlug:"meliodas", stats:[
    { libelle:"Attaque de l'équipement", valeur:"3 291", section:null },
    { libelle:"Efficacité de Déluge de Vent", valeur:"43.17%", section:null }
  ]
})), { statut:"aucun", candidats:[] });
assert.deepEqual(plain(deduireArme({
  nom:"Baguette des ailes de la flamme noire", niveau:50, passif:7,
  stats:[
    { libelle:"Attaque de l'équipement", valeur:"4 732", section:null },
    { libelle:"Dégâts crit.", valeur:"48.82%", section:null }
  ]
})), { statut:"aucun", candidats:[] });

console.log("ocr-arme : OK");
