# Activer les commandes Discord `/planning`, `/chrono`, `/run` et `/build`

Les quatre commandes vivent dans la même Edge Function, parce que Discord envoie
toutes les interactions d'une application vers une seule URL. Elles partagent
donc le serveur, les salons et les rôles autorisés.

`/run` republie à la demande le rappel que le webhook envoie le dimanche : la
liste des membres sous 3/3 runs avant le reset du lundi 9h. Le texte sort du
module partagé `supabase/functions/_shared/boss-reminder.js`, celui-là même
qu'utilise le cron GitHub Actions — les deux ne peuvent donc pas diverger.
Contrairement au rappel automatique, `/run` répond n'importe quel jour ; en
début de semaine, tout le monde apparaît logiquement à 0/3.

## La commande `/planning`

Elle génère à la demande deux images PNG affichées directement dans
Discord : la grille agrégée des 168 heures de la semaine ISO avec les meilleurs
créneaux, puis le détail écrit par membre. Le message invite aussi les joueurs à
ouvrir directement la page Disponibilités de NOVA. Elle répond dans les salons
Discord configurés ; GitHub Actions n'entre pas dans ce chemin et le rappel du
dimanche reste un message texte.

## La commande `/chrono`

Discord n'accepte qu'**un seul** endpoint d'interactions par application :
`/chrono` passe donc par la même Edge Function, le même secret et les mêmes
salons autorisés que `/planning`. C'est le nom de la commande qui les sépare.

`/chrono` répond en texte, pas en images : l'avancement du chronométrage des
animations, le nombre de compétences dont le DPS n'est pas calculable sans
elles, les mesures reçues en attente de validation, les cinq mesures les plus
utiles à faire, et un bouton **NOVA - Chronométrer une animation**.

L'avancement est lu sur GitHub Pages, dans
`data/chronometrage-avancement.json` — le fichier que
`scripts/lister-chronometrage.py` publie, donc exactement le compte affiché
par « Mon suivi ». Deux chemins qui liraient deux sources finiraient par
annoncer deux chiffres. Le nombre d'envois en attente vient, lui, de
`animation_measures` ; si cette lecture échoue, la ligne est tue plutôt
qu'affichée à zéro — « personne n'a rien envoyé » et « je n'ai pas pu
compter » ne sont pas la même information.

Le délai anti-spam de trente secondes est indexé sur le salon **et** sur la
commande : `/chrono` ne coûte qu'une lecture, il n'a aucune raison d'être
retenu parce qu'un planning vient d'être publié dans le même salon.

## La commande `/build`

`/build <joueur> <personnage> [arme]` publie dans le salon la fiche d'un
personnage tel qu'il est équipé dans le roster d'un membre : une image par
build, jusqu'à trois — c'est le nombre d'armes qu'un personnage peut porter.
Préciser l'arme n'en publie qu'une.

La carte reprend une fiche de jeu en obsidienne et or : portrait à gauche,
arme et armure gravée au centre, armures et bijoux à droite. Les vraies icônes
de maîtrise et de rôle/élément viennent de `7ds-ui/`. L'élément et le rôle
affichés sont ceux du **slot de l'arme équipée** ; ils peuvent donc changer d'un
build à l'autre pour un même personnage. Le niveau, l'outrepassement et chaque
enchantement se lisent sur une jauge. La note du joueur ferme la carte.
Un emplacement vide s'affiche vide plutôt que d'être tu : « ce joueur n'a pas
de collier » et « je n'ai pas lu le collier » ne sont pas la même information.

### Deux contraintes qui se voient sur l'image

**Les images du jeu sont en webp, et rien dans une Edge Function Deno ne
décode ce format.** `scripts/generer-vignettes.py` en publie donc une version
PNG, à la taille exacte où la carte les pose. Ces vignettes pèsent environ
six mégaoctets : elles ne sont **pas versionnées**, le job `package` du
workflow Pages les fabrique dans `_site` au déploiement. Une vignette
introuvable ne prive personne de sa carte — l'emplacement se dessine sans
image.

**La carte possède son propre atlas de polices**, produit par
`scripts/generer-police-carte.py` depuis Cinzel et EB Garamond. Il conserve les
minuscules, les accents, les ligatures et le signe `%`. L'atlas historique de
`/planning` reste séparé : modifier la fiche `/build` ne peut donc pas changer
le planning.

