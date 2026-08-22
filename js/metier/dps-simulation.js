/* Simulation evenementielle pure des competences offensives.

   La fenetre est semi-ouverte : une action ou un tick a exactement 60 s ne
   compte pas dans [0, 60 s[. Les temps deviennent une seule fois des
   millisecondes entieres. Une animation mesuree verrouille le heros apres son
   action ; une animation absente de la table vaut zero, jamais une duree
   supposee. La recherche teste les ordres possibles a chaque instant utile et
   memorise les etats equivalents pour conserver le meilleur total connu. */

import { degatsAttendus } from "./degats-calcul.js";
import { effetsDuBuild } from "./dps-effets.js";

  const CATEGORIE_DPS = {
    NORMAL:"normal",
    NORMAL_SKILL:"normal-skill",
    ACTIVE_THIRD:"special",
    ULTIMATE:"ultimate"
  };
  const TYPES_REGLES = new Set([
    "bonus-stat", "bonus-degats", "bonus-critique",
    "recharge-plate", "recharge-taux", "recharge-periodique",
    "recharge-par-impact", "cumul-degats", "deblocage-sequence",
    "degats-additionnels", "resistance-elementaire",
    "deblocage-competence", "remplacement-competence",
    "duree-periodique"
  ]);

  const enMs = secondes => Math.round(Number(secondes) * 1000);
  const enSecondes = ms => ms / 1000;
  const normaliserCibleDegats = cible => cible === "normal-attack" ? "normal" : cible;
  const animationMsMesuree = (animations, gameId) => {
    const secondes = Number(animations && animations[gameId]);
    return Number.isFinite(secondes) && secondes > 0
      ? Math.max(0, enMs(secondes)) : 0;
  };

  function copierObjet(source){
    return Object.assign({}, source || {});
  }

  function copierEtat(etat){
    return {
      tempsMs:etat.tempsMs,
      recharges:copierObjet(etat.recharges),
      buffs:copierObjet(etat.buffs),
      deblocages:copierObjet(etat.deblocages),
      remplacements:copierObjet(etat.remplacements),
      internes:copierObjet(etat.internes),
      declenchements:copierObjet(etat.declenchements),
      cumuls:Object.fromEntries(
        Object.entries(etat.cumuls).map(([cle, valeur]) => [cle, copierObjet(valeur)])
      ),
      sequences:Object.fromEntries(
        Object.entries(etat.sequences).map(([cle, valeurs]) => [cle, valeurs.slice()])
      ),
      ticks:etat.ticks.map(tick => copierObjet(tick)),
      periodiques:copierObjet(etat.periodiques)
    };
  }

  function reglesAPlats(effets, competences){
    const resultat = [];
    (Array.isArray(effets) ? effets : []).forEach((effet, effetIndex) => {
      const liste = Array.isArray(effet && effet.regles)
        ? effet.regles : [effet];
      liste.filter(Boolean).forEach((regle, index) => {
        const sourceId = regle.sourceId || effet.id || "effet:" + effetIndex;
        resultat.push(Object.assign({}, regle, {
          _cle:sourceId + ":" + regle.type + ":" + index,
          _origine:effet.origine || null,
          _texteFr:effet.texteFr || null,
          _proprietaire:String(sourceId).startsWith("skill:")
            ? String(sourceId).slice(6) : null
        }));
      });
    });
    (Array.isArray(competences) ? competences : [])
      .filter(competence => competence && competence.synthetique)
      .forEach(competence => (competence.regles || []).forEach((regle, index) => {
        resultat.push(Object.assign({}, regle, {
          _cle:(regle.sourceId || "skill:" + competence.gameId)
            + ":" + regle.type + ":synthetic:" + index,
          _origine:"skill",
          _proprietaire:competence.gameId
        }));
      }));
    resultat.forEach(regle => {
      if(!TYPES_REGLES.has(regle.type)){
        throw new Error("REGLE_DPS_INCONNUE:" + regle.type);
      }
    });
    return resultat;
  }

  function ajouterBonus(stats, regle, competence, estTick){
    const valeur = Number(regle.valeur) || 0;
    const categorie = CATEGORIE_DPS[competence.categorie];
    const cible = normaliserCibleDegats(regle.cible);
    if(cible === categorie){
      stats.bonusCategorie += valeur;
    }else if(cible === competence.gameId){
      stats.bonusGlobal += valeur;
    }else if(cible === "element:" + stats.element){
      stats.bonusElementaire += valeur;
    }else if(["all-elements", "any-skill", "global"]
      .includes(cible)){
      stats.bonusGlobal += valeur;
    }else if(cible === "self" && (!regle._proprietaire
      || regle._proprietaire === competence.gameId)){
      stats.bonusGlobal += valeur;
    }else if(cible === "periodic" && estTick){
      stats.bonusGlobal += valeur;
    }
  }

  function contextePourImpact(statsBase, cibleBase, competence, estTick,
    regles, etat){
    const categories = statsBase.bonusCategorie;
    const stats = Object.assign({}, statsBase, {
      bonusCategorie:categories && typeof categories === "object"
        ? Number(categories[CATEGORIE_DPS[competence.categorie]]) || 0
        : Number(categories) || 0,
      bonusElementaire:Number(statsBase.bonusElementaire) || 0,
      bonusGlobal:Number(statsBase.bonusGlobal) || 0
    });
    const cible = copierObjet(cibleBase);
    regles.forEach(regle => {
      if(regle.appliqueStatique) return;
      const permanent = regle._statique === true;
      const propre = regle._proprietaire === competence.gameId
        && !regle.declencheur && !regle.duree;
      const cumulActif = regle.type === "cumul-degats"
        && etat.cumuls[regle._cle]
        && etat.cumuls[regle._cle].expirationMs > etat.tempsMs;
      const actif = permanent || propre || cumulActif
        || (etat.buffs[regle._cle] && etat.buffs[regle._cle] > etat.tempsMs);
      if(!actif) return;
      if(regle.type === "bonus-degats"){
        ajouterBonus(stats, regle, competence, estTick);
      }else if(regle.type === "cumul-degats"){
        const cumul = etat.cumuls[regle._cle];
        const nombre = permanent
          ? Number(regle.cumulsMax) || 0
          : cumul && cumul.expirationMs > etat.tempsMs
            ? Number(cumul.nombre) || 0 : 0;
        ajouterBonus(stats, {
          cible:regle.cible,
          valeur:(Number(regle.valeurParCumul) || 0)
            * nombre,
          _proprietaire:regle._proprietaire
        }, competence, estTick);
      }else if(regle.type === "bonus-critique"){
        if(regle.stat === "critRate") stats.critRate += Number(regle.valeur) || 0;
        else if(regle.stat === "critDamage") stats.critDamage += Number(regle.valeur) || 0;
        else if(regle.stat === "critGuaranteed") stats.critRate = 10000;
        else if(regle.stat === "targetCritResist"){
          cible.critResist = (Number(cible.critResist) || 0)
            + (Number(regle.valeur) || 0);
        }else if(regle.stat === "targetCritDmgResist"){
          cible.critDmgResist = (Number(cible.critDmgResist) || 0)
            + (Number(regle.valeur) || 0);
        }
      }else if(regle.type === "bonus-stat"){
        const taux = (Number(regle.valeur) || 0) / 10000;
        if(regle.stat === "atk") stats.atk *= 1 + taux;
        else if(regle.stat === "def") stats.def *= 1 + taux;
        else if(regle.stat === "maxHp"){
          stats.maxHp *= 1 + taux;
          stats.remainingHp = stats.maxHp;
        }else if(regle.stat === "elementalAttack:" + stats.element){
          stats.attaqueElementaire *= 1 + taux;
        }else if(regle.stat === "targetDefRate"){
          cible.def *= 1 + taux;
        }
      }else if(regle.type === "resistance-elementaire"
        && (regle.element === "all" || !regle.element
          || regle.element === stats.element)){
        cible.resistanceElementaire =
          (Number(cible.resistanceElementaire) || 0)
          + (Number(regle.valeur) || 0);
      }
    });
    stats.critRate = Math.min(10000, Math.max(0, stats.critRate));
    cible.def = Math.max(0, Number(cible.def) || 0);
    return { stats, cible };
  }

  function competenceImmediate(competence){
    const periodique = competence.periodique;
    if(!periodique) return competence;
    const totalPeriodique = (Number(periodique.pourcentageParTick) || 0)
      * (Number(periodique.ticks) || 0);
    const composantes = (competence.composantes || [])
      .map(composante => Object.assign({}, composante, {
        pourcentage:composante.base === periodique.base
          ? Math.max(0, (Number(composante.pourcentage) || 0) - totalPeriodique)
          : composante.pourcentage
      }))
      .filter(composante => composante.pourcentage > 0);
    return Object.assign({}, competence, {
      composantes,
      pourcentage:null,
      repartition:[]
    });
  }

  function competenceTick(competence){
    const periodique = competence.periodique;
    return Object.assign({}, competence, {
      composantes:[{
        base:periodique.base,
        pourcentage:periodique.pourcentageParTick
      }],
      pourcentage:periodique.pourcentageParTick,
      repartition:[periodique.pourcentageParTick],
      periodique:null
    });
  }

  function degatsImpact(statsBase, competence, cible, regles, etat, estTick){
    const contexte = contextePourImpact(
      statsBase, cible, competence, estTick, regles, etat
    );
    const resultat = degatsAttendus({
      stats:contexte.stats,
      competence,
      cible:contexte.cible
    });
    return resultat ? resultat.total : 0;
  }

  function cibleDeRecharge(regle, competencesParId, competence){
    if(regle.cible && regle.cible !== "self") return regle.cible;
    const proprietaire = competencesParId[regle._proprietaire];
    const source = proprietaire || competence;
    return source ? CATEGORIE_DPS[source.categorie] : null;
  }

  function categoriesDeRecharge(regle, competencesParId, competence){
    const cible = cibleDeRecharge(regle, competencesParId, competence);
    return cible === "all-skills"
      ? Object.values(CATEGORIE_DPS)
      : [cible];
  }

  function declenche(regle, competence, typeEvenement){
    const attendu = regle.declencheur;
    const lieAuProprietaire = [
      "skill", "tick", "hit", "critical-hit", "application-statut"
    ].includes(attendu);
    if(regle._proprietaire && lieAuProprietaire
      && regle._proprietaire !== competence.gameId){
      return false;
    }
    if(!attendu){
      return Boolean(regle._proprietaire
        && regle._proprietaire === competence.gameId
        && typeEvenement === "action");
    }
    if(attendu === "tick") return typeEvenement === "tick";
    if(attendu === "hit") return typeEvenement === "action" || typeEvenement === "tick";
    if(attendu === "critical-hit"){
      return typeEvenement === "action" || typeEvenement === "tick";
    }
    if(attendu === "skill") return typeEvenement === "action";
    if(attendu === "ultimate") return CATEGORIE_DPS[competence.categorie] === "ultimate";
    if(attendu === "special" || attendu === "zone"){
      return CATEGORIE_DPS[competence.categorie] === "special";
    }
    if(attendu === "normal-skill"){
      return CATEGORIE_DPS[competence.categorie] === "normal-skill";
    }
    if(attendu === "buff") return competence.gameId === "buff";
    if(attendu === "condition-max") return typeEvenement === "action";
    if(attendu === "statut" || attendu === "application-statut"){
      return typeEvenement === "action";
    }
    return competence.gameId === attendu;
  }

  function reduireRecharge(etat, categorie, secondes){
    if(!categorie || !Object.prototype.hasOwnProperty.call(etat.recharges, categorie)){
      return;
    }
    etat.recharges[categorie] = Math.max(
      etat.tempsMs,
      etat.recharges[categorie] - enMs(secondes)
    );
  }

  function reduireRechargeTaux(etat, categorie, valeur){
    if(!categorie || !Object.prototype.hasOwnProperty.call(etat.recharges, categorie)){
      return;
    }
    const restant = Math.max(0, etat.recharges[categorie] - etat.tempsMs);
    const taux = Math.min(10000, Math.max(0, Number(valeur) || 0));
    etat.recharges[categorie] = etat.tempsMs
      + Math.round(restant * (1 - taux / 10000));
  }

  function rechargeCreeraitBoucle(regle, competencesParId){
    if(regle.type !== "recharge-taux" || Number(regle.valeur) < 10000
      || regle.rechargeInterne || regle.maxDeclenchementsConsecutifs){
      return false;
    }
    const proprietaire = competencesParId[regle._proprietaire];
    const categorieDeclencheur = proprietaire
      ? CATEGORIE_DPS[proprietaire.categorie]
      : ["normal-skill", "special", "ultimate"].includes(regle.declencheur)
        ? regle.declencheur : null;
    if(!categorieDeclencheur) return regle.cible === "self";
    const cibles = categoriesDeRecharge(regle, competencesParId, proprietaire);
    return cibles.includes(categorieDeclencheur);
  }

  /* Une regle rattachee a une categorie que la rotation ne joue jamais ne
     rapporte rien. Sans ce controle, elle restait dans le calcul et n'y
     ajoutait rien EN SILENCE : le meteore invoque par l'ultime du Baton de
     Merlin comptait pour zero alors que son ultime, aux degats non chiffres,
     etait deja ecarte. Dire « non inclus » et afficher zero ne racontent pas
     la meme chose au membre. */
  function declencheurJouable(regle, competencesParId){
    const categorie = regle.declencheur;
    if(!Object.values(CATEGORIE_DPS).includes(categorie)) return true;
    return Object.values(competencesParId).some(competence =>
      CATEGORIE_DPS[competence.categorie] === categorie
    );
  }

  function raisonRegleNonModelisee(regle, competencesParId, stats){
    if(regle._proprietaire && !competencesParId[regle._proprietaire]){
      return "competence-source-non-simulee";
    }
    if(regle.type === "bonus-stat"){
      return ["atk", "def", "maxHp", "targetDefRate",
        "elementalAttack:" + stats.element].includes(regle.stat)
        ? null : "formule-offensive-inconnue";
    }
    if(regle.type === "bonus-degats"){
      const cible = normaliserCibleDegats(regle.cible);
      const cibles = ["normal", "normal-skill", "special", "ultimate", "periodic",
        "all-elements", "any-skill", "global", "self"];
      return cibles.includes(cible) || competencesParId[regle.cible]
        ? null : "categorie-de-degats-hors-perimetre";
    }
    if(regle.type === "bonus-critique"){
      return ["critRate", "critDamage", "critGuaranteed", "targetCritResist",
        "targetCritDmgResist"].includes(regle.stat)
        ? null : "stat-critique-non-modelisee";
    }
    if(regle.type === "recharge-plate"){
      if(regle.mode === "amplification-reduction"){
        return "amplification-de-recharge-sans-effet-source";
      }
      if(regle.declencheur === "condition-max" && !regle.rechargeInterne){
        return "declencheur-externe-non-planifiable";
      }
      return categoriesDeRecharge(regle, competencesParId).some(categorie =>
        Object.values(CATEGORIE_DPS).includes(categorie)
      ) ? null : "recharge-hors-perimetre";
    }
    if(regle.type === "recharge-taux"){
      if(regle.mode === "amplification-reduction"){
        return "amplification-de-recharge-sans-effet-source";
      }
      if(regle.declencheur === "condition-max" && !regle.rechargeInterne){
        return "declencheur-externe-non-planifiable";
      }
      if(regle.cible === "periodic" || String(regle.cible).startsWith("status:")){
        return "periodicite-non-modelisee";
      }
      if(rechargeCreeraitBoucle(regle, competencesParId)){
        return "reinitialisation-sans-animation-bornee";
      }
      return categoriesDeRecharge(regle, competencesParId).some(categorie =>
        Object.values(CATEGORIE_DPS).includes(categorie)
      ) ? null : "recharge-hors-perimetre";
    }
    if(["recharge-periodique", "recharge-par-impact"].includes(regle.type)){
      return categoriesDeRecharge(regle, competencesParId).some(categorie =>
        Object.values(CATEGORIE_DPS).includes(categorie)
      ) ? null : "recharge-hors-perimetre";
    }
    if(regle.type === "cumul-degats") return null;
    if(regle.type === "deblocage-sequence"){
      return competencesParId[regle.competence]
        ? null : "competence-transformee-inconnue";
    }
    if(regle.type === "degats-additionnels"){
      if(regle.declencheur === "expiration-statut"){
        return "expiration-de-statut-non-modelisee";
      }
      if(!regle.ratioDegats && !(Array.isArray(regle.composantes)
        && regle.composantes.length)){
        return "degats-additionnels-non-bornes";
      }
      return declencheurJouable(regle, competencesParId)
        ? null : "declencheur-absent-de-la-rotation";
    }
    if(regle.type === "resistance-elementaire") return null;
    if(regle.type === "deblocage-competence"){
      return regle.competence && competencesParId[regle.competence]
        ? null : "competence-transformee-inconnue";
    }
    if(regle.type === "remplacement-competence"){
      return regle.cible && competencesParId[regle.competence]
        ? null : "competence-transformee-inconnue";
    }
    if(regle.type === "duree-periodique"){
      return regle.cible && Object.values(competencesParId).some(competence =>
        CATEGORIE_DPS[competence.categorie] === regle.cible && competence.periodique
      ) ? null : "periodicite-non-modelisee";
    }
    return "regle-non-modelisee";
  }

  function degatsAdditionnels(regle, dommageSource, statsBase, competence,
    cible, regles, etat){
    if(regle.ratioDegats){
      return dommageSource * (Number(regle.ratioDegats) || 0) / 10000;
    }
    if(!Array.isArray(regle.composantes) || !regle.composantes.length) return 0;
    const multiplicateur = Math.max(
      1,
      Number(regle.applications) || Number(regle.cumulsMax) || 1
    );
    return degatsImpact(
      statsBase,
      Object.assign({}, competence, {
        composantes:regle.composantes.map(composante => Object.assign({}, composante, {
          pourcentage:(Number(composante.pourcentage) || 0) * multiplicateur
        })),
        pourcentage:null,
        repartition:[],
        periodique:null
      }),
      cible,
      regles,
      etat,
      Boolean(regle.periodique)
    );
  }

  function programmerDegatsPeriodiques(etat, regle, competence, dommageSource,
    borne){
    const periodique = regle.periodique;
    const intervalle = enMs(periodique && periodique.intervalle);
    const ticks = Math.max(0, Math.trunc(Number(periodique && periodique.ticks) || 0));
    if(intervalle <= 0 || ticks <= 0) return;
    for(let index = 1; index <= ticks; index += 1){
      const tempsMs = etat.tempsMs + intervalle * index;
      if(tempsMs >= borne) break;
      etat.ticks.push({
        tempsMs,
        gameId:competence.gameId,
        regleCle:regle._cle,
        dommageSource,
        index
      });
    }
  }

  function appliquerRechargeDeclenchee(etat, regle, competence, configuration){
    const disponible = etat.internes[regle._cle] || 0;
    if(disponible > etat.tempsMs) return;
    const maximum = Number(regle.maxDeclenchementsConsecutifs) || 0;
    const compte = Number(etat.declenchements[regle._cle]) || 0;
    if(maximum && compte >= maximum){
      etat.declenchements[regle._cle] = 0;
      return;
    }
    categoriesDeRecharge(
      regle, configuration.competencesParId, competence
    ).forEach(categorie => {
      if(regle.type === "recharge-plate"){
        reduireRecharge(etat, categorie, regle.secondes);
      }else{
        reduireRechargeTaux(etat, categorie, regle.valeur);
      }
    });
    if(maximum) etat.declenchements[regle._cle] = compte + 1;
    if(regle.rechargeInterne){
      etat.internes[regle._cle] = etat.tempsMs + enMs(regle.rechargeInterne);
    }
  }

  function appliquerDeclencheurs(etat, competence, typeEvenement, dommageSource,
    configuration, borne){
    let supplement = 0;
    const traces = [];
    configuration.regles.forEach(regle => {
      if(regle.appliqueStatique) return;
      if(regle.type === "recharge-plate"
        && (regle._proprietaire || regle.declencheur)
        && declenche(regle, competence, typeEvenement)){
        appliquerRechargeDeclenchee(etat, regle, competence, configuration);
      }else if(regle.type === "recharge-taux"
        && regle.application !== "base"
        && regle.declencheur !== "condition-max"
        && declenche(regle, competence, typeEvenement)){
        appliquerRechargeDeclenchee(etat, regle, competence, configuration);
      }else if(regle.type === "recharge-par-impact"
        && declenche(regle, competence, typeEvenement)){
        categoriesDeRecharge(
          regle, configuration.competencesParId, competence
        ).forEach(categorie => reduireRecharge(etat, categorie, regle.secondes));
      }else if(["bonus-degats", "bonus-stat", "bonus-critique",
        "resistance-elementaire"].includes(regle.type)
        && (regle.declencheur || regle._proprietaire) && regle.duree
        && declenche(regle, competence, typeEvenement)){
        etat.buffs[regle._cle] = etat.tempsMs + enMs(regle.duree || 0);
      }else if(regle.type === "cumul-degats"
        && declenche(regle, competence, typeEvenement)){
        const courant = etat.cumuls[regle._cle];
        const nombre = courant && courant.expirationMs > etat.tempsMs
          ? Number(courant.nombre) || 0 : 0;
        etat.cumuls[regle._cle] = {
          nombre:Math.min(Number(regle.cumulsMax) || 0, nombre + 1),
          expirationMs:regle.duree
            ? etat.tempsMs + enMs(regle.duree)
            : Number.MAX_SAFE_INTEGER
        };
      }else if(regle.type === "deblocage-competence"
        && regle.competence
        && declenche(regle, competence, typeEvenement)){
        etat.deblocages[regle.competence] = etat.tempsMs + enMs(regle.duree);
      }else if(regle.type === "remplacement-competence"
        && declenche(regle, competence, typeEvenement)){
        etat.remplacements[regle.cible] = {
          gameId:regle.competence,
          expirationMs:etat.tempsMs + enMs(regle.duree)
        };
      }else if(regle.type === "deblocage-sequence"
        && regle._proprietaire === competence.gameId
        && typeEvenement === "action"){
        const debut = etat.tempsMs - enMs(regle.fenetre);
        const usages = (etat.sequences[regle._cle] || [])
          .filter(temps => temps >= debut);
        usages.push(etat.tempsMs);
        etat.sequences[regle._cle] = usages;
        if(usages.length >= Number(regle.usages)){
          etat.deblocages[regle.competence] = etat.tempsMs + enMs(regle.duree);
        }
      }else if(regle.type === "degats-additionnels"
        && declenche(regle, competence, typeEvenement)){
        const disponible = etat.internes[regle._cle] || 0;
        if(disponible <= etat.tempsMs){
          if(regle.periodique){
            programmerDegatsPeriodiques(
              etat, regle, competence, dommageSource, borne
            );
          }else{
            const dommage = degatsAdditionnels(
              regle,
              dommageSource,
              configuration.stats,
              competence,
              configuration.cible,
              configuration.regles,
              etat
            );
            supplement += dommage;
            if(dommage > 0){
              traces.push({
                type:"effet",
                tempsMs:etat.tempsMs,
                gameId:regle.sourceId || regle._cle,
                nom:"Degats additionnels",
                total:dommage
              });
            }
          }
          if(regle.rechargeInterne){
            etat.internes[regle._cle] = etat.tempsMs
              + enMs(regle.rechargeInterne);
          }
        }
      }
    });
    return { supplement, traces };
  }

  function preparerConfiguration(source, contexte){
    const stats = copierObjet(source.stats || contexte && contexte.stats || {});
    stats.bonusCategorie = copierObjet(stats.bonusCategorie);
    const cible = copierObjet(source.cible);
    /* Les animations mesurees en jeu, en secondes, par gameId. Une competence
       absente de la table vaut zero et non une duree supposee : le jour ou la
       moitie du tableau sera remplie, un chiffre invente serait indiscernable
       d'une mesure. `mesurees` compte ce qui l'est reellement, pour que la vue
       puisse dire a quel point elle est optimiste. */
    const animations = copierObjet(source.animations);
    let competences = (Array.isArray(source.competences)
      ? source.competences : []).filter(Boolean)
      .map(competence => Object.assign({}, competence, {
        composantes:(competence.composantes || []).map(copierObjet),
        periodique:competence.periodique
          ? copierObjet(competence.periodique) : null,
        animationMs:animationMsMesuree(animations, competence.gameId)
      }));
    const competencesParId = Object.fromEntries(
      competences.map(competence => [competence.gameId, competence])
    );
    const effets = Array.isArray(source.effets)
      ? source.effets : contexte && contexte.effets || [];
    const toutesLesRegles = reglesAPlats(effets, competences);
    const nonInclus = [];
    const regles = toutesLesRegles.filter(regle => {
      const raison = raisonRegleNonModelisee(regle, competencesParId, stats);
      if(!raison) return true;
      nonInclus.push({
        id:regle.sourceId || regle._cle,
        texteFr:regle._texteFr,
        type:regle.type,
        raison
      });
      return false;
    });
    regles.filter(regle => regle.type === "duree-periodique")
      .forEach(regle => {
        competences = competences.map(competence => {
          if(CATEGORIE_DPS[competence.categorie] !== regle.cible
            || !competence.periodique) return competence;
          const periodique = copierObjet(competence.periodique);
          periodique.duree += Number(regle.secondes) || 0;
          periodique.intervalle = Math.max(
            0.001,
            periodique.intervalle - (Number(regle.intervalleReduction) || 0)
          );
          periodique.ticks = Math.floor(
            periodique.duree / periodique.intervalle + 1e-9
          );
          return Object.assign({}, competence, { periodique });
        });
      });
    const rechargesPlates = {};
    const rechargesTaux = {};
    regles.forEach(regle => {
      if(regle.appliqueStatique) return;
      if(regle.type === "recharge-plate" && !regle._proprietaire
        && !regle.declencheur){
        categoriesDeRecharge(regle, competencesParId).forEach(categorie => {
          rechargesPlates[categorie] = (rechargesPlates[categorie] || 0)
            + (Number(regle.secondes) || 0);
        });
      }else if(regle.type === "recharge-taux" && regle.application === "base"){
        categoriesDeRecharge(regle, competencesParId).forEach(categorie => {
          rechargesTaux[categorie] = (rechargesTaux[categorie] || 0)
            + (Number(regle.valeur) || 0);
        });
      }else if(["bonus-stat", "bonus-degats", "bonus-critique",
        "cumul-degats", "resistance-elementaire"].includes(regle.type)
        && !regle.declencheur && !regle._proprietaire){
        regle._statique = true;
      }
    });
    const idsCouverture = Array.from(new Set(regles
      .filter(regle => regle.type !== "duree-periodique"
        || competences.some(competence => competence.periodique
          && CATEGORIE_DPS[competence.categorie] === regle.cible))
      .map(regle => regle.sourceId || regle._cle)));
    return {
      stats,
      cible,
      competences,
      competencesParId,
      regles,
      rechargesPlates,
      rechargesTaux,
      nonInclus,
      idsCouverture,
      animations:{
        mesurees:competences.filter(competence => competence.animationMs > 0).length,
        total:competences.length
      }
    };
  }

  function categorieDisponible(etat, categorie){
    return (etat.recharges[categorie] || 0) <= etat.tempsMs;
  }

  function actionsDisponibles(etat, configuration){
    const resultat = [];
    Object.entries(CATEGORIE_DPS).forEach(([categorieSource, categorie]) => {
      if(!categorieDisponible(etat, categorie)) return;
      const remplacement = etat.remplacements[categorie];
      if(remplacement && remplacement.expirationMs > etat.tempsMs){
        const competence = configuration.competencesParId[remplacement.gameId];
        if(competence) resultat.push(competence);
        return;
      }
      const debloquees = Object.entries(etat.deblocages)
        .filter(([, expiration]) => expiration > etat.tempsMs)
        .map(([gameId]) => configuration.competencesParId[gameId])
        .filter(competence => competence && competence.categorie === categorieSource)
        .sort((a, b) => String(a.gameId).localeCompare(String(b.gameId)));
      if(debloquees.length){
        resultat.push(...debloquees);
        return;
      }
      const competence = configuration.competences.find(item =>
        !item.synthetique && item.categorie === categorieSource
      );
      if(competence) resultat.push(competence);
    });
    return resultat.sort((a, b) => String(a.gameId).localeCompare(String(b.gameId)));
  }

  function dureeRecharge(competence, configuration){
    if(enMs(competence.recharge) === 0){
      return Math.max(1, competence.animationMs);
    }
    const categorie = CATEGORIE_DPS[competence.categorie];
    const plate = configuration.rechargesPlates[categorie] || 0;
    const taux = Math.min(9999, configuration.rechargesTaux[categorie] || 0);
    return Math.max(
      1,
      Math.round((enMs(competence.recharge) - enMs(plate)) * (1 - taux / 10000))
    );
  }

  function executerAction(etatSource, competence, configuration, borne){
    const etat = copierEtat(etatSource);
    const categorie = CATEGORIE_DPS[competence.categorie];
    etat.recharges[categorie] = etat.tempsMs
      + dureeRecharge(competence, configuration);
    const immediat = competenceImmediate(competence);
    const dommage = degatsImpact(
      configuration.stats,
      immediat,
      configuration.cible,
      configuration.regles,
      etat,
      false
    );
    const evenement = {
      type:"action",
      tempsMs:etat.tempsMs,
      gameId:competence.gameId,
      competence:competence.gameId,
      nom:competence.nom,
      total:dommage,
      preparation:configuration.regles.some(regle =>
        ["bonus-degats", "deblocage-competence", "remplacement-competence"]
          .includes(regle.type)
        && declenche(regle, competence, "action")
      )
    };
    if(competence.periodique){
      const intervalle = enMs(competence.periodique.intervalle);
      const ticks = Math.max(0, Math.trunc(Number(competence.periodique.ticks) || 0));
      for(let index = 1; index <= ticks; index += 1){
        const tempsMs = etat.tempsMs + intervalle * index;
        if(intervalle <= 0 || tempsMs >= borne) break;
        etat.ticks.push({
          tempsMs,
          gameId:competence.gameId,
          index
        });
      }
    }
    const reaction = appliquerDeclencheurs(
      etat, competence, "action", dommage, configuration, borne
    );
    /* Le verrouillage d'animation vient EN DERNIER : la recharge part du
       lancement, les ticks periodiques aussi, et les declencheurs se resolvent
       a l'instant de la frappe. Seule la disponibilite du heros pour l'action
       suivante recule. Une competence non mesuree avance de zero, et la
       simulation reste alors exactement celle d'avant la collecte. */
    etat.tempsMs += competence.animationMs || 0;
    return {
      etat,
      total:dommage + reaction.supplement,
      evenements:[evenement, ...reaction.traces]
    };
  }

  function traiterEvenementsForces(etat, configuration){
    let total = 0;
    const evenements = [];
    Object.entries(etat.periodiques).forEach(([cle, prochain]) => {
      const regle = configuration.regles.find(item => item._cle === cle);
      if(!regle) return;
      while(prochain <= etat.tempsMs){
        categoriesDeRecharge(regle, configuration.competencesParId)
          .forEach(categorie => {
            if(regle.type === "recharge-periodique"){
              reduireRecharge(etat, categorie, regle.secondes);
            }else if(regle.type === "recharge-taux"){
              reduireRechargeTaux(etat, categorie, regle.valeur);
            }
          });
        prochain += enMs(regle.intervalle);
      }
      etat.periodiques[cle] = prochain;
    });
    const dus = etat.ticks
      .filter(tick => tick.tempsMs <= etat.tempsMs)
      .sort((a, b) => a.tempsMs - b.tempsMs || a.index - b.index);
    etat.ticks = etat.ticks.filter(tick => tick.tempsMs > etat.tempsMs);
    dus.forEach(tick => {
      if(tick.regleCle){
        const regle = configuration.regles.find(item => item._cle === tick.regleCle);
        const competence = configuration.competencesParId[tick.gameId];
        if(!regle || !competence) return;
        const nombreTicks = Math.max(
          1, Number(regle.periodique && regle.periodique.ticks) || 1
        );
        const regleTick = Object.assign({}, regle, {
          periodique:null,
          ratioDegats:regle.periodique && regle.periodique.ratioParTick
            ? regle.periodique.ratioParTick
            : regle.ratioDegats
              ? regle.ratioDegats / nombreTicks : null,
          composantes:(regle.composantes || []).map(composante =>
            Object.assign({}, composante, {
              pourcentage:(Number(composante.pourcentage) || 0) / nombreTicks
            })
          )
        });
        const dommage = degatsAdditionnels(
          regleTick,
          tick.dommageSource,
          configuration.stats,
          competence,
          configuration.cible,
          configuration.regles,
          etat
        );
        total += dommage;
        evenements.push({
          type:"tick",
          tempsMs:etat.tempsMs,
          gameId:regle.sourceId || regle._cle,
          competence:competence.gameId,
          nom:"Degats additionnels",
          total:dommage,
          tick:tick.index
        });
        return;
      }
      const competence = configuration.competencesParId[tick.gameId];
      if(!competence || !competence.periodique) return;
      const dommage = degatsImpact(
        configuration.stats,
        competenceTick(competence),
        configuration.cible,
        configuration.regles,
        etat,
        true
      );
      total += dommage;
      evenements.push({
        type:"tick",
        tempsMs:etat.tempsMs,
        gameId:competence.gameId,
        competence:competence.gameId,
        nom:competence.nom,
        total:dommage,
        tick:tick.index
      });
      const reaction = appliquerDeclencheurs(
        etat, competence, "tick", dommage, configuration, configuration.borne
      );
      total += reaction.supplement;
      evenements.push(...reaction.traces);
    });
    return { total, evenements };
  }

  function prochainInstant(etat, configuration, borne){
    const candidats = [
      ...Object.values(etat.recharges),
      ...etat.ticks.map(tick => tick.tempsMs),
      ...Object.values(etat.periodiques),
      ...Object.values(etat.deblocages),
      ...Object.values(etat.buffs),
      ...Object.values(etat.remplacements).map(item => item.expirationMs)
    ].filter(temps => Number.isFinite(temps)
      && temps > etat.tempsMs && temps < borne);
    return candidats.length ? Math.min(...candidats) : borne;
  }

  function prochaineDisponibiliteHorsNormalePendant(
    etat, normale, configuration, borne
  ){
    const categories = Array.from(new Set(configuration.competences
      .filter(competence => competence.categorie !== "NORMAL")
      .map(competence => CATEGORIE_DPS[competence.categorie])
      .filter(Boolean)));
    if(!categories.length) return null;

    /* La projection avance les evenements deja planifies jusqu'a la fin de
       l'animation. Elle n'execute pas la normale candidate : une reduction
       causee par cette action ne peut pas servir a interdire son propre
       declencheur. Les ticks intermediaires independants ne deviennent une
       barriere que lorsqu'ils rendent vraiment une competence disponible. */
    const fin = Math.min(etat.tempsMs + normale.animationMs, borne);
    const projection = copierEtat(etat);

    while(projection.tempsMs <= fin){
      const recharges = categories
        .map(categorie => projection.recharges[categorie])
        .filter(Number.isFinite);
      const disponible = recharges.length ? Math.min(...recharges) : null;
      if(disponible !== null && disponible <= projection.tempsMs){
        return projection.tempsMs;
      }
      const forces = [
        ...projection.ticks.map(tick => tick.tempsMs),
        ...Object.values(projection.periodiques)
      ].filter(temps => Number.isFinite(temps)
        && temps > projection.tempsMs && temps <= fin);
      const prochainForce = forces.length ? Math.min(...forces) : null;
      if(disponible !== null && disponible <= fin
        && (prochainForce === null || disponible <= prochainForce)){
        return disponible;
      }
      if(prochainForce === null) return null;
      projection.tempsMs = prochainForce;
      traiterEvenementsForces(projection, configuration);
    }
    return null;
  }

  function prochainAlignementUtile(etat, actions, configuration, borne){
    const cibles = [];
    actions.forEach(action => {
      configuration.regles.forEach(regle => {
        if(!regle.duree || !declenche(regle, action, "action")) return;
        let categories = [];
        if(regle.type === "bonus-degats"
          && Object.values(CATEGORIE_DPS).includes(normaliserCibleDegats(regle.cible))){
          categories = [normaliserCibleDegats(regle.cible)];
        }else if(regle.type === "deblocage-competence"){
          const competence = configuration.competencesParId[regle.competence];
          if(competence) categories = [CATEGORIE_DPS[competence.categorie]];
        }else if(regle.type === "remplacement-competence"){
          categories = [regle.cible];
        }
        categories.forEach(categorie => {
          const disponible = etat.recharges[categorie];
          if(disponible > etat.tempsMs
            && etat.tempsMs + enMs(regle.duree) < disponible
            && disponible < borne){
            cibles.push(disponible);
          }
        });
      });
    });
    if(!cibles.length) return null;
    const cible = Math.min(...cibles);
    const forces = [
      ...etat.ticks.map(tick => tick.tempsMs),
      ...Object.values(etat.periodiques)
    ].filter(temps => temps > etat.tempsMs && temps < cible);
    return forces.length ? Math.min(...forces) : cible;
  }

  function cleEtat(etat){
    const ordonner = objet => Object.entries(objet)
      .sort(([a], [b]) => a.localeCompare(b));
    return JSON.stringify({
      t:etat.tempsMs,
      r:ordonner(etat.recharges),
      b:ordonner(etat.buffs),
      d:ordonner(etat.deblocages),
      m:ordonner(etat.remplacements).map(([cle, valeur]) => [
        cle, valeur.gameId, valeur.expirationMs
      ]),
      i:ordonner(etat.internes),
      j:ordonner(etat.declenchements),
      c:ordonner(etat.cumuls).map(([cle, valeur]) => [
        cle, valeur.nombre, valeur.expirationMs
      ]),
      s:ordonner(etat.sequences),
      k:etat.ticks.slice().sort((a, b) =>
        a.tempsMs - b.tempsMs || String(a.gameId).localeCompare(String(b.gameId))
      ),
      p:ordonner(etat.periodiques)
    });
  }

  function choisirMeilleur(a, b){
    if(!a) return b;
    if(!b) return a;
    if(Math.abs(a.total - b.total) > 1e-9) return a.total > b.total ? a : b;
    const actionsA = a.evenements.filter(evenement => evenement.type === "action");
    const actionsB = b.evenements.filter(evenement => evenement.type === "action");
    for(let index = 0; index < Math.min(actionsA.length, actionsB.length); index += 1){
      if(actionsA[index].tempsMs !== actionsB[index].tempsMs){
        return actionsA[index].tempsMs < actionsB[index].tempsMs ? a : b;
      }
      if(Boolean(actionsA[index].preparation) !== Boolean(actionsB[index].preparation)){
        return actionsA[index].preparation ? a : b;
      }
      if(Math.abs(actionsA[index].total - actionsB[index].total) > 1e-9){
        return actionsA[index].total > actionsB[index].total ? a : b;
      }
      const ordre = String(actionsA[index].gameId)
        .localeCompare(String(actionsB[index].gameId));
      if(ordre !== 0) return ordre < 0 ? a : b;
    }
    return actionsA.length >= actionsB.length ? a : b;
  }

  function combiner(prefixe, suite){
    return {
      total:prefixe.total + suite.total,
      evenements:prefixe.evenements.concat(suite.evenements)
    };
  }

  function rechercher(etatSource, configuration, borne, memo){
    const etat = copierEtat(etatSource);
    const forces = traiterEvenementsForces(etat, configuration);
    const cle = cleEtat(etat);
    let futur = memo.get(cle);
    if(!futur){
      futur = { total:0, evenements:[] };
      if(etat.tempsMs < borne){
        let meilleur = null;
        const disponibles = actionsDisponibles(etat, configuration);
        const normales = disponibles.filter(action => action.categorie === "NORMAL");
        const aRecharge = disponibles.filter(action => action.categorie !== "NORMAL");
        const normalesQuiRentrent = normales.filter(action => {
          const prochaineRecharge = prochaineDisponibiliteHorsNormalePendant(
            etat, action, configuration, borne
          );
          return prochaineRecharge === null
            || etat.tempsMs + action.animationMs <= prochaineRecharge;
        });
        const actions = aRecharge.length
          ? aRecharge
          : normalesQuiRentrent;
        actions.forEach(competence => {
          const transition = executerAction(etat, competence, configuration, borne);
          const suite = rechercher(transition.etat, configuration, borne, memo);
          meilleur = choisirMeilleur(
            meilleur,
            combiner({
              total:transition.total,
              evenements:transition.evenements
            }, suite)
          );
        });
        /* Les normales remplissent uniquement les creux. Si elles debordent
           sur le prochain cooldown, `actions` reste vide et `prochain` fait
           avancer l'horloge. Les attentes d'alignement restent reservees aux
           competences a recharge et a leurs effets temporaires. */
        const prochain = prochainInstant(etat, configuration, borne);
        const alignement = aRecharge.length
          ? prochainAlignementUtile(etat, aRecharge, configuration, borne)
          : null;
        const instantAttente = actions.length ? alignement : prochain;
        if(instantAttente !== null && instantAttente < borne){
          const attendu = copierEtat(etat);
          attendu.tempsMs = instantAttente;
          meilleur = choisirMeilleur(
            meilleur,
            rechercher(attendu, configuration, borne, memo)
          );
        }
        futur = meilleur || futur;
      }
      memo.set(cle, futur);
    }
    return combiner(forces, futur);
  }

  function rotationAvecAttentes(evenements){
    const resultat = [];
    let precedent = 0;
    evenements.forEach(evenement => {
      if(evenement.tempsMs > precedent){
        resultat.push({
          type:"attente",
          temps:enSecondes(precedent),
          jusquA:enSecondes(evenement.tempsMs)
        });
      }
      const copie = Object.assign({}, evenement, {
        temps:enSecondes(evenement.tempsMs)
      });
      delete copie.tempsMs;
      delete copie.preparation;
      resultat.push(copie);
      precedent = evenement.tempsMs;
    });
    return resultat;
  }

  function ouvertureDe(rotation){
    const resultat = [];
    const vus = new Set();
    for(const action of rotation.filter(item => item.type === "action")){
      if(vus.has(action.gameId)) break;
      vus.add(action.gameId);
      resultat.push(action);
    }
    return resultat;
  }

  function prioritesDe(rotation, attaqueNormaleIncluse){
    const noms = [];
    rotation.filter(item => item.type === "action").forEach(action => {
      if(!noms.includes(action.nom)) noms.push(action.nom);
    });
    if(!attaqueNormaleIncluse && rotation.some(item => item.type === "attente")){
      noms.push("Attaques normales pendant l'attente");
    }
    return noms;
  }

  function simulerDpsCompetences(entree){
    const source = entree || {};
    const contexte = !source.stats && source.build
      ? effetsDuBuild(source.build)
      : null;
    const borne = enMs(source.duree);
    const nonInclus = contexte ? contexte.nonInclus.slice() : [];
    const animations = copierObjet(source.animations);
    const animationMsDe = competence => animationMsMesuree(
      animations, competence && competence.gameId
    );
    const competences = (Array.isArray(source.competences)
      ? source.competences : []).filter(competence => {
      const categorieValide = Object.prototype.hasOwnProperty.call(
        CATEGORIE_DPS, competence && competence.categorie
      );
      const rechargeMs = enMs(competence && competence.recharge);
      const sansRechargeModelisee = rechargeMs === 0
        && ["NORMAL", "ACTIVE_THIRD"].includes(competence && competence.categorie)
        && animationMsDe(competence) > 0;
      const rechargeValide = rechargeMs > 0 || sansRechargeModelisee;
      const chiffree = (competence && Array.isArray(competence.composantes)
        && competence.composantes.some(composante =>
          Number.isFinite(Number(composante.pourcentage))
          && Number(composante.pourcentage) > 0
        )) || (competence && Number.isFinite(Number(competence.pourcentage))
          && Number(competence.pourcentage) > 0);
      if(!categorieValide || !rechargeValide || !chiffree){
        nonInclus.push({
          id:competence && competence.gameId,
          nom:competence && competence.nom,
          raison:competence && competence.categorie === "TAG_SKILL"
            ? "releve-hors-simulation-equipe"
            : !chiffree
              ? "degats-non-chiffres"
              : "categorie-ou-recharge-non-modelisee"
        });
      }
      return categorieValide && rechargeValide && chiffree;
    });
    const configuration = preparerConfiguration(
      Object.assign({}, source, { competences }), contexte
    );
    configuration.borne = borne;
    nonInclus.push(...configuration.nonInclus);
    if(!(borne > 0)){
      return {
        total:0, dps:0, duree:0, rotation:[], ouverture:[], priorites:[],
        nonInclus, hypotheses:[],
        animations:configuration.animations, couverture:[]
      };
    }
    const attaqueNormaleIncluse = configuration.competences.some(competence =>
      competence.categorie === "NORMAL"
    );
    if(!configuration.competences.length){
      return {
        total:null, dps:null, duree:borne / 1000,
        rotation:[], ouverture:[], priorites:[],
        nonInclus, hypotheses:[
          ...(contexte ? contexte.hypotheses : []),
          "ressources-illimitees",
          "animations-non-mesurees",
          ...(!attaqueNormaleIncluse
            ? ["attaques-normales-non-chiffrees"] : [])
        ],
        animations:configuration.animations,
        couverture:[]
      };
    }
    const etat = {
      tempsMs:0,
      recharges:{ normal:0, "normal-skill":0, special:0, ultimate:0 },
      buffs:{},
      deblocages:{},
      remplacements:{},
      internes:{},
      declenchements:{},
      cumuls:{},
      sequences:{},
      ticks:[],
      periodiques:{}
    };
    configuration.regles
      .filter(regle => regle.type === "recharge-periodique")
      .forEach(regle => {
        const intervalle = enMs(regle.intervalle);
        if(intervalle > 0) etat.periodiques[regle._cle] = intervalle;
      });
    configuration.regles
      .filter(regle => regle.type === "recharge-taux"
        && regle.declencheur === "condition-max" && regle.rechargeInterne)
      .forEach(regle => {
        regle.intervalle = regle.rechargeInterne;
        etat.periodiques[regle._cle] = 0;
      });
    const recherche = rechercher(etat, configuration, borne, new Map());
    const rotation = rotationAvecAttentes(recherche.evenements);
    return {
      total:recherche.total,
      dps:recherche.total / (borne / 1000),
      duree:borne / 1000,
      rotation,
      ouverture:ouvertureDe(rotation),
      priorites:prioritesDe(rotation, attaqueNormaleIncluse),
      nonInclus,
      hypotheses:[
        ...(contexte ? contexte.hypotheses : []),
        "ressources-illimitees",
        ...(configuration.animations.mesurees < configuration.animations.total
          ? ["animations-non-mesurees"] : []),
        ...(!attaqueNormaleIncluse
          ? ["attaques-normales-non-chiffrees"]
          : ["attaques-normales-remplissage"])
      ],
      animations:configuration.animations,
      couverture:configuration.idsCouverture
    };
  }

export { simulerDpsCompetences };
