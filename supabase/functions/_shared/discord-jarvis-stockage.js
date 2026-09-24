"use strict";

/* Lecture des fichiers de /jarvis deposes dans le bucket PRIVE jarvis-prive
   (monstres.json, mecaniques.json). Seule la cle service_role de l'Edge
   Function les lit : ils ne sont ni dans le depot ni sur Pages.

   Un succes est garde une heure : un fichier redepose est pris en compte au
   plus tard une heure apres, sans redeploiement. Un echec est garde une
   minute, pour reessayer vite sans marteler le stockage. Le lecteur ne leve
   jamais : il rend le fichier ou null. */

const CACHE_STOCKAGE_SUCCES_MS = 3_600_000;
const CACHE_STOCKAGE_ECHEC_MS = 60_000;
/* La lecture reussie la plus lente observee a pris 646 ms : 5 s laissent de
   la marge sans laisser un stockage muet bloquer la question. */
const DELAI_LECTURE_STOCKAGE_MS = 5_000;

/* options : fetch, url (adresse complete), cle (service_role), nom (pour le
   journal), valider(brut) -> null si bon, sinon le motif du refus, horloge,
   journaliser facultatif. */
function creerLecteurStockageJarvis(options) {
  let memoire = null;
  /* Chaque lecture reelle (hors cache) laisse une ligne : sa duree et son
     issue. C'est la premiere suspecte quand /jarvis depasse son delai. */
  const journaliser = options.journaliser
    || (ligne => console.log(JSON.stringify({ jarvis:ligne })));
  /* Une seule lecture a la fois : deux questions simultanees sur une
     instance froide partagent la meme, au lieu de telecharger deux fois. */
  let enCours = null;
  return function lireStockageJarvis() {
    const maintenant = options.horloge();
    if(memoire && memoire.expire > maintenant) return Promise.resolve(memoire.valeur);
    if(!enCours){
      enCours = lireDepuisLeStockage(maintenant).finally(() => { enCours = null; });
    }
    return enCours;
  };

  async function lireDepuisLeStockage(maintenant) {
    let valeur = null;
    let issue = "ok";
    try {
      if(!options.url || !options.cle) throw new Error("configuration du stockage absente");
      const reponse = await options.fetch(options.url, {
        headers:{ Authorization:"Bearer " + options.cle, apikey:options.cle },
        /* Un stockage lent ne doit pas bloquer toute la reponse /jarvis. */
        signal:AbortSignal.timeout(DELAI_LECTURE_STOCKAGE_MS)
      });
      if(!reponse.ok) throw new Error("stockage -> " + reponse.status);
      const brut = await reponse.json();
      /* Tout le fichier, pas seulement l'en-tete : une seule entree mal
         formee ferait lever l'outil a chaque question pendant une heure. */
      const refus = options.valider(brut);
      if(refus) throw new Error(refus);
      valeur = brut;
    } catch (erreur) {
      issue = erreur instanceof Error ? erreur.message : String(erreur);
      console.error("Fichier /jarvis « " + options.nom + " » indisponible :", issue);
    }
    journaliser({ etape:"stockage-" + options.nom, ms:options.horloge() - maintenant, issue });
    memoire = {
      valeur,
      expire:maintenant + (valeur ? CACHE_STOCKAGE_SUCCES_MS : CACHE_STOCKAGE_ECHEC_MS)
    };
    return valeur;
  }
}

const discordJarvisStockageApi = { creerLecteurStockageJarvis };

if(typeof module !== "undefined" && module.exports){
  module.exports = discordJarvisStockageApi;
}
globalThis.NOVA_DISCORD_JARVIS_STOCKAGE = discordJarvisStockageApi;
