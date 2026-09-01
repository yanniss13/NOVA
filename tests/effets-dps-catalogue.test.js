"use strict";

/* Le catalogue commite est la seule source lue par la PWA. Ce test juge sa
   couverture sans toucher aux fiches publiques qui ont servi a le generer. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { loadApp, plain } = require("./helpers/load-app");

const racine = path.resolve(__dirname, "..");
const bac = { window:{} };
vm.runInNewContext(
  fs.readFileSync(path.join(racine, "data", "effets-dps.js"), "utf8"),
  bac,
  { filename:"effets-dps.js" }
);
const catalogue = bac.window.SEVEN_DS_EFFETS_DPS;
const bacCompetences = { window:{} };
vm.runInNewContext(
  fs.readFileSync(path.join(racine, "data", "competences.js"), "utf8"),
  bacCompetences,
  { filename:"competences.js" }
);

assert.equal(catalogue.version, 1);
assert.equal(catalogue.audit.inconnus, 0);
assert.ok(catalogue.audit.total > 700, "Le catalogue doit couvrir toutes les sources");
assert.ok(catalogue.heroes.merlin.Wand.potentials["10"]);
assert.ok(catalogue.skills.merlin_wand_divine_judgment);

const classifications = new Set([
  "modelise",
  "sans-impact-dps",
  "non-inclus"
]);
catalogue.audit.sources.forEach(source => {
  assert.ok(
    classifications.has(source.classification),
    source.id + " : classification inconnue"
  );
  source.regles.forEach(regle => {
    assert.equal(regle.sourceId, source.id, source.id + " : provenance perdue");
  });
});

assert.equal(
  catalogue.heroes.meliodas.Axe.passives.meliodas_axe_passive.regles[0].valeur,
  9000,
  "Les trois cumuls de Liberation infernale doivent etre actifs"
);

/* Une remise a zero de sa propre recharge existe vraiment sur Diane/Hache.
   Sans exclusion explicite, elle ramenait la recharge a 1 ms et faisait
   deborder la pile avant meme que la fiche puisse s'afficher. */
const dianeAxe = catalogue.heroes.diane.Axe;
const effetsDiane = [
  ...Object.values(dianeAxe.potentials),
  ...Object.values(dianeAxe.passives),
  ...Object.values(catalogue.skills).filter(source =>
    source.hero === "diane" && source.weaponType === "Axe"
  )
].filter(source => source.classification === "modelise");
const competencesDiane = bacCompetences.window.SEVEN_DS_COMPETENCES.diane
  .filter(competence => competence.weaponType === "Axe")
  .concat(Object.entries(catalogue.skills)
    .filter(([, source]) => source.hero === "diane"
      && source.weaponType === "Axe" && source.synthetic)
    .map(([gameId, source]) => Object.assign({ gameId }, plain(source))));
const simulationDiane = plain(loadApp().hooks.simulerDpsCompetences({
  stats:{
    atk:1000, def:500, maxHp:10000, remainingHp:10000,
    attaqueElementaire:0, element:"earth", critRate:0, critDamage:0,
    bonusCategorie:{ "normal-skill":0, special:0, ultimate:0 },
    bonusElementaire:0, bonusGlobal:0
  },
  competences:competencesDiane,
  effets:effetsDiane,
  cible:{
    def:5600, critResist:0, critDmgResist:0,
    resistanceElementaire:0, faiblesse:0
  },
  duree:60
}));
assert.ok(Number.isFinite(simulationDiane.dps));
assert.ok(simulationDiane.nonInclus.some(exclusion =>
  exclusion.id === "skill:diane_axe_skill_rmb_ready"
    && exclusion.raison === "reinitialisation-sans-animation-bornee"
));

