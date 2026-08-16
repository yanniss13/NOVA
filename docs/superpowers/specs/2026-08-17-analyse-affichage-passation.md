# Passation — refonte de l'affichage de l'onglet Analyse

**Rédigé le 17 août 2026.** Destinataire : Codex, ou quiconque reprend le sujet.

---

## 0. Ne fais pas confiance à ce document

Ce fichier peut être faux dès sa rédaction. **L'avancement se lit dans les
commits, pas ici.** Commence par :

```bash
git log --oneline -8
git branch -a
git status
```

Si ce que tu lis ci-dessous contredit `git log`, c'est `git log` qui a raison.

---

## 1. Où en est le travail, exactement

### Livré, testé, poussé sur `main`

| Commit | Ce qu'il fait |
|---|---|
| `192d0c6` | Le recensement se groupe par personnage ; les deux recensements passent en fin de page |
| `29b4e18` | Le recensement affiche le chiffre au lieu du calcul à faire |

`main` est **verte** : suite unitaire complète + 13 fichiers e2e.

### En cours, NON terminé, sur la branche `wip/matrice-fusionnee`

Commit `642ba7c` — « la matrice absorbe le classement ».

**L'application fonctionne** (`tests/analyse-recensements.playwright.js` passe),
mais **deux fichiers de tests référencent encore le classement supprimé et
échouent**. C'est la seule raison pour laquelle ce travail n'est pas sur `main`.

```bash
git checkout wip/matrice-fusionnee
```

---

## 2. Ce qui reste à faire sur la branche

C'est du travail de test, pas de conception. La vue est finie.

### 2.1 `tests/accessibilite-mobile.playwright.js`

Un bloc d'une centaine de lignes (≈ 435 à 600) exerce le classement :

- `.elem-chip[data-elem="DARK"]` puis `.elem-chip[data-elem="ICE"]` — **ces
  pastilles n'existent plus**, tous les éléments sont visibles à la fois ;
- `.rank-row[data-owner=…][data-char=…][data-elem=…]` — devient
  `.mx-action[data-owner=…][data-char=…][data-elem=…]`, **mêmes trois
  attributs, exactement** ;
- `#analyseBody .rank-table` → `#analyseBody .matrix`.

Ce que ce bloc garde et qui doit continuer à être vérifié, sans rien perdre :

1. ouvrir une fiche depuis l'Analyse **ne relit aucune table Supabase** ;
2. la navigation précédent/suivant est masquée quand on vient de l'Analyse ;
3. le sélecteur d'arme montre les trois builds DPS Ténèbres de Meliodas, favori
   ouvert ;
4. Échap rend le focus à la case d'origine ;
5. si Realtime supprime le personnage pendant que la modale est ouverte, Échap
   rend le focus à `#tab-analyse`.

Les points 1 à 5 sont tous portés par le nouveau code : `caseDeLaMatrice()`
construit la même charge utile que l'ancienne ligne, et `rendreLaCibleDuFocus()`
remplace `renderRankTable()`'s fin de fonction.

Comme les huit éléments sont désormais visibles simultanément, **les deux clics
sur pastille disparaissent purement et simplement** — le test raccourcit.

### 2.2 `tests/supabase-etape1.playwright.js`

Deux endroits seulement :

- ligne ≈ 1498 : `await page.locator("#analyseBody .rank-table").waitFor();`
  → `.matrix` ;
- ligne ≈ 1588 : la `waitForFunction` qui cherche « Merlin » + « P10 » parmi
  `#analyseBody .rank-row` → `#analyseBody .mx-action`.

### 2.3 Ajouter ce que personne ne garde encore

Rien ne vérifie le **tri par colonne**, qui est la fonction reprise du
classement. À écrire, de préférence dans `analyse-recensements.playwright.js` :

- cliquer `.mx-tri[data-elem="ICE"]` classe les membres par leur meilleur
  potentiel Glace décroissant → la première ligne `.mx-player` est le bon
  membre ;
- l'en-tête porte `aria-sort="descending"`, les sept autres `"none"` ;
- **un second clic sur la même colonne revient à l'ordre par défaut** (nombre
  de DPS) — sans cette sortie le membre serait coincé ;
- **le tri ne déclenche AUCUNE lecture Supabase**. C'est le piège : ma première
  version appelait `renderAnalyse()` au clic, ce qui relisait le réseau à chaque
  changement de colonne. La matrice vit maintenant dans un conteneur stable
  (`.matrix-wrap`) et `rendreMatrice()` ne remplace que lui. Vérifie-le avec
  `window.__fakeSupabaseState.calls`.

---

## 3. Les décisions prises, et pourquoi — ne les défais pas sans raison

### Le groupement se fait sans en-tête de groupe

La moitié des groupes n'ont qu'**une seule ligne** (7 sur 14 côté
affaiblissement, 4 sur 13 côté renforcement). Un en-tête au-dessus d'une ligne
unique ajoute de la hauteur au lieu d'en retirer. Le portrait et le nom
n'apparaissent donc que sur la **première ligne** du groupe ; les suivantes
gardent une cellule vide — **c'est elle qui aligne les colonnes d'un bout à
l'autre de la liste** — avec un filet vertical.

