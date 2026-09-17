# Import du contenu jouable de Khala depuis les tables locales

Date : 2026-09-17  
Statut : conception validée par le propriétaire du projet

## Objectif

Mettre à jour NOVA depuis un export local du dossier `Content` du jeu et
intégrer Khala de bout en bout : assets, Builder, roster, Wiki, statistiques,
potentiels et calculateur. Les entrées internes sans nom ou sans localisation
jouable restent exclues.

La mise à jour doit être reproductible. Khala ne sera pas ajoutée directement
à la main dans les fichiers générés, car une régénération ultérieure
l'effacerait.

## Décisions de périmètre

- Seul le contenu jouable et localisé est importé.
- Khala est l'identité française de l'entrée interne `Calla`, identifiant héros
  `1029`.
- Ses trois armes sont `SwordDual`, `Cudgel3c` et `Gauntlets`, rendues dans
  l'interface par les dossiers existants Épées doubles, Nunchaku et Gantelets.
- Les deux entrées de `HeroMastery` sans nom jouable sont ignorées et un test
  verrouille cette exclusion.
- Les tables du jeu priment lorsqu'elles donnent une valeur ou un code
  explicite. Une donnée ambiguë reste absente ou signalée comme non couverte ;
  elle n'est jamais estimée.
- Les vingt-six héros existants ne changent que si un écart avec les tables du
  jeu est démontré par une comparaison structurée. Une différence de casse,
  d'espace ou de typographie n'est pas un changement métier.

## Architecture retenue

### 1. Extraction privée et normalisation

Un extracteur sous `outils/fabrication/` lit la racine indiquée par
`DONNEES_JEU`. Aucun chemin absolu vers l'export ne doit apparaître dans le
code, les fichiers générés ou la documentation publique.

L'extracteur lit uniquement les sources nécessaires :

- `Localization/Game/{fr,en}/Game.json` pour les noms et descriptions
  françaises affichées et les formulations anglaises déjà comprises par les
  normaliseurs du calculateur ;
- `Table/HeroMastery/*` pour les armes et la maîtrise ;
- `Table/Actor/HeroStatGroupTable.json` et les tables héros associées pour les
  statistiques et métadonnées ;
- `Table/Skill/DefaultSkillWeaponTypeTable.json`, `PC_SkillTable.json`,
  `PC_SkillBehaviorTable.json` et les tables de buffs pour les potentiels,
  compétences, coefficients et effets explicites ;
- les tables d'objets pour les armures gravées liées ;
- `UIImg` pour le portrait, les compétences et les armures liées.

Il produit dans `7ds-stats/` un instantané normalisé et réduit aux faits utiles
au site. Cet instantané ne contient ni chemin interne inutile, ni données des
deux entrées anonymes, ni payload brut.

### 2. Fusion dans les catalogues existants

Les générateurs concernés lisent l'instantané normalisé et fusionnent Khala
dans les mêmes structures que les héros existants :

- `data/personnages-meta.js` ;
- `data/potentiels.js` ;
- `data/wiki-competences.js` ;
- `data/competences.js` ;
- `data/stats-build.js` via les références de `7ds-stats/` ;
- les catalogues dérivés du calculateur, des jauges, de la rotation, des
  transcendances et du chronométrage.

La fusion est indexée par le slug canonique `khala`. Un doublon de slug, une
arme inconnue ou une forme de données incompatible fait échouer la génération.
Les fichiers `data/` restent les artefacts consommés par la PWA ; le navigateur
ne lit jamais l'export local ni `7ds-stats/`.

### 3. Assets

Les PNG sélectionnés dans `UIImg` sont convertis en WebP et rangés selon les
conventions actuelles :

- `7ds-personnages/khala.webp` pour le portrait ;
- `7ds-ui/skills/` pour les icônes de compétences ;
- `7ds-armures-ssr/Armure liee/` pour les trois armures liées jouables.

Les noms finaux suivent les conventions déjà consommées par les catalogues.
La liste d'assets n'est jamais écrite en dur dans l'application :
`scripts/generate-data.ps1` et le catalogue des armures liées sont régénérés
après la copie.

## Potentiels

Les potentiels sont reconstruits depuis la ligne
`<heros>_<arme>_grade_<palier>` de
`DefaultSkillWeaponTypeTable`. `Local_Key` désigne le texte français et
`Local_Replace` fournit les substitutions. La génération refuse :

