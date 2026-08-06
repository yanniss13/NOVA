/* La fiche d'un heros dans le wiki : lecture seule.

   Elle ne reutilise pas heroDetail() de fiche-heros.js, qui decrit un BUILD —
   un heros equipe, avec ses pieces et ses statistiques calculees. Ici on
   decrit un PERSONNAGE : ce qu'il sait faire, independamment de tout
   equipement.

   Le comportement de navigation (precedent, suivant, fleches clavier,
   compteur) reprend celui de detail-roster.js, deja eprouve. */

import {
  BUILD_STATS, ELEMENTS, ENUM_TO_FOLDER, POT, POT_MAX, WEAPON_ENUM, metaOf
} from "../noyau/constantes.js";
import { $, el } from "../noyau/dom.js";
import { charOf } from "../metier/catalogue.js";
import { linkedArmorsOf } from "../metier/armes.js";
import { armesDuHeros, competencesParArme } from "../metier/wiki-competences.js";
import { renderBonus } from "./elements.js";
import { ModalStack } from "./modal-stack.js";
import { formatBuildStatValue } from "./stats-affichage.js";
import { ROLES_HEROS, brancherFiche } from "./wiki.js";

  const fiche = { entries:[], index:0, arme:null };

  /* Les competences d'une arme, rangees par ce qu'elles SONT. La couleur du
     titre porte l'information : l'or pour ce que le heros est en permanence,
     le pourpre pour l'ultime qu'on attend, le neutre pour le reste. La
     derniere section ramasse tout le reste — une competence inedite doit
     apparaitre quelque part plutot que disparaitre. */
  const SECTIONS = [
    { titre:"Passif", ton:"passif", garde:c => c.categorie === "PASSIVE" },
    { titre:"Compétences", ton:"normal",
      garde:c => /skill_q|skill_e/.test(c.gameId) },
    { titre:"Ultime", ton:"ultime", garde:c => /skill_r/.test(c.gameId) },
    { titre:"Autres attaques", ton:"normal", garde:()=>true }
  ];

  /* Le libelle de la touche, lu sur le gameId. Les suffixes composes du jeu
     (`skill_q_1`, `skill_r_enchant`) designent la meme touche, d'ou la
     recherche en sous-chaine. L'ordre suit celui du module metier. */
  const TOUCHES = [
    ["passive", "Passif"],
    ["skill_q", "Q"],
    ["skill_e", "E"],
    ["skill_r", "R"],
    ["skill_tag", "Tag"],
    ["jumpatk", "Attaque sautée"]
  ];
  function toucheDe(gameId){
    const trouve = TOUCHES.find(([marque]) => String(gameId || "").includes(marque));
    return trouve ? trouve[1] : "Compétence";
  }

  function blocCompetence(competence){
    const entete = el("div",{class:"wiki-skill-head"},[
      /* L'icone du jeu, en medaillon : c'est elle que le membre reconnait a
         l'ecran de combat. Absente du catalogue, la ligne se rabat sur la
         seule pastille de touche plutot que de reserver un trou. */
      competence.icone ? el("img",{
        class:"wiki-skill-icon",
        src:"7ds-ui/skills/"+competence.icone,
        alt:"", loading:"lazy"
      }) : null,
      el("span",{class:"wiki-skill-kind", text:toucheDe(competence.gameId)}),
      el("span",{class:"wiki-skill-name", text:competence.nomFr})
    ]);
    /* Ni une recharge absente ni une recharge nulle ne s'annoncent : un
       passif est permanent, une attaque normale n'attend rien, et « 0 s »
       laisserait croire a un compte a rebours qui n'existe pas. */
    if(competence.recharge){
      entete.appendChild(
        el("span",{class:"wiki-skill-cd", text:competence.recharge+" s"})
      );
    }
    return el("div",{class:"wiki-skill"},[
      entete,
      el("p",{class:"wiki-skill-desc", html:renderBonus(competence.descriptionFr)})
    ]);
  }

  /* Une carte par arme, avec son icone de maitrise : c'est elle que le membre
     reconnait dans le jeu, bien avant le libelle. Les icones sont deja dans
     le depot, aucune n'est telechargee ici. */
  function selecteurArmes(armes){
    const rangee = el("div",{class:"wiki-hero-weapons"});
    armes.forEach(arme => {
      const info = WEAPON_ENUM[arme] || {};
      const libelle = info.label || arme;
      rangee.appendChild(el("button",{
        class:"wiki-hero-weapon"+(arme === fiche.arme ? " active" : ""),
        type:"button",
        "aria-pressed":String(arme === fiche.arme),
        title:libelle,
        onclick:()=>{ fiche.arme = arme; renderFiche(); }
      },[
        info.icon ? el("img",{
          class:"wiki-hero-weapon-icon",
          src:"7ds-ui/mastery/"+info.icon+".webp",
          alt:"", loading:"lazy"
        }) : null,
        el("span",{class:"wiki-hero-weapon-label", text:libelle})
      ]));
    });
    return rangee;
  }

  /* Un titre barre, comme sur la fiche de reference : un filet, puis le
     libelle en petites capitales. Le `ton` colore les deux. */
  function titreSection(texte, ton){
    return el("div",{class:"wiki-section wiki-section-"+ton},[
      el("span",{class:"wiki-section-rule"}),
      el("span",{class:"wiki-section-label", text:texte})
    ]);
  }

  function repliable(titre, contenu){
    if(!contenu) return null;
    return el("details",{class:"wiki-fold"},[
      el("summary",{text:titre}),
      contenu
    ]);
  }

  function blocPotentiels(charId, arme){
    const dossier = ENUM_TO_FOLDER[arme];
    const paliers = (POT[charId] || {})[dossier];
    if(!Array.isArray(paliers) || !paliers.length) return null;
    const liste = el("ol",{class:"wiki-pot"});
    paliers.slice(0, POT_MAX).forEach((texte, index) => {
      if(!texte) return;
      liste.appendChild(el("li",{},[
        el("span",{class:"wiki-pot-tier", text:"P"+(index + 1)}),
        el("span",{class:"wiki-pot-text", html:renderBonus(texte)})
      ]));
    });
    return liste.children.length ? liste : null;
  }

  /* Un code de stat rendu lisible. Le libelle francais et l'unite viennent du
     catalogue, jamais d'une table ecrite ici : un code inedit apparait des la
     regeneration, sans toucher a ce fichier. Un code absent du catalogue est
     tu plutot que d'afficher « B_Atk » a un membre. */
  function ligneDeStat(code, valeur){
    const libelle = (BUILD_STATS.statLabels || {})[code];
    if(!libelle || !libelle.fr) return null;
    let texte;
    try{
      texte = formatBuildStatValue(valeur, libelle.unit);
    }catch(erreur){
      return null;
    }
    return el("li",{class:"wiki-stat"},[
      el("span",{class:"wiki-stat-name", text:libelle.fr}),
      el("span",{class:"wiki-stat-value", text:texte})
    ]);
  }

  function blocStatsDeBase(charId){
    const personnage = (BUILD_STATS.charactersBySlug || {})[charId];
    const stats = personnage && personnage.baseStats;
    if(!Array.isArray(stats) || !stats.length) return null;
    const liste = el("ul",{class:"wiki-stats"});
    stats.forEach(item => {
      const ligne = ligneDeStat(item.stat, item.value);
      if(ligne) liste.appendChild(ligne);
    });
    return liste.children.length ? liste : null;
  }

  /* Le total qu'apporte la branche de maitrise une fois montee.

     La source la publie apport par apport (68 entrees pour Derieri a la
     hache : sous-niveaux et noeuds). Les sommer n'est pas une interpretation :
     `masteryTerms()` dans metier/stats-calcul.js pose chacune comme un terme
     ADDITIF dans un meme seau. On reprend sa semantique sans la redemontrer. */
  function blocMaitrises(charId, arme){
    const personnage = (BUILD_STATS.charactersBySlug || {})[charId];
    const branche = personnage
      && personnage.masteriesByWeapon
      && personnage.masteriesByWeapon[arme];
    const apports = branche && branche.abilities;
    if(!Array.isArray(apports) || !apports.length) return null;
    const totaux = new Map();
    apports.forEach(item => {
      if(!item || !item.stat) return;
      totaux.set(item.stat, (totaux.get(item.stat) || 0) + Number(item.value || 0));
    });
    const liste = el("ul",{class:"wiki-stats"});
    totaux.forEach((valeur, code) => {
      if(valeur === 0) return;
      const ligne = ligneDeStat(code, valeur);
      if(ligne) liste.appendChild(ligne);
    });
    return liste.children.length ? liste : null;
  }

  function blocArmuresLiees(charId){
    const fichiers = linkedArmorsOf(charId);
    if(!fichiers.length) return null;
    const rangee = el("div",{class:"wiki-linked"});
    fichiers.forEach(fichier => {
      rangee.appendChild(el("img",{
        src:fichier, alt:"", loading:"lazy",
        title:fichier.split("/").pop().replace(/\.webp$/i, "")
      }));
    });
    return rangee;
  }

  function renderFiche(){
    const entree = fiche.entries[fiche.index];
    const corps = $("#wikiHeroBody");
    /* A relever AVANT de vider le corps : le bouton d'arme focalise disparait
       avec lui et le focus retombe sur le body, donc HORS de la modale. Les
       fleches gauche/droite cessent alors de repondre, leur ecouteur etant
       pose sur l'overlay. On rendra le focus au bouton qui le remplace. */
    const focusEtaitSurUneArme = !!document.activeElement
      && !!document.activeElement.classList
      && document.activeElement.classList.contains("wiki-hero-weapon");
    corps.innerHTML = "";
    if(!entree) return;
    const character = charOf(entree.id);
    if(!character) return;

    $("#wikiHeroTitle").textContent = character.name;
    $("#wikiHeroPosition").textContent =
      (fiche.index + 1) + " / " + fiche.entries.length;
    const precedent = $("#wikiHeroPrev");
    const suivant = $("#wikiHeroNext");
    /* Le navigateur retire le focus d'un bouton des qu'il devient `disabled` :
       on note qui l'avait AVANT de desactiver, puis on le rend au controle
       encore utilisable plutot que de le perdre sur le body. */
    const actif = document.activeElement;
    precedent.disabled = fiche.index <= 0;
    suivant.disabled = fiche.index >= fiche.entries.length - 1;
    if((actif === precedent || actif === suivant) && actif.disabled){
      const repli = actif === precedent ? suivant : precedent;
      (repli.disabled ? $("#wikiHeroClose") : repli).focus();
    }

    const meta = metaOf(entree.id) || {};
    const element = ELEMENTS[meta.element];
    /* L'element du heros teinte le cadre et la lueur de l'en-tete : c'est la
       seule variable vraiment propre a chaque personnage, et c'est ce qui
       fait qu'aucune fiche ne ressemble a la precedente. Repli sur l'or quand
       l'element est inconnu, pour ne jamais rendre une couleur vide. */
    const aura = (element && element.color) || "#d9a441";
    const chips = el("div",{class:"wiki-hero-chips"});
    if(element){
      chips.appendChild(el("span",{
        class:"wiki-chip wiki-chip-element", text:element.label
      }));
    }
    if(meta.role){
      chips.appendChild(el("span",{
        class:"wiki-chip", text:ROLES_HEROS[meta.role] || meta.role
      }));
    }
    const nom = el("div",{class:"wiki-hero-name", text:character.name});
    if(meta.rarity){
      nom.appendChild(el("span",{class:"wiki-hero-gem", text:meta.rarity}));
    }
    corps.appendChild(el("div",{class:"wiki-hero-head", style:"--aura:"+aura},[
      el("div",{class:"wiki-hero-frame"},[
        el("img",{class:"wiki-hero-portrait", src:character.file, alt:"", loading:"lazy"})
      ]),
      el("div",{class:"wiki-hero-id"},[nom, chips])
    ]));

    const armes = armesDuHeros(entree.id);
    if(!armes.length){
      corps.appendChild(el("p",{
        class:"wiki-hero-hint",
        text:"Aucune compétence connue pour ce personnage."
      }));
      return;
    }
    if(!fiche.arme || !armes.includes(fiche.arme)) fiche.arme = armes[0];
    const selecteur = selecteurArmes(armes);
    corps.appendChild(selecteur);
    if(focusEtaitSurUneArme){
      const remplacant = selecteur.querySelector(".wiki-hero-weapon.active");
      if(remplacant) remplacant.focus();
    }

    /* Une competence n'entre que dans UNE section, la premiere qui la
       reconnait. La derniere garde vaut toujours : rien ne se perd. */
    const restantes = (competencesParArme(entree.id)[fiche.arme] || []).slice();
    SECTIONS.forEach(section => {
      const prises = restantes.filter(section.garde);
      if(!prises.length) return;
      prises.forEach(competence => {
        restantes.splice(restantes.indexOf(competence), 1);
      });
      corps.appendChild(titreSection(section.titre, section.ton));
      prises.forEach(competence => {
        corps.appendChild(blocCompetence(competence));
      });
    });

    [
      repliable("Potentiels", blocPotentiels(entree.id, fiche.arme)),
      repliable("Maîtrises d’arme", blocMaitrises(entree.id, fiche.arme)),
      repliable("Stats de base", blocStatsDeBase(entree.id)),
      repliable("Armures gravées", blocArmuresLiees(entree.id))
    ].forEach(bloc => { if(bloc) corps.appendChild(bloc); });
  }

  function deplacer(pas){
    const suivant = fiche.index + pas;
    if(suivant < 0 || suivant >= fiche.entries.length) return;
    fiche.index = suivant;
    fiche.arme = null;
    renderFiche();
  }

  function fermer(){ ModalStack.close($("#wikiHeroOverlay")); }

  function ouvrirFicheWiki(charId, entries){
    const liste = Array.isArray(entries) && entries.length ? entries : [];
    const index = liste.findIndex(item => item.id === charId);
    if(index === -1) return;
    const declencheur = document.activeElement;
    fiche.entries = liste;
    fiche.index = index;
    fiche.arme = null;
    renderFiche();
    ModalStack.open(
      $("#wikiHeroOverlay"), "#wikiHeroClose", fermer, declencheur
    );
  }

  $("#wikiHeroClose").addEventListener("click", fermer);
  $("#wikiHeroPrev").addEventListener("click", ()=>deplacer(-1));
  $("#wikiHeroNext").addEventListener("click", ()=>deplacer(1));
  $("#wikiHeroOverlay").addEventListener("click", event => {
    if(event.target === $("#wikiHeroOverlay")) fermer();
  });
  $("#wikiHeroOverlay").addEventListener("keydown", event => {
    if(event.key === "ArrowLeft"){ event.preventDefault(); deplacer(-1); }
    else if(event.key === "ArrowRight"){ event.preventDefault(); deplacer(1); }
  });

  brancherFiche(ouvrirFicheWiki);

/* Rien a exporter : ce module s'enregistre lui-meme aupres de wiki.js. Le
   depot refuse tout export que personne n'importe. app.js l'importe pour
   effet de bord. */
