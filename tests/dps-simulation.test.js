"use strict";

const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app");

const { hooks } = loadApp();
const { simulerDpsCompetences } = hooks;

assert.equal(
  typeof simulerDpsCompetences,
  "function",
  "le simulateur temporel doit exister"
);

const CIBLE_NEUTRE = {
  def:5600,
  critResist:0,
  critDmgResist:0,
  resistanceElementaire:0,
  faiblesse:0
};
const SANS_CRITIQUE = {
  atk:1000,
  def:500,
  maxHp:10000,
  remainingHp:10000,
  attaqueElementaire:0,
  critRate:0,
  critDamage:0,
  bonusCategorie:{ "normal-skill":0, special:0, ultimate:0 },
  bonusElementaire:0,
  bonusGlobal:0
};

const resultat = simulerDpsCompetences({
  stats:SANS_CRITIQUE,
  competences:[{
    gameId:"skill-10",
    nom:"Toutes les dix secondes",
    categorie:"NORMAL_SKILL",
    recharge:10,
    composantes:[{ base:"atk", pourcentage:100 }],
    pourcentage:100,
    repartition:[100]
  }],
  effets:[],
  cible:CIBLE_NEUTRE,
  duree:60
});

assert.equal(resultat.rotation.filter(e => e.type === "action").length, 6);
assert.deepStrictEqual(
  Array.from(
    resultat.rotation.filter(e => e.type === "action").map(e => e.temps)
  ),
  [0, 10, 20, 30, 40, 50]
);
assert.equal(resultat.total, 3000);
assert.equal(resultat.dps, resultat.total / 60);

const periodic = simulerDpsCompetences({
  stats:SANS_CRITIQUE,
  competences:[{
    gameId:"zone",
    nom:"Zone",
    categorie:"ACTIVE_THIRD",
    recharge:58,
    composantes:[{ base:"atk", pourcentage:50 }],
    pourcentage:50,
    repartition:[],
    periodique:{
      base:"atk",
      pourcentageParTick:10,
      intervalle:1,
      duree:5,
      ticks:5
    }
  }],
  effets:[],
  cible:CIBLE_NEUTRE,
  duree:60
});

assert.equal(
  periodic.rotation.filter(e => e.type === "tick" && e.temps >= 58).length,
  1,
  "le tick a 60 s est hors fenetre"
);
assert.ok(periodic.rotation.some(e => e.type === "attente"));

const categories = simulerDpsCompetences({
  stats:Object.assign({}, SANS_CRITIQUE, {
    bonusCategorie:{ "normal-skill":1000, special:2000, ultimate:3000 }
  }),
  competences:[
    { gameId:"normal", nom:"Normal", categorie:"NORMAL_SKILL", recharge:60,
      composantes:[{ base:"atk", pourcentage:100 }] },
    { gameId:"special", nom:"Special", categorie:"ACTIVE_THIRD", recharge:60,
      composantes:[{ base:"atk", pourcentage:100 }] },
    { gameId:"ultimate", nom:"Ultimate", categorie:"ULTIMATE", recharge:60,
      composantes:[{ base:"atk", pourcentage:100 }] },
    { gameId:"tag", nom:"Releve", categorie:"TAG", recharge:1,
      composantes:[{ base:"atk", pourcentage:9999 }] }
  ],
  effets:[],
  cible:CIBLE_NEUTRE,
  duree:60
});

assert.equal(categories.total, 600 + 550 + 650);
assert.equal(categories.nonInclus.length, 1, "la releve ne doit pas entrer dans le DPS");
assert.deepStrictEqual(
  Array.from(
    categories.rotation.filter(e => e.type === "action").map(e => e.gameId)
  ),
  ["ultimate", "special", "normal"],
  "a temps egal, la competence la plus forte passe en premier"
);

const normal = {
  gameId:"normal",
  nom:"Frappe",
  categorie:"NORMAL_SKILL",
  recharge:10,
  composantes:[{ base:"atk", pourcentage:100 }],
  pourcentage:100
};
const special = {
  gameId:"buff",
  nom:"Buff",
  categorie:"ACTIVE_THIRD",
  recharge:20,
  composantes:[{ base:"atk", pourcentage:1 }],
  pourcentage:1
};
const divine = {
  gameId:"divine",
  nom:"Divine",
  categorie:"NORMAL_SKILL",
  recharge:10,
  composantes:[{ base:"atk", pourcentage:200 }],
  pourcentage:200,
  synthetique:true
};
const lancer = (competences, effets, duree) => simulerDpsCompetences({
  stats:SANS_CRITIQUE,
  competences,
  effets,
  cible:CIBLE_NEUTRE,
  duree:duree || 20
});
const tempsActions = (simulation, id) => Array.from(
  simulation.rotation
    .filter(e => e.type === "action" && e.gameId === id)
    .map(e => e.temps)
);

