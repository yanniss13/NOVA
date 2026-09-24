# J.A.R.V.I.S. — lot 2b : effets, porteurs et règles du jeu

Date : 2026-09-24 · Statut : conception validée en discussion, à relire
Prolonge : `docs/superpowers/specs/2026-09-24-jarvis-monstres-design.md` (lot 2a)

## But

Trois questions de membres, sans réponse aujourd'hui :

- « C'est quoi Pétrification ? » — le glossaire des effets du jeu ;
- « Qui réduit la défense du boss ? » — quels héros posent quel effet, avec
  quelle cible, quelle durée, quel cumul ;
- « Comment marche le Déluge ? » — les règles, dans les mots du jeu.

Critères de réussite :

- `fiche_effet("Éclaboussures")` rend : malus, défense −20 %, 40 s, cumul 1,
  posé par Elizabeth (Grimoire) avec « Canon à eau », **cité** dans la
  description de la compétence ;
- `chercher_effets("défense", nature:"malus")` liste Éclaboussures parmi les
  réductions de défense, avec leurs porteurs ;
- `regle("Déluge")` rend les pages officielles du journal des tutoriels sur
  le Déluge, dont « Déluge élémentaire - Feu ».

Hors lot : les effets posés **par les boss** (aucune table ne relie un
monstre à ses compétences — voir « Suite ») et les passifs d'armes,
d'armures et de potentiels.

## Faits établis sur l'export du 24/09/2026

Tous vérifiés en lisant l'export, aucun supposé :

- `Table/Buff/BuffTable.json` : 5 676 buffs. `Type` vaut `Buff` (3 797),
  `DeBuff` (932), `SystemBuff` (640) ou `SystemDebuff` (307). 1 941 portent
  un `Local_Key` ; ils donnent **549 noms français distincts**, lus dans
  `Localization/Game/fr/Game.json` (`client_language_table`, clés comparées
  sans la casse). La description est dans `Local_Desc`, avec des gabarits
  `{0}`, `{1}`. Certaines clés n'ont pas de texte
  (`Local_Debuff_Fear_Name`…) : ces effets sont écartés.
- Valeurs : `AddAbil_List[].TargetAbil` (code de stat, préfixe
  `EAbilityType::`) et `Value`. Cumul : `StackType.MaxStack`. Cible :
  `ApplyType`, `EApplyType::Team` ou `EApplyType::Hero`.
- **Compétence → effets** : aucun champ de `PC_SkillTable` ne liste ses
  comportements. Le lien est le **nom** : les comportements d'une compétence
  s'appellent comme son identifiant, ou commencent par cet identifiant suivi
  de `_` (`elizabeth_book_skill_q` → `elizabeth_book_skill_q_a`, `…_q_b`).
  Chaque comportement de `Table/Skill/PC_SkillBehaviorTable.json` liste ses
  effets dans `BehaviorDetail_SetBuffTid[]` : `BuffTid` et `BuffTime` en
  **millisecondes** (`40000` = 40 s ; `-1` = sans durée).
- Les identifiants de compétence viennent de `data/wiki-competences.js`,
  public : 487 compétences, 27 héros. **Aucun identifiant n'est le préfixe
  `id_` d'un autre** : le rattachement par préfixe est sans ambiguïté
  aujourd'hui. 81 compétences n'ont aucun comportement (passifs surtout).
- 252 liens compétence → effet nommé, sur 120 effets distincts. Le nom de
  l'effet figure dans la description de la compétence 103 fois ; 149 fois
  non, souvent parce que la prose décrit l'effet avec d'autres mots
  (« augmente l'attaque » pour « Augmentation de l'attaque »).
- Cas de référence : `elizabeth_book_skill_q` (« Canon à eau ») pose
  `302171011` « Éclaboussures » (`I_DefAdd_Rate` −2000, 40 000 ms, cumul 1),
  exactement ce que dit sa description, et `302171012` « Augmentation des
  dégâts de faiblesse » (+1000 sur les 8 `_Weakness_Rate`, 20 000 ms), que
  sa description ne mentionne pas.
- Unités : `7ds-stats/stat-metadata.json` donne `unit` (`flat` ou
  `ten-thousandths`) pour 103 codes ; `7ds-stats/libelles-stats.json` le
  libellé (`court`, sinon `fr`). 27 codes posés par des effets n'ont pas de
  libellé, dont les familles `<Élément>_Weakness_Rate` et
  `<Élément>_Element_Res_Rate`, en dix-millièmes (établi au lot 2a).
- Règles : le journal des tutoriels compte **141 sujets**
  (`local_tutorial_log_subtitle_<sujet>`), chacun avec ses pages
  `local_tutorial_log_pagedesc_<sujet>NN`. S'y ajoutent les fenêtres
  `local_ui_popuptutorial_*` (titre `…_title`, textes) et les astuces
  `ui_loadingtip_desc_*`.

