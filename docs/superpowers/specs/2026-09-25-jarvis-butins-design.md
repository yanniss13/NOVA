# /jarvis — lot 2c, étape 2 : butins

Date : 2026-09-25. Le propriétaire a laissé le champ libre pour la nuit
(« ne me demande plus rien ») : les choix ci-dessous sont tranchés sans lui et
récapitulés à son réveil.

## But

- « Où trouver X ? » inclut les butins : monstres, captures, minage,
  donjons, boss de confrérie.
- « Que lâche Banakro ? », « que rapporte tel donjon ? » : un nouvel outil
  `butin`.

> **Révisé le 25/09/2026** : les chances sont affichées, avec la règle
> vérifiée contre 7dsorigin.app (paquet aléatoire = poids ; Belette 80 %,
> et non les 20 % d'un premier calcul) ; voir `docs/discord-planning.md`,
> « Chance de butin ». La décision ci-dessous est l'état d'avant.

## Décision : aucune probabilité

`DropPackTable` répète un même objet avec un taux par niveau de monde
(`Standard_Level` : 150, 350, 600, 1000 pour Banakro), `DropGroupTable`
pondère ses paquets (`DropPack_Rate`) et marque certains d'un booléen
(`DropPack_Type`) dont le sens n'est pas établi. Sans confirmation du
propriétaire sur un exemple concret, aucun pourcentage n'est publié :
l'outil dit ce qu'une source **peut** donner, et la consigne interdit au bot
d'inventer un taux. Question à poser au propriétaire : voir la fin.

## La chaîne, vérifiée sur l'export du 22/09/2026

- Groupe → paquets : `Drop/DropGroupTable[groupe].DropPack_Key[]`.
- Paquet → lignes : `Drop/DropPackTable`, lignes dont `DropPack_Key` est le
  paquet. `DropType` : `Item` → `Item_Tid` ; sinon une monnaie dont la clé
  est le suffixe en minuscules (`Seal_Liones` → `seal_liones`,
  `Gold` → `gold`) → `CurrencyTable[clé].LinkItemTid` → objet. Un type sans
  monnaie (`Exp`, `HawkPassExp`, `Subscription`…) ou un objet sans nom
  français est ignoré.
- Sources :
  - monstre : `MonsterActorTable[id].DropGroupTid` (258 acteurs) ;
  - capture : `MonsterActorTable[id].CatchDropGroupTid` (140) ;
  - minage : `Actor/MiningObjectTable[id].DropGroupTid`, nom par
    `Local_Key` (23 points nommés) ;
  - donjon : `Dungeon/DungeonTable[id].Reward_Tid` (« récompense ») et
    `First_Reward_Tid` (« première victoire ») ; nom par
    `DungeonGroupTable[Dungeon_Group]` (`Local_Main_Name`,
    `Local_Main_Sub_Name`) et difficulté `Local_Sub_Name` ;
  - confrérie : `Guild/GuildContentRewardTable`, `Reward_Drop_NN` avec
    `Reward_Check_NN` > 0 (paliers 5, 10, 13, 16, 20, 25, remise à zéro
    hebdomadaire).
- Hors périmètre : coffres et points d'interaction (`InteractionTable`,
  pas de chaîne sûre jusqu'à leur nom), quêtes, succès, événements, passe.

## Données : `objets.json`, version 1 inchangée

- Nouvelles sources d'objet :
  `{ type: "monstre"|"capture"|"minage"|"donjon"|"confrerie", origine, detail? }`.
  `origine` : « Banakro », « Mouette », « Minerai de fer »,
  « Mine de Ferzen — Nid (Difficile) », « Boss de confrérie ».
  `detail` : « première victoire » (donjon), « palier de participation 5 »
  (confrérie).
- Nouveau tableau `butins` :
  `[{ nom, type, detail?, objets: [nom…] }]`, une entrée par
  (origine, type, detail), objets dédoublonnés dans l'ordre des tables.
  Deux acteurs de même nom (versions d'un monstre) fusionnent.
- Les sources de boutique restent en tête de chaque objet.
- `version` reste 1 : le validateur accepte les nouveaux types, et
  `butins` est facultatif pour qu'un ancien fichier reste lisible.

## Outils

- `ou_trouver` : lignes « Butin de monstre : Banakro », « Capture :
  Mouette », « Minage : Minerai de fer », « Donjon : Mine de Ferzen (Normal),
  première victoire », « Boss de confrérie, palier de participation 5 ».
  Même plafond de 12 sources, boutiques d'abord.
- `butin({ nom })` : recherche sur `butins[].nom` (même classement que
  `ou_trouver`) ; plusieurs sources de même rang → liste (`candidats`,
  « nom — type ») ; sinon `{ nom, type, detail?, objets: [≤ 40],
  autresObjets?, noteProbabilites }` avec la note « la table ne donne pas de
  probabilité lisible : ne cite aucun taux ». Introuvable → `proches`.
- Source affichée : « butins · données du jeu du JJ/MM/AAAA ».
- Consigne : « Les butins disent ce qu'une source peut donner, jamais avec
  quelle chance : ne donne aucun pourcentage de butin. » La phrase « les
  butins ne sont pas encore couverts » devient « les recettes ne sont pas
  encore couvertes ».

## Tests

- `tests/objets-jarvis.test.js` : monstre, deux acteurs homonymes fusionnés,
  capture, minage, donjon (récompense et première victoire), confrérie
  (palier), monnaie par `DropType`, `Exp` ignoré, objet sans nom ignoré,
  paquet absent sans plantage, sources de boutique toujours en tête.
- `tests/discord-jarvis-objets.test.js` : lignes de `ou_trouver` pour chaque
  type, outil `butin` (exact, ambigu, introuvable, borne à 40, note),
  validateur (type inconnu refusé, `butins` facultatif).
- Tests de branchement : déclaration `butin`, consigne.

## Question pour le propriétaire (au réveil)

Sur Banakro, « Fragment de carapace brillant » a quatre taux : 150, 350,
600 et 1000, un par niveau de monde 1 à 4. Lit-on 1,5 %, 3,5 %, 6 % et
10 % de chance par victoire ? Si oui, les taux pourront être ajoutés.
