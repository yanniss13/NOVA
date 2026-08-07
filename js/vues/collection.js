/* L'onglet Collection : ce qu'il reste a trouver.

   Il n'enumere aucun objet lui-meme. `armesDuWiki()` et `graveesDuWiki()`
   joignent deja les images aux statistiques par le chemin de l'image, et c'est
   ce meme chemin qui sert de cle a la collection : une seule identite d'objet
   dans tout le site.

   La possession se CALCULE a chaque rendu (metier/collection.js) : le marque
   vient du store, l'equipe se derive du roster deja charge. Tenir a jour deux
   verites separement les ferait diverger, et il faudrait alors decider laquelle
   ment.

   ⚠️ Les noms de premier niveau sont uniques dans tout js/ — le chargeur `vm`
   des tests concatene les modules dans une portee commune. `valeursPortees`,
   `construireFiltres`, `retenus`, `tuile` et `grille` appartiennent deja a
   wiki.js : les fonctions equivalentes portent ici un nom en propre. */

import { WEAPON_ENUM } from "../noyau/constantes.js";
import { $, el, norm } from "../noyau/dom.js";
import { charOf } from "../metier/catalogue.js";
import { armesDuWiki, graveesDuWiki } from "../metier/wiki-equipement.js";
import {
  equipesDuRoster, possessionsDe, progressionDe, utilesAuRoster
} from "../metier/collection.js";
import { refreshRosterProfiles } from "../donnees/roster-profils.js";
import { CollectionStore } from "../donnees/collection-store.js";
import { MemberRosterStore } from "../donnees/roster-store.js";
import { sessionCourante } from "../etat/session.js";
import { toast } from "./toast.js";

  /* L'onglet s'ouvre sur les manquants : c'est la question qu'on vient lui
     poser. « Tout » reste a un clic pour verifier ce qu'on possede deja. */
  const POSSESSION = [
    { valeur:"manquants", libelle:"À trouver" },
    { valeur:"possedes",  libelle:"Possédés" },
    { valeur:"tout",      libelle:"Tout" }
  ];

  const FAMILLES = { arme:"Armes", gravee:"Armures gravées" };

  const nomDArme = code => (WEAPON_ENUM[code] || {}).label || code;
  const nomDeHeros = slug => (charOf(slug) || {}).name || slug;
  const nomDeFamille = nature => FAMILLES[nature] || nature;

  const etatCollection = {
    possession:"manquants", famille:"", type:"", heros:"", utiles:""
  };

  /* Les objets marques dans Supabase, pour le membre affiche. */
  let marques = new Set();

  const objetsDeLaCollection = () => armesDuWiki().concat(graveesDuWiki());

  /* Le membre AFFICHE, qui n'est pas forcement celui qui regarde : on consulte
     la collection d'un autre pour savoir quoi lui echanger. `""` signifie
     « moi », pour qu'une deconnexion ramene naturellement a sa propre vue. */
  let ownerChoisi = "";
  const moiMeme = () => sessionCourante.user ? sessionCourante.user.id : "";
  function ownerAffiche(){
    const moi = moiMeme();
    return moi ? (ownerChoisi || moi) : "";
  }
  const estMaCollection = () => !!moiMeme() && ownerAffiche() === moiMeme();
  const rosterAffiche = () => MemberRosterStore.all(ownerAffiche());

  const pseudoDe = id => {
    const profil = (sessionCourante.rosterProfiles || [])
      .find(item => item.id === id);
    return (profil && profil.pseudo) || "ce membre";
  };

  /* La relecture se fait UNE FOIS par proprietaire, pas a chaque rendu :
     `renderCollection` s'appelle a chaque filtre, et une relecture qui re-rend
     qui relit serait une boucle sans fin. */
  let relulePour = "";

  /* Le ROSTER se relit avec la collection, et non seulement dans son onglet :
     c'est lui qui dit ce qui est equipe, donc possede d'office. Sans cela, un
     membre qui ouvre Collection en premier verrait ses pieces portees comme
     restant a trouver — le contraire de ce que l'onglet promet. */
  function relireLeMembre(ownerId){
    if(!ownerId || relulePour === ownerId) return;
    relulePour = ownerId;
    Promise.all([
      CollectionStore.refresh(ownerId),
      MemberRosterStore.refresh(ownerId)
    ]).then(()=>{
      renderCollection();
    }).catch(()=>{
      /* Hors ligne, le cache local suffit a afficher. Pas de bandeau : le
         membre n'a rien demande, il a juste ouvert un onglet. */
      relulePour = "";
    });
  }

  /* Le temps reel a vu la table bouger : la prochaine lecture doit repasser
     par Supabase. Rendre ou non est la decision de l'appelant — un evenement
     ne change jamais l'onglet actif. */
  function invaliderCollection(){
    relulePour = "";
  }

  /* La liste des membres, lue une fois. Elle sert au selecteur ET au libelle
     du filtre d'utilite, qui nomme le roster consulte. */
  let profilsDemandes = false;

  function relireLesProfils(){
    if(profilsDemandes || !moiMeme()) return;
    profilsDemandes = true;
    refreshRosterProfiles()
      .then(()=>{ renderCollection(); })
      .catch(()=>{ profilsDemandes = false; });
  }

  let membresPoses = "";

  /* Le selecteur reste MASQUE tant qu'il n'y a personne d'autre a regarder :
     un controle a une seule option est une promesse non tenue. */
  function selecteurDeMembre(){
    const moi = moiMeme();
    const autres = (sessionCourante.rosterProfiles || [])
      .filter(profil => profil.id !== moi);
    $("#collectionOwnerField").hidden = !moi || !autres.length;
    const signature = moi + "|"
      + autres.map(profil => profil.id + ":" + profil.pseudo).join(",");
    if(membresPoses === signature) return;
    membresPoses = signature;
    const champ = $("#collectionOwner");
    champ.innerHTML = "";
    champ.appendChild(el("option",{ value:"", text:"Ma collection" }));
    autres.forEach(profil => champ.appendChild(el("option",{
      value:profil.id, text:profil.pseudo
    })));
    champ.value = ownerChoisi;
  }

  /* Le rendu n'a lieu qu'APRES la reponse de Supabase. Retirer la tuile avant
     confirmation ferait disparaitre un objet qu'une panne reseau laisserait
     non marque, et le membre le croirait acquis. */
  async function basculerPossession(objet, estPossede){
    try{
      if(estPossede) await CollectionStore.unmark(objet.file);
      else await CollectionStore.mark(objet.file);
      toast(objet.nom
        + (estPossede ? " remis à trouver" : " marqué comme possédé"));
      renderCollection();
    }catch(erreur){
      toast("Impossible d’enregistrer. Vérifie ta connexion.", true);
    }
  }

  /* Les valeurs d'un filtre : celles que les objets portent REELLEMENT,
     triees par libelle. Aucune liste ecrite a la main — c'est la regle qui a
     evite le piege SUPPORT / Supporter au Wiki. */
  function valeursDeCollection(objets, lire, nommer){
    const portees = new Set();
    (objets || []).forEach(objet => {
      const valeur = lire(objet);
      if(valeur) portees.add(valeur);
    });
    return [...portees]
      .map(valeur => ({ valeur, libelle:nommer(valeur) }))
      .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr-FR"));
  }

  const FILTRES = [
    {
      cle:"possession", id:"collectionFilterPossession", libelle:"Affichage",
      /* Pas d'option vide : « Tout » en est deja une. Un quatrieme choix qui
         ferait la meme chose serait un piege. */
      valeurs:() => POSSESSION
    },
    {
      cle:"famille", id:"collectionFilterFamille", libelle:"Famille",
      vide:"Armes et gravures",
      valeurs:objets =>
        valeursDeCollection(objets, objet => objet.nature, nomDeFamille)
    },
    {
      cle:"type", id:"collectionFilterType", libelle:"Type d'arme",
      vide:"Tous les types",
      valeurs:objets =>
        valeursDeCollection(objets, objet => objet.type, nomDArme)
    },
    {
      cle:"heros", id:"collectionFilterHeros", libelle:"Héros",
      vide:"Tous les héros",
      valeurs:objets =>
        valeursDeCollection(objets, objet => objet.heros, nomDeHeros)
    },
    {
      cle:"utiles", id:"collectionFilterUtiles", libelle:"Utilité",
      vide:"Tout le catalogue",
      valeurs:() => [{ valeur:"oui", libelle:"Utile à mon roster" }]
    }
  ];

  /* Le filtre d'utilite se rapporte au roster AFFICHE, pas a celui qui
     regarde. Le libelle doit le dire, sinon « utile » ne veut plus rien dire
     des qu'on consulte quelqu'un d'autre. */
  function libelleDUtilite(){
    const option = document.querySelector(
      "#collectionFilterUtiles option[value=\"oui\"]");
    if(!option) return;
    option.textContent = estMaCollection()
      ? "Utile à mon roster"
      : "Utile au roster de " + pseudoDe(ownerAffiche());
  }

  /* Les listes deroulantes ne se reconstruisent PAS a chaque rendu : leurs
     valeurs viennent d'un catalogue fige, et les recreer arracherait le focus
     du membre au moment meme ou il vient de choisir. */
  let filtresPoses = false;

  function filtresDeCollection(objets){
    const zone = $("#collectionFilters");
    zone.querySelectorAll("[data-filtre]").forEach(noeud => noeud.remove());
    FILTRES.forEach(filtre => {
      const champ = el("select",{
        id:filtre.id,
        onchange:evenement => {
          etatCollection[filtre.cle] = evenement.target.value;
          renderCollection();
        }
      });
      if(filtre.vide){
        champ.appendChild(el("option",{ value:"", text:filtre.vide }));
      }
      filtre.valeurs(objets).forEach(item => {
        champ.appendChild(el("option",{ value:item.valeur, text:item.libelle }));
      });
      champ.value = etatCollection[filtre.cle];
      zone.appendChild(el("label",{
        class:"wiki-field", dataset:{ filtre:filtre.id }
      },[
        el("span",{ text:filtre.libelle }),
        champ
      ]));
    });
  }

  function retenusDeCollection(objets, possessions, utiles){
    const recherche = norm($("#collectionSearch").value.trim());
    return objets.filter(objet => {
      if(recherche && !norm(objet.nom).includes(recherche)) return false;
      const possede = possessions.has(objet.file);
      if(etatCollection.possession === "manquants" && possede) return false;
      if(etatCollection.possession === "possedes" && !possede) return false;
      if(etatCollection.famille && objet.nature !== etatCollection.famille){
        return false;
      }
      if(etatCollection.type && objet.type !== etatCollection.type) return false;
      if(etatCollection.heros && objet.heros !== etatCollection.heros){
        return false;
      }
      if(etatCollection.utiles && !utiles.has(objet.file)) return false;
      return true;
    });
  }

  /* Les tuiles deja construites, par chemin d'image.

     ⚠️ ELLES SE REUTILISENT, elles ne se recreent pas. Un `<img>` recree
     repart d'un document vide : le navigateur le repeint, et 220 images qui
     repartent ensemble pour UN objet coche, c'est le clignotement que le
     membre voyait. Deplacer un noeud existant, lui, ne recharge rien. */
  const tuilesConnues = new Map();

  /* Une tuile. `equipe` la verrouille : l'objet est possede parce qu'il est
     porte, et se dire non possedant de ce qu'on equipe serait se contredire.
     Le titre dit pourquoi, sans quoi le cadenas serait une enigme. */
  function tuileDeCollection(objet){
    return el("button",{
      class:"wiki-tile",
      type:"button",
      title:objet.nom,
      dataset:{ file:objet.file }
    },[
      el("img",{ src:objet.file, alt:"", loading:"lazy" }),
      el("span",{ class:"wiki-tile-name", text:objet.nom })
    ]);
  }

  function majTuile(bouton, objet, contexte){
    const possede = contexte.possessions.has(objet.file);
    const equipe = contexte.equipements.has(objet.file);
    bouton.classList.toggle("collection-owned", possede);
    bouton.classList.toggle("collection-locked", equipe);
    bouton.title = equipe ? "Équipé — possédé d’office" : objet.nom;
    /* La propriete, pas l'attribut : `el` poserait `disabled="null"` pour une
       tuile libre, et l'attribut desactive des qu'il est present. */
    bouton.disabled = equipe;
    return bouton;
  }

  /* Aligne les enfants de `grille` sur `objets`, en place.

     ⚠️ On RETIRE D'ABORD, on place ensuite. Placer d'abord semble equivalent
     mais ne l'est pas : retirer le premier objet d'une liste decale tous les
     suivants, et chacun se fait alors repositionner — 151 deplacements pour un
     seul objet coche. Purger la grille avant de la parcourir ramene ce meme
     geste a zero deplacement. */
  function reconcilierGrille(grille, objets, contexte){
    const voulus = new Set(objets.map(objet => objet.file));
    [...grille.children].forEach(enfant => {
      if(!voulus.has(enfant.dataset.file)) grille.removeChild(enfant);
    });

    let precedent = null;
    objets.forEach(objet => {
      let bouton = tuilesConnues.get(objet.file);
      if(!bouton){
        bouton = tuileDeCollection(objet);
        tuilesConnues.set(objet.file, bouton);
      }
      majTuile(bouton, objet, contexte);
      const attendu = precedent ? precedent.nextSibling : grille.firstChild;
      if(bouton !== attendu) grille.insertBefore(bouton, attendu);
      precedent = bouton;
    });
  }

  /* Les deux sections existent des le premier rendu et ne sont plus jamais
     detruites : seul leur contenu bouge, et elles se masquent quand elles se
     vident. */
  const SECTIONS_COLLECTION = [
    { nature:"arme",   titre:"Armes" },
    { nature:"gravee", titre:"Armures gravées" }
  ];

  function poserLesSections(){
    const corps = $("#collectionBody");
    SECTIONS_COLLECTION.forEach(section => {
      if(section.zone) return;
      section.grille = el("div",{ class:"wiki-grid" });
      section.zone = el("div",{},[
        el("h2",{ class:"collection-section-title", text:section.titre }),
        section.grille
      ]);
      corps.appendChild(section.zone);
    });
  }

  /* La deconnexion ou le changement de compte remet la vue a zero : garder
     `ownerChoisi` afficherait la collection d'un membre a quelqu'un qui vient
     de changer d'identite. */
  let moiConnu = "";

  /* L'etat exact que le document porte deja. `null` tant que rien n'est peint,
     pour que le premier rendu ait toujours lieu. */
  let empreinteRendue = null;

  function renderCollection(){
    const moi = moiMeme();
    if(moi !== moiConnu){
      moiConnu = moi;
      ownerChoisi = "";
      profilsDemandes = false;
      membresPoses = "";
    }
    relireLesProfils();
    selecteurDeMembre();

    const ownerId = ownerAffiche();
    /* Le cache est indexe par proprietaire : le relire a chaque rendu suffit
       a ce qu'une deconnexion n'affiche jamais la collection du precedent. */
    marques = CollectionStore.all(ownerId);
    relireLeMembre(ownerId);

    const objets = objetsDeLaCollection();
    const roster = rosterAffiche();
    const equipements = equipesDuRoster(roster);
    const possessions = possessionsDe(marques, equipements);
    const utiles = utilesAuRoster(roster, objets);
    /* Lecture seule sur autrui : la RLS refuserait l'ecriture de toute facon,
       mais offrir un geste qui sera rejete est une promesse non tenue. */
    const contexte = { possessions, equipements, modifiable:estMaCollection() };

    if(!filtresPoses){
      filtresDeCollection(objets);
      filtresPoses = true;
    }
    libelleDUtilite();

    const compte = progressionDe(objets, possessions);
    const liste = retenusDeCollection(objets, possessions, utiles);
    /* Deux raisons de ne rien pouvoir cocher, et elles ne se disent pas
       pareil : sans compte la collection n'existe pas encore, chez autrui
       elle ne nous appartient pas. */
    const message = !liste.length
      ? "Rien à afficher avec ces filtres."
      : (contexte.modifiable
        ? ""
        : (moi
          ? "Collection de " + pseudoDe(ownerId) + " — lecture seule."
          : "Connecte-toi pour cocher ce que tu possèdes."));

    /* ⚠️ NE PAS REPEINDRE CE QUI N'A PAS CHANGE.

       Un seul clic declenchait TROIS reconstructions de la grille en 92 ms :
       le rendu du clic, celui de l'echo Realtime de notre PROPRE ecriture, et
       celui de la relecture que cet echo declenchait. Les 220 tuiles et leurs
       images etaient detruites puis recreees a chaque fois — le site
       clignotait, et le membre le voyait.

       Les deux rendus surnumeraires produisent un DOM identique : le cache
       local porte deja l'ecriture quand l'echo arrive. Cette empreinte les
       arrete avant qu'ils ne touchent au document. Meme lecon que
       `shouldIgnoreAvailabilityEcho` pour les dispos : l'echo de sa propre
       ecriture n'apprend rien. */
    const empreinte = JSON.stringify({
      modifiable:contexte.modifiable,
      message,
      compte,
      tuiles:liste.map(objet => objet.file
        + (possessions.has(objet.file) ? "|P" : "")
        + (equipements.has(objet.file) ? "|E" : ""))
    });
    if(empreinte === empreinteRendue) return Promise.resolve(true);
    empreinteRendue = empreinte;

    const progression = $("#collectionProgress");
    progression.innerHTML = "";
    progression.appendChild(el("b",{ text:String(compte.possedes) }));
    progression.appendChild(document.createTextNode(
      " / " + compte.total + " possédés — " + compte.manquants + " à trouver"
    ));

    poserLesSections();
    SECTIONS_COLLECTION.forEach(section => {
      const siennes = liste.filter(objet => objet.nature === section.nature);
      reconcilierGrille(section.grille, siennes, contexte);
      section.zone.hidden = !siennes.length;
    });

    $("#collectionState").textContent = message;
    return Promise.resolve(true);
  }

  /* Masque des le chargement : le premier rendu tranchera, mais un selecteur
     vide ne doit jamais exister, pas meme le temps d'une image. */
  $("#collectionOwnerField").hidden = true;

  /* Un seul ecouteur pour toutes les tuiles, pose une fois pour toutes.

     Un ecouteur PAR tuile devrait etre repose a chaque rendu, ce qui obligeait
     a recreer les noeuds — la cause meme du clignotement. Une tuile verrouillee
     est `disabled` et n'emet aucun clic : le verrou tient toujours. */
  $("#collectionBody").addEventListener("click", evenement => {
    const bouton = evenement.target.closest(".wiki-tile");
    if(!bouton || !estMaCollection()) return;
    const objet = objetsDeLaCollection()
      .find(item => item.file === bouton.dataset.file);
    if(!objet) return;
    void basculerPossession(objet, bouton.classList.contains("collection-owned"));
  });

  $("#collectionSearch").addEventListener("input", renderCollection);
  $("#collectionOwner").addEventListener("change", evenement => {
    ownerChoisi = evenement.target.value;
    renderCollection();
  });

export { invaliderCollection, renderCollection };
