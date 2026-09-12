/* Les degats attendus d'une competence. Le noyau defense/percement/resistance
   suit les sorties mesurees du calculateur de Blue ; les bornes finales et les
   couches absentes de son interface restent issues des tables et mesures du
   projet :

     Degats = ATK x Coef x Bonus-type x Critique x K/(K+DEF effective)
              x (1 - Resistance) x (1 + Faiblesse)

   Module PUR : ni DOM ni reseau, toutes les entrees arrivent par argument.

   Le critique est pris en ESPERANCE (1 + taux x degats) et non tire au sort :
   un comparateur doit etre deterministe, sinon deux consultations de la meme
   fiche donneraient deux classements.

   Les pourcentages arrivent en dix-milliemes, unite deja en vigueur dans le
   depot (voir js/vues/stats-affichage.js) : valeur / 10000 donne le rapport,
   valeur / 100 le pourcentage affiche. */

  /* Valeur reproduisant exactement les sorties du calculateur de Blue,
     relevees en boite noire le 12 septembre 2026 : avec 1 000 000 d'ATK,
     100 % de coefficient et 1 000 / 5 128 / 10 000 de DEF, il rend
     839 228,3 / 504 445,3 / 342 969,8, soit K = 5 220 dans K/(K+DEF).

     Elle ne sert que TANT QU'UN MEMBRE N'A PAS CALIBRE la sienne. C ne se
     lit sur aucun ecran du jeu et ne se deduit d'aucune table : elle se
     mesure sur un coup reel, d'ou calibrerConstante() plus bas.

     L'incertitude qui en resulte se simplifie dans un RAPPORT entre deux
     builds : c'est pourquoi la page reste honnete comme comparateur meme
     sans calibration, et ne devient predictive qu'avec. */
  const CONSTANTE_PAR_DEFAUT = 5220;

  function constanteDe(stats){
    const valeur = Number(stats && stats.constanteC);
    return Number.isFinite(valeur) && valeur > 0 ? valeur : CONSTANTE_PAR_DEFAUT;
  }

  /* Valeurs REELLES relevees sur le boss de confrerie, page
     7dsorigin.app/fr/boss-de-confrerie/akumu-bete-demoniaque. Jamais inventees.

     Les niveaux 1 a 20 ont ete releves sur la page publique ; le detail et la
     methode vivent dans docs/akumu-20-niveaux.md. Les niveaux 21 a 30 viennent
     directement du client, table Actor/NpcStatGroupTable, groupe
     stat_50700109. Le palier 21 ouvre un nouveau regime : la resistance
     critique retombe a 20 %, tandis que DEF, defense critique et PV continuent
     de croitre. Un test garde cette rupture au lieu de la lisser.

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
    [20, 38544, 12235, 21582, 96543801],
    [21, 40175,  2000, 35806, 102375267],
    [22, 43919,  2000, 38010, 112611620],
    [23, 47735,  2000, 40114, 123127648],
    [24, 51811,  2000, 42270, 134412784],
    [25, 56152,  2000, 44468, 146490333],
    [26, 60575,  2000, 46554, 158878632],
    [27, 65271,  2000, 48672, 172090420],
    [28, 70051,  2000, 50673, 185628496],
    [29, 75113,  2000, 52694, 200021136],
    [30, 80264,  2000, 54593, 214755600]
  ];

  /* Les deux valeurs publiees restent distinctes : 30 % pour chacun des huit
     elements et 50 % de resistance elementaire de base. Le modele de Blue
     tranche leur combinaison en retenant la plus haute avant les reductions. */
  const AKUMU_ELEMENTAIRE = {
    resistanceElementaire:3000,
    resistanceElementaireBase:5000,
    faiblesse:0,
  };

  /* LA BORNE DE CE QUI A ETE MESURE.

     7dsorigin borne explicitement sa propre formule : « the K/(K+DEF) form
     remains an approximation outside the measured range (DEF 0 -> 26,727) ».

     Akumu depasse cette borne des le palier 17 (DEF 30 029) et la TRIPLE au
     palier 30 (DEF 80 264). Toute la zone ou la confrerie joue est donc en
     extrapolation — y compris chez la source, et y compris si l'on remplacait
     un jour C par le K publie.

     Ce n'est pas un bug, c'est une limite. Elle est portee par la CIBLE plutot
     que laissee en commentaire parce qu'un chiffre extrapole qui ne se
     presente pas comme tel est plus dangereux qu'un chiffre absent : la vue
     doit pouvoir le dire au membre, et elle ne le peut que si la donnee le
     porte. */
  const DEF_MESUREE_MAX = 26727;

  const CIBLES = AKUMU_PALIERS.map(([niveau, def, critResist, critDmgResist, hp]) =>
    Object.assign({
      id:"akumu-" + niveau,
      nom:"Akumu, bête démoniaque",
      niveau,
      def,
      critResist,
      critDmgResist,
      hp,
      /* Publiee a 20 % aux niveaux 1 a 20. La table du client poursuit par
         pas de 0,2 point jusqu'a 22 % au niveau 30. */
      resistancePercement:niveau <= 20
        ? 2000
        : 2000 + (niveau - 20) * 20,
      horsPlageMesuree:def > DEF_MESUREE_MAX
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
    resistanceElementaireBase:0,
    faiblesse:0,
    resistancePercement:0
  }]);

  /* Le palier 1, garde sous son ancien nom : il etait la cible unique avant
     que les niveaux ne soient releves, et rien de ce qui etait affiche
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

  /* Deux bornes elementaires du datamine 7dsorigin (page formule-de-degats,
     section « Validation »), absentes de nos releves directs parce qu'AUCUNE
     cible accessible ici ne les atteint : Akumu n'a aucune faiblesse, et sa
     resistance est modeste. Elles ne deplacent donc aucun chiffre affiche
     aujourd'hui - elles restent justes le jour ou une cible extreme paraitra.

     PLAFOND_FAIBLESSE : la somme faiblesse + burst + stuff est capee de sorte
     que le terme d'avantage elementaire ne depasse jamais x6 (+500 %).
     PLANCHER_DEGATS : la reduction defense x resistance ne peut pas ramener un
     coup sous 5 % de sa valeur d'avant mitigation. */
  const PLAFOND_FAIBLESSE = 6;

  /* Blue borne le percement net a 100 %. Le jeu publie aussi une borne de
     somme a 90 %, mais le proprietaire a choisi le modele mesure par Blue
     comme reference empirique du calculateur. */
  const PLAFOND_PERCEMENT = 10000;
  const PLANCHER_DEGATS = 0.05;

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
    const seauAdditif = 1 + (bonusPublie
      ? (Number(stats.bonusCategorie) || 0)
        + (Number(stats.bonusElementaire) || 0)
        + (Number(stats.bonusGlobal) || 0)
      : (Number(stats.bonusType) || 0)) / RAPPORT;

    /* Le bonus de categorie d'un PALIER DE POTENTIEL ne rejoint pas ce seau :
       il se multiplie par-dessus.

       Mesure en jeu, mannequin (ni defense ni resistance), Merlin p10
       Baguette, Jugement foudroyant a 159 % :

         28 785 x 1,59 x 1,2505 x 1,15         = 65 818  -> releve 65 819
         28 785 x 1,59 x (1 + 0,2505 + 0,15)   = 64 098, 2,6 % trop bas

       Ce qui tranche sans calcul : l'ecran de stats du jeu affiche « 25,05 % »
       pour la competence normale, pas 40,05 %. Le palier 4 (« Renforce la
       puissance de la competence normale de 15 % ») n'est donc PAS verse dans
       la statistique que porte l'equipement — il s'applique apres elle.

       L'ecart grandit avec les deux bonus : a 60 % de categorie et 50 % de
       palier, le seau additif se trompe de 19 %. */
    const bonusOffensif = seauAdditif
      * (1 + (Number(stats.bonusCategoriePotentiel) || 0) / RAPPORT);

    /* Le percement de defense (`D_Protect_Cur_Rate`, « Defense Shatter »)
       reduit la DEF avant la courbe hyperbolique, selon le modele de Blue :

         percementNet = clamp(percement - resistancePercement, 0, 100 %)
         DEF effective = DEF apres malus x (1 - percementNet)
         mitigation = C/(C + DEF effective)

       Releve en boite noire le 12 septembre 2026 : a DEF 5 128, 50 % de
       percement rendent 670,6 pour une base de 1 000 ; avec 20 % de
       resistance au percement, 592,5. Ces nombres correspondent exactement
       a une DEF multipliee par 0,5 puis 0,7.

       A ne pas confondre avec la « Perforation » (`A_Accuracy`), qui ne perce
       AUCUNE defense : elle s'oppose a la « Perseverance » de l'ennemi
       (`A_Block`, et son taux `A_Block_Rate`). Les trois partagent le prefixe
       `A_` et sont plates la ou le percement est un taux : c'est un
       affrontement toucher / bloquer, une couche entiere que la formule
       publiee ne modelise pas. Elle reste donc non branchee, et le restera
       tant que cette couche n'aura pas sa propre formule - la brancher ici
       reviendrait a la faire passer pour de la penetration d'armure.

       La resistance au percement (`D_Protect_CurRes_Rate`) se retranche en
       points. Le plancher a zero empeche une resistance superieure au
       percement de renforcer la DEF ; le plafond a 100 % evite une DEF
       negative. */
    const percementNet = Math.min(PLAFOND_PERCEMENT, Math.max(
      0, (Number(stats.percementDefense) || 0)
        - (Number(cible.resistancePercement) || 0)
    ));

    /* La reduction de defense infligee a l'ennemi par une competence
       MULTIPLIE sa defense. Le percement multiplie ensuite cette DEF deja
       reduite : a 50 % de chaque, il reste 25 % de la DEF initiale.

       Le plafond a 100 % est un GARDE-FOU, pas un releve : personne n'a
       verifie ce que fait la reference au-dela, et une defense negative
       n'aurait aucune lecture. Nos malus culminent a 50 % cumules. */
    const reductionDef = Math.min(RAPPORT, Math.max(
      0, Number(stats.reductionDefense) || 0
    ));

    const defEffective = (Number(cible.def) || 0)
      * (1 - reductionDef / RAPPORT)
      * (1 - percementNet / RAPPORT);
    /* Blue retient la plus haute resistance entre la base commune et celle de
       l'element frappe, puis retranche les reductions d'equipe en POINTS.
       L'ancien champ unique reste compatible : en l'absence d'une resistance
       de base, il est simplement la valeur retenue.

       Jusqu'a 50 %, un point retire un point de degats. Au-dessus, trois
       points de resistance n'en retirent plus que deux : 80 % donnent donc
       un facteur 0,30 et non 0,20. Le plancher global de 5 % reste applique
       plus bas, conformement a la table du client. */
    const resistanceBrute = Math.max(
      0,
      Number(cible.resistanceElementaire) || 0,
      Number(cible.resistanceElementaireBase) || 0
    );
    const resistanceNette = Math.max(
      0, resistanceBrute
        - Math.max(0, Number(stats.reductionResistanceElementaire) || 0)
    );
    const resistance = resistanceNette <= 5000
      ? 1 - resistanceNette / RAPPORT
      : 0.5 - (resistanceNette - 5000) / 15000;

    return {
      bonusOffensif,
      percementNet,
      defEffective,
      resistance,
      /* Cape a x6 : le terme signe peut monter (faiblesse) ou descendre
         (resistance), mais la somme des sources ne l'amplifie pas au-dela de
         +500 %. Le plafond ne mord que par le haut - frapper une resistance
         reste pleinement penalisant. */
      faiblesse:Math.min(
        PLAFOND_FAIBLESSE,
        1 + (Number(cible.faiblesse) || 0) / RAPPORT
      )
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
    /* La resistance critique de la cible se reduit en POINTS, comme sa defense
       critique juste en dessous, et pour la meme raison : les deux sont des
       taux en dix-milliemes que le jeu retranche l'un a l'autre.

       Ce n'est pas une pure deduction. L'outil de reference expose ce debuff
       sous le nom `d-ecr` et il ne figure PAS parmi ses champs mesures inertes
       (RAPPORT-analyse-tapscreen.md, section 4, qui nomme `eai`, `d-edi`,
       `d-nadmg` et `d-epr`). Son voisin `d-ecdr`, lui, a ete mesure en points
       - retrancher « 50 » a une defense critique de 50 donne 0, pas 25 - et
       rien ne suggere que les deux champs voisins se comportent autrement.

       Le plancher a zero est un garde-fou : sur-reduire ne doit pas RENDRE du
       critique a la cible. */
    const resistCritCible = Math.max(
      0, (Number(cible.critResist) || 0)
        - Math.max(0, Number(stats.reductionResistanceCritique) || 0)
    );
    const critPropre = Math.min(PLAFOND_PROPRE, Math.max(
      0, (Number(stats.critRate) || 0) - resistCritCible
    ));
    const critAllie = Math.max(0, Number(stats.critRateAllie) || 0);
    const taux = Math.min(PLAFOND_TOTAL, critPropre + critAllie) / RAPPORT;

    /* La defense critique de la cible se reduit en POINTS, jamais en facteur.
       Mesure sans ambiguite : retrancher « 50 » a une defense critique de 50
       donne 0, pas 25. C'est ce qui rend Daisy si forte contre Akumu, dont la
       defense critique annule purement le gain du critique. */
    const defCritCible = Math.max(
      0, (Number(cible.critDmgResist) || 0)
        - Math.max(0, Number(stats.reductionDefenseCritique) || 0)
    );
    /* LE PLANCHER A 1. Un coup critique ne descend jamais sous le coup normal.

       `battle_min_critical_dam_rate` = 10000, soit 100 %
       (docs/constantes-combat-du-jeu.md, section « Plafonds et planchers — les
       bornes que le jeu applique en fin de calcul »).

       Elle voisine `battle_min_damres_rate` = 500, dont les 5 % sont exactement
       ceux que PLANCHER_DEGATS applique plus bas — ce plancher-la vient du
       datamine 7dsorigin, et la table du client le confirme au chiffre pres.
       Retenir une borne de cette section et ecarter sa voisine ne se defend
       pas.

       Ce module bornait a ZERO, et ce n'etait pas gratuit : tapscreen.app laisse
       bien le multiplicateur tomber sous 1 (RAPPORT-analyse-tapscreen.md,
       section 4 : a `cd` = 0 contre 42,93 % de defense critique, 36 329 contre
       63 658 en non-critique, mesure en boite noire non ambigue). Mais cette
       mesure prouve ce que fait L'OUTIL, pas ce que fait le jeu — et l'outil
       d'en face, 7dsorigin, plancherise a x1,00. Deux modeles tiers qui se
       contredisent ne valent pas la table du client.

       Le plancher ne peut pas mordre AVANT la soustraction : les degats
       critiques d'un build valent deja au moins 100 % par construction
       (`ga_default_criticalpowerper_rate` = 12000). Une borne qui ne mord jamais
       ne serait pas dans la table. Elle s'applique donc apres.

       Consequence : contre Akumu palier 21+, dont la defense critique depasse
       358 %, le taux critique n'est plus un handicap, il est NEUTRE. */
    const degatsCrit = ((Number(stats.critDamage) || 0) - defCritCible) / RAPPORT;
    const multiplicateurCritique = Math.max(1, 1 + degatsCrit);
    const critique = 1 + taux * (multiplicateurCritique - 1);
    const constante = constanteDe(stats);
    /* Sans DEF effective — cible nue ou percement a 100 % — la mitigation
       vaut 1 et la constante ne joue plus. */
    const mitigation = facteurs.defEffective > 0
      ? constante / (constante + facteurs.defEffective)
      : 1;

    /* Un SEUL calcul, lu trois fois : le facteur commun porte tout sauf le
       critique, donc le coup sans critique s'obtient sans le retirer, et les
       deux autres colonnes n'en sont que deux ponderations. Trois appels aux
       entrees differentes ouvriraient trois occasions de diverger. */
    /* Le plancher de degats : la reduction cote cible — defense puis
       resistance elementaire — ne peut pas faire tomber le coup sous 5 % de sa
       valeur d'avant mitigation. Datamine 7dsorigin.

       Il ne vit QU'ICI, en avant : calibrerConstante() refuse explicitement
       un coup qui l'atteint, car il a perdu l'information necessaire pour
       retrouver C. Les termes `mitigation` et `resistance` restent affiches
       bruts plus bas ; leur produit n'est floore que dans le total. */
    const reductionCible = Math.max(
      PLANCHER_DEGATS, mitigation * facteurs.resistance
    );
    const facteurCommun = facteurs.bonusOffensif * reductionCible
      * facteurs.faiblesse;
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

     Le rapport de mitigation qu'il implique se lit donc directement :

       m = D / (base x bonusOffensif x resistance x faiblesse)
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

    const avantReductionCible = base * facteurs.bonusOffensif
      * facteurs.faiblesse;
    if(!(avantReductionCible > 0)) return { erreur:"build-incomplet" };
    /* Au plancher final de 5 %, plusieurs constantes produisent le meme coup :
       l'inversion n'a plus de solution unique. La petite marge absorbe
       l'arrondi entier d'un releve en jeu. */
    if(observes / avantReductionCible <= PLANCHER_DEGATS + 0.0001){
      return { erreur:"degats-au-plancher" };
    }
    const denominateur = avantReductionCible * facteurs.resistance;
    if(!(denominateur > 0)) return { erreur:"build-incomplet" };

    const m = observes / denominateur;
    if(m <= 0) return { erreur:"degats-trop-faibles" };
    if(m >= 1) return { erreur:"degats-au-dela-de-la-pre-armure" };

    return { constante:m * facteurs.defEffective / (1 - m) };
  }

  /* Le score d'un cycle : chaque competence chiffree une fois, additionnee.
     Il mesure le burst, la ou le simulateur temporel mesure le rendement. Les
     competences que la source ne chiffre pas ne valent pas zero : elles sont
     comptees dans `nonInclus` plutot que fondues dans le total.

     Rendre null sur une liste entierement non chiffree est delibere : un
     heros dont aucun coefficient n'est publie doit rester ABSENT du
     classement, pas y figurer au dernier rang. */
  function degatsDuCycle(entree){
    const source = entree || {};
    const liste = Array.isArray(source.competences) ? source.competences : [];
    const detail = liste
      .map(competence => ({
        competence,
        resultat:degatsAttendus({
          stats:source.stats, competence, cible:source.cible
        })
      }))
      .filter(ligne => ligne.resultat !== null)
      .map(ligne => ({ competence:ligne.competence, total:ligne.resultat.total }));
    if(!detail.length) return null;
    return {
      total:detail.reduce((somme, ligne) => somme + ligne.total, 0),
      detail,
      nonInclus:liste.length - detail.length
    };
  }

