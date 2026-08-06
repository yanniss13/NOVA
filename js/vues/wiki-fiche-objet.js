/* La fiche d'un objet du wiki : une seule modale pour les trois natures.

   Elle porte ce qui ne depend pas du contenu — ouverture, fermeture, precedent
   et suivant, fleches clavier, compteur, preservation du focus — et aiguille
   le corps vers le module qui sait le batir. Les armures et les bijoux
   partagent le meme corps que les armures gravees : les trois ne different que
   par leur provenance.

   Le comportement de navigation reprend celui de wiki-fiche-heros.js, lui-meme
   herite de detail-roster.js. */

import { $, el } from "../noyau/dom.js";
import { objetDuWiki } from "../metier/wiki-equipement.js";
import { ModalStack } from "./modal-stack.js";
import { corpsArme } from "./wiki-corps-arme.js";
import { corpsEquipement } from "./wiki-corps-equipement.js";
import { brancherFicheObjet, ouvrirHerosDuWiki } from "./wiki.js";

  const objet = { entries:[], index:0, niveau:null };

  const CORPS = {
    arme:corpsArme,
    armure:corpsEquipement,
    bijou:corpsEquipement,
    gravee:corpsEquipement
  };

  /* Ouvrir la fiche d'un objet designe par son chemin — une piece soeur d'un
     ensemble. `objetDuWiki` rend la liste de sa categorie avec lui, pour que
     « precedent / suivant » reste utilisable apres ce saut. */
  function ouvrirParFichier(file){
    const trouve = objetDuWiki(file);
    if(!trouve) return;
    objet.entries = trouve.liste;
    objet.index = trouve.liste.indexOf(trouve.entree);
    objet.niveau = null;
    renderObjet();
  }

  function renderObjet(){
    const entree = objet.entries[objet.index];
    const corps = $("#wikiItemBody");
    /* A relever AVANT de vider le corps : la pastille de niveau focalisee
       disparait avec lui et le focus retombe sur le body, donc HORS de la
       modale. Les fleches gauche/droite cessent alors de repondre, leur
       ecouteur etant pose sur l'overlay. On rendra le focus a son
       remplacante. Meme piege que le selecteur d'arme de la fiche de heros. */
    const focusEtaitSurUnNiveau = !!document.activeElement
      && !!document.activeElement.classList
      && document.activeElement.classList.contains("wiki-level");
    corps.innerHTML = "";
    if(!entree) return;

    $("#wikiItemTitle").textContent = entree.nom;
    $("#wikiItemPosition").textContent =
      (objet.index + 1) + " / " + objet.entries.length;
    const precedent = $("#wikiItemPrev");
    const suivant = $("#wikiItemNext");
    /* Le navigateur retire le focus d'un bouton des qu'il devient `disabled` :
       on note qui l'avait AVANT de desactiver, puis on le rend au controle
       encore utilisable plutot que de le perdre sur le body. */
    const actif = document.activeElement;
    precedent.disabled = objet.index <= 0;
    suivant.disabled = objet.index >= objet.entries.length - 1;
    if((actif === precedent || actif === suivant) && actif.disabled){
      const repli = actif === precedent ? suivant : precedent;
      (repli.disabled ? $("#wikiItemClose") : repli).focus();
    }

    const contexte = {
      niveau:objet.niveau,
      choisirNiveau:niveau => { objet.niveau = niveau; renderObjet(); },
      ouvrirFichier:ouvrirParFichier,
      ouvrirHeros:ouvrirHerosDuWiki
    };
    const batir = CORPS[entree.nature];
    if(!batir){
      corps.appendChild(el("p",{
        class:"wiki-hero-hint",
        text:"Cet objet n’a pas encore de fiche."
      }));
      return;
    }
    batir(entree, contexte).forEach(noeud => {
      if(noeud) corps.appendChild(noeud);
    });

    if(focusEtaitSurUnNiveau){
      const remplacante = corps.querySelector(".wiki-level.active");
      if(remplacante) remplacante.focus();
    }
  }

  function deplacerObjet(pas){
    const suivant = objet.index + pas;
    if(suivant < 0 || suivant >= objet.entries.length) return;
    objet.index = suivant;
    /* Le niveau choisi appartenait a l'objet precedent : le garder ferait
       ouvrir le suivant sur un palier arbitraire au lieu de son maximum. */
    objet.niveau = null;
    renderObjet();
  }

  function fermerObjet(){ ModalStack.close($("#wikiItemOverlay")); }

  function ouvrirFicheObjet(entree, entries){
    const liste = Array.isArray(entries) && entries.length ? entries : [entree];
    const index = liste.indexOf(entree);
    if(index === -1) return;
    const declencheur = document.activeElement;
    objet.entries = liste;
    objet.index = index;
    objet.niveau = null;
    renderObjet();
    ModalStack.open(
      $("#wikiItemOverlay"), "#wikiItemClose", fermerObjet, declencheur
    );
  }

  $("#wikiItemClose").addEventListener("click", fermerObjet);
  $("#wikiItemPrev").addEventListener("click", ()=>deplacerObjet(-1));
  $("#wikiItemNext").addEventListener("click", ()=>deplacerObjet(1));
  $("#wikiItemOverlay").addEventListener("click", event => {
    if(event.target === $("#wikiItemOverlay")) fermerObjet();
  });
  $("#wikiItemOverlay").addEventListener("keydown", event => {
    if(event.key === "ArrowLeft"){ event.preventDefault(); deplacerObjet(-1); }
    else if(event.key === "ArrowRight"){ event.preventDefault(); deplacerObjet(1); }
  });

  brancherFicheObjet(ouvrirFicheObjet);

/* Rien a sortir : ce module s'enregistre lui-meme aupres de wiki.js, comme la
   fiche de heros. app.js l'importe pour effet de bord. */
