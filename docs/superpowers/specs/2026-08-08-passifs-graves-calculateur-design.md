# Passifs de tenue gravée dans le calculateur

**Date :** 2026-08-08
**État :** validé, prêt pour le plan d'implémentation

## Objectif

Faire entrer dans le calcul les **passifs de tenue gravée** — ceux du héros
calculé comme ceux de ses coéquipiers — et remplacer le choix d'équipe par une
**composition libre depuis le roster, un personnage à la fois**.

## Ce que les 68 tenues contiennent

Dépouillement complet de `engravedByFile` dans `data/stats-build.js`. Les
soixante-huit portent un passif ; aucune n'en est dépourvue.

| | |
|---|---|
| **14** | offensifs, buffant l'**équipe** (« tous les héros alliés ») |
| **26** | offensifs, buffant le **porteur** |
| **28** | hors modèle : barrières, soins, recharges, jauges, déplacement |

Les vingt-huit derniers sont écartés par la règle déjà écrite en tête de
`data/buffs-supports.js` : sans conversion offensive, ils ne changent aucun
dégât, et les chiffrer à zéro se lirait comme « ce buff ne sert à rien ».

Trois faits rendent le chantier faisable :

- **Les valeurs montent par niveau** (Meliodas : 50 / 65 / 80 %), et le build
  stocke le niveau dans `armorConfig["Armure liee"].passiveLevel`.
  `gearPassiveStatus` distingue `valid` de `missing`.
- **Le texte source est local.** `passiveLevels[].textFr` vit dans
  `stats-build.js`, niveau par niveau — la provenance se vérifie sans aller
  chercher un autre fichier, contrairement à `buffs-supports.js`.
- **Tous les effets visés tombent dans des seaux existants** : taux et dégâts
  critiques, attaque et dégâts élémentaires, attaque en pourcentage, les cinq
  bonus de catégorie, et les deux malus sur la cible.

## Le choix des coéquipiers change de forme

Le calculateur choisit aujourd'hui une **équipe enregistrée**. C'est trop
rigide : tester « et si je mettais Derieri à la place ? » oblige à aller
composer une équipe dans le builder.

À la place, **trois emplacements**, chacun un choix unique listant tous les
builds du roster :

```
Coéquipier 1  [ — · Daisy · Grimoire · Daisy · Baguette · Derieri · Épée 2 mains · … ]
Coéquipier 2  [ — ]
Coéquipier 3  [ — ]
```

Le couple **personnage + arme** est un seul choix, pas deux. C'est le bon
grain : l'arme décide quels buffs le coéquipier apporte — Daisy au Grimoire et
Daisy à la Baguette n'en donnent pas les mêmes.

Trois emplacements parce que le héros calculé occupe le quatrième siège. Vides
par défaut, donc aucun chiffre ne bouge tant que le membre n'y touche pas.

**Un même personnage ne peut pas occuper deux emplacements** : le jeu ne le
permet pas, et ses buffs se cumuleraient à tort. Le choisir dans un second
emplacement le retire du premier.

`js/metier/equipe-buffs.js` **n'est pas touché** : il reçoit déjà
`{ charId, typeArme, atk }`, et seule la source change. `EquipesStore` sort du
calculateur.

Le remplacement fait partie de CE chantier et non d'un suivant : laisser le
sélecteur d'équipe en place livrerait deux façons concurrentes de désigner ses
coéquipiers.

## La table des passifs

Fichier neuf, `data/passifs-graves.js`, **écrit et maintenu à la main** comme
`buffs-supports.js`, rangé par fichier de tenue — la clé de `engravedByFile`.

```js
"7ds-armures-ssr/Armure liee/Défense simple.webp":[
  {
    id:"meliodas-defense-simple-competence-normale",
    libelle:"Libération infernale reçue : compétence normale +80 %",
    cible:"soi",
    stat:"Normalskill_Damadd_Rate",
    operation:"add",
    unite:"ten-thousandths",
    niveaux:[5000, 6500, 8000],
    element:null,
    provenance:{ phrase:"augmente les dégâts de compétence normale de " }
  }
]
```

