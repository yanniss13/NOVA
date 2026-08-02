/* Le dos Supabase : le client, et la traduction de ses erreurs.

   `sb` vaut `null` si la configuration est absente : tout le code appelant
   doit donc le tester avant usage, et le site reste utilisable hors ligne.

   Il lit `window.supabase` pose par le script CDN d'index.html, un script
   classique donc execute avant tout module.

   `authMessage` l'accompagne parce qu'il traduit les erreurs de ce client
   seul — connexion, inscription, ecriture refusee — et qu'il est appele
   depuis une quinzaine d'endroits qui n'ont rien d'autre en commun. */

  const sb = window.supabase && window.SB_URL && window.SB_KEY
    ? window.supabase.createClient(window.SB_URL, window.SB_KEY)
    : null;

  // Les messages de Supabase sont en anglais : on ne montre que les notres.
  function authMessage(error){
    const message = String(error && error.message || "");
    if(/invalid login credentials/i.test(message)) return "Email ou mot de passe incorrect.";
    if(/already registered/i.test(message)) return "Un compte existe déjà avec cet email.";
    if(/password/i.test(message)) return "Le mot de passe doit contenir au moins 6 caractères.";
    return message || "La connexion au registre a échoué.";
  }

export { authMessage, sb };