### Ce que la commande lit

Le pseudo est retrouvé dans `profiles` **avant** de lire le roster :
`roster_characters` compte une ligne par personnage possédé, chacune portant
tous ses builds. Lire la table entière pour n'en garder qu'un joueur ferait
transiter plusieurs mégaoctets à chaque commande.

Les noms des personnages, les trois couples élément/rôle liés à leurs armes et
les libellés des statistiques viennent de
`data/libelles-discord.json`, publié sur Pages par
`scripts/generer-libelles-discord.js` — un extrait léger qui
suffit à la carte, là où le catalogue complet du site en pèse 2 500. Le nom
d'un objet, lui, ne vient d'aucun fichier : il **est** le nom de fichier de
son image.

La recherche ignore les accents et la casse. Un pseudo, un personnage ou une
arme introuvable répond dans le salon, avec les noms proches. La réponse
n'est pas éphémère : Discord veut une première réponse en moins de trois
secondes et l'ephémérité se décide à cet instant, avant d'avoir rien lu.

### L'autocomplétion des trois champs

Les trois champs se complètent en tapant. `joueur` propose les pseudos des
membres. `personnage` ne propose que les personnages présents dans le roster
**du joueur déjà saisi** — Discord envoie la valeur des autres options avec
chaque frappe, on sait donc de qui on parle. `arme` ne propose que les armes
sur lesquelles ce joueur a réellement un build pour ce personnage. Tant que le
champ `joueur` est vide ou ne désigne personne, les deux autres ne proposent
**rien** : lister les vingt-six personnages du jeu quand le membre n'en possède
que six serait pire que le silence.

Discord n'accorde que **trois secondes** à une interaction d'autocomplétion, et
aucune réponse différée n'y est possible — contrairement à la commande. Comme
il en envoie une à presque chaque frappe, les profils sont gardés en mémoire
une minute et le roster d'un joueur trente secondes. Sans ces caches, taper
« Elizabeth » lancerait neuf lectures Supabase, et la neuvième arriverait trop
tard. Le menu des personnages ne demande que la colonne `char_id` ; seul le
menu des armes lit `builds`, et pour une seule ligne.

L'autocomplétion passe par le même contrôle de serveur, de salon et de rôle
que la commande : proposer la liste des pseudos de la confrérie dans un salon
non autorisé serait une fuite. Un refus, comme une panne de lecture, répond
une **liste vide** — un menu de suggestions ne sait pas afficher d'erreur, et
un champ qui ne propose rien se comprend mieux qu'un menu figé.

Le choix des propositions vit dans `_shared/discord-build.js`, avec ses
lectures injectées : quel menu déclenche quelle lecture, et laquelle ne se
fait pas, se vérifie en Node sans Discord ni base.

## Architecture et sécurité

1. Discord envoie l'interaction signée à l'Edge Function `discord-planning`.
2. La fonction vérifie `X-Signature-Ed25519` et
   `X-Signature-Timestamp`, puis refuse toute requête vieille de plus de cinq
   minutes.
3. Le serveur doit correspondre à l'identifiant configuré, et le salon
   d'où part la commande doit figurer parmi les salons autorisés.
   Si `DISCORD_PLANNING_ROLE_IDS` est renseigné, seuls ces rôles et les membres
   qui gèrent le serveur passent.
4. Discord reçoit immédiatement une réponse différée. La lecture Supabase, la
   génération des deux images et leur publication continuent avec `EdgeRuntime.waitUntil`.
5. La RPC `claim_discord_planning_request` garantit un seul planning toutes les
   trente secondes, y compris si deux instances Edge reçoivent la commande au
   même moment.

La fonction est publique au sens HTTP (`verify_jwt=false`) parce que Discord ne
possède aucun JWT Supabase. Sa signature Ed25519 est son authentification. La
clé `service_role` reste fournie automatiquement à l'Edge Function par
Supabase et n'est jamais copiée dans le dépôt.

## 1. Appliquer le schéma

Rejouer le contenu complet et idempotent de `supabase/schema.sql` dans le SQL
Editor. Cette étape ajoute uniquement la table privée de délai et la RPC
réservée au rôle `service_role`.

## 2. Créer l'application Discord

Dans <https://discord.com/developers/applications> :

