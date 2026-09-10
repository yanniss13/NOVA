# Passation à Claude Code — apparence NOVA

État au 10 septembre 2026. Dépôt :
`C:\Users\yanni\Desktop\Site Confrérie 7ds`.
Branche relevée : `main`, HEAD `6391978`.

## La demande et le point d'arrêt

L'utilisateur a demandé : « tu peut essayer de faire un truc sympa pour mon
site avec les 2 screens joint ? (c'est juste des exemple ne recopie pas
betement) ». Les références représentent une interface fantasy NOVA, l'une
ivoire/or, l'autre obsidienne/violet, avec un décor de château, des héros et
des panneaux de composition d'équipe.

Une première version fonctionnelle est réalisée dans le vrai site. Ce n'est
pas une maquette indépendante. Elle est prête à être essayée localement,
mais **l'utilisateur n'a pas encore donné de retour esthétique final**.
Il demande maintenant cette passation pour que Claude Code continue.

L'utilisateur a brièvement demandé d'inverser les positions des châteaux,
puis a immédiatement annulé : « ah non j'ai rien dit pardon ».
**Ne pas appliquer cette demande annulée : les deux châteaux restent à droite.**

Le travail est **non commité et non publié**, dans le répertoire courant.
Ne pas réinitialiser les modifications locales. Aucun changement Supabase,
aucune migration et aucun changement des règles de calcul n'ont été faits.
La demande de passation ne constitue pas une demande de publication.

## Lire avant de reprendre

1. `AGENTS.md`, intégralement : consignes et contraintes du projet.
2. `js/ARCHITECTURE.md` : modules, couches et cascade CSS.
3. `docs/apparence-nova.md` : direction visuelle, assets et prompts exacts.
4. Cette passation, puis `git status` et le diff actuel. Les fichiers nouveaux
   non suivis ne figurent pas dans un simple `git diff` : les ouvrir aussi.

## Ce qui a été réalisé

- Marque NOVA dans l'en-tête, avec un petit emblème astral SVG. Le lien
  affilié LootBar et les destinations de navigation existantes sont conservés.
- Bannière commune entre l'en-tête et le contenu, avec le texte
  « Une confrérie. Des légendes à écrire. » et un lien vers `#builder`.
  Elle est plus courte dans les vues autres qu'Accueil et Builder.
- Deux panoramas originaux, générés par ImageGen : la même citadelle sous une
  éclipse violette et sous un soleil d'aube. Les références n'ont pas été
  recopiées comme interface, ni découpées pour fabriquer le site.
- Sélecteur Ténèbres/Lumière sur la bannière, disponible aussi sur mobile.
  Ténèbres est le choix par défaut. La préférence est locale, indépendante
  du compte, mémorisée et synchronisée entre les onglets du navigateur.
- Couleurs, boutons, cadres de héros, formulaires et panneaux retravaillés.
  Les contrôles fonctionnels restent à leur place. Les champs du nom et du
  pseudo prennent maintenant toute la largeur sur mobile.
- Traitement explicite des anciens fonds sombres et des couleurs de statut
  qui rendaient certains textes illisibles sur le thème clair.

Les palettes et la typographie sont détaillées dans `docs/apparence-nova.md`.
La conception actuelle concentre le décor dans la bannière et utilise des
cadres fins pour garder les outils lisibles. C'est une proposition de Codex,
pas une exigence esthétique irrévocable du propriétaire.

## Carte des fichiers

| Fichier | Rôle / modification |
| --- | --- |
| `index.html` | Marque, SVG, bannière et sélecteur ; charge le CSS et le module d'ambiance |
| `css/ambiance.css` — nouveau | Toute la nouvelle apparence ; chargé **en dernier** |
| `js/vues/ambiance.js` — nouveau | Applique le thème et sa préférence, sans rendu des vues |
| `assets/ambiance/nova-tenebres.webp` — nouveau | Panorama sombre, 2172 × 724, 162 166 octets |
| `assets/ambiance/nova-lumiere.webp` — nouveau | Panorama clair, 2172 × 724, 253 170 octets |
| `sw.js` | Nouveau CSS, module et deux images ajoutés à `CORE_ASSETS` |
| `tests/ambiance.playwright.js` — nouveau | Parcours de bascule, persistance et mobile |
| `scripts/lancer-tests.js` | Inclut ce nouveau parcours dans la suite E2E |
| `tests/css-ordre.test.js` | Déclare `ambiance` en dernier dans la cascade |
| `tests/helpers/modules.js` | Répertorie le module pour le chargeur et les gardes |
| `AGENTS.md`, `js/ARCHITECTURE.md` | Documentent le nouveau thème |
| `docs/apparence-nova.md` — nouveau | Documentation visuelle et prompts ImageGen |

