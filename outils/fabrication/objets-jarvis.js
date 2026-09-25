"use strict";

/* L'index des objets et les boutiques que /jarvis consulte : logique PURE.

   Elle recoit les tables deja lues et rend l'objet a deposer dans le bucket
   prive `jarvis-prive`. Aucun acces disque ici : `extraire-objets.js` lit
   l'export, et les tests lui tendent un mini-export.

   LA CHAINE, verifiee sur l'export du 22/09/2026 :
     Merchant/MerchantGoods : un article par ligne ; MerchantTid porte la
       boutique entiere (String_Tid, Local_Key, SellType).
     Boutique -> PNJ : InteractionButtonTable (ButtonDetailType « merchant »,
       ButtonDetailValue01 = boutique) -> InteractionTable (ButtonTid)
       -> Actor/NPCActorTable (InteractionTid[]).
     PNJ -> region : lignes des tables d'apparition (TagMainSector,
       TagSubSector), traduites par la localisation.
       Sans etiquette : Scene/Sector/<zone>_sectortable (AreaPoint des
       secteurs principaux) et la position de l'apparition.
     Monnaie : Item/CurrencyTable n'a pas de nom ; il passe par LinkItemTid.

   Les butins et les recettes ajouteront d'autres `type` de source aux
   memes objets. */

const { lecteurDeTextes } = require("./monstres-jarvis.js");

/* L'ordre compte : un nom porte par deux familles prend la premiere. */
const FAMILLES_OBJETS = [
  ["etc", "Divers"], ["equip", "Équipement"], ["use", "Consommable"],
  ["quest", "Quête"], ["pet", "Familier"], ["dropType", "Monnaie"]
];
const PERIODES_BOUTIQUE = {
  "EGoodsResetType::Shop_Daily":"par jour",
  "EGoodsResetType::Shop_Weekly":"par semaine",
  "EGoodsResetType::Shop_Monthly":"par mois"
};

function ordreNumeriqueObjets(a, b) {
  return String(a).localeCompare(String(b), "en", { numeric:true });
}

/* « 1 800 » : l'espace fine insecable de toLocaleString devient ordinaire. */
function nombreObjets(valeur) {
  return Number(valeur).toLocaleString("fr-FR").replace(/[\u202f\u00a0]/g, " ");
}

function ajouterDans(table, cle, valeur) {
  if(!table.has(cle)) table.set(cle, []);
  table.get(cle).push(valeur);
}

function sansDoublonsObjets(liste) {
  const vus = new Set();
  return liste.filter(element => {
    const cle = JSON.stringify(element);
    if(vus.has(cle)) return false;
    vus.add(cle);
    return true;
  });
}

function limiteArticle(brut) {
  const nombre = Number(brut.LimitCount) || 0;
  if(nombre <= 0) return null;
  /* Permanent, ou aucune periode : la limite ne se renouvelle pas. */
  return nombre + " " + (PERIODES_BOUTIQUE[brut.GoodsResetTime] || "au total");
}

function dansContourObjets(point, contour) {
  let dedans = false;
  for(let i = 0, j = contour.length - 1; i < contour.length; j = i++){
    const a = contour[i], b = contour[j];
    if((a.Y > point.Y) !== (b.Y > point.Y)
      && point.X < (b.X - a.X) * (point.Y - a.Y) / (b.Y - a.Y) + a.X) dedans = !dedans;
  }
  return dedans;
}

/* Une apparition sans etiquette de region (98 PNJ sur 142 au chapitre 7,
   dont Velia) : le contour du secteur principal de sa zone qui contient
   sa position (les donjons ont leurs propres coordonnees).
   Un seul contour, du chapitre de sa table, sinon rien. Mesure sur les PNJ
   etiquetes du 25/09/2026 : 983 accords, 18 ecarts en bordure. Les
   sous-secteurs ne se deduisent pas ainsi (un accord sur deux). */
function secteurParPosition(apparition, secteurs) {
  const position = apparition && apparition.position;
  if(!position || !Number.isFinite(apparition.chapitre)) return null;
  const cles = [...new Set((secteurs || [])
    .filter(secteur => secteur.zone === apparition.zone
      && dansContourObjets(position, secteur.points || []))
    .map(secteur => secteur.cle))];
  if(cles.length !== 1) return null;
  const chapitre = /^CH0*(\d+)_/i.exec(cles[0]);
  return chapitre && Number(chapitre[1]) === apparition.chapitre ? cles[0] : null;
}

