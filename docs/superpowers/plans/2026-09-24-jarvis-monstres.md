# J.A.R.V.I.S. lot 2a — monstres et boss : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** J.A.R.V.I.S. répond sur les faiblesses et résistances des monstres et boss du jeu, lues dans un export local, déposées dans un stockage Supabase privé et consultées par deux nouveaux outils.

**Architecture:** Un extracteur local (`outils/fabrication/`) produit `output/jarvis/monstres.json`. Il est découpé en une logique pure, testée en CI sur un mini-export, et une enveloppe qui lit le disque. Le fichier est déposé à la main dans le bucket privé `jarvis-prive`. Un nouveau module partagé (`_shared/discord-jarvis-monstres.js`) lit ce bucket, avec un cache et `fetch` injecté, et fournit les outils `fiche_monstre` et `chercher_monstres`, branchés sur `creerOutilsJarvis`.

**Tech Stack:** Node (CommonJS) pour l'extracteur ; JavaScript universel Node/Deno pour le module partagé ; Edge Function Supabase (Deno/TypeScript) ; Supabase Storage (REST `/storage/v1/object`) ; tests Node en `assert`.

**Spec:** `docs/superpowers/specs/2026-09-24-jarvis-monstres-design.md`

## Global Constraints

- Français partout dans les libellés visibles.
- **Aucune donnée du jeu dans le dépôt ni sur Pages** : `monstres.json` n'existe que dans `output/jarvis/`, qu'on ajoute à `.gitignore`, et dans le bucket privé.
- **Aucun chemin de disque** dans un fichier suivi (`tests/chemins-personnels.test.js`) : l'export se lit via `DONNEES_JEU`, et la racine du dépôt se trouve par `__dirname`.
- Bucket `jarvis-prive` : `public = false`, **aucune politique** sur `storage.objects`. Seule la clé `service_role` le lit.
- Signe des faiblesses : `<Élément>_Weakness_Rate` > 0 est une faiblesse, < 0 une résistance. Unité : le dix-millième (`2000` = 20 %).
- Le groupe `stat_poweroverwhelming` est écarté, **sauf** pour un acteur qui a des paliers dans `BossStatGroupTable` : ses paliers sont alors sa vraie source (cas d'Akumu).
- Cache de lecture : succès 1 heure (3 600 000 ms), échec 1 minute (60 000 ms), format `version === 1`.
- PV, défense et attaque sont toujours étiquetés `"valeurs de base, avant ajustement du niveau de monde"`.
- Plafonds : `fiche_monstre` rend 5 versions au plus, `chercher_monstres` 15 résultats au plus, chacun avec son total.
- Noms de premier niveau uniques dans tout le projet (suffixe `Jarvis` ou `Monstre`).
- Commits : `type(portee): sujet` en français, terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. **Ne jamais pousser** sans accord.
- Les fichiers du dépôt mélangent CRLF et LF : ne pas normaliser un fichier entier.

## Review Focus

- **Nom trop vague** (« démon » couvre Démon rouge et Démon gris) : l'outil prend la meilleure correspondance et **nomme les autres**, au lieu de choisir en silence. Tâche 3.
- **Élément donné en anglais par Gemini** (« holy », « Fire ») : il doit être reconnu comme en français. Tâche 3.
- **Monstre aux nombreuses versions** (les « abysses » en ont des dizaines) : 5 versions au plus, avec le total, et un rappel qu'un filtre `contexte` existe. Tâche 3.
- **Fichier déposé d'un autre format, ou tronqué** : le lecteur le refuse, et les outils répondent « indisponibles » au lieu de planter. Tâche 3.
- **Palier d'Akumu absent des données alors que le niveau est dans les bornes** : réponse claire avec les niveaux disponibles. Tâche 3.

---

## Structure des fichiers

| Fichier | Action | Responsabilité |
| --- | --- | --- |
| `outils/fabrication/monstres-jarvis.js` | Créer | Logique pure : tables lues → catalogue `version:1`. |
| `outils/fabrication/extraire-monstres.js` | Créer | Enveloppe : lit l'export via `DONNEES_JEU`, écrit `output/jarvis/monstres.json`. |
| `tests/monstres-jarvis.test.js` | Créer | Mini-export et attentes de l'extraction. Exporte `ENTREE_MONSTRES_TEST`. |
| `supabase/schema.sql` | Modifier (fin de fichier) | Bucket privé `jarvis-prive`. |
| `.gitignore` | Modifier | `output/jarvis/`. |
| `tests/jarvis-stockage.test.js` | Créer | Bucket privé sans politique, et `.gitignore`. |
| `supabase/functions/_shared/discord-jarvis-monstres.js` | Créer | Lecteur du bucket (cache), outils `fiche_monstre` et `chercher_monstres`, déclarations Gemini. |
| `tests/discord-jarvis-monstres.test.js` | Créer | Lecteur et outils. |
| `supabase/functions/_shared/discord-jarvis-outils.js` | Modifier | Brancher les deux outils et leurs déclarations. |
| `supabase/functions/_shared/discord-jarvis.js` | Modifier | Règle de consigne sur les monstres. |
| `supabase/functions/discord-planning/index.ts` | Modifier | Import, lecteur paresseux, `lireMonstres` passé aux outils. |
| `tests/discord-jarvis-outils.test.js`, `tests/discord-jarvis.test.js` | Modifier | 9 déclarations, câblage, consigne. |
| `scripts/lancer-tests.js` | Modifier | Nouveaux tests. |
| `docs/discord-planning.md`, `AGENTS.md`, `outils/fabrication/LISEZMOI.md` | Modifier | Documentation. |

---

### Task 1: Extraction pure du catalogue des monstres

**Files:**
- Create: `outils/fabrication/monstres-jarvis.js`
- Create: `tests/monstres-jarvis.test.js`
- Modify: `scripts/lancer-tests.js`

**Interfaces:**
- Produces: `construireCatalogueMonstres(entree) → catalogue`, exporté par `module.exports`.
  - `entree` : `{ monstres, groupes, paliersBoss, bossTerrain, donjons, groupesDonjon, zones, apparitions, textes, genereLe, dateExport }`. Les huit premiers champs sont des objets `Rows` des tables, sauf `apparitions` : `[{ fichier, zone, acteurs:string[] }]`. `textes` est le `client_language_table` de `Game.json`.
  - `catalogue` : `{ version:1, genereLe, dateExport, monstres:[{ nom, rang, versions:[{ rang, acteurs:string[], niveau?:number, contextes:[{ type, libelle }], stats, puissance? }] }] }`, où :
    - `type` ∈ `confrerie | terrain | donjon | cross | zone` ;
    - `rang` ∈ `boss | elite | normal` ;
    - `stats` = `{ faiblesses:{Default,Thunder,Wind,Fire,Ice,Earth,Dark,Holy}, resistances:{mêmes clés}, pv, defense, attaque, resCrit, defCrit, blocage, reducBlocage, reducTous }` (nombres bruts) ;
    - `puissance` = `{ "1":3144, … }`.
- Produces: `tests/monstres-jarvis.test.js` exporte `ENTREE_MONSTRES_TEST`. La tâche 3 s'en sert.

- [ ] **Step 1: Écrire le test**

Créer `tests/monstres-jarvis.test.js` :

```js
"use strict";

/* L'extraction des monstres pour /jarvis, sur un mini-export ecrit ici. Les
   formes des tables sont celles de l'export reel du 24/09/2026 : trois
   Demons rouges, dont la version Cross Challenge, Akumu et ses paliers
   (son acteur pointe sur le groupe de test), un donjon nomme, un monstre
   sans contexte, un acteur sans nom. */

const assert = require("node:assert/strict");
const path = require("node:path");

const { construireCatalogueMonstres } = require(path.resolve(
  __dirname, "..", "outils", "fabrication", "monstres-jarvis.js"
));

const ELEMENTS = ["Default", "Thunder", "Wind", "Fire", "Ice", "Earth", "Dark", "Holy"];
function groupe(faiblesses, autres) {
  const g = {};
  ELEMENTS.forEach(e => {
    g[e + "_Weakness_Rate"] = (faiblesses && faiblesses[e]) || 0;
    g[e + "_Element_Res_Rate"] = 1000;
  });
  return Object.assign(g, {
    B_MaxHp:95747, B_Def:555, B_Atk:1547, C_Critical_ResRate:1000,
    C_Critical_DamRes_Rate:869, A_Block:177, D_Block_DamRes_Rate:9500, D_All_DamRes_Rate:0
  }, autres || {});
}
const TOUS_A = valeur => Object.fromEntries(ELEMENTS.map(e => [e, valeur]));
const PUISSANCE = [
  { StandardWorldLevelTID:"Level_01", BattlePower:3144 },
  { StandardWorldLevelTID:"Level_04", BattlePower:19495 }
];
const NOM_ROUGE = "Local_Mon_Name_Boss_Demon_Red_0001";

const ENTREE_MONSTRES_TEST = {
  textes:{
    local_mon_name_boss_demon_red_0001:"Démon rouge",
    local_mon_name_akumu:"Akumu, bête démoniaque",
    local_mon_name_rabbit:"Lapin",
    local_dungeon_main_name_2806:"Démon rouge",
    local_dungeon_main_sub_name_2806:"Réveil après un long sommeil",
    local_dungeon_sub_name_2801:"Facile",
    local_dungeon_sub_name_2804:"Cauchemar",
    area_sector_1m:"Britannia"
  },
  monstres:{
    "50103301":{ Local_Key:NOM_ROUGE, grade:"EActorGrade::Boss", StatGroupTid:"stat_50103301", Recommend_BattlePower:PUISSANCE },
    "50103302":{ Local_Key:NOM_ROUGE, grade:"EActorGrade::Boss", StatGroupTid:"stat_50103301", Recommend_BattlePower:PUISSANCE },
    "51900001":{ Local_Key:NOM_ROUGE, grade:"EActorGrade::Boss", StatGroupTid:"stat_51900001", Recommend_BattlePower:[] },
    "50600106":{ Local_Key:NOM_ROUGE, grade:"EActorGrade::Boss", StatGroupTid:"stat_50600106", Recommend_BattlePower:[] },
    "51300009":{ Local_Key:NOM_ROUGE, grade:"EActorGrade::Boss", StatGroupTid:"stat_poweroverwhelming", Recommend_BattlePower:[] },
    "50700109":{ Local_Key:"local_mon_name_akumu", grade:"EActorGrade::Boss", StatGroupTid:"stat_poweroverwhelming", Recommend_BattlePower:[] },
    "60000001":{ Local_Key:"local_mon_name_rabbit", grade:"EActorGrade::Normal", StatGroupTid:"stat_rabbit", Recommend_BattlePower:[] },
    "60000002":{ Local_Key:"local_mon_name_sans_texte", grade:"EActorGrade::Elite", StatGroupTid:"stat_rabbit", Recommend_BattlePower:[] },
    "60000003":{ Local_Key:"local_mon_name_rabbit", grade:"EActorGrade::Normal", StatGroupTid:"stat_absent", Recommend_BattlePower:[] }
  },
  groupes:{
    stat_50103301:groupe({ Fire:-3000, Earth:2000, Holy:2000 }),
    stat_51900001:groupe({ Fire:-3000, Earth:2000, Holy:2000 }, { B_Atk:1426 }),
    stat_50600106:groupe(Object.assign(TOUS_A(-8000), { Ice:3000, Holy:3000 }), { B_Atk:601 }),
    stat_50700109_1:groupe(TOUS_A(-3000), { B_MaxHp:1000000 }),
    stat_50700109_30:groupe(TOUS_A(-3000), { B_MaxHp:9000000 }),
    stat_rabbit:Object.assign(groupe(null, { B_MaxHp:100, B_Def:5, B_Atk:3 }),
      Object.fromEntries(ELEMENTS.map(e => [e + "_Element_Res_Rate", 0]))),
    stat_poweroverwhelming:groupe(null, { B_MaxHp:9999999 })
  },
  paliersBoss:{
    "1001":{ Boss_Tid:50700109, Stat_Level:1, Stat_Group:"stat_50700109_1" },
    "1030":{ Boss_Tid:50700109, Stat_Level:30, Stat_Group:"stat_50700109_30" }
  },
  bossTerrain:{ "1":{ FieldBossTid:"50103301" } },
  donjons:{
    "1601":{ Dungeon_Zone:50801003, Dungeon_Type:"EDungeonType::Boss_Replay_Event",
      Dungeon_Group:81002806, Local_Sub_Name:"local_dungeon_sub_name_2801", Dungeon_Clear_Value:"51900001" },
    "1604":{ Dungeon_Zone:50801003, Dungeon_Type:"EDungeonType::Boss_Replay_Event",
      Dungeon_Group:81002806, Local_Sub_Name:"local_dungeon_sub_name_2804", Dungeon_Clear_Value:"51900001" }
  },
  groupesDonjon:{
    "81002806":{ Local_Main_Name:"local_dungeon_main_name_2806",
      Local_Main_Sub_Name:"local_dungeon_main_sub_name_2806", Dungeon_Core_Monster:["51900001"] }
  },
  zones:{ "50201001":{ Local_ZoneName:"area_sector_1m" }, "50801003":{ Local_ZoneName:"None" } },
  apparitions:[
    { fichier:"Chapter_03_Mon_spawntable", zone:"50201001", acteurs:["50103302"] },
    { fichier:"CrossChallenge_50406002_Spawn_spawntable", zone:"50406002", acteurs:["50600106"] },
    { fichier:"DemonRed_Spawn_spawntable", zone:"50801003", acteurs:["51900001"] }
  ],
  genereLe:"2026-09-24T12:00:00.000Z",
  dateExport:"2026-09-24"
};

const LIBELLE_DONJON = "Donjon : Démon rouge — Réveil après un long sommeil"
  + " (boss rejouable, événement) — Facile, Cauchemar";

function main() {
  const catalogue = construireCatalogueMonstres(ENTREE_MONSTRES_TEST);
  assert.equal(catalogue.version, 1);
  assert.equal(catalogue.dateExport, "2026-09-24");
  assert.equal(catalogue.genereLe, "2026-09-24T12:00:00.000Z");
  assert.deepEqual(catalogue.monstres.map(m => m.nom),
    ["Akumu, bête démoniaque", "Démon rouge", "Lapin"],
    "tri par nom ; l'acteur sans texte et le groupe absent sont ecartes");

  const rouge = catalogue.monstres.find(m => m.nom === "Démon rouge");
  assert.equal(rouge.rang, "boss");
  assert.equal(rouge.versions.length, 3,
    "terrain et chapitre 3 fusionnes (memes stats), donjon, Cross Challenge ; le groupe de test ecarte");
  const [terrain, donjon, cross] = rouge.versions;
  assert.deepEqual(terrain.acteurs, ["50103301", "50103302"]);
  assert.deepEqual(terrain.contextes, [
    { type:"terrain", libelle:"Boss de terrain" },
    { type:"zone", libelle:"Zone : Britannia" }
  ]);
  assert.deepEqual(terrain.puissance, { "1":3144, "4":19495 });
  assert.equal(terrain.stats.faiblesses.Fire, -3000, "negatif = resistance, tel quel");
  assert.equal(terrain.stats.faiblesses.Earth, 2000);
  assert.equal(terrain.stats.resistances.Holy, 1000);
  assert.deepEqual(
    [terrain.stats.pv, terrain.stats.defense, terrain.stats.attaque, terrain.stats.resCrit, terrain.stats.defCrit],
    [95747, 555, 1547, 1000, 869]);
  assert.deepEqual(donjon.acteurs, ["51900001"]);
  assert.deepEqual(donjon.contextes, [{ type:"donjon", libelle:LIBELLE_DONJON }],
    "l'apparition dans la zone du donjon prend le nom du donjon, sans doublon");
  assert.equal(donjon.puissance, undefined, "aucune puissance publiee, aucun champ");
  assert.deepEqual(cross.contextes, [{ type:"cross", libelle:"Cross Challenge" }]);
  assert.equal(cross.stats.faiblesses.Ice, 3000);
  assert.equal(cross.stats.faiblesses.Thunder, -8000);
  assert.ok(!rouge.versions.some(v => v.acteurs.includes("51300009")),
    "stat_poweroverwhelming est un groupe de test");

  const akumu = catalogue.monstres.find(m => m.nom.startsWith("Akumu"));
  assert.deepEqual(akumu.versions.map(v => v.niveau), [1, 30],
    "les paliers de BossStatGroupTable, malgre l'acteur sur le groupe de test");
  assert.deepEqual(akumu.versions[0].contextes, [{ type:"confrerie", libelle:"Boss de confrérie" }]);
  assert.equal(akumu.versions[1].stats.pv, 9000000);
  assert.equal(akumu.versions[0].stats.faiblesses.Holy, -3000);

  const lapin = catalogue.monstres.find(m => m.nom === "Lapin");
  assert.equal(lapin.rang, "normal");
  assert.deepEqual(lapin.versions[0].contextes, [], "aucun contexte retrouve : liste vide");
  assert.equal(lapin.versions[0].stats.resistances.Fire, 0);

  console.log("OK monstres-jarvis");
}

module.exports = { ENTREE_MONSTRES_TEST };

if(require.main === module) main();
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `node tests/monstres-jarvis.test.js`
Expected: FAIL avec `Cannot find module …monstres-jarvis.js`

- [ ] **Step 3: Écrire la logique pure**

Créer `outils/fabrication/monstres-jarvis.js` :

```js
"use strict";

/* Le catalogue des monstres que /jarvis consulte : logique PURE.

   Elle recoit les tables deja lues et rend l'objet a deposer dans le bucket
   prive `jarvis-prive`. Aucun acces disque ici : `extraire-monstres.js` lit
   l'export, et les tests lui tendent un mini-export.

   LA CHAINE, verifiee sur l'export du 24/09/2026 :
     MonsterActorTable[id].Local_Key -> Localization fr (cle sans la casse)
     MonsterActorTable[id].StatGroupTid -> NpcStatGroupTable
     BossStatGroupTable (Boss_Tid, Stat_Level, Stat_Group) -> les paliers
       d'un boss de confrerie. L'acteur d'Akumu pointe sur le groupe de test :
       ses paliers sont sa seule vraie source.

   Signe, confirme en jeu : <Element>_Weakness_Rate > 0 est une faiblesse,
   < 0 une resistance. Les valeurs restent brutes (dix-milliemes) : c'est le
   module du bot qui les met en mots. */

const ELEMENTS_EXTRACTION = ["Default", "Thunder", "Wind", "Fire", "Ice", "Earth", "Dark", "Holy"];
const GROUPE_DE_TEST = "stat_poweroverwhelming";
const RANGS_EXTRACTION = { "EActorGrade::Boss":"boss", "EActorGrade::Elite":"elite" };
const ORDRE_RANGS = ["normal", "elite", "boss"];
const ORDRE_CONTEXTES_EXTRACTION = ["confrerie", "terrain", "donjon", "cross", "zone"];
const TYPES_DONJON = {
  Normal:"donjon", Raid:"raid", Stella:"Stella", Boss_Replay:"boss rejouable",
  Boss_Replay_Event:"boss rejouable, événement", Boss_Guild:"boss de confrérie",
  Boss_Guild_Training:"entraînement de confrérie", Hero:"héros",
  Normal_Event:"événement", Combat:"combat", Subjugation:"soumission"
};

function lecteurDeTextes(textes) {
  const index = new Map();
  Object.entries(textes || {}).forEach(([cle, valeur]) => index.set(cle.toLowerCase(), valeur));
  return cle => {
    if(!cle || cle === "None") return null;
    const valeur = index.get(String(cle).toLowerCase());
    return typeof valeur === "string" && valeur.trim() ? valeur.trim() : null;
  };
}

function enListe(valeur) {
  if(valeur === undefined || valeur === null || valeur === "None") return [];
  return [].concat(valeur).map(String).filter(texte => texte && texte !== "None");
}

function statsDuGroupeExtraction(groupe) {
  const lire = code => Number(groupe[code]) || 0;
  const parElement = suffixe =>
    Object.fromEntries(ELEMENTS_EXTRACTION.map(element => [element, lire(element + suffixe)]));
  return {
    faiblesses:parElement("_Weakness_Rate"),
    resistances:parElement("_Element_Res_Rate"),
    pv:lire("B_MaxHp"), defense:lire("B_Def"), attaque:lire("B_Atk"),
    resCrit:lire("C_Critical_ResRate"), defCrit:lire("C_Critical_DamRes_Rate"),
    blocage:lire("A_Block"), reducBlocage:lire("D_Block_DamRes_Rate"),
    reducTous:lire("D_All_DamRes_Rate")
  };
}

function puissanceExtraction(acteur) {
  const sortie = {};
  (acteur.Recommend_BattlePower || []).forEach(palier => {
    const niveau = /(\d+)$/.exec(String(palier && palier.StandardWorldLevelTID || ""));
    const valeur = Number(palier && palier.BattlePower);
    if(niveau && valeur > 0) sortie[String(Number(niveau[1]))] = valeur;
  });
  return Object.keys(sortie).length ? sortie : null;
}

function prioriteContexte(contexte) {
  return ORDRE_CONTEXTES_EXTRACTION.indexOf(contexte.type);
}

function trierContextes(liste) {
  return liste.sort((a, b) =>
    prioriteContexte(a) - prioriteContexte(b) || a.libelle.localeCompare(b.libelle, "fr"));
}

/* Tous les contextes de chaque acteur : ou le joueur le rencontre. */
function contextesParActeur(entree, texte) {
  const parActeur = new Map();
  const ajouter = (id, contexte) => {
    const cle = String(id);
    if(!parActeur.has(cle)) parActeur.set(cle, []);
    const liste = parActeur.get(cle);
    if(!liste.some(deja => deja.libelle === contexte.libelle)) liste.push(contexte);
  };

  Object.values(entree.paliersBoss || {}).forEach(palier =>
    ajouter(palier.Boss_Tid, { type:"confrerie", libelle:"Boss de confrérie" }));
  Object.values(entree.bossTerrain || {}).forEach(boss =>
    enListe(boss.FieldBossTid).forEach(id =>
      ajouter(id, { type:"terrain", libelle:"Boss de terrain" })));

  /* Un donjon a plusieurs lignes (une par difficulte) qui partagent un groupe :
     c'est le groupe qui porte le nom. */
  const parGroupe = new Map();
  Object.values(entree.donjons || {}).forEach(donjon => {
    const cle = String(donjon.Dungeon_Group);
    if(!parGroupe.has(cle)){
      parGroupe.set(cle, { acteurs:new Set(), difficultes:[], zones:new Set(), type:donjon.Dungeon_Type });
    }
    const groupe = parGroupe.get(cle);
    enListe(donjon.Dungeon_Clear_Value).forEach(id => groupe.acteurs.add(id));
    groupe.zones.add(String(donjon.Dungeon_Zone));
    const difficulte = texte(donjon.Local_Sub_Name);
    if(difficulte && !groupe.difficultes.includes(difficulte)) groupe.difficultes.push(difficulte);
  });
  const libelleParZoneDeDonjon = new Map();
  parGroupe.forEach((groupe, cle) => {
    const ligne = (entree.groupesDonjon || {})[cle] || {};
    enListe(ligne.Dungeon_Core_Monster).forEach(id => groupe.acteurs.add(id));
    const nom = texte(ligne.Local_Main_Name);
    if(!nom) return;
    const sousNom = texte(ligne.Local_Main_Sub_Name);
    const brut = String(groupe.type || "").replace(/^.*::/, "");
    const libelle = "Donjon : " + nom + (sousNom ? " — " + sousNom : "")
      + " (" + (TYPES_DONJON[brut] || brut || "donjon") + ")"
      + (groupe.difficultes.length ? " — " + groupe.difficultes.join(", ") : "");
    groupe.acteurs.forEach(id => ajouter(id, { type:"donjon", libelle }));
    groupe.zones.forEach(zone => {
      if(!libelleParZoneDeDonjon.has(zone)) libelleParZoneDeDonjon.set(zone, libelle);
    });
  });

  (entree.apparitions || []).forEach(apparition => {
    let contexte;
    if(/^crosschallenge_/i.test(apparition.fichier)){
      contexte = { type:"cross", libelle:"Cross Challenge" };
    }else if(libelleParZoneDeDonjon.has(String(apparition.zone))){
      contexte = { type:"donjon", libelle:libelleParZoneDeDonjon.get(String(apparition.zone)) };
    }else{
      const zone = (entree.zones || {})[apparition.zone];
      const nom = zone && texte(zone.Local_ZoneName);
      contexte = { type:"zone", libelle:"Zone : " + (nom || String(apparition.zone)) };
    }
    (apparition.acteurs || []).forEach(id => ajouter(id, contexte));
  });

  parActeur.forEach(trierContextes);
  return parActeur;
}

function copieDeVersion(version) {
  const copie = {
    rang:version.rang,
    acteurs:[...version.acteurs],
    contextes:version.contextes.map(contexte => Object.assign({}, contexte)),
    stats:version.stats
  };
  if(version.niveau !== undefined) copie.niveau = version.niveau;
  if(version.puissance) copie.puissance = version.puissance;
  return copie;
}

function prioriteDeVersion(version) {
  return version.contextes.length ? prioriteContexte(version.contextes[0]) : ORDRE_CONTEXTES_EXTRACTION.length;
}

/* Deux versions aux memes statistiques retenues n'en font qu'une : on garde
   l'union de leurs acteurs et de leurs contextes. Les paliers d'un boss ne se
   fusionnent jamais : leur niveau est leur identite. */
function fusionnerVersions(versions) {
  const sortie = [];
  const parCle = new Map();
  versions.forEach(version => {
    if(version.niveau !== undefined){
      sortie.push(copieDeVersion(version));
      return;
    }
    const cle = JSON.stringify([version.rang, version.stats, version.puissance || null]);
    const deja = parCle.get(cle);
    if(!deja){
      const copie = copieDeVersion(version);
      parCle.set(cle, copie);
      sortie.push(copie);
      return;
    }
    version.acteurs.forEach(id => { if(!deja.acteurs.includes(id)) deja.acteurs.push(id); });
    version.contextes.forEach(contexte => {
      if(!deja.contextes.some(present => present.libelle === contexte.libelle)){
        deja.contextes.push(Object.assign({}, contexte));
      }
    });
    trierContextes(deja.contextes);
  });
  return sortie.sort((a, b) =>
    (a.niveau === undefined ? -1 : a.niveau) - (b.niveau === undefined ? -1 : b.niveau)
    || prioriteDeVersion(a) - prioriteDeVersion(b)
    || a.acteurs[0].localeCompare(b.acteurs[0]));
}

function construireCatalogueMonstres(entree) {
  const texte = lecteurDeTextes(entree.textes);
  const groupes = entree.groupes || {};
  const contextes = contextesParActeur(entree, texte);
  const paliersParBoss = new Map();
  Object.values(entree.paliersBoss || {}).forEach(palier => {
    const cle = String(palier.Boss_Tid);
    if(!paliersParBoss.has(cle)) paliersParBoss.set(cle, []);
    paliersParBoss.get(cle).push(palier);
  });

  const parNom = new Map();
  Object.entries(entree.monstres || {}).forEach(([id, acteur]) => {
    const nom = texte(acteur.Local_Key);
    if(!nom) return;
    const base = {
      rang:RANGS_EXTRACTION[acteur.grade] || "normal",
      acteurs:[String(id)],
      contextes:contextes.get(String(id)) || [],
      puissance:puissanceExtraction(acteur)
    };
    const versions = [];
    const paliers = paliersParBoss.get(String(id));
    if(paliers){
      paliers.forEach(palier => {
        const groupe = groupes[palier.Stat_Group];
        if(groupe){
          versions.push(Object.assign({}, base, {
            niveau:Number(palier.Stat_Level), stats:statsDuGroupeExtraction(groupe)
          }));
        }
      });
    }else if(acteur.StatGroupTid !== GROUPE_DE_TEST && groupes[acteur.StatGroupTid]){
      versions.push(Object.assign({}, base, { stats:statsDuGroupeExtraction(groupes[acteur.StatGroupTid]) }));
    }
    if(!versions.length) return;
    if(!parNom.has(nom)) parNom.set(nom, []);
    parNom.get(nom).push(...versions);
  });

  const monstres = [...parNom].map(([nom, versions]) => ({
    nom,
    rang:versions.reduce((meilleur, version) =>
      ORDRE_RANGS.indexOf(version.rang) > ORDRE_RANGS.indexOf(meilleur) ? version.rang : meilleur, "normal"),
    versions:fusionnerVersions(versions)
  })).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  return {
    version:1,
    genereLe:entree.genereLe || null,
    dateExport:entree.dateExport || null,
    monstres
  };
}

module.exports = { construireCatalogueMonstres };
```

- [ ] **Step 4: Faire passer le test**

Run: `node tests/monstres-jarvis.test.js`
Expected: `OK monstres-jarvis`

- [ ] **Step 5: Enregistrer le test dans la suite**

Dans `scripts/lancer-tests.js`, après `"node tests/discord-jarvis.test.js",`, ajouter :

```js
    "node tests/monstres-jarvis.test.js",
```

- [ ] **Step 6: Commit**

```bash
git add outils/fabrication/monstres-jarvis.js tests/monstres-jarvis.test.js scripts/lancer-tests.js
git commit -m "feat(jarvis): extraction pure du catalogue des monstres

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Extracteur local, bucket privé et `.gitignore`

**Files:**
- Create: `outils/fabrication/extraire-monstres.js`
- Modify: `.gitignore`
- Modify: `supabase/schema.sql` (ajout en fin de fichier)
- Create: `tests/jarvis-stockage.test.js`
- Modify: `scripts/lancer-tests.js`

**Interfaces:**
- Consumes: `construireCatalogueMonstres` (tâche 1).
- Produces: le fichier `output/jarvis/monstres.json` (JSON compact), et le bucket `jarvis-prive` décrit dans le schéma.

- [ ] **Step 1: Écrire le test du stockage**

Créer `tests/jarvis-stockage.test.js` :

```js
"use strict";

/* Les donnees du jeu lues par /jarvis ne vivent QUE dans un bucket prive :
   jamais dans le depot public, jamais sur Pages. Ce test lit le SQL que
   l'administrateur colle dans Supabase, et le .gitignore qui empeche un
   `git add .` distrait de publier l'extraction. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RACINE = path.resolve(__dirname, "..");
const sql = fs.readFileSync(path.join(RACINE, "supabase", "schema.sql"), "utf8");

assert.match(sql,
  /insert into storage\.buckets\s*\(\s*id\s*,\s*name\s*,\s*public\s*\)\s*values\s*\(\s*'jarvis-prive'\s*,\s*'jarvis-prive'\s*,\s*false\s*\)/i,
  "le bucket jarvis-prive est cree prive");
assert.match(sql, /on conflict\s*\(\s*id\s*\)\s*do update set public\s*=\s*false/i,
  "rejouer le schema remet le bucket en prive s'il avait ete ouvert a la main");
assert.doesNotMatch(sql, /create policy[^;]*storage\.objects[^;]*jarvis-prive/is,
  "aucune politique n'ouvre la lecture du bucket : seule la cle service_role le lit");

const gitignore = fs.readFileSync(path.join(RACINE, ".gitignore"), "utf8");
assert.match(gitignore, /^output\/jarvis\/\s*$/m,
  "l'extraction des donnees du jeu ne doit jamais etre commitee");

console.log("OK jarvis-stockage");
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `node tests/jarvis-stockage.test.js`
Expected: FAIL, `le bucket jarvis-prive est cree prive`

- [ ] **Step 3: Bucket, `.gitignore` et extracteur**

Ajouter **à la fin** de `supabase/schema.sql`, en gardant la fin de ligne du fichier :

```sql

-- =============================================================================
--  Donnees du jeu lues par /jarvis (lot 2a : monstres et boss).
--
--  Un bucket PRIVE. L'extraction se fait sur le poste du proprietaire
--  (outils/fabrication/extraire-monstres.js) et le fichier est depose a la main
--  dans Storage : il n'entre jamais dans le depot public ni sur Pages.
--  AUCUNE politique sur storage.objects ne le cite : seule la cle service_role
--  de l'Edge Function discord-planning le lit. Rejouer ce bloc remet le bucket
--  en prive s'il avait ete ouvert a la main.
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('jarvis-prive', 'jarvis-prive', false)
on conflict (id) do update set public = false;
```

Ajouter à `.gitignore`, après le bloc `outils/fabrication/animations-completes.json` :

```
# Donnees du jeu extraites pour /jarvis. Elles vont dans le bucket PRIVE
# jarvis-prive de Supabase, jamais dans ce depot public.
output/jarvis/
```

Créer `outils/fabrication/extraire-monstres.js` :

```js
"use strict";

/* Extrait les monstres et boss du jeu pour /jarvis.

   Lit l'export local designe par DONNEES_JEU (le dossier `Content`) et ecrit
   output/jarvis/monstres.json, a deposer dans le bucket PRIVE jarvis-prive de
   Supabase (Storage). Ce fichier n'entre jamais dans le depot : .gitignore
   l'en empeche.

   La logique vit dans monstres-jarvis.js, testee en CI sans l'export.

     $env:DONNEES_JEU = (Resolve-Path (Read-Host 'Dossier Content')).Path
     node outils/fabrication/extraire-monstres.js
*/

const fs = require("node:fs");
const path = require("node:path");
const { construireCatalogueMonstres } = require("./monstres-jarvis.js");

const CONTENU = process.env.DONNEES_JEU || "";
const RACINE = path.resolve(__dirname, "..", "..");
const SORTIE = path.join(RACINE, "output", "jarvis", "monstres.json");

function lignesDeTable(relatif) {
  const fichier = path.join(CONTENU, "Table", relatif);
  const brut = JSON.parse(fs.readFileSync(fichier, "utf8"));
  const lignes = Array.isArray(brut) && brut[0] && brut[0].Rows;
  if(!lignes || !Object.keys(lignes).length){
    throw new Error("Table vide ou illisible : " + relatif);
  }
  return lignes;
}

/* Les tables d'apparition vivent sous Table/Scene/Zone/<zone>/, dans un
   dossier « spawn » ou « Spawn » selon la zone. */
function apparitionsDesZones() {
  const racine = path.join(CONTENU, "Table", "Scene", "Zone");
  const sortie = [];
  fs.readdirSync(racine, { withFileTypes:true }).forEach(zone => {
    if(!zone.isDirectory()) return;
    (function parcourir(dossier) {
      fs.readdirSync(dossier, { withFileTypes:true }).forEach(entree => {
        const chemin = path.join(dossier, entree.name);
        if(entree.isDirectory()){
          parcourir(chemin);
          return;
        }
        if(!/_spawntable\.json$/i.test(entree.name)) return;
        const brut = JSON.parse(fs.readFileSync(chemin, "utf8"));
        const lignes = (Array.isArray(brut) && brut[0] && brut[0].Rows) || {};
        sortie.push({
          fichier:entree.name.replace(/\.json$/i, ""),
          zone:zone.name,
          acteurs:[...new Set(Object.values(lignes)
            .map(ligne => String(ligne && ligne.ActorID))
            .filter(id => id && id !== "None" && id !== "undefined"))]
        });
      });
    })(path.join(racine, zone.name));
  });
  return sortie;
}

function main() {
  if(!CONTENU){
    console.error("DONNEES_JEU n'est pas défini. Lancer d'abord :\n"
      + "  $env:DONNEES_JEU = (Resolve-Path (Read-Host 'Dossier Content')).Path");
    process.exit(1);
  }
  const tableMonstres = path.join(CONTENU, "Table", "Actor", "MonsterActorTable.json");
  const catalogue = construireCatalogueMonstres({
    monstres:lignesDeTable("Actor/MonsterActorTable.json"),
    groupes:lignesDeTable("Actor/NpcStatGroupTable.json"),
    paliersBoss:lignesDeTable("Dungeon/BossStatGroupTable.json"),
    bossTerrain:lignesDeTable("FieldBoss/FieldBossTable.json"),
    donjons:lignesDeTable("Dungeon/DungeonTable.json"),
    groupesDonjon:lignesDeTable("Dungeon/DungeonGroupTable.json"),
    zones:lignesDeTable("Scene/ZoneTable.json"),
    apparitions:apparitionsDesZones(),
    textes:JSON.parse(fs.readFileSync(
      path.join(CONTENU, "Localization", "Game", "fr", "Game.json"), "utf8"
    )).client_language_table,
    genereLe:new Date().toISOString(),
    dateExport:fs.statSync(tableMonstres).mtime.toISOString().slice(0, 10)
  });
  fs.mkdirSync(path.dirname(SORTIE), { recursive:true });
  const texte = JSON.stringify(catalogue);
  fs.writeFileSync(SORTIE, texte);
  const versions = catalogue.monstres.reduce((total, monstre) => total + monstre.versions.length, 0);
  console.log("Écrit " + path.relative(RACINE, SORTIE) + " : " + catalogue.monstres.length
    + " monstres, " + versions + " versions, " + Math.round(Buffer.byteLength(texte) / 1024) + " Ko.");
  console.log("À déposer dans le bucket privé « jarvis-prive » (Supabase → Storage).");
}

main();
```

- [ ] **Step 4: Faire passer les tests**

Run: `node tests/jarvis-stockage.test.js && python -m unittest tests/test_schema_sql.py && node tests/chemins-personnels.test.js`
Expected: `OK jarvis-stockage`, le schéma se parse (`OK`), aucun chemin personnel.

- [ ] **Step 5: Essayer l'extracteur sur l'export réel**

Ce qui suit ne tourne qu'avec l'export local. Le chemin est demandé à la volée, et n'est écrit dans aucun fichier.

Run (PowerShell) :

```powershell
$env:DONNEES_JEU = (Resolve-Path (Read-Host 'Dossier Content')).Path
node outils/fabrication/extraire-monstres.js
node -e "const c=require('./output/jarvis/monstres.json');const r=c.monstres.find(m=>m.nom==='Démon rouge');console.log(c.dateExport,c.monstres.length,JSON.stringify(r.versions.map(v=>[v.contextes.map(x=>x.libelle),v.stats.faiblesses])));const a=c.monstres.find(m=>m.nom.startsWith('Akumu'));console.log(a.versions.length,a.versions[0].niveau,a.versions[29].niveau)"
git status --short output/
```

Expected :
- environ 290 monstres ;
- le Démon rouge a une version « Boss de terrain » (`Earth:2000, Holy:2000, Fire:-3000`), une version donjon « Démon rouge — Réveil après un long sommeil » et une version « Cross Challenge » (`Ice:3000, Holy:3000`) ;
- Akumu a 30 versions, de 1 à 30 ;
- `git status` ne montre **rien** pour `output/jarvis/`.

Si le libellé d'un contexte sort vide ou brut, c'est un vrai écart des données : le signaler au lieu de le masquer.

- [ ] **Step 6: Enregistrer le test et commiter**

Dans `scripts/lancer-tests.js`, après `"node tests/monstres-jarvis.test.js",`, ajouter :

```js
    "node tests/jarvis-stockage.test.js",
```

```bash
git add outils/fabrication/extraire-monstres.js .gitignore supabase/schema.sql tests/jarvis-stockage.test.js scripts/lancer-tests.js
git commit -m "feat(jarvis): extracteur local et bucket prive des monstres

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Module partagé — lecteur du bucket et outils des monstres

**Files:**
- Create: `supabase/functions/_shared/discord-jarvis-monstres.js`
- Create: `tests/discord-jarvis-monstres.test.js`
- Modify: `scripts/lancer-tests.js`

**Interfaces:**
- Consumes: la forme du catalogue (tâche 1), et `ENTREE_MONSTRES_TEST` de `tests/monstres-jarvis.test.js` ; `discord-build.js` → `normaliserRecherche`, `propositions`.
- Produces: `globalThis.NOVA_DISCORD_JARVIS_MONSTRES` (et `module.exports`) :
  - `CHEMIN_MONSTRES_JARVIS = "jarvis-prive/monstres.json"`
  - `creerLecteurMonstresJarvis({ fetch, url, cle, horloge }) → () => Promise<catalogue|null>`
  - `DECLARATIONS_OUTILS_MONSTRES` : deux déclarations Gemini, `fiche_monstre` et `chercher_monstres`
  - `ajouterOutilsMonstresJarvis(table, lireMonstres)` ajoute `table.fiche_monstre` et `table.chercher_monstres`, de forme `{ executer(args) → Promise<objet>, source(args, donnees) → string }`, comme les outils du lot 1.

- [ ] **Step 1: Écrire le test**

Créer `tests/discord-jarvis-monstres.test.js` :

```js
"use strict";

/* Les monstres de /jarvis : le lecteur du bucket prive (faux fetch, fausse
   horloge) et les deux outils, sur un catalogue fabrique par la VRAIE
   extraction a partir du mini-export de tests/monstres-jarvis.test.js. Les
   formes ne peuvent donc pas diverger entre l'extracteur et le bot. */

const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const M = require(path.join(ROOT, "supabase", "functions", "_shared", "discord-jarvis-monstres.js"));
const { construireCatalogueMonstres } = require(path.join(ROOT, "outils", "fabrication", "monstres-jarvis.js"));
const { ENTREE_MONSTRES_TEST } = require("./monstres-jarvis.test.js");

const CATALOGUE = construireCatalogueMonstres(ENTREE_MONSTRES_TEST);

function outils(catalogue) {
  const table = {};
  M.ajouterOutilsMonstresJarvis(table, async () => catalogue);
  return {
    async executer(nom, args) {
      const donnees = await table[nom].executer(args);
      return { donnees, source:table[nom].source(args, donnees) };
    }
  };
}

function reponse(status, corps) {
  return { ok:status >= 200 && status < 300, status,
    json:async () => { if(corps instanceof Error) throw corps; return corps; } };
}

async function main() {
  /* ---------------- Declarations ---------------- */
  assert.deepEqual(M.DECLARATIONS_OUTILS_MONSTRES.map(d => d.name), ["fiche_monstre", "chercher_monstres"]);
  M.DECLARATIONS_OUTILS_MONSTRES.forEach(d => assert.equal(d.parameters.type, "OBJECT"));
  assert.equal(M.CHEMIN_MONSTRES_JARVIS, "jarvis-prive/monstres.json");

  /* ---------------- Lecteur du bucket ---------------- */
  let instant = 0;
  const appels = [];
  let suite = [reponse(200, CATALOGUE)];
  const lire = M.creerLecteurMonstresJarvis({
    url:"https://x.supabase.co/storage/v1/object/jarvis-prive/monstres.json",
    cle:"service-role", horloge:() => instant,
    fetch:async (url, init) => { appels.push({ url, init }); return suite.shift(); }
  });
  assert.equal(await lire(), CATALOGUE);
  assert.equal(appels[0].init.headers.Authorization, "Bearer service-role");
  assert.equal(appels[0].init.headers.apikey, "service-role");
  instant = 3_599_999;
  assert.equal(await lire(), CATALOGUE, "gardé une heure");
  assert.equal(appels.length, 1);
  instant = 3_600_001;
  suite = [reponse(404, {})];
  assert.equal(await lire(), null, "après l'heure, relu ; un 404 rend null");
  assert.equal(appels.length, 2);
  instant += 59_999;
  assert.equal(await lire(), null, "l'échec est gardé une minute");
  assert.equal(appels.length, 2);
  instant += 2;
  suite = [reponse(200, { version:2, monstres:[] })];
  assert.equal(await lire(), null, "format inconnu refusé");
  instant += 60_001;
  suite = [reponse(200, new SyntaxError("JSON tronqué"))];
  assert.equal(await lire(), null, "JSON illisible refusé");
  instant += 60_001;
  suite = [new TypeError("réseau")];
  const lireReseau = M.creerLecteurMonstresJarvis({ url:"u", cle:"c", horloge:() => 0,
    fetch:async () => { throw new TypeError("réseau"); } });
  assert.equal(await lireReseau(), null, "stockage injoignable : null, pas d'exception");
  const sansConfig = M.creerLecteurMonstresJarvis({ url:"", cle:"", horloge:() => 0,
    fetch:async () => { throw new Error("ne doit pas être appelé"); } });
  assert.equal(await sansConfig(), null);

  /* ---------------- fiche_monstre ---------------- */
  const o = outils(CATALOGUE);
  const rouge = await o.executer("fiche_monstre", { nom:"demon rouge" });
  assert.equal(rouge.donnees.nom, "Démon rouge");
  assert.equal(rouge.donnees.rang, "Boss");
  assert.equal(rouge.donnees.donneesDu, "24/09/2026");
  assert.equal(rouge.donnees.total, 3);
  assert.equal(rouge.source, "fiche monstre Démon rouge · données du jeu du 24/09/2026");
  assert.deepEqual(rouge.donnees.versions[0], {
    contextes:["Boss de terrain", "Zone : Britannia"],
    faiblesses:["Terre +20 %", "Sacré +20 %"],
    resistances:["Feu −30 %"],
    resistanceElementaireBase:"10 % sur tous les éléments",
    resistanceCritique:"10 %",
    defenseCritique:"8,69 %",
    valeursDeBase:{ pv:95747, defense:555, attaque:1547,
      note:"valeurs de base, avant ajustement du niveau de monde" },
    puissanceRecommandee:{ "Niveau de monde 1":3144, "Niveau de monde 4":19495 }
  });

  const cross = await o.executer("fiche_monstre", { nom:"Démon rouge", contexte:"Cross Challenge" });
  assert.equal(cross.donnees.versions.length, 1);
  assert.deepEqual(cross.donnees.versions[0].faiblesses, ["Glace +30 %", "Sacré +30 %"]);
  assert.deepEqual(cross.donnees.versions[0].resistances,
    ["Physique −80 %", "Foudre −80 %", "Vent −80 %", "Feu −80 %", "Terre −80 %", "Ténèbres −80 %"]);
  const donjon = await o.executer("fiche_monstre", { nom:"demon rouge", contexte:"donjon" });
  assert.match(donjon.donnees.versions[0].contextes[0], /^Donjon : Démon rouge — Réveil/);
  const contexteInconnu = await o.executer("fiche_monstre", { nom:"demon rouge", contexte:"plage" });
  assert.equal(contexteInconnu.donnees.erreur, "contexte inconnu");
  assert.deepEqual(contexteInconnu.donnees.contextesPossibles,
    ["terrain", "donjon", "confrérie", "cross challenge", "zone"]);
  const sansVersion = await o.executer("fiche_monstre", { nom:"demon rouge", contexte:"confrérie" });
  assert.equal(sansVersion.donnees.aucuneVersionPour, "confrérie");
  assert.ok(sansVersion.donnees.contextesDisponibles.includes("Cross Challenge"));

  const akumu = await o.executer("fiche_monstre", { nom:"akumu" });
  assert.equal(akumu.donnees.paliers, "1 à 30");
  assert.deepEqual(akumu.donnees.versions.map(v => v.niveau), [1, 30],
    "sans niveau : premier et dernier palier");
  assert.deepEqual(akumu.donnees.versions[0].contextes, ["Boss de confrérie, niveau 1"]);
  assert.deepEqual(akumu.donnees.versions[0].faiblesses, []);
  assert.equal(akumu.donnees.versions[0].resistances.length, 8);
  const akumu30 = await o.executer("fiche_monstre", { nom:"akumu", niveau:"30" });
  assert.deepEqual(akumu30.donnees.versions.map(v => v.niveau), [30], "niveau en chaîne compris");
  const akumu31 = await o.executer("fiche_monstre", { nom:"akumu", niveau:31 });
  assert.equal(akumu31.donnees.erreur, "niveau hors bornes : de 1 à 30");
  const akumu12 = await o.executer("fiche_monstre", { nom:"akumu", niveau:12 });
  assert.equal(akumu12.donnees.erreur, "niveau 12 absent des données");
  assert.deepEqual(akumu12.donnees.niveauxDisponibles, [1, 30]);

  const lapin = await o.executer("fiche_monstre", { nom:"lapin" });
  assert.equal(lapin.donnees.versions[0].nonConfirme, true);
  assert.deepEqual(lapin.donnees.versions[0].contextes, ["présent dans les fichiers, contexte non retrouvé"]);
  assert.equal(lapin.donnees.versions[0].resistanceElementaireBase, "aucune");
  assert.equal(lapin.donnees.versions[0].puissanceRecommandee, undefined);

  const inconnu = await o.executer("fiche_monstre", { nom:"Démon roux" });
  assert.equal(inconnu.donnees.introuvable, "Démon roux");
  assert.ok(inconnu.donnees.proches.includes("Démon rouge"));

  /* Nom trop vague : la meilleure correspondance, et les autres nommées. */
  const vague = outils({ version:1, dateExport:"2026-09-24", monstres:[
    { nom:"Démon gris", rang:"boss", versions:CATALOGUE.monstres[1].versions.slice(0, 1) },
    CATALOGUE.monstres[1]
  ] });
  const demon = await vague.executer("fiche_monstre", { nom:"démon" });
  assert.equal(demon.donnees.nom, "Démon gris");
  assert.deepEqual(demon.donnees.autresCorrespondances, ["Démon rouge"]);

  /* Plafond : 5 versions, le total, et le rappel du filtre. */
  const nombreuses = outils({ version:1, dateExport:"2026-09-24", monstres:[{
    nom:"Monstre des abysses", rang:"normal",
    versions:Array.from({ length:7 }, (_, rangVersion) => Object.assign({},
      CATALOGUE.monstres[2].versions[0], { acteurs:[String(rangVersion)] }))
  }] });
  const abysses = await nombreuses.executer("fiche_monstre", { nom:"abysses" });
  assert.equal(abysses.donnees.total, 7);
  assert.equal(abysses.donnees.versions.length, 5);
  assert.match(abysses.donnees.suite, /contexte/);

  /* ---------------- chercher_monstres ---------------- */
  const sacre = await o.executer("chercher_monstres", { element:"sacré" });
  assert.equal(sacre.donnees.element, "Sacré");
  assert.equal(sacre.donnees.total, 3);
  assert.deepEqual(sacre.donnees.monstres.map(m => [m.nom, m.faiblesse, m.contextes[0]]), [
    ["Démon rouge", "+30 %", "Cross Challenge"],
    ["Démon rouge", "+20 %", "Boss de terrain"],
    ["Démon rouge", "+20 %", sacre.donnees.monstres[2].contextes[0]]
  ]);
  assert.match(sacre.donnees.monstres[2].contextes[0], /^Donjon :/);
  assert.equal(sacre.source, "monstres faibles à Sacré · données du jeu du 24/09/2026");
  const anglais = await o.executer("chercher_monstres", { element:"Holy" });
  assert.equal(anglais.donnees.element, "Sacré", "le code anglais du jeu est compris");
  const foudre = await o.executer("chercher_monstres", { element:"foudre", rang:"tous" });
  assert.deepEqual([foudre.donnees.total, foudre.donnees.monstres], [0, []]);
  const lumiere = await o.executer("chercher_monstres", { element:"lumière" });
  assert.equal(lumiere.donnees.erreur, "élément inconnu");
  assert.equal(lumiere.donnees.elements.length, 8);
  const rangInconnu = await o.executer("chercher_monstres", { element:"feu", rang:"champion" });
  assert.equal(rangInconnu.donnees.erreur, "rang inconnu : boss, élite ou tous");

  /* ---------------- Catalogue indisponible ---------------- */
  const absent = outils(null);
  assert.deepEqual((await absent.executer("fiche_monstre", { nom:"x" })).donnees,
    { erreur:"données des monstres indisponibles" });
  assert.deepEqual((await absent.executer("chercher_monstres", { element:"feu" })).donnees,
    { erreur:"données des monstres indisponibles" });

  console.log("OK discord-jarvis-monstres");
}

main().catch(erreur => { console.error(erreur); process.exit(1); });
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `node tests/discord-jarvis-monstres.test.js`
Expected: FAIL avec `Cannot find module …discord-jarvis-monstres.js`

- [ ] **Step 3: Écrire le module**

Créer `supabase/functions/_shared/discord-jarvis-monstres.js` :

```js
"use strict";

/* Les monstres et boss de /jarvis : lecture du bucket prive et deux outils.

   Le catalogue est fabrique sur le poste du proprietaire
   (outils/fabrication/extraire-monstres.js) et depose dans le bucket PRIVE
   jarvis-prive. Il n'est ni dans le depot ni sur Pages : seule la cle
   service_role de l'Edge Function le lit.

   Signe confirme en jeu : une valeur positive est une faiblesse, une valeur
   negative une resistance. Les PV, la defense et l'attaque sont des valeurs
   de BASE : le niveau de monde les ajuste cote serveur, et aucune table
   exportee ne dit comment. */

if(typeof module !== "undefined" && module.exports){
  if(!globalThis.NOVA_DISCORD_BUILD) require("./discord-build.js");
}

const { normaliserRecherche, propositions } = globalThis.NOVA_DISCORD_BUILD;

const CHEMIN_MONSTRES_JARVIS = "jarvis-prive/monstres.json";
const CACHE_MONSTRES_SUCCES_MS = 3_600_000;
const CACHE_MONSTRES_ECHEC_MS = 60_000;
const MONSTRES_VERSIONS_MAX = 5;
const MONSTRES_RESULTATS_MAX = 15;
const NOTE_VALEURS_DE_BASE = "valeurs de base, avant ajustement du niveau de monde";
const LIBELLE_SANS_CONTEXTE = "présent dans les fichiers, contexte non retrouvé";
const ELEMENTS_MONSTRES_JARVIS = [
  ["Default", "Physique"], ["Thunder", "Foudre"], ["Wind", "Vent"], ["Fire", "Feu"],
  ["Ice", "Glace"], ["Earth", "Terre"], ["Dark", "Ténèbres"], ["Holy", "Sacré"]
];
const LIBELLES_RANG_MONSTRE = { boss:"Boss", elite:"Élite", normal:"Normal" };
const CONTEXTES_MONSTRE_JARVIS = [
  ["terrain", "terrain", ["terrain"]],
  ["donjon", "donjon", ["donjon", "raid"]],
  ["confrerie", "confrérie", ["confrerie", "guilde"]],
  ["cross", "cross challenge", ["cross"]],
  ["zone", "zone", ["zone"]]
];
const INDISPONIBLE_MONSTRES = { erreur:"données des monstres indisponibles" };

/* ---------------- Lecteur du bucket ---------------- */

/* Rend une fonction qui lit le catalogue. Un succes est garde une heure : un
   fichier redepose est pris en compte au plus tard une heure apres, sans
   redeploiement. Un echec est garde une minute, pour reessayer vite sans
   marteler le stockage. Elle ne leve jamais : elle rend le catalogue ou null. */
function creerLecteurMonstresJarvis(options) {
  let memoire = null;
  return async function lireMonstresJarvis() {
    const maintenant = options.horloge();
    if(memoire && memoire.expire > maintenant) return memoire.valeur;
    let valeur = null;
    try {
      if(!options.url || !options.cle) throw new Error("configuration du stockage absente");
      const reponse = await options.fetch(options.url, {
        headers:{ Authorization:"Bearer " + options.cle, apikey:options.cle }
      });
      if(!reponse.ok) throw new Error("stockage -> " + reponse.status);
      const brut = await reponse.json();
      if(!brut || brut.version !== 1 || !Array.isArray(brut.monstres)){
        throw new Error("format de monstres.json inconnu : " + (brut && brut.version));
      }
      valeur = brut;
    } catch (erreur) {
      console.error("Monstres /jarvis indisponibles :",
        erreur instanceof Error ? erreur.message : erreur);
    }
    memoire = {
      valeur,
      expire:maintenant + (valeur ? CACHE_MONSTRES_SUCCES_MS : CACHE_MONSTRES_ECHEC_MS)
    };
    return valeur;
  };
}

/* ---------------- Mise en mots ---------------- */

function pourcentMonstre(valeur) {
  return String(Number((Math.abs(valeur) / 100).toFixed(2))).replace(".", ",") + " %";
}

function signeMonstre(valeur) {
  return (valeur > 0 ? "+" : "−") + pourcentMonstre(valeur);
}

function elementsTriesMonstre(parElement, garder, sens) {
  return ELEMENTS_MONSTRES_JARVIS
    .map(([code, libelle], rang) => ({ libelle, rang, valeur:Number(parElement[code]) || 0 }))
    .filter(entree => garder(entree.valeur))
    .sort((a, b) => sens * (a.valeur - b.valeur) || a.rang - b.rang)
    .map(entree => entree.libelle + " " + signeMonstre(entree.valeur));
}

function resistanceDeBaseMonstre(resistances) {
  const valeurs = ELEMENTS_MONSTRES_JARVIS.map(([code]) => Number(resistances[code]) || 0);
  if(valeurs.every(valeur => valeur === valeurs[0])){
    return valeurs[0] === 0 ? "aucune" : pourcentMonstre(valeurs[0]) + " sur tous les éléments";
  }
  return ELEMENTS_MONSTRES_JARVIS
    .filter(([code]) => Number(resistances[code]))
    .map(([code, libelle]) => libelle + " " + pourcentMonstre(resistances[code]))
    .join(", ");
}

function versionLisibleMonstre(version) {
  const lisible = {};
  if(version.niveau !== undefined) lisible.niveau = version.niveau;
  lisible.contextes = version.contextes.length
    ? version.contextes.map(contexte =>
      contexte.type === "confrerie" && version.niveau !== undefined
        ? contexte.libelle + ", niveau " + version.niveau
        : contexte.libelle)
    : [LIBELLE_SANS_CONTEXTE];
  if(!version.contextes.length) lisible.nonConfirme = true;
  lisible.faiblesses = elementsTriesMonstre(version.stats.faiblesses, valeur => valeur > 0, -1);
  lisible.resistances = elementsTriesMonstre(version.stats.faiblesses, valeur => valeur < 0, 1);
  lisible.resistanceElementaireBase = resistanceDeBaseMonstre(version.stats.resistances);
  lisible.resistanceCritique = pourcentMonstre(version.stats.resCrit);
  lisible.defenseCritique = pourcentMonstre(version.stats.defCrit);
  lisible.valeursDeBase = {
    pv:version.stats.pv, defense:version.stats.defense, attaque:version.stats.attaque,
    note:NOTE_VALEURS_DE_BASE
  };
  if(version.puissance){
    lisible.puissanceRecommandee = Object.fromEntries(Object.entries(version.puissance)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([niveau, puissance]) => ["Niveau de monde " + niveau, puissance]));
  }
  return lisible;
}

