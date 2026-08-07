"use strict";

const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app");

const { hooks } = loadApp();
const { degatsAttendus, CIBLE_REFERENCE } = hooks;

/* Cible neutre et lisible : aucune resistance, aucune faiblesse, et une
   defense choisie pour que K/(K+DEF) tombe juste. K vaut 5600, donc
   DEF = 5600 donne exactement une reduction de moitie. */
const CIBLE_NEUTRE = {
  def:5600, critResist:0, critDmgResist:0,
  resistanceElementaire:0, faiblesse:0
};
const SANS_CRITIQUE = { atk:1000, critRate:0, critDamage:0, bonusType:0 };
const COUP_SIMPLE = { pourcentage:100, repartition:[100] };

/* Une competence peut additionner plusieurs statistiques du build avant les
   multiplicateurs de cible. */
{
  const competence = {
    composantes:[
      { base:"atk", pourcentage:70 },
      { base:"def", pourcentage:30 }
    ],
    pourcentage:null,
    repartition:[]
  };
  const stats = {
    atk:1000, def:500, maxHp:10000, remainingHp:10000,
    attaqueElementaire:0, critRate:0, critDamage:0,
    bonusCategorie:0, bonusElementaire:0, bonusGlobal:0
  };
  assert.equal(Math.round(degatsAttendus({
    stats, competence, cible:CIBLE_NEUTRE
  }).total), 425, "(700 + 150) x 0,5");
}

/* A defaut de mesure de PV courants, le comparatif maximal emploie 100 % des
   PV max ; une valeur courante explicite reste prioritaire. */
{
  const competence = {
    composantes:[{ base:"remainingHp", pourcentage:10 }],
    pourcentage:null,
    repartition:[]
  };
  const stats = {
    atk:1000, def:500, maxHp:10000,
    attaqueElementaire:0, critRate:0, critDamage:0,
    bonusCategorie:0, bonusElementaire:0, bonusGlobal:0
  };
  assert.equal(Math.round(degatsAttendus({
    stats, competence, cible:CIBLE_NEUTRE
  }).total), 500);
}

/* Les bonus publies forment un seul seau additif : +10 %, +20 % et +30 %
   donnent +60 %, pas trois multiplicateurs successifs. */
{
  const stats = Object.assign({}, SANS_CRITIQUE, {
    bonusCategorie:1000,
    bonusElementaire:2000,
    bonusGlobal:3000
  });
  assert.equal(Math.round(degatsAttendus({
    stats, competence:COUP_SIMPLE, cible:CIBLE_NEUTRE
  }).total), 800, "500 x (1 + 0,10 + 0,20 + 0,30)");
}

/* Le terme de defense : K/(K+DEF). Avec DEF = K, il vaut 0,5. */
{
  const r = degatsAttendus({
    stats:SANS_CRITIQUE, competence:COUP_SIMPLE, cible:CIBLE_NEUTRE
  });
  assert.equal(r.total, 500, "1000 ATK x 100 % x 0,5 = 500");
}

/* Doubler l'ATK double les degats : le terme est lineaire. */
{
  const r = degatsAttendus({
    stats:Object.assign({}, SANS_CRITIQUE, { atk:2000 }),
    competence:COUP_SIMPLE, cible:CIBLE_NEUTRE
  });
  assert.equal(r.total, 1000);
}

/* Doubler la DEF ne divise PAS les degats par deux : K/(K+DEF) n'est pas
   lineaire, et cette difference est exactement ce qu'un comparateur doit
   representer correctement. */
{
  const r = degatsAttendus({
    stats:SANS_CRITIQUE, competence:COUP_SIMPLE,
    cible:Object.assign({}, CIBLE_NEUTRE, { def:11200 })
  });
  assert.ok(
    r.total > 250 && r.total < 500,
    "La mitigation doit etre hyperbolique, recu : " + r.total
  );
  assert.equal(Math.round(r.total), 333);
}

/* Le critique en ESPERANCE : 1 + taux x degats. 5000 dix-milliemes = 50 %,
   et 14000 = 140 % -> facteur 1 + 0,5 x 1,4 = 1,7. */
{
  const r = degatsAttendus({
    stats:{ atk:1000, critRate:5000, critDamage:14000, bonusType:0 },
    competence:COUP_SIMPLE, cible:CIBLE_NEUTRE
  });
  assert.equal(Math.round(r.total), 850, "500 x 1,7 = 850");
}

/* La resistance critique de la cible se retranche aux degats critiques. Le
   taux reste a 9000 pour que le plafond de 90 % ne se melange pas a la mesure
   faite ici. */
{
  const r = degatsAttendus({
    stats:{ atk:1000, critRate:9000, critDamage:14000, bonusType:0 },
    competence:COUP_SIMPLE,
    cible:Object.assign({}, CIBLE_NEUTRE, { critDmgResist:4000 })
  });
  assert.equal(Math.round(r.total), 950, "500 x (1 + 0,9 x 1,0) = 950");
}

