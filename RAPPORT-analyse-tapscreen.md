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

---

# Session 3 (2026-08-07) — le champ `ds` et cinq questions de vérification

Même périmètre que les sessions précédentes : boîte noire, `calculator.html` isolé, aucune
lecture de bundle, aucune extraction massive de leur base d'ennemis, aucune donnée privée.
Une mesure à la fois, séquentielle (pas de boucle async groupée cette fois, précisément pour
éviter l'incident de pollution de la session 2).

**Note de méthode sur cette session** : pour figer la DEF ennemie à des valeurs rondes
exactes (5600, 2800, 10000, 7000 — demandées telles quelles), j'ai écrit directement dans le
champ caché `edef` (auto-rempli d'ordinaire par la sélection d'ennemi, invisible dans l'UI —
aucun texte de la page n'affiche jamais la DEF exacte d'un ennemi à l'utilisateur). Je l'ai fait
avec la même méthode `.value` + `dispatchEvent('input'/'change')` utilisée depuis le début pour
tous les champs, visibles ou non — ce n'est pas un contournement de protection (aucune protection
n'existe sur ce champ), seulement le seul moyen d'obtenir des DEF rondes exactes pour isoler
algébriquement `ds`. Je le signale explicitement par transparence. **Piège découvert et évité** :
sur le Training Dummy, écrire dans `edef` produit un résultat incohérent avec la formule
(edef=5600 → sortie 94 697 au lieu des 50 000 attendus) — le Dummy a un cas spécial interne qui
ignore en partie ce champ. Vérifié ensuite sur un vrai boss (Red Demon WL4) : `edef=5600` donne
exactement 51 000, pile la prédiction. **Tous les tests ci-dessous utilisent donc un vrai
ennemi (Red Demon, World Level 4) avec `edef` écrasé**, jamais le Training Dummy.

Config commune à tous les tests de la section 1 et 2 (relevé complet, pour reproductibilité) :
`char-sel=Diane`, `build-sel=Axe`, compétence = Special Skill (*Quake Smash*, coef 100%/307%),
`enemy-sel=Red Demon (World Level 4)` (fournit `ecr=15`, `ecdr=42.93`, `eew=20`, `eflatres=15` —
tous inchangés), `atk=100000`, `rhp=0`, `ea=0`, `cd=0`, `cc=0`, `edi=0`, `eai=0`, `dmgpct=0`,
`skilldmg=0`, `cval=5600`, tous les `d-*` = 0. Seuls `edef` et `ds` varient (précisés à chaque
ligne). Référence : à `edef=0, ds=0` (mitigation=1, DEF nulle), `out-nc = 102 000` — c'est le
plafond « pré-armure » déjà mesuré en session 1.

## 1. PRIORITÉ ABSOLUE — où `ds` entre-t-il dans la formule ?

| Test | `edef` | `ds` | `out-nc` mesuré |
|---|---|---|---|
| A | 5600 | 0 | **51 000** |
| B | 5600 | 50 | **102 000** |
| C | 2800 | 0 | **68 000** |

**B est-il égal à C ? Non — très clairement non.** 102 000 contre 68 000, un écart de 50 %,
aucune ambiguïté d'arrondi possible.

**Quelle DEF donnerait le résultat B avec `ds=0` ?** Mitigation à `ds=0` s'écrit `C/(C+DEF)` ;
pour retomber sur 102 000 (= la sortie à mitigation exactement 1), il faut `DEF = 0`. Autrement
dit : `ds=50` avec une DEF de 5600 ne fait PAS « comme si la DEF était réduite de moitié
(2800) » — ça fait **comme si la DEF était nulle**, et un peu plus même (voir point 2 : à
`ds=100` sur la même DEF, la sortie dépasse encore le cas DEF=0).

**Second couple, pour écarter toute coïncidence arithmétique** :

| Test | `edef` | `ds` | `out-nc` mesuré | Prédiction additive `Mitig=C/(C+DEF)+ds/100` |
|---|---|---|---|---|
| D | 10000 | 30 | **67 215** | 5600/15600 + 0,30 = 0,658974 → 102000×0,658974 = 67 215,4 |
| E | 7000 | 0 | **45 333** | 5600/12600 = 0,444444 → 102000×0,444444 = 45 333,3 |

D ≠ E (67 215 contre 45 333) alors que l'hypothèse « `ds` multiplie la DEF par (1−ds) »
prédirait D = E puisque 10000×(1−0,30) = 7000 exactement. Les deux paires (A/B/C et D/E)
convergent vers la **même** formule, au dixième d'unité près (arrondi d'affichage), avec zéro
paramètre ajusté après coup.

**MESURÉ, sans ambiguïté : `ds` n'agit pas en multipliant la DEF par `(1 − ds/100)`. Il
s'ajoute directement au ratio de mitigation** : `Mitig = C/(C+DEF_eff) + ds/100`, exactement la
formule retenue en session 1. Le code déjà écrit qui implémente cette addition est donc
**confirmé**, pas seulement plausible — deux couples indépendants, prédits à l'avance, tombent
juste à chaque fois.

## 2. `ds` est-il borné ?

Config identique, `edef=5600` fixe (référence DEF=0 → 102 000 ; référence `ds=50` → 102 000
déjà vu ci-dessus).

| `ds` | `out-nc` mesuré | Comparaison à la sortie DEF=0 (102 000) |
|---|---|---|
| 100 | **153 000** | **Dépasse** de 50 000 (×1,5) — ne se contente pas d'égaler le cas DEF=0 |
| 150 | **204 000** | **Dépasse** encore, exactement ×2,0 par rapport à DEF=0 |

**Réponse aux deux sous-questions** :
- `ds=100` n'égale PAS les dégâts à DEF=0 : il les dépasse largement (153 000 contre 102 000).
  La mitigation à `ds=100, DEF=5600` vaut `5600/11200 + 1,0 = 1,5`, pas `1,0`.
- `ds=150` ne plafonne pas : 204 000 = 102 000 × 2,0 exactement (`Mitig = 0,5 + 1,5 = 2,0`),
  cohérent point pour point avec la continuation linéaire déjà observée en session 1
  (`ds` 0→200 sur Red Demon, strictement linéaire). **MESURÉ : aucun plafond, la progression
  reste linéaire au moins jusqu'à `ds=150`.**

## 3. La résistance au percement (« Shatter Resistance ») existe-t-elle chez eux ?

**Recherche de champ** : aucun identifiant de champ ne contient "shatter", "resist", "pen" ou
"protect" au sens d'une stat DISTINCTE de `ds` du côté ennemi, à une exception : un champ
existe bien sous le nom **« Enemy protection resist reduction % »** (`d-epr`, debuff) avec son
pendant côté ennemi **`epr`** (« protection resist » propre à l'ennemi, champ caché,
auto-rempli). C'est le candidat le plus proche conceptuellement d'une « résistance au
percement ».

**Est-il branché ?** Testé les deux, isolément, à `edef=5600, ds=0` (référence 51 000) :

| Champ modifié | Valeur | `out-nc` |
|---|---|---|
| (aucun) | — | 51 000 (référence) |
| `d-epr` (debuff joueur) | 50 | **51 000 — aucun effet** |
| `epr` (stat propre de l'ennemi, écrasée directement) | 50 | **51 000 — aucun effet** |

**MESURÉ : `epr`/`d-epr` (« protection resist ») sont des champs totalement inertes.** Ni la
stat de l'ennemi ni le debuff qui est censé la réduire n'ont le moindre effet sur la sortie —
confirmé dans les deux sens. La session 1 avait déjà repéré `d-epr` comme « champ mort » ;
cette session confirme que le champ ennemi correspondant (`epr`) l'est tout autant, avec des
valeurs différentes (50 au lieu de 0/50 en session 1) pour écarter une coïncidence.

**Leur base porte-t-elle Akumu ?** Recherche dans les 64 options de `enemy-sel` : **aucune
entrée « Akumu » ni « Demonic Beast » n'existe** dans leur liste d'ennemis. La question de la
valeur de protection resist d'Akumu chez eux est donc sans objet — ce boss n'est simplement pas
dans leur base.

**`ds` est-il décrit comme net d'une résistance ?** Recherche du mot « shatter » sur toute la
page : **2 occurrences seulement**, toutes deux le libellé du champ ou son rappel dans le mode
d'emploi (*« ...Elemental ATK, Crit DMG, Crit Chance, Elemental DMG, Defense Shatter and Skill
Damage % from your in-game stat screen »*). Aucun texte n'évoque une soustraction, une
résistance opposée, ou une notion de valeur « nette ». **Indéterminé — rien de tel n'est écrit
nulle part sur cette page.**

## 4. `ds` : stat du héros ou malus sur l'ennemi ?

Recherche de texte explicite tranchant la question : **aucune trouvée**. Ni dans le libellé de
`ds` (« Defense shatter % », sans commentaire), ni dans le mode d'emploi, ni dans une infobulle
(il n'y en a pas sur ce champ, confirmé en session 1).

**Fait structurel mesuré, qui ne tranche pas mais qui éclaire** : `ds` est positionné dans le
bloc *« Character & Skill »* du formulaire, au même niveau que `atk`, `ea`, `cd`, `cc`, `edi`,
`eai` — c'est-à-dire dans le groupe des stats personnelles à relever sur l'écran de stats du
héros (le mode d'emploi le confirme : *« Elemental ATK, Crit DMG, Crit Chance, Elemental DMG,
Defense Shatter and Skill Damage % from your in-game stat screen »* — `ds` est cité dans la
même phrase que les stats d'équipement du héros). Les debuffs de compétence qui réduisent la
défense de l'ennemi (« réduit sa défense de 20 % ») vivent dans un bloc séparé et plus loin dans
le formulaire, *« Applied debuffs — enemy reductions »*, sous le nom `d-edef` (« Enemy defense
reduction % ») — un champ différent de `ds`, déjà présent dans la formule DEF_eff
(`DEF × (1−d-edef/100)`, confirmé en session 1) et distinct du ratio de mitigation où vit `ds`.

**Réponse : indéterminé pour la question posée** (aucun texte ne dit explicitement si `ds`
couvre l'équipement du héros, les debuffs de compétence sur l'ennemi, ou la somme des deux) —
mais **mesuré** que TapScreen les traite comme deux mécanismes distincts dans son formulaire :
`ds` (bloc héros, entre dans `Mitig` en addition) et `d-edef` (bloc debuffs ennemi, entre dans
`DEF_eff` en facteur multiplicatif). Ce ne sont pas juste deux noms pour la même case.

## 5. La défense critique de l'ennemi est-elle abaissable ?

Oui, via `d-ecdr` (« Enemy crit defense reduction % »), déjà repéré en session 1. Cette session
tranche précisément l'ambiguïté points/multiplicateur avec des nombres ronds.

Config : `ecdr` (défense critique propre de l'ennemi, champ caché) écrasé à exactement **50**,
`cd=0` (dégâts critiques du héros à zéro pour isoler proprement le multiplicateur), le reste
inchangé (`edef=5600`, `ds=0` → référence non-crit 51 000).

| `d-ecdr` | `out-nc` | `out-crit` | Ratio crit/non-crit |
|---|---|---|---|
| 0 | 51 000 | 25 500 | 0,50 = `1 + (0−50)/100` |
| **50** | 51 000 | **51 000** | **1,00** |

Avec `d-ecdr=50` sur une défense critique ennemie de 50, le ratio devient exactement 1,00 —
c'est-à-dire que le malus de défense critique de la cible est intégralement annulé
(`max(0, 50−50) = 0`). Si le champ avait été un multiplicateur (« réduit de 50 % »), la défense
critique serait tombée à 25 et le ratio aurait dû être `1+(0−25)/100 = 0,75` (soit
`out-crit = 38 250`), pas 1,00.

**MESURÉ, sans ambiguïté : `d-ecdr` est en points de pourcentage, retranchés directement de la
défense critique de la cible** (`max(0, critDéf_cible − d-ecdr)`), **pas un multiplicateur**.
Une défense critique de 50 réduite de « 50 » tombe à 0, pas à 25 — exactement le cas que tu
posais en exemple.

## 6. Le protocole de calibration de C est-il documenté ?

Oui, texte intégral relevé dans le panneau *« Defense Penetration Constant (C) »* :

> *« C is a hidden character-specific value that determines how much of your damage gets
> through enemy armor. It cannot be read from any stat screen — it must be measured from a
> real hit. Once calibrated, save it for future use. C changes when you unlock new potentials.
> You can calibrate C using any skill — pick whichever is easiest to get a clean number from.
> The C value applies equally to all skills for that character and build. If a skill shows more
> than one damage number on screen: add all the numbers from a single hit together and enter
> the total. For example if you see 1,405 and 1,405 appear from one hit, enter 2,810. »*

Et dans le sous-panneau du solveur lui-même :

> *« C Calibration Helper — Uses the skill card you have selected above. Select your skill, fill
> in all stats, enter your non-crit damage below, and hit Solve. »*

**MESURÉ : oui, procédure documentée**, et elle correspond exactement à ce que tu décris
(« frappe un ennemi, relève les dégâts, entre-les ») — avec trois précisions utiles qui ne
figuraient pas dans ta description : (1) elle exige spécifiquement un coup **non-critique** ;
(2) sur un skill à coups multiples affichant plusieurs nombres, il faut les **additionner** avant
de les entrer ; (3) C doit être **recalibré à chaque déblocage de potentiel** — ce n'est pas une
valeur figée à vie pour un personnage donné, contrairement à ce que « propre au personnage et au
build » pourrait laisser penser isolément.

## Récapitulatif — ce qui change pour le code déjà écrit

| Sujet | Verdict de cette session |
|---|---|
| `Mitig = C/(C+DEF_eff) + ds/100` | **Confirmé** par deux couples indépendants, prédits à l'avance |
| Plafond sur `ds` | **Aucun trouvé** jusqu'à 150 %, progression strictement linéaire |
| Résistance au percement opposée à `ds` | **N'existe pas chez TapScreen** — champ `epr`/`d-epr` présent mais mesuré inerte des deux côtés. Ne pas en chercher l'équivalent pour caler `ds` : `ds` s'applique chez eux sans aucune résistance en face. |
| `ds` = stat héros ou debuff ennemi ? | Indéterminé dans leur documentation ; mesuré qu'ils le traitent structurellement à part de `d-edef` (bloc différent, rôle différent dans la formule) |
| `d-ecdr` points ou multiplicateur | **Points**, confirmé sans ambiguïté (50 sur 50 → 0, pas 25) |
| Protocole de calibration de C | Documenté texto ; recalibration nécessaire à chaque nouveau potentiel débloqué (fait à ne pas perdre) |

---

# Session 4 (2026-08-08) — le moteur est-il conscient des catégories de compétence ?

Même périmètre que les trois sessions précédentes : boîte noire, `calculator.html` ouvert
directement, mode **Advanced**, aucune lecture de bundle, aucune extraction de leur base
d'ennemis, aucun contournement. Une mesure à la fois, tout synchrone.

**Aucune mesure des sessions 1 à 3 n'a été refaite**, à deux exceptions volontaires et
signalées : les valeurs de référence `out-nc` = 63 658 (Special) et 236 170 (Ultimate)
retombent au chiffre près sur celles des sessions 1 et 2 — c'est le témoin qui prouve que
cette session travaille bien sur la même configuration, pas une reprise de mesure.

## Configuration commune (relevé intégral, tous les champs, y compris non touchés)

`char-sel=Diane` · `build-sel=Axe` · `pot-sel=0 — None` · `enemy-sel=Red Demon (World Level 4)`
· mode Normal Attack = **Full Combo** (par défaut)

| Bloc | Champs et valeurs |
|---|---|
| Stats perso | `atk=100000`, `ea=0`, `rhp=0`, `cd=0`, `cc=0`, `edi=0`, `eai=0`, `ds=0`, `dmgpct=0`, `skilldmg=0` |
| Calibration | `cval=5600` |
| Cible (auto-rempli, **jamais écrasé cette fois**) | `edef=3373`, `ecr=15`, `ecdr=42.93`, `eew=20`, `eflatres=15`, `epr=0` |
| Buffs alliés | `d-cc=0`, `d-cd=0`, `d-atk=0`, `d-nadmg=0`, `d-tagdmg=0`, `d-edi=0` |
| Debuffs ennemi | `d-ecr=0`, `d-ecdr=0`, `d-edef=0`, `d-epr=0`, `d-eew=0`, `d-elementres=0`, `d-def=0`, `d-hp=0` |

Contrairement à la session 3, `edef` n'a **pas** été écrasé : la DEF native du boss (3373) est
utilisée telle quelle, donc aucun risque de réveiller le cas spécial du Training Dummy.

Cartes de compétence lues sur chaque onglet, et ligne de base à `skilldmg=0` :

| Onglet | Compétence affichée | Coef | `out-nc` de base — MESURÉ |
|---|---|---|---|
| Normal Attack | *Earth Cleaver* | 109 % (3 coups 26/31/52) | **69 387** |
| Normal Skill | *Charged Slash* | 205 % | **130 498** |
| Special Skill | *Quake Smash* | 100 % / 307 % (le moteur utilise le 100 %) | **63 658** |
| Ultimate Move | *Rock Blast* | 371 % | **236 170** |
| Tag Skill | *Ground Down* | 143 % | **91 030** |

**Repère de lecture pour tous les tableaux qui suivent** : sur Red Demon WL4 la faiblesse
élémentaire vaut +20 %, donc un `+50` qui tombe dans le seau additif unique ne donne pas ×1,5
mais **×1,41667 = (1,2 + 0,5) / 1,2** — exactement la pente établie en session 1. Un facteur
mesuré à 1,41667 signifie donc « le champ entre dans le seau », et 1,00000 signifie « champ
mort ».

## Incident de méthode (à ne pas répéter)

En cours de session 1re passe, `atktab-tag.click()` a cessé d'être pris en compte (l'onglet
actif restait `atktab-ultimate`) **et** `out-nc` s'est figé sur 236 170 : les captures d'écran
échouaient sur *« Script injection timed out »* alors que le JavaScript répondait toujours.
Détecté parce que l'onglet Special renvoyait le chiffre de l'Ultimate — un résultat
arithmétiquement impossible. **Toutes les mesures de la question 1.c ont été refaites sur une
page rechargée à neuf**, et à partir de là chaque relevé vérifie dans le même appel synchrone
l'onglet actif, la carte de compétence affichée, et le retour à la ligne de base après reset.
Rien de ce qui figure ci-dessous ne provient de la fenêtre polluée.

---

## QUESTION 1 — le moteur est-il conscient des catégories ?

**Réponse courte : les deux à la fois, et c'est le point important.**
Un mécanisme d'aiguillage par catégorie **existe** dans leur moteur — `d-tagdmg` ne s'active
que sur l'onglet Tag, c'est prouvé. Mais `skilldmg`, le champ principal, **ne l'utilise pas** :
c'est un multiplicateur global appliqué aveuglément sur les cinq onglets. Ils ont donc le
dispositif, et ils ne s'en servent pas là où on l'attendrait.

### 1.a — `skilldmg = 50`, rien d'autre modifié, sur les cinq onglets

| Onglet | `skilldmg` | `out-nc` — MESURÉ | Facteur vs base | Verdict |
|---|---|---|---|---|
| Normal Attack | 0 | 69 387 | — | ligne de base |
| Normal Attack | 50 | **98 298** | **×1,41667** | s'applique |
| Normal Skill | 0 | 130 498 | — | ligne de base |
| Normal Skill | 50 | **184 872** | **×1,41667** | s'applique |
| Special Skill | 0 | 63 658 | — | ligne de base |
| Special Skill | 50 | **90 182** | **×1,41667** | s'applique |
| Ultimate Move | 0 | 236 170 | — | ligne de base |
| Ultimate Move | 50 | **334 574** | **×1,41667** | s'applique |
| Tag Skill | 0 | 91 030 | — | ligne de base |
| Tag Skill | 50 | **128 960** | **×1,41667** | s'applique |

Toutes les lignes : MESURÉ. Facteur identique aux cinq décimales sur les cinq onglets.

**Conclusion, à dire clairement : leur champ `skilldmg` est un simple multiplicateur global,
et le joueur est seul responsable de la cohérence.** Le moteur ne vérifie jamais que la valeur
tapée correspond à la compétence sélectionnée.

Deux faits d'interface qui confirment cette lecture, sans ambiguïté possible :

1. **Le libellé du champ est renommé à chaque changement d'onglet** — MESURÉ :
   « Normal attack damage increase % » / « Normal skill damage increase % » / « Special skill
   damage increase % » / « Ultimate move damage increase % » / « Tag skill damage increase % ».
   L'UI fait donc croire à cinq champs distincts là où il n'y en a qu'un.
2. **Le texte d'aide sous le champ dit la chose explicitement** — relevé texto :
   > *« From stat screen — use the value matching your skill type (Normal Attack / Normal Skill / Special / Ultimate) »*

   C'est une consigne adressée à l'utilisateur, pas une garantie du moteur : ils demandent au
   joueur de saisir la bonne valeur en face du bon onglet, précisément parce que rien côté
   calcul ne le vérifie.

### 1.b — `d-nadmg = 50` (« Bonus normal attack damage %, ally buff ») sur les cinq onglets

| Onglet | `d-nadmg` | `out-nc` — MESURÉ | Facteur | Verdict |
|---|---|---|---|---|
| Normal Attack | 0 | 69 387 | — | ligne de base |
| Normal Attack | **50** | **69 387** | **×1,00000** | **mort** |
| Normal Skill | 50 | 130 498 | ×1,00000 | mort |
| Special Skill | 50 | 63 658 | ×1,00000 | mort |
| Ultimate Move | 50 | 236 170 | ×1,00000 | mort |
| Tag Skill | 50 | 91 030 | ×1,00000 | mort |

Toutes les lignes : MESURÉ.

**Vérifié trois fois plutôt que deux, comme demandé**, parce qu'une découverte sur cet onglet
aurait été majeure :

| Contre-épreuve | Résultat — MESURÉ |
|---|---|
| `d-nadmg = 500` (au lieu de 50) sur Normal Attack | 69 387 — **identique**, y compris `out-crit` 39 599 et `out-avg` 69 387 |
| `d-nadmg = 50` sur Normal Attack en mode **1st Hit Only** | 16 551 — identique à la base 1st-hit |
| Reprise complète sur page rechargée à neuf | 69 387 — identique |
| **Témoin** : `d-atk = 50` sur ce même onglet Normal Attack | **104 080** = ×1,50000 exactement |

Le témoin est ce qui rend le verdict solide : dans cette configuration précise, sur cet onglet
précis, le bloc des buffs alliés **est bien lu** par le calcul. `d-nadmg` n'est donc pas
victime d'un panneau non chargé ou d'un artefact de session — le champ est bel et bien inerte.
**Aucune découverte à rapporter ici : la session 1 avait raison, et elle avait raison sur les
cinq onglets, pas seulement sur celui qu'elle avait testé.**

### 1.c — `d-tagdmg = 50` (jamais testé jusqu'ici) sur les cinq onglets

| Onglet | `d-tagdmg` | `out-nc` — MESURÉ | Facteur | Verdict |
|---|---|---|---|---|
| Normal Attack | 50 | 69 387 | ×1,00000 | inerte sur cet onglet |
| Normal Skill | 50 | 130 498 | ×1,00000 | inerte sur cet onglet |
| Special Skill | 50 | 63 658 | ×1,00000 | inerte sur cet onglet |
| Ultimate Move | 50 | 236 170 | ×1,00000 | inerte sur cet onglet |
| **Tag Skill** | **50** | **128 960** | **×1,41667** | **ACTIF** |

Toutes les lignes : MESURÉ.

**`d-tagdmg` est vivant, et uniquement sur l'onglet Tag Skill.** C'est la découverte de la
session, et elle a été confirmée **trois fois de façon indépendante** : une première fois dans
la fenêtre où la page s'est ensuite figée, une deuxième fois après rechargement complet de la
page, une troisième fois isolément avec relevé intégral des 31 champs du formulaire
(`out-nc` 128 960, `out-crit` 73 597, `out-avg` 128 960, tous les autres champs à 0 sauf
`atk=100000`, `cval=5600` et les stats natives du boss).

Dans quel seau tombe-t-il ? Le seau additif unique, comme tout le reste — MESURÉ :

| Onglet Tag | `skilldmg` | `d-tagdmg` | `out-nc` — MESURÉ |
|---|---|---|---|
| Tag Skill | 0 | 0 | 91 030 |
| Tag Skill | 0 | 100 | **166 889** |
| Tag Skill | 100 | 0 | **166 889** |
| Tag Skill | 50 | 50 | **166 889** |

Trois chemins différents, un seul et même chiffre : `d-tagdmg` et `skilldmg` sont
interchangeables au point près dans le seau `Bracket = 1 + faiblesse + (…)/100`. Prédiction
avant mesure : 91 030 × (1,2+1,0)/1,2 = 166 888,3 → affiché 166 889. Aucun paramètre ajusté
après coup.

### Contrôle supplémentaire non demandé mais utile : `d-edi` est-il lui aussi conditionnel ?

Puisque `d-tagdmg` s'est révélé conditionné par l'onglet, j'ai repassé `d-edi` (déclaré mort en
session 1) sur les cinq onglets, pour vérifier que ce verdict-là ne souffrait pas du même angle
mort.

| Onglet | `d-edi` | `out-nc` — MESURÉ | Facteur |
|---|---|---|---|
| Normal Attack | 50 | 69 387 | ×1,00000 |
| Normal Skill | 50 | 130 498 | ×1,00000 |
| Special Skill | 50 | 63 658 | ×1,00000 |
| Ultimate Move | 50 | 236 170 | ×1,00000 |
| Tag Skill | 50 | 91 030 | ×1,00000 |

**`d-edi` est mort sur les cinq onglets. La session 1 est confirmée**, cette fois sur toute la
surface.

### Ce que ça dit de leur architecture (DÉDUIT du tableau ci-dessus)

Leur moteur contient bien un test « la compétence sélectionnée est-elle de catégorie X ? » —
`d-tagdmg` en est la preuve directe, il ne peut pas s'activer sur un seul onglet par hasard.
Ce test est câblé pour la catégorie Tag et **pour elle seule** parmi les champs mesurés :
son symétrique évident `d-nadmg`, dont le nom annonce exactement le même comportement pour la
catégorie Normal Attack, ne se déclenche sur aucun onglet, pas même le sien. C'est un
demi-mécanisme : soit un branchement oublié, soit un chantier laissé en plan.

Et le champ le plus utilisé du formulaire, `skilldmg`, contourne complètement ce mécanisme :
il est renommé par catégorie à l'écran, mais appliqué globalement dans le calcul.

---

## QUESTION 2 — `skilldmg` se souvient-il de l'onglet ?

**Non. Une seule valeur globale, jamais remise à zéro, jamais mémorisée par catégorie.**

Protocole : saisie de 50 sur l'onglet Special, puis parcours des quatre autres onglets, puis
retour sur Special. Lecture de `skilldmg` **avant** toute réécriture à chaque étape.

| Étape | `skilldmg` lu — MESURÉ | Libellé du champ à cet instant — MESURÉ |
|---|---|---|
| Saisie de 50 sur Special Skill | **50** | « Special skill damage increase % » |
| → Ultimate Move | **50** | « Ultimate move damage increase % » |
| → Normal Attack | **50** | « Normal attack damage increase % » |
| → Tag Skill | **50** | « Tag skill damage increase % » |
| → Normal Skill | **50** | « Normal skill damage increase % » |
| → retour Special Skill | **50** | « Special skill damage increase % » |

La valeur traverse les cinq onglets sans jamais bouger. Mesure indépendante faite plus tôt dans
la session, sur un autre chemin (Normal Attack → Normal Skill), même résultat : 50 conservé.

**Le piège concret pour l'utilisateur, MESURÉ** : il tape son « +50 % Ultimate » depuis son
écran de stats sur l'onglet Ultimate, passe sur l'onglet Special pour comparer — et son +50 %
d'Ultimate s'applique intégralement au Special, sous un libellé qui affiche désormais
« Special skill damage increase % ». Rien ne l'avertit. C'est exactement le scénario que leur
texte d'aide essaie de prévenir à la main.

---

## QUESTION 3 — cumul et bornes de `skilldmg`

Onglet fixe : **Special Skill** (*Quake Smash*), configuration commune inchangée, seul
`skilldmg` varie. Ligne de base 63 658.

| `skilldmg` | `out-nc` — MESURÉ | Facteur vs base | Prédiction du seau additif `(1,2 + s/100)/1,2` |
|---|---|---|---|
| 0 | **63 658** | 1,00000 | 63 658 |
| 25 | **76 920** | 1,20833 | 76 920 |
| 50 | **90 182** | 1,41667 | 90 182 |
| 100 | **116 706** | 1,83333 | 116 706 |
| 200 | **169 754** | 2,66667 | 169 755 |
| 500 | **328 898** | 5,16667 | 328 898 |
| 2000 | **1 124 618** | 17,66667 | 1 124 618 |
| −50 | **37 134** | 0,58333 | 37 134 |

Toutes les lignes : MESURÉ. La colonne « prédiction » est calculée à partir du seau établi en
session 1, sans aucun ajustement — l'écart maximal sur les huit points est de **1 unité
d'affichage** (arrondi).

**Plafond : aucun.** La progression reste strictement linéaire jusqu'à 2000 (soit ×17,67), et
`2000` est accepté sans le moindre avertissement. Le champ a `min="0"`, `step="0.01"` et
**pas d'attribut `max`**.

**Valeurs négatives : acceptées, et elles retranchent réellement.** La validation HTML5 native
les signale (`checkValidity()` = `false`, message *« La valeur doit être supérieure ou égale à
0 »*) mais **ne bloque pas `calculate()`**. Poussé plus loin :

| `skilldmg` | `out-nc` — MESURÉ | `out-crit` | `out-avg` |
|---|---|---|---|
| −100 | **10 610** | 6 055 | 10 610 |
| **−120** | **0** | 0 | 0 |
| −150 | **−15 914** | −9 082 | −15 914 |
| −200 | **−42 438** | −24 220 | −42 438 |

**Il n'y a aucun plancher.** Le seau s'annule exactement à `skilldmg = −120`, c'est-à-dire à
`−100 × (1 + faiblesse)` = −120 sur cette cible, puis passe en négatif et le calculateur
**affiche des dégâts négatifs**, sans erreur ni message. Leur formule n'écrit donc pas de
`max(0, …)` autour du seau offensif.

**Contradiction assumée avec le comportement de `ds`** : la session 2 avait mesuré `ds = -50`
comme **clampé à 0** (sortie identique à `ds = 0`). Ce n'est pas le cas de `skilldmg`, qui
descend sans filet jusqu'aux valeurs négatives. Les deux champs sont donc traités
différemment vis-à-vis du signe — ce n'est pas une politique générale de l'outil, c'est un
clamp posé sur un champ et pas sur l'autre.

---

## QUESTION 4 — le variant multi-coups (Full Combo / 1st Hit Only)

Onglet Normal Attack, *Earth Cleaver* : 109 % au total, 3 coups de 26 % / 31 % / 52 %.

| Mode | `skilldmg` | `out-nc` — MESURÉ |
|---|---|---|
| **Full Combo** | 0 | **69 387** |
| **Full Combo** | 50 | **98 298** |
| **1st Hit Only** | 0 | **16 551** |
| **1st Hit Only** | 50 | **23 447** |

Toutes les lignes : MESURÉ.

| Rapport | Valeur | Lecture |
|---|---|---|
| 98 298 / 69 387 | **1,41667** | facteur de `skilldmg` en Full Combo |
| 23 447 / 16 551 | **1,41665** | facteur de `skilldmg` en 1st Hit Only |
| 16 551 / 69 387 | **0,23853** | = 26 / 109 exactement (0,238532) |

**Réponse : le facteur relatif est rigoureusement le même sur les deux réglages** (l'écart de
0,000 02 est l'arrondi d'affichage sur un nombre 4 fois plus petit). Le bouton « 1st Hit Only »
ne fait que substituer le coefficient de compétence — 26 % au lieu de 109 % — dans une formule
par ailleurs inchangée ; `skilldmg` agit ensuite en aval, sur le résultat, exactement de la
même façon. Il n'y a **aucune interaction** entre le variant multi-coups et le bonus.

Contrôle joint, déjà cité en 1.b : `d-nadmg = 50` en mode 1st Hit Only donne 16 551, soit la
ligne de base — le champ ne se réveille pas davantage sur le premier coup seul.

---

## Récapitulatif de la session 4

| Question | Réponse | Statut |
|---|---|---|
| `skilldmg` est-il aiguillé par catégorie ? | **Non** — multiplicateur global sur les cinq onglets, ×1,41667 partout. Le libellé change, le calcul non. Le joueur est seul garant de la cohérence. | MESURÉ |
| `d-nadmg` s'anime-t-il sur Normal Attack ? | **Non**, sur aucun des cinq onglets, ni à 50 ni à 500 ni en 1st-hit. Témoin `d-atk` actif sur le même onglet. La session 1 est confirmée et élargie. | MESURÉ |
| `d-tagdmg` (jamais testé) | **VIVANT, et uniquement sur l'onglet Tag Skill** — ×1,41667. Confirmé 3 fois, dont une sur page rechargée à neuf. Tombe dans le même seau additif que `skilldmg` (100 seul = 100 seul = 50+50 = 166 889). | MESURÉ |
| Leur moteur connaît-il les catégories ? | **Oui, le mécanisme existe** (prouvé par `d-tagdmg`) **mais `skilldmg` ne l'utilise pas** et `d-nadmg`, son symétrique évident, ne se déclenche jamais. Demi-mécanisme. | MESURÉ pour les faits, DÉDUIT pour l'intention |
| `d-edi` réexaminé sur les 5 onglets | Mort partout. Session 1 confirmée. | MESURÉ |
| `skilldmg` mémorisé par onglet ? | **Non** — valeur unique et globale, conservée à l'identique sur les cinq onglets et au retour. Seul le libellé est renommé. | MESURÉ |
| Plafond de `skilldmg` | **Aucun** jusqu'à 2000 (×17,67), linéarité parfaite, pas d'attribut `max`. | MESURÉ |
| `skilldmg` négatif | **Accepté et appliqué.** Pas de plancher : seau nul à −120, dégâts **négatifs** affichés en dessous. Contredit le clamp observé sur `ds` en session 2 — les deux champs ne suivent pas la même règle. | MESURÉ |
| Full Combo vs 1st Hit Only | **Facteur identique** (1,41667 vs 1,41665). Le variant ne change que le coefficient (26 % au lieu de 109 %) ; `skilldmg` agit en aval sans interaction. | MESURÉ |

**Rien n'est resté indéterminé dans cette session.** Les quatre questions ont toutes reçu une
réponse mesurée.
