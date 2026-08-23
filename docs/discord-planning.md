# Activer les commandes Discord `/planning`, `/chrono` et `/run`

Les trois commandes vivent dans la même Edge Function, parce que Discord envoie
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

Facultatif, pour limiter la commande à un ou plusieurs rôles (séparés par des
virgules) :

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

## 4. Enregistrer les trois commandes dans le serveur

Dans un terminal local, définir temporairement ces trois variables :

```powershell
$env:DISCORD_APPLICATION_ID = "<application-id>"
$env:DISCORD_GUILD_ID = "<id-du-serveur>"
$env:DISCORD_BOT_TOKEN = "<token-bot>"
npm run discord:register-commands
Remove-Item Env:DISCORD_BOT_TOKEN
```

Le script traite les trois commandes : il crée celles qui manquent, met à jour
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

En cas d'échec, la commande affiche un message neutre. Le détail technique est
visible dans **Supabase → Edge Functions → discord-planning → Logs**.

## Retour arrière

Supprimer les commandes dans le portail Discord ou retirer l'Interactions
Endpoint URL suffit à les désactiver — le rappel automatique du dimanche, lui,
continue de partir : il passe par GitHub Actions et le webhook, sans jamais
toucher à l'Edge Function. La fonction peut ensuite être supprimée
avec `supabase functions delete discord-planning`. La petite table privée de
délai est sans effet sur le site et peut rester en place.