Le module d'ambiance est chargé directement par une balise module dans le
`head`, indépendamment du démarrage applicatif. Il pose `data-theme` sur
`document.documentElement`, met à jour `aria-pressed` et la meta `theme-color`.
Clé : `confrerie7ds.ambiance`, valeurs `dark` et `light`.
Une valeur inconnue revient à `dark`. Un refus de stockage n'empêche pas la
bascule pendant la session. Ne pas reconstruire le Builder pour changer de
thème : cela pourrait perdre son brouillon ou son focus.

Les WebP sont autonomes et précachés (environ 406 Kio ensemble). Aucun asset
existant n'a été écrasé. Les PNG originaux restent dans :
`C:\Users\yanni\.codex\generated_images\01a08aea-11fb-7432-97cd-b888797e2e63\`.
Leur nom est `exec-3bbf3845-08ff-4106-a40e-59000634b076.png` pour Ténèbres et
`exec-5f9033f6-4425-44c9-bae8-3e2d39c837eb.png` pour Lumière.
Le site ne dépend pas de ces chemins privés.

## Vérifications réellement effectuées

- Premier `npm test` : **99/99 commandes unitaires, 24/24 parcours E2E** au vert.
- Après intégration du nouveau parcours et corrections :
  `node scripts/lancer-tests.js e2e` : **25/25 parcours** au vert.
- Après les derniers ajustements de couleurs : `node tests/ambiance.playwright.js`,
  `node tests/css-ordre.test.js`, `node tests/modules-imports.test.js`,
  `node tests/pwa.test.js` et `git diff --check` ont réussi.
- Le nouveau parcours vérifie la conservation du nom d'équipe et du héros
  choisi pendant les bascules, la mémoire après rechargement, les valeurs
  invalides, la synchronisation entre onglets, le clavier et le stockage refusé.
  Il mesure aussi les cibles de 44 px et l'absence de débordement horizontal
  à 320, 390, 768 et 1440 px, dans les deux thèmes.
- Captures inspectées : Builder sombre/clair, mobile, Wiki et picker clair.
- Revue indépendante : fonds des cartes Boss, statuts d'erreur/OCR,
  médaillons et cellules Dispos corrigés. Les contrastes de plusieurs cas
  représentatifs ont été mesurés ; ce n'est pas un audit exhaustif de chaque
  état du site. Le texte secondaire clair a ensuite été légèrement assombri.

Les preuves locales, ignorées par Git, sont dans `test-results/nova/` :
`full-suite.log`, `e2e-final.log`, `builder-dark.png`, `builder-light.png`,
`mobile-dark.png`, `mobile-light.png`, `wiki-light.png`, `picker-light.png`.
Le script temporaire de capture a été supprimé ; les captures sont conservées.
Les captures de référence bloquaient les requêtes externes, donc utilisaient
les polices de repli si Cinzel n'était pas déjà disponible. Vérifier aussi
le rendu réel avec la police web chargée.

## Reprendre concrètement

1. Ouvrir `http://127.0.0.1:8000/#builder`. Un serveur Python a été laissé
   actif à la fin de la session ; vérifier avant d'en lancer un deuxième.
   Sinon : `python -m http.server 8000 --bind 127.0.0.1`, depuis la racine.
2. Regarder les deux thèmes avec des héros sélectionnés, puis les vues
   utilisées au quotidien : roster, équipement, Boss, Dispos et Wiki.
   Utiliser les jeux de données simulés des tests pour les cas connectés,
   sans modifier les données réelles de la confrérie pour une démonstration.
3. Prendre en compte le prochain retour du propriétaire. Sans nouvelle
   consigne précise, poursuivre la finition visuelle et la lisibilité dans
   ce périmètre ; aucune nouvelle fonctionnalité métier n'est demandée.
4. Pour les captures, attendre la stabilisation des transitions : une capture
   juste après la bascule peut montrer les anciennes couleurs des boutons
   sur les nouveaux fonds pendant environ 150–200 ms. Ce phénomène a déjà
   été distingué des vrais défauts de contraste.
5. Après modification, lancer les vérifications adaptées puis `npm test`
   avant une proposition de publication. La publication attend l'autorisation
   du propriétaire ; les nouveaux fichiers devront être suivis par Git,
   puisque GitHub Pages construit le site depuis `git archive HEAD`.

## Contraintes à préserver

- Les deux châteaux à droite : la demande d'inversion a été annulée.
- Aucune réécriture des catalogues générés ou des calculs pour une retouche visuelle.
- Le mode hors ligne, la pile de modales, les droits et le focus clavier.
- La barre mobile au pouce et ses zones de sécurité ; ne pas la recouvrir.
- La cascade CSS : toute nouvelle feuille doit être déclarée dans le test
  d'ordre et précachée. Le module d'ambiance doit rester déclaré également.
- Ne pas remplacer `__BUILD_VERSION__` dans le service worker à la main.
- Ne pas normaliser les fins de ligne de fichiers entiers : `index.html` et
  `AGENTS.md` ont un historique mélangé CRLF/LF.

À ce point, aucun défaut bloquant connu ne reste ouvert. La prochaine étape
est la poursuite de la finition avec Claude Code et le retour visuel du
propriétaire, pas un déploiement automatique.
