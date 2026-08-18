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
      /soutiens de tous les éléments/,
      "le texte long doit annoncer le recensement complet"
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

    /* FILTRE PAR MEMBRE : cocher un sous-groupe restreint la matrice a ses
       lignes, pour comparer. On ajoute un TROISIEME membre afin de prouver que
       les autres disparaissent vraiment — deux coches sur trois. */
    await page.evaluate(() => {
      window.__fakeSupabaseState.profiles.push({ id:"user-3", pseudo:"Escanor" });
      window.__fakeSupabaseState.roster_characters.push({
        owner:"user-3",
        char_id:"jericho",
        potential_tier:5,
        builds:{ Rapiere:{} },
        updated_at:"2026-08-17T09:00:00.000Z"
      });
    });
    await ouvrirAnalyse(page, "dps");
    const nomsDeLignes = () => page.locator(
      "#analysePanel-dps .matrix td.mx-player"
    ).allTextContents();
    const puceMembre = nom => page.locator(
      "#analysePanel-dps .matrix-membre"
    ).filter({ hasText:new RegExp("^" + nom + "$") });
    const puceTous = page.locator("#analysePanel-dps .matrix-membre-tous");

    assert.deepEqual(
      (await page.locator("#analysePanel-dps .matrix-membre").allTextContents())
        .sort(),
      ["Escanor", "Merlin", "Tous", "Yannis"],
      "une puce par membre, plus « Tous »"
    );
    assert.equal((await nomsDeLignes()).length, 3,
      "sans filtre, les trois membres s'affichent");
    assert.equal(await puceTous.getAttribute("aria-pressed"), "true",
      "« Tous » est actif tant qu'aucun membre n'est coche");

    await page.evaluate(() => { window.__fakeSupabaseState.calls.length = 0; });
    await puceMembre("Merlin").click();
    await puceMembre("Escanor").click();
    assert.deepEqual(
      (await nomsDeLignes()).sort(),
      ["Escanor", "Merlin"],
      "cocher Merlin et Escanor masque Yannis"
    );
    assert.equal(await puceTous.getAttribute("aria-pressed"), "false",
      "« Tous » n'est plus actif quand un membre est coche");
    assert.equal(
      await page.evaluate(() => window.__fakeSupabaseState.calls.length),
      0,
      "filtrer par membre ne doit relire aucune table Supabase"
    );

    await puceMembre("Tous").click();
    assert.equal((await nomsDeLignes()).length, 3,
      "« Tous » restaure les trois membres");
    /* On retire le membre d'appoint : les tests mobiles suivants raisonnent sur
       la confrerie d'origine. */
    await page.evaluate(() => {
      window.__fakeSupabaseState.profiles =
        window.__fakeSupabaseState.profiles.filter(p => p.id !== "user-3");
      window.__fakeSupabaseState.roster_characters =
        window.__fakeSupabaseState.roster_characters.filter(r => r.owner !== "user-3");
    });
    await ouvrirAnalyse(page, "dps");

    /* SUR TELEPHONE, chaque membre devient une carte : son nom et son total
       restent en tete, puis les huit elements tiennent en quatre colonnes.
       Le tableau semantique reste unique afin que les actions de build et la
       restitution du focus ne soient jamais dupliquees. */
    await page.setViewportSize({ width:390, height:844 });
    const triMobile = page.locator("#analysePanel-dps .matrix-mobile-sort-select");
    assert.equal(await triMobile.isVisible(), true,
      "le tri doit rester disponible au-dessus des cartes mobiles");
    assert.deepEqual(
      await triMobile.locator("option").allTextContents(),
      ["Total", "Feu", "Glace", "Vent", "Terre", "Lumière", "Ténèbres", "Foudre", "Physique"],
      "le tri mobile doit proposer le total et les huit elements"
    );
    await page.evaluate(() => {
      window.__fakeSupabaseState.calls.length = 0;
    });
    await triMobile.focus();
    /* On MARQUE le noeud du select avant de trier. S'il survit au rendu, c'est
       qu'on ne l'a pas reconstruit : reconstruire puis rappeler `.focus()`
       rouvrait le picker natif sur mobile a chaque choix. Le focus conserve, a
       lui seul, ne le prouve pas — un select neuf refocalise le passerait. */
    await page.evaluate(() => {
      document.querySelector(".matrix-mobile-sort-select").dataset.probeTri = "1";
    });
    await triMobile.selectOption("ICE");
    assert.equal(await premierMembre(), "Merlin",
      "le tri mobile Glace doit placer le meilleur potentiel en tete");
    assert.equal(
      await page.evaluate(() => document.activeElement.matches(
        ".matrix-mobile-sort-select"
      )),
      true,
      "le tri mobile doit conserver le focus apres le rendu"
    );
    assert.equal(
      await page.evaluate(() =>
        document.querySelector(".matrix-mobile-sort-select").dataset.probeTri
      ),
      "1",
      "le select de tri doit rester le meme noeud (sinon le picker se rouvre sur mobile)"
    );
    assert.equal(
      await page.evaluate(() => window.__fakeSupabaseState.calls.length),
      0,
      "le tri mobile ne doit relire aucune table Supabase"
    );
    await triMobile.selectOption("total");
    assert.equal(await premierMembre(), "Yannis",
      "le tri Total mobile doit restaurer l'ordre par nombre de DPS");

    for(const width of [320, 390, 640]){
      await page.setViewportSize({ width, height:844 });
      const carteMobile = await page.locator(
        "#analysePanel-dps .matrix .mx-player-card"
      ).first().evaluate(card => {
        const matrix = card.closest(".matrix");
        const wrap = card.closest(".matrix-wrap");
        const cells = [...card.querySelectorAll("td[data-mx-element]")];
        const labels = [...card.querySelectorAll(".mx-element-label")];
        const tops = cells.map(cell => Math.round(cell.getBoundingClientRect().top));
        const lignes = [...new Set(tops)];
        const rect = card.getBoundingClientRect();
        const wrapRect = wrap.getBoundingClientRect();
        return {
          display:getComputedStyle(card).display,
          headerDisplay:getComputedStyle(matrix.querySelector(".mx-header-row")).display,
          elementCount:cells.length,
          labels:labels.map(label => ({
            text:label.textContent.trim(),
            display:getComputedStyle(label).display,
            color:getComputedStyle(label).color
          })),
          cellsPerLine:lignes.map(top => tops.filter(value => value === top).length),
          cardInside:rect.left >= wrapRect.left - 1 && rect.right <= wrapRect.right + 1,
          cardFills:Math.abs(rect.width - wrapRect.width) <= 2,
          wrapOverflow:wrap.scrollWidth - wrap.clientWidth,
          matrixOverflow:matrix.scrollWidth - matrix.clientWidth,
          documentOverflow:document.scrollingElement.scrollWidth
            - document.scrollingElement.clientWidth,
          actionHeights:[...card.querySelectorAll(".mx-action")]
            .map(action => action.getBoundingClientRect().height)
        };
      });
      assert.equal(carteMobile.display, "grid",
        `chaque membre doit devenir une carte a ${width}px`);
      assert.equal(carteMobile.headerDisplay, "none",
        `l'en-tete du tableau doit ceder la place aux libelles des cartes a ${width}px`);
      assert.equal(carteMobile.elementCount, 8,
        `les huit elements doivent rester visibles dans chaque carte a ${width}px`);
      assert.ok(
        carteMobile.labels.length === 8
          && carteMobile.labels.every(label => label.text && label.display !== "none"),
        `chaque case doit nommer son element a ${width}px`
      );
      /* Chaque libelle porte la couleur de son element : sur telephone, c'est
         le seul repere d'element de la carte. L'ordre suit ELEM_ORDER, donc le
         premier est Feu (#d24b3e) et le deuxieme Glace (#56b0c9). */
      assert.equal(carteMobile.labels[0].color, "rgb(210, 75, 62)",
        `le libelle Feu doit porter sa couleur d'element a ${width}px`);
      assert.equal(carteMobile.labels[1].color, "rgb(86, 176, 201)",
        `le libelle Glace doit porter sa couleur d'element a ${width}px`);
      assert.deepEqual(carteMobile.cellsPerLine, [4, 4],
        `les elements doivent former une grille 4 par 2 a ${width}px`);
      assert.ok(
        carteMobile.cardInside
          && carteMobile.cardFills
          && carteMobile.wrapOverflow <= 1
          && carteMobile.matrixOverflow <= 1
          && carteMobile.documentOverflow <= 1,
        `les cartes DPS ne doivent provoquer aucun debordement horizontal a ${width}px`
      );
      assert.ok(
        carteMobile.actionHeights.every(height => height >= 43.5),
        `les builds doivent conserver une cible tactile de 44px a ${width}px`
      );
    }
    await page.setViewportSize({ width:1280, height:900 });
    assert.equal(
      await page.locator("#analysePanel-dps .mx-header-row").evaluate(row =>
        getComputedStyle(row).display
      ),
      "table-row",
      "le tableau desktop doit rester intact"
    );
    assert.equal(await triMobile.isHidden(), true,
      "le tri mobile ne doit pas doubler les en-tetes sur ordinateur");

    await page.locator(
      '.analyse-subnav-button[data-analyse-section="supports"]'
    ).click();
    const elementsDuRecensement = await page.locator(
      "#analysePanel-supports .debuff-row .elem-badge"
    ).allTextContents();
    assert.ok(elementsDuRecensement.length > 0);
    const elementsSpecialises = new Set(
      elementsDuRecensement.map(label => label.trim()).filter(label => label !== "Tous")
    );
    const codesDuCatalogue = await page.evaluate(() => {
      const armes = Object.values(window.SEVEN_DS_BUFFS_SUPPORTS || {}).flat();
      const tenues = Object.values(window.SEVEN_DS_PASSIFS_GRAVES || {}).flat()
        .filter(passif => passif.cible === "allies");
      return [...new Set(armes.concat(tenues)
        .map(ligne => String(ligne.element || "").toUpperCase())
        .filter(Boolean))];
    });
    const libelleParCode = {
      FIRE:"Feu", ICE:"Glace", WIND:"Vent", EARTH:"Terre",
      HOLY:"Lumière", DARK:"Ténèbres", THUNDER:"Foudre", DEFAULT:"Physique"
    };
    assert.deepEqual(
      [...elementsSpecialises].sort(),
      codesDuCatalogue.map(code => libelleParCode[code]).sort(),
      "Tous les supports elementaires doivent etre visibles par defaut"
    );

    const filtreTous = page.locator(
      '#analysePanel-supports .supports-element-filter [data-support-element=""]'
    );
    const filtreFeu = page.locator(
      '#analysePanel-supports .supports-element-filter [data-support-element="FIRE"]'
    );
    const filtreTenebres = page.locator(
      '#analysePanel-supports .supports-element-filter [data-support-element="DARK"]'
    );
    assert.equal(await filtreTous.getAttribute("aria-pressed"), "true",
      "Tous doit etre actif par defaut");

    await filtreFeu.click();
    await filtreTenebres.click();
    const elementsFiltres = (await page.locator(
      "#analysePanel-supports .debuff-row .elem-badge"
    ).allTextContents()).map(label => label.trim());
    assert.ok(elementsFiltres.includes("Tous"),
      "les effets generaux doivent rester visibles avec un filtre");
    assert.ok(elementsFiltres.includes("Feu") && elementsFiltres.includes("Ténèbres"),
      "plusieurs elements doivent pouvoir etre selectionnes ensemble");
    assert.ok(elementsFiltres.every(label =>
      ["Tous", "Feu", "Ténèbres"].includes(label)
    ), "le filtre doit masquer les elements non selectionnes");
    assert.equal(await filtreTous.getAttribute("aria-pressed"), "false");
    assert.equal(await filtreFeu.getAttribute("aria-pressed"), "true");
    assert.equal(await filtreTenebres.getAttribute("aria-pressed"), "true");
    assert.equal(
      await page.evaluate(() => document.activeElement?.dataset.supportElement),
      "DARK",
      "le bouton active doit garder le focus apres le filtrage"
    );

    await page.locator('.tab[data-view="builder"]').click();
    await ouvrirAnalyse(page);
    assert.equal(await filtreFeu.getAttribute("aria-pressed"), "true",
      "le filtre Feu doit survivre a un nouveau rendu de l'Analyse");
    assert.equal(await filtreTenebres.getAttribute("aria-pressed"), "true",
      "le filtre Tenebres doit survivre a un nouveau rendu de l'Analyse");
    assert.ok((await page.locator(
      "#analysePanel-supports .debuff-row .elem-badge"
    ).allTextContents()).map(label => label.trim()).every(label =>
      ["Tous", "Feu", "Ténèbres"].includes(label)
    ), "le nouveau rendu doit conserver la selection multiple");

    await filtreTous.click();
    assert.equal(
      await page.locator("#analysePanel-supports .debuff-row").count(),
      elementsDuRecensement.length,
      "Tous doit restaurer le recensement complet"
    );

    for(const width of [320, 390]){
      await page.setViewportSize({ width, height:844 });
      const dispositionFiltre = await page.locator(
        "#analysePanel-supports .supports-element-filter"
      ).evaluate(filtre => {
        const box = filtre.getBoundingClientRect();
        const boutons = [...filtre.querySelectorAll("button")];
        return {
          flexWrap:getComputedStyle(filtre).flexWrap,
          overflow:filtre.scrollWidth - filtre.clientWidth,
          documentOverflow:document.scrollingElement.scrollWidth
            - document.scrollingElement.clientWidth,
          heights:boutons.map(bouton => bouton.getBoundingClientRect().height),
          inside:boutons.every(bouton => {
            const rect = bouton.getBoundingClientRect();
            return rect.left >= box.left - 1 && rect.right <= box.right + 1;
          })
        };
      });
      assert.equal(dispositionFiltre.flexWrap, "wrap",
        `le filtre doit se replier sur plusieurs lignes a ${width}px`);
      assert.ok(
        dispositionFiltre.overflow <= 1
          && dispositionFiltre.documentOverflow <= 1
          && dispositionFiltre.inside,
        `le filtre ne doit pas deborder horizontalement a ${width}px`
      );
      assert.ok(dispositionFiltre.heights.every(height => height >= 43.5),
        `chaque filtre doit conserver une cible tactile de 44px a ${width}px`);
    }
    await page.setViewportSize({ width:1280, height:900 });

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
        .filter(ligne => ligne.cible === "ennemi").length;
      const tenues = Object.values(window.SEVEN_DS_PASSIFS_GRAVES || {}).flat()
        .filter(passif => passif.cible === "allies" && passif.cibleEnnemi).length;
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