/* Le critique PROPRE du heros plafonne a 90 %, quoi qu'affiche sa fiche. */
{
  const r = degatsAttendus({
    stats:{ atk:1000, critRate:12000, critDamage:20000 },
    competence:COUP_SIMPLE, cible:CIBLE_NEUTRE
  });
  assert.equal(Math.round(r.total), 1400, "500 x (1 + 0,9 x 2) — 120 % plafonne a 90 %");
}

/* Les buffs de SOUTIEN s'ajoutent apres ce plafond et n'y sont pas soumis :
   c'est ce qui rend nos soutiens utiles sur un build deja au plafond. Verses
   dans le seau du heros, les memes points seraient purement perdus. */
{
  const commun = { atk:1000, critDamage:20000 };
  const avecSoutien = degatsAttendus({
    stats:Object.assign({}, commun, { critRate:9000, critRateAllie:2000 }),
    competence:COUP_SIMPLE, cible:CIBLE_NEUTRE
  });
  const memesPointsEnPropre = degatsAttendus({
    stats:Object.assign({}, commun, { critRate:11000 }),
    competence:COUP_SIMPLE, cible:CIBLE_NEUTRE
  });
  assert.equal(Math.round(avecSoutien.total), 1500, "9000 + 2000 borne a 100 %");
  assert.equal(Math.round(memesPointsEnPropre.total), 1400, "11000 propre reste plafonne");
  assert.ok(avecSoutien.total > memesPointsEnPropre.total,
    "un buff allie doit rapporter la ou le critique propre est deja plafonne");
}

/* Les quatre configurations relevees sur l'outil de reference, transcrites
   telles quelles (RAPPORT-analyse-tapscreen.md). Avec 200 % de degats
   critiques et aucune resistance, total = 500 x (1 + 2 x taux) : chaque ligne
   fixe donc le taux effectif attendu. */
{
  [
    { cc:6000, allie:6000, resist:0, taux:"100 %", total:1500 },
    { cc:8500, allie:1000, resist:0, taux:"95 %", total:1450 },
    { cc:10000, allie:500, resist:0, taux:"95 %", total:1450 },
    { cc:8000, allie:2000, resist:1500, taux:"85 %", total:1350 }
  ].forEach(cas => {
    const r = degatsAttendus({
      stats:{ atk:1000, critRate:cas.cc, critRateAllie:cas.allie, critDamage:20000 },
      competence:COUP_SIMPLE,
      cible:Object.assign({}, CIBLE_NEUTRE, { critResist:cas.resist })
    });
    assert.equal(Math.round(r.total), cas.total,
      "cc " + cas.cc + " / allie " + cas.allie + " / resist " + cas.resist
        + " doit donner un taux de " + cas.taux);
  });
}

/* Un coup critique peut frapper PLUS FAIBLE qu'un coup normal quand la
   defense critique de la cible depasse les degats critiques du build. Mesure
   de reference : 0 de degats critiques contre 42,93 % de defense critique
   donne un rapport de 0,5707. */
{
  const r = degatsAttendus({
    stats:{ atk:1000, critRate:10000, critDamage:0 },
    competence:COUP_SIMPLE,
    cible:Object.assign({}, CIBLE_NEUTRE, { critDmgResist:4293 })
  });
  assert.equal(Math.round(r.avecCritique), 285, "500 x 0,5707");
  assert.ok(r.avecCritique < r.total && r.total < r.sansCritique,
    "l'ordre des colonnes s'inverse quand le critique devient une malchance");
}

/* Cette penalite se borne a zero : des degats negatifs n'auraient aucun sens. */
{
  const r = degatsAttendus({
    stats:{ atk:1000, critRate:10000, critDamage:0 },
    competence:COUP_SIMPLE,
    cible:Object.assign({}, CIBLE_NEUTRE, { critDmgResist:15000 })
  });
  assert.equal(r.avecCritique, 0);
  assert.ok(r.total >= 0, "l'esperance ne peut pas devenir negative");
}

/* Regression : l'esperance ne doit JAMAIS depasser le coup critique plein.
   Sans plafond, ces entrees donnaient un taux de 1,9 et une esperance de 2400
   pour un critique plein de 1500 - une colonne du tableau au-dessus de sa
   propre borne. */
{
  const r = degatsAttendus({
    stats:{ atk:1000, critRate:12000, critRateAllie:7000, critDamage:20000 },
    competence:COUP_SIMPLE, cible:CIBLE_NEUTRE
  });
  assert.ok(r.total <= r.avecCritique,
    "esperance " + r.total + " au-dessus du critique plein " + r.avecCritique);
  assert.equal(Math.round(r.total), 1500, "le taux sature a 100 %");
}

/* La repartition par coup somme au total, et chaque coup est chiffre. */
{
  const r = degatsAttendus({
    stats:SANS_CRITIQUE,
    competence:{ pourcentage:100, repartition:[25, 75] },
    cible:CIBLE_NEUTRE
  });
  assert.deepStrictEqual(r.parCoup.map(Math.round), [125, 375]);
  assert.equal(Math.round(r.parCoup.reduce((a, b) => a + b, 0)), r.total);
}

