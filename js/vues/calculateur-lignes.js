/* Les lignes cochables du Calculateur : soutiens, tenues gravees, potentiels,
   passifs d'ensemble, passifs d'armes, supplements, et la case « tout cocher ».

   Cinq cents lignes qui ne parlent que d'une chose — proposer des apports, en
   retenir certains, et compter ce qui est retenu. Elles cohabitaient avec le
   moteur d'affichage du Calculateur sans rien partager avec lui : chaque
   section recoit deja son `redessiner` en parametre, donc aucune ne rappelle
   son ancien parent. */

import { charOf } from "../metier/catalogue.js";
import { PLAFOND_PROPRE } from "../metier/degats-calcul.js";
import {
  degatsSupplementairesApplicables
} from "../metier/degats-supplementaires.js";
import { el } from "../noyau/dom.js";
import { etat } from "./calculateur-etat.js";

  /* Le catalogue nomme les personnages ; la table des buffs ne connait que
     leur slug. On passe par le catalogue, et on capitalise le slug en dernier
     recours plutot que d'afficher « daisy » a l'ecran. */
  function nomDuPersonnage(slug){
    const perso = charOf(slug) || {};
    return perso.name || perso.nom || perso.nomFr
      || slug.charAt(0).toUpperCase() + slug.slice(1);
  }

  /* LES QUATRE FONCTIONS DES CUMULS, ecrites une fois pour toutes.

     Une ligne REGLABLE n'est pas cochee, elle est reglee au cran. Tout ce qui,
     ailleurs sur cette page, demandait « cette ligne est-elle cochee ? » doit
     donc passer par ici : la case « tout cocher », le compte affiche, et la
     liste qui part au moteur. Les laisser interroger `etat.coches` directement
     rendrait ces lignes invisibles a l'une ou l'autre.

     `reglable` est pose par la VUE, jamais par les tables, et c'est
     deliberé. Porter `cumuls` ne suffit pas a meriter un selecteur : les buffs
     de soutien en portent aussi, et le combo de Derieri egalement, mais leurs
     sections rendent une case - a 50 crans, le choix a ete fait de declarer le
     combo plein plutot que de derouler cinquante et une lignes. Deduire le
     selecteur du seul champ `cumuls` aurait donc casse ces deux sections en
     silence : elles ecrivent dans `etat.coches`, ces fonctions auraient lu
     `etat.cumuls`, et rien ne se serait plus allume. */
  function reglable(ligne){
    return Boolean(ligne && ligne.reglable && ligne.cumuls);
  }

  function cumulsDe(ligne){
    if(!reglable(ligne)) return 0;
    const lu = Math.round(Number(etat.cumuls[ligne.id]));
    if(!Number.isFinite(lu)) return 0;
    return Math.min(Math.max(0, lu), ligne.cumuls);
  }

  /* « Reglee a fond » vaut « cochee » pour une ligne reglable : c'est ce que
     declare la case « tout cocher », dont l'avertissement dit deja qu'elle
     donne un plafond theorique. */
  function estRetenue(ligne){
    return reglable(ligne)
      ? cumulsDe(ligne) >= ligne.cumuls
      : etat.coches.has(ligne && ligne.id);
  }

  /* La ligne telle que le MOTEUR doit la voir, ou null si elle est eteinte.
     Une ligne reglable voit sa `valeur` recalculee - le pas multiplie par les
     crans declares - pour que rien en aval n'ait a connaitre le mecanisme. */
  function ligneActive(ligne){
    if(!ligne) return null;
    if(!reglable(ligne)){
      return etat.coches.has(ligne.id) ? ligne : null;
    }
    const crans = cumulsDe(ligne);
    return crans > 0
      ? Object.assign({}, ligne, { valeur:ligne.parCumul * crans })
      : null;
  }

  /* Le selecteur qui remplace la case sur une ligne a cumuls. Le libelle perd
     son « +24 % » de plafond au profit de la valeur REELLE du reglage : un
     nombre qui ne bouge pas quand on tourne la molette se lirait comme un
     reglage sans effet. */
  function ligneACumuls(ligne, redessiner){
    const crans = cumulsDe(ligne);
    const choix = el("select",{
      class:"calc-cumuls-choix",
      onchange:event => {
        etat.cumuls[ligne.id] = Number(event.target.value) || 0;
        redessiner();
      }
    });
    for(let n = 0; n <= ligne.cumuls; n++){
      const option = el("option",{ value:String(n), text:String(n) });
      option.selected = n === crans;
      choix.appendChild(option);
    }
    const apport = ligne.parCumul * crans;
    return el("div",{class:"calc-cumul-ligne"},[
      el("span",{class:"calc-cumul-nom",
        text:ligne.libelle.replace(/\s*[+-][\d.,  ]+%\s*$/, "")}),
      el("div",{class:"calc-cumul-reglage"},[
        choix,
        el("span",{class:"calc-cumul-apport",
          text:"/ " + ligne.cumuls + " cumuls — "
            + (crans ? "+" + (apport / 100).toFixed(2).replace(/\.?0+$/, "")
              + " %" : "éteint")})
      ])
    ]);
  }

  /* Les coequipiers arrivent de l'appelant : ce module n'a pas a savoir
     comment la page les choisit ni ou elle les range. */
  function sectionSoutiens(dispo, redessiner, coequipiers){
    const section = el("section",{class:"calc-soutiens calc-carte"},[
      el("h3",{class:"calc-carte-titre",text:"Soutiens"}),
      el("p",{class:"calc-avertissement",
        text:"À zéro, le chiffre est celui du héros seul. Cocher un buff ou "
          + "régler ses cumuls, c'est déclarer sa condition remplie : les "
          + "durées ne sont pas modélisées."})
    ]);
    if(!dispo.length){
      section.appendChild(el("p",{class:"calc-muette",
        text:coequipiers
          ? "Aucun membre de cette équipe n'apporte de buff modélisé "
            + "pour l'élément de ce build."
          : "Aucun buff connu ne s'applique à l'élément de ce build."}));
      return section;
    }
    /* REGROUPES PAR SOUTIEN. En liste plate, le nom se repetait sur chacune
       des vingt-quatre lignes et le membre lisait vingt-quatre fois « daisy »
       au lieu de voir cinq blocs. */
    const parSoutien = new Map();
    dispo.forEach(buff => {
      if(!parSoutien.has(buff.support)) parSoutien.set(buff.support, []);
      parSoutien.get(buff.support).push(buff);
    });

    const grilleSoutiens = el("div",{class:"calc-soutiens-grille"});
    parSoutien.forEach((buffs, slug) => {
      const bloc = el("div",{class:"calc-soutien"});
      /* L'arme sur l'EN-TETE, jamais sur chaque ligne : les buffs sont
         regroupes par soutien precisement pour ne pas repeter son nom
         vingt-quatre fois, et avec une equipe ils viennent tous de la meme
         arme. */
      const armeDuGroupe = buffs.find(buff => buff.arme);
      bloc.appendChild(el("h4",{class:"calc-soutien-nom",
        text:armeDuGroupe
          ? nomDuPersonnage(slug) + " · " + armeDuGroupe.arme
          : nomDuPersonnage(slug)}));
      buffs.forEach(buff => {
        if(reglable(buff)){
          bloc.appendChild(ligneACumuls(buff, redessiner));
          if(buff.repli){
            bloc.appendChild(el("p",{class:"calc-muette",
              text:"Build du coéquipier incomplet — valeur plafond."}));
          }
          return;
        }
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
        bloc.appendChild(el("label",{class:"calc-buff"},[
          caseACocher,
          el("span",{text:buff.libelle})
        ]));
        /* Le repli est DIT : sans cette ligne, un plafond servi faute de build
           lisible se lirait comme une valeur mesuree sur le coequipier. */
        if(buff.repli){
          bloc.appendChild(el("p",{class:"calc-muette",
            text:"Build du coéquipier incomplet — valeur plafond."}));
        }
      });
      grilleSoutiens.appendChild(bloc);
    });
    section.appendChild(grilleSoutiens);

    /* Un coequipier sans buff modelise garde une ligne. Le taire le ferait
       lire comme absent de l'equipe ; le chiffrer a zero le ferait lire comme
       inutile. C'est la meme regle qu'une competence sans coefficient. */
    if(coequipiers){
      const muets = coequipiers
        .filter(membre => !dispo.some(buff => buff.support === membre.charId))
        .map(membre => nomDuPersonnage(membre.charId));
      if(muets.length){
        section.appendChild(el("p",{class:"calc-muette",
          text:"Aucun buff modélisé : " + muets.join(", ") + "."}));
      }
    }
    return section;
  }

  /* Les passifs de tenue gravee. Une section a PART des soutiens, qui restent
     les buffs venus des competences : la tenue du heros calcule n'est pas un
     soutien, et les melanger brouillerait les deux. */
  function sectionTenuesGravees(passifs, redessiner){
    const section = el("section",{class:"calc-tenues calc-carte"},[
      el("h3",{class:"calc-carte-titre",text:"Tenues gravées"})
    ]);
    if(!passifs.length){
      section.appendChild(el("p",{class:"calc-muette",
        text:"Aucun passif de tenue gravée ne s'applique à ce build."}));
      return section;
    }
    const parPorteur = new Map();
    passifs.forEach(passif => {
      const cle = passif.support + "|" + passif.tenue;
      if(!parPorteur.has(cle)) parPorteur.set(cle, []);
      parPorteur.get(cle).push(passif);
    });

    const grille = el("div",{class:"calc-soutiens-grille"});
    parPorteur.forEach(lignes => {
      const bloc = el("div",{class:"calc-soutien"});
      const nomTenue = String(lignes[0].tenue).split("/").pop()
        .replace(/\.webp$/, "");
      bloc.appendChild(el("h4",{class:"calc-soutien-nom",
        text:nomDuPersonnage(lignes[0].support) + " · " + nomTenue}));
      lignes.forEach(passif => {
        /* Un passif a paliers se REGLE au lieu de se cocher : sa valeur reelle
           est presque toujours entre zero et son plafond, et la case
           envoyait tout le monde au plafond. */
        if(reglable(passif)){
          bloc.appendChild(ligneACumuls(passif, redessiner));
          if(passif.niveauInconnu){
            bloc.appendChild(el("p",{class:"calc-muette",
              text:"Niveau de passif non renseigné — valeur du niveau 1."}));
          }
          return;
        }
        const caseACocher = el("input",{
          type:"checkbox",
          onchange:()=>{
            if(etat.coches.has(passif.id)) etat.coches.delete(passif.id);
            else etat.coches.add(passif.id);
            redessiner();
          }
        });
        caseACocher.checked = etat.coches.has(passif.id);
        bloc.appendChild(el("label",{class:"calc-buff"},[
          caseACocher,
          el("span",{text:passif.libelle})
        ]));
        if(passif.niveauInconnu){
          bloc.appendChild(el("p",{class:"calc-muette",
            text:"Niveau de passif non renseigné — valeur du niveau 1."}));
        }
      });
      grille.appendChild(bloc);
    });
    section.appendChild(grille);
    return section;
  }

  /* Les potentiels tournes vers l'equipe. Une section a PART des deux autres,
     parce que la question qu'ils posent au membre est differente : ni « qui
     est dans mon equipe » ni « quelle tenue porte-t-il », mais « jusqu'ou a-t-il
     monte son personnage ». Le palier est ecrit sur chaque ligne pour cette
     raison - c'est le levier sur lequel le membre peut agir. */
  function sectionPotentiels(potentiels, redessiner){
    const section = el("section",{class:"calc-potentiels calc-carte"},[
      el("h3",{class:"calc-carte-titre",text:"Potentiels d'équipe"})
    ]);
    if(!potentiels.length){
      section.appendChild(el("p",{class:"calc-muette",
        text:"Aucun potentiel d'équipe ne s'applique à ce build. Les paliers "
          + "des coéquipiers viennent de leur fiche de roster."}));
      return section;
    }
    const parPorteur = new Map();
    potentiels.forEach(ligne => {
      const cle = ligne.support + "|" + ligne.arme;
      if(!parPorteur.has(cle)) parPorteur.set(cle, []);
      parPorteur.get(cle).push(ligne);
    });

    const grille = el("div",{class:"calc-soutiens-grille"});
    parPorteur.forEach(lignes => {
      const bloc = el("div",{class:"calc-soutien"});
      bloc.appendChild(el("h4",{class:"calc-soutien-nom",
        text:nomDuPersonnage(lignes[0].support) + " · " + lignes[0].arme}));
      lignes.forEach(ligne => {
        const caseACocher = el("input",{
          type:"checkbox",
          onchange:()=>{
            if(etat.coches.has(ligne.id)) etat.coches.delete(ligne.id);
            else etat.coches.add(ligne.id);
            redessiner();
          }
        });
        caseACocher.checked = etat.coches.has(ligne.id);
        bloc.appendChild(el("label",{class:"calc-buff"},[
          caseACocher,
          el("span",{text:"T" + ligne.palier + " — " + ligne.libelle})
        ]));
        if(ligne.repli){
          bloc.appendChild(el("p",{class:"calc-muette",
            text:"ATK du porteur illisible — valeur au plafond."}));
        }
      });
      grille.appendChild(bloc);
    });
    section.appendChild(grille);
    return section;
  }

  /* Ce que porte une ligne d'ensemble, dit en clair. Souverain cupide n'emploie
     que ces deux codes ; un code inconnu se tait plutot que d'afficher son
     identifiant brut a un membre. */
  const LIBELLE_STAT_ENSEMBLE = {
    C_Critical_Rate:"taux critique",
    D_Protect_Cur_Rate:"percement de défense"
  };

  /* CE QUE LE BUFF FAIT REELLEMENT, ET CE QU'IL NE FERA PAS.

     Les deux seules statistiques de Souverain cupide sont muettes sur les
     colonnes Non-crit et Crit : la formule ne les y fait entrer nulle part. Le
     taux critique ne pondere que l'esperance, et le percement ne mord que sur
     une armure - sur le mannequin, degatsAttendus() l'ignore volontairement.

     Un membre qui change d'etat et ne voit aucun chiffre bouger en conclut que
     la page est cassee. Ces lignes existent pour que le silence du tableau soit
     un resultat annonce, et non une panne supposee. */
  function apportDeLEnsemble(scenario, contexte){
    const lignes = scenario.lignes;
    if(!lignes.length) return [];
    const source = contexte || {};
    const cible = source.cible || {};
    const dit = lignes
      .filter(ligne => LIBELLE_STAT_ENSEMBLE[ligne.stat])
      .map(ligne => LIBELLE_STAT_ENSEMBLE[ligne.stat]
        + " +" + (Math.round(ligne.valeur) / 100) + " %");
    const notes = [el("p",{class:"calc-muette",
      text:"Ce buff ajoute " + dit.join(" et ") + "."})];

    const critique = lignes.find(ligne => ligne.stat === "C_Critical_Rate");
    /* Le plafond mord sur le taux NET de la resistance de la cible, comme dans
       degatsAttendus() : l'annoncer sur le taux brut se tromperait contre
       Akumu, dont la resistance critique atteint 122 % au niveau 20. */
    const critNet = (Number(source.critRate) || 0) - (Number(cible.critResist) || 0);
    if(critique && critNet >= PLAFOND_PROPRE){
      notes.push(el("p",{class:"calc-avertissement",
        text:"Taux critique déjà au plafond de "
          + (PLAFOND_PROPRE / 100) + " % : ce bonus n'ajoute rien."}));
    }else if(critique){
      notes.push(el("p",{class:"calc-muette",
        text:"Le taux critique ne déplace que la colonne Espérance — "
          + "jamais Non-crit ni Crit."}));
    }

    const percement = lignes.find(ligne => ligne.stat === "D_Protect_Cur_Rate");
    if(percement && !(Number(cible.def) > 0)){
      notes.push(el("p",{class:"calc-avertissement",
        text:"Sans armure, le percement n'a rien à percer : "
          + "il reste sans effet sur le mannequin."}));
    }
    return notes;
  }

  /* Le set est deja porte par le heros. Son etat temporaire est le seul choix
     local : les trois options remplacent un effet, elles ne se cochent pas. */
  function sectionPassifEnsemble(scenario, redessiner, contexte){
    if(!scenario) return null;
    const section = el("section",{class:"calc-ensembles calc-carte"},[
      el("h3",{class:"calc-carte-titre",text:"Bonus d'ensemble"}),
      el("p",{class:"calc-avertissement",
        text:scenario.nom + " — palier " + scenario.seuil + " pièces."})
    ]);
    if(scenario.tier === "seven"){
      section.appendChild(el("p",{class:"calc-muette",
        text:"Le palier 7 remplace le buff temporaire du palier précédent."}));
    }
    const choix = el("select",{
      "data-set-passive":scenario.setId,
      onchange:event => {
        etat.etatsEnsembles[scenario.setId] = Number(event.target.value) || 0;
        redessiner();
      }
    });
    ["Aucun buff temporaire", "Après une relève", "Après deux relèves"]
      .forEach((libelle, valeur) => {
        const option = el("option",{value:String(valeur), text:libelle});
        option.selected = valeur === scenario.etat;
        choix.appendChild(option);
      });
    section.appendChild(el("label",{class:"calc-champ"},[
      el("span",{text:"État du bonus"}), choix
    ]));
    apportDeLEnsemble(scenario, contexte)
      .forEach(note => section.appendChild(note));
    return section;
  }

  /* Les passifs de l'arme equipee se reglent au cran : leur duree courte et
     leur origine precise interdisent de les presenter comme un buff d'equipe. */
  function sectionPassifsArmes(passifs, redessiner){
    const section = el("section",{class:"calc-passifs-armes calc-carte"},[
      el("h3",{class:"calc-carte-titre",text:"Passifs d'arme"})
    ]);
    if(!passifs.length){
      section.appendChild(el("p",{class:"calc-muette",
        text:"Aucun passif d'arme chiffré ne s'applique à ce build."}));
      return section;
    }
    passifs.forEach(passif => {
      /* Meme partage que les tenues gravees : ce qui monte par crans se
         regle, le reste se coche. Derouler un selecteur de zero a zero sur un
         passif sans cumuls donnerait un reglage qui ne regle rien. */
      if(reglable(passif)){
        section.appendChild(ligneACumuls(passif, redessiner));
      }else{
        const caseACocher = el("input",{
          type:"checkbox",
          onchange:()=>{
            if(etat.coches.has(passif.id)) etat.coches.delete(passif.id);
            else etat.coches.add(passif.id);
            redessiner();
          }
        });
        caseACocher.checked = etat.coches.has(passif.id);
        section.appendChild(el("label",{class:"calc-buff"},[
          caseACocher,
          el("span",{text:passif.libelle})
        ]));
      }
      if(passif.niveauInconnu){
        section.appendChild(el("p",{class:"calc-muette",
          text:"Niveau de passif non renseigné — valeur du niveau 1."}));
      }
    });
    return section;
  }

  /* Tout ce que le membre peut activer sur cette page, dans l'ordre ou il le
     lit. Les degats supplementaires INCONDITIONNELS en sont exclus : ils n'ont
     pas de condition a declarer, puisqu'ils sont deja comptes. */
  function lignesCochables(soutiens, passifsGraves, potentiels, passifsArmes,
                           supplements){
    return soutiens
      .concat(passifsGraves)
      .concat(potentiels)
      .concat(passifsArmes)
      .concat(supplements.filter(ligne => ligne.condition));
  }

  /* « Tout cocher ».

     Ce n'est pas un raccourci anodin, et l'avertissement le dit : cocher une
     case, c'est declarer sa condition remplie. Tout cocher, c'est declarer que
     les cinq sections sont simultanement vraies - Extinction comprise, qui
     double la ligne et ne dure que 5 s, et un combo deja plein alors que le
     premier coup n'est pas parti. Le chiffre obtenu est un PLAFOND theorique,
     pas ce qu'un combat rend.

     Elle ne se contente pas d'ajouter : decochee, elle retire exactement les
     memes identifiants. Vider `etat.coches` en entier effacerait des choix
     portant sur un autre build, que la page reproposera plus tard. */
  function sectionToutCocher(lignes, redessiner){
    const section = el("section",{class:"calc-tout-cocher"});
    if(!lignes.length) return section;
    /* Une ligne a cumuls compte comme cochee quand elle est A FOND, et cette
       case l'y envoie. C'est exactement ce que son avertissement annonce : un
       plafond theorique, pas ce qu'un combat rend. */
    const toutes = lignes.every(estRetenue);
    const caseACocher = el("input",{
      type:"checkbox",
      onchange:()=>{
        lignes.forEach(ligne => {
          if(reglable(ligne)){
            etat.cumuls[ligne.id] = toutes ? 0 : ligne.cumuls;
            return;
          }
          if(toutes) etat.coches.delete(ligne.id);
          else etat.coches.add(ligne.id);
        });
        redessiner();
      }
    });
    caseACocher.checked = toutes;
    /* PAS la classe `calc-buff` : cette case COMMANDE les buffs, elle n'en est
       pas un. Les confondre ferait d'elle le premier element de toute liste de
       buffs - et « cocher le premier buff » cocherait alors la page entiere. */
    section.appendChild(el("label",{class:"calc-tout-cocher-case"},[
      caseACocher,
      el("span",{
        text:"Tout cocher — " + lignes.length + " buff(s) disponible(s)"})
    ]));
    section.appendChild(el("p",{class:"calc-avertissement",
      text:"Toutes conditions déclarées remplies en même temps : c'est un "
        + "plafond théorique, pas ce qu'un combat rend."}));
    return section;
  }

  /* Les degats supplementaires que les potentiels du heros CALCULE ajoutent.
     Aucun ne vient d'un coequipier : « la derniere frappe de SA competence
     normale » ne profite qu'a celui qui frappe. */
  function supplementsDuHeros(hero){
    return degatsSupplementairesApplicables({
      charId:etat.charId,
      typeArme:etat.typeArme,
      palier:hero && hero.potentiel ? hero.potentiel.tier : null
    });
  }

  /* Ceux qui entrent VRAIMENT dans le calcul : les inconditionnels toujours,
     les autres seulement coches. La regle est celle de tout le reste de la
     page - cocher, c'est declarer sa condition remplie - mais elle ne
     s'applique qu'a ce qui a une condition. */
  function supplementsRetenus(supplements){
    return supplements
      .filter(ligne => !ligne.condition || etat.coches.has(ligne.id));
  }

  /* Une section qui MELANGE deux sortes de lignes, a dessein : celles qui
     agissent seules et celles qui attendent une case. Les separer en deux
     blocs aurait laisse croire que les premieres sont facultatives, alors
     qu'elles sont deja dans le chiffre affiche. */
  function sectionSupplements(supplements, redessiner){
    const section = el("section",{class:"calc-supplements calc-carte"},[
      el("h3",{class:"calc-carte-titre",text:"Dégâts supplémentaires"})
    ]);
    if(!supplements.length){
      section.appendChild(el("p",{class:"calc-muette",
        text:"Aucun potentiel de ce build n'ajoute de dégâts à une compétence."}));
      return section;
    }
    supplements.forEach(ligne => {
      const texte = "T" + ligne.palier + " — " + ligne.libelle;
      if(!ligne.condition){
        section.appendChild(el("p",{class:"calc-supplement-actif",
          text:texte + " — compté"}));
        return;
      }
      const caseACocher = el("input",{
        type:"checkbox",
        onchange:()=>{
          if(etat.coches.has(ligne.id)) etat.coches.delete(ligne.id);
          else etat.coches.add(ligne.id);
          redessiner();
        }
      });
      caseACocher.checked = etat.coches.has(ligne.id);
      section.appendChild(el("label",{class:"calc-buff"},[
        caseACocher,
        el("span",{text:texte + " — " + ligne.condition})
      ]));
    });
    return section;
  }

export {
  ligneActive,
  lignesCochables,
  nomDuPersonnage,
  sectionPassifEnsemble,
  sectionPassifsArmes,
  sectionPotentiels,
  sectionSoutiens,
  sectionSupplements,
  sectionTenuesGravees,
  sectionToutCocher,
  supplementsDuHeros,
  supplementsRetenus
};
