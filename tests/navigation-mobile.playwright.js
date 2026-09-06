"use strict";

const assert = require("node:assert/strict");
const { CIBLE_TACTILE_PX } = require("./helpers/cible-tactile");
const { chromium } = require("playwright");
const { serveRepo } = require("./helpers/serve");
const { allerA } = require("./helpers/naviguer");

async function installConnectedSupabase(page, connected = true){
  await page.addInitScript(hasSession => {
    const session = hasSession
      ? { user:{ id:"mobile-user", email:"mobile@example.test" } }
      : null;
    function query(table){
      const builder = {
        select(){ return builder; },
        order(){ return builder; },
        eq(){ return builder; },
        in(){ return builder; },
        gte(){ return builder; },
        lte(){ return builder; },
        limit(){ return builder; },
        maybeSingle(){
          return Promise.resolve({
            data:hasSession && table === "profiles" ? { pseudo:"Yannis" } : null,
            error:null
          });
        },
        then(resolve, reject){
          return Promise.resolve({ data:[], error:null }).then(resolve, reject);
        }
      };
      return builder;
    }
    function channel(){
      const value = {
        on(){ return value; },
        subscribe(callback){
          queueMicrotask(() => callback("SUBSCRIBED"));
          return value;
        }
      };
      return value;
    }
    window.__mobileSupabaseClient = {
      auth:{
        async getSession(){ return { data:{session}, error:null }; },
        onAuthStateChange(){ return { data:{subscription:{unsubscribe(){}}} }; },
        async signOut(){ return { error:null }; }
      },
      from:query,
      channel,
      async removeChannel(){ return "ok"; },
      async rpc(){ return { data:null, error:null }; }
    };
  }, connected);
  await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*", route =>
    route.fulfill({
      status:200,
      contentType:"application/javascript",
      body:"window.supabase={createClient:function(){return window.__mobileSupabaseClient;}};"
    })
  );
}

/* LA NAVIGATION AU POUCE, apres la bascule sur la charte de la maquette.

   Ce que la refonte a retire, et qu'on ne teste donc plus :

   - l'arriere-plan sombre derriere « Plus ». Le tiroir est desormais un petit
     panneau ancre en haut a droite, pas un panneau plein ecran ;
   - le verrou de defilement qui figeait la page dessous. Il servait a ce
     panneau plein ecran ;
   - l'en-tete retractable. La barre du haut est compacte a toutes les largeurs,
     elle n'a plus rien a replier ;
   - le dock des sous-vues du Boss. Les onglets locaux d'une rubrique le
     remplacent, en haut de la vue et non au-dessus de la barre.

   Tout le reste — cinq destinations, ouverture et fermeture de « Plus »,
   restitution du focus, cibles de 44 px, absence de debordement, portee du
   visiteur — est verifie ici comme avant. */

