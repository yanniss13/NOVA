/* Préférence locale de présentation, indépendante des comptes et brouillons.
   Ce petit module est chargé dans le head pour appliquer le choix avant le
   démarrage du reste de l'application. Aucun rendu de vue n'est déclenché. */
const AMBIANCE_STORAGE_KEY = "confrerie7ds.ambiance";

function appliquerAmbiance(value){
  const theme = value === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll("[data-ambiance]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.ambiance === theme));
  });
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute("content", theme === "light" ? "#f4eee2" : "#100d18");
}

/* La bannière remonte sous l'en-tête : elle a donc besoin de sa hauteur, que
   le CSS seul ne sait pas lire. Cette hauteur n'est pas une constante — elle
   change quand les onglets passent à la ligne, quand le mobile bascule en
   paysage, ou quand la seconde ligne « Boss de Guilde » apparaît. Un
   ResizeObserver la republie à chaque fois ; sans lui, le panorama se
   décalerait dès le premier changement de disposition.
   Le nom est unique dans tout le projet : le chargeur de tests concatène les
   modules dans une seule portée. */
function publierHauteurEnTeteAmbiance(){
  const barre = document.querySelector(".topbar");
  if(!barre) return;
  const mesurer = () => {
    const hauteur = Math.round(barre.getBoundingClientRect().height);
    document.documentElement.style.setProperty("--topbar-h", `${hauteur}px`);
  };
  mesurer();
  if(typeof ResizeObserver === "function") new ResizeObserver(mesurer).observe(barre);
  /* Le repli paysage anime la hauteur : la valeur juste après la bascule est
     celle d'avant. L'observateur repasse de lui-même à la fin. */
  window.addEventListener("resize", mesurer);
}

/* L'en-tête est transparent tant que le panorama passe derrière lui, et
   reprend son verre dès que c'est le contenu du site qui défile dessous.

   Le seuil n'est pas une constante : la bannière est plus courte dans les
   catalogues, et l'en-tête grandit d'une ligne dans les vues « Boss de
   Guilde ». On lit donc où en est le bas de la bannière, à chaque image.
   Une seule lecture de rect par trame, cadencée par rAF.
   Le nom est unique dans tout le projet : le chargeur de tests concatène les
   modules dans une seule portée. */
function suivreDefilementAmbiance(){
  const banniere = document.querySelector(".guild-banner");
  const barre = document.querySelector(".topbar");
  if(!banniere || !barre) return;
  let enAttente = false;
  const evaluer = () => {
    enAttente = false;
    const chevauche = banniere.getBoundingClientRect().bottom
      > barre.getBoundingClientRect().height;
    document.documentElement.dataset.defile = chevauche ? "non" : "oui";
  };
  const planifier = () => {
    if(enAttente) return;
    enAttente = true;
    requestAnimationFrame(evaluer);
  };
  evaluer();
  window.addEventListener("scroll", planifier, { passive:true });
  window.addEventListener("resize", planifier);
}

/* Le chargeur vm ne représente pas la racine HTML ; il ne lance pas cette
   initialisation de présentation. Le navigateur la possède toujours. */
if(document.documentElement){
  let saved = null;
  try { saved = localStorage.getItem(AMBIANCE_STORAGE_KEY); } catch { /* Stockage privé refusé. */ }
  appliquerAmbiance(saved);
  publierHauteurEnTeteAmbiance();
  suivreDefilementAmbiance();
  /* Remonter en haut depuis le pied de page. C'est un bouton et non un lien :
     le site route sur le fragment d'URL, et un `href` inconnu ferait replier
     la vue courante sous les yeux du membre. */
  document.querySelectorAll("[data-remonter]").forEach(bouton => {
    bouton.addEventListener("click", () => {
      const doux = !matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top:0, behavior:doux ? "smooth" : "auto" });
    });
  });
  document.querySelectorAll("[data-ambiance]").forEach(button => {
    button.addEventListener("click", () => {
      appliquerAmbiance(button.dataset.ambiance);
      try { localStorage.setItem(AMBIANCE_STORAGE_KEY, button.dataset.ambiance); }
      catch { /* Le choix reste utilisable pour cette session. */ }
    });
  });
  window.addEventListener("storage", event => {
    if(event.key === AMBIANCE_STORAGE_KEY || event.key === null) appliquerAmbiance(event.newValue);
  });
}
