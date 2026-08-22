"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
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


/* Le verrouillage d'animation. Une competence a 10 s de recharge et 4 s
   d'animation ne se rejoue pas toutes les 10 s : la recharge court depuis le
   lancement, mais le heros reste occupe jusqu'a 4 s. Ici la recharge est plus
   longue que l'animation, les instants ne bougent donc pas — c'est le cas
   suivant, ou l'animation depasse la recharge, qui les deplace. */
{
  const competence = {
    gameId:"skill-3",
    nom:"Trois secondes de recharge",
    categorie:"NORMAL_SKILL",
    recharge:3,
    composantes:[{ base:"atk", pourcentage:100 }],
    pourcentage:100,
    repartition:[100]
  };
  const entree = animations => simulerDpsCompetences({
    stats:SANS_CRITIQUE,
    competences:[competence],
    effets:[],
    cible:CIBLE_NEUTRE,
    duree:60,
    animations
  });

  const sansMesure = entree(undefined);
  /* `Array.from` recopie dans ce realm : la rotation sort du bac a sable,
     et deepStrictEqual compare aussi les prototypes. */
  const instants = resultat => Array.from(resultat.rotation
    .filter(evenement => evenement.type === "action")
    .map(evenement => evenement.temps));
  assert.deepStrictEqual(instants(sansMesure).slice(0, 3), [0, 3, 6]);
  assert.equal(sansMesure.animations.mesurees, 0);
  assert.equal(sansMesure.animations.total, 1);
  assert.ok(
    sansMesure.hypotheses.includes("animations-non-mesurees"),
    "sans mesure, le resultat doit continuer a le dire"
  );

  /* 5 s d'animation contre 3 s de recharge : c'est l'animation qui commande,
     et le nombre d'actions dans la fenetre chute. */
  const mesuree = entree({ "skill-3":5 });
  assert.deepStrictEqual(instants(mesuree).slice(0, 3), [0, 5, 10]);
  assert.ok(
    mesuree.total < sansMesure.total,
    "une animation mesuree ne peut que reduire un DPS calcule sans elle"
  );
  assert.equal(mesuree.animations.mesurees, 1);
  assert.ok(
    !mesuree.hypotheses.includes("animations-non-mesurees"),
    "toutes les animations mesurees, la reserve n'a plus lieu d'etre"
  );

  /* Une mesure pour une competence absente de la rotation ne compte pas :
     le rapport doit parler des competences simulees, pas de la table. */
  const etrangere = entree({ "skill-inconnue":5 });
  assert.equal(etrangere.animations.mesurees, 0);
  assert.deepStrictEqual(instants(etrangere).slice(0, 3), [0, 3, 6]);
}

/* Les actions sans recharge ne sont planifiables qu'avec une animation
   mesuree qui borne leur frequence. Une normale sans mesure reste donc hors
   calcul, tandis qu'une mesure d'une seconde ouvre les instants 0, 1 et 2. */
{
  const attaqueNormale = {
    gameId:"auto", nom:"Auto-attaque", categorie:"NORMAL", recharge:0,
    composantes:[{ base:"atk", pourcentage:100 }], pourcentage:100
  };
  const sansAnimation = lancer([attaqueNormale], [], 3);
  assert.equal(sansAnimation.dps, null);
  assert.ok(sansAnimation.nonInclus.some(e =>
    e.id === "auto" && e.raison === "categorie-ou-recharge-non-modelisee"
  ));

  const avecAnimation = simulerDpsCompetences({
    stats:SANS_CRITIQUE, competences:[attaqueNormale],
    effets:[], cible:CIBLE_NEUTRE, duree:3, animations:{ auto:1 }
  });
  assert.deepStrictEqual(
    Array.from(avecAnimation.rotation.filter(e => e.type === "action").map(e => e.temps)),
    [0, 1, 2]
  );
  assert.equal(avecAnimation.animations.mesurees, 1);
  assert.equal(avecAnimation.animations.total, 1);
  assert.ok(!avecAnimation.hypotheses.includes("attaques-normales-non-chiffrees"));
  assert.ok(!avecAnimation.priorites.includes("Attaques normales pendant l'attente"),
    "le verrou d'une normale déjà modélisée n'est pas une attente libre");
}

