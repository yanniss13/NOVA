# Chronométrage — le classement promeut ce que le simulateur jette

**Date :** 2026-08-21
**État :** anomalie constatée et vérifiée à l'exécution, non corrigée.
**Décision attendue :** choisir la piste A, la piste B, ou les deux.

## Où on en est

`main` est à `83e4bd5`, CI verte, Pages déployé. Le comparateur DPS sur 60 s
est en ligne dans la fiche d'un héros du roster, et la chaîne de chronométrage
est complète de bout en bout : carte dans « Mon suivi », outil de mesure,
boîte de réception Supabase, rapatriement par médiane, commande Discord.

**Un seul geste reste en attente** — le déploiement de la fonction Edge, sans
lequel `/chrono` répond « Commande Discord inconnue » alors que la commande est
déjà enregistrée sur le serveur Discord :

```powershell
$supabase = "D:\Yanniss\outils\supabase-cli\node_modules\.bin\supabase.cmd"
& $supabase functions deploy discord-planning --project-ref uxouhbgdlolidjmxwgae
```

La CLI n'est pas sur le PATH, d'où le chemin complet. Le `.cmd` et pas le
`.ps1`, qui retomberait sur la politique d'exécution PowerShell.

## L'anomalie

`scripts/lister-chronometrage.py` classe les 335 animations à mesurer en deux
régimes (`lignes()`, ligne 145) :

- **« Débloque » — 151 compétences, recharge à 0.** Une compétence sans
  recharge ne se rejoue qu'à la fin de son animation : cette animation *est* le
  dénominateur entier de son DPS, pas une correction.
- **« Affine » — 184 compétences, recharge > 0.** L'animation n'ajoute qu'un
  retard. Classées par l'erreur commise à l'ignorer,
  `ANIMATION_SUPPOSEE / (recharge + ANIMATION_SUPPOSEE)`, où les 1,5 s
  (ligne 45) sont une hypothèse **de classement seulement**, jamais une valeur
  de calcul.

`rendre_avancement()` (ligne 214) concatène dans cet ordre et publie les cinq
premières non mesurées dans `data/chronometrage-avancement.json`. Ce sont elles
que « Mon suivi » et `/chrono` proposent.

**Le problème :** `js/metier/dps-simulation.js` ligne 1063 exclut toute
compétence dont la recharge vaut 0.

```js
const rechargeValide = enMs(competence && competence.recharge) > 0;
```

Et `CATEGORIE_DPS` (ligne 13) ne connaît que `NORMAL_SKILL`, `ACTIVE_THIRD` et
`ULTIMATE` — les attaques normales sont hors périmètre, ce que l'hypothèse
`attaques-normales-non-chiffrees` annonce déjà.

Conséquence : **les 151 « débloquantes » sont toutes rejetées par le
simulateur**, même une fois leur animation mesurée. Vérifié à l'exécution avec
une compétence à recharge 0 et une animation de 1,2 s fournie :

```
dps: null | raison: "categorie-ou-recharge-non-modelisee"
```

Les cinq mesures que la confrérie voit aujourd'hui en tête sont donc
exactement celles qui ne déplaceront aucun chiffre. Les 184 « affinantes »,
elles, entrent toutes dans le simulateur.

Le raisonnement du classement n'est pas faux — il est en avance sur le moteur.
Le design d'origine excluait les attaques normales « faute de cadence
d'animation », ce qui est précisément ce que la mesure apporte ; le code qui en
tirerait parti n'a jamais été écrit.

## Piste A — faire suivre le simulateur

Traiter une compétence sans recharge comme rejouable toutes les `animationMs`,
sa cadence étant son animation. C'est l'intention d'origine du design.

À prévoir :

- `CATEGORIE_DPS` doit accueillir `NORMAL`, sinon les attaques normales restent
  hors rotation même avec une cadence connue.
- Le filtre de la ligne 1063 doit accepter `recharge == 0` **à condition**
  qu'une animation soit mesurée. Sans mesure, une compétence sans recharge
  serait rejouable une infinité de fois dans la fenêtre : c'est une boucle
  infinie, pas un DPS. Le garde-fou n'est donc pas optionnel.
- `dureeRecharge()` rendrait alors `animationMs` pour ces compétences.
- Les DPS affichés vont **bouger**, et l'hypothèse
  `attaques-normales-non-chiffrees` disparaîtra pour les builds concernés.
- `tests/dps-simulation.test.js` porte déjà le cas du verrouillage
  d'animation : le nouveau cas s'y range naturellement.

Sans mesure disponible, rien ne change : c'est la propriété à conserver.

## Piste B — faire suivre le classement

Promouvoir d'abord ce qui est exploitable aujourd'hui, garder les 151 en
seconde liste avec la mention qu'elles attendent le moteur. Une ligne dans
`rendre_avancement()`, plus le document généré à réécrire.

Les cinq qui paieraient dès maintenant :

| héros | arme | compétence | recharge | erreur |
|---|---|---|---|---|
| diane | Gantelets | Combinaison de coups de pied | 5,0 s | 23 % |
| dreydrin | Hache | Écrasement puissant | 7,0 s | 18 % |
| drake | Épée à deux mains | Taillade perforante | 7,5 s | 17 % |
| dreyfus | Rapière | Brise-dard | 7,5 s | 17 % |
| gil-thunder | Lance | Déferlement foudroyant | 7,5 s | 17 % |

## Recommandation

B d'abord, A ensuite. B est court et évite de faire chronométrer la confrérie
dans le vide dès la mise en service de `/chrono` ; A est le vrai correctif,
mais il déplace des chiffres et mérite d'être fait à tête reposée. Les deux ne
s'excluent pas : une fois A livrée, le classement de B redevient celui
d'aujourd'hui.

## Deux propositions écartées, à ne pas refaire

- **Contrainte d'unicité `(owner, game_id, mode)` sur `animation_measures`.**
  `tests/animation-measures-schema.test.js` interdit explicitement les
  politiques `update` et `delete` : une mesure envoyée est un fait daté, pas un
  brouillon. L'arbitrage se fait au rapatriement, sous les yeux d'un humain.
- **Déplacer `RAPPORT-analyse-tapscreen.md` dans `docs/`.** Il est référencé
  depuis huit fichiers, dont des commentaires de `js/metier/degats-calcul.js`.

## Repères

- Classement : `scripts/lister-chronometrage.py`, `lignes()` et
  `rendre_avancement()`.
- Exclusion : `js/metier/dps-simulation.js`, `CATEGORIE_DPS` et le filtre de
  `simulerDpsCompetences`.
- Affichage de la réserve : `js/vues/fiche-heros.js`, `libelleHypothese()`.
- Chaîne complète : section « Chronométrage des animations » d'`AGENTS.md`.
