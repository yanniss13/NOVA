/* Etat mutable de la session : le seul endroit ou il vit.

   Pourquoi un objet et non des `let` exportes : une liaison exportee par un
   module est en lecture seule chez l'importateur. Une propriete d'objet, non.
   C'est ce qui permet aux vues de sortir de js/app.js tout en partageant
   le meme etat.

   Le nom `sessionCourante` n'est pas decoratif : `session` est deja pris
   comme parametre dans applySession(session) et dans les gestionnaires
   d'evenements Supabase. Une collision y aurait ecrit dans l'objet d'auth
   au lieu de l'etat applicatif, sans aucune erreur. */

  const sessionCourante = {
    user: null,
    pseudo: "",
    applicationEpoch: 0,
    rosterProfiles: []
  };

export { sessionCourante };
