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

La carte est illustrée : le portrait du personnage, l'icône de l'arme, des
quatre pièces d'armure, de l'armure gravée et des trois bijoux, avec pour
chacune son niveau de passif, ses enchantements et le palier de sa perle. La
note écrite par le joueur ferme la carte. Un emplacement vide s'affiche vide
plutôt que d'être tu : « ce joueur n'a pas de collier » et « je n'ai pas lu le
collier » ne sont pas la même information.

### Deux contraintes qui se voient sur l'image

**Les images du jeu sont en webp, et rien dans une Edge Function Deno ne
décode ce format.** `scripts/generer-vignettes.py` en publie donc une version
PNG, à la taille exacte où la carte les pose. Ces vignettes pèsent près de
trois mégaoctets : elles ne sont **pas versionnées**, le job `package` du
workflow Pages les fabrique dans `_site` au déploiement. Une vignette
introuvable ne prive personne de sa carte — l'emplacement se dessine sans
image.

**Les polices de la carte sont des atlas**, hérités du rendu de `/planning`,
et ils ne connaissent que `A-Z 0-9 - / : . ( ) | = ?`. Tout le texte de la
carte est donc en capitales sans accents. Trois traductions comblent les
manques : l'apostrophe devient une espace, `&` devient « ET », et le `%` est
tracé à la main, au rectangle et au disque. Sans lui, chaque pourcentage
s'afficherait « ? ».

### Ce que la commande lit

Le pseudo est retrouvé dans `profiles` **avant** de lire le roster :
`roster_characters` compte une ligne par personnage possédé, chacune portant
tous ses builds. Lire la table entière pour n'en garder qu'un joueur ferait
transiter plusieurs mégaoctets à chaque commande.

Les noms des personnages et les libellés des statistiques viennent de
`data/libelles-discord.json`, publié sur Pages par
`scripts/generer-libelles-discord.js` — l'extrait de dix kilo-octets qui
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

### Donner à `/build` ses propres salons

`DISCORD_BUILD_CHANNEL_ID` limite **`/build` seule** aux salons qu'il nomme :

```powershell
supabase secrets set DISCORD_BUILD_CHANNEL_ID=<id-du-salon-builds>
```

Renseigné, il **remplace** `DISCORD_PLANNING_CHANNEL_ID` pour cette commande :
`/build` ne répond plus que là, et le salon des builds n'ouvre ni `/planning`,
ni `/chrono`, ni `/run`. « Seulement ici » ne voudrait rien dire si les deux
listes s'additionnaient. Laissé vide, `/build` retombe sur la liste générale
et rien ne change.

**Ce réglage refuse, il ne masque pas.** Une commande refusée répond un message
d'erreur, mais elle reste proposée dans le menu `/` du salon. Pour qu'elle
disparaisse du menu, il faut le réglage de Discord lui-même : **Paramètres du
serveur → Intégrations →** l'application **→** la liste des commandes, où
chacune se restreint à des salons et des rôles. Les deux se complètent : le
serveur masque, l'Edge Function refuse. Régler l'un sans l'autre laisse soit un
message d'erreur là où la commande n'aurait pas dû apparaître, soit une
commande visible qui ne répondra pas.

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
