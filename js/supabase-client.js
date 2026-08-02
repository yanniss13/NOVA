/* Le client Supabase, cree une seule fois pour tout le site.

   `sb` vaut `null` si la configuration est absente : tout le code appelant
   doit donc le tester avant usage, et le site reste utilisable hors ligne.

   Il lit `window.supabase` pose par le script CDN d'index.html, un script
   classique donc execute avant tout module. */

  const sb = window.supabase && window.SB_URL && window.SB_KEY
    ? window.supabase.createClient(window.SB_URL, window.SB_KEY)
    : null;

export { sb };
