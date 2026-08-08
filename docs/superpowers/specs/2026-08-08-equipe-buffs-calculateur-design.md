# Buffs d'équipe réels dans le calculateur

**Date :** 2026-08-08
**État :** validé, prêt pour le plan d'implémentation

## Objectif

Sur l'onglet Calculateur, choisir une **équipe déjà enregistrée** et ne voir
que les buffs que cette équipe apporte réellement : ceux de ses membres, venant
de l'arme que chacun a équipée, et — pour les trois buffs qui valent un
pourcentage de l'attaque du support — chiffrés sur son build réel plutôt que sur
un plafond supposé.

## Ce qui existe déjà, et qu'on ne refait pas

Le dépôt porte **un modèle d'équipe complet**, et c'est ce qui rend ce chantier
court. `normalizeTeam` (`js/metier/equipe-modele.js`) borne une équipe à
`TEAM_SIZE = 4` héros, et `normalizeHero` donne à chacun exactement la forme
qu'attend `calculateHeroStats` :

- `char`, `potentiel:{tier}` ;
- `activeWeaponType`, `weapon`, `weaponConfig` ;
- `armor`, dont `LINKED_ARMOR_SLOT` — la tenue gravée — et `armorConfig`, qui
  porte le `passiveLevel` ;
- `jewel`, `jewelConfig`, `rosterBuilds`.

`rosterHeroSnapshot` construit déjà un héros de cette forme depuis une fiche du
roster, et c'est ce que le calculateur consomme aujourd'hui pour le héros
calculé. Un membre d'équipe se donne donc à `calculateHeroStats` sans
conversion.

`EquipesStore` (`js/donnees/equipes-store.js`) lit ces équipes en local et les
reflète dans Supabase quand un membre est connecté.

**Conséquence : aucun sélecteur d'équipe n'est à construire, aucun schéma
serveur à faire évoluer.** Ce qui est mémorisé sur l'appareil, c'est
uniquement *quelle* équipe le calculateur regarde.

## Ce que le membre voit

Au-dessus du bloc des buffs de soutien, un choix d'équipe alimenté par les
équipes existantes, plus une entrée **« Aucune équipe »** qui rend exactement
le comportement actuel — et qui reste le défaut, donc aucun chiffre ne bouge
tant que le membre n'a rien touché.

Une équipe choisie, le bloc des soutiens ne propose plus que les buffs :

1. des personnages **présents dans l'équipe** ;
2. venant de **l'arme que ce membre a réellement équipée** ;
3. compatibles avec l'**élément du build calculé** — règle déjà en place, elle
   ne change pas.

Chaque ligne nomme sa provenance : « Derieri · Épée à 2 mains ». Un coéquipier
sans buff modélisé garde une ligne disant « aucun buff modélisé », plutôt que
de disparaître : le fichier des buffs pose déjà qu'un zéro se lirait comme
« ce buff ne sert à rien », et une absence muette se lirait comme
« ce personnage n'existe pas ».

**Rien n'est coché à la place du membre.** L'équipe décide de ce qui est
*proposé*, jamais de ce qui est *appliqué*. C'est la règle en vigueur sur cette
page, et la raison est de fond : la plupart de ces buffs durent de 5 à 40
secondes et demandent une action du coéquipier, donc les appliquer d'office
annoncerait des dégâts que le membre n'obtient qu'en alignant tout au même
instant.

### Les quatre sièges comptent, y compris le héros calculé

Un héros qui est lui-même un support — calculer Gowther avec Gowther dans
l'équipe — apporte ses propres buffs. Le jeu écrit « tous les héros alliés », et
ces passifs ne sont pas déjà comptés dans ses statistiques : `stats-calcul.js`
déclare `engraving:passive` et `armor:passive` non couverts, donc il n'y a pas
de double comptage.

## Le gain principal : filtrer par arme

