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

  /* Milieu de l'intervalle 5500-5700 publie. L'incertitude qui en resulte se
     simplifie dans un rapport entre deux builds, ce qui est precisement
     l'usage vise par ce lot. */
  const K = 5600;

  /* Valeurs REELLES relevees sur le boss de confrerie, page
     7dsorigin.app/en/knighthood-boss/demonic-beast-akumu. Jamais inventees.

     La source ne publie qu'un seul bloc de statistiques alors que le boss a
     vingt niveaux de difficulte : la vue doit le dire, et rien ici ne doit
     extrapoler un niveau choisi.

     Les huit resistances elementaires valent 30 % et aucune faiblesse n'est
     publiee : sur Akumu, l'element ne change rien.

     `nom` duplique volontairement BOSS_NAME de js/donnees/boss-store.js : un
     module metier pur n'importe pas depuis js/donnees/. */
  const CIBLE_REFERENCE = {
    nom:"Akumu, bête démoniaque",
    def:3454,
    critResist:2000,
    critDmgResist:5000,
    resistanceElementaire:3000,
    faiblesse:0
  };

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

  function degatsAttendus(entree){
    const source = entree || {};
    const stats = source.stats;
    const competence = source.competence;
    const cible = source.cible;
    if(!stats || !competence || !cible) return null;
    const base = baseDeDegats(stats, competence);
    if(!nombreFini(base) || base <= 0) return null;

    const bonusPublie = ["bonusCategorie", "bonusElementaire", "bonusGlobal"]
      .some(cle => nombreFini(stats[cle]));
    const bonusOffensif = 1 + (bonusPublie
      ? (Number(stats.bonusCategorie) || 0)
        + (Number(stats.bonusElementaire) || 0)
        + (Number(stats.bonusGlobal) || 0)
      : (Number(stats.bonusType) || 0)) / RAPPORT;
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
    const degatsCrit = ((Number(stats.critDamage) || 0)
      - (Number(cible.critDmgResist) || 0)) / RAPPORT;
    const multiplicateurCritique = Math.max(0, 1 + degatsCrit);
    const critique = 1 + taux * (multiplicateurCritique - 1);
    const mitigation = K / (K + (Number(cible.def) || 0));
    const resistance = 1 - (Number(cible.resistanceElementaire) || 0) / RAPPORT;
    const faiblesse = 1 + (Number(cible.faiblesse) || 0) / RAPPORT;

    /* Un SEUL calcul, lu trois fois : le facteur commun porte tout sauf le
       critique, donc le coup sans critique s'obtient sans le retirer, et les
       deux autres colonnes n'en sont que deux ponderations. Trois appels aux
       entrees differentes ouvriraient trois occasions de diverger. */
    const facteurCommun = bonusOffensif * mitigation * resistance * faiblesse;
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
        { id:"bonus-offensif", libelle:"Bonus offensif", valeur:bonusOffensif },
        { id:"critique", libelle:"Critique (espérance)", valeur:critique },
        { id:"mitigation", libelle:"Défense de la cible", valeur:mitigation },
        { id:"resistance", libelle:"Résistance", valeur:resistance },
        { id:"faiblesse", libelle:"Faiblesse", valeur:faiblesse }
      ]
    };
  }

/* `degatsDuCycle` a ete retiree en meme temps que la mesure de cycle : le
   calculateur chiffre chaque competence separement, et le depot refuse une
   sortie que personne n'importe. Elle reste recuperable sur la branche
   comparateur-degats-lot1, avec le simulateur temporel qui l'accompagnait.

   Ne pas commencer une ligne de commentaire par le mot-cle d'un module :
   tests/helpers/load-app.js verifie par expression reguliere qu'aucune
   declaration ne survit a la concatenation, et une prose mal coupee la
   declenche. */
export { CIBLE_REFERENCE, degatsAttendus };
