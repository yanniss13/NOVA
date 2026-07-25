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
      if(localStorage.getItem(key) === null){
        localStorage.setItem(key, JSON.stringify([{
          id:"menu-test",
          name:"Test menu",
          dps:[
            { char:"merlin", element:"ICE", pot:5 },
            { char:"tristan", element:"FIRE", pot:3 },
            { char:"dreydrin", element:"EARTH", pot:2 },
            { char:"hendrickson", element:"HOLY", pot:1 }
          ]
        }]));
      }
    }, { key:REC_KEY });

    await page.goto(pathToFileURL(path.resolve(__dirname, "..", "index.html")).href);
    await page.locator('.tab[data-view="recensement"]').click();

    const triggers = page.locator(".dps-elem-trigger");
    assert.equal(await triggers.count(), 4);
    assert.equal(await page.locator(".dps-elem-sel select").count(), 0);

    const first = page.locator(".dps-row").filter({ hasText:"Merlin" })
      .locator(".dps-elem-trigger");
    const other = page.locator(".dps-row").filter({ hasText:"Tristan" })
      .locator(".dps-elem-trigger");
    const dreydrin = page.locator(".dps-row").filter({ hasText:"Dreydrin" })
      .locator(".dps-elem-trigger");
    const hendrickson = page.locator(".dps-row").filter({ hasText:"Hendrickson" })
      .locator(".dps-elem-trigger");
    const triggerFor = charId => ({
      merlin:first,
      tristan:other,
      dreydrin,
      hendrickson
    })[charId];
    const selectWithMouse = async(charId, label, element) => {
      const trigger = triggerFor(charId);
      await trigger.click();
      const menu = trigger.locator("xpath=following-sibling::span[@role='listbox']");
      await menu.getByRole("option", { name:label, exact:true }).click();
      assert.equal(await trigger.locator(".dps-elem-label").textContent(), label);
      await page.waitForFunction(({ key, charId, element }) => {
        const stored = JSON.parse(localStorage.getItem(key));
        return stored[0].dps.find(item => item.char === charId).element === element;
      }, { key:REC_KEY, charId, element });
    };
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
    await other.click();

    // Les quatre fixtures réelles couvrent les sept éléments via des clics souris.
    await selectWithMouse("merlin", "Glace", "ICE");
    await selectWithMouse("merlin", "Foudre", "THUNDER");
    await selectWithMouse("merlin", "Feu", "FIRE");
    await selectWithMouse("tristan", "Vent", "WIND");
    await selectWithMouse("dreydrin", "Terre", "EARTH");
    await selectWithMouse("dreydrin", "Lumière", "HOLY");
    await selectWithMouse("hendrickson", "Ténèbres", "DARK");

    // Ouverture depuis le déclencheur, puis navigation et sélection entièrement clavier.
    await first.focus();
    await first.press("ArrowDown");
    await firstMenu.waitFor({ state:"visible" });
    await page.locator(":focus").press("ArrowDown");
    await page.locator(":focus").press(" ");
    assert.equal(await first.locator(".dps-elem-label").textContent(), "Glace");
    await first.focus();
    await first.press("ArrowUp");
    await page.locator(":focus").press("ArrowUp");
    await page.locator(":focus").press("Enter");
    assert.equal(await first.locator(".dps-elem-label").textContent(), "Feu");
    await page.waitForFunction(key => {
      const stored = JSON.parse(localStorage.getItem(key));
      return stored[0].dps.find(item => item.char === "merlin").element === "FIRE";
    }, REC_KEY);

    await first.click();
    await firstMenu.getByRole("option", { name:"Feu", exact:true }).press("Escape");
    assert.equal(await first.getAttribute("aria-expanded"), "false");
    assert.equal(await first.evaluate(node => node === document.activeElement), true);

    await first.click();
    await page.locator(".rec-player-head").click();
    assert.equal(await first.getAttribute("aria-expanded"), "false");

    await page.setViewportSize({ width:390, height:844 });
    await first.click();
    await firstMenu.waitFor({ state:"visible" });
    const menuStyle = await firstMenu.evaluate(node => {
      const style = getComputedStyle(node);
      return {
        background:style.backgroundImage,
        border:style.borderTopColor,
        shadow:style.boxShadow
      };
    });
    assert.notEqual(menuStyle.background, "none");
    assert.equal(menuStyle.border, "rgb(169, 126, 44)");
    assert.notEqual(menuStyle.shadow, "none");

    const bounds = await firstMenu.boundingBox();
    assert.ok(bounds.x >= 0);
    assert.ok(bounds.x + bounds.width <= 390);

    await first.press("Escape");
    await page.emulateMedia({ reducedMotion:"reduce" });
    await first.click();
    const duration = await firstMenu.evaluate(node => getComputedStyle(node).animationDuration);
    assert.equal(duration, "0s");
    await first.press("Escape");

    await page.reload();
    await page.locator('.tab[data-view="recensement"]').click();
    const reloadedMerlin = page.locator(".dps-row").filter({ hasText:"Merlin" })
      .locator(".dps-elem-trigger");
    assert.equal(await reloadedMerlin.locator(".dps-elem-label").textContent(), "Feu");

    assert.deepEqual(errors, []);

    console.log("PASS Playwright: menu d’élément DPS accessible et persistant");
  }finally{
    await browser.close();
  }
})().catch(error=>{
  console.error(error);
  process.exitCode = 1;
});
