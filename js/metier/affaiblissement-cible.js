/* Qui peut affaiblir la cible, et qui dans la confrerie le possede.

   Module PUR : ni DOM, ni reseau, ni Supabase. La vue lui passe les membres
   deja agreges par rosterPlayerFrom() ; il rend des lignes pretes a afficher.

   LE CRITERE EST L'EFFET, JAMAIS LE ROLE. Le recensement des DPS repond "qui
   frappe" ; celui-ci repond "qui fait encaisser". Escanor porte son malus de
   defense avec une Epee a deux mains de role Attaquant, King avec un Grimoire
   de role Gardien : un filtre par role les manquerait tous les deux, et ce
   sont eux qu'on veut voir.

   La table dit ce qu'un personnage FAIT ; le roster dit qui le possede. Ce
   module ne fait que les croiser, et n'invente aucune des deux moities. */

import { ENUM_TO_FOLDER } from "../noyau/constantes.js";
import { owns } from "../noyau/outils.js";
import { armeDuGameId } from "./equipe-buffs.js";

  /* Chargee A LA DEMANDE par la vue, comme les competences et les potentiels
     d'equipe : la lire par window plutot que par import evite de la faire
     payer aux visiteurs qui n'ouvrent jamais l'Analyse. */
  function tableDesBuffs(){
    return window.SEVEN_DS_BUFFS_SUPPORTS || {};
  }

  /* Une ligne d'affaiblissement, c'est une entree qui vise l'ENNEMI. Les
     bonus poses sur le heros (`stat`) restent au calculateur : ils ne disent
     rien de ce que la cible encaisse.

     Les lignes CONSIGNEES en font partie, drapeau compris. C'est tout leur
     objet : elles servent a composer un groupe, et la vue dira qu'elles ne
     comptent pas dans les degats. */
  function lignesDAffaiblissement(){
    const catalogue = tableDesBuffs();
    return Object.keys(catalogue).sort().flatMap(support =>
      (catalogue[support] || [])
        .filter(ligne => ligne.cible === "ennemi")
        .map(ligne => {
          const arme = armeDuGameId((ligne.provenance || {}).gameId);
          return {
            id:ligne.id,
            support,
            libelle:ligne.libelle,
            effet:ligne.effet,
            valeur:ligne.valeur,
            element:ligne.element || null,
            horsCalcul:Boolean(ligne.horsCalcul),
            arme,
            /* Le roster range ses builds par DOSSIER francais ; l'enum est ce
               que le gameId ecrit. Les deux voyagent, parce que la vue affiche
               l'un et interroge le roster avec l'autre. */
            armeDossier:arme ? ENUM_TO_FOLDER[arme] || null : null
          };
        })
    );
  }

  /* Les membres qui portent CETTE ligne : le personnage ET l'arme qui la
     porte. Posseder Escanor ne suffit pas - son malus vit sur l'Epee a deux
     mains, et un membre qui ne joue que sa Hache ne l'apporte pas au groupe.

     Une ligne dont l'arme est illisible ne trouve PERSONNE plutot que tout le
     monde : une ligne grise a tort se corrige en la regardant, un membre
     annonce a tort envoie composer une equipe qui n'existe pas. */
  function porteursDeLaLigne(ligne, joueurs){
    const dossier = ligne && ligne.armeDossier;
    if(!dossier) return [];
    const membres = Array.isArray(joueurs) ? joueurs : [];
    return membres
      .flatMap(joueur => (joueur.characters || [])
        .filter(entree => entree
          && entree.charId === ligne.support
          && owns(entree.builds, dossier))
        .map(entree => ({
          owner:joueur.owner,
          nom:joueur.name,
          potentiel:entree.potentialTier || 0
        })))
      .sort((a, b) => b.potentiel - a.potentiel);
  }
