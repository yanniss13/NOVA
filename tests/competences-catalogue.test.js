"use strict";

/* Le catalogue commite doit rester exploitable sans reseau. Ce test le lit
   comme le navigateur : un simple fichier de donnees.

   Il ne re-aspire RIEN. `generate-competences.py --check` verifie la presence
   du fichier ; la coherence de son contenu se juge ici, hors ligne. Faire
   autrement rendrait `npm test` dependant d'un site tiers. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const racine = path.join(__dirname, "..");
const bac = { window:{} };
vm.runInNewContext(
  fs.readFileSync(path.join(racine, "data", "competences.js"), "utf8"),
  bac
);
const catalogue = bac.window.SEVEN_DS_COMPETENCES;

assert.ok(catalogue, "Le catalogue doit s'exposer sur window");
const slugs = Object.keys(catalogue);
assert.ok(
  slugs.length >= 20,
  "Le catalogue doit couvrir les personnages du jeu, recu : " + slugs.length
);

/* Les types d'arme doivent parler le vocabulaire du depot, sinon aucune
   competence ne se rattachera jamais a un build du roster. */
const source = fs.readFileSync(
  path.join(racine, "js", "noyau", "constantes.js"), "utf8"
);
const bloc = source.slice(
  source.indexOf("const FOLDER_TO_ENUM"),
  source.indexOf("const ENUM_TO_FOLDER")
);
const enums = new Set([...bloc.matchAll(/:\s*"([A-Za-z0-9]+)"/g)].map(m => m[1]));
assert.ok(enums.size >= 12, "FOLDER_TO_ENUM doit avoir ete lu, recu : " + enums.size);

const NATURES = new Set(["direct", "duree", "non-chiffree"]);
let total = 0;
let chiffrees = 0;
const parCouple = new Map();
slugs.forEach(slug => {
  catalogue[slug].forEach(competence => {
    total += 1;
    assert.ok(
      enums.has(competence.weaponType),
      slug + " : type d'arme inconnu de FOLDER_TO_ENUM -> " + competence.weaponType
    );
    assert.notStrictEqual(
      competence.categorie, "PASSIVE",
      slug + " : un passif ne doit pas entrer dans le catalogue de calcul"
    );
    assert.ok(
      NATURES.has(competence.nature),
      slug + " : nature inconnue sur " + competence.nom + " -> " + competence.nature
    );
    assert.ok(
      competence.recharge === null
        || (typeof competence.recharge === "number" && competence.recharge > 0),
      slug + " : recharge non exploitable sur " + competence.nom
    );
    assert.ok(
      Array.isArray(competence.composantes),
      slug + " : composantes absentes sur " + competence.nom
    );
    competence.composantes.forEach(composante => {
      assert.ok(
        ["atk", "def", "maxHp", "remainingHp"].includes(composante.base),
        slug + " : base inconnue sur " + competence.nom + " -> " + composante.base
      );
      assert.ok(
        typeof composante.pourcentage === "number" && composante.pourcentage > 0,
        slug + " : composante non exploitable sur " + competence.nom
      );
    });
    if(competence.periodique){
      assert.ok(
        competence.periodique.intervalle > 0 && competence.periodique.duree > 0,
        slug + " : temporalite periodique invalide sur " + competence.nom
      );
      assert.strictEqual(
        competence.periodique.ticks,
        Math.floor(
          competence.periodique.duree / competence.periodique.intervalle
        ),
        slug + " : nombre de ticks incoherent sur " + competence.nom
      );
    }
    /* Une donnee absente vaut null, jamais zero : un zero se propagerait dans
       la somme du cycle sans que personne ne le remarque. */
    if(competence.nature === "non-chiffree"){
      assert.strictEqual(
        competence.pourcentage, null,
        slug + " : une competence non chiffree ne porte aucun nombre -> "
          + competence.nom
      );
      return;
    }
    assert.ok(
      typeof competence.pourcentage === "number" && competence.pourcentage > 0,
      slug + " : pourcentage non exploitable sur " + competence.nom
    );
    chiffrees += 1;
    const couple = slug + "|" + competence.weaponType;
    parCouple.set(couple, (parCouple.get(couple) || 0) + 1);
  });
});

assert.ok(total >= 300, "Catalogue anormalement maigre, recu : " + total);
assert.ok(
  chiffrees >= 250,
  "Trop de competences echappent au calcul, chiffrees : " + chiffrees
);

/* Le classement compare des ARMES entre elles. Un couple (personnage, arme)
   qui ne porterait qu'une competence chiffree perdrait d'office contre un
   couple qui en porte cinq, et l'ecart mesurerait la couverture du catalogue
   plutot que la puissance du build. C'est exactement le contresens qu'un
   membre a releve : sa Merlin foudre, deux competences retenues sur cinq,
   passait pour deux fois plus faible que sa Merlin glace. */
const maigres = [...parCouple].filter(([, n]) => n < 3).map(([c]) => c);
assert.ok(
  maigres.length <= 6,
  "Trop de couples (perso, arme) sous-couverts : " + maigres.join(", ")
);

/* Gowther n'avait AUCUNE competence chiffree tant qu'on ne lisait que le
   champ `damagePercent` : la source le laisse a null pour toutes les siennes.
   Ses degats sont dans le texte, et il doit desormais se classer comme les
   autres. */
assert.ok(
  catalogue.gowther.some(c => c.nature !== "non-chiffree"),
  "Gowther doit porter des competences chiffrees, lues dans les descriptions"
);

/* Les deux gros coups de la Merlin foudre, absents du premier catalogue. */
const baguette = catalogue.merlin.filter(c => c.weaponType === "Wand");
const foudre = baguette.find(c => c.nom === "Judgment of Thunder");
assert.ok(foudre, "Merlin/Baguette doit porter Judgment of Thunder");
assert.strictEqual(
  foudre.pourcentage, 159,
  "Judgment of Thunder vaut 159 % de l'ATK, recu : " + foudre.pourcentage
);
assert.ok(
  baguette.some(c => c.nom === "Plasma Dome: Overload" && c.pourcentage === 406),
  "Merlin/Baguette doit porter son ultime a 406 %"
);
assert.strictEqual(
  baguette.find(c => c.gameId === "merlin_wand_skill_e_enchant").recharge,
  19.9,
  "Judgment of Thunder doit conserver son CD combat precis"
);
assert.strictEqual(
  baguette.find(c => c.gameId === "merlin_wand_skill_q").recharge,
  16.5,
  "Electromagnetic Field doit conserver son CD combat precis"
);

assert.strictEqual(
  catalogue.meliodas.find(
    c => c.gameId === "meliodas_axe_skill_rmb_ready"
  ).pourcentage,
  442,
  "La charge maximale de Meliodas vaut 140 % + 302 %, pas les coups tronques"
);

console.log(
  "competences : catalogue coherent (" + slugs.length + " personnages, "
  + total + " competences dont " + chiffrees + " chiffrees)"
);
