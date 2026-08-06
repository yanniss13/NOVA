"use strict";

/* Le lot 2 du wiki dans un vrai navigateur : les quatre catégories d'objets,
   leurs filtres et leurs fiches.

   Le parcours héros du lot 1 est couvert par `wiki.playwright.js`, qui doit
   rester inchangé : c'est lui la preuve de non-régression. */

const assert = require("node:assert/strict");
const { serveRepo } = require("./helpers/serve");
const { chromium } = require("playwright");

const EFFECTIFS = {
  wikiCategoryArmes:155,
  wikiCategoryArmures:62,
  wikiCategoryBijoux:37,
  wikiCategoryGravees:68
};

(async()=>{
  const server = await serveRepo();
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{ width:1440, height:1000 } });
  const errors = [];
  const imagesRatees = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("response", reponse => {
    if(reponse.status() >= 400 && /\.webp$/.test(reponse.url())){
      imagesRatees.push(reponse.url());
    }
  });

  const tuiles = () => page.locator("#wikiGrid .wiki-tile");
  const attendreTuiles = nombre => page.waitForFunction(
    attendu => document.querySelectorAll("#wikiGrid .wiki-tile").length === attendu,
    nombre
  );

  try{
    await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*", route =>
      route.fulfill({ status:200, contentType:"application/javascript", body:"" })
    );
    await page.goto(server.url + "/index.html");
    await page.locator("#tab-wiki").click();
    await page.locator("#view-wiki").waitFor({ state:"visible" });
    await tuiles().first().waitFor();

    /* Chaque catégorie liste ce que le dépôt contient. Ces nombres sont le
       filet : une image ajoutée sans régénération, ou l'inverse, s'y voit. */
    for(const [bouton, attendu] of Object.entries(EFFECTIFS)){
      await page.locator("#" + bouton).click();
      await attendreTuiles(attendu);
      assert.equal(
        await page.locator("#" + bouton).getAttribute("aria-pressed"), "true",
        bouton + " doit être marquée active"
      );
    }

    /* Les filtres appartiennent à la catégorie : ceux du héros n'ont rien à
       faire sur la grille des armes. */
    await page.locator("#wikiCategoryArmes").click();
    await attendreTuiles(155);
    assert.equal(
      await page.locator("#wikiFilterElement").count(), 0,
      "le filtre élément est propre aux personnages"
    );
    assert.equal(
      await page.locator("#wikiFilters [data-filtre]").count(), 3,
      "la catégorie Armes a trois filtres"
    );

    // Le type d'arme, dérivé des données et nommé en français.
    const types = await page.locator("#wikiFilterWeaponType option")
      .evaluateAll(nodes => nodes.map(node => node.textContent));
    assert.ok(types.includes("Hache"), "le type Hache doit être proposé, reçu "
      + JSON.stringify(types));
    await page.locator("#wikiFilterWeaponType").selectOption({ label:"Hache" });
    await attendreTuiles(13);

    /* Le filtre passif : 94 armes sur 155 en portent un. Les 61 autres sont
       listées quand même — leur fiche ne doit simplement rien inventer. */
    await page.locator("#wikiFilterWeaponType").selectOption("");
    await page.locator("#wikiFilterWeaponPassive").selectOption("oui");
    await attendreTuiles(94);
    await page.locator("#wikiFilterWeaponPassive").selectOption("non");
    await attendreTuiles(61);
    await page.locator("#wikiFilterWeaponPassive").selectOption("");
    await attendreTuiles(155);

    // La recherche par nom, et l'état vide annoncé plutôt que laissé nu.
    await page.locator("#wikiSearch").fill("zzzzz");
    await page.locator("#wikiEmpty").waitFor({ state:"visible" });
    assert.match(
      await page.locator("#wikiEmpty").textContent(), /arme/,
      "l'état vide doit parler de la catégorie affichée"
    );

    /* Changer de catégorie repart d'une recherche vierge : « zzzzz » ne
       désigne rien nulle part, et une grille vide sans cause visible est le
       pire des accueils. */
    await page.locator("#wikiCategoryArmures").click();
    await attendreTuiles(62);
    assert.equal(await page.locator("#wikiSearch").inputValue(), "");

    // Un ensemble d'armures, nommé en français par le catalogue.
    const ensembles = await page.locator("#wikiFilterArmorSet option")
      .evaluateAll(nodes => nodes.map(node => node.textContent));
    assert.ok(
      ensembles.length > 2 && ensembles.every(nom => !/^(armor|equip)_t/.test(nom)),
      "les ensembles doivent porter leur nom français, reçu "
        + JSON.stringify(ensembles)
    );
    const avantEnsemble = await tuiles().count();
    await page.locator("#wikiFilterArmorSet").selectOption({ index:1 });
    await page.waitForFunction(
      avant => {
        const compte = document.querySelectorAll("#wikiGrid .wiki-tile").length;
        return compte > 0 && compte < avant;
      },
      avantEnsemble
    );

    // Les bijoux ont leurs propres emplacements.
    await page.locator("#wikiCategoryBijoux").click();
    await attendreTuiles(37);
    const emplacements = await page.locator("#wikiFilterJewelSlot option")
      .evaluateAll(nodes => nodes.map(node => node.textContent));
    assert.ok(
      emplacements.includes("Anneau") && emplacements.includes("Collier"),
      "les emplacements de bijoux, reçu " + JSON.stringify(emplacements)
    );

    /* Les armures gravées se filtrent par héros : c'est leur seul axe, chacune
       étant liée à un personnage et un seul. */
    await page.locator("#wikiCategoryGravees").click();
    await attendreTuiles(68);
    await page.locator("#wikiFilterEngravedHero")
      .selectOption({ label:"Derieri" });
    await page.waitForFunction(
      () => {
        const compte = document.querySelectorAll("#wikiGrid .wiki-tile").length;
        return compte > 0 && compte < 68;
      }
    );

    /* Revenir aux personnages restaure les quatre filtres du lot 1, avec leurs
       identifiants d'origine. */
    await page.locator("#wikiCategoryHeros").click();
    await attendreTuiles(25);
    for(const id of ["wikiFilterElement", "wikiFilterWeapon",
                     "wikiFilterRole", "wikiFilterRarity"]){
      assert.equal(await page.locator("#" + id).count(), 1,
        "#" + id + " doit revenir avec la catégorie Personnages");
    }

    assert.deepEqual(errors, [], "aucune erreur de page attendue");
    assert.deepEqual(imagesRatees, [], "aucune image manquante attendue");
  } finally {
    await browser.close();
    await server.close();
  }

  console.log("PASS Playwright: wiki lot 2, catégories et filtres");
})();