1. créer une application, par exemple **NOVA** ;
2. relever dans **General Information** l'`Application ID` et la `Public Key` ;
3. ouvrir **Bot**, créer le bot si nécessaire et générer son token ;
4. ne placer aucune de ces valeurs dans un fichier du dépôt.

Pour obtenir les identifiants du serveur, des salons et éventuellement des rôles,
activer le mode développeur dans Discord, puis utiliser **Copier l'identifiant**
dans leur menu contextuel.

## 3. Configurer et déployer l'Edge Function

> **Le CLI Supabase n'est pas installé**, et n'est pas une dépendance du dépôt.
> Taper `supabase` tout court répond « n'est pas reconnu comme nom d'applet de
> commande ». Il s'exécute par `npx`, sans installation ni droits
> administrateur : **préfixer chaque commande `supabase` de ce document par
> `npx -y supabase@latest`**.
>
> Exemple, la commande de déploiement plus bas :
>
> ```powershell
> npx -y supabase@latest functions deploy discord-planning --project-ref uxouhbgdlolidjmxwgae
> ```
>
> Un raccourci PowerShell (`function supabase { npx … @args }`) semble
> pratique, mais ne transmet pas les sous-commandes : la forme explicite est la
> seule vérifiée.

Après connexion au CLI Supabase :

```powershell
supabase login
supabase link --project-ref uxouhbgdlolidjmxwgae
supabase secrets set DISCORD_PUBLIC_KEY=<public-key>
supabase secrets set DISCORD_GUILD_ID=<id-du-serveur>
supabase secrets set DISCORD_PLANNING_CHANNEL_ID=<id-du-salon>
```

`DISCORD_PLANNING_CHANNEL_ID` accepte plusieurs salons séparés par des
virgules ; la commande répond alors dans chacun d'eux, chaque salon gardant
son propre délai de trente secondes :

```powershell
supabase secrets set DISCORD_PLANNING_CHANNEL_ID=<id-salon-1>,<id-salon-2>
```

### Réserver une commande à un salon

`DISCORD_PLANNING_CHANNEL_ID` vaut pour les **quatre** commandes : il dit où
l'application accepte de répondre, pas quelle commande y est disponible.

Réserver `/build` à un salon et y cacher les trois autres se règle **dans
Discord**, pas ici : **Paramètres du serveur → Intégrations →** l'application
**→** la liste des commandes. Chacune s'y restreint à des salons et à des
rôles, et une commande interdite dans un salon **disparaît de son menu `/`**.

C'est mieux que ce que l'Edge Function saurait faire : elle ne peut que
refuser, jamais retirer la commande du menu. Doubler ce réglage côté serveur
donnerait deux endroits à tenir d'accord pour un résultat moins bon. La seule
règle à respecter est donc que tout salon ouvert dans Discord figure aussi
dans `DISCORD_PLANNING_CHANNEL_ID` — sinon la commande apparaît dans le menu
et répond une erreur.

Facultatif, pour limiter les commandes à un ou plusieurs rôles (séparés par des
virgules) — ce réglage-là reste commun aux quatre :

```powershell
supabase secrets set DISCORD_PLANNING_ROLE_IDS=<role-1>,<role-2>
```

Déployer ensuite :

```powershell
supabase functions deploy discord-planning --project-ref uxouhbgdlolidjmxwgae
```

L'URL publique devient :

```text
https://uxouhbgdlolidjmxwgae.supabase.co/functions/v1/discord-planning
```

La mettre dans **General Information → Interactions Endpoint URL** de
l'application Discord. Discord envoie un PING signé ; l'enregistrement réussit
uniquement si la fonction et `DISCORD_PUBLIC_KEY` sont corrects.

## 4. Enregistrer les quatre commandes dans le serveur

Dans un terminal local, définir temporairement ces trois variables :

```powershell
$env:DISCORD_APPLICATION_ID = "<application-id>"
$env:DISCORD_GUILD_ID = "<id-du-serveur>"
$env:DISCORD_BOT_TOKEN = "<token-bot>"
npm run discord:register-commands
Remove-Item Env:DISCORD_BOT_TOKEN
```

Le script traite les quatre commandes : il crée celles qui manquent, met à jour
celles qui existent déjà, et ne remplace jamais les autres commandes de
l'application. Il affiche aussi le lien d'autorisation
`applications.commands` à ouvrir pour installer l'application dans le serveur.

## 5. Vérification

Dans un salon configuré, lancer `/planning`. Le message d'attente doit être
remplacé par :

