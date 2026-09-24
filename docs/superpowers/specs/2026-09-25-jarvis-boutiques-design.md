# /jarvis — lot 2c, étape 1 : index des objets et boutiques

Date : 2026-09-25. Validé section par section par le propriétaire.

## But

Répondre sur Discord à deux questions des membres :

- « Où trouver X ? » — pour cette étape, dans quelles boutiques, à quel prix ;
- « Que vend telle boutique ? ».

Le lot 2c est découpé en trois étapes, livrées et testées séparément :
**boutiques** (celle-ci), puis **butins** (monstres, donjons, minage, boss
de confrérie), puis **recettes**. Chaque étape ajoute des sources au même
index d'objets. Butins, recettes et probabilités sont hors périmètre ici.

## Contraintes (rappel)

- Gemini palier gratuit uniquement : résultats d'outils bornés en taille.
- Données du jeu jamais dans le dépôt : `output/jarvis/objets.json` est
  ignoré par git et déposé dans le bucket privé `jarvis-prive`.
- Aucun chemin personnel dans un fichier suivi : l'export passe par
  `DONNEES_JEU`.
- Outils en lecture seule.

## La chaîne, vérifiée sur l'export du 22/09/2026

- `Table/Merchant/MerchantGoods.json` : 701 articles. Par ligne :
  `MerchantTid` (la boutique, avec `String_Tid`, `Local_Key`, `SellType`),
  `Sell_Asset` (`Item` ou `Currency`) + `Sell_Asset_Tid`, `GetCount`,
  `Payment_Asset` (`Currency` ou `Item`) + `Payment_Asset_Tid`, `Price`,
  `GoodsResetTime` (`Shop_Daily`, `Shop_Weekly`, `Shop_Monthly`,
  `Permanent`, `None`), `LimitCount`, `LimitLevelType`
  (`None` ou `World_Level`) + `LimitLevel`.
