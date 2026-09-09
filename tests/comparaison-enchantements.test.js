"use strict";

/* Le balayage des paliers : ce que l'essai d'enchantements rend, cible par
   cible. Le module est pur, mais il s'appuie sur `simulationDuBuild`, qui lit
   les catalogues sur `window` — le chargeur `vm` les pose donc avant. */

const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app");

const { hooks } = loadApp();
const { apportsDesBuffs, comparerSurLesCibles, statsAvecApports } = hooks;

assert.equal(
  typeof comparerSurLesCibles,
  "function",
  "le comparateur de paliers doit exister"
);

const CIBLE_A = { id:"a", niveau:1, def:1000, critResist:0, critDmgResist:0 };
const CIBLE_B = { id:"b", niveau:2, def:9000, critResist:0, critDmgResist:0 };

/* Sans build lisible, chaque ligne existe quand meme et porte un ecart nul :
   une cible ABSENTE du tableau se lirait comme une cible ou l'essai ne change
   rien, ce qui est un tout autre message. */
{
  const vide = comparerSurLesCibles({
    reference:null, essai:null, dossierArme:null, cibles:[CIBLE_A, CIBLE_B]
  });
  assert.equal(vide.lignes.length, 2, "une ligne par cible, toujours");
  assert.ok(
    vide.lignes.every(ligne => ligne.ecart === null),
    "un build illisible ne produit pas un ecart de zero"
  );
  assert.equal(
    vide.resume, null,
    "aucun palier chiffre : pas de resume plutot qu'un resume vide"
  );
}

/* Aucune cible : le module rend une liste vide sans lever. La vue peut ainsi
   l'appeler avant que le catalogue des paliers ne soit charge. */
{
  const sansCible = comparerSurLesCibles({ cibles:[] });
  assert.equal(sansCible.lignes.length, 0);
  assert.equal(sansCible.resume, null);
}

/* Une entree qui n'est meme pas un objet ne doit pas casser la vue. */
/* `deepStrictEqual` compare les prototypes : un tableau rendu par le bac a
   sable `vm` n'est jamais reference-egal a un `[]` de ce fichier. On mesure
   donc la longueur, seule chose que l'assertion doit dire ici. */
assert.equal(comparerSurLesCibles().lignes.length, 0);
assert.equal(comparerSurLesCibles(null).lignes.length, 0);


/* LES APPORTS DES BUFFS DE SOUTIEN.

   Le simulateur part du BUILD. Les lignes cochees dans le calculateur -
   soutiens, tenues gravees, potentiels d'equipe - vivent ailleurs, et sans
   elles le balayage repondait a cote de la question : ce sont precisement
   elles qui reduisent la resistance et la defense critiques du boss, donc
   elles qui decident si une ligne de degats critiques vaut quelque chose.

   `statsAvecApports` les verse dans les statistiques de la simulation. Elle
   est pure et exportee pour ca : la fusion se prouve ici, sans build. */
{
  assert.equal(
    typeof statsAvecApports, "function",
    "la fusion des apports doit exister"
  );

  const base = {
    atk:5000, critRate:6960, critDamage:15023,
    reductionDefenseCritique:0, reductionResistanceCritique:0,
    bonusCategorie:{ "normal-skill":0, special:8667, ultimate:5000 }
  };

  /* Sans apport, la fusion rend les MEMES chiffres : c'est ce qui garantit
     qu'un build sans aucune case cochee ne bouge pas d'un point. */
  const inchange = statsAvecApports(base, null);
  assert.equal(inchange.atk, 5000);
  assert.equal(inchange.critDamage, 15023);
  assert.equal(inchange.bonusCategorie.special, 8667);

  /* La fusion ne doit pas MUTER la source : le comparateur simule deux fois
     de suite, et une mutation ferait cumuler les apports au second passage. */
  statsAvecApports(base, { stats:{ atk:1000 } });
  assert.equal(base.atk, 5000, "la fusion ne mute jamais ses entrees");

  const avec = statsAvecApports(base, {
    stats:{
      critRateAllie:2000,
      critDamage:1500,
      reductionDefenseCritique:12500,
      reductionResistanceCritique:7400
    },
    /* Les cles arrivent dans le vocabulaire du CATALOGUE de competences,
       celui des cases cochees. La traduction vers les seaux du simulateur
       appartient au moteur, pas a la vue. */
    bonusParCategorie:{ ACTIVE_THIRD:1500, ULTIMATE:800, NORMAL:300 }
  });
  assert.equal(avec.critRateAllie, 2000, "un seau absent de la base s'ouvre");
  assert.equal(avec.critDamage, 16523, "un seau present s'ADDITIONNE");
  assert.equal(avec.reductionDefenseCritique, 12500);
  assert.equal(avec.reductionResistanceCritique, 7400);
  assert.equal(avec.bonusCategorie.special, 8667 + 1500);
  assert.equal(avec.bonusCategorie.ultimate, 5000 + 800);
  assert.equal(avec.bonusCategorie.normal, 300);
  /* TAG_SKILL n'a pas de seau dans le simulateur : la competence de releve
     n'entre pas dans une fenetre de soixante secondes en solo. Elle doit
     etre IGNOREE, jamais versee dans un autre seau. */
  const releve = statsAvecApports(base, {
    bonusParCategorie:{ TAG_SKILL:9999 }
  });
  assert.deepEqual(
    Object.keys(releve.bonusCategorie).sort(),
    ["normal-skill", "special", "ultimate"],
    "une categorie que le simulateur ne connait pas n'ouvre aucun seau"
  );
}


/* `apportsDesBuffs` : la difference que font les lignes cochees, et elle
   seule. Le simulateur calcule deja les statistiques du build de son cote ;
   lui passer les entrees completes le compterait deux fois. */
{
  const statsDuBuild = {
    atk:5000, critRate:6960, critDamage:15023, percementDefense:1702,
    bonusElementaire:1353, bonusGlobal:0
  };

  /* Comme plus haut : un objet du bac a sable `vm` ne peut pas etre compare
     par prototype. On compte donc ses cles. */
  assert.equal(
    Object.keys(apportsDesBuffs(statsDuBuild, [])).length, 0,
    "sans ligne cochee, l'equipe n'apporte rien - pas meme un zero"
  );

  const shred = apportsDesBuffs(statsDuBuild, [
    { stat:"C_Critical_Dam_Rate", valeur:1500 },
    { stat:"C_Critical_Rate", valeur:2000 },
    { stat:"D_Protect_Cur_Rate", valeur:1000 }
  ]);
  assert.equal(shred.critDamage, 1500, "le build ne doit pas etre recompte");
  assert.equal(
    shred.critRateAllie, 2000,
    "le taux critique d'un soutien garde son seau, applique apres le plafond"
  );
  assert.equal(shred.percementDefense, 1000);
  assert.equal(
    shred.atk, undefined,
    "une statistique que rien ne touche reste absente du resultat"
  );
}

console.log("comparaison-enchantements.test.js OK");