Aujourd'hui, cocher Daisy propose ses buffs de **Grimoire et de Baguette en même
temps**, alors qu'elle n'en tient qu'une. Ce n'est pas un cas isolé : sur les
huit supports de la table, six portent des buffs venant de plusieurs armes.

| Support | Armes présentes dans ses buffs |
|---|---|
| daisy | book, wand |
| derieri | axe, sword2h |
| dreydrin | axe, rapier |
| elizabeth | book, staff, wand |
| gowther | book, staff, wand |
| manny | sworddual, staff |

Chaque buff porte `provenance.gameId`, du genre `derieri_sword2h_skill_e`, qui
nomme l'arme. **Ce texte ne doit pas être découpé par position** :
`gil_thunder_lance_jumpatk` piégerait un découpage naïf, le slug contenant déjà
un tiret bas.

La règle retenue va dans l'autre sens, et c'est plus sûr : on ne cherche pas
quelle arme le gameId nomme, on vérifie que le gameId **contient le jeton de
l'arme équipée**. Le roster range les armes par DOSSIER français
(`Epee 2 mains`) et `FOLDER_TO_ENUM` donne l'enum (`Sword2h`) ; le jeton est
cet enum en minuscules, encadré de tirets bas — `_sword2h_`. Rien à deviner,
rien à découper.

Le piège à ne pas manquer : `weaponTypesOf(charId)` rend des **dossiers**, pas
des enums. Passer un dossier au jeton ne trouverait jamais rien.

## Les trois buffs indexés sur l'attaque du support

Trois lignes de la table valent un pourcentage de l'attaque de celui qui les
lance, plafonné. Ce sont exactement les trois entrées portant `unite:"flat"` :

| Support | `id` | Buff | Stat | Aujourd'hui |
|---|---|---|---|---|
| derieri | `derieri-taillade-attaque-feu` | Attaque de Feu, 30 % de son ATK | `Fire_Add` | 3000, le plafond |
| elizabeth | `elizabeth-vague-attaque-vent` | Attaque de Vent, 30 % de son ATK | `Wind_Add` | 3000, le plafond |
| gowther | `gowther-confusion-attaque-foudre` | Attaque de Foudre, 10 % de son ATK | `Thunder_Add` | 3000, le plafond |

La table ne garde que le plafond, donc le pourcentage est perdu. Il faut
l'écrire, sans retirer le plafond qui sert de repli :

```js
valeur:3000,                                // le plafond, et le repli
unite:"flat",
indexeSurAtk:{ taux:3000, plafond:3000 }    // 30 %, en dix-millièmes
```

La valeur devient `min(plafond, taux / 10000 × ATK du support)`.

**Repli.** Sans équipe, ou quand `calculateHeroStats` ne rend pas un statut
exploitable pour ce coéquipier, on retombe sur `valeur` — donc exactement le
chiffre d'aujourd'hui, avec une mention « build incomplet, valeur plafond ».
Rien ne régresse. Un test refusera que `valeur` et `plafond` divergent : sinon
le repli dériverait sans que rien ne le signale.

**Ampleur réelle, dite d'avance.** Un support correctement monté dépasse
rapidement 10 000 d'attaque, et 30 % butent alors sur le plafond. Ce raffinement
corrigera surtout les supports peu montés. Ce n'est pas un gain de chiffres,
c'est un chiffre qui cesse d'être une supposition.

**Hypothèse déclarée, non mesurée.** « 30 % de l'attaque du héros » est lu comme
`B_Atk`, sans l'attaque élémentaire, qui est une statistique distincte. Le
moteur de dégâts, lui, ajoute l'attaque élémentaire à l'ATK pour les composantes
de base `atk` — donc les deux lectures ne coïncident pas, et rien ne dit
laquelle le jeu applique ici. L'hypothèse sera écrite dans le module, à côté du
calcul.

## Découpage

**`js/metier/equipe-buffs.js` — nouveau, pur.**

