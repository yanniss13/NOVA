# Rapport — rétro-ingénierie comportementale du Damage Calculator de tapscreen.app

Date : 2026-08-07
Cible analysée : `https://tapscreen.app` → *Damage Calculator* (iframe `calculator.html`), mode **Advanced**.
Objectif : produire un calculateur de dégâts indépendant pour NOVA.

---

## 0. Méthode et périmètre

Ouverture de `tapscreen.app` → *Damage Calculator* → modale « Work in Progress » → mode
**Advanced**. Le calculateur vit dans une iframe `tapscreen.app/calculator.html`, ouverte
directement pour travailler sur un DOM propre.

Ce qui **n'a pas** été fait : aucune lecture de bundle JS, aucune extraction de leur base
de 58 ennemis / 63 builds, aucun contournement de protection. Tous les résultats ci-dessous
viennent de **~70 calculs boîte noire**, une variable modifiée à la fois, lus dans
`#out-nc` / `#out-crit` / `#out-avg`.

Note environnement : un seul navigateur était connecté à l'extension (« Browser 1 »,
Windows). L'extension ne remonte pas la marque, donc impossible de confirmer Edge vs Chrome.

---

## 1. Réseau — résultat net

**Aucune requête Fetch/XHR, aucun JSON public, aucun backend.** Ni au chargement, ni au
changement de stat, ni au clic sur *Calculate*. Les seules requêtes observées sont une
webfont Tabler (jsdelivr) et des images en `data:` base64.

→ Personnages, builds, compétences, ennemis et formule sont **entièrement embarqués côté
client**. Il n'y a pas d'API à consommer, et donc rien à « brancher » : pour disposer de ces
données, il faut les produire soi-même.

---

## 2. Ce que l'UI expose