function dateLisibleMonstre(catalogue) {
  const date = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(catalogue.dateExport || ""));
  return date ? date[3] + "/" + date[2] + "/" + date[1] : null;
}

/* ---------------- Recherche par nom ---------------- */

function rangNomMonstre(candidat, cherche) {
  const normalise = normaliserRecherche(candidat);
  if(!cherche || !normalise) return 0;
  if(normalise === cherche) return 4;
  if(normalise.startsWith(cherche)) return 3;
  if(normalise.includes(cherche)) return 2;
  const mots = cherche.split(/\s+/).filter(Boolean);
  if(mots.length > 1 && mots.every(mot => normalise.includes(mot))) return 1;
  return 0;
}

function trouverMonstresJarvis(catalogue, saisie) {
  const cherche = normaliserRecherche(saisie);
  let meilleurRang = 0;
  let trouves = [];
  catalogue.monstres.forEach(monstre => {
    const rang = rangNomMonstre(monstre.nom, cherche);
    if(rang > meilleurRang){
      meilleurRang = rang;
      trouves = [monstre];
    }else if(rang && rang === meilleurRang){
      trouves.push(monstre);
    }
  });
  return trouves;
}

function typeDeContexteMonstre(saisie) {
  const cherche = normaliserRecherche(saisie);
  const trouve = CONTEXTES_MONSTRE_JARVIS.find(([, , mots]) =>
    mots.some(mot => cherche.includes(mot)));
  return trouve ? trouve[0] : undefined;
}

