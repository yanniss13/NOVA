# Passation — comparateur de dégâts, réparation du catalogue

**Date :** 2026-08-04
**Branche :** `comparateur-degats-lot1` (dépôt principal, pas un worktree)
**État :** lot 1 terminé et corrigé. **Non poussé.**

> L'avancement réel se lit dans `git log`, pas ici. Ce document peut être
> périmé dès sa rédaction.

---

## Le déclencheur

Le membre a ouvert la fiche de sa Merlin et lu :

| Arme | Puissance affichée |
|---|---|
| Livre (glace) | 140 707 |
| Baguette (foudre) | 63 316 |

Or **sa Merlin foudre frappe plus fort en jeu**. Le classement disait
l'inverse. Il avait raison, le chiffre avait tort.

## La cause, établie par sondage — pas devinée

Le catalogue ne retenait que les compétences dont 7dsorigin.app publie le
champ `damagePercent`. Ce champ est **null dès que l'effet sort du coup
simple**. Résultat : **118 compétences non passives sur 320 étaient
absentes**, très inégalement réparties.

- Meliodas : 5 compétences par arme, aucune perdue.
- **Gowther : zéro compétence retenue**, sur les trois armes.
- Merlin : 4 retenues au Livre, **2 à la Baguette**, 1 au Bâton.

L'écart de 2,2× que le membre voyait était le rapport des **coefficients
cumulés** (512 % contre 255 %), soit 2,01. Il mesurait la couverture du
catalogue, pas la puissance du build.

Deux gros coups de la Merlin foudre manquaient : **Judgment of Thunder
(159 %)** et **Plasma Dome: Overload (406 %)**.

## Ce que le sondage a révélé en plus

Sondes jetables écrites dans le bac à sable, **non commitées** (elles
aspirent le site tiers ; ne pas les rejouer sans raison) :
`sonde-merlin.py`, `sonde-globale.py`, `cache-competences.py`,
`releve-descriptions.py`.

1. **`damagePercent` = somme de `hitDamages`** quand la liste existe
   (79 cas sur 79). C'est bien un total, pas un par-coup.
2. **La première phrase de la description ne vaut pas ce champ** : 88
   désaccords sur 228.
3. **L'attaque sautée vaut 25 %**, rangée en tête de `hitDamages` et omise
   de la description. Donc `total = 25 + combo`. **Vérifié exactement sur
   39 des 49** attaques sautées ; les 10 autres ont un `hitDamages`
   **tronqué par la source**, donc un `damagePercent` sous-estimé
   (howzer : 71 publié, 183 réel).
4. Quelques `damagePercent` sont **absurdes** : `bug_axe_skill_e` annonce
   31,3 % là où le texte dit 188 %.

## Le correctif

### `scripts/generate-competences.py`

Nouvelle fonction **`degats_de(skill) -> (pourcentage, nature)`**, avec
une priorité établie en confrontant les sources, documentée dans sa
docstring :

1. `hitDamages` s'il existe → somme (sauf attaque sautée : `max(somme, 25 + combo)`)
2. dégât périodique **borné** → `tick × ticks`, nature `duree`
3. la description → nature `direct`
4. `damagePercent` en dernier recours (tournures à paliers « 166 % / 237 % »)
5. sinon → `(None, "non-chiffree")`

Une compétence non chiffrable **reste au catalogue** avec
`pourcentage: null`, pour que la vue puisse annoncer combien d'effets
échappent au calcul plutôt que de les taire.

### `tests/test_generate_competences.py` — **NOUVEAU, à câbler**

16 tests hors ligne sur les règles. **Toutes les descriptions sont
recopiées telles quelles depuis la source** (balises de couleur comprises) :
une règle validée sur du texte réécrit ne prouve rien.

> ⚠️ **Ce fichier n'est PAS encore dans `package.json`.** Il faut l'ajouter
> aux scripts **`test` ET `test:unit`**, à côté de
> `python -m unittest tests/test_generate_stats.py`. Sans ça il ne tournera
> jamais — l'erreur a déjà été commise sur `tests/accueil.test.js`.

### `data/competences.js` — régénéré

**361 compétences dont 316 chiffrées**, contre 228 avant.

### `tests/competences-catalogue.test.js`

Assertions ajoutées : `nature` valide, `pourcentage === null` si non
chiffrée, ≥ 250 chiffrées, **au plus 6 couples (perso, arme) sous-couverts**,
Gowther non vide, et les deux coups de la Merlin foudre nommément.

## Le résultat

| Arme de Merlin | Chiffrées | Coefficients cumulés |
|---|---|---|
| Baguette (foudre) | **5 / 5** | **1028 %** |
| Livre (glace) | 5 / 6 | 745 % |
| Bâton | 3 / 5 | 407 % |

**La Baguette passe devant.** Le classement rejoint ce que le membre
observe en jeu. C'est la seule validation qui compte ici : aucun test ne
peut prouver qu'un modèle de dégâts correspond au jeu.

---

## Ce qui reste à faire

1. **Câbler `tests/test_generate_competences.py` dans `package.json`**
   (`test` et `test:unit`). Non fait.
2. **Lancer `npm test` en entier.** Non fait, faute de quota.
   Vérifiés isolément et **verts** : `test_generate_competences.py` (16),
   `competences-catalogue.test.js`, `degats-calcul.test.js`.
   Deux tests Playwright sont connus pour être instables — `supabase-etape1`
   (44 px) et `accessibilite-mobile` (tuile du picker) — les relancer avant
   de crier à la régression.
3. **Annoncer les non chiffrées dans la fiche.** 45 compétences ont
   `pourcentage: null`. La vue doit dire combien, selon la convention du
   dépôt : **« Non inclus dans le calcul »** (voir `detail-piece.js:120`,
   `stats-heros.js:154`). Non fait.
4. **Corriger le commentaire faux de `js/metier/degats-calcul.js:93`.** Il
   affirme que le cycle « reste équitable parce que chaque type d'arme porte
   les mêmes catégories ». **C'est faux**, la donnée le dément, et c'est
   précisément l'hypothèse qui a produit le contresens. Non fait.
5. **Pousser la branche.** `comparateur-degats-lot1` n'a **jamais** été
   poussée : `ff9f7b3`, `91cabae`, `4e51cc1`, `e90e077`, plus ce commit.
6. Lots 2, 3, 4 du comparateur : non spécifiés.

## Décisions assumées, à ne pas défaire sans raison

- **Les effets conditionnels ne comptent pas.** « Divine Judgment » à 329 %
  s'obtient en enchaînant deux fois en sept secondes : le compter
  promettrait un dégât que le joueur n'a pas à coup sûr.
- **Un dégât périodique sans fin annoncée** (« while the stance is
  maintained ») reste non chiffré. Il n'y a rien à totaliser.
- **Un dégât indexé sur la DEF** sort du calcul : la formule part de l'ATK.
- **Le cycle n'est pas un DPS.** Les temps de recharge ne sont pas modélisés
  et la vue doit continuer à le dire.

## Contraintes de sécurité toujours en vigueur

- L'URL du webhook Discord est un **secret** : jamais dans la conversation,
  jamais dans le dépôt. Elle se pose par `gh secret set DISCORD_WEBHOOK_URL`.
- `SUPABASE_SERVICE_ROLE` reste un secret GitHub, jamais dans le site public.
- La convention de stage signée est une donnée personnelle : hors du dépôt
  public.
