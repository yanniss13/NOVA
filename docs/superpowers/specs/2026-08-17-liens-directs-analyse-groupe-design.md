# Liens directs et analyse d’un groupe de boss — design

**Date :** 17 août 2026

**Statut :** validé par le propriétaire avant rédaction

**Périmètre :** navigation par URL, lien vers un groupe, analyse dynamique de ses participants

## 1. Objectif

Permettre à un membre d’ouvrir ou partager une destination précise de NOVA,
puis d’analyser la composition actuelle d’un groupe de boss sans sélectionner
ses participants à la main.

Deux besoins sont réunis :

1. les vues stables possèdent une URL qui survit au rechargement et à la
   connexion ;
2. un groupe ouvert propose « Analyser ce groupe » et « Copier le lien ».

L’analyse d’un groupe est **dynamique** : l’URL contient l’identifiant de la
session, jamais une liste figée de membres. Chaque ouverture relit donc les
participants actuels.

## 2. Contrat d’URL

GitHub Pages ne fournit aucune réécriture serveur. Les destinations utilisent
donc le fragment de l’URL :

```text
#dashboard
#builder
#roster
#member-roster
#availability
#boss
#analyse
#wiki
#collection
#boss/groupe/<session-id>
#analyse/groupe/<session-id>
```

Les vues internes qui exigent un contexte non reconstructible, notamment le
Calculateur ouvert sur un build, ne reçoivent pas de lien public dans ce lot.

Un identifiant de session est décodé comme un segment unique, non vide et de
longueur bornée. Une route inconnue ou mal formée ne déclenche aucune lecture
réseau arbitraire : elle revient à `dashboard` pour un membre connecté et à
`wiki` pour un visiteur.

## 3. Navigation et historique

`showView()` reste le point unique qui affiche une vue. Son contrat gagne une
option interne permettant à un résolveur de route d’ouvrir une vue sans
réécrire immédiatement le fragment qui vient d’être lu.

- Un clic d’onglet ou une navigation applicative vers une vue stable met à
  jour le fragment canonique avec `history.pushState()`.
- `popstate` résout de nouveau la route afin que Précédent/Suivant restaure la
  bonne vue.
- Ouvrir une route identique ne crée pas une entrée d’historique en double.
- Une route de groupe conserve son identifiant pendant son traitement ; elle
  ne doit pas être raccourcie automatiquement en `#boss` ou `#analyse`.

La résolution spécialisée vit dans un module de vue dédié, au-dessus de
`navigation.js`. Ce module peut appeler la navigation, lire `BossStore` et
configurer l’Analyse sans créer de dépendance ascendante dans le registre des
onglets.

## 4. Connexion et démarrage

Une destination réservée ouverte sans session reste mémorisée pendant que la
modale de connexion est affichée. Lors du premier passage « aucun compte →
compte connecté », `session-auth.js` demande au résolveur d’ouvrir cette route.

- Si une route réservée est en attente, elle remplace l’ouverture par défaut de
  « Mon suivi ».
- Sans route réservée, le comportement actuel reste inchangé : « Mon suivi »
  s’ouvre après connexion.
- Une déconnexion depuis une vue réservée conserve le repli actuel vers le
  Wiki ; elle ne relance pas automatiquement l’ancienne route lors d’une
  future connexion, sauf si cette route vient du chargement ou d’un nouveau
  changement d’URL explicite.

## 5. Liens de groupe dans les Sessions de boss

Chaque carte d’un **groupe ouvert** reçoit deux actions secondaires :

- **Analyser ce groupe** ouvre `#analyse/groupe/<session-id>` ;
- **Copier le lien** copie l’URL absolue `#boss/groupe/<session-id>`.

L’action d’analyse est désactivée lorsque le groupe ne contient aucun membre.
Elle ne rejoint pas le groupe, ne choisit aucune équipe et ne modifie aucune
donnée Supabase.

La copie utilise `navigator.clipboard.writeText()` dans le contexte HTTPS. En
cas d’échec ou d’API absente, `window.prompt("Copie ce lien", url)` affiche
l’adresse sélectionnable au lieu de prétendre que l’opération a réussi. Un
toast confirme uniquement une copie réellement effectuée.

La route `#boss/groupe/<session-id>` charge la vue Boss, retrouve la carte
ouverte correspondante, la fait défiler dans la zone visible et place le focus
sur sa première action pertinente. Si le groupe n’est plus ouvert ou n’existe
plus, la vue Boss reste affichée avec un message explicite.

Les archives ne reçoivent pas ces actions dans ce lot : analyser un ancien
groupe avec les rosters actuels pourrait être pris à tort pour un instantané de
la run passée.

