# Passation /jarvis — pour Codex

Date : 2026-09-24. Rédigée par Claude à la fin d'une session sur `/jarvis`.
Lis `AGENTS.md` (section « Commande Discord `/jarvis` ») et
`docs/discord-planning.md` (sections `/jarvis`, lots 2a et 2b) avant de toucher
à quoi que ce soit.

> **Vérifie l'état avec git, pas avec ce document.** Une passation peut être
> fausse dès sa rédaction : `git log --oneline main..fix/jarvis-retouches-2b`
> et `git log origin/main -1` disent ce qui est vraiment fait.

## Ce qu'est /jarvis

Un assistant IA dans Discord, qui répond aux questions des membres sur le jeu
et sur la confrérie. Une seule Edge Function Supabase
(`supabase/functions/discord-planning/index.ts`, Deno) reçoit toutes les
commandes Discord ; `/jarvis` y passe par Gemini (API REST, appel d'outils).

| Fichier | Rôle |
| --- | --- |
| `supabase/functions/_shared/discord-jarvis.js` | commande, consigne, boucle Gemini (5 tours), messages |
| `supabase/functions/_shared/discord-jarvis-outils.js` | outils héros, équipement, rosters, dispos, scores |
| `supabase/functions/_shared/discord-jarvis-stockage.js` | lecteur commun du bucket privé (cache 1 h / 1 min, délai 5 s) |
| `supabase/functions/_shared/discord-jarvis-monstres.js` | lot 2a : `fiche_monstre`, `chercher_monstres` |
| `supabase/functions/_shared/discord-jarvis-mecaniques.js` | lot 2b : `fiche_effet`, `chercher_effets`, `regle` |
| `outils/fabrication/monstres-jarvis.js` + `extraire-monstres.js` | extraction pure + enveloppe → `output/jarvis/monstres.json` |
| `outils/fabrication/mecaniques-jarvis.js` + `extraire-mecaniques.js` | extraction pure + enveloppe → `output/jarvis/mecaniques.json` |

Les deux JSON sont fabriqués sur le poste du propriétaire depuis son export
FModel (variable `DONNEES_JEU` = le dossier `Content` ; demande-lui le chemin,
ne l'écris jamais dans un fichier suivi), puis **déposés à la main** dans le
bucket Supabase privé `jarvis-prive`.

## Règles non négociables

- **Zéro facturation.** Gemini sur le palier gratuit uniquement. Face au
  quota, consommer moins ; jamais de clé payante, jamais de projets cumulés.
- **Les données du jeu ne vont jamais dans le dépôt public ni sur Pages.**
  `output/jarvis/` est ignoré par git ; le bucket n'a aucune politique.
  Un extrait ponctuel dans un test (un nom, une valeur) est admis, comme aux
  lots 2a et 2b ; un fichier de données, jamais.
- **Aucun chemin personnel** dans un fichier suivi (`tests/chemins-personnels.test.js`).
- **Jamais la clé Gemini ni le token du bot** dans le dépôt ou une conversation.
- **Demander avant chaque poussée.** Un accord vaut pour ce changement-là.
- **Un seul vocabulaire** : un renommage se fait partout dans le même commit, sans alias.
- Chaque module de `_shared/` est importé par `await import` dans `index.ts`,
  après ceux qu'il lit (`tests/edge-modules.test.js`, 15 modules aujourd'hui).

## Pièges déjà payés

- **Le journal d'abord.** Chaque question `/jarvis` écrit une ligne
  `{"jarvis":{code, modeles, journal}}` dans les logs de la fonction : étapes,
  durées, modèle utilisé, raison de fin de Gemini. Ne corrige rien sans elle.
- **Un secret n'est relu qu'au redéploiement** (`GEMINI_JARVIS_MODEL`…).
- **Quota** : le palier gratuit de `gemini-3.6-flash` n'accorde que
  **20 requêtes** (fenêtre non confirmée : minute ou jour). Une question coûte
  jusqu'à 5 appels. La liste de secours bascule sur `sature`, `quota`, `delai`.
- **Le mode `NONE` ne suffit pas** : le 24/09/2026, `gemini-3-flash-preview` a
  rendu un appel d'outil au dernier tour, sans texte (« Je ne peux pas
  répondre »). Corrigé sur la branche en cours par une consigne de dernier
  tour et un rattrapage sans outils.
- **Heredoc Bash** : il mange des échappements, et des ancres `includes()`
  échouent sans raison visible. Modifier par l'outil d'édition, pas par un
  script collé dans le shell.
