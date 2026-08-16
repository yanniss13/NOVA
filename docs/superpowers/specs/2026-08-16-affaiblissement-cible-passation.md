# Passation — recensement « Affaiblissement de la cible »

Date de rédaction : 2026-08-16
Destinataire : tout agent qui reprend ce chantier (Codex, Claude, autre).

> **Lis ce doc en entier, puis vérifie-le avec `git log`.** Un document de
> passation peut être faux dès sa rédaction : il décrit un état, et l'état
> bouge. Les commits, eux, ne mentent pas.

---

## 1. Les trois documents, et ce que chacun tranche

| Document | Ce qu'il tranche | Ne cherche pas ailleurs |
|---|---|---|
| [`specs/2026-08-16-affaiblissement-cible-design.md`](2026-08-16-affaiblissement-cible-design.md) | **Pourquoi**, et les cinq décisions du propriétaire | le périmètre, ce qui est écarté et pourquoi |
| [`plans/2026-08-16-affaiblissement-cible.md`](../plans/2026-08-16-affaiblissement-cible.md) | **Comment**, en cinq tâches testables | le code exact, les ancres vérifiées, l'ordre des commits |
| ce fichier | **Où on en est**, et les pièges | l'état d'avancement, ce qui a déjà coûté du temps |

Le plan contient le code réel de chaque étape, y compris les treize phrases de
provenance — **elles ont été vérifiées une par une contre les descriptions
réelles**. Ne les réécris pas « au propre » : trois d'entre elles sont longues
exprès (voir le piège nº 1).

---

## 2. État à la rédaction — et comment le vérifier vraiment

Au moment où ces lignes sont écrites : **spec et plan écrits, aucune ligne de
code produite.** Cinq commits locaux, aucun poussé.

Ne me crois pas. Vérifie :

```bash
git log --oneline -12
git log --oneline origin/main..HEAD          # ce qui n'est pas encore pousse
grep -c '"drake"\|"escanor"\|"king"' data/buffs-supports.js
ls js/metier/affaiblissement-cible.js 2>/dev/null
```

Lecture du résultat :
- `data/buffs-supports.js` sans `"drake"` → **tâche 2 non faite**, commence au début.
- `"drake"` présent mais pas `"gil-thunder"` → tâche 2 faite, **tâche 3 à faire**.
- `js/metier/affaiblissement-cible.js` absent → **tâche 4 à faire**.
- `grep -c debuff-row css/analyse.css` à 0 → **tâche 5 à faire**.

Et le juge de paix, qui ne dépend d'aucun de ces indices :

```bash
npm run test:unit
```

---

## 3. Le contexte en dix lignes

Le site est l'outil d'une confrérie **7DS Origin** (HTML/CSS/JS statiques,
GitHub Pages, Supabase pour les comptes et le partage). L'onglet **Analyse**
recense aujourd'hui les **DPS** de la confrérie : qui les possède, à quel
potentiel, pour quel élément.

Rien n'y dit **qui peut affaiblir le boss**, alors que c'est la seconde moitié
d'une composition. Ce chantier ajoute cette moitié.

Le cas qui décide de toute la conception est **Escanor à l'épée à deux mains** :
son slot porte le rôle `Attacker`, pas `Supporter`. Un recensement fondé sur le
rôle ne le verrait jamais — et c'est lui qu'on veut voir. **Le critère est donc
l'effet transcrit, jamais le rôle.** Si tu te surprends à filtrer sur un rôle,
tu as pris le mauvais chemin.

---

## 4. Les pièges, par ordre de temps perdu

### 1. `(Max : ` n'est pas une ancre — sauf quand elle l'est

Le test `nombreApres()` exige qu'une `phraseCumuls` apparaisse **exactement une
fois** dans la description, sinon il ne saurait pas de quel nombre il parle. Or
sur quatre descriptions elle apparaît deux fois :

| gameId | occurrences | ancre à employer |
|---|---|---|
| `escanor_sword2h_jumpatk` | 5 fois / 100 fois | `"sont infligés. (Max : "` |
| `guila_rapier_skill_e` | 5 fois / 100 fois | `"sont infligés. (Max : "` |
| `tioreh_wand_skill_q` | 5 fois / 100 fois | `"sont infligés. (Max : "` |
| `gowther_wand_skill_e` | 100 (jauge) / 4 fois | `"pendant 30s. (Max : "` |

