"use strict";

/* Le wiki, dans un vrai navigateur : l'onglet, la grille, les filtres. */

const assert = require("node:assert/strict");
const { serveRepo } = require("./helpers/serve");
const { chromium } = require("playwright");

(async()=>{
  const server = await serveRepo();
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{ width:1440, height:1000 } });
  const errors = [];
  const imagesRatees = [];
  page.on("pageerror", error => errors.push(error.message));
  /* Une icone absente ne casse rien de visible en test : sans ce guetteur,
     la fiche afficherait des cadres vides au vu et au su de personne. */
  page.on("response", reponse => {
    if(reponse.status() >= 400 && /\.webp$/.test(reponse.url())){
      imagesRatees.push(reponse.url());
    }
  });

  try{
    await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*", route =>
      route.fulfill({ status:200, contentType:"application/javascript", body:"" })
    );
    await page.goto(server.url + "/index.html");

    /* Le catalogue ne doit PAS être chargé tant que l'onglet n'est pas
       ouvert : c'est tout l'intérêt de le tenir hors du précache. */
    assert.equal(
      await page.evaluate(() => typeof window.SEVEN_DS_WIKI_COMPETENCES),
      "undefined",
      "le catalogue ne doit pas être chargé avant l'ouverture de l'onglet"
    );

    await page.locator("#tab-wiki").click();
    await page.locator("#view-wiki").waitFor({ state:"visible" });
    await page.locator("#wikiGrid .wiki-tile").first().waitFor();

    assert.equal(
      await page.evaluate(() => typeof window.SEVEN_DS_WIKI_COMPETENCES),
      "object",
      "l'ouverture de l'onglet doit charger le catalogue"
    );

    const total = await page.locator("#wikiGrid .wiki-tile").count();
    assert.ok(total >= 25, "la grille doit lister tous les héros, reçu "+total);

    // La recherche par nom.
    await page.locator("#wikiSearch").fill("derieri");
    await page.waitForFunction(
      () => document.querySelectorAll("#wikiGrid .wiki-tile").length === 1
    );
    assert.equal(
      await page.locator("#wikiGrid .wiki-tile").first().getAttribute("title"),
      "Derieri"
    );

    // Un filtre de catégorie, dérivé des métadonnées.
    await page.locator("#wikiSearch").fill("");
    await page.locator("#wikiFilterElement").selectOption("DARK");
    await page.waitForFunction(
      () => document.querySelectorAll("#wikiGrid .wiki-tile").length > 0
    );
    const sombres = await page.locator("#wikiGrid .wiki-tile").count();
    assert.ok(sombres > 0 && sombres < total,
      "le filtre élément doit restreindre la grille, reçu "+sombres+"/"+total);

    /* Le rôle « Soutien » est le piège : les métadonnées du héros disent
       SUPPORT là où le vocabulaire des slots d'arme dit Supporter. Un filtre
       bâti sur le mauvais dictionnaire perdrait cette option. */
    await page.locator("#wikiFilterElement").selectOption("");
    const roles = await page.locator("#wikiFilterRole option")
      .evaluateAll(nodes => nodes.map(node => node.value));
    assert.ok(roles.includes("SUPPORT"),
      "le filtre rôle doit proposer les soutiens, reçu "+JSON.stringify(roles));
    await page.locator("#wikiFilterRole").selectOption("SUPPORT");
    await page.waitForFunction(
      () => document.querySelectorAll("#wikiGrid .wiki-tile").length > 0
    );

    // Une recherche sans résultat annonce le vide plutôt que de le laisser nu.
    await page.locator("#wikiFilterRole").selectOption("");
    await page.locator("#wikiSearch").fill("zzzzz");
    await page.locator("#wikiEmpty").waitFor({ state:"visible" });

    // La fiche d'un héros : ouverture, contenu, changement d'arme.
    await page.locator("#wikiSearch").fill("");
    await page.locator('#wikiGrid .wiki-tile[data-char="derieri"]').click();
    await page.locator("#wikiHeroOverlay.on").waitFor();
    assert.equal(
      await page.locator("#wikiHeroTitle").textContent(),
      "Derieri"
    );

    assert.equal(
      await page.locator(".wiki-hero-weapon").count(), 3,
      "Derieri a trois types d'arme"
    );

    /* Chaque compétence porte le médaillon du jeu. */
    assert.equal(
      await page.locator(".wiki-skill-icon").count(),
      await page.locator(".wiki-skill").count(),
      "chaque compétence doit porter son icône"
    );

    // Le passif vient en tête des compétences de l'arme affichée.
    assert.equal(
      await page.locator(".wiki-skill").first().locator(".wiki-skill-kind")
        .textContent(),
      "Passif"
    );
    const premiereArme = await page.locator(".wiki-skill-name").first().textContent();

    // Changer d'arme change les compétences affichées.
    await page.locator(".wiki-hero-weapon").nth(1).click();
    await page.waitForFunction(
      nom => document.querySelector(".wiki-skill-name").textContent !== nom,
      premiereArme
    );

    /* Le balisage couleur du jeu est rendu, pas affiché tel quel : c'est le
       contrat de renderBonus(). */
    assert.equal(
      await page.locator(".wiki-skill-desc").first().evaluate(
        node => node.textContent.includes("[#")
      ),
      false,
      "le balisage couleur doit être rendu, pas laissé brut"
    );
    assert.ok(
      await page.locator(".wiki-skill-desc span[style*='color']").count() > 0,
      "au moins une portion colorée attendue"
    );

    /* Les blocs repliables tirent des données déjà chargées par l'appli.

       « Transcendances » s'est intercalé avec la version 2.0, le 26 août 2026.
       Sa place est voulue : c'est, avec les potentiels, ce qu'un membre compare
       d'un héros à l'autre, et les deux se lisent ensemble. */
    const replis = await page.locator(".wiki-fold > summary")
      .evaluateAll(nodes => nodes.map(node => node.textContent));
    assert.deepEqual(
      replis,
      ["Potentiels", "Transcendances", "Maîtrises d’arme", "Stats de base",
       "Armures gravées"]
    );

    /* La navigation clavier passe au héros suivant. Le clavier GLOBAL, pas
       `locator.press` : l'overlay est un div non focalisable, le focaliser ne
       ferait remonter aucun événement jusqu'à son écouteur. Les tests du
       roster procèdent déjà ainsi. */
    const position = await page.locator("#wikiHeroPosition").textContent();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(
      avant => document.querySelector("#wikiHeroPosition").textContent !== avant,
      position
    );

    await page.locator("#wikiHeroClose").click();
    await page.locator("#wikiHeroOverlay.on").waitFor({ state:"detached" });

    /* LES PUCES SUIVENT L'ARME, elles ne decrivent pas le personnage.

       Un heros n'a pas UN element et UN role : chaque type d'arme porte les
       siens. Dreyfus est Soutien Physique a la rapiere, et Attaquant Terre a
       l'epee a une main — afficher une seule paire figee ferait mentir la
       fiche sur deux de ses trois armes.

       Les armes sont visees par leur libelle et non par un rang : l'ordre
       vient du catalogue de competences, qu'un patch peut reordonner. */
    const puceElement = page.locator(".wiki-chip-element");
    const puceRole = page.locator(".wiki-hero-chips .wiki-chip:not(.wiki-chip-element)");
    const armeDite = nom =>
      page.locator('.wiki-hero-weapon[title="' + nom + '"]');

    await page.locator('#wikiGrid .wiki-tile[data-char="dreyfus"]').click();
    await page.locator("#wikiHeroOverlay.on").waitFor();

    await armeDite("Rapière").click();
    await page.waitForFunction(() =>
      document.querySelector('.wiki-hero-weapon[title="Rapière"]')
        .classList.contains("active"));
    assert.equal(await puceElement.textContent(), "Physique",
      "à la rapière, Dreyfus est Physique");
    assert.equal(await puceRole.textContent(), "Soutien",
      "à la rapière, Dreyfus est Soutien");

    await armeDite("Épée à une main").click();
    await page.waitForFunction(() =>
      document.querySelector('.wiki-hero-weapon[title="Épée à une main"]')
        .classList.contains("active"));
    assert.equal(await puceElement.textContent(), "Terre",
      "à l'épée à une main, Dreyfus est Terre");
    assert.equal(await puceRole.textContent(), "Attaquant",
      "à l'épée à une main, Dreyfus est Attaquant");

    /* UNE FICHE S'OUVRE EN HAUT.

       La modale est un element REUTILISE : le meme #wikiHeroBody sert a tous
       les heros. Sans remise a zero, ouvrir une fiche apres en avoir lu une
       longue depose le lecteur au milieu de la nouvelle, sur une section qu'il
       n'a pas demandee. */
    const defilement = () => page.evaluate(() =>
      document.querySelector("#wikiHeroBody").scrollTop);
    await page.evaluate(() => {
      const corps = document.querySelector("#wikiHeroBody");
      corps.scrollTop = corps.scrollHeight;
    });
    await page.waitForFunction(() =>
      document.querySelector("#wikiHeroBody").scrollTop > 0);
    await page.locator("#wikiHeroClose").click();
    await page.locator("#wikiHeroOverlay.on").waitFor({ state:"detached" });

    await page.locator('#wikiGrid .wiki-tile[data-char="derieri"]').click();
    await page.locator("#wikiHeroOverlay.on").waitFor();
    assert.equal(await defilement(), 0,
      "une fiche ouverte doit commencer en haut, pas la ou finissait la precedente");
    await page.locator("#wikiHeroClose").click();
    await page.locator("#wikiHeroOverlay.on").waitFor({ state:"detached" });

    /* Hors ligne : le catalogue a été mis en cache par le service worker au
       premier passage, la fiche doit donc rester consultable.

       Le worker doit CONTRÔLER la page avant qu'on coupe le réseau. Il
       n'installe qu'après le premier chargement et ne prend la main qu'à la
       navigation suivante — d'où le rechargement intermédiaire et l'attente
       de `controller`. Sans cela le test passe seul et échoue dans la suite,
       au gré de la charge machine. */
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    /* Une visite EN LIGNE mais déjà contrôlée par le worker : c'est celle-là
       qui fait passer le catalogue par `networkFirst` et le met en cache. Au
       tout premier chargement la page n'est pas encore contrôlée, la requête
       échappe donc au worker et rien n'est gardé. */
    await page.locator("#tab-wiki").click();
    await page.locator("#wikiGrid .wiki-tile").first().waitFor();
    await page.context().setOffline(true);
    await page.reload();
    await page.locator("#tab-wiki").click();
    await page.locator('#wikiGrid .wiki-tile[data-char="derieri"]').click();
    await page.locator("#wikiHeroOverlay.on").waitFor();
    assert.ok(
      await page.locator(".wiki-skill").count() > 0,
      "la fiche doit rester consultable hors ligne"
    );
    await page.context().setOffline(false);

    assert.deepEqual(errors, [], "aucune erreur de page attendue");
    assert.deepEqual(imagesRatees, [], "aucune image manquante attendue");
  } finally {
    await browser.close();
    await server.close();
  }

  console.log("PASS Playwright: wiki, grille, filtres et fiche de héros");
})();
