"use strict";

/* Le module métier des objets du wiki : les quatre listes et les ensembles.

   Deux régimes de lecture, et les deux comptent :

   1. sur des données FABRIQUÉES, pour les règles qui doivent tenir quoi qu'il
      arrive — la tolérance à une statistique absente, le tri, un ensemble sans
      palier 7 ;
   2. sur les données RÉELLES du dépôt, pour les effectifs. C'est ce second
      volet qui criera le jour où le jeu ajoutera une arme sans qu'on
      régénère. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
/* Les valeurs nées dans le contexte `vm` portent le prototype d'un AUTRE
   realm : `deepEqual` les refuse alors même que le contenu est identique. */
const { plain } = require("./helpers/load-app");

const RACINE = path.join(__dirname, "..");

const FOLDER_TO_ENUM = {
  "Baguette":"Wand", "Baton":"Staff", "Bouclier":"Shield",
  "Epee 1 main":"Sword1h", "Epee 2 mains":"Sword2h",
  "Epees doubles":"SwordDual", "Gantelets":"Gauntlets", "Hache":"Axe",
  "Lance":"Lance", "Livre":"Book", "Nunchaku":"Cudgel3c", "Rapiere":"Rapier"
};

function charger(data, buildStats){
  const source = fs
    .readFileSync(path.join(RACINE, "js", "metier", "wiki-equipement.js"), "utf8")
    .replace(/^\s*import\s[\s\S]*?from\s+"[^"]*";\s*$/gm, "")
    .replace(/export\s*\{[^}]*\};?/, "");
  const contexte = {
    DATA:data,
    BUILD_STATS:buildStats,
    FOLDER_TO_ENUM,
    LINKED_ARMOR_SLOT:"Armure liee"
  };
  vm.runInNewContext(
    source + "\nthis.__api = { armesDuWiki, armuresDuWiki, bijouxDuWiki,"
      + " graveesDuWiki, ensembleDe, objetDuWiki };",
    contexte,
    { filename:"wiki-equipement.js" }
  );
  return contexte.__api;
}

/* Les vraies données du dépôt, lues comme le navigateur les lit : deux
   scripts classiques qui posent chacun leur `window.SEVEN_DS_*`. */
function chargerReel(){
  const bac = { window:{} };
  ["data.js", "stats-build.js"].forEach(fichier => {
    vm.runInNewContext(
      fs.readFileSync(path.join(RACINE, "data", fichier), "utf8"),
      bac,
      { filename:fichier }
    );
  });
  return charger(bac.window.SEVEN_DS_DATA, bac.window.SEVEN_DS_BUILD_STATS);
}

/* ======================= Données fabriquées ======================= */

const DATA_TEST = {
  armes:{
    "Hache":[
      { name:"Hache B", file:"7ds-armes/Hache/hache-b.webp" },
      { name:"Hache A", file:"7ds-armes/Hache/hache-a.webp" }
    ],
    "Epee & bouclier":[
      { name:"Bouclier sans stats", file:"7ds-armes/Bouclier/orphelin.webp" }
    ]
  },
  armures:{
    "Haut":[{ name:"Haut du néant", file:"7ds-armures-ssr/Haut/haut.webp" }],
    "Armure liee":[
      { name:"Arrogance", file:"7ds-armures-ssr/Armure liee/arrogance.webp" },
      { name:"Sans héros", file:"7ds-armures-ssr/Armure liee/orpheline.webp" }
    ]
  },
  bijoux:{
    "Anneau":[{ name:"Anneau du néant", file:"7ds-bijoux/Anneau/anneau.webp" }]
  }
};

const STATS_TEST = {
  weaponsByFile:{
    "7ds-armes/Hache/hache-a.webp":{
      weaponType:"Axe",
      passiveLevels:[{ level:1, textFr:"Passif" }],
      gradesByGameId:{
        a:{ rarity:"grade3" }, b:{ rarity:"grade1" }, c:{ rarity:"grade2" }
      }
    },
    "7ds-armes/Hache/hache-b.webp":{
      weaponType:"Axe",
      passiveLevels:null,
      gradesByGameId:{ a:{ rarity:"grade5" } }
    }
  },
  gearByFile:{
    "7ds-armures-ssr/Haut/haut.webp":{
      slot:"Top", grade:"grade5", setId:"neant"
    },
    "7ds-bijoux/Anneau/anneau.webp":{
      slot:"Ring", grade:"grade5", setId:"neant"
    }
  },
  engravedByFile:{
    "7ds-armures-ssr/Armure liee/arrogance.webp":{ character:"escanor" }
  },
  gearSets:{
    neant:{
      nameFr:"Au bord du néant",
      twoCount:2, twoStats:[{ stat:"A", value:1 }], twoTextFr:"Deux pièces",
      fourCount:3, fourStats:[{ stat:"B", value:2 }], fourTextFr:"Trois pièces",
      sevenCount:null, sevenStats:null, sevenTextFr:null
    }
  }
};

