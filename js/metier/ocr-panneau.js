/* La geometrie du panneau de statistiques du jeu, sans un seul pixel.

   Ce module ne connait rien au 7DS : ni les stats, ni les pieces. C'est un
   lecteur de panneaux. Il recoit une fonction de luminance et des mots avec
   leurs boites, il rend un rectangle et des couples libelle/valeur. Le
   decodage d'image vit dans la couche `vues`, qui seule a droit au DOM.

   Aucune coordonnee n'est codee en dur : c'est ce qui lui permet de traiter un
   1920x1080 et un 2796x1290 sans reglage, alors que ces deux captures n'ont ni
   la meme resolution ni le meme rapport d'image. */

  const EST_NOMBRE_PANNEAU = /^[0-9][0-9\s\u00a0\u202f.,]*%?$/;

  const TITRES_DE_SECTION = ["Enchanter", "Bonus de gravure",
    "Parametre de promotion", "Ensemble 3 pieces", "Ensemble 5 pieces", "Stats"];

  function nettoyerTexte(texte){
    return String(texte)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .replace(/ +/g, " ")
      .trim();
  }

  /* Un titre de section n'a pas de valeur. Sans cette reconnaissance, il se
     collerait au libelle suivant et le rendrait meconnaissable. */
  function estSection(texte){
    const cible = nettoyerTexte(texte);
    if(!cible) return false;
    return TITRES_DE_SECTION.some(section => {
      const reference = nettoyerTexte(section);
      return cible === reference
        || (cible.length >= 4 && reference.startsWith(cible))
        || (reference.length >= 4 && cible.startsWith(reference));
    });
  }

  /* Le panneau est la derniere bande de colonnes majoritairement claires. On
     part du bord droit parce que c'est la qu'il vit, quelle que soit la
     resolution — le fond du jeu, lui, est un ciel etoile sombre. */
  function detecterPanneau(image){
    if(!image || typeof image.estClair !== "function") return null;
    const largeur = image.largeur;
    const hauteur = image.hauteur;
    if(!largeur || !hauteur) return null;

    const pas = Math.max(1, Math.round(hauteur / 300));
    const parColonne = [];
    for(let x = 0; x < largeur; x += 2){
      let clairs = 0;
      let total = 0;
      for(let y = 0; y < hauteur; y += pas){
        total++;
        if(image.estClair(x, y)) clairs++;
      }
      parColonne.push({ x, part:total ? clairs / total : 0 });
    }

    const SEUIL = 0.28;
    let fin = -1;
    let debut = -1;
    for(let i = parColonne.length - 1; i >= 0; i--){
      if(parColonne[i].part >= SEUIL){
        if(fin < 0) fin = parColonne[i].x;
        debut = parColonne[i].x;
      }else if(fin >= 0 && parColonne[i].x < debut - 30){
        break;
      }
    }
    if(fin < 0) return null;

    const lignesClaires = [];
    for(let y = 0; y < hauteur; y++){
      let clairs = 0;
      let total = 0;
      for(let x = debut; x <= fin; x += 3){
        total++;
        if(image.estClair(x, y)) clairs++;
      }
      if(total && clairs / total >= 0.5) lignesClaires.push(y);
    }
    if(!lignesClaires.length) return null;

    const haut = Math.min(...lignesClaires);
    return {
      left:debut,
      top:haut,
      width:fin - debut,
      height:Math.max(...lignesClaires) - haut
    };
  }

  /* Les valeurs sont les mots numeriques colles au bord droit du panneau. Leur
     x0 le plus a gauche donne la frontiere de la colonne. La deduire ainsi
     plutot que par une marge fixe evite qu'un libelle long soit pris pour une
     valeur — ce qui arrivait au mot « degats, » sur les lignes les plus
     larges. */
  function seuilColonneValeur(mots){
    const bordDroit = Math.max(...mots.map(m => m.bbox.x1));
    const valeurs = mots.filter(m =>
      EST_NOMBRE_PANNEAU.test(String(m.text).trim())
      && m.bbox.x1 >= bordDroit - 25);
    if(!valeurs.length) return bordDroit - 90;
    return Math.min(...valeurs.map(m => m.bbox.x0)) - 12;
  }

  function rangsVisuels(mots, tolerance){
    const sortie = [];
    mots.filter(m => String(m.text).trim())
      .sort((a, b) => a.bbox.y0 - b.bbox.y0)
      .forEach(mot => {
        const centre = (mot.bbox.y0 + mot.bbox.y1) / 2;
        let rang = sortie.find(r => Math.abs(r.y - centre) < tolerance);
        if(!rang){
          rang = { y:centre, mots:[] };
          sortie.push(rang);
        }
        rang.mots.push(mot);
        rang.y = (rang.y * (rang.mots.length - 1) + centre) / rang.mots.length;
      });
    sortie.sort((a, b) => a.y - b.y);
    sortie.forEach(r => r.mots.sort((a, b) => a.bbox.x0 - b.bbox.x0));
    return sortie;
  }

  /* Une stat est un bloc de libelle plus EXACTEMENT une valeur.

     Deux dispositions coexistent dans le jeu : la valeur sur la premiere ligne
     du libelle, ou la valeur apres une barre de progression sous le libelle. La
     presence de texte reel sur la ligne de la valeur les distingue.

     Ne pas revenir a une detection fondee sur les icones de debut de ligne :
     l'OCR les rate sur mobile, ce qui produisait un appariement faux et
     silencieux — le seul mode d'echec vraiment dangereux ici. */
  function extraireStats(mots){
    if(!Array.isArray(mots) || !mots.length) return [];
    const seuil = seuilColonneValeur(mots);
    const stats = [];
    let bloc = [];
    let attente = null;

    const fermerBloc = () => {
      if(bloc.length && attente){
        stats.push({ libelle:bloc.join(" "), valeur:attente });
      }
      bloc = [];
      attente = null;
    };

    for(const rang of rangsVisuels(mots, 14)){
      const gauche = rang.mots.filter(m => m.bbox.x1 <= seuil)
        .map(m => m.text).join(" ").trim();
      const droite = rang.mots.filter(m => m.bbox.x1 > seuil)
        .map(m => m.text).join("").trim();
      const valeur = EST_NOMBRE_PANNEAU.test(droite) ? droite : null;
      const lettres = gauche.replace(/[^\p{L}]/gu, "").length;
      const texte = lettres > 3 ? gauche.replace(/^[^\p{L}]+/u, "").trim() : "";

      if(texte && estSection(texte)){
        fermerBloc();
        continue;
      }
      if(texte && valeur){
        /* Un libelle deja commence sans valeur : cette ligne le termine et
           porte sa valeur. Fermer d'abord perdrait les lignes precedentes. */
        if(bloc.length && !attente){
          bloc.push(texte);
          attente = valeur;
          fermerBloc();
        }else{
          fermerBloc();
          bloc = [texte];
          attente = valeur;
        }
      }else if(texte){
        bloc.push(texte);
      }else if(valeur){
        if(!attente) attente = valeur;
        fermerBloc();
      }
    }
    fermerBloc();
    return stats;
  }

/* Aucun `export` tant qu'aucun module n'importe d'ici : le depot exige que tout
   symbole exporte soit consomme. La vue d'import ajoutera la ligne le jour ou
   elle consommera ces fonctions. */