Les autres prennent `"(Max : "` sans risque. Le plan porte la bonne ancre pour
chacune ; ne les uniformise pas.

### 2. Un relevé automatique ne peut pas établir ce périmètre

Un premier relevé par expressions régulières annonçait 19 personnages et
~33 lignes. **Il était faux dans les deux sens** :

- il comptait « réduit les dégâts subis de 20 % » — un bonus **défensif sur le
  porteur** — comme un malus infligé à l'ennemi. 21 phrases écartées à ce titre ;
- il ne voyait pas la **portée** d'un effet, parce que la restriction vit
  souvent dans une autre phrase que l'effet. Chez Meliodas : « réduit la
  résistance crit. *contre les attaques de Meliodas* de 3 %. Réduit **en
  outre** la défense crit. de 50 % » — la phrase qui porte « défense » ne porte
  pas la restriction.

Les 17 couples candidats ont donc été **lus en entier, un par un**. Le résultat
est neuf lignes, pas trente-trois. Si tu veux étendre le périmètre plus tard :
lis, ne grep pas.

### 3. Deux orthographes pour un seul personnage

Gil Thunder écrit ses identifiants tantôt `gil_thunder_lance_skill_rmb`,
tantôt `gilthunder_shield_passive`. Tout découpage par position lit « thunder »
comme une arme sur le premier. La règle du **jeton `_<enum>_`** les couvre
toutes les trois ; c'est la raison d'être de `armeDuGameId()` (tâche 1).

### 4. La table n'est pas chargée par l'onglet Analyse

`data/buffs-supports.js` n'est injecté qu'**à la demande**, par
`chargerCatalogues()` de `js/vues/calculateur.js` — qui en charge sept, dont
`competences.js` et ses 7491 lignes. L'Analyse doit charger la sienne, seule.
La tâche 5 lui donne son propre chargeur, et explique pourquoi il ne partage
pas celui du calculateur.

### 5. La spec se trompe sur deux points, corrigés dans le plan

Elle affirme que les tests existants couvrent les nouvelles lignes « sans
modification » : **faux deux fois**. `tests/calculateur-entrees.test.js` exige
une liste exacte de personnages, et exige que **chaque** ligne change une
entrée du moteur — ce qu'une ligne `horsCalcul` ne fait jamais. Elle annonce
aussi « 33 nouvelles lignes » de cases à cocher : c'est **13 lignes, dont 9
seulement** deviennent des cases à cocher. Le plan liste ces écarts en tête,
avec trois autres.

### 6. Deux tests Playwright sont instables

`supabase-etape1.playwright.js` (un écart de 44 px, et le focus temps réel du
boss) et `accessibilite-mobile.playwright.js` (la tuile du picker) échouent par
intermittence. **Relance avant de crier à la régression.** Inversement : le
runner CI Linux a des polices plus larges qu'en local, donc une assertion de
largeur peut passer chez toi et casser le déploiement.

---

## 5. La règle qui gouverne tout : aucune valeur inventée

`data/buffs-supports.js` est **le seul fichier de `data/` qu'aucun script ne
régénère**. La source amont ne publie pas ces valeurs — son champ `buffs` ne
porte qu'un identifiant, un type et une durée — donc elles sont transcrites à
la main depuis les descriptions françaises de `data/wiki-competences.js`.

Ce qui tient lieu de générateur, c'est le test :

- chaque `gameId` doit exister dans le wiki ;
- chaque `phrase` doit être un extrait **littéral** de sa description ;
- pour une valeur à cumuls, le nombre qui suit l'ancre doit **égaler** la
  valeur stockée, et `parCumul × cumuls === valeur` ;
- un code de stat inventé est refusé — la liste autorisée est
  `7ds-stats/libelles-stats.json`, pas une liste écrite dans le test.

**Ce que ces tests ne prouvent pas** : qu'une phrase a été *comprise*. Une
valeur mal interprétée les passe sans broncher. Les treize valeurs restent donc
à vérifier en jeu, comme les trois hypothèses de formule déjà signalées dans
`AGENTS.md`.