const reduction = lancer([normal], [
  { type:"recharge-plate", cible:"normal-skill", secondes:4 }
]);
assert.deepStrictEqual(tempsActions(reduction, "normal"), [0, 6, 12, 18]);

const reductionNonDeclenchee = lancer([normal], [{
  id:"skill:jump",
  origine:"skill",
  regles:[{
    type:"recharge-plate",
    cible:"normal-skill",
    secondes:4,
    sourceId:"skill:jump"
  }]
}]);
assert.deepStrictEqual(
  tempsActions(reductionNonDeclenchee, "normal"),
  [0, 10],
  "la reduction portee par une attaque absente ne devient pas un bonus permanent"
);

const buffAvantFrappe = lancer([normal, special], [{
  type:"bonus-degats",
  cible:"normal-skill",
  valeur:5000,
  declencheur:"buff",
  duree:5
}]);
assert.deepStrictEqual(
  Array.from(buffAvantFrappe.ouverture.slice(0, 2).map(a => a.gameId)),
  ["buff", "normal"]
);

const transformation = lancer([normal, special, divine], [{
  type:"deblocage-competence",
  declencheur:"buff",
  competence:"divine",
  duree:7
}]);
assert.ok(tempsActions(transformation, "divine").some(t => t < 7));
assert.ok(tempsActions(transformation, "normal").some(t => t >= 7));

const attenteRentable = lancer([
  normal,
  Object.assign({}, special, { recharge:9 })
], [{
  type:"bonus-degats",
  cible:"normal-skill",
  valeur:10000,
  declencheur:"buff",
  duree:0.5
}], 20);
assert.equal(
  attenteRentable.total,
  2015,
  "l'optimiseur doit pouvoir attendre une frappe pour aligner un buff court"
);
assert.equal(
  attenteRentable.rotation.filter(e => e.type === "action"
    && e.gameId === "normal")[1].total,
  1000
);

const tauxProprietaireAbsent = lancer([normal], [{
  id:"skill:jump",
  origine:"skill",
  regles:[{
    type:"recharge-taux",
    cible:"normal-skill",
    valeur:10000,
    sourceId:"skill:jump"
  }]
}]);
assert.deepStrictEqual(
  tempsActions(tauxProprietaireAbsent, "normal"),
  [0, 10],
  "une remise a zero portee par une attaque absente doit etre exclue"
);
assert.ok(tauxProprietaireAbsent.nonInclus.some(exclusion =>
  exclusion.raison === "competence-source-non-simulee"
));

const tauxDeclenche = lancer([normal, special], [{
  id:"engraving:test:cooldown",
  regles:[{
    type:"recharge-taux",
    cible:"normal-skill",
    valeur:5000,
    declencheur:"special",
    rechargeInterne:20,
    sourceId:"engraving:test:cooldown"
  }]
}], 25);
assert.deepStrictEqual(
  tempsActions(tauxDeclenche, "normal"),
  [0, 5, 15, 22.5],
  "le taux reduit la recharge restante au declenchement, pas sa duree de base"
);

const resetSansBorne = lancer([normal], [{
  id:"skill:normal",
  origine:"skill",
  regles:[{
    type:"recharge-taux",
    cible:"self",
    valeur:10000,
    sourceId:"skill:normal"
  }]
}], 20);
assert.deepStrictEqual(tempsActions(resetSansBorne, "normal"), [0, 10]);
assert.ok(resetSansBorne.nonInclus.some(exclusion =>
  exclusion.raison === "reinitialisation-sans-animation-bornee"
));

const declencheurExterneInconnu = lancer([normal], [{
  id:"potential:test:burst",
  regles:[{
    type:"recharge-taux",
    cible:"normal-skill",
    valeur:5000,
    declencheur:"condition-max",
    sourceId:"potential:test:burst"
  }]
}], 20);
assert.ok(declencheurExterneInconnu.nonInclus.some(exclusion =>
  exclusion.raison === "declencheur-externe-non-planifiable"
));

const effetsCible = lancer([normal], [{
  id:"passif:cible",
  regles:[
    { type:"bonus-stat", stat:"targetDefRate", valeur:-5000 },
    { type:"bonus-critique", stat:"targetCritResist", valeur:-1000 },
    { type:"bonus-critique", stat:"targetCritDmgResist", valeur:-1000 },
    { type:"resistance-elementaire", element:"all", valeur:-1000 }
  ]
}], 10);
assert.ok(effetsCible.total > lancer([normal], [], 10).total);
assert.equal(effetsCible.nonInclus.length, 0);

