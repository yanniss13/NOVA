"use strict";

/* Le filtre d'equipe : qui buffe, avec quelle arme, et pour combien.

   Ces tests portent sur le module PUR. Ils ne lisent ni roster, ni Supabase,
   ni DOM : la vue fait cette corvee et lui passe des coequipiers deja reduits
   a { charId, typeArme, atk }. */

const assert = require("node:assert/strict");
const { loadApp, plain } = require("./helpers/load-app");

const { hooks } = loadApp();
const { buffsApplicables, buffsDeLEquipe } = hooks;

assert.equal(typeof buffsDeLEquipe, "function",
  "buffsDeLEquipe doit etre expose par le chargeur de tests");

/* Daisy porte des buffs de Livre ET de Baguette. C'est le cas qui motive tout
   ce chantier : elle n'en tient qu'une a la fois. */
const DAISY_LIVRE = { charId:"daisy", typeArme:"Livre", atk:null };
const DAISY_BAGUETTE = { charId:"daisy", typeArme:"Baguette", atk:null };

const idsDe = liste => liste.map(buff => buff.id).sort();

/* Sans equipe, la liste est celle d'avant ce module, a l'identique. C'est le
   test qui garantit qu'aucun chiffre ne bouge par defaut. */
{
  const attendu = idsDe(buffsApplicables("thunder"));
  const obtenu = idsDe(buffsDeLEquipe({ element:"thunder", coequipiers:null }));
  assert.deepEqual(obtenu, attendu,
    "sans equipe, la liste doit rester celle de buffsApplicables");
}

/* Un buff venu d'une arme NON equipee disparait. */
{
  const livre = buffsDeLEquipe({
    element:"thunder", coequipiers:[DAISY_LIVRE]
  });
  const baguette = buffsDeLEquipe({
    element:"thunder", coequipiers:[DAISY_BAGUETTE]
  });

  assert.ok(livre.length > 0, "Daisy au Livre doit apporter des buffs");
  assert.ok(baguette.length > 0, "Daisy a la Baguette doit apporter des buffs");
  assert.notDeepEqual(idsDe(livre), idsDe(baguette),
    "les deux armes de Daisy ne doivent pas rendre la meme liste");

  livre.forEach(buff => assert.ok(
    buff.provenance.gameId.includes("_book_"),
    buff.id + " : ne vient pas du Livre alors que c'est l'arme equipee"
  ));
  livre.forEach(buff => assert.equal(buff.arme, "Livre",
    buff.id + " : doit etre annote de l'arme d'ou il vient"));
}

/* Le filtre par element continue de s'appliquer PAR-DESSUS celui par arme :
   la charge electrique de Daisy ne vaut que pour un build Foudre. */
{
  const foudre = buffsDeLEquipe({
    element:"thunder", coequipiers:[DAISY_LIVRE]
  });
  const feu = buffsDeLEquipe({
    element:"fire", coequipiers:[DAISY_LIVRE]
  });
  assert.ok(foudre.length > feu.length,
    "un build Foudre doit voir plus de buffs de Daisy qu'un build Feu");
}

/* Un coequipier hors table n'apporte rien, et ne casse rien. */
{
  const rien = buffsDeLEquipe({
    element:"dark",
    coequipiers:[{ charId:"meliodas", typeArme:"Epee 1 main", atk:12000 }]
  });
  assert.deepEqual(rien, [],
    "un personnage sans buff modelise ne doit rien apporter");
}

/* Les QUATRE sieges comptent, et l'ordre de l'equipe est conserve : le membre
   lit son equipe telle qu'il l'a composee, pas dans l'ordre du catalogue. */
{
  const equipe = buffsDeLEquipe({
    element:"thunder",
    coequipiers:[
      { charId:"gowther", typeArme:"Livre", atk:null },
      DAISY_LIVRE
    ]
  });
  const supports = [...new Set(equipe.map(buff => buff.support))];
  assert.deepEqual(supports, ["gowther", "daisy"],
    "l'ordre des sieges de l'equipe doit etre conserve");
}

