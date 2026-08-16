"use strict";

/* Ce qu'un visiteur sans compte voit, et ce qu'il peut en faire.

   Deux promesses, et aucune ne se demontre hors d'un navigateur :

   1. la barre d'onglets se reduit aux pages qui fonctionnent sans compte.
      Montrer « Sessions de boss » a qui ne peut rien en faire, c'est six
      portes fermees a la suite ;
   2. le Calculateur reste ATTEIGNABLE. Il part normalement du roster, donc
      d'un compte : sans le bouton du Builder, son onglet serait un cul-de-sac
      affichant « Connecte-toi », ce qui est pire que pas d'onglet du tout.

   Le mode hors ligne est le contre-exemple qui compte, et il a son bloc a la
   fin. Quand `sb` vaut null — PWA sans reseau, script CDN absent — aucun
   compte n'est possible et tout le site retombe sur localStorage : masquer
   des onglets y enfermerait le membre hors de ses propres equipes.

   Le faux Supabase est celui de `helpers/faux-supabase.js`, partage avec
   `supabase-etape1.playwright.js` : deux harnais auraient fini par diverger. */

const assert = require("node:assert/strict");
const { serveRepo } = require("./helpers/serve");
const { installFakeSupabase } = require("./helpers/faux-supabase");
const { chromium } = require("playwright");

/* Dans l'ordre du DOM : c'est celui que rend `ongletsVisibles`.

   « Dispos » et « Sessions de boss » n'y figurent plus : ils vivent dans le
   sous-menu de « Boss de Guilde », replie tant qu'on n'est pas dans le groupe.
   Leur portee reste verifiee plus bas, la ou le sous-menu est ouvert. */
const ONGLETS_PUBLICS = ["builder", "wiki", "collection", "calculateur"];
const ONGLETS_TOUS = [
  "dashboard", "builder", "roster", "member-roster",
  "analyse", "wiki", "collection", "calculateur"
];
const SOUS_ONGLETS_BOSS = ["roster", "availability", "boss"];

/* `getClientRects()` et non l'attribut `hidden` : on veut savoir ce que l'oeil
   voit, pas ce que le code a ecrit. Une regle CSS oubliee passerait le second
   controle et raterait le premier. */
const ongletsVisibles = page => page.evaluate(() =>
  [...document.querySelectorAll(".tab[data-view]")]
    .filter(onglet => onglet.getClientRects().length > 0)
    .map(onglet => onglet.dataset.view)
);

const vueActive = page => page.evaluate(() => {
  const vue = document.querySelector(".view.active");
  return vue ? vue.id.replace(/^view-/, "") : null;
});