// Les listes sont triées par nom, et une arme sans statistiques reste listée.
{
  const { armesDuWiki } = charger(DATA_TEST, STATS_TEST);
  const liste = plain(armesDuWiki());
  assert.deepEqual(
    liste.map(arme => arme.nom),
    ["Bouclier sans stats", "Hache A", "Hache B"],
    "les armes doivent être triées par nom"
  );

  /* L'orpheline : image présente, statistiques absentes. Elle reste listée,
     sinon une arme ajoutée au dépôt avant la régénération disparaîtrait de la
     grille — un trou silencieux, le pire des états. */
  const orpheline = liste[0];
  assert.deepEqual(orpheline.raretes, []);
  assert.equal(orpheline.rareteMax, null);
  assert.equal(orpheline.aPassif, false);
  /* Son type reste connu : il se lit sur le DOSSIER de l'image. Attention, le
     dossier (« Bouclier ») n'est pas la clé de DATA.armes (« Epee & bouclier »),
     qui est un libellé d'affichage. */
  assert.equal(orpheline.type, "Shield");
}

// Les raretés suivent l'ordre du jeu, pas l'ordre alphabétique du dictionnaire.
{
  const { armesDuWiki } = charger(DATA_TEST, STATS_TEST);
  const hacheA = plain(armesDuWiki()).find(arme => arme.nom === "Hache A");
  assert.deepEqual(hacheA.raretes, ["grade1", "grade2", "grade3"]);
  assert.equal(hacheA.rareteMax, "grade3");
  assert.equal(hacheA.aPassif, true);

  const hacheB = plain(armesDuWiki()).find(arme => arme.nom === "Hache B");
  assert.equal(hacheB.aPassif, false, "passiveLevels nul n'est pas un passif");
}

/* Les armures gravées ne sont PAS des armures : elles vivent sous la même clé
   dans data.js, et il faut les en retirer. */
{
  const api = charger(DATA_TEST, STATS_TEST);
  assert.deepEqual(plain(api.armuresDuWiki()).map(p => p.nom), ["Haut du néant"]);
  assert.deepEqual(plain(api.bijouxDuWiki()).map(p => p.nom), ["Anneau du néant"]);
  assert.deepEqual(
    plain(api.graveesDuWiki()).map(p => p.nom),
    ["Arrogance", "Sans héros"]
  );
}

// La famille affichée est celle du site, connue même sans statistiques.
{
  const { armuresDuWiki, graveesDuWiki } = charger(DATA_TEST, STATS_TEST);
  assert.equal(plain(armuresDuWiki())[0].famille, "Haut");
  assert.equal(plain(armuresDuWiki())[0].setId, "neant");
  assert.equal(plain(graveesDuWiki())[0].heros, "escanor");
  assert.equal(
    plain(graveesDuWiki())[1].heros, null,
    "une gravée sans entrée chiffrée reste listée, sans héros"
  );
}

/* Un ensemble rend TOUTES ses pièces, armures et bijoux confondus : c'est ce
   qui répare la coupure des deux grilles. */
{
  const { ensembleDe } = charger(DATA_TEST, STATS_TEST);
  const ensemble = plain(ensembleDe("neant"));
  assert.equal(ensemble.nom, "Au bord du néant");
  assert.deepEqual(
    ensemble.pieces.map(p => p.nom),
    ["Anneau du néant", "Haut du néant"],
    "un ensemble doit rendre ses pièces des deux catégories"
  );
}

/* Les seuils ne sont pas 2 / 4 / 7 : ils se lisent dans les données. Et un
   palier absent n'est pas un palier à zéro — il n'existe pas. */
{
  const { ensembleDe } = charger(DATA_TEST, STATS_TEST);
  const paliers = plain(ensembleDe("neant")).paliers;
  assert.equal(paliers.length, 2, "l'ensemble n'a pas de palier 7");
  assert.deepEqual(paliers.map(p => p.compte), [2, 3]);
  assert.deepEqual(paliers.map(p => p.texte), ["Deux pièces", "Trois pièces"]);
}

// Un identifiant inconnu ne lève pas : le site doit rester affichable.
{
  const { ensembleDe } = charger(DATA_TEST, STATS_TEST);
  assert.equal(ensembleDe("inexistant"), null);
  assert.equal(ensembleDe(null), null);
}