Une entrée porte `stat` OU `effet` — jamais les deux — exactement comme dans
`buffs-supports.js`, et pour la même raison : sans cette exclusion, une ligne
mal écrite tomberait dans la branche permissive et passerait.

### La garde, et pourquoi elle est plus forte qu'ailleurs

**La phrase est choisie pour que le nombre qui la suit immédiatement SOIT la
valeur stockée.**

Le test lit alors les trois niveaux dans `stats-build.js` et vérifie, pour
chacun, que la phrase en est un extrait **littéral**, et que `niveaux[i]` est
bien le nombre qui la suit dans le texte du niveau *i+1*.

C'est ce qui protège du piège propre à ces passifs : ils portent deux ou trois
effets chacun, avec autant de nombres, et rien d'autre n'empêcherait d'attribuer
la valeur d'un effet à un autre. Une erreur y serait **muette** — aucun test ne
casse, seuls les dégâts sont faux.

Les valeurs à cumuls s'écrivent de même. Pour « +5 % par coup **(Max : 30 %)** »,
la phrase pointe `"(Max : "` et la valeur vaut 30 : le transcripteur est forcé
de désigner le nombre exact au lieu de le déduire. C'est la convention « max
atteignable » déjà retenue pour `buffs-supports.js`.

## Qui reçoit quoi

`cible` vaut `"soi"` ou `"allies"`, lu dans le texte : `"allies"` quand il dit
« tous les héros alliés ».

| Porteur de la tenue | Passifs `soi` | Passifs `allies` |
|---|:---:|:---:|
| **Le héros calculé** | oui | oui |
| **Un coéquipier** | non | oui |

Le héros reçoit les deux : un passif « alliés » dit *tous* les héros alliés, et
il en fait partie — même raisonnement que pour les quatre sièges de
`equipe-buffs.js`. Le passif « soi » d'un coéquipier ne le concerne pas.

Le filtre par élément du build s'applique par-dessus, comme pour les buffs de
soutien.

## Le niveau, et son repli

Le niveau vient de `armorConfig["Armure liee"].passiveLevel`, via
`gearPassiveStatus`. Quand il vaut `missing`, on retient `niveaux[0]` — le
**plancher** — et la vue l'écrit : « niveau de passif non renseigné ».

Le plancher, pas le plafond : le chiffre affiché ne peut alors qu'être
sous-estimé, jamais flatté, et la mention pousse à renseigner le niveau pour
gagner le vrai chiffre. C'est un choix DIFFÉRENT de celui retenu pour les buffs
indexés sur l'ATK, où le plafond servait de repli — là il fallait ne pas
régresser par rapport à un chiffre déjà affiché ; ici rien n'existe encore.

## Les bonus de catégorie ne passent pas par le même chemin

Les buffs cochés traversent `entreesDuCalcul`, qui range chaque code de stat
dans un seau via `CIBLE_DU_BUFF`. Les cinq stats de catégorie n'y sont pas, et
ne peuvent pas y être : leur seau, `bonusCategorie`, s'applique **compétence par
compétence**, pas une fois pour toutes.

Il faut donc une seconde sortie : une fonction pure
`bonusCategorieDesBuffs(coches)` dans `js/metier/calculateur-entrees.js`, qui
rend `{ NORMAL_SKILL: 8000, … }` à fusionner avec les bonus venus du build.
`STAT_DE_LA_CATEGORIE` s'y inverse — la correspondance existe déjà, elle n'est
pas à inventer.

Ce n'est pas un détour : c'est ce qui fait atterrir les +80 % de Meliodas sur la
compétence normale **et sur elle seule**. Les verser dans le seau global les
appliquerait à son ultime, qui n'y a pas droit.

## Découpage

