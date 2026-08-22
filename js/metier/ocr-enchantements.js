/* Des lignes lues vers des choix d'enchantement.

   Contrairement au niveau ou au renforcement, un enchantement ne se deduit
   presque pas : il s'affiche. Le libelle donne la statistique, le nombre donne
   la valeur, le rang donne l'emplacement. Le catalogue ne sert qu'a verifier
   que le triplet est possible — une valeur hors des bornes signale une
   mauvaise lecture au lieu d'entrer dans le roster.

   Une perle de sortilege demande deux choses de plus, un palier et un element,
   qui ne sont ecrits nulle part sur le panneau. Elles se retrouvent par
   recoupement : le nombre de lignes remplies borne le palier, les bornes de
   valeur l'affinent, et une statistique elementaire designe l'element. Quand
   le recoupement laisse plusieurs possibilites, on le DIT au lieu de choisir
   en silence. */

import {
  buildGearDefinition,
  enchantmentBounds,
  gearEnchantmentLength
} from "./build-config.js";
import { pearlRequiredSlotCount, pearlSlotCount } from "./perles.js";
import { recalerLibelle, valeurNumerique } from "./ocr-libelles.js";

  /* Une ligne lue devient un choix si — et seulement si — son libelle se
     recale sur une option de la liste ET que sa valeur tient dans les bornes
     de cette option. Les deux conditions comptent : la seconde est ce qui
     transforme le catalogue en filet plutot qu'en simple dictionnaire.

     Le recalage se fait contre le catalogue ENTIER, jamais contre la seule
     liste permise. Restreindre d'abord parait plus malin — moins de candidats,
     donc moins d'hesitation — mais c'est l'inverse : prive de ses vrais
     voisins, un libelle tombe sur le moins mauvais de la liste restreinte.
     Mesure a l'appui, « Augmentation des degats de Foudre » se recalait ainsi
     sur « Augmentation des degats physiques », et le groupe elementaire faux
     ressortait comme explication valable. On identifie donc la statistique en
     premier, puis on demande si la piece peut la porter. */
  function choixDeLaLigne(ligne, options, dejaVues){
    if(!ligne) return null;
    const recale = recalerLibelle(ligne.libelle, ligne.valeur, []);
    if(recale.statut === "rejete" || !recale.code) return null;
    if(!options.some(option => option.stat === recale.code)) return null;
    if(dejaVues.has(recale.code)) return null;
    const nombre = valeurNumerique(ligne.valeur);
    if(nombre === null) return null;
    const option = options.find(item => item.stat === recale.code);
    if(!option || nombre < option.min || nombre > option.max) return null;
    dejaVues.add(recale.code);
    return { stat:recale.code, value:nombre };
  }

  /* Seules les pieces gravees portent des enchantements : `randomOptions` est
     absent de toutes les autres. La longueur du tableau vient du catalogue, pas
     du nombre de lignes lues — une configuration doit remplir tous ses
     emplacements, quitte a les laisser vides. */
  function enchantementsDePiece(fichier, lignes){
    const definition = buildGearDefinition(fichier);
    const longueur = definition ? gearEnchantmentLength(definition) : 0;
    if(!longueur) return [];
    const options = ((definition.randomOptions || {}).stats) || [];
    const lues = Array.isArray(lignes) ? lignes : [];
    const dejaVues = new Set();
    return Array.from({ length:longueur }, (_, slot) => {
      const choix = choixDeLaLigne(lues[slot], options, dejaVues);
      return choix ? { slot, stat:choix.stat, value:choix.value } : null;
    });
  }

  /* Un enchantement basique a des bornes propres a chaque emplacement : le
     catalogue donne une plage de reference et un taux par emplacement. Sans ce
     redressement, une valeur legitime paraitrait hors bornes. */
  function enchantementsBasiques(catalogue, lignes){
    const taux = catalogue.slots || [];
    const dejaVues = new Set();
    return taux.map((tauxDuSlot, slot) => {
      const options = (catalogue.options || []).map(option => Object.assign(
        {}, option, enchantmentBounds(option, tauxDuSlot)
      ));
      const choix = choixDeLaLigne(lignes[slot], options, dejaVues);
      return choix ? { slot, stat:choix.stat, value:choix.value } : null;
    });
  }

  /* Les groupes d'options d'un palier : un seul quand le palier ignore les
     elements, un par element sinon. */
  function groupesDuPalier(palier){
    if(Array.isArray(palier.elements) && palier.elements.length){
      return palier.elements.map(groupe => ({
        element:groupe.element, options:groupe.options || []
      }));
    }
    return [{ element:null, options:palier.options || [] }];
  }

  /* Toutes les combinaisons (palier, element) qui expliquent les lignes lues.
     Le nombre de lignes borne le palier — une perle Commune n'ouvre qu'un
     emplacement, une Legendaire quatre — et les bornes de valeur font le
     reste. */
  function combinaisonsDePerle(catalogue, lignes){
    const trouvees = [];
    for(const palier of catalogue.tiers || []){
      const maximum = pearlSlotCount(palier.tier);
      const minimum = pearlRequiredSlotCount(palier.tier);
      if(lignes.length < minimum || lignes.length > maximum) continue;
      for(const groupe of groupesDuPalier(palier)){
        const dejaVues = new Set();
        const choix = lignes.map((ligne, slot) => {
          const trouve = choixDeLaLigne(ligne, groupe.options, dejaVues);
          return trouve ? { slot, tier:palier.tier, element:groupe.element,
            stat:trouve.stat, value:trouve.value } : null;
        });
        if(choix.some(entree => entree === null)) continue;
        trouvees.push({ tier:palier.tier, element:groupe.element, choix });
      }
    }
    return trouvees;
  }

  /* Quand plusieurs elements expliquent aussi bien les lignes, aucun chiffre
     ne les separe : leurs bornes sont identiques pour les statistiques non
     elementaires. On retient alors celui de l'arme elle-meme — la Rapiere de
     l'ame vorace porte « Attaque de Vent », donc sa perle est presumee de Vent
     — et l'appelant le signale comme suppose. C'est une supposition affichee,
     pas une supposition cachee. */
  function preferee(combinaisons, statsNatives){
    const natives = new Set(statsNatives || []);
    const parElement = combinaisons.find(item =>
      aUneStatNative(item, natives));
    if(parElement) return parElement;
    /* A defaut, la perle entierement remplie : un membre remplit ses
       emplacements avant d'en ouvrir d'autres. */
    const pleine = combinaisons.find(item =>
      pearlSlotCount(item.tier) === item.choix.length);
    return pleine || combinaisons[0];
  }

  /* Une combinaison « porte » l'element de l'arme si son groupe contient une
     statistique que l'arme possede nativement. */
  const CORRESPONDANCES = {
    fire:"Fire", ice:"Ice", thunder:"Thunder", wind:"Wind",
    earth:"Earth", holy:"Holy", dark:"Dark"
  };
  function aUneStatNative(combinaison, natives){
    const prefixe = CORRESPONDANCES[combinaison.element];
    if(!prefixe) return false;
    for(const stat of natives){
      if(String(stat).startsWith(prefixe + "_")) return true;
    }
    return false;
  }

  /* Une arme sans enchantement lisible ne doit pas etre rejetee : elle entre
     avec ses emplacements vides. La configuration nue d'une perle compte un
     emplacement, celle d'un basique autant que le catalogue en declare. */
  function nueDArme(grade){
    const catalogue = (grade && grade.enchantments) || {};
    if(catalogue.type === "masterstone") return [null];
    return (catalogue.slots || []).map(() => null);
  }

  function enchantementsDArme(grade, lignes, statsNatives){
    const catalogue = (grade && grade.enchantments) || {};
    const lues = (Array.isArray(lignes) ? lignes : []).filter(Boolean);
    if(catalogue.type === "basic"){
      const choix = enchantementsBasiques(catalogue, lues);
      return { choix, tier:null, element:null, suppose:false };
    }
    if(catalogue.type !== "masterstone" || !lues.length){
      return { choix:nueDArme(grade), tier:null, element:null, suppose:false };
    }
    const combinaisons = combinaisonsDePerle(catalogue, lues);
    if(!combinaisons.length){
      return { choix:nueDArme(grade), tier:null, element:null, suppose:false };
    }
    const retenue = preferee(combinaisons, statsNatives);
    return {
      choix:retenue.choix,
      tier:retenue.tier,
      element:retenue.element,
      suppose:combinaisons.length > 1
    };
  }

/* L'inversion d'arme reutilise ces deux formes afin de soumettre le resultat
   au meme juge que la saisie manuelle. */
export { enchantementsDArme, enchantementsDePiece, nueDArme };