function entierMonstre(valeur) {
  if(valeur === undefined || valeur === null || valeur === "") return null;
  const nombre = Number(valeur);
  return Number.isFinite(nombre) ? Math.trunc(nombre) : NaN;
}

/* ---------------- Outils ---------------- */

async function outilFicheMonstre(lireMonstres, args) {
  const catalogue = await lireMonstres();
  if(!catalogue) return Object.assign({}, INDISPONIBLE_MONSTRES);
  const trouves = trouverMonstresJarvis(catalogue, args.nom);
  if(!trouves.length){
    return {
      introuvable:String(args.nom === undefined ? "" : args.nom),
      proches:propositions(catalogue.monstres.map(monstre => monstre.nom), args.nom)
    };
  }
  const monstre = trouves[0];
  let versions = monstre.versions;
  const resultat = {
    nom:monstre.nom,
    rang:LIBELLES_RANG_MONSTRE[monstre.rang] || monstre.rang,
    donneesDu:dateLisibleMonstre(catalogue)
  };
  if(trouves.length > 1){
    resultat.autresCorrespondances = trouves.slice(1, 6).map(autre => autre.nom);
  }

  if(args.contexte !== undefined && args.contexte !== null && String(args.contexte).trim()){
    const type = typeDeContexteMonstre(args.contexte);
    if(!type){
      return {
        erreur:"contexte inconnu",
        contextesPossibles:CONTEXTES_MONSTRE_JARVIS.map(([, libelle]) => libelle)
      };
    }
    const filtrees = versions.filter(version =>
      version.contextes.some(contexte => contexte.type === type));
    if(!filtrees.length){
      return Object.assign(resultat, {
        aucuneVersionPour:CONTEXTES_MONSTRE_JARVIS.find(([code]) => code === type)[1],
        contextesDisponibles:[...new Set(versions.flatMap(version =>
          version.contextes.map(contexte => contexte.libelle)))]
      });
    }
    versions = filtrees;
  }

  const niveaux = versions.filter(version => version.niveau !== undefined)
    .map(version => version.niveau);
  if(niveaux.length){
    const minimum = Math.min(...niveaux);
    const maximum = Math.max(...niveaux);
    const bornes = minimum === 1 ? { bas:1, haut:Math.max(maximum, 30) } : { bas:minimum, haut:maximum };
    const niveau = entierMonstre(args.niveau);
    if(niveau !== null){
      if(!(niveau >= bornes.bas && niveau <= bornes.haut)){
        return { erreur:"niveau hors bornes : de " + bornes.bas + " à " + bornes.haut };
      }
      const palier = versions.filter(version => version.niveau === niveau);
      if(!palier.length){
        return { erreur:"niveau " + niveau + " absent des données", niveauxDisponibles:niveaux };
      }
      versions = palier;
    }else if(versions.length > 1){
      resultat.paliers = bornes.bas + " à " + bornes.haut;
      versions = [versions[0], versions[versions.length - 1]];
    }
  }

  resultat.total = versions.length;
  resultat.versions = versions.slice(0, MONSTRES_VERSIONS_MAX).map(versionLisibleMonstre);
  if(versions.length > MONSTRES_VERSIONS_MAX){
    resultat.suite = "seules les " + MONSTRES_VERSIONS_MAX + " premières versions sont listées :"
      + " préciser un contexte (terrain, donjon, confrérie, cross challenge, zone) pour affiner";
  }
  return resultat;
}

