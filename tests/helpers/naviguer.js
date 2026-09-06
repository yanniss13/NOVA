"use strict";

/* ALLER A UNE VUE, DANS UN VRAI NAVIGATEUR, PAR LA VRAIE INTERFACE.

   Avant la refonte, chaque test navigateur ecrivait `page.click("#tab-wiki")`.
   Le jour ou la barre a change, dix-neuf fichiers ont casse d'un coup pour une
   seule et meme raison : ils connaissaient tous la FORME de la barre alors
   qu'ils voulaient seulement dire ou aller.

   Cet aide sait, lui, comment la coquille est faite. Les tests disent la
   destination ; c'est ici, et seulement ici, qu'on sait qu'un outil se trouve
   derriere un menu et qu'un telephone navigue par le bas.

   Il ne triche pas : aucun appel direct a `showView`, aucun fragment d'URL
   force. Il clique ce qu'un membre cliquerait, et une entree absente ou
   masquee fait echouer le test — ce qui est bien le but. */

const { RUBRIQUES } = require("./rubriques-lues");

/* `:visible` n'est pas un detail de confort. La meme destination existe dans
   les trois barres — bureau, tiroir, pouce — et une seule est affichee a la
   fois. Viser la premiere du DOM revenait a cliquer l'entree de bureau sur un
   telephone, ou elle est en `display:none`. On ne clique que ce qu'un membre
   pourrait cliquer. */
const SELECTEUR_DE_VUE = vue => `[data-view="${vue}"]:visible`;
/* `:not(.brand)` : la marque du site porte elle aussi `data-rubrique="guilde"`
   — elle ramene a l'accueil — mais ce n'est pas une entree de navigation. Elle
   reste toujours visible et ne s'allume jamais ; la viser ferait echouer toute
   verification de surlignage. */
const SELECTEUR_DE_RUBRIQUE = id => `[data-rubrique="${id}"]:not(.brand):visible`;
const LARGEUR_MOBILE = 768;

function rubriqueDeLaVue(vue){
  const trouvee = RUBRIQUES.find(rubrique => rubrique.vues.includes(vue));
  if(!trouvee) throw new Error(`vue inconnue de la table des rubriques : ${vue}`);
  return trouvee;
}

async function estMobile(page){
  const largeur = page.viewportSize();
  return !!largeur && largeur.width < LARGEUR_MOBILE;
}

/* Ouvre le contenant qui abrite l'entree, s'il y en a un : le menu Outils sur
   un ecran large, le tiroir « Plus » sur un telephone. */
async function ouvrirLeContenant(page, rubrique){
  if(await estMobile(page)){
    const auPouce = ["guilde", "equipes", "centre-boss", "mon-roster"];
    if(auPouce.includes(rubrique.id)) return;
    await page.locator("#mobileMoreButton").click();
    await page.locator("#mobileDrawer").waitFor({ state:"visible" });
    return;
  }
  if(rubrique.onglets.length && rubrique.id === "outils"){
    await page.locator("#toolsMenuButton").click();
    await page.locator("#toolsMenu").waitFor({ state:"visible" });
  }
}

/* Va a une vue et attend qu'elle soit reellement affichee.

   Deux chemins possibles : l'entree de la vue existe deja quelque part — un
   onglet local, une entree du menu Outils — et on la clique ; sinon on ouvre
   d'abord sa rubrique, ce qui fait apparaitre ses onglets locaux. */