- le nombre de membres ayant renseigné leurs disponibilités ;
- `tableau-disponibilites-AAAA-MM-JJ.png`, affiché dans le message ;
- `creneaux-par-membre-AAAA-MM-JJ.png`, affiché juste après ;
- un bouton **NOVA - Renseigner mes créneaux** ouvrant directement
  `https://yanniss13.github.io/NOVA/#availability`.

Dans le même salon, lancer `/chrono`. Le message d'attente doit être remplacé
par l'avancement, la liste des prochaines mesures et le bouton
**NOVA - Chronométrer une animation**.

Puis lancer `/run`. Le message d'attente doit être remplacé par la liste des
membres sous 3/3 runs, ou par `✅ tout le monde est à 3/3` — exactement le texte
que le salon reçoit le dimanche.

Enfin `/build joueur:<un pseudo> personnage:<un personnage de son roster>`. Le
message d'attente doit être remplacé par une image par build, portraits et
icônes compris, et un bouton **NOVA - Voir les rosters**. Des icônes absentes
au premier essai signifient que le déploiement Pages qui fabrique
`7ds-vignettes/` n'est pas encore passé.

En cas d'échec, la commande affiche un message neutre. Le détail technique est
visible dans **Supabase → Edge Functions → discord-planning → Logs**.

## Retour arrière

Supprimer les commandes dans le portail Discord ou retirer l'Interactions
Endpoint URL suffit à les désactiver — le rappel automatique du dimanche, lui,
continue de partir : il passe par GitHub Actions et le webhook, sans jamais
toucher à l'Edge Function. La fonction peut ensuite être supprimée
avec `supabase functions delete discord-planning`. La petite table privée de
délai est sans effet sur le site et peut rester en place.

## `/jarvis` — l'assistant IA J.A.R.V.I.S.

`/jarvis texte:<ta question> [prive:oui]` : Gemini répond en français à
partir des données de NOVA, sous le nom de J.A.R.V.I.S. Même serveur, mêmes
salons et mêmes rôles que les autres commandes. Un membre ne peut poser qu'une
question toutes les 20 s.

Le nom est `/jarvis` et non `/J.A.R.V.I.S.` : Discord refuse les majuscules et
les points dans un nom de commande.

### Palier gratuit uniquement : aucune facturation

1. Sur **aistudio.google.com**, créer un **nouveau projet**, distinct de celui
   de `lecture-panneau`, puis une clé API dans ce projet.
2. Vérifier que le projet affiche le palier **Free** et **qu'aucun compte de
   facturation n'y est relié**. C'est la garantie : un dépassement renvoie
   alors un refus (le bot répond « quota épuisé »), jamais une facture.
3. Poser la clé :

```powershell
npx -y supabase@latest secrets set GEMINI_JARVIS_API_KEY=<la-cle>
```

`GEMINI_JARVIS_MODEL` est une **liste de modèles séparés par des virgules**,
essayés dans l'ordre. Si l'un est saturé (503), à court de quota (429) ou muet
plus de 20 s, le bot passe au suivant ; un modèle qui a répondu reste le
premier choix pour le reste de la question. Une requête refusée ou une clé
invalide, elles, s'arrêtent tout de suite : changer de modèle n'y changerait
rien. Sans secret, la liste par défaut est
`gemini-3.6-flash,gemini-3-flash-preview,gemini-flash-lite-latest`.

Le 24/09/2026, Flash-Lite et Flash étaient saturés chez Google pendant que
`gemini-3.6-flash` répondait en 1,6 s. Les noms figés finissent retirés (les
2.5 répondaient déjà 404) : garder un alias `-latest` en fin de liste.

```powershell
npx -y supabase@latest secrets set "GEMINI_JARVIS_MODEL=gemini-3.6-flash,gemini-3-flash-preview,gemini-flash-lite-latest" --project-ref uxouhbgdlolidjmxwgae
```

Un secret n'est relu qu'au démarrage de la fonction : **redéployer** après
l'avoir changé. Les journaux de `discord-planning` portent une ligne
`{"jarvis":…}` par question, avec la liste `modeles` configurée et, dans
`journal`, le modèle qui a réellement répondu et la durée de chaque étape.

Ne **pas** employer `GEMINI_API_KEY` ni `GEMINI_MODEL` : ils règlent
`lecture-panneau`, et les secrets Supabase sont communs à tout le projet.

