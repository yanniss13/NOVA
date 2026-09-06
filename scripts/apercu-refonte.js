"use strict";

/* Captures de la nouvelle coquille, pour la relire a l'oeil.

   Usage : node scripts/apercu-refonte.js
   Les images sortent dans docs/apercus-refonte/. */

const fs = require("node:fs");
const path = require("node:path");
const { serveRepo } = require("../tests/helpers/serve");
const { allerA } = require("../tests/helpers/naviguer");
const { chromium } = require("playwright");

const SORTIE = path.join(__dirname, "..", "docs", "apercus-refonte");

const ECRANS = [
  { nom:"accueil", vue:null },
  { nom:"wiki", vue:"wiki" },
  { nom:"builder", vue:"builder" },
  { nom:"calculateur", vue:"calculateur" }
];

const FORMATS = [
  { nom:"bureau", width:1440, height:1000 },
  { nom:"telephone", width:390, height:844 }
];

(async()=>{
  fs.mkdirSync(SORTIE, { recursive:true });
  const server = await serveRepo();
  const browser = await chromium.launch({ headless:true });
  try{
    for(const format of FORMATS){
      const page = await browser.newPage({
        viewport:{ width:format.width, height:format.height }
      });
      /* Sans client Supabase, aucune vue n'est fermee et aucune modale de
         connexion ne s'ouvre : on voit la mise en page, pas un ecran de login. */
      await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*",
        route => route.fulfill({
          status:200, contentType:"application/javascript",
          body:"window.supabase=undefined;"
        }));
      await page.goto(server.url + "/index.html");
      for(const ecran of ECRANS){
        if(ecran.vue) await allerA(page, ecran.vue);
        await page.waitForTimeout(500);
        const fichier = path.join(SORTIE, `${ecran.nom}-${format.nom}.png`);
        await page.screenshot({ path:fichier, fullPage:ecran.nom === "accueil" });
        console.log("  " + path.relative(process.cwd(), fichier));
      }
      await page.close();
    }
  }finally{
    await browser.close();
    await server.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