/* `degatsDuCycle` est revenue avec le simulateur temporel de la branche
   comparateur-degats-lot1 : la fiche de heros a de nouveau un consommateur,
   et le depot refuse une sortie que personne n'importe.

   Ne pas commencer une ligne de commentaire par le mot-cle d'un module :
   tests/helpers/load-app.js verifie par expression reguliere qu'aucune
   declaration ne survit a la concatenation, et une prose mal coupee la
   declenche. */
/* CIBLE_REFERENCE n'est plus exportee : la vue choisit desormais son palier
   dans CIBLES. Elle reste dans le module — les tests la lisent par le
   chargeur — parce qu'elle documente le point de depart, le palier 1, celui
   que la page affichait quand il etait la seule cible connue. */
/* PLAFOND_PROPRE sort parce que la VUE doit le dire, pas seulement le subir :
   un bonus de taux critique verse a un heros deja au plafond ne deplace aucun
   chiffre, et un membre qui ne voit pas pourquoi croit la page cassee. Le
   reecrire dans la vue ferait deux plafonds a tenir d'accord. */
export {
  CIBLES, CONSTANTE_PAR_DEFAUT, DEF_MESUREE_MAX, PLAFOND_PROPRE,
  calibrerConstante, degatsAttendus, degatsDuCycle
};
