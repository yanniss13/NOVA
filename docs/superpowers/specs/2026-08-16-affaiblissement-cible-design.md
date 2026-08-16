# Conception — recenser qui affaiblit la cible

Date : 2026-08-16
Demande : « j'ai un recensement des DPS, tu pourrais faire pareil avec tous les
personnages support, ceux qui mettent des malus de défense aussi, par exemple
Escanor lumière serait pris en compte ».

---

## 1. Pourquoi

L'onglet Analyse recense les DPS de la confrérie : qui les possède, à quel
potentiel, pour quel élément. Rien ne dit en revanche **qui peut affaiblir le
boss**, alors que c'est la seconde moitié d'une composition.

La demande nomme un cas qui décide de toute la conception : *Escanor lumière*.
Son épée à deux mains porte le rôle de slot `Attacker`, pas `Supporter`. Un
recensement fondé sur le rôle ne le verrait jamais — et c'est précisément lui
qu'on veut voir.

Le rôle de slot dit ce qu'un personnage **est**. Cette section doit dire ce
qu'il **fait**.

---

## 2. Décisions du propriétaire

Prises pendant le cadrage, elles ferment des questions et ne se rouvrent pas
sans raison :

1. **Étendre les données d'abord**, puis bâtir le recensement dessus. Le
   recensement ne vaut que ce que la table sait.
2. **Périmètre transcrit : les malus de défense ET la vulnérabilité**
   (`effet:"vulnerabiliteGlobale"`, « augmente les dégâts subis »). Pas le
   reste du kit de support — ni soins, ni bonus aux alliés — pour les
   personnages ajoutés.
3. **Quatre dimensions par ligne** : qui le possède dans la confrérie et à quel
   potentiel, l'effet chiffré, l'arme concernée, l'élément visé.
4. **Aucune défense élémentaire hors Foudre.** La confrérie mène ses runs de
   Boss de Guilde avec des Merlin Foudre : un malus de défense de Feu ou de
   Vent ne sert aucune de ses compositions. Détail des lignes écartées et de ce
   que ce choix coûte en 5.4.
5. **La résistance élémentaire est consignée, pas calculée.** Elle entre dans
   la table avec un drapeau `horsCalcul`, apparaît dans le recensement et
   n'atteint jamais la formule. Mesurer d'abord aurait retardé le recensement
   de plusieurs jours. Voir 5.5.

---

## 3. Ce qui est acquis et ne bouge pas

- `data/buffs-supports.js` garde sa forme actuelle, à **une** exception près :
  le drapeau `horsCalcul` de la décision 5. Tout le reste — `cible`, `effet`,
  `parCumul`, `cumuls`, `provenance` — est inchangé, et les tests existants
  couvrent les nouvelles lignes sans modification.
- La règle « une entrée porte un `stat` OU un `effet`, jamais les deux »
  reste, et son test aussi.
- `provenance.gameId` + `provenance.phrase` restent obligatoires. Le test
  vérifie que la phrase est un extrait **littéral** de la description du
  gameId.
- Le recensement des DPS n'est pas touché. La nouvelle section vit à côté.

---

## 4. Le nom de la section

**« Affaiblissement de la cible »**, et non « Supports ».

Meliodas et Escanor posent des malus de défense en étant des DPS purs. Les
ranger sous « Supports » ferait mentir la section sur ce que le membre y
trouve. Ce qui rassemble réellement ces lignes, c'est l'effet — faire encaisser
davantage au boss — pas le rôle du porteur.

---

## 5. Volet données

### 5.1 Périmètre chiffré — établi par lecture, non par relevé

Un premier relevé par expressions régulières annonçait 19 personnages et ~33
lignes. **Il était faux dans les deux sens**, et la lecture intégrale des 17
couples candidats l'a corrigé :

- il comptait « réduit les dégâts subis de 20 % » — un bonus **défensif sur le
  porteur** — comme un malus sur l'ennemi. 21 phrases écartées à ce titre ;
- il ne pouvait pas voir la **portée** d'un effet, parce que la restriction
  vit souvent dans une autre phrase que l'effet. Chez Meliodas : « réduit la
  résistance crit. *contre les attaques de Meliodas* de 3 %. Réduit **en
  outre** la défense crit. de 50 % … » — la phrase qui porte « défense » ne
  porte pas la restriction.

**Aucun relevé automatique ne peut donc établir ce périmètre.** Les 17 couples
ont été lus en entier, un par un.

### 5.2 Les neuf lignes retenues

