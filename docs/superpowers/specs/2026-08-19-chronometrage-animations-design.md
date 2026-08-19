# Chronométrage des animations — conception

Date : 19 août 2026
Branche : `feat/chronometrage-animations`

## Le problème

Aucune source publique ne donne les temps d'animation de 7DS Origin. Sans
eux, 151 compétences sans recharge n'ont pas de DPS calculable : leur
animation *est* le dénominateur. 225 autres, à recharge, ont un DPS faux de
4 à 23 %.

`docs/chronometrage-animations.md` dit déjà quoi mesurer et dans quel ordre.
Il manque de quoi mesurer.

## Ce que l'exploration a établi

**L'animation dépend du héros ET de l'arme.** Meliodas à la hache frappe
« Dark Axe » à 189 %, à l'épée à une main « Dark Slash » à 185,1 %, aux épées
doubles « Dark Dual Slash » à 187,3 %. Trois noms, trois valeurs, trois
animations. La mesure porte donc sur un `gameId`, qui porte les trois
informations : héros, arme, emplacement.

| | mesures |
|---|---:|
| Sans recharge (débloquent) | **151** |
| Avec recharge (affinent) | 225 |
| Non chiffrables (hors calcul) | 41 |
| **À mesurer** | **335** |

> **Correction du 19 août, après un premier jet.** Cette conception affirmait
> d'abord que le moveset appartenait au héros seul, ce qui ramenait le travail
> à 161 mesures. C'était faux, et l'erreur venait d'une question mal posée de
> ma part : « est-ce la même animation quelle que soit l'arme ? » a été
> comprise comme « entre deux haches du même héros ». Les données le disaient
> pourtant — noms et pourcentages distincts par arme.
>
> Découvert avant toute mesure, donc sans donnée corrompue. Ce qui a changé :
> l'outil demande l'arme, une mesure ne renseigne qu'un `gameId`, la table
> Supabase est indexée par `game_id`, et deux tests qui verrouillaient le
> mauvais modèle ont été repris. Effet secondaire heureux : chaque mesure
> correspondant désormais à une seule compétence, la liste affiche son vrai
> nom français au lieu d'un libellé inventé.

**Le goulot est double : le volume et la possession.** 151 mesures ne tiennent
pas en une soirée. Mais mesurer `klotho_*` suppose de
posséder Klotho. Il manque deux héros au propriétaire du site ; d'autres
membres les ont. La collecte est donc partagée par nécessité de roster, pas
par volume — et par envie de ne pas tout faire seul.

**La table des touches est fausse.** `TOUCHES_CATEGORIES` a permuté E et Q.
Vérifié en jeu :

| catégorie | affiché aujourd'hui | correct |
|---|---|---|
| Attaque normale | clic gauche | clic gauche |
| Compétence normale | Q | **E** |
| Attaque spéciale | E | **Q** |
| Attaque ultime | R | R |
| Compétence de relève | 1 à 4 | 1 à 4 |

Le `gameId` ne donne pas la touche : `skill_rmb_ready` se déclenche sur Q et
`skill_q` sur R. Ce sont des noms internes qui ont dérivé. La catégorie reste
la bonne source, il n'y a que deux valeurs à échanger.

Un membre qui suit la colonne actuelle mesure la mauvaise compétence et
range une valeur juste au mauvais endroit, sans que rien ne le signale.

## Périmètre

Cinq livrables, dans cet ordre.

### 1. Correction des touches

Échanger E et Q dans `TOUCHES_CATEGORIES` de `scripts/lister-chronometrage.py` :
`NORMAL_SKILL` passe à `E`, `ACTIVE_THIRD` passe à `Q`. Les trois autres
entrées ne bougent pas.

C'est un correctif de deux lignes, mais il conditionne tout le reste : tant
qu'il n'est pas fait, le document dit à qui le lit d'appuyer sur la mauvaise
touche, et toute mesure venue d'un tiers est suspecte.

Un test verrouille la table complète, pour que la permutation ne puisse pas
revenir.

### 2. Garantie du français

Le test existant verrouille déjà l'en-tête, les libellés d'armes et de
catégories, et l'absence de noms anglais. Deux ajouts :