## Architecture

Même chaîne que le lot 2a :

```
export local ──► outils/fabrication/extraire-mecaniques.js
                   └─ construireCatalogueMecaniques(entree)   (pur, testé)
              ──► output/jarvis/mecaniques.json   (ignoré par git)
              ──► dépôt manuel dans le bucket privé jarvis-prive
Edge Function ──► lecteur de stockage commun (cache, délai, validation)
              ──► outils fiche_effet, chercher_effets, regle
```

### Extraction — `outils/fabrication/mecaniques-jarvis.js`

`construireCatalogueMecaniques(entree)` est pur : `entree` porte les tables
déjà lues (`buffs`, `comportements`, `textes`, `competences` du wiki,
`personnages` de `data/connaissances-discord.json`, `libelles`, `unites`,
`genereLe`, `dateExport`).
`extraire-mecaniques.js` lit `DONNEES_JEU` et les fichiers du dépôt, puis
écrit le JSON. Aucun chemin personnel dans le dépôt.

Sortie :

```js
{
  version: 1, genereLe, dateExport,
  effets: [{
    nom: "Éclaboussures",
    nature: "malus",            // "buff" | "malus" | "controle"
    description: "Réduit la défense de X",
    variantes: [{
      valeurs: [{ stat: "Augmentation de la défense", valeur: "-20 %" }],
      duree: 40,                // secondes ; absente si sans durée
      cumulMax: 1,
      cible: "ennemi",          // "equipe" | "porteur" | "ennemi"
      posePar: [{ heros: "Elizabeth", arme: "Grimoire",
                  competence: "Canon à eau", categorie: "ACTIVE_THIRD",
                  citeParDescription: true }]
    }]
  }],
  regles: [{ sujet: "Déluge élémentaire - Feu", pages: ["…", "…"] }]
}
```

Règles d'extraction :

- **Nature**, dans cet ordre : `DetailType` `StateCC` ou `Type`
  `SystemDebuff` → `controle` ; `DeBuff` → `malus` ; `Buff`/`SystemBuff` →
  `buff`. Un effet sans nom
  français est écarté, quelle que soit sa nature.
- **Cible** : buff `Team` → `equipe`, buff `Hero` → `porteur`, malus et
  contrôle → `ennemi`. `Team` sur un malus n'est pas interprété : son sens
  n'est pas établi.
- **Description** : balises de couleur retirées, `{n}` remplacés par « X ».
- **Valeurs** : une entrée par `AddAbil_List` dont la stat n'est pas `None`
  et la valeur non nulle. Libellé : `libelles[code].court || .fr` ; sinon,
  pour les familles élémentaires, « Dégâts de faiblesse <élément> » et
  « Résistance élémentaire <élément> » ; sinon le code lui-même. Unité :
  `unites[code]`, familles élémentaires en dix-millièmes ; en dix-millièmes
  la valeur s'écrit en % signé (`-2000` → `-20 %`) ; en `flat` elle s'écrit
  signée telle quelle ; unité inconnue → valeur brute suivie de
  « (valeur brute) ».
- **Variantes** : deux buffs de même nom forment une seule variante si leurs
  valeurs, durée, cumul et cible sont identiques ; leurs `posePar` sont
  fusionnés sans doublon. Une même compétence qui pose deux fois le même
  buff (comportements `_a` et `_b`) n'apparaît qu'une fois.
