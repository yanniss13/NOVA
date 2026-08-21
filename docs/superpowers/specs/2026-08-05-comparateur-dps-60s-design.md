# Comparateur de dégâts — DPS des compétences sur 60 secondes

**Date :** 2026-08-05  
**État :** implémenté et vérifié par `npm test` le 2026-08-05

## Objectif

Compléter le score « Puissance par arme » par une mesure temporelle qui permette
de comparer les trois builds d'un même personnage. La nouvelle mesure doit
notamment rendre visible la force des armes fondées sur les réductions de temps
de recharge, comme la baguette foudre de Merlin.

Deux résultats coexistent :

- **Dégâts d'un cycle** : le score actuel, chaque compétence chiffrée une fois ;
- **DPS des compétences sur 60 s — théorique** : les dégâts des compétences
  simulées pendant une fenêtre fixe, divisés par 60.

Le premier reste utile pour comparer le burst. Le second compare le rendement
temporel. Aucun des deux ne doit être présenté comme le DPS réel complet tant
que les attaques de base et les verrouillages d'animation ne sont pas mesurés.

## Périmètre validé

La comparaison porte uniquement sur les builds enregistrés **du même
personnage**. Les niveaux réellement configurés restent la source de vérité :

- niveau et potentiel actuels du héros ;
- arme, grade, niveau, promotion, outrepassement et enchantements actuels ;
- niveaux actuels des passifs d'arme et d'équipement ;
- armures, bijoux et ensembles réellement équipés.

En revanche, les conditions des passifs personnels couverts sont idéalisées :

- le passif est considéré activé dès le début de la fenêtre ;
- ses conditions restent satisfaites ;
- ses cumuls sont au maximum permis par le niveau réellement atteint ;
- les déclenchements venant d'une attaque combinée ou d'un allié sont supposés
  acquis, mais leurs propres dégâts ne sont pas ajoutés.

Les passifs des coéquipiers restent hors périmètre. Ils feront l'objet d'un lot
ultérieur consacré à la composition d'équipe.

## Hypothèses de la fenêtre de 60 secondes

La simulation suit l'intervalle `[0 s, 60 s[` : une action lancée exactement à
60 secondes ne compte pas.

- Les compétences normale, spéciale et ultime du type d'arme actif sont
  éligibles.
- L'ultime est utilisé quand l'optimiseur le juge rentable et disponible.
- La magie et l'endurance sont disponibles sans limite dans ce premier modèle.
- Les dégâts des compétences de relève et des attaques combinées sont exclus.
- Leurs buffs personnels peuvent néanmoins être considérés actifs au maximum,
  conformément au périmètre validé.
- Les attaques normales occupent verbalement les temps morts de la rotation,
  mais leurs dégâts ne sont pas chiffrés faute de cadence d'animation.
- Une action simulée ne consomme provisoirement aucun temps d'animation. Les
  actions disponibles au même instant sont donc ordonnées selon leurs effets.
- Un dégât périodique n'ajoute que les déclenchements survenus avant 60 s. Sa
  durée totale ne doit pas être créditée si la zone est lancée en fin de fenêtre.
- La cible reste la cible de référence actuelle, Banakro, avec les mêmes
  hypothèses de résistance et de faiblesse neutres.
- Le critique reste calculé en espérance pour conserver un résultat
  déterministe.

Les dégâts indexés sur la DEF ou les PV utilisent provisoirement les valeurs
finales déjà calculées par la fiche du build. Les dégâts fondés sur les PV
restants partent de 100 % des PV max. Cette base restera annoncée comme présumée
jusqu'aux relevés en jeu.

## Effets exclus par décision

Les cinq compétences maintenues sans durée ou nombre de déclenchements borné
restent hors calcul. Elles sont inventoriées avec leur protocole de mesure dans
`docs/competences-maintenues-a-tester.md`.

Un effet non borné ne reçoit jamais une durée inventée. Un effet encore
impossible à traduire est conservé dans le catalogue avec un état explicite et
remonte sous la formule exacte **« Non inclus dans le calcul »**.

## Données et couverture des passifs

### Compétences

`scripts/generate-competences.py` enrichit le catalogue figé avec les temps de
recharge et les champs structurés nécessaires à la simulation. Les tests et le
mode `--check` restent entièrement hors réseau.

