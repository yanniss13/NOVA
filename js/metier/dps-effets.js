/* Selection des effets offensifs qui appartiennent reellement au build.

   Le catalogue contient tous les niveaux possibles. Cette couche pure le
   reduit au personnage, a l'arme, au potentiel et aux niveaux effectivement
   renseignes dans la fiche. Les conditions personnelles sont lues dans leur
   etat maximal demande par le comparateur ; les interactions des competences
   restent toutefois temporelles et seront deroulees par le simulateur. */

import {
  BUILD_STATS,
  FOLDER_TO_ENUM,
  metaOf
} from "../noyau/constantes.js";

  const STAT_DPS = {
    atk:"B_Atk",
    def:"B_Def",
    maxHp:"B_MaxHp",
    critRate:"C_Critical_Rate",
    critDamage:"C_Critical_Dam_Rate"
  };
  const BONUS_CATEGORIE = {
    "normal-skill":"Normalskill_Damadd_Rate",
    special:"Activethird_Damadd_Rate",
    ultimate:"Ultimateskill_Damadd_Rate"
  };
  const SET_THRESHOLDS = {
    two:"twoCount",
    four:"fourCount",
    seven:"sevenCount"
  };

  function valeurTotale(totaux, stat){
    const ligne = (Array.isArray(totaux) ? totaux : [])
      .find(item => item && item.stat === stat);
    return ligne && Number.isFinite(Number(ligne.value))
      ? Number(ligne.value)
      : 0;
  }

  function definitionEquipement(file){
    return (BUILD_STATS.gearByFile || {})[file]
      || (BUILD_STATS.engravedByFile || {})[file]
      || null;
  }

  function entreeParSlug(collection, slug){
    if(!slug) return null;
    return Object.values(collection || {}).find(item => item && item.slug === slug)
      || null;
  }

  function typeArmeActif(hero, dossierArme){
    if(FOLDER_TO_ENUM[dossierArme]) return FOLDER_TO_ENUM[dossierArme];
    const chemin = String(hero && hero.weapon || "");
    const dossier = Object.keys(FOLDER_TO_ENUM).find(
      nom => chemin.indexOf("/" + nom + "/") >= 0
    );
    return dossier ? FOLDER_TO_ENUM[dossier] : null;
  }

  function elementActif(hero, typeArme){
    const meta = metaOf(hero && hero.char);
    const slot = meta && Array.isArray(meta.weapons)
      ? meta.weapons.find(item => item.weapon === typeArme)
      : null;
    return slot && slot.element ? String(slot.element).toLowerCase() : "default";
  }

  function tousLesFichiers(hero){
    return [
      ...Object.values(hero && hero.armor || {}),
      ...Object.values(hero && hero.jewel || {})
    ].filter(Boolean);
  }

  function statsDeBase(statsResult, element){
    const totaux = statsResult && statsResult.totals;
    const prefixe = element.charAt(0).toUpperCase() + element.slice(1);
    const elementAdd = valeurTotale(totaux, prefixe + "_Add");
    const elementRate = valeurTotale(totaux, prefixe + "_Rate");
    const stats = {};
    Object.entries(STAT_DPS).forEach(([cle, stat]) => {
      stats[cle] = valeurTotale(totaux, stat);
    });
    stats.element = element;
    stats.attaqueElementaire = elementAdd * (1 + elementRate / 10000);
    stats.bonusCategorie = {};
    Object.entries(BONUS_CATEGORIE).forEach(([cle, stat]) => {
      stats.bonusCategorie[cle] = valeurTotale(totaux, stat);
    });
    stats.bonusElementaire = valeurTotale(
      totaux, prefixe + "_Element_Rate"
    );
    stats.bonusGlobal = valeurTotale(totaux, "AllElement_Rate");
    stats.remainingHp = stats.maxHp;
    return stats;
  }

  function appliquerReglesStatiques(stats, effets){
    const tauxStats = { atk:0, def:0, maxHp:0, attaqueElementaire:0 };
    effets.forEach(effet => {
      if(effet.origine === "skill") return;
      effet.regles = effet.regles.map(regle => {
        let appliqueStatique = true;
        if(regle.type === "bonus-stat"){
          if(Object.prototype.hasOwnProperty.call(tauxStats, regle.stat)){
            tauxStats[regle.stat] += Number(regle.valeur) || 0;
          }else if(regle.stat === "elementalAttack:" + stats.element){
            tauxStats.attaqueElementaire += Number(regle.valeur) || 0;
          }else{
            appliqueStatique = false;
          }
        }else if(regle.type === "bonus-critique"){
          if(regle.stat === "critRate"){
            stats.critRate += Number(regle.valeur) || 0;
          }else if(regle.stat === "critDamage"){
            stats.critDamage += Number(regle.valeur) || 0;
          }else if(regle.stat === "critGuaranteed"){
            stats.critRate = 10000;
          }else{
            appliqueStatique = false;
          }
        }else if(regle.type === "bonus-degats"){
          const cible = regle.cible;
          const valeur = Number(regle.valeur) || 0;
          if(Object.prototype.hasOwnProperty.call(stats.bonusCategorie, cible)){
            stats.bonusCategorie[cible] += valeur;
          }else if(cible === "element:" + stats.element){
            stats.bonusElementaire += valeur;
          }else if(["all-elements", "any-skill", "global", "self"]
            .includes(cible)){
            stats.bonusGlobal += valeur;
          }else{
            appliqueStatique = false;
          }
        }else{
          appliqueStatique = false;
        }
        return appliqueStatique
          ? Object.assign({}, regle, { appliqueStatique:true })
          : regle;
      });
    });
    Object.entries(tauxStats).forEach(([stat, taux]) => {
      stats[stat] *= 1 + taux / 10000;
    });
    stats.critRate = Math.min(10000, Math.max(0, stats.critRate));
  }

  function effetsDuBuild({ hero, dossierArme, catalogue, statsResult }){
    const sourceHero = hero || {};
    const sourceCatalogue = catalogue || {};
    const typeArme = typeArmeActif(sourceHero, dossierArme);
    const element = elementActif(sourceHero, typeArme);
    const effets = [];
    const nonInclus = [];
    const couverture = [];

    function retenir(source, meta){
      if(!source) return;
      const entree = Object.assign({}, source, meta || {}, {
        regles:(source.regles || []).map(regle => Object.assign({}, regle))
      });
      couverture.push({
        id:entree.id,
        classification:entree.classification
      });
      if(entree.classification === "modelise") effets.push(entree);
      else if(entree.classification === "non-inclus") nonInclus.push(entree);
    }

    const branche = sourceCatalogue.heroes
      && sourceCatalogue.heroes[sourceHero.char]
      && sourceCatalogue.heroes[sourceHero.char][typeArme];
    const potentiel = Math.max(
      0, Math.trunc(Number(sourceHero.potentiel && sourceHero.potentiel.tier) || 0)
    );
    if(branche){
      Object.entries(branche.potentials || {})
        .map(([tier, source]) => ({ tier:Number(tier), source }))
        .filter(item => item.tier <= potentiel)
        .sort((a, b) => a.tier - b.tier)
        .forEach(item => retenir(item.source, {
          origine:"potential", tier:item.tier
        }));
      Object.values(branche.passives || {}).forEach(source => retenir(source, {
        origine:"hero-passive"
      }));
    }

    Object.values(sourceCatalogue.skills || {})
      .filter(source => source.hero === sourceHero.char
        && source.weaponType === typeArme)
      .forEach(source => retenir(source, { origine:"skill" }));

    const facts = statsResult && statsResult.facts
      && Array.isArray(statsResult.facts.passives)
      ? statsResult.facts.passives
      : [];
    const weaponFact = facts.find(fact => fact.source === "weapon:passive");
    const weaponDefinition = (BUILD_STATS.weaponsByFile || {})[sourceHero.weapon];
    const weaponEntry = weaponDefinition
      && sourceCatalogue.weapons
      && sourceCatalogue.weapons[weaponDefinition.slug];
    if(weaponEntry && weaponEntry.levels && weaponFact
      && weaponFact.status === "valid"){
      retenir(weaponEntry.levels[String(weaponFact.level)], {
        origine:"weapon", level:weaponFact.level, slot:"weapon"
      });
    }else if(weaponEntry && weaponEntry.levels){
      nonInclus.push({
        id:"weapon:passive:weapon",
        origine:"weapon",
        slot:"weapon",
        raison:"niveau-de-passif-"
          + (weaponFact && weaponFact.status || "missing")
      });
    }

    facts.filter(fact => fact.source === "armor:passive"
      || fact.source === "engraving:passive")
      .forEach(fact => {
        if(fact.status !== "valid"){
          nonInclus.push({
            id:fact.source + ":" + fact.slot,
            origine:"gear",
            slot:fact.slot,
            raison:"niveau-de-passif-" + fact.status
          });
          return;
        }
        const definition = definitionEquipement(fact.file);
        const famille = fact.source === "engraving:passive"
          ? "engravings" : "armors";
        const gearEntry = definition && sourceCatalogue.gear
          ? entreeParSlug(sourceCatalogue.gear[famille], definition.slug)
          : null;
        Object.values(gearEntry && gearEntry.passives || {}).forEach(niveaux => {
          retenir(niveaux[String(fact.level)], {
            origine:"gear", slot:fact.slot, level:fact.level
          });
        });
      });

    const compteSets = {};
    tousLesFichiers(sourceHero).forEach(file => {
      const definition = definitionEquipement(file);
      if(definition && definition.setId){
        compteSets[definition.setId] = (compteSets[definition.setId] || 0) + 1;
      }
    });
    Object.entries(compteSets).forEach(([setId, count]) => {
      const definition = (BUILD_STATS.gearSets || {})[setId];
      const entree = sourceCatalogue.sets && sourceCatalogue.sets[setId];
      Object.entries(SET_THRESHOLDS).forEach(([threshold, countKey]) => {
        const requis = definition && definition[countKey];
        if(Number.isFinite(requis) && count >= requis){
          retenir(entree && entree.bonuses && entree.bonuses[threshold], {
            origine:"set", setId, threshold, count
          });
        }
      });
    });

    const stats = statsDeBase(statsResult, element);
    appliquerReglesStatiques(stats, effets);
    return {
      stats,
      effets,
      nonInclus,
      hypotheses:[
        "passifs-personnels-actifs-au-maximum",
        "cumuls-personnels-au-maximum",
        "pv-restants-egaux-aux-pv-max"
      ],
      couverture
    };
  }

export { effetsDuBuild };