function construireCatalogueObjets(entree) {
  const lireBrut = lecteurDeTextes(entree.textes);
  /* Une traduction absente rend parfois la cle elle-meme : pas un texte. */
  const lire = cle => {
    const texte = lireBrut(cle);
    return texte && texte.toLowerCase() === String(cle).toLowerCase() ? null : texte;
  };

  const objetsParId = new Map();
  FAMILLES_OBJETS.forEach(([famille, type]) => {
    Object.entries((entree.objets || {})[famille] || {}).forEach(([id, brut]) => {
      if(objetsParId.has(String(id))) return;
      const nom = lire(brut && brut.Local_Key);
      if(nom) objetsParId.set(String(id), { nom, type });
    });
  });
  function actif(genre, id) {
    if(String(genre).endsWith("::Currency")){
      const monnaie = (entree.monnaies || {})[String(id)];
      const lie = monnaie && objetsParId.get(String(monnaie.LinkItemTid));
      return lie ? { nom:lie.nom, type:"Monnaie" } : null;
    }
    return objetsParId.get(String(id)) || null;
  }

  /* Boutique -> PNJ. */
  const boutonsParBoutique = new Map();
  Object.entries(entree.boutons || {}).forEach(([cle, bouton]) => {
    if(bouton && bouton.ButtonDetailType === "merchant") ajouterDans(boutonsParBoutique, String(bouton.ButtonDetailValue01), cle);
  });
  const interactionsParBouton = new Map();
  Object.entries(entree.interactions || {}).forEach(([cle, interaction]) => {
    if(interaction) ajouterDans(interactionsParBouton, String(interaction.ButtonTid), cle);
  });
  const pnjParInteraction = new Map();
  Object.entries(entree.pnj || {}).forEach(([id, pnj]) => {
    [].concat(pnj && pnj.InteractionTid || []).forEach(interaction => ajouterDans(pnjParInteraction, String(interaction), String(id)));
  });
  /* Region d'une apparition : son etiquette, sinon son contour (sans
     sous-secteur). Partagee par les PNJ et les filons. */
  function regionDApparition(apparition) {
    const place = !lire(apparition.secteur) && secteurParPosition(apparition, entree.secteurs);
    const principal = place ? lire(place) : lire(apparition.secteur);
    return principal ? { principal, sous:place ? null : lire(apparition.sousSecteur) } : null;
  }
  const regionsParActeur = new Map();
  (entree.apparitions || []).forEach(apparition => {
    const region = regionDApparition(apparition);
    if(!region) return;
    const { principal, sous } = region;
    const libelle = principal + (sous && sous !== principal ? " (" + sous + ")" : "");
    const deja = regionsParActeur.get(String(apparition.acteur)) || [];
    if(!deja.some(region => region.libelle === libelle)) deja.push({ principal, libelle });
    regionsParActeur.set(String(apparition.acteur), deja);
  });

  /* Articles regroupes par boutique, dans l'ordre du jeu. */
  const lignesParBoutique = new Map();
  Object.keys(entree.articles || {}).sort(ordreNumeriqueObjets).forEach(cle => {
    const brut = entree.articles[cle];
    const marchand = brut && brut.MerchantTid;
    if(!marchand) return;
    if(!lignesParBoutique.has(String(marchand.String_Tid))){
      lignesParBoutique.set(String(marchand.String_Tid), { marchand, lignes:[] });
    }
    lignesParBoutique.get(String(marchand.String_Tid)).lignes.push(brut);
  });

  let articlesEcartes = 0;
  const boutiques = [];
  [...lignesParBoutique.keys()].sort(ordreNumeriqueObjets).forEach(id => {
    const { marchand, lignes } = lignesParBoutique.get(id);
    const genre = lire(marchand.Local_Key);
    if(!genre){
      articlesEcartes += lignes.length;
      return;
    }
    const identifiantsPnj = [...new Set((boutonsParBoutique.get(id) || [])
      .flatMap(bouton => interactionsParBouton.get(bouton) || [])
      .flatMap(interaction => pnjParInteraction.get(interaction) || []))].sort(ordreNumeriqueObjets);
    const regions = [];
    identifiantsPnj.flatMap(pnj => regionsParActeur.get(pnj) || []).forEach(region => {
      if(!regions.some(deja => deja.libelle === region.libelle)) regions.push(region);
    });
    const articles = [];
    const vendus = [];
    lignes.slice().sort((a, b) => (Number(a.Order) || 0) - (Number(b.Order) || 0)).forEach(brut => {
      const vendu = actif(brut.Sell_Asset, brut.Sell_Asset_Tid);
      const paiement = actif(brut.Payment_Asset, brut.Payment_Asset_Tid);
      if(!vendu || !paiement){
        articlesEcartes += 1;
        return;
      }
      const ligne = { objet:vendu.nom };
      if(Number(brut.GetCount) > 1) ligne.quantite = Number(brut.GetCount);
      ligne.prix = nombreObjets(brut.Price) + " " + paiement.nom;
      const limite = limiteArticle(brut);
      if(limite) ligne.limite = limite;
      if(brut.LimitLevelType === "ELimitLevelType::World_Level" && Number(brut.LimitLevel) > 0){
        ligne.condition = "à partir du niveau de monde " + Number(brut.LimitLevel);
      }
      articles.push(ligne);
      vendus.push({ ligne, type:vendu.type });
    });
    /* Une boutique dont tous les articles sont ecartes n'a rien a dire. */
    if(!articles.length) return;
    const nomsPnj = [...new Set(identifiantsPnj.map(pnj => lire((entree.pnj[pnj] || {}).Local_Key)).filter(Boolean))];
    /* Region connue : « Boutique d'equipement — Liones ». Sinon le PNJ la
       distingue. Rien n'est invente. */
    let nomDeBase = genre;
    if(regions.length) nomDeBase = genre + " — " + regions[0].principal;
    else if(nomsPnj.length) nomDeBase = genre + " (" + nomsPnj.join(", ") + ")";
    boutiques.push({
      id, genre, nomDeBase,
      acces:identifiantsPnj.length ? "pnj" : "menu",
      pnj:nomsPnj,
      regions:regions.map(region => region.libelle),
      aleatoire:marchand.SellType === "ESellType::Random",
      articles:sansDoublonsObjets(articles),
      vendus
    });
  });

  /* Noms uniques : la boutique au plus petit identifiant garde le nom nu. */
  const vus = new Map();
  boutiques.forEach(boutique => {
    const rang = (vus.get(boutique.nomDeBase) || 0) + 1;
    vus.set(boutique.nomDeBase, rang);
    boutique.nom = rang === 1 ? boutique.nomDeBase : boutique.nomDeBase + " (" + rang + ")";
  });

  const index = new Map();
  boutiques.forEach(boutique => {
    boutique.vendus.forEach(({ ligne, type }) => {
      if(!index.has(ligne.objet)) index.set(ligne.objet, { nom:ligne.objet, type, sources:[] });
      const source = { type:"boutique", boutique:boutique.nom };
      Object.entries(ligne).forEach(([cle, valeur]) => { if(cle !== "objet") source[cle] = valeur; });
      if(boutique.aleatoire) source.aleatoire = true;
      index.get(ligne.objet).sources.push(source);
    });
  });

  const butins = butinsDuJeu(entree, lire, objetsParId, actif, regionDApparition);
  butins.forEach(butin => {
    butin.objets.forEach(objet => {
      if(!index.has(objet.nom)) index.set(objet.nom, { nom:objet.nom, type:objet.type, sources:[] });
      const source = { type:butin.type, origine:butin.nom };
      /* La chance reste dans `butins` seulement : le bot l'y relit, le
         fichier ne la porte pas deux fois. */
      if(butin.detail) source.detail = butin.detail;
      index.get(objet.nom).sources.push(source);
    });
  });

  const recettes = recettesDuJeu(entree, lire, objetsParId);
  recettes.forEach(recette => {
    if(!index.has(recette.produit)){
      index.set(recette.produit, { nom:recette.produit, type:recette.typeObjet, sources:[] });
    }
    index.get(recette.produit).sources.push({ type:"recette", origine:recette.type });
  });

  return {
    version:1,
    genereLe:entree.genereLe || null,
    dateExport:entree.dateExport || null,
    objets:[...index.values()]
      .map(objet => Object.assign(objet, { sources:sansDoublonsObjets(objet.sources) }))
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    boutiques:boutiques.map(boutique => {
      const sortie = {
        nom:boutique.nom, genre:boutique.genre, acces:boutique.acces,
        pnj:boutique.pnj, regions:boutique.regions
      };
      if(boutique.aleatoire) sortie.aleatoire = true;
      sortie.articles = boutique.articles;
      return sortie;
    }),
    butins:butins.map(butin => {
      const sortie = Object.assign(
        { nom:butin.nom, type:butin.type }, butin.detail ? { detail:butin.detail } : {},
        { objets:butin.objets.map(objet => objet.nom) });
      const taux = butin.objets.filter(objet => objet.taux);
      if(taux.length) sortie.taux = Object.fromEntries(taux.map(objet => [objet.nom, objet.taux]));
      /* Une quantite de 1 va sans dire. */
      const quantites = butin.objets.filter(objet => objet.quantite && objet.quantite.max > 1);
      if(quantites.length){
        sortie.quantites = Object.fromEntries(quantites.map(objet =>
          [objet.nom, texteQuantiteButin(objet.quantite.min, objet.quantite.max)]));
      }
      if(butin.filons && butin.filons.size){
        const total = [...butin.filons.values()].reduce((somme, nombre) => somme + nombre, 0);
        sortie.filons = { total, regions:[...butin.filons].map(([region, nombre]) => region + " : " + nombre) };
        /* Le maximum par jour : chaque filon une fois, chance certaine. */
        const certains = butin.objets.filter(objet => objet.taux === "100 %" && objet.quantite);
        if(certains.length){
          sortie.parJour = Object.fromEntries(certains.map(objet =>
            [objet.nom, texteQuantiteButin(total * objet.quantite.min, total * objet.quantite.max)]));
        }
      }
      return sortie;
    }),
    recettes:recettes.map(({ typeObjet, ...recette }) => recette),
    articlesEcartes
  };
}

