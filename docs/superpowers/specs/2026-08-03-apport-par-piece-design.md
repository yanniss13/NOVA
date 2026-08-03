# Conception — l'apport de chaque pièce sous la pièce elle-même

**Date :** 2026-08-03
**État :** conception validée par le propriétaire du projet.
**Origine :** demande remontée par un membre de la confrérie.

Citation de la demande : *« ça serait bien d'avoir les stats par équipement sous
l'équipement concerné, et quand même laisser le détail plus bas pour ceux que ça
intéresse »*.

---

## 1. Objectif

Dans les modales qui affichent la fiche d'un héros, faire apparaître sous chaque
pièce d'équipement un résumé de ce qu'elle apporte, dépliable vers le détail
complet. Le bloc « Statistiques du héros » existant reste en place, inchangé, en
bas de la fiche.

## 2. Décisions du propriétaire

Quatre questions lui ont été posées avec leurs compromis. Ses réponses sont des
décisions, pas des préférences à re-litiger.

1. **Densité : résumé compact, dépliable.** Une ligne toujours visible sous la
   pièce, le détail complet au clic. Les alternatives écartées étaient « les trois
   stats principales sans dépliage » et « le détail complet replié, rien de
   visible ».
2. **Contenu : les apports les plus forts de la pièce, pas des stats fixes.** Une
   armure remonte ses PV, un bijou son critique. L'option « toujours PV · ATK ·
   DEF » a été écartée parce qu'un bijou y afficherait « PV +0 » alors qu'il donne
   12 % de critique.
3. **Pièce non configurée : mention discrète, cliquable si le visiteur en a le
   droit.** « À configurer → » ouvre l'éditeur sur son propre build ; sur le build
   d'un autre membre, c'est un texte simple. L'option « ne rien afficher » a été
   écartée : l'absence de ligne serait ambiguë entre « non configurée » et
   « n'apporte rien ».
4. **Portée : les deux modales de consultation seulement** — détail d'une équipe
   et détail du roster d'un membre. Le Builder et le roster personnel ne sont
   **pas** dans le périmètre. Ils ne partagent pas `equipLine` et les inclure
   demanderait soit de les faire converger, soit de dupliquer.

## 3. État des lieux mesuré

À revérifier avec les commandes indiquées si ce document vieillit.

### 3.1 La mécanique par pièce existe déjà

`js/metier/stats-calcul.js` expose `calculateGearStats(file, config, slotKey)` et
`calculateWeaponStats(file, config)`. `js/vues/editeur-equipement.js` s'en sert
déjà pour afficher « Apport de l'équipement » **pendant l'édition** d'une pièce.
La demande revient largement à faire remonter ce bloc dans les fiches en lecture
seule.

```bash
grep -rn "buildStatsTitle\|statTermsDetails" js/ --include=*.js
```

### 3.2 L'agrégation de l'équipement boucle déjà sur les pièces

`calculateBuildStats(build)` (`js/metier/stats-calcul.js:695`) parcourt les
emplacements à la ligne 728, appelle `calculateGearStats` pour chacun, conserve le
statut par emplacement dans `statuses[domain + ":" + slotKey]`, puis **fusionne les
termes dans un tableau plat**. L'attribution par pièce n'est pas perdue pour
autant : chaque terme porte `bucket: domain + ":" + slotKey` et
`source:{ domain, component, slot, id }`.

**Conséquence : l'information nécessaire est déjà calculée. Elle est seulement
aplatie à l'affichage.**

### 3.3 Pourquoi PAS `calculateHeroStats`

`calculateHeroStats(hero)` (ligne 909) ne convient pas comme source. Sa boucle de
la ligne 968 est une **validation**, pas une agrégation : elle relève les pièces
absentes ou mal configurées, puis

```js
if(status !== "valid") return emptyHeroStatResult(status, missing);
```

Autrement dit, **une seule pièce non configurée vide entièrement le résultat**.
C'est l'état du héros de gauche dans la capture d'origine (« Configuration à
compléter — À compléter : weaponConfig, armorConfig.Bas, … »). Bâtir les résumés
sur ce résultat les ferait tous disparaître dès qu'une pièce manque, c'est-à-dire
dans le cas le plus fréquent.

