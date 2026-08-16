/* Ce que la confrerie apporte a un combat, et qui le possede.

   Module PUR : ni DOM, ni reseau, ni Supabase. La vue lui passe les membres
   deja agreges par rosterPlayerFrom() ; il rend des lignes pretes a afficher.

   DEUX RECENSEMENTS, UNE SEULE FORME DE LIGNE. Ce qui affaiblit la cible et ce
   qui renforce les allies sont deux questions differentes pour le membre qui
   compose, mais le meme travail pour le code : lire une table ecrite a la
   main, en tirer un libelle, une arme ou une tenue, puis croiser avec les
   rosters. La vue filtre sur `vise` ; le metier ne connait qu'une forme.

   LE CRITERE EST L'EFFET, JAMAIS LE ROLE. Escanor porte son malus de defense
   avec une Epee a deux mains de role Attaquant, King avec un Grimoire de role
   Gardien : un filtre par role les manquerait tous les deux, et ce sont eux
   qu'on veut voir.

   DEUX SOURCES, DEUX REGLES DE POSSESSION :

     "arme"   la ligne vit sur une competence. Un membre l'apporte s'il a le
              personnage ET cette arme dans ses builds.
     "tenue"  la ligne vit sur le passif d'une armure gravee. Un membre
              l'apporte si un de ses builds EQUIPE ce fichier - et son niveau
              de passif compte, parce que la valeur en depend du simple au
              tiers pres.

   CE QUI RESTE DEHORS : les passifs graves de cible « soi ». Ils ne profitent
   qu'a celui qui porte la tenue, donc ils ne disent rien de ce que le membre
   apporte au groupe. Les recenser gonflerait les deux sections de vingt-neuf
   lignes qui ne repondent a aucune des deux questions. */

