"use strict";

/* Les etats des deux recensements de l'Analyse qui dependent du reseau, et la
   possession par TENUE GRAVEE, qui ne se lit nulle part ailleurs.

   Le faux Supabase partage reproduit la chaine reelle `from().select()` et
   ses erreurs. Le rendu est exerce dans Chromium : ce test porte sur les
   classes et les libelles effectivement presentes dans l'onglet Analyse. */

const assert = require("node:assert/strict");
const { serveRepo } = require("./helpers/serve");
const { installFakeSupabase } = require("./helpers/faux-supabase");
const { chromium } = require("playwright");

async function ouvrirAnalyse(page, section = "supports"){
  await page.locator('.tab[data-view="analyse"]').click();
  const bouton = page.locator(
    `.analyse-subnav-button[data-analyse-section="${section}"]`
  );
  await bouton.waitFor();
  if(await bouton.getAttribute("aria-pressed") !== "true") await bouton.click();
  const cible = section === "dps"
    ? "#analysePanel-dps .matrix"
    : section === "overview"
      ? "#analysePanel-overview .analyse-summary"
      : "#analysePanel-supports .debuff-row";
  await page.locator(cible).first().waitFor();
}

(async()=>{
  const server = await serveRepo();
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{ width:1280, height:900 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  try{
    await installFakeSupabase(page);
    await page.goto(server.url + "/index.html");
    await page.locator("#authOverlay").waitFor({ state:"visible" });
    await page.locator("#authEmail").fill("yannis@example.test");
    await page.locator("#authPassword").fill("mot-de-passe-test");
    await page.getByRole("button", { name:"Se connecter", exact:true }).click();
    await page.locator("#accountPseudo").getByText("Yannis", { exact:true }).waitFor();

    /* LA SOUS-NAVIGATION MOBILE tient entière dans la largeur utile. Ce rail
       n'est pas la navigation principale : trois choix seulement doivent
       rester visibles ensemble, sans demander un geste horizontal caché. */
    await ouvrirAnalyse(page, "overview");
    assert.match(
      await page.locator("#view-analyse .section-lead").textContent(),
      /soutiens généraux et Foudre/,
      "le texte long doit expliquer que les soutiens ne sont pas tous Foudre"
    );
    for(const width of [320, 360, 390]){
      await page.setViewportSize({ width, height:844 });
      const sousNavigation = await page.locator(".analyse-subnav").evaluate(nav => {
        const box = nav.getBoundingClientRect();
        const buttons = [...nav.querySelectorAll(".analyse-subnav-button")];
        return {
          overflow:nav.scrollWidth - nav.clientWidth,
          documentOverflow:document.scrollingElement.scrollWidth
            - document.scrollingElement.clientWidth,
          overflowX:getComputedStyle(nav).overflowX,
          labels:buttons.map(button => button.textContent.trim()),
          fontSizes:buttons.map(button => parseFloat(getComputedStyle(button).fontSize)),
          widths:buttons.map(button => button.getBoundingClientRect().width),
          heights:buttons.map(button => button.getBoundingClientRect().height),
          buttonsInside:buttons.every(button => {
            const rect = button.getBoundingClientRect();
            return rect.left >= box.left - 1 && rect.right <= box.right + 1;
          })
        };
      });
      assert.deepEqual(
        sousNavigation.labels,
        ["Vue d'ensemble", "DPS par élément", "Soutiens"],
        "le bouton court ne doit pas faire croire que tous les soutiens sont Foudre"
      );
      assert.ok(
        sousNavigation.overflow <= 1
          && sousNavigation.documentOverflow <= 1
          && sousNavigation.overflowX !== "auto",
        `la sous-navigation ne doit pas défiler horizontalement à ${width}px`
      );
      assert.ok(
        Math.max(...sousNavigation.widths) - Math.min(...sousNavigation.widths) <= 1,
        `les trois colonnes doivent être égales à ${width}px`
      );
      assert.ok(
        sousNavigation.fontSizes.every(size => size < 12.5),
        `la police mobile doit être réduite à ${width}px `
          + `(${sousNavigation.fontSizes.join(", ")}px)`
      );
      assert.ok(
        sousNavigation.heights.every(height => height >= 43.5),
        `les cibles tactiles doivent conserver 44px à ${width}px `
          + `(${sousNavigation.heights.join(", ")}px)`
      );
      assert.equal(
        sousNavigation.buttonsInside,
        true,
        `les trois boutons doivent rester dans le rail à ${width}px`
      );
    }
    await page.setViewportSize({ width:1280, height:900 });

    /* LE TRI DE LA MATRICE reste local : il ne relit pas Supabase. Jericho
       donne a Yannis deux DPS, dont un Glace P2. Merlin doit donc passer devant
       sur la colonne Glace grace a son P9, puis ceder la tete au total. */
    await page.evaluate(() => {
      window.__fakeSupabaseState.roster_characters.push({
        owner:"user-1",
        char_id:"jericho",
        potential_tier:2,
        builds:{ Rapiere:{} },
        updated_at:"2026-08-17T08:00:00.000Z"
      });
    });
    await ouvrirAnalyse(page, "overview");
    assert.equal(
      await page.locator("#analysePanel-overview").isVisible(),
      true,
      "la vue d'ensemble doit etre affichee par defaut"
    );
    assert.equal(
      await page.locator("#analysePanel-dps").isHidden(),
      true,
      "la matrice ne doit pas encombrer la vue d'ensemble"
    );
    await page.evaluate(() => {
      window.__fakeSupabaseState.calls.length = 0;
    });
    await page.locator(
      '.analyse-subnav-button[data-analyse-section="dps"]'
    ).click();
    await page.locator("#analysePanel-dps .matrix").waitFor();
    assert.equal(
      await page.evaluate(() => window.__fakeSupabaseState.calls.length),
      0,
      "changer de sous-vue ne doit relire aucune table Supabase"
    );
    const premierMembre = () => page.locator(
      "#analyseBody .matrix .mx-player"
    ).nth(1).textContent();
    assert.equal(await premierMembre(), "Yannis",
      "l'ordre par defaut doit placer le membre qui a le plus de DPS en tete");

    await page.evaluate(() => {
      window.__fakeSupabaseState.calls.length = 0;
    });
    const triGlace = page.locator('#analyseBody .mx-tri[data-elem="ICE"]');
    await triGlace.click();
    assert.equal(await premierMembre(), "Merlin",
      "le meilleur potentiel Glace doit passer en tete");
    assert.equal(
      await triGlace.locator("..").getAttribute("aria-sort"),
      "descending",
      "l'en-tete Glace doit annoncer son ordre descendant"
    );
    assert.equal(
      await page.locator('#analyseBody .matrix th[aria-sort="none"]').count(),
      7,
      "les sept autres elements ne doivent annoncer aucun tri"
    );
    assert.equal(
      await page.evaluate(() => window.__fakeSupabaseState.calls.length),
      0,
      "trier la matrice ne doit relire aucune table Supabase"
    );

    await triGlace.click();
    assert.equal(await premierMembre(), "Yannis",
      "un second clic doit restaurer l'ordre par nombre de DPS");
    assert.equal(
      await page.locator('#analyseBody .matrix th[aria-sort="none"]').count(),
      8,
      "aucune colonne ne doit rester triee apres le second clic"
    );
    assert.equal(
      await page.evaluate(() => window.__fakeSupabaseState.calls.length),
      0,
      "restaurer l'ordre par defaut ne doit pas relire Supabase"
    );

    await page.locator(
      '.analyse-subnav-button[data-analyse-section="supports"]'
    ).click();
    const elementsDuRecensement = await page.locator(
      "#analysePanel-supports .debuff-row .elem-badge"
    ).allTextContents();
    assert.ok(elementsDuRecensement.length > 0);
    assert.ok(
      elementsDuRecensement.every(label => ["Tous", "Foudre"].includes(label.trim())),
      "l'Analyse ne doit lister que les supports generaux ou Foudre"
    );
    assert.equal(
      await page.locator("#analysePanel-supports .debuff-row .elem-badge")
        .filter({hasNotText:/^(Tous|Foudre)$/}).count(),
      0,
      "Feu, Tenebres et les autres elements doivent etre absents"
    );

    /* Une lecture reussie et vide affirme que personne ne possede l'effet. */
    await page.evaluate(() => {
      window.__fakeSupabaseState.roster_characters = [];
    });
    await ouvrirAnalyse(page);
    const lignes = page.locator("#analyseBody .debuff-row");
    const nombreDeLignes = await lignes.count();
    assert.ok(nombreDeLignes > 0, "le catalogue doit rester visible sans roster");
    assert.equal(
      await page.locator("#analyseBody .debuff-row.db-absente").count(),
      nombreDeLignes,
      "une lecture vide doit griser chaque effet absent"
    );
    assert.equal(
      await page.getByText("Personne", { exact:true }).count(),
      nombreDeLignes,
      "une lecture vide doit annoncer une absence certaine"
    );

    /* Une erreur ne dit rien de la possession : elle ne doit pas ressembler
       au roster vide ci-dessus. */
    await page.locator('.tab[data-view="builder"]').click();
    await page.evaluate(() => {
      window.__fakeSupabaseState.bossReadFailureOnce = {
        table:"roster_characters",
        message:"Echec roster simule"
      };
    });
    await ouvrirAnalyse(page);
    await page.waitForFunction(() =>
      window.__fakeSupabaseState.bossReadFailureOnce === null
    );
    assert.equal(
      await page.locator("#analyseBody .debuff-row.db-absente").count(),
      0,
      "une lecture en erreur ne doit griser aucun effet"
    );
    assert.equal(
      await page.getByText("Porteurs indisponibles", { exact:true }).count(),
      nombreDeLignes,
      "une lecture en erreur doit signaler une possession inconnue"
    );
    assert.equal(
      await page.getByText("Personne", { exact:true }).count(),
      0,
      "une erreur ne doit jamais annoncer une absence certaine"
    );

    /* P0 est un potentiel renseigne, pas une valeur manquante. */
    await page.locator('.tab[data-view="builder"]').click();
    await page.evaluate(() => {
      window.__fakeSupabaseState.roster_characters = [{
        owner:"user-1",
        char_id:"escanor",
        potential_tier:0,
        builds:{ "Epee 2 mains":{} },
        updated_at:"2026-08-16T12:00:00.000Z"
      }];
    });
    await ouvrirAnalyse(page);
    const escanor = page.locator("#analyseBody .debuff-row")
      .filter({ hasText:"Escanor" });
    assert.equal(await escanor.count(), 1, "Escanor doit avoir une ligne");
    assert.equal(
      await escanor.locator(".db-porteur").textContent(),
      "Yannis P0",
      "le potentiel zero doit etre affiche comme tout potentiel renseigne"
    );

    /* LE MEMBRE SOUTIEN-SEULEMENT, et c'est lui qui justifie tout le retrait
       du filtre DPS de rosterDerivedPlayers().

       King au Grimoire est de role Gardien : il ne produit aucune entree DPS,
       donc l'ancien filtre ecartait son proprietaire de l'analyse entiere.
       Il porte pourtant la Marque de la foret. Sans ce cas, rien ne verifiait
       que la vue passe bien la liste NON filtree au recensement - et la
       regression serait passee inapercue, le test P0 ci-dessus utilisant
       Escanor, qui est un DPS. */
    await page.locator('.tab[data-view="builder"]').click();
    await page.evaluate(() => {
      window.__fakeSupabaseState.roster_characters = [{
        owner:"user-1",
        char_id:"king",
        potential_tier:6,
        builds:{ "Livre":{} },
        updated_at:"2026-08-16T12:00:00.000Z"
      }];
    });
    await ouvrirAnalyse(page);
    const king = page.locator("#analyseBody .debuff-row")
      .filter({ hasText:"King" });
    assert.equal(await king.count(), 1, "King doit avoir une ligne");
    assert.equal(
      await king.locator(".db-porteur").textContent(),
      "Yannis P6",
      "un membre sans aucun DPS doit tout de meme etre compte comme porteur"
    );
    assert.equal(
      await king.locator(".db-personne").count(),
      0,
      "sa ligne ne doit plus annoncer une absence"
    );
    /* Et la consigne reste : sans aucun DPS, l'onglet doit encore dire quoi
       faire, au lieu d'aligner des sections vides. */
    assert.equal(
      await page.getByText("Rien à analyser", { exact:true }).count(),
      0,
      "un roster non vide ne doit pas afficher l'etat vide"
    );

    /* Aucun roster du tout : la consigne revient, et le recensement reste. */
    await page.locator('.tab[data-view="builder"]').click();
    await page.evaluate(() => {
      window.__fakeSupabaseState.roster_characters = [];
    });
    await ouvrirAnalyse(page);
    assert.equal(
      await page.getByText("Rien à analyser", { exact:true }).count(),
      1,
      "sans aucun roster, la consigne doit dire ou ajouter des personnages"
    );
    assert.ok(
      await page.locator("#analyseBody .debuff-row").count() > 0,
      "la consigne ne doit pas emporter le recensement avec elle"
    );

    /* LA POSSESSION PAR TENUE GRAVEE, qui n'obeit pas a la regle des armes :
       ce n'est pas le couple personnage + arme qui compte, mais le fichier
       d'armure REELLEMENT equipe dans un build - et le niveau de son passif,
       parce que la valeur en depend du simple au tiers pres. */
    await page.locator('.tab[data-view="builder"]').click();
    await page.evaluate(() => {
      window.__fakeSupabaseState.roster_characters = [{
        owner:"user-1",
        char_id:"drake",
        potential_tier:9,
        builds:{
          "Baton":{
            armor:{ "Armure liee":"7ds-armures-ssr/Armure liee/Chevalier impérial.webp" },
            armorConfig:{ "Armure liee":{ passiveLevel:2 } }
          }
        },
        updated_at:"2026-08-16T12:00:00.000Z"
      }];
    });
    await ouvrirAnalyse(page);
    const imperial = page.locator('#analyseBody .debuff-row[data-source="tenue"]')
      .filter({ hasText:"Chevalier impérial" }).first();
    assert.ok(await imperial.count() > 0,
      "la tenue gravee doit nommer la tenue, pas une arme");
    assert.equal(
      await imperial.getAttribute("data-vise"),
      "allies",
      "un passif qui renforce l'equipe appartient au second recensement"
    );
    /* CE QUE CE MEMBRE APPORTE, et non ce que la tenue rend au maximum.

       « Coups de Pulsion : dégâts de Foudre des alliés +20 % » vaut
       [12, 16, 20] %
       selon le niveau du passif. Le membre l'a declare au niveau 2 : sa ligne
       doit donc annoncer +16 %, pas +20 %, et surtout pas un « N2 » qui
       laissait le calcul a faire. */
    assert.match(
      await imperial.locator(".db-libelle").textContent(),
      /\+20 %/,
      "le libelle continue d'annoncer le maximum de la tenue"
    );
    assert.equal(
      await imperial.locator(".db-porteur").first().textContent(),
      "Yannis P9 · +16 %",
      "le porteur annonce la valeur A SON niveau, pas le maximum de la tenue"
    );
    assert.equal(
      await imperial.locator(".db-porteur").first().getAttribute("title"),
      "Passif de niveau 2 sur 3",
      "le niveau reste lisible, mais il cede la place a la valeur qu'il vaut"
    );
    /* Le libelle d'une tenue annonce son MAXIMUM : la ligne doit le dire,
       sinon elle promet a tout le monde ce que seul un niveau 3 rend. */
    assert.ok(await imperial.locator(".db-au-max").count() > 0,
      "une ligne de tenue doit signaler que son libelle vaut au niveau 3");

    /* Niveau non renseigne : dit, jamais suppose. */
    await page.locator('.tab[data-view="builder"]').click();
    await page.evaluate(() => {
      window.__fakeSupabaseState.roster_characters[0].builds.Baton.armorConfig = {};
      window.__fakeSupabaseEmit("roster_characters", "UPDATE");
    });
    await ouvrirAnalyse(page);
    assert.equal(
      await page.locator('#analyseBody .debuff-row[data-source="tenue"]')
        .filter({ hasText:"Chevalier impérial" }).first()
        .locator(".db-porteur").first().textContent(),
      "Yannis P9 · niv. ?",
      "un niveau absent se dit, il ne se remplace pas par le maximum"
    );

    /* ===== LE GROUPEMENT PAR PERSONNAGE, ET L'ORDRE QU'IL PORTE. =====

       Gil Thunder tient trois lignes contre la cible, une par arme. Un membre
       qui ne joue que son Epee a une main n'en apporte QU'UNE - c'est ce qui
       fait de lui le bon cas : le groupe doit remonter en tete de section, la
       ligne portee doit ouvrir le groupe, et les deux autres rester la, grises,
       sans repeter son nom.

       Le tri alphabetique d'origine l'aurait laisse entre Escanor et Gowther,
       ses trois lignes melees a vingt-cinq que personne ne porte. */
    await page.locator('.tab[data-view="builder"]').click();
    await page.evaluate(() => {
      window.__fakeSupabaseState.roster_characters = [{
        owner:"user-1",
        char_id:"gil-thunder",
        potential_tier:5,
        builds:{ "Epee 1 main":{} },
        updated_at:"2026-08-16T12:00:00.000Z"
      }];
    });
    await ouvrirAnalyse(page);

    /* La premiere liste est celle de l'affaiblissement : les deux sections
       sont rendues dans l'ordre de SECTIONS_DU_RECENSEMENT. */
    const affaiblissement = page.locator("#analyseBody .debuff-list").first();
    const gil = affaiblissement
      .locator('.debuff-groupe[data-support="gil-thunder"]');
    assert.equal(await gil.locator(".debuff-row").count(), 3,
      "les trois effets d'un meme personnage tiennent dans un seul groupe");
    assert.equal(
      await affaiblissement.locator(".debuff-groupe").first()
        .getAttribute("data-support"),
      "gil-thunder",
      "le seul groupe que la confrerie porte doit ouvrir la section"
    );
    assert.equal(await gil.locator(".db-nom").count(), 1,
      "le nom ne s'ecrit qu'une fois : trois lignes de suite ne l'apprenaient a personne");
    assert.equal(await gil.locator(".db-nom").textContent(), "Gil Thunder");
    assert.equal(await gil.locator(".debuff-row.db-suite").count(), 2,
      "les lignes qui suivent la tete de groupe se signalent comme telles");

    const teteDuGroupe = gil.locator(".debuff-row").first();
    assert.equal(
      await teteDuGroupe.locator(".db-origine").textContent(),
      "Épée à une main",
      "dans le groupe aussi, la ligne portee passe devant celles que personne n'a"
    );
    assert.equal(
      await teteDuGroupe.locator(".db-porteur").textContent(),
      "Yannis P5",
      "et c'est bien l'arme possedee qui lui vaut sa place"
    );
    assert.equal(
      await gil.locator(".debuff-row.db-absente").count(),
      2,
      "les deux armes qu'il ne joue pas restent visibles, mais effacees"
    );

    /* Le compte epargne de parcourir soixante lignes pour se situer. Il se
       derive de la table, comme partout ailleurs : un effet ajoute demain ne
       doit pas casser ce test sans raison. */
    const totalContreLaCible = await page.evaluate(() => {
      const armes = Object.values(window.SEVEN_DS_BUFFS_SUPPORTS || {}).flat()
        .filter(ligne => ligne.cible === "ennemi"
          && (!ligne.element || ligne.element === "thunder")).length;
      const tenues = Object.values(window.SEVEN_DS_PASSIFS_GRAVES || {}).flat()
        .filter(passif => passif.cible === "allies" && passif.cibleEnnemi
          && (!passif.element || passif.element === "thunder")).length;
      return armes + tenues;
    });
    assert.equal(
      await page.locator("#analyseBody .db-compte").first().textContent(),
      "1 effet porté sur " + totalContreLaCible + " par la confrérie",
      "la section annonce ce que la confrerie couvre avant de derouler la liste"
    );

    assert.deepEqual(errors, [], "aucune erreur de page");
    console.log("analyse-recensements.playwright.js OK");
  }finally{
    await browser.close();
    await server.close();
  }
})().catch(error=>{
  console.error(error);
  process.exitCode = 1;
});
