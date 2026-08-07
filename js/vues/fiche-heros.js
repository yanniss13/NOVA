/* La fiche d'un heros : portrait, badges d'arme, equipement, stats, note.

   C'est le noyau commun aux deux modales de consultation — detail d'une
   equipe et detail du roster d'un membre. Le Builder et le roster des
   membres n'utilisent que le bloc de stats, pas la fiche entiere.
   Chacune l'appelle avec ses propres options plutot que de redessiner la
   fiche : `badgesFor` remplace la rangee de badges figee par un selecteur
   interactif, `canImport` ajoute le bouton d'import vers le roster.

   `equipLine` et `importTeamHeroToRoster` restent prives : seule la fiche
   s'en sert. Les trois autres sortent parce que le Builder et le Roster
   dessinent des badges sans passer par la fiche entiere.

   Le calcul des stats n'est pas ici : la fiche delegue a stats-heros.js. */

import { el } from "../noyau/dom.js";
import {
  ARMOR_LABELS,
  ARMOR_SLOTS,
  ELEMENTS,
  JEWEL_LABELS,
  JEWEL_SLOTS,
  WEAPON_ENUM,
  WSLOT_ROLES,
  metaOf
} from "../noyau/constantes.js";
import { authMessage } from "../noyau/supabase-client.js";
import { canManageTeam, sessionCourante } from "../etat/session.js";
import { charOf, nameOfFile } from "../metier/catalogue.js";
import { equippedEnumOf, weaponFolderOf, weaponTypesOf } from "../metier/armes.js";
import {
  normalizePotentiel,
  normalizeRosterBuild,
  normalizeRosterCharacter
} from "../metier/equipe-modele.js";
import { orderedBuildEntries } from "../metier/stats-calcul.js";
import { MemberRosterStore } from "../donnees/roster-store.js";
import { ouvrirCalculateur } from "./calculateur.js";
import { openPieceDetail } from "./detail-piece.js";
import { heroStatsSection } from "./stats-heros.js";
import { toast } from "./toast.js";

  // Badge d'un slot d'arme : icône d'arme + coin élément/rôle
  function weaponSlotBadge(ws, active){
    const w = WEAPON_ENUM[ws.weapon];
    if(!w) return null;
    const elu = (ws.element||"").toUpperCase();
    const elLbl = ELEMENTS[elu] ? ELEMENTS[elu].label : (ws.element||"");
    const roleLbl = WSLOT_ROLES[ws.role] || ws.role || "";
    const combo = (ws.element||"default").toLowerCase()+"_"+(ws.role||"").toLowerCase();
    const badge = el("span",{class:"wslot"+(active?" active":""),
      title: w.label+(elLbl?" · "+elLbl:"")+(roleLbl?" · "+roleLbl:"")+(active?" (équipée)":"")});
    badge.appendChild(el("img",{class:"wslot-w", src:"7ds-ui/mastery/"+w.icon+".webp", alt:w.label, loading:"lazy"}));
    badge.appendChild(el("img",{class:"wslot-e", src:"7ds-ui/role-elements/"+combo+".webp", alt:"", loading:"lazy"}));
    return badge;
  }

  // Rangée de badges. L'élément et les badges suivent l'ARME ÉQUIPÉE.
  // Builder (compact=false) : les 3 armes possibles, l'équipée surlignée.
  // Roster (compact=true)   : seulement l'arme équipée (compact, aligné).
  function badgesRow(ch, hero, compact){
    const m = ch ? metaOf(ch.id) : null;
    if(!m || !m.weapons || !m.weapons.length) return compact ? el("div",{class:"hero-badges mini-badges"}) : null;

    const eq = equippedEnumOf(hero);
    const active = eq ? m.weapons.find(s => s.weapon === eq) : null;
    const row = el("div",{class:"hero-badges"+(compact?" mini-badges":"")});

    const slots = el("div",{class:"wslots"});
    if(compact){
      if(active){ const b = weaponSlotBadge(active, true); if(b) slots.appendChild(b); }
    } else {
      m.weapons.forEach(ws=>{
        const b = weaponSlotBadge(ws, !!active && ws.weapon === active.weapon);
        if(!b) return;
        if(active && ws.weapon !== active.weapon) b.classList.add("dim");
        slots.appendChild(b);
      });
    }
    if(slots.children.length) row.appendChild(slots);

    // en compact on renvoie toujours la rangée (réserve la hauteur -> colonnes alignées)
    return compact ? row : (row.children.length ? row : null);
  }

  /* La ligne d'une pièce. `onOpen` présente, elle devient un bouton qui
     ouvre l'apport de la pièce ; absente, elle reste un simple div — un
     emplacement vide n'a rien à montrer. */
  function equipLine(file, slotLabel, variant, onOpen){
    const thumb = el("div",{class:"eq-thumb"+(variant?" "+variant:"")+(file?"":" empty")});
    if(file) thumb.style.backgroundImage = "url('"+file.replace(/'/g,"%27")+"')";
    const txt = el("div",{class:"eq-txt"},[
      el("span",{class:"eq-slot", text:slotLabel}),
      el("span",{class:"eq-name", text: file ? nameOfFile(file) : "—"})
    ]);
    if(!file || !onOpen){
      return el("div",{class:"eq-line"+(file?"":" empty"), title: file ? nameOfFile(file) : ""},[
        thumb,
        txt
      ]);
    }
    const line = el("button",{
      class:"eq-line",
      type:"button",
      title:nameOfFile(file),
      "aria-label":"Voir l’apport — "+nameOfFile(file)
    },[
      thumb,
      txt,
      el("span",{class:"eq-chevron", "aria-hidden":"true", text:"›"})
    ]);
    line.addEventListener("click", ()=>onOpen(line));
    return line;
  }

  function heroDetail(h, options){
    const settings = options || {};
    const ch = h && h.char ? charOf(h.char) : null;
    const col = el("div",{class:"hdetail"});

    const port = el("div",{class:"hd-portrait"});
    if(ch) port.appendChild(el("img",{src:ch.file, alt:ch.name, loading:"lazy"}));
    else port.textContent = "—";
    const idBox = el("div",{class:"hd-id"},[
      el("div",{class:"hd-name"+(ch?"":" empty"), text: ch ? ch.name : "Emplacement libre"})
    ]);
    /* `badgesFor` remplace la rangée de badges figée par un sélecteur
       interactif (modal du roster d'un membre). */
    const badges = ch
      ? (settings.badgesFor ? settings.badgesFor(ch, h) : badgesRow(ch, h, false))
      : null;
    if(badges) idBox.appendChild(badges);
    col.appendChild(el("div",{class:"hd-head"},[port, idBox]));

    if(!ch) return col;

    if(h.potentiel && h.potentiel.tier > 0)
      col.appendChild(el("div",{class:"hd-pot", text:"✦ P"+h.potentiel.tier}));

    /* Une seule passe de calcul pour tout le héros, et un seul ordre de
       parcours : la position affichée dans la modale doit correspondre à
       ce que le membre voit ici. */
    const entries = orderedBuildEntries(h);
    const indexOfSlot = slot => entries.findIndex(item => item.slot === slot);
    const opener = slot => {
      const index = indexOfSlot(slot);
      if(index < 0) return null;
      return trigger => openPieceDetail(entries, index, trigger);
    };

    const gear = el("div",{class:"hd-gear"});
    gear.appendChild(el("div",{class:"hd-group-t", text:"Arme"}));
    gear.appendChild(equipLine(h.weapon, "Arme", "weapon", opener("weapon")));
    gear.appendChild(el("div",{class:"hd-group-t", text:"Armures"}));
    ARMOR_SLOTS.forEach(s=>gear.appendChild(
      equipLine(h.armor ? h.armor[s] : null, ARMOR_LABELS[s], "", opener(s))
    ));
    gear.appendChild(el("div",{class:"hd-group-t", text:"Bijoux"}));
    JEWEL_SLOTS.forEach(s=>gear.appendChild(
      equipLine(h.jewel ? h.jewel[s] : null, JEWEL_LABELS[s], "jewel", opener(s))
    ));
    /* Le bonus d'ensemble n'est pas une pièce : il n'a ni vignette ni
       emplacement, mais il a un apport, donc il a sa ligne et sa place dans
       le parcours. */
    const setIndex = indexOfSlot("set");
    if(setIndex >= 0 && entries[setIndex].terms.length){
      const bonus = el("button",{
        class:"eq-line eq-set-line",
        type:"button",
        "aria-label":"Voir l’apport — bonus d’ensemble"
      },[
        el("div",{class:"eq-txt"},[
          el("span",{class:"eq-name", text:"Bonus d’ensemble"})
        ]),
        el("span",{class:"eq-chevron", "aria-hidden":"true", text:"›"})
      ]);
      bonus.addEventListener("click", ()=>openPieceDetail(entries, setIndex, bonus));
      gear.appendChild(bonus);
    }
    col.appendChild(gear);

    const stats = heroStatsSection(h);
    if(stats) col.appendChild(stats);

    /* La fiche ne calcule aucun degat elle-meme : un seul calcul, un seul
       endroit a corriger. Le lien porte le heros ET son type d'arme, pour que
       la page s'ouvre sur le build qu'on regardait. */
    const typeCalcul = weaponFolderOf(h.weapon);
    if(h.char && typeCalcul){
      col.appendChild(el("button",{
        class:"btn btn-ghost hd-calcul",
        type:"button",
        text:"Calculer les dégâts",
        onclick:()=>{ void ouvrirCalculateur(h.char, typeCalcul, h); }
      }));
    }

    if(h.note && h.note.trim())
      col.appendChild(el("div",{class:"hd-note", text:h.note.trim()}));

    if(settings.canImport && h && h.char){
      const type = weaponFolderOf(h.weapon);
      const valid = type && weaponTypesOf(h.char).includes(type);
      const props = {
        class:"btn hd-roster-import",
        type:"button",
        title:valid ? "" : "Équipe d’abord une arme compatible.",
        text:settings.hasBuild(h.char, type)
          ? "Mettre à jour ce build dans mon roster"
          : "Ajouter au roster",
        onclick:()=>{ if(valid) void importTeamHeroToRoster(settings.team, h); }
      };
      if(!valid) props.disabled = "disabled";
      col.appendChild(el("button",props));
    }
    return col;
  }

  async function importTeamHeroToRoster(team, hero){
    if(!sessionCourante.user || !canManageTeam(team)) return;
    const type = weaponFolderOf(hero && hero.weapon);
    if(!hero || !hero.char || !type
      || !weaponTypesOf(hero.char).includes(type)){
      toast("Équipe d’abord une arme compatible.", true);
      return;
    }
    try{
      await MemberRosterStore.refresh(sessionCourante.user.id);
    }catch(error){
      if(!MemberRosterStore.all(sessionCourante.user.id).length){
        toast("Roster indisponible : "+authMessage(error), true);
        return;
      }
    }
    const existing = MemberRosterStore.all(sessionCourante.user.id)
      .find(entry => entry.charId === hero.char);
    const replacing = !!existing
      && Object.prototype.hasOwnProperty.call(existing.builds, type);
    const character = charOf(hero.char);
    if(replacing && !confirm(
      "Remplacer le build "+type+" de "+(character ? character.name : hero.char)+" ?"
    )) return;

    const next = normalizeRosterCharacter(existing || {
      owner:sessionCourante.user.id,
      charId:hero.char,
      potentialTier:hero.potentiel && hero.potentiel.tier,
      builds:{}
    });
    next.potentialTier = normalizePotentiel(hero.potentiel).tier;
    const importedBuild = normalizeRosterBuild(hero.char, type, hero);
    importedBuild.favorite = !!(
      existing
      && existing.builds[type]
      && existing.builds[type].favorite
    );
    next.builds[type] = importedBuild;
    try{
      await MemberRosterStore.upsert(next);
      toast(replacing
        ? "Build mis à jour dans ton roster."
        : "Personnage ajouté à ton roster.");
    }catch(error){
      toast("Import impossible : "+authMessage(error), true);
    }
  }

export {
  badgesRow,
  heroDetail,
  weaponSlotBadge
};