function elementDeSaisieMonstre(saisie) {
  const cherche = normaliserRecherche(saisie);
  if(!cherche) return null;
  return ELEMENTS_MONSTRES_JARVIS.find(([code, libelle]) =>
    normaliserRecherche(libelle) === cherche || normaliserRecherche(code) === cherche
    || (cherche.length >= 3 && normaliserRecherche(libelle).startsWith(cherche))) || null;
}

async function outilChercherMonstres(lireMonstres, args) {
  const catalogue = await lireMonstres();
  if(!catalogue) return Object.assign({}, INDISPONIBLE_MONSTRES);
  const element = elementDeSaisieMonstre(args.element);
  if(!element){
    return { erreur:"élément inconnu", elements:ELEMENTS_MONSTRES_JARVIS.map(([, libelle]) => libelle) };
  }
  const rangDemande = normaliserRecherche(args.rang || "boss");
  const rang = rangDemande.startsWith("tou") ? "tous"
    : rangDemande === "elite" ? "elite"
    : rangDemande === "boss" ? "boss" : null;
  if(!rang) return { erreur:"rang inconnu : boss, élite ou tous" };

  const vus = new Set();
  const trouves = [];
  catalogue.monstres.forEach(monstre => {
    monstre.versions.forEach(version => {
      if(rang !== "tous" && version.rang !== rang) return;
      const valeur = Number(version.stats.faiblesses[element[0]]) || 0;
      if(valeur <= 0) return;
      const contextes = version.contextes.length
        ? version.contextes.map(contexte => contexte.libelle)
        : [LIBELLE_SANS_CONTEXTE];
      const cle = monstre.nom + "|" + valeur + "|" + contextes.join("|");
      if(vus.has(cle)) return;
      vus.add(cle);
      trouves.push({ nom:monstre.nom, valeur, faiblesse:signeMonstre(valeur), contextes });
    });
  });
  trouves.sort((a, b) => b.valeur - a.valeur || a.nom.localeCompare(b.nom, "fr"));
  return {
    element:element[1],
    rang,
    donneesDu:dateLisibleMonstre(catalogue),
    total:trouves.length,
    monstres:trouves.slice(0, MONSTRES_RESULTATS_MAX)
      .map(({ nom, faiblesse, contextes }) => ({ nom, faiblesse, contextes }))
  };
}