`calculateBuildStats` est au contraire tolérante : elle ignore les pièces
invalides (`if(result.status !== "valid") return;`) tout en gardant les termes des
valides et le statut de toutes.

**`calculateBuildStats` n'est pas exportée aujourd'hui.** Elle n'est appelée qu'en
interne, à la ligne 1006. L'exporter fait partie du travail.

### 3.4 L'arme suit un chemin distinct

Les termes d'arme ne passent pas par `addGearStatTerm` mais par
`addWeaponStatTerm` (ligne 391), et ne portent **pas** de `source.slot`. Leur
structure reste néanmoins transposable au même classement :

| Rang | Reconnaissance |
|---|---|
| principale | `bucket:"weapon-native"` sans `source.subStat` |
| secondaire | `source.subStat` défini |
| enchantement | `bucket:"weapon-enchantment"` |

```bash
grep -n "addWeaponStatTerm\|addGearStatTerm" js/metier/stats-calcul.js
```

### 3.5 La fiche partagée n'a que deux appelants

Le commentaire en tête de `js/vues/fiche-heros.js` annonce « quatre grosses
modales ». C'est inexact : `heroDetail` n'est appelé que par
`js/vues/detail-equipe.js:37` et `js/vues/detail-roster.js:122`. Le Builder et le
roster des membres n'utilisent que `heroStatsSection`. Ce commentaire sera corrigé
au passage.

```bash
grep -rn "heroDetail" js/ --include=*.js | grep -v "fiche-heros.js:"
```

### 3.6 L'affichage déplié n'a pas besoin de code nouveau

`groupBuildStatResults(result)` ne consomme que `result.totals` et `result.terms`.
Un résultat par pièce ayant cette forme traverse donc sans modification la chaîne
d'affichage existante : `groupBuildStatResults` puis `statTermsDetails`.

## 4. Approche retenue

**Regrouper les termes déjà calculés**, plutôt que rappeler `calculateGearStats`
par pièce depuis la vue.

Deux approches ont été écartées :

- **Rappeler `calculateGearStats` par pièce depuis la vue.** Coût de 72 recalculs
  par ouverture de modale (8 héros × 9 pièces), et surtout un second chemin de
  calcul susceptible de diverger de l'apport total de l'équipement. Le bonus
  d'ensemble y deviendrait invisible, n'appartenant à aucune pièce.
- **Précalculer et stocker en base.** Migration Supabase, risque de données
  périmées, et rupture de la propriété « aucun changement de schéma ».

L'approche retenue apporte trois garanties :

- **Coût nul en calcul**, quel que soit le nombre de héros affichés.
- **Source de vérité unique** : la somme des résumés égale l'apport total de
  l'équipement *par construction*, puisque ce sont littéralement les mêmes termes.
- **Le bonus d'ensemble reste visible** au lieu de disparaître.

La source est le résultat de `calculateBuildStats(build)`, **pas** celui de
`calculateHeroStats(hero)` — voir 3.3 pour la raison, qui est décisive.

## 5. Conception détaillée

### 5.1 Couche métier — `js/metier/stats-calcul.js`

Deux changements, tous deux additifs.

**a. Exporter `calculateBuildStats`.** Elle existe (ligne 695) mais reste privée.

**b. Une fonction pure nouvelle :**

```
groupBuildTermsBySlot(buildResult) → [{ slot, domain, file, status, terms, totals }]
```

- Range les termes de `buildResult` par `source.slot`.
- L'arme n'a pas de `source.slot` : elle est reconnue par `source.domain === "weapon"`
  et sort dans une entrée `{ slot:"weapon", domain:"weapon" }`.
- Le bonus d'ensemble n'a pas de `slot` non plus : voir 5.5.
- Reconstruit les totaux par entrée avec `reconstructStatTotals`, déjà présent.
- Remonte le `status` depuis `buildResult.statuses[domain + ":" + slot]`, et
  depuis `statuses.weapon` pour l'arme.
- Chaque entrée a **exactement la forme d'un résultat `calculateGearStats`**,
  ce qui la rend consommable par la chaîne d'affichage existante.

### 5.2 Le champ `role`

`addGearStatTerm` **et** `addWeaponStatTerm` gagnent un champ `role`, valeurs
`"main"`, `"sub"`, `"enchantment"`, `"bonus"`.

