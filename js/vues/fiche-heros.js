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
import {
  groupBuildStatResults,
  groupBuildTermsBySlot,
  summaryTermsFor
} from "../metier/stats-calcul.js";
import { MemberRosterStore } from "../donnees/roster-store.js";
import {
  formatBuildStatValue,
  gearTermLabel,
  statTermsDetails
} from "./stats-affichage.js";
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

  /* « PV de l'équipement » sous une pièce d'équipement dit deux fois la même
     chose, et la place manque : la modale affiche jusqu'à huit héros de neuf
     pièces. Le suffixe ne tombe que dans le résumé compact — le détail
     déplié garde le libellé entier du catalogue. */
  function shortStatLabel(label){
    return String(label).replace(/\s+de l’équipement$/, "")
      .replace(/\s+de l'équipement$/, "");
  }

  function contributionText(item){
    return shortStatLabel(item.label)+" "
      +formatBuildStatValue(item.value, item.unit)
      +(item.unit === "flat" ? "" : " %");
  }

  /* L'apport d'une pièce : un résumé toujours visible, le détail au clic.
     Le détail passe par la chaîne d'affichage déjà utilisée par les éditeurs,
     donc le membre y retrouve une présentation qu'il connaît. */
  function equipContribution(entry){
    const resume = summaryTermsFor(entry, 3);
    if(!resume.length){
      return el("span",{ class:"eq-contribution empty", text:"À configurer" });
    }
    const box = el("details",{class:"eq-contribution"});
    box.appendChild(el("summary",{ text:resume.map(contributionText).join(" · ") }));
    groupBuildStatResults(entry).forEach(group => {
      group.stats.forEach(stat => {
        box.appendChild(statTermsDetails(stat, {
          termLabel:gearTermLabel,
          termValue:term => formatBuildStatValue(term.value, term.unit),
          termProvenance:term => term.source.component
        }));
      });
    });
    return box;
  }

  /* `entry` vient de groupBuildTermsBySlot. Absente, la ligne se dessine
     comme avant : les appelants sans build à montrer restent valides. */
  function equipLine(file, slotLabel, variant, entry){
    const thumb = el("div",{class:"eq-thumb"+(variant?" "+variant:"")+(file?"":" empty")});
    if(file) thumb.style.backgroundImage = "url('"+file.replace(/'/g,"%27")+"')";
    const txt = el("div",{class:"eq-txt"},[
      el("span",{class:"eq-slot", text:slotLabel}),
      el("span",{class:"eq-name", text: file ? nameOfFile(file) : "—"})
    ]);
    if(file && entry) txt.appendChild(equipContribution(entry));
    return el("div",{class:"eq-line"+(file?"":" empty"), title: file ? nameOfFile(file) : ""},[
      thumb,
      txt
    ]);
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

    /* Une seule passe de calcul pour tout le héros : les termes sont déjà
       produits par l'agrégation, on ne fait que les ranger par emplacement. */
    const entries = groupBuildTermsBySlot(h);
    const entryOf = slot => entries.find(item => item.slot === slot) || null;

    const gear = el("div",{class:"hd-gear"});
    gear.appendChild(el("div",{class:"hd-group-t", text:"Arme"}));
    gear.appendChild(equipLine(h.weapon, "Arme", "weapon", entryOf("weapon")));
    gear.appendChild(el("div",{class:"hd-group-t", text:"Armures"}));
    ARMOR_SLOTS.forEach(s=>gear.appendChild(
      equipLine(h.armor ? h.armor[s] : null, ARMOR_LABELS[s], "", entryOf(s))
    ));
    gear.appendChild(el("div",{class:"hd-group-t", text:"Bijoux"}));
    JEWEL_SLOTS.forEach(s=>gear.appendChild(
      equipLine(h.jewel ? h.jewel[s] : null, JEWEL_LABELS[s], "jewel", entryOf(s))
    ));
    /* Le bonus d'ensemble n'appartient à aucune pièce : le répartir serait
       faux, le taire ferait que la somme des résumés ne fait plus le total. */
    const setEntry = entryOf("set");
    if(setEntry && setEntry.terms.length){
      gear.appendChild(el("div",{class:"hd-group-t", text:"Bonus d’ensemble"}));
      const bonus = el("div",{class:"eq-set-bonus"});
      bonus.appendChild(equipContribution(setEntry));
      gear.appendChild(bonus);
    }
    col.appendChild(gear);

    const stats = heroStatsSection(h);
    if(stats) col.appendChild(stats);

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
