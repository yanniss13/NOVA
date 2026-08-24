/* La lecture d'un panneau par un modele distant, ramenee a la forme du depot.

   Le module est PUR : ni reseau, ni DOM. L'appel vit dans
   js/vues/import-captures.js, qui possede deja les entrees-sorties ; ici on ne
   fait que juger et normaliser ce qui revient.

   POURQUOI JUGER. Un modele de langage rend ce qu'on lui demande la plupart du
   temps, pas toujours. Le schema impose cote serveur ferme les types, pas le
   SENS : rien n'empeche un libelle vide, une valeur sans chiffre, ou une liste
   de statistiques inventees pour une image illisible. Tout ce qui n'est pas
   exploitable est donc rejete ICI, avant d'atteindre la deduction.

   Ce module ne cherche pas a deviner l'arme ni la piece : il rend exactement
   la forme que produit Tesseract - { statut, stats, entete, passif } - et
   `deduireArme` ou `deduirePiece` fait le reste, en confrontant chaque
   candidate aux tables du jeu. Une lecture fausse est donc rejetee par le
   catalogue, pas ecrite dans le build. */

  /* Une valeur de panneau est un nombre, eventuellement decimal, eventuellement
     suivi d'un pourcent. Rien d'autre ne doit passer : `deduireArme` compare
     des ENTIERS exacts, et un caractere parasite decale tout. */
  const VALEUR_LISIBLE = /^[+-]?\d+(?:[.,]\d+)?\s*%?$/;

  function texteNet(brut){
    return typeof brut === "string" ? brut.replace(/\s+/g, " ").trim() : "";
  }

  function entierOuNul(brut){
    if(typeof brut === "number" && Number.isInteger(brut)) return brut;
    /* Le modele peut rendre « 50 » plutot que 50 malgre le schema : on
       l'accepte, mais on refuse tout ce qui n'est pas un entier ecrit. */
    if(typeof brut === "string" && /^\d+$/.test(brut.trim())){
      return Number(brut.trim());
    }
    return null;
  }

  /* Une ligne exploitable, ou null. Le libelle sert de cle de rapprochement et
     la valeur de chiffre a reproduire : sans l'un des deux, la ligne ne peut
     rien apporter et sa presence brouillerait la deduction. */
  function ligneNette(brut){
    if(!brut || typeof brut !== "object" || Array.isArray(brut)) return null;
    const libelle = texteNet(brut.libelle);
    const valeur = texteNet(brut.valeur);
    if(!libelle || !VALEUR_LISIBLE.test(valeur)) return null;
    const section = texteNet(brut.section);
    /* `null` et chaine vide disent la meme chose - une ligne hors section - et
       le reste du site attend `null`. Les confondre ferait passer une
       statistique native pour un enchantement. */
    return { libelle, valeur, section:section || null };
  }

  function normaliserLecture(brut){
    if(!brut || typeof brut !== "object" || Array.isArray(brut)){
      return { statut:"lecture-illisible", stats:[] };
    }
    const stats = (Array.isArray(brut.stats) ? brut.stats : [])
      .map(ligneNette)
      .filter(Boolean);
    if(!stats.length) return { statut:"aucune-stat-lue", stats:[] };

    const nom = texteNet(brut.nom);
    const niveau = entierOuNul(brut.niveau);
    return {
      statut:"ok",
      stats,
      /* `type` reste vide : Tesseract le tire de la ligne du niveau, et rien
         en aval ne le lit. Le champ est conserve pour que les deux lecteurs
         rendent la meme forme. */
      entete:{ nom, type:"", niveau },
      passif:entierOuNul(brut.passif)
    };
  }

  /* La lecture assistee ne remplace Tesseract que si les trois conditions sont
     reunies. Hors ligne, elle ne peut pas aboutir ; sans compte, la fonction
     Edge refusera ; sans client Supabase, il n'y a personne a appeler. */
  function lectureAssisteeDisponible(etat){
    const source = etat || {};
    return Boolean(source.client) && Boolean(source.connecte)
      && source.enLigne !== false;
  }

export { lectureAssisteeDisponible, normaliserLecture };
