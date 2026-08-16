# Affaiblissement de la cible — plan d'implémentation

> **Pour un agent exécutant :** SOUS-COMPÉTENCE REQUISE — utilise
> `superpowers:subagent-driven-development` (recommandé) ou
> `superpowers:executing-plans` pour dérouler ce plan tâche par tâche. Les
> étapes sont en cases à cocher (`- [ ]`) pour le suivi.

**But :** recenser dans l'onglet Analyse qui, dans la confrérie, peut affaiblir
le boss — et à quel potentiel — en transcrivant d'abord les treize lignes
manquantes dans `data/buffs-supports.js`.

**Architecture :** deux volets qui se suivent. (1) La table manuelle
`data/buffs-supports.js` gagne neuf lignes calculées et quatre lignes
*consignées mais hors calcul*, plus un drapeau `horsCalcul` que
`buffsApplicables()` filtre pour que le calculateur ne les propose jamais.
(2) Un module métier pur, `js/metier/affaiblissement-cible.js`, dérive de cette
table les lignes affichables et croise chacune avec les rosters ; `js/vues/analyse.js`
les rend entre la couverture élémentaire et le classement.

**Pile technique :** modules ES vanille, aucun *build*. Tests Node (`node --test`
n'est pas utilisé ici : chaque fichier de test est un script assertif) chargés
par le bac à sable `vm` de `tests/helpers/load-app.js`, plus Playwright pour le
parcours.

**Spec :** [`docs/superpowers/specs/2026-08-16-affaiblissement-cible-design.md`](../specs/2026-08-16-affaiblissement-cible-design.md)
— le plan argumente depuis elle ; lis les deux.

## Contraintes globales

Elles valent pour **toutes** les tâches, sans être répétées :

- **Aucune valeur inventée.** Chaque chiffre transcrit cite une phrase
  **littérale** de la description française du `gameId` dans
  `data/wiki-competences.js`. Les treize ancres de ce plan ont été vérifiées
  contre les descriptions réelles ; ne les réécris pas « au propre ».
- **`(Max : ` n'est PAS une ancre universelle.** Sur quatre des descriptions
  elle apparaît **deux fois**, et `nombreApres()` exige exactement une
  occurrence. Les ancres longues de ce plan (`"sont infligés. (Max : "`,
  `"pendant 30s. (Max : "`) sont là pour ça.
- **Pas d'accent dans les commentaires de code.** Le dépôt écrit ses
  commentaires sans accents (`ECRIT ET MAINTENU A LA MAIN`) ; les libellés et
  textes affichés, eux, sont accentués. Suis la convention du fichier que tu
  modifies.
- **Une entrée porte `stat` OU `effet`, jamais les deux.** Règle testée.
- **Un module n'importe jamais un module déclaré après lui** dans
  `tests/helpers/modules.js`. Toute extraction ajoute son fichier dans sa
  couche.
- **Un export que personne n'importe est refusé** par
  `tests/modules-imports.test.js`. Le crochet de test (`HOOK_EXPORT` de
  `tests/helpers/load-app.js`) voit les fonctions internes sans `export`.
- **Espace insécable :** les phrases citées peuvent en contenir. L'outil
  d'édition convertit parfois ` ` en vrai caractère — si un test se plaint
  d'une phrase introuvable alors qu'elle semble identique, c'est ça.
- **Commande de test unitaire complète :** `npm run test:unit`.
  Un fichier seul : `node tests/<nom>.test.js`.

## Ce que ce plan corrige dans la spec

Cinq points établis en lisant le code, que la spec ne pouvait pas connaître.
**Ils sont intégrés aux tâches ci-dessous** ; ils sont listés ici pour que le
lecteur de la spec ne croie pas à une divergence accidentelle.

1. **La spec §3 et §7 affirment que les tests existants couvrent les nouvelles
   lignes « sans modification ». C'est faux, deux fois.**
   `tests/calculateur-entrees.test.js:40` exige que la table couvre
   *exactement* huit personnages, et `:202-211` exige que **chaque** ligne
   change une entrée du moteur — ce qu'une ligne `horsCalcul` ne fait
   précisément jamais. Les deux doivent bouger, et c'est tant mieux : ce sont
   les tests qui échouent d'abord dans les tâches 2 et 3.
2. **La spec §5.7 annonce « 33 nouvelles lignes » de cases à cocher.** Reste
   d'un décompte antérieur corrigé en §5.1. Le vrai chiffre est **13 lignes,
   dont 9 seulement deviennent des cases à cocher** ; les 4 autres sont
   justement celles que le calculateur ne doit jamais voir.
3. **L'en-tête de `data/buffs-supports.js` déclare `gowther_wand_skill_e`
   exclu** (rubrique « les reductions de defense ELEMENTAIRE »). La décision 4
   du propriétaire la fait entrer. Le commentaire doit donc bouger dans la même
   tâche que la ligne, sinon le fichier se contredit.
4. **`rosterDerivedPlayers()` jette les membres sans DPS**
   (`js/vues/analyse.js:124`). Un membre qui ne joue que des soutiens serait
   invisible dans le recensement même s'il possède l'effet. Le filtre descend
   d'un cran, au niveau des sections qui parlent réellement de DPS.
5. **`.cov-row` est figé à `repeat(7,1fr)`** (`css/analyse.css:9`) alors que la
   couverture compte **huit** éléments depuis l'entrée de « Physique » le
   15 août 2026. « Physique » se retrouve seul sur une deuxième ligne. Un
   caractère à changer, dans la feuille et la section que la tâche 5 touche
   déjà.

Un sixième point, découvert et **absent de la spec** : `data/buffs-supports.js`
n'est chargé qu'**à la demande**, par `chargerCatalogues()` de
`js/vues/calculateur.js`. L'Analyse ne le charge pas. La tâche 5 lui donne son
propre chargeur.

## Structure des fichiers

| Fichier | Rôle | Tâche |
|---|---|---|
| `js/metier/equipe-buffs.js` | *modifié* — `armeDuGameId()` extrait la règle du jeton ; `vientDeLArme()` s'exprime désormais par elle | 1 |
| `data/buffs-supports.js` | *modifié* — 9 lignes calculées, puis 4 consignées ; en-tête mis à jour | 2, 3 |
| `tests/helpers/effets-cible.js` | *modifié* — l'effet `resistanceElementaire` entre, avec sa condition | 3 |
| `js/metier/calculateur-entrees.js` | *modifié* — `buffsApplicables()` filtre `horsCalcul` | 3 |
| `js/metier/affaiblissement-cible.js` | **créé** — module pur : les lignes du recensement, et qui les possède | 4 |
| `tests/helpers/modules.js` | *modifié* — déclare le nouveau module dans la couche `metier` | 4 |
| `tests/helpers/load-app.js` | *modifié* — expose trois fonctions au bac à sable | 1, 4 |
| `tests/affaiblissement-cible.test.js` | **créé** — le recensement, le jeton d'arme, et la garde `horsCalcul` | 4 |
| `js/vues/analyse.js` | *modifié* — la section, son chargeur de table, et le filtre DPS descendu | 5 |
| `css/analyse.css` | *modifié* — la liste, et les huit colonnes de couverture | 5 |
| `tests/supabase-etape1.playwright.js` | *modifié* — une assertion de parcours | 5 |
| `package.json` | *modifié* — le nouveau test unitaire dans la chaîne | 4 |

Découpage voulu : la **règle du jeton d'arme** (tâche 1) est utile seule et se
teste seule ; les **données** (2 et 3) valent indépendamment de tout affichage —
elles enrichissent déjà le calculateur ; le **module pur** (4) se teste sans
navigateur ; la **vue** (5) ne fait plus que rendre. Un relecteur peut refuser
la tâche 5 en gardant les quatre premières.

---

### Tâche 1 : la règle du jeton d'arme, extraite et nommée

`vientDeLArme()` répond « oui / non ». Le recensement a besoin de la question
inverse — « quelle arme ce `gameId` nomme-t-il ? » — pour **afficher** l'arme.
La règle est la même ; elle ne doit exister qu'une fois.

**Fichiers :**
- Modifier : `js/metier/equipe-buffs.js:21-35` (la fonction et son commentaire),
  `:11` (l'import), `:90` (les exports)
- Modifier : `tests/helpers/load-app.js` (crochet `armeDuGameId`)
- Test : `tests/equipe-buffs.test.js` (ajout en fin de fichier, avant le
  `console.log`)

**Interfaces :**
- Consomme : `ENUM_TO_FOLDER` et `FOLDER_TO_ENUM` de `js/noyau/constantes.js`.
- Produit : `armeDuGameId(gameId) -> string|null` — l'enum d'arme du dépôt
  (`"Staff"`, `"Sword2h"`, `"Lance"`…) ou `null`. Les tâches 4 et 5 en
  dépendent.

- [ ] **Étape 1 : écrire le test qui échoue**

À ajouter à la fin de `tests/equipe-buffs.test.js`, juste avant le
`console.log` final :

```js
/* L'ARME QUE NOMME UN gameId, et les deux orthographes de Gil Thunder.

   Le meme personnage s'ecrit `gil_thunder_` sur sa Lance et `gilthunder_` sur
   son Bouclier. C'est exactement le piege que la regle du jeton existe pour
   eviter : un decoupage par position lirait « thunder » comme une arme sur le
   premier, et « shield » correctement sur le second. */
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

  /* Rien plutot que n'importe quoi : une arme absente ne s'invente pas. */
  assert.equal(armeDuGameId("daisy_passive"), null,
    "un gameId sans jeton d'arme ne doit nommer aucune arme");
  assert.equal(armeDuGameId(null), null);
  assert.equal(armeDuGameId(""), null);

  /* L'INVARIANT, et c'est lui qui compte : dans toute la table, un gameId
     nomme UNE arme et une seule. Sans ce controle, `armeDuGameId` rendrait
     silencieusement la premiere trouvee le jour ou un identifiant en
     contiendrait deux.

     La liste des armes est DERIVEE de constantes.js, jamais recopiee : deux
     listes tenues en parallele finiraient par diverger, et celle-ci
     divergerait du cote qui ne leve pas. */
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
```

Ce bloc lit `plain` : ajoute-le à l'import en tête du fichier —
`const { loadApp, plain } = require("./helpers/load-app");`. Il lit aussi deux
crochets qui n'existent pas encore, `ENUM_TO_FOLDER` et
`SEVEN_DS_BUFFS_SUPPORTS` (voir étape 3).

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
node tests/equipe-buffs.test.js
```
Attendu : ÉCHEC sur `armeDuGameId doit etre expose par le chargeur de tests`
(la fonction n'existe pas, le crochet rend `undefined`).

- [ ] **Étape 3 : implémenter**

Dans `js/metier/equipe-buffs.js`, remplacer l'import de la ligne 11 :

```js
import { ENUM_TO_FOLDER, FOLDER_TO_ENUM } from "../noyau/constantes.js";
```

Remplacer la fonction `vientDeLArme` et son commentaire (lignes 21-35) par :

```js
  /* L'ARME QUE NOMME UN gameId, ou null.

     On ne decoupe PAS par position : un gameId s'ecrit <slug>_<arme>_<reste>
     et le slug peut lui-meme contenir un tiret bas. Gil Thunder l'ecrit des
     DEUX facons - `gil_thunder_lance_skill_rmb` et `gilthunder_shield_passive`
     - et un decoupage par position se tromperait sur la premiere.

     On cherche donc le JETON `_<enum>_`, en minuscules. Un test verifie qu'un
     gameId de la table n'en contient jamais deux ; sans lui, ce `find`
     rendrait la premiere arme trouvee sans que personne ne le sache. */
  function armeDuGameId(gameId){
    const nu = String(gameId || "").toLowerCase();
    return Object.keys(ENUM_TO_FOLDER).find(
      enumArme => nu.includes("_" + enumArme.toLowerCase() + "_")
    ) || null;
  }

  /* Le buff vient-il de l'arme equipee ? Le roster range les armes par DOSSIER
     francais ; FOLDER_TO_ENUM donne l'enum que le gameId, lui, ecrit. */
  function vientDeLArme(gameId, typeArme){
    const enumArme = FOLDER_TO_ENUM[typeArme];
    if(!enumArme) return false;
    return armeDuGameId(gameId) === enumArme;
  }
```

Exports (ligne 90) :

```js
export { armeDuGameId, buffsDeLEquipe, valeurIndexeeSurAtk };
```

Dans `tests/helpers/load-app.js`, ajouter au `HOOK_EXPORT`, à côté de
`buffsDeLEquipe` :

```js
  armeDuGameId:typeof armeDuGameId === "function"
    ? armeDuGameId
    : undefined,
  /* Exposees pour que le test du jeton d'arme derive sa liste d'armes des
     MEMES constantes que le code, au lieu de la recopier - meme raison
     qu'ARMOR_SLOTS juste au-dessus. */
  ENUM_TO_FOLDER:typeof ENUM_TO_FOLDER === "object"
    ? ENUM_TO_FOLDER
    : undefined,
  SEVEN_DS_BUFFS_SUPPORTS:window.SEVEN_DS_BUFFS_SUPPORTS,
```

⚠️ `SEVEN_DS_BUFFS_SUPPORTS` n'est pas une variable du script mais une
propriété de `window` — d'où l'écriture qualifiée, sans garde `typeof`. Dans le
bac à sable, `sandbox.window = sandbox`, et `loadApp()` y installe la vraie
table lue sur disque avant d'exécuter le script.

- [ ] **Étape 4 : lancer les tests et vérifier qu'ils passent**

```bash
node tests/equipe-buffs.test.js && node tests/calculateur-entrees.test.js && node tests/modules-imports.test.js
```
Attendu : trois `OK`. Le troisième compte : il refuse un export que personne
n'importe — `armeDuGameId` n'a pas encore de consommateur applicatif.

**Si `modules-imports.test.js` refuse `armeDuGameId`** : ne le retire pas des
exports. Fusionne les tâches 1 et 4 en un seul commit — c'est la tâche 4 qui
lui donne son importateur (`js/metier/affaiblissement-cible.js`). Vérifie
d'abord ce que le test refuse exactement : il se peut qu'il tolère un export
non importé et n'en refuse que la déclaration inutile.

- [ ] **Étape 5 : commit**

```bash
git add js/metier/equipe-buffs.js tests/equipe-buffs.test.js tests/helpers/load-app.js
git commit -m "refactor: la regle du jeton d'arme se lit dans les deux sens"
```

---

### Tâche 2 : les neuf lignes calculées

Neuf malus de défense et de vulnérabilité, lus un par un dans les descriptions
françaises. Ils entrent dans la table et deviennent, du même coup, neuf cases à
cocher du calculateur — décochées par défaut, donc aucun chiffre existant ne
bouge.

**Fichiers :**
- Modifier : `data/buffs-supports.js` — l'en-tête (lignes 99-104) et le corps
- Test : `tests/calculateur-entrees.test.js:35-41` (la liste des personnages)

**Interfaces :**
- Consomme : `armeDuGameId` (tâche 1) — indirectement, par les tests.
- Produit : quinze clés dans `window.SEVEN_DS_BUFFS_SUPPORTS`. Les tâches 4 et
  5 lisent les `id` `escanor-inflammation-defense` et
  `drake-courant-electrique-defense-crit`.

- [ ] **Étape 1 : écrire le test qui échoue**

Dans `tests/calculateur-entrees.test.js`, remplacer le bloc des lignes 35-43 :

```js
/* LES PERSONNAGES DE LA TABLE, et non « les supports ».

   Escanor porte son malus de defense avec une Epee a deux mains de role
   Attaquant, Meliodas n'est support de rien, et King debuffe avec un Grimoire
   de role Gardien. Ce qui rassemble ces lignes n'est pas un role - c'est un
   effet sur la cible, ou un bonus rendu a l'equipe.

   La liste est en dur pour qu'un ajout de personnage soit un GESTE : sans
   elle, une clef mal orthographiee - « gilthunder » au lieu de « gil-thunder »
   - creerait un quinzieme personnage fantome que rien ne signalerait. */
const PERSONNAGES = [
  "elizabeth", "daisy", "manny", "howzer",
  "gowther", "guila", "dreydrin", "derieri",
  /* Entres avec le recensement « Affaiblissement de la cible » : ils ne
     donnent rien a l'equipe, ils retirent quelque chose au boss. */
  "drake", "escanor", "king", "klotho", "slader", "tioreh"
];

assert.deepEqual(Object.keys(TABLE).sort(), [...PERSONNAGES].sort(),
  "La table doit couvrir exactement les personnages declares ici");

const tousLesBuffs = PERSONNAGES.flatMap(slug => TABLE[slug]);
```

Puis remplacer les deux autres emplois de `SUPPORTS` dans le fichier
(`SUPPORTS.forEach(slug => {` à la ligne ~112) par `PERSONNAGES.forEach`.

```bash
grep -n "SUPPORTS" tests/calculateur-entrees.test.js
```
doit ne plus rien rendre après le remplacement.

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

```bash
node tests/calculateur-entrees.test.js
```
Attendu : ÉCHEC sur `La table doit couvrir exactement les personnages declares
ici` — six clés manquent (`gil-thunder` n'est pas encore attendu, il arrive en
tâche 3).

- [ ] **Étape 3 : corriger l'en-tête de `data/buffs-supports.js`**

Les lignes 99-104 déclarent `gowther_wand_skill_e` hors de la table. La
décision 4 du propriétaire l'y fait entrer. Remplacer la rubrique par :

```js
// - la reduction de defense ELEMENTAIRE, sauf pour la FOUDRE. Elle vise une
//   defense distincte de la defense generale, que le moteur ne separe pas :
//   la verser dans la reduction generale suppose que le jeu confond les deux.
//   On l'assume pour la seule Foudre, parce que la confrerie mene ses runs de
//   Boss de Guilde avec des Merlin Foudre - `gowther_wand_skill_e` figure donc
//   dans la table, portee par `element:"thunder"` pour qu'aucun build d'un
//   autre element ne la voie.
//     derieri_sword2h_skill_q  defense de Feu -20 %, reste dehors
//   Elle reviendra quand la cible portera ses defenses par element ; la ligne
//   de Derieri est deja lue et chiffree dans la spec du recensement, sa
//   reintegration ne coute que sa transcription.
```

- [ ] **Étape 4 : transcrire les neuf lignes**

Les clés restent rangées par ordre alphabétique : `daisy`, `derieri`, `drake`,
`dreydrin`, `elizabeth`, `escanor`, `gowther`, `guila`, `howzer`, `king`,
`klotho`, `manny`, `slader`, `tioreh`.

**`drake`** — clé nouvelle, à insérer après `derieri` :

```js
  "drake": [
    {
      id:"drake-courant-electrique-defense-crit",
      libelle:"Courant électrique : défense crit. de l'ennemi −8 % par cumul, 5 cumuls",
      cible:"ennemi",
      effet:"defenseCritique",
      operation:"add",
      parCumul:800,
      cumuls:5,
      valeur:4000,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"drake_staff_skill_rmb",
        phrase:"※ Courant électrique : réduit la défense crit. de ",
        phraseCumuls:"(Max : "
      }
    }
  ],
```

**`elizabeth`** — ajouter en tête de son tableau existant :

```js
    {
      /* Les 50 cumuls ne s'empilent qu'« en subissant des attaques de Vent » :
         la valeur transcrite est le MAXIMUM atteignable, comme partout dans
         cette table, mais une equipe sans Vent ne l'atteindra pas. Le volet
         « Alteration » de la meme arme - defense de Vent -30 % - reste dehors
         par la decision 4 du proprietaire. */
      id:"elizabeth-rupture-defense-crit",
      libelle:"Rupture : défense crit. de l'ennemi −0,8 % par cumul, 50 cumuls",
      cible:"ennemi",
      effet:"defenseCritique",
      operation:"add",
      parCumul:80,
      cumuls:50,
      valeur:4000,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"elizabeth_staff_skill_r",
        phrase:"et réduit la défense crit. de ",
        phraseCumuls:"(Max : "
      }
    },
```

**`escanor`** — clé nouvelle, après `elizabeth` :

```js
  "escanor": [
    {
      /* LA RAISON D'ETRE DU RECENSEMENT. Son slot Epee a deux mains porte le
         role Attacker, pas Supporter : un recensement fonde sur le role ne le
         verrait jamais, et c'est precisement lui qu'on veut voir.

         L'ancre des cumuls est LONGUE a dessein : « (Max : » apparait DEUX
         fois dans cette description - 5 fois pour les cumuls d'Inflammation,
         100 fois pour la reduction de defense - et le test exige une
         occurrence unique pour savoir de quel nombre il parle. */
      id:"escanor-inflammation-defense",
      libelle:"Inflammation : défense de l'ennemi −0,15 % par cumul, 100 cumuls",
      cible:"ennemi",
      effet:"defense",
      operation:"add",
      parCumul:15,
      cumuls:100,
      valeur:1500,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"escanor_sword2h_jumpatk",
        phrase:"Réduit la défense de ",
        phraseCumuls:"sont infligés. (Max : "
      }
    }
  ],
```

**`gowther`** — ajouter à son tableau existant, après
`gowther-extinction-degats-subis` :

```js
    {
      /* LA SEULE defense ELEMENTAIRE de la table, et elle y entre par une
         decision : la confrerie mene ses runs de Boss de Guilde avec des
         Merlin Foudre. `element:"thunder"` fait le reste - buffsApplicables()
         ne la propose qu'aux builds Foudre, donc aucun build d'un autre
         element ne se voit crediter une defense qui ne le concerne pas.

         Meme piege d'ancre qu'Escanor : « (Max : » apparait deux fois - 100
         pour la jauge de Deluge, 4 pour les cumuls de ce malus. */
      id:"gowther-salve-defense-foudre",
      libelle:"Salve de flèches : défense de Foudre de l'ennemi −6 % par cumul, 4 cumuls",
      cible:"ennemi",
      effet:"defense",
      operation:"add",
      parCumul:600,
      cumuls:4,
      valeur:2400,
      unite:"ten-thousandths",
      element:"thunder",
      provenance:{
        gameId:"gowther_wand_skill_e",
        phrase:"réduit la défense de Foudre de l'ennemi à hauteur de ",
        phraseCumuls:"pendant 30s. (Max : "
      }
    },
```

**`guila`** — son tableau ne compte qu'une entrée, sans virgule finale : ajoute
la virgule après `guila-protection-degats-feu`, puis cette entrée.

```js
    {
      /* Meme etat Inflammation qu'Escanor et Tioreh, aux memes valeurs : trois
         lectures independantes qui concordent. */
      id:"guila-inflammation-defense",
      libelle:"Inflammation : défense de l'ennemi −0,15 % par cumul, 100 cumuls",
      cible:"ennemi",
      effet:"defense",
      operation:"add",
      parCumul:15,
      cumuls:100,
      valeur:1500,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"guila_rapier_skill_e",
        phrase:"Réduit la défense de ",
        phraseCumuls:"sont infligés. (Max : "
      }
    }
