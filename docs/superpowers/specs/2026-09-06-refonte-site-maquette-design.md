# Refonte complète du site — conception de la maquette

## Objet

Créer une maquette HTML interactive et responsive de la future interface du
site Confrérie 7DS. La maquette sert de référence visuelle et fonctionnelle
avant toute modification de l'application actuelle. Elle reprend la composition
simple fournie par le propriétaire : une grande image d'accueil, trois accès
essentiels et un second niveau consacré aux outils.

La maquette doit permettre de juger la navigation, la hiérarchie, la densité,
les composants et le comportement mobile. Elle ne lit ni n'écrit dans Supabase,
ne remplace pas `index.html` et ne modifie aucune donnée réelle.

## Résultat attendu

Le prototype sera servi depuis la racine du dépôt à l'adresse
`/docs/refonte-maquette/`. Il sera composé de fichiers autonomes dans ce dossier
et réutilisera en lecture seule les portraits et icônes déjà présents dans le
dépôt.

La maquette sera considérée comme réussie si :

- elle ressemble clairement à l'exemple validé, sans donner l'impression d'un
  tableau de bord générique ;
- toutes les fonctions visibles du site actuel ont une destination claire ;
- les parcours du Boss de Guilde sont immédiatement accessibles ;
- les vues principales sont réellement navigables dans le prototype ;
- le rendu fonctionne à 1440 px, 1024 px, 390 px et 320 px sans débordement
  horizontal ;
- les textes, boutons et états donnent une vision crédible du produit final ;
- le site actuel reste intact.

## Direction visuelle

### Palette

- **Abîme** `#050D14` : fond extérieur.
- **Ardoise** `#071A26` : fond principal de l'application.
- **Ardoise claire** `#0C2634` : panneaux actifs et survols.
- **Or ancien** `#B9852C` : filets, pictogrammes et repères.
- **Or clair** `#DDB45F` : actions principales et état actif.
- **Parchemin** `#EFE2C9` : titres et texte principal.
- **Brume** `#A9A39B` : descriptions et métadonnées.
- **Alerte** `#B95A4F` : erreurs et échéances urgentes uniquement.

Les aplats restent sombres et calmes. Les dégradés servent à assurer la
lisibilité sur les images, jamais à décorer une zone vide. L'or indique une
action, une sélection ou une information importante.

### Typographie

`Cinzel` reste la police des titres, des noms de héros et des repères de
navigation. Le texte courant utilise la pile système déjà fiable dans
l'application. Les données chiffrées utilisent des chiffres tabulaires quand
leur alignement compte.

Les titres sont en casse normale. Les petits libellés en capitales sont réservés
aux véritables repères de contexte, par exemple « Semaine du 7 septembre » ou
« Boss de guilde ».

### Formes et ornements

- angles légèrement arrondis, de 4 à 8 px selon la taille du panneau ;
- filets simples de 1 px, avec un second trait seulement sur les cadres majeurs ;
- losanges et étoiles utilisés comme points de séparation ;
- aucun halo permanent autour de toutes les cartes ;
- une seule zone spectaculaire par écran : l'image d'accueil, le boss courant,
  la composition d'équipe ou le héros ouvert.

Les pictogrammes sont dessinés en traits dorés ou proviennent des ressources
locales `7ds-ui/`. Les portraits viennent de `7ds-personnages/`. La maquette ne
génère pas de faux assets du jeu.

## Architecture de navigation

### Ordinateur

La barre supérieure comporte :

1. le sceau « 7 » et « Confrérie 7DS » ;
2. **Notre guilde** ;
3. **Équipes** ;
4. **Roster** ;
5. **Outils**, avec un menu regroupant Wiki, Collection, Calculateur et Analyse ;
6. la connexion ou le profil du membre.

La barre reste compacte. Les sous-vues sont affichées dans une barre locale sous
le titre de la rubrique, et non ajoutées à la navigation principale.

### Téléphone

L'en-tête porte le sceau, le nom court, la connexion et le bouton de menu. Une
barre fixe en bas donne accès à **Accueil**, **Équipes**, **Boss**, **Roster** et
**Plus**. Le panneau « Plus » contient Wiki, Collection, Calculateur, Analyse,
administration et compte.

Dans une rubrique complexe, des onglets horizontaux locaux restent visibles
sous son en-tête. Ils peuvent défiler sans déplacer la page.

### Correspondance avec le site actuel