## 6. Analyse dynamique du groupe

Le résolveur de `#analyse/groupe/<session-id>` :

1. relit le groupe et ses participations depuis `BossStore` ;
2. transmet à l’Analyse l’identifiant, le titre et les propriétaires actuels ;
3. ouvre la sous-vue `DPS par élément` ;
4. rend l’Analyse depuis les rosters partagés déjà utilisés aujourd’hui.

Le contexte de groupe restreint **toute** l’Analyse :

- compteurs de la vue d’ensemble ;
- couverture par élément ;
- matrice DPS ;
- affaiblissements de la cible ;
- renforcements des alliés.

Le filtre manuel par membre reste disponible, mais ses choix sont limités aux
membres du groupe. Il continue de ne restreindre que la matrice à l’intérieur
de ce périmètre.

Un bandeau placé avant les sous-vues indique :

- le titre et le numéro de run ;
- le nombre de participants actuels ;
- le nombre éventuel de participants sans roster exploitable ;
- une action « Toute la confrérie » qui efface le contexte de groupe et
  remplace l’URL par `#analyse`.

Les propriétaires présents dans la session mais absents des rosters ne sont
pas inventés dans les calculs. Le bandeau les compte explicitement afin que
l’absence de données ne ressemble pas à un vrai zéro de couverture.

## 7. Actualisation et erreurs

La composition est relue à chaque ouverture de la route. Une modification
survenue après le partage du lien est donc visible au prochain accès ou
rechargement.

Ce lot n’ajoute pas d’abonnement Realtime spécifique pendant que l’Analyse est
ouverte. Une actualisation automatique en direct pourra venir plus tard si le
besoin réel apparaît ; elle n’est pas nécessaire au contrat « composition
actuelle à chaque ouverture ».

Cas d’erreur :

- groupe introuvable ou archivé : message dans la destination Boss/Analyse et
  retour possible vers la vue générale ;
- lecture des participations impossible : l’Analyse n’annonce aucune fausse
  absence et propose de réessayer ;
- aucun participant : état vide explicite, sans basculer sur toute la
  confrérie en silence ;
- route invalide : repli local, sans appel Supabase avec une valeur non
  validée.

## 8. Accessibilité et mobile

- Les nouvelles actions utilisent des boutons ou liens natifs et conservent
  une cible tactile minimale de 44 px.
- Après une route vers un groupe Boss, le focus va sur une action de la carte,
  pas sur un conteneur non interactif.
- Après une route vers l’Analyse, le titre du contexte est annoncé et la
  sous-vue DPS porte son état actif habituel.
- Le bandeau et les actions se replient sans débordement horizontal entre 320
  et 390 px.
- Précédent/Suivant restaure à la fois la vue et le contexte de groupe.

## 9. Données et sécurité

Aucune table, politique RLS, RPC ou migration n’est ajoutée. Les routes ne
contiennent que des identifiants déjà lisibles par les membres connectés. Les
lectures continuent de passer par les politiques Supabase existantes.

Une URL ne donne jamais un droit supplémentaire : un visiteur sans session voit
la connexion, et une lecture refusée reste refusée après navigation directe.

## 10. Tests

### Tests purs

- sérialisation et lecture de chaque route stable ;
- validation et encodage d’un identifiant de groupe ;
- rejet des fragments inconnus, vides ou trop longs ;
- construction des URL absolues à copier.

### Playwright

- une vue stable ouverte par fragment survit au rechargement ;
- une route réservée ouverte hors connexion reprend après identification au
  lieu d’ouvrir le tableau de bord ;
- Précédent/Suivant restaure les vues ;
- `#boss/groupe/<id>` cible la bonne carte ;
- « Copier le lien » copie l’adresse attendue sans écriture Supabase ;
- « Analyser ce groupe » ouvre la sous-vue DPS et filtre les trois panneaux sur
  les participants actuels ;
- un changement de participation avant une nouvelle ouverture modifie le
  résultat ;
- un membre sans roster est compté comme tel, jamais comme une couverture à
  zéro silencieuse ;
- groupe vide, inconnu, archivé et erreur réseau produisent leurs états
  explicites ;
- contrôles tactiles et absence de débordement à 320 et 390 px.

La suite complète `npm test` reste le garde avant tout push.

## 11. Hors périmètre

- notifications push ;
- application automatique d’une proposition de groupes ;
- liens vers une modale de build ou un calculateur préconfiguré ;
- analyse historique à partir des instantanés archivés ;
- synchronisation Realtime du contexte de groupe pendant que l’Analyse reste
  ouverte ;
- modification du webhook Discord dans ce lot.