const DECLARATIONS_OUTILS_MONSTRES = [
  {
    name:"fiche_monstre",
    description:"Faiblesses et résistances élémentaires, résistances critiques et valeurs de base"
      + " d'un monstre ou d'un boss du jeu, version par version (boss de terrain, donjon,"
      + " boss de confrérie, Cross Challenge, zone). Données lues dans les fichiers du jeu.",
    parameters:{
      type:"OBJECT",
      properties:{
        nom:{ type:"STRING", description:"Nom du monstre, même approximatif (ex. « démon rouge », « akumu »)." },
        contexte:{ type:"STRING", description:"Facultatif : terrain, donjon, confrérie, cross challenge ou zone." },
        niveau:{ type:"INTEGER", description:"Facultatif : palier d'un boss à paliers comme Akumu (1 à 30)." }
      },
      required:["nom"]
    }
  },
  {
    name:"chercher_monstres",
    description:"Monstres faibles à un élément, du plus faible au moins faible, avec leur contexte.",
    parameters:{
      type:"OBJECT",
      properties:{
        element:{ type:"STRING", description:"Physique, Foudre, Vent, Feu, Glace, Terre, Ténèbres ou Sacré." },
        rang:{ type:"STRING", enum:["boss", "elite", "tous"], description:"Facultatif : boss (par défaut), elite ou tous." }
      },
      required:["element"]
    }
  }
];

