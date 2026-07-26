"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

(async()=>{
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{width:1280,height:900} });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  try{
    await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*", route =>
      route.fulfill({
        status:200,
        contentType:"application/javascript",
        body:"window.supabase=undefined;"
      })
    );
    await page.goto(pathToFileURL(path.resolve(__dirname, "..", "index.html")).href);
    const tabs = page.getByRole("tab");
    assert.equal(await tabs.count(), 6);
    assert.equal(await tabs.nth(0).getAttribute("aria-selected"), "true");
    assert.equal(await tabs.nth(0).getAttribute("tabindex"), "0");
    assert.equal(await tabs.nth(1).getAttribute("aria-selected"), "false");
    assert.equal(await tabs.nth(1).getAttribute("tabindex"), "-1");

    await tabs.nth(0).focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await tabs.nth(1).getAttribute("aria-selected"), "true");
    assert.equal(await page.locator("#view-roster").isVisible(), true);

    await page.keyboard.press("End");
    assert.equal(await tabs.nth(5).getAttribute("aria-selected"), "true");
    assert.equal(await page.locator("#view-boss").isVisible(), true);

    await page.keyboard.press("Home");
    assert.equal(await tabs.nth(0).getAttribute("aria-selected"), "true");
    assert.equal(await page.locator("#view-builder").isVisible(), true);

    const login = page.locator("#accountLogin");
    await login.focus();
    await login.click();
    await page.locator("#authOverlay").waitFor({state:"visible"});
    await page.waitForFunction(() => document.activeElement.id === "authEmail");
    await page.keyboard.press("Escape");
    await page.locator("#authOverlay").waitFor({state:"hidden"});
    await page.waitForFunction(() => document.activeElement.id === "accountLogin");
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "accountLogin"
    );

    const portrait = page.locator(".hero .portrait").first();
    await portrait.click();
    await page.locator("#overlay").waitFor({state:"visible"});
    await page.locator("#pickerClose").focus();
    await page.keyboard.press("Shift+Tab");
    assert.equal(
      await page.evaluate(() =>
        document.querySelector("#overlay").contains(document.activeElement)
      ),
      true
    );
    await page.keyboard.press("Escape");
    await page.locator("#overlay").waitFor({state:"hidden"});
    await page.waitForFunction(() =>
      document.querySelector(".hero .portrait") === document.activeElement
    );
    assert.equal(
      await portrait.evaluate(node => node === document.activeElement),
      true
    );

    const mobileContext = await browser.newContext({
      viewport:{width:390,height:844},
      isMobile:true,
      hasTouch:true,
      reducedMotion:"reduce"
    });
    const mobile = await mobileContext.newPage();
    await mobile.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*", route =>
      route.fulfill({
        status:200,
        contentType:"application/javascript",
        body:"window.supabase=undefined;"
      })
    );
    await mobile.goto(pathToFileURL(path.resolve(__dirname, "..", "index.html")).href);

    assert.equal(await mobile.locator("#toast").getAttribute("role"), "status");
    assert.equal(await mobile.locator("#toast").getAttribute("aria-live"), "polite");

    for(const selector of [".tab", ".btn"]){
      const box = await mobile.locator(selector).first().boundingBox();
      assert.ok(box && box.height >= 44, selector+" doit mesurer au moins 44 px");
    }

    await mobile.locator(".hero .portrait").first().click();
    await mobile.locator('#pickerGrid .tile[title="Meliodas"]').click();
    const gearBox = await mobile.locator(".hero .gear-slot.weapon")
      .first().boundingBox();
    assert.ok(gearBox && gearBox.height >= 44, ".gear-slot doit mesurer 44 px");
    await mobile.locator(".hero .gear-slot.weapon").first().click();
    await mobile.locator("#overlay").waitFor({state:"visible"});
    for(const selector of [".icon-btn", ".chip"]){
      const box = await mobile.locator(selector).first().boundingBox();
      assert.ok(box && box.height >= 44, selector+" doit mesurer au moins 44 px");
      assert.ok(box.width >= 44, selector+" doit mesurer au moins 44 px de large");
    }
    const compactChipWidth = await mobile.evaluate(() => {
      const chip = document.createElement("button");
      chip.className = "chip";
      chip.textContent = "T0";
      document.body.appendChild(chip);
      const width = chip.getBoundingClientRect().width;
      chip.remove();
      return width;
    });
    assert.ok(
      compactChipWidth >= 44,
      ".chip compacte doit mesurer au moins 44 px de large"
    );
    await mobile.keyboard.press("Escape");

    for(const name of [
      "builder", "roster", "member-roster",
      "recensement", "analyse", "boss"
    ]){
      await mobile.locator('.tab[data-view="'+name+'"]').click();
      await mobile.waitForTimeout(50);
      const overflow = await mobile.evaluate(() =>
        document.scrollingElement.scrollWidth -
        document.scrollingElement.clientWidth
      );
      assert.ok(overflow <= 1, "Débordement "+name+" : "+overflow+"px");
    }

    const motion = await mobile.locator(".view.active").evaluate(node => ({
      animationName:getComputedStyle(node).animationName,
      animationDuration:getComputedStyle(node).animationDuration
    }));
    assert.ok(
      motion.animationName === "none" || motion.animationDuration === "0s",
      "Les animations doivent être neutralisées"
    );
    await mobileContext.close();

    assert.deepStrictEqual(errors, []);
    console.log("PASS accessibilité : onglets, modales et mobile");
  }finally{
    await browser.close();
  }
})().catch(error=>{
  console.error(error);
  process.exitCode = 1;
});
