/* L'onglet Wiki : rail de categories, filtres, grille.

   Cinq categories, decrites par une TABLE et non par cinq branches de code.
   Chacune declare sa source, le texte de son champ de recherche, ses filtres
   et ce que fait un clic. Ajouter une categorie, c'est ajouter une ligne.

   Le catalogue des competences n'est PAS precache : ~210 Ko de prose pour un
   onglet qu'on ouvre deliberement. Il est injecte a la premiere ouverture, par
   une balise <script> classique — la meme forme que les autres fichiers de
   donnees, qui posent tous un window.*. Le gestionnaire `fetch` du service
   worker le met en cache au passage, donc hors ligne ensuite. Les quatre
   categories d'objets n'en ont pas besoin : leurs donnees vivent dans
   data/stats-build.js, deja precache.

   Les valeurs des listes deroulantes sont derivees des entrees REELLEMENT
   listees, jamais ecrites a la main. C'est la regle qui a evite le piege
   SUPPORT / Supporter au lot 1. */

import {
  BUILD_STATS, DATA, ELEMENTS, META, WEAPON_ENUM, metaOf
} from "../noyau/constantes.js";
import { $, el, norm } from "../noyau/dom.js";
import { charOf } from "../metier/catalogue.js";
import {
  armesDuWiki, armuresDuWiki, bijouxDuWiki, graveesDuWiki
} from "../metier/wiki-equipement.js";
import { libelleDeRarete } from "./wiki-blocs.js";

  /* SEVEN_DS_META parle le vocabulaire du PERSONNAGE — `SUPPORT` — et non
     celui des slots d'arme de WSLOT_ROLES, qui dit `Supporter`. Les deux ne
     se recouvrent pas : batir ce filtre sur WSLOT_ROLES perdait les soutiens.
     Un code inedit s'affiche tel quel plutot que de disparaitre du filtre. */
  const ROLES_HEROS = {
    ATTACKER:"Attaquant", DEFENDER:"Défenseur", SUPPORT:"Soutien"
  };

  /* Points d'extension : les fiches s'y branchent au chargement de leur
     module. Tant qu'ils valent null, une tuile reste inerte plutot que de
     lever. */
  let ouvrirFiche = null;
  let ouvrirObjet = null;
  const brancherFiche = fonction => { ouvrirFiche = fonction; };
  const brancherFicheObjet = fonction => { ouvrirObjet = fonction; };

  /* Ouvrir la fiche d'un heros depuis ailleurs que sa grille — l'armure gravee
     qui lui est liee. On passe TOUS les heros et non le seul concerne, pour
     que le « precedent / suivant » de la fiche reste utilisable. */
  function ouvrirHerosDuWiki(slug){
    if(ouvrirFiche) ouvrirFiche(slug, DATA.personnages || []);
  }

  let chargement = null;

  function chargerCatalogue(){
    if(window.SEVEN_DS_WIKI_COMPETENCES) return Promise.resolve(true);
    if(chargement) return chargement;
    chargement = new Promise((resolve, reject) => {
      document.head.appendChild(el("script",{
        src:"./data/wiki-competences.js",
        onload:()=>resolve(true),
        onerror:()=>reject(new Error("catalogue introuvable"))
      }));
    }).catch(erreur => {
      /* Rejouable : un echec reseau ne doit pas condamner l'onglet pour toute
         la duree de la session. */
      chargement = null;
      throw erreur;
    });
    return chargement;
  }

  /* Les valeurs d'un filtre : celles que les entrees portent REELLEMENT,
     triees par libelle. `lire` en extrait les valeurs, `libelle` les nomme. */
  function valeursPortees(entrees, lire, libelle){
    const portees = new Set();
    (entrees || []).forEach(entree => {
      (lire(entree) || []).forEach(valeur => { if(valeur) portees.add(valeur); });
    });
    return [...portees]
      .map(valeur => ({ valeur, libelle:libelle(valeur) }))
      .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr-FR"));
  }

  const libelleArme = code => (WEAPON_ENUM[code] || {}).label || code;
  const libelleElement = code => (ELEMENTS[code] || {}).label || code;
  const libelleEnsemble = id =>
    ((BUILD_STATS.gearSets || {})[id] || {}).nameFr || id;
  const libelleHeros = slug => (charOf(slug) || {}).name || slug;

  /* Un filtre sur une valeur simple : le cas de loin le plus courant. */
  const filtreSimple = (id, libelle, vide, lire, nommer) => ({
    id, libelle, vide,
    valeurs:entrees => valeursPortees(entrees, entree => [lire(entree)], nommer),
    garde:(entree, valeur) => lire(entree) === valeur
  });

  const CATEGORIES = [
    {
      cle:"heros",
      bouton:"#wikiCategoryHeros",
      recherche:"Nom d'un héros…",
      vide:"Aucun héros ne correspond à cette recherche.",
      source:() => DATA.personnages || [],
      nom:entree => entree.name,
      image:entree => entree.file,
      marque:entree => ({ char:entree.id }),
      /* Les filtres du lot 1, inchanges — identifiants compris : les tests du
         parcours heros s'y appuient. Ils se derivent de META et non des
         entrees listees, parce que les armes d'un heros y sont imbriquees. */
      filtres:[
        {
          id:"wikiFilterElement", libelle:"Élément", vide:"Tous les éléments",
          valeurs:() => valeursPortees(
            Object.values(META), meta => [meta.element], libelleElement),
          garde:(entree, valeur) => (metaOf(entree.id) || {}).element === valeur
        },
        {
          id:"wikiFilterWeapon", libelle:"Arme", vide:"Toutes les armes",
          valeurs:() => valeursPortees(
            Object.values(META),
            meta => (meta.weapons || []).map(slot => slot.weapon),
            libelleArme),
          garde:(entree, valeur) =>
            ((metaOf(entree.id) || {}).weapons || [])
              .some(slot => slot.weapon === valeur)
        },
        {
          id:"wikiFilterRole", libelle:"Rôle", vide:"Tous les rôles",
          valeurs:() => valeursPortees(
            Object.values(META), meta => [meta.role],
            code => ROLES_HEROS[code] || code),
          garde:(entree, valeur) => (metaOf(entree.id) || {}).role === valeur
        },
        {
          id:"wikiFilterRarity", libelle:"Rareté", vide:"Toutes les raretés",
          valeurs:() => valeursPortees(
            Object.values(META), meta => [meta.rarity], code => code),
          garde:(entree, valeur) => (metaOf(entree.id) || {}).rarity === valeur
        }
      ],
      ouvrir:(entree, liste) => {
        if(ouvrirFiche) ouvrirFiche(entree.id, liste);
      }
    },
    {
      cle:"armes",
      bouton:"#wikiCategoryArmes",
      recherche:"Nom d'une arme…",
      vide:"Aucune arme ne correspond à cette recherche.",
      source:armesDuWiki,
      filtres:[
        filtreSimple("wikiFilterWeaponType", "Type", "Tous les types",
          entree => entree.type, libelleArme),
        {
          id:"wikiFilterWeaponGrade", libelle:"Rareté",
          vide:"Toutes les raretés",
          /* ⚠️ Sur TOUTES les raretes ou l'arme existe, pas sur la plus
             haute. Une arme monte de grade 1 a grade 3, ou n'existe qu'en
             grade 4 ou 5 — jamais les deux. Filtrer sur le maximum faisait
             disparaitre « Grade 2 », qui n'est jamais un plafond : le membre
             lisait « Grade 1, Grade 3, Grade 4, Grade 5 » et ne pouvait pas
             chercher les armes qui existent en grade 2. */
          valeurs:entrees => valeursPortees(
            entrees, entree => entree.raretes, libelleDeRarete),
          garde:(entree, valeur) => entree.raretes.indexOf(valeur) !== -1
        },
        {
          id:"wikiFilterWeaponPassive", libelle:"Passif", vide:"Toutes",
          /* Un booleen, pas un vocabulaire du jeu : les deux options sont
             ecrites ici sans que ce soit une liste en dur a maintenir. */
          valeurs:() => [
            { valeur:"oui", libelle:"Avec passif" },
            { valeur:"non", libelle:"Sans passif" }
          ],
          garde:(entree, valeur) => entree.aPassif === (valeur === "oui")
        }
      ]
    },
    {
      cle:"armures",
      bouton:"#wikiCategoryArmures",
      recherche:"Nom d'une armure…",
      vide:"Aucune armure ne correspond à cette recherche.",
      source:armuresDuWiki,
      filtres:[
        filtreSimple("wikiFilterArmorSlot", "Emplacement",
          "Tous les emplacements", entree => entree.famille, code => code),
        filtreSimple("wikiFilterArmorSet", "Ensemble", "Tous les ensembles",
          entree => entree.setId, libelleEnsemble)
      ]
    },
    {
      cle:"bijoux",
      bouton:"#wikiCategoryBijoux",
      recherche:"Nom d'un bijou…",
      vide:"Aucun bijou ne correspond à cette recherche.",
      source:bijouxDuWiki,
      filtres:[
        filtreSimple("wikiFilterJewelSlot", "Emplacement",
          "Tous les emplacements", entree => entree.famille, code => code),
        filtreSimple("wikiFilterJewelSet", "Ensemble", "Tous les ensembles",
          entree => entree.setId, libelleEnsemble)
      ]
    },
    {
      cle:"gravees",
      bouton:"#wikiCategoryGravees",
      recherche:"Nom d'une armure gravée…",
      vide:"Aucune armure gravée ne correspond à cette recherche.",
      source:graveesDuWiki,
      filtres:[
        filtreSimple("wikiFilterEngravedHero", "Héros", "Tous les héros",
          entree => entree.heros, libelleHeros)
      ]
    }
  ];

  /* Les quatre categories d'objets partagent la meme forme d'entree : le
     module metier rend `{file, nom}`. Les combler ici evite de repeter ces
     trois lignes quatre fois dans la table. */
  CATEGORIES.forEach(categorie => {
    if(categorie.nom) return;
    categorie.nom = entree => entree.nom;
    categorie.image = entree => entree.file;
    categorie.marque = entree => ({ file:entree.file });
    categorie.ouvrir = (entree, liste) => {
      if(ouvrirObjet) ouvrirObjet(entree, liste);
    };
  });

  let active = "heros";
  let filtresPour = null;
  const categorieActive = () =>
    CATEGORIES.find(categorie => categorie.cle === active) || CATEGORIES[0];

  function construireFiltres(categorie){
    const zone = $("#wikiFilters");
    zone.querySelectorAll("[data-filtre]").forEach(noeud => noeud.remove());
    $("#wikiSearch").placeholder = categorie.recherche;
    $("#wikiEmpty").textContent = categorie.vide;
    const entrees = categorie.source();
    (categorie.filtres || []).forEach(filtre => {
      const champ = el("select",{ id:filtre.id, onchange:renderGrid });
      champ.appendChild(el("option",{ value:"", text:filtre.vide }));
      filtre.valeurs(entrees).forEach(item => {
        champ.appendChild(el("option",{ value:item.valeur, text:item.libelle }));
      });
      zone.appendChild(el("label",{
        class:"wiki-field", dataset:{ filtre:filtre.id }
      },[
        el("span",{ text:filtre.libelle }),
        champ
      ]));
    });
  }

  function retenus(){
    const categorie = categorieActive();
    const recherche = norm($("#wikiSearch").value.trim());
    return categorie.source().filter(entree => {
      if(recherche && !norm(categorie.nom(entree)).includes(recherche)){
        return false;
      }
      return (categorie.filtres || []).every(filtre => {
        const champ = $("#" + filtre.id);
        const valeur = champ ? champ.value : "";
        return !valeur || filtre.garde(entree, valeur);
      });
    });
  }

  function tuile(categorie, entree, liste){
    return el("button",{
      class:"wiki-tile",
      type:"button",
      title:categorie.nom(entree),
      dataset:categorie.marque(entree),
      onclick:()=>categorie.ouvrir(entree, liste)
    },[
      el("img",{ src:categorie.image(entree), alt:"", loading:"lazy" }),
      el("span",{ class:"wiki-tile-name", text:categorie.nom(entree) })
    ]);
  }

  function renderGrid(){
    const categorie = categorieActive();
    const grille = $("#wikiGrid");
    grille.innerHTML = "";
    const liste = retenus();
    liste.forEach(entree => {
      grille.appendChild(tuile(categorie, entree, liste));
    });
    $("#wikiEmpty").hidden = liste.length > 0;
  }

  function afficher(){
    const categorie = categorieActive();
    if(filtresPour !== categorie.cle){
      construireFiltres(categorie);
      filtresPour = categorie.cle;
    }
    renderGrid();
  }

  function choisir(cle){
    if(active === cle) return;
    active = cle;
    CATEGORIES.forEach(categorie => {
      const bouton = $(categorie.bouton);
      const choisie = categorie.cle === cle;
      bouton.classList.toggle("active", choisie);
      bouton.setAttribute("aria-pressed", String(choisie));
    });
    /* La recherche d'une categorie n'a pas de sens dans une autre : « derieri »
       ne designe aucune arme. On repart d'un champ vide plutot que d'une
       grille mysterieusement vide. */
    $("#wikiSearch").value = "";
    afficher();
  }

  function renderWiki(){
    const etat = $("#wikiState");
    if(window.SEVEN_DS_WIKI_COMPETENCES){
      etat.textContent = "";
      afficher();
      return Promise.resolve(true);
    }
    etat.textContent = "Chargement du wiki…";
    return chargerCatalogue().then(()=>{
      etat.textContent = "";
      afficher();
      return true;
    }).catch(()=>{
      etat.textContent = "Le wiki n’a pas pu être chargé. Vérifie ta connexion "
        + "puis rouvre l’onglet.";
      return true;
    });
  }

  $("#wikiSearch").addEventListener("input", renderGrid);
  CATEGORIES.forEach(categorie => {
    $(categorie.bouton).addEventListener("click", ()=>choisir(categorie.cle));
  });

/* `chargerCatalogue` reste interne : le depot refuse tout export que personne
   n'importe. `ROLES_HEROS` sort parce que la fiche affiche le meme libelle que
   le filtre — une seule table, pas deux. */
export {
  ROLES_HEROS,
  brancherFiche,
  brancherFicheObjet,
  ouvrirHerosDuWiki,
  renderWiki
};
