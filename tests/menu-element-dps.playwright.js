"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

const REC_KEY = "confrerie7ds.recensement";

(async()=>{
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{ width:1280, height:900 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  try{
    await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*", route =>
      route.fulfill({ status:200, contentType:"application/javascript", body:"" })
    );
    await page.addInitScript(({ key }) => {
      localStorage.setItem(key, JSON.stringify([{
        id:"menu-test",
        name:"Test menu",
        dps:[
          { char:"merlin", element:"ICE", pot:5 },
          { char:"tristan", element:"FIRE", pot:3 }
        ]
      }]));
    }, { key:REC_KEY });

    await page.goto(pathToFileURL(path.resolve(__dirname, "..", "index.html")).href);
    await page.locator('.tab[data-view="recensement"]').click();

    const triggers = page.locator(".dps-elem-trigger");
    assert.equal(await triggers.count(), 2);
    assert.equal(await page.locator(".dps-elem-sel select").count(), 0);

    const first = page.locator(".dps-row").filter({ hasText:"Merlin" })
      .locator(".dps-elem-trigger");
    const other = page.locator(".dps-row").filter({ hasText:"Tristan" })
      .locator(".dps-elem-trigger");
    assert.equal(await first.getAttribute("aria-haspopup"), "listbox");
    assert.equal(await first.getAttribute("aria-expanded"), "false");
    await first.click();
    assert.equal(await first.getAttribute("aria-expanded"), "true");

    const firstMenu = page.locator(".dps-row").filter({ hasText:"Merlin" })
      .locator(".dps-elem-menu");
    await firstMenu.waitFor({ state:"visible" });
    assert.equal(await firstMenu.getByRole("option").count(), 3);
    assert.equal(
      await firstMenu.getByRole("option", { name:"Glace", exact:true })
        .getAttribute("aria-selected"),
      "true"
    );

    await other.click();
    assert.equal(await page.locator(".dps-elem-menu:visible").count(), 1);
    assert.equal(await first.getAttribute("aria-expanded"), "false");

    await first.click();
    await firstMenu.getByRole("option", { name:"Glace", exact:true }).press("ArrowDown");
    await page.locator(":focus").press("Enter");
    assert.equal(await first.locator(".dps-elem-label").textContent(), "Foudre");
    await page.waitForFunction(key => {
      const stored = JSON.parse(localStorage.getItem(key));
      return stored[0].dps.find(item => item.char === "merlin").element === "THUNDER";
    }, REC_KEY);

    await first.click();
    await firstMenu.getByRole("option", { name:"Foudre", exact:true }).press("Escape");
    assert.equal(await first.getAttribute("aria-expanded"), "false");
    assert.equal(await first.evaluate(node => node === document.activeElement), true);

    await first.click();
    await page.locator(".rec-player-head").click();
    assert.equal(await first.getAttribute("aria-expanded"), "false");
    assert.deepEqual(errors, []);

    console.log("PASS Playwright: menu d’élément DPS accessible et persistant");
  }finally{
    await browser.close();
  }
})().catch(error=>{
  console.error(error);
  process.exitCode = 1;
});
