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
  const regionsParActeur = new Map();
  (entree.apparitions || []).forEach(apparition => {
    const principal = lire(apparition.secteur);
    if(!principal) return;
    const sous = lire(apparition.sousSecteur);
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
       distingue (chapitres 3 et 7 : apparitions sans region). Rien n'est
       invente. */
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

  const butins = butinsDuJeu(entree, lire, objetsParId, actif);
  butins.forEach(butin => {
    butin.objets.forEach(objet => {
      if(!index.has(objet.nom)) index.set(objet.nom, { nom:objet.nom, type:objet.type, sources:[] });
      const source = { type:butin.type, origine:butin.nom };
      if(butin.detail) source.detail = butin.detail;
      index.get(objet.nom).sources.push(source);
    });
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
    butins:butins.map(butin => Object.assign(
      { nom:butin.nom, type:butin.type }, butin.detail ? { detail:butin.detail } : {},
      { objets:butin.objets.map(objet => objet.nom) })),
    articlesEcartes
  };
}

/* Ce que chaque source PEUT donner. Aucune probabilite : DropPackTable
   repete un objet avec un taux par niveau de monde (Standard_Level) et
   DropGroupTable pondere ses paquets, sans que la lecture de ces taux soit
   confirmee. Un groupe -> ses paquets -> leurs lignes -> un objet (Item) ou
   une monnaie (le suffixe de DropType : Seal_Liones -> seal_liones). */
function butinsDuJeu(entree, lire, objetsParId, actif) {
  const lignesParPaquet = new Map();
  Object.values(entree.paquetsButin || {}).forEach(ligne => {
    if(ligne) ajouterDans(lignesParPaquet, String(ligne.DropPack_Key), ligne);
  });
  function objetsDuGroupe(groupe) {
    const brut = (entree.groupesButin || {})[String(groupe)];
    if(!brut) return [];
    const vus = new Map();
    [].concat(brut.DropPack_Key || []).forEach(paquet => {
      (lignesParPaquet.get(String(paquet)) || []).forEach(ligne => {
        const genre = String(ligne.DropType || "").replace(/^.*::/, "");
        const objet = genre === "Item"
          ? objetsParId.get(String(ligne.Item_Tid)) || null
          : actif("::Currency", genre.toLowerCase());
        if(objet && !vus.has(objet.nom)) vus.set(objet.nom, objet);
      });
    });
    return [...vus.values()];
  }

  const butins = [];
  const parCle = new Map();
  function ajouter(nom, type, detail, groupe) {
    if(!nom || !groupe || groupe === "None") return;
    const objets = objetsDuGroupe(groupe);
    if(!objets.length) return;
    const cle = type + "|" + nom + "|" + (detail || "");
    if(!parCle.has(cle)){
      parCle.set(cle, { nom, type, detail, objets:[] });
      butins.push(parCle.get(cle));
    }
    const butin = parCle.get(cle);
    objets.forEach(objet => {
      if(!butin.objets.some(deja => deja.nom === objet.nom)) butin.objets.push(objet);
    });
  }

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
    ajouter(point && lire(point.Local_Key), "minage", null, point && point.DropGroupTid);
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
