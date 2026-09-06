"use strict";

const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { serveRepo } = require("./helpers/serve");

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