Aujourd'hui l'information existe, mais sous deux formes différentes selon le
chemin : dans la chaîne `id` pour l'équipement (`":main:"`, `":sub:"`), dans la
combinaison `bucket` + `source.subStat` pour l'arme (voir 3.4). Découper des
chaînes d'un côté et croiser deux champs de l'autre donnerait deux règles de
classement à maintenir en parallèle.

Le champ `role` unifie les deux chemins en une seule règle testable. Il est
additif et ne casse aucun consommateur existant.

### 5.3 Le classement du résumé

Les unités ne sont pas comparables : « PV +4 200 » est en points, « CRIT 12 % » en
dix-millièmes. Toute normalisation serait arbitraire. Le classement suit donc la
structure que les données du jeu portent déjà, et **ne compare jamais deux unités
entre elles** :

| Rang | `role` | Origine |
|---|---|---|
| 1 | `main` | stat principale de la pièce |
| 2 | `sub` | stat secondaire |
| 3 | `enchantment` | option aléatoire la plus forte |

Une pièce qui n'a pas de stat secondaire affiche deux entrées, pas trois. On ne
complète jamais avec une stat d'un autre rang pour atteindre trois.

### 5.4 Couche vue — `js/vues/fiche-heros.js`

`equipLine` reçoit l'entrée correspondant à sa pièce et un indicateur de droit
d'édition. Elle dessine :

- **Pièce configurée** : la ligne de résumé, dépliable vers
  `groupBuildStatResults` puis `statTermsDetails`.
- **Pièce non configurée** : « À configurer → » (lien vers l'éditeur) si le
  visiteur a le droit de modifier ce build, « À configurer » (texte) sinon.

Le droit se lit avec `canManageTeam` et `sessionCourante.user`, déjà importés par
les deux modales appelantes. Aucune notion de permission nouvelle.

`equipLine` reste privée au module.

### 5.5 Le bonus d'ensemble

`gearSetTerms` produit des termes portant `bucket:"set"` et **aucun
`source.slot`** : ils n'appartiennent à aucune pièce.

- Les répartir sur les pièces serait faux.
- Les taire ferait que la somme des résumés ne fait pas l'apport total de
  l'équipement.

`groupBuildTermsBySlot` les remonte donc dans une entrée séparée
`{ slot:"set", domain:"set" }`, affichée une seule fois sous le bloc d'équipement
sous le libellé « Bonus d'ensemble ».

## 6. Tests

| Niveau | Ce qui est vérifié |
|---|---|
| Unitaire | **Invariant central** : somme des totaux de toutes les entrées (pièces + arme + `set`) = `totals` de `calculateBuildStats`. Protège la fonctionnalité de toute évolution future de la formule. |
| Unitaire | Classement : une armure remonte ses PV, un bijou son critique. |
| Unitaire | Une pièce sans stat secondaire sort deux entrées, pas trois complétées artificiellement. |
| Unitaire | **Tolérance aux pièces non configurées** : un build dont une seule pièce est non configurée produit quand même les résumés de toutes les autres. C'est le test qui aurait attrapé le défaut de conception initial. |
| Unitaire | Une pièce non configurée sort avec `status !== "valid"` et aucun terme. |
| Unitaire | Les termes `bucket:"set"` ne sont attribués à aucune pièce. |
| Unitaire | L'arme sort dans son entrée `slot:"weapon"`, avec le même classement principale → secondaire → enchantement. |
| Playwright | Ouvrir la modale de détail d'équipe : un résumé est présent sous une pièce configurée, le dépliage révèle le détail, une pièce non configurée affiche « À configurer ». |

**Attention à l'invariant** : il ne porte pas sur le total du **héros**, qui ajoute
les stats de base du personnage, la maîtrise, le potentiel et les passifs. Il porte
sur l'apport de l'**équipement** seul, celui que retourne `calculateBuildStats`.

## 7. Hors périmètre

- Le Builder et le roster personnel (décision 4).
- Le bloc « Statistiques du héros » en bas de fiche : inchangé.
- Toute modification du schéma Supabase : aucune n'est nécessaire.
- Le rapport de boss : il n'appelle pas `heroDetail`.