/* Le buff indexe sur l'ATK : chiffre, ecrete, et repli. */
{
  const surCible = atk => buffsDeLEquipe({
    element:"thunder",
    coequipiers:[{ charId:"gowther", typeArme:"Baguette", atk }]
  }).find(buff => buff.id === "gowther-confusion-attaque-foudre");

  /* 10 % de 20 000 = 2000, sous le plafond de 3000. */
  const sousLePlafond = surCible(20000);
  assert.ok(sousLePlafond, "le buff indexe doit etre present a la Baguette");
  assert.equal(sousLePlafond.valeur, 2000, "10 % de 20 000 d'ATK valent 2000");
  assert.equal(sousLePlafond.repli, false,
    "une valeur calculee n'est pas un repli");

  /* 10 % de 50 000 = 5000, ecrete au plafond publie. */
  assert.equal(surCible(50000).valeur, 3000,
    "la valeur doit etre ecretee au plafond de 3000");

  /* Build illisible : on rend le plafond, et on le DIT. */
  const repli = surCible(null);
  assert.equal(repli.valeur, 3000,
    "sans ATK connue, le repli est le plafond - le chiffre d'avant");
  assert.equal(repli.repli, true,
    "un repli doit etre signale, pour que la vue ne le presente pas comme un calcul");

  /* Une ATK nulle est un build illisible, pas un buff nul. */
  assert.equal(surCible(0).repli, true, "une ATK nulle vaut build illisible");
}

/* Un buff NON indexe garde sa valeur, quelle que soit l'ATK du support. */
{
  buffsDeLEquipe({
    element:"thunder",
    coequipiers:[{ charId:"daisy", typeArme:"Livre", atk:99999 }]
  }).filter(buff => buff.unite !== "flat").forEach(buff => {
    assert.equal(buff.repli, false,
      buff.id + " : un buff a valeur fixe n'est jamais un repli");
  });
}

/* L'ARME QUE NOMME UN gameId, et les deux orthographes de Gil Thunder.

   Le meme personnage s'ecrit `gil_thunder_` sur sa Lance et `gilthunder_` sur
   son Bouclier. C'est exactement le piege que la regle du jeton existe pour
   eviter : un decoupage par position lirait "thunder" comme une arme sur
   le premier, et "shield" correctement sur le second. */
{
  const { armeDuGameId } = hooks;
  assert.equal(typeof armeDuGameId, "function",
    "armeDuGameId doit etre expose par le chargeur de tests");

  assert.equal(armeDuGameId("gil_thunder_lance_skill_rmb"), "Lance",
    "un slug a tiret bas ne doit pas decaler la lecture de l'arme");
  assert.equal(armeDuGameId("gilthunder_shield_passive"), "Shield",
    "l'autre orthographe du meme personnage doit rendre la meme reponse");
  assert.equal(armeDuGameId("escanor_sword2h_jumpatk"), "Sword2h",
    "Sword1h et Sword2h sont deux jetons distincts");
  assert.equal(armeDuGameId("manny_sworddual_jumpatk"), "SwordDual");

  assert.equal(armeDuGameId("daisy_passive"), null,
    "un gameId sans jeton d'arme ne doit nommer aucune arme");
  assert.equal(armeDuGameId(null), null);
  assert.equal(armeDuGameId(""), null);

  const armesConnues = Object.keys(plain(hooks.ENUM_TO_FOLDER));
  assert.equal(armesConnues.length, 12, "le depot connait douze types d'arme");
  const tousLesIds = Object.values(plain(hooks.SEVEN_DS_BUFFS_SUPPORTS || {}))
    .flat()
    .map(ligne => ligne.provenance.gameId);
  assert.ok(tousLesIds.length > 0, "la table doit fournir des gameId a verifier");
  tousLesIds.forEach(gameId => {
    const nommees = armesConnues.filter(arme => String(gameId).toLowerCase()
      .includes("_" + arme.toLowerCase() + "_"));
    assert.equal(nommees.length, 1,
      gameId + " : doit nommer exactement une arme, trouve " + nommees.join(", "));
  });
}

console.log("equipe-buffs.test.js OK");
