"use strict";

/* Un preset transporte sept emplacements et rien d'autre. L'armure gravee
   appartient au heros : la capturer la deplacerait d'un personnage a l'autre,
   ce que le jeu ne permet pas. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const racine = path.join(__dirname, "..");
/* On ajoute une sortie explicite plutot que de compter sur le bloc `export` :
   dans un script `vm`, un `const` de haut niveau n'atterrit PAS sur l'objet
   global du contexte, contrairement a une declaration `function`. Cette
   epilogue marche aussi bien sur un module qui n'exporte encore rien que sur
   celui qui exportera plus tard. */
const EPILOGUE = "\nglobalThis.__api = {"
  + " PRESET_ARMOR_SLOTS, PRESET_NAME_MAX, PRESETS_MAX,"
  + " nomPresetValide, normaliserPreset, capturerPreset, appliquerPreset };";
const source = fs.readFileSync(
  path.join(racine, "js", "metier", "presets.js"), "utf8"
).replace(/^import[\s\S]*?;\s*$/gm, "")
  .replace(/^export\s*\{[\s\S]*?\}\s*;\s*$/m, "")
  + EPILOGUE;
const bac = {
  ARMOR_SLOTS:["Haut","Bas","Bottes","Ceinture","Armure liee"],
  JEWEL_SLOTS:["Anneau","Collier","Boucle d'oreille"],
  LINKED_ARMOR_SLOT:"Armure liee",
  jsonCopy:value => JSON.parse(JSON.stringify(value))
};
vm.runInNewContext(source, bac, { filename:"presets.js" });

const {
  PRESET_ARMOR_SLOTS, PRESET_NAME_MAX, PRESETS_MAX,
  nomPresetValide, normaliserPreset, capturerPreset, appliquerPreset
} = bac.__api;

const buildComplet = () => ({
  weapon:"7ds-armes/Hache/Hache de guerre.webp",
  weaponConfig:{ niveau:80 },
  armor:{
    "Haut":"7ds-armures-ssr/Haut/Haut A.webp",
    "Bas":"7ds-armures-ssr/Bas/Bas A.webp",
    "Bottes":"7ds-armures-ssr/Bottes/Bottes A.webp",
    "Ceinture":"7ds-armures-ssr/Ceinture/Ceinture A.webp",
    "Armure liee":"7ds-armures-ssr/Armure liee/Gravee A.webp"
  },
  armorConfig:{
    "Haut":{ niveau:20 },
    "Armure liee":{ niveau:5 }
  },
  jewel:{ "Anneau":"Anneau A.webp", "Collier":null, "Boucle d'oreille":null },
  jewelConfig:{ "Anneau":{ niveau:10 } },
  note:"mon build boss",
  favorite:true
});

// Les quatre emplacements transportables, jamais l'armure gravee.
assert.deepStrictEqual(PRESET_ARMOR_SLOTS, ["Haut","Bas","Bottes","Ceinture"]);
assert.equal(PRESET_NAME_MAX, 40);
assert.equal(PRESETS_MAX, 40);

// Un nom se nettoie, et refuse le vide comme le trop long.
assert.equal(nomPresetValide("  Boss  "), "Boss");
assert.equal(nomPresetValide("   "), null);
assert.equal(nomPresetValide(null), null);
assert.equal(nomPresetValide("x".repeat(41)), null);
assert.equal(nomPresetValide("x".repeat(40)), "x".repeat(40));

// La capture prend les sept emplacements et laisse l'armure gravee au heros.
const capture = capturerPreset(buildComplet());
assert.deepStrictEqual(Object.keys(capture.armor), ["Haut","Bas","Bottes","Ceinture"]);
assert.equal(Object.prototype.hasOwnProperty.call(capture.armor, "Armure liee"), false);
assert.equal(
  Object.prototype.hasOwnProperty.call(capture.armorConfig, "Armure liee"),
  false
);
assert.deepStrictEqual(capture.armorConfig["Haut"], { niveau:20 });
assert.deepStrictEqual(capture.jewelConfig["Anneau"], { niveau:10 });

// Une config sans sa piece est perimee : elle ne voyage pas.
const sansPiece = capturerPreset(Object.assign(buildComplet(), {
  jewel:{ "Anneau":null, "Collier":null, "Boucle d'oreille":null },
  jewelConfig:{ "Anneau":{ niveau:10 } }
}));
/* On compare les CLES, pas l'objet : un objet ne du `vm` n'a pas le
   `Object.prototype` du test, et `deepStrictEqual` compare les prototypes. */
assert.deepStrictEqual(Object.keys(sansPiece.jewelConfig), []);

// Un build sans aucune des sept pieces ne fait pas un preset.
assert.equal(capturerPreset({
  armor:{ "Armure liee":"7ds-armures-ssr/Armure liee/Gravee A.webp" },
  jewel:{}
}), null);
assert.equal(capturerPreset(null), null);

// Appliquer remplace les sept emplacements et preserve tout le reste.
const cible = {
  weapon:"7ds-armes/Lance/Lance B.webp",
  weaponConfig:{ niveau:70 },
  armor:{
    "Haut":"vieux haut.webp", "Bas":null, "Bottes":null, "Ceinture":null,
    "Armure liee":"7ds-armures-ssr/Armure liee/Gravee CIBLE.webp"
  },
  armorConfig:{ "Haut":{ niveau:1 }, "Armure liee":{ niveau:3 } },
  jewel:{ "Anneau":null, "Collier":"vieux collier.webp", "Boucle d'oreille":null },
  jewelConfig:{ "Collier":{ niveau:2 } },
  note:"note de la cible",
  favorite:false
};
const applique = appliquerPreset(cible, capture);

assert.equal(applique.weapon, "7ds-armes/Lance/Lance B.webp");
assert.deepStrictEqual(applique.weaponConfig, { niveau:70 });
assert.equal(applique.note, "note de la cible");
assert.equal(applique.favorite, false);
// L'armure gravee de la CIBLE reste, avec sa config.
assert.equal(applique.armor["Armure liee"], "7ds-armures-ssr/Armure liee/Gravee CIBLE.webp");
assert.deepStrictEqual(applique.armorConfig["Armure liee"], { niveau:3 });
// Les quatre emplacements viennent du preset.
assert.equal(applique.armor["Haut"], "7ds-armures-ssr/Haut/Haut A.webp");
assert.equal(applique.armor["Bas"], "7ds-armures-ssr/Bas/Bas A.webp");
assert.deepStrictEqual(applique.armorConfig["Haut"], { niveau:20 });
// Un emplacement vide du preset vide celui de la cible, config comprise.
assert.equal(applique.jewel["Collier"], null);
assert.equal(Object.prototype.hasOwnProperty.call(applique.jewelConfig, "Collier"), false);

// Appliquer ne modifie JAMAIS le build d'origine.
assert.equal(cible.armor["Haut"], "vieux haut.webp");
assert.deepStrictEqual(cible.jewelConfig, { "Collier":{ niveau:2 } });

// Un preset illisible ne casse rien.
assert.equal(appliquerPreset(cible, null), null);
assert.equal(appliquerPreset(null, capture), null);

// Une cle inconnue est ecartee a la normalisation.
const nettoye = normaliserPreset({
  armor:{ "Haut":"h.webp", "Chapeau":"inconnu.webp", "Armure liee":"g.webp" },
  jewel:{}
});
assert.deepStrictEqual(Object.keys(nettoye.armor), ["Haut","Bas","Bottes","Ceinture"]);

console.log("presets.test.js : OK");