- **CRLF** : le dépôt mélange les fins de ligne ; ne jamais normaliser un fichier entier.
- **Typage Deno** : copier `supabase/functions` dans un dossier temporaire et
  y lancer `npx -y deno@latest check --node-modules-dir=auto functions/discord-planning/index.ts`.
  Attendu : seulement 3 erreurs TS2322 préexistantes sur `Blob`.
- **Tests** : `npm test` (≈ 125 unitaires + 29 e2e). `supabase-etape1`,
  `accessibilite-mobile` et `visiteur-anonyme` sont instables : relancer une
  fois avant de parler de régression.

## Tâche 0 — Finir la branche en cours

`fix/jarvis-retouches-2b`, partie de `main` (8f6f1c0), **pas poussée** :

| Commit | Contenu |
| --- | --- |
| 79713ab | Dernier tour dit en toutes lettres, rattrapage sans outils, outils groupés par tour (bug du 24/09) |
| 0d2d2eb | Extraction : noms égaux à leur clé écartés, tous les gabarits `{…}` remplacés |
| a6c6f16 | Outils : nom vide, héros inconnu, arme du porteur, validation profonde, porteurs masqués |
| 3badf60 | Consigne « quel monstre ou quel effet », commentaire d'import |

À faire, dans l'ordre :

1. `npm test` complet au vert sur la branche.
2. **Demander au propriétaire** l'accord pour pousser, puis avance rapide :
   `git push origin fix/jarvis-retouches-2b:main`.
