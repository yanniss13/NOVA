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
import {
  lignesDeSoutien,
  porteursDeLaLigne
} from "../metier/recensement-supports.js";
import { charOf } from "../metier/catalogue.js";
import { favoriteRosterWeaponType } from "../metier/equipe-modele.js";
import {
  ELEMENTS,
  ENUM_TO_FOLDER,
  FOLDER_TO_ENUM,
  metaOf,
  WEAPON_ENUM
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
  const elemLabel = e => e==="HOLY" ? "Lumière" : (ELEMENTS[e] ? ELEMENTS[e].label : (e||"—"));
  const elemColor = e => ELEMENTS[e] ? ELEMENTS[e].color : "#8a8a8a";
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

  function elemBadge(e){
    const b = el("span",{class:"elem-badge", title:elemLabel(e)});
    b.style.setProperty("--ec", elemColor(e));
    b.appendChild(el("span",{class:"dot"}));
    b.appendChild(el("span",{text:elemLabel(e)}));
    return b;
  }

  /* Les deux tables du recensement sont chargees A LA DEMANDE, comme au
     calculateur : un visiteur qui n'ouvre jamais l'Analyse ne doit pas les
     payer.

     On ne reutilise PAS chargerCatalogues() de js/vues/calculateur.js : il en
     charge sept, dont cinq que l'Analyse ne lit jamais - competences.js pese a
     lui seul 7491 lignes. Un echec remet la promesse a null : une coupure
     reseau ne doit pas condamner les sections pour toute la session. */
  const TABLES_DU_RECENSEMENT = [
    { global:"SEVEN_DS_BUFFS_SUPPORTS", src:"./data/buffs-supports.js" },
    { global:"SEVEN_DS_PASSIFS_GRAVES", src:"./data/passifs-graves.js" }
  ];
  let chargementDesTables = null;
  function injecter(src){
    return new Promise((resolve, reject) => {
      document.head.appendChild(el("script",{
        src,
        onload:() => resolve(true),
        onerror:() => reject(new Error("catalogue introuvable : " + src))
      }));
    });
  }
  function chargerTablesDuRecensement(){
    const manquantes = TABLES_DU_RECENSEMENT.filter(t => !window[t.global]);
    if(!manquantes.length) return Promise.resolve(true);
    if(chargementDesTables) return chargementDesTables;
    chargementDesTables = Promise.all(manquantes.map(t => injecter(t.src)))
      .then(() => true)
      .catch(erreur => {
        chargementDesTables = null;
        throw erreur;
      });
    return chargementDesTables;
  }

  /* La pastille « tous elements », de la MEME forme que celle d'un element.

     Le texte gris qu'elle remplace revenait sur quarante lignes sur soixante-
     six : c'est le cas par defaut, pas une information, et il rompait la
     colonne en alternant du texte et des badges. */
  function badgeTous(){
    const b = el("span",{class:"elem-badge db-tous",
      title:"Cet effet ne dépend d'aucun élément"});
    b.style.setProperty("--ec", "#6f6960");
    b.appendChild(el("span",{class:"dot"}));
    b.appendChild(el("span",{text:"Tous"}));
    return b;
  }

  /* Un dix-millieme rendu lisible : 1500 et -1 donnent « −15 % ».

     Le sens vient du libelle, pas de la valeur, qui n'est qu'une magnitude.
     `fr-FR` pose la virgule decimale, et deux decimales suffisent : la table
     ne descend pas plus bas. */
  function pourcent(valeur, sens){
    const nombre = (valeur / 100)
      .toLocaleString("fr-FR", { maximumFractionDigits:2 });
    return (sens < 0 ? "−" : "+") + nombre + " %";
  }

  /* CE QUE CE PORTEUR APPORTE, en toutes lettres.

     Une ligne d'arme ne dit rien de plus que son potentiel. Une ligne de tenue
     gravee, elle, vaut trois valeurs selon le niveau du passif — jusqu'au
     TRIPLE d'ecart — et le libelle n'annonce que le maximum. Ecrire « · N2 »
     laissait le membre chercher lui-meme ce que valait un niveau 2 ; on ecrit
     donc la valeur, et le niveau passe en infobulle.

     Le niveau inconnu reste dit : c'est un champ a remplir, et le supposer
     plein promettrait le maximum a quelqu'un qui ne l'a peut-etre pas. */
  function apportDuPorteur(ligne, porteur){
    if(ligne.source !== "tenue") return { suffixe:"", titre:"" };
    if(!porteur.niveau) return { suffixe:" · niv. ?", titre:"" };
    const valeur = ligne.niveaux ? ligne.niveaux[porteur.niveau - 1] : null;
    if(valeur == null || ligne.sens === null){
      return { suffixe:" · N" + porteur.niveau, titre:"" };
    }
    return {
      suffixe:" · " + pourcent(valeur, ligne.sens),
      titre:"Passif de niveau " + porteur.niveau + " sur 3"
    };
  }

  /* UNE LIGNE DE RECENSEMENT, quelle que soit la section.

     Les deux sections posent la meme question - qui apporte quoi - et ne
     different que par le camp vise. Une seule fonction les rend donc, et le
     jour ou l'affichage doit changer, il change pour les deux.

     `lectureRostersReussie` distingue deux etats que rien ne doit confondre :
     « personne ne l'a » est une affirmation, « on n'a pas pu lire » est un
     aveu d'ignorance. Les afficher pareil ferait croire a une absence certaine
     sur une simple coupure reseau.

     `teteDeGroupe` dit si cette ligne ouvre le groupe de son personnage. Elle
     seule porte le portrait et le nom : Gil Thunder tenait trois lignes de
     suite, Gowther trois autres, et repeter le nom ne l'apprenait a personne.
     Les porteurs arrivent tout calcules - le groupe en a besoin AVANT le rendu
     pour se classer, et les recalculer ici ferait le travail deux fois. */
  function ligneDuRecensement(ligne, porteurs, lectureRostersReussie, teteDeGroupe){
    const ch = charOf(ligne.support);
    /* D'ou vient l'effet : l'arme qui le porte, ou la tenue gravee. Sans cette
       precision la ligne serait trompeuse - un membre irait monter la mauvaise
       arme, ou chercher un passif sur la mauvaise piece. */
    const origine = ligne.source === "tenue"
      ? ligne.tenueNom
      : (ligne.arme && WEAPON_ENUM[ligne.arme]
          ? WEAPON_ENUM[ligne.arme].label : "—");

    /* La cellule reste presente meme vide sur les lignes de suite : c'est elle
       qui aligne toutes les colonnes d'un bout a l'autre de la liste, et son
       filet gauche relie visuellement le groupe. */
    const perso = el("span",{class:"db-perso"});
    if(teteDeGroupe){
      const portrait = el("span",{class:"rk-portrait"});
      if(ch) portrait.appendChild(el("img",{src:ch.file,alt:"",loading:"lazy"}));
      perso.appendChild(portrait);
      perso.appendChild(el("span",{class:"db-nom",
        text:ch ? ch.name : (ligne.support || "—")}));
    }

    const effet = el("span",{class:"db-effet"},[
      el("span",{class:"db-libelle", text:ligne.libelle})
    ]);
    /* LE TOTAL, quand le libelle ne donne que le taux unitaire. Douze lignes
       obligeaient a multiplier de tete — « −0,15 % par cumul, 100 cumuls » —
       pour arriver au seul chiffre comparable d'une ligne a l'autre. */
    if(ligne.totalCumule !== null && ligne.sens !== null){
      effet.appendChild(el("span",{
        class:"db-total",
        title:"Total une fois les cumuls au maximum",
        text:pourcent(ligne.totalCumule, ligne.sens)
      }));
    }
    /* La mention est le pendant a l'ecran du drapeau `horsCalcul` : sans elle,
       le membre lirait un malus chiffre et le croirait compte dans ses
       degats. */
    if(ligne.horsCalcul){
      effet.appendChild(el("span",{
        class:"db-hors-calcul",
        title:"Effet réel, mais absent du calcul : le moteur n'a pas d'entrée pour la résistance élémentaire, et la mécanique du jeu n'a pas été mesurée.",
        text:"hors calcul"
      }));
    }
    /* Une tenue gravee vaut trois valeurs selon son niveau de passif, et le
       libelle annonce le MAXIMUM. On le dit, sinon la ligne promet a tout le
       monde ce que seul un passif de niveau 3 rend. */
    if(ligne.source === "tenue"){
      effet.appendChild(el("span",{class:"db-au-max", text:"au niv. 3"}));
    }

    const qui = el("span",{class:"db-porteurs"});
    if(porteurs.length){
      porteurs.forEach(p => {
        /* P0 est un potentiel RENSEIGNE, pas une valeur manquante : on l'ecrit
           comme les autres. */
        const apport = apportDuPorteur(ligne, p);
        const porteur = el("span",{
          class:"db-porteur" + (ligne.source === "tenue" && !p.niveau
            ? " db-niveau-inconnu" : ""),
          text:p.nom + " P" + p.potentiel + apport.suffixe
        });
        /* Pose seulement s'il y a quelque chose a dire : un `title` vide est
           un attribut de plus dans le DOM et rien pour le lecteur. */
        if(apport.titre) porteur.title = apport.titre;
        qui.appendChild(porteur);
      });
    }else if(lectureRostersReussie){
      qui.appendChild(el("span",{class:"db-personne", text:"Personne"}));
    }else{
      qui.appendChild(el("span",{
        class:"db-personne",
        text:"Porteurs indisponibles"
      }));
    }

    return el("div",{
      /* Grisee, jamais retiree. Et jamais grisee sur une lecture en echec : le
         gris dit « la confrerie ne l'a pas », ce qu'on ignore alors. */
      class:"debuff-row"
        + (teteDeGroupe ? "" : " db-suite")
        + (lectureRostersReussie && !porteurs.length ? " db-absente" : ""),
      dataset:{ source:ligne.source, vise:ligne.vise }
    },[
      perso,
      el("span",{class:"db-origine", text:origine}),
      effet,
      ligne.element
        ? elemBadge(String(ligne.element).toUpperCase())
        : badgeTous(),
      qui
    ]);
  }

  /* LES GROUPES D'UNE SECTION : un par personnage, dans l'ordre ou le membre
     a interet a les lire.

     Le tri alphabetique d'origine dispersait les trois lignes que la confrerie
     porte au milieu de vingt-cinq qui ne concernent personne. Ici les groupes
     portes passent devant, du plus haut potentiel au plus bas ; le reste suit
     par ordre alphabetique, grise mais entier - un effet que personne n'a
     reste une information, et c'est meme celle qui fait recruter.

     `potentiel` vaut -1 quand aucune ligne du groupe n'est portee : c'est ce
     qui separe les deux blocs, et P0 doit rester du bon cote — un potentiel
     zero est renseigne, pas manquant. */
  function groupesDuRecensement(vise, membres){
    const parSupport = new Map();
    lignesDeSoutien()
      /* L'Analyse sert ici a preparer les compositions Foudre de la
         confrerie. Les effets generaux restent utiles a toute equipe ; les
         bonus propres aux autres elements restent dans le catalogue pour le
         calculateur, mais n'encombrent plus ce recensement. */
      .filter(ligne => ligne.vise === vise && ligneVisibleDansAnalyse(ligne))
      .forEach(ligne => {
        const cle = ligne.support || "";
        if(!parSupport.has(cle)) parSupport.set(cle, []);
        parSupport.get(cle).push({
          ligne,
          porteurs:porteursDeLaLigne(ligne, membres)
        });
      });
    return [...parSupport.entries()]
      .map(([support, lignes]) => {
        const ch = charOf(support);
        return {
          support,
          nom:ch ? ch.name : (support || "—"),
          /* Le meme classement A L'INTERIEUR du groupe : un groupe monte en
             tete parce qu'un membre le porte, la ligne qui lui vaut cette
             place doit donc se lire la premiere. Le tri est stable, l'ordre
             de la table — armes puis tenues — survit a egalite. */
          lignes:lignes.slice().sort((a, b) =>
            (b.porteurs.length ? 1 : 0) - (a.porteurs.length ? 1 : 0)
          ),
          potentiel:lignes.reduce((max, item) => Math.max(
            max, ...item.porteurs.map(p => p.potentiel)
          ), -1)
        };
      })
      .sort((a, b) => {
        const porteA = a.potentiel >= 0 ? 1 : 0;
        const porteB = b.potentiel >= 0 ? 1 : 0;
        return porteB - porteA
          || b.potentiel - a.potentiel
          || a.nom.localeCompare(b.nom, "fr");
      });
  }

  /* UNE SECTION DU RECENSEMENT, rendue a part parce qu'elle ne depend d'AUCUN
     roster. C'est ce qui lui permet d'apparaitre aussi quand la confrerie n'a
     rien saisi : un effet que personne ne possede reste une information, et
     c'est meme celle qui fait recruter. */
  function rendreRecensement(box, section, membres, tablesLues, lectureRostersReussie){
    box.appendChild(el("h2",{class:"an-title", text:section.titre}));
    box.appendChild(el("p",{class:"an-note", text:section.note}));
    if(!tablesLues){
      box.appendChild(el("div",{class:"rank-empty",
        text:"Recensement indisponible : les tables d'effets n'ont pas pu être lues."}));
      return;
    }
    const groupes = groupesDuRecensement(section.vise, membres);
    const total = groupes.reduce((n, g) => n + g.lignes.length, 0);
    const portes = groupes.reduce((n, g) =>
      n + g.lignes.filter(item => item.porteurs.length).length, 0);
    /* Le compte se lit AVANT la liste : sans lui il faut parcourir soixante
       lignes pour savoir combien la confrerie en couvre. Il se tait sur une
       lecture en echec, ou il affirmerait un vide qu'on ignore. */
    if(lectureRostersReussie){
      /* Zero se dit en gris : l'or annonce une couverture, et un compte nul
         n'en est pas une. */
      box.appendChild(el("p",{class:"db-compte" + (portes ? "" : " db-aucun"),
        text:portes + (portes > 1 ? " effets portés" : " effet porté")
          + " sur " + total + " par la confrérie"}));
    }
    const liste = el("div",{class:"debuff-list"});
    groupes.forEach(groupe => {
      const bloc = el("div",{class:"debuff-groupe",
        dataset:{ support:groupe.support }});
      groupe.lignes.forEach((item, index) => bloc.appendChild(
        ligneDuRecensement(
          item.ligne, item.porteurs, lectureRostersReussie, index === 0
        )
      ));
      liste.appendChild(bloc);
    });
    box.appendChild(liste);
  }

  /* Les deux sections, dans l'ordre ou le membre les lit : ce qu'on retire au
     boss, puis ce qu'on donne au groupe. */
  const SECTIONS_DU_RECENSEMENT = [
    {
      vise:"ennemi",
      titre:"Affaiblissement de la cible",
      note:"Effets généraux ou Foudre que la confrérie peut appliquer au boss. Les effets propres aux autres éléments sont masqués."
    },
    {
      vise:"allies",
      titre:"Renforcement des alliés",
      note:"Renforts généraux ou Foudre apportés au groupe par une compétence ou une tenue gravée. Les effets propres aux autres éléments sont masqués."
    }
  ];

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

  function ligneVisibleDansAnalyse(ligne){
    return !ligne.element
      || String(ligne.element).toLowerCase() === "thunder";
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

  /* LA MATRICE, dans son conteneur stable. Aucune lecture reseau : elle ne
     travaille que sur les joueurs deja charges. */
  function rendreMatrice(wrap, players){
    const table = el("table",{class:"matrix"});
    const thead = el("tr",{},[
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
    membresTries(players).forEach(p => {
      const tr = el("tr",{});
      tr.appendChild(el("td",{class:"mx-player", text:p.name}));
      tr.appendChild(el("td",{class:"mx-total", text:String((p.dps||[]).length)}));
      ELEM_ORDER.forEach(e => {
        const dps = (p.dps||[]).filter(d => dpsElem(d) === e)
          .sort((a,b) => (b.pot||0) - (a.pot||0));
        const td = el("td",{
          class:(dps.length ? "" : "mx-empty")
            + (analyseTri === e ? " mx-colonne-triee" : "")
        });
        if(dps.length) dps.forEach(d => td.appendChild(caseDeLaMatrice(p, d)));
        else td.textContent = "—";
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    wrap.replaceChildren(table);
    /* Le tableau doit deja etre connecte : si Realtime reconstruit la vue
       pendant que la modale est ouverte, ModalStack refuse a juste titre une
       cible de focus detachee. */
    rendreLaCibleDuFocus(wrap);
  }

  async function renderAnalyse(){
    const renderId = ++analyseRenderId;
    const box = $("#analyseBody");
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
    /* Les trois sections DPS ne parlent que des membres qui en ont un. Les deux
       recensements, eux, parlent de tout le monde : un membre qui ne joue que
       des soutiens y a sa place, et le filtre d'origine le rendait invisible
       avant meme que la vue ne le voie. */
    const players = membres.filter(p => (p.dps || []).length);

    /* Les panneaux sont tous construits depuis la meme lecture. Changer de
       sous-vue ne rappelle donc ni les rosters ni les tables d'effets. */
    const overview = panneauAnalyse("overview");
    const dpsPanel = panneauAnalyse("dps");
    const supportsPanel = panneauAnalyse("supports");
    box.append(
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
      membres, tablesLues, lectureRostersReussie
    );
    const totalDps = players.reduce((n, joueur) =>
      n + (joueur.dps || []).length, 0);
    const dpsFoudre = players.reduce((n, joueur) => n + (joueur.dps || [])
      .filter(personnage => dpsElem(personnage) === "THUNDER").length, 0);

    overview.appendChild(el("h2",{class:"an-title", text:"En un coup d'œil"}));
    overview.appendChild(el("div",{class:"analyse-summary"},[
      carteResume(
        lectureRostersReussie ? membres.length : "—",
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
        supports ? "effets généraux ou Foudre" : "donnée indisponible"
      )
    ]));
    if(membres.length){
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
      /* Le conteneur reste stable : changer de tri ne relit pas Supabase. */
      const wrap = el("div",{class:"matrix-wrap"});
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

    supportsPanel.appendChild(el("p",{class:"analyse-panel-intro",
      text:"Uniquement les effets généraux et Foudre utiles à la composition de la confrérie."}));
    SECTIONS_DU_RECENSEMENT.forEach(section => rendreRecensement(
      supportsPanel, section, membres, tablesLues, lectureRostersReussie
    ));
    afficherSousVueAnalyse(box, analyseSousVue);
  }

export { renderAnalyse };
