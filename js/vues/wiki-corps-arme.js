/* Le corps d'une fiche d'arme : en-tete, passif, statistiques, enchantements.

   Il ne connait pas la modale qui l'affiche : il rend une liste de noeuds et
   recoit du contexte ce dont il a besoin — le niveau choisi et le moyen d'en
   changer. C'est ce qui permet a une seule modale de servir les trois natures
   d'objet.

   Aucune valeur n'est recalculee ici. La statistique principale d'une rarete
   publie sa base et son maximum ; on les affiche tels quels. Reconstruire un
   total de build serait dupliquer metier/stats-calcul.js — et le membre a deja
   le comparateur pour cela. */

import { BUILD_STATS, WEAPON_ENUM } from "../noyau/constantes.js";
import { el } from "../noyau/dom.js";
import { renderBonus } from "./elements.js";
import {
  libelleDeRarete, libelleDeStat, ligneDeValeur, listeDeLignes, repliable,
  selecteurNiveaux, texteDeValeur, titreSection
} from "./wiki-blocs.js";

  function statistiquesDe(arme){
    return (BUILD_STATS.weaponsByFile || {})[arme.file] || null;
  }

  /* Les raretes dans l'ordre du jeu. `arme.raretes` le tient deja : le module
     metier trie sur le chiffre du suffixe, pas sur l'alphabet. */
  function gradesOrdonnes(arme, stats){
    const parRarete = new Map();
    Object.values((stats && stats.gradesByGameId) || {}).forEach(grade => {
      if(grade && grade.rarity) parRarete.set(grade.rarity, grade);
    });
    return arme.raretes.map(rarete => parRarete.get(rarete)).filter(Boolean);
  }

  function enteteArme(arme){
    const chips = el("div",{class:"wiki-item-chips"});
    if(arme.type){
      chips.appendChild(el("span",{
        class:"wiki-chip wiki-chip-fort",
        text:(WEAPON_ENUM[arme.type] || {}).label || arme.type
      }));
    }
    arme.raretes.forEach(rarete => {
      chips.appendChild(el("span",{ class:"wiki-chip", text:libelleDeRarete(rarete) }));
    });
    return el("div",{class:"wiki-item-head"},[
      el("div",{class:"wiki-item-frame"},[
        el("img",{ class:"wiki-item-image", src:arme.file, alt:"", loading:"lazy" })
      ]),
      el("div",{class:"wiki-item-id"},[
        el("div",{class:"wiki-item-name", text:arme.nom}),
        chips
      ])
    ]);
  }

  /* Le passif et ses sept niveaux. Les textes ne different que par leurs
     chiffres : un selecteur vaut mieux que sept paragraphes empiles, et il
     ouvre sur le niveau maximum, celui qu'on vise. */
  function passifArme(arme, stats, contexte){
    const niveaux = (stats && stats.passiveLevels) || [];
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

  /* Une plage publiee telle quelle : « 89 → 279 ». Ni interpolation ni total
     reconstruit — ce sont les deux bornes que la source donne. */
  function lignePlage(code, minimum, maximum){
    const libelle = libelleDeStat(code);
    if(!libelle) return null;
    const bas = texteDeValeur(minimum, libelle.unit);
    const haut = texteDeValeur(maximum, libelle.unit);
    if(bas === null || haut === null) return null;
    return ligneDeValeur(libelle.fr, bas === haut ? haut : bas + " → " + haut);
  }

  function blocRarete(arme, stats, grade){
    const lignes = [];
    if(grade.mainStatValues){
      lignes.push(lignePlage(
        stats.mainStatCode, grade.mainStatValues.base, grade.mainStatValues.max
      ));
    }
    (grade.subStats || []).forEach(sous => {
      if(!sous || !sous.values) return;
      lignes.push(lignePlage(sous.stat, sous.values.base, sous.values.max));
    });
    const liste = listeDeLignes(lignes);
    if(!liste) return null;
    return el("div",{class:"wiki-grade"},[
      el("h4",{ class:"wiki-grade-title", text:libelleDeRarete(grade.rarity) }),
      liste
    ]);
  }

  function statistiquesArme(arme, stats){
    const blocs = gradesOrdonnes(arme, stats)
      .map(grade => blocRarete(arme, stats, grade))
      .filter(Boolean);
    if(!blocs.length) return null;
    const zone = el("div",{class:"wiki-grades"});
    blocs.forEach(bloc => zone.appendChild(bloc));
    return zone;
  }

  /* ⚠️ Deux formes d'enchantement selon la rarete, et il faut les deux.

     Les grades 1 a 3 publient une liste plate d'options avec leurs
     emplacements. Les grades 4 et 5 publient cinq PALIERS successifs — et ce
     sont exactement les 94 armes qui portent un passif, donc celles qu'on
     vient lire. Ne traiter que la premiere forme laissait la section vide sur
     toutes les armes interessantes. */
  function paliersDEnchantement(grade){
    const enchant = grade && grade.enchantments;
    if(!enchant) return [];
    if(enchant.type === "masterstone"){
      return (enchant.tiers || []).map(palier => ({
        titre:"Palier " + palier.tier,
        options:palier.options || null,
        /* Le dernier palier ne publie pas d'options mais neuf pools
           elementaires de treize options chacun. Cent dix-sept lignes n'ont
           pas leur place dans une fiche, et l'editeur d'arme du Builder les
           donne deja, exactes et selon l'element choisi. */
        note:palier.elements
          ? palier.elements.length + " pools élémentaires de "
            + ((palier.elements[0] || {}).options || []).length
            + " options — voir l’éditeur d’arme du Builder"
          : null
      }));
    }
    /* Les emplacements se comptent, mais leur valeur est un taux de chance :
       seul leur nombre parle au membre. */
    const emplacements = (enchant.slots || []).length;
    return [{
      titre:null,
      options:enchant.options || null,
      note:emplacements
        ? (emplacements > 1 ? emplacements + " emplacements" : "1 emplacement")
        : null
    }];
  }

  function blocEnchantement(palier){
    const liste = listeDeLignes(
      (palier.options || []).map(
        option => lignePlage(option.stat, option.min, option.max))
    );
    if(!liste && !palier.note) return null;
    const bloc = el("div",{class:"wiki-grade"});
    if(palier.titre){
      bloc.appendChild(el("h4",{ class:"wiki-grade-title", text:palier.titre }));
    }
    if(palier.note){
      bloc.appendChild(el("p",{ class:"wiki-item-note", text:palier.note }));
    }
    if(liste) bloc.appendChild(liste);
    return bloc;
  }

  /* Ceux de la rarete la plus haute : c'est celle qu'on monte. Les raretes
     inferieures proposent les memes options a des bornes plus basses, les
     repeter n'apprendrait rien. */
  function enchantements(arme, stats){
    const grades = gradesOrdonnes(arme, stats);
    const blocs = paliersDEnchantement(grades[grades.length - 1])
      .map(blocEnchantement)
      .filter(Boolean);
    if(!blocs.length) return null;
    const zone = el("div",{class:"wiki-grades"});
    blocs.forEach(bloc => zone.appendChild(bloc));
    return zone;
  }

  function corpsArme(arme, contexte){
    const stats = statistiquesDe(arme);
    if(!stats){
      return [
        enteteArme(arme),
        el("p",{
          class:"wiki-hero-hint",
          text:"Les statistiques de cette arme ne sont pas encore publiées."
        })
      ];
    }
    return [enteteArme(arme)]
      .concat(passifArme(arme, stats, contexte))
      .concat([
        repliable("Statistiques par rareté", statistiquesArme(arme, stats)),
        repliable("Enchantements", enchantements(arme, stats))
      ]);
  }

export { corpsArme };