/* ---- UN POTENTIEL DE BASE NE SE COMPTE QU'UNE FOIS. ----

   « Augmente l'attaque de X%, la défense de Y% et les PV max de Z% » est la
   forme de base des potentiels. Ces trois hausses arrivent au heros par
   `stats-calcul`, qui lit `potentialsByWeapon` dans data/stats-build.js et y
   replie `I_AtkAdd_Rate` sur `B_Atk`. Une regle `bonus-stat` posee EN PLUS
   dans le catalogue d'effets serait appliquee une seconde fois par
   `dps-effets`, qui fait `stats.atk *= 1 + taux` sur un total qui la contient
   deja.

   CE N'EST PAS UNE HYPOTHESE. Le cas s'est produit : trois heros
   — ban, derieri, gowther — sortent de `7ds-stats/personnages.json` avec
   `stats: []` sur leurs trente paliers. `generate-stats-build.py` reconstruit
   leurs chiffres depuis la prose, mais `generate-effets-dps.py` jugeait la
   couverture sur le champ `stats` reste vide : son garde ne se declenchait
   pas, et l'attaque de ces trois-la ressortait a x1,69 au lieu de x1,30 au
   palier 10.

   Ce test relit le catalogue commite — le seul que la PWA charge — et refuse
   qu'une forme de base porte la moindre regle de stat. Les effets
   CONDITIONNELS restent libres : « +20% de defense pendant 40s apres la
   competence normale » ne tombe pas dans cette forme et garde sa regle. */

const bacBuild = { window:{} };
vm.runInNewContext(
  fs.readFileSync(path.join(racine, "data", "stats-build.js"), "utf8"),
  bacBuild,
  { filename:"stats-build.js" }
);
const catalogueBuild = bacBuild.window.SEVEN_DS_BUILD_STATS.charactersBySlug;

/* La forme de base, telle que `POTENTIAL_BASE_FORM` la reconnait cote Python.
   Le balisage de couleur [#RRGGBB]…[-] est celui de data/potentiels.js. */
const FORME_DE_BASE =
  /Augmente l'attaque de \[#[0-9A-F]{6}\]\d+(?:[.,]\d+)?%\[-\]/i;
const STATS_DE_BASE = { atk:"I_AtkAdd_Rate", def:"I_DefAdd_Rate", maxHp:"I_MaxHpAdd_Rate" };

const doublons = [];
let formesDeBase = 0;
Object.entries(catalogue.heroes).forEach(([hero, armes]) => {
  Object.entries(armes).forEach(([arme, bloc]) => {
    Object.entries(bloc.potentials || {}).forEach(([palier, effet]) => {
      if(!FORME_DE_BASE.test(effet.texteFr || "")) return;
      formesDeBase++;
      (effet.regles || []).forEach(regle => {
        if(regle.type !== "bonus-stat") return;
        const code = STATS_DE_BASE[regle.stat];
        if(!code) return;
        const snapshot = ((catalogueBuild[hero] || {}).potentialsByWeapon
          || {})[arme];
        const ligne = Array.isArray(snapshot && snapshot[palier])
          ? snapshot[palier].find(item => item.stat === code)
          : null;
        doublons.push(
          hero + "/" + arme + " palier " + palier + " : regle " + regle.stat
            + "=" + regle.valeur + (ligne ? " alors que le catalogue porte "
              + code + "=" + ligne.value : " (stat de base)")
        );
      });
    });
  });
});

assert.ok(
  formesDeBase > 200,
  "La forme de base doit rester reconnue : " + formesDeBase + " paliers trouves"
);
assert.deepEqual(
  doublons, [],
  "Ces potentiels de forme de base comptent leur stat deux fois :\n  "
    + doublons.join("\n  ")
);

/* La contre-epreuve : le catalogue de build doit VRAIMENT porter ces hausses,
   sinon l'assertion ci-dessus passerait en ne prouvant que leur absence des
   deux cotes — et la hausse serait perdue au lieu d'etre doublee. */
const sansCouverture = [];
Object.entries(catalogue.heroes).forEach(([hero, armes]) => {
  Object.entries(armes).forEach(([arme, bloc]) => {
    Object.entries(bloc.potentials || {}).forEach(([palier, effet]) => {
      if(!FORME_DE_BASE.test(effet.texteFr || "")) return;
      const snapshot = ((catalogueBuild[hero] || {}).potentialsByWeapon
        || {})[arme];
      const ligne = Array.isArray(snapshot && snapshot[palier])
        ? snapshot[palier].find(item => item.stat === "I_AtkAdd_Rate")
        : null;
      if(!ligne || !Number(ligne.value)){
        sansCouverture.push(hero + "/" + arme + " palier " + palier);
      }
    });
  });
});
assert.deepEqual(
  sansCouverture, [],
  "Ces potentiels de forme de base n'apportent leur attaque par AUCUNE voie :\n  "
    + sansCouverture.join("\n  ")
);

console.log(
  "effets DPS : catalogue coherent (" + catalogue.audit.total + " sources, "
    + formesDeBase + " potentiels de forme de base comptes une seule fois)"
);
