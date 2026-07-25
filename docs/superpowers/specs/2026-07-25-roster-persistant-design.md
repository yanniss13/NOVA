# Roster persistant par membre — Design

Date : 2026-07-25
Statut : design validé par l’utilisateur

## Objectif

Permettre à chaque membre de la confrérie d’enregistrer ses personnages équipés
une seule fois, puis de les réutiliser rapidement dans le builder. Le roster
d’un membre est visible par tous les membres connectés, mais seul son
propriétaire peut le modifier.

Cette fonctionnalité constitue la première partie d’une feuille de route en
trois sous-projets :

1. roster persistant ;
2. sessions de boss ;
3. PWA installable.

Les sessions et la PWA ne font pas partie de cette spécification.

## Principes de référence

Lorsque le comportement dépend du jeu, les libellés et catégories suivent les
données locales provenant de `7dsorigin.app` plutôt que des règles inventées.
Les filtres du roster reprennent les catégories vérifiées sur la page
Personnages : nom, élément, type d’arme, rôle et rareté.

Le site ne calcule aucune statistique absente des données locales. Il conserve
les règles déjà implémentées :

- potentiel commun T0–T10 par personnage ;
- trois types d’armes compatibles issus de `potentiels.js` ;
- élément et rôle dépendant du type d’arme ;
- armures liées filtrées selon le personnage ;
- une arme, cinq armures et trois bijoux par configuration.

## Décisions validées

- Une ligne Supabase représente un personnage d’un membre.
- Un membre ne possède qu’une fiche par personnage.
- Le potentiel est commun au personnage.
- Chaque type d’arme compatible possède au maximum une configuration
  modifiable.
- Une configuration contient une arme précise, cinq armures, trois bijoux et
  une note.
- Tous les membres authentifiés peuvent consulter tous les rosters.
- Seul le propriétaire ajoute, modifie ou supprime ses fiches.
- L’utilisation d’un personnage dans une équipe crée une copie indépendante.
- Modifier le roster ne modifie jamais rétroactivement une équipe enregistrée.
- Modifier une équipe ne modifie jamais automatiquement le roster.
- Le Recensement DPS reste séparé pour cette première version.

## Modèle Supabase

Une table `public.roster_characters` est ajoutée :

```sql
owner          uuid        not null references auth.users(id) on delete cascade
char_id        text        not null
potential_tier smallint    not null default 0
builds         jsonb       not null default '{}'::jsonb
updated_at     timestamptz not null default now()
primary key (owner, char_id)
check (potential_tier between 0 and 10)
```

Un index sur `owner` optimise la consultation du roster d’un membre. Le script
reste idempotent et peut être rejoué dans l’éditeur SQL Supabase sans supprimer
les données existantes.

### Forme de `builds`

`builds` est un objet indexé par le dossier du type d’arme compatible :

```js
{
  "Baguette": {
    weapon: "7ds-armes/Baguette/exemple.webp" | null,
    armor: {
      "Haut": "..." | null,
      "Bas": "..." | null,
      "Bottes": "..." | null,
      "Ceinture": "..." | null,
      "Armure liee": "..." | null
    },
    jewel: {
      "Anneau": "..." | null,
      "Collier": "..." | null,
      "Boucle d'oreille": "..." | null
    },
    note: "texte libre"
  }
}
```

Seules les clés présentes dans
`window.SEVEN_DS_POTENTIELS[char_id]` sont conservées. L’arme précise doit
appartenir au groupe correspondant à la clé. L’armure liée doit appartenir à
`window.SEVEN_DS_ARMURES_LIEES[char_id]`. Les autres valeurs d’équipement sont
normalisées avec les mêmes règles que le builder.

Une configuration peut être partielle, comme un héros du builder actuel : les
emplacements d’équipement restent facultatifs. Elle est créée lorsque le membre
enregistre explicitement l’onglet d’une arme. Les onglets compatibles non
enregistrés restent absents de `builds` et sont indiqués comme vides dans
l’interface.

## Sécurité RLS

La table active Row Level Security avec quatre politiques :

- lecture : rôle `authenticated`, condition `true` ;
- insertion : `owner = auth.uid()` ;
- mise à jour : `owner = auth.uid()` ;
- suppression : `owner = auth.uid()`.

Le client ne reçoit ni clé secrète ni capacité d’administration. Masquer les
boutons dans l’interface améliore l’expérience, mais les politiques RLS restent
la protection réelle.

## Stockage local et consommation Supabase

Le cache du roster partagé utilise une nouvelle clé locale distincte, par
exemple `confrerie7ds.cloud.roster`. Il sert à :

- afficher la dernière version chargée lors d’une coupure ;
- utiliser ses propres configurations en lecture dans le builder hors ligne ;
- éviter un rechargement inutile lors des changements de vue.

Une modification ou suppression du roster exige une connexion dans cette
version. Il n’existe pas de file d’attente de synchronisation hors ligne.

Le chargement est limité au membre consulté. Les futures vues d’organisation
peuvent sélectionner uniquement `owner`, `char_id` et `potential_tier` sans
télécharger tous les équipements.

