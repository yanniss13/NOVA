# Conception — une modale par pièce, avec navigation

**Date :** 2026-08-03
**État :** conception validée par le propriétaire du projet.
**Remplace :** la présentation en ligne décrite dans
`2026-08-03-apport-par-piece-design.md`. La couche métier de ce document-là
reste valide et acquise ; seule la présentation change.

---

## 1. Pourquoi cette révision

La première version affichait sous chaque pièce un résumé de trois apports,
dépliable. Elle a été implémentée, testée, et **vue en conditions réelles**.
Le rendu a été jugé inutilisable, pour deux raisons que seul l'écran révèle :

1. **Le résumé ne tient jamais.** Avec les libellés du catalogue — « Efficacité
   de recharge de la magie », « Efficacité des barrières » — trois apports sont
   systématiquement tronqués. L'information promise n'est pas lisible :
   `▸ Attaque +3 154 · Dégâts crit. +48,82…`
2. **« À configurer » saturait l'écran.** Sur la capture d'origine, trois héros
   sur quatre n'avaient aucune pièce configurée : neuf mentions grises
   identiques par héros, vingt-sept au total. La mention avait été choisie avant
   d'être vue à cette densité.

Leçon à retenir : la décision « mention discrète pour les pièces non
configurées » était raisonnable dans l'abstrait et mauvaise à l'usage. Un
rendu réel vaut mieux qu'une maquette.

## 2. Décisions du propriétaire

1. **La ligne ne porte plus que le nom.** Aucun résumé, aucune mention. Le
   détail passe entièrement par une modale.
2. **Navigation entre les pièces.** « Il faut pouvoir naviguer entre les modales
   des équipements pour ne pas recliquer sur chacun. » C'est une exigence, pas
   un confort.
3. **Parcours : les neuf pièces du héros, configurées d'abord.** Les non
   configurées restent atteignables, mais après. Le parcours ne traverse pas les
   autres héros.
4. **Affordance : un chevron `›` discret** en bout de ligne, visible en
   permanence. L'option « seulement au survol » a été écartée : la majorité des
   membres consultent sur téléphone, où le survol n'existe pas.
5. **`summaryTermsFor` est retirée**, avec ses tests. Plus aucun appelant, et le
   dépôt refuse les exports orphelins. Elle reste récupérable dans l'historique
   (`git show 22f5e29 -- js/metier/stats-calcul.js`).

## 3. Ce qui est acquis et ne bouge pas

La couche métier de la première conception est validée et testée. Elle reste
telle quelle :

- Le champ `role` sur chaque terme (`main`, `sub`, `extra`, `enchantment`,
  `bonus`).
- `groupBuildTermsBySlot(build)` et **son invariant de somme** : la somme des
  entrées égale l'apport total de l'équipement.
- Le choix de `calculateBuildStats` comme source plutôt que
  `calculateHeroStats`, qui vide son résultat dès qu'une pièce manque.

## 4. Approche retenue

**Un module dédié `js/vues/detail-piece.js`**, qui possède son overlay, son état
de navigation et son rendu. `fiche-heros.js` ne fait que câbler le clic et lui
passer les entrées déjà calculées.

C'est le découpage de `js/vues/detail-roster.js`, qui possède sa modale et sa
navigation `‹ ›` sans que ses appelants en sachent quoi que ce soit.

Deux approches écartées :

- **Tout dans `fiche-heros.js`.** Aucun fichier nouveau, mais le fichier
  passerait de 260 à environ 400 lignes et mélangerait deux métiers : dessiner
  une fiche, et posséder une modale avec son état. C'est la fusion que le
  refactor de `index.html` a défaite.
- **Étendre `#gearConfigOverlay` en mode lecture seule.** Réutilise du balisage,
  mais cet éditeur existe pour *modifier* : y greffer un mode consultation
  conflerait deux intentions dans un fichier de 467 lignes.

### Contrainte d'ordre des couches

`tests/modules-imports.test.js` interdit qu'un module dépende d'un module situé
plus bas dans `tests/helpers/modules.js`. `detail-piece.js` doit donc être
inséré **avant** `vues/fiche-heros.js` (position 14), et **après**
`vues/stats-affichage.js` (position 8) dont il dépend. Position visée : 13,
juste avant `fiche-heros.js`.

## 5. Conception détaillée

### 5.1 La ligne d'équipement — `js/vues/fiche-heros.js`

`equipLine` perd `equipContribution`, `shortStatLabel` et `contributionText`.

- **Pièce équipée** : la ligne devient un `<button>`, avec un `›` en bout. Un
  vrai bouton, pas un `div` porteur d'un `onclick` : c'est ce qui la rend
  atteignable au clavier sans `tabindex` artificiel, et annonçable par un
  lecteur d'écran.
- **Emplacement vide** : reste un `div` non cliquable. Il n'y a rien à montrer.
- Son `aria-label` nomme la pièce et l'action : « Voir l'apport — Haut du
  souverain cupide ».

### 5.2 Le balisage — `index.html`

Un overlay calqué sur `#rosterDetailOverlay` :

```html
<div class="overlay" id="pieceDetailOverlay" aria-hidden="true">
  <div class="picker-panel">
    <div class="picker-head">
      <span class="picker-title" id="pieceDetailTitle">Pièce</span>
      <button class="icon-btn" id="pieceDetailClose" aria-label="Fermer">✕</button>
    </div>
    <div class="roster-detail-nav">
      <button class="icon-btn" id="pieceDetailPrev" type="button"
              aria-label="Pièce précédente">‹</button>
      <span class="roster-detail-position" id="pieceDetailPosition"
            aria-live="polite"></span>
      <button class="icon-btn" id="pieceDetailNext" type="button"
              aria-label="Pièce suivante">›</button>
    </div>
    <div class="roster-detail-body" id="pieceDetailBody"></div>
  </div>
</div>
```

