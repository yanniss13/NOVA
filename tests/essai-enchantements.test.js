"use strict";

/* L'essai ne doit jamais muter le build dont vient le calculateur : cette
   frontiere empeche une comparaison locale de devenir une ecriture roster. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const racine = path.join(__dirname, "..");
const source = fs.readFileSync(
  path.join(racine, "js", "metier", "essai-enchantements.js"), "utf8"
).replace(/^import[\s\S]*?;\s*$/gm, "")
  .replace(/^export\s*\{[\s\S]*?\}\s*;\s*$/m, "");
const bac = {
  LINKED_ARMOR_SLOT:"Armure liee",
  jsonCopy:value => JSON.parse(JSON.stringify(value))
};
vm.runInNewContext(source, bac, { filename:"essai-enchantements.js" });

const {
  creerEssaiEnchantements, herosAvecEssaiEnchantements,
  remplacerConfigEssai, reinitialiserEssaiEnchantements,
  essaiEnchantementsDiffere
} = bac;

assert.equal(typeof creerEssaiEnchantements, "function");
assert.equal(typeof herosAvecEssaiEnchantements, "function");
assert.equal(typeof remplacerConfigEssai, "function");
assert.equal(typeof reinitialiserEssaiEnchantements, "function");
assert.equal(typeof essaiEnchantementsDiffere, "function");

const CONFIG_ARME_REFERENCE = {
  version:1, gradeGameId:"grade", level:50, promotion:4, overlimit:0,
  enchantments:[{ slot:0, stat:"B_Atk_Equip", value:420 }]
};
const CONFIG_GRAVURE_REFERENCE = {
  version:1, level:120, reinforce:5,
  enchantments:[{ slot:0, stat:"B_Atk_Equip", value:210 }], passiveLevel:2
};
const CONFIG_ARME_ESSAI = Object.assign({}, CONFIG_ARME_REFERENCE, {
  enchantments:[{ slot:0, stat:"C_Critical_Rate", value:800 }]
});
const HERO = {
  weapon:"7ds-armes/Test.webp",
  weaponConfig:CONFIG_ARME_REFERENCE,
  armor:{ "Armure liee":"7ds-armures/Test.webp", Haut:"haut.webp" },
  armorConfig:{ "Armure liee":CONFIG_GRAVURE_REFERENCE, Haut:{ version:1 } }
};

const essai = creerEssaiEnchantements(HERO);
const modifie = remplacerConfigEssai(essai, "weapon", CONFIG_ARME_ESSAI);
const heroEssai = herosAvecEssaiEnchantements(HERO, modifie);

assert.deepEqual(HERO.weaponConfig, CONFIG_ARME_REFERENCE,
  "la reference ne doit pas recevoir l'essai d'arme");
assert.deepEqual(HERO.armorConfig["Armure liee"], CONFIG_GRAVURE_REFERENCE,
  "la reference ne doit pas recevoir l'essai de gravure");
assert.deepEqual(heroEssai.weaponConfig, CONFIG_ARME_ESSAI,
  "l'essai doit remplacer seulement la configuration d'arme");
assert.deepEqual(heroEssai.armorConfig["Armure liee"], CONFIG_GRAVURE_REFERENCE,
  "la gravure de reference doit rester intacte quand seule l'arme change");
assert.deepEqual(heroEssai.armorConfig.Haut, HERO.armorConfig.Haut,
  "une armure ordinaire ne fait pas partie de l'essai");
assert.equal(essaiEnchantementsDiffere(modifie), true,
  "une sous-stat differente doit activer la comparaison");
assert.deepEqual(reinitialiserEssaiEnchantements(modifie).essai, essai.reference,
  "reinitialiser doit restaurer les configurations exactes de reference");
assert.deepEqual(remplacerConfigEssai(essai, "bijou", CONFIG_ARME_ESSAI), essai,
  "une cle hors perimetre ne doit pas ajouter de source modifiable");

console.log("essai-enchantements.test.js OK");
