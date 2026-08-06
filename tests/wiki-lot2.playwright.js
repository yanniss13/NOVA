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

    /* ====================== Les fiches d'objet ====================== */

    // Une arme à passif : sept pastilles, ouvertes sur le niveau maximum.
    await page.locator("#wikiCategoryArmes").click();
    await attendreTuiles(155);
    await page.locator("#wikiFilterWeaponPassive").selectOption("oui");
    await attendreTuiles(94);
    await tuiles().first().click();
    await page.locator("#wikiItemOverlay.on").waitFor();

    const niveaux = page.locator("#wikiItemBody .wiki-level");
    assert.equal(await niveaux.count(), 7, "un passif d'arme a sept niveaux");
    assert.equal(
      await niveaux.nth(6).getAttribute("aria-pressed"), "true",
      "la fiche doit s'ouvrir sur le niveau maximum"
    );

    /* Le balisage couleur du jeu est rendu, pas affiché tel quel : c'est le
       contrat de renderBonus(). */
    const passifMax = await page.locator("#wikiItemBody .wiki-skill-desc")
      .first().textContent();
    assert.ok(passifMax.length > 0 && !passifMax.includes("[#"),
      "le balisage couleur doit être rendu, pas laissé brut");

    // Changer de niveau change le texte : ce sont les mêmes phrases, d'autres
    // chiffres.
    await niveaux.nth(0).click();
    await page.waitForFunction(
      avant => document.querySelector("#wikiItemBody .wiki-skill-desc")
        .textContent !== avant,
      passifMax
    );

    /* Les deux blocs repliables d'une arme tirent des données déjà chargées :
       aucun appel réseau n'est fait à l'ouverture d'une fiche. */
    assert.deepEqual(
      await page.locator("#wikiItemBody .wiki-fold > summary")
        .evaluateAll(nodes => nodes.map(node => node.textContent)),
      ["Statistiques par rareté", "Enchantements"]
    );

    // La navigation clavier passe à l'arme suivante, et repart de son maximum.
    const position = await page.locator("#wikiItemPosition").textContent();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(
      avant => document.querySelector("#wikiItemPosition").textContent !== avant,
      position
    );
    assert.equal(
      await page.locator("#wikiItemBody .wiki-level.active").getAttribute("aria-label"),
      "Niveau 7",
      "changer d'arme doit rouvrir sur le niveau maximum"
    );
    await page.locator("#wikiItemClose").click();
    await page.locator("#wikiItemOverlay.on").waitFor({ state:"detached" });

    /* Une arme SANS passif n'affiche pas de section vide : 61 armes sont dans
       ce cas, et une rubrique creuse laisserait croire à une donnée manquante
       plutôt qu'à une arme qui n'en a pas. */
    await page.locator("#wikiFilterWeaponPassive").selectOption("non");
    await attendreTuiles(61);
    await tuiles().first().click();
    await page.locator("#wikiItemOverlay.on").waitFor();
    assert.equal(await page.locator("#wikiItemBody .wiki-level").count(), 0);
    assert.equal(
      await page.locator("#wikiItemBody .wiki-section-label")
        .evaluateAll(nodes => nodes.filter(n => n.textContent === "Passif").length),
      0,
      "aucune section Passif pour une arme qui n'en a pas"
    );
    await page.locator("#wikiItemClose").click();
    await page.locator("#wikiItemOverlay.on").waitFor({ state:"detached" });

    /* Une pièce d'ensemble : le nom de l'ensemble, sa prose, et ses pièces
       sœurs — y compris celles de l'autre grille. */
    await page.locator("#wikiCategoryArmures").click();
    await attendreTuiles(62);
    await page.locator("#wikiFilterArmorSet").selectOption({ index:1 });
    await page.waitForFunction(
      () => document.querySelectorAll("#wikiGrid .wiki-tile").length > 0
    );
    await tuiles().first().click();
    await page.locator("#wikiItemOverlay.on").waitFor();

    assert.ok(
      (await page.locator("#wikiItemBody .wiki-set-name").textContent()).length > 2,
      "l'ensemble doit être nommé"
    );
    assert.ok(
      await page.locator("#wikiItemBody .wiki-set-tier").count() >= 1,
      "l'ensemble doit annoncer au moins un palier"
    );
    /* Le seuil se lit dans les données : « 2 pièces » est un abus de langage,
       il vaut 3 dans une bonne moitié des ensembles. */
    assert.match(
      await page.locator("#wikiItemBody .wiki-set-count").first().textContent(),
      /^\d+ pièces?$/
    );
    const proses = await page.locator("#wikiItemBody .wiki-set-text")
      .evaluateAll(nodes => nodes.map(node => node.textContent));
    assert.ok(proses.length > 0, "un palier doit porter sa prose");
    assert.ok(proses.every(texte => !texte.includes("[#")),
      "la prose d'ensemble doit être rendue, pas laissée brute");

    const soeurs = page.locator("#wikiItemBody .wiki-set-piece");
    assert.ok(await soeurs.count() >= 2, "un ensemble a plusieurs pièces");
    assert.equal(
      await page.locator("#wikiItemBody .wiki-set-piece.active").count(), 1,
      "la pièce courante doit être marquée parmi ses sœurs"
    );

    // Cliquer une sœur ouvre sa fiche, sans quitter la modale.
    const titreAvant = await page.locator("#wikiItemTitle").textContent();
    await soeurs.locator(":not(.active)").first().click();
    await page.waitForFunction(
      avant => document.querySelector("#wikiItemTitle").textContent !== avant,
      titreAvant
    );
    await page.locator("#wikiItemClose").click();
    await page.locator("#wikiItemOverlay.on").waitFor({ state:"detached" });

    /* Une armure gravée : son héros, et le seul chemin qui mène d'un objet à
       un personnage. */
    await page.locator("#wikiCategoryGravees").click();
    await attendreTuiles(68);
    await page.locator("#wikiFilterEngravedHero").selectOption({ label:"Derieri" });
    await page.waitForFunction(
      () => document.querySelectorAll("#wikiGrid .wiki-tile").length > 0
    );
    await tuiles().first().click();
    await page.locator("#wikiItemOverlay.on").waitFor();

    assert.equal(
      await page.locator("#wikiItemBody .wiki-level").count(), 3,
      "un passif d'armure gravée a trois niveaux"
    );
    assert.equal(await page.locator("#wikiItemBody .wiki-set").count(), 0,
      "une armure gravée n'appartient à aucun ensemble");

    const versHeros = page.locator("#wikiItemBody .wiki-linked-hero");
    assert.equal(await versHeros.getAttribute("data-char"), "derieri");
    await versHeros.click();
    await page.locator("#wikiHeroOverlay.on").waitFor();
    assert.equal(await page.locator("#wikiHeroTitle").textContent(), "Derieri");
    /* La fiche de héros s'empile PAR-DESSUS : la fermer doit rendre la fiche
       d'objet, pas laisser le membre sur la grille. */
    await page.locator("#wikiHeroClose").click();
    await page.locator("#wikiHeroOverlay.on").waitFor({ state:"detached" });
    await page.locator("#wikiItemOverlay.on").waitFor();
    await page.locator("#wikiItemClose").click();
    await page.locator("#wikiItemOverlay.on").waitFor({ state:"detached" });

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
