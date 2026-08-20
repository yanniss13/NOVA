"use strict";

const assert = require("node:assert/strict");
const { CIBLE_TACTILE_PX } = require("./helpers/cible-tactile");
const { chromium } = require("playwright");
const { serveRepo } = require("./helpers/serve");

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

    const nav = page.getByRole("navigation", {
      name:"Navigation principale mobile"
    });
    await nav.waitFor({ state:"visible" });
    const destinations = nav.locator("button:not([hidden])");
    assert.equal(await destinations.count(), 5,
      "un membre connecte doit garder cinq destinations principales au pouce");
    assert.deepEqual(
      await destinations.allTextContents().then(items => items.map(item => item.trim())),
      ["Accueil","Créer","Boss","Roster","Plus"]
    );

    assert.equal(await page.locator(".tabs-rail").isHidden(), true,
      "le rail horizontal ne doit plus doubler la navigation mobile");

    const plus = page.getByRole("button", { name:"Plus" });
    await plus.click();
    assert.equal(await plus.getAttribute("aria-expanded"), "true");
    const panel = page.getByRole("navigation", { name:"Plus" });
    await panel.waitFor({ state:"visible" });
    assert.equal(await panel.getByRole("button", { name:"Analyse" }).isVisible(), true);
    assert.equal(await panel.getByRole("button", { name:"Wiki" }).isVisible(), true);
    assert.equal(await panel.getByRole("button", { name:"Collection" }).isVisible(), true);
    assert.equal(await panel.getByRole("button", { name:"Calculateur" }).isVisible(), true);
    assert.match(await panel.textContent(), /Yannis/,
      "le compte courant doit etre identifiable dans Plus");

    await panel.getByRole("button", { name:"Wiki" }).click();
    await page.locator("#view-wiki").waitFor({ state:"visible" });
    assert.equal(await panel.isHidden(), true,
      "choisir une rubrique doit refermer Plus");
    assert.equal(await plus.getAttribute("aria-current"), "page",
      "Plus doit porter le contexte des rubriques secondaires");
    assert.equal(await page.evaluate(() => document.activeElement.id), "mobileNavMore",
      "une rubrique de Plus doit rendre le focus a son declencheur visible");

    await plus.click();
    await page.keyboard.press("Escape");
    assert.equal(await panel.isHidden(), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), "mobileNavMore",
      "Echap doit refermer Plus et restituer le focus");

    await plus.click();
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).overflow), "hidden",
      "Plus doit bloquer le defilement de la page sous son panneau");
    await page.locator("#mobileMoreBackdrop").click({ position:{x:2,y:2} });
    assert.equal(await panel.isHidden(), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), "mobileNavMore",
      "fermer Plus par son arriere-plan doit restituer le focus");

    await nav.getByRole("button", { name:"Créer" }).click();
    await page.locator("#view-builder").waitFor({ state:"visible" });
    await page.evaluate(() => window.scrollTo({ top:420 }));
    const readingPosition = await page.evaluate(() => Math.round(window.scrollY));
    assert.ok(readingPosition > 100, "le Builder doit etre defile avant le verrou");
    await plus.click();
    const lockedReading = await page.evaluate(() => ({
      position:getComputedStyle(document.body).position,
      top:parseFloat(document.body.style.top),
      scrollY:Math.round(window.scrollY)
    }));
    assert.equal(lockedReading.position, "fixed",
      "Plus doit figer le corps pour Safari iOS");
    assert.equal(Math.round(-lockedReading.top), readingPosition,
      "le verrou doit memoriser la position de lecture");
    await page.mouse.wheel(0, 500);
    assert.equal(
      await page.evaluate(() => parseFloat(document.body.style.top)),
      lockedReading.top,
      "la lecture sous Plus ne doit pas bouger"
    );
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => Math.round(window.scrollY)), readingPosition,
      "fermer Plus doit restituer la position de lecture");

    await plus.click();
    await page.setViewportSize({ width:700, height:780 });
    assert.equal(await panel.isHidden(), true,
      "quitter le breakpoint mobile doit normaliser le panneau Plus");
    /* Le CSS masque le panneau des le redimensionnement, mais aria-expanded
       est remis a jour par un ecouteur matchMedia, dans une tache ulterieure.
       Verifier aussitot gagnait la course en local et la perdait sur le
       runner. Attendre l'attribut ne masque rien : s'il ne changeait jamais,
       l'attente expirerait et le test echouerait tout autant. */
    await page.waitForFunction(() =>
      document.querySelector("#mobileNavMore").getAttribute("aria-expanded") === "false");
    assert.equal(await page.locator("#mobileNavMore").getAttribute("aria-expanded"), "false");
    await page.setViewportSize({ width:390, height:780 });
    assert.equal(await panel.isHidden(), true,
      "revenir en portrait ne doit pas rouvrir un ancien panneau");

    await nav.getByRole("button", { name:"Boss" }).click();
    await page.locator("#view-roster").waitFor({ state:"visible" });
    assert.equal(await nav.getByRole("button", { name:"Boss" })
      .getAttribute("aria-current"), "page");
    assert.equal(await page.locator("#mobileBossSubtabs").isVisible(), true,
      "les sous-vues du Boss restent disponibles dans leur vue");
    const bossDock = await page.locator("#mobileBossSubtabs").evaluate(node => {
      const rect = node.getBoundingClientRect();
      const nav = document.querySelector(".mobile-nav").getBoundingClientRect();
      return {
        top:rect.top,
        bottom:rect.bottom,
        navTop:nav.top,
        viewportHeight:innerHeight,
        targets:[...node.querySelectorAll("button")].map(button =>
          button.getBoundingClientRect().height
        )
      };
    });
    assert.ok(bossDock.top >= 0 && bossDock.bottom <= bossDock.navTop + 1,
      "le dock Boss doit rester entierement visible au-dessus de la barre");
    bossDock.targets.forEach(height => assert.ok(height >= CIBLE_TACTILE_PX,
      "chaque sous-vue Boss doit conserver une cible de 44 px"));

    await nav.getByRole("button", { name:"Créer" }).click();
    await page.locator("#view-builder").waitFor({ state:"visible" });
    const headerBeforeScroll = await page.locator(".topbar").evaluate(node => ({
      height:Math.round(node.getBoundingClientRect().height),
      position:getComputedStyle(node).position
    }));
    await page.evaluate(() => window.scrollTo({ top:500 }));
    await page.evaluate(() => new Promise(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    ));
    const headerAfterScroll = await page.locator(".topbar").evaluate(node => ({
      height:Math.round(node.getBoundingClientRect().height),
      retracted:node.classList.contains("is-retracted")
    }));
    assert.equal(headerBeforeScroll.position, "relative",
      "l'identite mobile doit defiler avec la page, la navigation restant en bas");
    assert.equal(headerAfterScroll.retracted, false,
      "le controleur de l'ancien header retractable doit etre inactif en portrait");
    assert.equal(headerAfterScroll.height, headerBeforeScroll.height,
      "le header mobile compact ne doit plus changer de hauteur au defilement");

    for(const width of [320,360,390]){
      await page.setViewportSize({ width, height:780 });
      const metrics = await page.evaluate(() => {
        const mobileNav = document.querySelector(".mobile-nav");
        const main = document.querySelector("main");
        const root = document.scrollingElement;
        const buttons = [...mobileNav.querySelectorAll("button:not([hidden])")];
        return {
          navHeight:mobileNav.getBoundingClientRect().height,
          bottomPadding:parseFloat(getComputedStyle(main).paddingBottom),
          scrollPaddingBottom:parseFloat(getComputedStyle(document.documentElement)
            .scrollPaddingBottom),
          overflow:root.scrollWidth-root.clientWidth,
          targets:buttons.map(button => {
            const rect = button.getBoundingClientRect();
            return { width:rect.width, height:rect.height };
          })
        };
      });
      assert.ok(metrics.overflow <= 1,
        `la navigation ne doit pas elargir le document a ${width}px`);
      assert.ok(metrics.bottomPadding >= metrics.navHeight,
        `le contenu doit rester au-dessus de la barre a ${width}px`);
      assert.ok(metrics.scrollPaddingBottom >= metrics.navHeight,
        `le focus ne doit pas etre masque par la barre a ${width}px`);
      metrics.targets.forEach(target => {
        assert.ok(target.width >= CIBLE_TACTILE_PX && target.height >= CIBLE_TACTILE_PX,
          `chaque destination doit mesurer au moins 44 px a ${width}px`);
      });
    }

    const anonymousContext = await browser.newContext({
      viewport:{ width:320, height:780 },
      isMobile:true,
      hasTouch:true,
      reducedMotion:"reduce"
    });
    const anonymousPage = await anonymousContext.newPage();
    const anonymousErrors = [];
    anonymousPage.on("pageerror", error => anonymousErrors.push(error.message));
    await installConnectedSupabase(anonymousPage, false);
    await anonymousPage.goto(server.url + "/index.html");
    await anonymousPage.locator("#mobileNavDashboard").waitFor({ state:"hidden" });
    await anonymousPage.getByRole("button", {
      name:"Continuer hors connexion",
      exact:true
    }).click();
    assert.deepEqual(
      await anonymousPage.locator(".mobile-nav button:not([hidden])")
        .allTextContents().then(items => items.map(item => item.trim())),
      ["Créer","Plus"],
      "un visiteur ne doit voir que les destinations utilisables sans compte"
    );
    assert.equal(await anonymousPage.locator("#view-wiki").isVisible(), true,
      "une vue privee initiale doit se replier sur le Wiki pour un visiteur");
    await anonymousPage.locator("#mobileNavMore").click();
    assert.equal(
      await anonymousPage.locator('[data-mobile-view="analyse"]').isHidden(),
      true,
      "Analyse ne doit pas etre proposee sans compte"
    );
    assert.equal(await anonymousPage.locator("#mobileAccountLogin").isVisible(), true);
    assert.deepEqual(anonymousErrors, []);
    await anonymousContext.close();

    assert.deepEqual(errors, []);
    console.log("navigation mobile : barre inferieure, Plus, focus et dimensions OK");
  }finally{
    await context.close();
    await browser.close();
    await server.close();
  }
})().catch(error=>{
  console.error(error);
  process.exitCode = 1;
});
