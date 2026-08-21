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
  FOLDER_TO_ENUM,
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
  calculateHeroStats,
  orderedBuildEntries
} from "../metier/stats-calcul.js";
import { CIBLES, degatsDuCycle } from "../metier/degats-calcul.js";
import { effetsDuBuild } from "../metier/dps-effets.js";
import { simulerDpsCompetences } from "../metier/dps-simulation.js";
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

  /* Le classement compare les builds d'un MEME heros : la cible n'a qu'a
     rester constante d'une ligne a l'autre. Le palier 1 d'Akumu est celui que
     la page affichait quand il etait la seule cible connue. Le figer ici evite
     qu'un changement de palier dans le calculateur deplace un classement que
     personne n'a touche. */
  const CIBLE_CLASSEMENT = CIBLES[0];

  /* Les deux catalogues du classement pesent 1,4 Mo : effets-dps.js est le
     deuxieme fichier du depot par la taille. Les charger au demarrage les
     ferait payer a chaque visiteur qui n'ouvre jamais une fiche de heros.
     Motif repris de js/vues/calculateur.js. */
  let chargementDps = null;

  function cataloguesDpsPrets(){
    return Boolean(typeof window !== "undefined"
      && window.SEVEN_DS_COMPETENCES && window.SEVEN_DS_EFFETS_DPS);
  }

  function chargerCataloguesDps(){
    if(cataloguesDpsPrets()) return Promise.resolve(true);
    if(chargementDps) return chargementDps;
    const injecter = src => new Promise((resolve, reject) => {
      document.head.appendChild(el("script",{
        src, onload:()=>resolve(true),
        onerror:()=>reject(new Error("catalogue introuvable : "+src))
      }));
    });
    chargementDps = Promise.all([
      window.SEVEN_DS_COMPETENCES
        ? Promise.resolve(true) : injecter("./data/competences.js"),
      window.SEVEN_DS_EFFETS_DPS
        ? Promise.resolve(true) : injecter("./data/effets-dps.js")
    ]).catch(erreur => {
      /* Rejouable : un echec reseau ne doit pas condamner la fiche pour toute
         la duree de la session. */
      chargementDps = null;
      throw erreur;
    });
    return chargementDps;
  }

  /* Les competences du catalogue rattachees a un build du roster. Le roster
     range ses builds par DOSSIER d'image (« Hache »), la source les publie par
     ENUM (« Axe ») : FOLDER_TO_ENUM fait le pont, et il existait deja. */
  function competencesDuBuild(charId, dossierArme){
    const catalogue = (typeof window !== "undefined"
      && window.SEVEN_DS_COMPETENCES) || {};
    const enumArme = FOLDER_TO_ENUM[dossierArme];
    if(!enumArme) return [];
    return (catalogue[charId] || [])
      .filter(competence => competence.weaponType === enumArme);
  }

  /* Les entrees du moteur, lues par CODE dans le resultat groupe.
     `calculateBuildStats` n'est pas exportee : `calculateHeroStats` est la
     porte publique. Un statut autre que `valid` ou `partial` ne porte aucun
     chiffre — la ligne est alors absente plutot que fausse. */
  function resultatStatsDeFrappe(hero){
    const result = calculateHeroStats(hero);
    if(!result || (result.status !== "valid" && result.status !== "partial")){
      return null;
    }
    const atk = result.totals.find(total => total.stat === "B_Atk");
    return atk && typeof atk.value === "number" ? result : null;
  }

  function statsDeCycleHistorique(statsResult){
    const totaux = statsResult && Array.isArray(statsResult.totals)
      ? statsResult.totals : [];
    const valeur = stat => {
      const ligne = totaux.find(total => total.stat === stat);
      return ligne && typeof ligne.value === "number" ? ligne.value : 0;
    };
    const atk = valeur("B_Atk");
    return typeof atk === "number" ? {
      atk,
      critRate:valeur("C_Critical_Rate"),
      critDamage:valeur("C_Critical_Dam_Rate"),
      bonusType:0
    } : null;
  }

  function competencesDpsDuBuild(charId, dossierArme){
    const competences = competencesDuBuild(charId, dossierArme);
    const catalogue = (typeof window !== "undefined"
      && window.SEVEN_DS_EFFETS_DPS) || {};
    const enumArme = FOLDER_TO_ENUM[dossierArme];
    const synthetiques = Object.entries(catalogue.skills || {})
      .filter(([, competence]) => competence.synthetic
        && competence.weaponType === enumArme)
      .map(([gameId, competence]) => Object.assign({ gameId }, competence));
    return competences.concat(synthetiques);
  }

  /* Deux builds enregistres au minimum : avec un seul, un classement n'apprend
     rien, et rien ne justifie de telecharger 1,4 Mo de catalogues. */
  function classementPossible(hero){
    return Object.keys((hero && hero.rosterBuilds) || {}).length >= 2;
  }

  function parDpsPuisParCycle(a, b){
    const aConnu = Number.isFinite(a.dps);
    const bConnu = Number.isFinite(b.dps);
    if(aConnu !== bConnu) return aConnu ? -1 : 1;
    return aConnu ? b.dps - a.dps : b.cycle - a.cycle;
  }

  /* Le classement des builds enregistres, du plus fort au plus faible.
     Un build dont aucune competence n'est connue est ABSENT du classement :
     l'afficher a zero le ferait passer pour mauvais alors qu'il est seulement
     inconnu du catalogue — le cas de Gowther, dont la source ne publie aucun
     coefficient. */
  function classementPuissance(hero){
    const builds = (hero && hero.rosterBuilds) || {};
    if(!classementPossible(hero)) return [];
    return Object.keys(builds)
      .map(dossierArme => {
        const build = builds[dossierArme] || {};
        const competences = competencesDuBuild(hero.char, dossierArme);
        if(!competences.length) return null;
        const actif = Object.assign({}, hero, {
          weapon:build.weapon,
          weaponConfig:build.weaponConfig,
          armor:build.armor,
          armorConfig:build.armorConfig,
          jewel:build.jewel,
          jewelConfig:build.jewelConfig,
          activeWeaponType:dossierArme
        });
        const statsResult = resultatStatsDeFrappe(actif);
        if(!statsResult) return null;
        const catalogue = (typeof window !== "undefined"
          && window.SEVEN_DS_EFFETS_DPS) || {};
        const contexte = effetsDuBuild({
          hero:actif,
          dossierArme,
          catalogue,
          statsResult
        });
        const cycle = degatsDuCycle({
          stats:statsDeCycleHistorique(statsResult),
          competences,
          cible:CIBLE_CLASSEMENT
        });
        const simulation = simulerDpsCompetences({
          stats:contexte.stats,
          competences:competencesDpsDuBuild(hero.char, dossierArme),
          effets:contexte.effets,
          cible:CIBLE_CLASSEMENT,
          duree:60
        });
        const categoriesDps = new Set([
          "NORMAL_SKILL", "ACTIVE_THIRD", "ULTIMATE"
        ]);
        const nonChiffrees = competences.filter(competence =>
          categoriesDps.has(competence.categorie)
          && !(competence.composantes || []).some(composante =>
            Number.isFinite(Number(composante.pourcentage))
          )
        ).length;
        return cycle ? {
          arme:dossierArme,
          cycle:cycle.total,
          dps:Number.isFinite(simulation.dps) ? simulation.dps : null,
          nonInclus:nonChiffrees + contexte.nonInclus.length
            + simulation.nonInclus.length,
          exclusions:contexte.nonInclus.concat(simulation.nonInclus),
          ouverture:simulation.ouverture.map(action => action.nom),
          priorites:simulation.priorites,
          rotation:simulation.rotation,
          hypotheses:simulation.hypotheses
        } : null;
      })
      .filter(Boolean)
      .sort(parDpsPuisParCycle);
  }

  function libelleHypothese(hypothese){
    const libelles = {
      "passifs-personnels-actifs-au-maximum":
        "Passifs personnels activés au maximum de leur niveau réel",
      "cumuls-personnels-au-maximum":"Cumuls personnels au maximum",
      "pv-restants-egaux-aux-pv-max":"PV restants égaux aux PV max",
      "ressources-illimitees":"Ressources illimitées",
      "animations-non-mesurees":"Animations non mesurées",
      "attaques-normales-non-chiffrees":"Attaques normales non chiffrées"
    };
    return libelles[hypothese] || hypothese;
  }

  function listeDetail(titre, valeurs, ordonnee){
    if(!Array.isArray(valeurs) || !valeurs.length) return null;
    return el("div",{class:"hd-puissance-groupe"},[
      el("strong",{text:titre}),
      el(ordonnee ? "ol" : "ul",{class:"hd-puissance-rotation"},
        valeurs.map(valeur => el("li",{text:String(valeur)})))
    ]);
  }

  function detailRotation(ligne){
    const chronologie = (ligne.rotation || [])
      .filter(evenement => evenement.type !== "attente")
      .map(evenement => {
        const temps = Number(evenement.temps || 0).toFixed(1).replace(".", ",");
        return temps+" s — "+(evenement.nom || evenement.gameId || "Effet");
      });
    const exclusions = (ligne.exclusions || []).map(exclusion =>
      exclusion.texteFr || exclusion.nom || exclusion.id || exclusion.raison
    );
    const details = el("details",{class:"hd-puissance-detail"},[
      el("summary",{text:"Rotation optimale selon les données connues"})
    ]);
    [
      listeDetail("Ouverture", ligne.ouverture, true),
      listeDetail("Priorité", ligne.priorites, false),
      listeDetail("Chronologie", chronologie, false),
      listeDetail("Hypothèses", (ligne.hypotheses || []).map(libelleHypothese), false),
      listeDetail("Non inclus dans le calcul", exclusions, false)
    ].filter(Boolean).forEach(groupe => details.appendChild(groupe));
    return details;
  }

  function puissanceSection(classement){
    if(!Array.isArray(classement) || classement.length < 2) return null;
    const lignes = classement.slice().sort(parDpsPuisParCycle);
    const nonInclus = lignes.reduce((total, ligne) =>
      total + (Number.isInteger(ligne.nonInclus) && ligne.nonInclus > 0
        ? ligne.nonInclus
        : 0), 0);
    const contenu = [
      el("strong",{text:"Puissance par arme"}),
      el("p",{class:"hd-puissance-note",
        text:"DPS des compétences sur 60 s — théorique. Ressources illimitées, "
          + "passifs personnels activés au maximum de leur niveau réel. "
          + "Attaques normales et temps d'animation non chiffrés."})
    ];
    if(nonInclus){
      contenu.push(el("p",{
        class:"hd-puissance-note hd-puissance-non-inclus"
      },[
        el("strong",{text:"Non inclus dans le calcul"}),
        " : "+nonInclus+" effet"+(nonInclus > 1 ? "s" : "")
          +" non chiffré"+(nonInclus > 1 ? "s" : "")+"."
      ]));
    }
    const bloc = el("section",{
      class:"hd-puissance",
      dataset:{ puissance:String(lignes.length) }
    }, contenu);
    lignes.forEach(ligne => {
      const mesures = el("span",{class:"hd-puissance-mesures"},[
        el("span",{},[
          el("span",{text:"DPS des compétences sur 60 s : "}),
          el("span",{class:"hd-puissance-valeur",
            text:Number.isFinite(ligne.dps)
              ? new Intl.NumberFormat("fr-FR").format(Math.round(ligne.dps))+"/s"
              : "Non disponible"})
        ]),
        el("span",{},[
          el("span",{text:"Dégâts d'un cycle : "}),
          el("span",{class:"hd-puissance-valeur secondaire",
            text:new Intl.NumberFormat("fr-FR").format(Math.round(ligne.cycle))})
        ])
      ]);
      bloc.appendChild(el("div",{class:"hd-puissance-ligne"},[
        el("strong",{text:ligne.arme}),
        mesures,
        detailRotation(ligne)
      ]));
    });
    return bloc;
  }

  /* La fiche s'ouvre sans attendre le reseau : tant que les catalogues ne sont
     pas la, la section annonce son attente puis se remplace elle-meme. Une
     fiche refermee entre-temps laisse un noeud detache, et `replaceWith` n'y
     fait rien — c'est la sortie voulue, pas un cas a rattraper. */
  function ajouterPuissance(col, hero){
    if(!classementPossible(hero)) return;
    if(cataloguesDpsPrets()){
      const bloc = puissanceSection(classementPuissance(hero));
      if(bloc) col.appendChild(bloc);
      return;
    }
    const attente = el("section",{
      class:"hd-puissance",
      dataset:{ puissance:"attente" }
    },[
      el("strong",{text:"Puissance par arme"}),
      el("p",{class:"hd-puissance-note", text:"Chargement du catalogue…"})
    ]);
    col.appendChild(attente);
    chargerCataloguesDps().then(() => {
      const bloc = puissanceSection(classementPuissance(hero));
      if(bloc) attente.replaceWith(bloc);
      else attente.remove();
    }).catch(() => {
      attente.replaceWith(el("section",{class:"hd-puissance"},[
        el("strong",{text:"Puissance par arme"}),
        el("p",{class:"hd-puissance-note",
          text:"Catalogue indisponible : le classement n'a pas pu être calculé."})
      ]));
    });
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

    /* Classement des builds enregistres. Il n'apparait qu'a partir de DEUX
       builds chiffrables : avec un seul, un classement n'apprend rien. */
    ajouterPuissance(col, h);
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
