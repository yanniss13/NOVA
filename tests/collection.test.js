"use strict";

/* La possession d'un objet : marqué explicitement OU équipé dans un build.

   Le module est lu en isolation, avec ses dépendances posées en globales du
   contexte `vm`. C'est ce qui permet de tester la règle sur des données
   fabriquées, sans dépendre du roster réel ni du catalogue du jeu — qui
   changent à chaque mise à jour. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
/* Les valeurs nées dans le contexte `vm` portent le prototype d'un AUTRE
   realm : `deepEqual` les refuse alors même que le contenu est identique. */
const { plain } = require("./helpers/load-app");

const RACINE = path.join(__dirname, "..");

function charger(){
  const source = fs
    .readFileSync(path.join(RACINE, "js", "metier", "collection.js"), "utf8")
    .replace(/^\s*import\s[\s\S]*?from\s+"[^"]*";\s*$/gm, "")
    .replace(/export\s*\{[^}]*\};?/, "");
  const contexte = {
    LINKED_ARMOR_SLOT:"Armure liee",
    /* Volontairement partiel : seuls les deux dossiers utiles au test. */
    FOLDER_TO_ENUM:{ "Hache":"Axe", "Livre":"Book" },
    // Derieri manie la hache, Merlin le livre.
    weaponTypesOf:charId => (
      { derieri:["Hache"], merlin:["Livre"] }[charId] || []
    )
  };
  vm.runInNewContext(
    source + "\nthis.__api = { equipesDuRoster, possessionsDe,"
      + " utilesAuRoster, progressionDe };",
    contexte,
    { filename:"collection.js" }
  );
  return contexte.__api;
}

const HACHE = "7ds-armes/Hache/hache-a.webp";
const LIVRE = "7ds-armes/Livre/livre-a.webp";
const LANCE = "7ds-armes/Lance/lance-a.webp";
const GRAVEE_DERIERI = "7ds-armures-ssr/Armure liee/gravee-a.webp";
const GRAVEE_ESCANOR = "7ds-armures-ssr/Armure liee/gravee-b.webp";

const ROSTER = [
  {
    charId:"derieri",
    builds:{
      Hache:{
        weapon:HACHE,
        armor:{ "Armure liee":GRAVEE_DERIERI }
      },
      // Un build sans arme ni gravée : il ne doit rien ajouter.
      "Epee 1 main":{ weapon:null, armor:{} }
    }
  }
];

const OBJETS = [
  { file:HACHE, nom:"Hache A", nature:"arme", type:"Axe" },
  { file:LIVRE, nom:"Livre A", nature:"arme", type:"Book" },
  { file:LANCE, nom:"Lance A", nature:"arme", type:"Lance" },
  { file:GRAVEE_DERIERI, nom:"Gravée A", nature:"gravee", heros:"derieri" },
  { file:GRAVEE_ESCANOR, nom:"Gravée B", nature:"gravee", heros:"escanor" }
];

// L'arme et l'armure gravée de chaque build comptent, et rien d'autre.
{
  const { equipesDuRoster } = charger();
  assert.deepEqual(
    plain([...equipesDuRoster(ROSTER)]).sort(),
    [HACHE, GRAVEE_DERIERI].sort()
  );
}

/* Un roster vide ou absent ne lève pas : la vue doit rester affichable avant
   que les données du membre ne soient chargées. */
{
  const { equipesDuRoster } = charger();
  assert.deepEqual(plain([...equipesDuRoster([])]), []);
  assert.deepEqual(plain([...equipesDuRoster(null)]), []);
  assert.deepEqual(plain([...equipesDuRoster([{ charId:"x" }])]), []);
  assert.deepEqual(plain([...equipesDuRoster([null, undefined])]), []);
}

/* Possédé = marqué explicitement OU équipé. Les deux ensembles se FUSIONNENT,
   ils ne se remplacent pas : un objet marqué le reste une fois déséquipé, un
   objet équipé compte même jamais marqué. */
{
  const { equipesDuRoster, possessionsDe } = charger();
  const equipes = equipesDuRoster(ROSTER);
  assert.deepEqual(
    plain([...possessionsDe(new Set([LANCE]), equipes)]).sort(),
    [HACHE, LANCE, GRAVEE_DERIERI].sort()
  );
  // Sans rien de marqué, il reste les équipés.
  assert.deepEqual(
    plain([...possessionsDe(new Set(), equipes)]).sort(),
    [HACHE, GRAVEE_DERIERI].sort()
  );
  // Sans rien d'équipé, il reste les marqués.
  assert.deepEqual(
    plain([...possessionsDe(new Set([LANCE]), new Set())]),
    [LANCE]
  );
  assert.deepEqual(plain([...possessionsDe(null, null)]), []);
}

/* ⚠️ Les deux vocabulaires d'arme. `weaponTypesOf` rend des noms de DOSSIER
   (« Hache »), les objets du Wiki portent un ENUM (« Axe »). Sans
   FOLDER_TO_ENUM pour faire le pont, l'ensemble serait vide et le filtre
   n'afficherait jamais rien — en silence, ce qui est le pire. */
{
  const { utilesAuRoster } = charger();
  assert.deepEqual(
    plain([...utilesAuRoster(ROSTER, OBJETS)]).sort(),
    [HACHE, GRAVEE_DERIERI].sort(),
    "ni la lance (aucun héros ne la manie), ni la gravée d'Escanor (hors roster)"
  );
}

/* L'utilité ne dépend PAS de la possession : une arme du bon type compte même
   si elle n'est pas encore équipée. C'est tout l'intérêt du filtre. */
{
  const { utilesAuRoster } = charger();
  const autreHache = { file:"7ds-armes/Hache/hache-b.webp", nom:"Hache B",
                       nature:"arme", type:"Axe" };
  assert.ok(
    utilesAuRoster(ROSTER, OBJETS.concat([autreHache])).has(autreHache.file),
    "une arme du bon type est utile même jamais possédée"
  );
}

// Un roster vide ne rend rien d'utile, et ne lève pas.
{
  const { utilesAuRoster } = charger();
  assert.deepEqual(plain([...utilesAuRoster([], OBJETS)]), []);
  assert.deepEqual(plain([...utilesAuRoster(ROSTER, [])]), []);
  assert.deepEqual(plain([...utilesAuRoster(null, null)]), []);
}

// Le décompte, celui qui s'affiche « 2 / 5 possédés — 3 à trouver ».
{
  const { equipesDuRoster, possessionsDe, progressionDe } = charger();
  const possessions = possessionsDe(new Set(), equipesDuRoster(ROSTER));
  assert.deepEqual(plain(progressionDe(OBJETS, possessions)), {
    total:5, possedes:2, manquants:3
  });
  assert.deepEqual(plain(progressionDe([], new Set())), {
    total:0, possedes:0, manquants:0
  });
  /* Un chemin possédé qui ne figure dans aucun objet listé ne doit pas gonfler
     le compte : une image retirée du dépôt laisse sa ligne en base. */
  assert.deepEqual(
    plain(progressionDe(OBJETS, new Set([HACHE, "7ds-armes/disparue.webp"]))),
    { total:5, possedes:1, manquants:4 }
  );
}

console.log("PASS collection : possession, utilité au roster et progression");
