/* Etat mutable de la session : le seul endroit ou il vit.

   Pourquoi un objet et non des `let` exportes : une liaison exportee par un
   module est en lecture seule chez l'importateur. Une propriete d'objet, non.
   C'est ce qui permet aux vues de sortir de js/app.js tout en partageant
   le meme etat.

   Le nom `sessionCourante` n'est pas decoratif : `session` est deja pris
   comme parametre dans applySession(session) et dans les gestionnaires
   d'evenements Supabase. Une collision y aurait ecrit dans l'objet d'auth
   au lieu de l'etat applicatif, sans aucune erreur.

   `canManageTeam` vit ici et non dans metier/equipe-modele.js : c'est une
   question posee a la session courante, pas une regle sur l'equipe. Le
   modele d'equipe, lui, doit rester lisible sans connaitre l'utilisateur. */

  const sessionCourante = {
    user: null,
    pseudo: "",
    applicationEpoch: 0,
    rosterProfiles: []
  };

  // Hors ligne, faute de compte, tout est modifiable en local.
  function canManageTeam(team){
    return !sessionCourante.user || !!team && team.owner === sessionCourante.user.id;
  }

export { canManageTeam, sessionCourante };
