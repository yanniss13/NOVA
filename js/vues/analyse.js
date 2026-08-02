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
import { sessionCourante } from "../etat/session.js";
import { charOf } from "../metier/catalogue.js";
import { favoriteRosterWeaponType } from "../metier/equipe-modele.js";
import {
  ELEMENTS,
  ENUM_TO_FOLDER,
  FOLDER_TO_ENUM,
  metaOf
} from "../noyau/constantes.js";
import { $, el } from "../noyau/dom.js";
import { owns } from "../noyau/outils.js";
import { sb } from "../noyau/supabase-client.js";
import { openRosterDetailFor, rosterDetail } from "./detail-roster.js";
import { ModalStack } from "./modal-stack.js";
import { openAuth } from "./modale-auth.js";
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
      .map(owner => rosterPlayerFrom(owner, nameOf(owner), byOwner[owner]))
      .filter(p => p.dps.length);
  }

  const ELEM_ORDER = ["FIRE","ICE","WIND","EARTH","HOLY","DARK","THUNDER"];
  const elemLabel = e => e==="HOLY" ? "Lumière" : (ELEMENTS[e] ? ELEMENTS[e].label : (e||"—"));
  const elemColor = e => ELEMENTS[e] ? ELEMENTS[e].color : "#8a8a8a";
  const elemOf = charId => { const m = metaOf(charId); return m ? (m.element||"").toUpperCase() : null; };
  // éléments POSSIBLES d'un perso (il en a un par type d'arme équipable)
  function charElements(charId){
    const m = metaOf(charId); if(!m) return [];
    const set = [];
    (m.weapons||[]).forEach(w=>{ const e=(w.element||"").toUpperCase(); if(e && e!=="DEFAULT" && !set.includes(e)) set.push(e); });
    if(!set.length && m.element) set.push((m.element||"").toUpperCase());
    return set;
  }
  // élément retenu pour une entrée DPS (choisi, sinon 1er possible)
  const dpsElem = d => (d.element||"").toUpperCase() || charElements(d.char)[0] || elemOf(d.char);

  function elemBadge(e){
    const b = el("span",{class:"elem-badge", title:elemLabel(e)});
    b.style.setProperty("--ec", elemColor(e));
    b.appendChild(el("span",{class:"dot"}));
    b.appendChild(el("span",{text:elemLabel(e)}));
    return b;
  }

  /* ============================ Analyse ============================ */
  let analyseElem = null;
  let analyseRenderId = 0;
  let analysePlayers = [];   // joueurs déjà chargés par renderAnalyse (filtrage local)

  function rankRowForFocusKey(root, key){
    if(!root || !key) return null;
    return [...root.querySelectorAll(".rank-action")].find(row =>
      row.dataset.owner === String(key.owner || "")
      && row.dataset.char === String(key.char || "")
      && row.dataset.elem === String(key.element || "")
    ) || null;
  }

  // Construit le tableau du classement dans son conteneur stable, à partir des
  // joueurs déjà chargés et de l'élément choisi. Aucune lecture réseau ici.
  function renderRankTable(rankBox){
    const entries = [];
    analysePlayers.forEach(p=>(p.dps||[]).forEach(d=>{
      if(dpsElem(d)===analyseElem){
        entries.push({
          player:p.name,
          owner:p.owner,
          characters:p.characters,
          dps:d
        });
      }
    }));
    entries.sort((a,b)=>(b.dps.pot||0)-(a.dps.pot||0));
    const rank = el("div",{class:"rank-table"});
    rank.appendChild(el("div",{class:"rank-row rank-head"},[
      el("span",{class:"rk-pos",text:"#"}), el("span",{class:"rk-player",text:"Membre"}),
      el("span",{class:"rk-dps",text:"DPS"}), el("span",{class:"rk-pot",text:"Potentiel"})
    ]));
    if(!entries.length) rank.appendChild(el("div",{class:"rank-empty", text:"Aucun DPS "+elemLabel(analyseElem)+" recensé."}));
    entries.forEach((en,i)=>{
      const ch=charOf(en.dps.char);
      const element = dpsElem(en.dps);
      const port=el("span",{class:"rk-portrait"});
      if(ch) port.appendChild(el("img",{src:ch.file,alt:"",loading:"lazy"}));
      const row = el("button",{
        class:"rank-row rank-action"+(i<3?" top":""),
        type:"button",
        dataset:{ owner:en.owner || "", char:en.dps.char, elem:element },
        onclick:()=>{
          const entry = (en.characters||[])
            .find(character => character.charId === en.dps.char);
          if(!entry) return;
          openRosterDetailFor({
            entries:[entry],
            index:0,
            memberName:en.player,
            weaponTypes:en.dps.weaponTypes,
            weaponType:en.dps.preferredWeaponType,
            showNavigation:false,
            returnFocusKey:{
              owner:en.owner,
              char:en.dps.char,
              element
            }
          });
        }
      },[
        el("span",{class:"rk-pos", text:String(i+1)}),
        el("span",{class:"rk-player", text:en.player}),
        el("span",{class:"rk-dps"},[
          port,
          el("span",{text: ch?ch.name:en.dps.char})
        ]),
        el("span",{
          class:"rk-pot",
          text:en.dps.pot>0 ? ("P"+en.dps.pot) : "—"
        })
      ]);
      rank.appendChild(row);
    });
    rankBox.replaceChildren(rank);
    /* Realtime peut remplacer la ligne qui a ouvert la modale. On corrige la
       cible de restitution dans la pile AVANT la fermeture ; ModalStack reste
       l'unique mécanisme qui déplace effectivement le focus. */
    const overlay = $("#rosterDetailOverlay");
    if(overlay.classList.contains("on") && rosterDetail.returnFocusKey){
      const replacement = rankRowForFocusKey(
        rankBox, rosterDetail.returnFocusKey
      );
      if(replacement) ModalStack.setRestoreFocus(overlay, replacement);
    }
  }

  async function renderAnalyse(){
    const renderId = ++analyseRenderId;
    const box = $("#analyseBody");
    /* Le rafraîchissement détache immédiatement les lignes du classement. Si
       celle qui a ouvert la modale ne réapparaît pas (build supprimé ou lecture
       en échec), l'onglet Analyse reste une cible logique et visible. Une ligne
       reconstruite remplacera ce repli dans `renderRankTable()`. */
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
    let players;
    try{
      players = await rosterDerivedPlayers();
    }catch(error){
      players = [];
      toast("Analyse indisponible pour l'instant.", true);
    }
    if(renderId !== analyseRenderId) return;
    box.innerHTML = "";
    if(!players.length){
      box.appendChild(el("div",{class:"empty-state"},[
        el("p",{class:"big",text:"Rien à analyser"}),
        el("p",{text:"Les DPS sont calculés depuis les rosters : ajoute des personnages offensifs dans l'onglet « Roster »."})
      ]));
      return;
    }

    // --- 1) Couverture par élément ---
    const cov = {}; ELEM_ORDER.forEach(e=>cov[e]={players:0,dps:0});
    players.forEach(p=>{
      const has={};
      (p.dps||[]).forEach(d=>{ const e=dpsElem(d); if(cov[e]){ cov[e].dps++; has[e]=true; } });
      ELEM_ORDER.forEach(e=>{ if(has[e]) cov[e].players++; });
    });
    box.appendChild(el("h2",{class:"an-title", text:"Couverture par élément"}));
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
    box.appendChild(covRow);

    // --- 2) Classement par élément ---
    // Le classement vit dans un conteneur stable : le clic sur un élément ne
    // remplace que ce conteneur (aucun rechargement Supabase, aucun reflow global).
    box.appendChild(el("h2",{class:"an-title", text:"Classement par potentiel"}));
    if(analyseElem===null){
      analyseElem = ELEM_ORDER.find(e=>cov[e].dps>0) || ELEM_ORDER[0];
    }
    analysePlayers = players;
    const chips = el("div",{class:"elem-chips"});
    const rankBox = el("div",{class:"rank-box"});
    ELEM_ORDER.forEach(e=>{
      chips.appendChild(el("button",{class:"elem-chip"+(e===analyseElem?" active":""),
        "aria-pressed": e===analyseElem ? "true" : "false",
        dataset:{elem:e},
        onclick:()=>{
          analyseElem=e;
          [...chips.children].forEach(b=>{
            const on = b.dataset.elem===analyseElem;
            b.classList.toggle("active", on);
            b.setAttribute("aria-pressed", on ? "true" : "false");
          });
          renderRankTable(rankBox);
        }},[ elemBadge(e) ]));
    });
    box.appendChild(chips);
    box.appendChild(rankBox);
    /* Le conteneur doit déjà être connecté : si Realtime reconstruit la vue
       pendant que la modale est ouverte, ModalStack refuse à juste titre une
       cible de focus détachée. */
    renderRankTable(rankBox);

    // --- 3) Matrice joueur × élément ---
    box.appendChild(el("h2",{class:"an-title", text:"Matrice membre × élément"}));
    const wrap = el("div",{class:"matrix-wrap"});
    const table = el("table",{class:"matrix"});
    const thead = el("tr",{},[ el("th",{class:"mx-player",text:"Membre"}), el("th",{text:"Total"}) ]);
    ELEM_ORDER.forEach(e=>{ const th=el("th",{}); th.appendChild(elemBadge(e)); thead.appendChild(th); });
    table.appendChild(thead);
    players.slice().sort((a,b)=>(b.dps||[]).length-(a.dps||[]).length).forEach(p=>{
      const tr=el("tr",{});
      tr.appendChild(el("td",{class:"mx-player", text:p.name}));
      tr.appendChild(el("td",{class:"mx-total", text:String((p.dps||[]).length)}));
      ELEM_ORDER.forEach(e=>{
        const cell = (p.dps||[]).filter(d=>dpsElem(d)===e)
          .sort((a,b)=>(b.pot||0)-(a.pot||0))
          .map(d=>{ const ch=charOf(d.char); return (ch?ch.name:d.char)+(d.pot>0?" P"+d.pot:""); });
        const td = el("td",{class:cell.length?"":"mx-empty"});
        if(cell.length) cell.forEach(t=>td.appendChild(el("div",{class:"mx-item",text:t})));
        else td.textContent="—";
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    wrap.appendChild(table);
    box.appendChild(wrap);
  }

export { renderAnalyse };