| Bloc | Champs |
|---|---|
| Personnage | `char-sel`, `build-sel`, `pot-sel`, onglets Normal Attack / Normal Skill / Special / Ultimate / Tag, carte de compétence (ex. *Earth Cleaver* 109 %, 3 coups 26/31/52), variante **Full combo / 1st hit only** |
| Stats perso | `atk`, `ea` (ATK élémentaire), `cd`, `cc`, `edi` (dégâts élém. %), `eai`, `ds` (**defense shatter**), `dmgpct` (set), `skilldmg` (dmg % du type d'attaque) |
| Cible | `enemy-sel` (58 entrées), stats auto-remplies **selon l'élément du perso**, mécaniques spécifiques (ex. Corrupted Ancient Dragon : 6 stacks × 10 % de défense élémentaire) |
| Calibration | **`cval` — constante de pénétration C, marquée REQUIRED**, avec un solveur « Solve → » à partir d'un coup non-critique observé en jeu |
| Debuffs ennemi | `d-ecr` (rés. crit), `d-ecdr` (déf. crit), `d-edef` (déf. %), `d-epr` (rés. protection), `d-eew` (rés. élém. %), `d-elementres` (**déf. élémentaire en points bruts**) |
| Buffs alliés | `d-cc`, `d-cd`, `d-atk`, `d-edi`, `d-nadmg`, `d-tagdmg`, `d-def`, `d-hp` |
| Sorties | non-crit, crit, moyenne + « effective crit chance » |

Auto-description du site : *« v4 — Confirmed formula, 95 % accuracy (310+ test hits) »*.

---

## 3. La formule déduite

Toutes les relations ci-dessous sont **mesurées**, puis **validées** par une prédiction à
l'aveugle sur une configuration combinée (13 variables simultanées) :
prédit **2 138 681**, obtenu **2 138 728** — écart 0,002 %.

```
ATK_tot   = (ATK + ATK_élém) × (1 + buffATK%/100)

Bracket   = 1 + faiblesse + (EDI% + DMG_set% + SkillDMG% + debuffRésÉlém%) / 100
            ⚠ TOUT est additif dans UN SEUL seau, faiblesse élémentaire comprise

DEF_eff   = max(0, DEF_base × (1 − réducDEF%/100)) + défÉlémBrute

Mitig     = C / (C + DEF_eff) + DefenseShatter% / 100        ⚠ non plafonné

NonCrit   = ATK_tot × coefCompétence × K_cible × Bracket × Mitig

CritMult  = 1 + CD_tot%/100 − max(0, défCrit_cible − réducDéfCrit%/100)
Crit      = NonCrit × CritMult

p         = min(90, max(0, CC_tot% − max(0, résCrit_cible% − réducRésCrit%))) / 100
Moyenne   = NonCrit + p × (Crit − NonCrit)
```

### Preuves marquantes

**Le seau additif unique** — c'est le point le plus contre-intuitif. Sur le Training Dummy
(faiblesse 0) : `edi 50` → ×1,5 ; `dmgpct 50` → ×1,5 ; `skilldmg 50` → ×1,5 ; les trois à 50
→ **×2,5** (= 1 + 150/100), pas ×3,375. Sur Red Demon WL4 (faiblesse +20 %) le même +50 ne
donne plus ×1,5 mais **×1,4167 = 1 + 50/120** — la pente devient `1/(100×(1+faiblesse))`.
La faiblesse élémentaire est donc *dans* le seau, pas un multiplicateur séparé.

**Defense Shatter s'ajoute au ratio de pénétration, pas à la DEF.** Sur Red Demon,
`ds` 0/10/25/50/100/200 → 831 377 / 942 557 / 1 109 327 / 1 387 277 / 1 943 177 / 3 054 977 :
parfaitement linéaire, +A×0,01 par point. À 200 % on triple les dégâts. Aucun plafond.
Cas particulier : si `DEF_eff = 0`, le shatter est ignoré.

**C n'agit que via la DEF.** À DEF = 0 (Training Dummy), faire varier C de 1 à 10⁶ ne change
rien. À DEF > 0, le fit `C/(C+DEF)` est exact sur 9 valeurs de C (1 → 10⁶) avec DEF = 3373.

**Plafond de crit à 90 %.** `cc 100` + `cd 100` → moyenne 2 071 au lieu de 2 180, soit
p = 0,90 exactement. `cc 25` → p = 0,25 exact.

**La défense critique se soustrait au multiplicateur** (elle ne divise pas les CD) :
`critMult = 0,5707 + CD/100` sur Red Demon, donc défCrit = 0,4293. À `d-ecdr 50`, elle est
clampée à 0 et on retrouve `1 + CD/100` pile.

**ATK élémentaire s'additionne directement à l'ATK** : `atk 500k + ea 500k` ≡ `atk 1M`,
sur les deux cibles testées.

### Constantes de cible mesurées (contre Diane / Axe)

| Cible | DEF | Faiblesse | K | défCrit | résCrit |
|---|---|---|---|---|---|
| Training Dummy | 0 | 0 | 1,00 | — | — |
| Red Demon (WL4) | ≈ 3373 | +20 % | 0,85 | 0,4293 | 15 % |
| Gray Demon (WL4) | ≈ 3577 | 0 | 0,85 | non mesuré | non mesuré |

**Hypothèse sur K** : les deux boss donnent 0,85 et le dummy 1,00. `0,85 = 1 − 0,15` — c'est
très probablement la `résistanceElementaire` (15 % ici). Deux points de mesure ne suffisent
pas à le prouver ; à confirmer sur une cible dont la résistance est connue.

---

## 4. Champs qui ne font rien (v4)

Mesurés à 50, effet **strictement nul** :

- `eai` — *Elemental attack increase %* (pourtant documenté dans l'UI)
- `d-edi` — *Bonus elemental damage % (ally buff)*
- `d-nadmg` — *Bonus normal attack damage % (ally buff)*
- `d-epr` — *Enemy protection resist reduction %*

Les autres buffs alliés (`d-atk`, `d-cc`, `d-cd`) fonctionnent parfaitement. Ce sont donc des
champs morts ou conditionnels, pas un problème de câblage général. `d-tagdmg` n'a pas pu
être testé (page figée en fin de session).

**Anomalie non expliquée** : `d-elementres` (défense élémentaire brute) s'ajoute *exactement*
au dénominateur sur un vrai boss (+50 → DEF 3373 → 3423, prédiction au chiffre près), mais
sur le Training Dummy +50 ne produit que +5 d'effet.

---

## 5. Écarts avec `js/metier/degats-calcul.js` (état actuel du dépôt)

Bonne nouvelle : la structure crit (`1 + taux × (CD − résCD)`) et la mitigation `K/(K+DEF)`
**convergent** avec ce que fait TapScreen. Les divergences réelles :

| Sujet | Dépôt NOVA | Mesuré chez eux |
|---|---|---|
| Faiblesse | facteur séparé `× (1 + faiblesse)` | **additive dans le seau des bonus** |
| Defense shatter | absent | `+ DS%/100` sur le ratio, non plafonné |
| Plafond de crit | absent | **90 %** |
| K | constante 5600 | **calibré par build** (`C`), obligatoire |
| Réduc. DEF ennemie | absent | `DEF × (1 − r)` puis `+ défÉlémBrute` |

Le point 1 n'est pas cosmétique : à faiblesse 20 % et bonus 60 %, le modèle actuel donne
×1,92, le leur ×1,95.

Le point 4 est le plus embêtant : eux *refusent* de calculer sans C calibré (« an
uncalibrated C will give wrong damage numbers »). Le `K = 5600` fixe est un choix documenté
et défendable pour un **comparateur de builds** (il se simplifie dans un rapport entre deux
builds) — mais il ne donnera jamais le vrai chiffre absolu.

---

# Proposition d'implémentation pour NOVA

Le style du dépôt (module métier pur, sans DOM ni réseau, entrées par argument, commentaire
d'intention en tête) est respecté.

## Fichiers JSON

### `data/degats/cibles.json`

```json
{
  "version": 1,
  "unite": "pourcentages en dix-millièmes, cohérent avec le reste du dépôt",
  "cibles": {
    "akumu": {
      "nom": "Akumu, bête démoniaque",
      "def": 3454,
      "critResist": 2000,
      "critDefense": 5000,
      "resistanceElementaire": 3000,
      "faiblesses": { "Fire": 0, "Water": 0, "Wind": 0, "Earth": 0,
                      "Thunder": 0, "Dark": 0, "Holy": 0 },
      "source": "7dsorigin.app/en/knighthood-boss/demonic-beast-akumu"
    }
  }
}
```

`critDefense` remplace `critDmgResist` (même rôle, nom aligné sur la mécanique constatée).
**À remplir depuis nos propres relevés / le wiki** — pas depuis la base de TapScreen, qui est
leur travail de compilation.

### `data/degats/penetration.json`

```json
{
  "version": 1,
  "defaut": 5600,
  "note": "C par build, obtenu par calibration sur un coup non-critique réel. `defaut` reste une valeur de repli honnête pour comparer deux builds entre eux.",
  "parBuild": {}
}
```

## `js/metier/degats-formule.js` (nouveau, pur)

```js
/* Le modèle « v4 » : formule reconstituée par mesure boîte noire sur le
   calculateur public de tapscreen.app, une variable à la fois (~70 tirs,
   validée à 0,002 % sur une configuration à 13 variables).

   Trois écarts avec degats-calcul.js, tous mesurés, aucun supposé :
   la faiblesse élémentaire est ADDITIVE avec les bonus offensifs ;
   le defense shatter s'ajoute au RATIO de pénétration ;
   le taux de critique effectif plafonne à 90 %.

   Module PUR : ni DOM ni réseau. Pourcentages en dix-millièmes. */

const RAPPORT = 10000;
const PLAFOND_CRIT = 9000;   /* 90 %, mesuré */

const n = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

/* Le seau unique : tout ce qui augmente les dégâts s'y ajoute, faiblesse
   élémentaire comprise. Les séparer poserait une multiplication que la
   formule n'écrit pas. */
function seauOffensif(stats, cible){
  return 1 + (
    n(cible.faiblesse)
    + n(stats.bonusElementaire) + n(stats.bonusCategorie) + n(stats.bonusGlobal)
    + n(stats.debuffResistanceElementaire)
  ) / RAPPORT;
}

/* La DEF réduite en pourcentage NE PEUT PAS passer sous zéro, puis la
   défense élémentaire brute s'ajoute au même dénominateur. Ordre mesuré :
   inverser les deux donne 983 570 au lieu des 982 600 observés. */
function defenseEffective(cible, debuffs){
  const reduite = n(cible.def) * (1 - n(debuffs.reductionDef) / RAPPORT);
  return Math.max(0, reduite) + n(debuffs.defenseElementaireBrute);
}

function mitigation(defEff, C, defenseShatter){
  if(defEff <= 0) return 1;              /* le shatter est alors ignoré */
  return C / (C + defEff) + n(defenseShatter) / RAPPORT;
}

function multiplicateurCritique(stats, cible, debuffs){
  const defCrit = Math.max(
    0, n(cible.critDefense) - n(debuffs.reductionDefenseCritique)
  );
  return Math.max(0, 1 + (n(stats.critDamage) - defCrit) / RAPPORT);
}

function tauxCritiqueEffectif(stats, cible, debuffs){
  const resist = Math.max(
    0, n(cible.critResist) - n(debuffs.reductionResistanceCritique)
  );
  const brut = n(stats.critRate) - resist;
  return Math.min(PLAFOND_CRIT, Math.max(0, brut)) / RAPPORT;
}

/* `base` arrive déjà calculée (ATK+ATK_élém × coefficients de composantes),
   pour réutiliser tel quel baseDeDegats() de degats-calcul.js. */
function degatsV4({ base, stats, cible, debuffs = {}, C }){
  if(!Number.isFinite(base) || base <= 0) return null;

  const defEff   = defenseEffective(cible, debuffs);
  const mitig    = mitigation(defEff, n(C), stats.defenseShatter);
  const resist   = 1 - n(cible.resistanceElementaire) / RAPPORT;
  const seau     = seauOffensif(stats, cible);

  const sansCritique = base * seau * resist * mitig;
  const critMult     = multiplicateurCritique(stats, cible, debuffs);
  const avecCritique = sansCritique * critMult;
  const taux         = tauxCritiqueEffectif(stats, cible, debuffs);

  return {
    sansCritique,
    avecCritique,
    total: sansCritique + taux * (avecCritique - sansCritique),
    tauxCritiqueEffectif: taux,
    termes:[
      { id:"base",       libelle:"Base de dégâts",         valeur:base },
      { id:"seau",       libelle:"Bonus + faiblesse",      valeur:seau },
      { id:"resistance", libelle:"Résistance élémentaire", valeur:resist },
      { id:"mitigation", libelle:"Pénétration / DEF",      valeur:mitig },
      { id:"critique",   libelle:"Multiplicateur critique",valeur:critMult }
    ]
  };
}

export {
  degatsV4, seauOffensif, defenseEffective,
  mitigation, multiplicateurCritique, tauxCritiqueEffectif, PLAFOND_CRIT
};
```

## `js/metier/degats-calibration.js` (nouveau, pur)

```js
/* Résout C à partir d'UN coup non-critique réellement observé en jeu.

   Sans cette étape, la mitigation est une estimation : c'est pourquoi
   TapScreen marque son champ C « REQUIRED ». Le calcul est direct, pas
   itératif — la formule s'inverse. */

import { seauOffensif, defenseEffective } from "./degats-formule.js";

const RAPPORT = 10000;

function resoudreC({ degatsObserves, base, stats, cible, debuffs = {} }){
  const defEff = defenseEffective(cible, debuffs || {});
  if(defEff <= 0) return null;   /* aucune DEF : C est indéterminable */

  const seau   = seauOffensif(stats, cible);
  const resist = 1 - (Number(cible.resistanceElementaire) || 0) / RAPPORT;
  const attendu = base * seau * resist;
  if(!(attendu > 0)) return null;

  /* mitig = observé/attendu, puis on retire le defense shatter avant
     d'inverser C/(C+DEF). */
  const mitig = degatsObserves / attendu
    - (Number(stats.defenseShatter) || 0) / RAPPORT;
  if(!(mitig > 0) || mitig >= 1) return null;   /* hors domaine : refuser */

  return (mitig * defEff) / (1 - mitig);
}

export { resoudreC };
```

---

## Ce qu'il ne faut pas faire

Recopier leur base de 58 ennemis. La **formule** est une mécanique de jeu, observable et
réimplémentable librement ; leur table de stats est un travail de compilation qui leur
appartient. Le JSON proposé ci-dessus est un *schéma vide* à remplir depuis nos propres
relevés.

## Points à vérifier avant de committer

1. **K = 0,85 → résistance 15 %** : hypothèse construite sur 2 boss seulement.
2. `critDefense` d'Akumu = 5000 (50 %) dans le dépôt ; avec la formule mesurée, un build à
   moins de 50 % de CD ne critique plus du tout (multiplicateur clampé à 1). À recouper.
3. Le plafond de 90 % : mesuré chez eux, pas vérifié en jeu.
4. `d-tagdmg` non testé.

---

# Addendum — les quatre questions ouvertes (session 2)

Date : 2026-08-07. Même périmètre que la session 1 : boîte noire uniquement, `calculator.html`
en iframe isolée, aucune lecture de bundle. Seule différence de méthode : au lieu de cliquer,
j'ai appelé directement les fonctions globales exposées par la page — `calculate()`,
`solveC()`, `setAtkType()` — qui sont exactement les fonctions attachées aux boutons
correspondants (`onclick="calculate()"`, etc.). C'est strictement équivalent à cliquer ;
aucun code interne n'a été lu ou inspecté.

**Incident méthodologique à signaler** : un premier script groupant 5 calculs dans une boucle
asynchrone a dépassé le délai de la connexion à distance (45 s) et remonté une erreur de
timeout — mais le script a continué de tourner dans la page en arrière-plan après cette
erreur. Le résultat s'en est trouvé pollué sur une mesure (Escanor / Épée-et-Bouclier,
voir 1.a) : un C retrouvé de 10061 au lieu des 5600 injectés, que j'ai d'abord pris pour une
vraie anomalie. Refaite proprement (un seul appel, une seule valeur, une lecture, à chaque
étape), la même configuration redonne un écart de 0 %. Le rejeu propre est ce qui est reporté
ci-dessous ; je documente l'artefact ici parce que la consigne est de séparer le mesuré du
déduit, et que ceci illustre bien le risque.

## 1. Le solveur de C

### 1.a Round-trip complet, et dépendance au personnage / à l'arme / à la compétence

Protocole : je fixe une config complète (perso, build, compétence, cible, stats, debuffs à 0),
j'injecte un `cval` connu (C₀ = 5600), je lis `out-nc`, puis je réinjecte cette valeur dans
`cal-nc` avec la même cible dans `cal-enemy`, et j'appuie sur *Solve →*.

| Config | Cible | C injecté | `out-nc` (aller) | C retrouvé (`calib-out`) | Écart |
|---|---|---|---|---|---|
| Diane / Axe / Special Skill | Red Demon (WL4) | 5600 | 63 658 | **5600** | 0 % |
| Diane / Axe / Ultimate Move (coef très différent) | Red Demon (WL4) | 5600 | 236 170 | **5600** | 0 % |
| Escanor / Greatsword / Special Skill | Red Demon (WL4) | 5600 | 110 128 | **5600** | 0 % |
| Escanor / Sword&Shield / Special *« Solar Onslaught »* (build « Experimental », dégâts basés sur la **Défense** du perso, pas l'ATK) | Red Demon (WL4) | 5600 | 111 401 (mesure propre) | **5600** | 0 % |

Écart mesuré : **0 % dans les quatre cas**, y compris pour un build « Experimental » où le
champ `atk` est ré-étiqueté « Defence (displayed stat) » et où les cinq compétences du kit
(Normal Attack, Normal Skill, Special, Ultimate, Tag) sont TOUTES indexées sur la Défense du
perso plutôt que sur l'ATK — signalé par le bandeau d'avertissement du site lui-même.

**Fait UI mesuré séparément** : changer de personnage ou de build ne touche JAMAIS `cval`.
Testé Daisy → Diane → Escanor → retour Diane : `cval` reste strictement la valeur tapée par
l'utilisateur (99999 par défaut, sentinelle « REQUIRED »). Il n'y a donc **aucune base de C
par personnage intégrée à l'outil** — le texte « or enter a community-verified value » suppose
que l'utilisateur va chercher/coller cette valeur ailleurs, l'outil ne la propose pas.

**Ce qui est mesuré** : le solveur traite `C` comme une pure constante algébrique du ratio de
mitigation `C/(C+DEF)`, totalement découplée du coefficient de compétence et des multiplicateurs
de personnage — à condition d'entrer les bonnes stats et la bonne compétence en face du bon
coup observé. Round-trip exact sur 2 personnages, 3 armes/builds, et un type de formule
(ATK vs DEF) radicalement différent.
**Ce qui est déduit, pas mesuré** : que le *vrai* C en jeu soit réellement une constante de
personnage/build (comme l'affirme leur propre texte d'aide : *"C is a hidden character-specific
value... applies equally to all skills for that character and build"*) est une affirmation de
TapScreen sur leur design, pas quelque chose que j'ai pu vérifier avec de vrais coups en jeu.
Je n'ai testé que l'auto-cohérence de LEUR outil, pas la vérité du jeu.

### 1.b DEF = 0 (Training Dummy)

| `cal-enemy` | `cal-nc` entré | Résultat |
|---|---|---|
| Training Dummy | 100 000 (= `out-nc` mesuré à DEF=0, indépendant de C) | *« C calibration not needed for the Training Dummy — it has no Defense, so C has no effect. Use a real enemy to calibrate C. »* — `cval` inchangé |

Refus explicite et propre, pas de valeur absurde ni de crash. Confirme par la mesure directe
(le message du bouton, pas seulement le raisonnement) ce que la session 1 avait déduit.

### 1.c Coup observé trop grand (mitigation ≥ 1)

Plafond du non-crit mesuré indépendamment à C → ∞ (`cval = 999 999 999`) : **`out-nc` = 102 000**
sur cette config (Diane/Axe/Special vs Red Demon WL4). Balayage de `cal-nc` autour de ce plafond :

| `cal-nc` | C retrouvé |
|---|---|
| 90 000 | 25 297 |
| 95 000 | 45 776 |
| 99 000 | 111 309 |
| 100 000 | 168 650 |
| 101 000 | 340 673 |
| 101 500 | 684 719 |
| 101 800 | 1 716 857 |
| 101 900 | 3 437 087 |
| 101 950 | 6 877 547 |
| 101 990 | 34 401 227 |
| 101 999 | 344 042 627 |
| 101 999,5 | 688 088 627 |
| 101 999,9 | 3 440 456 627 |
| 101 999,99 | 34 404 596 645 |
| **102 000** | *« Invalid — damage exceeds pre-armor value. Check your stats or enemy selection. »* |
| 102 000,5 / 102 001 / 103 000 / 105 000 / 150 000 / 200 000 | même message *Invalid* |

Mesuré : pas de clamp arbitraire, pas de `NaN` silencieux. `C` diverge continûment vers l'infini
à mesure que le coup entré s'approche du plafond théorique (mitigation → 1), puis l'outil bascule
sur un message d'erreur explicite dès que le coup dépasse ce plafond (mitigation ≥ 1). La
transition asymptotique est nette : entre 101 999,99 (valide, C ≈ 3,4×10¹⁰) et 102 000 (invalide),
il n'y a pas de zone floue.

## 2. Le champ `ds` (Defense Shatter)

| Point demandé | Mesuré |
|---|---|
| Libellé exact | **« Defense shatter % »** — aucun texte d'aide, aucune infobulle nulle part sur la page (contrairement à `d-elementres` qui a un paragraphe « CONFIRMED formula » complet) |
| Attributs HTML | `type="number"`, `min="0"`, `step="0.01"`, pas de `max` |
| Valeur par défaut | `0` |
| Terme « penetration » ailleurs sur la page | Une seule occurrence, dans le libellé de `cval` : *« DEFENSE PENETRATION CONSTANT (C) »* — sans rapport avec `ds` |
| Terme « perforation » | **0 occurrence** sur toute la page |
| Terme « accuracy » | 2 occurrences, toutes dans le slogan marketing (*« v4 — Confirmed formula, 95% accuracy »*) — pas un nom de stat |
| `ds` négatif | `-50` et `-99999` sont acceptés dans le champ (`el.value` les garde, la validation HTML5 native les signale invalides — *« La valeur doit être supérieure ou égale à 0 »* — mais ça ne bloque pas `calculate()`) ; dans les deux cas, **sortie strictement identique** à `ds = 0` (63 658). Clampé à 0, pas de bonus de mitigation négatif. |

**Ce qui est mesuré** : TapScreen ne nomme, n'affiche et ne documente **aucune** stat distincte
de type « pénétration », « perforation » ou « précision » ailleurs dans son UI — `ds` est un
champ isolé, sans texte reliant son unité (pourcentage, pas de plage haute) à une mécanique de
jeu précise au-delà de son propre nom.
**Ce qui reste indéterminé** : je ne peux ni confirmer ni infirmer que ta stat « Perforation »
(valeur plate) correspond à `ds` (pourcentage) — TapScreen ne donne simplement pas assez
d'information pour trancher. C'est un vide chez eux, pas une réponse.

## 3. Le plafond de crit à 90 % — correction du rapport précédent

### 3.a Balayage fin de `cc` (Training Dummy, résistance crit de la cible = 0)

| `cc` | Chance de crit effective affichée | `out-nc` | `out-crit` | `out-avg` |
|---|---|---|---|---|
| 85 | 85,0 % | 100 000 | 180 000 | 168 000 |
| 88 | 88,0 % | 100 000 | 180 000 | 170 400 |
| 89 | 89,0 % | 100 000 | 180 000 | 171 200 |
| 90 | 90,0 % | 100 000 | 180 000 | 172 000 |
| 91 | **90,0 %** (plafonné) | 100 000 | 180 000 | 172 000 |
| 95 | 90,0 % | 100 000 | 180 000 | 172 000 |
| 100 | 90,0 % | 100 000 | 180 000 | 172 000 |

Le plafond de 90 % sur `cc` seul est confirmé au point près (bascule nette entre 90 et 91).

### 3.b Le même balayage via `d-cc` (buff allié) seul, `cc = 0`

`d-cc = 85` → 85,0 % effective, `out-avg = 168 000` : **identique** au cas `cc = 85` seul.

### 3.c Le plafond porte-t-il sur la somme ? — NON, et ceci contredit le rapport de la session 1

| `cc` | `d-cc` | Effective mesurée | Prédiction « plafond sur la somme » (hypothèse session 1) | Prédiction confirmée : « plafond sur `cc` seul, `d-cc` ajouté après » |
|---|---|---|---|---|
| 60 | 60 | **100,0 %** | 90 % | 100 % (60 non plafonné car < 90, +60 = 120, clamp final à 100) |
| 85 | 10 | **95,0 %** | 90 % | 95 % (85 non plafonné car < 90, +10) |
| 95 | 20 | **100,0 %** | 90 % | 100 % (min(90,95)=90, +20=110, clamp final à 100) |
| 100 | 5 | **95,0 %** | 90 % | 95 % (min(90,100)=90, +5) |

Vérification avec résistance crit non nulle (Red Demon WL4, résistance = 15 %) :

| `cc` | `d-cc` | Effective mesurée | Calcul |
|---|---|---|---|
| 100 | 0 | 85,0 % | min(90, 100−15) = 85 |
| 80 | 20 | 85,0 % | min(90, 80−15) + 20 = 65+20 = 85 |

**Formule effective retrouvée, mesurée point par point :**
```
effective% = clamp( min(90, max(0, cc − résistCrit_cible + réductions)) + d-cc , 0, 100 )
```

**C'est une vraie correction, pas une nuance** : le rapport de la session 1 écrivait
`p = min(90, max(0, CC_tot% − résistCrit%)) / 100` en traitant `cc` et `d-cc` comme une seule
somme plafonnée ensemble à 90 %. C'est faux. Le plafond de 90 % ne s'applique **qu'au champ
`cc` de base** (après soustraction de la résistance crit de la cible) ; le buff allié `d-cc`
s'ajoute **après** ce plafond et n'y est pas soumis — seul un plafond dur à 100 % (logique,
un taux ne dépasse pas 100 %) s'applique au total final. Concrètement : un perso à 85 % de
crit propre plus un soutien à +10 % de crit affiche 95 % de chance de critique effective, pas
90 %.

## 4. Multiplicateur critique sous 1

Cible : Red Demon (WL4), critDefense ≈ 42,93 % (mesurée en session 1). Config : atk = 100 000,
`ds`/`edi`/etc. = 0, tous les debuffs à 0. Je fais varier `cd` (dégâts critiques du héros) et je
lis directement `out-nc` / `out-crit` (pas la moyenne, pour isoler le multiplicateur).

| `cd` | `out-nc` | `out-crit` | Ratio crit/non-crit |
|---|---|---|---|
| 0 | 63 658 | **36 329** | **0,5708** — le critique fait *moins* de dégâts que le non-critique |
| 20 | 63 658 | 49 061 | 0,7707 |
| 43 | 63 658 | 63 702 | 1,0007 — bascule juste au-dessus de 1, cohérent avec critDefense ≈ 42,93 % |
| 60 | 63 658 | 74 524 | 1,1707 |

**Mesuré sans ambiguïté** : à `cd = 0` contre une cible à forte défense critique, le coup
critique (36 329) est franchement inférieur au coup non-critique (63 658). Ce n'est pas un
effet de bord ou un arrondi — l'écart est de 43 % et la transition au-dessus de 1 se produit
exactement là où la défense critique de la cible le prédit. **Le calculateur ne borne donc pas
le multiplicateur critique à 1 minimum.** Si ton moteur borne actuellement cet écart à zéro,
c'est ton moteur qui diverge de ce que fait TapScreen, pas l'inverse.

Point non retesté (déduit de la session 1 seulement, pas revérifié ici) : la formule postule
un plancher dur à 0 (`max(0, 1 + (CD−défCrit)/100)`) pour empêcher un multiplicateur négatif.
Aucune cible accessible dans la liste n'a une défense critique assez haute pour pousser ce
plancher en dehors de la zone [0,1] déjà démontrée ci-dessus ; je ne l'ai donc pas vérifié
directement.