### Ce que Gemini voit

Il ne lit jamais la base : il appelle des outils, et seul le résultat de ces
outils lui est transmis. Sur le palier gratuit, Google peut réutiliser ce
contenu : la description de la commande prévient les membres.

| Outil | Données |
| --- | --- |
| `lister_personnages`, `fiche_personnage`, `chercher_equipement` | `data/connaissances-discord.json`, publié par Pages |
| `qui_possede`, `roster_de` | `roster_characters` : noms d'objets, **jamais les notes** |
| `dispos` | `member_availability`, semaine ISO de Paris |
| `scores_boss` | `boss_sessions`, `boss_run_reports`, `boss_participation` |

Pseudos seulement : aucun UUID ni email. Aucun outil n'écrit.

### Mise en service

1. Poser le secret (voir ci-dessus).
2. Fusionner et pousser vers `main`, puis attendre le déploiement Pages, qui
   publie `data/connaissances-discord.json`.
3. `npx -y supabase@latest functions deploy discord-planning --project-ref uxouhbgdlolidjmxwgae`
4. `npm run discord:register-commands` avec le token du bot.
5. Essayer dans un salon autorisé : une question publique, puis `prive:oui`.

Après une régénération du wiki ou des catalogues, lancer
`node scripts/generer-connaissances-discord.js`. Sinon, le test `--verifier`
échoue.

### Monstres et boss (lot 2a)

Deux outils de plus : `fiche_monstre` (faiblesses, résistances, résistances
critiques et valeurs de base, version par version avec leur contexte) et
`chercher_monstres` (monstres faibles à un élément).

Les données viennent des fichiers du jeu, extraits sur le poste du
propriétaire et déposés dans le bucket Supabase **privé** `jarvis-prive`.
Elles ne sont ni dans le dépôt ni sur Pages.

**Première mise en service**

1. Rejouer `supabase/schema.sql` dans le SQL Editor. Il crée le bucket privé.
2. Extraire :

```powershell
$env:DONNEES_JEU = (Resolve-Path (Read-Host 'Dossier Content')).Path
node outils/fabrication/extraire-monstres.js
```

3. Déposer `output/jarvis/monstres.json` dans Storage → `jarvis-prive`.
4. Redéployer `discord-planning`. Pas de commande à réenregistrer.

**Après une mise à jour du jeu** : étapes 2 et 3. Le bot prend le nouveau
fichier en compte au plus tard une heure après, sans redéploiement.

Les PV, la défense et l'attaque sont des **valeurs de base** : le niveau de
monde les ajuste côté serveur, et aucune table exportée ne dit comment. Les
faiblesses et résistances, elles, concordent avec les mesures en jeu.

`fiche_monstre` rend aussi les **stratégies officielles** du boss, textes du
jeu (`local_boss_strategy_<code>_title_N` / `_desc_N`) : « Union : chaque
fois qu'un joueur meurt, Akumu gagne en puissance ». Le code se retrouve dans
la clé du nom du monstre ; quand il en couvre plusieurs (« baba_boss » :
Durak, Durak 「corrompu」, Jorn le Costaud), seuls ceux du rang le plus élevé
les reçoivent.

Elle rend enfin les **effets que posent ses attaques** (« Augmentation de
l'attaque : Attaque +20 % (600 s, jusqu'à 5 cumuls, à la mort d'un
joueur) »), lus dans `Mon_SkillTable` → `Mon_SkillBehaviorTable` →
`BuffTable`, plus ses effets d'apparition (`Spawning_Buff_List`). Un
acteur sans compétence à son numéro emprunte celles de l'**unique** autre
acteur de son groupe d'animations : le boss de confrérie Akumu (`50700109`)
utilise celles de `51300084`. S'il y a plusieurs candidats, rien n'est
rattaché. **Aucune cible n'est donnée** : la table dit « ennemi » sur une
« Réduction de l'attaque » qu'Akumu reçoit lui-même, et la consigne interdit
au bot de dire qui reçoit l'effet. Une condition inconnue (autre que « à la
mort d'un joueur ») ou un nombre de cumuls négatif écarte l'effet.

### Mémoire courte

