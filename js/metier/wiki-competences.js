/* Regroupement et ordre des competences du wiki. Pur : ni DOM, ni reseau.

   Le catalogue est charge A LA DEMANDE, a la premiere ouverture de l'onglet
   Wiki — donc APRES l'evaluation de ce module. Le lire ici a l'evaluation
   (`const CATALOGUE = window.SEVEN_DS_WIKI_COMPETENCES`) donnerait un objet
   vide a vie. D'ou l'accesseur, appele a chaque fois.

   C'est la difference avec noyau/constantes.js, dont les donnees sont posees
   par des <script> classiques avant les modules. */

  const catalogue = () => window.SEVEN_DS_WIKI_COMPETENCES || {};

  /* L'ordre d'affichage d'une arme, dans la logique du jeu : ce que le heros
     est en permanence (le passif), puis ses touches, puis l'attaque sautee.
     Les marques sont cherchees en SOUS-CHAINE : la source ecrit
     `skill_q_1` et `skill_r_enchant` pour des variantes de la meme touche. */
  const ORDRE = ["passive", "skill_q", "skill_e", "skill_r", "skill_tag", "jumpatk"];

  /* Un suffixe inconnu passe en fin plutot que d'etre perdu : le jour ou le
     jeu ajoute une touche, le wiki doit la montrer, pas la taire. */
  const rangDe = gameId => {
    const rang = ORDRE.findIndex(marque => String(gameId || "").includes(marque));
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
      liste.sort((a, b) => rangDe(a.gameId) - rangDe(b.gameId));
    });
    return parArme;
  }

  const armesDuHeros = slug => Object.keys(competencesParArme(slug));

export {
  armesDuHeros,
  competencesParArme
};