function sourceDateeMonstre(debut, donnees) {
  return debut + (donnees.donneesDu ? " · données du jeu du " + donnees.donneesDu : "");
}

function ajouterOutilsMonstresJarvis(table, lireMonstres) {
  table.fiche_monstre = {
    executer:args => outilFicheMonstre(lireMonstres, args),
    source:(args, donnees) =>
      sourceDateeMonstre("fiche monstre " + (donnees.nom || args.nom || "?"), donnees)
  };
  table.chercher_monstres = {
    executer:args => outilChercherMonstres(lireMonstres, args),
    source:(args, donnees) =>
      sourceDateeMonstre("monstres faibles à " + (donnees.element || args.element || "?"), donnees)
  };
}

const discordJarvisMonstresApi = {
  CHEMIN_MONSTRES_JARVIS,
  DECLARATIONS_OUTILS_MONSTRES,
  creerLecteurMonstresJarvis,
  ajouterOutilsMonstresJarvis
};

if(typeof module !== "undefined" && module.exports){
  module.exports = discordJarvisMonstresApi;
}
globalThis.NOVA_DISCORD_JARVIS_MONSTRES = discordJarvisMonstresApi;
```

- [ ] **Step 4: Faire passer le test**

Run: `node tests/discord-jarvis-monstres.test.js`
Expected: `OK discord-jarvis-monstres`. Les lignes `Monstres /jarvis indisponibles : …` affichées sont les scénarios d'échec voulus.

Si l'assertion sur `akumu12` (« absent des données ») échoue : les bornes d'un boss dont le premier palier est 1 vont jusqu'à `max(maximum, 30)`. C'est voulu, car le mini-export n'a que 1 et 30 alors que le jeu en a 30. Relire le test avant de modifier le code.

- [ ] **Step 5: Enregistrer et commiter**

Dans `scripts/lancer-tests.js`, après `"node tests/jarvis-stockage.test.js",`, ajouter :

```js
    "node tests/discord-jarvis-monstres.test.js",