- il assert désormais la table de touches corrigée ;
- un test tourne le générateur sur les **vraies** données et échoue si une
  seule compétence retombe sur `skill["nom"]` au lieu de son `nomFr`. C'est
  la garantie demandée : le document ne peut plus repartir en anglais sans
  faire échouer la suite.

### 3. Outil de chronométrage

`outils/chrono-animation.html` et `outils/chrono-animation.js`, sans
dépendance, servis par GitHub Pages. Page non listée dans la navigation et
exclue par `robots.txt` : discrète, pas privée.

La vidéo est chargée par `<input type="file">` et **ne quitte jamais la
machine**. Aucun envoi, aucun stockage.

Déplacement image par image via `requestVideoFrameCallback` : flèches
gauche/droite pour une image, avec `Maj` pour dix.

**Mode rafale**, pour les 56 sans recharge. Le mesureur enchaîne l'attaque,
marque la première image du coup 1 puis celle du coup N+1, et l'outil divise
par N. Deux gains : l'erreur est divisée par N, et la question « quand
l'animation se termine-t-elle » ne se pose jamais. On mesure l'intervalle
entre deux lancements, qui est exactement le dénominateur du DPS. Aucune
convention à écrire ni à faire respecter.

**Mode unique**, pour celles à recharge. Deux marqueurs, début et fin.
L'animation n'y est qu'un retard ajouté à la recharge, le dixième de seconde
suffit.

Héros et emplacement se choisissent dans deux listes alimentées par
`data/competences.js`. Aucun `gameId` n'est saisi à la main. L'outil affiche
les `gameId` que la mesure va renseigner, et l'avancement lu depuis
`data/animations-mesurees.json`.

### 4. Boîte de réception Supabase

Table `animation_measures` : `id`, `owner`, `pseudo`, `hero`, `slot`,
`seconds`, `mode`, `reps`, `fps`, `created_at`.

RLS : un membre authentifié insère ses propres lignes ; la lecture est
ouverte, comme le reste des données du site.

**Pas de colonne de statut, pas de rôle d'administration.** La table est un
journal d'envois. L'acceptation est une décision locale, matérialisée par
l'écriture dans `animations-mesurees.json`. Inventer un rôle admin pour
trois contributeurs coûterait plus qu'il ne rapporte.

### 5. Commande de rapatriement

`python scripts/rapatrier-mesures.py` lit la table, la compare au JSON, et
affiche ce qui est nouveau. Elle signale les désaccords — deux membres, même
emplacement, valeurs écartées de plus de 10 % — sans trancher à la place de
l'auteur.

À l'acceptation, elle écrit la valeur sur **tous les `gameId` du couple
héros × emplacement**. Le fichier reste indexé par `gameId`, son format ne
change pas, le générateur n'est pas touché. Si une arme s'avère plus tard
faire exception, sa ligne s'écrase seule.

`animations-mesurees.json` reste la source de vérité, versionnée dans git et
relue avant publication. Une mesure fausse ne peut pas atteindre le
calculateur sans passer sous les yeux de quelqu'un.

## Ce qui n'est pas fait

- Pas de saisie depuis un téléphone. Avancer image par image au doigt est
  impraticable ; un membre qui filme sur mobile termine sur ordinateur.
- Pas de modération dans la base, pas de rôle admin.
- Pas de mesure des 41 compétences `non-chiffrees`, sans dégâts modélisés.
- Pas de mesure du temps de lancement des 11 compétences `duree` : leur
  durée de dégâts est déjà publiée dans les données.

## Tests

- Unitaire Python : les cinq couples catégorie/touche, verrouillés.
- Unitaire Python : aucune compétence ne retombe sur son nom anglais.
- Unitaire JS : arithmétique images → secondes → division par N.
- Playwright : la page charge une vidéo générée à la volée, marque deux
  images, et produit la durée attendue.
- Unitaire Python : le rapatriement écrit bien sur tous les `gameId` du
  couple, et signale un désaccord au-delà de 10 %.

## Ordre d'exécution

1 et 2 d'abord, seuls : le document doit dire vrai avant qu'on outille sa
lecture. 3 ensuite, utilisable seul avec copier-coller. 4 et 5 en dernier,
une fois qu'on sait que des membres enregistrent réellement.