Les actions sans temps de recharge exploitable ne sont pas transformées en
zéro. Elles restent connues mais non planifiables par le moteur temporel.

### Catalogue d'effets DPS

Un catalogue généré et commité normalise les effets personnels provenant de :

- la compétence passive du héros pour le type d'arme actif ;
- les paliers de potentiel réellement débloqués pour ce type d'arme ;
- le passif de l'arme équipée à son niveau réel ;
- les passifs d'armure, de gravure et de bijou à leur niveau réel ;
- les paliers d'ensemble réellement actifs.

Le navigateur ne doit jamais interpréter les descriptions en prose. Le
générateur privilégie les champs structurés de la source. Une règle particulière
nécessaire pour une tournure non structurée est attachée au `gameId` stable dans
le générateur, avec sa provenance et un test dédié.

Chaque source recensée reçoit exactement l'une de ces classifications :

- `modelise` : elle produit une ou plusieurs règles numériques ;
- `sans-impact-dps` : soin, défense sans conversion offensive ou effet sans
  conséquence sur les dégâts simulés ;
- `non-inclus` : information insuffisante ou décision d'exclusion documentée.

Ainsi, « tout considérer » signifie qu'aucun passif personnel n'est oublié en
silence. Un passif sans impact ne change pas le nombre ; un passif inexploitable
est annoncé au lieu d'être assimilé à zéro.

Les règles normalisées couvrent au minimum :

- bonus de dégâts globaux, élémentaires ou par catégorie de compétence ;
- ATK, DEF et PV employés par les formules de dégâts ;
- taux et dégâts critiques ;
- cumuls, plafonds et durées ;
- réduction de recharge plate ou proportionnelle ;
- remise à zéro partielle d'une recharge ;
- déblocage et remplacement temporaire d'une compétence ;
- dégâts additionnels bornés et déclenchements internes.

## Simulateur événementiel

Un nouveau module métier pur déroule la fenêtre. Il ne dépend ni du DOM ni du
réseau et reçoit toutes ses données par arguments.

Entrée conceptuelle :

```js
simulerDpsCompetences({
  stats,
  competences,
  effets,
  cible,
  duree: 60
})
```

État suivi :

- horloge et recharges disponibles ;
- buffs, cumuls et échéances ;
- compétences normales ou transformées actuellement disponibles ;
- déclenchements périodiques déjà programmés ;
- total et trace des dégâts ;
- hypothèses et effets non inclus.

Les instants de décision sont uniquement les événements utiles : disponibilité
d'une action, déclenchement périodique, expiration d'un effet ou fin d'une
fenêtre de transformation. Le moteur ne balaie pas arbitrairement chaque
milliseconde.

Quand plusieurs actions ou un court délai peuvent changer le résultat, il teste
les ordres pertinents, mémorise les états équivalents et conserve le meilleur
total à 60 secondes. Un ordre stable départage les égalités afin que la même
fiche produise toujours la même rotation.

Le résultat canonique contient :

```js
{
  total,
  dps,
  rotation,
  ouverture,
  priorites,
  nonInclus,
  hypotheses,
  couverture
}
```

Le libellé reste **« rotation optimale selon les données connues »**. Il ne
promet pas un optimum physique tant que le temps d'action est nul et que les
attaques normales ne sont pas chiffrées.

## Cas Merlin foudre à verrouiller

La régression centrale couvre l'interaction qui a motivé ce lot :

- « Jugement foudroyant » possède une recharge longue et une version
  « Jugement divin » ;
- « Champ électromagnétique » frappe périodiquement, réduit la recharge de la
  compétence normale et augmente ses dégâts avec un plafond ;
- les paliers réellement débloqués peuvent encore réduire la recharge ou
  ouvrir directement la compétence transformée ;
- le passif personnel et l'équipement ne s'appliquent qu'à leur niveau réel,
  mais leurs conditions validées sont maximisées.

Le test ne doit pas simplement figer un classement final : il doit prouver que
retirer l'effet de réduction de recharge diminue le nombre d'utilisations de la
compétence normale et change le total correspondant.

## Affichage dans la fiche de héros

Le bloc actuel devient une comparaison à deux mesures. Pour chaque arme :

```text
Baguette
Cycle                         140 707
DPS des compétences sur 60 s    8 432/s
```

