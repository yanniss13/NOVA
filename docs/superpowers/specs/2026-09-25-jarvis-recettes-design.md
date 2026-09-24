# /jarvis — lot 2c, étape 3 : recettes

Date : 2026-09-25. Tranché sans le propriétaire (champ libre pour la nuit),
récapitulé à son réveil.

## But

- « Comment fabriquer / cuisiner X ? » : un outil `recette`.
- « Où trouver X ? » cite aussi la recette qui le produit.

## La chaîne, vérifiée sur l'export du 22/09/2026

Quatre tables de `Table/Making/`, même forme : `Material_TID_1..7` et
`Material_Cnt_1..7` (ingrédients), `Reward_Item_Tid_1` et
`Reward_Item_Cnt_1` (produit ; les emplacements 2 et 3 sont toujours vides,
`Reward_Type_1` toujours `Success`).

| Table | Lignes | `Function_Type` | Type affiché |
| --- | ---: | --- | --- |
| `CookingRecipeTable` | 341 | `ManualCook` / `AutoCook` | « Cuisine — Élaborer des recettes » / « Cuisine — Cuisiner la recette » |
| `ProductionRecipeTable` | 250 | `Production` | « Fabrication — Établi de fortune » (… jusqu'à « Établi de maître artisan ») |
| `BindingRecipeTable` | 100 | `AutoBind` / `ManualBind` | « Gravure » |
| `CombineRecipeTable` | 1 | `Combine` | « Combinaison » |

- Les libellés de cuisine et d'établi viennent de `MakingCategory`
  (`Function_Type` ou `Recipe_Type` → `Local_Key`). « Gravure » et
  « Combinaison » sont écrits ici : le jeu ne leur donne pas de catégorie
  nommée ; « gravure » est le mot du jeu pour ces sceaux (« Sceau de gravure
  usé »).
- Cuisine : `Material_Group_n` (même indice que l'ingrédient) désigne des
  ingrédients interchangeables, listés par `MakingList`
  (`Material_Group`) : « Riz x1 (ou : Orge, Blé, Maïs) ».
- **`MakingRecipe` est écartée** : 361 de ses 563 produits de fabrication
  n'ont pas de nom, et pour un même produit (« Établi robuste ») ses
  ingrédients diffèrent de `ProductionRecipeTable`. C'est une table
  périmée.
- Une recette dont le produit ou un ingrédient n'a pas de nom français est
  écartée.
- Conditions de déblocage (`Recipe_Open_Condition`, `Contents_Level`) : hors
  périmètre, leur sens n'est pas établi.

## Données : `objets.json`, version 1

- `recettes: [{ produit, quantite?, type, ingredients: ["Riz x1 (ou : Orge,
  Blé, Maïs)"] }]`, facultatif pour les anciens fichiers. Alternatives :
  au plus 4 noms, puis « et N autres ».
- Nouvelle source d'objet `{ type: "recette", origine: <type affiché> }`,
  après les boutiques et les butins. Un produit obtenu par deux recettes du
  même type n'a qu'une source.
- Recettes dédoublonnées (même produit, type, ingrédients). Une même
  recette en cuisine manuelle et automatique n'en fait qu'une, de type
  « Cuisine » (170 cas).
- Fabrication : `Recipe_Type` liste les établis où la recette apparaît ;
  le type affiché est le plus modeste, suivi de « ou supérieur » quand la
  liste en compte plusieurs (« Fabrication — Établi raffiné ou
  supérieur »).

## Outils

- `ou_trouver` : ligne « Recette : Cuisine — Cuisiner la recette ».
- `recette({ objet })` : recherche sur les produits (même classement) ;
  plusieurs produits de même rang → `candidats` ; sinon
  `{ produit, recettes: [{ type, quantite?, ingredients }] }`, au plus
  5 recettes, puis `autresRecettes`. Introuvable → `proches`.
- Source affichée : « recettes · données du jeu du JJ/MM/AAAA ».
- Consigne : la mention « les recettes ne sont pas encore couvertes »
  devient « les quêtes, succès, événements et coffres ne sont pas
  couverts ».

## Tests

- `tests/objets-jarvis.test.js` : cuisine manuelle avec groupe, cuisine
  automatique, établi, gravure, combinaison, ingrédient sans nom écarté,
  doublon fusionné, `MakingRecipe` ignorée (non lue), source « recette ».
- `tests/discord-jarvis-objets.test.js` : ligne `ou_trouver`, outil
  `recette` (exact, ambigu, introuvable, borne), validateur.
- Consigne et déclaration `recette`.
