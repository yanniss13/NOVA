# Passation — comparateur DPS 60 s après revue

**Date :** 2026-08-05  
**Dépôt :** `C:\Users\yanni\Desktop\Site Confrérie 7ds`  
**Branche :** `comparateur-degats-lot1`  
**Dernier commit local :** `4673416 feat: comparer le dps theorique sur soixante secondes`  
**Publication :** aucun push effectué.

## Intention validée par le propriétaire

La fiche d'un héros doit comparer le DPS théorique des trois armes du même
personnage sur 60 secondes :

- niveaux réels du héros, du potentiel, des armes et des passifs ;
- conditions des passifs personnels supposées actives et cumuls au maximum ;
- recharges et ordre optimal de rotation modélisés ;
- ressources illimitées pour ce premier modèle ;
- attaques normales et temps d'animation encore exclus ;
- effets impossibles à borner annoncés sous « Non inclus dans le calcul ».

Ne pas pousser sans une autorisation explicite. Le menu de fin attendu reste :
merger localement / pousser et ouvrir une PR / laisser en l'état.

## État commité à `4673416`

Le commit contient le premier simulateur complet, son catalogue d'effets, le
rendu de la fiche, les tests et la documentation. Un `npm test` complet avait
fini vert en 201 secondes, avec les sept tests Playwright verts. Avant ce
succès, `potentiel-commun.playwright.js` avait révélé qu'une ancienne fiche à
un seul build lançait inutilement le simulateur ; ce cas avait été corrigé.

Ce vert ne suffit plus : une revue postérieure a trouvé des erreurs sémantiques
importantes. Le travail non commité ci-dessous les corrige en grande partie.

## Revue reçue

La revue a trouvé :

1. les `recharge-taux` de compétences étaient traitées comme des réductions
   permanentes de la durée de base ; une remise à zéro de Diane/Hache pouvait
   produire `RangeError: Maximum call stack size exceeded` ;
2. 172 règles de 169 sources étaient annoncées `modelise` mais n'avaient aucun
   effet et ne remontaient pas en exclusion ;
3. la recherche n'envisageait jamais d'attendre quand une action était
   disponible, même pour aligner un buff court avec une frappe ;
4. Elizabeth/Bâton pouvait afficher un faux `0/s` sans action temporelle
   simulable ;
5. le score de cycle historique absorbait par erreur les nouveaux bonus du DPS ;
6. le détail de rotation était comprimé sur mobile et son résumé faisait moins
   de 44 px ;
7. la chronologie retriait une action avant le tick qui l'avait débloquée.

## Modifications non commitées déjà faites

### Simulateur `js/metier/dps-simulation.js`

- Une `recharge-plate` appartenant à une compétence absente n'est plus un
  bonus permanent.
- Les réductions proportionnelles agissent désormais sur la recharge restante
  au déclenchement ; seules les règles explicitement marquées
  `application:"base"` modifient la durée de base.
- Les remises à zéro de la propre compétence, non bornées sans temps
  d'animation, sont exclues avec
  `reinitialisation-sans-animation-bornee` au lieu de boucler.
- `self`, `all-skills`, les déclencheurs et recharges internes sont suivis.
- Une attente ciblée est explorée lorsqu'un buff court expirerait avant la
  compétence qu'il prépare. Une première branche exhaustive était correcte
  mais trop lente ; elle a été remplacée par `prochainAlignementUtile`.
- Les modificateurs `targetDefRate`, `targetCritResist`,
  `targetCritDmgResist` et la résistance élémentaire `all` sont appliqués.
- Le cumul de dégâts déclenché par les ticks du Champ de Merlin est suivi.
- Les règles sans formule ou hors périmètre remontent dans `nonInclus` :
  perforation/brisure, attaques normales, relève, link, statuts non bornés,
  compétences transformées inconnues et périodicité non modélisée.
- Les dégâts additionnels périodiques sont programmés par ticks et
  tronqués à la borne au lieu d'être crédités immédiatement en entier.
- L'ordre causal des événements est conservé : tick puis action débloquée.
- Sans action normale/spéciale/ultime exploitable, le résultat renvoie
  `dps:null`, pas zéro.

### Générateur et catalogue