```

```bash
git add supabase/functions/_shared/discord-jarvis-monstres.js tests/discord-jarvis-monstres.test.js scripts/lancer-tests.js
git commit -m "feat(jarvis): lecteur du bucket prive et outils des monstres

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Note : `tests/edge-modules.test.js` échoue désormais (module non importé par `index.ts`) jusqu'à la tâche 4. C'est attendu.

---

### Task 4: Brancher les monstres dans J.A.R.V.I.S.

**Files:**
- Modify: `supabase/functions/_shared/discord-jarvis-outils.js`
- Modify: `supabase/functions/_shared/discord-jarvis.js` (`CONSIGNE_JARVIS`)
- Modify: `supabase/functions/discord-planning/index.ts`
- Modify: `tests/discord-jarvis-outils.test.js`, `tests/discord-jarvis.test.js`

**Interfaces:**
- Consumes: `DECLARATIONS_OUTILS_MONSTRES`, `ajouterOutilsMonstresJarvis`, `creerLecteurMonstresJarvis`, `CHEMIN_MONSTRES_JARVIS` (tâche 3).
- Produces: `creerOutilsJarvis({ catalogue, requete, maintenant?, lireMonstres? })`. `lireMonstres` est facultatif ; en son absence, les outils des monstres répondent « indisponibles ». La liste des déclarations passe à 9 outils.

- [ ] **Step 1: Mettre à jour les tests**

Dans `tests/discord-jarvis-outils.test.js`, remplacer l'assertion de la liste des déclarations :

```js
  assert.deepEqual(DECLARATIONS_OUTILS_JARVIS.map(d => d.name), [
    "lister_personnages", "fiche_personnage", "chercher_equipement",
    "qui_possede", "roster_de", "dispos", "scores_boss"
  ]);
```

par :

```js
  assert.deepEqual(DECLARATIONS_OUTILS_JARVIS.map(d => d.name), [
    "lister_personnages", "fiche_personnage", "chercher_equipement",
    "qui_possede", "roster_de", "dispos", "scores_boss",
    "fiche_monstre", "chercher_monstres"
  ]);
  /* Sans lecteur de monstres fourni, les deux outils le disent au lieu de
     planter : le reste de /jarvis ne depend pas du bucket prive. */
  assert.deepEqual((await outils().executer("fiche_monstre", { nom:"démon" })).donnees,
    { erreur:"données des monstres indisponibles" });
```

Dans `tests/discord-jarvis.test.js`, bloc 11 (câblage de `index.ts`), ajouter avant `console.log("OK discord-jarvis");` :

