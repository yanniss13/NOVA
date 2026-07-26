# Phase 1 qualité — CI Pages et mises à jour PWA

## Objectif

Empêcher la publication d’une version qui échoue aux tests et permettre aux
membres de choisir quand activer une nouvelle version de l’application PWA.

Cette phase couvre les points qualité suivants :

1. tests automatiques GitHub et déploiement Pages conditionné ;
2. gestion visible et sûre des mises à jour PWA.

Les workflows, le service worker et l’interface de mise à jour ne changent ni
les données Supabase ni le comportement métier du builder, du roster ou des
groupes de boss.

## Déploiement GitHub Pages

### Déclencheurs

Un workflow Pages dédié s’exécute :

- sur chaque Pull Request visant `main`, pour les tests uniquement ;
- sur chaque push vers `main`, pour les tests puis le déploiement ;
- manuellement via `workflow_dispatch`, pour pouvoir relancer un déploiement.

Le workflow existant du rappel Discord reste séparé et inchangé.

### Job de test

Le job de test :

1. récupère le dépôt ;
2. installe la version Node LTS retenue par le workflow ;
3. exécute `npm ci` depuis `package-lock.json` ;
4. installe Chromium et les dépendances système nécessaires à Playwright ;
5. exécute `npm test`.

Une Pull Request s’arrête après ce job. Un push vers `main` ne peut pas
atteindre le job de déploiement si le job de test échoue.

### Préparation de l’artefact

Le site livré reste entièrement statique. Le job de déploiement prépare un
répertoire temporaire à partir des seuls fichiers suivis par Git au commit
testé. Cela exclut naturellement :

- `node_modules` ;
- les worktrees ;
- les rapports SDD ;
- les fichiers locaux non suivis.

Les tests et la documentation peuvent rester dans l’archive sans être chargés
par l’application, mais aucun fichier généré par `npm ci` ne doit être publié.

Avant l’envoi à GitHub Pages, le job remplace un marqueur de version dans la
copie de `sw.js` par le SHA du commit. Le fichier source du dépôt conserve le
marqueur lisible ; seule la copie déployée reçoit le SHA.

Le job utilise ensuite le mécanisme officiel GitHub Pages :

1. configuration Pages ;
2. envoi de l’artefact statique ;
3. déploiement de cet artefact.

Les permissions du workflow restent minimales : lecture du dépôt, écriture
Pages et jeton d’identité pour le déploiement. Une concurrence dédiée annule
un ancien déploiement encore en attente lorsqu’un commit plus récent arrive.

### Configuration manuelle

Après fusion du workflow, le propriétaire du dépôt sélectionne une fois :

`Settings → Pages → Build and deployment → Source → GitHub Actions`.

Le domaine GitHub Pages et tout éventuel domaine personnalisé restent gérés par
les réglages Pages existants.

## Cycle de mise à jour PWA

### Version du cache

`sw.js` construit le nom du cache applicatif à partir du marqueur remplacé par
le SHA lors du déploiement. Chaque commit publié produit donc un service worker
différent et un nouveau cache, sans dépendre d’un oubli de modification
manuelle comme `conf7ds-v3`.

Les ressources essentielles continuent à être préchargées. Les API Supabase et
le client Supabase CDN restent exclus du cache.

### Installation sans interruption

Le nouveau service worker ne doit plus appeler `skipWaiting()` automatiquement
pendant son installation.

Lorsqu’une nouvelle version atteint l’état `installed` alors qu’un contrôleur
existe déjà :

- elle reste en attente ;
- l’application affiche une bannière de mise à jour ;
- la page courante continue de fonctionner avec sa version actuelle.

Le premier service worker installé sur un appareil s’active normalement sans
afficher de bannière inutile.

### Bannière de mise à jour

La bannière est intégrée dans `index.html` et contient :