J.A.R.V.I.S. se souvient des **3 derniers échanges** de chaque membre pendant
**30 minutes** : « et pour Drake ? » se comprend après une question sur
Akumu. Les questions et réponses (coupées à 600 caractères, sans les données
des outils) vivent dans `private.jarvis_memoire`, sans politique : seule la
fonction, en `service_role`, y passe par `jarvis_memoire_lire` et
`jarvis_memoire_noter`. Chaque écriture efface les mémoires périmées de tout
le monde. Une panne de la mémoire ne bloque jamais la réponse (3 s au plus,
ligne `{"etape":"memoire","issue":"erreur"}` dans le journal).

**Mise en service** : rejouer `supabase/schema.sql` dans le SQL Editor, puis
redéployer `discord-planning`. Sans le schéma, la lecture échoue en silence
et J.A.R.V.I.S. répond sans mémoire.

### Effets, porteurs et règles (lot 2b)

Trois outils de plus : `fiche_effet` (un effet du jeu, ses valeurs, sa
durée, son cumul, sa cible et les compétences de héros qui le posent),
`chercher_effets` (« qui réduit la défense ? ») et `regle` (les textes
officiels du journal des tutoriels, des fenêtres d'aide et des astuces).

Même chaîne que les monstres, même bucket privé :

```powershell
$env:DONNEES_JEU = (Resolve-Path (Read-Host 'Dossier Content')).Path
node outils/fabrication/extraire-mecaniques.js
```

Puis déposer `output/jarvis/mecaniques.json` dans Storage → `jarvis-prive`,
et redéployer `discord-planning` la première fois. Ensuite, un nouveau
dépôt est pris en compte au plus tard une heure après.

Les porteurs viennent des compétences publiques du wiki
(`data/wiki-competences.js`) : relancer l'extraction après une
régénération du wiki. Un porteur marqué « nom absent de la description »
n'est pas un effet caché : la description de la compétence le décrit
souvent avec d'autres mots.

### Objets et boutiques (lot 2c)

Quatre outils de plus : `ou_trouver` (« où trouver X ? » : boutiques, prix
et limites d'achat, butins de monstres, captures, minage, donjons, paliers
du boss de confrérie et recettes), `boutique` (les articles d'une boutique,
son PNJ et sa région), `butin` (« que lâche Banakro ? ») et `recette`
(« comment cuisiner des beignets protéinés ? »). Quêtes, succès, événements
et coffres ne sont pas couverts : une source absente ne prouve pas qu'un
objet est introuvable, et la consigne le dit au bot.

**Recettes.** `CookingRecipeTable` (cuisine), `ProductionRecipeTable`
(établis), `BindingRecipeTable` (gravure) et `CombineRecipeTable`. En
cuisine, `Material_Group_n` donne des ingrédients interchangeables
(`MakingList`). `MakingRecipe` n'est **pas** lue : table périmée, dont la
plupart des produits n'ont pas de nom et dont les ingrédients diffèrent
pour un même produit. Une recette visible à plusieurs établis prend le plus
modeste, « ou supérieur ».

**Aucune probabilité de butin.** `DropPackTable` donne un taux par niveau
de monde (`Standard_Level`) et `DropGroupTable` pondère ses paquets, mais
la lecture de ces taux n'est pas confirmée : le bot dit ce qu'une source
peut donner, jamais avec quelle chance. Les coffres et points de récolte
(`InteractionTable`) ne sont pas couverts, faute de chaîne sûre jusqu'à
leur nom.

```powershell
$env:DONNEES_JEU = (Resolve-Path (Read-Host 'Dossier Content')).Path
node outils/fabrication/extraire-objets.js
```

Puis déposer `output/jarvis/objets.json` dans Storage → `jarvis-prive` et
redéployer `discord-planning` la première fois.

La chaîne : `MerchantGoods` (articles) → boutique → `InteractionButtonTable`
→ `InteractionTable` → `NPCActorTable` (PNJ) → tables d'apparition
(`TagMainSector`, `TagSubSector`) pour la région. Une boutique prend le nom
de sa région (« Boutique d'équipement — Liones ») ; sans région connue — les
apparitions des chapitres 3 et 7 n'en portent pas — le nom de son PNJ
(« Boutique d'équipement (Nigel) »). Les boutiques d'événement et celle de
la confrérie s'ouvrent depuis un menu. La boutique itinérante tire ses
articles au hasard. Un article dont l'objet ou la monnaie n'a pas de nom
français est écarté, et une boutique vide est omise.