/* ACTIVE_THIRD est le seul autre cas sans recharge borne par une animation
   mesuree : la rotation peut la rejouer exactement a la fin de celle-ci. */
{
  const speciale = {
    gameId:"speciale-zero", nom:"Spéciale", categorie:"ACTIVE_THIRD",
    recharge:0, composantes:[{ base:"atk", pourcentage:100 }], pourcentage:100
  };
  const simulation = simulerDpsCompetences({
    stats:SANS_CRITIQUE, competences:[speciale], effets:[],
    cible:CIBLE_NEUTRE, duree:2, animations:{ "speciale-zero":0.5 }
  });
  assert.deepStrictEqual(
    Array.from(simulation.rotation.filter(e => e.type === "action").map(e => e.temps)),
    [0, 0.5, 1, 1.5]
  );
}

/* La relève n'est jamais simulee isolément, même lorsqu'une animation
   bornerait sa frequence : l'exclusion doit le dire explicitement. */
{
  const releve = simulerDpsCompetences({
    stats:SANS_CRITIQUE,
    competences:[{
      gameId:"tag", nom:"Relève", categorie:"TAG_SKILL", recharge:0,
      composantes:[{ base:"atk", pourcentage:100 }], pourcentage:100
    }],
    effets:[], cible:CIBLE_NEUTRE, duree:3, animations:{ tag:1 }
  });
  assert.equal(releve.dps, null);
  assert.ok(releve.nonInclus.some(e =>
    e.id === "tag" && e.raison === "releve-hors-simulation-equipe"
  ));
}

/* Une auto disponible ne doit pas masquer le prochain gros cooldown :
   l'optimiseur compare aussi l'attente jusqu'au burst à 5 s. */
{
  const simulation = simulerDpsCompetences({
    stats:SANS_CRITIQUE,
    competences:[
      { gameId:"auto-cadence", nom:"Auto", categorie:"NORMAL", recharge:0,
        composantes:[{ base:"atk", pourcentage:100 }], pourcentage:100 },
      { gameId:"burst-cadence", nom:"Burst", categorie:"NORMAL_SKILL", recharge:5,
        composantes:[{ base:"atk", pourcentage:1000 }], pourcentage:1000 }
    ],
    effets:[], cible:CIBLE_NEUTRE, duree:6, animations:{ "auto-cadence":2 }
  });
  assert.deepStrictEqual(tempsActions(simulation, "burst-cadence"), [0, 5]);
  assert.ok(
    simulation.rotation.filter(e => e.type === "action").length <= 5,
    "l'attente et les candidats dédupliqués ne doivent pas exploser la rotation"
  );
}

/* Le catalogue appelle la catégorie interne `normal` « normal-attack » :
   cette forme doit être couverte et ajouter ses +50 % à chaque auto. */
{
  const simulation = simulerDpsCompetences({
    stats:SANS_CRITIQUE,
    competences:[{
      gameId:"auto-bonus", nom:"Auto", categorie:"NORMAL", recharge:0,
      composantes:[{ base:"atk", pourcentage:100 }], pourcentage:100
    }],
    effets:[{
      id:"bonus-normal-attack",
      regles:[{ type:"bonus-degats", cible:"normal-attack", valeur:5000 }]
    }],
    cible:CIBLE_NEUTRE, duree:6, animations:{ "auto-bonus":2 }
  });
  assert.deepStrictEqual(
    Array.from(simulation.rotation.filter(e => e.type === "action").map(e => e.total)),
    [750, 750, 750]
  );
  assert.ok(!simulation.nonInclus.some(e =>
    e.id === "bonus-normal-attack:bonus-degats:0"
  ));
}

/* Une animation mesurée doit être finie et strictement positive. Les valeurs
   invalides ne déverrouillent pas une auto, ni ne bloquent une recharge. */
{
  const auto = {
    gameId:"auto-invalide", nom:"Auto", categorie:"NORMAL", recharge:0,
    composantes:[{ base:"atk", pourcentage:100 }], pourcentage:100
  };
  [0, Infinity, NaN].forEach(animation => {
    const simulation = simulerDpsCompetences({
      stats:SANS_CRITIQUE, competences:[auto], effets:[], cible:CIBLE_NEUTRE,
      duree:3, animations:{ "auto-invalide":animation }
    });
    assert.equal(simulation.dps, null);
    assert.equal(simulation.animations.mesurees, 0);
    assert.ok(simulation.nonInclus.some(e => e.id === "auto-invalide"));
  });

  const rechargee = simulerDpsCompetences({
    stats:SANS_CRITIQUE,
    competences:[{
      gameId:"recharge-infinie", nom:"Recharge", categorie:"NORMAL_SKILL", recharge:1,
      composantes:[{ base:"atk", pourcentage:100 }], pourcentage:100
    }],
    effets:[], cible:CIBLE_NEUTRE, duree:3,
    animations:{ "recharge-infinie":Infinity }
  });
  assert.deepStrictEqual(tempsActions(rechargee, "recharge-infinie"), [0, 1, 2]);
  assert.equal(rechargee.animations.mesurees, 0);
}