- le texte **« Nouvelle version disponible »** ;
- un bouton **Mettre à jour** ;
- un bouton accessible pour fermer temporairement la bannière.

Elle est utilisable au clavier, possède un libellé compréhensible par les
lecteurs d’écran et respecte les zones sûres mobiles.

Fermer la bannière ne refuse pas définitivement la version : elle peut
réapparaître après un rechargement si le worker attend toujours.

### Activation choisie

Le bouton **Mettre à jour** :

1. retrouve le worker en attente ;
2. lui envoie le message `SKIP_WAITING`;
3. désactive le bouton pour empêcher les doubles clics ;
4. affiche un état d’action en cours ;
5. attend l’événement `controllerchange` ;
6. recharge la page une seule fois.

Le service worker écoute `message` et n’appelle `skipWaiting()` que pour ce
message explicite.

Si le worker attendu n’existe plus, l’application masque la bannière et
continue sans rechargement forcé.

### Détection des versions

Après l’enregistrement :

- un worker déjà en attente affiche immédiatement la bannière ;
- `updatefound` surveille une nouvelle installation ;
- une vérification périodique légère appelle `registration.update()` lorsque
la page reste ouverte longtemps ;
- un retour de l’application au premier plan peut également vérifier les
  mises à jour.

Les erreurs d’enregistrement ou de vérification ne bloquent jamais
l’application et ne produisent pas de boucle de notifications.

### Stratégie réseau

Les navigations restent `network-first`, avec repli sur le document mis en
cache hors ligne.

Les fichiers applicatifs essentiels utilisent une stratégie qui privilégie la
fraîcheur en ligne et retombe sur le cache hors ligne. Les images locales
peuvent conserver `stale-while-revalidate`, car elles sont nommées de manière
stable et indépendantes de la logique JavaScript.

Cette séparation réduit le risque de charger un nouveau document avec
d’anciennes données JavaScript après une mise à jour.

## Gestion des erreurs

- Échec des tests : aucun job de déploiement.
- Échec de préparation ou de déploiement : l’ancienne version Pages reste la
  dernière version disponible.
- Échec de vérification PWA : aucune bannière trompeuse ; le site actuel reste
  utilisable.
- Échec d’activation après clic : le bouton redevient utilisable et le site ne
  recharge pas en boucle.
- Hors ligne : le builder et les ressources déjà installées continuent de
  fonctionner selon le contrat PWA existant.

## Tests

### Workflow

Un test Node statique vérifie :

- les déclencheurs Pull Request, push `main` et manuel ;
- la dépendance du déploiement au job de test ;
- `npm ci`, l’installation Chromium et `npm test` ;
- les permissions Pages minimales ;
- la préparation depuis l’état Git ;
- le remplacement du marqueur de version ;
- les étapes officielles de configuration, artefact et déploiement.

### Service worker

Les tests PWA vérifient :

- la version de cache fondée sur le marqueur déployé ;
- l’absence de `skipWaiting()` pendant `install` ;
- le handler `SKIP_WAITING` ;
- l’exclusion Supabase/CDN ;
- les stratégies réseau des documents, fichiers applicatifs et images ;
- le nettoyage des anciens caches.

### Interface

Un test Playwright avec un faux conteneur Service Worker vérifie :

- worker déjà en attente ;
- worker nouvellement installé ;
- affichage et fermeture de la bannière ;
- envoi unique de `SKIP_WAITING` ;
- bouton occupé pendant l’activation ;
- un seul rechargement logique après `controllerchange` ;
- aucune activation ou recharge automatique avant le clic.

Les tests mobiles existants contrôlent aussi l’absence de débordement
horizontal de la bannière.

## Hors périmètre

- Synchronisation détaillée et date de dernière mise à jour.
- Conflits d’édition Supabase.
- Optimisation des images.
- Skeletons, file de toasts et mémorisation du défilement.
- Modification du workflow de rappel Discord.
- Changement du domaine personnalisé.
