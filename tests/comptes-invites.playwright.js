"use strict";

/* Ce qu'un invité voit, et ce qu'il ne voit pas.

   Ce parcours ne prouve pas la sécurité — elle vit dans la RLS, et
   `tests/comptes-invites-schema.test.js` la lit. Il prouve autre chose, que
   seul un navigateur peut montrer : qu'un invité ne se cogne pas à six écrans
   vides avant de comprendre qu'ils ne sont pas pour lui. */

const assert = require("node:assert/strict");
const { serveRepo } = require("./helpers/serve");
const { installFakeSupabase } = require("./helpers/faux-supabase");
const { chromium } = require("playwright");

const ONGLETS_INVITE = [
  "builder", "member-roster", "wiki", "collection", "calculateur"
];
const ONGLETS_MEMBRE = [
  "dashboard", "builder", "roster", "member-roster",
  "analyse", "wiki", "collection", "calculateur"
];

/* `getClientRects()` et non l'attribut `hidden` : on veut savoir ce que l'oeil
   voit, pas ce que le code a ecrit. */
const ongletsVisibles = page => page.evaluate(() =>
  [...document.querySelectorAll(".tabs .tab[data-view]")]
    .filter(onglet => onglet.getClientRects().length > 0)
    .map(onglet => onglet.dataset.view)
);

const vueActive = page => page.evaluate(() => {
  const vue = document.querySelector(".view.active");
  return vue ? vue.id.replace(/^view-/, "") : null;
});

/* La modale s'ouvre d'elle-meme au chargement et apres chaque deconnexion :
   cliquer « Connexion » par-dessus taperait dans son fond et n'ouvrirait
   rien. On ne le fait donc que si elle est deja refermee. */
async function connecter(page, email){
  const modale = page.locator("#authOverlay");
  if(!(await modale.isVisible())) await page.locator("#accountLogin").click();
  await modale.waitFor({ state:"visible" });
  await page.locator("#authEmail").fill(email);
  await page.locator("#authPassword").fill("mot-de-passe-test");
  await page.getByRole("button", { name:"Se connecter", exact:true }).click();
}

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

    /* ---- L'invité : son roster, et rien de la confrérie. ---- */
    await connecter(page, "invite@example.test");
    await page.locator("#accountPseudo")
      .getByText("Invité", { exact:true }).waitFor();

    assert.deepEqual(await ongletsVisibles(page), ONGLETS_INVITE,
      "un invité garde son roster et les pages publiques, rien d'autre");
    assert.equal(await vueActive(page), "member-roster",
      "la connexion doit le poser sur son roster, pas sur un Wiki");

    /* LA ROUTE, et pas seulement l'onglet : un onglet masqué ne protège que la
       souris.

       On passe par un lien interne — `a[data-app-route]`, le seul chemin que
       `js/vues/routage.js` écoute — et non par une écriture de
       `location.hash`, que rien n'observe : la page ne bougerait pas et le
       test passerait sans rien prouver.

       On part du Wiki pour que le repli soit une TRANSITION observable. Rester
       sur le roster prouverait la même chose que ne rien faire. */
    await page.locator('.tabs .tab[data-view="wiki"]').click();
    await page.locator("#view-wiki").waitFor({ state:"visible" });
    await page.evaluate(() => {
      const lien = document.createElement("a");
      lien.id = "lienTestAnalyse";
      lien.href = "#analyse";
      lien.setAttribute("data-app-route", "");
      lien.textContent = "Analyse";
      document.body.appendChild(lien);
    });
    await page.locator("#lienTestAnalyse").click();
    await page.locator("#view-member-roster").waitFor({ state:"visible" });
    assert.equal(await vueActive(page), "member-roster",
      "l'Analyse ne doit pas s'ouvrir, et le repli mène au roster de l'invité");
    /* `isVisible` et non l'attribut `hidden` : la modale s'ouvre et se ferme
       par une classe, et lire le mauvais champ ferait passer ce test quoi
       qu'il arrive. */
    assert.equal(
      await page.locator("#authOverlay").isVisible(),
      false,
      "un invité connecté n'a rien à faire d'une fenêtre de connexion"
    );
    await page.evaluate(() => {
      const lien = document.querySelector("#lienTestAnalyse");
      if(lien) lien.remove();
    });

    /* ---- Le membre : la barre entière revient. ---- */
    await page.getByRole("button", { name:"Déconnexion", exact:true }).click();
    await page.locator("#accountLogin").waitFor({ state:"visible" });
    await connecter(page, "yannis@example.test");
    await page.locator("#accountPseudo")
      .getByText("Yannis", { exact:true }).waitFor();

    assert.deepEqual(await ongletsVisibles(page), ONGLETS_MEMBRE,
      "un membre retrouve la barre entière");
    assert.equal(await vueActive(page), "dashboard",
      "un membre atterrit sur le suivi, comme avant");

    assert.deepEqual(errors, [], "aucune erreur de page");
    console.log("comptes-invites.playwright.js OK");
  }finally{
    await browser.close();
    await server.close();
  }
})().catch(error=>{
  console.error(error);
  process.exitCode = 1;
});