```js
  /* Lot 2a : le bucket prive des monstres, lu par la cle service_role. */
  assert.match(index, /creerLecteurMonstresJarvis\(\{/);
  assert.match(index, /"\/storage\/v1\/object\/" \+ CHEMIN_MONSTRES_JARVIS/);
  assert.match(index, /lireMonstres:/);
  assert.match(Q.CONSIGNE_JARVIS, /valeurs de base/);
  assert.match(Q.CONSIGNE_JARVIS, /monstres/);
```

Run: `node tests/discord-jarvis-outils.test.js ; node tests/discord-jarvis.test.js`
Expected: les deux échouent, l'un sur la liste des déclarations, l'autre sur `creerLecteurMonstresJarvis`.

- [ ] **Step 2: Brancher les outils**

Dans `supabase/functions/_shared/discord-jarvis-outils.js` :

1. Dans le bloc de `require` du haut, ajouter en dernier :

```js
  if(!globalThis.NOVA_DISCORD_JARVIS_MONSTRES) require("./discord-jarvis-monstres.js");
```

2. Après la ligne `const { currentBossWeekStart } = globalThis.NOVA_BOSS_REMINDER;`, ajouter :

```js
const {
  DECLARATIONS_OUTILS_MONSTRES, ajouterOutilsMonstresJarvis
} = globalThis.NOVA_DISCORD_JARVIS_MONSTRES;
```

3. Remplacer la fin du tableau des déclarations, la ligne `];` qui suit la déclaration `scores_boss`, juste avant `/* 4 : egal, 3 : commence par`, par :

```js
].concat(DECLARATIONS_OUTILS_MONSTRES);
```

4. Dans `creerOutilsJarvis`, juste après `ajouterOutilsConfrerie(table, contexte);`, ajouter :

```js
  /* Lot 2a : les monstres, lus dans le bucket prive. Sans lecteur fourni, ils
     repondent « indisponibles » : le reste de /jarvis n'en depend pas. */
  ajouterOutilsMonstresJarvis(table, options.lireMonstres || (async () => null));
```

- [ ] **Step 3: Compléter la consigne**

Dans `supabase/functions/_shared/discord-jarvis.js`, dans `CONSIGNE_JARVIS` :

- remplacer `rappelle ce que tu sais faire : héros, compétences, équipements, rosters, disponibilités, scores de boss.` par `rappelle ce que tu sais faire : héros, compétences, équipements, monstres et boss, rosters, disponibilités, scores de boss.` ;
- ajouter, juste avant la ligne `- N'écris jamais de mention Discord (@…).`, la ligne :

```
- Les PV, la défense et l'attaque d'un monstre sont des valeurs de base, avant l'ajustement du niveau de monde : précise-le si tu les cites. Une version « contexte non retrouvé » n'est pas confirmée en jeu : ne la présente pas comme sortie.
```

- [ ] **Step 4: Câbler l'Edge Function**

Dans `supabase/functions/discord-planning/index.ts` :

1. Dans le type `EdgeSharedGlobal`, ajouter `  NOVA_DISCORD_JARVIS_MONSTRES?: unknown;`.
2. Juste **avant** `await import("../_shared/discord-jarvis-outils.js");`, ajouter :

```ts
/* Lot 2a : les monstres, lus par les outils de /jarvis. */
await import("../_shared/discord-jarvis-monstres.js");
```

3. Dans le type de `creerOutilsJarvis` déclaré sous `NOVA_DISCORD_JARVIS_OUTILS`, ajouter le champ facultatif `lireMonstres?(): Promise<unknown>;` à ses `options`.
4. Après la destructuration de `NOVA_DISCORD_JARVIS_OUTILS`, ajouter :

```ts
const { CHEMIN_MONSTRES_JARVIS, creerLecteurMonstresJarvis } =
  edgeSharedGlobal.NOVA_DISCORD_JARVIS_MONSTRES as {
    CHEMIN_MONSTRES_JARVIS: string;
    creerLecteurMonstresJarvis(options: {
      fetch: typeof fetch;
      url: string;
      cle: string;
      horloge(): number;
    }): () => Promise<unknown>;
  };
```

5. Juste avant `async function publishJarvis(`, ajouter :

```ts
/* Le catalogue des monstres vit dans le bucket PRIVE jarvis-prive, lu avec la
   cle service_role. Le lecteur est cree une fois par instance : son cache
   (1 h en cas de succes, 1 min en cas d'echec) survit d'une question a
   l'autre. */
let lecteurMonstresJarvis: (() => Promise<unknown>) | null = null;
function lireMonstresJarvis(config: PlanningConfig): Promise<unknown> {
  if(!lecteurMonstresJarvis){
    lecteurMonstresJarvis = creerLecteurMonstresJarvis({
      fetch,
      url:config.supabaseUrl + "/storage/v1/object/" + CHEMIN_MONSTRES_JARVIS,
      cle:config.serviceRoleKey,
      horloge:() => Date.now()
    });
  }
  return lecteurMonstresJarvis();
}
```

6. Dans `publishJarvis`, remplacer l'appel à `creerOutilsJarvis({ … })` par :

```ts
    const outils = creerOutilsJarvis({
      catalogue:await lireConnaissances(),
      requete:chemin => supabaseJson<unknown>(config, chemin),
      lireMonstres:() => lireMonstresJarvis(config)
    });
```

- [ ] **Step 5: Faire passer les tests**

Run: `node tests/discord-jarvis-outils.test.js && node tests/discord-jarvis.test.js && node tests/edge-modules.test.js && node tests/discord-jarvis-monstres.test.js`
Expected : `OK discord-jarvis-outils`, `OK discord-jarvis`, `OK edge-modules (13 modules partagés, …)` et `OK discord-jarvis-monstres`.

Si `deno` est disponible par `npx -y deno@latest`, contrôler les types sur une **copie isolée** de `supabase/functions`, comme au lot 1 (le `package.json` du dépôt perturbe Deno) :

```bash
SP=<dossier temporaire>; rm -rf "$SP/dc" && mkdir -p "$SP/dc" && cp -r supabase/functions "$SP/dc/" && (cd "$SP/dc" && npx -y deno@latest check --node-modules-dir=auto functions/discord-planning/index.ts)
```

Expected : seulement les 3 erreurs `TS2322` sur `Blob`, qui existaient déjà sur `main`.

- [ ] **Step 6: Suite unitaire et commit**

Run: `npm run test:unit`
Expected: tout au vert.

```bash
git add supabase/functions/_shared/discord-jarvis-outils.js supabase/functions/_shared/discord-jarvis.js supabase/functions/discord-planning/index.ts tests/discord-jarvis-outils.test.js tests/discord-jarvis.test.js
git commit -m "feat(jarvis): brancher les monstres sur /jarvis

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Documentation

**Files:**
- Modify: `docs/discord-planning.md`
- Modify: `AGENTS.md`
- Modify: `outils/fabrication/LISEZMOI.md`

- [ ] **Step 1: `docs/discord-planning.md`**

Ajouter à la fin de la section `/jarvis` :

````markdown
### Monstres et boss (lot 2a)

Deux outils de plus : `fiche_monstre` (faiblesses, résistances, résistances
critiques et valeurs de base, version par version avec leur contexte) et
`chercher_monstres` (monstres faibles à un élément).

Les données viennent des fichiers du jeu, extraits sur le poste du
propriétaire et déposés dans le bucket Supabase **privé** `jarvis-prive`.
Elles ne sont ni dans le dépôt ni sur Pages.

**Première mise en service**

1. Rejouer `supabase/schema.sql` dans le SQL Editor. Il crée le bucket privé.
2. Extraire :

```powershell
$env:DONNEES_JEU = (Resolve-Path (Read-Host 'Dossier Content')).Path
node outils/fabrication/extraire-monstres.js
```

3. Déposer `output/jarvis/monstres.json` dans Storage → `jarvis-prive`.
4. Redéployer `discord-planning`. Pas de commande à réenregistrer.

**Après une mise à jour du jeu** : étapes 2 et 3. Le bot prend le nouveau
fichier en compte au plus tard une heure après, sans redéploiement.

Les PV, la défense et l'attaque sont des **valeurs de base** : le niveau de
monde les ajuste côté serveur, et aucune table exportée ne dit comment. Les
faiblesses et résistances, elles, concordent avec les mesures en jeu.
````

- [ ] **Step 2: `AGENTS.md`**

Dans l'entrée **Commande Discord `/jarvis`**, remplacer la phrase `Un lot 2 est prévu : les exports FModel iront dans un stockage Supabase **privé**, jamais dans le dépôt ni sur Pages.` par :

```markdown
  **Lot 2a (monstres et boss)** : `outils/fabrication/extraire-monstres.js` lit
  l'export local (`DONNEES_JEU`) et écrit `output/jarvis/monstres.json`,
  ignoré par git, que le propriétaire dépose dans le bucket **privé**
  `jarvis-prive` (aucune politique : seule la clé `service_role` le lit). Les
  outils `fiche_monstre` et `chercher_monstres` vivent dans
  `_shared/discord-jarvis-monstres.js`. Faiblesse > 0, résistance < 0,
  confirmé en jeu. L'acteur d'Akumu pointe sur le groupe de test
  `stat_poweroverwhelming` : ses vraies statistiques sont ses 30 paliers de
  `BossStatGroupTable`. Lots suivants prévus : 2b (buffs), 2c (boutiques et
  butins), 2d (contenu non sorti), sur la même chaîne.
```

- [ ] **Step 3: `outils/fabrication/LISEZMOI.md`**

Ajouter avant `## Ce qui n'est pas ici` :

```markdown
## Les monstres de /jarvis

`extraire-monstres.js` fabrique `output/jarvis/monstres.json` pour la
commande Discord `/jarvis`. Ce fichier est ignoré par git et va dans le
bucket Supabase **privé** `jarvis-prive` : il n'entre jamais dans ce dépôt
public. La logique vit dans `monstres-jarvis.js`, testée en CI sans l'export.
Procédure : `docs/discord-planning.md`.
```

- [ ] **Step 4: Suite complète et commit**

Run: `npm test`
Expected : tout au vert. Trois tests Playwright sont connus pour être instables (`supabase-etape1`, `accessibilite-mobile`, `visiteur-anonyme`) : s'ils échouent, les relancer seuls.

```bash
git add docs/discord-planning.md AGENTS.md outils/fabrication/LISEZMOI.md
git commit -m "docs(jarvis): monstres et boss, bucket prive et extraction

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Ne pas pousser.** La mise en service (schéma, extraction, dépôt du fichier, redéploiement) revient au propriétaire.
