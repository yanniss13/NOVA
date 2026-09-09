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

import { FOLDER_TO_ENUM } from "../noyau/constantes.js";

  /* Le plafond compte les APPUIS, pas les cases : « E x5 » en consomme cinq.
     Soixante identifiants pesent moins de 2 Ko dans le blob de l'equipe. */
  const PLAFOND_ROTATION = 60;

  const MARQUEUR_COMBINE = "@combine:";

  /* Un identifiant du jeu : des segments minuscules separes par des blancs
     soulignes. Le prefixe `@` d'une combinaison ne peut donc pas entrer en
     collision avec lui. */
  const IDENTIFIANT = /^[a-z0-9]+(_[a-z0-9]+)+$/;

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

  function casesDeLaRotation(rotation, heroes, competences){
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

    /* LA RELEVE SE DEDUIT, ELLE NE SE POSE PAS.

       Changer de heros DANS le jeu, c'est relever : la competence de releve du
       heros qui entre joue toute seule. Le membre n'a donc rien a placer, et
       le site n'a rien a stocker — meme regle que le repli « xN », qui est une
       vue et jamais un rangement.

       Aucune releve avant la premiere case : c'est le heros par lequel on
       commence, il est deja la. */
    const releves = relevesDeLEquipe(heroes, competences);
    const suite = [];
    let surLeTerrain = null;
    posees.forEach(item => {
      const entrant = heroDeLaCase(item);
      const releve = entrant ? releves.get(entrant) : null;
      /* Si le membre a POSE la releve lui-meme — une rotation composee avant
         que le site ne la deduise — on n'en ajoute pas une seconde. */
      const dejaPosee = item.competence && releve
        && item.competence.gameId === releve.gameId;
      if(surLeTerrain && entrant && entrant !== surLeTerrain
        && releve && !dejaPosee){
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
    });
    return suite;
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
  normaliserRotation,
  paletteDeLEquipe,
  retirerLaCase,
  retirerUne
};