/* Les recettes : quatre tables de Table/Making de meme forme
   (Material_TID_1..7 / Material_Cnt_1..7 -> Reward_Item_Tid_1). MakingRecipe
   n'est PAS lue : table perimee, 361 de ses 563 produits de fabrication n'ont
   pas de nom et ses ingredients different de ProductionRecipeTable pour un
   meme produit. En cuisine, Material_Group_n liste des ingredients
   interchangeables (MakingList). */
const ALTERNATIVES_MAX_RECETTE = 4;

function recettesDuJeu(entree, lire, objetsParId) {
  const nomObjet = id => (objetsParId.get(String(id)) || {}).nom || null;
  const groupes = new Map();
  const liste = entree.listeIngredients || {};
  Object.keys(liste).sort(ordreNumeriqueObjets).forEach(id => {
    const nom = nomObjet(id);
    const groupe = Number(liste[id] && liste[id].Material_Group) || 0;
    if(nom && groupe > 0) ajouterDans(groupes, String(groupe), nom);
  });
  const categories = entree.categoriesFabrication || {};
  const libelleParFonction = new Map();
  Object.keys(categories).sort().forEach(cle => {
    const categorie = categories[cle];
    const libelle = categorie && lire(categorie.Local_Key);
    if(libelle && !libelleParFonction.has(categorie.Function_Type)) libelleParFonction.set(categorie.Function_Type, libelle);
  });
  const types = {
    cuisine:ligne => "Cuisine" + (libelleParFonction.has(ligne.Function_Type)
      ? " — " + libelleParFonction.get(ligne.Function_Type) : ""),
    /* Recipe_Type liste les etablis ou la recette apparait : le plus
       modeste suffit, les suivants la reprennent. */
    fabrication:ligne => {
      const rangs = [].concat(ligne.Recipe_Type || [])
        .map(type => Number((/^productiontable_(\d+)$/.exec(String(type)) || [])[1]))
        .filter(rang => rang > 0).sort((a, b) => a - b);
      const etabli = rangs.length && lire((categories["making_productiontable_" + rangs[0]] || {}).Local_Key);
      return "Fabrication" + (etabli ? " — " + etabli + (rangs.length > 1 ? " ou supérieur" : "") : "");
    },
    gravure:() => "Gravure",
    combinaison:() => "Combinaison"
  };

  function recette(ligne, famille) {
    const produit = objetsParId.get(String(ligne.Reward_Item_Tid_1));
    if(!produit) return null;
    const ingredients = [];
    for(let rang = 1; rang <= 7; rang++){
      const id = ligne["Material_TID_" + rang];
      const nombre = Number(ligne["Material_Cnt_" + rang]) || 0;
      if(!id || id === "None" || nombre <= 0) continue;
      const nom = nomObjet(id);
      /* Un ingredient sans nom : la recette ne se lirait pas. */
      if(!nom) return null;
      const autres = (groupes.get(String(Number(ligne["Material_Group_" + rang]) || 0)) || [])
        .filter(autre => autre !== nom);
      const reste = autres.length - ALTERNATIVES_MAX_RECETTE;
      ingredients.push(nom + " x" + nombre + (autres.length
        ? " (ou : " + autres.slice(0, ALTERNATIVES_MAX_RECETTE).join(", ")
          + (reste > 0 ? " et " + reste + " autre" + (reste > 1 ? "s" : "") : "") + ")"
        : ""));
    }
    if(!ingredients.length) return null;
    const sortie = { produit:produit.nom };
    if(Number(ligne.Reward_Item_Cnt_1) > 1) sortie.quantite = Number(ligne.Reward_Item_Cnt_1);
    sortie.type = types[famille](ligne);
    sortie.ingredients = ingredients;
    return sortie;
  }

  const sortie = [];
  const vues = new Set();
  /* Cuisine manuelle et automatique d'une meme recette : une seule,
     « Cuisine ». */
  const cuisines = new Map();
  [["recettesCuisine", "cuisine"], ["recettesFabrication", "fabrication"],
    ["recettesGravure", "gravure"], ["recettesCombinaison", "combinaison"]].forEach(([table, famille]) => {
    const lignes = entree[table] || {};
    Object.keys(lignes).sort(ordreNumeriqueObjets).forEach(id => {
      const trouvee = lignes[id] && recette(lignes[id], famille);
      if(!trouvee) return;
      const cle = JSON.stringify(trouvee);
      if(vues.has(cle)) return;
      vues.add(cle);
      if(famille === "cuisine"){
        const { type, ...sansType } = trouvee;
        const cleCuisine = JSON.stringify(sansType);
        if(cuisines.has(cleCuisine)){
          cuisines.get(cleCuisine).type = "Cuisine";
          return;
        }
        cuisines.set(cleCuisine, trouvee);
      }
      trouvee.typeObjet = objetsParId.get(String(lignes[id].Reward_Item_Tid_1)).type;
      sortie.push(trouvee);
    });
  });
  return sortie;
}

