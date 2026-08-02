/* Etat mutable du brouillon d'equipe : l'equipe en cours d'edition dans le
   Builder, et de quoi savoir si elle a diverge de sa source.

   Un objet et non des `let` exportes, pour la meme raison qu'a
   js/session.js : une liaison exportee est en lecture seule chez
   l'importateur, une propriete d'objet non.

   `equipe` vaut null jusqu'au demarrage : sa valeur initiale demande le
   catalogue des personnages, que ce module n'a pas a connaitre. C'est
   js/app.js qui l'amorce, au meme instant qu'avant l'extraction. */

  const brouillonEquipe = {
    equipe: null,
    edition: false,
    sourceMaj: 0,
    jsonInitial: "",
    supprimeAilleurs: false,
    referencesRoster: []
  };

export { brouillonEquipe };
