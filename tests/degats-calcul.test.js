"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { loadApp, plain } = require("./helpers/load-app");

const bacPassifsArmes = { window:{} };
vm.runInNewContext(fs.readFileSync(
  path.join(__dirname, "..", "data", "passifs-armes.js"), "utf8"
), bacPassifsArmes);
/* La table range les passifs par FAMILLE d'armes : une entree nomme ses
   fichiers et porte ses lignes. On aplatit les lignes de toutes les familles
   pour retrouver celle que les releves de Derieri ont mesuree. */
const PASSIF_DERIERI = bacPassifsArmes.window.SEVEN_DS_PASSIFS_ARMES
  .flatMap(famille => famille.lignes)
  .find(passif => passif.id === "gantelets-ame-vorace-barrage-tenebres");
assert.ok(PASSIF_DERIERI, "le passif mesure de Derieri doit etre dans la table.");

const { hooks } = loadApp();
const {
  degatsAttendus, CIBLE_REFERENCE, calibrerConstante, CONSTANTE_PAR_DEFAUT
} = hooks;

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

/* MAIS le bonus de categorie venu d'un PALIER DE POTENTIEL n'entre pas dans ce
   seau : il forme un facteur a part, applique par-dessus.

   Mesure en jeu, mannequin d'entrainement (ni defense ni resistance), Merlin
   p10 Baguette, Jugement foudroyant (159 %, categorie NORMAL_SKILL) :

     ATK (4 813 + 10 374) x 1,8026 + 1 409 d'Attaque de Foudre = 28 785
     ecran de stats : « Augmentation des degats, competence normale » 25,05 %
     palier 4 : « Renforce la puissance de la competence normale de 15 % »

     28 785 x 1,59 x 1,2505 x 1,15 = 65 818   -> releve en jeu : 65 819
     28 785 x 1,59 x (1 + 0,2505 + 0,15) = 64 098, soit 2,6 % trop bas

   L'ecran de stats du jeu affiche 25,05 % et non 40,05 % : la preuve que le
   palier ne rejoint pas la statistique de l'equipement, il s'applique apres. */
{
  const stats = Object.assign({}, SANS_CRITIQUE, {
    bonusCategorie:2505,
    bonusCategoriePotentiel:1500
  });
  assert.equal(Math.round(degatsAttendus({
    stats, competence:COUP_SIMPLE, cible:CIBLE_NEUTRE
  }).total), 719, "500 x 1,2505 x 1,15 - et non 500 x 1,4005 = 700");
}

