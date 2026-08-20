# NOVA

NOVA est une PWA communautaire pour **The Seven Deadly Sins: Origin**. Elle réunit dans une même interface la préparation des builds, le suivi des rosters et l’organisation hebdomadaire d’une confrérie.

[Ouvrir la démo](https://yanniss13.github.io/NOVA/) · [Signaler un problème](https://github.com/yanniss13/NOVA/issues)

![Aperçu du wiki de NOVA](docs/images/nova-apercu.jpg)

## Fonctionnalités

- Team Builder avec armes, armures, bijoux, potentiels et statistiques expliquées.
- Roster partagé des personnages et des équipes, synchronisé avec Supabase.
- Analyse des forces de la confrérie par élément et calculateur de dégâts.
- Disponibilités hebdomadaires sous forme de grille de 168 créneaux.
- Deux images du planning visibles dans Discord (tableau hebdomadaire et
  créneaux écrits par membre), générées à la demande avec `/planning`.
- Sessions de boss, trois runs par membre, rapports et historique des scores.
- Assistant de composition en lecture seule : meilleurs créneaux et groupes équilibrés de cinq membres maximum.
- Wiki des héros et de l’équipement, suivi de collection et fonctionnement PWA hors ligne.

L’assistant de boss ne réserve aucune place. Il combine les disponibilités déclarées, le potentiel, les builds renseignés et leur diversité élémentaire ; la décision reste aux membres.

## Stack et architecture

Le client repose sur du **HTML, CSS et JavaScript natif**, sans étape de build. Supabase fournit l’authentification, PostgreSQL, les politiques RLS et Realtime. Les scripts Python régénèrent les catalogues du jeu. Playwright et les tests Node/Python couvrent les parcours, les calculs, le schéma SQL, l’accessibilité et la PWA.

Le JavaScript suit cinq couches contrôlées automatiquement :

```text
noyau → état → métier pur → données Supabase → vues DOM → app.js
```

Le détail des responsabilités se trouve dans [js/ARCHITECTURE.md](js/ARCHITECTURE.md).

Le catalogue chiffré `data/stats-build.js` pèse environ 2,4 Mo. Il est chargé à la demande uniquement lorsqu’une vue de calcul, de wiki, d’analyse ou de configuration en a besoin. Après ce premier usage, le service worker peut le servir hors ligne.

## Lancer le projet

Prérequis : Python 3, Node.js 24 et npm.

```bash
npm ci
python -m http.server 8000
```

Ouvrir ensuite `http://localhost:8000`. Un serveur HTTP est requis : ouvrir directement `index.html` bloque les modules ES dans plusieurs navigateurs.

## Tests

```bash
npm run test:unit
npm run test:e2e
# ou la suite complète
npm test
```

Le déploiement GitHub Pages n’a lieu qu’après le passage de toute la suite dans GitHub Actions.

## Données générées

Les fichiers de `7ds-stats/` et `data/` sont produits par les scripts du dossier `scripts/`. Les collections JSON sont triées avec une clé stable afin qu’une variation d’ordre de la source ne crée plus de faux changements Git.

```bash
python scripts/generate-stats.py
python scripts/generate-stats-build.py
python scripts/generate-wiki.py
```

La source publique utilisée est `7dsorigin.app`. NOVA est un projet communautaire indépendant, sans affiliation avec Netmarble ou les ayants droit de la licence.

## Configuration Supabase

Le navigateur utilise uniquement une clé publique `anon`; les droits réels sont imposés par les politiques RLS de [supabase/schema.sql](supabase/schema.sql). Ne jamais placer de clé `service_role` ou de secret serveur dans ce dépôt.

Pour une autre instance, adapter `supabase-config.js`, puis appliquer le schéma SQL sur le projet Supabase cible.