async function allerA(page, vue){
  const rubrique = rubriqueDeLaVue(vue);
  const directe = page.locator(SELECTEUR_DE_VUE(vue)).first();

  if(await directe.count()){
    await directe.click();
  }else{
    await ouvrirLeContenant(page, rubrique);
    const entree = page.locator(SELECTEUR_DE_VUE(vue)).first();
    if(await entree.count()){
      await entree.click();
    }else{
      await page.locator(SELECTEUR_DE_RUBRIQUE(rubrique.id)).first().click();
      /* La rubrique a ouvert sa vue chef. Si c'est deja la bonne, on s'arrete
         la : recliquer son onglet la rendrait UNE SECONDE FOIS, et un test qui
         injecte une panne unique la verrait consommee par le premier rendu. */
      const dejaOuverte = await page.locator(`#view-${vue}.active`).count();
      if(!dejaOuverte){
        const onglet = page.locator(`#localTabs ${SELECTEUR_DE_VUE(vue)}`);
        if(await onglet.count()) await onglet.click();
      }
    }
  }
  await page.locator(`#view-${vue}`).waitFor({ state:"visible" });
}

/* CE QUE LA BARRE PROPOSE VRAIMENT, a l'oeil.

   Les tests de portee — visiteur, invite, membre, administrateur — verifiaient
   la liste des onglets visibles. La barre a change de forme mais la question
   est la meme : ou ce compte peut-il aller ? On rend donc les deux surfaces de
   la navigation de bureau, les rubriques et les outils du menu.

   `getClientRects()` et non l'attribut `hidden` : on veut savoir ce que l'oeil
   voit, pas ce que le code a ecrit. Une regle CSS oubliee passerait le second
   controle et raterait le premier. */
async function destinationsVisibles(page){
  return page.evaluate(() => {
    const vu = element => element.getClientRects().length > 0;
    const menu = document.querySelector(".tools-menu");
    return {
      rubriques:[...document.querySelectorAll("#desktopNav [data-rubrique]")]
        .filter(vu).map(entree => entree.dataset.rubrique),
      /* Le menu est replie : ses entrees n'ont pas de rectangle. On lit donc
         `hidden`, que la coquille pose sur celles qui sont hors de portee, et
         on ne rend rien du tout si le menu lui-meme est invisible. */
      outils:menu && vu(menu)
        ? [...document.querySelectorAll("#toolsMenu [data-view]")]
            .filter(entree => !entree.hidden).map(entree => entree.dataset.view)
        : []
    };
  });
}

/* Les onglets locaux affiches, dans l'ordre. C'est le second etage de la
   navigation : il remplace le sous-menu du groupe « Boss de Guilde ». */
async function ongletsLocauxVisibles(page){
  return page.evaluate(() =>
    [...document.querySelectorAll("#localTabs [data-view]")]
      .filter(onglet => onglet.getClientRects().length > 0)
      .map(onglet => onglet.dataset.view));
}

/* OUVRIR LE MENU DU COMPTE.

   « Deconnexion » et « Importer mes donnees locales » vivaient a plat dans la
   barre du haut ; ils sont desormais dans le menu du compte, comme dans la
   maquette. Un test qui les cherche doit donc ouvrir ce menu d'abord — c'est
   ce que fait un membre. */
async function ouvrirLeCompte(page){
  const menu = page.locator("#accountMenu");
  if(await menu.isVisible()) return;
  const surLeBureau = page.locator("#accountMenuButton:visible");
  if(await surLeBureau.count()){
    await surLeBureau.click();
  }else{
    await page.locator("#mobileMoreButton").click();
    await page.locator('#mobileDrawer [data-action="compte"]').click();
  }
  await menu.waitFor({ state:"visible" });
}

/* L'entree de navigation qui mene a une vue, pour les tests qui verifient son
   etat — surlignage, visibilite, taille de cible tactile. */
function entreeDeLaVue(page, vue){
  return page.locator(SELECTEUR_DE_VUE(vue)).first();
}

function entreeDeLaRubrique(page, id){
  return page.locator(SELECTEUR_DE_RUBRIQUE(id)).first();
}

module.exports = {
  allerA,
  destinationsVisibles,
  ongletsLocauxVisibles,
  ouvrirLeCompte,
  entreeDeLaRubrique,
  entreeDeLaVue,
  rubriqueDeLaVue,
  RUBRIQUES
};
