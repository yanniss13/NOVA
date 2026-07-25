# Menu d’élément DPS personnalisé — Design

## Objectif

Remplacer le menu natif de sélection d’élément du recensement DPS par un
composant entièrement cohérent avec le thème héraldique sombre de
l’application, sans modifier le modèle de données ni le comportement de
sauvegarde.

## Périmètre

- Uniquement le choix d’élément présent dans chaque ligne DPS du recensement.
- Les sept éléments et leurs couleurs continuent de provenir de la constante
  `ELEMENTS`.
- La valeur enregistrée reste l’identifiant actuel de l’élément.
- Aucun changement aux données locales, à Supabase ou aux autres sélecteurs.

## Composant

Le sélecteur natif est remplacé par :

1. un bouton déclencheur affichant le point coloré, le nom de l’élément courant
   et une flèche dorée ;
2. une liste superposée contenant les sept choix ;
3. une option par élément avec point coloré, libellé et coche pour la valeur
   sélectionnée.

Une seule liste peut être ouverte à la fois. Choisir une option met à jour la
ligne DPS avec le mécanisme de sauvegarde existant, puis ferme la liste.

## Direction visuelle

- Déclencheur compact intégré à la ligne DPS existante.
- Panneau obsidienne, bordure or vieilli, ombre pourpre discrète.
- Option survolée ou ciblée : contraste renforcé et fond pourpre assombri.
- Option sélectionnée : texte plus clair, marque dorée et coche visible.
- Animation courte limitée à l’ouverture ; aucune animation si
  `prefers-reduced-motion` est actif.
- Largeur adaptée au contenu, sans débordement sur mobile.

## Interactions et accessibilité

- Clic sur le déclencheur : ouvrir ou fermer la liste.
- Clic sur une option : sélectionner et fermer.
- Clic extérieur : fermer.
- `Flèche haut` et `Flèche bas` : déplacer le focus actif.
- `Entrée` ou `Espace` : ouvrir ou sélectionner.
- `Échap` : fermer et rendre le focus au déclencheur.
- Le déclencheur expose `aria-haspopup="listbox"` et `aria-expanded`.
- La liste utilise le rôle `listbox`, les choix le rôle `option` et
  `aria-selected`.
- Le focus reste visible au clavier.

## Comportement des données

Le gestionnaire de sélection appelle la même mise à jour que le menu actuel :
il remplace uniquement l’élément de la ligne concernée, enregistre le
recensement et relance son rendu. Le format stocké ne change pas.

## Vérification

- Sélectionner chacun des sept éléments à la souris.
- Recharger la page et confirmer la persistance de la valeur.
- Parcourir et sélectionner entièrement au clavier.
- Vérifier la fermeture par `Échap` et clic extérieur.
- Vérifier qu’une seule liste s’ouvre à la fois.
- Contrôler l’affichage aux largeurs ordinateur et mobile.
- Confirmer que le recensement local et Supabase conservent le même format.
