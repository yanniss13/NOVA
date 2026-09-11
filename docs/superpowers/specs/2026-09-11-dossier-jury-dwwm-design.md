# Dossier jury DWWM — conception

Date : 11 septembre 2026

Projet : Site Confrérie 7DS — Team Builder / Boss de Guilde

Certification ciblée : TP Développeur web et web mobile, RNCP37674

## 1. Objectif

Produire dans `docs/jury/` un dossier complet, cohérent et prêt à être utilisé
pour la soutenance DWWM. Le dossier doit expliquer le projet à un jury qui ne
connaît ni 7DS Origin ni son vocabulaire, démontrer les compétences réellement
mises en œuvre et donner au candidat un support fiable pour une présentation de
35 minutes.

Le dossier de MoniteurConnect sert uniquement de référence pour le niveau de
finition et les catégories de livrables. Aucun texte, écran, chiffre, schéma ou
résultat de conformité propre à MoniteurConnect ne doit subsister.

## 2. Référentiel et règles de vérité

La structure des compétences suit la fiche officielle France Compétences
RNCP37674, valable du 1er septembre 2023 au 1er septembre 2028 :
<https://www.francecompetences.fr/recherche/RNCP/37674/>.

Le dossier couvre explicitement les huit compétences des deux blocs :

1. installer et configurer l’environnement de travail ;
2. maquetter des interfaces utilisateur web ou web mobile ;
3. réaliser des interfaces utilisateur statiques ;
4. développer la partie dynamique des interfaces ;
5. mettre en place une base de données relationnelle ;
6. développer des composants d’accès aux données SQL et NoSQL ;
7. développer des composants métier côté serveur ;
8. documenter le déploiement d’une application dynamique.

Toute affirmation technique ou quantitative doit être rattachée à une preuve
reproductible : fichier du dépôt, test automatisé, résultat d’audit daté,
capture réelle, schéma SQL ou configuration de déploiement. Les limites doivent
être dites clairement. En particulier, le caractère statique de l’application
cliente, l’usage de Supabase comme back-end géré et le rôle des Edge Functions
ne doivent pas être présentés comme une architecture serveur développée de
toutes pièces.

## 3. Public et fil narratif

Le dossier s’adresse d’abord à un jury de développeurs, pas aux joueurs. Chaque
notion du jeu utile à la démonstration sera définie en une phrase.

Le fil narratif recommandé est :

1. une confrérie doit coordonner ses membres, leurs équipes et leurs créneaux ;
2. l’application centralise ces informations et automatise les calculs
   complexes nécessaires au boss de guilde ;
3. le navigateur reste utilisable hors ligne pour la construction locale ;
4. Supabase apporte comptes, persistance partagée, RLS et temps réel ;
5. les tests, la PWA et la CI sécurisent les évolutions et le déploiement.

La démonstration principale suivra un parcours transversal : connexion,
consultation du suivi, modification d’un build, composition d’une équipe,
analyse ou calcul de dégâts, disponibilités, puis groupe ou rapport de boss.

## 4. Arborescence cible

```text
docs/jury/
├─ README.md
├─ resume-projet.md
├─ expression-du-besoin.md
├─ specifications-fonctionnelles-techniques.md
├─ decoupage-fonctionnel.md
├─ architecture-application.md
├─ base-de-donnees.md
├─ securite-rgpd.md
├─ tests-qualite-deploiement.md
├─ competences-dwwm.md
├─ charte-graphique.md
├─ comparaison-conception-realisation.md
├─ conformite-accessibilite-responsive.md
├─ audit-certification-dwwm.md
├─ veille-technique.md
├─ veille-securite.md
├─ captures/
│  ├─ desktop/
│  └─ mobile/
├─ diagrammes/
│  ├─ architecture.svg
│  ├─ cas-utilisation.svg
│  ├─ modele-donnees.svg
│  └─ parcours-principal.svg
├─ soutenance/
│  ├─ soutenance.html
│  ├─ demo-11-minutes.md
│  └─ questions-reponses.md
└─ pdf/
   └─ miroir des documents destinés à l’impression
```

Des fichiers auxiliaires peuvent être ajoutés lorsque leur rôle est clair
(script d’export, manifeste de captures ou résultats d’audit). Aucun lot de
wireframes artificiels ne sera inventé après coup. La comparaison de conception
reposera sur les spécifications et maquettes historiques réellement présentes,
ainsi que sur l’évolution visible dans Git.

## 5. Contenu des livrables

### 5.1 Dossier écrit

- `README.md` sert de sommaire, de point de reprise et de checklist avant jury.
- `resume-projet.md` donne une lecture du projet en moins de cinq minutes.
- `expression-du-besoin.md` présente contexte, acteurs, objectifs, contraintes,
  critères d’acceptation et hors-périmètre.
- `specifications-fonctionnelles-techniques.md` décrit les fonctionnalités,
  règles métier, architecture et dépendances externes.
- `decoupage-fonctionnel.md` distingue les parcours visiteur, membre et
  administration, ainsi que les fonctions transversales.
- `architecture-application.md` explique le découpage `noyau` / `etat` /
  `metier` / `donnees` / `vues`, la PWA, les catalogues générés et les Edge
  Functions.
- `base-de-donnees.md` décrit les entités Supabase, leurs relations, les RPC,
  les instantanés et les politiques RLS.
