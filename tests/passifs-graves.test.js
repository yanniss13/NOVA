"use strict";

/* La table des passifs de tenue gravee est ECRITE A LA MAIN. Ce test tient
   lieu de generateur.

   Sa regle centrale : la PHRASE citee est choisie pour que le nombre qui la
   suit immediatement SOIT la valeur stockee. Le test la cherche dans le texte
   de chacun des trois niveaux et compare. Sans cela, rien n'empecherait
   d'attribuer a un effet la valeur d'un autre - ces passifs en portent deux ou
   trois chacun - et l'erreur serait muette : aucun test ne casse, seuls les
   degats sont faux. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const racine = path.join(__dirname, "..");

function catalogueDe(fichier, cle){
  const bac = { window:{} };
  vm.runInNewContext(
    fs.readFileSync(path.join(racine, "data", fichier), "utf8"), bac
  );
  return bac.window[cle];
}

const TABLE = catalogueDe("passifs-graves.js", "SEVEN_DS_PASSIFS_GRAVES");
const GRAVEES = catalogueDe("stats-build.js", "SEVEN_DS_BUILD_STATS")
  .engravedByFile;
const LIBELLES = JSON.parse(fs.readFileSync(
  path.join(racine, "7ds-stats", "libelles-stats.json"), "utf8"
));

const nu = texte => (texte || "").replace(/\[#?[0-9A-Fa-f-]*\]/g, "");
const identifiants = new Set();
let lignes = 0;

Object.keys(TABLE).forEach(fichier => {
  const tenue = GRAVEES[fichier];
  assert.ok(tenue, "tenue inconnue du catalogue : " + fichier);
  const niveaux = tenue.passiveLevels || [];
  assert.equal(niveaux.length, 3,
    fichier + " : trois niveaux de passif attendus, recu " + niveaux.length);

  TABLE[fichier].forEach(passif => {
    lignes++;
    assert.ok(!identifiants.has(passif.id),
      "identifiant en double : " + passif.id);
    identifiants.add(passif.id);

    /* Une entree porte SOIT un code de stat du heros, SOIT un effet sur la
       cible. Jamais les deux, jamais aucun : sans cette exclusion, une ligne
       mal ecrite tomberait dans la branche permissive et passerait. */
    const surLaCible = Object.prototype.hasOwnProperty.call(passif, "effet");
    assert.notEqual(surLaCible,
      Object.prototype.hasOwnProperty.call(passif, "stat"),
      passif.id + " : une entree porte `stat` OU `effet`, exactement un des deux");
    if(surLaCible){
      assert.ok(["defense", "defenseCritique"].includes(passif.effet),
        passif.id + " : effet inconnu sur la cible -> " + passif.effet);
      assert.equal(passif.cibleEnnemi, true,
        passif.id + " : un malus sur la cible doit porter cibleEnnemi:true");
    }else{
      assert.ok(Object.prototype.hasOwnProperty.call(LIBELLES, passif.stat),
        passif.id + " : code de stat inconnu du depot -> " + passif.stat);
    }

    assert.ok(["soi", "allies"].includes(passif.cible),
      passif.id + " : cible doit valoir \"soi\" ou \"allies\"");
    assert.ok(["add", "multiply"].includes(passif.operation),
      passif.id + " : operation invalide -> " + passif.operation);
    assert.ok(["flat", "ten-thousandths"].includes(passif.unite),
      passif.id + " : unite invalide -> " + passif.unite);
    assert.ok(passif.libelle && passif.libelle.trim(),
      passif.id + " : un passif sans libelle est illisible a l'ecran");
    assert.equal(passif.niveaux.length, 3,
      passif.id + " : trois valeurs attendues, une par niveau");
    assert.ok(passif.niveaux.every(v => typeof v === "number" && v > 0),
      passif.id + " : une valeur absente s'omet, elle ne vaut jamais zero");

    /* LA garde. Pour chacun des trois niveaux : la phrase citee doit etre un
       extrait litteral du texte de CE niveau, y apparaitre EXACTEMENT une
       fois - sinon on ne saurait pas de quel nombre on parle - et le nombre
       qui la suit doit valoir la valeur stockee. */
    niveaux.forEach((source, index) => {
      const texte = nu(source.textFr);
      const morceaux = texte.split(passif.provenance.phrase);
      assert.equal(morceaux.length, 2,
        passif.id + " : la phrase doit apparaitre EXACTEMENT une fois au "
          + "niveau " + source.level + ", trouvee " + (morceaux.length - 1)
          + " fois\n  cherche : " + passif.provenance.phrase);
      const trouve = /^(-?\d+(?:[.,]\d+)?)\s*%?/.exec(morceaux[1]);
      assert.ok(trouve && trouve[1],
        passif.id + " : aucun nombre ne suit la phrase au niveau "
          + source.level);
      const lu = Number(trouve[1].replace(",", "."));
      const attendu = passif.unite === "ten-thousandths"
        ? passif.niveaux[index] / 100
        : passif.niveaux[index];
      assert.equal(lu, attendu,
        passif.id + " : niveau " + source.level + ", le texte annonce " + lu
          + " et la table stocke " + attendu);
    });
  });
});

/* Dix-sept tenues sur les vingt-six passifs offensifs « sur soi ». Les neuf
   autres sont NOMMEES dans l'en-tete de data/passifs-graves.js avec la raison
   de leur absence - un seau qui manque au moteur, ou une valeur que la garde
   refuse de laisser designer. Ce compte empeche qu'un oubli passe inapercu, et
   il devra monter le jour ou l'un de ces seaux existera. */
assert.equal(Object.keys(TABLE).length, 17,
  "17 tenues attendues dans ce lot, recu " + Object.keys(TABLE).length);

console.log("passifs-graves.test.js OK (" + lignes + " lignes sur "
  + Object.keys(TABLE).length + " tenues)");