- 49 boutiques. Nom : `MerchantTid.Local_Key` en français
  (« Boutique d'équipement », « Boutique de la confrérie »…).
  `SellType::Random` = boutique itinérante, articles tirés au hasard.
- Boutique → PNJ :
  `InteractionButtonTable` (`ButtonDetailType:"merchant"`,
  `ButtonDetailValue01` = identifiant de boutique)
  → `InteractionTable` (`ButtonTid`)
  → `Actor/NPCActorTable` (`InteractionTid[]`), nom par `Local_Key`.
- PNJ → région : lignes des tables d'apparition
  (`Table/Scene/Zone/<zone>/**/_spawntable.json`) dont `ActorID` est le PNJ ;
  `TagMainSector` et `TagSubSector` se traduisent en minuscules dans la
  localisation (`ch01_sector_main_liones` → « Liones »,
  `ch01_sector_sub_liones_plain` → « Plaines de Liones »).
- 12 boutiques n'ont pas de PNJ : 11 boutiques d'échange d'événement et la
  boutique de la confrérie. Elles s'ouvrent depuis un menu.
- Objets : `Item/ItemTable_Data_{Etc,Equip,Use,Quest,Pet,DropType}.json`,
  nom par `Local_Key`. 2 783 objets, 2 400 noms distincts ; 244 noms sont
  portés par plusieurs identifiants. Les 313 objets vendus ont tous un nom.
- Monnaies : `Item/CurrencyTable.json` ; le nom passe par `LinkItemTid`
  (objet), la ligne elle-même n'a pas de `Local_Key`.

## Le fichier `objets.json`

```
{
  version: 1, genereLe, dateExport,
  objets: [
    { nom, type,
      sources: [
        { type: "boutique", boutique, prix, quantite?, limite?, condition?, aleatoire? }
      ] }
  ],
  boutiques: [
    { nom, genre, acces: "pnj" | "menu", pnj: [..], regions: [..], aleatoire?,
      articles: [ { objet, quantite?, prix, limite?, condition? } ] }
  ]
}
```

- `genre` : le nom du jeu (« Boutique d'équipement »).
- `nom` : unique dans le fichier. Boutique à PNJ : `genre` + « de » +
  première région principale de ses PNJ (« Boutique d'équipement de
  Liones »). Sans région : `genre` seul ; si deux boutiques restent
  homonymes, celle au plus petit identifiant porte le nom nu et les autres un suffixe
  numéroté (« … (2) »). Aucune région n'est inventée.
- `regions` : « Région principale (sous-région) », sans doublon, dans
  l'ordre de l'identifiant du PNJ.
- `prix` : « 1 800 Or », « 5 Jeton Magi★Pop » — quantité puis nom de la
  monnaie ou de l'objet demandé. Un paiement dont le nom est introuvable
  écarte l'article (et le compte en sortie de l'extracteur).
- `quantite` : `GetCount` quand il dépasse 1.
- `limite` : « 3 par jour » / « par semaine » / « par mois » selon
  `GoodsResetTime`, « 3 au total » pour `Permanent` ou sans période
  (`None`), absente si `LimitCount` vaut 0.
- `condition` : « à partir du niveau de monde N » pour `World_Level`.
- `aleatoire: true` sur la boutique itinérante et sur ses sources.
- `type` d'objet : famille de la table source — `Etc` Divers, `Equip`
  Équipement, `Use` Consommable, `Quest` Quête, `Pet` Familier, `DropType`
  Monnaie ; un nom partagé par plusieurs familles prend la première, dans
  cet ordre.
- Un nom partagé par plusieurs identifiants forme **une** entrée dont les
  sources sont l'union, sans doublon.
- Seuls les objets cités par au moins une source entrent dans l'index.
- Les monnaies vendues (`Sell_Asset:Currency`) entrent aussi, sous leur nom.

## Code

- `outils/fabrication/objets-jarvis.js` : logique pure,
  `construireCatalogueObjets(entree)`. Réutilise `lecteurDeTextes` de
  `monstres-jarvis.js`.
- `outils/fabrication/extraire-objets.js` : lit `DONNEES_JEU`, écrit
  `output/jarvis/objets.json`, affiche les comptes (objets, boutiques,
  articles écartés).
- `supabase/functions/_shared/discord-jarvis-objets.js` : validation,
  déclarations et exécution des deux outils. Lecture par
  `creerLecteurStockageJarvis`, chemin `jarvis-prive/objets.json`.
- `supabase/functions/discord-planning/index.ts` : importe le module et
  branche son lecteur, comme pour les monstres.

## Outils

`ou_trouver({ objet })` :

- recherche tolérante aux accents, à la casse et aux fautes proches, sur le
  modèle de `fiche_effet` ;
- plusieurs objets possibles pour un nom partiel : `candidats` (au plus 10),
  sans en choisir un ;
- sinon `{ nom, type, sources: ["Boutique d'équipement de Liones (Alexander,
  Liones (Plaines de Liones)) : 1 800 Or, 3 par jour"] }`, au plus 12
  sources, puis `autresSources: N` ;
- introuvable : `{ introuvable, proches }` (au plus 5).

`boutique({ nom, region? })` :

- correspondance sur `nom` puis sur `genre` ;
- un `genre` qui couvre plusieurs boutiques, sans `region` :
  `{ genre, regionsPossibles }` ;
- `region` filtre sur `regions` (tolérant aux accents) ;
- sinon `{ nom, acces, pnj, regions, aleatoire?, articles: ["Épée longue x1 :
  1 800 Or, 3 par jour"] }`, au plus 40 articles, puis `autresArticles` ;
- inconnue : `{ introuvable, boutiques }` (noms, au plus 30).

Source affichée : « boutiques · données du jeu du JJ/MM/AAAA ».

Consigne ajoutée : « Les prix et limites des boutiques viennent des fichiers
du jeu. La boutique itinérante tire ses articles au hasard : dis qu'elle peut
les proposer. Une source absente ne prouve pas qu'un objet est introuvable :
les butins ne sont pas encore couverts. »

## Erreurs

- Fichier absent, illisible ou mal formé : `{ erreur: "données des objets
  indisponibles" }` ; les autres outils de `/jarvis` fonctionnent.
- Le validateur refuse le fichier entier dès qu'une entrée est mal formée
  (même politique que les monstres).

## Tests

- `tests/objets-jarvis.test.js` (mini-export écrit dans le test) : boutique
  de ville à deux PNJ, boutique d'événement sans PNJ, boutique itinérante,
  paiement en objet, paiement en monnaie via `LinkItemTid`, limite
  hebdomadaire, limite définitive, condition de niveau de monde, deux objets
  homonymes, PNJ sans apparition (boutique sans région), paiement
  introuvable écarté, deux boutiques homonymes sans région.
- `tests/discord-jarvis-objets.test.js` : les deux outils sur le catalogue
  produit par la vraie extraction du mini-export ; bornes ; nom partiel
  ambigu ; faute proche ; genre sans région ; fichier abîmé refusé ;
  source datée.
- Les deux fichiers dans `scripts/lancer-tests.js`. Test de consigne dans
  `tests/discord-jarvis.test.js`. `npm test` et `deno check` (seules les
  trois erreurs `Blob` préexistantes sont admises).

## Mise en service

1. Redéployer `discord-planning`.
2. Déposer `output/jarvis/objets.json` dans `jarvis-prive`.

Aucun SQL, aucune commande Discord à réenregistrer. Documentation :
`docs/discord-planning.md`, `AGENTS.md`, `outils/fabrication/LISEZMOI.md`.