---

## 6. Le cas `horsCalcul`, et pourquoi il existe

Quatre lignes réduisent la **résistance à la Foudre** de l'ennemi. Ce n'est pas
une bizarrerie : **14 personnages** réduisent la résistance élémentaire, et
l'enjeu est gros — retirer 15 points à une résistance de 30 % vaut **+21 % de
dégâts**.

Le moteur connaît `resistanceElementaire` sur la cible, mais **rien ne la
réduit**. Y brancher ces lignes modifierait la formule. Or `d-eew`, le champ
correspondant chez l'outil de référence, **n'a jamais été mesuré**
(`RAPPORT-analyse-tapscreen.md`) : on ignore s'il se retranche en points ou en
pourcentage. Ajouter un terme non mesuré à la formule est précisément ce que ce
dépôt refuse.

D'où le drapeau. Une ligne `horsCalcul:true` est **vraie, sourcée et
inexploitable par le moteur** : le recensement l'affiche pour composer un
groupe, `buffsApplicables()` l'ignore, et aucune case à cocher mensongère
n'apparaît dans le calculateur.

> **La garde la plus importante de tout le chantier** est le test qui vérifie
> que `buffsApplicables()` ne rend **jamais** une ligne consignée, pour aucun
> élément. Sans lui, une ligne finirait un jour en case à cocher, le membre la
> cocherait, son total ne bougerait pas — et il croirait pourtant son effet
> compté. Le silence est ici pire que l'absence.

Suite prévue, **hors de ce chantier** : mesurer `d-eew` chez tapscreen selon la
méthode déjà éprouvée, puis retirer le drapeau sans retoucher les données.
Réserve honnête : le rapport signale une anomalie inexpliquée sur le voisin
`d-elementres`, qui se comporte différemment sur un vrai boss et sur le
mannequin. Si `d-eew` fait de même, la mesure pourrait ne rien conclure.

---

## 7. Les règles du dépôt qu'on oublie une fois, puis plus jamais

- **Ordre des couches.** `tests/helpers/modules.js` tient l'ordre de
  chargement, et `tests/modules-imports.test.js` refuse qu'un module en importe
  un déclaré **après** lui. Toute extraction ajoute son fichier dans sa couche.
- **Un export que personne n'importe est refusé.** Pour exposer une fonction
  interne à un test, passe par le crochet `HOOK_EXPORT` de
  `tests/helpers/load-app.js`, pas par un `export`.
- **Le bac à sable `vm` concatène tous les modules dans une seule portée.**
  Deux `const` homonymes dans deux modules se heurtent — c'est pourquoi une même
  idée porte trois noms (`TAUX_PLEIN`, `DIX_MILLIEMES`, `RAPPORT`).
- **Les tableaux créés dans le `vm` échouent à `deepStrictEqual`.** Le dépôt
  fournit `plain(valeur)` pour ça.
- **Commentaires de code sans accents**, libellés affichés avec.
- **Espace insécable** : les phrases citées en contiennent. Un outil d'édition
  peut convertir l'échappement en vrai caractère ; si un test dit qu'une phrase
  est introuvable alors qu'elle semble identique, c'est ça.
- **Ne commite jamais avec `git add -A`** sur ce dépôt : le propriétaire y
  dépose des fichiers pendant que tu travailles. Nomme tes fichiers.

---

## 8. Quand c'est fini

1. `npm test` en entier, deux fois si un Playwright instable a parlé.
2. Regarder la page pour de vrai — l'étape 6 de la tâche 5 liste quoi vérifier.
3. Mettre à jour `AGENTS.md` : le recensement d'affaiblissement rejoint la
   liste de l'état actuel.
4. Ne pousse que si le propriétaire l'a demandé.

Ce qui reste ouvert après ce chantier est listé en fin de plan
(« Hors de ce plan ») : la mesure de `d-eew`, la vérification en jeu des treize
valeurs, les deux lignes de défense élémentaire écartées par la décision 4, et
le cas Meliodas laissé dehors pour ambiguïté de portée.
