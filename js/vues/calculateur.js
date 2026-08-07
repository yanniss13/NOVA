/* L'onglet « Calculateur » : les degats de chaque competence contre Akumu.

   Cette vue ne calcule RIEN. Elle lit un build du roster, demande ses bases
   offensives a stats-calcul.js, laisse le membre les retoucher et cocher des
   buffs de soutien, puis confie le tout a calculateur-entrees.js.

   Ce n'est pas un DPS : aucune chronologie, aucun temps d'animation, aucun
   ordre de rotation. C'est un choix, pas un oubli - les donnees qui manquent
   sont precisement celles dont un DPS dependrait. */

import { FOLDER_TO_ENUM, metaOf } from "../noyau/constantes.js";
import { $, el, numericKeyboardInputProps } from "../noyau/dom.js";
import { sessionCourante } from "../etat/session.js";
import { charOf } from "../metier/catalogue.js";
import { equippedEnumOf } from "../metier/armes.js";
import { rosterHeroSnapshot } from "../metier/equipe-modele.js";
import { calculateHeroStats, groupBuildStatResults } from "../metier/stats-calcul.js";
import { CIBLE_REFERENCE } from "../metier/degats-calcul.js";
import {
  buffsApplicables, entreesDuCalcul, resultatsParCompetence
} from "../metier/calculateur-entrees.js";
import { MemberRosterStore } from "../donnees/roster-store.js";
import { ModalStack } from "./modal-stack.js";
import { showView } from "./navigation.js";

  const NOMBRE = new Intl.NumberFormat("fr-FR");

  /* Les trois bases offensives, et le code de stat qui les porte. */
  const BASES = [
    { cle:"atk", code:"B_Atk", label:"ATK" },
    { cle:"critRate", code:"C_Critical_Rate", label:"Taux critique (%)" },
    { cle:"critDamage", code:"C_Critical_Dam_Rate", label:"Dégâts critiques (%)" }
  ];

  /* Etat de la page. `retouches` ne contient que ce que le membre a
     REELLEMENT modifie : une cle absente vaut « valeur du build ». */
  const etat = {
    charId:null,
    typeArme:null,
    heroImpose:null,
    retouches:{},
    coches:new Set()
  };

  let chargementCatalogues = null;

  /* Les deux catalogues sont charges A LA DEMANDE. competences.js fait 7491
     lignes : le charger au demarrage le ferait payer a chaque visiteur qui ne
     calcule rien. Motif repris de js/vues/wiki.js. */
  function chargerCatalogues(){
    if(window.SEVEN_DS_COMPETENCES && window.SEVEN_DS_BUFFS_SUPPORTS){
      return Promise.resolve(true);
    }
    if(chargementCatalogues) return chargementCatalogues;
    const injecter = src => new Promise((resolve, reject) => {
      document.head.appendChild(el("script",{
        src, onload:()=>resolve(true),
        onerror:()=>reject(new Error("catalogue introuvable : "+src))
      }));
    });
    chargementCatalogues = Promise.all([
      window.SEVEN_DS_COMPETENCES
        ? Promise.resolve(true) : injecter("./data/competences.js"),
      window.SEVEN_DS_BUFFS_SUPPORTS
        ? Promise.resolve(true) : injecter("./data/buffs-supports.js")
    ]).catch(erreur => {
      /* Rejouable : un echec reseau ne doit pas condamner l'onglet pour toute
         la duree de la session. */
      chargementCatalogues = null;
      throw erreur;
    });
    return chargementCatalogues;
  }

  function fichesDuMembre(){
    const user = sessionCourante.user;
    return user ? MemberRosterStore.all(user.id) : [];
  }

  function ficheDe(charId){
    return fichesDuMembre().find(entry => entry.charId === charId) || null;
  }

  function typesDe(entry){
    return entry && entry.builds ? Object.keys(entry.builds).sort() : [];
  }

  /* L'element vient de l'ARME equipee, jamais du personnage : chaque slot
     d'arme porte le sien, et `meta.element` fixe n'existe pas. Piege
     documente dans AGENTS.md. */
  function elementDuBuild(charId, hero){
    const meta = metaOf(charId);
    const equipee = equippedEnumOf(hero);
    const slot = meta && meta.weapons
      ? meta.weapons.find(w => w.weapon === equipee)
      : null;
    return slot && slot.element ? String(slot.element).toLowerCase() : null;
  }

  /* Les bases offensives du build, par code de stat. Un statut autre que
     `valid` ou `partial` ne porte AUCUN chiffre : on rend null plutot qu'un
     zero, et la page dit « Configuration a completer ». */
  function basesDuBuild(hero, element){
    const result = calculateHeroStats(hero);
    if(result.status !== "valid" && result.status !== "partial"){
      return { statut:result.status, manques:result.missing || [], stats:null };
    }
    const parCode = new Map(
      groupBuildStatResults(result)
        .flatMap(group => group.stats)
        .map(stat => [stat.stat, stat])
    );
    const lire = code => {
      const stat = parCode.get(code);
      return stat && Number.isFinite(stat.value) ? stat.value : 0;
    };
    /* L'attaque elementaire du build : celle de son element, plus celle qui
       vaut pour tous. Le moteur les ajoute a l'ATK. */
    const majuscule = element
      ? element.charAt(0).toUpperCase() + element.slice(1)
      : null;
    return {
      statut:result.status,
      manques:[],
      stats:{
        atk:lire("B_Atk"),
        def:lire("B_Def"),
        maxHp:lire("B_MaxHp"),
        critRate:lire("C_Critical_Rate"),
        critDamage:lire("C_Critical_Dam_Rate"),
        attaqueElementaire:
          (majuscule ? lire(majuscule + "_Add") : 0) + lire("AllElement_Add")
      }
    };
  }

  /* Le roster range ses builds par DOSSIER d'image (« Hache »), le catalogue
     les publie par ENUM (« Axe ») : FOLDER_TO_ENUM fait le pont, et il existe
     deja. */
  function competencesDu(charId, typeArme){
    const enumArme = FOLDER_TO_ENUM[typeArme];
    if(!enumArme) return [];
    const catalogue = window.SEVEN_DS_COMPETENCES || {};
    return (catalogue[charId] || []).filter(c => c.weaponType === enumArme);
  }

  /* Le nom francais et l'icone viennent du catalogue du wiki, joint par
     gameId. Sans equivalent, la ligne GARDE son chiffre et retombe sur le nom
     anglais : un nom anglais se remarque, un chiffre absent se croirait nul. */
  function libelleDe(charId, competence){
    const fiche = ((window.SEVEN_DS_WIKI_COMPETENCES || {})[charId] || [])
      .find(k => k.gameId === competence.gameId);
    return {
      nom:(fiche && fiche.nomFr) || competence.nom || competence.gameId,
      icone:fiche && fiche.icone ? "7ds-ui/skills/" + fiche.icone : null
    };
  }

  function valeurRetouchee(cle, valeurDuBuild){
    return Object.prototype.hasOwnProperty.call(etat.retouches, cle)
      ? etat.retouches[cle]
      : valeurDuBuild;
  }

  function aRetouche(){
    return Object.keys(etat.retouches).length > 0;
  }

  /* ---- rendu ---- */

  function champsDeBase(stats, redessiner){
    const form = el("div",{class:"calc-form"});
    BASES.forEach(base => {
      const courante = valeurRetouchee(base.cle, stats[base.cle]);
      const modifie = Object.prototype.hasOwnProperty.call(etat.retouches, base.cle);
      /* Le type number passe OBLIGATOIREMENT par ce helper : il porte aussi
         inputmode et pattern, sans quoi le clavier mobile n'est pas le bon.
         tests/potentiel-commun.test.js compte les occurrences pour l'imposer. */
      const input = el("input",numericKeyboardInputProps({
        class:"calc-valeur" + (modifie ? " calc-retouche" : ""),
        value:String(Math.round(courante)),
        onchange:event => {
          const lu = Number(event.target.value);
          if(!Number.isFinite(lu)) return;
          etat.retouches[base.cle] = lu;
          redessiner();
        }
      }));
      form.appendChild(el("div",{class:"calc-champ"},[
        el("label",{text:base.label}),
        input
      ]));
    });
    if(aRetouche()){
      form.appendChild(el("button",{
        class:"btn btn-ghost",
        type:"button",
        text:"Réinitialiser",
        onclick:()=>{ etat.retouches = {}; redessiner(); }
      }));
    }
    return form;
  }

  function sectionSoutiens(element, redessiner){
    const dispo = buffsApplicables(element);
    const section = el("section",{class:"calc-soutiens"},[
      el("strong",{text:"Soutiens"}),
      el("p",{class:"calc-avertissement",
        text:"Décoché, le chiffre est celui du héros seul. Cocher un buff, "
          + "c'est déclarer sa condition remplie : les durées ne sont pas "
          + "modélisées."})
    ]);
    if(!dispo.length){
      section.appendChild(el("p",{class:"calc-muette",
        text:"Aucun buff connu ne s'applique à l'élément de ce build."}));
      return section;
    }
    dispo.forEach(buff => {
      /* La case se coche par PROPRIETE, jamais par attribut : `el()` passe
         toute valeur a setAttribute, et setAttribute("checked", undefined)
         ecrit la chaine "undefined" - donc une case cochee. Les six buffs
         sans element l'etaient tous par defaut. */
      const caseACocher = el("input",{
        type:"checkbox",
        onchange:()=>{
          if(etat.coches.has(buff.id)) etat.coches.delete(buff.id);
          else etat.coches.add(buff.id);
          redessiner();
        }
      });
      caseACocher.checked = etat.coches.has(buff.id);
      section.appendChild(el("label",{class:"calc-buff"},[
        caseACocher,
        el("span",{text:buff.support + " — " + buff.libelle})
      ]));
    });
    return section;
  }

  function tableauDesCompetences(charId, competences, entrees){
    const lignes = resultatsParCompetence({
      competences, entrees, cible:CIBLE_REFERENCE
    });
    const corps = el("tbody");
    lignes.forEach(ligne => {
      const nom = libelleDe(charId, ligne.competence);
      if(!ligne.resultat){
        corps.appendChild(el("tr",{class:"calc-muette"},[
          el("td",{text:nom.nom}),
          el("td",{colspan:"3", text:"Non inclus dans le calcul"})
        ]));
        return;
      }
      corps.appendChild(el("tr",{},[
        el("td",{text:nom.nom}),
        el("td",{class:"calc-valeur",
          text:NOMBRE.format(Math.round(ligne.resultat.sansCritique))}),
        el("td",{class:"calc-valeur",
          text:NOMBRE.format(Math.round(ligne.resultat.avecCritique))}),
        el("td",{class:"calc-valeur",
          text:NOMBRE.format(Math.round(ligne.resultat.total))})
      ]));
    });
    return el("table",{class:"calc-table"},[
      el("thead",{},[
        el("tr",{},[
          el("th",{text:"Compétence"}),
          el("th",{text:"Non-crit"}),
          el("th",{text:"Crit"}),
          el("th",{text:"Espérance"})
        ])
      ]),
      corps
    ]);
  }

  function avertissements(){
    return el("section",{class:"calc-avertissement"},[
      el("p",{text:"Cible : " + CIBLE_REFERENCE.nom + ". La source ne publie "
        + "qu'un seul jeu de statistiques alors que le boss a vingt niveaux de "
        + "difficulté — ce chiffre ne vaut donc pas pour un niveau choisi."}),
      el("p",{text:"Sur Akumu, l'élément ne change rien : les huit résistances "
        + "élémentaires valent 30 % et aucune faiblesse n'est publiée."}),
      el("strong",{text:"Non inclus dans le calcul"}),
      el("ul",{},[
        el("li",{text:"les passifs conditionnels du héros et de son équipement"}),
        el("li",{text:"les buffs de coéquipiers non cochés, et la durée de ceux qui le sont"}),
        el("li",{text:"les debuffs appliqués à la cible"}),
        el("li",{text:"les temps d'animation, donc toute notion de dégâts par seconde"}),
        el("li",{text:"les attaques normales, les compétences de relève et les attaques combinées"}),
        el("li",{text:"les mécaniques d'Akumu : pierres élémentaires, attaque dorsale, renforcement à chaque mort"})
      ])
    ]);
  }

  function selecteurs(entries, redessiner){
    const bloc = el("div",{class:"calc-form"});
    const choix = el("select",{
      onchange:event => {
        etat.charId = event.target.value;
        const types = typesDe(ficheDe(etat.charId));
        etat.typeArme = types[0] || null;
        etat.retouches = {};
        etat.coches.clear();
        redessiner();
      }
    });
    entries.forEach(entry => {
      const ch = charOf(entry.charId);
      /* Meme raison que pour les cases a cocher : la selection passe par la
         propriete, pas par un attribut que `el()` ecrirait « undefined ». */
      const option = el("option",{
        value:entry.charId,
        text:ch ? ch.name : entry.charId
      });
      option.selected = entry.charId === etat.charId;
      choix.appendChild(option);
    });
    bloc.appendChild(el("div",{class:"calc-champ"},[
      el("label",{text:"Personnage"}), choix
    ]));

    const types = typesDe(ficheDe(etat.charId));
    const armes = el("div",{class:"calc-champ"},[el("label",{text:"Build"})]);
    const rail = el("div",{class:"calc-armes"});
    types.forEach(type => {
      rail.appendChild(el("button",{
        type:"button",
        class:"btn btn-ghost" + (type === etat.typeArme ? " active" : ""),
        text:type,
        onclick:()=>{
          etat.typeArme = type;
          etat.retouches = {};
          redessiner();
        }
      }));
    });
    armes.appendChild(rail);
    bloc.appendChild(armes);
    return bloc;
  }

  function dessiner(){
    const vue = $("#calculateurBody");
    if(!vue) return;
    vue.textContent = "";

    const entries = fichesDuMembre();

    /* Deux sources possibles, et c'est voulu : un build IMPOSE par le lien
       d'une fiche de heros - qui peut venir d'une equipe locale, sans compte
       ni roster -, ou un build choisi dans le roster du membre connecte.

       Sans le premier cas, le bouton « Calculer les degats » d'une equipe
       locale menerait a « Connecte-toi » : un lien qui ne mene nulle part est
       pire que pas de lien. */
    let hero = null;
    if(etat.heroImpose){
      hero = etat.heroImpose;
      vue.appendChild(el("div",{class:"calc-form"},[
        el("p",{class:"calc-avertissement",
          text:"Build ouvert depuis une fiche de héros."}),
        entries.length
          ? el("button",{
              class:"btn btn-ghost",
              type:"button",
              text:"Choisir dans mon roster",
              onclick:()=>{
                etat.heroImpose = null;
                etat.retouches = {};
                etat.coches.clear();
                dessiner();
              }
            })
          : null
      ]));
    } else {
      if(!entries.length){
        vue.appendChild(el("p",{class:"calc-muette",
          text:sessionCourante.user
            ? "Enregistre d'abord un personnage dans ton roster : le "
              + "calculateur part de tes builds, il n'invente aucune valeur."
            : "Connecte-toi pour calculer les dégâts de tes builds, ou ouvre "
              + "le calculateur depuis la fiche d'un héros."}));
        return;
      }
      if(!etat.charId || !ficheDe(etat.charId)) etat.charId = entries[0].charId;
      const fiche = ficheDe(etat.charId);
      const types = typesDe(fiche);
      if(!etat.typeArme || types.indexOf(etat.typeArme) === -1){
        etat.typeArme = types[0] || null;
      }
      vue.appendChild(selecteurs(entries, dessiner));
      if(!etat.typeArme){
        vue.appendChild(el("p",{class:"calc-muette",
          text:"Ce personnage ne porte aucun build enregistré."}));
        return;
      }
      hero = rosterHeroSnapshot(fiche, etat.typeArme);
    }

    if(!hero){
      vue.appendChild(el("p",{class:"calc-muette",
        text:"Ce build n'a pas pu être lu."}));
      return;
    }

    const element = elementDuBuild(etat.charId, hero);
    const bases = basesDuBuild(hero, element);
    if(!bases.stats){
      vue.appendChild(el("p",{class:"calc-muette",
        text:"Configuration à compléter"
          + (bases.manques.length ? " : " + bases.manques.join(", ") : ".")}));
      return;
    }

    vue.appendChild(champsDeBase(bases.stats, dessiner));
    if(aRetouche()){
      vue.appendChild(el("p",{class:"calc-avertissement calc-retouche",
        text:"Valeurs retouchées — ne reflète plus ton build."}));
    }

    vue.appendChild(sectionSoutiens(element, dessiner));

    const coches = buffsApplicables(element)
      .filter(buff => etat.coches.has(buff.id));
    vue.appendChild(el("p",{class:"calc-avertissement",
      text:coches.length
        ? "Avec " + coches.length + " buff(s) d'équipe."
        : "Héros seul."}));

    const statsRetouchees = Object.assign({}, bases.stats);
    BASES.forEach(base => {
      statsRetouchees[base.cle] = valeurRetouchee(base.cle, bases.stats[base.cle]);
    });

    const entrees = entreesDuCalcul({
      statsDuBuild:statsRetouchees, buffsCoches:coches
    });
    const competences = competencesDu(etat.charId, etat.typeArme);
    if(!competences.length){
      vue.appendChild(el("p",{class:"calc-muette",
        text:"Aucune compétence connue pour ce type d'arme."}));
    } else {
      vue.appendChild(tableauDesCompetences(etat.charId, competences, entrees));
    }
    vue.appendChild(avertissements());
  }

  function renderCalculateur(){
    return chargerCatalogues()
      .then(()=>{ dessiner(); return true; })
      .catch(()=>{
        const vue = $("#calculateurBody");
        if(vue){
          vue.textContent = "";
          vue.appendChild(el("p",{class:"calc-muette",
            text:"Le catalogue de compétences n'a pas pu être chargé. "
              + "Réessaie en rouvrant l'onglet."}));
        }
        return true;
      });
  }

  /* Ouverture ciblee depuis la fiche de heros : la page s'ouvre sur le build
     qu'on regardait. */
  function ouvrirCalculateur(charId, typeArme, hero){
    etat.charId = charId || null;
    etat.typeArme = typeArme || null;
    etat.heroImpose = hero || null;
    etat.retouches = {};
    etat.coches.clear();
    /* Le lien part d'une fiche ouverte DANS une modale. Sans cette fermeture,
       la page s'afficherait derriere elle et le document resterait fige. */
    ModalStack.closeAll();
    return showView("calculateur");
  }

/* L'enregistrement de la vue se fait dans js/app.js, comme pour toutes les
   autres : c'est lui qui connait l'ordre de demarrage. */
export { ouvrirCalculateur, renderCalculateur };