/* « 1,5 % » a partir de dix-milliemes (150). */
function pourcentButin(dixMilliemes) {
  return Number((dixMilliemes / 100).toFixed(2)).toLocaleString("fr-FR") + " %";
}

/* La quantite d'un objet par tirage, ou null : jamais lue sur deux lignes
   (leur cumul n'est pas confirme), ni sans Min_Cnt/Max_Cnt lisibles. */
function quantiteButin(quantites) {
  if(quantites.length !== 1) return null;
  const { min, max } = quantites[0];
  return Number.isInteger(min) && Number.isInteger(max) && min >= 1 && max >= min ? { min, max } : null;
}

function texteQuantiteButin(min, max) {
  return min === max ? nombreObjets(min) : nombreObjets(min) + " à " + nombreObjets(max);
}

/* Les taux d'un objet par niveau de monde, ou null quand ils ne se lisent
   pas sans hypothese : taux de groupe absent, deux lignes au meme niveau
   (leur cumul n'est pas confirme), niveaux melanges avec « None ». */
function tauxLisibleButin(suivi) {
  if(!suivi.connu || suivi.ambigu || !suivi.niveaux.size) return null;
  const niveaux = [...suivi.niveaux.entries()];
  if(suivi.niveaux.has("None")) return niveaux.length === 1 ? pourcentButin(niveaux[0][1]) : null;
  const numeros = niveaux.map(([niveau, taux]) => [Number((/^level_(\d+)$/.exec(niveau) || [])[1]), taux]);
  if(numeros.some(([numero]) => !(numero > 0))) return null;
  numeros.sort((a, b) => a[0] - b[0]);
  if(numeros.every(([, taux]) => taux === numeros[0][1])) return pourcentButin(numeros[0][1]);
  /* Des niveaux qui se suivent : « niveaux de monde 1 a 4 : 1,5 % ; 3,5 % ;
     6 % ; 10 % ». Sinon, chaque niveau nomme. */
  if(numeros.every(([numero], rang) => numero === numeros[0][0] + rang)){
    return "niveaux de monde " + numeros[0][0] + " à " + numeros[numeros.length - 1][0] + " : "
      + numeros.map(([, taux]) => pourcentButin(taux)).join(" ; ");
  }
  return numeros.map(([numero, taux]) => pourcentButin(taux) + " (niveau de monde " + numero + ")").join(" ; ");
}

