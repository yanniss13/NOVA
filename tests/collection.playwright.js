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
  /* « Le filtre restreint sans vider », mesuré contre le total DERIVE du
     catalogue. Le plafond se passe en argument : le navigateur ne connaît
     aucune variable de ce fichier, et un nombre écrit dans la fonction
     redeviendrait le compte figé qu'on vient de retirer. */
  const attendreRestriction = plafond => page.waitForFunction(
    max => {
      const vues = document.querySelectorAll("#collectionBody .wiki-tile").length;
      return vues > 0 && vues < max;
    },
    plafond
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
    /* LE TOTAL SE DERIVE, il ne s'écrit pas. Ce nombre a valu 238, puis 249,
       puis 252 quand les trois tenues liées de Khala sont entrées au
       catalogue — et à chaque fois le test a menti une fournée durant avant
       qu'on aille le corriger à la main. L'onglet n'énumère rien lui-même :
       il concatène `armesDuWiki()` et `graveesDuWiki()`, soit toutes les
       armes de `DATA.armes` et toutes les pièces de l'emplacement « Armure
       liee ». On compte donc la même chose que la vue, depuis la même
       source. */
    const attendu = await page.evaluate(() => {
      const data = window.SEVEN_DS_DATA || {};
      const armes = Object.values(data.armes || {})
        .reduce((somme, famille) => somme + (famille || []).length, 0);
      const gravees = ((data.armures || {})["Armure liee"] || []).length;
      return { armes, gravees, total:armes + gravees };
    });
    assert.ok(attendu.armes > 0 && attendu.gravees > 0,
      "le catalogue doit porter des armes ET des gravées");
    assert.equal(total, attendu.total,
      "la grille doit lister toutes les armes (" + attendu.armes
        + ") et toutes les gravées (" + attendu.gravees + ") du dépôt");
    /* « 3 / <total> possédés — <reste> à trouver », construit du même total :
       un libellé figé aurait le même défaut que le compte figé. */
    const progressionAttendue = possedes => new RegExp(
      possedes + " \\/ " + total + " possédés — " + (total - possedes)
        + " à trouver"
    );
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
    assert.match(await progression(), progressionAttendue(3));

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

    /* ⚠️ LE CLIGNOTEMENT. Un clic ne doit RECRÉER aucune tuile.

       Le site clignotait pour de vrai : le clic re-rendait, l'écho Realtime de
       notre propre écriture invalidait et re-rendait, et la relecture ainsi
       déclenchée re-rendait encore. Trois fois 220 tuiles en 92 ms, et à chaque
       reconstruction les 27 images visibles repartaient d'un document vide.

       On marque les tuiles présentes ; celles qui n'ont plus la marque après le
       clic sont neuves — ce sont elles qui repeignent. Un `MutationObserver`
       ne suffirait pas : il rapporte un simple DÉPLACEMENT comme un retrait
       suivi d'un ajout, et confondrait les deux. */
    const marquerLesTuiles = () => page.evaluate(() =>
      document.querySelectorAll("#collectionBody .wiki-tile")
        .forEach(noeud => { noeud.dataset.sonde = "1"; })
    );
    const tuilesNeuves = () => page.evaluate(() =>
      document.querySelectorAll(
        "#collectionBody .wiki-tile:not([data-sonde])").length
    );
    await marquerLesTuiles();

    /* Et le compteur de progression ne doit être réécrit QU'UNE fois. C'est la
       trace des rendus surnuméraires : sans le garde d'empreinte, l'écho
       Realtime et sa relecture en déclenchent deux de plus, qui repassent sur
       les 220 objets pour aboutir au même document. */
    await page.evaluate(() => {
      window.__reecrituresProgression = 0;
      new MutationObserver(lots => lots.forEach(lot => {
        if(lot.addedNodes.length) window.__reecrituresProgression++;
      })).observe(document.querySelector("#collectionProgress"),
        { childList:true });
    });

    const cible = await tuiles().first().getAttribute("data-file");
    await tuiles().first().click();
    await page.getByText("marqué comme possédé", { exact:false }).waitFor();
    await attendreTuiles(total - EQUIPEES.length - 1);
    assert.match(await progression(), progressionAttendue(4));
    assert.deepEqual(await lignesEnBase(), ["user-1|" + cible],
      "le marquage doit être une ligne en base, pas un état local");
    assert.equal(await tuileDe(cible).count(), 0,
      "l'objet coché quitte la liste des manquants");

    /* On laisse passer l'écho Realtime et la relecture qu'il déclenchait. */
    await page.waitForTimeout(800);
    assert.equal(await tuilesNeuves(), 0,
      "aucune tuile ne doit être recréée par un clic — c'est le clignotement");
    /* Deux nœuds écrits par rendu : le nombre en gras et le texte qui suit. */
    assert.equal(
      await page.evaluate(() => window.__reecrituresProgression), 2,
      "un clic ne doit produire qu'un seul rendu, pas trois");

    /* Et le filtrage non plus : réduire la grille puis la rétablir doit
       réutiliser les mêmes nœuds, jamais en reconstruire. */
    await marquerLesTuiles();
    await page.fill("#collectionSearch", "hache");
    await page.waitForFunction(() =>
      document.querySelectorAll("#collectionBody .wiki-tile").length < 30);
    assert.equal(await tuilesNeuves(), 0,
      "filtrer ne doit retirer que des tuiles, jamais en reconstruire");
    await page.fill("#collectionSearch", "");
    await attendreTuiles(total - EQUIPEES.length - 1);
    assert.equal(await tuilesNeuves(), 0,
      "revenir à la grille complète doit réattacher les tuiles conservées");

    // ---- Le filtre « Possédés » le retrouve, et un second clic le rend.
    await page.selectOption("#collectionFilterPossession", "possedes");
    await attendreTuiles(EQUIPEES.length + 1);
    assert.equal(await tuileDe(cible).count(), 1);
    await tuileDe(cible).click();
    await page.getByText("remis à trouver", { exact:false }).waitFor();
    await attendreTuiles(EQUIPEES.length);
    assert.deepEqual(await lignesEnBase(), [],
      "décocher doit supprimer la ligne, pas la marquer");
    assert.match(await progression(), progressionAttendue(3));

    /* ---- « Utile à mon roster » : les armes du type que manie un héros du
       roster, et les gravures de ces héros. Meliodas manie l'épée à une main,
       les épées doubles et la hache — ni les livres ni les lances. */
    await page.selectOption("#collectionFilterPossession", "tout");
    await attendreTuiles(total);
    await page.selectOption("#collectionFilterUtiles", "oui");
    await attendreRestriction(total);
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
    /* « INVITÉ » N'APPARAÎT PAS. La politique « à moi ou membre » rend bien sa
       collection lisible à la confrérie — mais un invité n'appartient pas à la
       confrérie, et le proposer ici revenait à le compter parmi nous.

       La liste vient de `refreshRosterProfiles`, qui ne retourne que des
       membres. L'invité, lui, garde son propre accès : la RLS ne lui rend que
       sa ligne, donc son sélecteur ne se vide pas — il n'a simplement personne
       d'autre à regarder, ce qui est exact. */
    assert.deepEqual(
      await champMembre.locator("option").allTextContents(),
      ["Ma collection", "Merlin"]
    );

    await champMembre.selectOption("user-2");
    await page.getByText("Collection de Merlin — lecture seule").waitFor();
    /* Merlin possède le Grimoire (marqué) et le porte (équipé) : la fusion des
       deux ensembles ne doit pas le compter deux fois. */
    assert.match(await progression(), progressionAttendue(1));

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
    await attendreRestriction(total);
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
    assert.match(await progression(), progressionAttendue(3));

    /* ---- KHALA, ET SES TROIS TENUES LIEES.

       La Collection ne connaît que des CHEMINS d'image : c'est la clé unique
       d'un objet dans tout le site. Un héros arrivé par les seules données
       doit donc y entrer sans qu'une ligne de code le nomme — ses tenues
       rejoignent « utile à mon roster » parce qu'il est au roster, et ses
       types d'arme ouvrent leurs dossiers.

       Le LIBELLE est ce qui se vérifie ici. Le chemin de ses tenues porte
       « Khala — » en préfixe pour rester unique dans un dossier partagé ;
       affiché tel quel, il ferait lire le nom du héros deux fois et rangerait
       les trois pièces sous K. On dérive l'attendu de `SEVEN_DS_DATA`, qui
       est la seule source des noms affichables — l'écrire à la main ferait
       de ce test une copie du bug qu'il surveille. */
    await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      state.roster_characters.push({
        owner:"user-1",
        char_id:"khala",
        potential_tier:7,
        builds:{ "Epees doubles":{}, Nunchaku:{}, Gantelets:{} },
        updated_at:"2026-09-17T08:00:00.000Z"
      });
      window.__fakeSupabaseEmit("roster_characters", "INSERT");
    });
    /* On passe par le roster du membre avant de revenir : `relireLeMembre()`
       est asynchrone, et la Collection se rend UNE PREMIERE FOIS sur le roster
       encore périmé. Attendre ici la carte de Khala donne un point d'appui sûr
       — sans lui, le filtre d'utilité se mesurait sur le rendu d'avant et le
       test échouait une fois sur deux pour une raison qui n'est pas la
       sienne. */
    await page.locator('.tab[data-view="member-roster"]').click();
    await page.locator("#memberRosterGrid .member-roster-card", {
      has:page.locator(".member-roster-name", { hasText:"Khala" })
    }).waitFor();
    await page.locator("#tab-collection").click();
    await attendreTuiles(total);

    const tenuesKhala = await page.evaluate(() => {
      const parFichier = new Map();
      Object.values(window.SEVEN_DS_DATA.armures || {}).forEach(liste =>
        liste.forEach(piece => parFichier.set(piece.file, piece.name)));
      return (window.SEVEN_DS_ARMURES_LIEES.khala || []).map(fichier => ({
        fichier,
        nom:parFichier.get(fichier) || null
      }));
    });
    assert.equal(tenuesKhala.length, 3,
      "le catalogue doit lier trois tenues à Khala");
    for(const tenue of tenuesKhala){
      assert.ok(tenue.nom,
        tenue.fichier + " doit porter un libellé dans le catalogue");
      const tuile = tuileDe(tenue.fichier);
      assert.equal(await tuile.count(), 1,
        tenue.fichier + " doit être listée dans la Collection");
      assert.equal(await tuile.locator(".wiki-tile-name").textContent(),
        tenue.nom,
        "la tuile doit porter le libellé du catalogue, pas le nom du fichier");
    }

    await page.selectOption("#collectionFilterUtiles", "oui");
    await attendreRestriction(total);
    const utilesAvecKhala = await tuiles().evaluateAll(noeuds =>
      noeuds.map(noeud => noeud.dataset.file)
    );
    for(const tenue of tenuesKhala){
      assert.ok(utilesAvecKhala.includes(tenue.fichier),
        "« " + tenue.nom + " » doit devenir utile dès que Khala est au roster");
    }
    /* Ses trois types d'arme ouvrent leurs dossiers, par le même pont
       FOLDER_TO_ENUM que ceux de Meliodas : le Nunchaku et les Gantelets
       n'étaient utiles à personne avant elle. */
    const dossiersAvecKhala = [...new Set(utilesAvecKhala
      .map(fichier => fichier.split("/")[1]))].sort();
    assert.deepEqual(
      dossiersAvecKhala,
      ["Armure liee", "Epee 1 main", "Epees doubles", "Gantelets", "Hache",
        "Nunchaku"],
      "les dossiers utiles doivent s'ouvrir aux armes de Khala"
    );
    await page.selectOption("#collectionFilterUtiles", "");
    await attendreTuiles(total);

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