**`data/passifs-graves.js`** — la table, à la main.

**`js/metier/passifs-graves.js`** — pur. Reçoit `{ porteurs, element }` où
chaque porteur vaut `{ charId, tenue, niveau, estLeHeros }` : `tenue` est le
fichier de la tenue gravée équipée, `niveau` vaut 1, 2, 3 **ou `null`** quand le
build ne le renseigne pas, et `estLeHeros` distingue le héros calculé de ses
coéquipiers. Rend les lignes applicables, chacune avec sa valeur déjà résolue
pour le niveau et un drapeau `niveauInconnu`. Ni DOM, ni réseau, ni roster.

**`js/metier/calculateur-entrees.js`** — `bonusCategorieDesBuffs` en plus.

**`js/vues/calculateur.js`** — les trois emplacements, la lecture de la tenue et
de son niveau, la section « Tenues gravées », la fusion des bonus de catégorie.

**`js/donnees/equipe-choisie-store.js` → `coequipiers-store.js`** — il retenait
un identifiant d'équipe, il retiendra trois couples `{ charId, typeArme }`.
L'ancienne clé de stockage devient morte, sans conséquence : elle ne portait
qu'un réglage d'écran, et le store ignore ce qu'il ne sait pas relire.

**Une section à part à l'écran**, « Tenues gravées », distincte des
« Soutiens » — qui restent les buffs venus des *compétences*. Des cases à
cocher, parce que ces passifs sont presque tous conditionnels. Chaque bloc porte
le nom du héros et de sa tenue.

## Tests

`tests/passifs-graves.test.js` — la garde de la table et le module pur :

- pour chaque entrée et chacun des trois niveaux, la phrase est un extrait
  littéral du `textFr` de ce niveau, et `niveaux[i]` est le nombre qui la suit ;
- chaque entrée porte `stat` OU `effet`, et un code de stat connu du dépôt ;
- **aucune entrée n'est inerte** : cochée, elle doit changer soit une entrée du
  moteur, soit un bonus de catégorie. C'est le filet qui a déjà attrapé des
  codes inventés dans `buffs-supports.js`, mais il doit ici accepter les DEUX
  sorties : un buff de catégorie ne touche justement aucune entrée du moteur,
  et le filet d'origine le rejetterait à tort ;
- un passif `soi` d'un coéquipier n'atteint pas le héros ; un passif `allies`
  oui, quel que soit le porteur ;
- niveau connu : la valeur du niveau ; niveau inconnu : `niveaux[0]`, drapeau
  levé.

`tests/calculateur-entrees.test.js` — `bonusCategorieDesBuffs` : un buff de
catégorie atterrit dans sa seule catégorie, un buff ordinaire n'y met rien, et
deux buffs de la même catégorie s'additionnent.

`tests/equipe-buffs.test.js` — inchangé. Le module ne bouge pas.

`tests/calculateur.playwright.js` — remplir un emplacement de coéquipier réduit
la liste des soutiens ; le vider la restaure ; la section des tenues gravées
apparaît et ses cases sont décochées par défaut.

## Hors périmètre

- **Les 14 passifs `allies`.** La machinerie est bâtie pour eux dès ce
  chantier — `cible` les distingue déjà — mais la table ne les porte pas encore.
  Les ajouter sera une pure transcription, sans code.
- **Les 28 passifs hors modèle.** Barrières, soins, recharges et jauges ne
  changent aucun dégât.
- **Les cinq buffs de soutien restreints à une catégorie**, listés dans l'en-tête
  de `data/buffs-supports.js` — dont les +50 % de compétence normale de Derieri.
  `bonusCategorieDesBuffs` les débloque techniquement ; les activer reste cinq
  lignes à écrire dans un autre fichier, et sera fait à part pour que ce chantier
  n'ait qu'une seule table à relire.
- **Les passifs d'arme et d'armure ordinaire**, toujours déclarés non couverts
  par `stats-calcul.js`.
