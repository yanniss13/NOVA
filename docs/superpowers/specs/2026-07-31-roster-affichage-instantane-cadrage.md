# Cadrage — affichage instantané du Roster

**Date :** 2026-07-31
**État :** cadrage interrompu (contexte épuisé), aucune ligne de code écrite.
**Avant de reprendre :** vérifie l'état réel avec `git log`, pas ce document.

## Le problème, mesuré

Après le correctif `679dbd8` (réservation de hauteur, CLS 0,52 → 0,0085),
l'utilisateur observe que l'onglet **Analyse s'affiche instantanément**, mais que
**Roster et Sessions de boss gardent un délai perceptible**.

Explication retenue, à confirmer dans le code : Analyse travaille sur des données
déjà en mémoire, tandis que ces deux vues attendent une réponse Supabase.
Ce n'est plus un problème d'affichage mais d'aller-retour réseau.

Chiffres de référence mesurés le 2026-07-30 en production, à ne pas refaire :

| Métrique | Valeur | Seuil |
| --- | --- | --- |
| LCP | 0,89 s | < 2,5 s |
| INP (CPU 4x, 4G) | 80 ms | < 200 ms |
| CLS après correctif | 0,0085 | < 0,1 |

Le site n'est donc lent ni au rendu ni à la réactivité. Seule l'attente réseau
reste.

## Décision prise

**Le cache local s'applique au Roster uniquement.**

Sessions de boss en est exclu délibérément : ses données sont **partagées**
(« Groupe 1 · 0/5 joueurs » se remplit avec d'autres membres). Afficher une copie
locale y ferait voir un groupe libre alors qu'il vient d'être complété, et
laisserait cliquer « Rejoindre » sur un groupe plein. Le Roster, lui, ne contient
que les données du membre, écrites depuis son propre appareil.

## Contrainte majeure découverte

**Le temps réel Supabase est déjà en place** dans `index.html` (abonnements
`channel` / `postgres_changes`). La fraîcheur est donc déjà assurée : le cache
local ne sert qu'à **remplir l'écran avant l'arrivée de la première réponse**,
pas à remplacer la synchronisation.

## Règles de conception non négociables

L'utilisateur a lui-même identifié le piège : si l'arrivée des données provoque
une reconstruction du DOM, les vignettes de personnages clignotent et la mise en
page re-saute — on réintroduirait en pire le défaut qu'on vient de corriger.

1. **Comparer avant de redessiner.** Si la réponse est identique aux données
   affichées, ne rien toucher. C'est le cas dans la quasi-totalité des ouvertures,
   puisque c'est le membre lui-même qui a écrit ces données.
2. **Mettre à jour uniquement ce qui diffère**, fiche par fiche, jamais la liste
   entière.
3. **Ne jamais vider le conteneur.** Pas de `innerHTML = ""` suivi d'une
   reconstruction : c'est ce geste qui recrée les `<img>` et fait clignoter.

## Questions restées ouvertes

- Le cache doit-il rendre le Roster consultable **hors connexion** (vraie
  fonctionnalité PWA), ou n'est-il qu'une astuce d'affichage ?
- Portée du cache : faut-il l'indexer par identifiant de compte et le purger à la
  déconnexion ? À trancher — deux membres partageant un ordinateur ne doivent pas
  voir le roster l'un de l'autre.
- Le délai se produit-il à chaque ouverture de l'onglet, ou seulement au premier
  chargement du site ? Cela change l'ampleur du gain.

## Points d'entrée dans le code

| Quoi | Où |
| --- | --- |
| Lecture du roster | `index.html` ~6095 et ~6252, `sb.from("roster_characters")` |
| Rendu | `renderRoster()`, `index.html` ~8591 |
| Bascule de vue | `showView()`, `index.html` ~6725 |
| Sessions de boss (hors périmètre) | `sb.from("boss_sessions")`, ~9570 |

## Reprise

Reprendre au cadrage : `superpowers:brainstorming`, questions ouvertes ci-dessus,
puis spec et plan. Rien n'a été implémenté, `main` est intact.