Avec 24 personnages, trois configurations maximum et uniquement des chemins de
fichiers, le volume estimé est d’environ 120 Ko par membre. Cent membres
représenteraient environ 12 Mo de données brutes, très en dessous des 500 Mo de
base actuellement inclus dans le plan Free Supabase. Les images restent servies
par GitHub Pages et ne sont pas envoyées dans Supabase Storage.

## Interface du roster

Un nouvel onglet principal `Roster` contient deux modes :

### Mon roster

- ajout d’un personnage ;
- modification de son potentiel et de ses configurations ;
- suppression avec confirmation ;
- import explicite depuis une équipe appartenant au membre.

### Roster des membres

- choix d’un membre authentifié ;
- consultation en lecture seule ;
- aucun bouton d’ajout, modification, import ou suppression.

La barre de filtre contient :

- recherche par nom ;
- élément ;
- type d’arme ;
- rôle ;
- rareté.

Ces filtres utilisent `personnages-meta.js` et les données locales déjà
générées. Aucun appel externe à `7dsorigin.app` n’est effectué par le navigateur.

### Carte de personnage

Chaque carte affiche :

- portrait et nom ;
- rareté ;
- potentiel commun ;
- trois armes compatibles ;
- état enregistré ou vide de chaque configuration.

### Éditeur

L’éditeur reprend le thème héraldique et les composants de sélection existants.
Il affiche :

1. le potentiel commun en tête ;
2. un onglet par type d’arme compatible ;
3. dans l’onglet actif, l’arme précise, les cinq armures, les trois bijoux et la
   note.

Sur téléphone, les onglets d’arme peuvent défiler dans leur propre conteneur,
sans agrandir la largeur du document.

## Intégration avec le builder

Chaque emplacement d’équipe propose :

- `Depuis mon roster`, mis en avant pour le membre connecté ;
- `Choisir manuellement`, qui conserve le parcours existant.

Le parcours roster est :

1. choisir un personnage de son propre roster ;
2. choisir l’une de ses configurations d’arme enregistrées ;
3. copier la configuration normalisée dans le slot de l’équipe.

La copie inclut le personnage, l’arme précise, les armures, les bijoux, la note
et le potentiel commun. Elle est ensuite totalement indépendante. Un bouton
`Recharger depuis mon roster` peut remplacer explicitement le slot par la
version actuelle du roster.

Le builder manuel reste disponible hors connexion. Le roster mis en cache peut
être utilisé pour remplir une équipe hors connexion, sans autoriser sa
modification.

## Reprise depuis les équipes existantes

Il n’y a pas de migration automatique. Sur les personnages des équipes dont
`owner === currentUser.id`, une action explicite permet :

- `Ajouter au roster` si le personnage est absent ;
- `Mettre à jour ce build dans mon roster` si la configuration du même type
  d’arme existe déjà.

Avant un remplacement, la confirmation nomme le personnage et le type d’arme.
Seule la configuration correspondante est remplacée. Les équipes sources ne
sont jamais modifiées. Si le héros de l’équipe n’a pas d’arme compatible
permettant d’identifier sa configuration, l’action d’import est désactivée et
explique qu’une arme compatible doit d’abord être équipée.

## Erreurs et cohérence

- Une sauvegarde réussie met à jour le cache local.
- Une sauvegarde échouée garde l’éditeur et les saisies ouverts.
- Les erreurs sont affichées en français avec le système de notification
  existant.
- Une réponse Supabase est normalisée avant affichage ou copie.
- Une arme incompatible, une armure liée incompatible ou une clé d’arme
  inconnue est retirée automatiquement.
- Un `char_id` absent des données locales est ignoré sans empêcher le rendu des
  autres fiches.
- En cas de sauvegardes successives du même propriétaire, la dernière requête
  réussie fait foi ; aucune édition simultanée multi-appareil avancée n’est
  ajoutée.

## Vérification

Les tests automatisés couvrent :

- présence de la table, des contraintes et des politiques RLS dans le SQL ;
- création, lecture, modification et suppression d’une fiche ;
- lecture d’un autre membre sans actions d’écriture ;
- refus logique des types d’armes incompatibles ;
- potentiel commun aux trois configurations ;
- normalisation de l’arme précise et de l’armure liée ;
- sauvegarde et lecture du cache ;
- copie indépendante d’une configuration vers le builder ;
- absence de modification du roster après édition de la copie ;
- import explicite depuis une équipe propriétaire ;
- conservation des saisies lors d’une erreur Supabase ;
- affichage à 320, 360 et 390 pixels sans débordement global ;
- maintien de la suite complète `npm test`.

## Hors périmètre

- plusieurs builds pour un même type d’arme ;
- calcul ou simulation de statistiques ;
- synchronisation automatique avec le Recensement DPS ;
- synchronisation hors ligne différée ;
- temps réel multi-appareil ;
- sessions de boss ;
- installation PWA ;
- récupération automatique de nouvelles données depuis le site de référence.

## Références vérifiées

- `https://7dsorigin.app/fr/personnages` : catégories Élément, Arme, Rôle et
  Rareté.
- `https://7dsorigin.app/fr/team-builder` : équipe de quatre héros et
  configurations d’équipement.
- `https://supabase.com/pricing` et
  `https://supabase.com/docs/guides/platform/database-size` : quotas Free
  consultés le 2026-07-25.