/* `objetDuWiki` rend l'entrée ET la liste de sa catégorie : la modale garde
   ainsi son « précédent / suivant » quand on y arrive par une pièce sœur. */
{
  const { objetDuWiki } = charger(DATA_TEST, STATS_TEST);
  const trouve = plain(objetDuWiki("7ds-bijoux/Anneau/anneau.webp"));
  assert.equal(trouve.entree.nom, "Anneau du néant");
  assert.equal(trouve.entree.nature, "bijou");
  assert.deepEqual(trouve.liste.map(p => p.nom), ["Anneau du néant"]);
  assert.equal(objetDuWiki("7ds-armes/inconnue.webp"), null);
}

// Les données peuvent manquer entièrement sans que rien ne lève.
{
  const api = charger({}, {});
  assert.deepEqual(plain(api.armesDuWiki()), []);
  assert.deepEqual(plain(api.armuresDuWiki()), []);
  assert.deepEqual(plain(api.bijouxDuWiki()), []);
  assert.deepEqual(plain(api.graveesDuWiki()), []);
  assert.equal(api.ensembleDe("neant"), null);
  assert.equal(api.objetDuWiki("x"), null);
}

/* ========================= Données réelles ========================= */

{
  const api = chargerReel();
  const armes = api.armesDuWiki();
  const armures = api.armuresDuWiki();
  const bijoux = api.bijouxDuWiki();
  const gravees = api.graveesDuWiki();

  assert.equal(armes.length, 155, "155 armes attendues");
  assert.equal(armures.length, 62, "62 armures attendues");
  assert.equal(bijoux.length, 37, "37 bijoux attendus");
  assert.equal(gravees.length, 68, "68 armures gravées attendues");

  assert.equal(
    armes.filter(arme => arme.aPassif).length, 94,
    "94 armes portent un passif ; les 61 autres n'en ont pas, "
      + "et leur fiche ne doit pas inventer de section"
  );

  /* Aucune pièce ne doit avoir perdu sa jointure : un chemin d'image qui ne
     retrouve pas ses statistiques est une régénération manquée. La rareté est
     le témoin — elle vient des statistiques, pas de l'image. */
  assert.deepEqual(
    plain(armures.concat(bijoux).filter(piece => !piece.grade).map(p => p.nom)), [],
    "toute pièce d'équipement doit retrouver ses statistiques"
  );

  /* ⚠️ Une pièce n'appartient PAS forcément à un ensemble : 30 sur 99 sont
     autonomes. Vingt d'entre elles sont le palier bas (qualité 86-100) et ne
     portent rien de plus que leurs statistiques ; les dix autres (101-130)
     portent un passif à trois niveaux À LA PLACE de l'ensemble — aucune pièce
     d'ensemble n'a de passif. La fiche doit donc afficher l'un OU l'autre,
     et savoir n'afficher ni l'un ni l'autre. */
  assert.equal(
    armures.concat(bijoux).filter(piece => piece.setId).length, 69,
    "69 pièces appartiennent à un ensemble"
  );
  assert.equal(
    armures.concat(bijoux).filter(piece => !piece.setId).length, 30,
    "30 pièces sont autonomes"
  );

  assert.deepEqual(
    plain(gravees.filter(piece => !piece.heros).map(p => p.nom)), [],
    "toute armure gravée est liée à un héros"
  );
  assert.deepEqual(
    plain(armes.filter(arme => !arme.type).map(a => a.nom)), [],
    "toute arme a un type"
  );

  // Tout ensemble cité par une pièce se retrouve, avec ses pièces.
  const cites = [...new Set(
    armures.concat(bijoux).map(piece => piece.setId).filter(Boolean)
  )];
  assert.equal(cites.length, 15, "15 ensembles attendus");
  cites.forEach(setId => {
    const ensemble = api.ensembleDe(setId);
    assert.ok(ensemble, setId + " : ensemble introuvable");
    assert.ok(ensemble.nom && ensemble.nom !== setId,
      setId + " : nom français manquant");
    assert.ok(ensemble.paliers.length >= 1, setId + " : aucun palier");
    ensemble.paliers.forEach(palier => {
      assert.ok(palier.texte, setId + " : palier sans texte");
    });
    assert.ok(ensemble.pieces.length >= 2, setId + " : moins de deux pièces");
  });

  /* Le cas qui a motivé la séparation des grilles : un ensemble d'accessoires
     n'a que des bijoux, et sa fiche doit quand même les lister tous. */
  const bijouterie = api.ensembleDe("accessory_t5_corruption");
  assert.ok(
    bijouterie.pieces.every(piece => piece.nature === "bijou"),
    "cet ensemble ne contient que des bijoux"
  );
  assert.ok(bijouterie.pieces.length >= 2);
}

console.log("PASS wiki : objets, ensembles et jointure aux statistiques");
