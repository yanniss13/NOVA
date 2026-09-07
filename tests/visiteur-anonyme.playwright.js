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
const {
  allerA, destinationsVisibles, ongletsLocauxVisibles, ouvrirLeCompte
} = require("./helpers/naviguer");
const { installFakeSupabase } = require("./helpers/faux-supabase");
const { chromium } = require("playwright");

/* CE QUE LA BARRE PROPOSE, selon qui regarde.

   La barre a change de forme : dix onglets a plat sont devenus des rubriques,
   et les quatre outils vivent dans un menu. La question testee n'a pas bouge —
   ou ce compte peut-il aller ? — seule sa lecture a change.

   `outils` reste separe des rubriques : ce sont deux etages de navigation, et
   les confondre masquerait qu'une rubrique entiere a disparu de la barre. */
const PORTEE_VISITEUR = {
  rubriques:["guilde", "equipes"],
  outils:["wiki", "collection", "calculateur"]
};
const PORTEE_MEMBRE = {
  rubriques:["guilde", "equipes", "centre-boss", "mon-roster"],
  outils:["wiki", "collection", "calculateur", "analyse"]
};
/* Les onglets du centre Boss, second etage de la rubrique. Ils remplacent le
   sous-menu du groupe « Boss de Guilde ». */
const ONGLETS_DU_CENTRE_BOSS = ["availability", "boss"];

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
    await page.locator('#desktopNav [data-rubrique="mon-roster"]')
      .waitFor({ state:"hidden" });

    /* ---- Le visiteur : deux rubriques, trois outils, l'accueil public. ---- */
    assert.deepEqual(await destinationsVisibles(page), PORTEE_VISITEUR,
      "sans compte, seules les pages utilisables doivent rester dans la barre");
    assert.equal(await vueActive(page), "home",
      "le visiteur doit atterrir sur l'accueil public");

    /* La modale reste la porte d'entree : elle s'ouvre au chargement et se
       ferme sur « Continuer hors connexion », comportement inchange. */
    await page.getByRole("button",
      { name:"Continuer hors connexion", exact:true }).click();
    await page.locator("#authOverlay").waitFor({ state:"hidden" });

    /* ---- Le Calculateur, ouvert par son onglet, equipe vide. ----

       Il partait du roster, donc d'un compte : son onglet repondait
       « Connecte-toi », en renvoyant vers une fiche de heros qu'un visiteur ne
       peut pas ouvrir. Il doit maintenant montrer la sortie qui existe. */
    await allerA(page, "calculateur");
    assert.equal(await page.evaluate(() => location.hash), "#calculateur",
      "l'onglet Calculateur doit nommer sa vue dans l'URL");
    assert.equal(
      await page.getByText("Connecte-toi pour calculer les dégâts").count(),
      0,
      "l'onglet ne doit plus reclamer un compte a un visiteur"
    );
    await page.locator("#calculateurBody")
      .getByRole("button", { name:"Créer une équipe", exact:true })
      .waitFor({ state:"visible" });

    /* ---- Le Calculateur, ouvert par son onglet, equipe composee. ---- */
    await allerA(page, "builder");
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
    await allerA(page, "calculateur");
    await page.locator("#calculateurBody")
      .getByRole("button", { name:"Meliodas — Hache", exact:true })
      .click();
    await page.locator("#calculateurBody .calc-avertissement")
      .waitFor({ state:"visible" });

    /* Et le bouton du Builder mene au meme endroit, sans passer par ce choix. */
    await allerA(page, "builder");
    const lien = premierHeros.getByRole("button",
      { name:"Calculer les dégâts", exact:true });
    await lien.waitFor({ state:"visible" });
    await lien.click();

    await page.locator("#view-calculateur").waitFor({ state:"visible" });
    assert.equal(await vueActive(page), "calculateur");
    /* Le fragment suivait la vue affichee, pas l'onglet d'ou l'on vient :
       arriver par le Builder annoncait `#builder` sur le Calculateur. */
    assert.equal(await page.evaluate(() => location.hash), "#calculateur",
      "arrive par le Builder, l'URL ne doit pas rester sur #builder");
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

    assert.deepEqual(await destinationsVisibles(page), PORTEE_MEMBRE,
      "un membre connecte retrouve la barre entiere");
    /* LA CONNEXION NE DEPLACE PLUS PERSONNE. L'accueil est la page d'arrivee
       de tous : ce sont ses appels a l'action qui changent, pas la vue. */
    assert.equal(await vueActive(page), "home",
      "la connexion laisse le membre sur l'accueil");
    assert.deepEqual(
      await page.locator(".hero-actions button:not([hidden])")
        .evaluateAll(boutons => boutons.map(bouton =>
          bouton.textContent.replace(/\s+/g, " ").trim())),
      ["Ma semaine", "Groupes de boss →", "Explorer les outils →"],
      "l'accueil d'un membre lui propose sa semaine, pas de creer un compte");

    /* LES ONGLETS LOCAUX, ouverts : c'est la seule facon d'atteindre les Dispos,
       donc la seule facon de prouver qu'un membre y a droit. */
    await allerA(page, "boss");
    assert.deepEqual(await ongletsLocauxVisibles(page), ONGLETS_DU_CENTRE_BOSS,
      "le centre Boss ouvert doit rendre ses deux entrees atteignables");
    await page.locator('#localTabs [data-view="availability"]').click();
    assert.equal(await vueActive(page), "availability",
      "un membre connecte atteint les Dispos par les onglets locaux");
    /* Le Wiki appartient a Outils, qui a QUATRE onglets : changer de rubrique
       doit changer le second etage, pas l'effacer. */
    await allerA(page, "wiki");
    assert.deepEqual(await ongletsLocauxVisibles(page),
      ["wiki", "collection", "calculateur", "analyse"],
      "changer de rubrique doit remplacer les onglets du second etage");
    /* Mon roster n'a qu'une vue : un onglet unique n'est plus un choix, la
       barre se tait. */
    await allerA(page, "member-roster");
    assert.equal(
      await page.locator("#localTabsBar").evaluate(el => el.hidden),
      true,
      "une rubrique sans choix doit replier la barre du second etage"
    );

    /* ---- Deconnexion : la barre se referme, et la vue avec elle. ---- */
    await ouvrirLeCompte(page);
    await page.getByRole("button", { name:"Déconnexion", exact:true }).click();
    await page.locator("#accountLogin").waitFor({ state:"visible" });

    assert.deepEqual(await destinationsVisibles(page), PORTEE_VISITEUR,
      "se deconnecter doit refermer les rubriques reservees");
    assert.equal(await vueActive(page), "home",
      "la vue quittee restant publique, la navigation garde le Wiki ouvert "
        + "ou replie sur l'accueil");

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
    await horsLigne.locator('#desktopNav [data-rubrique="mon-roster"]')
      .waitFor({ state:"visible" });

    assert.deepEqual(await destinationsVisibles(horsLigne), PORTEE_MEMBRE,
      "sans Supabase le site est un bac a sable local : tout reste ouvert");
    assert.equal(await vueActive(horsLigne), "home",
      "et la navigation ne bouge pas : l'accueil reste la porte d'entree");
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
