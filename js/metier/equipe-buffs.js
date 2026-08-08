/* Les buffs qu'une EQUIPE apporte reellement.

   Sans equipe, le calculateur propose tous les buffs du catalogue, toutes
   armes confondues : cocher Daisy offre ses buffs de Livre ET de Baguette,
   alors qu'elle n'en tient qu'une. Six des huit supports sont dans ce cas.

   Module PUR : ni DOM, ni reseau, ni roster. La vue lui passe des coequipiers
   deja reduits a { charId, typeArme, atk } ; c'est elle qui appelle
   calculateHeroStats et en extrait B_Atk. */

import { FOLDER_TO_ENUM } from "../noyau/constantes.js";
import { buffsApplicables } from "./calculateur-entrees.js";

  /* 10 000 dix-milliemes valent 100 %. Le nom differe de `DIX_MILLIEMES` chez
     le voisin, et de `RAPPORT` dans le moteur, a dessein : le chargeur de
     tests concatene tous les modules dans une MEME portee, donc deux `const`
     homonymes se heurtent. C'est la raison de ces trois noms pour une seule
     idee. */
  const TAUX_PLEIN = 10000;

  /* Le buff vient-il de l'arme equipee ?

     On ne cherche PAS quelle arme le gameId nomme : on verifie qu'il contient
     le jeton de l'arme equipee. Le sens compte, parce qu'un gameId s'ecrit
     <slug>_<arme>_<reste> et que le slug peut lui-meme contenir un tiret bas -
     `gil_thunder_lance_jumpatk` piegerait tout decoupage par position.

     Le roster range les armes par DOSSIER francais ; FOLDER_TO_ENUM donne
     l'enum, et le jeton est cet enum en minuscules, encadre de tirets bas. */
  function vientDeLArme(gameId, typeArme){
    const enumArme = FOLDER_TO_ENUM[typeArme];
    if(!enumArme) return false;
    return String(gameId || "").toLowerCase()
      .includes("_" + enumArme.toLowerCase() + "_");
  }

  /* La valeur effective d'un buff, et si elle est un repli.

     Trois buffs valent un pourcentage de l'ATK de leur LANCEUR, plafonne. Sans
     equipe, ou quand le build du support n'est pas lisible, on rend `valeur` -
     c'est-a-dire le plafond, donc exactement le chiffre d'avant ce module.

     HYPOTHESE, non mesuree : « 30 % de l'attaque du heros » est lu comme la
     seule ATK, sans l'attaque elementaire. Le moteur de degats, lui, ajoute
     l'attaque elementaire a l'ATK pour les composantes de base `atk` : les deux
     lectures ne coincident pas, et rien ne dit laquelle le jeu applique ici.
     La vue passe B_Atk. */
  function chiffre(buff, membre){
    const indexe = buff.indexeSurAtk;
    const atk = membre ? Number(membre.atk) : NaN;
    const chiffrable = Boolean(indexe) && Number.isFinite(atk) && atk > 0;
    return Object.assign({}, buff, {
      arme:membre ? membre.typeArme : null,
      valeur:chiffrable
        ? Math.min(indexe.plafond, Math.round(indexe.taux * atk / TAUX_PLEIN))
        : buff.valeur,
      repli:Boolean(indexe) && !chiffrable
    });
  }

  /* `coequipiers` a null vaut « aucune equipe » et rend la liste complete,
     telle qu'avant ce module. C'est ce qui garantit qu'aucun chiffre ne bouge
     tant que le membre n'a choisi aucune equipe.

     L'ordre suit les SIEGES de l'equipe, pas l'ordre alphabetique du
     catalogue : le membre lit son equipe telle qu'il l'a composee. */
  function buffsDeLEquipe(entree){
    const source = entree || {};
    const disponibles = buffsApplicables(source.element);
    const equipe = Array.isArray(source.coequipiers)
      ? source.coequipiers : null;
    if(!equipe) return disponibles.map(buff => chiffre(buff, null));
    return equipe.flatMap(membre => disponibles
      .filter(buff => buff.support === (membre && membre.charId)
        && vientDeLArme(
          buff.provenance && buff.provenance.gameId, membre && membre.typeArme
        ))
      .map(buff => chiffre(buff, membre)));
  }

export { buffsDeLEquipe };
