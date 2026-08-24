/* Les buffs qu'une EQUIPE apporte reellement.

   Sans equipe, le calculateur propose tous les buffs du catalogue, toutes
   armes confondues : cocher Daisy offre ses buffs de Livre ET de Baguette,
   alors qu'elle n'en tient qu'une. Six des huit supports sont dans ce cas.

   Module PUR : ni DOM, ni reseau, ni roster. La vue lui passe des coequipiers
   deja reduits a { charId, typeArme, atk, def } ; c'est elle qui appelle
   calculateHeroStats et en extrait B_Atk et B_Def. */

import { ENUM_TO_FOLDER, FOLDER_TO_ENUM } from "../noyau/constantes.js";
import { buffsApplicables } from "./calculateur-entrees.js";

  /* 10 000 dix-milliemes valent 100 %. Le nom differe de `DIX_MILLIEMES` chez
     le voisin, et de `RAPPORT` dans le moteur, a dessein : le chargeur de
     tests concatene tous les modules dans une MEME portee, donc deux `const`
     homonymes se heurtent. C'est la raison de ces trois noms pour une seule
     idee. */
  const TAUX_PLEIN = 10000;

  /* L'ARME QUE NOMME UN gameId, ou null.

     On ne decoupe PAS par position : un gameId s'ecrit <slug>_<arme>_<reste>
     et le slug peut lui-meme contenir un tiret bas. Gil Thunder l'ecrit des
     DEUX facons - `gil_thunder_lance_skill_rmb` et `gilthunder_shield_passive`
     - et un decoupage par position se tromperait sur la premiere.

     On cherche donc le JETON `_<enum>_`, en minuscules. Un test verifie qu'un
     gameId de la table n'en contient jamais deux ; sans lui, ce `find`
     rendrait la premiere arme trouvee sans que personne ne le sache. */
  function armeDuGameId(gameId){
    const nu = String(gameId || "").toLowerCase();
    return Object.keys(ENUM_TO_FOLDER).find(
      enumArme => nu.includes("_" + enumArme.toLowerCase() + "_")
    ) || null;
  }

  /* Le buff vient-il de l'arme equipee ? Le roster range les armes par DOSSIER
     francais ; FOLDER_TO_ENUM donne l'enum que le gameId, lui, ecrit. */
  function vientDeLArme(gameId, typeArme){
    const enumArme = FOLDER_TO_ENUM[typeArme];
    if(!enumArme) return false;
    return armeDuGameId(gameId) === enumArme;
  }

  /* « X % d'une statistique du lanceur » : le chiffre reel d'une ligne, ou
     null quand cette statistique est inconnue. Deux tables s'en servent - les
     buffs de soutien ici, les potentiels d'equipe chez le voisin - et elles
     doivent rendre le MEME nombre, d'ou cette fonction plutot qu'une formule
     recopiee.

     HYPOTHESE, non mesuree : « 30 % de l'attaque du heros » est lu comme la
     seule ATK, sans l'attaque elementaire. Le moteur de degats, lui, ajoute
     l'attaque elementaire a l'ATK pour les composantes de base `atk` : les deux
     lectures ne coincident pas, et rien ne dit laquelle le jeu applique ici.
     La vue passe B_Atk, et B_Def pour les lignes indexees sur la defense. */

  /* Les statistiques du LANCEUR sur lesquelles une ligne peut s'indexer. La
     defense est arrivee avec le palier 10 du Livre d'Elizabeth, qui donne aux
     allies « 10 % de la defense du heros » en attaque. */
  const INDEXATIONS = [["indexeSurAtk", "atk"], ["indexeSurDef", "def"]];

  function indexationDe(ligne){
    for(const [champ, stat] of INDEXATIONS){
      if(ligne && ligne[champ]) return { indexe:ligne[champ], stat };
    }
    return null;
  }

  /* Le chiffre reel d'une ligne indexee, ou null quand la statistique du
     lanceur n'est pas lisible.

     Le plafond est FACULTATIF. Les trois premieres lignes indexees en
     portaient toutes un, au point qu'il passait pour obligatoire ; le palier
     10 du Livre d'Elizabeth n'en annonce aucun. Sans plafond, la ligne vaut
     exactement son taux. */
  function valeurIndexee(ligne, porteur){
    const trouve = indexationDe(ligne);
    if(!trouve) return null;
    const nombre = Number(porteur && porteur[trouve.stat]);
    if(!Number.isFinite(nombre) || nombre <= 0) return null;
    const brut = Math.round(trouve.indexe.taux * nombre / TAUX_PLEIN);
    return Number.isFinite(trouve.indexe.plafond)
      ? Math.min(trouve.indexe.plafond, brut) : brut;
  }

  /* La valeur effective d'un buff, et si elle est un repli.

     Plusieurs buffs valent un pourcentage d'une statistique de leur LANCEUR.
     Sans equipe, ou quand son build n'est pas lisible, on rend `valeur` : pour
     une ligne plafonnee c'est le plafond, donc exactement le chiffre d'avant
     ce module ; pour une ligne SANS plafond c'est zero, faute de tout repli
     honnete. */
  function chiffre(buff, membre){
    const chiffree = valeurIndexee(buff, membre);
    return Object.assign({}, buff, {
      arme:membre ? membre.typeArme : null,
      valeur:chiffree === null ? buff.valeur : chiffree,
      repli:Boolean(indexationDe(buff)) && chiffree === null
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

export { armeDuGameId, buffsDeLEquipe, indexationDe, valeurIndexee };
