/* La rotation d'une equipe : l'ordre dans lequel son auteur joue.

   C'est un outil de COMMUNICATION, pas une entree du simulateur. Il dit
   « voila comment je joue », et rien de plus.

   Module PUR : ni DOM, ni reseau, ni lecture de `window`. Les catalogues
   arrivent par argument — c'est ce qui permet aux tests d'utiliser les vrais
   fichiers de `data/` plutot qu'un faux catalogue, qui ferait voir des bugs
   inexistants et raterait ceux qui existent.

   LA ROTATION EST UNE LISTE PLATE D'APPUIS, un identifiant par appui. Le repli
   en cases « x5 » est une VUE calculee, jamais un stockage : ranger des series
   poserait un invariant — « jamais deux series voisines identiques » — que
   chaque mutation devrait maintenir, et qu'une seule oubliee casserait en
   silence. Une liste plate n'a aucun invariant, elle est toujours valide. */

import { ARMOR_SLOTS, FOLDER_TO_ENUM, JEWEL_SLOTS } from "../noyau/constantes.js";
import { activeGearSets, calculateHeroStats } from "./stats-calcul.js";

  /* Le plafond compte les APPUIS, pas les cases : « E x5 » en consomme cinq.
     Soixante identifiants pesent moins de 2 Ko dans le blob de l'equipe. */
  const PLAFOND_ROTATION = 60;

  const MARQUEUR_COMBINE = "@combine:";

  /* Un identifiant du jeu : des segments minuscules separes par des blancs
     soulignes. Le prefixe `@` d'une combinaison ne peut donc pas entrer en
     collision avec lui. */
  const IDENTIFIANT = /^[a-z0-9]+(_[a-z0-9]+)+$/;

  /* LES CONSTANTES DE LA RELEVE, lues dans `Misc/DefineTable` du jeu et non
     estimees : `tagpoint_gauge` et `tagpoint_maxstack`. */
  const JAUGE_PAR_RELEVE = 1000;
  const RELEVES_CUMULABLES = 3;

  /* LES CONSTANTES DE LA MAGIE, lues dans `Misc/DefineTable` : une boule
     contient 1000 points (`ga_magicforce_gage`) et l'equipe en garde sept
     (`magicforcemaxstack`). */
  const POINTS_PAR_BOULE_MAGIE = 1000;
  const BOULES_MAGIE_MAX = 7;
  const MAGIE_MAX = POINTS_PAR_BOULE_MAGIE * BOULES_MAGIE_MAX;

  /* L'ENSEMBLE « Energie revigorante » — celui dont les pieces s'appellent
     « de l'hymne regenerateur ». A trois pieces, la premiere attaque sur un
     ennemi encore intact rend 2000 points a l'EQUIPE ENTIERE ; sa recharge de
     300 s le limite a un seul declenchement dans une rotation.

     Le palier a deux pieces (+10 % d'efficacite) n'est PAS ici : il arrive
     deja par `calculateHeroStats`, qui agrege les bonus d'ensemble. L'ajouter
     le compterait deux fois.

     Le +15 % d'efficacite pendant 20 s qui accompagne le palier a trois n'est
     pas modelise : une rotation n'a pas d'axe de temps. Comme pour la releve,
     le calcul sous-estime plutot que l'inverse. */
  const ENSEMBLE_ENERGIE_REVIGORANTE = "accessory_t5_hymn";
  const MAGIE_RENDUE_ENERGIE_REVIGORANTE = 2000;

  /* Les participants d'une combinaison, LANCEUR EN TETE. Rend null plutot que
     de deviner : une etape mal formee n'est pas une combinaison approximative,
     c'est une etape a jeter. */
  function etapeCombinee(etape){
    if(typeof etape !== "string" || !etape.startsWith(MARQUEUR_COMBINE)){
      return null;
    }
    const parts = etape.slice(MARQUEUR_COMBINE.length).split(":");
    if(parts.length < 2 || parts.length > 3) return null;
    if(!parts.every(part => IDENTIFIANT.test(part))) return null;
    return { lanceur:parts[0], partenaires:parts.slice(1) };
  }

  function etapeValide(etape){
    if(typeof etape !== "string") return false;
    return etape.startsWith(MARQUEUR_COMBINE)
      ? etapeCombinee(etape) !== null
      : IDENTIFIANT.test(etape);
  }

  /* Ce qui entre dans l'equipe — donc dans Supabase — passe par ici, quelle
     que soit la porte d'entree. */
  function normaliserRotation(brut){
    if(!Array.isArray(brut)) return [];
    return brut.filter(etapeValide).slice(0, PLAFOND_ROTATION);
  }

  /* Les appuis consecutifs identiques, replies en series. `debut` garde
     l'index du premier appui : c'est lui qui rend les mutations possibles sans
     jamais stocker de series. */
  function seriesDeLaRotation(rotation){
    const liste = Array.isArray(rotation) ? rotation : [];
    const series = [];
    liste.forEach((etape, index) => {
      const derniere = series[series.length - 1];
      if(derniere && derniere.etape === etape){
        derniere.fois += 1;
        return;
      }
      series.push({ etape, fois:1, debut:index });
    });
    return series;
  }

  /* L'arme EQUIPEE d'un heros, en enum du site. Le roster range ses builds par
     dossier d'image (« Nunchaku »), la source les publie par enum
     (« Cudgel3c ») : FOLDER_TO_ENUM fait le pont, et il existait deja. */
  function armeEquipee(hero){
    const chemin = hero && typeof hero.weapon === "string" ? hero.weapon : "";
    const dossier = chemin.split("/")[1];
    return (dossier && FOLDER_TO_ENUM[dossier]) || null;
  }

  /* La categorie que le catalogue donne a la competence de releve — celle qui
     joue quand un heros ENTRE sur le terrain. Chaque couple (heros, arme) en a
     exactement une. */
  const CATEGORIE_RELEVE = "TAG_SKILL";

  /* Ce que l'equipe PORTE reellement : chaque heros avec les competences de
     l'arme qu'il a en main, jamais tout son kit. Un heros sans arme ni
     personnage n'a rien a proposer et sort de la liste plutot que d'y figurer
     vide.

     Les passifs sont exclus : on ne les lance pas. */
  function competencesPortees(heroes, competences){
    const liste = Array.isArray(heroes) ? heroes : [];
    const catalogue = competences || {};
    return liste.reduce((portees, hero) => {
      const char = hero && hero.char;
      const arme = armeEquipee(hero);
      if(!char || !arme) return portees;
      const retenues = (catalogue[char] || [])
        .filter(competence => competence.weaponType === arme
          && competence.categorie !== "PASSIVE");
      if(retenues.length) portees.push({ char, arme, competences:retenues });
      return portees;
    }, []);
  }

  /* La palette PROPOSEE au membre. Elle retire la releve de ce qu'on peut
     poser a la main : elle se deduit maintenant du changement de heros, et
     l'offrir en plus ferait poser deux fois la meme chose.

     `competencesPortees` la garde, elle : une rotation composee avant ce
     changement peut en contenir une, et elle doit continuer a se resoudre en
     case normale plutot que de devenir orpheline. */
  function paletteDeLEquipe(heroes, competences){
    return competencesPortees(heroes, competences).reduce((palette, entree) => {
      const retenues = entree.competences
        .filter(competence => competence.categorie !== CATEGORIE_RELEVE);
      if(retenues.length){
        palette.push({ char:entree.char, arme:entree.arme, competences:retenues });
      }
      return palette;
    }, []);
  }

  /* La competence de releve de chaque heros de l'equipe, avec l'arme qu'il
     PORTE — au nunchaku et aux gantelets, Ban n'entre pas de la meme facon. */
  function relevesDeLEquipe(heroes, competences){
    const index = new Map();
    competencesPortees(heroes, competences).forEach(entree => {
      if(index.has(entree.char)) return;
      const releve = entree.competences
        .find(competence => competence.categorie === CATEGORIE_RELEVE);
      if(releve) index.set(entree.char, releve);
    });
    return index;
  }

  /* Les combinaisons que CETTE equipe peut reellement executer.

     Une ligne du catalogue n'est retenue que si TOUTES ses competences —
     lanceur et partenaires — appartiennent a un heros de l'equipe avec son
     arme equipee. C'est ce qui interdit de composer une rotation impossible :
     les combinaisons de Ban sont toutes aux gantelets, donc un Ban au nunchaku
     n'en obtient aucune.

     Le lanceur vient de la TABLE (`Owner_Skill_Tid`), jamais d'un ordre dans
     lequel le membre aurait tape les portraits. */
  function combinaisonsDeLEquipe(heroes, competences, combinaisons){
    const disponibles = new Set();
    competencesPortees(heroes, competences).forEach(entree => {
      entree.competences.forEach(competence => disponibles.add(competence.gameId));
    });
    return (Array.isArray(combinaisons) ? combinaisons : [])
      .filter(entree => entree && disponibles.has(entree.lanceur)
        && Array.isArray(entree.partenaires)
        && entree.partenaires.every(partenaire => disponibles.has(partenaire)))
      .map(entree => ({
        etape:MARQUEUR_COMBINE
          + [entree.lanceur].concat(entree.partenaires).join(":"),
        lanceur:entree.lanceur,
        partenaires:entree.partenaires.slice()
      }));
  }

  /* L'index des competences que l'equipe porte REELLEMENT, du gameId vers son
     heros et sa fiche. C'est lui qui decide si une etape est orpheline. */
  function indexDeLEquipe(heroes, competences){
    const index = new Map();
    competencesPortees(heroes, competences).forEach(entree => {
      entree.competences.forEach(competence => {
        index.set(competence.gameId, { char:entree.char, competence });
      });
    });
    return index;
  }

  /* Les cases affichables : les series, resolues contre l'equipe.

     UNE ETAPE QUE L'EQUIPE NE PORTE PLUS GARDE SA CASE, marquee orpheline. La
     supprimer en silence ferait disparaitre le travail du membre sans qu'il
     comprenne pourquoi — c'est la meme regle que le catalogue de competences,
     ou une competence non chiffrable garde sa ligne au lieu d'etre tue. */
  /* Le heros SUR LE TERRAIN apres une case. Pour une combinaison c'est le
     LANCEUR : les partenaires enchainent depuis leur banc, ils ne prennent pas
     la place. */
  function heroDeLaCase(item){
    if(item.participants && item.participants.length){
      return item.participants[0].char;
    }
    return item.char;
  }

  /* Ce qu'une CASE apporte a la jauge : la valeur de la competence, multipliee
     par la serie. Une combinaison compte pour son lanceur — c'est sa
     competence qui part. */
  function jaugeDeLaCase(item, jauges){
    const identifiant = item.participants && item.participants.length
      ? item.participants[0].gameId
      : item.etape;
    return (Number(jauges[identifiant]) || 0) * (item.fois || 1);
  }

  /* LE LANCEUR d'une case : la competence dont la recharge compte. Pour une
     combinaison, c'est le premier participant — la table du jeu le dit. */
  function lanceurDeLaCase(item){
    return item.participants && item.participants.length
      ? item.participants[0].gameId
      : item.competence && item.competence.gameId || item.etape;
  }

  /* TOUS ceux qui paient. Une combinaison coute la magie de CHACUN de ses
     participants, pas seulement celle du lanceur : chaque heros paie sa
     propre competence. Les 672 lignes du catalogue ont un partenaire qui
     coute des boules, et trente-six d'entre elles en somment huit pour une
     jauge qui en garde sept — celles-la ne partent pas, et le site le dit
     plutot que de les facturer au rabais. */
  function participantsDeLaCase(item){
    return item.participants && item.participants.length
      ? item.participants.map(participant => participant.gameId)
      : [lanceurDeLaCase(item)];
  }

  /* Rejoue chaque APPUI d'une serie, meme si l'ecran la replie en `xN`.
     C'est indispensable pour un ultime : dans une serie de trois, les deux
     premiers peuvent partir et le troisieme manquer de magie. */
  function simulerMagieDesCases(items, reglages){
    const options = reglages || {};
    const catalogue = options.catalogue || {};
    const efficacites = options.efficacites || {};
    const rendueParEnsemble = Math.max(
      0, Number(options.rendueParEnsemble) || 0
    );
    let magie = 0;
    let ensembleDejaRendu = false;
    return (Array.isArray(items) ? items : []).map(item => {
      const regle = catalogue[lanceurDeLaCase(item)] || {};
      const rechargeBrute = Math.max(0, Number(regle.recharge) || 0);
      const cout = participantsDeLaCase(item).reduce((total, identifiant) => {
        const part = catalogue[identifiant] || {};
        return total + Math.max(0, Number(part.cout) || 0);
      }, 0);
      const heros = heroDeLaCase(item);
      const efficacite = efficacites && efficacites[heros] || {};
      const taux = Number(efficacite.taux) || 0;
      const recharge = rechargeBrute * (1 + taux / 10000);
      const avant = magie;
      let valides = 0;
      let impossibles = 0;
      let gaspilles = 0;
      let manque = 0;
      const fois = Math.max(1, Number(item.fois) || 1);

      for(let appui = 0; appui < fois; appui++){
        const prix = cout * POINTS_PAR_BOULE_MAGIE;
        if(prix > magie){
          impossibles += 1;
          manque = Math.max(manque, prix - magie);
          continue;
        }
        magie -= prix;
        valides += 1;
        const avantRecharge = magie;
        magie = Math.min(MAGIE_MAX, magie + recharge);
        gaspilles += Math.max(0, avantRecharge + recharge - MAGIE_MAX);
      }

      /* LES 2000 POINTS DE L'ENSEMBLE ARRIVENT APRES LA PREMIERE CASE : il
         faut avoir frappe pour declencher l'effet. Une rotation qui ouvre sur
         un ultime trop cher reste donc impossible, et c'est la case suivante
         qui en profite. */
      let rendueIci = 0;
      if(rendueParEnsemble > 0 && !ensembleDejaRendu){
        ensembleDejaRendu = true;
        const avantRendu = magie;
        magie = Math.min(MAGIE_MAX, magie + rendueParEnsemble);
        rendueIci = magie - avantRendu;
        gaspilles += Math.max(0, avantRendu + rendueParEnsemble - MAGIE_MAX);
      }

      return Object.assign({}, item, {
        magie:{
          avant,
          apres:magie,
          rendueParEnsemble:rendueIci,
          recharge:recharge * valides,
          cout:cout * valides,
          coutParLancement:cout,
          valides,
          impossibles,
          manque,
          gaspilles,
          bonusTaux:taux,
          bonusConnu:efficacite.connu === true
        }
      });
    });
  }

  function efficacitesRechargeMagie(heroes, calculerStats){
    const calculer = typeof calculerStats === "function"
      ? calculerStats : calculateHeroStats;
    return (Array.isArray(heroes) ? heroes : []).reduce((index, hero) => {
      if(!hero || typeof hero.char !== "string" || !hero.char) return index;
      const resultat = calculer(hero) || {};
      const connu = resultat.status === "valid" || resultat.status === "partial";
      const total = connu && Array.isArray(resultat.totals)
        ? resultat.totals.find(item => item.stat === "MF_ChargeEffic_Rate")
        : null;
      index[hero.char] = {
        taux:total && Number.isFinite(total.value) ? total.value : 0,
        connu
      };
      return index;
    }, {});
  }

  /* Ce que les ENSEMBLES PORTES rendent a la jauge d'equipe, une fois pour la
     rotation entiere. Un seul porteur suffit : l'effet vise « tous les heros
     allies », pas son seul porteur.

     Le seuil de trois pieces n'est pas ecrit ici : il vient de `fourCount`
     dans les donnees du jeu, par `activeGearSets`. Le recopier a la main en
     ferait un second chiffre a maintenir, qui divergerait. */
  function magieRendueParLesEnsembles(heroes){
    const porte = (Array.isArray(heroes) ? heroes : []).some(hero => {
      if(!hero || typeof hero !== "object") return false;
      const pieces = [["armor", ARMOR_SLOTS], ["jewel", JEWEL_SLOTS]]
        .reduce((fichiers, [rangement, emplacements]) => {
          const range = hero[rangement] || {};
          emplacements.forEach(emplacement => {
            if(range[emplacement]) fichiers.push(range[emplacement]);
          });
          return fichiers;
        }, []);
      return activeGearSets(pieces).some(ensemble =>
        ensemble.setId === ENSEMBLE_ENERGIE_REVIGORANTE && ensemble.fourActive);
    });
    return porte ? MAGIE_RENDUE_ENERGIE_REVIGORANTE : 0;
  }

  function casesDeLaRotation(rotation, heroes, competences, jauges, magie){
    const index = indexDeLEquipe(heroes, competences);
    const nomme = gameId => {
      const trouve = index.get(gameId);
      return {
        gameId,
        char:trouve ? trouve.char : null,
        competence:trouve ? trouve.competence : null
      };
    };
    /* `serie` porte le rang de la case dans la ROTATION, et il ne se confond
       pas avec sa position a l'ecran : les releves deduites s'intercalent
       entre elles. Toutes les mutations passent par ce rang-la. */
    const posees = seriesDeLaRotation(rotation).map((serie, rang) => {
      const combinee = etapeCombinee(serie.etape);
      if(combinee){
        const participants = [combinee.lanceur]
          .concat(combinee.partenaires).map(nomme);
        return Object.assign({}, serie, {
          serie:rang,
          competence:null,
          char:null,
          participants,
          orpheline:participants.some(part => !part.competence)
        });
      }
      const trouve = index.get(serie.etape) || null;
      return Object.assign({}, serie, {
        serie:rang,
        competence:trouve ? trouve.competence : null,
        char:trouve ? trouve.char : null,
        participants:[],
        orpheline:!trouve
      });
    });

    /* LA RELEVE SE DEDUIT DE LA JAUGE, PAS DU CHANGEMENT DE HEROS.

       Premiere version : « changer de heros, c'est relever ». Faux, et le
       membre l'a vu sur sa propre rotation — « en jeu j'ai pas assez, elle se
       declenche apres sur Elisabeth ». On PERMUTE quand on veut ; c'est
       l'attaque d'entree qui coute un point de releve.

       Le modele suit donc le jeu : chaque case verse `UI_TagGauge` dans une
       jauge d'EQUIPE — une seule barre, peu importe qui frappe — et chaque
       tranche de 1000 donne un point, trois au plus. Un changement de heros ne
       produit une releve que s'il reste un point a depenser.

       Ce que ce modele NE tient PAS, faute d'axe de temps dans une rotation :
       la regeneration passive (`tagpoint_recovery`, 70 toutes les 1500 ms). Il
       sous-estime donc legerement, jamais l'inverse — une releve affichee est
       une releve qu'on a vraiment.

       Aucune releve avant la premiere case : c'est le heros par lequel on
       commence, il est deja la. */
    const releves = relevesDeLEquipe(heroes, competences);
    const gains = jauges || {};
    const suite = [];
    let surLeTerrain = null;
    let jauge = 0;
    let points = 0;
    posees.forEach(item => {
      const entrant = heroDeLaCase(item);
      const releve = entrant ? releves.get(entrant) : null;
      /* Une releve POSEE a la main — une rotation composee avant que le site
         ne la deduise — tient lieu de releve et depense son point. On ne
         discute pas le geste du membre : il etait devant son ecran. */
      const dejaPosee = item.competence && releve
        && item.competence.gameId === releve.gameId;
      if(dejaPosee){
        points = Math.max(0, points - 1);
      } else if(surLeTerrain && entrant && entrant !== surLeTerrain
        && releve && points >= 1){
        points -= 1;
        suite.push({
          releve:true,
          etape:null,
          serie:null,
          fois:1,
          char:entrant,
          sortant:surLeTerrain,
          competence:releve,
          participants:[],
          orpheline:false
        });
      }
      suite.push(item);
      if(entrant) surLeTerrain = entrant;

      jauge += jaugeDeLaCase(item, gains);
      while(jauge >= JAUGE_PAR_RELEVE && points < RELEVES_CUMULABLES){
        jauge -= JAUGE_PAR_RELEVE;
        points += 1;
      }
      /* A trois points, la barre ne banque plus : elle reste pleine a ras
         bord et le surplus est perdu, comme en jeu. */
      if(points >= RELEVES_CUMULABLES){
        jauge = Math.min(jauge, JAUGE_PAR_RELEVE - 1);
      }
    });
    return magie && magie.catalogue && Object.keys(magie.catalogue).length
      ? simulerMagieDesCases(suite, magie)
      : suite;
  }

  /* LES MUTATIONS portent sur un index de CASE, jamais d'appui : c'est ce que
     le membre voit et touche. Elles rendent toujours un nouveau tableau — une
     rotation mutee sur place echapperait au bouton « Annuler ». */
  function ajouterEtape(rotation, etape){
    const liste = Array.isArray(rotation) ? rotation.slice() : [];
    if(!etapeValide(etape) || liste.length >= PLAFOND_ROTATION) return liste;
    liste.push(etape);
    return liste;
  }

  function serieVisee(rotation, indexDeCase){
    if(!(indexDeCase >= 0)) return null;
    return seriesDeLaRotation(rotation)[indexDeCase] || null;
  }

  function retirerUne(rotation, indexDeCase){
    const liste = Array.isArray(rotation) ? rotation.slice() : [];
    const serie = serieVisee(liste, indexDeCase);
    if(!serie) return liste;
    liste.splice(serie.debut, 1);
    return liste;
  }

  function retirerLaCase(rotation, indexDeCase){
    const liste = Array.isArray(rotation) ? rotation.slice() : [];
    const serie = serieVisee(liste, indexDeCase);
    if(!serie) return liste;
    liste.splice(serie.debut, serie.fois);
    return liste;
  }

  function deplacerCase(rotation, de, vers){
    const liste = Array.isArray(rotation) ? rotation.slice() : [];
    const series = seriesDeLaRotation(liste);
    if(de < 0 || vers < 0 || de >= series.length || vers >= series.length){
      return liste;
    }
    if(de === vers) return liste;
    const bougee = series[de];
    const restantes = series.slice(0, de).concat(series.slice(de + 1));
    restantes.splice(vers, 0, bougee);
    return restantes.reduce(
      (plate, serie) => plate.concat(new Array(serie.fois).fill(serie.etape)),
      []
    );
  }

/* `etapeCombinee` et `seriesDeLaRotation` ne sortent PAS : elles ne servent
   qu'ici, et le depot refuse une sortie que personne n'importe. Les tests les
   atteignent par le chargeur, qui concatene les modules dans une portee
   commune. */
export {
  PLAFOND_ROTATION,
  ajouterEtape,
  casesDeLaRotation,
  combinaisonsDeLEquipe,
  deplacerCase,
  efficacitesRechargeMagie,
  magieRendueParLesEnsembles,
  normaliserRotation,
  paletteDeLEquipe,
  retirerLaCase,
  retirerUne
};