| Personnage / arme | Effet | Valeur | État source |
|---|---|---|---|
| drake / Bâton | `defenseCritique` | −8 % × 5 = 40 % | Courant électrique |
| elizabeth / Bâton | `defenseCritique` | −0,8 % × 50 = 40 % | Rupture |
| escanor / Épée 2 mains | `defense` | −0,15 % × 100 = 15 % | Inflammation |
| gowther / Baguette | `defense` (Foudre) | −6 % × 4 = 24 % | Salve de flèches |
| guila / Rapière | `defense` | −0,15 % × 100 = 15 % | Inflammation |
| king / Grimoire | `vulnerabiliteGlobale` | +2 % × 10 = 20 % | Marque de la forêt |
| klotho / Bâton | `defenseCritique` | −10 % | Érosion dimensionnelle |
| slader / Hache | `vulnerabiliteGlobale` | +25 % | Blessure profonde |
| tioreh / Baguette | `defense` | −0,15 % × 100 = 15 % | Inflammation |

Escanor, Guila et Tioreh partagent le **même état Inflammation**, aux mêmes
valeurs : une cohérence qui conforte la lecture.

Le schéma actuel suffit : `parCumul` + `cumuls` + `valeur` expriment déjà les
effets cumulatifs, et `provenance.phraseCumuls` ancre le plafond. Aucune
modification de format.

### 5.3 Déjà couverts, rien à faire

daisy/Grimoire, dreydrin/Hache, elizabeth/Grimoire, gowther/Grimoire,
manny/Épées doubles.

### 5.4 Écartés, et pourquoi — à ne pas rajouter par erreur

- **Défense élémentaire autre que la Foudre.** Décision du propriétaire : la
  confrérie mène ses runs de Boss de Guilde avec des Merlin Foudre, donc un
  malus de défense de Feu ou de Vent ne sert aucune de ses compositions. Sont
  écartés à ce titre : **derieri / Épée 2 mains** (défense de Feu −20 %) et le
  volet *Altération* d'**elizabeth / Bâton** (défense de Vent −30 %). Seul
  gowther / Baguette reste, sa cible étant la Foudre.
  ⚠️ Ce choix fige la méta du moment dans les données, et prive le calculateur
  d'options pour une équipe Feu ou Vent. Les deux lignes sont déjà lues et
  chiffrées ci-dessus : les réintégrer ne coûte que leur transcription.
- **meliodas / Épées doubles** : ambiguïté de portée décrite en 5.1. « En
  outre » rattache la réduction de défense crit. à une phrase restreinte
  « contre les attaques de Meliodas ». Attribuer au groupe un bonus qui ne
  profite peut-être qu'au porteur serait pire que l'omettre. À vérifier en jeu.
Les réductions de **résistance élémentaire** ne sont pas écartées : elles
entrent par une autre porte, décrite en 5.5.

### 5.5 La résistance élémentaire — consignée, hors calcul

**Ce n'est pas une bizarrerie de Drake : 14 personnages réduisent la résistance
élémentaire.** C'est une mécanique entière, et elle pèse lourd — Akumu porte
30 % de résistance, que la formule traduit en facteur ×0,70. Retirer 15 points
le porterait à ×0,85, **+21 % de dégâts**.

Le moteur connaît déjà `resistanceElementaire` sur la cible, mais **rien ne la
réduit** : il n'existe pas de `reductionResistanceElementaire`. Y brancher ces
lignes modifierait la formule.

Or `d-eew`, le champ correspondant chez l'outil de référence, **n'a jamais été
mesuré** par `RAPPORT-analyse-tapscreen.md`. On ignore s'il se retranche en
points ou en pourcentage, et comment il se compose. Ajouter un terme non mesuré
à la formule est précisément ce que ce dépôt refuse.

D'où le drapeau. Une ligne `horsCalcul:true` est **vraie, sourcée et
inexploitable par le moteur** : le recensement l'affiche pour composer un
groupe, `buffsApplicables` l'ignore, et aucune case à cocher mensongère
n'apparaît dans le calculateur. Précédent maison : `uncovered` dans
`stats-calcul.js`, qui garde les passifs en prose connus mais hors des nombres.

Même filtre Foudre que la décision 4 — quatre lignes, toutes à −15 % :

| Personnage / arme | Déclencheur | gameId |
|---|---|---|
| drake / Bâton | état Paralysie, exige Électrocution | `drake_staff_skill_rmb` |
| gil-thunder / Lance | état Paralysie, exige Électrocution | `gil_thunder_lance_skill_rmb` |
| gil-thunder / Bouclier | retrait de la barrière de Foudre, 30 s | `gilthunder_shield_passive` |
| gil-thunder / Épée 1 main | activation du Déluge de Foudre, 20 s | `gilthunder_sword1h_passive` |

⚠️ Les identifiants de Gil Thunder s'écrivent **tantôt `gil_thunder_`, tantôt
`gilthunder_`**. La règle du jeton `_<enum>_` de `vientDeLArme` les couvre
toutes les trois ; un découpage par position n'y survivrait pas.

**Suite prévue, hors de ce périmètre** : mesurer `d-eew` chez tapscreen selon
la méthode déjà éprouvée, puis retirer le drapeau sans retoucher les données.
Réserve honnête : le rapport signale une anomalie inexpliquée sur le voisin
`d-elementres`, qui se comporte différemment sur un vrai boss et sur le
mannequin. Si `d-eew` fait de même, la mesure pourrait ne rien conclure.