Ne « simplifie » pas en supprimant cette cellule vide : les colonnes se
désalignent immédiatement. Sous 820 px elle est masquée, et le groupe se dit
alors par un retrait (`.db-suite`).

### L'ordre : ce que la confrérie porte passe devant

Dans la section **et** à l'intérieur d'un groupe. Le tri alphabétique dispersait
les trois lignes qui comptent au milieu de vingt-cinq qui ne concernent
personne. `potentiel: -1` marque un groupe que personne ne porte, ce qui sépare
les deux blocs — **et laisse P0 du bon côté**, un potentiel zéro étant
renseigné, pas manquant.

### Le sens de l'effet se lit dans le libellé

Rien d'autre ne le porte : `valeur` est une magnitude (5000 vaut « −50 % »
comme « +50 % »), et `cible` ne tranche pas — « dégâts subis par l'ennemi
+2 % » vise l'ennemi et **monte**. `sensDuLibelle()` n'accepte que `+` et le
vrai signe moins **U+2212**, ceux qu'emploient les tables. Une ligne future
écrite au trait d'union ASCII rend `null` et **la vue se tait** plutôt que
d'inventer un « + ». `tests/recensement-supports.test.js` le vérifie sur les
36 lignes concernées.

### Le total ne s'affiche que si le libellé ne le donne pas

C'est la **tournure** qui décide, pas la présence de `cumuls` :

- « Inflammation : défense de l'ennemi −0,15 % **par cumul**, 100 cumuls » →
  total affiché (−15 %) ;
- « Gelure : défense crit. de l'ennemi −20 % (10 cumuls) » → **rien**, son
  chiffre est déjà le total.

D'où le test `/par (cumul|coup)/` dans `libelleParCumul()`. Le contre-exemple
Gelure est explicitement gardé par un test.

### Les recensements sont en fin de page

Ils occupaient 3 234 px sur 4 000 et repoussaient au-delà du quatrième écran la
seule section qui répond à « qui j'emmène ». La coupure suit la nature de la
donnée : au-dessus ce que la confrérie possède, dérivé des rosters ; en dessous
ce que le jeu offre, lu dans deux tables qui ne dépendent d'aucun roster.

---

## 4. Pièges de ce dépôt, à ne pas redécouvrir

- **Commentaires en français SANS accents**, chaînes affichées avec accents,
  guillemets « » dans les commentaires, fins de ligne CRLF.
- **`tests/modules-imports.js`** impose l'ordre des couches ET **rejette tout
  export que personne n'importe**. Si tu supprimes le dernier appelant d'une
  fonction exportée, supprime l'export.
- **`tests/css-ordre.test.js`** fige l'ordre des `<link>`. `roster.css` charge
  avant `analyse.css` : c'est ce qui permet à `.db-tous` de surcharger
  `.elem-badge`. Ne réordonne pas.
- **Deux tests instables connus** : `supabase-etape1` (assertion des 44 px) et
  `accessibilite-mobile` (tuile du picker). **Relance avant de crier à la
  régression.**
- **CI Linux : polices plus larges qu'en local (Windows).** Une assertion de
  largeur peut passer chez toi et casser le déploiement.
- **`ERR_NO_BUFFER_SPACE`** sous Windows après plusieurs séries Playwright =
  épuisement de ports éphémères, pas un échec de test. Lance les e2e par
  groupes de trois.
- L'outil d'édition **convertit un échappement d'insécable en vrai caractère**
  dans les tables de `data/`. Passe par un jeton si tu dois en écrire un.

---

## 5. Ce qui reste ouvert, et que personne n'a tranché

- **Mention visible du lien d'affiliation LootBar.** Seul `rel="sponsored"` est
  présent, invisible pour les membres. Décision produit, pas technique.
- **`chevalier-sacre-electrocution`** : `cible:"soi"` alors que
  `cibleEnnemi:true`. Seule anomalie de la table, volontairement hors des deux
  recensements. **À vérifier en jeu.**
- **`d-eew`** : mesurer en jeu, puis retirer le drapeau `horsCalcul`.
- Deux améliorations d'affichage proposées et **non retenues pour l'instant** :
  signaler les cartes de Couverture à zéro (c'est la raison d'être de cette
  section : repérer les trous), et remplacer les cinquante « Personne » du
  recensement par un tiret.

---

## 6. Vérification avant de pousser

```bash
npm run test:unit
# puis les e2e par groupes de trois, pour ne pas épuiser les ports :
node tests/analyse-recensements.playwright.js
node tests/supabase-etape1.playwright.js
node tests/accessibilite-mobile.playwright.js
```

Et regarde la page. Les scripts jetables que j'ai utilisés ne sont pas dans le
dépôt, mais le harnais existe : `tests/helpers/serve.js` +
`tests/helpers/faux-supabase.js`, connexion avec `yannis@example.test`, puis
`.tab[data-view="analyse"]`. Une confrérie à deux membres ne montre rien : il
faut peupler `window.__fakeSupabaseState.roster_characters` pour juger.