- une clé de localisation absente ;
- un palier hors de 1 à 10 ;
- une arme qui ne fait pas partie des trois maîtrises du héros ;
- un texte final contenant encore un placeholder `{n}` ;
- un nombre de paliers différent de dix par arme.

Cette même source sert à comparer les potentiels des héros existants. Les
corrections de fond du patch peuvent être appliquées ; les écarts purement
typographiques sont ignorés.

Les instantanés numériques des paliers de stats principales restent cumulatifs,
comme l'exige `stats-build.js`. Ils ne sont produits que lorsque les codes et
valeurs sont démontrés. Les paliers qui modifient une compétence alimentent le
catalogue d'effets, pas les statistiques fixes du héros.

## Wiki et calculateur

La fiche Wiki de Khala expose dix-huit entrées : six par arme, passifs inclus.
Les noms et descriptions viennent des clés françaises de `PC_SkillTable`, avec
leurs substitutions complètement résolues. Les icônes référencées doivent
exister localement.

Le catalogue du calculateur exclut les passifs comme aujourd'hui et reprend les
compétences posables, leurs catégories, recharges et coefficients démontrables.
Les comportements simples et les sommes de coups prouvables sont normalisés
dans le contrat actuel de `data/competences.js`.

Les effets conditionnels ne sont ajoutés à `data/effets-dps.js` que si leur
statistique, leur valeur, leur déclencheur, leur portée et leur durée sont tous
lisibles. Sinon ils restent descriptifs et apparaissent parmi les effets non
couverts. « Bout en bout » signifie que Khala traverse toutes les vues et que
ses données calculables sont calculées, pas que les zones inconnues reçoivent
une valeur supposée.

## Comportement visible

Khala apparaît dans :

- le Builder et ses filtres ;
- le roster personnel et les rosters consultés ;
- le Wiki des personnages et des compétences ;
- l'Analyse et ses regroupements par élément ;
- la Collection lorsque ses équipements sont concernés ;
- le calculateur individuel et les rotations d'équipe.

Ses trois builds sont interchangeables comme ceux des autres héros. Une
configuration incomplète conserve les diagnostics actuels et n'affiche jamais
un faux total.

## Gestion des erreurs et sécurité du dépôt

La génération s'arrête avant toute publication si une source requise est
absente, illisible ou incohérente. Les sorties sont écrites de façon atomique
ou seulement après validation complète afin de ne pas laisser un catalogue
tronqué.

L'extracteur ne touche pas aux archives du jeu et ne contient aucun moyen de
contourner une protection technique. Il ne lit que les JSON et PNG déjà
exportés. Le workflow GitHub Pages continue d'exclure
`outils/fabrication/` et `7ds-stats/` de l'artefact publié.

Les fichiers non suivis existants, notamment les images d'ambiance et
`outils/fmodel/`, ne font pas partie du chantier et ne sont ni modifiés ni
supprimés.

## Vérifications

Les tests ciblés doivent prouver :

- vingt-sept héros jouables, avec `khala` présente dans tous les catalogues
  requis ;
- exactement trois armes compatibles pour Khala ;
- dix potentiels par arme et aucun placeholder résiduel ;
- dix-huit entrées Wiki et la couverture attendue du catalogue de calcul ;
- l'existence de chaque image référencée ;
- l'exclusion des deux entrées anonymes ;
- la reconstruction des statistiques sans terme opaque ;
- l'absence de changement inexpliqué sur les vingt-six héros existants.

La validation finale comprend :

1. les modes `--check` des générateurs qui en disposent ;
2. les tests unitaires ciblés sur les catalogues et le moteur ;
3. les parcours Playwright du Builder, du Wiki et du calculateur ;
4. une inspection visuelle de Khala sur bureau et mobile ;
5. `npm test` complet.

Le diff des catalogues générés est relu avant validation. Les totaux attendus
(héros, compétences, potentiels et assets) sont consignés dans les tests au
moment où l'extraction normalisée est stabilisée.

## Hors périmètre

- Publier ou intégrer les deux héros internes sans nom.
- Copier les 72 255 fichiers de l'export dans le dépôt.
- Remplacer immédiatement tous les générateurs fondés sur 7dsorigin.app.
- Déduire une formule de combat ou un effet depuis la seule prose.
- Modifier le schéma Supabase : l'ajout d'un héros et de ses catalogues ne
  nécessite aucune table ni RPC supplémentaire.