- **Porteurs** : pour chaque compétence du wiki, ses comportements sont ceux
  dont le nom vaut l'identifiant ou commence par l'identifiant suivi de `_`.
  Si un comportement correspond à plusieurs identifiants, **le plus long
  gagne** (garde-fou pour un futur préfixe ; aucun cas aujourd'hui). Le nom
  du héros et le libellé de l'arme viennent de
  `connaissances-discord.json` : `personnages[slug].nom`, et l'entrée de
  `armes` dont le `type` vaut le `weaponType` de la compétence (Elizabeth :
  `Book` → Grimoire, `Staff` → Bâton, `Wand` → Baguette). Un type introuvable
  laisse le `weaponType` brut.
  `citeParDescription` : le nom de l'effet figure dans la description de la
  compétence, comparé sans casse ni accents.
- Un effet nommé sans aucun porteur reste dans le glossaire : il répond à
  « c'est quoi Gel ? ».
- **Règles** : un sujet par `local_tutorial_log_subtitle_<s>`, pages
  `local_tutorial_log_pagedesc_<s>NN` dans l'ordre numérique, balises
  retirées ; un sujet sans page est écarté. Les fenêtres
  `local_ui_popuptutorial_*` forment des sujets à part (titre + textes), et
  les astuces de chargement un sujet « Astuces de chargement ».
- Tri : effets et sujets par nom, `localeCompare("fr")`.

### Lecture — lecteur de stockage commun

`creerLecteurMonstresJarvis` devient `creerLecteurStockageJarvis({ fetch,
url, cle, chemin, valider, horloge, journaliser })`, dans son propre module
`_shared/discord-jarvis-stockage.js`. Il garde tout le comportement du lot
2a : cache 1 h après un succès, 1 min après un échec, délai de 5 s, lecture
partagée entre questions simultanées, fichier refusé en entier si
`valider` échoue, journal `stockage-<fichier>`. Les monstres l'appellent
avec `CHEMIN_MONSTRES_JARVIS` et `catalogueMonstreValide` ; les mécaniques
avec `CHEMIN_MECANIQUES_JARVIS = "jarvis-prive/mecaniques.json"` et
`catalogueMecaniquesValide`. Un seul nom pour ce lecteur : l'ancien
disparaît partout, sans alias.

`catalogueMecaniquesValide` exige `version === 1`, deux tableaux, et pour
chaque effet un `nom` non vide, une `nature` connue, des `variantes` en
tableau ; pour chaque sujet un `sujet` non vide et des `pages` en tableau
de chaînes.

### Outils — `_shared/discord-jarvis-mecaniques.js`

Déclarations ajoutées à celles de Gemini, comme `DECLARATIONS_OUTILS_MONSTRES`.
Recherche sans casse ni accents, départage exact → début → contient.

- `fiche_effet({ nom })` : l'effet trouvé, ses variantes (au plus 6) et leurs
  porteurs (au plus 10 par variante), plus `autresCorrespondances` (au plus
  5 noms). Aucun résultat : `{ erreur: "aucun effet de ce nom" }`.
- `chercher_effets({ texte, nature?, heros? })` : cherche `texte` dans le
  nom, la description et les libellés de stat, avec les synonymes
  d'éléments du lot 2a (`SYNONYMES_ELEMENTS_MONSTRE`, exporté pour
  l'occasion). `nature` filtre ; `heros` ne garde que les variantes posées
  par ce héros. Rend au plus 12 effets, chacun avec sa nature, sa
  description et ses porteurs résumés. Les effets qui ont un porteur
  passent devant.
- `regle({ sujet })` : les sujets trouvés (au plus 3), pages bornées à
  1 500 caractères par sujet. Aucun résultat : la liste de 20 sujets
  proches par mot commun, sinon une erreur.

Chaque réponse porte `source: "export du jeu du <dateExport>"`. Fichier
indisponible : `{ erreur: "données des mécaniques indisponibles" }`, sans
faire échouer la question.

### Consigne

Trois phrases ajoutées à la consigne de J.A.R.V.I.S. :

- pour un chiffre, la description de la compétence prime ; les valeurs des
  tables la complètent ;
- `citeParDescription:false` se dit « le nom de cet effet n'apparaît pas
  dans la description de la compétence : elle le décrit peut-être
  autrement, ou il dépend d'une condition » — jamais « caché » ni
  « secret » ;
- les règles se citent comme des textes du jeu, sans extrapoler.

### Branchement

`index.ts` importe le module mécaniques après le module stockage, crée
`lireMecaniquesJarvis` paresseux comme `lireMonstresJarvis`, et le passe à
`creerOutilsJarvis`. `tests/edge-modules.test.js` passe à 14 modules.
Documentation : `docs/discord-planning.md` (section `/jarvis`), `AGENTS.md`
(ligne du lot), `outils/fabrication/LISEZMOI.md`.

## Tests

- `tests/mecaniques-jarvis.test.js` sur un mini-export écrit dans le test :
  Éclaboussures (cité, −20 %, 40 s, cumul 1, cible ennemi) ; l'effet de
  faiblesse non cité (8 valeurs élémentaires, libellés de famille) ; un
  buff d'équipe et un buff du porteur ; un effet sans texte écarté ; deux
  comportements `_a`/`_b` qui posent le même buff → un seul porteur ; deux
  identifiants dont l'un prolonge l'autre → le plus long gagne ; une stat
  sans unité → « (valeur brute) » ; un sujet de règle à deux pages dans
  l'ordre, un sujet sans page écarté.
- `tests/discord-jarvis-mecaniques.test.js` : les trois outils, les bornes,
  les synonymes, le filtre `heros`, le fichier indisponible.
- `tests/jarvis-stockage.test.js` : le lecteur commun, pour les deux
  fichiers (cache, échec, délai, lecture partagée, validation).
- `tests/discord-planning.test.js` et `tests/edge-modules.test.js` : le
  branchement.

## Suite

Recherche séparée : les effets posés par les boss. `Mon_SkillTable`
(2 573 compétences) est préfixé par un identifiant d'acteur, mais Akumu
(`50700109`) n'y a aucune ligne et son acteur ne cite aucune compétence ;
le lien passe probablement par des fichiers d'IA qui ne sont pas des
tables. Si la recherche le trouve, les effets rejoignent les fiches de
monstres du lot 2a.