### 5.6 Les deux limites qui subsistent

**L'exhaustivité n'est pas atteinte.** Les 17 couples lus sont ceux qu'un
relevé imparfait a désignés. Un effet dont la formulation échappe à toutes mes
expressions — et le commentaire en tête de la table prévient qu'ils se cachent
volontiers dans la définition d'un état — n'a jamais été présenté à la lecture.
La table sera plus complète qu'aujourd'hui ; elle ne sera pas complète, et on
ne saura pas ce qui manque.

**La transcription lit des phrases, elle ne joue pas au jeu.** Une valeur mal
interprétée passe les tests sans broncher : le test vérifie que la phrase citée
existe, pas qu'elle a été comprise. Les valeurs restent donc à vérifier en jeu,
comme les trois hypothèses de formule déjà signalées dans AGENTS.md.

### 5.7 Effet de bord, et il est bienvenu

`js/metier/equipe-buffs.js` lit cette table pour alimenter le calculateur. Les
33 nouvelles lignes y apparaîtront comme autant de **cases à cocher**
supplémentaires, filtrées par l'arme réellement équipée du coéquipier.

Aucun calcul existant ne change en silence : les buffs sont opt-in, décochés par
défaut. Le calculateur gagne des options, il n'en réécrit aucune.

---

## 6. Volet Analyse

### 6.1 Emplacement

Une section dans `js/vues/analyse.js`, **après** la couverture élémentaire et
**avant** le classement par potentiel. La couverture pose le décor, cette
section dit qui peut l'exploiter.

### 6.2 Ce qu'une ligne montre

Une ligne par couple *personnage + effet*, portant :

- **le personnage et l'arme** qui porte l'effet — un support ne débuffe souvent
  qu'avec une arme précise, et l'omettre rendrait la ligne trompeuse ;
- **l'effet chiffré**, repris du `libelle` de la table, déjà rédigé en
  français : « Défense de l'ennemi −30 % » ;
- **l'élément visé** quand l'effet en cible un (`element` non nul), sinon la
  mention qu'il vaut pour tous ;
- **les membres qui le possèdent**, avec leur potentiel, comme le classement
  DPS. Un effet que personne ne possède reste affiché, en grisé : savoir qu'il
  manque à la confrérie est une information.

### 6.3 Source de la possession

Les rosters déjà agrégés par `rosterPlayerFrom`. Un membre possède l'effet s'il
a le personnage **et** l'arme qui le porte dans ses `builds`. La correspondance
arme ↔ effet se lit sur `provenance.gameId`, avec la même règle de jeton que
`vientDeLArme` dans `equipe-buffs.js` — pas un découpage par position, qui
casserait sur `gil_thunder_lance_jumpatk`.

### 6.4 Contrainte de couches

`analyse.js` est déclaré après `metier/` dans `tests/helpers/modules.js` : il
peut donc importer la logique de correspondance. Si `vientDeLArme` doit être
partagé, il remonte dans `metier/equipe-buffs.js` et s'exporte — jamais
l'inverse, et jamais recopié.

---

## 7. Tests

- **Table** : les tests existants de `buffs-supports.js` couvrent les nouvelles
  lignes sans modification. Ils exigent phrase littérale, forme unique
  (`stat` xor `effet`), et unité déclarée.
- **Recensement** : un test unitaire, sur le modèle de
  `tests/analyse-elements.test.js`, vérifiant que
  - un personnage à malus apparaît **quel que soit son rôle de slot** — le cas
    Escanor, qui est la raison d'être de la section ;
  - un personnage à slot Soutien **sans** malus mesuré n'y figure pas ;
  - l'arme affichée est celle du `gameId`, pas la première du personnage ;
  - un effet que personne ne possède reste listé.
- **`horsCalcul`** : deux gardes, et la seconde est la plus importante —
  - la ligne apparaît bien dans le recensement ;
  - **`buffsApplicables` ne la rend jamais.** Sans ce test, une ligne
    consignée finirait un jour en case à cocher du calculateur, et le membre
    croirait son effet compté dans les dégâts.
- **Jeton d'arme** : `gil_thunder_lance_skill_rmb` et
  `gilthunder_shield_passive` doivent tous deux se rattacher à leur arme. Les
  deux orthographes du même personnage sont le piège que
  `vientDeLArme` existe pour éviter.
- **Parcours** : une assertion dans le Playwright de l'Analyse, si un membre
  connecté y est déjà mis en scène.

---

## 8. Hors périmètre

- Le reste du kit des personnages ajoutés : soins, bonus aux alliés,
  résistance critique. Décision 2 du propriétaire.
- Toute vérification en jeu des valeurs transcrites.
- Le classement DPS, inchangé.
- Une refonte de `buffs-supports.js` : on ajoute des lignes, on ne remanie pas.
