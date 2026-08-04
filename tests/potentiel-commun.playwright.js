"use strict";

const assert = require("node:assert/strict");
const { serveRepo } = require("./helpers/serve");
const { chromium } = require("playwright");

const STORAGE_KEY = "confrerie7ds.teams";

(async()=>{
  const server = await serveRepo();
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{ width:1440, height:1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  try{
    await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*", route =>
      route.fulfill({ status:200, contentType:"application/javascript", body:"" })
    );
    await page.goto(server.url + "/index.html");
    await page.evaluate(key => localStorage.removeItem(key), STORAGE_KEY);
    await page.reload();

    /* L'arrivee se fait sur l'accueil : le Builder demande un clic explicite.
       Ce test parle du potentiel commun, pas de la vue de depart. */
    await page.locator("#tab-builder").click();
    await page.locator("#view-builder").waitFor({ state:"visible" });

    const firstHero = page.locator(".hero").first();
    assert.doesNotMatch(
      await firstHero.locator(".note").getAttribute("placeholder"),
      /\bT(?:[0-9]|10)\b/,
      "aucun exemple visible ne doit employer l’ancien préfixe T"
    );
    await firstHero.locator(".gear-slot.weapon").click();
    assert.equal(
      await page.locator("#overlay").evaluate(el => el.classList.contains("on")),
      false
    );
    assert.equal(await page.locator("#toast").textContent(), "Choisis d'abord un héros.");

    const linkedSlot = armorSlot(firstHero, "Armure gravée");
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

    await chooseArmor(page, firstHero, "Armure gravée", "Une nouvelle aventure");
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
    await chooseArmor(
      page,
      firstHero,
      "Bas",
      "Bas de la puissance retorse"
    );
    let passiveConfigButton = firstHero.locator(
      '.gear-configurable-slot[data-slot="Bas"] .gear-config-open'
    );
    await passiveConfigButton.click();
    assert.deepEqual(
      await page.locator(".gear-config-passive-level option").allTextContents(),
      ["À renseigner","1","2","3"]
    );
    await page.locator(".gear-config-passive-level").selectOption("2");
    await page.locator("#gearConfigSave").click();
    passiveConfigButton = firstHero.locator(
      '.gear-configurable-slot[data-slot="Bas"] .gear-config-open'
    );
    await passiveConfigButton.click();
    assert.equal(
      await page.locator(".gear-config-passive-level").inputValue(),
      "2"
    );
    await page.locator("#gearConfigCancel").click();

    await firstHero.locator(".gear-slot.weapon").click();
    assert.deepEqual(
      (await page.locator("#pickerChips .chip").allTextContents()).sort(),
      ["Epee a une main", "Epees doubles", "Hache", "Tous"].sort()
    );
    await page.locator("#pickerClose").click();

    await firstHero.locator(".pot-btn").click();
    assert.deepEqual(
      await page.locator("#potBody .pot-paliers button").allTextContents(),
      ["P0","P1","P2","P3","P4","P5","P6","P7","P8","P9","P10"],
      "tous les paliers visibles utilisent P, jamais T"
    );
    await assertVisibleText(
      page.locator("#potBody .pot-empty"),
      "Équipe une arme compatible pour afficher les bonus de potentiel."
    );
    await page.locator("#potBody").getByRole("button", { name:"P5", exact:true }).click();
    assert.equal(await page.locator("#potBody .pot-head-val").textContent(), "P5/10");
    await page.locator("#potClose").click();
    assert.equal(await firstHero.locator(".pot-val").textContent(), "P5");

    await chooseWeapon(
      page,
      firstHero,
      "Epee a une main",
      "Épée longue usée"
    );
    await assertVisibleText(
      firstHero.locator(".weapon-config-summary"),
      "Données chiffrées indisponibles"
    );
    assert.equal(
      await firstHero.locator(".weapon-config-open").isDisabled(),
      true,
      "Une variante sans courbes natives ne doit pas ouvrir un calcul à zéro"
    );

    await chooseWeapon(
      page,
      firstHero,
      "Hache",
      "Hache de l'âme vorace"
    );
    await firstHero.locator(".pot-btn").click();
    assert.equal(await page.locator("#potBody .pot-head-val").textContent(), "P5/10");
    assert.equal(await page.locator("#potBody .pot-item").count(), 10);
    const hacheT2 = await page.locator("#potBody .pot-item").nth(1).textContent();
    await page.locator("#potClose").click();

    const configButton = firstHero.locator(".weapon-config-open");
    await assertVisibleText(
      firstHero.locator(".weapon-config-summary"),
      "Configuration à compléter"
    );
    await configButton.click();
    await page.locator("#weaponConfigOverlay").waitFor({ state:"visible" });
    await page.locator(".weapon-config-level").fill("999");
    await page.locator("#weaponConfigCancel").click();
    assert.equal(
      (await firstHero.locator(".weapon-config-summary").textContent()).trim(),
      "Configuration à compléter"
    );
    assert.equal(
      await page.evaluate(() => document.activeElement.classList.contains("weapon-config-open")),
      true,
      "Annuler doit rendre le focus au contrôle exact"
    );

    await configButton.click();
    await page.locator("#weaponConfigOverlay").waitFor({ state:"visible" });
    assert.equal(await page.locator(".weapon-config-level").inputValue(), "0");
    await page.locator(".weapon-config-grade").selectOption({ index:0 });
    await page.locator(".weapon-config-level").fill("999");
    await page.locator("#weaponConfigSave").click();
    assert.equal(
      await page.locator("#weaponConfigOverlay").getAttribute("aria-hidden"),
      "false",
      "Une configuration invalide ne doit pas être enregistrée"
    );
    assert.equal(
      await page.evaluate(() => document.activeElement.classList.contains("weapon-config-level")),
      true,
      "Le premier champ invalide doit recevoir le focus"
    );
    await page.locator(".weapon-config-level").fill("0");
    await page.locator(".weapon-config-enchantment-choice").selectOption("5");
    await page.locator("#weaponConfigSave").click();
    assert.equal(
      await page.evaluate(() =>
        document.activeElement.classList.contains("weapon-config-enchantment-element")
      ),
      true,
      "Un palier 5 incomplet doit diriger vers le choix d’élément"
    );
    await page.locator(".weapon-config-promotion").selectOption("0");
    await page.locator(".weapon-config-overlimit").selectOption("0");
    for(const select of await page.locator(".weapon-config-enchantment-choice").all()){
      await select.selectOption("none");
    }
    await assertVisibleText(
      page.locator("#weaponConfigPreview .weapon-stats-title"),
      "Apport de l’arme hors passif — borne inférieure"
    );
    const partialPreview = await page.locator("#weaponConfigPreview").textContent();
    assert.doesNotMatch(partialPreview.toLowerCase(), /stats du héros|total du héros/);
    const weaponConfigText = await page.locator("#weaponConfigOverlay").textContent();
    assert.match(weaponConfigText, /Promotion/);
    assert.doesNotMatch(weaponConfigText, /Renforcement/);

    for(const width of [320, 360, 390]){
      await page.setViewportSize({ width, height:844 });
      const mobileMetrics = await page.locator("#weaponConfigOverlay").evaluate(overlay => ({
        documentWidth:document.documentElement.scrollWidth,
        viewportWidth:window.innerWidth,
        overlayWidth:overlay.scrollWidth,
        columns:getComputedStyle(
          overlay.querySelector(".weapon-config-layout")
        ).gridTemplateColumns
      }));
      assert.ok(
        mobileMetrics.documentWidth <= mobileMetrics.viewportWidth,
        "Le document ne doit pas déborder à "+width+" px"
      );
      assert.ok(
        mobileMetrics.overlayWidth <= mobileMetrics.viewportWidth,
        "La modale ne doit pas déborder à "+width+" px"
      );
      assert.equal(mobileMetrics.columns.split(" ").length, 1);
    }
    await page.setViewportSize({ width:1440, height:1000 });

    await page.locator("#weaponConfigSave").click();
    assert.match(
      (await firstHero.locator(".weapon-config-summary").textContent()).trim(),
      /^Configurée/
    );
    assert.equal(
      await page.evaluate(() => document.activeElement.classList.contains("weapon-config-open")),
      true,
      "Valider doit rendre le focus au contrôle reconstruit"
    );

    await configButton.click();
    await page.locator(".weapon-config-promotion").selectOption("1");
    await page.locator("#weaponConfigPreview details")
      .filter({ hasText:"Promotion" }).first().locator("summary").click();
    await assertVisibleText(
      page.locator("#weaponConfigPreview .weapon-stat-term")
        .filter({ hasText:"Promotion" }).first().locator("span").first(),
      "Promotion"
    );
    await page.locator(".weapon-config-overlimit").selectOption("1");
    await page.locator("#weaponConfigPreview details")
      .filter({ hasText:"Outrepassement" }).first().locator("summary").click();
    await assertVisibleText(
      page.locator("#weaponConfigPreview .weapon-stat-term-overlimit").first(),
      "Outrepassement ×1,05 — base présumée"
    );
    await page.locator("#weaponConfigSave").click();

    await configButton.click();
    page.once("dialog", dialog => dialog.accept());
    await page.locator("#weaponConfigReset").click();
    await assertVisibleText(
      firstHero.locator(".weapon-config-summary"),
      "Configuration à compléter"
    );
    assert.equal(
      await page.evaluate(() => document.activeElement.classList.contains("weapon-config-open")),
      true,
      "Réinitialiser doit rendre le focus au contrôle reconstruit"
    );

    await configButton.click();
    await page.locator(".weapon-config-level").fill("0");
    await page.locator(".weapon-config-promotion").selectOption("0");
    await page.locator(".weapon-config-overlimit").selectOption("0");
    await page.locator(".weapon-config-enchantment-choice").selectOption("none");
    await page.locator("#weaponConfigSave").click();

    // Saisie d'une pièce d'équipement, de bout en bout.
    await chooseArmor(
      page,
      firstHero,
      "Haut",
      "Haut de la mélodie d'Arachnée"
    );
    const gearConfigButton = firstHero.locator(
      '.gear-config-open[data-slot="Haut"]'
    );
    assert.equal(
      await gearConfigButton.count(),
      1,
      "Chaque pièce équipée doit proposer un bouton de configuration"
    );
    await gearConfigButton.click();
    await page.locator("#gearConfigOverlay").waitFor({ state:"visible" });

    const gearLevelInput = page.locator(".gear-config-level");
    const gearMinimum = Number(await gearLevelInput.getAttribute("min"));
    const gearMaximum = Number(await gearLevelInput.getAttribute("max"));
    assert.ok(
      gearMaximum > gearMinimum,
      "Les bornes de qualité doivent venir de la pièce"
    );
    await gearLevelInput.fill(String(gearMaximum));
    await page.locator(".gear-config-reinforce").selectOption("5");
    await page.locator("#gearConfigPreview .weapon-stats-family").first()
      .waitFor({ state:"visible" });
    const gearPreview = await page.locator("#gearConfigPreview").innerText();
    assert.match(
      gearPreview,
      /calcul partiel/,
      "Le total d'une pièce sans passif doit rester annoncé comme partiel"
    );
    assert.match(gearPreview, /\d/, "La contribution doit afficher des chiffres");
    assert.doesNotMatch(
      gearPreview.toLowerCase(),
      /stats du héros|total du héros/
    );

    await gearLevelInput.fill(String(gearMaximum + 1));
    await page.locator("#gearConfigSave").click();
    assert.equal(
      await page.locator("#gearConfigOverlay").getAttribute("aria-hidden"),
      "false",
      "Une configuration invalide ne doit pas être enregistrée"
    );
    assert.equal(
      await page.evaluate(() =>
        document.activeElement.classList.contains("gear-config-level")
      ),
      true,
      "Le premier champ invalide doit recevoir le focus"
    );
    await gearLevelInput.fill(String(gearMaximum));
    await page.locator("#gearConfigSave").click();
    await page.locator("#gearConfigOverlay").waitFor({ state:"hidden" });
    assert.equal(
      await page.evaluate(() =>
        document.activeElement.classList.contains("gear-config-open")
      ),
      true,
      "Fermer doit rendre le focus au bouton exact qui a ouvert"
    );
    await chooseArmor(
      page,
      firstHero,
      "Haut",
      "Haut de l'araignée de l'ombre"
    );
    assert.equal(
      (await firstHero.locator(
        '.gear-config-open[data-slot="Haut"]'
      ).textContent()).trim(),
      "Configurer",
      "Changer de pièce doit effacer sa configuration précédente"
    );

    page.once("dialog", dialog => dialog.accept());
    await chooseWeapon(page, firstHero, "Hache", "Hache bénie");
    await assertVisibleText(
      firstHero.locator(".weapon-config-summary"),
      "Configuration à compléter"
    );

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

    await page.evaluate(key => {
      const catalog = window.SEVEN_DS_BUILD_STATS;
      const firstCatalogFile = (items, definitions) => {
        const match = (items || []).find(item => definitions[item.file]);
        if(!match) throw new Error("FIXTURE_EQUIPMENT_MISSING");
        return match.file;
      };
      let weapon = null;
      let grade = null;
      for(const item of window.SEVEN_DS_DATA.armes.Hache){
        const definition = catalog.weaponsByFile[item.file];
        const candidate = definition
          && Object.values(definition.gradesByGameId).find(value =>
            value.mainStatValues
            && value.promotionValues
            && value.enchantments
            && value.enchantments.type === "basic"
          );
        if(candidate){
          weapon = item.file;
          grade = candidate;
          break;
        }
      }
      if(!weapon || !grade){
        throw new Error("FIXTURE_WEAPON_GRADE_MISSING");
      }
      const configFor = file => {
        const definition = catalog.gearByFile[file]
          || catalog.engravedByFile[file];
        if(!definition) throw new Error("FIXTURE_GEAR_MISSING:"+file);
        return {
          version:1,
          level:definition.qualityMin,
          reinforce:0,
          enchantments:Array(
            definition.randomOptions
              ? definition.randomOptions.slots : 0
          ).fill(null),
          passiveLevel:null
        };
      };
      const armor = {
        Haut:firstCatalogFile(
          window.SEVEN_DS_DATA.armures.Haut,
          catalog.gearByFile
        ),
        Bas:firstCatalogFile(
          window.SEVEN_DS_DATA.armures.Bas,
          catalog.gearByFile
        ),
        Bottes:firstCatalogFile(
          window.SEVEN_DS_DATA.armures.Bottes,
          catalog.gearByFile
        ),
        Ceinture:firstCatalogFile(
          window.SEVEN_DS_DATA.armures.Ceinture,
          catalog.gearByFile
        ),
        "Armure liee":(
          window.SEVEN_DS_ARMURES_LIEES.meliodas || []
        ).find(file => catalog.engravedByFile[file])
      };
      if(!armor["Armure liee"]){
        throw new Error("FIXTURE_ENGRAVING_MISSING");
      }
      const jewel = {
        Anneau:firstCatalogFile(
          window.SEVEN_DS_DATA.bijoux.Anneau,
          catalog.gearByFile
        ),
        Collier:firstCatalogFile(
          window.SEVEN_DS_DATA.bijoux.Collier,
          catalog.gearByFile
        ),
        "Boucle d'oreille":firstCatalogFile(
          window.SEVEN_DS_DATA.bijoux["Boucle d'oreille"],
          catalog.gearByFile
        )
      };
      const hero = {
        char:"meliodas",
        weapon,
        weaponConfig:{
          version:1,
          gradeGameId:grade.gameId,
          level:0,
          promotion:0,
          overlimit:0,
          enchantments:Array(grade.enchantments.slots.length).fill(null)
        },
        armor,
        armorConfig:Object.fromEntries(
          Object.entries(armor).map(([slot, file]) => [
            slot,
            configFor(file)
          ])
        ),
        jewel,
        jewelConfig:Object.fromEntries(
          Object.entries(jewel).map(([slot, file]) => [
            slot,
            configFor(file)
          ])
        ),
        potentiel:{ tier:0 },
        note:"Ancien instantané sans armes secondaires"
      };
      localStorage.setItem(key, JSON.stringify([{
        id:"equipe-stats-partielles",
        pseudo:"Stats partielles",
        heroes:[hero]
      }]));
    }, STORAGE_KEY);
    await page.reload();
    await page.locator('.tab[data-view="roster"]').click();
    const partialTeam = page.locator("#rosterGrid .team")
      .filter({ hasText:"Stats partielles" })
      .first();
    await partialTeam.getByRole("button", {
      name:/Voir l'équipement/
    }).click();
    const partialStats = page.locator("#teamDetail .hero-stats").first();
    assert.match(
      await partialStats.locator(".weapon-stats-title").innerText(),
      /calcul partiel/i
    );
    assert.match(
      await partialStats.locator(".hero-stat-card")
        .filter({ hasText:"ATK" }).innerText(),
      /arme secondaire manquante/i
    );
    assert.doesNotMatch(
      await partialStats.locator(".hero-stat-card")
        .filter({ hasText:"PV" }).innerText(),
      /arme secondaire manquante/i
    );
    await page.locator("#teamClose").click();

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
        },{
          char:"meliodas",
          weapon:"7ds-armes/Hache/Hache de l'âme vorace.webp",
          weaponConfig:{ version:99 },
          potentiel:{ tier:0 }
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
    assert.equal(await armorSlot(page.locator(".hero").first(), "Armure gravée").evaluate(
      el => el.classList.contains("filled")
    ), false);
    const futureHero = page.locator(".hero").nth(1);
    await assertVisibleText(
      futureHero.locator(".weapon-config-summary"),
      "Configuration à compléter"
    );
    await futureHero.locator(".weapon-config-open").click();
    await page.locator("#weaponConfigOverlay").waitFor({
      state:"visible",
      timeout:2000
    });
    assert.match(
      await page.locator("#weaponConfigPreview").textContent(),
      /n’est pas compatible/
    );
    await page.locator("#weaponConfigCancel").click();
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
    await server.close();
  }
})().catch(error=>{
  console.error(error);
  process.exitCode = 1;
});

async function chooseWeapon(page, hero, group, name){
  await hero.locator(".gear-slot.weapon").click();
  await page.locator("#pickerChips").getByRole("button", { name:group, exact:true }).click();
  if(name){
    await page.locator(`#pickerGrid .tile[title="${name}"]`).click();
  }else{
    await page.locator("#pickerGrid .tile:not(.none)").first().click();
  }
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
