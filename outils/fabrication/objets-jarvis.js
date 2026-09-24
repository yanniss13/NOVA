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
  return Number(valeur).toLocaleString("fr-FR").replace(/[  ]/g, " ");
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
    boutiques.push({
      id, genre,
      nomDeBase:regions.length ? genre + " de " + regions[0].principal : genre,
      acces:identifiantsPnj.length ? "pnj" : "menu",
      pnj:[...new Set(identifiantsPnj.map(pnj => lire((entree.pnj[pnj] || {}).Local_Key)).filter(Boolean))],
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
    articlesEcartes
  };
}

module.exports = { construireCatalogueObjets };