| Nouvelle rubrique | Fonctions actuelles |
| --- | --- |
| Notre guilde | accueil public, Mon suivi, état de synchronisation, prochaines actions |
| Équipes | Team Builder, équipes disponibles, détail d'équipement, presets, import de captures |
| Boss | équipes du boss, disponibilités, groupes, recommandations, rapports et archives |
| Roster | mon roster, roster des membres, builds par arme et fiches détaillées |
| Outils | Wiki, Collection, Calculateur DPS, Analyse |
| Compte | connexion, migration locale, statut temps réel, mise à jour PWA, déconnexion |
| Administration | membres, invités et actions réservées aux administrateurs |

Le bouton **Boss** mobile ouvre directement le centre de commandement. Sur
ordinateur, le centre de commandement est accessible depuis la carte principale
« Boss de guilde » et depuis la rubrique Équipes.

## Écrans du prototype

### 1. Accueil public

Cet écran suit directement l'exemple fourni.

- À gauche de la grande image : « On prépare la suite, ensemble », une phrase
  sur les équipes, le roster et les sessions, puis « Créer mon compte » et
  « Explorer les outils ».
- À droite : une grande illustration recadrée, avec un voile sombre uniquement
  là où du texte doit rester lisible sur téléphone.
- Sous l'image : trois cartes **Boss de guilde**, **Roster de la guilde** et
  **Nos disponibilités**.
- En dessous : une bande plus basse avec Wiki, Collection, Calculateur et
  Analyse, puis un appel à la connexion.
- Le lien LootBar actuel reste présent de façon discrète dans le menu Outils ou
  dans le pied de page, avec son statut de lien sponsorisé conservé.

Sur téléphone, l'image précède le texte, les trois cartes deviennent une liste
compacte et les outils une liste à une ligne par destination, comme dans la
référence.

### 2. Mon suivi

Après connexion, « Notre guilde » ouvre le tableau de bord personnel plutôt que
la page promotionnelle. Le haut de page montre la semaine de boss, le prochain
reset et l'état de synchronisation.

Le contenu est organisé par actions :

- équipe à sélectionner ;
- session à rejoindre ;
- run en cours ;
- rapport à compléter ;
- runs terminées ;
- prochain créneau où plusieurs membres sont disponibles.

Chaque carte mène directement à la bonne sous-vue du Boss de Guilde. Les états
« rien à faire », cache hors ligne et erreur de lecture sont représentés.

### 3. Centre Boss de Guilde

Le centre Boss possède cinq onglets locaux : **Vue d'ensemble**, **Équipes**,
**Disponibilités**, **Groupes** et **Rapports**.

La vue d'ensemble affiche le boss courant, la semaine, le nombre de groupes, les
places libres, le prochain bon créneau et les actions du membre. Une grande
carte « Prochaine attaque » constitue le point visuel fort.

Les autres onglets couvrent :

- les équipes partagées avec filtre par membre et ouverture de l'équipement ;
- mes disponibilités et l'agrégation de la confrérie ;
- les groupes de 1 à 5 membres, l'équipe choisie et les recommandations ;
- la saisie du score et de la note, les corrections autorisées et les archives.

Les commandes administrateur permettant d'ajouter un membre ou de corriger une
run sont visibles dans un état de démonstration distinct.

### 4. Équipes et Team Builder

La rubrique contient **Créer une équipe** et **Équipes partagées**.

Le Team Builder conserve quatre héros. Sur ordinateur, une bande de composition
montre les quatre portraits et la zone de travail se concentre sur le héros
sélectionné. Sur téléphone, les quatre portraits deviennent un rail horizontal
et l'édition du héros occupe toute la largeur.

La fiche d'édition expose :

- personnage, potentiel et trois types d'arme compatibles ;
- arme équipée et configuration chiffrée ;
- haut, bas, bottes, ceinture et armure gravée ;
- anneau, collier et boucles d'oreilles ;
- qualités, renforcements, gravures, options et enchantements ;
- statistiques calculées et couverture partielle ;
- bonus d'équipe, note, nouvelle équipe et enregistrement ;
- presets et import depuis des captures.

Les équipements utilisent une présentation inspirée de la fiche Discord déjà
validée : portrait, icônes réelles, lignes dorées et jauges lisibles.

### 5. Roster

Deux modes restent disponibles : **Mon roster** et **Roster des membres**.
Recherche, filtres par élément, rôle et arme, choix du membre et compteur restent
présents.

Une carte montre portrait, potentiel, armes enregistrées, build favori et état
de complétude. La fiche détaillée permet de changer de build, marquer le favori,
copier l'équipement, supprimer un build, importer depuis une équipe, lancer
l'import par captures, ouvrir le comparateur DPS et enregistrer.

La consultation du roster d'un autre membre garde la navigation précédent / 
suivant et interdit visuellement les actions d'édition.

### 6. Outils

