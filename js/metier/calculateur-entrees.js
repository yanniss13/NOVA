/* Traduit « un build et des buffs coches » en entrees du moteur de degats.

   Module PUR : ni DOM ni reseau. Il existe pour que cette traduction soit
   testable sans navigateur, et pour que js/vues/calculateur.js ne contienne
   aucun calcul. */

import { degatsAttendus } from "./degats-calcul.js";

  const DIX_MILLIEMES = 10000;

  const ELEMENTS_BUFF = [
    "Fire", "Thunder", "Wind", "Ice", "Earth", "Dark", "Holy", "Default"
  ];

  /* Ou chaque code de stat atterrit dans les entrees du moteur.

     Les codes viennent de 7ds-stats/libelles-stats.json, jamais d'une
     invention : le plan citait AllSkill_Add et AllCategory_Add, qui
     n'existent nulle part. Un test refuse desormais tout buff dont le code ne
     change aucune entree.

     Les trois seaux de bonus restent distincts parce que le moteur les
     distingue : les confondre poserait une equivalence que la formule
     n'ecrit pas. */
  const CIBLE_DU_BUFF = Object.assign(
    {
      /* Un taux sur l'attaque du heros, pas une valeur plate. */
      I_AtkAdd_Rate:"atk",
      /* Des POINTS d'attaque, eux. Le jeu ecrit les deux avec le meme mot :
         `I_AtkAdd_Rate` multiplie, `B_Atk` s'ajoute. Le palier 10 du Livre
         d'Elizabeth donne aux allies 10 % de sa DEFENSE sous cette forme. */
      B_Atk:"atk",
      /* Le taux critique venu d'un SOUTIEN a son propre seau : le moteur
         plafonne le critique propre du heros a 90 % et ajoute celui des
         allies APRES ce plafond. Le verser dans `critRate` rendrait ces
         buffs invisibles sur tout build deja proche du plafond. */
      C_Critical_Rate:"critRateAllie",
      C_Critical_Dam_Rate:"critDamage",
      /* « Defense Shatter » : un pourcentage retranche a la defense de la
         cible. A ne pas confondre avec `A_Accuracy` (« Perforation »), plate
         et non modelisee. */
      D_Protect_Cur_Rate:"percementDefense",
      /* « Attaque de tous les elements » : le moteur l'ajoute a l'ATK pour
         toute composante de base `atk`, voir baseDeComposante(). */
      AllElement_Add:"attaqueElementaire"
    },
    /* Wind_Add… : l'attaque elementaire, plate. */
    Object.fromEntries(ELEMENTS_BUFF.map(e => [e + "_Add", "attaqueElementaire"])),
    /* Wind_Element_Rate… : l'augmentation des degats de cet element. */
    Object.fromEntries(ELEMENTS_BUFF.map(e => [e + "_Element_Rate", "bonusElementaire"]))
  );

  /* Le set equipe modifie les stats du heros, pas le seau des soutiens. Le
     critique est le seul code commun dont les deux origines divergent : un
     soutien arrive apres le plafond, tandis que Souverain cupide le subit. */
  const CIBLE_DU_BUFF_PROPRE = {
    C_Critical_Rate:"critRate",
    D_Protect_Cur_Rate:"percementDefense"
  };

  /* Ou atterrit une ligne qui n'a PAS de code de stat - un malus inflige a la
     cible, pour l'essentiel. libelles-stats.json ne decrit que des
     statistiques de heros, et leur en inventer un aurait desactive le test qui
     refuse les codes inventes.

     Les malus de meme nature s'ADDITIONNENT ici (20 % + 20 % + 10 % = 50 %).
     C'est un choix, pas une mesure : le jeu pourrait aussi bien ne pas les
     cumuler, ou les composer (1-0,2)x(1-0,2). L'outil de reference n'expose
     qu'un seul champ ou le joueur saisit un total deja fait, donc il ne
     tranche pas non plus. */
  const EFFET_SUR_LA_CIBLE = {
    defense:"reductionDefense",
    defenseCritique:"reductionDefenseCritique",
    /* La resistance critique, distincte de la defense critique : l'une decide
       si le coup critique PART, l'autre de ce qu'il rapporte. Les confondre
       ferait payer deux fois le meme debuff, ou disparaitre l'autre. */
    resistanceCritique:"reductionResistanceCritique",
    /* « Augmente les degats subis de 100 % » : une vulnerabilite qui ne vise
       AUCUNE categorie en particulier. Elle va donc dans `bonusGlobal`, un
       seau que le moteur additionne deja aux deux autres et que rien
       n'alimentait - meme raisonnement que la vulnerabilite par categorie,
       sans la restriction, donc meme analogie avec la faiblesse mesuree. */
    vulnerabiliteGlobale:"bonusGlobal"
  };

  /* LES DEUX STATISTIQUES ELEMENTAIRES DU BUILD, que rien ne lisait.

     Seul `X_Add` remontait au moteur. Les trois autres codes existaient dans
     le catalogue - 94 objets portent `X_Rate`, 94 portent `X_Element_Rate` -
     sans que rien ne les branche. Un membre qui roulait « Augmentation des
     degats de Foudre » ne voyait donc pas son chiffre bouger d'un point.

     MESURE EN JEU, mannequin (ni defense ni resistance), Merlin p10 Baguette,
     Jugement foudroyant a 159 %, releve juste apres un rerolle
     d'enchantement :

       ecran : Attaque de Foudre 1 409, Augmentation de l'attaque de Foudre
               43,76 %, Augmentation des degats de Foudre 12,44 %,
               competence normale 23,81 %, palier 4 +15 %

       [15 187 x 1,7316 + 1 409 x 1,4376] x 1,59 x 1,3625 x 1,15 = 70 563
                                                    -> releve en jeu : 70 563
       les memes sans le taux d'attaque             -> 69 027, 2,2 % trop bas
       les memes sans le bonus de degats            -> 64 738, 8,3 % trop bas

     CE QUE LA MESURE ETABLIT. Le taux ne se replie PAS dans le nombre
     affiche : l'ecran montre toujours 1 409 et range les 43,76 % dans un bloc
     « Stats elementaires (%) » separe. L'ecran de stats n'est pas l'entree du
     calcul - meme piege que les bonus de categorie venus d'un potentiel.

     Elle etablit aussi que le bonus de degats elementaire tombe dans le MEME
     seau additif que le bonus de categorie : les faire se multiplier donnerait
     72 097, soit 2,2 % de trop. C'etait jusqu'ici une deduction reprise de
     l'outil de reference ; c'est desormais un releve.

     CE QU'ELLE N'ETABLIT PAS, et qui est donc un CHOIX. Les deux
     statistiques « tous elements » de Merlin sont nulles, donc rien ici ne les
     mesure :
       - `AllElement_Rate` dit « augmentation de TOUTES les attaques
         elementaires » : il majore les deux plats. `X_Rate` ne nomme qu'un
         element : il ne majore que le sien. Chaque taux porte ce que son
         libelle dit, et rien de plus.
       - les deux taux s'ADDITIONNENT avant de multiplier, par analogie avec
         `I_AtkAdd_Rate`, taux unique deja somme sur toutes ses sources.
     L'enjeu reste mince : un seul objet du catalogue porte `AllElement_Rate`.

     La fonction prend `lire` en argument plutot que le build : les codes de
     stat vivent ici, avec le reste du vocabulaire, et un test peut les
     verifier sans navigateur. */
  /* LE SEAU ELEMENTAIRE QU'UNE STAT ALIMENTE, ou null si elle n'en alimente
     aucun. Deux taux existent et ils ne portent pas la meme chose :

       AllElement_Rate  majore les DEUX attaques elementaires
       Ice_Rate…        ne majore que celle de son propre element

     Les confondre etait tentant - un seul supplement suffisait tant que seul
     Barrage des Tenebres passait par ici - mais cela ferait majorer l'attaque
     « tous elements » par un taux qui ne la nomme pas.

     Le suffixe ne suffit PAS a reconnaitre un taux elementaire :
     C_Critical_Rate et I_AtkAdd_Rate finissent par _Rate sans etre
     elementaires. Le nom retire doit figurer dans la liste des elements. */
  function seauElementaireDeLaStat(stat){
    if(stat === "AllElement_Rate") return "tous";
    if(typeof stat !== "string") return null;
    const nom = stat.replace(/_Rate$/, "");
    return nom !== stat && ELEMENTS_BUFF.indexOf(nom) !== -1 ? "propre" : null;
  }

  function statsElementairesDuBuild(lire, element, supplements){
    const lecture = typeof lire === "function" ? lire : () => 0;
    const valeur = code => Number(lecture(code)) || 0;
    const prefixe = element
      ? String(element).charAt(0).toUpperCase()
        + String(element).slice(1).toLowerCase()
      : null;
    const propre = prefixe ? valeur(prefixe + "_Add") : 0;
    const tous = valeur("AllElement_Add");
    /* Les passifs d'arme arrivent ici, avant que l'attaque elementaire ne soit
       resolue. Les envoyer dans entreesDuCalcul serait muet : il ne reste
       alors plus qu'un nombre deja calcule. Ils arrivent DEJA TRIES par
       seauElementaireDeLaStat(), un seau par taux. */
    const apports = supplements || {};
    const tauxPropre = (prefixe ? valeur(prefixe + "_Rate") : 0)
      + (Number(apports.propre) || 0);
    const tauxTous = valeur("AllElement_Rate")
      + (Number(apports.tous) || 0);
    return {
      attaqueElementaire:
        propre * (1 + (tauxPropre + tauxTous) / DIX_MILLIEMES)
        + tous * (1 + tauxTous / DIX_MILLIEMES),
      bonusElementaire:prefixe ? valeur(prefixe + "_Element_Rate") : 0
    };
  }

  function tableDesBuffs(){
    return window.SEVEN_DS_BUFFS_SUPPORTS || {};
  }

  /* Un buff elementaire ne concerne que les builds de cet element. Il est
     ABSENT des autres, jamais grise : c'est la meme regle qu'une competence
     sans coefficient, qui disparait au lieu de valoir zero.

     L'element attendu est celui de l'ARME equipee, jamais du personnage : un
     heros change d'element avec son arme.

     Les lignes CONSIGNEES (`horsCalcul`) sortent avant tout filtre. Le moteur
     n'a pas d'entree pour la resistance elementaire : les proposer donnerait
     une case a cocher qui ne bouge aucun chiffre, et le membre croirait son
     effet compte. Elles vivent dans le recensement de l'Analyse, pas ici. */
  function buffsApplicables(elementDuBuild){
    const catalogue = tableDesBuffs();
    const vise = (elementDuBuild || "").toLowerCase();
    return Object.keys(catalogue).sort().flatMap(support =>
      (catalogue[support] || [])
        .filter(buff => !buff.horsCalcul)
        .filter(buff => !buff.element || buff.element.toLowerCase() === vise)
        .map(buff => Object.assign({ support }, buff))
    );
  }

  function entreesDuCalcul(entree){
    const source = entree || {};
    const stats = source.statsDuBuild || {};
    const coches = Array.isArray(source.buffsCoches) ? source.buffsCoches : [];

    const sorties = {
      atk:Number(stats.atk) || 0,
      attaqueElementaire:Number(stats.attaqueElementaire) || 0,
      def:Number(stats.def) || 0,
      maxHp:Number(stats.maxHp) || 0,
      critRate:Number(stats.critRate) || 0,
      /* Le build n'alimente jamais ce seau : il ne se remplit que des buffs
         de soutien coches, et le moteur l'ajoute apres le plafond de 90 %. */
      critRateAllie:0,
      critDamage:Number(stats.critDamage) || 0,
      percementDefense:Number(stats.percementDefense) || 0,
      /* Le build alimente ce seau depuis `I_All_DamAdd_Rate`, « Augmentation
         de tous les degats ». Le code existait dans le catalogue - l'ensemble
         « Au bord du neant » le porte a +7,5 %, des trois pieces - sans que
         rien ne le lise : un membre qui roulait cet ensemble voyait 7,5 % de
         degats disparaitre en silence. Meme famille d'oubli que les deux
         statistiques elementaires.
         Les vulnerabilites cochees s'y ajoutent par-dessus, ce qui est juste :
         le seau vaut pour toutes les competences a la fois, quelle que soit
         l'origine de ce qui l'alimente. */
      bonusGlobal:Number(stats.bonusGlobal) || 0,
      /* Le build ALIMENTE ce seau, contrairement aux deux autres : son bonus
         de degats elementaire vaut pour toutes ses competences a la fois,
         donc il a sa place dans les entrees communes. Le bonus de CATEGORIE
         ne l'a pas - il ne vaut que pour une categorie, et voyage a part dans
         `bonusParCategorie`. Les buffs de soutien s'ajoutent par-dessus. */
      bonusElementaire:Number(stats.bonusElementaire) || 0,
      bonusCategorie:0,
      /* Trois seaux de malus sur la cible. Le build ne les alimente jamais :
         ils ne viennent que des competences d'equipe cochees. */
      reductionDefense:0,
      reductionDefenseCritique:0,
      reductionResistanceCritique:0
    };

    coches.forEach(buff => {
      const cle = buff && buff.effet
        ? EFFET_SUR_LA_CIBLE[buff.effet]
        : buff && buff.porteur === "hero"
          ? CIBLE_DU_BUFF_PROPRE[buff.stat]
          : CIBLE_DU_BUFF[buff && buff.stat];
      if(!cle) return;
      const valeur = Number(buff.valeur);
      if(!Number.isFinite(valeur)) return;
      if(buff.operation === "multiply"){
        sorties[cle] = sorties[cle] * (1 + valeur / DIX_MILLIEMES);
        return;
      }
      sorties[cle] = sorties[cle] + valeur;
    });

    return sorties;
  }

  /* Chaque categorie de competence a son propre bonus de degats, et le
     catalogue de competences porte exactement les cinq categories que le jeu
     publie. La correspondance n'est pas une convention locale : le code de
     stat `Activethird_Damadd_Rate` et la categorie `ACTIVE_THIRD` sont deux
     ecritures du meme identifiant amont.

     Ces bonus ne peuvent pas rejoindre les entrees communes, qui valent pour
     toutes les competences a la fois : verser le bonus d'ultime dans une
     attaque normale la gonflerait a tort. Ils s'appliquent donc ligne par
     ligne, au moment ou chaque competence est chiffree. */
  const STAT_DE_LA_CATEGORIE = {
    NORMAL:"Normalattack_Damadd_Rate",
    NORMAL_SKILL:"Normalskill_Damadd_Rate",
    ACTIVE_THIRD:"Activethird_Damadd_Rate",
    ULTIMATE:"Ultimateskill_Damadd_Rate",
    TAG_SKILL:"Normalskillchangetag_Damadd_Rate"
  };

  /* L'inverse de la table ci-dessus, derive d'ELLE plutot que reecrit : deux
     listes tenues en parallele finiraient par diverger. */
  const CATEGORIE_DE_LA_STAT = Object.fromEntries(
    Object.entries(STAT_DE_LA_CATEGORIE)
      .map(([categorie, code]) => [code, categorie])
  );

  /* Une VULNERABILITE de la cible : « augmente les degats de competence
     normale SUBIS PAR L'ENNEMI de 50 % ». Ce n'est pas un bonus du heros, et
     la table le dit - la ligne porte `effet`, pas un code de stat, parce que
     libelles-stats.json ne decrit que des statistiques de heros.

     Elle atterrit pourtant dans le MEME seau additif que le bonus du heros,
     et ce choix est une ANALOGIE, pas une mesure. Ce qui la fonde : la
     FAIBLESSE de l'ennemi, mesuree chez l'outil de reference, tombe elle
     aussi dans le seau additif des bonus au lieu de former un facteur separe
     (RAPPORT-analyse-tapscreen.md, section 5). C'est le cas connu le plus
     proche - une propriete de la cible qui amplifie les degats.

     Rien ne la mesure directement, et rien ne le pourra bientot : l'outil de
     reference n'a AUCUN champ de degats subis par categorie. Le jour ou une
     mesure existera, c'est ici qu'elle se posera, en un seul endroit. */
  const VULNERABILITE_CATEGORIE = "vulnerabiliteCategorie";

  /* La categorie que vise une ligne cochee, quelle que soit sa forme : le code
     de stat d'un bonus du heros, ou la categorie nommee d'une vulnerabilite. */
  function categorieVisee(buff){
    if(!buff) return null;
    if(buff.effet === VULNERABILITE_CATEGORIE) return buff.categorie || null;
    return CATEGORIE_DE_LA_STAT[buff.stat] || null;
  }

  /* Les bonus de categorie apportes par des buffs COCHES.

     Ils ne peuvent pas passer par entreesDuCalcul, dont les seaux valent pour
     toutes les competences a la fois : y verser un bonus de competence normale
     gonflerait l'ultime. Ils sortent donc a part, pour etre fusionnes avec
     ceux que le build porte deja.

     Une valeur illisible est ignoree plutot que propagee : un NaN dans le seau
     ferait disparaitre la ligne de degats entiere, sans rien dire. */
  function bonusCategorieDesBuffs(buffsCoches){
    const liste = Array.isArray(buffsCoches) ? buffsCoches : [];
    return liste.reduce((bonus, buff) => {
      const categorie = categorieVisee(buff);
      const valeur = Number(buff && buff.valeur);
      if(!categorie || !Number.isFinite(valeur)) return bonus;
      bonus[categorie] = (bonus[categorie] || 0) + valeur;
      return bonus;
    }, {});
  }

  /* Les entrees vues par UNE competence : les entrees communes, plus le bonus
     de sa seule categorie.

     La CALIBRATION s'en sert autant que le tableau, et c'est la raison d'etre
     de cette fonction. Elle inverse la formule sur une competence precise :
     lui passer des entrees sans le bonus de categorie, alors que le tableau
     l'applique, ferait mesurer une constante fausse — d'autant plus fausse
     que le bonus est gros, et il monte a +115 % sur certains paliers. */
  function entreesDeLaCompetence(
    entrees, bonusParCategorie, competence, bonusPotentielParCategorie
  ){
    const categorie = competence && competence.categorie;
    const bonus = Number((bonusParCategorie || {})[categorie]) || 0;
    /* Le bonus de PALIER DE POTENTIEL voyage a part, parce qu'il ne s'ajoute
       pas : il multiplie le seau. Mesure en jeu sur le mannequin, Merlin p10
       Baguette — l'ecran de stats affiche 25,05 % pour la competence normale
       et non 40,05 %, et seul le produit des deux retrouve le coup releve.
       Voir le commentaire de facteursHorsConstante() dans degats-calcul.js. */
    const potentiel = Number(
      (bonusPotentielParCategorie || {})[categorie]
    ) || 0;
    if(!bonus && !potentiel) return entrees;
    /* Le bonus d'equipement S'AJOUTE au seau : un buff de soutien deja verse
       dans `bonusCategorie` par entreesDuCalcul() doit survivre, sinon cocher
       un soutien effacerait l'apport de l'equipement. */
    return Object.assign({}, entrees, {
      bonusCategorie:(Number(entrees && entrees.bonusCategorie) || 0) + bonus,
      bonusCategoriePotentiel:
        (Number(entrees && entrees.bonusCategoriePotentiel) || 0) + potentiel
    });
  }

  /* Une competence non chiffrable garde sa ligne et rend `null`. La masquer
     ferait croire qu'elle n'existe pas ; la chiffrer a zero, qu'elle ne fait
     rien. */
  function resultatsParCompetence(entree){
    const source = entree || {};
    const liste = Array.isArray(source.competences) ? source.competences : [];
    return liste.map(competence => ({
      competence,
      resultat:degatsAttendus({
        stats:entreesDeLaCompetence(
          source.entrees, source.bonusParCategorie, competence,
          source.bonusPotentielParCategorie
        ),
        competence,
        cible:source.cible
      })
    }));
  }

  function resultatChiffre(resultat){
    return resultat && ["sansCritique", "avecCritique", "total"]
      .every(cle => Number.isFinite(resultat[cle]));
  }

  function ecartDeResultat(reference, essai){
    const absolu = essai - reference;
    return {
      absolu,
      relatif:reference === 0 ? null : Math.round(absolu * 10000 / reference)
    };
  }

  function resultatsParCompetenceCompares(reference, essai){
    const secondes = Array.isArray(essai) ? essai : [];
    return (Array.isArray(reference) ? reference : []).map((ligne, index) => {
      const second = secondes[index] || {};
      const premierResultat = ligne && ligne.resultat;
      const secondResultat = second.resultat;
      const ecarts = resultatChiffre(premierResultat) && resultatChiffre(secondResultat)
        ? {
            sansCritique:ecartDeResultat(
              premierResultat.sansCritique, secondResultat.sansCritique
            ),
            avecCritique:ecartDeResultat(
              premierResultat.avecCritique, secondResultat.avecCritique
            ),
            total:ecartDeResultat(premierResultat.total, secondResultat.total)
          }
        : null;
      return Object.assign({}, ligne, { essai:secondResultat || null, ecarts });
    });
  }

export {
  STAT_DE_LA_CATEGORIE,
  bonusCategorieDesBuffs,
  buffsApplicables, entreesDeLaCompetence, entreesDuCalcul,
  resultatsParCompetence, resultatsParCompetenceCompares,
  seauElementaireDeLaStat, statsElementairesDuBuild
};