Entrée : `{ coequipiers, element }`, où chaque coéquipier est réduit à
`{ charId, typeArme, atk }` — `atk` valant `null` quand le build n'est pas
exploitable. Sortie : la liste des buffs applicables, chacun annoté de son
support, de son arme, de sa valeur effective, et d'un drapeau disant si la
valeur est un repli.

Ce module **ne connaît ni le roster, ni Supabase, ni le DOM**. C'est ce qui le
rend testable en node, comme `calculateur-entrees.js` et `degats-calcul.js`.

**`js/vues/calculateur.js` — la corvée d'entrées/sorties.**

Lire les équipes, tenir `etat.equipeId`, dessiner le choix, appeler
`calculateHeroStats` sur chaque membre de l'équipe retenue et en extraire
`B_Atk`, puis passer la liste réduite au module pur. La vue ne calcule aucune
valeur de buff.

**`data/buffs-supports.js`** gagne le champ `indexeSurAtk` sur ses trois lignes
concernées. Le fichier reste écrit à la main, comme son en-tête l'exige.

**Mémorisation.** L'identifiant de l'équipe choisie est retenu sur l'appareil,
au même motif que `js/donnees/calibration-store.js`.

**Ce qui ne bouge pas :** `js/metier/degats-calcul.js`, et la table
`CIBLE_DU_BUFF` de `calculateur-entrees.js` qui range chaque buff dans son
seau. Le moteur ignore que les buffs viennent d'une équipe.

## Tests

`tests/equipe-buffs.test.js` — nouveau, sur le module pur :

- un buff d'une arme non équipée est absent ;
- un buff d'une arme équipée est présent, annoté de son support et de son arme ;
- le filtre par élément continue de s'appliquer par-dessus celui par arme ;
- un coéquipier hors table rend « aucun buff modélisé » plutôt que rien ;
- `indexeSurAtk` : valeur calculée sous le plafond, valeur écrêtée au plafond,
  et repli sur `valeur` quand `atk` vaut `null` ;
- les quatre sièges comptent, le héros calculé compris.

`tests/calculateur-entrees.test.js` — inchangé : sans équipe, la liste des buffs
et les entrées du moteur restent identiques. C'est le test qui garantit qu'aucun
chiffre existant ne bouge.

Garde sur la table des buffs — dans le test de catalogue existant : toute entrée
portant `indexeSurAtk` a un `valeur` égal à son `plafond`.

`tests/calculateur.playwright.js` — choisir une équipe, vérifier que la liste
des soutiens rétrécit et nomme l'arme de provenance, et que revenir à « Aucune
équipe » restaure la liste complète.

## Hors périmètre, et pourquoi

**Les passifs de tenue gravée.** Dix-neuf des soixante-huit tenues buffent
l'équipe, mais la plupart sous condition, et beaucoup sont défensives —
barrières, soins, défense — donc écartées par la règle déjà posée dans
`data/buffs-supports.js`. Il reste une poignée d'offensives modélisables, dont
une sans condition : *Robe de printemps* de Daisy, « +10 % chances crit. de tous
les héros alliés ». Les transcrire, les trier et les chiffrer par niveau de
passif est un chantier de saisie à part entière, qui suivra celui-ci.

Les **statistiques** de la tenue gravée, elles, entrent déjà dans le calcul :
elles deviennent des termes comme n'importe quelle pièce, et alimentent donc
l'ATK du support qui sert aux trois buffs indexés.

**Les buffs restreints à une catégorie de compétence.** Cinq sont connus et
listés dans l'en-tête de `data/buffs-supports.js` — dont les +50 % de dégâts de
compétence normale de Derieri. Le calcul est désormais par compétence, donc
l'obstacle historique est levé, mais les activer est un chantier distinct de
celui-ci : il touche la table des buffs et le seau `bonusCategorie`, pas la
composition d'équipe.

**Les équipes nommées et gérées depuis le calculateur.** On lit les équipes
existantes ; on n'en crée pas, on n'en modifie pas. Le builder est là pour ça.