const formuleInconnue = lancer([normal], [{
  id:"passif:perforation",
  regles:[{ type:"bonus-stat", stat:"pierce", valeur:2000 }]
}], 10);
assert.ok(formuleInconnue.nonInclus.some(exclusion =>
  exclusion.raison === "formule-offensive-inconnue"
));
assert.ok(!formuleInconnue.couverture.includes("passif:perforation"));

const zoneCumuls = {
  gameId:"zone",
  nom:"Zone",
  categorie:"ACTIVE_THIRD",
  recharge:60,
  composantes:[{ base:"atk", pourcentage:1 }],
  pourcentage:1,
  periodique:{
    base:"atk", pourcentageParTick:1, intervalle:1, duree:5, ticks:5
  }
};
const avecCumuls = lancer([normal, zoneCumuls], [{
  id:"skill:zone",
  origine:"skill",
  regles:[{
    type:"cumul-degats",
    cible:"normal-skill",
    valeurParCumul:1000,
    cumulsMax:2,
    declencheur:"tick",
    duree:20,
    sourceId:"skill:zone"
  }]
}], 20);
assert.ok(
  avecCumuls.rotation.find(e => e.type === "action"
    && e.gameId === "normal" && e.temps === 10).total
    > lancer([normal, zoneCumuls], [], 20).rotation.find(e =>
      e.type === "action" && e.gameId === "normal" && e.temps === 10
    ).total,
  "les impacts du Champ doivent construire le cumul de degats de Merlin"
);

const ordreCausal = lancer([
  normal,
  Object.assign({}, zoneCumuls, {
    periodique:{
      base:"atk", pourcentageParTick:1, intervalle:1, duree:5, ticks:5
    }
  })
], [{
  id:"skill:zone",
  origine:"skill",
  regles:[{
    type:"recharge-par-impact",
    cible:"normal-skill",
    secondes:1,
    declencheur:"tick",
    sourceId:"skill:zone"
  }]
}], 11);
const aCinqSecondes = ordreCausal.rotation.filter(e => e.temps === 5);
assert.deepStrictEqual(
  Array.from(aCinqSecondes.map(e => e.type)),
  ["tick", "action"],
  "la chronologie doit montrer le tick avant l'action qu'il debloque"
);

const aucuneAction = lancer([{
  gameId:"tag",
  nom:"Releve",
  categorie:"TAG",
  recharge:10,
  composantes:[{ base:"atk", pourcentage:100 }]
}], [], 20);
assert.equal(aucuneAction.dps, null, "une simulation inconnue ne vaut pas zero");
assert.deepStrictEqual(Array.from(aucuneAction.couverture), []);

assert.equal(
  JSON.stringify(lancer([normal, special], [])),
  JSON.stringify(lancer([normal, special], [])),
  "une meme entree doit produire une rotation stable"
);

/* Un degat additionnel invoque par l'ultime ne vaut RIEN quand l'ultime
   lui-meme n'est pas simulable - sur le Baton de Merlin ses degats ne sont
   pas chiffres, il est deja ecarte. La regle doit alors etre annoncee, jamais
   rester inerte en silence : c'est tout l'ecart entre « cet effet n'a pas ete
   compte » et « cet effet ne rapporte rien ». */
const ultime = {
  gameId:"ultime",
  nom:"Ultime",
  categorie:"ULTIMATE",
  recharge:10,
  composantes:[{ base:"atk", pourcentage:100 }],
  pourcentage:100
};
const meteore = [{
  id:"potential:essai:Staff:9",
  origine:"potential",
  regles:[{
    type:"degats-additionnels",
    composantes:[{ base:"atk", pourcentage:150 }],
    declencheur:"ultimate",
    sourceId:"potential:essai:Staff:9"
  }]
}];
const ultimeAbsent = lancer([normal], meteore);
assert.ok(
  ultimeAbsent.nonInclus.some(exclusion =>
    exclusion.id === "potential:essai:Staff:9"
      && exclusion.raison === "declencheur-absent-de-la-rotation"
  ),
  "une regle dont le declencheur n'est jamais joue doit etre annoncee"
);

const ultimePresent = lancer([normal, ultime], meteore);
assert.ok(
  !ultimePresent.nonInclus.some(e => e.id === "potential:essai:Staff:9"),
  "avec son ultime simule, la regle ne doit plus etre exclue"
);
assert.ok(
  ultimePresent.total > lancer([normal, ultime], []).total,
  "avec son declencheur joue, la regle doit reellement ajouter des degats"
);

console.log("dps-simulation.test.js OK");
