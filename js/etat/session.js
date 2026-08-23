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

  /* `membre` part a VRAI, et ce n'est pas une etourderie.

     Hors ligne, ou avant la premiere lecture de profil, personne n'a de
     drapeau. Traiter ce vide comme « pas membre » enfermerait la confrerie
     entiere dehors des que Supabase repond mal. La RLS reste le vrai portier :
     un onglet ouvert sur des donnees vides se repare d'un rechargement, un
     membre exile de son propre roster, non. */
  const sessionCourante = {
    user: null,
    pseudo: "",
    membre: true,
    admin: false,
    applicationEpoch: 0,
    rosterProfiles: []
  };

  // Hors ligne, faute de compte, tout est modifiable en local.
  function canManageTeam(team){
    return !sessionCourante.user || !!team && team.owner === sessionCourante.user.id;
  }

  /* Un visiteur : quelqu'un dont on SAIT qu'il n'a pas de compte.

     Le detour par `applicationEpoch` n'est pas une precaution de style, il
     separe deux « pas de compte » que `user === null` confond :

     - avant la premiere application de session, personne n'a encore de
       compte parce que Supabase n'a pas fini de repondre. Le membre qui
       clique dans cette fenetre est un membre, pas un visiteur ;
     - quand la configuration Supabase manque — PWA sans reseau, script CDN
       absent — `applySession` n'est jamais appelee et le site entier retombe
       sur localStorage. Y traiter le membre en visiteur l'enfermerait hors de
       ses propres equipes.

     Dans ces deux cas l'epoque vaut 0, et la reponse est « non ». */
  function visiteurAnonyme(){
    return sessionCourante.applicationEpoch > 0 && !sessionCourante.user;
  }

  /* L'invite : quelqu'un dont on SAIT qu'il a un compte SANS appartenir a la
     confrerie. Meme prudence que `visiteurAnonyme` — tant que la session n'a
     pas ete appliquee, la reponse est « non ». */
  function inviteHorsConfrerie(){
    return sessionCourante.applicationEpoch > 0
      && !!sessionCourante.user
      && !sessionCourante.membre;
  }

  /* Le drapeau seul ne suffit pas : il survit en memoire a une deconnexion
     tant que `applySession` n'a pas fini son travail. */
  function estAdministrateur(){
    return !!sessionCourante.user && !!sessionCourante.admin;
  }

export {
  canManageTeam,
  estAdministrateur,
  inviteHorsConfrerie,
  sessionCourante,
  visiteurAnonyme
};