Les classes de navigation et de corps sont réutilisées telles quelles : elles
sont déjà stylées et testées.

### 5.3 Le module — `js/vues/detail-piece.js`

```
openPieceDetail(context)
```

où `context = { entries, index }` — les entrées produites par
`groupBuildTermsBySlot`, déjà ordonnées (voir 5.4), et l'indice de celle à
afficher.

Le corps réutilise la chaîne d'affichage des éditeurs, sans rendu nouveau :

```
groupBuildStatResults(entrée)  →  statTermsDetails(...)
```

Une entrée sans terme affiche « Cette pièce n'est pas encore configurée. » et
rien d'autre. **Pas de lien vers l'éditeur** : les deux modales appelantes sont
des vues de consultation, affichant le plus souvent le build d'un autre membre,
et `openGearConfigEditor` exige un rappel `commit` qui n'y existe pas.

### 5.4 L'ordre du parcours

Établi une seule fois, à l'ouverture de la fiche, par une fonction pure dans
`js/metier/stats-calcul.js` :

```
orderedBuildEntries(build) → entrées triées
```

Règle : les entrées ayant au moins un terme d'abord, les autres ensuite ; à
l'intérieur de chaque groupe, l'ordre naturel arme → armures → bijoux →
ensemble.

Cette fonction est pure et testable sans navigateur, contrairement au tri qui
vivrait dans la vue. C'est aussi elle qui garantit que la position affichée
(« 2 / 9 ») correspond à ce que le membre voit.

**`orderedBuildEntries` appelle `groupBuildTermsBySlot` en interne et devient
le seul point d'entrée exporté.** `groupBuildTermsBySlot` redevient privée :
`fiche-heros.js` n'aura plus besoin d'elle directement, et
`modules-imports.test.js` rejetterait un export sans importateur — le même
garde-fou qui a déjà mordu pendant l'implémentation précédente.

Ses tests unitaires existants continuent de fonctionner sans modification :
ils passent par `loadApp`, qui expose aussi les fonctions privées.

### 5.5 La navigation

Reprise littérale du motif de `detail-roster.js` (lignes 101 à 118) :

- `prev.disabled = index <= 0`, `next.disabled = index >= entrées.length - 1`.
- Position dans un `aria-live="polite"`.
- **Le repli de focus** : si le bouton qui a le focus devient désactivé, le
  focus passe à l'autre, ou au bouton de fermeture si les deux le sont. Sans
  cette garde, le focus tombe sur le `body` et le membre au clavier perd sa
  place. C'est la subtilité à ne pas oublier en recopiant.

### 5.6 Le bonus d'ensemble

Il n'est pas une pièce et n'a donc pas de ligne d'équipement. Il obtient la
sienne, sous les bijoux — `Bonus d'ensemble ›` — et devient la dernière entrée
du parcours. Il n'apparaît que s'il est actif.

Cette ligne est un `<button>` comme les autres et ouvre la même modale, sur son
entrée. Elle ne porte ni vignette ni libellé d'emplacement : seulement le titre
et le chevron.

### 5.7 Ce qui est retiré

| Élément | Fichier |
|---|---|
| `equipContribution`, `shortStatLabel`, `contributionText` | `js/vues/fiche-heros.js` |
| styles `.eq-contribution`, `.eq-set-bonus` | `css/modales.css` |
| `summaryTermsFor` et `SUMMARY_ROLE_ORDER` | `js/metier/stats-calcul.js` |
| son exposition au chargeur | `tests/helpers/load-app.js` |
| ses trois tests | `tests/apport-par-piece.test.js` |
| ses assertions de rendu en ligne | `tests/apport-par-piece.playwright.js` |

## 6. Tests

| Niveau | Ce qui est vérifié |
|---|---|
| Unitaire | `orderedBuildEntries` place les pièces configurées avant les autres. |
| Unitaire | À l'intérieur d'un groupe, l'ordre reste arme → armures → bijoux → ensemble. |
| Unitaire | L'invariant de somme de `groupBuildTermsBySlot` continue de tenir (test existant, conservé). |
| Playwright | Un clic sur une ligne ouvre la modale, titrée du nom de la pièce. |
| Playwright | `›` passe à la pièce suivante et la position se met à jour. |
| Playwright | `‹` est désactivé sur la première entrée, `›` sur la dernière. |
| Playwright | Une pièce non configurée affiche son message et aucune statistique. |
| Playwright | Échap ferme la modale de pièce **sans** fermer la modale d'équipe qui la porte. |
| Playwright | Le focus revient sur la ligne d'origine à la fermeture. |

Le dernier test protège l'empilement : `ModalStack` pose son verrou de
défilement à la première ouverture et ne le lève qu'à la dernière. Une
régression y casserait le défilement de toute la page.

## 7. Hors périmètre

- Le Builder et le roster personnel : inchangés, comme dans la conception
  précédente.
- Le bloc « Statistiques du héros » en bas de fiche : inchangé.
- Tout lien vers l'éditeur depuis une modale de consultation.
- Toute modification du schéma Supabase : aucune n'est nécessaire.
