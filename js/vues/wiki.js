/* L'onglet Wiki : rail de categories, filtres, grille de heros.

   Le catalogue des competences n'est PAS precache : ~190 Ko de prose pour un
   onglet qu'on ouvre deliberement. Il est injecte a la premiere ouverture,
   par une balise <script> classique — la meme forme que les autres fichiers
   de donnees, qui posent tous un window.*. Le gestionnaire `fetch` du service
   worker le met en cache au passage, donc hors ligne ensuite.

   Les valeurs des filtres sont derivees de SEVEN_DS_META : aucune liste
   d'elements, de roles ou de raretes n'est ecrite ici. Un heros ajoute au jeu
   apparait donc sans toucher a ce fichier. */

import { DATA, ELEMENTS, META, WEAPON_ENUM, metaOf }
  from "../noyau/constantes.js";
import { $, el, norm } from "../noyau/dom.js";

  /* SEVEN_DS_META parle le vocabulaire du PERSONNAGE — `SUPPORT` — et non
     celui des slots d'arme de WSLOT_ROLES, qui dit `Supporter`. Les deux ne
     se recouvrent pas : batir ce filtre sur WSLOT_ROLES perdait les soutiens.
     Un code inedit s'affiche tel quel plutot que de disparaitre du filtre. */
  const ROLES_HEROS = {
    ATTACKER:"Attaquant", DEFENDER:"Défenseur", SUPPORT:"Soutien"
  };

  /* Point d'extension : la fiche de heros s'y branche au chargement de son
     module. Tant qu'il vaut null, une tuile reste inerte plutot que de lever. */
  let ouvrirFiche = null;
  const brancherFiche = fonction => { ouvrirFiche = fonction; };

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

  /* Les valeurs d'un filtre : celles que les heros portent REELLEMENT, triees
     par libelle. `lire` extrait les valeurs d'une meta, `libelle` les nomme. */
  function valeursDe(lire, libelle){
    const portees = new Set();
    Object.values(META).forEach(meta => {
      (lire(meta) || []).forEach(valeur => { if(valeur) portees.add(valeur); });
    });
    return [...portees]
      .map(valeur => ({ valeur, libelle:libelle(valeur) }))
      .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr-FR"));
  }

  function remplirFiltre(selecteur, valeurs, libelleVide){
    const champ = $(selecteur);
    if(champ.options.length) return;
    champ.appendChild(el("option",{ value:"", text:libelleVide }));
    valeurs.forEach(item => {
      champ.appendChild(el("option",{ value:item.valeur, text:item.libelle }));
    });
    champ.addEventListener("change", renderGrid);
  }

  function remplirFiltres(){
    remplirFiltre("#wikiFilterElement",
      valeursDe(meta => [meta.element],
        code => (ELEMENTS[code] || {}).label || code),
      "Tous les éléments");
    remplirFiltre("#wikiFilterWeapon",
      valeursDe(meta => (meta.weapons || []).map(slot => slot.weapon),
        code => (WEAPON_ENUM[code] || {}).label || code),
      "Toutes les armes");
    remplirFiltre("#wikiFilterRole",
      valeursDe(meta => [meta.role], code => ROLES_HEROS[code] || code),
      "Tous les rôles");
    remplirFiltre("#wikiFilterRarity",
      valeursDe(meta => [meta.rarity], code => code),
      "Toutes les raretés");
  }

  function correspond(character){
    const meta = metaOf(character.id) || {};
    const recherche = norm($("#wikiSearch").value.trim());
    if(recherche && !norm(character.name).includes(recherche)) return false;
    const element = $("#wikiFilterElement").value;
    if(element && meta.element !== element) return false;
    const role = $("#wikiFilterRole").value;
    if(role && meta.role !== role) return false;
    const rarete = $("#wikiFilterRarity").value;
    if(rarete && meta.rarity !== rarete) return false;
    const arme = $("#wikiFilterWeapon").value;
    if(arme && !(meta.weapons || []).some(slot => slot.weapon === arme)){
      return false;
    }
    return true;
  }

  const retenus = () => (DATA.personnages || []).filter(correspond);

  function tuile(character){
    return el("button",{
      class:"wiki-tile",
      type:"button",
      title:character.name,
      dataset:{ char:character.id },
      onclick:()=>{ if(ouvrirFiche) ouvrirFiche(character.id, retenus()); }
    },[
      el("img",{ src:character.file, alt:"", loading:"lazy" }),
      el("span",{ class:"wiki-tile-name", text:character.name })
    ]);
  }

  function renderGrid(){
    const grille = $("#wikiGrid");
    grille.innerHTML = "";
    const liste = retenus();
    liste.forEach(character => grille.appendChild(tuile(character)));
    $("#wikiEmpty").hidden = liste.length > 0;
  }

  function renderWiki(){
    const etat = $("#wikiState");
    if(window.SEVEN_DS_WIKI_COMPETENCES){
      etat.textContent = "";
      renderGrid();
      return Promise.resolve(true);
    }
    etat.textContent = "Chargement du wiki…";
    return chargerCatalogue().then(()=>{
      etat.textContent = "";
      remplirFiltres();
      renderGrid();
      return true;
    }).catch(()=>{
      etat.textContent = "Le wiki n’a pas pu être chargé. Vérifie ta connexion "
        + "puis rouvre l’onglet.";
      return true;
    });
  }

  $("#wikiSearch").addEventListener("input", renderGrid);

/* `chargerCatalogue` reste interne : le depot refuse tout export que personne
   n'importe (tests/modules-imports.test.js). `ROLES_HEROS` sort parce que la
   fiche affiche le meme libelle que le filtre — une seule table, pas deux. */
export { ROLES_HEROS, brancherFiche, renderWiki };
