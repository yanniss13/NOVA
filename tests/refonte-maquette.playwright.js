"use strict";

const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { serveRepo } = require("./helpers/serve");

async function openRoute(page, route){
  await page.evaluate(value => {
    history.pushState(null, "", "#" + value);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, route);
  await page.locator(`[data-view="${route}"]:not([hidden])`).waitFor();
}

(async () => {
  const server = await serveRepo();
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{ width:1440, height:1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  try{
    await page.goto(server.url + "/docs/refonte-maquette/index.html");
    await page.getByRole("button", { name:"Organiser une session" }).click();
    await page.locator('[data-view="boss"]:not([hidden])').waitFor();
    assert.equal(await page.evaluate(() => location.hash), "#boss");

    await page.goBack();
    await page.locator('[data-view="home"]:not([hidden])').waitFor();
    await page.getByRole("button", { name:"Connexion", exact:true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    assert.equal(await dialog.getAttribute("aria-modal"), "true");
    await page.getByRole("button", { name:"Entrer en mode membre" }).click();
    assert.equal(await page.locator("body").getAttribute("data-session"), "member");
    await page.getByRole("button", { name:/YanniSs13/ }).waitFor();

    await page.getByText("Équipe manquante", { exact:true }).waitFor();
    await page.getByRole("button", { name:"Ouvrir le groupe" }).click();
    await page.locator('[data-view="boss"]:not([hidden])').waitFor();
    for(const label of ["Équipes", "Disponibilités", "Groupes", "Rapports"]){
      await page.getByRole("tab", { name:label, exact:true }).click();
      await page.locator('[data-boss-panel]:not([hidden])').waitFor();
    }
    await page.getByText("Score global", { exact:true }).waitFor();

    const destinations = [
      ["teams", "Composer une équipe"],
      ["roster", "Mon roster"],
      ["tools", "Les outils de la confrérie"],
      ["admin", "Comptes invités"]
    ];
    for(const [route, text] of destinations){
      await openRoute(page, route);
      await page.getByRole("heading", { name:text, exact:true }).waitFor();
    }
    await openRoute(page, "tools");
    for(const [label,id] of [
      ["Wiki","wiki"], ["Collection","collection"],
      ["Calculateur","calculator"], ["Analyse","analysis"]
    ]){
      await page.getByRole("tab", { name:label, exact:true }).click();
      await page.locator(`[data-tool-panel="${id}"]:not([hidden])`).waitFor();
    }

    for(const viewport of [
      { width:1440, height:1000 }, { width:1024, height:900 },
      { width:390, height:844 }, { width:320, height:700 }
    ]){
      await page.setViewportSize(viewport);
      await page.goto(server.url + "/docs/refonte-maquette/index.html#home");
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 1,
        `débordement ${viewport.width}px : ${overflow}px`);
    }

    await page.setViewportSize({ width:320, height:700 });
    for(const route of ["dashboard", "teams", "boss", "roster", "tools", "admin"]){
      await openRoute(page, route);
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 1, `débordement mobile de ${route} : ${overflow}px`);
    }

    await openRoute(page, "home");
    await page.locator("#mobileMenuButton").focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#mobileMenuButton").getAttribute("aria-expanded"), "true");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#mobileMenuButton").getAttribute("aria-expanded"), "false");

    const petitesCibles = await page.locator("button:visible").evaluateAll(buttons =>
      buttons.map(button => {
        const box = button.getBoundingClientRect();
        return { name:button.textContent.trim(), width:box.width, height:box.height };
      }).filter(box => box.width < 44 || box.height < 44));
    assert.deepEqual(petitesCibles, [],
      "cibles tactiles trop petites : " + JSON.stringify(petitesCibles));

    await page.setViewportSize({ width:1440, height:1000 });
    await page.goto(server.url + "/docs/refonte-maquette/index.html#home");
    const loginButton = page.locator(".account-button");
    await loginButton.focus();
    await loginButton.click();
    await page.getByRole("button", { name:"Fermer", exact:true }).last().click();
    assert.equal(await loginButton.evaluate(element => element === document.activeElement), true,
      "la modale doit rendre le focus au bouton Connexion");
    const imagesBrisees = await page.locator("img").evaluateAll(images =>
      images.filter(image => !image.complete || image.naturalWidth === 0)
        .map(image => image.getAttribute("src")));
    assert.deepEqual(imagesBrisees, [],
      "images introuvables : " + imagesBrisees.join(", "));

    if(process.env.NOVA_CAPTURE === "1"){
      if((await loginButton.textContent()).includes("YanniSs13")){
        await loginButton.click();
        await page.getByRole("button", { name:"Se déconnecter" }).click();
      }
      await page.locator("body").click({ position:{ x:1, y:1 } });
      await page.screenshot({ path:"apercu-refonte-desktop.png", fullPage:true });
      await page.setViewportSize({ width:390, height:844 });
      await page.reload();
      await page.screenshot({ path:"apercu-refonte-mobile.png", fullPage:true });
      await page.setViewportSize({ width:1440, height:1000 });
      await page.goto(server.url + "/docs/refonte-maquette/index.html#boss");
      await page.locator("body").click({ position:{ x:1, y:1 } });
      await page.screenshot({ path:"apercu-refonte-boss.png", fullPage:true });
    }

    assert.deepEqual(errors, [], "erreurs navigateur : " + errors.join(" | "));
    console.log("refonte-maquette.playwright.js navigation OK");
  }finally{
    await browser.close();
    await server.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
