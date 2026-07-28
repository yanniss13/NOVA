"use strict";

/* Contrat de forme du catalogue généré `stats-build.js`.
   Le moteur lève `BUILD_STAT_METADATA_MISSING` sur un code de stat absent de
   `statLabels` : mieux vaut l'attraper ici qu'à l'exécution chez un membre. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const sandbox = { window:{} };
vm.runInNewContext(
  fs.readFileSync(path.join(ROOT, "stats-build.js"), "utf8"),
  sandbox,
  { filename:"stats-build.js" }
);
const catalog = sandbox.window.SEVEN_DS_BUILD_STATS;

assert.equal(catalog.version, 1);
["weaponsByFile", "gearByFile", "engravedByFile", "gearSets", "statLabels"]
  .forEach(key => assert.ok(
    catalog[key] && typeof catalog[key] === "object",
    key + " doit exister dans le catalogue"
  ));

/* Les clés sont des chemins RELATIFS à la racine du dépôt : c'est ainsi que le
   site charge ses images. Un chemin absolu rendrait le catalogue inutilisable,
   divulguerait le chemin de la machine de génération, et ferait échouer
   `--check` en intégration continue. Ce contrôle manquait, et le défaut est
   passé. */
const ASSET_FOLDERS = ["7ds-armes/", "7ds-armures-ssr/", "7ds-bijoux/"];
["weaponsByFile", "gearByFile", "engravedByFile"].forEach(section => {
  Object.keys(catalog[section]).forEach(key => {
    assert.ok(
      ASSET_FOLDERS.some(folder => key.startsWith(folder)),
      section + " : clé hors dossier d'assets — " + key
    );
    assert.doesNotMatch(
      key,
      /^[A-Za-z]:|\\|^\/|\.\./,
      section + " : clé non relative — " + key
    );
    assert.ok(key.endsWith(".webp"), section + " : clé sans extension — " + key);
  });
});

const GAME_SLOTS = ["Top", "Bottom", "Belt", "Shoes", "Ring", "Necklace", "Earring"];
const gear = Object.entries(catalog.gearByFile);
assert.ok(gear.length > 50, "le catalogue doit contenir les pièces d'équipement");
gear.forEach(([file, entry]) => {
  assert.ok(
    GAME_SLOTS.includes(entry.slot),
    file + " : emplacement inconnu " + entry.slot
  );
  assert.ok(Number.isInteger(entry.qualityMin), file + " : qualityMin manquant");
  assert.ok(
    Number.isInteger(entry.qualityMax) && entry.qualityMax >= entry.qualityMin,
    file + " : bornes de qualité incohérentes"
  );
  assert.ok(Number.isInteger(entry.reinforceMax), file + " : reinforceMax manquant");
  assert.ok(Array.isArray(entry.tierBoundaries), file + " : bornes manquantes");
  /* La segmentation se déduit de la pièce : max(1, bornes − 1), vérifié sur les
     1 156 blocs de croissance des 312 pièces. Le nombre d'incréments doit
     suivre. */
  const segments = Math.max(1, entry.tierBoundaries.length - 1);
  [["mainValues", "mainAdd"], ["subValues", "subAdd"]].forEach(([values, add]) => {
    if(!entry[values]) return;
    assert.equal(
      entry[values].progression.length,
      segments,
      file + " : " + values + " ne suit pas la segmentation"
    );
    assert.ok(entry[add], file + " : " + add + " manquant alors que " + values + " existe");
    assert.equal(
      entry[add].progression.length,
      segments,
      file + " : " + add + " ne suit pas la segmentation"
    );
  });
  if(entry.setId){
    assert.ok(
      Object.prototype.hasOwnProperty.call(catalog.gearSets, entry.setId),
      file + " : ensemble " + entry.setId + " absent du catalogue"
    );
  }
});

const engraved = Object.entries(catalog.engravedByFile);
assert.ok(engraved.length > 50, "les équipements gravés doivent être présents");
engraved.forEach(([file, entry]) => {
  assert.ok(entry.character, file + " : équipement gravé sans personnage");
  assert.equal(entry.slot, "Armure liee", file + " : emplacement inattendu");
  /* Les gravures nomment leurs identifiants autrement que les armures et cachent
     leur plafond de renforcement dans `growth.promotion`. Sans ces trois champs,
     le moteur ne saurait ni les nommer ni les renforcer. */
  assert.ok(entry.slug, file + " : slug manquant");
  assert.ok(entry.grade, file + " : grade manquant");
  assert.ok(
    Number.isInteger(entry.reinforceMax) && entry.reinforceMax > 0,
    file + " : plafond de renforcement manquant"
  );
});

