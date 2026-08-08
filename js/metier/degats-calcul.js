/* Les degats attendus d'une competence, selon la formule publiee par
   7dsorigin.app/en/damage-formula et validee empiriquement par ses auteurs :

     Degats = ATK x Coef x Bonus-type x Critique x K/(K+DEF)
              x (1 - Resistance) x (1 + Faiblesse)

   Module PUR : ni DOM ni reseau, toutes les entrees arrivent par argument.

   Le critique est pris en ESPERANCE (1 + taux x degats) et non tire au sort :
   un comparateur doit etre deterministe, sinon deux consultations de la meme
   fiche donneraient deux classements.

   Les pourcentages arrivent en dix-milliemes, unite deja en vigueur dans le
   depot (voir js/vues/stats-affichage.js) : valeur / 10000 donne le rapport,
   valeur / 100 le pourcentage affiche. */

  /* Milieu de l'intervalle 5500-5700 publie. Elle ne sert que TANT QU'UN
     MEMBRE N'A PAS CALIBRE la sienne : C est propre au personnage, a son
     build et a ses potentiels debloques. Elle ne se lit sur aucun ecran du
     jeu et ne se deduit d'aucune table - elle se mesure sur un coup reel,
     d'ou calibrerConstante() plus bas.

     L'incertitude qui en resulte se simplifie dans un RAPPORT entre deux
     builds : c'est pourquoi la page reste honnete comme comparateur meme
     sans calibration, et ne devient predictive qu'avec. */
  const CONSTANTE_PAR_DEFAUT = 5600;

  function constanteDe(stats){
    const valeur = Number(stats && stats.constanteC);
    return Number.isFinite(valeur) && valeur > 0 ? valeur : CONSTANTE_PAR_DEFAUT;
  }

  /* Valeurs REELLES relevees sur le boss de confrerie, page
     7dsorigin.app/fr/boss-de-confrerie/akumu-bete-demoniaque. Jamais inventees.

     Les VINGT niveaux sont desormais publies et releves un par un : le detail
     et la methode vivent dans docs/akumu-20-niveaux.md. Les niveaux 1 et 20
     ont ete verifies a la main sur la page source ; entre les deux, DEF, HP et
     les deux statistiques critiques croissent strictement, ce qu'un test
     controle. Le palier 10 -> 11 fait un saut irregulier sur DEF et HP : c'est
     leur donnee, relue deux fois, pas une coquille de transcription.

     `nom` duplique volontairement BOSS_NAME de js/donnees/boss-store.js : un
     module metier pur n'importe pas depuis js/donnees/. */

  /* niveau, DEF, resistance crit., defense crit., HP — taux en dix-milliemes */
  const AKUMU_PALIERS = [
    [1,   3454,  2000,  5000,  2090121],
    [2,   4161,  2200,  5400,  2923402],
    [3,   5045,  2420,  5832,  3974208],
    [4,   6009,  2662,  6299,  5180389],
    [5,   7054,  2928,  6803,  6541945],
    [6,   8316,  3221,  7347,  8198714],
    [7,   9819,  3543,  7935, 10197308],
    [8,  11436,  3897,  8570, 12413428],
    [9,  13165,  4287,  9256, 14847073],
    [10, 14453,  4716,  9996, 17700232],
    [11, 17891,  5188, 10796, 24022303],
    [12, 19521,  5707, 11660, 28721553],
    [13, 21333,  6278, 12593, 34135530],
    [14, 23326,  6906, 13600, 40334151],
    [15, 25500,  7597, 14688, 47387335],
    [16, 27674,  8357, 15863, 54999870],
    [17, 30029,  9193, 17132, 63560194],
    [18, 32747, 10112, 18503, 73549970],
    [19, 35464, 11123, 19983, 84238935],
    [20, 38544, 12235, 21582, 96543801]
  ];

  /* EN SUSPENS, et volontairement laisse en l'etat.

     La source publie DEUX nombres elementaires, et on ne sait pas encore
     lequel joue quel role : huit resistances par element a 30 %, et une
     « resistance elementaire de base » a 50 % dont l'infobulle dit
     « reduction de degats plate appliquee a tous les elements, EN PLUS des
     faiblesses ».

     Chez l'outil de reference, le facteur multiplicatif vient du champ
     `eflatres` — flat resistance — et les valeurs par element tombent dans le
     seau additif. Si la correspondance des deux vocabulaires se confirme, ces
     deux lignes deviennent resistanceElementaire 5000 et faiblesse -3000, et
     tous les chiffres contre Akumu baissent d'environ moitie.

     Le test qui trancherait tient en une lecture : la fiche du Demon rouge sur
     7dsorigin, au niveau de monde ou DEF = 3373, doit afficher une resistance
     elementaire de base de 15 % pour correspondre au `eflatres = 15` mesure.
     Tant que personne ne l'a lue, on ne change rien : se tromper ici fausserait
     les vingt paliers d'un facteur deux. */
  const AKUMU_ELEMENTAIRE = {
    resistanceElementaire:3000,
    faiblesse:0,
    /* NON PUBLIEE, et sans equivalent actif dans l'outil de reference, dont
       les champs de resistance au percement sont mesures inertes. La source
       publie pourtant une « resistance au percement » de 20 %, constante sur
       les vingt paliers : la passer a 2000 rapprocherait du jeu et eloignerait
       de la reference, et la facon dont le jeu la retranche n'est pas mesuree.
       Zero reproduit le calcul de la reference ; ce n'est pas un releve. */
    resistancePercement:0
  };

  const CIBLES = AKUMU_PALIERS.map(([niveau, def, critResist, critDmgResist, hp]) =>
    Object.assign({
      id:"akumu-" + niveau,
      nom:"Akumu, bête démoniaque",
      niveau,
      def,
      critResist,
      critDmgResist,
      hp
    }, AKUMU_ELEMENTAIRE)
  ).concat([{
    /* Le mannequin d'entrainement. Tous ses facteurs valent 1, donc les degats
       affiches SONT le coefficient de la competence multiplie par l'ATK : c'est
       la seule cible qui rend ce coefficient lisible de l'exterieur.

       C'est aussi la seule que l'outil de reference possede AUSSI, donc la
       seule ou les deux calculateurs se comparent sans forcer les statistiques
       de l'un dans l'autre — et la seule que les deux inconnues elementaires
       ci-dessus ne peuvent pas contaminer, puisqu'il n'a aucune resistance. */
    id:"mannequin",
    nom:"Mannequin d'entraînement",
    niveau:null,
    def:0,
    critResist:0,
    critDmgResist:0,
    hp:null,
    resistanceElementaire:0,
    faiblesse:0,
    resistancePercement:0
  }]);

  /* Le palier 1, garde sous son ancien nom : il etait la cible unique avant
     que les vingt niveaux ne soient releves, et rien de ce qui etait affiche
     ne doit bouger du seul fait d'avoir ajoute les autres. */
  const CIBLE_REFERENCE = (() => {
    const { id, niveau, hp, ...reste } = CIBLES[0];
    return reste;
  })();

  const RAPPORT = 10000;

  /* Le taux critique n'est pas un simple total. La regle, relevee sur l'outil
     de reference et consignee dans RAPPORT-analyse-tapscreen.md :

       taux = min(100, min(90, max(0, critRate - critResist)) + critRateAllie)

     Le plafond de 90 % ne mord que sur le critique PROPRE du heros, une fois
     retranchee la resistance de la cible. Les buffs allies s'ajoutent APRES ce
     plafond et n'y sont pas soumis ; seule la borne a 100 % les arrete.

     Confondre les deux seaux ne serait pas un detail : nos soutiens cumulent
     +70 % de taux critique, donc un seau unique ferait deborder `taux` au-dela
     de 1 et l'esperance passerait AU-DESSUS du coup critique plein. */
  const PLAFOND_PROPRE = 9000;
  const PLAFOND_TOTAL = 10000;

  function nombreFini(valeur){
    return typeof valeur === "number" && Number.isFinite(valeur);
  }

  function baseDeComposante(stats, base){
    if(base === "atk"){
      return (Number(stats.atk) || 0)
        + (Number(stats.attaqueElementaire) || 0);
    }
    if(base === "def") return Number(stats.def) || 0;
    if(base === "maxHp") return Number(stats.maxHp) || 0;
    if(base === "remainingHp"){
      return Number.isFinite(stats.remainingHp)
        ? stats.remainingHp
        : (Number(stats.maxHp) || 0);
    }
    return null;
  }

  function baseDeDegats(stats, competence){
    const composantes = Array.isArray(competence.composantes)
      && competence.composantes.length
      ? competence.composantes
      : [{ base:"atk", pourcentage:competence.pourcentage }];
    return composantes.reduce((total, composante) => {
      const base = baseDeComposante(stats, composante.base);
      return base === null || !nombreFini(composante.pourcentage)
        ? NaN
        : total + base * composante.pourcentage / 100;
    }, 0);
  }

  /* Tout ce qui ne depend NI du critique NI de la constante C.

     Les deux fonctions publiques s'en servent : la directe pour calculer, son
     inverse pour calibrer. Ce partage n'est pas de l'economie de lignes -
     c'est ce qui garantit qu'elles ne divergent pas. Une inversion rangee a
     l'ecart derive de son modele sans que rien ne le signale, et le seul
     symptome serait une constante fausse chez un membre. */
  function facteursHorsConstante(stats, cible){
    const bonusPublie = ["bonusCategorie", "bonusElementaire", "bonusGlobal"]
      .some(cle => nombreFini(stats[cle]));
    const bonusOffensif = 1 + (bonusPublie
      ? (Number(stats.bonusCategorie) || 0)
        + (Number(stats.bonusElementaire) || 0)
        + (Number(stats.bonusGlobal) || 0)
      : (Number(stats.bonusType) || 0)) / RAPPORT;

    /* Le percement de defense (`D_Protect_Cur_Rate`, « Defense Shatter »)
       s'AJOUTE au rapport de mitigation. Il ne divise PAS la defense :

         mitigation = C/(C+DEF) + percement

       Ce n'est pas une deduction. Cinq mesures predites a l'avance tombent
       juste (RAPPORT-analyse-tapscreen.md, session 3) : a DEF 5600, percer
       de 50 % rend exactement le chiffre d'une defense NULLE, quand diviser
       la defense par deux en rendrait un tout autre. La premiere version de
       ce module retenait la division, et se trompait de 50 %.

       Consequence assumee : la mitigation peut depasser 1, et les degats
       depasser alors la valeur pre-armure. C'est ce que fait l'outil de
       reference, mesure sans aucun plafond jusqu'a 150 % de percement. Ce
       terme est une linearisation, pas une mecanique physique - ne pas le
       borner « par bon sens » sans mesure a l'appui.

       A ne pas confondre avec la « Perforation » (`A_Accuracy`), qui ne perce
       AUCUNE defense : elle s'oppose a la « Perseverance » de l'ennemi
       (`A_Block`, et son taux `A_Block_Rate`). Les trois partagent le prefixe
       `A_` et sont plates la ou le percement est un taux : c'est un
       affrontement toucher / bloquer, une couche entiere que la formule
       publiee ne modelise pas. Elle reste donc non branchee, et le restera
       tant que cette couche n'aura pas sa propre formule - la brancher ici
       reviendrait a la faire passer pour de la penetration d'armure.

       Le jeu porte une resistance au percement (`D_Protect_CurRes_Rate`) que
       l'outil de reference ne modelise PAS : ses champs `epr` et `d-epr` ont
       ete mesures inertes des deux cotes. Zero reproduit donc exactement son
       calcul, et le terme reste ici pour le jour ou la valeur d'un boss sera
       publiee. Seul le plancher a zero est conserve : sur-resister ne doit
       pas RENFORCER la defense. */
    const percementNet = Math.max(
      0, (Number(stats.percementDefense) || 0)
        - (Number(cible.resistancePercement) || 0)
    );

    /* La reduction de defense infligee a l'ennemi par une competence
       MULTIPLIE sa defense, la ou le percement s'ajoute au rapport. Deux
       formes distinctes pour deux mecaniques distinctes, et cette difference
       est mesuree, pas supposee : chez la reference, `d-edef` multiplie
       tandis que `ds` s'ajoute.

       Le plafond a 100 % est un GARDE-FOU, pas un releve : personne n'a
       verifie ce que fait la reference au-dela, et une defense negative
       n'aurait aucune lecture. Nos malus culminent a 50 % cumules. */
    const reductionDef = Math.min(RAPPORT, Math.max(
      0, Number(stats.reductionDefense) || 0
    ));

    return {
      bonusOffensif,
      percementNet,
      defEffective:(Number(cible.def) || 0) * (1 - reductionDef / RAPPORT),
      resistance:1 - (Number(cible.resistanceElementaire) || 0) / RAPPORT,
      faiblesse:1 + (Number(cible.faiblesse) || 0) / RAPPORT
    };
  }

  function degatsAttendus(entree){
    const source = entree || {};
    const stats = source.stats;
    const competence = source.competence;
    const cible = source.cible;
    if(!stats || !competence || !cible) return null;
    const base = baseDeDegats(stats, competence);
    if(!nombreFini(base) || base <= 0) return null;

    const facteurs = facteursHorsConstante(stats, cible);
    const critPropre = Math.min(PLAFOND_PROPRE, Math.max(
      0, (Number(stats.critRate) || 0) - (Number(cible.critResist) || 0)
    ));
    const critAllie = Math.max(0, Number(stats.critRateAllie) || 0);
    const taux = Math.min(PLAFOND_TOTAL, critPropre + critAllie) / RAPPORT;

    /* Un coup critique peut frapper PLUS FAIBLE qu'un coup normal, quand la
       defense critique de la cible depasse les degats critiques du build : le
       critique devient alors une malchance. Borner cet ecart a zero, comme le
       faisait ce module, effacait la penalite et surestimait ces builds.

       Seul le multiplicateur est borne, et a zero : des degats negatifs
       n'auraient aucun sens. */
    /* La defense critique de la cible se reduit en POINTS, jamais en facteur.
       Mesure sans ambiguite : retrancher « 50 » a une defense critique de 50
       donne 0, pas 25. C'est ce qui rend Daisy si forte contre Akumu, dont
       les 50 % de defense critique sont precisement ce qui fait passer le
       coup critique sous le coup normal. */
    const defCritCible = Math.max(
      0, (Number(cible.critDmgResist) || 0)
        - Math.max(0, Number(stats.reductionDefenseCritique) || 0)
    );
    const degatsCrit = ((Number(stats.critDamage) || 0) - defCritCible) / RAPPORT;
    const multiplicateurCritique = Math.max(0, 1 + degatsCrit);
    const critique = 1 + taux * (multiplicateurCritique - 1);
    const constante = constanteDe(stats);
    const mitigation = constante / (constante + facteurs.defEffective)
      + facteurs.percementNet / RAPPORT;

    /* Un SEUL calcul, lu trois fois : le facteur commun porte tout sauf le
       critique, donc le coup sans critique s'obtient sans le retirer, et les
       deux autres colonnes n'en sont que deux ponderations. Trois appels aux
       entrees differentes ouvriraient trois occasions de diverger. */
    const facteurCommun = facteurs.bonusOffensif * mitigation
      * facteurs.resistance * facteurs.faiblesse;
    const sansCritique = facteurCommun * base;
    const avecCritique = sansCritique * multiplicateurCritique;
    const total = sansCritique * critique;

    /* La repartition par coup, quand la source la donne. A defaut, un coup
       unique portant tout : mieux vaut un detail pauvre qu'un detail faux. */
    const parts = Array.isArray(competence.repartition)
      && competence.repartition.length
      && nombreFini(competence.pourcentage)
      && competence.pourcentage > 0
      ? competence.repartition
      : null;
    const parCoup = parts
      ? parts.map(part => total * (Number(part) || 0) / competence.pourcentage)
      : [total];

    return {
      total,
      sansCritique,
      avecCritique,
      parCoup,
      termes:[
        { id:"base", libelle:"Base de dégâts", valeur:base },
        { id:"bonus-offensif", libelle:"Bonus offensif",
          valeur:facteurs.bonusOffensif },
        { id:"critique", libelle:"Critique (espérance)", valeur:critique },
        { id:"mitigation", libelle:"Défense de la cible", valeur:mitigation },
        { id:"resistance", libelle:"Résistance", valeur:facteurs.resistance },
        { id:"faiblesse", libelle:"Faiblesse", valeur:facteurs.faiblesse }
      ]
    };
  }

  /* L'INVERSE de degatsAttendus, sur le seul coup NON CRITIQUE.

     Un coup non critique vaut :

       D = base x bonusOffensif x mitigation x resistance x faiblesse

     Le rapport de mitigation qu'il implique se lit donc directement, et la
     part qui revient a la defense s'obtient en retirant le percement :

       m = D / (base x bonusOffensif x resistance x faiblesse) - percement
       C = m x DEF / (1 - m)

     Pourquoi un coup NON critique : ce module prend le critique en ESPERANCE,
     alors qu'un coup reel est soit critique soit non, jamais la moyenne des
     deux. Calibrer sur un critique donnerait une constante fausse sans que
     rien ne proteste. La procedure publiee l'exige egalement, et demande de
     plus d'ADDITIONNER les nombres d'une competence a coups multiples.

     Trois refus explicites plutot qu'un chiffre absurde : une constante
     fausse serait le pire des resultats, puisqu'elle se sauvegarderait et
     fausserait ensuite chaque ligne du tableau sans plus jamais se signaler. */
  function calibrerConstante(entree){
    const source = entree || {};
    const stats = source.stats;
    const competence = source.competence;
    const cible = source.cible;
    if(!stats || !competence || !cible) return null;

    const observes = Number(source.degatsObserves);
    if(!nombreFini(observes) || observes <= 0){
      return { erreur:"degats-manquants" };
    }
    const base = baseDeDegats(stats, competence);
    if(!nombreFini(base) || base <= 0) return null;

    const facteurs = facteursHorsConstante(stats, cible);
    /* Une defense nulle rend la mitigation egale a 1 quelle que soit la
       constante : aucun coup ne peut alors la reveler. */
    if(facteurs.defEffective <= 0) return { erreur:"defense-nulle" };

    const denominateur = base * facteurs.bonusOffensif
      * facteurs.resistance * facteurs.faiblesse;
    if(!(denominateur > 0)) return { erreur:"build-incomplet" };

    const m = observes / denominateur - facteurs.percementNet / RAPPORT;
    if(m <= 0) return { erreur:"degats-trop-faibles" };
    if(m >= 1) return { erreur:"degats-au-dela-de-la-pre-armure" };

    return { constante:m * facteurs.defEffective / (1 - m) };
  }

/* `degatsDuCycle` a ete retiree en meme temps que la mesure de cycle : le
   calculateur chiffre chaque competence separement, et le depot refuse une
   sortie que personne n'importe. Elle reste recuperable sur la branche
   comparateur-degats-lot1, avec le simulateur temporel qui l'accompagnait.

   Ne pas commencer une ligne de commentaire par le mot-cle d'un module :
   tests/helpers/load-app.js verifie par expression reguliere qu'aucune
   declaration ne survit a la concatenation, et une prose mal coupee la
   declenche. */
/* CIBLE_REFERENCE n'est plus exportee : la vue choisit desormais son palier
   dans CIBLES. Elle reste dans le module — les tests la lisent par le
   chargeur — parce qu'elle documente le point de depart, le palier 1, celui
   que la page affichait quand il etait la seule cible connue. */
export {
  CIBLES, CONSTANTE_PAR_DEFAUT, calibrerConstante, degatsAttendus
};
