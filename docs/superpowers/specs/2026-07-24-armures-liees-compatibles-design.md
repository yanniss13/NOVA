# Armures liées compatibles par personnage

**Statut :** design validé le 24 juillet 2026  
**Périmètre :** filtrage de l’emplacement `Armure liee` uniquement

## Contexte

Le team builder propose actuellement les 66 armures liées SSR à tous les héros.
Dans le jeu, chaque armure liée correspond pourtant à un costume gravé d’un
personnage précis. Les quatre emplacements classiques (`Haut`, `Bas`, `Bottes`
et `Ceinture`) restent universels.

Les données publiques embarquées dans le team builder de
`https://7dsorigin.app/fr/team-builder/create` permettent de relier les costumes
aux personnages. Les 66 images locales ont toutes été associées sans doublon :
les 24 héros disposent chacun de 2 ou 3 armures liées locales.

## Objectifs

- Ne proposer que les armures liées du héros sélectionné.
- Retirer automatiquement une armure liée devenue incompatible.
- Corriger les anciennes équipes lors du chargement ou de l’import.
- Conserver les autres emplacements d’armure entièrement inchangés.
- Garder l’application autonome et fonctionnelle hors ligne.
- Pouvoir régénérer manuellement les associations sans dépendance npm.

## Hors périmètre

- Aucun téléchargement automatique de nouvelles images.
- Aucune synchronisation planifiée avec GitHub Actions.
- Aucun appel à 7dsorigin.app pendant l’utilisation normale du site.
- Aucun usage des routes `/api/` ou des pages non publiques.
- Aucun filtrage de `Haut`, `Bas`, `Bottes` ou `Ceinture`.

## Données générées

Un nouveau fichier `armures-liees.js` expose une table générée :

```js
window.SEVEN_DS_ARMURES_LIEES = {
  "meliodas": [
    "7ds-armures-ssr/Armure liee/Défense simple.webp",
    "7ds-armures-ssr/Armure liee/Majesté bien malveillante.webp",
    "7ds-armures-ssr/Armure liee/Une nouvelle aventure.webp"
  ]
};
```

`index.html` charge ce fichier après `data.js` et `potentiels.js`. Il ne contient
aucune liste d’images codée en dur.

## Génération manuelle

Un script `generate-armures-liees.py` effectue une seule requête vers la page
publique du team builder lorsque l’utilisateur le lance explicitement.

Le script :

1. lit les costumes et leur personnage dans les données embarquées ;
2. conserve les costumes dont l’équipement gravé correspond à une armure liée ;
3. rapproche le nom français du costume du nom de fichier local ;
4. produit les chemins relatifs dans `armures-liees.js` ;
5. refuse d’écraser le fichier généré si une image locale est inconnue,
   dupliquée ou associée à plusieurs personnages.

Il ne télécharge aucune image. Une fermeture ou une indisponibilité de la source
empêche seulement une future régénération : la dernière copie commitée continue
de fonctionner localement et sur GitHub Pages.

## Comportement dans le builder

Des fonctions dédiées centralisent les règles :

- `linkedArmorsOf(charId)` retourne les fichiers autorisés ;
- `isLinkedArmorCompatible(charId, file)` valide un choix existant ;
- le sélecteur d’armure liée filtre `DATA.armures["Armure liee"]` avec cette
  table.

Lorsqu’un utilisateur clique sur `Armure liée` sans avoir choisi de héros,
l’application n’ouvre pas le sélecteur et affiche :

> Choisis d’abord un héros.

Pour un héros connu, le sélecteur affiche uniquement ses 2 ou 3 armures liées
présentes dans les assets locaux. Si aucune donnée compatible n’est disponible,
il affiche :

> Aucune armure liée compatible disponible.

Le sélecteur des quatre emplacements classiques garde son fonctionnement actuel
et continue d’afficher toutes les pièces du slot.

## Changement de héros et migration

Après un changement de personnage :

- l’arme incompatible est retirée selon la règle existante ;
- l’armure liée est conservée seulement si elle appartient aussi au nouveau
  personnage, sinon elle est mise à `null` ;
- les quatre armures classiques, les bijoux, le potentiel et la note sont
  conservés.

`normalizeHero()` applique la même validation aux données du `localStorage` et
aux imports JSON. Une ancienne armure liée incompatible est donc supprimée dès
la normalisation, sans message bloquant.

Pour un héros absent de la table générée, le comportement est fermé par défaut :
aucune armure liée n’est proposée et une valeur existante est retirée. Le site
ne retombe jamais sur la liste globale, afin de ne pas autoriser silencieusement
un équipement invalide.

## Vérifications

Les tests unitaires vérifieront :

- les 24 héros et les 66 fichiers locaux sont couverts ;
- chaque fichier est associé exactement une fois ;
- chaque héros possède 2 ou 3 armures liées ;
- une armure compatible est conservée et une armure incompatible est retirée ;
- les emplacements classiques ne sont pas filtrés.

Le parcours Playwright vérifiera :

- le message affiché sans héros ;
- les trois armures liées de Meliodas et l’absence des autres ;
- la suppression du choix après passage à un héros incompatible ;
- la normalisation d’une ancienne sauvegarde invalide ;
- le maintien du fonctionnement normal des autres armures.

## Exploitation responsable

La source n’est contactée que lors d’une régénération manuelle. Il n’y a ni
scraping périodique, ni tentative de dissimulation, ni contournement d’une
protection. Le fichier généré mentionne la source et sa date de génération.
Toute demande de retrait ou tout changement des conditions de la source devra
être respecté avant une nouvelle régénération.
