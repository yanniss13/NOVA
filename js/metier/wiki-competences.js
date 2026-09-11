/* Regroupement et ordre des competences du wiki. Pur : ni DOM, ni reseau.

   Le catalogue est charge A LA DEMANDE, a la premiere ouverture de l'onglet
   Wiki — donc APRES l'evaluation de ce module. Le lire ici a l'evaluation
   (`const CATALOGUE = window.SEVEN_DS_WIKI_COMPETENCES`) donnerait un objet
   vide a vie. D'ou l'accesseur, appele a chaque fois.

   C'est la difference avec noyau/constantes.js, dont les donnees sont posees
   par des <script> classiques avant les modules. */

  const catalogue = () => window.SEVEN_DS_WIKI_COMPETENCES || {};

  /* L'ordre d'affichage suit la NATURE de la competence, pas la touche qui la
     declenche. Les heros n'ont pas leurs competences sur les memes touches :
     l'ultime est sur Q chez Meliodas et sur R chez Ban. Trier par touche
     donnait donc un ordre different d'une fiche a l'autre, l'ultime tantot en
     tete tantot en quatrieme position.

     L'ordre precedent lisait le `gameId` en SOUS-CHAINE, ce qui posait un
     second probleme : `skill_rmb` — le CLIC DROIT — contient `skill_r`, et se
     rangeait donc a la place de la touche R. */
  const ORDRE = [
    "PASSIVE", "NORMAL", "NORMAL_SKILL", "ACTIVE_THIRD", "ULTIMATE", "TAG_SKILL"
  ];

  /* Une categorie inconnue passe en fin plutot que d'etre perdue : le jour ou
     le jeu en ajoute une, le wiki doit la montrer, pas la taire. */
  const rangDe = competence => {
    const rang = ORDRE.indexOf(String((competence || {}).categorie || ""));
    return rang === -1 ? ORDRE.length : rang;
  };

  const competencesDe = slug => {
    const liste = slug && catalogue()[slug];
    return Array.isArray(liste) ? liste : [];
  };

  function competencesParArme(slug){
    const parArme = {};
    competencesDe(slug).forEach(competence => {
      const arme = competence.weaponType;
      if(!arme) return;
      (parArme[arme] = parArme[arme] || []).push(competence);
    });
    /* `sort` est stable : a rang egal, l'ordre de la source est conserve. */
    Object.values(parArme).forEach(liste => {
      liste.sort((a, b) => rangDe(a) - rangDe(b));
    });
    return parArme;
  }

  const armesDuHeros = slug => Object.keys(competencesParArme(slug));

export {
  armesDuHeros,
  competencesParArme
};
