/* L'onglet Analyse : qui peut couvrir quel element, et avec quel potentiel.

   La question a laquelle il repond : « pour ce boss, qui dans la confrerie a
   un DPS de cet element, et a quel niveau ? » Il ne stocke rien — il derive
   tout du roster des membres.

   La regle metier tient en deux lignes, en tete du module : un build de role
   Attaquant compte comme DPS, plus UNE exception, Gowther Baguette (role
   Briseur) a partir du potentiel 7. Cette exception vient du jeu, pas d'un
   choix de code : ne la retire pas sans verifier en jeu.

   Les aides d'element (ordre, libelle, couleur) sont ici et non dans
   noyau/constantes.js parce que l'ordre d'affichage est un choix de CETTE
   vue : c'est celui de la roue des elements, pas l'ordre du catalogue. */

import { refreshRosterProfiles } from "../donnees/roster-profils.js";
import { cloudRosterFromRow } from "../donnees/roster-store.js";
import { BossStore } from "../donnees/boss-store.js";
import { sessionCourante } from "../etat/session.js";
import { charOf } from "../metier/catalogue.js";
import { favoriteRosterWeaponType } from "../metier/equipe-modele.js";
import { fragmentDeRoute, lireRoute } from "../metier/routage.js";
import {
  ENUM_TO_FOLDER,
  FOLDER_TO_ENUM,
  metaOf
} from "../noyau/constantes.js";
import { $, el } from "../noyau/dom.js";
import { owns } from "../noyau/outils.js";
import { sb } from "../noyau/supabase-client.js";
import {
  chargerTablesDuRecensement,
  groupesDuRecensement,
  rendreRecensement,
  SECTIONS_DU_RECENSEMENT
} from "./analyse-recensement.js";
import { elemBadge, elemColor, elemLabel } from "./badge-element.js";
import { openRosterDetailFor, rosterDetail } from "./detail-roster.js";
import { ModalStack } from "./modal-stack.js";
import { openAuth } from "./modale-auth.js";
import { showView } from "./navigation.js";
import { enregistrerGestionnaireRoute } from "./routage.js";
import { toast } from "./toast.js";

  /* ===== #5 Analyse : DPS dérivés du Roster ===== */
  // Un build Attaquant du roster = une entrée DPS { char, element, pot }.
  // Exception unique : Gowther Baguette (Briseur) à partir de P7.
  function isRosterBuildDps(entry, slot, weaponEnum){
    if(slot.role === "Attacker") return true;
    return slot.role === "Buster"
      && entry.charId === "gowther"
      && weaponEnum === "Wand"
      && (entry.potentialTier||0) >= 7;
  }
  /* Préférence de jeu du propriétaire, propre à Meliodas : à défaut de favori,
     ouvrir l'Épée à une main. Ce n'est pas une liste d'assets — c'est une
     règle produit nommée. La généraliser changerait le comportement de futurs
     personnages sans décision. */
  const DPS_PREFERRED_WEAPON_BY_CHAR = { meliodas:"Sword1h" };

  function dpsEntriesFromRoster(entry){
    const m = entry && metaOf(entry.charId);
    if(!m || !entry.builds) return [];
    /* Les SR sont hors de l'analyse DPS. Filtrer ici les retire d'un coup du
       classement, de la couverture et de la matrice, qui dérivent toutes de
       cette sortie. */
    if(m.rarity !== "SSR") return [];
    const favoriteFolder = favoriteRosterWeaponType(entry);
    const favoriteEnum = favoriteFolder ? FOLDER_TO_ENUM[favoriteFolder] : null;
    const preferred = DPS_PREFERRED_WEAPON_BY_CHAR[entry.charId] || null;
    const byElement = new Map();
    /* On parcourt les slots du personnage, pas les clés de `builds` : l'ordre
       des armes devient stable d'un membre à l'autre. */
    (m.weapons||[]).forEach(slot => {
      const en = slot.weapon;
      const folder = ENUM_TO_FOLDER[en];
      if(!folder || !owns(entry.builds, folder)) return;
      if(!isRosterBuildDps(entry, slot, en)) return;
      const element = (slot.element||"").toUpperCase();
      if(!element) return;
      if(!byElement.has(element)){
        byElement.set(element, {
          char:entry.charId,
          element,
          pot:entry.potentialTier||0,
          weaponTypes:[],
          preferredWeaponType:null
        });
      }
      byElement.get(element).weaponTypes.push(en);
    });
    return [...byElement.values()].map(item => Object.assign(item, {
      preferredWeaponType:
        (favoriteEnum && item.weaponTypes.includes(favoriteEnum) && favoriteEnum)
        || (preferred && item.weaponTypes.includes(preferred) && preferred)
        || item.weaponTypes[0]
    }));
  }

  /* Assemblage d'un joueur de l'analyse. `characters` conserve les rosters
     normalises deja calcules : la modale de detail doit pouvoir s'ouvrir sans
     relire le reseau. */
  function rosterPlayerFrom(owner, name, entries){
    return {
      owner,
      name,
      characters:entries,
      dps:entries.reduce((acc, e) => acc.concat(dpsEntriesFromRoster(e)), [])
    };
  }

  // Agrège tous les rosters de la confrérie -> [{owner, name, dps:[…], characters:[…]}]
  async function rosterDerivedPlayers(){
    if(!sessionCourante.user || !sb) return [];
    const [rosterRes, profiles] = await Promise.all([
      sb.from("roster_characters").select("owner,char_id,potential_tier,builds,updated_at"),
      refreshRosterProfiles().catch(()=>sessionCourante.rosterProfiles.slice())
    ]);
    if(rosterRes.error) throw rosterRes.error;
    const byOwner = {};
    (rosterRes.data||[]).forEach(row=>{
      const entry = cloudRosterFromRow(row);
      if(!entry) return;
      (byOwner[entry.owner] = byOwner[entry.owner] || []).push(entry);
    });
    const nameOf = id => {
      const p = (profiles||[]).find(x => x.id === id);
      if(p) return p.pseudo;
      if(sessionCourante.user && id === sessionCourante.user.id) return sessionCourante.pseudo || "Moi";
      return "Membre";
    };
    return Object.keys(byOwner)
      /* Plus de filtre sur `dps.length` ici : un membre qui ne joue que des
         soutiens a sa place au recensement d'affaiblissement, et ce filtre le
         rendait invisible avant meme que la vue ne le voie. Les sections DPS
         filtrent desormais elles-memes, au plus pres de leur besoin. */
      .map(owner => rosterPlayerFrom(owner, nameOf(owner), byOwner[owner]));
  }

  /* Cette liste pilote TOUT le tableau : les cartes de couverture, les
     pastilles du classement et les colonnes. Un element absent n'y est pas
     affiche de travers — il n'existe pas, et les heros qui le portent ne
     comptent pour rien.

     « Physique » (code DEFAULT) y figure depuis le 15 aout 2026, date a
     laquelle le jeu en a fait un element a part entiere en y basculant Dreyfus
     et Griamore. Il ferme la marche parce qu'il ne participe a aucun cycle de
     faiblesses : ce n'est pas un huitieme element du cercle, c'est l'absence
     d'affinite, et le lecteur le cherche en dernier.

     tests/analyse-elements.test.js exige que cette liste et `ELEMENTS` se
     recouvrent exactement. */
  const ELEM_ORDER = [
    "FIRE","ICE","WIND","EARTH","HOLY","DARK","THUNDER","DEFAULT"
  ];
  const elemOf = charId => { const m = metaOf(charId); return m ? (m.element||"").toUpperCase() : null; };
  // éléments POSSIBLES d'un perso (il en a un par type d'arme équipable)
  function charElements(charId){
    const m = metaOf(charId); if(!m) return [];
    const set = [];
    /* `DEFAULT` n'est plus ecarte : il valait « pas d'element » avant le
       15 aout 2026, il vaut « Physique » depuis. L'ecarter revenait a rendre
       invisibles le Grimoire de Gowther, la rapiere de Dreyfus, et Griamore
       en entier — ses trois armes le sont. */
    (m.weapons||[]).forEach(w=>{ const e=(w.element||"").toUpperCase(); if(e && !set.includes(e)) set.push(e); });
    if(!set.length && m.element) set.push((m.element||"").toUpperCase());
    return set;
  }
  // élément retenu pour une entrée DPS (choisi, sinon 1er possible)
  const dpsElem = d => (d.element||"").toUpperCase() || charElements(d.char)[0] || elemOf(d.char);


  /* ============================ Analyse ============================ */
  let analyseRenderId = 0;
  let analyseSousVue = "overview";
  const ANALYSE_SOUS_VUES = [
    { id:"overview", label:"Vue d'ensemble" },
    { id:"dps", label:"DPS par élément" },
    { id:"supports", label:"Soutiens" }
  ];
  /* L'element sur lequel la matrice est triee, ou null pour l'ordre par
     defaut - le nombre de DPS. Il remplace l'ancien element du classement :
     meme etat conserve d'un rendu a l'autre, meme question posee. */
  let analyseTri = null;
  /* Les membres coches pour comparer un sous-groupe, par identifiant d'owner.
     Vide = filtre inactif, toute la confrerie s'affiche dans la matrice. Meme
     etat conserve d'un rendu a l'autre que le tri, et comme lui il ne touche
     QU'A la matrice : les compteurs de la vue d'ensemble restent calcules sur
     tout le monde. */
  const analyseMembres = new Set();
  /* Vide signifie « Tous ». Une selection contient un ou plusieurs codes
     d'element et conserve toujours les effets generaux, utiles a toute
     composition. Comme le filtre des membres, cet etat survit aux rendus
     Realtime sans etre persiste entre deux chargements de page. */
  const analyseElementsSupports = new Set();
  let analyseGroupContext = { status:"none" };

  function routeAnalyseGroupeCourante(){
    const route = lireRoute(location.hash);
    return route && route.type === "group" && route.view === "analyse"
      ? route
      : null;
  }

  function synchroniserContexteAnalyse(){
    const route = routeAnalyseGroupeCourante();
    if(!route || route.sessionId !== analyseGroupContext.sessionId){
      analyseGroupContext = { status:"none" };
    }
    return route;
  }

  function participantsAnalyse(membership){
    const uniques = new Map();
    (membership || []).forEach(item => {
      const owner = String(item && item.owner || "");
      if(owner && !uniques.has(owner)){
        uniques.set(owner, {
          owner,
          pseudo:String(item.pseudo || "Membre")
        });
      }
    });
    return [...uniques.values()];
  }

  function afficherSousVueAnalyse(box, sousVue, donnerLeFocus = false){
    if(!ANALYSE_SOUS_VUES.some(item => item.id === sousVue)) return;
    analyseSousVue = sousVue;
    box.querySelectorAll(".analyse-subnav-button").forEach(button => {
      const active = button.dataset.analyseSection === sousVue;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
      if(active && donnerLeFocus) button.focus();
    });
    box.querySelectorAll(".analyse-panel").forEach(panel => {
      panel.hidden = panel.dataset.analyseSection !== sousVue;
    });
  }

  function navigationAnalyse(box){
    const nav = el("div",{
      class:"analyse-subnav",
      role:"group",
      "aria-label":"Sections de l'analyse"
    });
    ANALYSE_SOUS_VUES.forEach(item => {
      nav.appendChild(el("button",{
        id:"analyseSubpage-" + item.id,
        class:"analyse-subnav-button" + (analyseSousVue === item.id ? " active" : ""),
        type:"button",
        dataset:{ analyseSection:item.id },
        "aria-controls":"analysePanel-" + item.id,
        "aria-pressed":String(analyseSousVue === item.id),
        text:item.label,
        onclick:()=>afficherSousVueAnalyse(box, item.id)
      }));
    });
    return nav;
  }

  function panneauAnalyse(id){
    return el("section",{
      id:"analysePanel-" + id,
      class:"analyse-panel",
      dataset:{ analyseSection:id },
      "aria-labelledby":"analyseSubpage-" + id
    });
  }

  function carteResume(valeur, libelle, detail){
    return el("div",{class:"analyse-summary-card"},[
      el("strong",{class:"analyse-summary-value", text:String(valeur)}),
      el("span",{class:"analyse-summary-label", text:libelle}),
      el("span",{class:"analyse-summary-detail", text:detail})
    ]);
  }

  function resumeDesSupports(membres, tablesLues, lectureRostersReussie){
    if(!tablesLues || !lectureRostersReussie) return null;
    const groupes = SECTIONS_DU_RECENSEMENT.flatMap(section =>
      groupesDuRecensement(section.vise, membres)
    );
    return {
      total:groupes.reduce((n, groupe) => n + groupe.lignes.length, 0),
      portes:groupes.reduce((n, groupe) =>
        n + groupe.lignes.filter(item => item.porteurs.length).length, 0)
    };
  }

  function celluleParClef(root, key){
    if(!root || !key) return null;
    return [...root.querySelectorAll(".mx-action")].find(cell =>
      cell.dataset.owner === String(key.owner || "")
      && cell.dataset.char === String(key.char || "")
      && cell.dataset.elem === String(key.element || "")
    ) || null;
  }

  /* Realtime peut remplacer la case qui a ouvert la modale. On corrige la
     cible de restitution dans la pile AVANT la fermeture ; ModalStack reste
     l'unique mecanisme qui deplace effectivement le focus. */
  function rendreLaCibleDuFocus(racine){
    const overlay = $("#rosterDetailOverlay");
    if(!overlay.classList.contains("on") || !rosterDetail.returnFocusKey) return;
    const remplacante = celluleParClef(racine, rosterDetail.returnFocusKey);
    if(remplacante) ModalStack.setRestoreFocus(overlay, remplacante);
  }

  /* UNE CASE DE LA MATRICE : un membre, un element, un personnage.

     C'est l'unite qu'exploitait le classement — meme trio owner/char/element,
     meme fiche ouverte, meme cle de restitution du focus. La matrice le porte
     desormais elle-meme, ce qui a permis de retirer une section qui reposait
     la question a laquelle celle-ci repond deja, mais pour un seul element a
     la fois. Aucune lecture reseau : l'entree de roster est deja chargee. */
  function caseDeLaMatrice(joueur, dps){
    const ch = charOf(dps.char);
    const element = dpsElem(dps);
    return el("button",{
      class:"mx-item mx-action",
      type:"button",
      dataset:{ owner:joueur.owner || "", char:dps.char, elem:element },
      title:(ch ? ch.name : dps.char) + " — ouvrir le build de " + joueur.name,
      onclick:()=>{
        const entree = (joueur.characters || [])
          .find(personnage => personnage.charId === dps.char);
        if(!entree) return;
        openRosterDetailFor({
          entries:[entree],
          index:0,
          memberName:joueur.name,
          weaponTypes:dps.weaponTypes,
          weaponType:dps.preferredWeaponType,
          showNavigation:false,
          returnFocusKey:{ owner:joueur.owner, char:dps.char, element }
        });
      }
    },[
      el("span",{class:"mx-nom", text:ch ? ch.name : dps.char}),
      /* P0 est un potentiel renseigne : il s'ecrit, comme au recensement. Ne
         rien mettre laissait croire a une donnee manquante. */
      el("span",{class:"mx-pot", text:"P" + (dps.pot || 0)})
    ]);
  }

  /* Le meilleur potentiel d'un membre pour un element, ou -1 s'il n'en a
     aucun : c'est la cle du tri par colonne, et -1 range les absents apres
     les P0, qui eux sont renseignes. */
  function meilleurPotentiel(joueur, element){
    return (joueur.dps || [])
      .filter(dps => dpsElem(dps) === element)
      .reduce((max, dps) => Math.max(max, dps.pot || 0), -1);
  }

  /* L'ordre des membres. Par defaut le nombre de DPS, comme avant ; par
     colonne quand le membre a clique un element, ce qui remplace exactement
     le classement : le meilleur porteur de l'element passe en tete. */
  function membresTries(joueurs){
    const ordonnes = joueurs.slice();
    if(analyseTri === null){
      return ordonnes.sort((a, b) => (b.dps || []).length - (a.dps || []).length);
    }
    return ordonnes.sort((a, b) =>
      meilleurPotentiel(b, analyseTri) - meilleurPotentiel(a, analyseTri)
      || (b.dps || []).length - (a.dps || []).length
      || a.name.localeCompare(b.name, "fr")
    );
  }

  /* LES PUCES DE FILTRE PAR MEMBRE : une case a cocher accessible par membre,
     plus une remise a zero « Tous ». Cocher un ou plusieurs membres restreint
     la matrice a leurs lignes, pour comparer un sous-groupe ; « Tous » vide la
     selection. Le filtre ne relit jamais le reseau : il ne fait que masquer des
     lignes deja rendues. La rangee se construit une seule fois par rendu et se
     met a jour en place — la reconstruire a chaque clic perdrait le focus. */
  function filtreMembres(wrap, players){
    const groupe = el("div",{
      class:"matrix-membres",
      role:"group",
      "aria-label":"Filtrer la matrice par membre"
    });
    /* « Tous » n'est pas un membre : c'est l'etat « aucun filtre », actif quand
       la selection est vide. En tete, il devient le point de retour naturel. */
    const puceTous = el("button",{
      class:"matrix-membre matrix-membre-tous"
        + (analyseMembres.size ? "" : " active"),
      type:"button",
      "aria-pressed":String(analyseMembres.size === 0),
      text:"Tous",
      onclick:()=>{
        if(!analyseMembres.size) return;
        analyseMembres.clear();
        synchroniser();
        rendreMatrice(wrap, players);
      }
    });
    groupe.appendChild(puceTous);
    const puces = players.map(joueur => {
      const actif = analyseMembres.has(joueur.owner);
      const puce = el("button",{
        class:"matrix-membre" + (actif ? " active" : ""),
        type:"button",
        dataset:{ owner:joueur.owner || "" },
        "aria-pressed":String(actif),
        text:joueur.name,
        onclick:()=>{
          if(analyseMembres.has(joueur.owner)) analyseMembres.delete(joueur.owner);
          else analyseMembres.add(joueur.owner);
          synchroniser();
          rendreMatrice(wrap, players);
        }
      });
      groupe.appendChild(puce);
      return puce;
    });
    function synchroniser(){
      const vide = analyseMembres.size === 0;
      puceTous.classList.toggle("active", vide);
      puceTous.setAttribute("aria-pressed", String(vide));
      puces.forEach(puce => {
        const actif = analyseMembres.has(puce.dataset.owner);
        puce.classList.toggle("active", actif);
        puce.setAttribute("aria-pressed", String(actif));
      });
    }
    return groupe;
  }

  /* LE MULTI-FILTRE DES SOUTIENS. Les huit elements restent proposes meme si
     aucun effet specialise n'est encore transcrit pour l'un d'eux : le filtre
     de l'Analyse partage ainsi le meme vocabulaire que la couverture DPS.
     « Tous » vide la selection ; desactivee jusqu'au dernier element, celle-ci
     revient naturellement a l'etat complet. */
  function filtreElementsSupports(rafraichir){
    const groupe = el("div",{
      class:"supports-element-filter",
      role:"group",
      "aria-label":"Filtrer les soutiens par élément"
    });
    groupe.appendChild(el("span",{
      class:"supports-element-filter-label",
      text:"Éléments affichés"
    }));
    const choix = [{ id:"", label:"Tous" }].concat(
      ELEM_ORDER.map(id => ({ id, label:elemLabel(id) }))
    );
    choix.forEach(choixElement => {
      const actif = choixElement.id
        ? analyseElementsSupports.has(choixElement.id)
        : analyseElementsSupports.size === 0;
      const bouton = el("button",{
        class:"support-element-button"
          + (choixElement.id ? "" : " support-element-tous")
          + (actif ? " active" : ""),
        type:"button",
        dataset:{ supportElement:choixElement.id },
        "aria-pressed":String(actif),
        onclick:()=>{
          if(!choixElement.id){
            if(!analyseElementsSupports.size) return;
            analyseElementsSupports.clear();
          }else if(analyseElementsSupports.has(choixElement.id)){
            analyseElementsSupports.delete(choixElement.id);
          }else{
            analyseElementsSupports.add(choixElement.id);
          }
          rafraichir(choixElement.id);
        }
      },[
        el("span",{class:"support-element-dot", "aria-hidden":"true"}),
        el("span",{text:choixElement.label})
      ]);
      bouton.style.setProperty(
        "--ec", choixElement.id ? elemColor(choixElement.id) : "#6f6960"
      );
      groupe.appendChild(bouton);
    });
    return groupe;
  }

  /* LA MATRICE, dans son conteneur stable. Aucune lecture reseau : elle ne
     travaille que sur les joueurs deja charges. */
  function rendreMatrice(wrap, players){
    /* Le select de tri PERSISTE d'un rendu a l'autre. Le reconstruire puis lui
       rendre le focus rouvrait le picker natif sur mobile a CHAQUE choix : le
       `.focus()` programmatique sur un <select> tactile ordonne au systeme de
       rouvrir la liste. On garde donc le meme noeud vivant — il conserve son
       focus tout seul, sans qu'on le rappelle — et on ne remplace que la
       table. Le tri peut aussi venir d'un clic sur un en-tete de colonne
       (ordinateur), d'ou la mise a jour de `value` a chaque passage. */
    let triMobile = wrap.querySelector(".matrix-mobile-sort");
    let selectTriMobile = triMobile
      && triMobile.querySelector(".matrix-mobile-sort-select");
    if(!selectTriMobile){
      selectTriMobile = el("select",{class:"matrix-mobile-sort-select"});
      selectTriMobile.appendChild(el("option",{value:"total", text:"Total"}));
      ELEM_ORDER.forEach(e =>
        selectTriMobile.appendChild(el("option",{value:e, text:elemLabel(e)})));
      selectTriMobile.addEventListener("change",()=>{
        analyseTri = selectTriMobile.value === "total"
          ? null : selectTriMobile.value;
        rendreMatrice(wrap, players);
      });
      triMobile = el("label",{class:"matrix-mobile-sort"},[
        el("span",{text:"Trier par"}),
        selectTriMobile
      ]);
    }
    selectTriMobile.value = analyseTri === null ? "total" : analyseTri;
    const table = el("table",{class:"matrix"});
    const thead = el("tr",{class:"mx-header-row"},[
      el("th",{class:"mx-player", text:"Membre"}),
      el("th",{text:"Total"})
    ]);
    ELEM_ORDER.forEach(e => {
      const trie = analyseTri === e;
      const th = el("th",{
        /* `aria-sort` sur l'en-tete, et non une classe : c'est ce que lit une
           aide technique pour annoncer l'ordre du tableau. */
        "aria-sort":trie ? "descending" : "none"
      });
      th.appendChild(el("button",{
        class:"mx-tri" + (trie ? " active" : ""),
        type:"button",
        dataset:{ elem:e },
        title:trie
          ? "Classement par " + elemLabel(e) + " — cliquer pour revenir au total"
          : "Classer les membres par leur meilleur potentiel " + elemLabel(e),
        /* Un second clic sur la meme colonne rend l'ordre par defaut : sans
           cette sortie, le membre ne pourrait plus revenir au total. */
        onclick:()=>{
          analyseTri = trie ? null : e;
          rendreMatrice(wrap, players);
        }
      },[ elemBadge(e) ]));
      thead.appendChild(th);
    });
    table.appendChild(thead);
    /* Le filtre par membre ne restreint QUE les lignes affichees. Vide = toute
       la confrerie ; la selection ne contient que des membres presents (elle
       est purgee au rendu), donc la matrice ne peut pas se retrouver vide. */
    const affiches = analyseMembres.size
      ? players.filter(joueur => analyseMembres.has(joueur.owner))
      : players;
    membresTries(affiches).forEach(p => {
      const total = (p.dps || []).length;
      const tr = el("tr",{class:"mx-player-card"});
      tr.appendChild(el("td",{class:"mx-player", text:p.name}));
      tr.appendChild(el("td",{
        class:"mx-total",
        text:String(total),
        "aria-label":"Total : " + total + " DPS"
      }));
      ELEM_ORDER.forEach(e => {
        const dps = (p.dps||[]).filter(d => dpsElem(d) === e)
          .sort((a,b) => (b.pot||0) - (a.pot||0));
        const td = el("td",{
          class:(dps.length ? "" : "mx-empty")
            + (analyseTri === e ? " mx-colonne-triee" : ""),
          dataset:{ mxElement:e }
        });
        /* Le libelle prend la couleur de son element : sur telephone, l'en-tete
           colore du tableau est masque, et cette pastille devient le seul repere
           d'element de la carte. */
        const label = el("span",{class:"mx-element-label", text:elemLabel(e)});
        label.style.setProperty("--ec", elemColor(e));
        td.appendChild(label);
        if(dps.length) dps.forEach(d => td.appendChild(caseDeLaMatrice(p, d)));
        else td.appendChild(el("span",{class:"mx-empty-mark", text:"—"}));
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    /* Ne remplacer QUE la table : le select garde son identite, donc son focus,
       et ne se rouvre pas sur mobile. Au tout premier rendu, poser les deux. */
    const ancienneTable = wrap.querySelector("table.matrix");
    if(ancienneTable) ancienneTable.replaceWith(table);
    else wrap.replaceChildren(triMobile, table);
    /* Le tableau doit deja etre connecte : si Realtime reconstruit la vue
       pendant que la modale est ouverte, ModalStack refuse a juste titre une
       cible de focus detachee. */
    rendreLaCibleDuFocus(wrap);
  }

  function bandeauGroupeAnalyse(context, options){
    const settings = Object.assign({
      lectureRostersReussie:true,
      sansRoster:0
    }, options || {});
    const title = context.group.title + " · Run " + (context.group.run_no || 1);
    const nombre = context.participants.length;
    const details = [
      el("span",{
        class:"analyse-group-meta",
        text:nombre + " participant" + (nombre > 1 ? "s" : "")
      })
    ];
    if(!settings.lectureRostersReussie){
      details.push(el("span",{
        class:"analyse-group-meta analyse-group-error",
        text:"Données de roster indisponibles"
      }));
    }else if(settings.sansRoster > 0){
      details.push(el("span",{
        class:"analyse-group-meta analyse-group-warning",
        text:settings.sansRoster + " sans roster exploitable"
      }));
    }
    return el("section",{
      class:"analyse-group-context",
      role:"region",
      "aria-labelledby":"analyseGroupTitle"
    },[
      el("div",{class:"analyse-group-main"},[
        el("h2",{
          id:"analyseGroupTitle",
          class:"analyse-group-title",
          tabindex:-1,
          text:title
        }),
        el("div",{class:"analyse-group-details"},details)
      ]),
      el("button",{
        class:"btn btn-secondary analyse-group-all",
        type:"button",
        text:"Toute la confrérie",
        onclick:()=>void showView("analyse")
      })
    ]);
  }

  function etatRouteAnalyse(message, action){
    const box = $("#analyseBody");
    box.innerHTML = "";
    const content = [
      el("p",{
        id:"analyseGroupTitle",
        class:"big",
        tabindex:-1,
        text:message
      })
    ];
    if(action){
      content.push(el("a",{
        class:"btn btn-secondary",
        href:action.href,
        dataset:{appRoute:""},
        text:action.label
      }));
    }
    box.appendChild(el("div",{
      class:"empty-state analyse-route-state",
      role:"status"
    },content));
  }

  function rendreGroupeAnalyseVide(context){
    const box = $("#analyseBody");
    box.innerHTML = "";
    const overview = panneauAnalyse("overview");
    const dpsPanel = panneauAnalyse("dps");
    const supportsPanel = panneauAnalyse("supports");
    dpsPanel.appendChild(el("div",{class:"empty-state analyse-empty"},[
      el("p",{
        class:"big",
        text:"Ce groupe ne contient encore aucun participant."
      })
    ]));
    box.append(
      bandeauGroupeAnalyse(context),
      navigationAnalyse(box),
      overview,
      dpsPanel,
      supportsPanel
    );
    afficherSousVueAnalyse(box, "dps");
  }

  async function ouvrirRouteAnalyseGroupe(route){
    analyseSousVue = "dps";
    analyseGroupContext = {
      status:"loading",
      sessionId:route.sessionId
    };
    const loaded = await showView("analyse", {historyMode:"none"});
    if(!loaded) return false;
    try{
      const group = await BossStore.sessionById(route.sessionId);
      if(!group || group.status !== "open"){
        analyseGroupContext = {
          status:"not-found",
          sessionId:route.sessionId
        };
      }else{
        const membership = await BossStore.listMembership([route.sessionId]);
        analyseGroupContext = {
          status:"ready",
          sessionId:route.sessionId,
          group,
          participants:participantsAnalyse(membership)
        };
      }
    }catch(error){
      analyseGroupContext = {
        status:"read-error",
        sessionId:route.sessionId
      };
    }
    await renderAnalyse();
    $("#analyseGroupTitle")?.focus();
    return true;
  }

  async function renderAnalyse(){
    const renderId = ++analyseRenderId;
    const box = $("#analyseBody");
    synchroniserContexteAnalyse();
    /* Le rafraîchissement détache immédiatement les cases de la matrice. Si
       celle qui a ouvert la modale ne réapparaît pas (build supprimé ou lecture
       en échec), l'onglet Analyse reste une cible logique et visible. Une case
       reconstruite remplacera ce repli dans `rendreLaCibleDuFocus()`. */
    const detailOverlay = $("#rosterDetailOverlay");
    if(detailOverlay.classList.contains("on") && rosterDetail.returnFocusKey){
      ModalStack.setRestoreFocus(detailOverlay, $("#tab-analyse"));
    }
    box.innerHTML = "";
    box.appendChild(el("div",{class:"empty-state"},[
      el("p",{class:"big",text:"Chargement de l’analyse…"})
    ]));
    if(!sessionCourante.user){
      box.innerHTML = "";
      box.appendChild(el("div",{class:"empty-state"},[
        el("p",{class:"big",text:"Connecte-toi pour voir l'analyse"}),
        el("button",{class:"btn btn-primary",text:"Connexion",onclick:()=>openAuth()})
      ]));
      return;
    }
    if(analyseGroupContext.status === "loading"){
      box.innerHTML = "";
      box.appendChild(el("div",{class:"empty-state"},[
        el("p",{class:"big",text:"Chargement du groupe…"})
      ]));
      return;
    }
    if(analyseGroupContext.status === "not-found"){
      etatRouteAnalyse(
        "Ce groupe n’est plus ouvert ou n’existe plus.",
        {
          label:"Retour aux sessions",
          href:fragmentDeRoute({ type:"view", view:"boss" })
        }
      );
      return;
    }
    if(analyseGroupContext.status === "read-error"){
      etatRouteAnalyse(
        "Impossible de lire les participants du groupe.",
        {
          label:"Réessayer",
          href:fragmentDeRoute({
            type:"group",
            view:"analyse",
            sessionId:analyseGroupContext.sessionId
          })
        }
      );
      return;
    }
    if(analyseGroupContext.status === "ready"
      && analyseGroupContext.participants.length === 0){
      rendreGroupeAnalyseVide(analyseGroupContext);
      return;
    }
    let membres;
    let lectureRostersReussie = true;
    try{
      membres = await rosterDerivedPlayers();
    }catch(error){
      membres = [];
      lectureRostersReussie = false;
      toast("Analyse indisponible pour l'instant.", true);
    }
    const tablesLues = await chargerTablesDuRecensement()
      .then(() => true, () => false);
    if(renderId !== analyseRenderId) return;
    box.innerHTML = "";
    const participantOwners = analyseGroupContext.status === "ready"
      ? new Set(analyseGroupContext.participants.map(item => item.owner))
      : null;
    const membresAnalyses = participantOwners
      ? membres.filter(membre => participantOwners.has(membre.owner))
      : membres;
    /* Les trois sections DPS ne parlent que des membres qui en ont un. Les deux
       recensements, eux, parlent de tout le monde : un membre qui ne joue que
       des soutiens y a sa place, et le filtre d'origine le rendait invisible
       avant meme que la vue ne le voie. */
    const players = membresAnalyses.filter(p => (p.dps || []).length);

    /* Les panneaux sont tous construits depuis la meme lecture. Changer de
       sous-vue ne rappelle donc ni les rosters ni les tables d'effets. */
    const overview = panneauAnalyse("overview");
    const dpsPanel = panneauAnalyse("dps");
    const supportsPanel = panneauAnalyse("supports");
    const ownersAvecRoster = new Set(
      membresAnalyses.map(item => item.owner)
    );
    const sansRoster = analyseGroupContext.status === "ready"
      && lectureRostersReussie
      ? analyseGroupContext.participants.filter(
        item => !ownersAvecRoster.has(item.owner)
      ).length
      : 0;
    const groupBanner = analyseGroupContext.status === "ready"
      ? bandeauGroupeAnalyse(analyseGroupContext, {
        lectureRostersReussie,
        sansRoster
      })
      : null;
    box.append(
      ...(groupBanner ? [groupBanner] : []),
      navigationAnalyse(box),
      overview,
      dpsPanel,
      supportsPanel
    );

    const cov = {}; ELEM_ORDER.forEach(e=>cov[e]={players:0,dps:0});
    players.forEach(p=>{
      const has={};
      (p.dps||[]).forEach(d=>{ const e=dpsElem(d); if(cov[e]){ cov[e].dps++; has[e]=true; } });
      ELEM_ORDER.forEach(e=>{ if(has[e]) cov[e].players++; });
    });
    const supports = resumeDesSupports(
      membresAnalyses, tablesLues, lectureRostersReussie
    );
    const totalDps = players.reduce((n, joueur) =>
      n + (joueur.dps || []).length, 0);
    const dpsFoudre = players.reduce((n, joueur) => n + (joueur.dps || [])
      .filter(personnage => dpsElem(personnage) === "THUNDER").length, 0);

    overview.appendChild(el("h2",{class:"an-title", text:"En un coup d'œil"}));
    overview.appendChild(el("div",{class:"analyse-summary"},[
      carteResume(
        lectureRostersReussie ? membresAnalyses.length : "—",
        "Membres analysés",
        lectureRostersReussie ? "rosters lus" : "lecture indisponible"
      ),
      carteResume(
        lectureRostersReussie ? totalDps : "—",
        "DPS recensés",
        "tous éléments"
      ),
      carteResume(
        lectureRostersReussie ? dpsFoudre : "—",
        "DPS Foudre",
        "prêts pour une composition Foudre"
      ),
      carteResume(
        supports ? supports.portes + " / " + supports.total : "—",
        "Supports couverts",
        supports ? "tous éléments" : "donnée indisponible"
      )
    ]));
    if(membresAnalyses.length){
      overview.appendChild(el("h2",{class:"an-title", text:"Couverture par élément"}));
      const covRow = el("div",{class:"cov-row"});
      ELEM_ORDER.forEach(e=>{
        const c = el("div",{class:"cov-card"});
        c.style.setProperty("--ec", elemColor(e));
        c.appendChild(elemBadge(e));
        c.appendChild(el("div",{class:"cov-nums"},[
          el("span",{class:"cov-big", text:String(cov[e].players)}),
          el("span",{class:"cov-lbl", text:"membre"+(cov[e].players>1?"s":"")})
        ]));
        c.appendChild(el("div",{class:"cov-sub", text:cov[e].dps+" DPS"}));
        covRow.appendChild(c);
      });
      overview.appendChild(covRow);
    }else{
      overview.appendChild(el("div",{class:"empty-state analyse-empty"},[
        el("p",{class:"big", text:lectureRostersReussie
          ? "Rien à analyser"
          : "Rosters indisponibles"}),
        el("p",{text:lectureRostersReussie
          ? "Ajoute des personnages dans l'onglet « Roster » pour calculer la couverture."
          : "La lecture des rosters a échoué. Les supports restent consultables sans afficher de fausse absence."})
      ]));
    }

    dpsPanel.appendChild(el("h2",{class:"an-title", text:"Matrice membre × élément"}));
    dpsPanel.appendChild(el("p",{class:"an-note",
      text:"Clique un élément pour classer les membres sur cette colonne, ou une case pour ouvrir le build correspondant."}));
    if(players.length){
      /* On aligne la selection sur les membres presents : un membre disparu
         depuis le dernier rendu (build supprime en direct) en sort tout seul,
         donc le filtre se soigne et la matrice ne peut pas se vider. */
      if(analyseMembres.size){
        const presents = new Set(players.map(joueur => joueur.owner));
        [...analyseMembres].forEach(owner => {
          if(!presents.has(owner)) analyseMembres.delete(owner);
        });
      }
      /* Le conteneur reste stable : changer de tri ou de filtre ne relit pas
         Supabase. Le filtre par membre se pose au-dessus, la matrice dessous. */
      const wrap = el("div",{class:"matrix-wrap"});
      dpsPanel.appendChild(filtreMembres(wrap, players));
      dpsPanel.appendChild(wrap);
      rendreMatrice(wrap, players);
    }else{
      dpsPanel.appendChild(el("div",{class:"empty-state analyse-empty"},[
        el("p",{class:"big", text:lectureRostersReussie
          ? "Aucun DPS recensé"
          : "Matrice indisponible"}),
        el("p",{text:lectureRostersReussie
          ? "Ajoute un personnage offensif dans l'onglet « Roster »."
          : "La lecture des rosters a échoué."})
      ]));
    }

    function rendreSupports(elementAFocaliser = null){
      supportsPanel.innerHTML = "";
      supportsPanel.appendChild(el("p",{class:"analyse-panel-intro",
        text:"Tous les effets utiles à la composition, avec sélection de plusieurs éléments."}));
      supportsPanel.appendChild(filtreElementsSupports(rendreSupports));
      SECTIONS_DU_RECENSEMENT.forEach(section => rendreRecensement(
        supportsPanel,
        section,
        membresAnalyses,
        tablesLues,
        lectureRostersReussie,
        analyseElementsSupports
      ));
      if(elementAFocaliser !== null){
        supportsPanel.querySelector(
          `[data-support-element="${elementAFocaliser}"]`
        )?.focus();
      }
    }
    rendreSupports();
    afficherSousVueAnalyse(box, analyseSousVue);
  }

enregistrerGestionnaireRoute("analyse", ouvrirRouteAnalyseGroupe);

export { renderAnalyse };
