"use strict";

/* Le suivi de collection dans un vrai navigateur.

   Ce que ce parcours prouve, et qu'aucun test unitaire ne peut prouver : que
   le clic ecrit vraiment dans Supabase, que la tuile disparait de « À trouver »
   APRES la reponse et pas avant, et qu'une piece equipee resiste au clic.

   Le faux Supabase est celui de `helpers/faux-supabase.js`, partage avec
   `supabase-etape1.playwright.js` : deux harnais auraient fini par diverger. */

const assert = require("node:assert/strict");
const { serveRepo } = require("./helpers/serve");
const { installFakeSupabase } = require("./helpers/faux-supabase");
const { chromium } = require("playwright");

/* Le roster semé par le faux : Meliodas (user-1) porte ces trois armes. Elles
   doivent donc apparaître possédées sans qu'on ait rien coché. */
const EQUIPEES = [
  "7ds-armes/Hache/Hache à l'aura triomphale.webp",
  "7ds-armes/Epee 1 main/En plein cœur !.webp",
  "7ds-armes/Epees doubles/Épées doubles bénies.webp"
];

(async()=>{
  const server = await serveRepo();
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{ width:1440, height:1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  const tuiles = () => page.locator("#collectionBody .wiki-tile");
  const tuileDe = fichier =>
    page.locator('#collectionBody .wiki-tile[data-file="' + fichier + '"]');
  const lignesEnBase = () => page.evaluate(() =>
    window.__fakeSupabaseState.collection_items.map(row => row.owner + "|" + row.item)
  );
  const ecrituresCollection = () => page.evaluate(() =>
    window.__fakeSupabaseState.calls.filter(appel =>
      appel.table === "collection_items" && appel.operation !== "select"
    ).length
  );
  const progression = () => page.locator("#collectionProgress").textContent();
  const attendreTuiles = nombre => page.waitForFunction(
    attendu =>
      document.querySelectorAll("#collectionBody .wiki-tile").length === attendu,
    nombre
  );

  try{
    await installFakeSupabase(page);
    await page.goto(server.url + "/index.html");

    /* Déconnecté, la grille se consulte mais rien ne se coche : la collection
       vit dans Supabase, et un clic sans effet serait pire qu'un clic annoncé
       impossible. */
    await page.locator("#authOverlay").waitFor({ state:"visible" });
    await page.getByRole("button",
      { name:"Continuer hors connexion", exact:true }).click();
    await page.locator("#tab-collection").click();
    await tuiles().first().waitFor();
    const total = await tuiles().count();
    assert.equal(total, 223, "les armes et les armures gravées du dépôt");
    assert.match(await page.locator("#collectionState").textContent(),
      /Connecte-toi pour cocher/);
    await tuiles().first().click();
    assert.deepEqual(await lignesEnBase(), [],
      "sans compte, aucun clic ne doit écrire");

    // ---- Connexion, puis l'état d'arrivée : tout est à trouver sauf l'équipé.
    await page.locator("#accountLogin").click();
    await page.locator("#authEmail").fill("yannis@example.test");
    await page.locator("#authPassword").fill("mot-de-passe-test");
    await page.getByRole("button", { name:"Se connecter", exact:true }).click();
    await page.locator("#accountPseudo")
      .getByText("Yannis", { exact:true }).waitFor();

    await page.locator("#tab-collection").click();
    await page.locator("#view-collection").waitFor({ state:"visible" });
    /* Le roster se relit à l'ouverture de l'onglet : les trois armes portées
       quittent « À trouver » sans qu'on ait rien coché. */
    await attendreTuiles(total - EQUIPEES.length);
    assert.match(await progression(), /3 \/ 223 possédés — 220 à trouver/);

    /* Une pièce équipée est possédée d'office, verrouillée, et résiste au
       clic : se dire non possédant de ce qu'on équipe serait se contredire. */
    await page.selectOption("#collectionFilterPossession", "tout");
    await attendreTuiles(total);
    for(const fichier of EQUIPEES){
      const tuile = tuileDe(fichier);
      assert.equal(await tuile.count(), 1, fichier + " doit être listée");
      assert.ok(await tuile.evaluate(noeud =>
        noeud.classList.contains("collection-owned")
        && noeud.classList.contains("collection-locked")
        && noeud.disabled
      ), fichier + " doit être possédée, verrouillée et inerte");
    }
    await tuileDe(EQUIPEES[0]).click({ force:true });
    assert.deepEqual(await lignesEnBase(), [],
      "cliquer une pièce équipée ne doit rien écrire");

    // ---- Le geste : cocher un objet le retire de « À trouver ».
    await page.selectOption("#collectionFilterPossession", "manquants");
    await attendreTuiles(total - EQUIPEES.length);
    const cible = await tuiles().first().getAttribute("data-file");
    await tuiles().first().click();
    await page.getByText("marqué comme possédé", { exact:false }).waitFor();
    await attendreTuiles(total - EQUIPEES.length - 1);
    assert.match(await progression(), /4 \/ 223 possédés — 219 à trouver/);
    assert.deepEqual(await lignesEnBase(), ["user-1|" + cible],
      "le marquage doit être une ligne en base, pas un état local");
    assert.equal(await tuileDe(cible).count(), 0,
      "l'objet coché quitte la liste des manquants");

    // ---- Le filtre « Possédés » le retrouve, et un second clic le rend.
    await page.selectOption("#collectionFilterPossession", "possedes");
    await attendreTuiles(EQUIPEES.length + 1);
    assert.equal(await tuileDe(cible).count(), 1);
    await tuileDe(cible).click();
    await page.getByText("remis à trouver", { exact:false }).waitFor();
    await attendreTuiles(EQUIPEES.length);
    assert.deepEqual(await lignesEnBase(), [],
      "décocher doit supprimer la ligne, pas la marquer");
    assert.match(await progression(), /3 \/ 223 possédés — 220 à trouver/);

    /* ---- « Utile à mon roster » : les armes du type que manie un héros du
       roster, et les gravures de ces héros. Meliodas manie l'épée à une main,
       les épées doubles et la hache — ni les livres ni les lances. */
    await page.selectOption("#collectionFilterPossession", "tout");
    await attendreTuiles(total);
    await page.selectOption("#collectionFilterUtiles", "oui");
    await page.waitForFunction(() =>
      document.querySelectorAll("#collectionBody .wiki-tile").length > 0
      && document.querySelectorAll("#collectionBody .wiki-tile").length < 223
    );
    const utiles = await tuiles().count();
    assert.ok(utiles > 0 && utiles < total,
      "le filtre doit restreindre sans vider : " + utiles + " sur " + total);
    const dossiers = await tuiles().evaluateAll(noeuds =>
      [...new Set(noeuds.map(noeud => noeud.dataset.file.split("/")[1]))].sort()
    );
    /* ⚠️ Le piège des deux vocabulaires : `weaponTypesOf` rend des noms de
       DOSSIER (« Hache »), les objets portent un ENUM (« Axe »). Sans le pont
       FOLDER_TO_ENUM, cette liste serait vide — en silence. */
    assert.deepEqual(dossiers, ["Armure liee", "Epee 1 main", "Epees doubles", "Hache"],
      "seuls les types maniés par le roster et ses gravures");

    /* ---- La collection d'un AUTRE membre : consultable, jamais modifiable.
       Merlin possède un objet et manie le livre ; Meliodas ni l'un ni l'autre. */
    await page.selectOption("#collectionFilterUtiles", "");
    await page.evaluate(() => {
      window.__fakeSupabaseState.collection_items.push({
        owner:"user-2",
        item:"7ds-armes/Livre/Grimoire béni.webp",
        created_at:"2026-07-25T11:30:00.000Z"
      });
    });
    await attendreTuiles(total);

    const champMembre = page.locator("#collectionOwner");
    assert.equal(await page.locator("#collectionOwnerField").isVisible(), true,
      "le sélecteur apparaît dès qu'il y a quelqu'un d'autre à regarder");
    assert.deepEqual(
      await champMembre.locator("option").allTextContents(),
      ["Ma collection", "Merlin"]
    );

    await champMembre.selectOption("user-2");
    await page.getByText("Collection de Merlin — lecture seule").waitFor();
    /* Merlin possède le Grimoire (marqué) et le porte (équipé) : la fusion des
       deux ensembles ne doit pas le compter deux fois. */
    assert.match(await progression(), /1 \/ 223 possédés — 222 à trouver/);

    /* Le Grimoire est à la fois MARQUÉ et ÉQUIPÉ par Merlin : la fusion des
       deux ensembles ne doit pas le compter deux fois — d'où le 1 ci-dessus. */
    assert.ok(await tuileDe("7ds-armes/Livre/Grimoire béni.webp")
      .evaluate(noeud => noeud.classList.contains("collection-owned")),
      "possédé par Merlin");

    /* La lecture seule se vérifie sur une tuile LIBRE : le Grimoire est équipé,
       donc verrouillé pour une tout autre raison, et cliquer dessus ne
       prouverait rien.

       Et on compte les ÉCRITURES, pas l'état final : décocher la ligne d'un
       autre supprimerait `owner = moi AND item = …`, qui n'existe pas — la
       base serait inchangée et une assertion naïve passerait alors qu'un ordre
       est bel et bien parti. */
    await page.selectOption("#collectionFilterPossession", "manquants");
    await attendreTuiles(total - 1);
    const libre = await tuiles().first().getAttribute("data-file");
    const ecrituresAvant = await ecrituresCollection();
    await tuiles().first().click({ force:true });
    await page.waitForTimeout(250);
    assert.equal(await ecrituresCollection(), ecrituresAvant,
      "consulter autrui ne doit envoyer aucune écriture (" + libre + ")");
    assert.deepEqual(await lignesEnBase(), ["user-2|7ds-armes/Livre/Grimoire béni.webp"],
      "et ne rien changer en base");
    await page.selectOption("#collectionFilterPossession", "tout");
    await attendreTuiles(total);

    /* Le filtre d'utilité se rapporte au roster AFFICHÉ, pas à celui qui
       regarde — et son libellé doit le dire. */
    assert.equal(
      await page.locator('#collectionFilterUtiles option[value="oui"]')
        .textContent(),
      "Utile au roster de Merlin"
    );
    await page.selectOption("#collectionFilterUtiles", "oui");
    await page.waitForFunction(() => {
      const tuilesVues = [...document.querySelectorAll("#collectionBody .wiki-tile")];
      return tuilesVues.length > 0 && tuilesVues.length < 223;
    });
    const dossiersMerlin = await tuiles().evaluateAll(noeuds =>
      [...new Set(noeuds.map(noeud => noeud.dataset.file.split("/")[1]))].sort()
    );
    /* Baguette, Bâton et Livre sont TROIS dossiers pour UN type — l'enum
       « Book ». Le filtre raisonne sur le type manié, pas sur le dossier :
       attendre le seul « Livre » serait confondre l'image et la règle. */
    assert.deepEqual(dossiersMerlin, ["Armure liee", "Baguette", "Baton", "Livre"],
      "le roster de Merlin, pas celui du visiteur");

    // Revenir sur soi rend le geste, et le décompte de départ.
    await champMembre.selectOption("");
    await page.getByText("Collection de Merlin — lecture seule")
      .waitFor({ state:"hidden" });
    await page.selectOption("#collectionFilterUtiles", "");
    await attendreTuiles(total);
    assert.match(await progression(), /3 \/ 223 possédés — 220 à trouver/);

    assert.deepEqual(errors, [], "aucune erreur de page");
    console.log("PASS Playwright: collection, marquage, verrou et filtres");
  }finally{
    await browser.close();
    await server.close();
  }
})().catch(error=>{
  console.error(error);
  process.exitCode = 1;
});