- `securite-rgpd.md` couvre authentification, autorisations, données exposées,
  secrets, validation, risques résiduels et données personnelles.
- `tests-qualite-deploiement.md` documente la suite Node/Playwright/Python, la
  CI GitHub Pages, le service worker et la procédure de livraison.
- `competences-dwwm.md` relie chacune des huit compétences à des réalisations et
  à des preuves précises.
- `charte-graphique.md` décrit l’identité NOVA, les thèmes, composants,
  typographie, couleurs, états et règles d’accessibilité.
- `comparaison-conception-realisation.md` retrace les décisions et écarts
  justifiés sans prétendre qu’une maquette inexistante a précédé le produit.
- `conformite-accessibilite-responsive.md` rassemble les contrôles automatisés
  et manuels datés, avec leurs limites.
- `audit-certification-dwwm.md` classe chaque attente en « prouvée », « à
  renforcer » ou « non couverte ».
- Les deux veilles contiennent des sources officielles ou primaires, leur date,
  l’enseignement retenu et son application au projet.

### 5.2 Diagrammes

Les sources SVG restent lisibles et modifiables dans le dépôt. Chaque diagramme
possède une légende et un équivalent directement visible dans le document qui
l’emploie. Les quatre diagrammes minimaux sont : architecture globale, cas
d’utilisation, modèle relationnel et parcours de démonstration.

### 5.3 Captures et conformité

Les captures proviennent de l’application réellement servie en HTTP. Elles
couvrent au minimum l’accueil, le Team Builder, le roster, la fiche de build,
l’analyse, le calculateur, le suivi, les disponibilités, les groupes de boss et
l’administration lorsque cette dernière est démontrable sans données privées.

Deux familles sont conservées : ordinateur et mobile. Les comptes, adresses et
données de membres réels sont masqués ou remplacés par des données de
démonstration. Une capture ne constitue pas à elle seule une preuve
d’accessibilité ; les contrôles clavier et les audits restent séparés.

### 5.4 Soutenance

Le support HTML vise 25 à 30 diapositives pour 35 minutes. Les notes orateur
indiquent le temps cible, le message essentiel et la transition. Le scénario de
démonstration réserve environ 11 minutes et prévoit une solution de secours par
captures si Supabase ou le réseau est indisponible.

Le document de questions/réponses prépare notamment : architecture sans
framework, choix de Supabase, RLS, stockage JSONB, sécurité, accessibilité,
offline/PWA, tests, dette technique, limites du calculateur, RGPD et pistes
d’évolution.

### 5.5 PDF

Les documents destinés au jury sont exportés en PDF avec une arborescence
miroir. Les PDF sont contrôlés visuellement après rendu : pages non coupées,
tableaux lisibles, diagrammes nets, liens internes cohérents et aucune page
blanche accidentelle.

## 6. Méthode de production

1. Inventorier le code, le schéma SQL, la CI, les tests, les spécifications et
   l’historique Git.
2. Construire une matrice « compétence DWWM → réalisation → preuve → limite ».
3. Rédiger le socle documentaire et les diagrammes.
4. Servir l’application et produire des captures représentatives avec des
   données de démonstration non sensibles.
5. Exécuter les tests et audits disponibles ; enregistrer seulement les
   résultats réellement obtenus.
6. Écrire le support de soutenance, la démonstration et les questions/réponses.
7. Exporter les PDF et vérifier visuellement les fichiers rendus.
8. Contrôler les liens, les références, les dates et l’absence de vestiges de
   MoniteurConnect.

## 7. Gestion des limites et erreurs

- Une fonctionnalité qui nécessite un compte ou une configuration Supabase
  indisponible est documentée depuis le code et marquée comme non vérifiée en
  conditions réelles.
- Un audit impossible à exécuter n’est jamais remplacé par un résultat supposé.
- Les chiffres de tests sont datés et régénérés avant livraison.
- Les données générées volumineuses ne sont pas reproduites dans le dossier ;
  leur pipeline et leurs contrôles sont expliqués.
- Les fausses pistes déjà consignées dans
  `docs/chantier-calculateur-codex.md` ne sont pas rouvertes.

## 8. Vérification et critères d’acceptation

Le dossier est terminé lorsque :

- aucun fichier ne mentionne MoniteurConnect autrement que pour expliquer que
  son dossier a servi de modèle structurel ;
- les huit compétences RNCP37674 disposent chacune d’au moins une preuve ou
  d’une limite explicitement assumée ;
- les liens Markdown et HTML internes sont valides ;
- les diagrammes et captures référencés existent ;
- la suite `npm test` a été rejouée et son résultat daté est reporté sans
  extrapolation ;
- les pages principales ont été contrôlées aux largeurs mobile et bureau ;
- le support de présentation tient dans le format de 35 minutes ;
- la démonstration possède un parcours nominal et un scénario de secours ;
- chaque PDF s’ouvre et a été vérifié après rendu ;
- `git diff --check` ne signale aucune erreur de format dans les fichiers
  textuels produits.

## 9. Hors périmètre

- Modifier l’application uniquement pour embellir le dossier, sauf demande
  distincte après identification d’un défaut bloquant.
- Inventer des résultats de tests, une mise en production ou des mesures dans
  le jeu.
- Copier les contenus, captures ou preuves d’un autre projet.
- Publier, pousser ou transmettre le dossier sans demande explicite.