/* LES QUATRE RELEVES DE DERIERI, rejoues tels quels.

   Ils protegent le taux de l'attaque elementaire de Barrage des Tenebres,
   publie sur les sept niveaux de Gantelets de l'ame vorace. La table est
   relue dans tests/passifs-armes.test.js ; ce bloc garde la formule complete.

   Derieri, Gantelets, palier 5, mannequin (ni defense ni resistance),
   « Assaut fulgurant » - deux frappes, 186 % puis 315 %.

     ATK (4 382 + 8 817) x 1,51 + (270 + 5 281) x (1 + 0,025 n)
     ecran de stats : « degats de competence normale » 0,00 %
     palier 4 : « Renforce la puissance de la competence normale de 45 % »
     degats critiques 126,46 %

   La frappe 2 porte toujours UN cumul de plus que la frappe 1 : chaque coup
   porte en octroie un, et le premier vient d'etre porte.

   L'ecart tolere est de 0,01 %. Il n'est pas decoratif : les chiffres sont
   mesures dans le jeu, pas produits par le moteur. */
{
  const MANNEQUIN = {
    def:0, critResist:0, critDmgResist:0,
    resistanceElementaire:0, faiblesse:0, resistancePercement:0
  };
  const PAR_CUMUL = PASSIF_DERIERI.parCumul[6];

  const derieri = (cumuls, critRate) => ({
    atk:19930.49,
    attaqueElementaire:5551 * (1 + PAR_CUMUL * cumuls / 10000),
    critRate, critDamage:12646,
    bonusCategorie:0, bonusElementaire:0,
    bonusGlobal:0,
    bonusCategoriePotentiel:4500
  });
  const frappe = pourcentage => ({ pourcentage, repartition:[] });

  const releves = [
    { quoi:"frappe 1, 0 cumul", coup:186, cumuls:0, crit:false, attendu:68724 },
    { quoi:"frappe 1, 4 cumuls", coup:186, cumuls:4, crit:false, attendu:70221 },
    { quoi:"frappe 2, 1 cumul", coup:315, cumuls:1, crit:false, attendu:117021 },
    { quoi:"frappe 2, 5 cumuls, critique",
      coup:315, cumuls:5, crit:true, attendu:270747 }
  ];
  releves.forEach(releve => {
    const r = degatsAttendus({
      stats:derieri(releve.cumuls, releve.crit ? 10000 : 0),
      competence:frappe(releve.coup),
      cible:MANNEQUIN
    });
    const obtenu = releve.crit ? r.avecCritique : r.sansCritique;
    const ecart = Math.abs(obtenu - releve.attendu) / releve.attendu;
    assert.ok(ecart < 1e-4,
      "Derieri, " + releve.quoi + " : releve en jeu " + releve.attendu
        + ", calcule " + obtenu.toFixed(1) + ", ecart "
        + (ecart * 100).toFixed(4) + " %");
  });
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

/* La RESISTANCE critique de la cible se reduit en POINTS, et il ne faut pas la
   confondre avec sa DEFENSE critique : l'une decide si le coup critique part,
   l'autre de ce qu'il rapporte.

   Avec 200 % de degats critiques, total = 500 x (1 + 2 x taux). A 60 % de
   critique propre contre 20 % de resistance, le taux vaut 40 % ; en retrancher
   20 points a la resistance le ramene a 60 %. */
{
  const contre = reduction => degatsAttendus({
    stats:{ atk:1000, critRate:6000, critDamage:20000,
      reductionResistanceCritique:reduction },
    competence:COUP_SIMPLE,
    cible:Object.assign({}, CIBLE_NEUTRE, { critResist:2000 })
  });
  assert.equal(Math.round(contre(0).total), 900, "sans reduction, taux 40 %");
  assert.equal(Math.round(contre(2000).total), 1100,
    "20 points retranches ramenent la resistance a zero, taux 60 %");
  /* Sur-reduire ne doit RIEN rendre de plus : le plancher est a zero, sans
     quoi une cible sans resistance se mettrait a offrir du critique. */
  assert.equal(Math.round(contre(9000).total), 1100,
    "sur-reduire ne depasse pas la resistance nulle");
  /* Et elle ne se confond pas avec la defense critique : reduire l'une ne doit
     rien changer a l'autre. */
  const memesPoints = degatsAttendus({
    stats:{ atk:1000, critRate:6000, critDamage:20000,
      reductionDefenseCritique:2000 },
    competence:COUP_SIMPLE,
    cible:Object.assign({}, CIBLE_NEUTRE, { critResist:2000 })
  });
  assert.equal(Math.round(memesPoints.total), 900,
    "reduire la DEFENSE critique ne touche pas la RESISTANCE critique");
}

/* LE PLANCHER DU MULTIPLICATEUR CRITIQUE, a x1,00.

   `battle_min_critical_dam_rate` = 10000, soit 100 %, dans la section du
   client « bornes que le jeu applique en fin de calcul » — la voisine directe
   de `battle_min_damres_rate` = 500 que PLANCHER_DEGATS applique deja.

   Ce module bornait a ZERO, sur la foi de RAPPORT-analyse-tapscreen.md
   (section 4 : a `cd` = 0 contre 42,93 % de defense critique, tapscreen rend
   36 329 contre 63 658 en non-critique, soit 0,5707). Cette mesure est
   solide, mais elle prouve ce que fait L'OUTIL. 7dsorigin, l'autre outil,
   plancherise a x1,00. Deux modeles tiers qui se contredisent ne pesent pas
   contre la table du client.

   Ces deux cas etaient donc attendus a 285 et a 0. Ils valent le coup normal. */
{
  const auPlancher = cible => degatsAttendus({
    stats:{ atk:1000, critRate:10000, critDamage:0 },
    competence:COUP_SIMPLE,
    cible:Object.assign({}, CIBLE_NEUTRE, { critDmgResist:cible })
  });

  const juste = auPlancher(4293);
  assert.equal(Math.round(juste.avecCritique), 500,
    "42,93 % de defense critique ne fait pas descendre le critique sous 1");
  assert.notEqual(Math.round(juste.avecCritique), 285,
    "285 etait le chiffre de tapscreen, pas celui de la table du jeu");

  const loin = auPlancher(15000);
  assert.equal(Math.round(loin.avecCritique), 500,
    "150 % de defense critique s'arrete au plancher, elle ne creuse pas");

  /* Le plancher rend le critique NEUTRE, jamais nuisible : les trois colonnes
     se rejoignent au lieu de s'inverser. */
  [juste, loin].forEach(r => {
    assert.equal(Math.round(r.total), Math.round(r.sansCritique));
    assert.equal(Math.round(r.total), Math.round(r.avecCritique));
  });
}

/* Et il ne s'applique qu'au multiplicateur : au-dessus de 1, la defense
   critique mord normalement, sinon le plancher effacerait la stat entiere. */
{
  const r = degatsAttendus({
    stats:{ atk:1000, critRate:10000, critDamage:20000 },
    competence:COUP_SIMPLE,
    cible:Object.assign({}, CIBLE_NEUTRE, { critDmgResist:5000 })
  });
  assert.equal(Math.round(r.avecCritique), 1250, "500 x (1 + 2,0 - 0,5)");
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

/* Les 31 cibles selectionnables : les 30 niveaux d'Akumu, puis le mannequin.

   Les niveaux 1 a 20 ont ete verifies sur la page publique. Les niveaux 21 a
   30 viennent directement de NpcStatGroupTable, groupe stat_50700109. */
{
  const CIBLES = plain(hooks.CIBLES);
  assert.equal(CIBLES.length, 31);

  const parId = Object.fromEntries(CIBLES.map(c => [c.id, c]));

  /* Le niveau 1 est exactement l'ancienne CIBLE_REFERENCE : ajouter les
     niveaux ne doit deplacer aucun chiffre deja affiche. */
  assert.deepEqual(parId["akumu-1"], Object.assign({
    id:"akumu-1", niveau:1, hp:2090121
  }, plain(CIBLE_REFERENCE)));

  assert.equal(parId["akumu-20"].def, 38544);
  assert.equal(parId["akumu-20"].critResist, 12235);
  assert.equal(parId["akumu-20"].critDmgResist, 21582);
  assert.equal(parId["akumu-20"].hp, 96543801);

  /* Le niveau 21 ouvre un nouveau palier : la resistance critique retombe a
     20 %, tandis que DEF, defense critique et PV poursuivent leur hausse. */
  assert.equal(parId["akumu-21"].def, 40175);
  assert.equal(parId["akumu-21"].critResist, 2000);
  assert.equal(parId["akumu-21"].critDmgResist, 35806);
  assert.equal(parId["akumu-21"].hp, 102375267);

  assert.equal(parId["akumu-30"].def, 80264);
  assert.equal(parId["akumu-30"].critResist, 2000);
  assert.equal(parId["akumu-30"].critDmgResist, 54593);
  assert.equal(parId["akumu-30"].hp, 214755600);

  /* Valeurs volontairement conservees sur les 30 paliers tant que leur
     combinaison dans la formule elementaire n'est pas tranchee en jeu. */
  CIBLES.filter(c => c.niveau).forEach(cible => {
    assert.equal(cible.resistanceElementaire, 3000, cible.id);
    assert.equal(cible.faiblesse, 0, cible.id);
    assert.equal(cible.resistancePercement, 0, cible.id);
  });

  /* La DEF, la defense critique et les PV croissent a chaque palier : une
     coquille de transcription se verrait ici. La resistance critique suit
     deux regimes distincts, verifies juste apres. */
  const niveaux = CIBLES.filter(c => c.niveau)
    .sort((a, b) => a.niveau - b.niveau);
  assert.equal(niveaux.length, 30);
  niveaux.forEach((cible, index) => {
    assert.equal(cible.niveau, index + 1);
    if(index === 0) return;
    const avant = niveaux[index - 1];
    assert.ok(cible.def > avant.def, "DEF croissante au palier " + cible.niveau);
    assert.ok(cible.critDmgResist > avant.critDmgResist, cible.id);
    assert.ok(cible.hp > avant.hp, cible.id);
  });
  niveaux.slice(0, 20).forEach((cible, index) => {
    if(index > 0) assert.ok(cible.critResist > niveaux[index - 1].critResist, cible.id);
  });
  niveaux.slice(20).forEach(cible => {
    assert.equal(cible.critResist, 2000, cible.id);
  });
}

/* Le mannequin d'entrainement : aucune defense, aucune resistance.

   Il rend visible le coefficient brut d'une competence — degats = ATK x coef —
   parce que tous les autres facteurs valent 1. C'est aussi la seule cible que
   l'outil de reference possede AUSSI, donc la seule sur laquelle les deux
   calculateurs se comparent sans qu'on force les stats de l'un dans l'autre. */
{
  const mannequin = plain(hooks.CIBLES).find(c => c.id === "mannequin");
  assert.ok(mannequin, "le mannequin doit figurer dans les cibles");
  assert.equal(mannequin.def, 0);
  assert.equal(mannequin.critResist, 0);
  assert.equal(mannequin.critDmgResist, 0);
  assert.equal(mannequin.resistanceElementaire, 0);
  assert.equal(mannequin.faiblesse, 0);
  assert.equal(mannequin.resistancePercement, 0);
  assert.equal(mannequin.niveau, null);

  const sortie = degatsAttendus({
    stats:{ atk:1000, critRate:0, critDamage:0 },
    competence:COUP_SIMPLE,
    cible:mannequin
  });
  assert.equal(sortie.sansCritique, 1000, "degats = ATK x coef, sans perte");

  /* Sans armure, le percement n'a RIEN a percer : il ne doit pas s'appliquer.

     La mitigation vaut deja 1 quand la defense est nulle ; y ajouter le
     percement la pousserait au-dessus de 1, c'est-a-dire au-dessus des degats
     d'avant armure — un coup qui frappe plus fort que sa propre puissance.

     C'est le comportement de l'outil de reference, mesure en session 1
     (« si DEF_eff = 0, le shatter est ignore ») puis reconfirme en session 5,
     ou son percement laisse la sortie du mannequin strictement inchangee. */
  [0, 50, 100, 5000].forEach(percement => {
    assert.equal(
      degatsAttendus({
        stats:{ atk:1000, critRate:0, critDamage:0, percementDefense:percement },
        competence:COUP_SIMPLE,
        cible:mannequin
      }).sansCritique,
      1000,
      "le percement ne doit rien changer sans defense, essaye : " + percement
    );
  });

  /* Le JEU plafonne la somme des sources de percement : sa table de combat
     porte `battle_max_sum_protect_cur_rate = 9000`, soit 90 %. Au-dela, tout
     point supplementaire est perdu.

     Ce plafond est celui du jeu, PAS celui de l'outil de reference, qui
     accepte 150 % sans broncher. Les deux chiffres divergent donc au-dela de
     90 % de percement, et c'est un choix assume : le calculateur dit ce qui
     se passe en combat, pas ce qu'affiche 7dsorigin.app. */
  {
    const avec = percement => degatsAttendus({
      stats:{ atk:1000, critRate:0, critDamage:0, percementDefense:percement },
      competence:COUP_SIMPLE,
      cible:CIBLE_NEUTRE
    }).sansCritique;

    assert.equal(avec(9000), avec(15000),
      "au-dela de 90 %, un point de percement de plus ne doit rien rapporter");
    assert.equal(avec(9000), avec(9001),
      "le plafond doit mordre des le premier point au-dessus");
    assert.ok(avec(5000) < avec(9000),
      "sous le plafond, le percement doit rester pleinement actif");
  }

  /* Le percement reste PLEINEMENT actif des qu'il y a une armure : le
     correctif ci-dessus ne doit pas l'avoir neutralise ailleurs. Sur
     CIBLE_NEUTRE, C = DEF = 5600 donne une mitigation de 0,5, que 5000
     dix-milliemes de percement portent a 1,0 — donc le double. */
  assert.equal(
    degatsAttendus({
      stats:{ atk:1000, critRate:0, critDamage:0, percementDefense:5000 },
      competence:COUP_SIMPLE,
      cible:CIBLE_NEUTRE
    }).sansCritique,
    2 * degatsAttendus({
      stats:{ atk:1000, critRate:0, critDamage:0 },
      competence:COUP_SIMPLE,
      cible:CIBLE_NEUTRE
    }).sansCritique
  );

  /* Sans defense, aucun coup ne peut reveler la constante : le refus est le
     meme que celui de l'outil de reference sur son propre mannequin, et il est
     NOMME pour que la vue explique quoi corriger au lieu d'un « impossible »
     sec. */
  assert.deepEqual(
    plain(calibrerConstante({
      degatsObserves:1000,
      stats:{ atk:1000 },
      competence:COUP_SIMPLE,
      cible:mannequin
    })),
    { erreur:"defense-nulle" }
  );
}

/* Le percement de defense (« Defense Shatter ») s'AJOUTE au rapport de
   mitigation ; il ne divise pas la defense. Les cinq mesures de l'outil de
   reference, transcrites telles quelles (RAPPORT-analyse-tapscreen.md,
   session 3). Sa constante valait 5600, comme notre K : les chiffres se
   comparent donc directement. Avec 1000 d'ATK et une competence a 100 %,
   total = 1000 x mitigation. */
{
  [
    { def:5600, percement:0, total:500, note:"5600/11200 = 0,5" },
    { def:5600, percement:5000, total:1000, note:"0,5 + 0,5, soit une defense NULLE" },
    { def:2800, percement:0, total:667, note:"5600/8400" },
    { def:10000, percement:3000, total:659, note:"5600/15600 + 0,30" },
    { def:7000, percement:0, total:444, note:"5600/12600" }
  ].forEach(cas => {
    const r = degatsAttendus({
      stats:{ atk:1000, percementDefense:cas.percement },
      competence:COUP_SIMPLE,
      cible:Object.assign({}, CIBLE_NEUTRE, { def:cas.def })
    });
    assert.equal(Math.round(r.total), cas.total,
      "DEF " + cas.def + " / percement " + cas.percement + " : " + cas.note);
  });
}

/* La preuve que ce n'est PAS une division de la defense : percer 50 % d'une
   defense de 5600 ne rend pas le chiffre d'une defense de 2800. C'est
   exactement la mesure qui a invalide la premiere version de ce module. */
{
  const perce = degatsAttendus({
    stats:{ atk:1000, percementDefense:5000 },
    competence:COUP_SIMPLE, cible:CIBLE_NEUTRE
  });
  const defenseMoitie = degatsAttendus({
    stats:{ atk:1000 }, competence:COUP_SIMPLE,
    cible:Object.assign({}, CIBLE_NEUTRE, { def:2800 })
  });
  assert.notEqual(Math.round(perce.total), Math.round(defenseMoitie.total),
    "percer de moitie n'est pas diviser la defense de moitie");
  assert.equal(Math.round(perce.total), 1000);
  assert.equal(Math.round(defenseMoitie.total), 667);
}

/* La resistance au percement se retranche au percement, et a rien d'autre. */
{
  const r = degatsAttendus({
    stats:{ atk:1000, percementDefense:5000 },
    competence:COUP_SIMPLE,
    cible:Object.assign({}, CIBLE_NEUTRE, { resistancePercement:2000 })
  });
  assert.equal(Math.round(r.total), 800, "0,5 + (50 % - 20 %)");
}

/* La mitigation peut depasser 1 — les degats depassent alors la valeur
   pre-armure — mais le percement qui l'y pousse est PLAFONNE a 90 %.

   Ce test disait l'inverse jusqu'au 23 aout 2026 : il gravait « AUCUN plafond
   en haut », mesure jusqu'a 150 % chez l'outil de reference. Le jeu, lui,
   porte `battle_max_sum_protect_cur_rate = 9000`. On a tranche pour le JEU :
   la page dit ce qui se passe en combat.

   Ne pas rendre ce test a son ancienne forme sans rouvrir cette decision :
   0,5 + 1,5 = 2,0 est ce que calcule 7dsorigin.app, pas ce que fait le jeu. */
{
  const r = degatsAttendus({
    stats:{ atk:1000, percementDefense:15000 },
    competence:COUP_SIMPLE, cible:CIBLE_NEUTRE
  });
  assert.equal(Math.round(r.total), 1400, "0,5 + 0,9 plafonne = 1,4");
}

/* Un plancher a zero en revanche : sur-resister ne RENFORCE pas la defense. */
{
  const r = degatsAttendus({
    stats:{ atk:1000, percementDefense:1000 },
    competence:COUP_SIMPLE,
    cible:Object.assign({}, CIBLE_NEUTRE, { resistancePercement:9000 })
  });
  assert.equal(Math.round(r.total), 500);
}

/* Un build sans percement retrouve exactement la mitigation de base : le
   terme est neutre par defaut, jamais penalisant. */
{
  const r = degatsAttendus({
    stats:SANS_CRITIQUE, competence:COUP_SIMPLE, cible:CIBLE_NEUTRE
  });
  assert.equal(r.total, 500);
}

/* La reduction de defense infligee a l'ennemi MULTIPLIE sa defense, la ou le
   percement s'ajoute au rapport. DEF 5600 reduite de 20 % tombe a 4480, donc
   K/(K+DEF) vaut 5600/10080. Si ce malus s'ajoutait au rapport comme le
   percement, on lirait 700 : les deux formes ne sont pas interchangeables. */
{
  const r = degatsAttendus({
    stats:{ atk:1000, reductionDefense:2000 },
    competence:COUP_SIMPLE, cible:CIBLE_NEUTRE
  });
  assert.equal(Math.round(r.total), 556);
  assert.notEqual(Math.round(r.total), 700, "ce malus multiplie, il ne s'ajoute pas");
}

/* La defense critique de la cible se reduit en POINTS, pas en facteur. Une
   defense critique de 50 % reduite de « 50 » tombe a ZERO, pas a 25. */
/* Le build porte 200 % de degats critiques pour rester AU-DESSUS du plancher
   de x1,00 : sous le plancher, les deux lectures rendraient le meme chiffre et
   ce test ne prouverait plus rien. */
{
  const cible = Object.assign({}, CIBLE_NEUTRE, { critDmgResist:5000 });
  const base = { atk:1000, critRate:10000, critDamage:20000 };

  const sansMalus = degatsAttendus({
    stats:base, competence:COUP_SIMPLE, cible
  });
  assert.equal(Math.round(sansMalus.avecCritique), 1250, "500 x (1 + 2,0 - 0,5)");

  const avecMalus = degatsAttendus({
    stats:Object.assign({}, base, { reductionDefenseCritique:5000 }),
    competence:COUP_SIMPLE, cible
  });
  assert.equal(Math.round(avecMalus.avecCritique), 1500,
    "defense critique annulee : le critique rend ses 200 % pleins");
  assert.notEqual(Math.round(avecMalus.avecCritique), 1375,
    "un facteur aurait laisse 25 % de defense critique, et non zero");

  /* Et elle ne descend pas sous zero : sur-reduire ne rend pas de bonus. */
  const surReduit = degatsAttendus({
    stats:Object.assign({}, base, { reductionDefenseCritique:9000 }),
    competence:COUP_SIMPLE, cible
  });
  assert.equal(Math.round(surReduit.avecCritique),
    Math.round(avecMalus.avecCritique));
}

/* Le cas qui motive tout ce lot : sur Akumu, dont les 50 % de defense critique
   annulent entierement le gain d'un build a 40 % de degats critiques — le
   multiplicateur tomberait a 0,90 sans le plancher, et s'arrete a 1,00 —
   annuler cette defense fait repasser le critique en bonus. C'est le plus gros
   mouvement de chiffres de la serie, et la raison d'etre de Daisy. */
{
  const base = { atk:1000, critRate:10000, critDamage:4000 };

  const seul = degatsAttendus({
    stats:base, competence:COUP_SIMPLE, cible:CIBLE_REFERENCE
  });
  assert.equal(Math.round(seul.avecCritique), Math.round(seul.sansCritique),
    "sans soutien, le critique ne rapporte RIEN sur Akumu : il est neutralise");

  const avecDaisy = degatsAttendus({
    stats:Object.assign({}, base, { reductionDefenseCritique:5000 }),
    competence:COUP_SIMPLE, cible:CIBLE_REFERENCE
  });
  assert.ok(avecDaisy.avecCritique > avecDaisy.sansCritique,
    "defense critique annulee, le critique redevient un gain");
  assert.equal(Math.round(seul.sansCritique), Math.round(avecDaisy.sansCritique),
    "un malus de defense CRITIQUE ne touche pas le coup non critique");
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

/* Sans constante mesuree, le moteur retombe sur sa valeur par defaut - c'est
   elle qui a servi a tous les chiffres precedents. */
{
  const sans = degatsAttendus({
    stats:{ atk:1000 }, competence:COUP_SIMPLE, cible:CIBLE_NEUTRE
  });
  const avecLeDefaut = degatsAttendus({
    stats:{ atk:1000, constanteC:CONSTANTE_PAR_DEFAUT },
    competence:COUP_SIMPLE, cible:CIBLE_NEUTRE
  });
  assert.equal(CONSTANTE_PAR_DEFAUT, 5600);
  assert.equal(sans.total, avecLeDefaut.total);

  const autre = degatsAttendus({
    stats:{ atk:1000, constanteC:11200 },
    competence:COUP_SIMPLE, cible:CIBLE_NEUTRE
  });
  assert.equal(Math.round(autre.total), 667, "11200/(11200+5600)");
}

/* LE ROUND-TRIP : calculer avec une constante donnee, puis la retrouver
   depuis le seul coup non critique. Zero ecart, sur des configurations qui
   different par le build ET par la cible.

   C'est la seule verification capable d'attraper une inversion ayant derive
   de la formule directe - et c'est exactement ce que l'outil de reference
   reussit sur ses propres entrees. */
{
  [
    { c:5600, stats:{ atk:1000 }, cible:CIBLE_NEUTRE },
    { c:3200, stats:{ atk:12345, critRate:5000, critDamage:14000 },
      cible:CIBLE_NEUTRE },
    { c:9000, stats:{ atk:8000, percementDefense:2500 }, cible:CIBLE_REFERENCE },
    { c:4100, stats:{ atk:6000, reductionDefense:2000, bonusGlobal:1500 },
      cible:CIBLE_REFERENCE }
  ].forEach(cas => {
    const stats = Object.assign({}, cas.stats, { constanteC:cas.c });
    const attendu = degatsAttendus({
      stats, competence:COUP_SIMPLE, cible:cas.cible
    });
    const retrouve = calibrerConstante({
      stats, competence:COUP_SIMPLE, cible:cas.cible,
      degatsObserves:attendu.sansCritique
    });
    assert.ok(retrouve && Number.isFinite(retrouve.constante),
      "la calibration doit aboutir, recu : " + JSON.stringify(retrouve));
    assert.ok(Math.abs(retrouve.constante - cas.c) < 1e-6,
      "constante " + cas.c + " retrouvee a " + retrouve.constante);
  });
}

/* Quatre refus explicites plutot qu'une constante absurde. Une constante
   fausse serait le pire des resultats : elle se sauvegarderait, puis
   fausserait chaque ligne du tableau sans plus jamais se signaler. */
{
  const commun = {
    stats:{ atk:1000 }, competence:COUP_SIMPLE, cible:CIBLE_NEUTRE
  };

  assert.equal(
    calibrerConstante(Object.assign({}, commun, { degatsObserves:0 })).erreur,
    "degats-manquants"
  );
  assert.equal(
    calibrerConstante(Object.assign({}, commun, { degatsObserves:-5 })).erreur,
    "degats-manquants"
  );
  /* La base vaut 1000 : au-dela, la mitigation depasserait 1 et C divergerait. */
  assert.equal(
    calibrerConstante(Object.assign({}, commun, { degatsObserves:1000 })).erreur,
    "degats-au-dela-de-la-pre-armure"
  );
  /* Sans defense, la mitigation vaut 1 quelle que soit C : aucun coup ne peut
     la reveler. L'outil de reference refuse exactement ce cas. */
  assert.equal(
    calibrerConstante(Object.assign({}, commun, {
      cible:Object.assign({}, CIBLE_NEUTRE, { def:0 }), degatsObserves:500
    })).erreur,
    "defense-nulle"
  );
  /* Trop faibles : le percement seul depasse deja la mitigation observee. */
  assert.equal(
    calibrerConstante({
      stats:{ atk:1000, percementDefense:5000 },
      competence:COUP_SIMPLE, cible:CIBLE_NEUTRE, degatsObserves:400
    }).erreur,
    "degats-trop-faibles"
  );
}

/* Calibrer sur un coup CRITIQUE est l'erreur que le membre fera. Le garde-fou
   l'attrape au lieu de rendre une constante trop grande. */
{
  const stats = { atk:1000, critRate:10000, critDamage:14000, constanteC:5600 };
  const r = degatsAttendus({
    stats, competence:COUP_SIMPLE, cible:CIBLE_NEUTRE
  });
  assert.equal(
    calibrerConstante({
      stats, competence:COUP_SIMPLE, cible:CIBLE_NEUTRE,
      degatsObserves:r.avecCritique
    }).erreur,
    "degats-au-dela-de-la-pre-armure"
  );
}

/* ======================================================================
   LE TERME D'AVANTAGE ELEMENTAIRE, enfin exerce, et ses deux bornes.

   Toutes les cibles du jeu accessibles ici sont Akumu, dont la faiblesse est
   nulle : ce terme n'etait couvert par AUCUN releve. Les multiplicateurs
   publies par l'outil de reference pour Diane (Terre) contre une cible faible
   a la Terre le fixent (page formule-de-degats, exemple de validation).
   ====================================================================== */

/* Faiblesse et resistance elementaire ensemble : resistance 15 % -> x0,85,
   faiblesse +2000 -> x1,2. Sans defense, le total isole ces deux termes. */
{
  const r = degatsAttendus({
    stats:{ atk:1000, critRate:0, critDamage:0 },
    competence:COUP_SIMPLE,
    cible:Object.assign({}, CIBLE_NEUTRE, {
      def:0, resistanceElementaire:1500, faiblesse:2000
    })
  });
  assert.equal(Math.round(r.total), 1020,
    "1000 x 0,85 (resist 15 %) x 1,2 (faiblesse +2000)");
}

/* Frapper une RESISTANCE, non une faiblesse : le terme signe descend sous 1. */
{
  const r = degatsAttendus({
    stats:{ atk:1000 }, competence:COUP_SIMPLE,
    cible:Object.assign({}, CIBLE_NEUTRE, { def:0, faiblesse:-2000 })
  });
  assert.equal(Math.round(r.total), 800, "faiblesse -2000 -> x0,8");
}

/* LE PLAFOND d'avantage elementaire a x6 (+500 %) : la somme faiblesse + burst
   + stuff est capee la. Datamine 7dsorigin. Aucune cible du jeu accessible ici
   n'en approche - un garde pour une cible extreme a venir, pas un chiffre
   d'aujourd'hui. */
{
  const auCap = degatsAttendus({
    stats:{ atk:1000 }, competence:COUP_SIMPLE,
    cible:Object.assign({}, CIBLE_NEUTRE, { def:0, faiblesse:50000 })
  });
  assert.equal(Math.round(auCap.total), 6000, "50000 = +500 % -> x6 pile");
  const auDela = degatsAttendus({
    stats:{ atk:1000 }, competence:COUP_SIMPLE,
    cible:Object.assign({}, CIBLE_NEUTRE, { def:0, faiblesse:120000 })
  });
  assert.equal(Math.round(auDela.total), 6000,
    "au-dela du cap, le terme reste borne a x6");
}

/* LE PLANCHER de degats a 5 % : la reduction defense x resistance ne peut pas
   ramener un coup sous 5 % de sa valeur d'avant mitigation. Datamine
   7dsorigin. Cible extreme fabriquee, aucune n'existe a ce jour. */
{
  const r = degatsAttendus({
    stats:{ atk:1000 }, competence:COUP_SIMPLE,
    cible:Object.assign({}, CIBLE_NEUTRE, {
      def:5600, resistanceElementaire:9900
    })
  });
  /* Sans plancher : 1000 x 0,5 x 0,01 = 5. Avec : 1000 x 0,05 = 50. */
  assert.equal(Math.round(r.total), 50,
    "0,5 x 0,01 = 0,005 remonte au plancher 0,05");
}

/* Et le plancher NE MORD PAS dans la plage reelle : Akumu, resistance 30 %,
   defense de moitie, reste loin au-dessus de 5 %. Le coup garde sa valeur
   exacte - preuve que le garde n'a rien deplace. */
{
  const r = degatsAttendus({
    stats:{ atk:1000 }, competence:COUP_SIMPLE,
    cible:Object.assign({}, CIBLE_NEUTRE, { resistanceElementaire:3000 })
  });
  assert.equal(Math.round(r.total), 350,
    "0,5 x 0,7 = 0,35, bien au-dessus du plancher");
}

console.log("degats-calcul.test.js OK");
