/* L'accueil : ce que le membre doit faire cette semaine, au-dela du boss.

   Module PUR — ni DOM ni reseau. Il n'invente aucune donnee : il compose des
   faits que dispos-logique, equipe-modele et stats-calcul savent deja produire.

   Il vit hors de boss-logique.js a dessein. Ce dernier parle du boss ; lui
   faire accueillir les dispos et le roster brouillerait sa raison d'etre.

   REGLE TRANSVERSE — une lecture indisponible vaut `null`, jamais une valeur
   par defaut. Trois etats et non deux : donnee absente, donnee vide, donnee
   pleine. Annoncer « tes dispos ne sont pas posees » parce que la requete a
   echoue pousserait le membre a refaire un travail deja fait. */

import {
  aggregateAvailability,
  availabilitySlotFromIndex,
  normalizeAvailabilityMask
} from "./dispos-logique.js";
import {
  favoriteRosterWeaponType,
  normalizeRosterCharacter,
  rosterHeroSnapshot
} from "./equipe-modele.js";
import { calculateHeroStats } from "./stats-calcul.js";

  function countPosedSlots(mask){
    let total = 0;
    for(let index = 0; index < mask.length; index += 1){
      if(mask[index] === "1") total += 1;
    }
    return total;
  }

  function availabilitySummary(input){
    const source = input || {};
    /* Un tableau, meme vide, dit « j'ai lu ». Tout le reste dit « je ne sais
       pas », et la carte disparaitra plutot que de mentir. */
    if(!Array.isArray(source.rows)) return null;
    const userId = source.userId || "";
    const own = source.rows.find(row => row && row.owner === userId);
    const count = countPosedSlots(normalizeAvailabilityMask(own && own.slots));
    const { best } = aggregateAvailability(source.rows);
    const first = best.length ? best[0] : null;
    return {
      mine:{ posed:count > 0, count },
      best:first
        ? Object.assign(
            availabilitySlotFromIndex(first.index), { count:first.count }
          )
        : null
    };
  }

  /* Le build JUGE est le favori. A defaut, le premier build declare : les cles
     de `builds` sont posees par `normalizeRosterCharacter` dans l'ordre de
     `weaponTypesOf(charId)`, donc « le premier » est deterministe et non
     arbitraire. */
  function judgedWeaponType(entry){
    const favorite = favoriteRosterWeaponType(entry);
    if(favorite) return favorite;
    const normalized = normalizeRosterCharacter(entry);
    const types = normalized ? Object.keys(normalized.builds) : [];
    return types.length ? types[0] : null;
  }

  function rosterSummary(input){
    const source = input || {};
    if(!Array.isArray(source.characters)) return null;
    const toComplete = source.characters.filter(entry => {
      const weaponType = judgedWeaponType(entry);
      if(!weaponType) return true;
      const hero = rosterHeroSnapshot(entry, weaponType);
      if(!hero) return true;
      return calculateHeroStats(hero).status !== "valid";
    }).length;
    return { toComplete };
  }

export { availabilitySummary, rosterSummary };
