# Passation — perle de sortilège : libellés et emplacements de stat

**Date :** 2026-07-28
**Base :** `main` = `328dd51` (lot 1 livré et déployé)
**Pour :** l'agent qui reprend si le travail s'interrompt.

Ce document est une **assurance** : il est écrit avant le changement, pour qu'une
interruption ne laisse personne devant un arbre à moitié modifié sans contexte.
Vérifie l'état réel avec `git status --short` et `git log --oneline -3` avant de
supposer quoi que ce soit.

---

## 1. Vérité terrain fournie par le propriétaire

Le propriétaire joue au jeu. Ces informations viennent de lui, pas des données
de 7dsorigin, et **font autorité** sur elles :

1. L'enchantement que 7dsorigin nomme « Pierre maîtresse » (`type:"masterstone"`
   dans les données) s'appelle en jeu **« Perle de sortilège »**. Le champ
   `pearlEnchant` du payload de 7dsorigin confirme d'ailleurs « perle ».
2. Les paliers ont des noms de rareté, pas des numéros :

   | Palier | Nom en jeu | Emplacements de stat |
   | --- | --- | --- |
   | 1 | Commune | 1 |
   | 2 | Remarquable | 2 |
   | 3 | Rare | 2 |
   | 4 | Héroïque | 3 |
   | 5 | Légendaire | 4 |

Les données de 7dsorigin **ne portent pas** ce nombre d'emplacements : leurs
`tiers[].options` ne listent que les stats possibles. Cette table vient donc
uniquement du propriétaire. Ne la cherche pas dans `stats-build.js`, et ne la
« corrige » pas d'après les données.

## 2. Le défaut à corriger

Le code fixe **un seul** emplacement pour toute perle, quel que soit le palier.
Conséquence : avec une perle légendaire, le membre ne peut enregistrer qu'une de
ses 4 stats. Trois quarts de son enchantement sont insaisissables.

## 3. Les quatre endroits à modifier

Références de ligne valables sur `328dd51` — elles bougeront dès la première
édition, retrouve-les par le nom de la fonction.

| Endroit | Fonction | Ce qui est faux |
| --- | --- | --- |
| `index.html` ~2386 | `enchantmentLength(grade)` | `if(enchantments.type === "masterstone") return 1;` — longueur codée en dur |
| `index.html` ~2467 | `enchantmentChoiceStatus` | `if(choice.slot !== 0 ...) return "incompatible"` — refuse tout indice > 0 |
| `index.html` ~3339 | `renderMasterstoneWeaponEnchantments` | libellé « Pierre maîtresse », options « Palier N », `slot:0` codé en dur, un seul bloc rendu |
| `index.html` ~3353 | idem | `weaponConfigOption(tier.tier, "Palier "+tier.tier)` |

## 4. Décision de modèle

Le palier appartient à **la perle**, pas à chaque stat. Mais le modèle stocke un
tableau `enchantments` dont chaque entrée porte déjà `{slot, tier, element, stat,
value}`.

**Choix retenu :** garder le tableau, avec une entrée par emplacement, toutes
portant le même `tier` et le même `element`. Raisons :

- la forme du tableau est déjà validée par les triggers SQL et par les tests de
  schéma — la changer imposerait une seconde migration ;
- `emptyWeaponConfig` construit le tableau **avant** qu'un palier soit choisi ;
  la longueur doit donc pouvoir évoluer au changement de palier.

**Conséquences à implémenter :**

1. `enchantmentLength` doit connaître le palier courant. Pour une perle sans
   palier choisi (tout à `null`), une longueur de 1 reste correcte.
2. Au changement de palier dans l'interface, **redimensionner** le tableau à la
   longueur du nouveau palier : tronquer si l'on descend, compléter avec des
   entrées neuves si l'on monte.
3. La validation doit vérifier, pour une perle :
   - `choice.slot === index` (et non `=== 0`) ;
   - `index < emplacements(palier)` ;
   - **toutes** les entrées non nulles partagent le même `tier` et le même
     `element` — sinon `"incompatible"`. C'est la contrainte qui empêche un
     état absurde (deux perles de paliers différents sur la même arme).
4. La même stat ne doit pas pouvoir occuper deux emplacements de la même perle.
   ⚠️ **À faire confirmer par le propriétaire** avant de l'imposer : je ne sais
   pas si le jeu l'autorise. Par défaut, ne pas l'interdire.

## 5. Tests attendus

Dans `tests/stats-build.test.js`, en TDD strict — écrire rouge, vérifier
l'échec, puis implémenter :

1. `enchantmentLength` renvoie 1, 2, 2, 3, 4 pour les paliers 1 à 5.
2. Une perle légendaire avec 4 stats valides est `valid`.
3. Une perle légendaire avec une 5ᵉ entrée est `incompatible`.
4. Deux entrées de paliers différents sont `incompatible`.
5. Deux entrées d'éléments différents sont `incompatible`.
6. Une perle héroïque dont seules 2 des 3 entrées sont remplies est
   `incomplete`, pas `incompatible` — c'est la distinction introduite par
   `328dd51`, ne pas la casser.
7. La décomposition émet un terme par emplacement rempli, et la reconstruction
   reste égale au total.

Et **prouver que ces tests mordent** : casser volontairement la table des
emplacements (par exemple renvoyer 1 partout) et vérifier l'échec, comme le
plan du lot 1 l'exige à chaque tâche.

## 6. Interface

- Titre : **« Perle de sortilège »**.
- Sélecteur de palier : `Commune`, `Remarquable`, `Rare`, `Héroïque`,
  `Légendaire` — jamais « Palier N ».
- Rendre **n** blocs de stat, numérotés, chacun avec son sélecteur de stat et
  son champ de valeur.
- Le palier et l'élément restent choisis **une seule fois** pour la perle, pas
  par emplacement.
- Mobile : chaque contrôle reste à 44 px minimum, et aucun débordement
  horizontal entre 320 et 390 px — vérifié par
  `tests/accessibilite-mobile.playwright.js`.

## 7. Documentation

Ajouter la table des paliers dans `AGENTS.md`, avec la mention explicite que
**le nombre d'emplacements vient du propriétaire et non des données**, pour
qu'un futur agent ne la « corrige » pas d'après `stats-build.js`.

## 8. État au moment d'écrire ce document

`main` = `328dd51`, arbre propre, 18 suites vertes, lot 1 déployé et vérifié en
production. Rien de ce document n'est encore implémenté.
