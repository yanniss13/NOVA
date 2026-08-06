"use strict";

/* Le module métier du wiki : regroupement par arme et ordre d'affichage.

   Il est lu ici en isolation, avec un faux catalogue posé sur un `window`
   fabriqué : c'est ce qui permet de tester l'ordre sans dépendre des données
   réelles, qui changent à chaque mise à jour du jeu. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
/* Les valeurs nées dans le contexte `vm` portent le prototype d'un AUTRE
   realm : `deepEqual` les refuse alors même que le contenu est identique.
   `plain` les ramène dans celui-ci. Les autres tests du dépôt font pareil. */
const { plain } = require("./helpers/load-app");

const RACINE = path.join(__dirname, "..");

function charger(catalogue){
  const source = fs
    .readFileSync(path.join(RACINE, "js", "metier", "wiki-competences.js"), "utf8")
    .replace(/export\s*\{[^}]*\};?/, "");
  const contexte = { window:{ SEVEN_DS_WIKI_COMPETENCES:catalogue } };
  vm.runInNewContext(
    source + "\nthis.__api = { competencesParArme, armesDuHeros };",
    contexte,
    { filename:"wiki-competences.js" }
  );
  return contexte.__api;
}

const competence = (gameId, weaponType, categorie) => ({
  gameId, weaponType, categorie,
  nomFr:gameId, descriptionFr:"desc", recharge:null
});

/* L'ordre d'affichage : passif, Q, E, R, TAG, attaque sautée. La source les
   publie dans un ordre quelconque — ici volontairement à l'envers. */
{
  const { competencesParArme } = charger({
    derieri:[
      competence("derieri_axe_jumpatk", "Axe", "NORMAL"),
      competence("derieri_axe_skill_tag", "Axe", "NORMAL"),
      competence("derieri_axe_skill_r", "Axe", "ULTIMATE"),
      competence("derieri_axe_skill_e", "Axe", "NORMAL"),
      competence("derieri_axe_skill_q", "Axe", "NORMAL"),
      competence("derieri_axe_passive", "Axe", "PASSIVE")
    ]
  });
  assert.deepEqual(
    plain(competencesParArme("derieri").Axe.map(c => c.gameId)),
    [
      "derieri_axe_passive",
      "derieri_axe_skill_q",
      "derieri_axe_skill_e",
      "derieri_axe_skill_r",
      "derieri_axe_skill_tag",
      "derieri_axe_jumpatk"
    ]
  );
}

/* Les suffixes composés du jeu — `skill_q_1`, `skill_r_enchant` — désignent
   bien la même touche et doivent se ranger au même endroit. */
{
  const { competencesParArme } = charger({
    derieri:[
      competence("derieri_gauntlets_skill_r_enchant", "Gauntlets", "ULTIMATE"),
      competence("derieri_gauntlets_skill_q_1", "Gauntlets", "NORMAL"),
      competence("derieri_gauntlets_passive", "Gauntlets", "PASSIVE")
    ]
  });
  assert.deepEqual(
    plain(competencesParArme("derieri").Gauntlets.map(c => c.gameId)),
    [
      "derieri_gauntlets_passive",
      "derieri_gauntlets_skill_q_1",
      "derieri_gauntlets_skill_r_enchant"
    ]
  );
}

/* Un suffixe inconnu est rangé en fin, jamais perdu : le wiki doit montrer
   une compétence inédite plutôt que la taire. */
{
  const { competencesParArme } = charger({
    derieri:[
      competence("derieri_axe_skill_inconnu", "Axe", "NORMAL"),
      competence("derieri_axe_passive", "Axe", "PASSIVE")
    ]
  });
  assert.deepEqual(
    plain(competencesParArme("derieri").Axe.map(c => c.gameId)),
    ["derieri_axe_passive", "derieri_axe_skill_inconnu"]
  );
}

// Le regroupement sépare bien les armes, et `armesDuHeros` suit l'ordre source.
{
  const { competencesParArme, armesDuHeros } = charger({
    derieri:[
      competence("derieri_gauntlets_passive", "Gauntlets", "PASSIVE"),
      competence("derieri_axe_passive", "Axe", "PASSIVE"),
      competence("derieri_gauntlets_skill_q", "Gauntlets", "NORMAL")
    ]
  });
  assert.deepEqual(plain(armesDuHeros("derieri")), ["Gauntlets", "Axe"]);
  assert.equal(competencesParArme("derieri").Gauntlets.length, 2);
  assert.equal(competencesParArme("derieri").Axe.length, 1);
}

/* Le catalogue arrive APRÈS l'évaluation des modules : tant qu'il manque, le
   site doit rester affichable plutôt que lever. */
{
  const { competencesParArme, armesDuHeros } = charger(undefined);
  assert.deepEqual(plain(competencesParArme("derieri")), {});
  assert.deepEqual(plain(armesDuHeros("derieri")), []);
}

// Un héros absent du catalogue ne lève pas non plus.
{
  const { competencesParArme, armesDuHeros } = charger({ derieri:[] });
  assert.deepEqual(plain(competencesParArme("inconnu")), {});
  assert.deepEqual(plain(armesDuHeros("inconnu")), []);
}

console.log("PASS wiki : regroupement et ordre des compétences");
