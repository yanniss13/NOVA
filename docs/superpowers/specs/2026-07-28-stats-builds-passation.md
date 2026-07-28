# Passation — stats de build détaillées (roster et team builder)

**Date :** 2026-07-28
**État :** conception commencée, découpage proposé mais **pas encore validé** par le
propriétaire du projet.
**Pour :** l'agent qui reprend ce chantier (Codex).

Ce document existe parce que la conception a été interrompue. Il contient tout ce
qui a été **mesuré** (avec la commande pour le revérifier), tout ce qui a été
**décidé** par le propriétaire, et ce qui reste **ouvert**. Ne redécouvre pas ce
qui est déjà ici.

---

## 1. Objectif

Rendre la construction d'équipe et le roster « aussi poussés que le team-builder
de 7dsorigin.app » : le membre saisit le détail chiffré de son équipement et voit
les stats qui en résultent.

Citation exacte de la demande : *« je veut juste que ma construction d'equipe et
que les personnage que je met dans mon roster soit aussi poussé que 7ds app »*,
précisée ensuite par *« voir mes stats réelles »*.

## 2. Décisions déjà prises par le propriétaire

Deux questions lui ont été posées, avec les compromis explicités. Ses réponses
sont des décisions, pas des préférences à re-litiger :

1. **Exactitude : « modèle documenté ».** On applique la formule dérivable, en
   distinguant visiblement ce qui est certain de ce qui est estimé. Il a été
   averti que nos chiffres pourront différer des leurs de quelques pour cent sur
   la part armure, et il a choisi cette option plutôt que la validation contre
   leur outil.
2. **Saisie : « complète, pièce par pièce ».** Il a été averti que cela
   représente une quarantaine de champs par personnage et une migration Supabase,
   et qu'une alternative existait (valeurs par défaut au maximum, correction
   ponctuelle). Il a maintenu la saisie complète. **Ne repropose pas la version
   simplifiée sans qu'il la redemande.**

## 3. Ce qui a été mesuré, et comment le revérifier