(async()=>{
  const server = await serveRepo();
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{ width:1440, height:1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  try{
    await installFakeSupabase(page);
    await page.goto(server.url + "/index.html");
    await page.locator("#authOverlay").waitFor({ state:"visible" });
    /* La modale s'ouvre AVANT que la barre ne soit rangee — `applySession`
       propose la connexion, puis rafraichit les vues, puis referme les portes.
       Sans cette attente, le test lirait la barre au milieu du geste. */
    await page.locator("#tab-dashboard").waitFor({ state:"hidden" });

    /* ---- Le visiteur : quatre onglets, et le Wiki pour l'accueillir. ---- */
    assert.deepEqual(await ongletsVisibles(page), ONGLETS_PUBLICS,
      "sans compte, seules les pages utilisables doivent rester dans la barre");
    assert.equal(await vueActive(page), "wiki",
      "l'Accueil etant masque, le visiteur doit atterrir sur le Wiki");

    /* La modale reste la porte d'entree : elle s'ouvre au chargement et se
       ferme sur « Continuer hors connexion », comportement inchange. */
    await page.getByRole("button",
      { name:"Continuer hors connexion", exact:true }).click();
    await page.locator("#authOverlay").waitFor({ state:"hidden" });

    /* ---- Le Calculateur, ouvert par son onglet, equipe vide. ----

       Il partait du roster, donc d'un compte : son onglet repondait
       « Connecte-toi », en renvoyant vers une fiche de heros qu'un visiteur ne
       peut pas ouvrir. Il doit maintenant montrer la sortie qui existe. */
    await page.locator('.tab[data-view="calculateur"]').click();
    await page.locator("#view-calculateur").waitFor({ state:"visible" });
    assert.equal(
      await page.getByText("Connecte-toi pour calculer les dégâts").count(),
      0,
      "l'onglet ne doit plus reclamer un compte a un visiteur"
    );
    await page.locator("#calculateurBody")
      .getByRole("button", { name:"Créer une équipe", exact:true })
      .waitFor({ state:"visible" });

    /* ---- Le Calculateur, ouvert par son onglet, equipe composee. ---- */
    await page.locator('.tab[data-view="builder"]').click();
    const premierHeros = page.locator(".hero").first();

    /* Le bouton n'a de sens qu'une fois le build identifiable : le
       calculateur a besoin du personnage ET du type d'arme. */
    assert.equal(
      await premierHeros.getByRole("button",
        { name:"Calculer les dégâts", exact:true }).count(),
      0,
      "un emplacement vide n'a aucun degat a calculer"
    );

    await premierHeros.locator(".portrait").click();
    await page.locator('#pickerGrid .tile[title="Meliodas"]').click();
    await premierHeros.locator(".gear-slot.weapon").click();
    await page.locator("#pickerChips")
      .getByRole("button", { name:"Hache", exact:true }).click();
    await page.locator('#pickerGrid .tile[title="Hache bénie"]').click();

    /* L'onglet seul suffit desormais : l'equipe en cours d'edition est une
       source de builds au meme titre que le roster d'un membre. */
    await page.locator('.tab[data-view="calculateur"]').click();
    await page.locator("#view-calculateur").waitFor({ state:"visible" });
    await page.locator("#calculateurBody")
      .getByRole("button", { name:"Meliodas — Hache", exact:true })
      .click();
    await page.locator("#calculateurBody .calc-avertissement")
      .waitFor({ state:"visible" });

    /* Et le bouton du Builder mene au meme endroit, sans passer par ce choix. */
    await page.locator('.tab[data-view="builder"]').click();
    const lien = premierHeros.getByRole("button",
      { name:"Calculer les dégâts", exact:true });
    await lien.waitFor({ state:"visible" });
    await lien.click();

    await page.locator("#view-calculateur").waitFor({ state:"visible" });
    assert.equal(await vueActive(page), "calculateur");
    await page.locator("#calculateurBody .calc-avertissement")
      .waitFor({ state:"visible" });
    assert.equal(
      await page.getByText("Connecte-toi pour calculer les dégâts").count(),
      0,
      "arrive par le Builder, le calculateur ne doit pas reclamer de compte"
    );

    /* ---- Connexion : les six onglets reserves reviennent. ---- */
    await page.locator("#accountLogin").click();
    await page.locator("#authEmail").fill("yannis@example.test");
    await page.locator("#authPassword").fill("mot-de-passe-test");
    await page.getByRole("button", { name:"Se connecter", exact:true }).click();
    await page.locator("#accountPseudo")
      .getByText("Yannis", { exact:true }).waitFor();

    assert.deepEqual(await ongletsVisibles(page), ONGLETS_TOUS,
      "un membre connecte retrouve la barre entiere");
    assert.equal(await vueActive(page), "dashboard",
      "la connexion mene au suivi, comme avant");

    /* LE SOUS-MENU, ouvert : c'est la seule facon d'atteindre les Dispos et les
       Sessions, donc la seule facon de prouver qu'un membre y a droit. */
    await page.locator('.tabs .tab[data-view="roster"]').click();
    assert.deepEqual(
      await page.evaluate(() =>
        [...document.querySelectorAll(".subtabs .tab[data-view]")]
          .filter(onglet => onglet.getClientRects().length > 0)
          .map(onglet => onglet.dataset.view)
      ),
      SOUS_ONGLETS_BOSS,
      "le groupe ouvert doit rendre ses trois entrees atteignables"
    );
    await page.locator('.subtabs .tab[data-view="availability"]').click();
    assert.equal(await vueActive(page), "availability",
      "un membre connecte atteint les Dispos par le sous-menu");
    await page.locator('.tab[data-view="wiki"]').click();
    assert.equal(
      await page.locator(".subtabs").evaluate(el => el.hidden),
      true,
      "quitter le groupe doit replier sa seconde ligne"
    );

    /* ---- Deconnexion : la barre se referme, et la vue avec elle. ---- */
    await page.getByRole("button", { name:"Déconnexion", exact:true }).click();
    await page.locator("#accountLogin").waitFor({ state:"visible" });

    assert.deepEqual(await ongletsVisibles(page), ONGLETS_PUBLICS,
      "se deconnecter doit refermer les onglets reserves");
    assert.equal(await vueActive(page), "wiki",
      "la vue quittee etant reservee, la navigation doit replier sur le Wiki");

    /* ---- Hors ligne : aucun compte possible, donc aucun onglet masque. ---- */
    const horsLigne = await browser.newPage({
      viewport:{ width:1440, height:1000 }
    });
    horsLigne.on("pageerror", error => errors.push(error.message));
    await horsLigne.route(
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*",
      route => route.fulfill({
        status:200, contentType:"application/javascript", body:""
      })
    );
    await horsLigne.goto(server.url + "/index.html");
    /* Pas d'attente de modale ici : sans client Supabase, `initAuth` sort
       avant de l'ouvrir. C'est justement pourquoi masquer des onglets dans ce
       mode serait sans recours — il n'y a aucune fenetre de connexion a
       proposer. */
    await horsLigne.locator("#tab-dashboard").waitFor({ state:"visible" });

    assert.deepEqual(await ongletsVisibles(horsLigne), ONGLETS_TOUS,
      "sans Supabase le site est un bac a sable local : tout reste ouvert");
    assert.equal(await vueActive(horsLigne), "dashboard",
      "et la navigation ne bouge pas");
    await horsLigne.close();

    assert.deepEqual(errors, [], "aucune erreur de page");
    console.log("visiteur-anonyme.playwright.js OK");
  }finally{
    await browser.close();
    await server.close();
  }
})().catch(error=>{
  console.error(error);
  process.exitCode = 1;
});