/* Ce que chaque source peut donner, et avec quelle chance. Un groupe -> ses
   paquets -> leurs lignes -> un objet (Item) ou une monnaie (le suffixe de
   DropType : Seal_Liones -> seal_liones).
   LA CHANCE, a chaque victoire ou recolte, verifiee le 25/09/2026 contre
   7dsorigin.app (Belette, Chaman ours-garou, Banakro) :
   - le groupe ouvre chaque paquet avec DropPack_Rate (dix-milliemes) ;
   - paquet ALEATOIRE (DropPack_Type vrai) : il donne UN objet de sa liste,
     les Rate sont des poids. Belette : 8000 x 2500/2500 = 80 %. Chaman :
     2000 x 22500/25000 = 18 %, 2000 x 2500/25000 = 2 % ;
   - paquet non aleatoire : chaque objet a sa chance, DropPack_Rate x Rate.
     Banakro : 1,5 %, 3,5 %, 6 % puis 10 % selon le niveau de monde
     (Standard_Level ; une ligne « None » vaut a tous les niveaux). */
function butinsDuJeu(entree, lire, objetsParId, actif, regionDApparition) {
  const lignesParPaquet = new Map();
  Object.values(entree.paquetsButin || {}).forEach(ligne => {
    if(ligne) ajouterDans(lignesParPaquet, String(ligne.DropPack_Key), ligne);
  });
  function objetsDuGroupe(groupe) {
    const brut = (entree.groupesButin || {})[String(groupe)];
    if(!brut) return [];
    const vus = new Map();
    [].concat(brut.DropPack_Key || []).forEach((paquet, rang) => {
      const tauxPaquet = Array.isArray(brut.DropPack_Rate) ? Number(brut.DropPack_Rate[rang]) : NaN;
      const aleatoire = Array.isArray(brut.DropPack_Type) && brut.DropPack_Type[rang] === true;
      const lignes = (lignesParPaquet.get(String(paquet)) || []).map(ligne => {
        const genre = String(ligne.DropType || "").replace(/^.*::/, "");
        const objet = genre === "Item"
          ? objetsParId.get(String(ligne.Item_Tid)) || null
          : actif("::Currency", genre.toLowerCase());
        if(objet && !vus.has(objet.nom)) vus.set(objet.nom, { objet, niveaux:new Map(), connu:true, ambigu:false, quantites:[] });
        /* Quantite par tirage : Min_Cnt a Max_Cnt, sur une seule ligne. */
        if(objet) vus.get(objet.nom).quantites.push({ min:Number(ligne.Min_Cnt), max:Number(ligne.Max_Cnt) });
        return { objet, niveau:String(ligne.Standard_Level || "None"), taux:Number(ligne.Rate) };
      });
      /* Une ligne sans niveau vaut a tous les niveaux du paquet : les poids
         d'un paquet aleatoire se ramenent a leur somme, niveau par niveau. */
      const niveaux = [...new Set(lignes.map(ligne => ligne.niveau).filter(niveau => niveau !== "None"))];
      (niveaux.length ? niveaux : ["None"]).forEach(niveau => {
        const actives = lignes.filter(ligne => ligne.niveau === niveau || ligne.niveau === "None");
        const total = actives.reduce((somme, ligne) => somme + (Number.isFinite(ligne.taux) ? ligne.taux : 0), 0);
        actives.forEach(ligne => {
          if(!ligne.objet) return;
          const suivi = vus.get(ligne.objet.nom);
          if(!Number.isFinite(tauxPaquet) || !Number.isFinite(ligne.taux) || (aleatoire && !(total > 0))){
            suivi.connu = false;
            return;
          }
          const chance = tauxPaquet * (aleatoire ? ligne.taux / total : ligne.taux / 10000);
          if(suivi.niveaux.has(niveau)) suivi.ambigu = true;
          else suivi.niveaux.set(niveau, chance);
        });
      });
    });
    return [...vus.values()].map(suivi => Object.assign({}, suivi.objet,
      { taux:tauxLisibleButin(suivi), quantite:quantiteButin(suivi.quantites) }));
  }

  const butins = [];
  const parCle = new Map();
  function ajouter(nom, type, detail, groupe) {
    if(!nom || !groupe || groupe === "None") return null;
    const objets = objetsDuGroupe(groupe);
    if(!objets.length) return null;
    const cle = type + "|" + nom + "|" + (detail || "");
    if(!parCle.has(cle)){
      parCle.set(cle, { nom, type, detail, objets:[] });
      butins.push(parCle.get(cle));
    }
    const butin = parCle.get(cle);
    /* Deux versions d'un monstre aux taux (ou quantites) differents : ni
       l'un ni l'autre. */
    objets.forEach(objet => {
      const deja = butin.objets.find(present => present.nom === objet.nom);
      if(!deja) butin.objets.push(objet);
      else {
        if(deja.taux !== objet.taux) deja.taux = null;
        if(JSON.stringify(deja.quantite) !== JSON.stringify(objet.quantite)) deja.quantite = null;
      }
    });
    return butin;
  }

  /* Les filons de chaque point de minage, par region principale (etiquette
     ou contour, comme les PNJ). Une apparition sans region (carte JcJ,
     donjon) n'est pas comptee. */
  const filonsParActeur = new Map();
  (entree.apparitionsMinage || []).forEach(apparition => {
    const region = regionDApparition(apparition);
    if(!region) return;
    const acteur = String(apparition.acteur);
    if(!filonsParActeur.has(acteur)) filonsParActeur.set(acteur, new Map());
    const parRegion = filonsParActeur.get(acteur);
    parRegion.set(region.principal, (parRegion.get(region.principal) || 0) + 1);
  });

  const monstres = entree.monstres || {};
  Object.keys(monstres).sort(ordreNumeriqueObjets).forEach(id => {
    const acteur = monstres[id];
    const nom = acteur && lire(acteur.Local_Key);
    ajouter(nom, "monstre", null, acteur && acteur.DropGroupTid);
    ajouter(nom, "capture", null, acteur && acteur.CatchDropGroupTid);
  });
  const minage = entree.minage || {};
  Object.keys(minage).sort(ordreNumeriqueObjets).forEach(id => {
    const point = minage[id];
    const butin = ajouter(point && lire(point.Local_Key), "minage", null, point && point.DropGroupTid);
    if(!butin || !filonsParActeur.has(String(id))) return;
    if(!butin.filons) butin.filons = new Map();
    filonsParActeur.get(String(id)).forEach((nombre, region) =>
      butin.filons.set(region, (butin.filons.get(region) || 0) + nombre));
  });
  const donjons = entree.donjons || {};
  Object.keys(donjons).sort(ordreNumeriqueObjets).forEach(id => {
    const donjon = donjons[id] || {};
    const groupe = (entree.groupesDonjon || {})[String(donjon.Dungeon_Group)] || {};
    const nom = lire(groupe.Local_Main_Name);
    if(!nom) return;
    const sous = lire(groupe.Local_Main_Sub_Name);
    const difficulte = lire(donjon.Local_Sub_Name);
    const libelle = nom + (sous ? " — " + sous : "") + (difficulte ? " (" + difficulte + ")" : "");
    ajouter(libelle, "donjon", null, donjon.Reward_Tid);
    ajouter(libelle, "donjon", "première victoire", donjon.First_Reward_Tid);
  });
  const confrerie = entree.recompensesConfrerie || {};
  Object.keys(confrerie).sort(ordreNumeriqueObjets).forEach(id => {
    const ligne = confrerie[id] || {};
    for(let palier = 1; palier <= 10; palier++){
      const suffixe = String(palier).padStart(2, "0");
      const seuil = Number(ligne["Reward_Check_" + suffixe]) || 0;
      if(seuil > 0){
        ajouter("Boss de confrérie", "confrerie", "palier de participation " + seuil, ligne["Reward_Drop_" + suffixe]);
      }
    }
  });
  return butins;
}

module.exports = { construireCatalogueObjets };
