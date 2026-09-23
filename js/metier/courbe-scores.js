/* L'ECHELLE VERTICALE D'UNE COURBE DE SCORES.

   Partagee par l'entrainement du boss et par la progression hebdomadaire du
   boss de guilde : les deux tracent une suite de scores dans le temps, et
   c'est la meme question d'echelle qui se pose aux deux.

   Ni DOM, ni Supabase : une liste de scores entre, un cadre sort. */

  /* POURQUOI ELLE NE PART PAS DE ZERO.

     Une confrerie progresse par paliers de quelques pour cent. Cadree sur
     zero, une serie 212 000 → 255 500 — soit +20 % — s'ecrase en un filet
     plat dans le tiers haut du cadre, les deux tiers du bas restant vides :
     la progression qu'on vient justement consulter devient invisible.

     L'echelle se cadre donc sur les donnees, avec une marge, puis s'arrondit
     a un pas lisible (1, 2 ou 5 fois une puissance de dix) pour que chaque
     graduation tombe sur un nombre rond. Les graduations sont des ENTIERS :
     formatBossScore() les relit en BigInt et rendrait « — » sur une decimale.

     Le prix a payer est connu et assume : une courbe qui ne part pas de zero
     exagere visuellement l'ecart. C'est pour cela que les graduations sont
     chiffrees a l'ecran — on lit l'amplitude reelle, on ne la devine pas.

     Les pixels passent par Number ; les scores affiches restent des chaines. */
  function echelleCourbeScores(scores){
    const valeurs = (scores || []).map(Number).filter(Number.isFinite);
    if(!valeurs.length) return null;
    const min = Math.min(...valeurs);
    const max = Math.max(...valeurs);
    /* Serie plate — un seul point, ou deux fois le meme score : sans etendue,
       toute division donnerait NaN. On ouvre une fenetre autour de la valeur
       pour que le point se pose au milieu du cadre. */
    const etendue = max - min || Math.max(1, Math.abs(max) * 0.1);
    /* Les bornes suivent les donnees au plus pres ; ce sont les GRADUATIONS
       qui tombent sur des nombres ronds, a l'interieur du cadre. Arrondir les
       bornes elles-memes rouvrirait le vide qu'on vient de fermer : sur une
       serie 212 000 → 255 500, un cadre 200 000 → 280 000 laisse la courbe
       n'occuper que la moitie de sa hauteur. */
    const bas = Math.max(0, min - etendue * 0.18);
    const haut = max + etendue * 0.18;
    const pas = pasAgreableCourbe((haut - bas) / 5);
    const graduations = [];
    for(let valeur = Math.ceil(bas / pas) * pas; valeur <= haut; valeur += pas){
      graduations.push(Math.round(valeur));
    }
    return { bas, haut, pas, graduations };
  }

  /* 1, 2 ou 5 fois une puissance de dix : les seuls pas dont un lecteur
     additionne les graduations de tete. */
  function pasAgreableCourbe(brut){
    const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(brut) || 1)));
    const normalise = Math.abs(brut) / magnitude;
    const choix = normalise <= 1 ? 1 : normalise <= 2 ? 2 : normalise <= 5 ? 5 : 10;
    return Math.max(1, choix * magnitude);
  }


  /* Le resume chiffre qui accompagne la courbe : record, dernier point et
     ecart au record. Les scores restent des chaines et se comparent en
     BigInt — un score de boss depasse vite 2^53. */
  function resumeCourbeScores(serie){
    if(!serie || !serie.length) return null;
    let meilleur = null;
    serie.forEach(point => {
      const valeur = BigInt(point.score);
      if(meilleur === null || valeur > meilleur) meilleur = valeur;
    });
    const dernier = BigInt(serie[serie.length - 1].score);
    return {
      meilleur:meilleur.toString(),
      dernier:dernier.toString(),
      ecart:(dernier - meilleur).toString()
    };
  }

export { echelleCourbeScores, resumeCourbeScores };
