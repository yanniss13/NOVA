# Suivi de collection — armes et armures gravées

**Date :** 2026-08-07
**État :** validé, prêt pour le plan d'implémentation

## Objectif

Donner à chaque membre la liste de ce qu'il lui **reste à trouver**. Il coche
ce qu'il obtient en jeu, l'objet quitte la liste, et ce qui demeure est
exactement ce qu'il doit chasser.

Périmètre : les **155 armes** et les **68 armures gravées**, soit 223 objets.

## Décisions prises avec le commanditaire

| Question | Réponse retenue |
|---|---|
| Portée | **Partagée** avec la confrérie, comme le Roster : chacun tient la sienne, tous peuvent la consulter |
| Objets équipés | **Comptés d'office** comme possédés, et non décochables tant qu'ils sont équipés |
| Contenu de la liste | **Tout, avec des filtres**, dont un filtre « utile à mon roster » |

## Ce qui existe déjà et n'est pas à refaire

- **Les 223 objets, avec leurs images et leurs statistiques.**
  `js/metier/wiki-equipement.js` publie `armesDuWiki()` et `graveesDuWiki()`,
  qui joignent déjà `data/data.js` à `data/stats-build.js` par le chemin de
  l'image. La collection réemploie ces deux fonctions ; elle n'énumère rien
  elle-même.
- **Le chemin de l'image est la clé de tout le site** — des grilles, des
  statistiques, des builds du roster. C'est donc la clé de la collection.
- **Le patron d'une table possédée mais lisible par tous** :
  `public.roster_characters` et ses quatre politiques RLS.
- **Le sélecteur de membre** : `renderMemberRosterControls(profiles, ownerId)`
  et `sessionCourante.rosterProfiles` alimentent déjà une liste déroulante des
  membres dans le Roster.
- **La lecture du roster d'un membre quelconque** : `MemberRosterStore.all(id)`
  et `MemberRosterStore.refresh(id)`.
- **La synchro temps réel** : le canal de `js/vues/synchro-temps-reel.js`
  écoute déjà plusieurs tables ; une de plus n'ajoute pas de connexion.
- **Les grilles de vignettes et leurs filtres** : `css/wiki.css` porte
  `.wiki-grid` et `.wiki-tile`, la collection les reprend.

## Stockage : une ligne par objet possédé

```sql
create table if not exists public.collection_items (
  owner      uuid not null references auth.users(id) on delete cascade,
  item       text not null,
  created_at timestamptz not null default now(),
  primary key (owner, item)
);
create index if not exists collection_items_owner_idx
  on public.collection_items(owner);
```

`item` est le chemin de l'image — `7ds-armes/Hache/Hache de guerre.webp`.

RLS calquée sur celle du roster : `select` pour tout membre connecté,
`insert` / `delete` réservés au propriétaire (`owner = auth.uid()`).
Pas de politique `update` : une ligne n'a rien à modifier, elle existe ou non.

**Pourquoi une ligne par objet plutôt qu'un tableau par membre.** Un tableau
imposerait de réécrire les 223 entrées à chaque clic ; deux appareils ouverts
en même temps se marcheraient dessus et des coches disparaîtraient
silencieusement. Le dépôt a déjà rencontré ce problème sur `roster_characters`
et a dû lui adjoindre un verrou de comparaison-et-échange. Ici, cocher est un
`insert` et décocher un `delete` : deux opérations atomiques qui ne peuvent
rien écraser. Le coût est de 223 lignes par membre au maximum — négligeable.

## La règle de possession

> Un objet est possédé s'il est **marqué explicitement** ou **équipé dans un
> build du membre affiché**.

La part équipée se dérive des lignes de roster déjà chargées : pour chaque
personnage, `builds[type].weapon` et `builds[type].armor["Armure liee"]`.

Un objet équipé **ne se décoche pas**. Sa vignette porte un cadenas et une
infobulle qui en donne la raison — « équipé sur Derieri (Hache) ». Autoriser
le décochage produirait un état incohérent : le membre affirmerait ne pas
posséder ce qu'il a équipé.

**Conséquence assumée** : déséquiper un objet jamais marqué explicitement le
fait retomber dans les manquants. C'est correct — le site n'a plus aucune
raison de croire qu'il est possédé — mais c'est surprenant. Le remède est à la
portée du membre : cocher l'objet avant de le déséquiper. Le cas est rare et
un marquage automatique à la première apparition créerait des faux positifs
bien plus difficiles à corriger.

## L'onglet

Un **9ᵉ onglet, « Collection »**, et non une catégorie du Wiki.

Le Wiki est une référence impersonnelle et sans propriétaire. La collection a
besoin d'un sélecteur de membre, d'un compteur de progression et d'un filtre
par défaut sur les manquants — trois choses qui n'y ont pas leur place, et qui
brouilleraient une page dont la clarté vient justement de son impersonnalité.

**Coût connu et accepté** : `tests/accessibilite-mobile.playwright.js` compte
les onglets et vérifie que `Fin` mène au dernier. Il passe de 8 à 9.

### Contenu

1. **En-tête** : sélecteur de membre (« Ma collection » par défaut), et un
   décompte de la forme « 84 / 223 possédés — 139 à trouver ».
2. **Filtres** : possession (manquants par défaut, possédés, tout), famille
   (armes / gravées / les deux), rareté, type d'arme, héros lié, et
   **« utile à ce roster »**.

   Ce dernier se rapporte toujours au **membre affiché**, jamais à celui qui
   regarde : sur la collection d'un autre, il répond « que lui manque-t-il pour
   ses personnages », qui est la seule question intéressante. Son libellé dit
   « mon roster » sur sa propre collection et « le roster de <pseudo> » sur
   celle d'un autre, pour que la réponse ne soit jamais devinée.
