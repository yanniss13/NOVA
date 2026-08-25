# Chronométrage des animations

> Fichier **généré** par `python scripts/lister-chronometrage.py`.
> Les mesures se saisissent dans `data/animations-mesurees.json`,
> jamais ici : cette page est réécrite à chaque exécution.

Aucune source publique ne donne ces temps. Ils se mesurent en jeu, et
cette liste existe pour rendre ce travail fini : elle dit quoi mesurer
d'abord, et ce que chaque mesure rapporte.

**Avancement : 0 / 13 mesurées.**

## 1. Mesures qui débloquent maintenant — 0 compétences

Sans recharge : l'animation sert de dénominateur au modèle de cadence.
Ces attaques normales et spéciales débloquent maintenant le calcul du DPS.

| héros | arme | compétence | catégorie | touche | dégâts % | mesure (s) |
|---|---|---|---|---|---|---|

## 2. Mesures qui affinent maintenant — 13 compétences

Avec recharge : le simulateur calcule déjà la compétence et
l'animation ajoute un retard. La colonne « erreur » donne ce qu'on
se trompe en l'ignorant, pour une animation supposée de 1.5 s.
Classement par erreur décroissante.

| héros | arme | compétence | catégorie | touche | recharge | erreur | mesure (s) |
|---|---|---|---|---|---|---|---|
| diane | Gantelets | Combinaison de coups de pied | Attaque spéciale | Q | 5 s | 23 % |  |
| hendrickson | Épée à une main | Perforation divine | Attaque spéciale | Q | 7.5 s | 17 % |  |
| guila | Épée & bouclier | Explosion resplendissante | Attaque ultime | R | 10 s | 13 % |  |
| tristan | Épée à deux mains | Entaille d'amputation | Attaque ultime | R | 10 s | 13 % |  |
| king | Grimoire | Bouclier gardien | Attaque spéciale | Q | 12 s | 11 % |  |
| escanor | Hache | Soleil condensé | Attaque spéciale | Q | 13.5 s | 10 % |  |
| bug | Hache | Rossée des ténèbres | Compétence normale | E | 14 s | 10 % |  |
| bug | Épées doubles | Double taillade des abysses | Attaque spéciale | Q | 14 s | 10 % |  |
| diane | Gantelets | Ferveur martiale | Compétence normale | E | 15 s | 9 % |  |
| escanor | Hache | Lignée orgueilleuse | Compétence normale | E | 15 s | 9 % |  |
| hendrickson | Lance | Brise-lance abyssal | Attaque spéciale | Q | 15 s | 9 % |  |
| bug | Hache | Pulvérisation des abysses | Attaque spéciale | Q | 16.2 s | 8 % |  |
| bug | Épées doubles | Extermination | Compétence normale | E | 20.9 s | 7 % |  |

## 3. Relèves — simulation d’équipe future — 0 compétences

Les compétences de relève seront calculées avec une future simulation
d'équipe. Leur mesure est utile pour préparer ce modèle, sans modifier
encore le DPS affiché.

| héros | arme | compétence | catégorie | touche | dégâts % | mesure (s) |
|---|---|---|---|---|---|---|
