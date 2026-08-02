/* Emplacements d'equipement : sets, et modeles vides.

   Deux choses ici : la detection des sets (plusieurs pieces d'une meme
   famille, reconnue par la racine commune de leurs noms de fichiers) et les
   modeles vides d'armure, de bijou et de potentiel.

   Feuille de l'arbre : ne depend que de js/constantes.js. Les cinq fonctions
   de detection de racine commune restent privees, elles n'ont aucun sens
   hors d'ici. */

import { ARMOR_SLOTS, JEWEL_SLOTS } from "../noyau/constantes.js";

  const emptyArmor = () => ARMOR_SLOTS.reduce((o,s)=>(o[s]=null,o),{});

  /* ---------- Sets d'équipement (armures ET bijoux) ----------
     Les sets ne sont JAMAIS listés en dur : ils sont déduits de
     `window.SEVEN_DS_DATA`. Le nom d'une pièce est le libellé de son
     emplacement suivi du nom du set — « Haut de la mélodie d'Arachnée »,
     « Bottes de combat de la mélodie d'Arachnée », « Boucles d'oreilles de la
     mélodie d'Arachnée » — donc on regroupe par plus long suffixe commun.
     Cette approche survit à l'ajout d'une pièce hors convention : seule
     celle-là ne trouvera pas de set, les autres tiennent.
     L'armure liée est exclue : elle est propre au personnage et n'a pas de set. */
  const ARMOR_SET_SLOTS = ["Haut","Bas","Bottes","Ceinture"];
  const ARMOR_SET_MIN_STEM = 6;

  /* Une note entre parenthèses en fin de nom n'appartient pas à l'identité du
     set. Sans ce nettoyage, « Anneau des 100 jours (jamais porté) » et
     « Boucles d'oreilles des 100 jours (jamais portées) » ne se rejoignent pas,
     l'accord du participe cassant le suffixe commun. */
  function stripSetNote(name){
    return String(name || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
  }

  function commonSuffix(a, b){
    const left = String(a), right = String(b);
    let i = 0;
    while(
      i < left.length && i < right.length &&
      left[left.length-1-i] === right[right.length-1-i]
    ) i++;
    return left.slice(left.length - i);
  }

  function armorSetLabel(stem){
    const raw = String(stem).trim();
    // Retire l'article français de liaison pour un libellé lisible en liste.
    const cleaned = raw
      .replace(/^(?:de\s+(?:la|les|le|l['’])|du|des|d['’])\s*/i, "")
      .trim();
    const label = cleaned || raw;
    return label ? label[0].toLocaleUpperCase("fr-FR")+label.slice(1) : "";
  }

  function equipmentSetsFrom(source, slots){
    const groups = source && typeof source === "object" ? source : {};
    const lists = slots.map(slot =>
      Array.isArray(groups[slot]) ? groups[slot] : []
    );
    if(lists.some(list => !list.length)) return [];
    const [reference, ...others] = lists;
    const sets = [];
    reference.forEach(base => {
      const baseName = stripSetNote(base.name);
      const pieces = {};
      pieces[slots[0]] = base.file;
      let stem = baseName;
      const complete = others.every((list, index) => {
        let best = null;
        let bestSuffix = "";
        list.forEach(candidate => {
          const suffix = commonSuffix(baseName, stripSetNote(candidate.name));
          if(suffix.length > bestSuffix.length){
            bestSuffix = suffix;
            best = candidate;
          }
        });
        if(!best || bestSuffix.trim().length < ARMOR_SET_MIN_STEM) return false;
        if(bestSuffix.length < stem.length) stem = bestSuffix;
        pieces[slots[index+1]] = best.file;
        return true;
      });
      if(!complete) return;
      const name = armorSetLabel(stem);
      if(name) sets.push({ name, pieces });
    });
    return sets.sort((a,b) => a.name.localeCompare(b.name, "fr-FR"));
  }

  function armorSetsFrom(armures){
    return equipmentSetsFrom(armures, ARMOR_SET_SLOTS);
  }

  function jewelSetsFrom(bijoux){
    return equipmentSetsFrom(bijoux, JEWEL_SLOTS);
  }
  const emptyJewel = () => JEWEL_SLOTS.reduce((o,s)=>(o[s]=null,o),{});
  const emptyPot = () => ({ tier:0 });

export {
  ARMOR_SET_SLOTS,
  armorSetsFrom,
  emptyArmor,
  emptyJewel,
  emptyPot,
  jewelSetsFrom
};
