# Souverain cupide dans le calculateur

## Objectif

Le calculateur de degats doit pouvoir simuler les bonus temporaires de
Souverain cupide apres une competence de releve. Cette simulation est un etat
local du calculateur : elle ne modifie ni l'equipe, ni le roster, ni les
configurations d'equipement sauvegardees.

Le chantier ne couvre que Souverain cupide. Les autres effets conditionnels ou
aleatoires d'ensembles restent descriptifs tant qu'une source publiee et un
modele de scenario ne permettent pas de les calculer sans approximation.

## Etats et regle de remplacement

Le calculateur propose un selecteur exclusif :

| Etat | 5 ou 6 pieces | 7 pieces |
| --- | ---: | ---: |
| Aucun buff temporaire | aucun | aucun |
| Apres une releve | chances crit. +3 % | chances crit. +6 % |
| Apres deux releves | chances crit. +7 %, percement de defense +7 % | chances crit. +12 %, percement de defense +12 % |

Le seuil du premier palier est celui publie par le set, `fourCount:5`, et non
le nom historique du champ. A sept pieces, le palier sept remplace entierement
le buff temporaire du palier precedent : +3 % et +6 % ne s'additionnent donc
jamais, et les deux versions du buff a deux releves ne coexistent jamais.

Les bonus fixes du set continuent de passer par `gearSetTerms()` comme
auparavant. Le selecteur ne represente que les effets temporaires apres releve.

## Donnees et moteur

`data/passifs-ensembles.js` sera une table ecrite a la main. Elle contiendra
les deux paliers de `equip_t5_greed`, leurs trois etats, les codes de stat
publies `C_Critical_Rate` et `D_Protect_Cur_Rate`, et une provenance textuelle
par valeur. Aucun fichier genere n'est modifie.

Chaque nombre est relu depuis `SEVEN_DS_BUILD_STATS.gearSets.equip_t5_greed`.
Le test nettoie les balises de couleur puis cherche une phrase d'ancrage qui
apparait exactement une fois dans le texte du palier vise; le pourcentage doit
suivre immediatement. Une faute de transcription, un changement du texte, ou
un code absent de `statLabels` echoue donc explicitement.

Un module pur `js/metier/passifs-ensembles.js` recoit les ensembles actifs et
l'etat choisi. Il expose seulement les lignes correspondant au meilleur palier
actif de Souverain cupide. Il ne lit ni DOM, ni stockage, ni roster. Le module
retourne une liste vide sous cinq pieces, selectionne le palier 5--6 entre
cinq et six pieces, puis uniquement le palier 7 a sept pieces.

Les lignes temporaires rejoignent les statistiques propres du build avant
`entreesDuCalcul()`. Le critique utilise donc le meme plafond que le critique
propre du heros; le percement suit le meme seau que le bonus fixe du set. Le
comparateur d'enchantements applique le meme etat aux deux colonnes, afin que
son ecart ne mesure que les enchantements.

## Interface

Une carte « Bonus d'ensemble » apparait dans le calculateur seulement lorsque
Souverain cupide atteint cinq pieces. Elle affiche le palier effectif et un
selecteur : « Aucun buff temporaire », « Apres une releve » et « Apres deux
releves ». A sept pieces, son texte annonce que le palier 7 remplace le palier
precedent.

Changer l'etat redessine le tableau de toutes les competences et conserve les
bases de l'equipe. L'etat est reinitialise lorsque le build calcule change.
Le compteur « ligne(s) active(s) » inclut un etat temporaire non nul.

## Verification

- test de table : ancres uniques, nombres, codes de stat et absence de valeur
  sans provenance;
- test pur : seuils 0, 5, 6 et 7, et non-cumul des deux paliers;
- test des entrees : critique et percement modifient les seaux attendus;
- parcours Playwright : equipe locale, choix des trois etats, chiffre modifie,
  remplacement confirme a sept pieces et absence d'ecriture dans
  `confrerie7ds.teams`;
- mutation volontaire de chaque valeur protegee, echec observe puis valeur
  restauree;
- `npm test` complet et inspection visuelle locale avant envoi sur `main`.
