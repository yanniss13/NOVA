"use strict";

/* L'import d'une arme choisit d'abord le build correspondant : les autres
   captures de la meme serie ne doivent jamais modifier le build ouvert avant
   l'import. */

const assert = require("node:assert/strict");
const { loadApp, plain } = require("./helpers/load-app");

const BAGUETTE = "7ds-armes/Baguette/baguette-importee.webp";
const HACHE = "7ds-armes/Hache/hache-existante.webp";
const HAUT = "7ds-armures-ssr/Haut/haut-importe.webp";
const WEAPON_CONFIG = {
  version:1, gradeGameId:"grade-baguette", level:50,
  promotion:4, overlimit:6, enchantments:[null]
};
const GEAR_CONFIG = {
  version:1, level:130, reinforce:5, enchantments:[], passiveLevel:null
};

const { hooks } = loadApp();
const appliquer = hooks.appliquerImportRosterCaptures;
assert.equal(typeof appliquer, "function",
  "l'ecriture d'import doit etre testable sans rendre la modale");

function draftMerlin(){
  return {
    charId:"merlin",
    builds:{
      Livre:{
        weapon:"7ds-armes/Livre/livre-ouvert.webp",
        weaponConfig:{ version:1, gradeGameId:"grade-livre" },
        armor:{ Haut:"7ds-armures-ssr/Haut/haut-livre.webp" },
        armorConfig:{ Haut:{ version:1, level:1 } },
        jewel:{}, jewelConfig:{}, note:"Le build ouvert", favorite:false
      },
      Baguette:{
        weapon:null, weaponConfig:null, armor:{}, armorConfig:{},
        jewel:{}, jewelConfig:{}, note:"", favorite:false
      }
    }
  };
}

// Mutation protegee : choisir le build apres les ecritures replacerait l'arme
// et le Haut dans Livre, le build ouvert avant l'import.
{
  const draft = draftMerlin();
  const resultat = plain(appliquer(draft, "Livre", {
    Arme:{ fichier:BAGUETTE, config:WEAPON_CONFIG },
    Haut:{ fichier:HAUT, config:GEAR_CONFIG }
  }));

  assert.deepEqual(resultat, { weaponType:"Baguette", applied:2 });
  assert.equal(draft.builds.Baguette.weapon, BAGUETTE);
  assert.deepEqual(plain(draft.builds.Baguette.weaponConfig), WEAPON_CONFIG);
  assert.equal(draft.builds.Baguette.armor.Haut, HAUT);
  assert.deepEqual(plain(draft.builds.Baguette.armorConfig.Haut), GEAR_CONFIG);
  assert.equal(draft.builds.Livre.weapon, "7ds-armes/Livre/livre-ouvert.webp");
  assert.equal(draft.builds.Livre.armor.Haut, "7ds-armures-ssr/Haut/haut-livre.webp");
}

{
  const draft = draftMerlin();
  delete draft.builds.Livre;
  const resultat = plain(appliquer(draft, "Livre", {
    Arme:{ fichier:HACHE, config:WEAPON_CONFIG }
  }));

  assert.deepEqual(resultat, { weaponType:"Livre", applied:0 });
  assert.equal(Object.hasOwn(draft.builds, "Livre"), false,
    "une arme incompatible ne cree pas un build courant vide");
  assert.equal(draft.builds.Baguette.weapon, null);
}

{
  const draft = draftMerlin();
  const resultat = plain(appliquer(draft, "Livre", {
    Haut:{ fichier:HAUT, config:GEAR_CONFIG }
  }));

  assert.deepEqual(resultat, { weaponType:"Livre", applied:1 });
  assert.equal(draft.builds.Livre.armor.Haut, HAUT);
  assert.deepEqual(plain(draft.builds.Livre.armorConfig.Haut), GEAR_CONFIG);
  assert.equal(draft.builds.Baguette.armor.Haut, undefined);
}

console.log("import-captures roster : OK");