Le classement principal du nouveau résultat suit le DPS théorique. Le score de
cycle reste visible afin de ne pas confondre dégâts immédiats et rendement
temporel.

Un détail dépliable présente :

1. **Ouverture** — les premières actions dans l'ordre ;
2. **Priorité** — la règle courte permettant au membre de reproduire la
   rotation ;
3. **Chronologie** — secondes, actions, transformations et principaux buffs ;
4. **Hypothèses** — ressources illimitées, passifs maximisés, animations non
   mesurées, attaques normales non chiffrées ;
5. **Non inclus dans le calcul** — effets et compétences exclus pour ce build.

Le bloc conserve les règles actuelles : il n'apparaît qu'avec au moins deux
builds comparables et n'affiche jamais un zéro à la place d'une donnée inconnue.

## Mesure future des animations

Les bases publiques annoncent extraire leurs données des fichiers du jeu, mais
elles n'exposent pas actuellement une durée d'action directement réutilisable.
Les fichiers client peuvent contenir des séquences ou montages d'animation avec
une longueur et une vitesse de lecture. Cette longueur visuelle n'est toutefois
pas nécessairement le verrouillage de combat : sections, branchements,
annulations, vitesse de lecture et logique de gameplay peuvent autoriser la
prochaine action avant ou après sa fin.

Ordre de recherche retenu :

1. vérifier les données publiques et les champs déjà exposés par les payloads ;
2. employer une durée issue d'un fichier seulement si sa signification est
   démontrée et sa provenance conservée ;
3. valider le verrouillage réel sur des vidéos originales à 60 FPS ou plus ;
4. conserver médiane, dispersion et incertitude ;
5. ne remplacer l'hypothèse `durée: 0` qu'après cette validation.

Une vidéo doit montrer l'interface et une tentative immédiate d'action suivante,
répétée trois à cinq fois. L'analyse compte les images entre l'activation et la
première action suivante acceptée. Les exécutions normales et annulées sont
mesurées séparément.

## Architecture du dépôt

Le simulateur constitue un nouveau module métier. Il doit respecter les quatre
enregistrements obligatoires :

1. `tests/helpers/modules.js` ;
2. `sw.js` dans `CORE_ASSETS` ;
3. import par `js/vues/fiche-heros.js` ;
4. liste `hooks` de `tests/helpers/load-app.js`.

Le catalogue généré est chargé par `index.html`, précaché et disponible hors
ligne. Les JSON de référence et les pages tierces ne sont jamais chargés par la
PWA.

## Stratégie de tests

La méthode reste test rouge avant correctif.

### Génération hors réseau

- extraction d'une recharge décimale ;
- distinction entre recharge de compétence et recharge interne d'un passif ;
- classification obligatoire de chaque passif recensé ;
- maintien explicite des entrées non incluses ;
- `--check` sans aucune requête réseau.

### Moteur pur

- bornes `[0, 60[` et nombre exact d'utilisations ;
- troncature des dégâts périodiques en fin de fenêtre ;
- bonus actif avant la frappe qu'il améliore ;
- cumuls plafonnés au niveau réel ;
- réductions plates et proportionnelles de recharge ;
- compétence transformée disponible uniquement dans sa fenêtre ;
- ressources illimitées et ultime disponible ;
- dégâts de relève et d'attaque combinée absents ;
- dégâts DEF/PV utilisant la base présumée documentée ;
- cas de régression Merlin foudre ;
- rotation et résultat déterministes.

### Vue

- cycle et DPS tous deux affichés ;
- classement selon le DPS ;
- ouverture, priorités et chronologie accessibles ;
- hypothèses visibles ;
- formule « Non inclus dans le calcul » conservée ;
- absence de faux zéro pour une arme non couverte.

La validation finale exécute `npm test` en entier. Les deux scénarios Playwright
connus comme instables sont relancés isolément avant toute conclusion de
régression.

## Hors périmètre

- dégâts des attaques normales tant que leur cadence n'est pas mesurée ;
- verrouillages, annulations et temps de déplacement ;
- génération réelle de magie, endurance, relève ou ultime ;
- dégâts apportés par les coéquipiers, relève et attaques combinées ;
- choix d'une autre cible ou d'un autre boss ;
- rotation d'une équipe complète ;
- aspiration réseau pendant les tests ou au rendu.
