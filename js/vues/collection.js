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

  const ownerAffiche = () => sessionCourante.user ? sessionCourante.user.id : "";
  const rosterAffiche = () => MemberRosterStore.all(ownerAffiche());

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

  /* Une tuile. `equipe` la verrouille : l'objet est possede parce qu'il est
     porte, et se dire non possedant de ce qu'on equipe serait se contredire.
     Le titre dit pourquoi, sans quoi le cadenas serait une enigme. */
  function tuileDeCollection(objet, contexte){
    const possede = contexte.possessions.has(objet.file);
    const equipe = contexte.equipements.has(objet.file);
    const bouton = el("button",{
      class:"wiki-tile"
        +(possede ? " collection-owned" : "")
        +(equipe ? " collection-locked" : ""),
      type:"button",
      title:equipe ? "Équipé — possédé d’office" : objet.nom,
      dataset:{ file:objet.file }
    },[
      el("img",{ src:objet.file, alt:"", loading:"lazy" }),
      el("span",{ class:"wiki-tile-name", text:objet.nom })
    ]);
    /* La propriete, pas l'attribut : `el` poserait `disabled="null"` pour une
       tuile libre, et l'attribut desactive des qu'il est present. */
    if(equipe) bouton.disabled = true;
    else if(contexte.modifiable){
      bouton.addEventListener("click",
        ()=>void basculerPossession(objet, possede));
    }
    return bouton;
  }

  function grilleDeCollection(titre, objets, contexte){
    if(!objets.length) return null;
    return el("div",{},[
      el("h2",{ class:"collection-section-title", text:titre }),
      el("div",{ class:"wiki-grid" },
        objets.map(objet => tuileDeCollection(objet, contexte)))
    ]);
  }

  function renderCollection(){
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
    const contexte = { possessions, equipements, modifiable:!!ownerId };

    if(!filtresPoses){
      filtresDeCollection(objets);
      filtresPoses = true;
    }

    const compte = progressionDe(objets, possessions);
    const progression = $("#collectionProgress");
    progression.innerHTML = "";
    progression.appendChild(el("b",{ text:String(compte.possedes) }));
    progression.appendChild(document.createTextNode(
      " / " + compte.total + " possédés — " + compte.manquants + " à trouver"
    ));

    const liste = retenusDeCollection(objets, possessions, utiles);
    const corps = $("#collectionBody");
    corps.innerHTML = "";
    [
      grilleDeCollection("Armes",
        liste.filter(objet => objet.nature === "arme"), contexte),
      grilleDeCollection("Armures gravées",
        liste.filter(objet => objet.nature === "gravee"), contexte)
    ].forEach(zone => { if(zone) corps.appendChild(zone); });

    /* Sans compte, la grille reste consultable mais rien ne se coche : la
       collection vit dans Supabase, et un clic sans effet serait pire qu'un
       clic annonce impossible. */
    $("#collectionState").textContent = !liste.length
      ? "Rien à afficher avec ces filtres."
      : (contexte.modifiable
        ? ""
        : "Connecte-toi pour cocher ce que tu possèdes.");
    return Promise.resolve(true);
  }

  $("#collectionSearch").addEventListener("input", renderCollection);
  /* Le selecteur de membre est pose dans le balisage mais reste masque tant
     que rien ne l'alimente : un controle vide qui ne fait rien est une
     promesse non tenue. */
  $("#collectionOwnerField").hidden = true;

export { invaliderCollection, renderCollection };
