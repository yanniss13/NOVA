/* Le recensement de l'Analyse : ce que la confrerie retire au boss, et ce
   qu'elle apporte au groupe.

   Trois cents lignes qui ne parlent que de ces deux tableaux — chargement a la
   demande des tables, calcul de l'apport d'un porteur, rendu des lignes et des
   groupes. Elles occupaient le quart de `analyse.js` sans rien partager avec la
   matrice DPS ni le contexte de groupe.

   Le module ne connait aucun etat de l'Analyse : tout ce qu'il affiche lui
   arrive en parametre. */

import { charOf } from "../metier/catalogue.js";
import {
  lignesDeSoutien,
  porteursDeLaLigne
} from "../metier/recensement-supports.js";
import { WEAPON_ENUM } from "../noyau/constantes.js";
import { el } from "../noyau/dom.js";
import { elemBadge } from "./badge-element.js";

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
  function groupesDuRecensement(vise, membres, elementsSelectionnes = null){
    const parSupport = new Map();
    lignesDeSoutien()
      .filter(ligne => ligne.vise === vise
        && ligneVisibleDansAnalyse(ligne, elementsSelectionnes))
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
  function rendreRecensement(
    box,
    section,
    membres,
    tablesLues,
    lectureRostersReussie,
    elementsSelectionnes = null
  ){
    box.appendChild(el("h2",{class:"an-title", text:section.titre}));
    box.appendChild(el("p",{class:"an-note", text:section.note}));
    if(!tablesLues){
      box.appendChild(el("div",{class:"rank-empty",
        text:"Recensement indisponible : les tables d'effets n'ont pas pu être lues."}));
      return;
    }
    const groupes = groupesDuRecensement(
      section.vise, membres, elementsSelectionnes
    );
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
      note:"Effets que la confrérie peut appliquer au boss avec les éléments affichés."
    },
    {
      vise:"allies",
      titre:"Renforcement des alliés",
      note:"Renforts apportés au groupe par une compétence ou une tenue gravée."
    }
  ];

  function ligneVisibleDansAnalyse(ligne, elementsSelectionnes){
    const selection = elementsSelectionnes instanceof Set
      ? elementsSelectionnes
      : new Set();
    return !ligne.element
      || !selection.size
      || selection.has(String(ligne.element).toUpperCase());
  }

export {
  chargerTablesDuRecensement,
  groupesDuRecensement,
  rendreRecensement,
  SECTIONS_DU_RECENSEMENT
};
