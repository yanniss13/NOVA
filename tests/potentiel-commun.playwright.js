"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

const STORAGE_KEY = "confrerie7ds.teams";

(async()=>{
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{ width:1440, height:1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  try{
    await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*", route =>
      route.fulfill({ status:200, contentType:"application/javascript", body:"" })
    );
    const url = pathToFileURL(path.resolve(__dirname, "..", "index.html")).href;
    await page.goto(url);
    await page.evaluate(key => localStorage.removeItem(key), STORAGE_KEY);
    await page.reload();

    const firstHero = page.locator(".hero").first();
    await firstHero.locator(".gear-slot.weapon").click();
    assert.equal(
      await page.locator("#overlay").evaluate(el => el.classList.contains("on")),
      false
    );
    assert.equal(await page.locator("#toast").textContent(), "Choisis d'abord un héros.");

    const linkedSlot = armorSlot(firstHero, "Armure liée");
    await linkedSlot.click();
    assert.equal(
      await page.locator("#overlay").evaluate(el => el.classList.contains("on")),
      false
    );
    assert.equal(await page.locator("#toast").textContent(), "Choisis d'abord un héros.");

    await chooseHero(page, firstHero, "Meliodas");
    await linkedSlot.click();
    assert.deepEqual(
      (await page.locator("#pickerGrid .tile:not(.none)").evaluateAll(nodes =>
        nodes.map(node => node.title).sort()
      )),
      ["Défense simple", "Majesté bien malveillante", "Une nouvelle aventure"].sort()
    );
    await page.locator("#pickerClose").click();

    await chooseArmor(page, firstHero, "Armure liée", "Une nouvelle aventure");
    await chooseHero(page, firstHero, "Merlin");
    assert.equal(await linkedSlot.evaluate(el => el.classList.contains("filled")), false);

    const topSlot = armorSlot(firstHero, "Haut");
    await topSlot.click();
    const expectedTopCount = await page.evaluate(
      () => window.SEVEN_DS_DATA.armures.Haut.length
    );
    assert.equal(
      await page.locator("#pickerGrid .tile:not(.none)").count(),
      expectedTopCount
    );
    await page.locator("#pickerClose").click();

    await chooseHero(page, firstHero, "Meliodas");
    await firstHero.locator(".gear-slot.weapon").click();
    assert.deepEqual(
      (await page.locator("#pickerChips .chip").allTextContents()).sort(),
      ["Epee a une main", "Epees doubles", "Hache", "Tous"].sort()
    );
    await page.locator("#pickerClose").click();

    await firstHero.locator(".pot-btn").click();
    await assertVisibleText(
      page.locator("#potBody .pot-empty"),
      "Équipe une arme compatible pour afficher les bonus de potentiel."
    );
    await page.locator("#potBody").getByRole("button", { name:"P5", exact:true }).click();
    assert.equal(await page.locator("#potBody .pot-head-val").textContent(), "P5/10");
    await page.locator("#potClose").click();
    assert.equal(await firstHero.locator(".pot-val").textContent(), "P5");

    await chooseWeapon(page, firstHero, "Hache");
    await firstHero.locator(".pot-btn").click();
    assert.equal(await page.locator("#potBody .pot-head-val").textContent(), "P5/10");
    assert.equal(await page.locator("#potBody .pot-item").count(), 10);
    const hacheT2 = await page.locator("#potBody .pot-item").nth(1).textContent();
    await page.locator("#potClose").click();

    await chooseWeapon(page, firstHero, "Epee a une main");
    await firstHero.locator(".pot-btn").click();
    assert.equal(await page.locator("#potBody .pot-head-val").textContent(), "P5/10");
    assert.equal(await page.locator("#potBody .pot-item").count(), 10);
    const epeeT2 = await page.locator("#potBody .pot-item").nth(1).textContent();
    assert.notEqual(epeeT2, hacheT2, "Les descriptions doivent suivre l'arme équipée");
    await page.locator("#potClose").click();

    const secondHero = page.locator(".hero").nth(1);
    await chooseHero(page, secondHero, "Meliodas");
    await chooseWeapon(page, secondHero, "Hache");
    assert.equal(await secondHero.locator(".gear-slot.weapon").evaluate(
      el => el.classList.contains("filled")
    ), true);
    await chooseHero(page, secondHero, "Merlin");
    assert.equal(await secondHero.locator(".gear-slot.weapon").evaluate(
      el => el.classList.contains("filled")
    ), false);

    await page.locator("#pseudo").fill("Test Playwright");
    await page.locator("#btnSave").click();
    assert.equal(
      await page.locator("#authOverlay").evaluate(el => el.classList.contains("on")),
      true,
      "Enregistrer hors connexion doit inviter à se connecter"
    );
    assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), null);
    await page.getByRole("button", { name:"Continuer hors connexion", exact:true }).click();

    await page.evaluate(({ key })=>{
      localStorage.setItem(key, JSON.stringify([{
        id:"ancienne-equipe",
        pseudo:"Ancien membre",
        heroes:[{
          char:"meliodas",
          weapon:"7ds-armes/Livre/grimoire-incompatible.webp",
          armor:{
            "Armure liee":"7ds-armures-ssr/Armure liee/Chercheuse de savoir.webp"
          },
          potentiel:{ weaponType:"Hache", tier:8 }
        }]
      }]));
    }, { key:STORAGE_KEY });
    await page.reload();
    await page.locator('.tab[data-view="roster"]').click();
    assert.match(await page.locator(".mini-pot").first().textContent(), /P8/);
    await page.getByRole("button", { name:"Modifier", exact:true }).click();
    assert.equal(await page.locator(".hero").first().locator(".gear-slot.weapon").evaluate(
      el => el.classList.contains("filled")
    ), false);
    assert.equal(await armorSlot(page.locator(".hero").first(), "Armure liée").evaluate(
      el => el.classList.contains("filled")
    ), false);
    await page.locator("#btnSave").click();
    assert.equal(
      await page.locator("#authOverlay").evaluate(el => el.classList.contains("on")),
      true
    );
    await page.getByRole("button", { name:"Continuer hors connexion", exact:true }).click();
    await page.locator('.tab[data-view="roster"]').click();
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name:"Supprimer", exact:true }).click();
    await page.waitForFunction(key => {
      const teams = JSON.parse(localStorage.getItem(key)||"[]");
      return teams.length === 0;
    }, STORAGE_KEY);
    assert.deepEqual(errors, []);

    console.log("PASS Playwright: potentiel commun, changement d'arme et migration");
  }finally{
    await browser.close();
  }
})().catch(error=>{
  console.error(error);
  process.exitCode = 1;
});

async function chooseWeapon(page, hero, group){
  await hero.locator(".gear-slot.weapon").click();
  await page.locator("#pickerChips").getByRole("button", { name:group, exact:true }).click();
  await page.locator("#pickerGrid .tile:not(.none)").first().click();
}

async function chooseHero(page, hero, name){
  await hero.locator(".portrait").click();
  await page.locator(`#pickerGrid .tile[title="${name}"]`).click();
}

function armorSlot(hero, label){
  return hero.locator(".gear-slot").filter({ hasText:label });
}

async function chooseArmor(page, hero, label, itemName){
  await armorSlot(hero, label).click();
  await page.locator(`#pickerGrid .tile[title="${itemName}"]`).click();
}

async function assertVisibleText(locator, expected){
  await locator.waitFor({ state:"visible" });
  assert.equal((await locator.textContent()).trim(), expected);
}