3. Le propriétaire redépose `output/jarvis/mecaniques.json` (468 effets,
   151 sujets, ≈ 446 Ko, à réextraire si l'export a changé) dans
   `jarvis-prive`, puis redéploie :
   `npx -y supabase@latest functions deploy discord-planning --project-ref uxouhbgdlolidjmxwgae`.
4. Vérifier en production avec la question qui avait échoué :
   « il y a que 3 personnages qui réduisent la défense générale ? ». Dans le
   journal, attendre soit une réponse en moins de 5 tours (outils groupés),
   soit une ligne `{"etape":"gemini","tour":"rattrapage","issue":"texte"}`.
   Si le rattrapage est refusé par Google (`issue` = un code d'erreur),
   l'appel sans outils déclarés n'est pas accepté avec un historique qui
   contient des appels de fonction : il faudra une autre forme de rattrapage.

## Tâche 1 — Valeurs brutes des effets (M-6, reporté)

> **Close le 25/09/2026.** Les unités étaient déjà toutes prouvées
> (1 533 / 1 533, aucune valeur brute). Restaient 283 valeurs dont la
> statistique s'affichait par son code : le jeu les nomme dans ses clés
> `ui_<code>` (`ui_s_movespdadd_rate` = « Vitesse de déplacement »), dernier
> recours de `libelleStatMecanique`. 198 sont nommées ; les 85 autres
> (`T_Atk`, `T_Def`, `T_MaxHP`, endurance et vitesse de nage, de vol plané,
> de familier volant, `MaxSP_Rate`, `RecoverySP_Rate`, `Move_Spd`) n'ont
> aucun nom dans les fichiers et gardent leur code : ce sont des plats, des
> effets de climat et d'aventure, que leur propre nom d'effet décrit déjà.
> Le texte ci-dessous est l'état d'avant.

26 % des valeurs de `mecaniques.json` s'affichent « 5000 (valeur brute) » :
27 codes de stat posés par des effets n'ont ni libellé dans
`7ds-stats/libelles-stats.json` ni unité dans `7ds-stats/stat-metadata.json`
(ex. `NormalAttack_DamAdd_Rate`, `Earth_Burst_Gauge_Res_Rate`,
`S_MoveSpdAdd_Rate`, `H_HealReceive_Rate`, `A_Block_Rate`, `T_MaxHP`).

**Interdit** : déduire l'unité du nom du code (règle d'`AGENTS.md`). Il faut
une source : une table du jeu qui déclare l'unité, ou une mesure en jeu, ou
la prose d'une compétence qui donne le même chiffre en %. Lister la liste
exacte avec l'extraction réelle, chercher une preuve par code, compléter
`stat-metadata.json` code par code avec sa provenance.

## Tâche 2 — Recherche : effets posés par les boss

> **Faite le 25/09/2026** : le lien passe par le groupe d'animations
> (`ActorTid.ActorAniKeyGroup`). Voir `outils/fabrication/effets-monstres-jarvis.js`
> et `docs/discord-planning.md`. Le texte ci-dessous est l'état d'avant.

Question : peut-on relier un boss (Akumu, Démon rouge…) aux effets qu'il
inflige ? C'est une **recherche**, pas un lot : rapporter faisable / pas
faisable / à quel coût, sans garder de code.

Faits établis sur l'export du 24/09/2026 :

- `Table/Skill/Mon_SkillTable.json` : 2 573 compétences, identifiants
  préfixés par un acteur (`51300003_normalatk_1`).
- `Table/Skill/Mon_SkillBehaviorTable.json` : 4 447 comportements, dont
  1 950 posent un buff (`BehaviorDetail_SetBuffTid`).
- **Akumu (`50700109`) n'a aucune ligne** dans `Mon_SkillTable`, et son
  acteur (`MonsterActorTable`) ne cite aucune compétence (seulement
  `Spawning_Skill`/`Dying_Skill`, à `None`).
- Le lien passe probablement par les arbres de comportement de l'IA
  (fichiers d'actifs, pas des tables).

Pistes, de la moins chère à la plus chère : autres tables qui citent un
identifiant de monstre ou de compétence de monstre ; noms de comportements
qui contiennent un nom de boss ; fichiers d'IA de l'export. Si le lien est
trouvé, les effets rejoignent les fiches de `fiche_monstre` (lot 2a).

## Tâche 3 — Lot 2c : boutiques et butins

> **Fait le 25/09/2026** en trois étapes : boutiques, butins, recettes
> (`outils/fabrication/objets-jarvis.js`, `_shared/discord-jarvis-objets.js`,
> outils `ou_trouver`, `boutique`, `butin`, `recette`). Specs :
> `docs/superpowers/specs/2026-09-25-jarvis-{boutiques,butins,recettes}-design.md`.
> Taux de butin confirmés par le propriétaire et affichés
> (`docs/discord-planning.md`, « Chance de butin »).

Questions visées : « où trouver tel matériau ? », « que vend tel marchand ? ».
Tables pressenties : `MerchantGoods` (671 lignes depuis le usmap Dumper-7),
`DropPackTable`, `DropGroupTable`. Même chaîne que 2a et 2b : extraction pure
testée sur un mini-export, enveloppe qui lit `DONNEES_JEU`, fichier dans
`output/jarvis/`, dépôt dans `jarvis-prive`, lecteur commun
`creerLecteurStockageJarvis`, outils en lecture seule bornés en taille.
Passer par le processus complet : conception validée par le propriétaire,
spec, plan, puis exécution.

## Tâche 4 — Lot 2d : contenu non sorti

> **Recherche du 25/09/2026, sans conclusion.** Aucun signal de sortie dans
> les tables : `HeroActorTable.Open_Start_Date` vaut `44378.4583333333`
> (1er juillet 2021, une valeur de remplissage) pour **toutes** ses 89
> lignes, et `HideHeroList` ne masque que l'avatar par défaut (`8001`).
> Sept héros des tables ne sont pas sur le site : Tioré, Hauser,
> Gilthunder, Griamor, Derrierie, Mannie, Clotho. Rien ne dit s'ils sont
> sortis.
>
> **Réponse du propriétaire (25/09/2026)** : les sept sont sur le site, sous
> d'autres noms (Tioreh, Howzer, Griamore, Derieri, Manny, Klotho…). La liste
> des héros du site fait foi, et un contenu non sorti se **signale** (« pas
> encore sorti en jeu, présent dans les fichiers »), il ne se tait pas.
> Aujourd'hui aucun héros des tables n'est absent du site : rien à signaler,
> pas de code. À reprendre quand un nouveau héros apparaît dans
> `HeroActorTable` avant le site — comparer par identifiant, jamais par nom.

Distinguer dans les réponses ce qui est sorti en jeu de ce qui ne l'est pas
encore. Attention (mémoire du projet) : un identifiant neuf entre deux
exports est souvent un objet existant réédité ; vérifier l'icône et le nom,
et croire le propriétaire quand il dit « ça existe déjà ». Un diff d'export
ne date pas un changement : dire « modifié dans les fichiers », jamais
« changé aujourd'hui ».

## Suivi à surveiller

- **Quota** : si « quota gratuit atteint » revient souvent, réduire les appels
  (outils mieux groupés, réponses plus courtes), jamais payer.
- **Justesse des porteurs** : le rattachement compétence → effet passe par le
  nom des comportements (`<gameId>` ou `<gameId>_…`). Aucun cas ambigu
  aujourd'hui ; si un nouveau héros casse la règle, `tests/mecaniques-jarvis.test.js`
  a le cas « le plus long identifiant gagne ».
- **Après une régénération du wiki** (`data/wiki-competences.js`), relancer
  `extraire-mecaniques.js` et redéposer le fichier : les porteurs en dépendent.