```

**`king`** — clé nouvelle, après `howzer` :

```js
  "king": [
    {
      /* Grimoire de role Gardien : encore un que le role ne designerait pas.
         La vulnerabilite globale amplifie TOUT ce que la cible encaisse, sans
         distinction de categorie ni d'element. */
      id:"king-marque-degats-subis",
      libelle:"Marque de la forêt : dégâts subis par l'ennemi +2 % par cumul, 10 cumuls",
      cible:"ennemi",
      effet:"vulnerabiliteGlobale",
      operation:"add",
      parCumul:200,
      cumuls:10,
      valeur:2000,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"king_book_skill_e",
        phrase:"※ Marque de la forêt : augmente les dégâts subis de ",
        phraseCumuls:"(Max : "
      }
    }
  ],
  "klotho": [
    {
      id:"klotho-erosion-defense-crit",
      libelle:"Érosion dimensionnelle : défense crit. de l'ennemi −10 %",
      cible:"ennemi",
      effet:"defenseCritique",
      operation:"add",
      valeur:1000,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"klotho_staff_skill_e",
        phrase:"※ Érosion dimensionnelle : réduit la défense crit. de 10%"
      }
    }
  ],
```

**`slader`** et **`tioreh`** — clés nouvelles, après `manny` :

```js
  "slader": [
    {
      /* +25 % de degats subis en une seule ligne, sans cumul a monter : le
         deuxieme plus gros de la table apres l'Extinction de Gowther. */
      id:"slader-blessure-degats-subis",
      libelle:"Blessure profonde : dégâts subis par l'ennemi +25 %",
      cible:"ennemi",
      effet:"vulnerabiliteGlobale",
      operation:"add",
      valeur:2500,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"slader_axe_skill_q",
        phrase:"※ Blessure profonde : augmente les dégâts subis de 25%"
      }
    }
  ],
  "tioreh": [
    {
      id:"tioreh-inflammation-defense",
      libelle:"Inflammation : défense de l'ennemi −0,15 % par cumul, 100 cumuls",
      cible:"ennemi",
      effet:"defense",
      operation:"add",
      parCumul:15,
      cumuls:100,
      valeur:1500,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"tioreh_wand_skill_q",
        phrase:"Réduit la défense de ",
        phraseCumuls:"sont infligés. (Max : "
      }
    }
  ]
