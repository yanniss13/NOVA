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

  /* L'en-tete de la carte, au-dessus du panneau de statistiques.

     `detecterPanneau` s'arrete sous lui : le cadre dore plafonne a 192,8 de
     luminance quand la detection en exige 195, si bien que le nom de la
     piece et son `Lv.` restaient dehors. Or le nom est la seule chose qui
     identifie une arme — sans lui, l'inversion ne tranche que dans onze cas
     sur cent, contre quatre-vingt-dix-huit avec.

     On remonte donc depuis le haut du panneau tant que la ligne appartient
     encore a la carte. Le releve sur captures reelles laisse une marge
     enorme : le fond du jeu mesure 20 a 40 de luminance moyenne, la carte
     ne descend jamais sous 92. C'est a l'appelant de fixer le seuil, comme
     pour `estClair` — ce module ne touche pas un pixel. */
  const PART_DE_CARTE = 0.5;
  /* Quelques rangs sombres au milieu de l'en-tete ne le terminent pas : une
     bande de separation en fait partie. Au-dela, on est sorti de la carte. */
  const TROU_TOLERE = 4;

  function detecterEntete(image, zone){
    if(!image || typeof image.estCarte !== "function") return null;
    if(!zone || !zone.width || zone.top <= 0) return null;
    const gauche = zone.left;
    const droite = zone.left + zone.width;
    const estRangDeCarte = y => {
      let sur = 0;
      let total = 0;
      for(let x = gauche; x <= droite; x += 3){
        total++;
        if(image.estCarte(x, y)) sur++;
      }
      return total > 0 && sur / total >= PART_DE_CARTE;
    };

    let haut = zone.top;
    let trou = 0;
    for(let y = zone.top - 1; y >= 0; y--){
      if(estRangDeCarte(y)){
        haut = y;
        trou = 0;
      }else if(++trou > TROU_TOLERE){
        break;
      }
    }
    const hauteur = zone.top - haut;
    /* Sous un vingtieme du panneau, ce n'est pas un en-tete mais le liset du
       panneau lui-meme. Rendre `null` vaut mieux que faire lire du vide. */
    if(hauteur < zone.height * 0.05) return null;
    return { left:gauche, top:haut, width:zone.width, height:hauteur };
  }

  /* Une arme affiche `Lv.50`, une armure jamais : elle affiche son
     emplacement et deux badges de renforcement. C'est le discriminant entre
     les deux familles, et il ne coute rien — le meme motif rend le niveau. */
  const NIVEAU_AFFICHE = /\bLv\.?\s*([0-9]{1,3})\b/i;
  const NIVEAU_DE_PASSIF = /\bNiv\.?\s*([0-9]{1,2})\b/i;

  function lireEntete(mots){
    const rangs = rangsVisuels(Array.isArray(mots) ? mots : [], 14)
      .map(rang => rang.mots.map(mot => String(mot.text)).join(" ").trim());
    let niveau = null;
    let type = "";
    let rangDuNiveau = -1;
    rangs.forEach((texte, index) => {
      if(niveau !== null) return;
      const trouve = NIVEAU_AFFICHE.exec(texte);
      if(!trouve) return;
      niveau = Number(trouve[1]);
      type = texte.slice(0, trouve.index).trim();
      rangDuNiveau = index;
    });

    /* Le nom est la ligne la plus fournie en lettres au-dessus de celle du
       niveau. Le critere resiste au bruit : les debris que l'OCR ramasse
       au-dessus du titre ne font jamais plus de quelques lettres. */
    const lettresDe = texte => texte.replace(/[^\p{L}]/gu, "").length;
    const candidats = rangDuNiveau >= 0 ? rangs.slice(0, rangDuNiveau) : rangs;
    let nom = "";
    for(const texte of candidats){
      if(lettresDe(texte) > lettresDe(nom)) nom = texte;
    }
    return { nom, type, niveau };
  }

  /* Le passif d'une arme s'affiche `Niv. 7`, et ce nombre vaut exactement le
     depassement plus un. Le lire fait passer l'inversion de 99,47 % a
     99,96 % de reponses uniques. Il est facultatif : mal lu, il est ignore
     plutot que de fausser la deduction. */
  function niveauDePassif(texte){
    const brut = (texte === undefined || texte === null) ? "" : String(texte);
    const trouve = NIVEAU_DE_PASSIF.exec(brut);
    return trouve ? Number(trouve[1]) : null;
  }

  /* Le bord droit du panneau, ou toutes les valeurs sont alignees. C'est le
     seul repere global qu'on s'autorise, et il est fiable : les valeurs y sont
     collees quelle que soit la resolution. */
  function bordDroit(mots){
    return Math.max(...mots.map(m => m.bbox.x1));
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
    const droite = bordDroit(mots);
    const stats = [];
    let bloc = [];
    let attente = null;

    /* La section d'appartenance voyage avec la ligne. Un panneau d'arme
       range ses enchantements sous « Enchanter », une piece gravee ses
       options aleatoires sous « Bonus de gravure » : sans ce marquage, ces
       lignes seraient confondues avec les statistiques natives, et
       l'inversion chercherait une piece capable de les porter toutes. */
    let section = null;

    const fermerBloc = () => {
      if(bloc.length && attente){
        stats.push({ libelle:bloc.join(" "), valeur:attente, section });
      }
      bloc = [];
      attente = null;
    };

    for(const rang of rangsVisuels(mots, 14)){
      /* La valeur est LOCALE a la ligne : c'est son dernier mot, s'il est
         numerique et colle au bord droit. Une frontiere verticale globale
         tranchait au milieu du dernier mot des libelles longs, qui partaient
         alors a la poubelle. */
      const dernier = rang.mots[rang.mots.length - 1];
      const candidat = dernier ? String(dernier.text).trim() : "";
      const estValeur = !!dernier
        && EST_NOMBRE_PANNEAU.test(candidat)
        && dernier.bbox.x1 >= droite - 40;
      const valeur = estValeur ? candidat : null;
      const gauche = (estValeur ? rang.mots.slice(0, -1) : rang.mots)
        .map(m => m.text).join(" ").trim();
      const lettres = gauche.replace(/[^\p{L}]/gu, "").length;
      /* Un fragment qui OUVRE un libelle doit contenir un mot d'au moins
         quatre lettres. La bordure superieure du panneau laisse des debris
         — « Le V4 LS », « Le ee » — que l'ancien decompte global de lettres
         laissait passer : ils se collaient alors au vrai libelle suivant.
         Les treize libelles releves sur captures reelles portent tous un
         mot de quatre lettres, aucun debris n'en porte. La regle ne vaut
         pas pour un fragment de CONTINUATION, qui peut etre court. */
      const utile = lettres > 3
        && (bloc.length > 0 || /\p{L}{4,}/u.test(gauche));
      const texte = utile ? gauche.replace(/^[^\p{L}]+/u, "").trim() : "";

      if(texte && estSection(texte)){
        fermerBloc();
        section = nettoyerTexte(texte);
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

export { detecterPanneau, extraireStats, EST_NOMBRE_PANNEAU };