/* `extraStats` porte des contributions supplémentaires, avec leurs propres
   courbes. Les 145 des équipements gravés seraient sinon perdues, et chaque
   gravure sous-estimée. */
const withExtras = engraved.filter(([, entry]) => (entry.extraStats || []).length);
assert.ok(
  withExtras.length > 40,
  "les équipements gravés doivent porter leurs contributions supplémentaires "
  +"(" + withExtras.length + " en ont)"
);
gear.concat(engraved).forEach(([file, entry]) => {
  const segments = Math.max(1, entry.tierBoundaries.length - 1);
  (entry.extraStats || []).forEach(extra => {
    assert.ok(extra.stat, file + " : contribution sans code de stat");
    assert.equal(
      extra.values.progression.length,
      segments,
      file + " : " + extra.stat + " ne suit pas la segmentation"
    );
  });
});

/* Les seuils d'ensemble viennent des données : « 2 et 4 pièces » est un abus de
   langage. `twoCount` vaut 3 dans onze ensembles sur vingt-et-un. */
const sets = Object.entries(catalog.gearSets);
assert.ok(sets.length > 5, "les ensembles doivent être présents");
assert.ok(
  sets.some(([, entry]) => entry.twoCount !== 2),
  "au moins un ensemble ne s'active pas à deux pièces"
);
sets.forEach(([id, entry]) => {
  assert.ok(Number.isInteger(entry.twoCount), id + " : premier seuil manquant");
  assert.ok(
    Array.isArray(entry.twoStats) && entry.twoStats.length,
    id + " : premier palier sans stats"
  );
  [["fourCount", "fourStats"], ["sevenCount", "sevenStats"]]
    .forEach(([count, stats]) => {
      if(entry[count] === null || entry[count] === undefined){
        assert.equal(
          entry[stats],
          null,
          id + " : " + stats + " sans seuil correspondant"
        );
        return;
      }
      assert.ok(
        Array.isArray(entry[stats]) && entry[stats].length,
        id + " : " + count + " sans stats"
      );
    });
});

// Tout code cité doit avoir son libellé, sa famille et son unité.
const cited = new Set();
gear.concat(engraved).forEach(([, entry]) => {
  cited.add(entry.mainStat);
  if(entry.subStat) cited.add(entry.subStat);
  ((entry.randomOptions || {}).stats || []).forEach(item => cited.add(item.stat));
  (entry.extraStats || []).forEach(item => cited.add(item.stat));
});
sets.forEach(([, entry]) => {
  [entry.twoStats, entry.fourStats, entry.sevenStats].forEach(group => {
    (group || []).forEach(item => cited.add(item.stat));
  });
});
assert.ok(cited.size > 30, "le catalogue doit citer des codes de stat");
[...cited].sort().forEach(code => {
  const meta = catalog.statLabels[code];
  assert.ok(meta, "code sans métadonnée : " + code);
  assert.ok(meta.fr, code + " : libellé français manquant");
  assert.ok(
    meta.unit === "flat" || meta.unit === "ten-thousandths",
    code + " : unité invalide"
  );
  assert.ok(meta.family, code + " : famille manquante");
});

/* Aucune variante de casse ne doit subsister : le jeu écrit `B_MaxHp_Equip` et
   `B_MaxHP_Equip` pour la même stat, et deux entrées scinderaient le total. */
const byKey = new Map();
Object.keys(catalog.statLabels).forEach(code => {
  const key = code.toLowerCase().replace(/[^a-z0-9]+/g, "");
  byKey.set(key, (byKey.get(key) || []).concat(code));
});
const duplicates = [...byKey.values()].filter(codes => codes.length > 1);
assert.deepStrictEqual(
  duplicates,
  [],
  "variantes de casse non fusionnées : " + JSON.stringify(duplicates)
);

console.log("PASS catalogue de builds : équipement, gravures, ensembles");