```

- [ ] **Étape 5 : lancer les tests et vérifier qu'ils passent**

```bash
node tests/calculateur-entrees.test.js && node tests/equipe-buffs.test.js
```
Attendu : deux `OK`.

Ce que ce passage prouve, ligne par ligne : chaque `gameId` existe dans
`data/wiki-competences.js` ; chaque `phrase` est un extrait **littéral** de sa
description ; chaque `phraseCumuls` apparaît **exactement une fois** ; le
nombre qui suit chaque ancre **égale** la valeur stockée ; et
`parCumul × cumuls === valeur`.

- [ ] **Étape 6 : vérifier la suite complète**

```bash
npm run test:unit
```
Attendu : aucun échec. Surveille en particulier `degats-calcul.test.js` et
`essai-enchantements.test.js` — ils ne lisent pas cette table, mais le bac à
sable la charge pour tous.

- [ ] **Étape 7 : commit**

```bash
git add data/buffs-supports.js tests/calculateur-entrees.test.js
git commit -m "feat(donnees): neuf personnages de plus affaiblissent la cible"
```

---

### Tâche 3 : la résistance élémentaire, consignée et hors calcul

Quatre lignes vraies, sourcées, et **inexploitables par le moteur** : il n'a
aucune entrée pour la résistance élémentaire, et le champ correspondant de
l'outil de référence (`d-eew`) n'a jamais été mesuré. Le drapeau `horsCalcul`
les fait exister sans mentir.

**La garde la plus importante de tout ce plan** est ici : `buffsApplicables()`
ne doit **jamais** les rendre. Sans ce test, une ligne consignée finirait un
jour en case à cocher, et le membre croirait son effet compté dans ses dégâts.

**Fichiers :**
- Modifier : `tests/helpers/effets-cible.js:18-31`
- Modifier : `tests/calculateur-entrees.test.js` (schéma + filet « aucun buff ignoré »)
- Modifier : `js/metier/calculateur-entrees.js:182-190`
- Modifier : `data/buffs-supports.js` (en-tête + 4 lignes)

**Interfaces :**
- Consomme : la table de la tâche 2.
- Produit : le drapeau `horsCalcul:true` sur quatre lignes, et la garantie que
  `buffsApplicables()` les exclut. La tâche 4 s'appuie sur les deux.

- [ ] **Étape 1 : écrire les tests qui échouent**

Dans `tests/helpers/effets-cible.js`, ajouter à la liste `EFFETS_SUR_LA_CIBLE` :

```js
  /* « Reduit la resistance a la Foudre de 15 % » : CONSIGNEE, PAS CALCULEE.

     Le moteur connait `resistanceElementaire` sur la cible, mais rien ne la
     reduit - il n'existe pas de `reductionResistanceElementaire`, et en
     ajouter un modifierait la formule. Or `d-eew`, le champ correspondant chez
     l'outil de reference, n'a jamais ete mesure : on ignore s'il se retranche
     en points ou en pourcentage.

     Toute ligne portant cet effet DOIT donc porter `horsCalcul:true`, et un
     test le verifie. C'est la seule entree de cette liste que le moteur ne
     branche nulle part, et c'est voulu. */
  "resistanceElementaire"