La page Outils est un index sobre de quatre destinations, chacune possédant sa
propre vue complète.

- **Wiki** : catégories Héros, Armes, Armures, Bijoux et Gravures ; recherche,
  filtres, grilles et fiches détaillées avec navigation.
- **Collection** : membre consulté, progression, filtres, objets possédés ou
  manquants et mise à jour des possessions autorisées.
- **Calculateur** : boss, deux builds comparés, compétences, cycle de 60 s,
  hypothèses, chronologie et détails du calcul.
- **Analyse** : Vue d'ensemble, DPS par élément et Supports Foudre, à partir
  d'une même lecture des rosters.

Les outils denses privilégient une barre de filtres collante et des panneaux
repliables sur téléphone.

### 7. Compte et administration

La maquette présente la connexion, le compte connecté, le statut temps réel,
l'import des anciennes données locales, la déconnexion et la proposition de
mise à jour PWA. Un état hors ligne explique précisément ce qui reste utilisable.

L'administration montre les comptes invités, les membres reconnus et les
actions autorisées, sans simuler une écriture réelle.

## Composants partagés

- `AppHeader` : marque, navigation, compte et menu mobile.
- `PageHero` : titre, explication, actions et éventuel visuel dominant.
- `LocalTabs` : sous-navigation d'une rubrique.
- `OrnatePanel` : cadre majeur à filet doré.
- `ActionCard` : action du tableau de bord avec état et échéance.
- `HeroStrip` : sélection compacte de héros.
- `EquipmentSlot` : image, nom, statut et action.
- `BuildSummary` : identité du build et statistiques expliquées.
- `BossRunCard` : groupe, participants, équipe, score et actions.
- `FilterBar` : recherche, filtres et compteur.
- `StatePanel` : vide, chargement, hors ligne, erreur ou accès refusé.
- `MobileNav` et `MoreDrawer` : navigation au pouce.

Les mêmes composants et espacements sont réutilisés dans tous les écrans. Les
cartes n'ont pas toutes la même forme : une carte d'action, une fiche de héros
et un groupe de boss gardent une hiérarchie propre à leur contenu.

## Interactions de la maquette

Le prototype utilise des données fictives déterministes et permet :

- de passer d'une rubrique à l'autre sans rechargement ;
- d'ouvrir et fermer le menu Outils et le menu mobile ;
- de changer les onglets locaux ;
- de sélectionner un héros, un build ou un groupe ;
- d'ouvrir une fiche ou une modale de démonstration ;
- de basculer entre état public et membre connecté ;
- d'afficher les états vide, hors ligne et erreur depuis un panneau de
  démonstration discret ;
- de tester le focus clavier et la restitution du focus à la fermeture.

Aucune interaction n'écrit dans `localStorage`, Supabase ou les données du site.

## Responsive et accessibilité

La mise en page comporte trois régimes :

- **large**, à partir de 1180 px : navigation complète, grilles et panneaux
  côte à côte ;
- **intermédiaire**, de 768 à 1179 px : grilles réduites et actions regroupées ;
- **mobile**, sous 768 px : une colonne, navigation basse et panneaux repliables.

Toutes les cibles tactiles atteignent 44 px. Les onglets et modales suivent les
conventions ARIA du site actuel. Le focus est visible en or clair. Les contrastes
sont vérifiés sur les fonds réels, et `prefers-reduced-motion` supprime les
transitions non nécessaires. Aucun geste tactile essentiel ne dépend d'un
glissement.

## Structure prévue du prototype

```text
docs/refonte-maquette/
├─ index.html       # structure et contenu de démonstration
├─ maquette.css     # palette, composants, responsive et états
└─ maquette.js      # navigation et interactions locales sans persistance
```

Le prototype référence directement les ressources existantes par chemins
relatifs. Il n'ajoute aucune dépendance, bibliothèque ou étape de build.

## Validation

La validation comprend :

1. un test statique vérifiant que toutes les destinations du site actuel sont
   représentées dans la maquette ;
2. un test navigateur des navigations desktop et mobile ;
3. une vérification des modales au clavier ;
4. des captures à 1440 × 1000, 390 × 844 et 320 × 700 ;
5. une inspection visuelle des alignements, débordements et contrastes ;
6. `npm test` afin de prouver que l'ajout du prototype ne casse pas le site.

## Hors périmètre

Cette étape ne remplace pas le balisage, le CSS ou les modules du site actuel.
Elle ne modifie ni le modèle de données, ni Supabase, ni le service worker, ni
les Edge Functions. Elle ne publie rien. La migration vers la nouvelle
interface fera l'objet de plans séparés après validation de la maquette.