/* Une entree manquante rend null, jamais zero : un zero se propagerait dans
   la somme du cycle sans que personne ne le remarque. */
{
  assert.strictEqual(degatsAttendus(), null);
  assert.strictEqual(
    degatsAttendus({ stats:SANS_CRITIQUE, cible:CIBLE_NEUTRE }), null
  );
  assert.strictEqual(
    degatsAttendus({
      stats:SANS_CRITIQUE, cible:CIBLE_NEUTRE,
      competence:{ pourcentage:null, repartition:[] }
    }),
    null
  );
}

/* La cible de reference porte les valeurs relevees sur Akumu, le boss de
   confrerie, jamais des chiffres inventes. Source :
   7dsorigin.app/en/knighthood-boss/demonic-beast-akumu */
{
  assert.equal(CIBLE_REFERENCE.def, 3454);
  assert.equal(CIBLE_REFERENCE.critResist, 2000);
  assert.equal(CIBLE_REFERENCE.critDmgResist, 5000);
  assert.equal(CIBLE_REFERENCE.resistanceElementaire, 3000);
  assert.equal(CIBLE_REFERENCE.faiblesse, 0);
  /* Celle-ci n'est PAS un releve : la source ne publie aucune resistance au
     percement pour Akumu. Le zero est une hypothese, et ce test existe pour
     qu'elle reste visible plutot que de se fondre dans les autres. */
  assert.equal(CIBLE_REFERENCE.resistancePercement, 0);
}

/* Le percement de defense (« Defense Shatter ») retranche un POURCENTAGE de
   la defense de la cible AVANT la mitigation. DEF 5600 percee a 50 % tombe a
   2800, donc K/(K+DEF) passe de 0,5 a 5600/8400. */
{
  const r = degatsAttendus({
    stats:{ atk:1000, percementDefense:5000 },
    competence:COUP_SIMPLE, cible:CIBLE_NEUTRE
  });
  assert.equal(Math.round(r.total), 667);
}

/* La resistance au percement de la cible s'y oppose, et c'est la difference
   qui compte. */
{
  const r = degatsAttendus({
    stats:{ atk:1000, percementDefense:5000 },
    competence:COUP_SIMPLE,
    cible:Object.assign({}, CIBLE_NEUTRE, { resistancePercement:2000 })
  });
  assert.equal(Math.round(r.total), 588, "50 % - 20 % = 30 % de percement net");
}

/* Le percement net est borne des deux cotes : il ne peut ni annuler plus que
   la defense entiere, ni la RENFORCER quand la cible sur-resiste. */
{
  const excedent = degatsAttendus({
    stats:{ atk:1000, percementDefense:15000 },
    competence:COUP_SIMPLE, cible:CIBLE_NEUTRE
  });
  assert.equal(Math.round(excedent.total), 1000, "au plus, la defense tombe a zero");

  const surResiste = degatsAttendus({
    stats:{ atk:1000, percementDefense:1000 },
    competence:COUP_SIMPLE,
    cible:Object.assign({}, CIBLE_NEUTRE, { resistancePercement:9000 })
  });
  assert.equal(Math.round(surResiste.total), 500,
    "un percement negatif laisse la defense intacte, il ne l'augmente pas");
}

/* Un build sans percement retrouve exactement la mitigation de base : le
   terme est neutre par defaut, jamais penalisant. */
{
  const r = degatsAttendus({
    stats:SANS_CRITIQUE, competence:COUP_SIMPLE, cible:CIBLE_NEUTRE
  });
  assert.equal(r.total, 500);
}

/* Les trois colonnes sont trois lectures d'un SEUL calcul. L'esperance est
   forcement encadree par le coup sans critique et le coup critique plein :
   c'est ce qui interdit qu'une colonne derive des deux autres. */
{
  const r = degatsAttendus({
    stats:{ atk:1000, critRate:5000, critDamage:14000 },
    competence:COUP_SIMPLE, cible:CIBLE_NEUTRE
  });
  assert.ok(r.sansCritique < r.total, "l'esperance depasse le coup sans crit");
  assert.ok(r.total < r.avecCritique, "le coup critique depasse l'esperance");
  /* 500 sans critique, 1,4 de degats crit -> 1200 en critique plein. */
  assert.equal(Math.round(r.sansCritique), 500);
  assert.equal(Math.round(r.avecCritique), 1200);
}

/* Un taux critique nul aplatit l'esperance sur le coup sans critique, et ne
   touche pas au coup critique plein. */
{
  const r = degatsAttendus({
    stats:{ atk:1000, critRate:0, critDamage:14000 },
    competence:COUP_SIMPLE, cible:CIBLE_NEUTRE
  });
  assert.equal(Math.round(r.total), Math.round(r.sansCritique));
  assert.equal(Math.round(r.avecCritique), 1200);
}

console.log("degats-calcul.test.js OK");