Les données sont déjà dans le dépôt : `7ds-stats/*.json`, générées par
`generate-stats.py` (voir la section « Stats de référence » d'`AGENTS.md`).

### 3.1 La formule des armes est exacte — 148 sur 148

Pour chaque sous-stat d'arme : `max == base + 10 × Σ(progression)`.

```bash
python - <<'PY'
import json
armes = json.load(open("7ds-stats/armes.json", encoding="utf-8"))
ok = bad = 0
for w in armes:
    for g in w.get("grades") or []:
        for s in g.get("subStats") or []:
            v = s["values"]
            if v["base"] + 10 * sum(v["progression"]) == v["max"]: ok += 1
            else: bad += 1
print("exact:", ok, "ecarts:", bad)   # attendu : exact: 148 ecarts: 0
PY
```

Interprétation : la progression donne l'incrément **par niveau** de chaque
segment de **10 niveaux**. Les longueurs rencontrées sont 4 (60 cas) et 5
(88 cas), soit un plafond de niveau 40 ou 50 selon le grade.

### 3.2 Renforcement des armures : ne pas transposer cette règle aux armes

Les 412 occurrences de `growthType: "reinforce"` mesurées appartiennent
uniquement à `armures.json`. Elles portent toutes la progression :

```
[10300, 10700, 11200, 11800, 12500]
```

Soit des multiplicateurs en dix-millièmes : ×1,03 / ×1,07 / ×1,12 / ×1,18 / ×1,25
pour les niveaux de renforcement 1 à 5 des armures. `reinforceMax` vaut 5
partout où il a été observé dans ce contexte.

Les armes ne possèdent aucune entrée `growthType: "reinforce"`. Leur
progression suit trois sources distinctes :

- `promotionValues`, avec l'invariant
  `max == base + Σ(progression)` vérifié sur 261 cas sur 261 ;
- `promotionSteps[].reinforceMax`, qui ouvre successivement les plafonds de
  niveau 20, 30, 40 et 50 ;
- `overlimit.levels[].statRate`, en dix-millièmes, selon la table constante
  `0 / 500 / 1000 / 1750 / 2500 / 3750 / 5000`, identique sur les 81 armes
  concernées.

L'unité des taux est confirmée : `500` signifie `+5 %`. Le lot arme ne doit
donc jamais importer ni appliquer la progression multiplicative propre aux
armures.

### 3.3 Additifs simples, rien à deviner

Ces sources livrent directement des paires `{stat, value}` qui s'additionnent :

- `personnages[].potentials[].stats` (30 paliers par personnage : 3 armes × 10) ;
- `personnages[].weaponMasteries[].subLevels[].abilities` ;
- `personnages[].commonMasteryStats` ;
- `sets.json` → `bonusTwoStats` et `bonusFourStats`.

### 3.4 L'inconnue : l'interpolation des armures

Structure observée sur une pièce grade5 (Haut de l'araignée de l'ombre) :

```json
"mainStatValues": {"growthType":"equiplv_17","abilityType":"B_Def_Equip","progression":[3073]}
"mainEquiplvAdd": {"growthType":"equiplv_add_17","abilityType":"B_Def_Equip","progression":[35]}
"mainReinforce": {"growthType":"reinforce","progression":[10300,10700,11200,11800,12500]}
```

avec `qualityMin: 120`, `qualityMax: 160`, `tierBoundaries: [119]`.

Les identifiants `equiplv_N` ne renvoient à aucune table publiée : ils
apparaissent 757 fois comme valeur de `growthType`, mais zéro fois comme clé de
dictionnaire. Ils sont redondants et ne doivent donc être ni résolus, ni
convertis en table de correspondance.

La segmentation nécessaire est entièrement portée par chaque objet :

```text
nombreDeSegments = max(1, len(tierBoundaries) − 1)
```

Cette relation a été vérifiée sur les 1 156 blocs de croissance des 312 pièces,
sans exception. Lorsqu'il n'existe qu'une seule borne, l'unique intervalle va de
`qualityMin` à `qualityMax`.

Il reste une seule hypothèse à valider : le gain par niveau d'un segment
part-il de la borne inférieure de ce segment ou toujours de `qualityMin` ?
L'implémentation du lot armures devra centraliser ce choix dans un unique
paramètre nommé :

```text
origine(segment, "segment-lower-bound") = borne inférieure du segment
origine(segment, "quality-min")          = qualityMin

statAvantRenforcement =
  progression[segment]
  + equiplvAdd[segment] × (niveau − origine(segment, mode))
```

Le renforcement d'armure s'applique ensuite avec le taux correspondant de la
table décrite au § 3.2.

```js
/*
 * PRÉSUMÉ, NON VÉRIFIÉ :
 * le gain par niveau repart de la borne inférieure de chaque segment.
 *
 * Vérification dans le jeu :
 * relever la même statistique d'une même armure à qualityMin, juste avant,
 * au niveau et juste après la première borne interne, puis comparer les deux
 * reconstructions "segment-lower-bound" et "quality-min".
 */
const ARMOR_SEGMENT_ORIGIN_MODE = "segment-lower-bound";
```

Le terme produit à partir de ce choix devra porter
`confidence: "presumed"`. Si la mesure favorise l'autre formule, le basculement
devra se limiter à remplacer cette valeur par `"quality-min"`.

**Pourquoi ce n'est pas vérifiable avec les données seules :** contrairement aux
armes, aucun champ `max` ne permet de recouper le point d'origine. La mesure
dans le vrai jeu selon le protocole ci-dessus reste le test décisif.

### 3.5 L'ordre d'application des pourcentages est inconnu

Les codes en `_Rate` (`I_AtkAdd_Rate`, `C_Critical_Rate`…) sont des pourcentages
en dix-millièmes. Ce qui n'est écrit nulle part : **de quelle base** ils
s'appliquent (attaque de base du personnage seule ? base + équipement ?) et dans
quel ordre par rapport aux bonus de set et de potentiel. À trancher et à
**documenter dans le code**, puisque c'est un choix, pas une donnée.

Pour l'outrepassement des armes, le lot 1 retient l'hypothèse
`native-before-enchantments` : multiplicateur appliqué aux statistiques natives
de l'arme avant les enchantements. La valeur du multiplicateur est exacte ; sa
base est présumée.

Cette hypothèse doit vivre dans un paramètre unique du moteur. Protocole de
validation : relever dans le jeu l'ATK à outrepassement 0 puis 1 sur une arme
enchantée et vérifier si le gain de 5 % porte sur les statistiques natives ou
sur le total enchanté. Une contradiction doit se corriger en changeant une
seule ligne.

Le moteur expose dès le lot 1 :

- `coverage: ["weapon"]` uniquement quand le domaine arme est entièrement
  calculé ;
- une liste de termes portant `stat`, `operation`, `unit`, seau ou cible et
  provenance ;
- un terme multiplicatif concret par statistique affectée, jamais `stat: "*"` ;
- des totaux partiels dont chaque valeur est strictement reconstructible depuis
  les termes.

Les unités `flat` et `ten-thousandths` sont déclarées explicitement par terme.
Elles ne sont jamais déduites des codes ou du drapeau `taux` incomplet de
`libelles-stats.json`.

## 4. Découpage proposé (à faire valider avant de coder)

Règle imposée par le propriétaire, apprise à ses dépens : **chaque lot doit être
utilisable seul**. Un chantier invisible lui a déjà fait abandonner une tâche.
Voir la mémoire `prioriser-valeur-visible-membres`.

### Lot 1 — L'arme, de bout en bout

Socle de données chargé par le navigateur, modèle de build étendu + migration
Supabase, moteur de calcul, affichage des stats de l'arme sur la fiche.

Saisie : grade, niveau, promotion, outrepassement, enchantements (basiques ou
pierre maîtresse). Affichage : ce que l'arme apporte, chiffré.

**Commencer ici parce que c'est le seul terrain où la formule est prouvée**
(§ 3.1). Le moteur et la migration servent ensuite aux deux autres lots.

### Lot 2 — Les 7 pièces d'équipement et le costume gravé

Haut, Bas, Ceinture, Bottes, Anneau, Collier, Boucle d'oreille + costume gravé.
Détection des sets et bonus 2/4 pièces. C'est le lot qui porte l'incertitude du
§ 3.4 : aucune table `equiplv_N` ne doit être créée, la segmentation vient de
`tierBoundaries`, et seul le point d'origine est piloté par
`ARMOR_SEGMENT_ORIGIN_MODE`. Le terme correspondant doit porter
`confidence: "presumed"` et l'interface doit le signaler comme estimé.

### Lot 3 — Maîtrise, potentiel et totaux

Arbre de maîtrise par arme, potentiel **par type d'arme**, total final du héros,
totaux d'équipe.

⚠️ Changement de modèle : le site stocke aujourd'hui **un seul**
`potentialTier` (0–10) par personnage, utilisé par le Recensement DPS. Le jeu en
a un **par type d'arme**. Migration à concevoir sans casser le recensement.

### Hors périmètre pour l'instant

Synergies de Combines (545 combinaisons dans le payload), partage par lien,
export en image, hub communautaire.

## 5. Le socle de données à produire (prérequis du lot 1)

Les fichiers de `7ds-stats/` pèsent 11,5 Mo : **ne les charge pas dans le
navigateur**. Un extrait de calcul a été mesuré à **639 Ko brut, 24 Ko gzippé**,
en ne gardant que les champs chiffrés (aucun texte descriptif) :

| Partie | Taille compacte |
| --- | --- |
| personnages (stats de base, potentiels, maîtrises) | 142 Ko |
| armures | 190 Ko |
| armures gravées | 267 Ko |
| armes | 30 Ko |
| sets | 3 Ko |
| libellés | 6 Ko |

Cet extrait **n'a pas encore été écrit dans le dépôt** — seul son dimensionnement
a été fait. Il reste à décider sa forme : un `stats-build.js` posant
`window.SEVEN_DS_BUILD_STATS`, cohérent avec `data.js` / `personnages-meta.js` /
`potentiels.js`, chargé par une balise `<script src>` classique pour rester
compatible `file://`.

## 6. Contraintes du dépôt à ne pas violer

Lire `AGENTS.md` **en entier** avant de commencer. Les points qui vont te
concerner directement :

- **Aucune étape de build.** Tout doit fonctionner par double-clic sur
  `index.html`, en `file://`. Pas de modules ES, pas de bundler.
- **Toute la logique applicative est inline** dans le `<script>` principal
  d'`index.html` (7 300+ lignes). Les blocs `<script>` séparés en fin de fichier
  existent parce que le bac à sable `vm` des tests unitaires ne fournit ni
  `addEventListener`, ni `matchMedia`, ni `requestAnimationFrame`.
- **Règle d'or sur les assets :** ne jamais coder en dur une liste d'armes,
  d'armures ou d'éléments. Tout dérive de `window.SEVEN_DS_DATA`. Comparaison des
  sets **par suffixe**, jamais par égalité de nom exacte (piège documenté).
- **`index.html` a des fins de ligne mixtes (CRLF et LF).** Ne jamais présumer
  le séparateur d'une ancre multi-ligne : inspecter la zone ciblée, utiliser
  une expression tolérant `\r?\n`, ou éditer ligne par ligne. Ne pas normaliser
  tout le fichier au passage, car cela masquerait le vrai diff fonctionnel.
- **Le chargeur de tests** (`tests/helpers/load-app.js`, lignes 131-133) extrait
  le script inline par expression régulière et expose les fonctions internes.
  Toute fonction pure à tester doit être ajoutée à `HOOK_EXPORT`.
- **`robots.txt` de 7dsorigin.app interdit `/api/`** à tous les agents. Le
  générateur lit le payload RSC embarqué dans la page, ce qui ne demande qu'un
  GET. Ne tape jamais leur API.
- **Ne pousse rien sans autorisation explicite** du propriétaire. Il valide
  chaque étape.

## 7. Méthode de travail attendue

Le propriétaire a vu cette discipline appliquée toute la session et l'attend :

1. **TDD strict.** Écrire le test, le voir échouer **pour la bonne raison**, puis
   implémenter au minimum.
2. **Prouver qu'une assertion mord.** Casser volontairement le code visé et
   vérifier que le test échoue. Deux assertions vacuines ont été attrapées comme
   ça pendant cette session — dont une qui passait alors que la fonctionnalité
   était désactivée.
3. **Mesurer, ne pas raisonner à vue.** Trois bugs de défilement ont été résolus
   par sonde instrumentée après que le raisonnement ait donné de mauvaises
   réponses.
4. **Un commit par tâche**, message en français décrivant le *pourquoi*.
5. **Terminer par** `npm test`, `git diff --check`, `git status --short`.
6. **Après déploiement**, vérifier en production que `BUILD_VERSION` dans le
   `sw.js` servi correspond bien au SHA poussé.
7. **Rapporter honnêtement.** Si un test échoue, le dire avec sa sortie. Si une
   partie est estimée et non prouvée, le dire.

## 8. Questions ouvertes à poser au propriétaire

1. Le découpage en trois lots du § 4 lui convient-il, et démarre-t-on par le
   lot 1 ?
2. Quelles stats veut-il voir affichées ? Leur outil en distingue cinq familles :
   PV/ATK/DEF, stats supplémentaires, modificateurs de dégâts, stats spéciales,
   stats élémentaires.
3. La saisie détaillée s'applique-t-elle à **son** roster seulement, ou tous les
   membres doivent-ils remplir autant de champs ? Cela change la conception du
   modèle partagé et des politiques RLS.
4. Que devient un build déjà enregistré, qui n'a que des images sans niveaux ?
   Proposition : les stats restent masquées jusqu'à ce que les niveaux soient
   renseignés, plutôt que d'afficher un total faux.

## 9. État du dépôt à la passation

`main` = `2d1d922`, synchronisé avec `origin`, arbre propre, 14 suites de tests
vertes. Rien de ce chantier n'a été implémenté : aucune ligne de moteur de
calcul, aucun champ de saisie, aucune migration. Seules les **données de
référence** et leur générateur sont en place.
