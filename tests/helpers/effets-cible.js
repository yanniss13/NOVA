"use strict";

/* Les effets qu'une ligne peut infliger a la CIBLE, et rien d'autre.
   Ils n'ont pas de code de stat : 7ds-stats/libelles-stats.json ne decrit que
   des statistiques de HEROS, et leur en inventer un aurait desactive le test
   qui refuse les codes inventes.

   UNE seule liste, partagee par les trois tables ecrites a la main - buffs de
   soutien, passifs de tenue gravee, potentiels d'equipe. Elle a existe en
   trois exemplaires, et il a suffi d'ajouter un effet pour que les trois
   divergent : deux le refusaient encore quand le troisieme l'acceptait deja.

   La verite executable reste EFFET_SUR_LA_CIBLE dans
   js/metier/calculateur-entrees.js, plus la vulnerabilite que
   bonusCategorieDesBuffs() traite a part. Un test refuse de toute facon toute
   ligne qui ne change rien : un effet ajoute ici sans etre branche la-bas se
   ferait prendre. */
const EFFETS_SUR_LA_CIBLE = [
  /* La defense de la cible, MULTIPLIEE par (1 - valeur). */
  "defense",
  /* Sa defense critique, en POINTS retranches - ce que rapporte un critique. */
  "defenseCritique",
  /* Sa resistance critique, en POINTS aussi - si le critique PART. */
  "resistanceCritique",
  /* « Degats de competence normale SUBIS par l'ennemi » : une vulnerabilite,
     qui nomme la categorie qu'elle amplifie. */
  "vulnerabiliteCategorie",
  /* « Augmente les degats subis de 100 % » : la meme, sans categorie. Elle
     amplifie TOUT ce que la cible encaisse. */
  "vulnerabiliteGlobale"
];

/* Les cinq categories du catalogue de competences, celles que le moteur
   distingue. Une vulnerabilite doit en nommer une. */
const CATEGORIES_DE_COMPETENCE = [
  "NORMAL", "NORMAL_SKILL", "ACTIVE_THIRD", "ULTIMATE", "TAG_SKILL"
];

module.exports = { EFFETS_SUR_LA_CIBLE, CATEGORIES_DE_COMPETENCE };