(async()=>{
  const server = await serveRepo();
  const browser = await chromium.launch({ headless:true });
  const context = await browser.newContext({
    viewport:{ width:390, height:844 },
    isMobile:true,
    hasTouch:true,
    reducedMotion:"reduce"
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  try{
    await installConnectedSupabase(page);
    await page.goto(server.url + "/index.html");

    const nav = page.getByRole("navigation", { name:"Navigation mobile" });
    await nav.waitFor({ state:"visible" });
    const destinations = nav.locator("button:not([hidden])");
    assert.equal(await destinations.count(), 5,
      "un membre connecte doit garder cinq destinations principales au pouce");
    assert.deepEqual(
      await destinations.allTextContents()
        .then(items => items.map(item => item.trim())),
      ["Accueil", "Équipes", "Boss", "Roster", "Plus"]
    );

    assert.equal(await page.locator("#desktopNav").isHidden(), true,
      "la barre de bureau ne doit pas doubler la navigation mobile");

    /* ---- « Plus » : ce qu'il contient, et comment il se ferme. ---- */
    const plus = page.locator("#mobileMoreButton");
    const tiroir = page.getByRole("navigation", { name:"Explorer" });
    await plus.click();
    assert.equal(await plus.getAttribute("aria-expanded"), "true");
    await tiroir.waitFor({ state:"visible" });
    for(const outil of ["Wiki", "Collection", "Calculateur", "Analyse"]){
      assert.equal(
        await tiroir.getByRole("button", { name:outil, exact:true }).isVisible(),
        true,
        outil + " doit rester a un geste dans « Plus »");
    }
    assert.equal(
      await tiroir.getByRole("button", { name:"Mon compte", exact:true }).isVisible(),
      true,
      "le compte doit rester atteignable depuis « Plus »");

    await tiroir.getByRole("button", { name:"Wiki", exact:true }).click();
    await page.locator("#view-wiki").waitFor({ state:"visible" });
    assert.equal(await tiroir.isHidden(), true,
      "choisir une destination doit refermer « Plus »");
    assert.equal(await plus.getAttribute("aria-current"), "page",
      "« Plus » doit porter le contexte des rubriques secondaires");

    await plus.click();
    await tiroir.waitFor({ state:"visible" });
    await page.keyboard.press("Escape");
    assert.equal(await tiroir.isHidden(), true);
    assert.equal(await page.evaluate(() => document.activeElement.id),
      "mobileMoreButton",
      "Echap doit refermer « Plus » et rendre le focus au bouton qui l'a ouvert");

    /* Le tiroir a DEUX declencheurs. Le focus revient a celui qui a servi : le
       rendre toujours au premier renverrait le doigt en haut de l'ecran apres
       un geste au pouce. */
    await page.locator("#mobileMenuButton").click();
    await tiroir.waitFor({ state:"visible" });
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => document.activeElement.id),
      "mobileMenuButton",
      "ouvert par le menu du haut, « Plus » doit rendre le focus au menu du haut");

    /* Quitter le format mobile fait disparaitre les deux declencheurs : un
       tiroir laisse ouvert n'aurait plus aucun moyen d'etre ferme. */
    await plus.click();
    await tiroir.waitFor({ state:"visible" });
    await page.setViewportSize({ width:1024, height:780 });
    await page.waitForFunction(() =>
      document.querySelector("#mobileDrawer").hidden === true);
    assert.equal(await page.locator("#mobileMoreButton")
      .getAttribute("aria-expanded"), "false");
    await page.setViewportSize({ width:390, height:780 });
    assert.equal(await tiroir.isHidden(), true,
      "revenir en portrait ne doit pas rouvrir un ancien tiroir");

    /* ---- Le centre Boss et ses onglets locaux. ---- */
    await nav.getByRole("button", { name:"Boss" }).click();
    await page.locator("#view-boss").waitFor({ state:"visible" });
    assert.equal(await nav.getByRole("button", { name:"Boss" })
      .getAttribute("aria-current"), "page");
    const ongletsLocaux = page.locator("#localTabs button");
    assert.deepEqual(
      await ongletsLocaux.allTextContents()
        .then(items => items.map(item => item.trim())),
      ["Disponibilités", "Groupes et rapports"],
      "le centre Boss doit exposer ses deux sections");
    const cibles = await ongletsLocaux.evaluateAll(boutons =>
      boutons.map(bouton => bouton.getBoundingClientRect().height));
    cibles.forEach(hauteur => assert.ok(hauteur >= CIBLE_TACTILE_PX,
      "chaque onglet local doit conserver une cible de 44 px"));

    /* UN SEUL onglet local actif a la fois : la barre ne doit pas mentir sur
       l'endroit ou l'on se trouve. */
    await page.locator("#localTabs [data-view=\"availability\"]").click();
    await page.locator("#view-availability").waitFor({ state:"visible" });
    const actifs = await page.locator("#localTabs")
      .evaluate(node => [...node.querySelectorAll("button")]
        .filter(bouton => bouton.getAttribute("aria-selected") === "true")
        .map(bouton => bouton.textContent.trim()));
    assert.deepEqual(actifs, ["Disponibilités"],
      "un seul onglet local doit etre actif a la fois");
    assert.equal(
      await nav.getByRole("button", { name:"Boss" }).getAttribute("aria-current"),
      "page",
      "la RUBRIQUE, elle, reste surlignee dans toutes ses vues"
    );

    /* ---- L'en-tete mobile : compacte, et immobile au defilement. ---- */
    await allerA(page, "builder");
    const enteteAvant = await page.locator(".app-header").evaluate(node => ({
      hauteur:Math.round(node.getBoundingClientRect().height),
      position:getComputedStyle(node).position
    }));
    await page.evaluate(() => window.scrollTo({ top:500 }));
    await page.evaluate(() => new Promise(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    ));
    const enteteApres = await page.locator(".app-header").evaluate(node =>
      Math.round(node.getBoundingClientRect().height));
    assert.equal(enteteAvant.position, "relative",
      "l'identite mobile doit defiler avec la page, la navigation restant en bas");
    assert.equal(enteteApres, enteteAvant.hauteur,
      "l'en-tete mobile compacte ne doit pas changer de hauteur au defilement");

    /* ---- Dimensions, a trois largeurs. ---- */
    for(const width of [320, 360, 390]){
      await page.setViewportSize({ width, height:780 });
      const mesures = await page.evaluate(() => {
        const barre = document.querySelector(".mobile-nav");
        const zone = document.querySelector("main");
        const racine = document.scrollingElement;
        const boutons = [...barre.querySelectorAll("button:not([hidden])")];
        return {
          hauteurBarre:barre.getBoundingClientRect().height,
          margeBasse:parseFloat(getComputedStyle(zone).paddingBottom),
          ancrageBas:parseFloat(getComputedStyle(document.documentElement)
            .scrollPaddingBottom),
          debordement:racine.scrollWidth - racine.clientWidth,
          cibles:boutons.map(bouton => {
            const rect = bouton.getBoundingClientRect();
            return { width:rect.width, height:rect.height };
          })
        };
      });
      assert.ok(mesures.debordement <= 1,
        `la navigation ne doit pas elargir le document a ${width}px`);
      assert.ok(mesures.margeBasse >= mesures.hauteurBarre,
        `le contenu doit rester au-dessus de la barre a ${width}px`);
      assert.ok(mesures.ancrageBas >= mesures.hauteurBarre,
        `le focus ne doit pas etre masque par la barre a ${width}px`);
      mesures.cibles.forEach(cible => {
        assert.ok(cible.width >= CIBLE_TACTILE_PX && cible.height >= CIBLE_TACTILE_PX,
          `chaque destination doit mesurer au moins 44 px a ${width}px`);
      });
    }

    /* ---- Le visiteur : ce qu'il voit, et ce qu'on lui refuse. ---- */
    const contexteAnonyme = await browser.newContext({
      viewport:{ width:320, height:780 },
      isMobile:true,
      hasTouch:true,
      reducedMotion:"reduce"
    });
    const pageAnonyme = await contexteAnonyme.newPage();
    const erreursAnonymes = [];
    pageAnonyme.on("pageerror", error => erreursAnonymes.push(error.message));
    await installConnectedSupabase(pageAnonyme, false);
    await pageAnonyme.goto(server.url + "/index.html");
    await pageAnonyme.locator(".mobile-nav [data-rubrique=\"mon-roster\"]")
      .waitFor({ state:"hidden" });
    await pageAnonyme.getByRole("button", {
      name:"Continuer hors connexion", exact:true
    }).click();
    assert.deepEqual(
      await pageAnonyme.locator(".mobile-nav button:not([hidden])")
        .allTextContents().then(items => items.map(item => item.trim())),
      ["Accueil", "Équipes", "Plus"],
      "un visiteur ne doit voir que les destinations utilisables sans compte"
    );
    assert.equal(await pageAnonyme.locator("#view-home").isVisible(), true,
      "un visiteur doit atterrir sur l'accueil public");
    await pageAnonyme.locator("#mobileMoreButton").click();
    assert.equal(
      await pageAnonyme.locator("#mobileDrawer [data-view=\"analyse\"]").isHidden(),
      true,
      "Analyse ne doit pas etre proposee sans compte"
    );
    await pageAnonyme.locator("#mobileDrawer [data-action=\"compte\"]").click();
    assert.equal(await pageAnonyme.locator("#authOverlay").isVisible(), true,
      "« Mon compte » doit proposer la connexion a un visiteur");
    assert.deepEqual(erreursAnonymes, []);
    await contexteAnonyme.close();

    assert.deepEqual(errors, []);
    console.log("navigation mobile : barre au pouce, tiroir, focus et dimensions OK");
  }finally{
    await context.close();
    await browser.close();
    await server.close();
  }
})().catch(error=>{
  console.error(error);
  process.exitCode = 1;
});