`scripts/generate-effets-dps.py` conserve maintenant :

- le déclencheur de la réduction de recharge (`skill`, `normal-skill`,
  `special`, `ultimate`, `hit` ou `condition-max`) ;
- la recharge interne de l'effet ;
- `application:"base"` pour le boost de réduction de recharge cumulé de
  Drake.

`scripts/effets-dps-regles.py` distingue maintenant :

- le potentiel Meliodas Épée 1 main, qui amplifie une autre réduction et ne
  doit pas devenir une réduction autonome ;
- le potentiel Meliodas Épées doubles, déclenché par la spéciale ;
- les recharges de base conditionnelles d'Elaine/Livre et Manny/Bâton.

`data/effets-dps.js` a été régénéré une première puis une deuxième fois
depuis les fiches publiques (2048 sources). **Attention :** les deux dernières
règles spécifiques Elaine/Manny viennent d'être ajoutées au Python mais le
catalogue n'a pas encore été régénéré après cet ultime changement.

### Vue et CSS

- `statsDeCycleHistorique` reconstruit l'ancien contrat : ATK, critique et
  `bonusType:0`, sans attaque élémentaire ni passifs du nouveau DPS.
- Un DPS inconnu s'affiche « Non disponible », jamais `0/s`.
- Le compteur résumé inclut aussi les exclusions produites par le simulateur.
- `.hd-puissance-ligne` est passée en grille ; le détail prend toute la
  largeur et le `summary` atteint 44 px sur mobile.

### Tests ajoutés ou renforcés

- attente rentable pour un buff court ;
- recharge proportionnelle déclenchée et recharge interne ;
- compétence source absente ;
- remise à zéro non bornée ;
- modificateurs de cible ;
- exclusion d'une formule inconnue ;
- cumul du Champ de Merlin ;
- ordre causal tick/action ;
- absence de faux zéro ;
- régression réelle Diane/Hache sur 60 s ;
- cycle historique séparé ;
- largeur et cible tactile à 320 px.

## Vérifications réellement passées depuis la revue

- `python -m unittest tests/test_generate_effets_dps.py` : 77 tests verts
  avant l'ajout du dernier test Elaine/Manny ; ce dernier est actuellement
  rouge tant que la règle spécifique n'est pas relancée dans le test.
- `node tests/dps-simulation.test.js` : vert.
- `node tests/dps-merlin.test.js` : vert.
- `node tests/fiche-heros.test.js` : vert.
- `node tests/effets-dps-catalogue.test.js` : vert, y compris Diane/Hache.
- `node tests/apport-par-piece.playwright.js` : vert après la correction
  mobile.

**Aucun `npm run test:unit` ni `npm test` complet n'a encore été relancé après
ces corrections. Ne pas les présenter comme vérifiées.**

## Ordre de reprise recommandé

1. Lancer `python -m unittest tests/test_generate_effets_dps.py` et terminer
   le test de recharge conditionnelle Manny ; la règle spécifique vient
   d'être ajoutée et devrait rendre ce test vert.
2. Régénérer `data/effets-dps.js` avec
   `python scripts/generate-effets-dps.py`. Cette aspiration est justifiée
   uniquement par les deux dernières règles spécifiques.
3. Relancer les tests ciblés DPS et le test Playwright de la fiche.
4. Auditer le diff de `js/metier/dps-simulation.js` : c'est une grosse
   correction non commitée et elle mérite une seconde revue attentive.
5. Vérifier le marqueur natif du `<summary>` : `display:flex` atteint 44 px
   mais peut masquer le triangle selon le navigateur. Préférer si besoin
   `display:list-item` avec un padding donnant 44 px.
6. Mesurer le temps des 72 branches héros/arme si possible. La recherche
   exhaustive d'attente avait explosé ; la version ciblée est rapide sur les
   tests actuels, mais les 72 branches ne sont pas encore chronométrées.
7. Lancer `npm run test:unit`, puis `npm test` complet. Relancer isolément
   `supabase-etape1` ou `accessibilite-mobile` seulement s'ils échouent, car
   ils sont connus comme instables.
8. Lancer `git diff --check`, une recherche de secrets et `git status`.
9. Faire une nouvelle revue de code, corriger les constats, puis committer en
   français sans accent. Ne pas pousser automatiquement.

