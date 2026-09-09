"use strict";

/* La rotation d'une equipe, dans un vrai navigateur.

   L'equipe est batie DEPUIS LES CATALOGUES plutot qu'ecrite en dur : une liste
   de fichiers ecrite a la main se perimerait au premier renommage d'image.
   Meme procede que tests/calculateur.playwright.js, dont ce bloc est repris.

   Ban est monte AUX GANTELETS, et ce n'est pas un detail : c'est la seule arme
   avec laquelle il lance une compétence combinée. Au nunchaku, la palette n'en
   proposerait aucune — ce que garde deja tests/rotation-equipe.test.js. */

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

    /* Le catalogue est PARESSEUX : 7491 lignes que ne doit pas payer un
       visiteur qui ne calcule rien. */
    assert.equal(
      await page.evaluate(() => typeof window.SEVEN_DS_COMPETENCES),
      "undefined",
      "le catalogue ne doit pas etre charge au demarrage"
    );

    /* Le catalogue chiffre est lui aussi charge a la demande. Le Builder est
       la premiere vue de ce parcours qui en a besoin. */
    await page.locator("#tab-builder").click();
    await page.waitForFunction(() =>
      Object.keys(window.SEVEN_DS_BUILD_STATS?.weaponsByFile || {}).length > 0
    );

    await page.evaluate(key => {
      const catalog = window.SEVEN_DS_BUILD_STATS;
      const souverainCupide = slot => {
        const match = Object.entries(catalog.gearByFile)
          .find(([, definition]) => definition.setId === "equip_t5_greed"
            && definition.slot === slot);
        if(!match) throw new Error("FIXTURE_GREED_SLOT_MISSING:"+slot);
        return match[0];
      };
      let weapon = null;
      let grade = null;
      for(const item of window.SEVEN_DS_DATA.armes.Gantelets){
        const definition = catalog.weaponsByFile[item.file];
        const candidate = definition
          && Object.values(definition.gradesByGameId).find(value =>
            value.mainStatValues
            && value.promotionValues
            && value.enchantments
            && value.enchantments.type === "basic"
            && value.enchantments.slots.length > 0
          );
        if(candidate){
          weapon = item.file;
          grade = candidate;
          break;
        }
      }
      if(!weapon || !grade) throw new Error("FIXTURE_WEAPON_GRADE_MISSING");

      const configFor = file => {
        const definition = catalog.gearByFile[file]
          || catalog.engravedByFile[file];
        if(!definition) throw new Error("FIXTURE_GEAR_MISSING:"+file);
        return {
          version:1,
          level:definition.qualityMin,
          reinforce:0,
          enchantments:Array(
            definition.randomOptions ? definition.randomOptions.slots : 0
          ).fill(null),
          passiveLevel:null
        };
      };
      const armor = {
        Haut:souverainCupide("Top"),
        Bas:souverainCupide("Bottom"),
        Bottes:souverainCupide("Shoes"),
        Ceinture:souverainCupide("Belt"),
        "Armure liee":(window.SEVEN_DS_ARMURES_LIEES.ban || [])
          .find(file => catalog.engravedByFile[file])
      };
      if(!armor["Armure liee"]) throw new Error("FIXTURE_ENGRAVING_MISSING");
      const jewel = {
        Anneau:souverainCupide("Ring"),
        Collier:souverainCupide("Necklace"),
        "Boucle d'oreille":souverainCupide("Earring")
      };
      localStorage.setItem(key, JSON.stringify([{
        id:"equipe-calculateur",
        pseudo:"Calculateur",
        heroes:[{
          char:"ban",
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
            Object.entries(armor).map(([slot, file]) => [slot, configFor(file)])
          ),
          jewel,
          jewelConfig:Object.fromEntries(
            Object.entries(jewel).map(([slot, file]) => [slot, configFor(file)])
          ),
          potentiel:{ tier:0 }
        },
        /* UN SECOND HEROS, monte a minima : la rotation n'a besoin que de son
           personnage et de son arme EQUIPEE. Il est la pour qu'une
           combinaison existe — Ban aux gantelets ne se combine pas tout seul.

           Tristan aux epees doubles est le partenaire verifie par
           tests/rotation-equipe.test.js, et la table porte les deux sens :
           Ban lance avec Tristan, et Tristan lance avec Ban. */
        {
          char:"tristan",
          weapon:Object.keys(catalog.weaponsByFile)
            .find(file => file.indexOf("/Epees doubles/") >= 0)
        }]
      }]));
    }, STORAGE_KEY);
    await page.reload();
    /* La modale de detail d'une equipe qu'on possede : la palette est la. */
    await page.locator('.tabs .tab[data-view="roster"]').click();
    await page.getByRole("button", { name:/Voir l.équipement/ }).first().click();
    const rota = page.locator(".rota");
    await rota.waitFor();
    await rota.locator(".rota-palette-bouton").first().waitFor();

    /* Deux appuis sur la MEME competence font une case x2, pas deux cases.
       C'est la demande du membre : onze cases identiques ne se lisent pas. */
    const premiere = rota.locator(".rota-palette-bouton").first();
    await premiere.click();
    await premiere.click();
    assert.equal(
      await rota.locator(".rota-case").count(), 1,
      "deux appuis identiques font une seule case"
    );
    assert.equal(
      await rota.locator(".rota-fois").innerText(), "×2",
      "la case annonce sa serie"
    );

    /* Une seconde competence ouvre une seconde case. */
    await rota.locator(".rota-palette-bouton").nth(1).click();
    assert.equal(await rota.locator(".rota-case").count(), 2);

    /* Les fleches reordonnent — la voie sure, celle qui marche au clavier. */
    const avant = await rota.locator(".rota-case").first().getAttribute("title");
    await rota.locator(".rota-case").first()
      .locator('.rota-cmd[title="Déplacer vers la droite"]').click();
    const apres = await rota.locator(".rota-case").first().getAttribute("title");
    assert.notEqual(avant, apres, "la premiere case a change apres le deplacement");

    /* LE GLISSER. `mouse.move` de Playwright emet de vrais Pointer Events,
       donc le geste se teste pour de bon — pas seulement les fleches. */
    await rota.locator(".rota-palette-bouton").nth(2).click();
    assert.equal(await rota.locator(".rota-case").count(), 3);
    const tiree = await rota.locator(".rota-case").first().getAttribute("title");
    const source = await rota.locator(".rota-case").first().boundingBox();
    const destination = await rota.locator(".rota-case").last().boundingBox();
    /* On vise le HAUT de la case, pas son centre : les commandes occupent le
       bas, et un appui dessus n'ouvre pas un glisser — c'est voulu. */
    await page.mouse.move(source.x + source.width / 2, source.y + 10);
    await page.mouse.down();
    await page.mouse.move(
      destination.x + destination.width / 2, destination.y + 10,
      { steps:12 }
    );
    await page.mouse.up();
    assert.equal(
      await rota.locator(".rota-case").last().getAttribute("title"), tiree,
      "la case tiree doit finir la ou on l'a lachee"
    );

    /* LA COMBINAISON. Ban aux gantelets en a : la section existe. */
    assert.ok(
      await rota.locator(".rota-palette-combine").count() > 0,
      "Ban aux gantelets doit proposer au moins une combinaison"
    );

    /* Enregistrer, fermer, rouvrir : l'ordre a survecu. */
    const ordreAvant = await rota.locator(".rota-case").allTextContents();
    await page.getByRole("button", { name:"Enregistrer la rotation" }).click();
    await page.waitForFunction(() =>
      document.querySelector(".rota-barre .btn").disabled === true);
    await page.locator("#teamClose").click();
    await page.getByRole("button", { name:/Voir l.équipement/ }).first().click();
    await rota.locator(".rota-case").first().waitFor();
    assert.deepEqual(
      await rota.locator(".rota-case").allTextContents(), ordreAvant,
      "la rotation enregistree revient dans le meme ordre"
    );

    /* Les cibles tactiles restent conformes. */
    const boite = await rota.locator(".rota-cmd").first().boundingBox();
    assert.ok(
      boite.width >= 24 && boite.height >= 24,
      "une commande d'edition doit rester touchable, recu : "
        + boite.width + "×" + boite.height
    );

    assert.deepEqual(errors, [], "aucune erreur de page attendue");
  } finally {
    await browser.close();
    await server.close();
  }

  console.log("PASS Playwright: rotation d'équipe, composition et relecture");
})();
