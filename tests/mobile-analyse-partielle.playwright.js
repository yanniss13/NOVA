"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

const REC_KEY = "confrerie7ds.recensement";

(async()=>{
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{ width:390, height:844 } });
  const errors = [];
  const navigations = [];
  const supabaseRequests = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("framenavigated", frame => { if(frame === page.mainFrame()) navigations.push(frame.url()); });
  page.on("request", request => {
    if(request.url().includes("supabase.co")) supabaseRequests.push(request.url());
  });

  try{
    await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*", route =>
      route.fulfill({ status:200, contentType:"application/javascript", body:"" })
    );
    await page.addInitScript(({ key }) => {
      if(localStorage.getItem(key) === null){
        localStorage.setItem(key, JSON.stringify([
          { id:"p1", name:"Akaaarix", dps:[
            { char:"merlin", element:"ICE", pot:10 },
            { char:"escanor", element:"FIRE", pot:8 },
            { char:"diane", element:"EARTH", pot:5 }
          ]},
          { id:"p2", name:"Membre au pseudo particulièrement long", dps:[
            { char:"escanor", element:"FIRE", pot:6 },
            { char:"elaine", element:"WIND", pot:9 }
          ]},
          { id:"p3", name:"Syval", dps:[
            { char:"meliodas", element:"DARK", pot:7 },
            { char:"merlin", element:"THUNDER", pot:4 }
          ]}
        ]));
      }
    }, { key:REC_KEY });

    await page.goto(pathToFileURL(path.resolve(__dirname, "..", "index.html")).href);

    // --- 1) Aucun débordement horizontal global à 320 / 360 / 390 px ---
    for(const width of [320, 360, 390]){
      await page.setViewportSize({ width, height:844 });
      for(const view of ["recensement", "analyse"]){
        await page.locator(`.tab[data-view="${view}"]`).click();
        await page.waitForTimeout(120);
        const overflow = await page.evaluate(() => {
          const root = document.scrollingElement;
          return root.scrollWidth - root.clientWidth;
        });
        assert.ok(
          overflow <= 1,
          `Débordement horizontal de ${overflow}px sur "${view}" à ${width}px`
        );
      }
    }

    // La matrice, elle, garde son défilement interne quand elle est plus large.
    const matrixScroll = await page.locator(".matrix-wrap").evaluate(node =>
      node.scrollWidth > node.clientWidth
    );
    assert.equal(matrixScroll, true, "La matrice doit rester défilable en interne");

    // --- 2) Filtre du classement : remplacement partiel, sans rechargement ---
    await page.setViewportSize({ width:1280, height:900 });
    await page.locator('.tab[data-view="analyse"]').click();
    await page.locator(".rank-box .rank-table").waitFor();

    // Marque les nœuds stables pour vérifier qu'ils ne sont pas reconstruits.
    await page.evaluate(() => {
      document.querySelector(".cov-row").dataset.marker = "stable";
      document.querySelector(".matrix-wrap").dataset.marker = "stable";
    });

    const activeBefore = await page.locator(".elem-chip.active").getAttribute("data-elem");
    const navCountBefore = navigations.length;
    const sbCountBefore = supabaseRequests.length;

    // Choisit un autre élément que l'actif (Ténèbres — Meliodas P7 de Syval).
    const darkChip = page.locator('.elem-chip[data-elem="DARK"]');
    assert.notEqual(activeBefore, "DARK");
    await darkChip.click();

    // aria-pressed reflète la sélection.
    assert.equal(await darkChip.getAttribute("aria-pressed"), "true");
    assert.equal(
      await page.locator(`.elem-chip[data-elem="${activeBefore}"]`).getAttribute("aria-pressed"),
      "false"
    );
    assert.equal(await page.locator('.elem-chip[aria-pressed="true"]').count(), 1);

    // Le tableau est remplacé et montre le filtre choisi.
    await page.locator(".rank-box .rank-row", { hasText:"Syval" }).waitFor();
    assert.match(
      await page.locator(".rank-box .rank-table").textContent(),
      /Meliodas/,
      "Le classement doit refléter l'élément choisi"
    );

    // Aucune navigation, aucune lecture Supabase, pas d'écran de chargement.
    assert.equal(navigations.length, navCountBefore, "Le clic ne doit pas naviguer");
    assert.equal(supabaseRequests.length, sbCountBefore, "Le clic ne doit pas relire Supabase");
    assert.equal(await page.locator("#analyseBody .empty-state").count(), 0);

    // Couverture et matrice : mêmes nœuds, toujours connectés.
    const markers = await page.evaluate(() => ({
      cov: document.querySelector(".cov-row")?.dataset.marker === "stable" &&
           document.querySelector(".cov-row").isConnected,
      matrix: document.querySelector(".matrix-wrap")?.dataset.marker === "stable" &&
              document.querySelector(".matrix-wrap").isConnected
    }));
    assert.equal(markers.cov, true, "La couverture ne doit pas être reconstruite");
    assert.equal(markers.matrix, true, "La matrice ne doit pas être reconstruite");

    assert.deepEqual(errors, []);
    console.log("PASS Playwright: pas de débordement mobile, filtre d'analyse partiel");
  }finally{
    await browser.close();
  }
})().catch(error=>{
  console.error(error);
  process.exitCode = 1;
});