## Fichiers probablement modifiés au moment de cette passation

- `css/roster.css`
- `data/effets-dps.js`
- `js/metier/dps-simulation.js`
- `js/vues/fiche-heros.js`
- `scripts/effets-dps-regles.py`
- `scripts/generate-effets-dps.py`
- `tests/apport-par-piece.playwright.js`
- `tests/dps-merlin.test.js`
- `tests/dps-simulation.test.js`
- `tests/effets-dps-catalogue.test.js`
- `tests/fiche-heros.test.js`
- `tests/helpers/load-app.js`
- `tests/test_generate_effets_dps.py`
- ce fichier de passation.

Vérifier avec `git status --short` : cette liste est indicative et ne remplace
pas l'état réel du worktree.

## Suite donnée le 2026-08-05

Les neuf étapes de reprise ont été exécutées. Ce qui suit remplace la section
« Vérifications réellement passées » ci-dessus.

### Un défaut supplémentaire, trouvé à la mesure

Les 72 branches héros/arme ont été chronométrées. Aucune n'explose (493 ms au
total, 39 ms au pire), aucune ne plante, aucune ne vaut zéro, et seule
Elizabeth/Bâton renvoie `null` — le comportement voulu.

Mais **merlin/Staff sortait à 12 704 de DPS quand toutes les autres branches
tenaient entre 500 et 3 500**. Diagnostic : quatre potentiels y pesaient 99,5 %
du total. Leurs textes disent « **l'attaque ultime** invoque un météore » ou
« la dernière frappe **des compétences normales** », mais le générateur les
classait tous `declencheur:"hit"` — que le simulateur lit comme « toute action
**ou tout tick** ». Ils se déclenchaient donc 158 fois en soixante secondes,
sur les ticks d'une compétence qui n'était même pas la leur. Trois d'entre eux
étaient rattachés à un ultime lui-même écarté du calcul.

Le défaut touchait **89 règles**, dont **65 nommaient explicitement une
catégorie**.

### Corrections apportées

- `declencheur_degats(texte)` dans `scripts/generate-effets-dps.py` déduit la
  catégorie que le texte nomme. Deux catégories nommées, ou aucune : le
  déclencheur reste `hit`, parce que trancher serait inventer.
- `declencheurJouable()` dans `js/metier/dps-simulation.js` : une règle dont
  la catégorie déclencheuse n'est jamais jouée est annoncée
  `declencheur-absent-de-la-rotation` au lieu de rester inerte en silence.
  Huit cas sur les 72 branches.
- Le `<summary>` passe de `display:flex` à `display:list-item` : les 44 px
  étaient atteints, mais le triangle natif disparaissait.

Après correction, merlin/Staff tombe à **2 434**, dans la plage des autres.
Répartition des déclencheurs : 37 ultime, 24 compétence normale, 14 spéciale,
18 encore `hit`.

### Vérifications réellement passées

- `python -m unittest tests/test_generate_effets_dps.py` : **79 verts**.
- `node tests/dps-simulation.test.js`, `dps-merlin`, `effets-dps-catalogue`,
  `fiche-heros` : verts.
- `node tests/apport-par-piece.playwright.js` : vert.
- **`npm run test:unit` : vert.**
- **`npm test` complet : vert, les sept Playwright compris**, sans aucune
  relance — `supabase-etape1` et `accessibilite-mobile` sont passés du premier
  coup.
- `git diff --check` propre, aucun secret dans le diff.

`data/effets-dps.js` a été régénéré deux fois : une première pour reporter les
règles Elaine/Livre et Manny/Bâton, une seconde après la correction des
déclencheurs. 2048 sources, audit à zéro inconnu.

### Ce qui reste ouvert

- Les **18 règles encore `hit`** se déclenchent sur chaque tick d'un dégât
  périodique. Aucune n'est aujourd'hui aberrante, mais rien ne les borne : si
  un futur héros combine un `hit` non borné et un périodique rapide, le
  problème réapparaîtra sous une autre forme.
- Aucune revue de code externe n'a été demandée sur ces corrections ; seule
  une relecture attentive du diff a été faite.