/* Une auto qui finit exactement au retour du cooldown ne le retarde pas. */
{
  const frontiere = simulerDpsCompetences({
    stats:SANS_CRITIQUE,
    competences:[
      { gameId:"auto-frontiere", nom:"Auto", categorie:"NORMAL", recharge:0,
        composantes:[{ base:"atk", pourcentage:100 }], pourcentage:100 },
      { gameId:"burst-frontiere", nom:"Burst", categorie:"NORMAL_SKILL", recharge:6,
        composantes:[{ base:"atk", pourcentage:1000 }], pourcentage:1000 }
    ],
    effets:[], cible:CIBLE_NEUTRE, duree:7,
    animations:{ "auto-frontiere":2 }
  });
  assert.deepStrictEqual(tempsActions(frontiere, "auto-frontiere"), [0, 2, 4, 6]);
  assert.deepStrictEqual(tempsActions(frontiere, "burst-frontiere"), [0, 6]);
  assert.deepStrictEqual(
    Array.from(frontiere.rotation.filter(item =>
      item.type === "action" && item.temps === 6
    ).map(item => item.gameId)),
    ["burst-frontiere", "auto-frontiere"]
  );
}

/* Une competence a recharge prete passe avant l'auto de remplissage. */
{
  const priorite = simulerDpsCompetences({
    stats:SANS_CRITIQUE,
    competences:[
      { gameId:"auto-priorite", nom:"Auto", categorie:"NORMAL", recharge:0,
        composantes:[{ base:"atk", pourcentage:100 }], pourcentage:100 },
      { gameId:"skill-prioritaire", nom:"Competence", categorie:"NORMAL_SKILL",
        recharge:10, composantes:[{ base:"atk", pourcentage:100 }], pourcentage:100 }
    ],
    effets:[], cible:CIBLE_NEUTRE, duree:3,
    animations:{ "auto-priorite":2 }
  });
  assert.equal(
    priorite.rotation.find(item => item.type === "action").gameId,
    "skill-prioritaire"
  );
}

/* Un evenement periodique qui avance une recharge est lui aussi une frontiere
   de remplissage. L'auto ne doit pas le traverser et repousser la competence
   que cet evenement rend disponible. */
{
  const rechargePeriodique = simulerDpsCompetences({
    stats:SANS_CRITIQUE,
    competences:[
      { gameId:"auto-recharge-periodique", nom:"Auto", categorie:"NORMAL",
        recharge:0, composantes:[{ base:"atk", pourcentage:100 }],
        pourcentage:100 },
      { gameId:"burst-recharge-periodique", nom:"Burst",
        categorie:"NORMAL_SKILL", recharge:10,
        composantes:[{ base:"atk", pourcentage:1000 }], pourcentage:1000 }
    ],
    effets:[{
      id:"recharge-periodique-test",
      regles:[{
        type:"recharge-periodique", cible:"normal-skill",
        secondes:5, intervalle:5
      }]
    }],
    cible:CIBLE_NEUTRE,
    duree:10,
    animations:{ "auto-recharge-periodique":4 }
  });
  assert.deepStrictEqual(
    tempsActions(rechargePeriodique, "burst-recharge-periodique"),
    [0, 5],
    "une auto ne doit pas masquer la recharge avancee a 5 s"
  );
}

/* Les evenements reducteurs ne sont pas tous des barrieres : la projection
   doit autoriser les autos qui finissent avant le retour reel du cooldown. */
{
  const reductionsFrequentes = simulerDpsCompetences({
    stats:SANS_CRITIQUE,
    competences:[
      { gameId:"auto-reductions-frequentes", nom:"Auto", categorie:"NORMAL",
        recharge:0, composantes:[{ base:"atk", pourcentage:100 }],
        pourcentage:100 },
      { gameId:"burst-reductions-frequentes", nom:"Burst",
        categorie:"NORMAL_SKILL", recharge:10,
        composantes:[{ base:"atk", pourcentage:1000 }], pourcentage:1000 }
    ],
    effets:[{
      id:"reductions-frequentes-test",
      regles:[{
        type:"recharge-periodique", cible:"normal-skill",
        secondes:2, intervalle:1
      }]
    }],
    cible:CIBLE_NEUTRE,
    duree:10,
    animations:{ "auto-reductions-frequentes":2 }
  });
  assert.deepStrictEqual(
    tempsActions(reductionsFrequentes, "burst-reductions-frequentes"),
    [0, 4, 8]
  );
  assert.deepStrictEqual(
    tempsActions(reductionsFrequentes, "auto-reductions-frequentes"),
    [0, 2, 4, 6, 8],
    "les reductions intermediaires ne doivent pas affamer le remplissage"
  );
}

