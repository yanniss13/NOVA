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
      C_Critical_Rate:"critRate",
      C_Critical_Dam_Rate:"critDamage",
      /* « Attaque de tous les elements » : le moteur l'ajoute a l'ATK pour
         toute composante de base `atk`, voir baseDeComposante(). */
      AllElement_Add:"attaqueElementaire"
    },
    /* Wind_Add… : l'attaque elementaire, plate. */
    Object.fromEntries(ELEMENTS_BUFF.map(e => [e + "_Add", "attaqueElementaire"])),
    /* Wind_Element_Rate… : l'augmentation des degats de cet element. */
    Object.fromEntries(ELEMENTS_BUFF.map(e => [e + "_Element_Rate", "bonusElementaire"]))
  );

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
      critDamage:Number(stats.critDamage) || 0,
      bonusGlobal:0,
      bonusElementaire:0,
      bonusCategorie:0
    };

    coches.forEach(buff => {
      const cle = CIBLE_DU_BUFF[buff && buff.stat];
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
