# Audit mobile et accessibilité des parcours principaux

## Objectif

Rendre les parcours principaux utilisables au clavier, sur écran tactile et avec
les technologies d'assistance, sans modifier l'identité visuelle héraldique du
site.

Cette étape vise les problèmes observables et automatisables ; elle ne prétend
pas constituer à elle seule une certification WCAG complète.

## Gestion centralisée des modales

Un gestionnaire commun prendra en charge les overlays suivants :

- Picker d'équipement/personnage ;
- éditeur du roster ;
- potentiel ;
- détail d'équipe ;
- authentification.

À l'ouverture, il mémorise l'élément déclencheur et place le focus sur le premier
contrôle pertinent. Tant que la modale est ouverte :

- `Tab` et `Maj+Tab` restent dans la modale supérieure ;
- `Échap` ferme uniquement la modale supérieure qui autorise la fermeture ;
- une fermeture rend le focus au déclencheur encore présent dans le document ;
- les modales imbriquées fonctionnent en pile, notamment le Picker ouvert depuis
  l'éditeur du roster.

Les overlays fermés sont masqués pour l'affichage et les lecteurs d'écran. Les
fonctions métier existantes restent responsables de leurs brouillons ; le
gestionnaire ne manipule que le focus et l'état de dialogue.

## Navigation principale

Les boutons de navigation appliqueront complètement le motif ARIA des onglets :

- identifiants stables ;
- `role="tab"`, `aria-controls`, `aria-selected` et `tabindex` itinérant ;
- vues associées avec `role="tabpanel"` et `aria-labelledby` ;
- flèches gauche/droite, `Début` et `Fin` pour déplacer puis activer l'onglet.

La navigation à la souris et au toucher reste inchangée.

## Retours accessibles

- Le toast devient une région `aria-live`.
- Les erreurs urgentes sont annoncées sans dépendre de leur seule couleur.
- L'indicateur Realtime utilise également un statut textuel annoncé.
- Les boutons composés uniquement d'une icône conservent ou reçoivent un
  `aria-label`.
- Un style `:focus-visible` commun rend le focus perceptible sur tous les
  contrôles interactifs.

## Mobile et zones tactiles

Sur les périphériques tactiles, les principaux contrôles interactifs auront une
zone d'au moins 44 × 44 pixels : boutons, onglets, puces, fermetures, choix
d'équipement et options de menu.

Les correctifs respecteront les contraintes suivantes :

- largeur du document toujours inférieure ou égale au viewport ;
- contenus longs cassables sans élargir une carte ;
- overlays limités à la hauteur dynamique disponible et contenu interne
  défilable ;
- barres de défilement toujours visuellement masquées, sans supprimer le
  défilement ;
- zones fixes compatibles avec les marges sûres des téléphones.

## Réduction des mouvements

Sous `prefers-reduced-motion: reduce`, les animations et transitions décoratives
seront désactivées globalement. Les changements d'état restent immédiatement
visibles et aucune fonction ne dépend d'une animation.

## Tests d'acceptation

- Toutes les vues principales restent dans la largeur d'un viewport mobile.
- Chaque contrôle tactile représentatif mesure au moins 44 × 44 pixels.
- Les flèches, `Début` et `Fin` pilotent les onglets et mettent à jour leurs
  attributs ARIA.
- L'ouverture d'une modale place le focus à l'intérieur.
- `Tab` et `Maj+Tab` bouclent dans la modale supérieure.
- `Échap` ferme la bonne modale et restitue le focus.
- Le Picker imbriqué rend le focus à l'éditeur du roster.
- Le toast et l'état Realtime possèdent une région live textuelle.
- Le média `prefers-reduced-motion` neutralise les animations ciblées.
- Les tests actuels de défilement, potentiel, Supabase et sessions de boss
  continuent de passer.