```

Dans `tests/calculateur-entrees.test.js`, à l'intérieur du
`tousLesBuffs.forEach(buff => {` du schéma (après le bloc `if(surLaCible)`),
ajouter :

```js
  /* LE DRAPEAU ET SON EFFET VONT ENSEMBLE, dans les deux sens.

     Sans le premier sens, une ligne de resistance elementaire oubliee de
     drapeau atteindrait le calculateur. Sans le second, un drapeau pose par
     erreur sur un malus reel le ferait disparaitre des cases a cocher, en
     silence et sans qu'aucun chiffre ne bouge - le pire des deux. */
  const consignee = Object.prototype.hasOwnProperty.call(buff, "horsCalcul");
  if(consignee){
    assert.equal(buff.horsCalcul, true,
      buff.id + " : `horsCalcul` ne s'ecrit qu'a true, ou pas du tout");
  }
  assert.equal(consignee, buff.effet === "resistanceElementaire",
    buff.id + " : `horsCalcul` et l'effet `resistanceElementaire` vont "
      + "ensemble, ou pas du tout");
```

Remplacer le filet « aucun buff silencieusement ignoré » (lignes ~202-211) par :

```js
tousLesBuffs.forEach(buff => {
  const nu = entreesDuCalcul({ statsDuBuild:NEUTRE, buffsCoches:[] });
  const avec = entreesDuCalcul({ statsDuBuild:NEUTRE, buffsCoches:[buff] });
  const changeLeMoteur = Object.keys(nu).some(cle => nu[cle] !== avec[cle]);
  const changeUneCategorie =
    Object.keys(bonusCategorieDesBuffs([buff])).length > 0;

  /* UNE LIGNE CONSIGNEE NE CHANGE RIEN, et c'est sa definition. Le filet
     s'inverse pour elle : au lieu d'exiger qu'elle branche quelque chose, on
     exige qu'elle ne branche RIEN. Une ligne hors calcul qui deplacerait une
     entree du moteur serait un mensonge silencieux. */
  if(buff.horsCalcul){
    assert.ok(!changeLeMoteur && !changeUneCategorie,
      buff.id + " : une ligne hors calcul ne doit toucher AUCUNE entree du "
        + "moteur, or celle-ci en change une");
    return;
  }

  assert.ok(changeLeMoteur || changeUneCategorie,
    buff.id + " : ce buff ne change NI une entree du moteur NI un bonus de "
      + "categorie, son code " + buff.stat + " n'est branche nulle part");
});

/* LA GARDE QUI COMPTE LE PLUS DE TOUT CE CHANTIER.

   Une ligne consignee vit dans le recensement de l'Analyse, pour composer un
   groupe. Elle ne doit JAMAIS apparaitre en case a cocher du calculateur : le
   membre la cocherait, verrait son total ne pas bouger, et croirait pourtant
   son effet compte. Le silence est ici pire que l'absence. */
{
  const consignees = tousLesBuffs.filter(buff => buff.horsCalcul);
  assert.ok(consignees.length > 0,
    "la table doit porter au moins une ligne consignee, sinon cette garde ne "
      + "verifie rien");
  ["", "fire", "ice", "wind", "earth", "holy", "dark", "thunder", "default"]
    .forEach(element => {
      const proposes = new Set(buffsApplicables(element).map(buff => buff.id));
      consignees.forEach(ligne => assert.ok(!proposes.has(ligne.id),
        ligne.id + " : ligne hors calcul proposee au calculateur pour l'element « "
          + element + " »"));
    });
}
```

⚠️ Ce bloc doit être placé **après** la déclaration de `buffsApplicables`
(ligne ~158, `const { … } = hooks;`).

- [ ] **Étape 2 : lancer et vérifier l'échec**

```bash
node tests/calculateur-entrees.test.js
```
Attendu : ÉCHEC sur `la table doit porter au moins une ligne consignee` —
aucune n'existe encore.

- [ ] **Étape 3 : filtrer dans `buffsApplicables`**

Dans `js/metier/calculateur-entrees.js`, remplacer la fonction (lignes 176-190,
commentaire compris) :

```js
  /* Un buff elementaire ne concerne que les builds de cet element. Il est
     ABSENT des autres, jamais grise : c'est la meme regle qu'une competence
     sans coefficient, qui disparait au lieu de valoir zero.

     L'element attendu est celui de l'ARME equipee, jamais du personnage : un
     heros change d'element avec son arme.

     Les lignes CONSIGNEES (`horsCalcul`) sortent avant tout filtre. Le moteur
     n'a pas d'entree pour la resistance elementaire : les proposer donnerait
     une case a cocher qui ne bouge aucun chiffre, et le membre croirait son
     effet compte. Elles vivent dans le recensement de l'Analyse, pas ici. */
  function buffsApplicables(elementDuBuild){
    const catalogue = tableDesBuffs();
    const vise = (elementDuBuild || "").toLowerCase();
    return Object.keys(catalogue).sort().flatMap(support =>
      (catalogue[support] || [])
        .filter(buff => !buff.horsCalcul)
        .filter(buff => !buff.element || buff.element.toLowerCase() === vise)
        .map(buff => Object.assign({ support }, buff))
    );
  }
```

- [ ] **Étape 4 : transcrire les quatre lignes**

Dans `data/buffs-supports.js`, ajouter d'abord au bloc de commentaire de tête,
juste après la description de `vulnerabiliteGlobale` :

```js
//               "resistanceElementaire"  CONSIGNEE, PAS CALCULEE. Le moteur
//                                     connait la resistance elementaire de la
//                                     cible mais RIEN ne la reduit, et le
//                                     champ correspondant de l'outil de
//                                     reference n'a jamais ete mesure. La
//                                     ligne porte donc `horsCalcul:true` :
//                                     buffsApplicables() l'ecarte, le
//                                     recensement de l'Analyse l'affiche. Un
//                                     test verifie les deux.
//                                     Ce n'est pas une bizarrerie isolee : 14
//                                     personnages reduisent la resistance
//                                     elementaire, et l'enjeu est gros - 15
//                                     points retires a une resistance de 30 %
//                                     valent +21 % de degats.
```

Ajouter à `drake` (deuxième entrée de son tableau) :

```js
    {
      /* Meme competence que la ligne ci-dessus, autre effet : la Tempete de
         Foudre pose Courant electrique ET Paralysie. Deux lignes, deux
         identifiants, une seule source. */
      id:"drake-paralysie-resistance-foudre",
      libelle:"Paralysie : résistance à la Foudre de l'ennemi −15 %",
      cible:"ennemi",
      effet:"resistanceElementaire",
      horsCalcul:true,
      operation:"add",
      valeur:1500,
      unite:"ten-thousandths",
      element:"thunder",
      provenance:{
        gameId:"drake_staff_skill_rmb",
        phrase:"※ Paralysie : immobilisation. Réduit la résistance à la Foudre de 15%"
      }
    }
```

Créer la clé `gil-thunder`, entre `escanor` et `gowther` :

```js
  /* TROIS ARMES, DEUX ORTHOGRAPHES. Ses identifiants s'ecrivent tantot
     `gil_thunder_`, tantot `gilthunder_` : la regle du jeton `_<enum>_` de
     armeDuGameId() les couvre toutes les trois, un decoupage par position n'y
     survivrait pas. Ses trois lignes sont consignees, aucune n'atteint la
     formule. */
  "gil-thunder": [
    {
      id:"gil-thunder-paralysie-resistance-foudre",
      libelle:"Paralysie : résistance à la Foudre de l'ennemi −15 %",
      cible:"ennemi",
      effet:"resistanceElementaire",
      horsCalcul:true,
      operation:"add",
      valeur:1500,
      unite:"ten-thousandths",
      element:"thunder",
      provenance:{
        gameId:"gil_thunder_lance_skill_rmb",
        phrase:"※ Paralysie : immobilisation. Réduit la résistance à la Foudre de 15%"
      }
    },
    {
      id:"gil-thunder-barriere-resistance-foudre",
      libelle:"Barrière de Foudre retirée : résistance à la Foudre de l'ennemi −15 % (30 s)",
      cible:"ennemi",
      effet:"resistanceElementaire",
      horsCalcul:true,
      operation:"add",
      valeur:1500,
      unite:"ten-thousandths",
      element:"thunder",
      provenance:{
        gameId:"gilthunder_shield_passive",
        phrase:"réduit la résistance à la Foudre des ennemis proches de 15% pendant 30s"
      }
    },
    {
      id:"gil-thunder-deluge-resistance-foudre",
      libelle:"Déluge de Foudre activé : résistance à la Foudre de l'ennemi −15 % (20 s)",
      cible:"ennemi",
      effet:"resistanceElementaire",
      horsCalcul:true,
      operation:"add",
      valeur:1500,
      unite:"ten-thousandths",
      element:"thunder",
      provenance:{
        gameId:"gilthunder_sword1h_passive",
        phrase:"réduit la résistance à la Foudre de l'ennemi de 15% pendant 20s"
      }
    }
  ],
```

Enfin, ajouter `"gil-thunder"` à la liste `PERSONNAGES` de
`tests/calculateur-entrees.test.js`, dans le second groupe.

- [ ] **Étape 5 : lancer les tests et vérifier qu'ils passent**

```bash
node tests/calculateur-entrees.test.js && node tests/equipe-buffs.test.js
```
Attendu : deux `OK`.

- [ ] **Étape 6 : vérifier que le calculateur n'a pas bougé**

```bash
npm run test:unit && node tests/calculateur.playwright.js
```
Attendu : aucun échec. Le Playwright du calculateur compte et coche des buffs —
c'est lui qui verrait une ligne consignée s'inviter dans la liste.

- [ ] **Étape 7 : commit**

```bash
git add data/buffs-supports.js tests/helpers/effets-cible.js tests/calculateur-entrees.test.js js/metier/calculateur-entrees.js
git commit -m "feat(donnees): la resistance a la Foudre, consignee et hors calcul"
```

---

### Tâche 4 : le module pur du recensement

Toute la logique du recensement, sans DOM ni réseau, donc testable sans
navigateur. La vue n'aura plus qu'à rendre.

**Fichiers :**
- Créer : `js/metier/affaiblissement-cible.js`
- Modifier : `tests/helpers/modules.js` (après `"metier/equipe-buffs.js"`)
- Modifier : `tests/helpers/load-app.js` (deux crochets)
- Modifier : `package.json` (`test:unit`)
- Test : `tests/affaiblissement-cible.test.js`

**Interfaces :**
- Consomme : `armeDuGameId` (tâche 1), `ENUM_TO_FOLDER` de
  `js/noyau/constantes.js`, `owns` de `js/noyau/outils.js`, et
  `window.SEVEN_DS_BUFFS_SUPPORTS` (tâches 2 et 3).
- Produit :
  - `lignesDAffaiblissement() -> Array<{ id, support, libelle, effet, valeur,
    element, horsCalcul, arme, armeDossier }>` — `arme` est l'enum
    (`"Sword2h"`), `armeDossier` le dossier français du roster
    (`"Epee 2 mains"`), `element` reste en minuscules (`"thunder"`) ou `null`.
  - `porteursDeLaLigne(ligne, joueurs) -> Array<{ owner, nom, potentiel }>`,
    trié par potentiel décroissant.

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `tests/affaiblissement-cible.test.js` :

```js
"use strict";

/* Le recensement « Affaiblissement de la cible » : quelles lignes il montre,
   et qui les possede.

   Ce que ce fichier garde, et que rien d'autre ne garde : le critere du
   recensement est l'EFFET TRANSCRIT, jamais le role de slot. Escanor porte son
   malus de defense avec une Epee a deux mains de role Attaquant ; King avec un
   Grimoire de role Gardien. Un recensement fonde sur le role les manquerait
   tous les deux, et c'est exactement ce qui a motive cette section. */

const assert = require("node:assert/strict");
const { loadApp, plain } = require("./helpers/load-app");

const { hooks } = loadApp();
const { lignesDAffaiblissement, porteursDeLaLigne, buffsApplicables } = hooks;

assert.equal(typeof lignesDAffaiblissement, "function",
  "lignesDAffaiblissement doit etre expose par le chargeur de tests");
assert.equal(typeof porteursDeLaLigne, "function",
  "porteursDeLaLigne doit etre expose par le chargeur de tests");

const lignes = lignesDAffaiblissement();
const parId = id => lignes.find(ligne => ligne.id === id);

/* ---- Le critere est l'effet, pas le role ---- */
const escanor = parId("escanor-inflammation-defense");
assert.ok(escanor,
  "Escanor doit figurer au recensement : son Epee a deux mains est de role "
    + "Attaquant, et c'est justement le cas qui interdit de filtrer par role");
assert.equal(escanor.arme, "Sword2h");
assert.equal(escanor.armeDossier, "Epee 2 mains");

assert.ok(parId("king-marque-degats-subis"),
  "King debuffe avec un Grimoire de role Gardien : lui aussi doit figurer");

/* ---- Un bonus pose sur le HEROS n'est pas un affaiblissement ---- */
assert.ok(!parId("daisy-reveil-degats-crit"),
  "un bonus rendu aux allies ne dit rien de ce que la cible encaisse");
lignes.forEach(ligne => assert.ok(ligne.effet,
  ligne.id + " : toute ligne du recensement porte un effet sur la cible"));

/* ---- L'arme est celle du gameId, PAS la premiere du personnage ----

   Drake porte Epee 2 mains, Baton, Epee 1 main dans cet ordre. Son malus vient
   du Baton : afficher sa premiere arme serait une ligne fausse, et le membre
   irait monter la mauvaise. */
const drake = parId("drake-courant-electrique-defense-crit");
assert.equal(drake.arme, "Staff",
  "l'arme affichee doit venir du gameId, pas de l'ordre des slots du perso");
assert.equal(drake.armeDossier, "Baton");

/* Les deux orthographes de Gil Thunder, sur deux armes differentes. */
assert.equal(parId("gil-thunder-paralysie-resistance-foudre").arme, "Lance");
assert.equal(parId("gil-thunder-barriere-resistance-foudre").arme, "Shield");
assert.equal(parId("gil-thunder-deluge-resistance-foudre").arme, "Sword1h");

/* Aucune ligne sans arme lisible : une ligne dont l'arme est inconnue ne peut
   trouver aucun porteur, donc elle s'afficherait grise a tort et pour
   toujours. */
lignes.forEach(ligne => assert.ok(ligne.arme,
  ligne.id + " : aucune arme lisible dans son gameId"));

/* ---- Les lignes consignees : presentes ici, absentes du calculateur ---- */
const consignees = lignes.filter(ligne => ligne.horsCalcul);
assert.equal(consignees.length, 4,
  "les quatre lignes de resistance a la Foudre doivent figurer au recensement");
const proposees = new Set(buffsApplicables("thunder").map(buff => buff.id));
consignees.forEach(ligne => assert.ok(!proposees.has(ligne.id),
  ligne.id + " : consignee au recensement, elle ne doit jamais etre proposee "
    + "en case a cocher du calculateur"));

/* ---- La possession : le personnage ET l'arme ---- */
const YANNIS = {
  owner:"u-1",
  name:"Yannis",
  characters:[
    { charId:"escanor", potentialTier:8, builds:{ "Epee 2 mains":{} } },
    /* Il a Drake, mais a l'Epee 1 main : son Baton n'est pas monte, donc il
       n'apporte PAS le Courant electrique. */
    { charId:"drake", potentialTier:5, builds:{ "Epee 1 main":{} } }
  ]
};
const MARC = {
  owner:"u-2",
  name:"Marc",
  characters:[
    { charId:"escanor", potentialTier:10, builds:{ "Epee 2 mains":{}, "Hache":{} } }
  ]
};

assert.deepEqual(plain(porteursDeLaLigne(escanor, [YANNIS, MARC])), [
  { owner:"u-2", nom:"Marc", potentiel:10 },
  { owner:"u-1", nom:"Yannis", potentiel:8 }
], "les porteurs se lisent du meilleur potentiel au moins bon");

assert.deepEqual(plain(porteursDeLaLigne(drake, [YANNIS, MARC])), [],
  "posseder le personnage sans l'arme qui porte l'effet n'est pas le posseder");

/* ---- Une ligne que personne ne possede reste une ligne ---- */
assert.deepEqual(plain(porteursDeLaLigne(escanor, [])), [],
  "aucun porteur ne doit lever : savoir qu'un effet manque est une information");
assert.ok(lignes.length >= 13,
  "le recensement doit couvrir les treize lignes transcrites, recu "
    + lignes.length);

/* ---- Les entrees illisibles ne cassent rien ---- */
assert.deepEqual(plain(porteursDeLaLigne(null, [YANNIS])), []);
assert.deepEqual(plain(porteursDeLaLigne(escanor, null)), []);
assert.deepEqual(
  plain(porteursDeLaLigne(escanor, [{ owner:"u-3", name:"Vide" }])), [],
  "un membre sans roster charge ne doit pas lever");

console.log("affaiblissement-cible.test.js OK (" + lignes.length + " lignes, "
  + consignees.length + " consignees)");
```

- [ ] **Étape 2 : lancer et vérifier l'échec**

```bash
node tests/affaiblissement-cible.test.js
```
Attendu : ÉCHEC sur `lignesDAffaiblissement doit etre expose par le chargeur de
tests`.

- [ ] **Étape 3 : créer le module**

`js/metier/affaiblissement-cible.js` :

```js
/* Qui peut affaiblir la cible, et qui dans la confrerie le possede.

   Module PUR : ni DOM, ni reseau, ni Supabase. La vue lui passe les membres
   deja agreges par rosterPlayerFrom() ; il rend des lignes pretes a afficher.

   LE CRITERE EST L'EFFET, JAMAIS LE ROLE. Le recensement des DPS repond « qui
   frappe » ; celui-ci repond « qui fait encaisser ». Escanor porte son malus
   de defense avec une Epee a deux mains de role Attaquant, King avec un
   Grimoire de role Gardien : un filtre par role les manquerait tous les deux,
   et ce sont eux qu'on veut voir.

   La table dit ce qu'un personnage FAIT ; le roster dit qui le possede. Ce
   module ne fait que les croiser, et n'invente aucune des deux moities. */

import { ENUM_TO_FOLDER } from "../noyau/constantes.js";
import { owns } from "../noyau/outils.js";
import { armeDuGameId } from "./equipe-buffs.js";

  /* Chargee A LA DEMANDE par la vue, comme les competences et les potentiels
     d'equipe : la lire par window plutot que par import evite de la faire
     payer aux visiteurs qui n'ouvrent jamais l'Analyse. */
  function tableDesBuffs(){
    return window.SEVEN_DS_BUFFS_SUPPORTS || {};
  }

  /* Une ligne d'affaiblissement, c'est une entree qui vise l'ENNEMI. Les
     bonus poses sur le heros (`stat`) restent au calculateur : ils ne disent
     rien de ce que la cible encaisse.

     Les lignes CONSIGNEES en font partie, drapeau compris. C'est tout leur
     objet : elles servent a composer un groupe, et la vue dira qu'elles ne
     comptent pas dans les degats. */
  function lignesDAffaiblissement(){
    const catalogue = tableDesBuffs();
    return Object.keys(catalogue).sort().flatMap(support =>
      (catalogue[support] || [])
        .filter(ligne => ligne.cible === "ennemi")
        .map(ligne => {
          const arme = armeDuGameId((ligne.provenance || {}).gameId);
          return {
            id:ligne.id,
            support,
            libelle:ligne.libelle,
            effet:ligne.effet,
            valeur:ligne.valeur,
            element:ligne.element || null,
            horsCalcul:Boolean(ligne.horsCalcul),
            arme,
            /* Le roster range ses builds par DOSSIER francais ; l'enum est ce
               que le gameId ecrit. Les deux voyagent, parce que la vue affiche
               l'un et interroge le roster avec l'autre. */
            armeDossier:arme ? ENUM_TO_FOLDER[arme] || null : null
          };
        })
    );
  }

  /* Les membres qui portent CETTE ligne : le personnage ET l'arme qui la
     porte. Posseder Escanor ne suffit pas - son malus vit sur l'Epee a deux
     mains, et un membre qui ne joue que sa Hache ne l'apporte pas au groupe.

     Une ligne dont l'arme est illisible ne trouve PERSONNE plutot que tout le
     monde : une ligne grise a tort se corrige en la regardant, un membre
     annonce a tort envoie composer une equipe qui n'existe pas. */
  function porteursDeLaLigne(ligne, joueurs){
    const dossier = ligne && ligne.armeDossier;
    if(!dossier) return [];
    const membres = Array.isArray(joueurs) ? joueurs : [];
    return membres
      .flatMap(joueur => (joueur.characters || [])
        .filter(entree => entree
          && entree.charId === ligne.support
          && owns(entree.builds, dossier))
        .map(entree => ({
          owner:joueur.owner,
          nom:joueur.name,
          potentiel:entree.potentialTier || 0
        })))
      .sort((a, b) => b.potentiel - a.potentiel);
  }

export { lignesDAffaiblissement, porteursDeLaLigne };
```

- [ ] **Étape 4 : déclarer le module et ses crochets**

Dans `tests/helpers/modules.js`, insérer juste après `"metier/equipe-buffs.js"` :

```js
  /* Apres `equipe-buffs.js`, dont il importe la regle du jeton d'arme : un
     module n'importe jamais un module declare apres lui. */
  "metier/affaiblissement-cible.js",
```

Dans `tests/helpers/load-app.js`, ajouter au `HOOK_EXPORT` :

```js
  lignesDAffaiblissement:typeof lignesDAffaiblissement === "function"
    ? lignesDAffaiblissement
    : undefined,
  porteursDeLaLigne:typeof porteursDeLaLigne === "function"
    ? porteursDeLaLigne
    : undefined,
```

Dans `package.json`, ajouter à la fin de `test:unit`, après
`node tests/analyse-elements.test.js` :

```
 && node tests/affaiblissement-cible.test.js
```

⚠️ `index.html` doit aussi charger le nouveau module. Vérifie comment les
modules y sont déclarés :

```bash
grep -n "equipe-buffs" index.html
```
S'il y figure explicitement, ajoute `affaiblissement-cible.js` au même endroit,
dans le même ordre que `tests/helpers/modules.js`. S'il n'y a qu'un seul point
d'entrée (`js/app.js`), rien à faire : les `import` suffisent.

- [ ] **Étape 5 : lancer les tests et vérifier qu'ils passent**

```bash
node tests/affaiblissement-cible.test.js && node tests/modules-imports.test.js && npm run test:unit
```
Attendu : `affaiblissement-cible.test.js OK (13 lignes, 4 consignees)`, puis
aucun échec sur la suite.

**Si `modules-imports.test.js` refuse `lignesDAffaiblissement` ou
`porteursDeLaLigne`** : c'est attendu tant que la tâche 5 ne les importe pas.
Deux options, dans cet ordre de préférence : enchaîner la tâche 5 et ne
committer qu'ensuite, ou vérifier que le test ne refuse que les exports
d'un module déjà importé ailleurs.

- [ ] **Étape 6 : commit**

```bash
git add js/metier/affaiblissement-cible.js tests/affaiblissement-cible.test.js tests/helpers/modules.js tests/helpers/load-app.js package.json
git commit -m "feat(metier): le recensement de l'affaiblissement, sans navigateur"
```

---

### Tâche 5 : la section dans l'Analyse

**Fichiers :**
- Modifier : `js/vues/analyse.js` — imports, chargeur de table,
  `rosterDerivedPlayers()`, `renderAnalyse()`
- Modifier : `css/analyse.css`
- Modifier : `tests/supabase-etape1.playwright.js` (~ligne 1490)

**Interfaces :**
- Consomme : `lignesDAffaiblissement()` et `porteursDeLaLigne()` (tâche 4),
  `WEAPON_ENUM` de `js/noyau/constantes.js`, `charOf` de
  `js/metier/catalogue.js`, `elemBadge()` et `el()` locaux.
- Produit : un bloc `.debuff-list` de lignes `.debuff-row` dans `#analyseBody`,
  entre la couverture et le classement.

- [ ] **Étape 1 : écrire l'assertion de parcours qui échoue**

Dans `tests/supabase-etape1.playwright.js`, juste après
`assert.match(analyseText, /Meliodas/);` (~ligne 1490) :

```js
    /* LE RECENSEMENT D'AFFAIBLISSEMENT NE DEPEND D'AUCUN ROSTER : une ligne
       que personne ne possede reste affichee, parce que savoir qu'un effet
       manque a la confrerie est une information. Son compte doit donc valoir
       exactement le nombre de lignes visant l'ennemi dans la table - derive de
       la table elle-meme, pour qu'ajouter une ligne demain ne casse pas ce
       test sans raison. */
    assert.match(analyseText, /Affaiblissement de la cible/);
    const lignesAttendues = await page.evaluate(() =>
      Object.values(window.SEVEN_DS_BUFFS_SUPPORTS || {})
        .flat()
        .filter(ligne => ligne.cible === "ennemi")
        .length
    );
    assert.ok(lignesAttendues > 0,
      "la table des buffs doit etre chargee par l'onglet Analyse lui-meme");
    assert.equal(
      await page.locator("#analyseBody .debuff-row").count(),
      lignesAttendues,
      "chaque ligne visant l'ennemi doit avoir sa ligne au recensement"
    );
    /* Une ligne consignee se signale a l'ecran, sinon le membre la croirait
       comptee dans ses degats. */
    assert.ok(
      await page.locator("#analyseBody .db-hors-calcul").count() > 0,
      "les lignes hors calcul doivent porter leur mention"
    );
```

- [ ] **Étape 2 : lancer et vérifier l'échec**

```bash
node tests/supabase-etape1.playwright.js
```
Attendu : ÉCHEC sur `Affaiblissement de la cible` introuvable dans le texte.

⚠️ Ce fichier a deux points connus d'instabilité (un écart de 44 px, et le
focus temps réel du boss). Un échec **ailleurs** que sur les assertions
ci-dessus se relance avant d'être diagnostiqué.

- [ ] **Étape 3 : implémenter la vue**

Dans `js/vues/analyse.js`, ajouter aux imports :

```js
import {
  lignesDAffaiblissement,
  porteursDeLaLigne
} from "../metier/affaiblissement-cible.js";
```
et ajouter `WEAPON_ENUM` à l'import existant de `../noyau/constantes.js`.

Ajouter le chargeur, juste avant `/* ============ Analyse ============ */`
(~ligne 169) :

```js
  /* La table des buffs est chargee A LA DEMANDE, comme au calculateur : un
     visiteur qui n'ouvre jamais l'Analyse ne doit pas la payer.

     On ne reutilise PAS chargerCatalogues() de js/vues/calculateur.js : il en
     charge sept, dont six que l'Analyse ne lit jamais - competences.js pese a
     lui seul 7491 lignes. Un echec est rejouable : une coupure reseau ne doit
     pas condamner la section pour toute la session. */
  let chargementDesBuffs = null;
  function chargerBuffsSupports(){
    if(window.SEVEN_DS_BUFFS_SUPPORTS) return Promise.resolve(true);
    if(chargementDesBuffs) return chargementDesBuffs;
    chargementDesBuffs = new Promise((resolve, reject) => {
      document.head.appendChild(el("script",{
        src:"./data/buffs-supports.js",
        onload:() => resolve(true),
        onerror:() => reject(new Error("catalogue introuvable : buffs-supports"))
      }));
    }).catch(erreur => {
      chargementDesBuffs = null;
      throw erreur;
    });
    return chargementDesBuffs;
  }
```

Dans `rosterDerivedPlayers()`, retirer le filtre final (ligne 124) :

```js
    return Object.keys(byOwner)
      /* Plus de filtre sur `dps.length` ici : un membre qui ne joue que des
         soutiens a sa place au recensement d'affaiblissement, et le filtre
         d'origine le rendait invisible avant meme que la vue ne le voie. Les
         sections DPS filtrent desormais elles-memes, au plus pres de leur
         besoin. */
      .map(owner => rosterPlayerFrom(owner, nameOf(owner), byOwner[owner]));
```

Dans `renderAnalyse()`, remplacer le bloc de chargement (lignes 281-296) :

```js
    let membres;
    try{
      membres = await rosterDerivedPlayers();
    }catch(error){
      membres = [];
      toast("Analyse indisponible pour l'instant.", true);
    }
    const buffsLus = await chargerBuffsSupports().then(() => true, () => false);
    if(renderId !== analyseRenderId) return;
    box.innerHTML = "";
    if(!membres.length){
      box.appendChild(el("div",{class:"empty-state"},[
        el("p",{class:"big",text:"Rien à analyser"}),
        el("p",{text:"Les DPS sont calculés depuis les rosters : ajoute des personnages offensifs dans l'onglet « Roster »."})
      ]));
      return;
    }
    /* Les trois sections DPS ne parlent que des membres qui en ont un. Le
       recensement d'affaiblissement, lui, parle de tout le monde. */
    const players = membres.filter(p => (p.dps || []).length);
```

Puis, **après** `box.appendChild(covRow);` et **avant** le titre « Classement
par potentiel », insérer :

```js
    // --- 2) Affaiblissement de la cible ---
    /* Sa place n'est pas indifferente : la couverture pose le decor - qui
       frappe, et de quel element - et cette section dit qui peut le faire
       encaisser. Le classement, qui suit, sert a choisir QUI emmener. */
    box.appendChild(el("h2",{class:"an-title", text:"Affaiblissement de la cible"}));
    box.appendChild(el("p",{class:"an-note",
      text:"Ce que la confrérie peut retirer au boss lui-même. Le rôle du personnage n'y décide de rien : Escanor porte son malus de défense avec une épée à deux mains d'Attaquant."}));
    if(!buffsLus){
      box.appendChild(el("div",{class:"rank-empty",
        text:"Recensement indisponible : la table des effets n'a pas pu être lue."}));
    }else{
      const affaiblissements = el("div",{class:"debuff-list"});
      lignesDAffaiblissement().forEach(ligne => {
        const porteurs = porteursDeLaLigne(ligne, membres);
        const ch = charOf(ligne.support);
        const arme = ligne.arme && WEAPON_ENUM[ligne.arme]
          ? WEAPON_ENUM[ligne.arme].label : "—";
        const portrait = el("span",{class:"rk-portrait"});
        if(ch) portrait.appendChild(el("img",{src:ch.file,alt:"",loading:"lazy"}));

        const effet = el("span",{class:"db-effet"},[
          el("span",{class:"db-libelle", text:ligne.libelle})
        ]);
        /* La mention est le pendant a l'ecran du drapeau `horsCalcul` : sans
           elle, le membre lirait un malus chiffre et le croirait compte dans
           ses degats. */
        if(ligne.horsCalcul){
          effet.appendChild(el("span",{
            class:"db-hors-calcul",
            title:"Effet réel, mais absent du calcul : le moteur n'a pas d'entrée pour la résistance élémentaire, et la mécanique du jeu n'a pas été mesurée.",
            text:"hors calcul"
          }));
        }

        const qui = el("span",{class:"db-porteurs"});
        if(porteurs.length){
          porteurs.forEach(p => qui.appendChild(el("span",{
            class:"db-porteur",
            text:p.nom + (p.potentiel > 0 ? " P" + p.potentiel : "")
          })));
        }else{
          qui.appendChild(el("span",{class:"db-personne", text:"Personne"}));
        }

        affaiblissements.appendChild(el("div",{
          /* Grisee, jamais retiree : savoir qu'un effet manque a la confrerie
             est une information, et c'est meme celle qui fait recruter. */
          class:"debuff-row" + (porteurs.length ? "" : " db-absente")
        },[
          el("span",{class:"db-perso"},[
            portrait,
            el("span",{class:"db-nom",
              text:(ch ? ch.name : ligne.support) + " · " + arme})
          ]),
          effet,
          ligne.element
            ? elemBadge(String(ligne.element).toUpperCase())
            : el("span",{class:"db-tous", text:"tous éléments"}),
          qui
        ]));
      });
      box.appendChild(affaiblissements);
    }
```

Enfin, renumérote les commentaires de section : `// --- 3) Classement par
élément ---` et `// --- 4) Matrice joueur × élément ---`.

- [ ] **Étape 4 : la feuille de style**

Dans `css/analyse.css`, corriger d'abord la couverture (ligne 9) :

```css
/* HUIT colonnes, pas sept : « Physique » est un element a part entiere depuis
   le 15 aout 2026, et il tombait seul sur une deuxieme ligne. */
.cov-row{display:grid;grid-template-columns:repeat(8,1fr);gap:10px}
```

Puis ajouter à la fin du fichier :

```css
/* ---------- Affaiblissement de la cible ---------- */
.an-note{margin:-6px 0 12px;color:var(--muted);font-size:12.5px;max-width:74ch}
.debuff-list{display:flex;flex-direction:column;border:1px solid var(--line);
  border-radius:10px;overflow:hidden}
.debuff-row{display:grid;grid-template-columns:1.3fr 1.9fr auto 1fr;
  align-items:center;gap:10px;padding:8px 14px;
  border-bottom:1px solid var(--line-soft)}
.debuff-row:last-child{border-bottom:0}
/* Une ligne que personne ne possede s'efface, elle ne disparait pas. */
.debuff-row.db-absente{opacity:.55}
.db-perso{display:flex;align-items:center;gap:8px;min-width:0}
.db-nom{color:var(--parchment);font-size:13px;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis}
.db-effet{display:flex;align-items:center;gap:8px;min-width:0}
.db-libelle{font-size:12.5px;color:var(--muted);min-width:0}
.db-hors-calcul{flex:none;font-size:10px;letter-spacing:.08em;
  text-transform:uppercase;color:var(--muted-2);border:1px solid var(--line);
  border-radius:999px;padding:1px 7px;white-space:nowrap}
.db-tous{font-size:11px;color:var(--muted-2);white-space:nowrap}
.db-porteurs{display:flex;flex-wrap:wrap;gap:4px 8px;justify-content:flex-end}
.db-porteur{font-size:12px;color:var(--gold-bright);white-space:nowrap}
.db-personne{font-size:12px;color:var(--muted-2)}
@media(max-width:820px){
  .debuff-row{grid-template-columns:1fr;gap:4px}
  .db-porteurs{justify-content:flex-start}
}
```

- [ ] **Étape 5 : lancer les tests et vérifier qu'ils passent**

```bash
node tests/css-ordre.test.js && npm run test:unit
```
puis
```bash
node tests/supabase-etape1.playwright.js && node tests/accessibilite-mobile.playwright.js
```
Attendu : aucun échec. `accessibilite-mobile` attend `#analyseBody .rank-table`
— la nouvelle section le précède sans le remplacer, mais c'est le test qui le
prouve.

- [ ] **Étape 6 : regarder la page**

Ouvre l'onglet Analyse connecté et vérifie de l'œil :
- les huit cartes de couverture tiennent sur **une** ligne ;
- une ligne possédée montre les membres et leur potentiel, une ligne non
  possédée est grisée et dit « Personne » ;
- les quatre lignes de Drake et Gil Thunder portent « hors calcul » ;
- la ligne de Gowther montre la pastille Foudre, les autres « tous éléments » ;
- en 375 px de large, les lignes s'empilent sans déborder.

- [ ] **Étape 7 : la suite complète**

```bash
npm test
```
Attendu : aucun échec. En cas d'échec sur `supabase-etape1` (44 px) ou
`accessibilite-mobile` (tuile du picker), relance avant de conclure à une
régression.

- [ ] **Étape 8 : commit**

```bash
git add js/vues/analyse.js css/analyse.css tests/supabase-etape1.playwright.js
git commit -m "feat(analyse): qui peut affaiblir la cible, et qui le possede"
```

---

## Hors de ce plan

- **Mesurer `d-eew` chez tapscreen** puis retirer le drapeau `horsCalcul`.
  Projet distinct : il touche la formule. Réserve honnête déjà consignée en
  §5.5 de la spec — le rapport signale une anomalie inexpliquée sur le voisin
  `d-elementres`, et si `d-eew` se comporte pareil, la mesure pourrait ne rien
  conclure.
- **Vérifier les treize valeurs en jeu.** Les tests garantissent qu'une phrase
  citée existe, pas qu'elle a été comprise.
- **Réintégrer les deux lignes de défense élémentaire écartées**
  (`derieri_sword2h_skill_q` Feu −20 %, volet *Altération* d'elizabeth Vent
  −30 %). Elles sont déjà lues et chiffrées dans la spec : leur retour ne coûte
  que leur transcription, le jour où la confrérie jouera autre chose que Foudre.
- **`meliodas / Épées doubles`**, laissé dehors pour ambiguïté de portée. À
  trancher en jeu, pas au clavier.
- **L'exhaustivité.** Les 17 couples lus sont ceux qu'un relevé imparfait a
  désignés. La table sera plus complète qu'aujourd'hui ; elle ne sera pas
  complète, et on ne saura pas ce qui manque.
