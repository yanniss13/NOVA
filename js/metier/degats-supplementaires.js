/* Les degats qu'un potentiel AJOUTE a une competence du heros calcule.

   Module PUR : ni DOM, ni reseau, ni roster. La vue lui passe { charId,
   typeArme, palier } ; c'est elle qui lit le palier dans le roster.

   Ces lignes ne concernent QUE le heros calcule. Aucune ne vise l'equipe :
   « la derniere frappe de SA competence normale » ne profite qu'a celui qui
   frappe. C'est ce qui distingue ce module de potentiels-equipe.js, dont il
   partage pourtant les cles. */

  /* Charge A LA DEMANDE par la vue, comme les trois autres catalogues ecrits
     a la main : le lire par window evite de le faire payer aux visiteurs qui
     ne calculent rien. */
  function tableDesSupplements(){
    return window.SEVEN_DS_DEGATS_SUPPLEMENTAIRES || {};
  }

  /* Les paliers ouverts, du plus bas au plus haut. Un palier absent ou
     illisible ne rend RIEN plutot que tout : un membre qui n'a pas renseigne
     le sien ne doit pas recevoir les degats d'un palier 10. */
  function paliersDuPorteur(branche, palier){
    const atteint = Number(palier);
    if(!Number.isFinite(atteint) || atteint < 1) return [];
    return Object.keys(branche)
      .map(Number)
      .filter(niveau => Number.isFinite(niveau) && niveau <= atteint)
      .sort((a, b) => a - b);
  }

  function degatsSupplementairesApplicables(entree){
    const source = entree || {};
    const branche = (tableDesSupplements()[source.charId] || {})[source.typeArme];
    if(!branche) return [];
    return paliersDuPorteur(branche, source.palier)
      .flatMap(niveau => (branche[String(niveau)] || [])
        .map(ligne => Object.assign({}, ligne, { palier:niveau })));
  }

  /* La competence, augmentee des supplements de SA categorie.

     Ils deviennent une COMPOSANTE de plus, et ce choix porte tout le sens du
     module : une composante traverse le bonus de categorie, le critique et la
     mitigation comme le reste de la competence. Le detail du raisonnement est
     dans l'en-tete de data/degats-supplementaires.js.

     `pourcentage` et `repartition` restent INTACTS. Ils decrivent ce que la
     source publie pour la competence elle-meme, et un test du catalogue exige
     que `pourcentage` egale la somme des composantes d'ATK de data/. Y ajouter
     un supplement ferait mentir cette relation sur un chiffre que le
     generateur relit. La base de degats, elle, lit les composantes. */
  function competenceAvecSupplements(competence, supplements){
    const retenus = (Array.isArray(supplements) ? supplements : [])
      .filter(ligne => ligne && ligne.categorie === competence.categorie
        && Number.isFinite(Number(ligne.pourcentage)));
    if(!retenus.length) return competence;

    const dejaLa = Array.isArray(competence.composantes)
      && competence.composantes.length
      ? competence.composantes
      : [{ base:"atk", pourcentage:competence.pourcentage }];
    return Object.assign({}, competence, {
      composantes:dejaLa.concat(retenus.map(ligne => ({
        base:"atk",
        pourcentage:Number(ligne.pourcentage),
        supplement:ligne.id
      })))
    });
  }

export { competenceAvecSupplements, degatsSupplementairesApplicables };