import {
  buildGearDefinition,
  gearPassiveStatus
} from "./build-config.js";
import {
  ENUM_TO_FOLDER,
  LINKED_ARMOR_SLOT,
  LINKED_ARMORS
} from "../noyau/constantes.js";
import { owns } from "../noyau/outils.js";
import { armeDuGameId } from "./equipe-buffs.js";

  /* Chargees A LA DEMANDE par la vue, comme les competences et les potentiels
     d'equipe : les lire par window plutot que par import evite de les faire
     payer aux visiteurs qui n'ouvrent jamais l'Analyse. */
  function tableDesBuffs(){
    return window.SEVEN_DS_BUFFS_SUPPORTS || {};
  }
  function tableDesPassifs(){
    return window.SEVEN_DS_PASSIFS_GRAVES || {};
  }

  /* Le personnage d'une tenue gravee, deduit de la table des armures liees.

     On ne le lit PAS dans l'identifiant de la ligne, meme s'il y figure en
     tete (`howzer-aventure-securite-defense-crit`) : un identifiant est un
     nom, pas une donnee, et il suffirait d'une ligne mal baptisee pour
     attribuer une tenue au mauvais heros. La table des armures liees, elle,
     est generee. */
  function herosDeLaTenue(fichier){
    return Object.keys(LINKED_ARMORS).find(
      charId => (LINKED_ARMORS[charId] || []).includes(fichier)
    ) || null;
  }

  /* Le nom lisible d'une tenue : son fichier, sans dossier ni extension. */
  function nomDeLaTenue(fichier){
    const feuille = String(fichier || "").split("/").pop() || "";
    return feuille.replace(/\.webp$/i, "");
  }

  /* Une ligne d'ARME. `cible:"ennemi"` marque un malus inflige a la cible ;
     tout le reste est un bonus rendu aux allies - la table n'accueille que ce
     qui atteint l'equipe, les bonus qui ne profitent qu'a leur porteur en ont
     ete ecartes a la transcription. */
  function lignesDArmes(){
    const catalogue = tableDesBuffs();
    return Object.keys(catalogue).sort().flatMap(support =>
      (catalogue[support] || []).map(ligne => {
        const arme = armeDuGameId((ligne.provenance || {}).gameId);
        return {
          id:ligne.id,
          support,
          libelle:ligne.libelle,
          element:ligne.element || null,
          horsCalcul:Boolean(ligne.horsCalcul),
          vise:ligne.cible === "ennemi" ? "ennemi" : "allies",
          source:"arme",
          arme,
          /* Le roster range ses builds par DOSSIER francais ; l'enum est ce
             que le gameId ecrit. Les deux voyagent, parce que la vue affiche
             l'un et interroge le roster avec l'autre. */
          armeDossier:arme ? ENUM_TO_FOLDER[arme] || null : null,
          tenue:null,
          tenueNom:null
        };
      })
    );
  }

  /* Une ligne de TENUE GRAVEE.

     `cibleEnnemi` et `cible` ne disent pas la meme chose : le premier dit OU
     l'effet se pose, le second QUI en profite. Une ligne qui frappe l'ennemi
     rejoint donc l'affaiblissement, et une ligne de cible « soi » sort du
     recensement meme si elle frappe l'ennemi - c'est le cas, unique, de
     « Chevalier sacre prometteur », dont la source restreint l'effet aux
     degats du porteur. */
  function lignesDeTenues(){
    const catalogue = tableDesPassifs();
    return Object.keys(catalogue).sort().flatMap(tenue =>
      (catalogue[tenue] || [])
        .filter(passif => passif.cible === "allies")
        .map(passif => ({
          id:passif.id,
          support:herosDeLaTenue(tenue),
          libelle:passif.libelle,
          element:passif.element || null,
          horsCalcul:Boolean(passif.horsCalcul),
          vise:passif.cibleEnnemi ? "ennemi" : "allies",
          source:"tenue",
          arme:null,
          armeDossier:null,
          tenue,
          tenueNom:nomDeLaTenue(tenue)
        }))
    );
  }

  /* Les deux sources reunies. Les armes d'abord, les tenues ensuite : a
     l'ecran, le membre lit ce qui vient des competences avant ce qui vient de
     l'equipement, comme dans le calculateur. */
  function lignesDeSoutien(){
    return lignesDArmes().concat(lignesDeTenues());
  }

  /* Le niveau du passif grave declare dans un build, ou null.

     On passe par gearPassiveStatus() plutot que de lire `passiveLevel` a la
     main : c'est le juge qu'emploie deja le calculateur, et les deux doivent
     s'accorder sur ce que « renseigne » veut dire. Un niveau absent n'est pas
     une erreur - c'est un champ que le membre n'a pas rempli, et la vue le
     dira plutot que de supposer le maximum. */
  function niveauDuPassif(build){
    const tenue = build && build.armor ? build.armor[LINKED_ARMOR_SLOT] : null;
    if(!tenue) return null;
    const config = build.armorConfig
      ? build.armorConfig[LINKED_ARMOR_SLOT] : null;
    return gearPassiveStatus(buildGearDefinition(tenue), config) === "valid"
      ? config.passiveLevel
      : null;
  }

  /* Les builds d'une entree de roster, dans un ordre stable. */
  function buildsDe(entree){
    const builds = entree && entree.builds;
    if(!builds) return [];
    return Object.keys(builds).sort().map(dossier => builds[dossier]);
  }

  /* Un membre porte-t-il CETTE ligne, et a quel niveau ?

     Rend `null` s'il ne la porte pas, sinon `{ potentiel, niveau }`. Le niveau
     ne vaut que pour une tenue ; une ligne d'arme rend toujours null, et la
     vue n'affiche alors rien plutot qu'un « niveau 1 » invente. */
  function portePar(ligne, entree){
    if(!entree) return null;
    if(ligne.source === "arme"){
      if(entree.charId !== ligne.support) return null;
      if(!owns(entree.builds, ligne.armeDossier)) return null;
      return { potentiel:entree.potentialTier || 0, niveau:null };
    }
    /* Une tenue est propre a un personnage, mais on ne le verifie pas : c'est
       le BUILD qui l'equipe qui fait foi. Passer par le personnage ajouterait
       une occasion de se tromper sans rien prouver de plus. */
    const equipes = buildsDe(entree).filter(build =>
      build && build.armor && build.armor[LINKED_ARMOR_SLOT] === ligne.tenue
    );
    if(!equipes.length) return null;
    /* Plusieurs builds peuvent porter la meme tenue a des niveaux differents :
       on retient le MEILLEUR, celui que le membre peut effectivement amener. */
    const niveaux = equipes.map(niveauDuPassif).filter(n => n !== null);
    return {
      potentiel:entree.potentialTier || 0,
      niveau:niveaux.length ? Math.max(...niveaux) : null
    };
  }

  /* Les membres qui portent CETTE ligne.

     Posseder Escanor ne suffit pas - son malus vit sur l'Epee a deux mains, et
     un membre qui ne joue que sa Hache ne l'apporte pas au groupe. Une ligne
     dont l'arme ou la tenue est illisible ne trouve PERSONNE plutot que tout
     le monde : une ligne grise a tort se corrige en la regardant, un membre
     annonce a tort envoie composer une equipe qui n'existe pas. */
  function porteursDeLaLigne(ligne, joueurs){
    if(!ligne) return [];
    if(ligne.source === "arme" && !ligne.armeDossier) return [];
    if(ligne.source === "tenue" && !ligne.tenue) return [];
    const membres = Array.isArray(joueurs) ? joueurs : [];
    return membres
      .flatMap(joueur => (joueur.characters || [])
        .map(entree => {
          const port = portePar(ligne, entree);
          return port ? Object.assign({
            owner:joueur.owner, nom:joueur.name
          }, port) : null;
        })
        .filter(Boolean))
      .sort((a, b) => b.potentiel - a.potentiel);
  }

export { lignesDeSoutien, porteursDeLaLigne };
