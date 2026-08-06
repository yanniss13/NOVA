/* Le corps d'une fiche de piece : armure, bijou, armure gravee.

   Les trois partagent la meme forme — une vignette, une provenance, parfois un
   passif, des statistiques, des gravures — et ne different que par leur
   provenance : une piece d'ensemble affiche son ensemble, une armure gravee
   affiche le heros auquel elle est liee.

   Il ne connait pas la modale qui l'affiche : il rend une liste de noeuds et
   recoit du contexte le niveau choisi, le moyen d'en changer et les deux
   ouvertures dont il a besoin. C'est ce qui permet a une seule modale de
   servir les trois natures d'objet. */

import { ARMOR_LABELS, JEWEL_LABELS } from "../noyau/constantes.js";
import { el } from "../noyau/dom.js";
import { charOf } from "../metier/catalogue.js";
import { buildGearDefinition, gearStatValue } from "../metier/build-config.js";
import { ensembleDe } from "../metier/wiki-equipement.js";
import { renderBonus } from "./elements.js";
import {
  libelleDeRarete, libelleDeStat, ligneDeValeur, listeDeLignes, listeDeStats,
  repliable, selecteurNiveaux, texteDeValeur, titreSection
} from "./wiki-blocs.js";

  const libelleFamille = famille =>
    ARMOR_LABELS[famille] || JEWEL_LABELS[famille] || famille;

  function entetePiece(piece, definition){
    const chips = el("div",{class:"wiki-item-chips"});
    if(piece.famille){
      chips.appendChild(el("span",{
        class:"wiki-chip wiki-chip-fort", text:libelleFamille(piece.famille)
      }));
    }
    if(piece.grade){
      chips.appendChild(el("span",{
        class:"wiki-chip", text:libelleDeRarete(piece.grade)
      }));
    }
    /* La plage de qualite est la fourchette dans laquelle la piece tombe : ce
       n'est pas un niveau a monter mais un tirage a l'obtention, et c'est ce
       qui separe deux pieces d'apparence identique. */
    if(definition && definition.qualityMin && definition.qualityMax){
      chips.appendChild(el("span",{
        class:"wiki-chip",
        text:"Qualité " + definition.qualityMin + "–" + definition.qualityMax
      }));
    }
    return el("div",{class:"wiki-item-head"},[
      el("div",{class:"wiki-item-frame"},[
        el("img",{ class:"wiki-item-image", src:piece.file, alt:"", loading:"lazy" })
      ]),
      el("div",{class:"wiki-item-id"},[
        el("div",{class:"wiki-item-name", text:piece.nom}),
        chips
      ])
    ]);
  }

  /* L'ensemble et ses paliers.

     ⚠️ Les seuils ne sont pas 2 / 4 / 7 : ils se lisent dans les donnees, et
     `compte` vaut 3 dans une bonne moitie des ensembles. Ecrire « 2 pieces »
     en dur mentirait sur la moitie du catalogue.

     Le texte porte des clauses qu'aucun chiffre ne represente — « activer un
     Deluge restaure la jauge de magie » — d'ou son passage par renderBonus()
     plutot qu'un simple affichage des statistiques. */
  function palierDEnsemble(item){
    const bloc = el("div",{class:"wiki-set-tier"},[
      el("span",{
        class:"wiki-set-count",
        text:item.compte + (item.compte > 1 ? " pièces" : " pièce")
      })
    ]);
    if(item.texte){
      bloc.appendChild(el("p",{
        class:"wiki-set-text", html:renderBonus(item.texte)
      }));
    }else{
      const liste = listeDeStats(
        (item.stats || []).map(stat => [stat.stat, stat.value])
      );
      if(liste) bloc.appendChild(liste);
    }
    return bloc;
  }

  /* Les pieces soeurs, en vignettes cliquables.

     C'est ce qui repare la coupure des grilles Armures et Bijoux : un ensemble
     d'accessoires n'a que des bijoux, un ensemble d'armures que des armures,
     et le membre arrive par l'une ou par l'autre. La liste ne depend pas de la
     grille d'ou l'on vient. */
  function piecesSoeurs(ensemble, piece, contexte){
    const rangee = el("div",{class:"wiki-set-pieces"});
    ensemble.pieces.forEach(item => {
      const courante = item.file === piece.file;
      rangee.appendChild(el("button",{
        class:"wiki-set-piece" + (courante ? " active" : ""),
        type:"button",
        title:item.nom,
        "aria-current":courante ? "true" : "false",
        dataset:{ file:item.file },
        onclick:()=>{ if(!courante) contexte.ouvrirFichier(item.file); }
      },[
        el("img",{ src:item.file, alt:"", loading:"lazy" })
      ]));
    });
    return rangee;
  }

  function blocEnsemble(piece, contexte){
    const ensemble = piece.setId ? ensembleDe(piece.setId) : null;
    if(!ensemble) return [];
    const zone = el("div",{class:"wiki-set"});
    zone.appendChild(el("div",{ class:"wiki-set-name", text:ensemble.nom }));
    ensemble.paliers.forEach(item => zone.appendChild(palierDEnsemble(item)));
    if(ensemble.pieces.length) zone.appendChild(piecesSoeurs(ensemble, piece, contexte));
    return [titreSection("Ensemble", "passif"), zone];
  }

  /* Le heros auquel une armure gravee est liee, cliquable : sa fiche du lot 1
     s'ouvre par-dessus celle-ci. C'est le seul chemin qui mene d'un objet a un
     personnage. */
  function blocHeros(piece, contexte){
    const heros = piece.heros ? charOf(piece.heros) : null;
    if(!heros) return [];
    return [
      titreSection("Héros lié", "passif"),
      el("button",{
        class:"wiki-linked-hero",
        type:"button",
        dataset:{ char:heros.id },
        onclick:()=>contexte.ouvrirHeros(heros.id)
      },[
        el("img",{ src:heros.file, alt:"", loading:"lazy" }),
        el("span",{ text:heros.name })
      ])
    ];
  }

  /* Le passif et ses niveaux — trois pour les gravees comme pour les dix
     pieces autonomes qui en portent un. Les pieces d'ensemble n'en ont pas :
     l'ensemble tient ce role. */
  function passifPiece(definition, contexte){
    const niveaux = (definition && definition.passiveLevels) || [];
    if(!niveaux.length) return [];
    const maximum = niveaux[niveaux.length - 1].level;
    const actif = contexte.niveau === null || contexte.niveau === undefined
      ? maximum
      : contexte.niveau;
    const choisi = niveaux.find(item => item.level === actif) || niveaux[0];
    return [
      titreSection("Passif", "passif"),
      selecteurNiveaux(
        niveaux.map(item => item.level), choisi.level, contexte.choisirNiveau
      ),
      el("p",{ class:"wiki-skill-desc", html:renderBonus(choisi.textFr || "") })
    ];
  }

  /* Les statistiques a leur plafond : qualite maximale et renforcement
     maximal.

     Le calcul n'est pas refait ici — `gearStatValue` est celui du comparateur,
     avec ses courbes et son arrondi. Une seule regle, un seul endroit ou elle
     peut avoir tort. */
  function statistiquesPiece(definition){
    const niveau = definition.qualityMax;
    const renfort = definition.reinforceMax;
    const valeur = (courbe, ajout) =>
      gearStatValue(definition, courbe, ajout, niveau, renfort);
    const paires = [];
    if(definition.mainStat && definition.mainValues){
      paires.push([
        definition.mainStat, valeur(definition.mainValues, definition.mainAdd)
      ]);
    }
    if(definition.subStat && definition.subValues){
      paires.push([
        definition.subStat, valeur(definition.subValues, definition.subAdd)
      ]);
    }
    (definition.extraStats || []).forEach(extra => {
      if(!extra || !extra.stat) return;
      paires.push([extra.stat, valeur(extra.values, extra.add)]);
    });
    return listeDeStats(paires);
  }

  /* Les gravures : ce que la piece PEUT tirer, pas ce qu'elle a tire. Chaque
     option publie ses deux bornes ; le nombre d'emplacements dit combien on en
     obtient. */
  function gravuresPossibles(definition){
    const options = (definition.randomOptions
      && definition.randomOptions.stats) || [];
    if(!options.length) return null;
    const lignes = options.map(option => {
      const libelle = libelleDeStat(option.stat);
      if(!libelle) return null;
      const bas = texteDeValeur(option.min, libelle.unit);
      const haut = texteDeValeur(option.max, libelle.unit);
      if(bas === null || haut === null) return null;
      return ligneDeValeur(libelle.fr, bas === haut ? haut : bas + " → " + haut);
    });
    const liste = listeDeLignes(lignes);
    if(!liste) return null;
    const zone = el("div");
    const emplacements = Number(definition.randomOptions.slots) || 0;
    if(emplacements){
      zone.appendChild(el("p",{
        class:"wiki-item-note",
        text:emplacements > 1
          ? emplacements + " emplacements tirés au sort"
          : "1 emplacement tiré au sort"
      }));
    }
    zone.appendChild(liste);
    return zone;
  }

  function corpsEquipement(piece, contexte){
    const definition = buildGearDefinition(piece.file);
    if(!definition){
      return [
        entetePiece(piece, null),
        el("p",{
          class:"wiki-hero-hint",
          text:"Les statistiques de cette pièce ne sont pas encore publiées."
        })
      ];
    }
    return [entetePiece(piece, definition)]
      .concat(piece.nature === "gravee"
        ? blocHeros(piece, contexte)
        : blocEnsemble(piece, contexte))
      .concat(passifPiece(definition, contexte))
      .concat([
        titreSection("Statistiques au maximum", "normal"),
        statistiquesPiece(definition),
        repliable("Gravures possibles", gravuresPossibles(definition))
      ]);
  }

export { corpsEquipement };