3. **Deux grilles** : Armes, puis Armures gravées, en vignettes.

### Le geste

La page s'ouvre sur les **manquants**. Un clic sur une vignette marque l'objet
possédé ; comme le filtre courant montre les manquants, la vignette disparaît.
Un toast nomme ce qui vient d'être marqué.

**Pas de bouton « Annuler » dans le toast.** `toast(msg, isErr)`
(`js/vues/toast.js`) n'accepte pas d'action, et lui en ajouter une toucherait
un composant partagé par tout le site pour un seul appelant. Le retour en
arrière passe par le filtre « possédés », d'où un second clic décoche. Deux
gestes pour réparer un clic malheureux, sans nouveau composant : le compromis
est explicite.

Consulter la collection d'un **autre membre** est en lecture seule ; les
vignettes ne réagissent pas au clic et le compteur reste affiché.

## Architecture

### 1. `supabase/schema.sql` *(modifié)*

La table et ses trois politiques, dans le style idempotent du fichier.

### 2. `js/donnees/collection-store.js` *(créé)*

```js
CollectionStore.all(ownerId)        // les chemins marqués, depuis le cache
CollectionStore.refresh(ownerId)    // relit la table pour ce membre
CollectionStore.mark(item)          // insert pour l'utilisateur courant
CollectionStore.unmark(item)        // delete pour l'utilisateur courant
```

Cache hors ligne cloisonné par compte, sur le modèle de `roster-store.js`, et
**jamais utilisé pour accorder un droit** — la RLS reste seule juge.

### 3. `js/metier/collection.js` *(créé)*

Pur, sans DOM ni réseau, donc testable seul :

```js
equipesDuRoster(entrees)              // Set des chemins équipés dans un roster
possessionsDe(marques, equipes)       // Set fusionné, la règle de possession
utilesAuRoster(entrees, objets)       // Set des chemins qui servent à ce roster
progressionDe(objets, possessions)    // {total, possedes, manquants}
```

Pas de fonction `estVerrouille()` : un objet est verrouillé s'il appartient à
l'ensemble rendu par `equipesDuRoster`, et une fonction d'une ligne pour le
dire n'ajouterait qu'un nom à retenir. `utilesAuRoster` reçoit les objets parce
que l'utilité se juge sur leur type et leur héros, que le roster ignore.

`utilesAuRoster` : une armure gravée sert si son `character` figure dans le
roster ; une arme sert si son `weaponType` correspond à un type manié par un
des personnages. ⚠️ Les deux vocabulaires diffèrent — `weaponTypesOf(charId)`
rend des **noms de dossier** (« Hache »), `weaponsByFile[].weaponType` rend un
**enum** (« Axe ») — et `FOLDER_TO_ENUM` fait le pont. Comparer sans lui
donnerait un ensemble vide.

### 4. `js/vues/collection.js` *(créé)*

L'onglet : sélecteur de membre, filtres, grilles, geste de marquage.
Réemploie `armesDuWiki()` et `graveesDuWiki()`.

### 5. Intégration

- `index.html` : 9ᵉ onglet, `<section id="view-collection">`, feuille liée.
- `js/app.js` : import et `enregistrerVue("collection", …)`.
- `sw.js` : les trois modules et `css/collection.css` dans `CORE_ASSETS`.
- `tests/helpers/modules.js` : les trois modules dans leur couche.
- `js/vues/synchro-temps-reel.js` : la table dans la liste écoutée.
- `AGENTS.md` : la table, la règle de possession et le piège des vocabulaires.

## Tests

### `tests/collection.test.js` *(créé, unitaire)*

Le module métier dans un `vm` : la fusion marqué + équipé, un objet équipé
verrouillé, `utilesAuRoster` sur les deux vocabulaires d'arme, la progression,
et la tolérance à un roster vide ou absent.

### `tests/collection-schema.test.js` *(créé)*

Le SQL commité : la table, sa clé primaire composite, ses trois politiques, et
l'**absence** de politique `update`. Sur le modèle de
`tests/roster-schema.test.js`.

### `tests/collection.playwright.js` *(créé)*

Le parcours réel avec le faux Supabase déjà en place : l'onglet s'ouvre sur les
manquants, un clic fait disparaître une vignette et incrémente le compteur, le
filtre « possédés » la retrouve, un second clic la décoche, un objet équipé
apparaît coché et verrouillé, le filtre « utile à mon roster » restreint la
grille, et la collection d'un autre membre ne réagit pas au clic.

### Tests existants à ajuster

`tests/accessibilite-mobile.playwright.js` : 8 onglets deviennent 9, et `Fin`
mène désormais à `#view-collection`.

## Hors périmètre

- Les armures et bijoux non gravés (99 pièces). Ils appartiennent à des
  ensembles et se remplacent ; la rareté qui justifie une chasse est du côté
  des armes et des gravées.
- Le niveau, le nombre d'exemplaires, les doublons.
- Un tableau croisé « qui possède quoi » à l'échelle de la confrérie. La
  consultation d'un membre à la fois répond déjà à la question posée.
- Un lien depuis la fiche du Wiki vers la collection.

## Risques

- **Le décochage par déséquipement**, décrit plus haut. Assumé et documenté
  dans l'interface plutôt que masqué.
- **Le 9ᵉ onglet** allonge une barre qui défile déjà sur mobile. Si elle
  devient impraticable, le regroupement des onglets est un chantier propre,
  distinct de celui-ci.
- **Le premier remplissage est long** : 223 objets à passer en revue. Les
  équipés cochés d'office et le filtre « utile à mon roster » sont là pour que
  le membre commence par les quelques dizaines qui le concernent.
