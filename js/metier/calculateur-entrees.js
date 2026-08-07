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

  /* Ou atterrit un malus inflige a la CIBLE. Ces lignes n'ont pas de code de
     stat : libelles-stats.json ne decrit que des statistiques de heros, et
     leur en inventer un aurait desactive le test qui refuse les codes
     inventes.

     Les malus de meme nature s'ADDITIONNENT ici (20 % + 20 % + 10 % = 50 %).
     C'est un choix, pas une mesure : le jeu pourrait aussi bien ne pas les
     cumuler, ou les composer (1-0,2)x(1-0,2). L'outil de reference n'expose
     qu'un seul champ ou le joueur saisit un total deja fait, donc il ne
     tranche pas non plus. */
  const EFFET_SUR_LA_CIBLE = {
    defense:"reductionDefense",
    defenseCritique:"reductionDefenseCritique"
  };

  function tableDesBuffs(){
    return window.SEVEN_DS_BUFFS_SUPPORTS || {};
  }

  /* Un buff elementaire ne concerne que les builds de cet element. Il est
     ABSENT des autres, jamais grise : c'est la meme regle qu'une competence
     sans coefficient, qui disparait au lieu de valoir zero.

     L'element attendu est celui de l'ARME equipee, jamais du personnage : un
     heros change d'element avec son arme. */
  function buffsApplicables(elementDuBuild){
    const catalogue = tableDesBuffs();
    const vise = (elementDuBuild || "").toLowerCase();
    return Object.keys(catalogue).sort().flatMap(support =>
      (catalogue[support] || [])
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
      bonusGlobal:0,
      bonusElementaire:0,
      bonusCategorie:0,
      /* Deux seaux de malus sur la cible. Le build ne les alimente jamais :
         ils ne viennent que des competences d'equipe cochees. */
      reductionDefense:0,
      reductionDefenseCritique:0
    };

    coches.forEach(buff => {
      const cle = buff && buff.effet
        ? EFFET_SUR_LA_CIBLE[buff.effet]
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

  /* Une competence non chiffrable garde sa ligne et rend `null`. La masquer
     ferait croire qu'elle n'existe pas ; la chiffrer a zero, qu'elle ne fait
     rien. */
  function resultatsParCompetence(entree){
    const source = entree || {};
    const liste = Array.isArray(source.competences) ? source.competences : [];
    return liste.map(competence => ({
      competence,
      resultat:degatsAttendus({
        stats:source.entrees, competence, cible:source.cible
      })
    }));
  }

export { buffsApplicables, entreesDuCalcul, resultatsParCompetence };