/* Une reduction causee par l'auto ne doit pas interdire cette meme auto : sans
   elle, la disponibilite anticipee n'existerait pas. Son animation reste le
   verrou normal de l'action qui produit la reduction. */
{
  const reductionParAuto = simulerDpsCompetences({
    stats:SANS_CRITIQUE,
    competences:[
      { gameId:"auto-reduction-directe", nom:"Auto", categorie:"NORMAL",
        recharge:0, composantes:[{ base:"atk", pourcentage:100 }],
        pourcentage:100 },
      { gameId:"burst-reduction-directe", nom:"Burst",
        categorie:"NORMAL_SKILL", recharge:5,
        composantes:[{ base:"atk", pourcentage:1000 }], pourcentage:1000 }
    ],
    effets:[{
      id:"skill:auto-reduction-directe",
      origine:"skill",
      regles:[{
        type:"recharge-plate", cible:"normal-skill", secondes:1,
        sourceId:"skill:auto-reduction-directe"
      }]
    }],
    cible:CIBLE_NEUTRE,
    duree:6,
    animations:{ "auto-reduction-directe":2 }
  });
  assert.deepStrictEqual(
    tempsActions(reductionParAuto, "auto-reduction-directe"),
    [0, 2, 4],
    "une reduction causee par l'auto ne doit pas bloquer son declencheur"
  );
  assert.deepStrictEqual(
    tempsActions(reductionParAuto, "burst-reduction-directe"),
    [0, 4]
  );
  assert.deepStrictEqual(
    Array.from(reductionParAuto.rotation.filter(item =>
      item.type === "action" && item.temps === 4
    ).map(item => item.gameId)),
    ["burst-reduction-directe", "auto-reduction-directe"]
  );
}

/* Cas catalogue Howzer : l'attaque normale remet la speciale a zero. Si la
   projection utilise ce reset pour refuser l'auto, le declencheur ne part
   jamais et la speciale attend a tort sa recharge native. */
{
  const resetHowzer = simulerDpsCompetences({
    stats:SANS_CRITIQUE,
    competences:[
      { gameId:"howzer_gauntlets_jumpatk", nom:"Auto Howzer",
        categorie:"NORMAL", recharge:0,
        composantes:[{ base:"atk", pourcentage:100 }], pourcentage:100 },
      { gameId:"howzer_gauntlets_active3", nom:"Speciale Howzer",
        categorie:"ACTIVE_THIRD", recharge:10.8,
        composantes:[{ base:"atk", pourcentage:1000 }], pourcentage:1000 }
    ],
    effets:[{
      id:"skill:howzer_gauntlets_jumpatk",
      origine:"skill",
      regles:[{
        type:"recharge-taux", cible:"special", valeur:10000,
        sourceId:"skill:howzer_gauntlets_jumpatk"
      }]
    }],
    cible:CIBLE_NEUTRE,
    duree:6,
    animations:{ howzer_gauntlets_jumpatk:2 }
  });
  assert.deepStrictEqual(
    tempsActions(resetHowzer, "howzer_gauntlets_jumpatk"),
    [0, 2, 4]
  );
  assert.deepStrictEqual(
    tempsActions(resetHowzer, "howzer_gauntlets_active3"),
    [0, 2, 4]
  );
}

/* Une fenetre reelle de 60 s avec les quatre categories ne doit pas faire
   exploser la recherche lorsque seule l'auto est mesuree. Le sous-processus
   transforme une non-terminaison en echec borne au lieu de bloquer la suite. */
{
  const performance = spawnSync(
    process.execPath,
    [path.join(__dirname, "helpers", "dps-performance-runner.js")],
    { encoding:"utf8", timeout:5000 }
  );
  assert.equal(
    performance.error && performance.error.code,
    undefined,
    "la simulation DPS de 60 s doit terminer en moins de 5 s"
  );
  assert.equal(performance.status, 0, performance.stderr || performance.stdout);
}

console.log("dps-simulation.test.js OK");
