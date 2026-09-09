/* Un build du roster -> une simulation DPS. Pur : ni DOM ni reseau.

   Ces quatre fonctions vivaient dans vues/fiche-heros.js, ou elles servaient
   le seul classement des armes. Le comparateur d'enchantements a besoin des
   memes : il simule DEUX fois le meme heros, une fois avec ses enchantements
   actuels et une fois avec ceux qu'il essaie. Les recopier dans la vue du
   calculateur aurait pose deux definitions de « le DPS d'un build », qui
   auraient derive l'une de l'autre au premier correctif.

   La regle du depot veut que la logique pure sorte des vues. C'est ce qui
   permet a comparaison-enchantements.js de ne rien savoir du DOM. */

import { FOLDER_TO_ENUM } from "../noyau/constantes.js";
import { calculateHeroStats } from "./stats-calcul.js";
import { effetsDuBuild } from "./dps-effets.js";
import { CATEGORIE_DPS, simulerDpsCompetences } from "./dps-simulation.js";

  /* Les competences du catalogue rattachees a un build du roster. Le roster
     range ses builds par DOSSIER d'image (« Hache »), la source les publie par
     ENUM (« Axe ») : FOLDER_TO_ENUM fait le pont, et il existait deja. */
  function competencesDuBuild(charId, dossierArme){
    const catalogue = (typeof window !== "undefined"
      && window.SEVEN_DS_COMPETENCES) || {};
    const enumArme = FOLDER_TO_ENUM[dossierArme];
    if(!enumArme) return [];
    return (catalogue[charId] || [])
      .filter(competence => competence.weaponType === enumArme);
  }

  /* Le catalogue d'effets publie aussi des competences SYNTHETIQUES : des
     frappes qu'aucune fiche ne liste, ouvertes par un palier de potentiel. */
  function competencesDpsDuBuild(charId, dossierArme){
    const competences = competencesDuBuild(charId, dossierArme);
    const catalogue = (typeof window !== "undefined"
      && window.SEVEN_DS_EFFETS_DPS) || {};
    const enumArme = FOLDER_TO_ENUM[dossierArme];
    const synthetiques = Object.entries(catalogue.skills || {})
      .filter(([, competence]) => competence.synthetic
        && competence.weaponType === enumArme)
      .map(([gameId, competence]) => Object.assign({ gameId }, competence));
    return competences.concat(synthetiques);
  }

  /* Les entrees du moteur, lues par CODE dans le resultat groupe.
     `calculateBuildStats` n'est pas exportee : `calculateHeroStats` est la
     porte publique. Un statut autre que `valid` ou `partial` ne porte aucun
     chiffre — la ligne est alors absente plutot que fausse. */
  function resultatStatsDeFrappe(hero){
    const result = calculateHeroStats(hero);
    if(!result || (result.status !== "valid" && result.status !== "partial")){
      return null;
    }
    const atk = result.totals.find(total => total.stat === "B_Atk");
    return atk && typeof atk.value === "number" ? result : null;
  }

  /* LES APPORTS DES LIGNES COCHEES, verses dans les statistiques simulees.

     Le simulateur ne connait que le BUILD : ni les soutiens de l'equipe, ni
     les tenues gravees des coequipiers, ni les potentiels d'equipe. Or ce
     sont eux qui reduisent la resistance et la defense critiques du boss —
     les deux seules statistiques qui decident si une ligne de degats
     critiques vaut quelque chose ou rien du tout. Un comparateur aveugle a
     ces lignes classe donc a l'envers pour tout membre qui joue accompagne.

     La fusion est ADDITIVE et ne mute rien : le comparateur simule deux fois
     de suite le meme heros, et une source mutee cumulerait ses apports au
     second passage.

     Les bonus de categorie arrivent dans le vocabulaire du catalogue de
     competences (`ACTIVE_THIRD`), le simulateur les range dans le sien
     (`special`) : la traduction vit dans dps-simulation.js, seul module a
     qui elle appartienne. Une categorie qu'il ne connait pas — la releve,
     qui n'entre pas dans une fenetre en solo — est ignoree plutot que versee
     dans un seau voisin. */
  function statsAvecApports(stats, apports){
    const base = Object.assign({}, stats || {});
    const seaux = Object.assign({}, (stats && stats.bonusCategorie) || {});
    const source = apports || {};

    Object.entries(source.stats || {}).forEach(([cle, valeur]) => {
      const ajout = Number(valeur);
      if(!Number.isFinite(ajout)) return;
      base[cle] = (Number(base[cle]) || 0) + ajout;
    });

    Object.entries(source.bonusParCategorie || {}).forEach(([categorie, valeur]) => {
      const seau = CATEGORIE_DPS[categorie];
      const ajout = Number(valeur);
      if(!seau || !Number.isFinite(ajout)) return;
      seaux[seau] = (Number(seaux[seau]) || 0) + ajout;
    });

    base.bonusCategorie = seaux;
    return base;
  }

  /* La simulation d'un build contre UNE cible.

     Rend null quand le build ne porte aucun chiffre exploitable : un DPS a
     zero se lirait comme « ce build est mauvais » alors qu'il veut dire
     « le catalogue ne sait pas le chiffrer ». La difference compte d'autant
     plus dans un comparateur, ou zero contre zero donnerait un ecart nul et
     rassurant. */
  function simulationDuBuild(entree){
    const source = entree || {};
    const hero = source.hero;
    const dossierArme = source.dossierArme;
    if(!hero || !dossierArme) return null;
    const statsResult = resultatStatsDeFrappe(hero);
    if(!statsResult) return null;
    const competences = competencesDpsDuBuild(hero.char, dossierArme);
    if(!competences.length) return null;
    const catalogue = (typeof window !== "undefined"
      && window.SEVEN_DS_EFFETS_DPS) || {};
    const contexte = effetsDuBuild({
      hero, dossierArme, catalogue, statsResult
    });
    const simulation = simulerDpsCompetences({
      stats:statsAvecApports(contexte.stats, source.apports),
      competences,
      effets:contexte.effets,
      cible:source.cible,
      duree:Number(source.duree) > 0 ? Number(source.duree) : 60,
      animations:source.animations
    });
    /* Un DPS non fini n'annule pas la simulation : la fiche de heros affiche
       encore le cycle d'un build dont aucune competence n'a de recharge
       modelisee. Le champ passe a null, et chaque appelant decide. */
    return {
      dps:Number.isFinite(simulation.dps) ? simulation.dps : null,
      total:simulation.total,
      nonInclus:contexte.nonInclus.concat(simulation.nonInclus),
      hypotheses:simulation.hypotheses,
      animations:simulation.animations,
      ouverture:simulation.ouverture,
      priorites:simulation.priorites,
      rotation:simulation.rotation
    };
  }

/* `statsAvecApports` n'est pas exportee : elle ne sert qu'ici, et le depot
   refuse une sortie que personne n'importe. Les tests l'atteignent par le
   chargeur, qui concatene les modules dans une portee commune. */
export {
  competencesDuBuild,
  resultatStatsDeFrappe,
  simulationDuBuild
};
