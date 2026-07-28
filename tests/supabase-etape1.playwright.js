"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

(async()=>{
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{ width:1440, height:1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  try{
    await installFakeSupabase(page);
    const url = pathToFileURL(path.resolve(__dirname, "..", "index.html")).href;
    await page.goto(url);

    const authOverlay = page.locator("#authOverlay");
    await authOverlay.waitFor({ state:"visible" });
    assert.equal(await authOverlay.evaluate(el => el.classList.contains("on")), true);
    assert.equal(
      await authOverlay.getByRole("button", { name:"Continuer hors connexion", exact:true }).count(),
      1
    );

    const anonymousBossAcl = await page.evaluate(async () => {
      const state = window.__fakeSupabaseState;
      state.boss_sessions.push({
        id:"boss-session-rls-probe",
        created_by:"user-1",
        title:"Groupe ACL",
        week_start:"2026-07-20",
        slot:1,
        run_no:99,
        status:"archived",
        created_at:"2026-07-25T08:00:00.000Z"
      });
      state.boss_participation.push({
        session_id:"boss-session-rls-probe",
        owner:"user-1",
        pseudo:"Yannis",
        team_id:null,
        team_snapshot:{ id:"snapshot-acl", data:{} },
        updated_at:"2026-07-25T08:00:00.000Z"
      });
      state.boss_run_reports.push({
        session_id:"boss-session-rls-probe",
        global_score:1,
        note:"",
        created_by:"user-1",
        created_by_pseudo:"Yannis",
        created_at:"2026-07-25T08:00:00.000Z",
        updated_by:null,
        updated_by_pseudo:null,
        updated_at:null
      });
      const reads = {};
      for(const table of [
        "boss_sessions",
        "boss_participation",
        "boss_run_reports"
      ]){
        const { data, error } = await window.__fakeSupabaseClient
          .from(table)
          .select("*");
        reads[table] = {
          count:(data || []).length,
          error:error && error.message
        };
      }
      const legacy = await window.__fakeSupabaseClient.rpc(
        "complete_boss_run",
        { p_session_id:"boss-session-rls-probe" }
      );
      return {
        reads,
        legacyError:legacy.error && legacy.error.message
      };
    });
    assert.deepEqual(
      anonymousBossAcl,
      {
        reads:{
          boss_sessions:{ count:0, error:null },
          boss_participation:{ count:0, error:null },
          boss_run_reports:{ count:0, error:null }
        },
        legacyError:"AUTH_REQUIRED"
      },
      "Le fake doit appliquer l'authentification et la lecture RLS à toutes les ressources Boss"
    );

    // Déconnecté, le Team Builder reste la vue initiale.
    assert.equal(await page.locator("#view-builder").isVisible(), true);
    assert.equal(await page.locator("#view-dashboard").isVisible(), false);

    await page.locator("#authEmail").fill("yannis@example.test");
    await page.locator("#authPassword").fill("mot-de-passe-test");
    await page.getByRole("button", { name:"Se connecter", exact:true }).click();

    await page.locator("#accountPseudo").getByText("Yannis", { exact:true }).waitFor();

    // Après connexion, « Mon suivi » devient la vue par défaut.
    await page.locator("#view-dashboard").waitFor({ state:"visible" });
    assert.equal(
      await page.locator("#tab-dashboard").getAttribute("aria-selected"),
      "true"
    );

    const authenticatedBossRead = await page.evaluate(async () => {
      const state = window.__fakeSupabaseState;
      const reads = {};
      for(const table of [
        "boss_sessions",
        "boss_participation",
        "boss_run_reports"
      ]){
        const { data, error } = await window.__fakeSupabaseClient
          .from(table)
          .select("*");
        /* On ne compte que les lignes de la sonde : « Mon suivi » sème
           désormais les six groupes de la semaine dès son ouverture, à un
           moment que ce test ne contrôle pas. */
        reads[table] = {
          count:(data || []).filter(row =>
            (row.id || row.session_id) === "boss-session-rls-probe"
          ).length,
          error:error && error.message
        };
      }
      state.boss_sessions = state.boss_sessions.filter(item =>
        item.id !== "boss-session-rls-probe"
      );
      state.boss_participation = state.boss_participation.filter(item =>
        item.session_id !== "boss-session-rls-probe"
      );
      state.boss_run_reports = state.boss_run_reports.filter(item =>
        item.session_id !== "boss-session-rls-probe"
      );
      return reads;
    });
    assert.deepEqual(
      authenticatedBossRead,
      {
        boss_sessions:{ count:1, error:null },
        boss_participation:{ count:1, error:null },
        boss_run_reports:{ count:1, error:null }
      },
      "Un membre authentifié doit lire les sessions, participations et rapports partagés"
    );
    assert.equal(await authOverlay.evaluate(el => el.classList.contains("on")), false);
    await page.getByText("À jour", { exact:true }).waitFor();
    assert.equal(
      await page.evaluate(() => window.__fakeSupabaseState.realtimeChannels.length),
      1
    );
    assert.ok(
      await page.evaluate(() =>
        window.__fakeSupabaseState.realtimeTables.includes("boss_run_reports")
      ),
      "Realtime doit écouter les rapports"
    );
    await page.evaluate(() => {
      window.__fakeSupabaseState.realtimeChannels[0]
        .statusCallback("CHANNEL_ERROR");
    });
    await page.getByText("Synchronisation indisponible", { exact:true }).waitFor();
    await page.evaluate(() => {
      window.__fakeSupabaseState.realtimeChannels[0]
        .statusCallback("SUBSCRIBED");
    });
    await page.getByText("À jour", { exact:true }).waitFor();

    await page.locator('.tab[data-view="member-roster"]').click();
    await page.locator("#memberRosterGrid .member-roster-card").first().waitFor();
    assert.equal(await page.locator("#memberRosterGrid .member-roster-card").count(), 1);
    assert.match(await page.locator("#memberRosterGrid").textContent(), /Meliodas/);
    assert.equal(await page.locator("#memberRosterGrid .member-roster-edit").count(), 1);

    /* Filtres de catégorie : quatre listes déroulantes, plus aucun rail
       défilant horizontalement. */
    assert.equal(
      await page.locator(".member-roster-filter-rail").count(),
      0,
      "Le rail de chips défilant doit avoir disparu"
    );
    assert.deepEqual(
      await page.locator("#memberRosterFilters select").evaluateAll(nodes =>
        nodes.map(node => node.id)
      ),
      [
        "memberRosterFilterElement",
        "memberRosterFilterWeapon",
        "memberRosterFilterRole",
        "memberRosterFilterRarity"
      ]
    );
    const filterOverflow = await page.locator("#memberRosterFilters").evaluate(node =>
      node.scrollWidth - node.clientWidth
    );
    assert.ok(
      filterOverflow <= 1,
      "Les filtres ne doivent pas déborder horizontalement ("+filterOverflow+"px)"
    );
    assert.equal(
      await page.locator("#memberRosterFilterReset").count(),
      0,
      "Sans filtre actif, aucun bouton de réinitialisation"
    );
    await page.locator("#memberRosterFilterElement").selectOption("Fire");
    await page.waitForFunction(() =>
      document.querySelectorAll("#memberRosterGrid .member-roster-card").length === 0
    );
    assert.match(
      await page.locator("#memberRosterCount").textContent(),
      /0 personnage sur 1/
    );
    await page.locator("#memberRosterFilterReset").click();
    await page.locator("#memberRosterGrid .member-roster-card").first().waitFor();
    assert.equal(
      await page.locator("#memberRosterFilterElement").inputValue(),
      "",
      "La réinitialisation doit remettre chaque liste sur « Tous »"
    );

    await page.locator("#memberRosterGrid .member-roster-edit").click();
    await page.locator("#memberRosterOverlay").waitFor({ state:"visible" });
    assert.match(await page.locator("#memberRosterEditor").textContent(), /Potentiel commun/);
    assert.match(await page.locator("#memberRosterEditor").textContent(), /Hache/);
    const rosterWeaponButton = page.locator(
      "#memberRosterEditor .gear-slot.weapon"
    );
    await rosterWeaponButton.click();
    await page.locator("#overlay").waitFor({state:"visible"});
    await page.keyboard.press("Escape");
    await page.locator("#overlay").waitFor({state:"hidden"});
    await page.waitForFunction(() =>
      document.querySelector("#memberRosterOverlay")
        .contains(document.activeElement)
    );
    assert.equal(
      await page.locator("#memberRosterOverlay").isVisible(),
      true
    );
    assert.equal(
      await page.evaluate(() =>
        document.querySelector("#memberRosterOverlay")
          .contains(document.activeElement)
      ),
      true
    );

    /* Le roster réutilise exactement le panneau chiffré du Team Builder. */
    const rosterWeaponConfig = page.locator(
      "#memberRosterEditor .weapon-config-open"
    );
    await rosterWeaponConfig.waitFor();
    assert.match(
      await page.locator("#memberRosterEditor .weapon-config-summary").textContent(),
      /Configuration à compléter/
    );
    await rosterWeaponConfig.click();
    await page.locator("#weaponConfigOverlay").waitFor({ state:"visible" });
    assert.equal(
      await page.locator("#weaponConfigTitle").textContent(),
      "Configurer l’arme"
    );
    await page.locator(".weapon-config-level").fill("10");
    await page.locator(".weapon-config-promotion").selectOption("1");
    await page.locator(".weapon-config-overlimit").selectOption("1");
    await page.locator("#weaponConfigSave").click();
    await page.locator("#weaponConfigOverlay").waitFor({ state:"hidden" });
    assert.match(
      await page.locator("#memberRosterEditor .weapon-config-summary").textContent(),
      /Configurée .* Nv\. 10 .* Outrepassement 1/
    );
    await rosterWeaponButton.click();
    await page.locator("#overlay").waitFor({ state:"visible" });
    page.once("dialog", dialog => dialog.dismiss());
    await page.locator("#pickerGrid .tile:not(.none):not(.selected)").first().click();
    await page.locator("#overlay").waitFor({ state:"hidden" });
    assert.match(
      await page.locator("#memberRosterEditor .weapon-config-summary").textContent(),
      /Configurée .* Nv\. 10 .* Outrepassement 1/,
      "Refuser le changement d’arme doit conserver la configuration"
    );

    /* ---- Équiper un set en un clic (roster) ----
       Un set remplit les 4 emplacements universels et ne touche jamais
       l'armure liée, qui dépend du personnage. */
    const rosterSetButton = page.locator(
      '#memberRosterEditor [data-gear-action="armor-set"]'
    );
    await rosterSetButton.waitFor();
    assert.equal(
      await rosterSetButton.textContent(),
      "Équiper un set d’armure",
      "Les deux boutons de set doivent être distinguables"
    );
    await rosterSetButton.click();
    await page.locator("#overlay").waitFor({ state:"visible" });
    assert.equal(
      await page.locator("#pickerTitle").textContent(),
      "Équiper un set d’armure"
    );
    // Pas d'option « Aucun » : un set s'applique ou on ferme.
    assert.equal(await page.locator("#pickerGrid .tile.none").count(), 0);
    const setTiles = await page.locator("#pickerGrid .tile").count();
    assert.ok(setTiles >= 2, "Plusieurs sets complets doivent être proposés");
    const chosenSetName = await page.locator("#pickerGrid .tile .tile-name")
      .first().textContent();
    await page.locator("#pickerGrid .tile").first().click();
    await page.locator("#overlay").waitFor({ state:"hidden" });

    const armorAfterSet = await page.evaluate(() =>
      [...document.querySelectorAll("#memberRosterEditor .gear-slot")]
        .filter(node => !node.classList.contains("weapon")
          && !node.classList.contains("jewel"))
        .map(node => ({
          label:node.textContent.trim(),
          filled:node.classList.contains("filled")
        }))
    );
    const universal = armorAfterSet.filter(slot =>
      !/li[ée]e/i.test(slot.label)
    );
    assert.equal(universal.length, 4, "Quatre emplacements universels attendus");
    assert.ok(
      universal.every(slot => slot.filled),
      "Le set doit remplir les quatre emplacements universels"
    );
    const linked = armorAfterSet.find(slot => /li[ée]e/i.test(slot.label));
    assert.ok(linked && !linked.filled, "L'armure liée ne doit pas être touchée");

    /* Les quatre pièces appartiennent bien au MÊME set : leurs noms de fichier
       partagent la racine, et cette racine correspond au set choisi. */
    const equippedNames = await page.evaluate(() =>
      [...document.querySelectorAll("#memberRosterEditor .gear-slot")]
        .filter(node => !node.classList.contains("weapon")
          && !node.classList.contains("jewel")
          && !/li[ée]e/i.test(node.textContent)
          && node.classList.contains("filled"))
        .map(node => node.getAttribute("title") || "")
    );
    assert.equal(equippedNames.length, 4);
    const sharedSuffix = equippedNames.reduce((suffix, name) => {
      let i = 0;
      while(
        i < suffix.length && i < name.length &&
        suffix[suffix.length-1-i] === name[name.length-1-i]
      ) i++;
      return suffix.slice(suffix.length - i);
    });
    assert.ok(
      sharedSuffix.trim().length >= 6,
      "Les quatre pièces doivent partager la racine du set, obtenu : "+
      JSON.stringify(sharedSuffix)
    );
    assert.ok(
      chosenSetName.length > 0 &&
      sharedSuffix.toLocaleLowerCase("fr-FR")
        .includes(chosenSetName.toLocaleLowerCase("fr-FR").slice(1)),
      "La racine partagée doit correspondre au set choisi « "+chosenSetName+" »"
    );

    /* ---- Même geste pour les bijoux ----
       Les trois emplacements sont remplis, et les armures déjà équipées ne
       doivent pas bouger. */
    const rosterJewelButton = page.locator(
      '#memberRosterEditor [data-gear-action="jewel-set"]'
    );
    await rosterJewelButton.waitFor();
    assert.equal(
      await rosterJewelButton.textContent(),
      "Équiper un set de bijoux"
    );
    await rosterJewelButton.click();
    await page.locator("#overlay").waitFor({ state:"visible" });
    assert.equal(
      await page.locator("#pickerTitle").textContent(),
      "Équiper un set de bijoux"
    );
    assert.ok(
      await page.locator("#pickerGrid .tile").count() >= 2,
      "Plusieurs sets de bijoux doivent être proposés"
    );
    const chosenJewelSet = await page.locator("#pickerGrid .tile .tile-name")
      .first().textContent();
    await page.locator("#pickerGrid .tile").first().click();
    await page.locator("#overlay").waitFor({ state:"hidden" });

    const jewelNames = await page.evaluate(() =>
      [...document.querySelectorAll("#memberRosterEditor .gear-slot.jewel")]
        .map(node => ({
          title:node.getAttribute("title") || "",
          filled:node.classList.contains("filled")
        }))
    );
    assert.equal(jewelNames.length, 3, "Trois emplacements de bijoux attendus");
    assert.ok(
      jewelNames.every(slot => slot.filled),
      "Le set doit remplir les trois emplacements de bijoux"
    );
    /* Même normalisation que le produit : une note finale entre parenthèses
       n'appartient pas à l'identité du set. Sans elle, « (jamais porté) » et
       « (jamais portées) » ne partagent que « ) ». */
    const jewelSuffix = jewelNames
      .map(slot => slot.title.replace(/\s*\([^)]*\)\s*$/, "").trim())
      .reduce((suffix, name) => {
      let i = 0;
      while(
        i < suffix.length && i < name.length &&
        suffix[suffix.length-1-i] === name[name.length-1-i]
      ) i++;
      return suffix.slice(suffix.length - i);
    });
    assert.ok(
      jewelSuffix.trim().length >= 6,
      "Les trois bijoux doivent partager la racine du set, obtenu : "+
      JSON.stringify(jewelSuffix)
    );
    assert.ok(
      jewelSuffix.toLocaleLowerCase("fr-FR")
        .includes(chosenJewelSet.toLocaleLowerCase("fr-FR").slice(1)),
      "La racine partagée doit correspondre au set choisi « "+chosenJewelSet+" »"
    );
    // Les armures restent celles du set précédent.
    const armorStillFilled = await page.evaluate(() =>
      [...document.querySelectorAll("#memberRosterEditor .gear-slot")]
        .filter(node => !node.classList.contains("weapon")
          && !node.classList.contains("jewel")
          && !/li[ée]e/i.test(node.textContent))
        .every(node => node.classList.contains("filled"))
    );
    assert.ok(armorStillFilled, "Équiper des bijoux ne doit pas vider les armures");
    assert.equal(
      await page.locator(".member-roster-weapon-tabs .chip.active").textContent(),
      "Hache ✓ ★"
    );
    const favoriteButton = page.locator(".member-roster-favorite");
    assert.equal(await favoriteButton.getAttribute("aria-pressed"), "true");

    await page.getByRole("button", { name:/Epee 1 main/ }).click();
    const copyButton = page.locator(".member-roster-copy-favorite");
    await copyButton.waitFor();
    page.once("dialog", dialog => dialog.accept());
    await copyButton.click();

    const copiedDraft = await page.evaluate(() => {
      const editor = document.querySelector("#memberRosterEditor");
      return {
        note:editor.querySelector("textarea").value,
        favorite:editor.querySelector(".member-roster-favorite")
          .getAttribute("aria-pressed")
      };
    });
    assert.equal(copiedDraft.note, "Mon build");
    assert.equal(copiedDraft.favorite, "false");

    await page.locator("#memberRosterSave").click();
    await page.locator("#memberRosterOverlay").waitFor({ state:"hidden" });
    await page.waitForFunction(() => {
      const row = window.__fakeSupabaseState.roster_characters
        .find(item => item.owner === "user-1" && item.char_id === "meliodas");
      const target = row && row.builds["Epee 1 main"];
      return target &&
        target.weapon === "7ds-armes/Epee 1 main/En plein cœur !.webp" &&
        target.note === "Mon build" &&
        target.favorite === false &&
        row.builds.Hache.favorite === true &&
        row.builds.Hache.weaponConfig &&
        row.builds.Hache.weaponConfig.version === 1;
    });
    const meliodasCard = page.locator("#memberRosterGrid .member-roster-card")
      .filter({ hasText:"Meliodas" });
    assert.match(await meliodasCard.textContent(), /★ favori/);
    assert.match(
      await meliodasCard.locator(".member-roster-build-tag")
        .filter({ hasText:"favori" })
        .getAttribute("aria-label"),
      /build favori/i
    );

    await meliodasCard.locator(".member-roster-edit").click();
    assert.match(
      await page.locator("#memberRosterEditor .weapon-config-summary").textContent(),
      /Configurée .* Nv\. 10 .* Outrepassement 1/
    );
    await page.getByRole("button", { name:/Epee 1 main/ }).click();
    const destinationNote = page.locator("#memberRosterEditor textarea");
    await destinationNote.fill("Ne pas écraser");
    page.once("dialog", dialog => dialog.dismiss());
    await page.locator(".member-roster-copy-favorite").click();
    assert.equal(await destinationNote.inputValue(), "Ne pas écraser");
    await page.locator("#memberRosterClose").click();

    const addRosterCharacter = page.locator("#memberRosterAdd");
    await addRosterCharacter.click();
    await page.locator("#overlay").waitFor({state:"visible"});
    await page.locator("#pickerGrid .tile").first().click();
    await page.locator("#memberRosterOverlay").waitFor({state:"visible"});
    await page.locator("#memberRosterClose").click();
    await page.locator("#memberRosterOverlay").waitFor({state:"hidden"});
    await page.waitForTimeout(20);
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "memberRosterAdd",
      "Le focus doit revenir au bouton qui a lancé l’ajout"
    );

    await page.evaluate(() => {
      const row = window.__fakeSupabaseState.roster_characters
        .find(item => item.owner === "user-2" && item.char_id === "merlin");
      const build = row.builds.Livre;
      const weapon = window.SEVEN_DS_BUILD_STATS.weaponsByFile[build.weapon];
      const grade = Object.values(weapon.gradesByGameId)[0];
      build.weaponConfig = {
        version:1,
        gradeGameId:grade.gameId,
        level:0,
        promotion:0,
        overlimit:0,
        enchantments:Array(grade.enchantments.slots.length).fill(null)
      };
    });
    await page.locator("#memberRosterOthers").click();
    await page.locator("#memberRosterOwner").selectOption("user-2");
    await page.locator("#memberRosterGrid .member-roster-card").first().waitFor();
    assert.match(await page.locator("#memberRosterGrid").textContent(), /Merlin/);
    assert.equal(await page.locator("#memberRosterGrid .member-roster-edit").count(), 0);
    assert.equal(await page.locator("#memberRosterGrid .member-roster-delete").count(), 0);

    /* Roster d'un autre membre : le détail s'ouvre en modale, navigue d'un
       personnage à l'autre et change de build par les icônes d'arme.
       On sème un second personnage pour ce membre le temps du test. */
    assert.equal(
      await page.locator("#memberRosterGrid .member-roster-detail-btn").count(),
      1,
      "Chaque fiche consultée doit offrir un bouton de détail"
    );
    await page.evaluate(() => {
      window.__fakeSupabaseState.roster_characters.push({
        owner:"user-2",
        char_id:"escanor",
        potential_tier:5,
        builds:{
          Hache:{
            weapon:"7ds-armes/Hache/Hache à l'aura triomphale.webp",
            armor:{}, jewel:{}, note:"Build hache"
          },
          "Epee 2 mains":{
            weapon:"7ds-armes/Epee 2 mains/Espadon à l'aura triomphale.webp",
            armor:{}, jewel:{}, note:"Build espadon"
          }
        },
        updated_at:"2026-07-25T08:36:00.000Z"
      });
      window.__fakeSupabaseEmit("roster_characters", "INSERT");
    });
    await page.waitForFunction(() =>
      document.querySelectorAll("#memberRosterGrid .member-roster-card").length === 2
    );

    const rosterDetailOverlay = page.locator("#rosterDetailOverlay");
    await page.locator("#memberRosterGrid .member-roster-card").nth(1)
      .locator(".member-roster-detail-btn").click();
    await rosterDetailOverlay.waitFor({ state:"visible" });
    assert.match(await page.locator("#rosterDetailBody").textContent(), /Merlin/);
    assert.match(
      await page.locator("#rosterDetailBody").textContent(),
      /Apport de l’arme — calcul partiel/
    );
    assert.equal(
      await page.locator("#rosterDetailBody .weapon-config-open").count(),
      0,
      "Le détail d’autrui ne doit exposer aucun contrôle d’édition"
    );
    assert.ok(
      await page.locator("#rosterDetailBody .weapon-stats details").count() > 0,
      "La décomposition de l’apport doit rester consultable"
    );
    assert.match(await page.locator("#rosterDetailTitle").textContent(), /Merlin/);
    assert.equal(await page.locator("#rosterDetailPosition").textContent(), "2 / 2");
    assert.equal(
      await page.locator("#rosterDetailNext").evaluate(node => node.disabled),
      true,
      "Au dernier personnage, la flèche droite doit être désactivée"
    );

    /* Flèche gauche puis touches fléchées : même parcours, deux entrées. */
    await page.locator("#rosterDetailPrev").click();
    await page.waitForFunction(() =>
      document.querySelector("#rosterDetailPosition").textContent === "1 / 2"
    );
    assert.match(await page.locator("#rosterDetailBody").textContent(), /Escanor/);
    assert.equal(
      await page.locator("#rosterDetailPrev").evaluate(node => node.disabled),
      true,
      "Au premier personnage, la flèche gauche doit être désactivée"
    );
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() =>
      document.querySelector("#rosterDetailPosition").textContent === "2 / 2"
    );
    await page.keyboard.press("ArrowLeft");
    await page.waitForFunction(() =>
      document.querySelector("#rosterDetailPosition").textContent === "1 / 2"
    );

    /* Icônes d'arme : Escanor a un build Hache et un build Epee 2 mains, mais
       aucun build Bouclier — cette icône reste inactive. */
    assert.deepEqual(
      await page.locator(".roster-detail-weapon").evaluateAll(nodes =>
        nodes.map(node => ({ type:node.dataset.weaponType, off:node.disabled }))
      ),
      [
        { type:"Hache", off:false },
        { type:"Bouclier", off:true },
        { type:"Epee 2 mains", off:false }
      ]
    );
    assert.match(await page.locator("#rosterDetailBody").textContent(), /Build hache/);
    assert.equal(
      await page.locator('.roster-detail-weapon[data-weapon-type="Hache"]')
        .getAttribute("aria-pressed"),
      "true"
    );
    await page.locator('.roster-detail-weapon[data-weapon-type="Epee 2 mains"]').click();
    await page.waitForFunction(() =>
      document.querySelector("#rosterDetailBody").textContent.includes("Build espadon")
    );
    assert.match(
      await page.locator("#rosterDetailBody").textContent(),
      /Espadon à l’aura triomphale|Espadon à l'aura triomphale/
    );
    assert.equal(
      await page.locator('.roster-detail-weapon[data-weapon-type="Epee 2 mains"]')
        .getAttribute("aria-pressed"),
      "true"
    );

    await page.locator("#rosterDetailClose").click();
    await rosterDetailOverlay.waitFor({ state:"hidden" });
    await page.evaluate(() => {
      window.__fakeSupabaseState.roster_characters =
        window.__fakeSupabaseState.roster_characters
          .filter(row => row.char_id !== "escanor");
      window.__fakeSupabaseEmit("roster_characters", "DELETE");
    });
    await page.waitForFunction(() =>
      document.querySelectorAll("#memberRosterGrid .member-roster-card").length === 1
    );

    await page.locator('.tab[data-view="builder"]').click();
    const rosterHeroSlot = page.locator(".hero").first();
    await rosterHeroSlot
      .getByRole("button", { name:"Depuis mon roster", exact:true })
      .click();
    await page.locator('#pickerGrid .tile[title="Meliodas"]').click();
    await page.locator('#pickerGrid .tile[title*="Hache"]').click();
    assert.match(await rosterHeroSlot.textContent(), /Meliodas/);
    assert.match(await rosterHeroSlot.textContent(), /P7/);

    await rosterHeroSlot.locator("textarea.note").fill("Copie modifiée");
    const rosterNote = await page.evaluate(() =>
      window.__fakeSupabaseState.roster_characters
        .find(row => row.owner === "user-1" && row.char_id === "meliodas")
        .builds.Hache.note
    );
    assert.equal(rosterNote, "Mon build");

    await page.locator('.tab[data-view="roster"]').click();
    await page.locator("#rosterGrid .team").first().waitFor();
    assert.equal(await page.locator("#rosterGrid .team").count(), 2);
    /* On compte les actions de gestion, pas le conteneur : « Dupliquer » est
       désormais offert sur chaque carte, donc `.team-actions` existe partout. */
    assert.equal(
      await page.locator('#rosterGrid [data-team-action="edit"]').count(),
      1,
      "Seule l'équipe du membre connecté doit être modifiable"
    );
    assert.equal(
      await page.locator('#rosterGrid [data-team-action="delete"]').count(),
      1,
      "Seule l'équipe du membre connecté doit être supprimable"
    );

    await page.evaluate(() => {
      window.__fakeSupabaseState.teams.push({
        id:"team-realtime",
        owner:"user-2",
        pseudo:"Merlin",
        data:{
          id:"team-realtime",
          pseudo:"Merlin",
          heroes:Array.from({length:4}, () => ({
            char:null,
            weapon:null,
            armor:{},
            jewel:{},
            potentiel:{tier:0},
            note:""
          }))
        },
        created_at:"2026-07-26T09:00:00.000Z",
        updated_at:"2026-07-26T09:00:00.000Z"
      });
      window.__fakeSupabaseEmit("teams", "INSERT");
    });
    await page.waitForFunction(() =>
      document.querySelectorAll("#rosterGrid .team").length === 3
    );
    await page.evaluate(() => {
      window.__fakeSupabaseState.teams =
        window.__fakeSupabaseState.teams
          .filter(team => team.id !== "team-realtime");
      window.__fakeSupabaseEmit("teams", "DELETE");
    });
    await page.waitForFunction(() =>
      document.querySelectorAll("#rosterGrid .team").length === 2
    );

    await page.locator('.tab[data-view="builder"]').click();
    const firstHero = page.locator(".hero").first();
    await firstHero.locator(".portrait").click();
    await page.locator('#pickerGrid .tile[title="Meliodas"]').click();
    await page.locator("#btnSave").click();

    await page.waitForFunction(() => window.__fakeSupabaseState.teams.length === 3);
    const saved = await page.evaluate(() => window.__fakeSupabaseState.teams.at(-1));
    assert.equal(saved.owner, "user-1");
    assert.equal(saved.pseudo, "Yannis");
    assert.equal(saved.data.heroes[0].char, "meliodas");

    await page.locator('.tab[data-view="roster"]').click();
    await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      const roster = state.roster_characters.find(item =>
        item.owner === "user-1" && item.char_id === "meliodas"
      );
      const team = state.teams.find(item => item.id === "team-own");
      team.data.heroes[0] = {
        char:"meliodas",
        weapon:roster.builds.Hache.weapon,
        weaponConfig:JSON.parse(JSON.stringify(roster.builds.Hache.weaponConfig)),
        armor:{},
        jewel:{},
        potentiel:{tier:roster.potential_tier},
        note:"Instantané chiffré"
      };
      window.__fakeSupabaseEmit("teams", "UPDATE");
    });
    const ownTeam = page.locator("#rosterGrid .team")
      .filter({ hasText:"Yannis" })
      .first();
    await ownTeam.getByText("Meliodas", { exact:true }).waitFor();
    await ownTeam.getByRole("button", { name:/Voir l'équipement/ }).click();
    const teamStats = page.locator("#teamDetail .weapon-stats").first();
    assert.match(await teamStats.textContent(), /Apport de l’arme — calcul partiel/);
    assert.match(await teamStats.textContent(), /Promotion/);
    assert.match(
      await teamStats.textContent(),
      /Outrepassement ×1,05 — base présumée/
    );
    assert.doesNotMatch(
      (await teamStats.textContent()).toLocaleLowerCase("fr-FR"),
      /stats du héros|total du héros|renforcement/
    );
    assert.equal(
      await page.locator("#teamDetail .weapon-config-open").count(),
      0,
      "Le détail d’équipe reste strictement en lecture seule"
    );
    const termTrace = await teamStats.locator("details .weapon-stat-term")
      .first().evaluate(node => ({
        operation:node.dataset.operation,
        unit:node.dataset.unit,
        buckets:node.dataset.buckets,
        text:node.textContent
      }));
    assert.ok(termTrace.operation);
    assert.ok(termTrace.unit);
    assert.ok(termTrace.buckets);
    assert.match(termTrace.text, /Source : arme|Source : weapon/);
    const importButton = page.locator("#teamDetail")
      .getByRole("button", { name:/roster/i })
      .first();
    page.once("dialog", dialog => dialog.accept());
    await importButton.click();
    await page.waitForFunction(() => {
      const row = window.__fakeSupabaseState.roster_characters.find(item =>
        item.owner === "user-1" && item.char_id === "meliodas"
      );
      return row && row.builds.Hache.note === "Copie modifiée";
    });
    assert.equal(
      await page.evaluate(() =>
        window.__fakeSupabaseState.roster_characters
          .find(item => item.owner === "user-1" && item.char_id === "meliodas")
          .builds.Hache.favorite
      ),
      true,
      "Mettre à jour le contenu d’un build ne doit pas retirer son favori"
    );

    await page.locator("#teamClose").click();
    const otherTeam = page.locator("#rosterGrid .team").filter({ hasText:"Merlin" });
    await otherTeam.getByRole("button", { name:/Voir l'équipement/ }).click();
    assert.equal(
      await page.locator("#teamDetail").getByRole("button", { name:/roster/i }).count(),
      0
    );
    await page.locator("#teamClose").click();

    /* ---- Nom d'équipe et duplication ----
       « Dupliquer » est proposé sur TOUTE équipe : le registre est partagé et le
       résultat est un brouillon indépendant. */
    const cardsBeforeDuplicate = await page.locator("#rosterGrid .team").count();
    assert.ok(cardsBeforeDuplicate >= 2, "Il faut plusieurs équipes pour ce test");
    assert.equal(
      await page.locator('#rosterGrid [data-team-action="duplicate"]').count(),
      cardsBeforeDuplicate,
      "Dupliquer doit être proposé sur chaque équipe, pas seulement les siennes"
    );
    assert.equal(
      await page.locator('#rosterGrid [data-team-action="edit"]').count(),
      cardsBeforeDuplicate - 1,
      "Modifier ne doit rester que sur les équipes du membre connecté"
    );

    /* Équipe source dédiée, retirée à la fin : les deux équipes du jeu de test
       restent intactes pour les scénarios suivants. Elle porte un nom (dont on
       vérifie l'affichage) et un héros, sans lequel la sauvegarde est refusée. */
    await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      state.teams.push({
        id:"team-dup-source",
        owner:"user-1",
        pseudo:"Yannis",
        data:{
          id:"team-dup-source",
          name:"Compo de Yannis",
          pseudo:"Yannis",
          heroes:Array.from({length:4}, (unused, index) => ({
            char:index === 0 ? "meliodas" : null,
            weapon:null,
            armor:{},
            jewel:{},
            potentiel:{tier:0},
            note:""
          }))
        },
        created_at:"2026-07-27T09:00:00.000Z",
        updated_at:"2026-07-27T09:00:00.000Z"
      });
      window.__fakeSupabaseEmit("teams", "INSERT");
    });
    const teamToDuplicate = page.locator("#rosterGrid .team")
      .filter({ hasText:"Compo de Yannis" });
    await teamToDuplicate.locator(".team-name").waitFor();
    const duplicatedFrom = await teamToDuplicate.evaluate(node => ({
      name:node.querySelector(".team-name")?.textContent || "",
      pseudo:node.querySelector(".team-pseudo")?.textContent || "",
      heroes:[...node.querySelectorAll(".team-heroes img")].map(img => img.src)
    }));
    assert.equal(duplicatedFrom.name, "Compo de Yannis");
    assert.equal(duplicatedFrom.pseudo, "Yannis");
    assert.ok(
      duplicatedFrom.heroes.length > 0,
      "L'équipe source doit avoir au moins un héros, sinon le test ne prouve rien"
    );
    const teamsBeforeDuplicate = await page.evaluate(() =>
      window.__fakeSupabaseState.teams.length
    );
    await teamToDuplicate.locator('[data-team-action="duplicate"]').click();
    await page.locator("#view-builder").waitFor({ state:"visible" });

    // Un brouillon, pas une écriture : rien n'est enregistré avant validation.
    assert.equal(
      await page.evaluate(() => window.__fakeSupabaseState.teams.length),
      teamsBeforeDuplicate,
      "Dupliquer ne doit rien enregistrer tout de suite"
    );
    assert.equal(await page.locator("#editFlag").isVisible(), false);
    assert.equal(
      await page.locator("#teamName").inputValue(),
      "Compo de Yannis (copie)",
      "Le nom du brouillon doit signaler la copie"
    );
    // Le pseudo est le mien, pas celui de l'auteur d'origine.
    assert.equal(await page.locator("#pseudo").inputValue(), "Yannis");
    assert.deepEqual(
      await page.evaluate(() =>
        [...document.querySelectorAll("#heroGrid .portrait img")].map(img => img.src)
      ),
      duplicatedFrom.heroes,
      "La copie doit reprendre les héros de l'équipe d'origine"
    );

    // Enregistrer crée bien une NOUVELLE équipe, sans toucher l'originale.
    await page.locator("#teamName").fill("Compo dupliquée");
    await page.locator("#btnSave").click();
    await page.waitForFunction(count =>
      window.__fakeSupabaseState.teams.length === count + 1,
      teamsBeforeDuplicate
    );
    await page.locator('.tab[data-view="roster"]').click();
    await page.locator("#rosterGrid .team-name")
      .filter({ hasText:"Compo dupliquée" }).waitFor();
    /* On rend au jeu de test exactement l'état où on l'a trouvé : la source
       dédiée et la copie disparaissent, les équipes préexistantes restent. */
    await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      state.teams = state.teams.filter(team =>
        team.id !== "team-dup-source" &&
        !(team.data && team.data.name === "Compo dupliquée")
      );
      window.__fakeSupabaseEmit("teams", "DELETE");
    });
    await page.waitForFunction(count =>
      document.querySelectorAll("#rosterGrid .team").length === count,
      cardsBeforeDuplicate
    );

    // #5 : Recensement 100% dérivé du roster, lecture seule.
    await page.locator('.tab[data-view="recensement"]').click();
    await page.locator("#recGrid .rec-player").first().waitFor();
    assert.equal(await page.locator("#recGrid .rec-player").count(), 2);
    // Plus de saisie manuelle : aucun bouton d'ajout/suppression.
    assert.equal(await page.locator("#recGrid .dps-add").count(), 0);
    assert.equal(await page.locator("#recGrid .rec-del").count(), 0);

    const ownRecensement = page.locator("#recGrid .rec-player").filter({ hasText:"Yannis" });
    // Yannis a meliodas (Attaquant/Ténèbres) dans son roster -> DPS dérivé Ténèbres.
    assert.match(await ownRecensement.textContent(), /Meliodas/);
    await page.evaluate(() => {
      window.__fakeSupabaseState.calls.length = 0;
      const row = window.__fakeSupabaseState.roster_characters
        .find(item => item.owner === "user-2" && item.char_id === "merlin");
      row.potential_tier = 10;
      window.__fakeSupabaseEmit("roster_characters", "UPDATE");
      window.__fakeSupabaseEmit("profiles", "UPDATE");
    });
    await page.waitForFunction(() =>
      [...document.querySelectorAll("#recGrid .rec-player")]
        .some(card =>
          card.textContent.includes("Merlin") &&
          card.textContent.includes("P10")
        )
    );
    assert.equal(
      await page.evaluate(() =>
        window.__fakeSupabaseState.calls.filter(call =>
          call.table === "roster_characters" &&
          call.operation === "select"
        ).length
      ),
      1,
      "Deux événements du même domaine doivent produire une seule relecture"
    );

    // Aucun débordement horizontal sur mobile (recensement + analyse).
    for(const width of [320, 360, 390]){
      await page.setViewportSize({ width, height:844 });
      const overflow = await page.evaluate(() =>
        document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth
      );
      assert.ok(overflow <= 1, `Débordement recensement de ${overflow}px à ${width}px`);
    }
    await page.setViewportSize({ width:1280, height:900 });

    await page.locator('.tab[data-view="analyse"]').click();
    await page.locator("#analyseBody .rank-table").waitFor();
    const analyseText = await page.locator("#analyseBody").textContent();
    assert.match(analyseText, /Yannis/);
    assert.match(analyseText, /Merlin/);
    assert.match(analyseText, /Meliodas/);

    // Migration one-shot des ÉQUIPES locales (le recensement n'est plus migré).
    const migrateButton = page.locator("#btnMigrateLocal");
    // Visible seulement parce qu'il reste réellement des données locales.
    assert.equal(await migrateButton.isVisible(), true);
    assert.equal(await migrateButton.textContent(), "Importer mes données locales");
    await migrateButton.click();
    await page.waitForFunction(() =>
      window.__fakeSupabaseState.teams.some(team => team.id === "local-team")
    );
    const migratedTeam = await page.evaluate(() =>
      window.__fakeSupabaseState.teams.find(team => team.id === "local-team")
    );
    assert.equal(migratedTeam.owner, "user-1");
    assert.equal(migratedTeam.pseudo, "Yannis");
    /* Une fois la migration faite, ce bouton à usage unique disparaît au lieu
       de rester désactivé : il mangeait une ligne entière du header mobile
       pour toujours. */
    await migrateButton.waitFor({ state:"hidden" });
    assert.equal(await migrateButton.isVisible(), false);
    await page.locator('.tab[data-view="member-roster"]').click();
    await page.locator("#memberRosterMine").click();
    await page.locator("#memberRosterGrid .member-roster-edit").click();
    const rosterEditorNote = page.locator("#memberRosterEditor textarea");
    await rosterEditorNote.fill("Saisie conservée");
    await page.evaluate(() => {
      window.__fakeSupabaseEmit("roster_characters", "UPDATE");
    });
    await page.waitForTimeout(300);
    assert.equal(await rosterEditorNote.inputValue(), "Saisie conservée");
    await page.evaluate(() => {
      window.__fakeSupabaseState.failNextRosterUpsert = true;
    });
    await page.locator("#memberRosterSave").click();
    assert.equal(
      await page.locator("#memberRosterOverlay").evaluate(node =>
        node.classList.contains("on")
      ),
      true
    );
    assert.equal(await rosterEditorNote.inputValue(), "Saisie conservée");
    await page.locator("#memberRosterClose").click();

    /* ---- Conflits Realtime de configuration d'arme ----
       La ligne distante peut avancer pendant que deux niveaux de brouillon
       restent ouverts : le panneau arme, puis son parent roster/équipe. */
    await page.locator("#memberRosterGrid .member-roster-edit").click();
    const rosterConflictOpen = page.locator(
      "#memberRosterEditor .weapon-config-open"
    );
    await rosterConflictOpen.click();
    await page.locator("#weaponConfigOverlay").waitFor({ state:"visible" });
    await page.locator(".weapon-config-level").fill("9");
    await page.evaluate(() => {
      const row = window.__fakeSupabaseState.roster_characters.find(item =>
        item.owner === "user-1" && item.char_id === "meliodas"
      );
      row.updated_at = new Date(Date.parse(row.updated_at) + 60_000).toISOString();
      window.__fakeSupabaseEmit("roster_characters", "UPDATE");
    });
    await page.waitForTimeout(300);
    assert.equal(
      await page.locator("#weaponConfigOverlay").isVisible(),
      true,
      "Realtime ne doit pas fermer le panneau arme"
    );
    assert.equal(
      await page.locator(".weapon-config-level").inputValue(),
      "9",
      "Realtime ne doit pas remplacer le brouillon d'arme"
    );
    await page.locator("#weaponConfigSave").click();
    const rosterConflict = page.locator(".weapon-config-conflict");
    await rosterConflict.waitFor({ timeout:3000 });
    assert.equal(await rosterConflict.getAttribute("role"), "alert");
    assert.equal(
      await rosterConflict.getByRole("button", {
        name:"Recharger la version récente",
        exact:true
      }).count(),
      1
    );
    assert.equal(
      await rosterConflict.getByRole("button", {
        name:"Enregistrer quand même",
        exact:true
      }).count(),
      1
    );
    assert.equal(
      await page.locator("#weaponConfigOverlay").isVisible(),
      true,
      "Le conflit ne doit ni écrire ni fermer le panneau"
    );

    page.once("dialog", dialog => dialog.accept());
    await rosterConflict.getByRole("button", {
      name:"Recharger la version récente",
      exact:true
    }).click();
    await page.locator("#weaponConfigOverlay").waitFor({ state:"hidden" });
    assert.equal(
      await page.locator("#memberRosterOverlay").isVisible(),
      true,
      "Recharger doit conserver l'éditeur roster parent"
    );

    await page.locator("#memberRosterEditor .weapon-config-open").click();
    await page.locator(".weapon-config-level").fill("8");
    await page.evaluate(() => {
      const row = window.__fakeSupabaseState.roster_characters.find(item =>
        item.owner === "user-1" && item.char_id === "meliodas"
      );
      row.updated_at = new Date(Date.parse(row.updated_at) + 60_000).toISOString();
      window.__fakeSupabaseEmit("roster_characters", "UPDATE");
    });
    await page.waitForTimeout(300);
    await page.locator("#weaponConfigSave").click();
    await page.locator(".weapon-config-conflict").waitFor({ timeout:3000 });
    await page.getByRole("button", {
      name:"Enregistrer quand même",
      exact:true
    }).click();
    await page.locator("#weaponConfigOverlay").waitFor({ state:"hidden" });
    assert.match(
      await page.locator("#memberRosterEditor .weapon-config-summary").textContent(),
      /Nv\. 8/,
      "L'écrasement explicite doit valider exactement ce brouillon"
    );

    const rosterUpsertsBeforeGuard = await page.evaluate(() =>
      window.__fakeSupabaseState.calls.filter(call =>
        call.table === "roster_characters" && call.operation === "upsert"
      ).length
    );
    page.once("dialog", dialog => dialog.dismiss());
    await page.locator("#memberRosterSave").click();
    assert.equal(
      await page.locator("#memberRosterOverlay").isVisible(),
      true,
      "Refuser la garde parent doit conserver le brouillon roster"
    );
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "memberRosterSave",
      "Refuser la garde parent doit réactiver et refocaliser Enregistrer"
    );
    assert.equal(
      await page.evaluate(() =>
        window.__fakeSupabaseState.calls.filter(call =>
          call.table === "roster_characters" && call.operation === "upsert"
        ).length
      ),
      rosterUpsertsBeforeGuard,
      "Refuser la garde parent ne doit lancer aucun upsert roster"
    );
    page.once("dialog", dialog => dialog.accept());
    await page.locator("#memberRosterSave").click();
    await page.locator("#memberRosterOverlay").waitFor({ state:"hidden" });
    await page.waitForFunction(() => {
      const row = window.__fakeSupabaseState.roster_characters.find(item =>
        item.owner === "user-1" && item.char_id === "meliodas"
      );
      return row && row.builds.Hache.weaponConfig &&
        row.builds.Hache.weaponConfig.level === 8;
    });

    /* Une suppression distante survenue après l'affichage du conflit doit
       fermer proprement les deux modales, sans ressusciter la ligne. */
    await page.locator("#memberRosterGrid .member-roster-edit").click();
    await page.locator("#memberRosterEditor .weapon-config-open").click();
    await page.locator(".weapon-config-level").fill("7");
    await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      const row = state.roster_characters.find(item =>
        item.owner === "user-1" && item.char_id === "meliodas"
      );
      row.updated_at = new Date(Date.parse(row.updated_at) + 60_000).toISOString();
      window.__fakeRosterConflictBackup = JSON.parse(JSON.stringify(row));
      window.__fakeSupabaseEmit("roster_characters", "UPDATE");
    });
    await page.waitForTimeout(300);
    await page.locator("#weaponConfigSave").click();
    await page.locator(".weapon-config-conflict").waitFor({ timeout:3000 });
    await page.evaluate(() => {
      window.__fakeSupabaseState.roster_characters =
        window.__fakeSupabaseState.roster_characters.filter(item =>
          item.owner !== "user-1" || item.char_id !== "meliodas"
        );
    });
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", {
      name:"Recharger la version récente",
      exact:true
    }).click();
    await page.locator("#weaponConfigOverlay").waitFor({ state:"hidden" });
    await page.locator("#memberRosterOverlay").waitFor({ state:"hidden" });
    assert.match(
      await page.locator("#toast").textContent(),
      /supprimé du roster/
    );
    await page.evaluate(() => {
      window.__fakeSupabaseState.roster_characters.push(
        window.__fakeRosterConflictBackup
      );
      window.__fakeSupabaseEmit("roster_characters", "INSERT");
    });
    await page.locator("#memberRosterGrid .member-roster-edit").waitFor();

    /* Même contrat dans le Team Builder, avec la garde parent juste avant
       Store.upsert. Une équipe temporaire isole ce scénario du reste. */
    await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      const roster = state.roster_characters.find(item =>
        item.owner === "user-1" && item.char_id === "meliodas"
      );
      state.teams.push({
        id:"team-weapon-conflict",
        owner:"user-1",
        pseudo:"Yannis",
        data:{
          id:"team-weapon-conflict",
          name:"Conflit Team",
          pseudo:"Yannis",
          heroes:Array.from({length:4}, (unused, index) => index === 0 ? {
            char:"meliodas",
            weapon:roster.builds.Hache.weapon,
            weaponConfig:JSON.parse(JSON.stringify(
              roster.builds.Hache.weaponConfig
            )),
            armor:{},
            jewel:{},
            potentiel:{tier:7},
            note:""
          } : {
            char:null,
            weapon:null,
            armor:{},
            jewel:{},
            potentiel:{tier:0},
            note:""
          })
        },
        created_at:"2026-07-25T11:00:00.000Z",
        updated_at:"2026-07-25T11:00:00.000Z"
      });
      window.__fakeSupabaseEmit("teams", "INSERT");
    });
    await page.locator('.tab[data-view="roster"]').click();
    const conflictTeamCard = page.locator("#rosterGrid .team")
      .filter({ hasText:"Conflit Team" });
    await conflictTeamCard.locator('[data-team-action="edit"]').click();
    const teamConflictOpen = page.locator(
      "#heroGrid .hero"
    ).first().locator(".weapon-config-open");
    await teamConflictOpen.click();
    await page.locator(".weapon-config-level").fill("6");
    await page.evaluate(() => {
      const row = window.__fakeSupabaseState.teams.find(item =>
        item.id === "team-weapon-conflict"
      );
      row.updated_at = new Date(Date.parse(row.updated_at) + 60_000).toISOString();
      window.__fakeSupabaseEmit("teams", "UPDATE");
    });
    await page.waitForTimeout(300);
    assert.equal(await page.locator(".weapon-config-level").inputValue(), "6");
    await page.locator("#weaponConfigSave").click();
    await page.locator(".weapon-config-conflict").waitFor({ timeout:3000 });
    await page.getByRole("button", {
      name:"Enregistrer quand même",
      exact:true
    }).click();
    await page.locator("#weaponConfigOverlay").waitFor({ state:"hidden" });

    const teamUpsertsBeforeGuard = await page.evaluate(() =>
      window.__fakeSupabaseState.calls.filter(call =>
        call.table === "teams" && call.operation === "upsert"
      ).length
    );
    page.once("dialog", dialog => dialog.dismiss());
    await page.locator("#btnSave").click();
    assert.equal(await page.locator("#view-builder").isVisible(), true);
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "btnSave"
    );
    assert.equal(
      await page.evaluate(() =>
        window.__fakeSupabaseState.calls.filter(call =>
          call.table === "teams" && call.operation === "upsert"
        ).length
      ),
      teamUpsertsBeforeGuard,
      "Refuser la garde parent ne doit lancer aucun upsert équipe"
    );
    page.once("dialog", dialog => dialog.accept());
    await page.locator("#btnSave").click();
    await page.locator("#view-roster").waitFor({ state:"visible" });
    assert.equal(
      await page.evaluate(() => {
        const row = window.__fakeSupabaseState.teams.find(item =>
          item.id === "team-weapon-conflict"
        );
        return row.data.heroes[0].weaponConfig.level;
      }),
      6
    );
    await page.evaluate(() => {
      window.__fakeSupabaseState.teams =
        window.__fakeSupabaseState.teams.filter(item =>
          item.id !== "team-weapon-conflict"
        );
      window.__fakeSupabaseEmit("teams", "DELETE");
    });

    /* Une nouvelle équipe n'a aucune source distante : elle ne doit jamais
       produire de faux conflit dans le panneau. */
    await page.locator('.tab[data-view="builder"]').click();
    await page.locator("#btnNew").click();
    await page.locator(".hero").first()
      .getByRole("button", { name:"Depuis mon roster", exact:true }).click();
    await page.locator('#pickerGrid .tile[title="Meliodas"]').click();
    await page.locator('#pickerGrid .tile[title*="Hache"]').click();
    await page.locator("#heroGrid .hero").first()
      .locator(".weapon-config-open").click();
    await page.locator(".weapon-config-level").fill("5");
    await page.locator("#weaponConfigSave").click();
    await page.locator("#weaponConfigOverlay").waitFor({ state:"hidden" });
    assert.equal(
      await page.locator(".weapon-config-conflict").count(),
      0,
      "Un brouillon neuf ne doit pas signaler de version plus récente"
    );
    await page.locator("#btnNew").click();

    for(const width of [320, 360, 390]){
      await page.setViewportSize({ width, height:844 });
      await page.locator('.tab[data-view="member-roster"]').click();
      await page.waitForTimeout(100);
      const overflow = await page.evaluate(() => {
        const root = document.scrollingElement;
        return root.scrollWidth - root.clientWidth;
      });
      assert.ok(overflow <= 1, `Débordement roster de ${overflow}px à ${width}px`);
      if(width === 320){
        await page.locator("#memberRosterGrid .member-roster-edit").click();
        const weaponTabs = await page.locator(".member-roster-weapon-tabs").evaluate(node => ({
          scrollWidth:node.scrollWidth,
          clientWidth:node.clientWidth
        }));
        assert.ok(
          weaponTabs.scrollWidth > weaponTabs.clientWidth,
          "Les types d’arme doivent défiler dans leur propre rail à 320 px"
        );
        await page.locator("#memberRosterClose").click();
      }
    }

    assert.equal(
      await page.evaluate(() => localStorage.getItem("confrerie7ds.teams") !== null),
      true,
      "La migration ne doit pas supprimer le filet de sauvegarde local"
    );

    // Boss : trois runs maximum, départ libérateur, archive et run suivante.
    await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      state.calls.length = 0;
      state.bossReadFailureOnce = {
        table:"boss_sessions",
        message:"Échec boss simulé"
      };
      for(let index = 1; index <= 205; index++){
        const slot = ((index - 1) % 6) + 1;
        state.boss_sessions.push({
          id:"boss-history-" + index,
          created_by:"user-1",
          title:"Groupe " + slot,
          boss_name:"Akumu, bête démoniaque",
          session_date:"2026-07-06",
          week_start:"2026-07-06",
          slot,
          run_no:Math.floor((index - 1) / 6) + 1,
          elements:[],
          status:"archived",
          completed_at:"2026-07-12T10:00:00.000Z",
          remind_at:null,
          reminded_at:null,
          created_at:"2026-07-06T09:00:00.000Z"
        });
        state.boss_participation.push({
          session_id:"boss-history-" + index,
          owner:"history-user-" + index,
          pseudo:"Historique " + index,
          team_id:null,
          team_snapshot:null,
          updated_at:"2026-07-12T10:00:00.000Z"
        });
      }
    });
    await page.locator('.tab[data-view="boss"]').click();
    await page.waitForFunction(() =>
      window.__fakeSupabaseState.bossReadFailureOnce === null
    );
    assert.doesNotMatch(await page.locator("#bossBody").textContent(), /Chargement/);
    assert.match(await page.locator("#bossBody").textContent(), /Groupes indisponibles/);
    await page.getByRole("button", { name:"Réessayer", exact:true }).click();
    await page.locator(".boss-grid .boss-card").nth(5).waitFor();
    assert.equal(await page.locator(".boss-grid .boss-card").count(), 6);
    const membershipBatchSizes = await page.evaluate(() =>
      window.__fakeSupabaseState.calls
        .filter(call => call.table === "boss_participation" && call.operation === "select")
        .map(call => {
          const filter = call.filters.find(([key]) => key === "__in:session_id");
          return filter ? filter[1].length : 0;
        })
    );
    assert.ok(
      membershipBatchSizes.length > 1,
      "Plus de 100 sessions doivent déclencher plusieurs requêtes de participation"
    );
    assert.ok(
      membershipBatchSizes.every(size => size > 0 && size <= 100),
      "Chaque requête de participation doit contenir au maximum 100 UUID"
    );
    assert.equal(
      membershipBatchSizes.reduce((sum, size) => sum + size, 0),
      211,
      "Tous les UUID historiques et courants doivent être interrogés"
    );
    assert.match(
      await page.locator(".boss-archive").textContent(),
      /Historique 205/,
      "Les participations du dernier lot doivent rester visibles"
    );
    await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      state.boss_sessions = state.boss_sessions.filter(
        run => !run.id.startsWith("boss-history-")
      );
      state.boss_participation = state.boss_participation.filter(
        membership => !membership.session_id.startsWith("boss-history-")
      );
      state.calls.length = 0;
    });
    assert.equal(await page.evaluate(() => window.__fakeSupabaseState.boss_sessions.length), 6);
    await page.evaluate(() => {
      window.__fakeSupabaseState.bossReadFailureOnce = {
        table:"boss_run_reports",
        message:
          "PGRST205: Could not find the table 'public.boss_run_reports' in the schema cache"
      };
    });
    await page.locator('.tab[data-view="builder"]').click();
    await page.locator('.tab[data-view="boss"]').click();
    await page.waitForFunction(() =>
      window.__fakeSupabaseState.bossReadFailureOnce === null
    );
    await page.getByText("Maintenance des rapports de boss", {
      exact:true
    }).waitFor({ timeout:2000 });
    assert.match(
      await page.locator("#bossBody").textContent(),
      /La version du site et le schéma partagé ne sont pas compatibles/
    );
    await page.locator("#bossBody").getByRole("button", {
      name:"Réessayer",
      exact:true
    }).click();
    await page.locator(".boss-grid .boss-card").nth(5).waitFor();

    const alteredSeedResult = await page.evaluate(async () => {
      const state = window.__fakeSupabaseState;
      const before = JSON.stringify(state.boss_sessions);
      const alteredSeeds = state.boss_sessions.map((run, index) => Object.assign({}, run, {
        boss_name:index === 0 ? "Boss injecté" : run.boss_name
      }));
      const result = await window.__fakeSupabaseClient.from("boss_sessions")
        .upsert(alteredSeeds, {
          onConflict:"week_start,slot,run_no",
          ignoreDuplicates:true
        });
      return {
        error:result.error && result.error.message,
        unchanged:JSON.stringify(state.boss_sessions) === before
      };
    });
    assert.equal(alteredSeedResult.error, "RPC_REQUIRED");
    assert.equal(
      alteredSeedResult.unchanged,
      true,
      "Une seed aux métadonnées altérées doit être refusée sans mutation"
    );
    const invalidWeekErrors = await page.evaluate(async () => {
      const state = window.__fakeSupabaseState;
      const source = state.boss_sessions[0];
      const invalidRun = Object.assign({}, source, {
        id:"boss-invalid-week",
        week_start:"1999-01-04"
      });
      state.boss_sessions.push(invalidRun);
      const errors = await Promise.all([
        "join_boss_run",
        "leave_boss_run",
        "complete_boss_run_with_report"
      ].map(async name => {
        const result = await window.__fakeSupabaseClient.rpc(name, {
          p_session_id:invalidRun.id,
          p_global_score:"1",
          p_note:""
        });
        return result.error && result.error.message;
      }));
      const legacy = await window.__fakeSupabaseClient.rpc(
        "complete_boss_run",
        { p_session_id:invalidRun.id }
      );
      state.boss_sessions = state.boss_sessions.filter(item => item.id !== invalidRun.id);
      return {
        errors,
        legacy:legacy.error && legacy.error.message
      };
    });
    assert.deepEqual(invalidWeekErrors.errors, [
      "RUN_INVALID_WEEK",
      "RUN_INVALID_WEEK",
      "RUN_INVALID_WEEK"
    ]);
    assert.equal(invalidWeekErrors.legacy, "REPORT_REQUIRED");
    const directWriteErrors = await page.evaluate(async () => {
      const client = window.__fakeSupabaseClient;
      const state = window.__fakeSupabaseState;
      const run = state.boss_sessions.find(item => item.slot === 1 && item.run_no === 1);
      const results = await Promise.all([
        client.from("boss_participation").upsert({
          session_id:run.id, owner:"user-1", pseudo:"Yannis"
        }),
        client.from("boss_participation").update({ pseudo:"Intrus" })
          .eq("session_id", run.id).eq("owner", "user-1"),
        client.from("boss_participation").delete()
          .eq("session_id", run.id).eq("owner", "user-1"),
        client.from("boss_sessions").upsert(Object.assign({}, run, { id:"boss-invalid-seed" })),
        client.from("boss_sessions").update({ status:"archived" }).eq("id", run.id),
        client.from("boss_sessions").delete().eq("id", run.id),
        client.from("boss_run_reports").upsert({
          session_id:run.id,
          global_score:1,
          note:"",
          created_by:"user-1",
          created_by_pseudo:"Yannis"
        }),
        client.from("boss_run_reports").update({ global_score:2 })
          .eq("session_id", run.id),
        client.from("boss_run_reports").delete().eq("session_id", run.id)
      ]);
      return {
        errors:results.map(result => result.error && result.error.message),
        participationCount:state.boss_participation.length,
        runCount:state.boss_sessions.length,
        runStatus:run.status
      };
    });
    assert.deepEqual(directWriteErrors.errors, [
      "RPC_REQUIRED",
      "RPC_REQUIRED",
      "RPC_REQUIRED",
      "RPC_REQUIRED",
      "RPC_REQUIRED",
      "RPC_REQUIRED",
      "RPC_REQUIRED",
      "RPC_REQUIRED",
      "RPC_REQUIRED"
    ]);
    assert.equal(directWriteErrors.participationCount, 0);
    assert.equal(directWriteErrors.runCount, 6);
    assert.equal(directWriteErrors.runStatus, "open");
    await page.evaluate(() => { window.__fakeSupabaseState.rpcCalls.length = 0; });
    assert.match(await page.locator("#bossCount").textContent(), /0\/3/);
    await page.evaluate(() => {
      const session = window.__fakeSupabaseState.boss_sessions
        .find(item => item.status === "open");
      window.__fakeSupabaseState.boss_participation.push({
        session_id:session.id,
        owner:"user-2",
        pseudo:"Merlin",
        team_id:null,
        team_snapshot:null,
        updated_at:"2026-07-26T10:00:00.000Z"
      });
      window.__fakeSupabaseEmit("boss_participation", "INSERT");
    });
    await page.locator("#bossBody").getByText("Merlin", { exact:true }).waitFor();
    await page.evaluate(() => {
      window.__fakeSupabaseState.boss_participation =
        window.__fakeSupabaseState.boss_participation
          .filter(item => item.owner !== "user-2");
      window.__fakeSupabaseEmit("boss_participation", "DELETE");
    });
    await page.waitForFunction(() =>
      !document.querySelector("#bossBody").textContent.includes("Merlin")
    );

    await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      const session = state.boss_sessions.find(item => item.slot === 1);
      state.boss_participation.push({
        session_id:session.id,
        owner:"user-2",
        pseudo:"Merlin",
        team_id:null,
        team_snapshot:null,
        updated_at:"2026-07-26T10:02:00.000Z"
      });
      window.__fakeSupabaseHoldBossRead("boss_participation");
      window.__fakeSupabaseEmit("boss_participation", "INSERT");
    });
    await page.waitForFunction(() =>
      typeof window.__fakeSupabaseState.bossReadHold.release === "function"
    );
    await page.evaluate(() => {
      window.__fakeSupabaseState.bossReadFailureOnce = {
        table:"boss_sessions",
        message:"Échec plus récent simulé"
      };
    });
    await page.locator('.tab[data-view="builder"]').click();
    await page.locator('.tab[data-view="boss"]').click();
    await page.waitForFunction(() =>
      window.__fakeSupabaseState.bossReadFailureOnce === null
    );
    await page.evaluate(() => window.__fakeSupabaseReleaseBossRead());
    await page.waitForFunction(() => !window.__fakeSupabaseState.bossReadHold);
    await page.waitForTimeout(30);
    assert.doesNotMatch(
      await page.locator("#bossBody").textContent(),
      /Merlin/,
      "Une lecture ancienne ne redevient pas courante après l’échec du rendu suivant"
    );
    await page.evaluate(() =>
      window.__fakeSupabaseEmit("boss_participation", "UPDATE")
    );
    await page.locator("#bossBody").getByText("Merlin", { exact:true }).waitFor();
    await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      state.boss_participation = state.boss_participation
        .filter(item => item.owner !== "user-2");
      window.__fakeSupabaseEmit("boss_participation", "DELETE");
    });
    await page.locator("#bossBody").getByText("Merlin", { exact:true })
      .waitFor({ state:"detached" });

    const groupOne = page.locator(".boss-card", {
      hasText:"Groupe 1 · Run 1"
    });

    await page.evaluate(() =>
      window.__fakeSupabaseHoldBossRpc("join_boss_run")
    );
    await groupOne.getByRole("button", {
      name:"Rejoindre",
      exact:true
    }).click();
    await page.waitForFunction(() =>
      typeof window.__fakeSupabaseState.bossRpcHold.release === "function"
    );

    assert.match(await groupOne.textContent(), /Yannis/);
    assert.match(await page.locator("#bossCount").textContent(), /1\/3/);
    assert.equal(
      await groupOne.getByRole("button", {
        name:"Synchronisation…",
        exact:true
      }).isDisabled(),
      true
    );
    assert.doesNotMatch(await page.locator("#bossBody").textContent(), /Chargement/);
    assert.equal(
      await page.evaluate(() =>
        window.__fakeSupabaseState.boss_participation.length
      ),
      0,
      "L’interface doit changer avant la résolution de la RPC"
    );

    await page.evaluate(() => window.__fakeSupabaseReleaseBossRpc());
    await page.waitForFunction(() =>
      window.__fakeSupabaseState.boss_participation.length === 1
    );
    await groupOne.getByRole("button", {
      name:"Quitter",
      exact:true
    }).waitFor();
    assert.match(await groupOne.textContent(), /1\/5 joueurs/);
    assert.match(await groupOne.textContent(), /Équipe manquante/);

    await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      const latestUpdate = Math.max(...state.teams.map(team =>
        Date.parse(team.updated_at) || 0
      ));
      state.teams.push({
        id:"team-boss-four",
        owner:"user-1",
        pseudo:"Yannis",
        data:{
          id:"team-boss-four",
          pseudo:"Yannis",
          heroes:["bug", "daisy", "diane", "drake"].map(char => ({
            char,
            weapon:null,
            armor:{},
            jewel:{},
            potentiel:{ tier:0 },
            note:""
          }))
        },
        created_at:"2026-07-26T20:00:00.000Z",
        updated_at:new Date(latestUpdate + 60000).toISOString()
      });
    });

    const chooseBossTeam = groupOne.getByRole("button", {
      name:"Choisir mon équipe",
      exact:true
    });
    const bossTeamOverlay = page.locator("#bossTeamOverlay");
    const bossTeamChoices = page.locator("#bossTeamList .boss-team-choice");

    // Le déclencheur doit être capturé avant la lecture réseau.
    await page.evaluate(() => window.__fakeSupabaseHoldBossRead("teams"));
    await chooseBossTeam.click();
    await page.waitForFunction(() =>
      typeof window.__fakeSupabaseState.bossReadHold.release === "function"
    );
    const focusDecoy = page.locator(".boss-card", {
      hasText:"Groupe 2 · Run 1"
    }).getByRole("button", { name:"Rejoindre", exact:true });
    await focusDecoy.focus();
    await page.evaluate(() => window.__fakeSupabaseReleaseBossRead());
    await bossTeamOverlay.waitFor({ state:"visible" });
    await page.keyboard.press("Escape");
    await bossTeamOverlay.waitFor({ state:"hidden" });
    assert.equal(
      await page.evaluate(() => document.activeElement.textContent.trim()),
      "Choisir mon équipe",
      "Le focus doit revenir au déclencheur capturé avant la lecture réseau"
    );

    // Fermer pendant un retry lent ne doit jamais rouvrir la modale.
    await page.evaluate(() => {
      window.__fakeSupabaseState.bossReadFailureOnce = {
        table:"teams",
        message:"Échec équipes simulé"
      };
    });
    await chooseBossTeam.click();
    await bossTeamOverlay.waitFor({ state:"visible" });
    const retryBossTeams = page.locator("#bossTeamList")
      .getByRole("button", { name:"Réessayer", exact:true });
    await page.evaluate(() => window.__fakeSupabaseHoldBossRead("teams"));
    await retryBossTeams.click();
    await page.waitForFunction(() =>
      typeof window.__fakeSupabaseState.bossReadHold.release === "function"
    );
    await page.keyboard.press("Escape");
    await page.evaluate(() => window.__fakeSupabaseReleaseBossRead());
    await page.waitForFunction(() => !window.__fakeSupabaseState.bossReadHold);
    await page.waitForTimeout(50);
    assert.equal(
      await bossTeamOverlay.isVisible(),
      false,
      "Une lecture terminée après Échap ne doit pas rouvrir le sélecteur"
    );

    await chooseBossTeam.click();
    await bossTeamOverlay.waitFor({ state:"visible" });
    await page.setViewportSize({ width:1000, height:844 });
    const bossTeamModalWidth = await page.locator(".boss-team-modal")
      .evaluate(modal => modal.getBoundingClientRect().width);
    assert.ok(
      bossTeamModalWidth <= 722,
      `La modale d’équipe doit garder sa largeur dédiée (reçu ${bossTeamModalWidth}px)`
    );
    await page.setViewportSize({ width:390, height:844 });
    assert.equal(
      await bossTeamChoices.count(),
      await page.evaluate(() =>
        window.__fakeSupabaseState.teams.filter(team => team.owner === "user-1").length
      )
    );
    assert.equal(
      await bossTeamChoices.first().locator(".boss-team-choice-hero").count(),
      4,
      "Chaque choix doit montrer les quatre emplacements de la composition"
    );
    assert.match(await bossTeamChoices.first().textContent(), /Modifiée le/);
    for(const name of ["Bug", "Daisy", "Diane", "Drake"]){
      assert.match(await bossTeamChoices.first().textContent(), new RegExp(name));
    }
    assert.equal(
      await bossTeamChoices.first().locator("img").count(),
      4,
      "La composition complète doit montrer quatre images"
    );
    assert.deepEqual(
      await bossTeamChoices.first().locator("img").evaluateAll(images =>
        images.map(image => new URL(image.src).pathname.split("/").pop())
      ),
      ["bug.webp", "daisy.webp", "diane.webp", "drake.webp"]
    );
    assert.equal(
      await page.evaluate(() =>
        document.activeElement.classList.contains("boss-team-choice")
      ),
      true,
      "Le focus initial doit arriver sur la première équipe"
    );
    await page.keyboard.press("Escape");
    await bossTeamOverlay.waitFor({ state:"hidden" });
    const bossTeamTriggerHandle = await chooseBossTeam.elementHandle();
    assert.ok(bossTeamTriggerHandle, "Le déclencheur d’équipe doit exister");
    for(const width of [320, 390]){
      await page.setViewportSize({ width, height:844 });
      await chooseBossTeam.click();
      await bossTeamOverlay.waitFor({ state:"visible" });
      await page.waitForFunction(() =>
        document.activeElement.classList.contains("boss-team-choice")
      );
      const modalMetrics = await page.evaluate(() => {
        const root = document.scrollingElement;
        const overlay = document.querySelector("#bossTeamOverlay");
        const modal = document.querySelector(".boss-team-modal");
        const list = document.querySelector("#bossTeamList");
        const choice = document.querySelector(".boss-team-choice");
        const close = document.querySelector("#bossTeamClose");
        const overlayRect = overlay.getBoundingClientRect();
        const modalRect = modal.getBoundingClientRect();
        const listRect = list.getBoundingClientRect();
        const choiceRects = [...document.querySelectorAll(".boss-team-choice")]
          .map(node => node.getBoundingClientRect().toJSON());
        const heroRects = [...document.querySelectorAll(
          ".boss-team-choice-hero"
        )].map(node => node.getBoundingClientRect().toJSON());
        const closeRect = close.getBoundingClientRect();
        return {
          viewportWidth:document.documentElement.clientWidth,
          viewportHeight:document.documentElement.clientHeight,
          documentOverflow:root.scrollWidth - root.clientWidth,
          overlay:overlayRect.toJSON(),
          modal:modalRect.toJSON(),
          list:listRect.toJSON(),
          choices:choiceRects,
          heroes:heroRects,
          closeWidth:closeRect.width,
          closeHeight:closeRect.height
        };
      });
      assert.ok(
        modalMetrics.documentOverflow <= 1,
        `Débordement du sélecteur d’équipe de ${modalMetrics.documentOverflow}px à ${width}px`
      );
      for(const [label, rect] of [
        ["overlay", modalMetrics.overlay],
        ["modale", modalMetrics.modal],
        ["liste", modalMetrics.list]
      ]){
        assert.ok(
          rect.left >= 0 && rect.top >= 0 &&
          rect.right <= modalMetrics.viewportWidth &&
          rect.bottom <= modalMetrics.viewportHeight,
          `${label} du sélecteur hors viewport à ${width}px : `+
            JSON.stringify(rect)
        );
      }
      for(const rect of [...modalMetrics.choices, ...modalMetrics.heroes]){
        assert.ok(
          rect.left >= modalMetrics.modal.left &&
          rect.right <= modalMetrics.modal.right &&
          rect.left >= 0 && rect.right <= modalMetrics.viewportWidth,
          `Contenu d’équipe hors modale à ${width}px : ${JSON.stringify(rect)}`
        );
      }
      modalMetrics.choices.forEach(rect => {
        assert.ok(
          rect.height >= 44 && rect.width >= 44,
          "Une équipe doit rester une cible tactile de 44 × 44 px"
        );
      });
      assert.ok(
        modalMetrics.closeWidth >= 44 && modalMetrics.closeHeight >= 44,
        `La fermeture du sélecteur doit mesurer 44 × 44 px à ${width}px`
      );
      await page.locator("#bossTeamClose").focus();
      await page.keyboard.press("Shift+Tab");
      assert.equal(
        await page.evaluate(() =>
          document.querySelector("#bossTeamOverlay")
            .contains(document.activeElement)
        ),
        true,
        `Le focus doit rester piégé dans le sélecteur à ${width}px`
      );
      await page.keyboard.press("Escape");
      await bossTeamOverlay.waitFor({ state:"hidden" });
      assert.equal(
        await page.evaluate(trigger =>
          document.activeElement === trigger
        , bossTeamTriggerHandle),
        true,
        `Échap doit restituer le focus au déclencheur à ${width}px`
      );
    }
    await page.setViewportSize({ width:390, height:844 });

    // Une équipe supprimée côté serveur disparaît du picker après réconciliation.
    await chooseBossTeam.click();
    await bossTeamOverlay.waitFor({ state:"visible" });
    const staleChoiceCount = await bossTeamChoices.count();
    const removedBossTeam = await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      const index = state.teams.findIndex(team => team.id === "team-boss-four");
      return state.teams.splice(index, 1)[0];
    });
    await bossTeamChoices.first().click();
    await page.waitForFunction(() =>
      document.querySelector("#toast").textContent.includes("Cette équipe ne t’appartient plus.")
    );
    assert.equal(
      await page.locator("#toast").textContent(),
      "Équipe non sélectionnée : Cette équipe ne t’appartient plus. Actualise tes équipes puis choisis-en une autre."
    );
    assert.equal(await bossTeamOverlay.isVisible(), true);
    await page.waitForFunction(expected =>
      document.querySelectorAll("#bossTeamList .boss-team-choice").length === expected
    , staleChoiceCount - 1);
    assert.doesNotMatch(await page.locator("#bossTeamList").textContent(), /Bug/);
    await page.evaluate(team => {
      window.__fakeSupabaseState.teams.push(team);
    }, removedBossTeam);
    await page.keyboard.press("Escape");
    await bossTeamOverlay.waitFor({ state:"hidden" });
    assert.equal(
      await page.evaluate(() => document.activeElement.textContent.trim()),
      "Choisir mon équipe",
      "La réconciliation doit restaurer le focus sur le bouton recréé"
    );

    // Une erreur autoritative ne doit jamais réutiliser l’état Boss obsolète
    // lorsque sa propre actualisation échoue.
    await groupOne.getByRole("button", {
      name:"Choisir mon équipe",
      exact:true
    }).click();
    await bossTeamOverlay.waitFor({ state:"visible" });
    const membershipRemovedDuringFailedRefresh = await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      const session = state.boss_sessions.find(run => run.slot === 1 && run.run_no === 1);
      const index = state.boss_participation.findIndex(item =>
        item.session_id === session.id && item.owner === "user-1"
      );
      state.bossReadFailureOnce = {
        table:"boss_sessions",
        message:"Échec Boss pendant la réconciliation"
      };
      return state.boss_participation.splice(index, 1)[0];
    });
    await bossTeamChoices.first().click();
    await page.waitForFunction(() =>
      document.querySelector("#toast").textContent.includes(
        "Seuls les participants peuvent effectuer cette action."
      )
    );
    assert.equal(
      await bossTeamOverlay.isVisible(),
      false,
      "Le picker doit se fermer si l’état Boss autoritatif n’a pas pu être relu"
    );
    await page.getByText("Groupes indisponibles", { exact:true }).waitFor();
    const retryFailedBossReconciliation = page.locator("#bossBody")
      .getByRole("button", { name:"Réessayer", exact:true });
    assert.equal(
      await page.evaluate(() => document.activeElement.textContent.trim()),
      "Réessayer",
      "Le focus doit arriver sur l’action sûre après l’échec de réconciliation"
    );
    assert.doesNotMatch(
      await page.locator("#bossBody").textContent(),
      /Choisir mon équipe/,
      "La vue sûre ne doit pas réafficher une participation obsolète"
    );
    await retryFailedBossReconciliation.click();
    await groupOne.getByRole("button", { name:"Rejoindre", exact:true }).waitFor();
    await page.evaluate(membership => {
      window.__fakeSupabaseState.boss_participation.push(membership);
      window.__fakeSupabaseEmit("boss_participation", "INSERT");
    }, membershipRemovedDuringFailedRefresh);
    await groupOne.getByRole("button", {
      name:"Choisir mon équipe",
      exact:true
    }).waitFor();

    /* Retour en desktop : les sections suivantes portent sur le focus, Realtime
       et les changements de compte, plus sur la mise en page mobile. Le 390 px
       posé plus haut n'était jamais restauré, et le header rétractable y masque
       désormais le bloc compte dès qu'on a défilé. Les scénarios réellement
       mobiles règlent leur propre viewport. */
    await page.setViewportSize({ width:1280, height:900 });

    // Fermer le picker pendant que la lecture des équipes attend ne doit pas
    // empêcher l’échec Boss déjà connu d’invalider la vue obsolète.
    await groupOne.getByRole("button", {
      name:"Choisir mon équipe",
      exact:true
    }).click();
    await bossTeamOverlay.waitFor({ state:"visible" });
    const membershipRemovedBeforeEscape = await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      const session = state.boss_sessions.find(run => run.slot === 1 && run.run_no === 1);
      const index = state.boss_participation.findIndex(item =>
        item.session_id === session.id && item.owner === "user-1"
      );
      state.bossReadFailureOnce = {
        table:"boss_sessions",
        message:"Échec Boss avant fermeture du picker"
      };
      window.__fakeSupabaseHoldBossRead("teams");
      return state.boss_participation.splice(index, 1)[0];
    });
    await bossTeamChoices.first().click();
    await page.waitForFunction(() =>
      window.__fakeSupabaseState.bossReadFailureOnce === null &&
      typeof window.__fakeSupabaseState.bossReadHold?.release === "function"
    );
    await page.keyboard.press("Escape");
    await bossTeamOverlay.waitFor({ state:"hidden" });
    await page.locator("#authLogout").focus();
    await page.evaluate(() => window.__fakeSupabaseReleaseBossRead());
    await page.waitForFunction(() => !window.__fakeSupabaseState.bossReadHold);
    await page.waitForTimeout(50);
    assert.match(
      await page.locator("#bossBody").textContent(),
      /Groupes indisponibles/,
      "L’échec Boss doit invalider la vue même si le picker a été fermé"
    );
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "authLogout",
      "L’état sûr ne doit pas voler le focus déplacé volontairement hors de la vue Boss"
    );
    await page.locator("#bossBody")
      .getByRole("button", { name:"Réessayer", exact:true })
      .click();
    await groupOne.getByRole("button", { name:"Rejoindre", exact:true }).waitFor();
    await page.evaluate(membership => {
      window.__fakeSupabaseState.boss_participation.push(membership);
      window.__fakeSupabaseEmit("boss_participation", "INSERT");
    }, membershipRemovedBeforeEscape);
    await groupOne.getByRole("button", {
      name:"Choisir mon équipe",
      exact:true
    }).waitFor();

    await groupOne.getByRole("button", {
      name:"Choisir mon équipe",
      exact:true
    }).click();
    await bossTeamOverlay.waitFor({ state:"visible" });
    const removedMembership = await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      const session = state.boss_sessions.find(run => run.slot === 1 && run.run_no === 1);
      const index = state.boss_participation.findIndex(item =>
        item.session_id === session.id && item.owner === "user-1"
      );
      return state.boss_participation.splice(index, 1)[0];
    });
    await bossTeamChoices.first().click();
    await page.waitForFunction(() =>
      document.querySelector("#toast").textContent.includes(
        "Seuls les participants peuvent effectuer cette action."
      )
    );
    await bossTeamOverlay.waitFor({ state:"hidden" });
    await groupOne.getByRole("button", { name:"Rejoindre", exact:true }).waitFor();
    assert.equal(
      await page.evaluate(() => document.activeElement.textContent.trim()),
      "Rejoindre",
      "Une participation disparue doit restituer le focus à l’action disponible"
    );
    await page.evaluate(membership => {
      window.__fakeSupabaseState.boss_participation.push(membership);
      window.__fakeSupabaseEmit("boss_participation", "INSERT");
    }, removedMembership);
    await groupOne.getByRole("button", {
      name:"Choisir mon équipe",
      exact:true
    }).waitFor();

    await groupOne.getByRole("button", {
      name:"Choisir mon équipe",
      exact:true
    }).click();
    await bossTeamOverlay.waitFor({ state:"visible" });
    await page.evaluate(() => {
      const run = window.__fakeSupabaseState.boss_sessions
        .find(item => item.slot === 1 && item.run_no === 1);
      run.status = "archived";
      run.completed_at = "2026-07-26T10:13:00.000Z";
    });
    await bossTeamChoices.first().click();
    await page.waitForFunction(() =>
      document.querySelector("#toast").textContent.includes("Cette run vient d’être terminée.")
    );
    await bossTeamOverlay.waitFor({ state:"hidden" });
    assert.equal(
      await page.evaluate(() => document.activeElement.dataset.view),
      "boss",
      "Une run archivée doit restituer le focus à l’onglet Boss"
    );
    await page.evaluate(() => {
      const run = window.__fakeSupabaseState.boss_sessions
        .find(item => item.slot === 1 && item.run_no === 1);
      run.status = "open";
      run.completed_at = null;
      window.__fakeSupabaseEmit("boss_sessions", "UPDATE");
    });
    await groupOne.getByRole("button", {
      name:"Choisir mon équipe",
      exact:true
    }).waitFor();

    // Une seule sélection est admise ; un ancien résultat ne ferme pas un
    // picker rouvert pour un autre groupe.
    await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      const session = state.boss_sessions.find(run => run.slot === 2 && run.run_no === 1);
      state.boss_participation.push({
        session_id:session.id,
        owner:"user-1",
        pseudo:"Yannis",
        team_id:null,
        team_snapshot:null,
        updated_at:"2026-07-26T10:12:00.000Z"
      });
      window.__fakeSupabaseEmit("boss_participation", "INSERT");
    });
    const groupTwo = page.locator(".boss-card", {
      hasText:"Groupe 2 · Run 1"
    });
    await groupTwo.getByRole("button", {
      name:"Choisir mon équipe",
      exact:true
    }).waitFor();
    const selectCallsBeforePending = await page.evaluate(() =>
      window.__fakeSupabaseState.rpcCalls.filter(call =>
        call.name === "select_boss_team"
      ).length
    );
    await page.evaluate(() => window.__fakeSupabaseHoldBossRpc("select_boss_team"));
    await groupOne.getByRole("button", {
      name:"Choisir mon équipe",
      exact:true
    }).click();
    await bossTeamOverlay.waitFor({ state:"visible" });
    await bossTeamChoices.first().click();
    await page.waitForFunction(() =>
      typeof window.__fakeSupabaseState.bossRpcHold.release === "function"
    );
    assert.equal(
      await bossTeamChoices.evaluateAll(choices =>
        choices.every(choice => choice.disabled)
      ),
      true,
      "Toutes les équipes doivent être bloquées pendant la sélection"
    );
    assert.equal(
      await page.evaluate(() =>
        window.__fakeSupabaseState.rpcCalls.filter(call =>
          call.name === "select_boss_team"
        ).length
      ),
      selectCallsBeforePending + 1,
      "Une seule RPC doit partir pendant le pending"
    );
    await page.locator("#bossTeamClose").click();
    await groupTwo.getByRole("button", {
      name:"Choisir mon équipe",
      exact:true
    }).click();
    await bossTeamOverlay.waitFor({ state:"visible" });
    assert.equal(
      await bossTeamChoices.evaluateAll(choices =>
        choices.every(choice => !choice.disabled)
      ),
      true,
      "Le nouveau picker ne doit pas hériter du pending précédent"
    );
    await page.evaluate(() => window.__fakeSupabaseReleaseBossRpc());
    await page.waitForFunction(() => !window.__fakeSupabaseState.bossRpcHold);
    await page.waitForTimeout(50);
    assert.equal(
      await bossTeamOverlay.isVisible(),
      true,
      "Le résultat de l’ancien picker ne doit pas fermer le nouveau"
    );

    const secondChoiceTeamId = await page.evaluate(() =>
      window.__fakeSupabaseState.teams
        .filter(team => team.owner === "user-1")
        .sort((a,b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[1].id
    );
    await bossTeamChoices.nth(1).click();
    await bossTeamOverlay.waitFor({ state:"hidden" });
    const focusedAfterExplicitTeamRefresh = await page.evaluateHandle(
      () => document.activeElement
    );
    const expectedGroupTwoTeamFocus = await page.evaluate(() => {
      const run = window.__fakeSupabaseState.boss_sessions.find(item =>
        item.slot === 2 && item.run_no === 1
      );
      return { action:"team", sessionId:run.id };
    });
    const currentBossActionFocus = () => page.evaluate(() => {
      const active = document.activeElement;
      const card = active && active.closest(".boss-card");
      return {
        action:active && active.classList.contains("boss-member-team-action")
          ? "team"
          : null,
        sessionId:card && card.dataset.sessionId
      };
    });
    assert.deepEqual(
      await currentBossActionFocus(),
      expectedGroupTwoTeamFocus,
      "Le refresh explicite doit d’abord cibler l’action équipe recréée"
    );
    await page.waitForFunction(
      action => !action.isConnected,
      focusedAfterExplicitTeamRefresh
    );
    assert.deepEqual(
      await currentBossActionFocus(),
      expectedGroupTwoTeamFocus,
      "L’écho Realtime doit conserver la même identité session/action"
    );

    // Le même écho ne doit pas reprendre un focus déplacé hors de la vue Boss.
    await groupTwo.getByRole("button", {
      name:"Changer",
      exact:true
    }).click();
    await bossTeamOverlay.waitFor({ state:"visible" });
    await bossTeamChoices.nth(1).click();
    await bossTeamOverlay.waitFor({ state:"hidden" });
    const groupTwoActionBeforeExternalFocus = await groupTwo.getByRole("button", {
      name:"Changer",
      exact:true
    }).elementHandle();
    assert.ok(
      groupTwoActionBeforeExternalFocus,
      "L’action équipe doit exister avant l’écho Realtime"
    );
    /* La cible du focus externe est un onglet plutôt que `#authLogout` : les
       onglets restent visibles que le header soit replié ou non, ce qui rend ce
       test indépendant de la largeur d'écran. Un onglet est tout aussi
       extérieur à `#bossBody`, donc l'intention est intacte. */
    await page.locator("#tab-builder").focus();
    await page.waitForFunction(
      action => !action.isConnected,
      groupTwoActionBeforeExternalFocus
    );
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "tab-builder",
      "L’écho Realtime ne doit pas voler un focus déplacé hors de la vue Boss"
    );

    assert.deepEqual(
      await page.evaluate(() => {
        const state = window.__fakeSupabaseState;
        const group = state.boss_sessions.find(run => run.slot === 2 && run.run_no === 1);
        const membership = state.boss_participation.find(item =>
          item.session_id === group.id && item.owner === "user-1"
        );
        const call = state.rpcCalls.at(-1);
        return {
          teamId:membership.team_id,
          rpcTeamId:call.args.p_team_id,
          rpcSessionId:call.args.p_session_id
        };
      }),
      {
        teamId:secondChoiceTeamId,
        rpcTeamId:secondChoiceTeamId,
        rpcSessionId:await page.evaluate(() =>
          window.__fakeSupabaseState.boss_sessions
            .find(run => run.slot === 2 && run.run_no === 1).id
        )
      }
    );

    await groupOne.getByText("Équipe prête", { exact:true }).waitFor();
    assert.match(await groupOne.textContent(), /Équipe prête/);
    assert.equal(
      await page.evaluate(() =>
        window.__fakeSupabaseState.rpcCalls.at(-1).name
      ),
      "select_boss_team"
    );
    const selectedBossTeam = await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      const membership = state.boss_participation.find(item =>
        item.owner === "user-1" &&
        item.session_id === state.boss_sessions.find(run => run.slot === 1).id
      );
      const source = state.teams.find(team => team.id === membership.team_id);
      const sourceFirstHero = source.data.heroes[0].char;
      source.data.heroes[0].char = null;
      const snapshotFirstHeroAfterMutation = membership.team_snapshot.data.heroes[0].char;
      source.data.heroes[0].char = sourceFirstHero;
      return {
        membership,
        source,
        sameDataReference:membership.team_snapshot.data === source.data,
        snapshotFirstHeroAfterMutation,
        snapshotKeys:Object.keys(membership.team_snapshot).sort()
      };
    });
    assert.equal(selectedBossTeam.membership.team_id, "team-boss-four");
    assert.equal(selectedBossTeam.membership.team_snapshot.capturedAt, "2026-07-25T10:15:00.000Z");
    assert.equal(selectedBossTeam.sameDataReference, false);
    assert.equal(selectedBossTeam.snapshotFirstHeroAfterMutation, "bug");
    assert.deepEqual(selectedBossTeam.snapshotKeys, [
      "capturedAt",
      "createdAt",
      "data",
      "id",
      "owner",
      "pseudo",
      "updatedAt"
    ]);

    const bossTeamDetailButton = groupOne.getByRole("button", {
      name:/Voir l’équipe de Yannis/
    });
    await bossTeamDetailButton.click();
    await page.locator("#teamOverlay").waitFor({ state:"visible" });
    assert.equal(await page.locator("#teamDetail .hdetail").count(), 4);
    for(const name of ["Bug", "Daisy", "Diane", "Drake"]){
      await page.locator("#teamDetail").getByText(name, { exact:true }).waitFor();
    }
    assert.equal(await page.locator("#teamDetail .hd-portrait img").count(), 4);
    await page.locator("#teamClose").click();

    // Une réconciliation déjà engagée par l’ancien compte ne doit pas
    // remplacer la vue autoritative du compte suivant.
    await groupOne.getByRole("button", {
      name:"Changer",
      exact:true
    }).click();
    await bossTeamOverlay.waitFor({ state:"visible" });
    const teamsRemovedBeforeAccountSwitch = await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      const removed = state.teams.filter(team => team.owner === "user-1");
      state.teams = state.teams.filter(team => team.owner !== "user-1");
      state.bossReadFailureOnce = {
        table:"boss_sessions",
        message:"Échec Boss de l’ancien compte"
      };
      window.__fakeSupabaseHoldBossReadOnce("teams");
      return removed;
    });
    await bossTeamChoices.first().click();
    await page.waitForFunction(() =>
      window.__fakeSupabaseState.bossReadFailureOnce === null &&
      typeof window.__fakeSupabaseState.bossReadHold?.release === "function"
    );
    await page.evaluate(() => window.__fakeSupabaseApplySession({
      id:"user-2",
      email:"merlin@example.test"
    }));
    await page.locator("#accountPseudo").getByText("Merlin", {
      exact:true
    }).waitFor();
    await bossTeamOverlay.waitFor({ state:"hidden", timeout:2000 });
    await page.evaluate(() => window.__fakeSupabaseReleaseBossRead());
    await page.waitForFunction(() => !window.__fakeSupabaseState.bossReadHold);
    await page.locator("#bossBody .boss-card").first().waitFor();
    assert.doesNotMatch(
      await page.locator("#bossBody").textContent(),
      /Groupes indisponibles/,
      "Le résultat tardif de l’ancien compte ne doit pas remplacer la vue de Merlin"
    );
    await page.evaluate(teams => {
      window.__fakeSupabaseState.teams.push(...teams);
    }, teamsRemovedBeforeAccountSwitch);
    await page.evaluate(() => window.__fakeSupabaseApplySession({
      id:"user-1",
      email:"yannis@example.test"
    }));
    await page.locator("#accountPseudo").getByText("Yannis", {
      exact:true
    }).waitFor();
    await groupOne.getByRole("button", {
      name:"Changer",
      exact:true
    }).waitFor();

    // Un changement de compte invalide immédiatement le contexte du picker.
    await groupOne.getByRole("button", {
      name:"Changer",
      exact:true
    }).click();
    await bossTeamOverlay.waitFor({ state:"visible" });
    const staleAccountChoice = await bossTeamChoices.first().elementHandle();
    const accountSwitchSelectCalls = await page.evaluate(() =>
      window.__fakeSupabaseState.rpcCalls.filter(call =>
        call.name === "select_boss_team"
      ).length
    );
    await page.evaluate(() => window.__fakeSupabaseApplySession({
      id:"user-2",
      email:"merlin@example.test"
    }));
    await page.locator("#accountPseudo").getByText("Merlin", {
      exact:true
    }).waitFor();
    await bossTeamOverlay.waitFor({ state:"hidden", timeout:2000 });
    await page.evaluate(choice => choice.click(), staleAccountChoice);
    await page.waitForTimeout(50);
    assert.equal(
      await page.evaluate(() =>
        window.__fakeSupabaseState.rpcCalls.filter(call =>
          call.name === "select_boss_team"
        ).length
      ),
      accountSwitchSelectCalls,
      "Une tuile du compte précédent doit devenir inerte"
    );
    await page.evaluate(() => window.__fakeSupabaseApplySession({
      id:"user-1",
      email:"yannis@example.test"
    }));
    await page.locator("#accountPseudo").getByText("Yannis", {
      exact:true
    }).waitFor();
    await groupOne.getByRole("button", {
      name:"Changer",
      exact:true
    }).waitFor();

    await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      const session = state.boss_sessions.find(run => run.slot === 2 && run.run_no === 1);
      state.boss_participation = state.boss_participation.filter(item =>
        item.session_id !== session.id || item.owner !== "user-1"
      );
      window.__fakeSupabaseEmit("boss_participation", "DELETE");
    });
    await groupTwo.getByRole("button", { name:"Rejoindre", exact:true }).waitFor();

    const ownTeams = await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      const owned = state.teams.filter(team => team.owner === "user-1");
      state.teams = state.teams.filter(team => team.owner !== "user-1");
      return owned;
    });
    await groupOne.getByRole("button", { name:"Changer", exact:true }).click();
    await bossTeamOverlay.waitFor({ state:"visible" });
    assert.match(await page.locator("#bossTeamList").textContent(), /Crée d’abord une équipe/);
    assert.equal(
      await page.locator("#bossTeamList").getByRole("button", {
        name:"Créer une équipe",
        exact:true
      }).count(),
      1
    );
    await page.locator("#bossTeamList").getByRole("button", {
      name:"Créer une équipe",
      exact:true
    }).click();
    await bossTeamOverlay.waitFor({ state:"hidden" });
    assert.equal(await page.locator("#view-builder").getAttribute("class"), "view active");
    assert.equal(
      await page.evaluate(() => document.activeElement.dataset.view),
      "builder"
    );
    await page.evaluate(teams => {
      window.__fakeSupabaseState.teams.push(...teams);
    }, ownTeams);
    await page.locator('.tab[data-view="boss"]').click();
    await groupOne.getByRole("button", { name:"Changer", exact:true }).waitFor();

    const fullGroup = page.locator(".boss-card", {
      hasText:"Groupe 6 · Run 1"
    });
    const fullSessionId = await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      const run = state.boss_sessions.find(item => item.slot === 6 && item.run_no === 1);
      state.boss_participation.push({
        session_id:run.id,
        owner:"user-1",
        pseudo:"Yannis",
        team_id:null,
        team_snapshot:null,
        updated_at:"2026-07-26T10:10:00.000Z"
      });
      for(let index = 1; index <= 4; index++){
        state.boss_participation.push({
          session_id:run.id,
          owner:"full-user-" + index,
          pseudo:"Complet " + index,
          team_id:null,
          team_snapshot:null,
          updated_at:"2026-07-26T10:10:00.000Z"
        });
      }
      window.__fakeSupabaseEmit("boss_participation", "INSERT");
      return run.id;
    });
    await fullGroup.getByText("5/5 joueurs", { exact:true }).waitFor();
    assert.equal(
      await fullGroup.getByRole("button", { name:"Quitter", exact:true }).isEnabled(),
      true,
      "Le membre courant doit pouvoir quitter un groupe complet"
    );
    await fullGroup.getByRole("button", { name:"Quitter", exact:true }).click();
    await page.waitForFunction(sessionId =>
      !window.__fakeSupabaseState.boss_participation.some(item =>
        item.session_id === sessionId && item.owner === "user-1"
      )
    , fullSessionId);
    await fullGroup.getByText("4/5 joueurs", { exact:true }).waitFor();

    await page.evaluate(sessionId => {
      window.__fakeSupabaseState.boss_participation.push({
        session_id:sessionId,
        owner:"full-user-5",
        pseudo:"Complet 5",
        team_id:null,
        team_snapshot:null,
        updated_at:"2026-07-26T10:11:00.000Z"
      });
    }, fullSessionId);
    await fullGroup.getByRole("button", { name:"Rejoindre", exact:true }).click();
    await page.waitForFunction(() =>
      document.querySelector("#toast").textContent.includes(
        "Ce groupe est déjà complet (5/5)."
      )
    );
    assert.equal(
      await page.locator("#toast").textContent(),
      "Action impossible : Ce groupe est déjà complet (5/5)."
    );
    await page.waitForFunction(sessionId =>
      !window.__fakeSupabaseState.boss_participation.some(item =>
        item.session_id === sessionId && item.owner === "user-1"
      )
    , fullSessionId);
    await fullGroup.getByText("5/5 joueurs", { exact:true }).waitFor();
    assert.equal(
      await fullGroup.getByRole("button", { name:"Rejoindre", exact:true }).isDisabled(),
      true
    );
    assert.doesNotMatch(await fullGroup.textContent(), /Yannis/);
    await page.evaluate(sessionId => {
      const state = window.__fakeSupabaseState;
      state.boss_participation = state.boss_participation.filter(item =>
        item.session_id !== sessionId
      );
      window.__fakeSupabaseEmit("boss_participation", "DELETE");
    }, fullSessionId);
    await fullGroup.getByText("0/5 joueurs", { exact:true }).waitFor();

    await page.evaluate(() =>
      window.__fakeSupabaseHoldBossRpc("leave_boss_run")
    );
    await groupOne.getByRole("button", {
      name:"Quitter",
      exact:true
    }).click();
    await page.waitForFunction(() =>
      typeof window.__fakeSupabaseState.bossRpcHold.release === "function"
    );

    assert.doesNotMatch(await groupOne.textContent(), /Yannis/);
    assert.match(await page.locator("#bossCount").textContent(), /0\/3/);
    assert.doesNotMatch(await page.locator("#bossBody").textContent(), /Chargement/);

    await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      const session = state.boss_sessions.find(item => item.slot === 1);
      state.boss_participation.push({
        session_id:session.id,
        owner:"user-2",
        pseudo:"Merlin",
        team_id:null,
        team_snapshot:null,
        updated_at:"2026-07-26T10:05:00.000Z"
      });
      window.__fakeSupabaseEmit("boss_participation", "INSERT");
    });
    await groupOne.getByText("Merlin", { exact:true }).waitFor();
    assert.doesNotMatch(await groupOne.textContent(), /Yannis/);

    await page.evaluate(() => window.__fakeSupabaseReleaseBossRpc());
    await page.waitForFunction(() =>
      !window.__fakeSupabaseState.boss_participation.some(item =>
        item.owner === "user-1"
      )
    );
    assert.match(
      await groupOne.textContent(),
      /Merlin/,
      "La réponse de Quitter ne doit pas retirer le membre concurrent"
    );
    await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      state.boss_participation = state.boss_participation
        .filter(item => item.owner !== "user-2");
      window.__fakeSupabaseEmit("boss_participation", "DELETE");
    });
    await groupOne.getByText("Merlin", { exact:true }).waitFor({ state:"detached" });

    await page.evaluate(() => {
      window.__fakeSupabaseHoldBossRpc("join_boss_run");
      window.__fakeSupabaseState.bossRpcFailureOnce = {
        name:"join_boss_run",
        message:"AUTH_REQUIRED"
      };
    });
    await groupOne.getByRole("button", { name:"Rejoindre", exact:true }).click();
    await page.waitForFunction(() =>
      typeof window.__fakeSupabaseState.bossRpcHold.release === "function"
    );
    assert.match(await groupOne.textContent(), /Yannis/);
    assert.match(await page.locator("#bossCount").textContent(), /1\/3/);
    await page.evaluate(() => {
      window.__fakeSupabaseState.bossReadFailureOnce = {
        table:"boss_sessions",
        message:"Échec de réconciliation simulé"
      };
      window.__fakeSupabaseReleaseBossRpc();
    });
    await page.waitForFunction(() =>
      window.__fakeSupabaseState.bossReadFailureOnce === null
    );
    const authFailureToast = await page.locator("#toast").textContent();
    assert.match(
      authFailureToast,
      /Ta session a expiré\. Reconnecte-toi pour continuer\./
    );
    assert.doesNotMatch(authFailureToast, /Groupes indisponibles/);
    assert.doesNotMatch(await groupOne.textContent(), /Yannis/);
    assert.match(await page.locator("#bossCount").textContent(), /0\/3/);
    await page.evaluate(() => {
      window.__fakeSupabaseState.bossReadFailureOnce = {
        table:"boss_sessions",
        message:"Échec Realtime simulé"
      };
      window.__fakeSupabaseEmit("boss_participation", "UPDATE");
    });
    await page.waitForFunction(() =>
      window.__fakeSupabaseState.bossReadFailureOnce === null
    );
    await page.getByText("Synchronisation indisponible", { exact:true }).waitFor();
    const realtimeFailureToast = await page.locator("#toast").textContent();
    assert.match(
      realtimeFailureToast,
      /Ta session a expiré\. Reconnecte-toi pour continuer\./
    );
    assert.doesNotMatch(realtimeFailureToast, /Groupes indisponibles/);

    await groupOne.getByRole("button", { name:"Rejoindre", exact:true }).click();
    await page.waitForFunction(() => window.__fakeSupabaseState.boss_participation.length === 1);
    await groupOne.getByRole("button", { name:"Quitter", exact:true }).waitFor();
    await page.evaluate(() => {
      window.__fakeSupabaseHoldBossRpc("leave_boss_run");
      window.__fakeSupabaseState.bossRpcFailureOnce = {
        name:"leave_boss_run",
        message:"RUN_ARCHIVED"
      };
    });
    await groupOne.getByRole("button", { name:"Quitter", exact:true }).click();
    await page.waitForFunction(() =>
      typeof window.__fakeSupabaseState.bossRpcHold.release === "function"
    );
    assert.doesNotMatch(await groupOne.textContent(), /Yannis/);
    assert.match(await page.locator("#bossCount").textContent(), /0\/3/);
    await page.evaluate(() => window.__fakeSupabaseReleaseBossRpc());
    await page.waitForFunction(() => {
      const toast = document.querySelector("#toast");
      return toast && toast.classList.contains("on") &&
        toast.textContent.includes("Cette run vient d’être terminée. La liste a été actualisée.");
    });
    assert.match(await groupOne.textContent(), /Yannis/);
    await groupOne.getByRole("button", { name:"Quitter", exact:true }).waitFor();
    assert.match(await page.locator("#bossCount").textContent(), /1\/3/);
    await groupOne.getByRole("button", { name:"Quitter", exact:true }).click();
    await page.waitForFunction(() => window.__fakeSupabaseState.boss_participation.length === 0);

    for(const errorCase of [
      {
        code:"RUN_INVALID_WEEK",
        expected:"La semaine de boss a changé. La liste a été actualisée."
      },
      {
        code:"AUTH_REQUIRED",
        expected:"Ta session a expiré. Reconnecte-toi pour continuer."
      }
    ]){
      await page.evaluate(({ code }) => {
        window.__fakeSupabaseState.bossRpcFailureOnce = {
          name:"join_boss_run",
          message:code
        };
      }, errorCase);
      await page.locator(".boss-card", { hasText:"Groupe 1 · Run 1" })
        .getByRole("button", { name:"Rejoindre", exact:true }).click();
      await page.waitForFunction(expected => {
        const toast = document.querySelector("#toast");
        return toast && toast.classList.contains("on") &&
          toast.textContent.includes(expected);
      }, errorCase.expected);
      const toastText = await page.locator("#toast").textContent();
      assert.match(toastText, new RegExp(errorCase.expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.doesNotMatch(toastText, new RegExp(errorCase.code));
    }
    await page.evaluate(() => { window.__fakeSupabaseState.rpcCalls.length = 0; });

    await page.evaluate(() => {
      window.__fakeSupabaseHoldBossRead("boss_participation");
      window.__fakeSupabaseEmit("boss_participation", "UPDATE");
    });
    await page.waitForFunction(() =>
      typeof window.__fakeSupabaseState.bossReadHold.release === "function"
    );
    await page.evaluate(() =>
      window.__fakeSupabaseHoldBossRpc("join_boss_run")
    );
    await page.locator(".boss-card", { hasText:"Groupe 1 · Run 1" })
      .getByRole("button", { name:"Rejoindre", exact:true }).click();
    await page.waitForFunction(() =>
      typeof window.__fakeSupabaseState.bossRpcHold.release === "function"
    );
    await page.evaluate(() => window.__fakeSupabaseReleaseBossRpc());
    await page.waitForFunction(() =>
      window.__fakeSupabaseState.boss_participation.length === 1
    );
    await page.evaluate(() => window.__fakeSupabaseReleaseBossRead());
    await page.waitForFunction(() => !window.__fakeSupabaseState.bossReadHold);
    await page.waitForTimeout(150);
    const staleReadGroup = page.locator(".boss-card", { hasText:"Groupe 1 · Run 1" });
    assert.match(
      await staleReadGroup.textContent(),
      /Yannis/,
      "Une lecture Realtime antérieure ne doit pas effacer le succès local"
    );
    assert.match(await page.locator("#bossCount").textContent(), /1\/3/);
    await staleReadGroup.getByRole("button", { name:"Quitter", exact:true }).click();
    await page.waitForFunction(() => window.__fakeSupabaseState.boss_participation.length === 0);

    await page.evaluate(() =>
      window.__fakeSupabaseHoldBossRpc("join_boss_run")
    );
    await page.locator(".boss-card", { hasText:"Groupe 1 · Run 1" })
      .getByRole("button", { name:"Rejoindre", exact:true }).click();
    await page.waitForFunction(() =>
      typeof window.__fakeSupabaseState.bossRpcHold.release === "function"
    );
    await page.getByRole("button", { name:"Déconnexion", exact:true }).click();
    await authOverlay.waitFor({ state:"visible" });
    await page.locator("#bossBody").getByText(
      "Connecte-toi pour les groupes de boss",
      { exact:true }
    ).waitFor();
    assert.equal(await page.locator("#bossCount").textContent(), "");
    await page.evaluate(() => window.__fakeSupabaseReleaseBossRpc());
    await page.waitForFunction(() =>
      window.__fakeSupabaseState.boss_participation.some(item => item.owner === "user-1")
    );
    await page.waitForTimeout(100);
    assert.deepEqual(errors, [], "Aucune erreur de page après une déconnexion pendant la RPC");
    assert.doesNotMatch(await page.locator("#bossBody").textContent(), /Yannis/);
    await page.evaluate(() => {
      window.__fakeSupabaseState.boss_participation = [];
    });
    await page.locator("#authEmail").fill("yannis@example.test");
    await page.locator("#authPassword").fill("mot-de-passe-test");
    await page.getByRole("button", { name:"Se connecter", exact:true }).click();
    // Une connexion réussie ouvre « Mon suivi » : ce scénario revient sur Boss.
    await page.locator("#view-dashboard").waitFor({ state:"visible" });
    await page.locator('.tab[data-view="boss"]').click();
    await page.locator(".boss-card", { hasText:"Groupe 1 · Run 1" })
      .getByRole("button", { name:"Rejoindre", exact:true }).waitFor();
    assert.match(await page.locator("#bossCount").textContent(), /0\/3/);
    await page.evaluate(() => { window.__fakeSupabaseState.rpcCalls.length = 0; });

    for(const number of [1, 2, 3]){
      await page.locator(".boss-card", { hasText:"Groupe " + number + " · Run 1" })
        .getByRole("button", { name:"Rejoindre", exact:true }).click();
    }
    await page.waitForFunction(() => window.__fakeSupabaseState.boss_participation.length === 3);
    assert.deepEqual(
      await page.evaluate(() => window.__fakeSupabaseState.rpcCalls
        .filter(call => call.name === "join_boss_run")
        .map(call => call.args)),
      await page.evaluate(() => window.__fakeSupabaseState.boss_sessions
        .filter(item => [1, 2, 3].includes(item.slot) && item.run_no === 1)
        .sort((a,b) => a.slot - b.slot)
        .map(item => ({ p_session_id:item.id }))
      )
    );
    assert.match(await page.locator("#bossCount").textContent(), /3\/3/);
    assert.equal(
      await page.locator(".boss-card", { hasText:"Groupe 4 · Run 1" })
        .getByRole("button", { name:"Rejoindre", exact:true }).isDisabled(),
      true
    );
    const fourthJoinError = await page.evaluate(async () => {
      const run = window.__fakeSupabaseState.boss_sessions.find(item =>
        item.slot === 4 && item.run_no === 1
      );
      const result = await window.__fakeSupabaseClient.rpc(
        "join_boss_run",
        { p_session_id:run.id }
      );
      return result.error && result.error.message;
    });
    assert.equal(fourthJoinError, "RUN_LIMIT_REACHED");
    assert.equal(
      await page.evaluate(() => window.__fakeSupabaseState.boss_participation.length),
      3
    );

    await page.locator(".boss-card", { hasText:"Groupe 1 · Run 1" })
      .getByRole("button", { name:"Quitter", exact:true }).click();
    await page.waitForFunction(() => window.__fakeSupabaseState.boss_participation.length === 2);
    assert.equal(
      await page.evaluate(() => window.__fakeSupabaseState.rpcCalls.some(call =>
        call.name === "leave_boss_run" &&
        call.args.p_session_id === window.__fakeSupabaseState.boss_sessions.find(item =>
          item.slot === 1 && item.run_no === 1
        ).id
      )),
      true,
      "Quitter passe par leave_boss_run"
    );
    assert.match(await page.locator("#bossCount").textContent(), /2\/3/);

    await page.locator(".boss-card", { hasText:"Groupe 4 · Run 1" })
      .getByRole("button", { name:"Rejoindre", exact:true }).click();
    await page.waitForFunction(() => window.__fakeSupabaseState.boss_participation.length === 3);

    const legacyCompleteError = await page.evaluate(async () => {
      const run = window.__fakeSupabaseState.boss_sessions.find(item =>
        item.slot === 2 && item.run_no === 1
      );
      const result = await window.__fakeSupabaseClient.rpc(
        "complete_boss_run",
        { p_session_id:run.id }
      );
      return result.error && result.error.message;
    });
    assert.equal(legacyCompleteError, "REPORT_REQUIRED");

    const bossReportOverlay = page.locator("#bossReportOverlay");
    const missingTeamError = await page.evaluate(async () => {
      const run = window.__fakeSupabaseState.boss_sessions.find(item =>
        item.slot === 2 && item.run_no === 1
      );
      const result = await window.__fakeSupabaseClient.rpc(
        "complete_boss_run_with_report",
        {
          p_session_id:run.id,
          p_global_score:"12450800",
          p_note:"Rotation propre."
        }
      );
      return result.error && result.error.message;
    });
    assert.equal(missingTeamError, "TEAM_REQUIRED:Yannis");
    const missingTeamGroup = page.locator(".boss-card", {
      hasText:"Groupe 2 · Run 1"
    });
    await missingTeamGroup.getByRole("button", {
      name:"Run terminée",
      exact:true
    }).click();
    await bossReportOverlay.waitFor({ state:"visible" });
    assert.match(
      await page.locator("#bossReportError").textContent(),
      /Chaque membre doit choisir une équipe.*Yannis/
    );
    await page.locator("#bossScore").fill("12450800");
    assert.equal(
      await page.locator("#bossReportSubmit").isDisabled(),
      true,
      "Une équipe manquante doit bloquer la terminaison dans l’interface"
    );
    await page.locator("#bossReportClose").click();
    await bossReportOverlay.waitFor({ state:"hidden" });

    const overCapacitySessionId = await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      const run = state.boss_sessions.find(item =>
        item.slot === 2 && item.run_no === 1
      );
      for(let index = 1; index <= 5; index++){
        state.boss_participation.push({
          session_id:run.id,
          owner:"overflow-user-" + index,
          pseudo:"Surnombre " + index,
          team_id:null,
          team_snapshot:null,
          updated_at:"2026-07-25T10:20:00.000Z"
        });
      }
      window.__fakeSupabaseEmit("boss_participation", "INSERT");
      return run.id;
    });
    await missingTeamGroup.getByText(
      "Groupe au-dessus de la nouvelle limite",
      { exact:true }
    ).waitFor({ timeout:2000 });
    assert.match(await missingTeamGroup.textContent(), /6\/5 joueurs/);
    assert.equal(
      await missingTeamGroup.getByRole("button", {
        name:"Run terminée",
        exact:true
      }).isDisabled(),
      true,
      "Une session héritée à 6/5 ne doit pas pouvoir être clôturée localement"
    );
    const overCapacityError = await page.evaluate(async sessionId => {
      const result = await window.__fakeSupabaseClient.rpc(
        "complete_boss_run_with_report",
        {
          p_session_id:sessionId,
          p_global_score:"12450800",
          p_note:""
        }
      );
      return result.error && result.error.message;
    }, overCapacitySessionId);
    assert.equal(overCapacityError, "GROUP_OVER_CAPACITY");
    await page.evaluate(sessionId => {
      const state = window.__fakeSupabaseState;
      state.boss_participation = state.boss_participation.filter(item =>
        !item.owner.startsWith("overflow-user-")
      );
      window.__fakeSupabaseEmit("boss_participation", "DELETE");
    }, overCapacitySessionId);
    await missingTeamGroup.getByText(
      "Groupe au-dessus de la nouvelle limite",
      { exact:true }
    ).waitFor({ state:"detached" });

    const nonMemberError = await page.evaluate(async () => {
      const run = window.__fakeSupabaseState.boss_sessions.find(item =>
        item.slot === 5 && item.run_no === 1
      );
      const result = await window.__fakeSupabaseClient.rpc(
        "complete_boss_run_with_report",
        {
          p_session_id:run.id,
          p_global_score:"12450800",
          p_note:""
        }
      );
      return result.error && result.error.message;
    });
    assert.equal(nonMemberError, "NOT_A_PARTICIPANT");

    await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      const source = state.teams.find(team => team.id === "team-boss-four");
      source.data.heroes[0].weapon =
        "7ds-armes/Hache/Hache à l'aura triomphale.webp";
      state.boss_participation.forEach(member => {
        const run = state.boss_sessions.find(item =>
          item.id === member.session_id && item.status === "open"
        );
        if(!run || ![2, 3, 4].includes(run.slot)) return;
        member.team_id = source.id;
        member.team_snapshot = JSON.parse(JSON.stringify({
          id:source.id,
          owner:source.owner,
          pseudo:source.pseudo,
          data:source.data,
          createdAt:source.created_at,
          updatedAt:source.updated_at,
          capturedAt:"2026-07-25T10:15:00.000Z"
        }));
      });
      window.__fakeSupabaseEmit("boss_participation", "UPDATE");
    });
    const groupTwoReportCard = page.locator(".boss-card", {
      hasText:"Groupe 2 · Run 1"
    });
    await groupTwoReportCard.getByText("Équipe prête", { exact:true }).waitFor();

    // La modale ouverte suit l’état Realtime autoritatif sans perdre les champs.
    await groupTwoReportCard.getByRole("button", {
      name:"Run terminée",
      exact:true
    }).click();
    await bossReportOverlay.waitFor({ state:"visible" });
    await page.locator("#bossScore").fill("12450800");
    await page.locator("#bossReportNote").fill("Saisie Realtime conservée.");
    const liveParticipantId = await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      const run = state.boss_sessions.find(item =>
        item.slot === 2 && item.run_no === 1
      );
      state.boss_participation.push({
        session_id:run.id,
        owner:"live-user",
        pseudo:"Arthur live",
        team_id:null,
        team_snapshot:null,
        updated_at:"2026-07-25T10:24:00.000Z"
      });
      window.__fakeSupabaseEmit("boss_participation", "INSERT");
      return run.id;
    });
    const liveMember = page.locator("#bossReportMembers .boss-report-member", {
      hasText:"Arthur live"
    });
    await liveMember.waitFor({ timeout:2000 });
    assert.match(await liveMember.textContent(), /Équipe à choisir/);
    assert.equal(await page.locator("#bossReportSubmit").isDisabled(), true);
    assert.equal(await page.locator("#bossScore").inputValue(), "12450800");
    assert.equal(
      await page.locator("#bossReportNote").inputValue(),
      "Saisie Realtime conservée."
    );

    await page.evaluate(sessionId => {
      const state = window.__fakeSupabaseState;
      const mine = state.boss_participation.find(item =>
        item.session_id === sessionId && item.owner === "user-1"
      );
      const live = state.boss_participation.find(item =>
        item.session_id === sessionId && item.owner === "live-user"
      );
      live.team_id = mine.team_id;
      live.team_snapshot = JSON.parse(JSON.stringify(mine.team_snapshot));
      window.__fakeSupabaseEmit("boss_participation", "UPDATE");
    }, liveParticipantId);
    await liveMember.getByText("Équipe prête", { exact:true }).waitFor();
    assert.equal(await page.locator("#bossReportSubmit").isEnabled(), true);
    assert.equal(await page.locator("#bossScore").inputValue(), "12450800");
    assert.equal(
      await page.locator("#bossReportNote").inputValue(),
      "Saisie Realtime conservée."
    );

    await page.evaluate(sessionId => {
      const state = window.__fakeSupabaseState;
      const source = state.boss_participation.find(item =>
        item.session_id === sessionId && item.owner === "user-1"
      );
      for(let index = 1; index <= 4; index++){
        state.boss_participation.push({
          session_id:sessionId,
          owner:"live-overflow-" + index,
          pseudo:"Surplus live " + index,
          team_id:source.team_id,
          team_snapshot:JSON.parse(JSON.stringify(source.team_snapshot)),
          updated_at:"2026-07-25T10:25:00.000Z"
        });
      }
      window.__fakeSupabaseEmit("boss_participation", "INSERT");
    }, liveParticipantId);
    await page.locator("#bossReportError").getByText(
      "Groupe au-dessus de la nouvelle limite",
      { exact:true }
    ).waitFor({ timeout:2000 });
    assert.equal(await page.locator("#bossReportSubmit").isDisabled(), true);
    assert.equal(await page.locator("#bossScore").inputValue(), "12450800");
    assert.equal(
      await page.locator("#bossReportNote").inputValue(),
      "Saisie Realtime conservée."
    );

    await page.evaluate(sessionId => {
      const state = window.__fakeSupabaseState;
      state.boss_participation = state.boss_participation.filter(item =>
        item.session_id !== sessionId ||
        (
          item.owner !== "live-user" &&
          !String(item.owner || "").startsWith("live-overflow-")
        )
      );
      window.__fakeSupabaseEmit("boss_participation", "DELETE");
    }, liveParticipantId);
    await liveMember.waitFor({ state:"detached" });
    await page.waitForFunction(() =>
      document.querySelector("#bossReportError")?.textContent === "" &&
      !document.querySelector("#bossReportSubmit")?.disabled
    );
    assert.equal(await page.locator("#bossScore").inputValue(), "12450800");
    assert.equal(
      await page.locator("#bossReportNote").inputValue(),
      "Saisie Realtime conservée."
    );
    await page.locator("#bossReportClose").click();
    await bossReportOverlay.waitFor({ state:"hidden" });

    const groupThreeReportCard = page.locator(".boss-card", {
      hasText:"Groupe 3 · Run 1"
    });
    await groupThreeReportCard.getByRole("button", {
      name:"Run terminée",
      exact:true
    }).click();
    await bossReportOverlay.waitFor({ state:"visible" });
    await page.locator("#bossScore").fill("999");
    await page.locator("#bossReportNote").fill("Archivée ailleurs.");
    await page.evaluate(() => {
      const run = window.__fakeSupabaseState.boss_sessions.find(item =>
        item.slot === 3 && item.run_no === 1
      );
      run.status = "archived";
      run.completed_at = "2026-07-25T10:26:00.000Z";
      window.__fakeSupabaseEmit("boss_sessions", "UPDATE");
    });
    await bossReportOverlay.waitFor({ state:"hidden", timeout:2000 });
    assert.equal(
      await page.evaluate(() => document.activeElement.dataset.view),
      "boss",
      "Une archive autoritative doit fermer la modale sur une cible sûre"
    );
    await page.evaluate(() => {
      const run = window.__fakeSupabaseState.boss_sessions.find(item =>
        item.slot === 3 && item.run_no === 1
      );
      run.status = "open";
      run.completed_at = null;
      window.__fakeSupabaseEmit("boss_sessions", "UPDATE");
    });
    await groupThreeReportCard.getByRole("button", {
      name:"Run terminée",
      exact:true
    }).waitFor();

    const invalidScoreError = await page.evaluate(async () => {
      const run = window.__fakeSupabaseState.boss_sessions.find(item =>
        item.slot === 3 && item.run_no === 1
      );
      const result = await window.__fakeSupabaseClient.rpc(
        "complete_boss_run_with_report",
        {
          p_session_id:run.id,
          p_global_score:"0",
          p_note:""
        }
      );
      return result.error && result.error.message;
    });
    assert.equal(invalidScoreError, "INVALID_SCORE");

    const noteTooLongError = await page.evaluate(async () => {
      const run = window.__fakeSupabaseState.boss_sessions.find(item =>
        item.slot === 3 && item.run_no === 1
      );
      const result = await window.__fakeSupabaseClient.rpc(
        "complete_boss_run_with_report",
        {
          p_session_id:run.id,
          p_global_score:"1",
          p_note:"x".repeat(1001)
        }
      );
      return result.error && result.error.message;
    });
    assert.equal(noteTooLongError, "NOTE_TOO_LONG");

    const fiveMemberRunId = await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      const run = state.boss_sessions.find(item =>
        item.slot === 4 && item.run_no === 1
      );
      const mine = state.boss_participation.find(item =>
        item.session_id === run.id && item.owner === "user-1"
      );
      for(let index = 1; index <= 4; index++){
        state.boss_participation.push({
          session_id:run.id,
          owner:"five-user-" + index,
          pseudo:"Membre " + index,
          team_id:mine.team_id,
          team_snapshot:JSON.parse(JSON.stringify(mine.team_snapshot)),
          updated_at:"2026-07-25T10:25:00.000Z"
        });
      }
      window.__fakeSupabaseEmit("boss_participation", "INSERT");
      return run.id;
    });
    const fiveMemberCard = page.locator(".boss-card", {
      hasText:"Groupe 4 · Run 1"
    });
    await fiveMemberCard.getByText("5/5 joueurs", { exact:true }).waitFor();
    await fiveMemberCard.getByRole("button", {
      name:"Run terminée",
      exact:true
    }).click();
    await bossReportOverlay.waitFor({ state:"visible" });
    assert.equal(
      await page.locator("#bossReportMembers .boss-report-member").count(),
      5
    );
    await page.locator("#bossScore").fill("5000000");
    await page.locator("#bossReportNote").fill("Cinq membres.");
    await page.locator("#bossReportSubmit").click();
    await bossReportOverlay.waitFor({ state:"hidden" });
    await page.locator(".boss-card", { hasText:"Groupe 4 · Run 2" }).waitFor();
    const fiveMemberCompletion = await page.evaluate(id => {
      const state = window.__fakeSupabaseState;
      const call = state.rpcCalls
        .filter(item => item.name === "complete_boss_run_with_report")
        .at(-1);
      return {
        status:state.boss_sessions.find(item => item.id === id).status,
        reportScore:state.boss_run_reports
          .find(item => item.session_id === id)?.global_score,
        participants:state.boss_participation
          .filter(item => item.session_id === id).length,
        args:call && call.args
      };
    }, fiveMemberRunId);
    assert.deepEqual(
      fiveMemberCompletion,
      {
        status:"archived",
        reportScore:5000000,
        participants:5,
        args:{
          p_session_id:fiveMemberRunId,
          p_global_score:"5000000",
          p_note:"Cinq membres."
        }
      },
      "Un groupe exactement à 5 doit être archivé par le parcours UI/RPC"
    );
    await page.evaluate(id => {
      const state = window.__fakeSupabaseState;
      const run = state.boss_sessions.find(item => item.id === id);
      run.status = "open";
      run.completed_at = null;
      state.boss_sessions = state.boss_sessions.filter(item =>
        !(item.slot === run.slot && item.run_no === 2)
      );
      state.boss_run_reports = state.boss_run_reports.filter(item =>
        item.session_id !== id
      );
      state.boss_participation = state.boss_participation.filter(item =>
        item.session_id !== id || !item.owner.startsWith("five-user-")
      );
      window.__fakeSupabaseEmit("boss_sessions", "UPDATE");
      window.__fakeSupabaseEmit("boss_participation", "DELETE");
      window.__fakeSupabaseEmit("boss_run_reports", "DELETE");
    }, fiveMemberRunId);
    await page.locator(".boss-card", { hasText:"Groupe 4 · Run 1" })
      .getByText("1/5 joueurs", { exact:true }).waitFor();

    const archivedId = await page.evaluate(() =>
      window.__fakeSupabaseState.boss_sessions.find(item =>
        item.slot === 2 && item.run_no === 1
      ).id
    );
    await groupTwoReportCard
      .getByRole("button", { name:"Run terminée", exact:true }).click();
    await bossReportOverlay.waitFor({ state:"visible" });
    assert.equal(await bossReportOverlay.getAttribute("aria-hidden"), "false");
    await page.waitForFunction(() => document.activeElement.id === "bossScore");
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "bossScore",
      "Le score doit recevoir le focus à l’ouverture"
    );
    assert.equal(
      await page.locator("#bossScore").getAttribute("aria-describedby"),
      "bossReportError"
    );
    assert.equal(
      await page.locator("#bossScore").getAttribute("aria-invalid"),
      "true",
      "Le score vide et signalé en erreur doit être annoncé comme invalide"
    );
    assert.equal(await page.locator("#bossReportSubmit").isDisabled(), true);
    await page.locator("#bossScore").fill("9007199254740992");
    assert.equal(
      await page.locator("#bossReportSubmit").isDisabled(),
      true,
      "Un score hors de la précision sûre doit être refusé"
    );
    const invalidUiScoreCalls = await page.evaluate(() =>
      window.__fakeSupabaseState.rpcCalls.filter(call =>
        call.name === "complete_boss_run_with_report"
      ).length
    );
    for(const invalidScore of ["12.5", "+12", "-12", "12 000"]){
      await page.locator("#bossScore").fill(invalidScore);
      assert.equal(
        await page.locator("#bossReportSubmit").isDisabled(),
        true,
        `Le score ${JSON.stringify(invalidScore)} doit être refusé`
      );
      assert.equal(
        await page.locator("#bossScore").getAttribute("aria-invalid"),
        "true"
      );
      await page.evaluate(() => document.querySelector("#bossReportSubmit").click());
    }
    assert.equal(
      await page.evaluate(() => window.__fakeSupabaseState.rpcCalls.filter(call =>
        call.name === "complete_boss_run_with_report"
      ).length),
      invalidUiScoreCalls,
      "Décimales, signes et espaces ne doivent déclencher aucune RPC"
    );
    await page.locator("#bossScore").fill("9007199254740991");
    assert.equal(
      await page.locator("#bossReportSubmit").isEnabled(),
      true,
      "La borne MAX_SAFE_INTEGER doit rester acceptée"
    );
    await page.locator("#bossScore").fill("12450800");
    assert.equal(await page.locator("#bossReportSubmit").isDisabled(), false);
    await page.locator("#bossReportNote").fill("x".repeat(899));
    assert.equal(
      await page.locator("#bossReportCount").getAttribute("aria-live"),
      null,
      "Le compteur ne doit pas bavarder loin de la limite"
    );
    await page.locator("#bossReportNote").fill("x".repeat(900));
    assert.equal(
      await page.locator("#bossReportCount").getAttribute("aria-live"),
      "polite",
      "Le compteur doit annoncer l’approche de la limite"
    );
    await page.locator("#bossReportNote").fill("Rotation propre.");
    assert.equal(await page.locator("#bossReportCount").textContent(), "16/1000");
    assert.equal(
      await page.locator("#bossReportCount").getAttribute("aria-live"),
      null,
      "Le compteur doit redevenir silencieux sous le seuil"
    );
    assert.match(await page.locator("#bossReportMembers").textContent(), /Yannis/);

    await page.locator("#bossReportClose").click();
    await bossReportOverlay.waitFor({ state:"hidden" });
    const bossReportTrigger = groupTwoReportCard.getByRole("button", {
      name:"Run terminée",
      exact:true
    });
    const bossReportTriggerHandle = await bossReportTrigger.elementHandle();
    assert.ok(bossReportTriggerHandle, "Le déclencheur du rapport doit exister");
    for(const width of [320, 390]){
      await page.setViewportSize({ width, height:844 });
      await bossReportTrigger.click();
      await bossReportOverlay.waitFor({ state:"visible" });
      await page.waitForFunction(() => document.activeElement.id === "bossScore");
      await page.locator("#bossScore").fill("9007199254740991");
      await page.locator("#bossReportNote").fill("W".repeat(1000));
      const reportMetrics = await page.evaluate(() => {
        const root = document.scrollingElement;
        const overlay = document.querySelector("#bossReportOverlay");
        const modal = document.querySelector(".boss-report-modal");
        const body = document.querySelector(".boss-report-body");
        const score = document.querySelector("#bossScore");
        const note = document.querySelector("#bossReportNote");
        const submit = document.querySelector("#bossReportSubmit");
        const close = document.querySelector("#bossReportClose");
        const overlayRect = overlay.getBoundingClientRect();
        const modalRect = modal.getBoundingClientRect();
        const bodyRect = body.getBoundingClientRect();
        const scoreRect = score.getBoundingClientRect();
        const noteRect = note.getBoundingClientRect();
        const submitRect = submit.getBoundingClientRect();
        const closeRect = close.getBoundingClientRect();
        return {
          viewportWidth:document.documentElement.clientWidth,
          viewportHeight:document.documentElement.clientHeight,
          documentOverflow:root.scrollWidth - root.clientWidth,
          overlay:overlayRect.toJSON(),
          modal:modalRect.toJSON(),
          body:bodyRect.toJSON(),
          score:scoreRect.toJSON(),
          scoreOverflow:score.scrollWidth - score.clientWidth,
          note:noteRect.toJSON(),
          noteOverflow:note.scrollWidth - note.clientWidth,
          members:[...document.querySelectorAll(".boss-report-member")]
            .map(node => node.getBoundingClientRect().toJSON()),
          submitHeight:submitRect.height,
          submitWidth:submitRect.width,
          closeWidth:closeRect.width,
          closeHeight:closeRect.height
        };
      });
      assert.ok(
        reportMetrics.documentOverflow <= 1,
        `Débordement du rapport de ${reportMetrics.documentOverflow}px à ${width}px`
      );
      for(const [label, rect] of [
        ["overlay", reportMetrics.overlay],
        ["modale", reportMetrics.modal],
        ["corps", reportMetrics.body],
        ["score", reportMetrics.score],
        ["note", reportMetrics.note]
      ]){
        assert.ok(
          rect.left >= 0 && rect.top >= 0 &&
          rect.right <= reportMetrics.viewportWidth &&
          rect.bottom <= reportMetrics.viewportHeight,
          `${label} du rapport hors viewport à ${width}px : `+
            JSON.stringify(rect)
        );
      }
      for(const rect of reportMetrics.members){
        assert.ok(
          rect.left >= reportMetrics.body.left &&
          rect.right <= reportMetrics.body.right,
          `Carte membre hors corps à ${width}px : ${JSON.stringify(rect)}`
        );
      }
      assert.ok(
        reportMetrics.score.width >= 44 &&
        reportMetrics.score.height >= 44 &&
        reportMetrics.scoreOverflow <= 1,
        `Le score maximal doit rester contenu et mesurer 44 px à ${width}px`
      );
      assert.ok(
        reportMetrics.note.width >= 44 &&
        reportMetrics.note.height >= 44 &&
        reportMetrics.noteOverflow <= 1,
        `La note non sécable doit rester contenue à ${width}px`
      );
      assert.ok(
        reportMetrics.submitHeight >= 44 && reportMetrics.submitWidth >= 44,
        "L’enregistrement doit rester une cible de 44 px"
      );
      assert.ok(
        reportMetrics.closeWidth >= 44 && reportMetrics.closeHeight >= 44,
        `La fermeture du rapport doit mesurer 44 × 44 px à ${width}px`
      );
      await page.locator("#bossReportClose").focus();
      await page.keyboard.press("Shift+Tab");
      assert.equal(
        await page.evaluate(() =>
          document.querySelector("#bossReportOverlay")
            .contains(document.activeElement)
        ),
        true,
        `Le focus doit rester piégé dans le rapport à ${width}px`
      );
      await page.keyboard.press("Escape");
      await bossReportOverlay.waitFor({ state:"hidden" });
      assert.equal(
        await page.evaluate(trigger =>
          document.activeElement === trigger
        , bossReportTriggerHandle),
        true,
        `Échap doit restituer le focus à la fin de run à ${width}px`
      );
    }
    await page.setViewportSize({ width:390, height:844 });
    await groupTwoReportCard.getByRole("button", {
      name:"Run terminée",
      exact:true
    }).click();
    await bossReportOverlay.waitFor({ state:"visible" });
    await page.locator("#bossScore").fill("12450800");
    await page.locator("#bossReportNote").fill("Rotation propre.");

    for(const errorCase of [
      {
        code:"GROUP_OVER_CAPACITY",
        expected:
          "Des membres doivent quitter ce groupe pour revenir à 5 joueurs."
      },
      {
        code:"TEAM_REQUIRED:Yannis, Arthur",
        expected:
          "Chaque membre doit choisir une équipe avant de terminer la run : Yannis, Arthur."
      },
      {
        code:"INVALID_SCORE",
        expected:"Saisis un score entier supérieur à zéro."
      },
      {
        code:"NOT_A_PARTICIPANT",
        expected:"Seuls les participants peuvent effectuer cette action."
      },
      {
        code:"REPORT_REQUIRED",
        expected:
          "Une mise à jour du site est nécessaire pour terminer cette run."
      },
      {
        code:
          "PGRST202: Could not find the function public.complete_boss_run_with_report in the schema cache",
        expected:
          "La version du site et le schéma partagé ne sont pas compatibles. La maintenance est en cours ; applique la mise à jour proposée puis recharge la page."
      },
      {
        code:"NOTE_TOO_LONG",
        expected:"La note doit contenir 1 000 caractères maximum."
      }
    ]){
      await page.evaluate(code => {
        window.__fakeSupabaseState.bossRpcFailureOnce = {
          name:"complete_boss_run_with_report",
          message:code
        };
      }, errorCase.code);
      await page.locator("#bossReportSubmit").click();
      await page.locator("#bossReportError").getByText(
        errorCase.expected,
        { exact:true }
      ).waitFor({ timeout:2000 });
      assert.equal(
        await bossReportOverlay.isVisible(),
        true,
        `${errorCase.code} doit conserver le rapport ouvert`
      );
      if(errorCase.code === "INVALID_SCORE"){
        assert.equal(await page.locator("#bossScore").inputValue(), "12450800");
        assert.equal(
          await page.locator("#bossScore").getAttribute("aria-invalid"),
          "true",
          "INVALID_SCORE serveur doit invalider un score localement valide"
        );
        assert.equal(await page.locator("#bossReportSubmit").isDisabled(), true);
        await page.locator("#bossReportNote").fill("Note modifiée.");
        assert.equal(
          await page.locator("#bossReportError").textContent(),
          errorCase.expected,
          "Modifier la note ne doit pas effacer INVALID_SCORE"
        );
        assert.equal(
          await page.locator("#bossScore").getAttribute("aria-invalid"),
          "true"
        );
        await page.locator("#bossScore").fill("12450801");
        assert.equal(
          await page.locator("#bossScore").getAttribute("aria-invalid"),
          "false",
          "Le prochain input score doit effacer l’invalidité serveur"
        );
        assert.equal(await page.locator("#bossReportError").textContent(), "");
        await page.locator("#bossScore").fill("12450800");
        await page.locator("#bossReportNote").fill("Rotation propre.");
      }
    }

    const failedCompletionBefore = await page.evaluate(id => {
      const state = window.__fakeSupabaseState;
      state.bossRpcFailureOnce = {
        name:"complete_boss_run_with_report",
        message:"NETWORK_FAILURE"
      };
      const run = state.boss_sessions.find(item => item.id === id);
      return {
        reports:state.boss_run_reports.length,
        status:run.status,
        nextRuns:state.boss_sessions.filter(item =>
          item.slot === run.slot && item.run_no === (run.run_no || 1) + 1
        ).length
      };
    }, archivedId);
    await page.locator("#bossReportSubmit").click();
    await page.locator("#bossReportError").getByText(
      "Le rapport n’a pas été enregistré. Vérifie ta connexion puis réessaie.",
      { exact:true }
    ).waitFor();
    assert.equal(await page.locator("#bossScore").inputValue(), "12450800");
    assert.equal(await page.locator("#bossReportNote").inputValue(), "Rotation propre.");
    assert.equal(await page.locator("#bossReportSubmit").isEnabled(), true);
    assert.equal(await bossReportOverlay.isVisible(), true);
    assert.deepEqual(
      await page.evaluate(id => {
        const state = window.__fakeSupabaseState;
        const run = state.boss_sessions.find(item => item.id === id);
        return {
          reports:state.boss_run_reports.length,
          status:run.status,
          nextRuns:state.boss_sessions.filter(item =>
            item.slot === run.slot && item.run_no === (run.run_no || 1) + 1
          ).length
        };
      }, archivedId),
      failedCompletionBefore,
      "Une erreur ne doit créer ni rapport, ni archive, ni run suivante"
    );

    await page.evaluate(id => {
      const state = window.__fakeSupabaseState;
      const mine = state.boss_participation.find(item =>
        item.session_id === id && item.owner === "user-1"
      );
      state.boss_participation.push({
        session_id:id,
        owner:"week-reset-user",
        pseudo:"Arthur reset",
        team_id:mine.team_id,
        team_snapshot:JSON.parse(JSON.stringify(mine.team_snapshot)),
        updated_at:"2026-07-25T10:29:00.000Z"
      });
      state.bossRpcFailureOnce = {
        name:"complete_boss_run_with_report",
        message:"RUN_INVALID_WEEK"
      };
    }, archivedId);
    await page.locator("#bossReportSubmit").click();
    await bossReportOverlay.waitFor({ state:"hidden", timeout:3000 });
    await page.waitForFunction(() => {
      const toast = document.querySelector("#toast");
      return toast &&
        toast.textContent.includes(
          "La semaine de boss a changé. La liste a été actualisée."
        );
    });
    assert.doesNotMatch(
      await page.locator("#toast").textContent(),
      /RUN_INVALID_WEEK/
    );
    await page.locator("#bossBody").getByText(
      "Arthur reset",
      { exact:true }
    ).waitFor();
    await page.evaluate(() => {
      window.__fakeSupabaseState.boss_participation =
        window.__fakeSupabaseState.boss_participation.filter(item =>
          item.owner !== "week-reset-user"
        );
      window.__fakeSupabaseEmit("boss_participation", "DELETE");
    });
    await page.locator("#bossBody").getByText(
      "Arthur reset",
      { exact:true }
    ).waitFor({ state:"detached" });
    await groupTwoReportCard.getByRole("button", {
      name:"Run terminée",
      exact:true
    }).click();
    await bossReportOverlay.waitFor({ state:"visible" });
    await page.locator("#bossScore").fill("12450800");
    await page.locator("#bossReportNote").fill("Rotation propre.");

    const reportCallsBeforeSubmit = await page.evaluate(() =>
      window.__fakeSupabaseState.rpcCalls.filter(call =>
        call.name === "complete_boss_run_with_report"
      ).length
    );
    await page.evaluate(() =>
      window.__fakeSupabaseHoldBossRpc("complete_boss_run_with_report")
    );
    await page.evaluate(() => {
      const submit = document.querySelector("#bossReportSubmit");
      submit.click();
      submit.click();
    });
    await page.waitForFunction(() =>
      typeof window.__fakeSupabaseState.bossRpcHold.release === "function"
    );
    assert.equal(await page.locator("#bossReportSubmit").isDisabled(), true);
    assert.equal(
      await page.evaluate(() => window.__fakeSupabaseState.rpcCalls.filter(call =>
        call.name === "complete_boss_run_with_report"
      ).length),
      reportCallsBeforeSubmit + 1,
      "Une double soumission ne doit lancer qu’une RPC"
    );
    await page.evaluate(() => window.__fakeSupabaseReleaseBossRpc());
    await bossReportOverlay.waitFor({ state:"hidden" });
    await page.locator(".boss-card", { hasText:"Groupe 2 · Run 2" }).waitFor();
    assert.equal(
      await page.evaluate(id => {
        const call = window.__fakeSupabaseState.rpcCalls
          .filter(item => item.name === "complete_boss_run_with_report")
          .at(-1);
        return JSON.stringify(call && call.args) === JSON.stringify({
          p_session_id:id,
          p_global_score:"12450800",
          p_note:"Rotation propre."
        });
      }, archivedId),
      true,
      "Run terminée passe les trois arguments exacts au RPC atomique"
    );
    assert.equal(
      await page.evaluate(() => window.__fakeSupabaseState.boss_run_reports.length),
      1
    );
    assert.equal(
      await page.evaluate(() => window.__fakeSupabaseState.boss_run_reports[0].global_score),
      12450800
    );
    assert.equal(
      await page.evaluate(id =>
        window.__fakeSupabaseState.boss_sessions.find(item => item.id === id).status
      , archivedId),
      "archived"
    );
    assert.equal(
      await page.evaluate(() => window.__fakeSupabaseState.boss_sessions.filter(item =>
        item.slot === 2 && item.run_no === 2
      ).length),
      1
    );
    const nextRunId = await page.evaluate(() =>
      window.__fakeSupabaseState.boss_sessions.find(item =>
        item.slot === 2 && item.run_no === 2
      ).id
    );
    assert.equal(
      await page.evaluate(id => window.__fakeSupabaseState.boss_participation.some(item =>
        item.session_id === id
      ), nextRunId),
      false,
      "La run suivante est créée vide"
    );
    const nextRunCard = page.locator(".boss-card", { hasText:"Groupe 2 · Run 2" });
    assert.match(await nextRunCard.textContent(), /Personne pour l'instant/);
    assert.equal(
      await nextRunCard.getByRole("button", { name:"Rejoindre", exact:true }).count(),
      1
    );
    assert.equal(await page.locator(".boss-grid .boss-card").count(), 6);
    assert.match(await page.locator("#bossCount").textContent(), /3\/3/);
    assert.match(await page.locator(".boss-archive-current").textContent(), /Groupe 2 · Run 1/);
    assert.match(await page.locator(".boss-archive-current").textContent(), /Yannis/);

    const doubleCompleteError = await page.evaluate(async id => {
      const result = await window.__fakeSupabaseClient.rpc(
        "complete_boss_run_with_report",
        {
          p_session_id:id,
          p_global_score:"12450800",
          p_note:"Rotation propre."
        }
      );
      return result.error && result.error.message;
    }, archivedId);
    assert.equal(doubleCompleteError, "RUN_ARCHIVED");
    assert.equal(
      await page.evaluate(() => window.__fakeSupabaseState.boss_sessions.filter(item =>
        item.slot === 2 && item.run_no === 2
      ).length),
      1,
      "Une double terminaison ne crée jamais deux runs suivantes"
    );
    const archivedLeaveError = await page.evaluate(async id => {
      const result = await window.__fakeSupabaseClient.rpc(
        "leave_boss_run",
        { p_session_id:id }
      );
      return result.error && result.error.message;
    }, archivedId);
    assert.equal(archivedLeaveError, "RUN_ARCHIVED");
    assert.equal(
      await page.evaluate(id => window.__fakeSupabaseState.boss_participation.some(item =>
        item.session_id === id && item.owner === "user-1"
      ), archivedId),
      true,
      "La participation archivée reste définitive"
    );

    const archivedReportCard = page.locator(".boss-report-card", {
      hasText:"Groupe 2 · Run 1"
    });
    await archivedReportCard.waitFor();
    assert.equal(
      (await archivedReportCard.locator(".boss-report-score").textContent())
        .replace(/\s+/g, " ").trim(),
      "12 450 800"
    );
    assert.equal(
      await archivedReportCard.locator(".boss-report-note").textContent(),
      "Rotation propre."
    );
    assert.match(
      await archivedReportCard.locator(".boss-report-meta").textContent(),
      /Rapport enregistré par Yannis/
    );
    assert.equal(
      await archivedReportCard.locator(".boss-report-participant").count(),
      1
    );
    await page.waitForTimeout(180);
    const groupedBossReadsBefore = await page.evaluate(() => {
      const calls = window.__fakeSupabaseState.calls;
      return Object.fromEntries(
        ["boss_sessions", "boss_participation", "boss_run_reports"]
          .map(table => [
            table,
            calls.filter(call =>
              call.table === table && call.operation === "select"
            ).length
          ])
      );
    });
    await page.evaluate(id => {
      const state = window.__fakeSupabaseState;
      state.boss_run_reports
        .find(item => item.session_id === id).global_score = 12450801;
      window.__fakeSupabaseEmit("boss_participation", "UPDATE");
      window.__fakeSupabaseEmit("boss_run_reports", "INSERT");
      window.__fakeSupabaseEmit("boss_sessions", "UPDATE");
    }, archivedId);
    await archivedReportCard.getByText("12 450 801", { exact:true }).waitFor();
    await page.waitForTimeout(180);
    const groupedBossReadsAfter = await page.evaluate(() => {
      const calls = window.__fakeSupabaseState.calls;
      return Object.fromEntries(
        ["boss_sessions", "boss_participation", "boss_run_reports"]
          .map(table => [
            table,
            calls.filter(call =>
              call.table === table && call.operation === "select"
            ).length
          ])
      );
    });
    assert.deepEqual(
      Object.fromEntries(Object.keys(groupedBossReadsAfter).map(table => [
        table,
        groupedBossReadsAfter[table] - groupedBossReadsBefore[table]
      ])),
      {
        boss_sessions:1,
        boss_participation:1,
        boss_run_reports:1
      },
      "Trois événements rapprochés doivent appliquer un seul cycle Boss final"
    );

    const immutableReportBefore = await page.evaluate(id => {
      const state = window.__fakeSupabaseState;
      const source = state.teams.find(team => team.id === "team-boss-four");
      source.data.heroes[0].char = "meliodas";
      source.data.heroes[0].weapon =
        "7ds-armes/Epee 1 main/En plein cœur !.webp";
      const report = state.boss_run_reports.find(item => item.session_id === id);
      const participants = state.boss_participation.filter(item =>
        item.session_id === id
      );
      return {
        immutableReportFields:{
          session_id:report.session_id,
          created_by:report.created_by,
          created_by_pseudo:report.created_by_pseudo,
          created_at:report.created_at
        },
        participants:JSON.stringify(participants),
        snapshot:JSON.stringify(participants[0].team_snapshot)
      };
    }, archivedId);

    await archivedReportCard.getByRole("button", {
      name:"Voir l’équipe de Yannis",
      exact:true
    }).click();
    await page.locator("#teamOverlay").waitFor({ state:"visible" });
    await page.locator("#teamDetail").getByText("Bug", { exact:true }).waitFor();
    await page.locator("#teamDetail")
      .getByText("Hache à l'aura triomphale", { exact:true }).waitFor();
    assert.doesNotMatch(await page.locator("#teamDetail").textContent(), /Meliodas/);
    await page.locator("#teamClose").click();

    const invalidCorrectionError = await page.evaluate(async id => {
      const result = await window.__fakeSupabaseClient.rpc(
        "update_boss_run_report",
        {
          p_session_id:id,
          p_global_score:"0",
          p_note:"Ne doit pas passer"
        }
      );
      return result.error && result.error.message;
    }, archivedId);
    assert.equal(invalidCorrectionError, "INVALID_SCORE");

    await archivedReportCard.getByRole("button", {
      name:"Corriger le rapport",
      exact:true
    }).click();
    await bossReportOverlay.waitFor({ state:"visible" });
    assert.equal(await page.locator("#bossReportTitle").textContent(), "Corriger le rapport");
    assert.equal(
      await page.locator("#bossReportSubmit").textContent(),
      "Enregistrer la correction"
    );
    assert.equal(await page.locator("#bossScore").inputValue(), "12450801");
    assert.equal(await page.locator("#bossReportNote").inputValue(), "Rotation propre.");
    const reportBeforeNotFound = await page.evaluate(id => {
      const state = window.__fakeSupabaseState;
      state.bossRpcFailureOnce = {
        name:"update_boss_run_report",
        message:"REPORT_NOT_FOUND"
      };
      return JSON.parse(JSON.stringify(
        state.boss_run_reports.find(item => item.session_id === id)
      ));
    }, archivedId);
    await page.locator("#bossReportSubmit").click();
    await page.locator("#bossReportError").getByText(
      "Aucun rapport modifiable n’existe pour cette run.",
      { exact:true }
    ).waitFor();
    assert.equal(await bossReportOverlay.isVisible(), true);
    assert.equal(await page.locator("#bossScore").inputValue(), "12450801");
    assert.equal(await page.locator("#bossReportNote").inputValue(), "Rotation propre.");
    assert.equal(
      await page.evaluate(() =>
        window.__fakeSupabaseState.rpcCalls.at(-1).name
      ),
      "update_boss_run_report",
      "REPORT_NOT_FOUND doit provenir de la RPC de correction"
    );
    assert.deepEqual(
      await page.evaluate(id => JSON.parse(JSON.stringify(
        window.__fakeSupabaseState.boss_run_reports
          .find(item => item.session_id === id)
      )), archivedId),
      reportBeforeNotFound,
      "REPORT_NOT_FOUND ne doit modifier aucun champ du rapport"
    );
    const exactLimitNote = "W".repeat(1000);
    await page.locator("#bossScore").fill("9007199254740991");
    await page.locator("#bossReportNote").fill(exactLimitNote);
    assert.equal(
      await page.locator("#bossReportCount").textContent(),
      "1000/1000"
    );
    assert.equal(await page.locator("#bossReportSubmit").isEnabled(), true);
    await page.locator("#bossReportSubmit").click();
    await bossReportOverlay.waitFor({ state:"hidden" });
    await page.waitForFunction(id => {
      const report = window.__fakeSupabaseState.boss_run_reports
        .find(item => item.session_id === id);
      return report &&
        report.global_score === Number.MAX_SAFE_INTEGER &&
        report.note.length === 1000;
    }, archivedId);
    const exactLimitCorrection = await page.evaluate(id => {
      const state = window.__fakeSupabaseState;
      const call = state.rpcCalls
        .filter(item => item.name === "update_boss_run_report")
        .at(-1);
      const report = state.boss_run_reports.find(item =>
        item.session_id === id
      );
      return {
        score:report.global_score,
        noteLength:report.note.length,
        rpcScore:call && call.args.p_global_score,
        rpcNoteLength:call && call.args.p_note.length
      };
    }, archivedId);
    assert.deepEqual(
      exactLimitCorrection,
      {
        score:Number.MAX_SAFE_INTEGER,
        noteLength:1000,
        rpcScore:"9007199254740991",
        rpcNoteLength:1000
      },
      "MAX_SAFE_INTEGER et une note de 1 000 caractères doivent traverser UI et RPC sans altération"
    );
    for(const width of [320, 390]){
      await page.setViewportSize({ width, height:844 });
      const longNoteMetrics = await page.evaluate(id => {
        const root = document.scrollingElement;
        const card = [...document.querySelectorAll(".boss-report-card")]
          .find(item => item.dataset.sessionId === id);
        const note = card.querySelector(".boss-report-note");
        const score = card.querySelector(".boss-report-score");
        const noteRect = note.getBoundingClientRect();
        const scoreRect = score.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        return {
          viewport:document.documentElement.clientWidth,
          documentOverflow:root.scrollWidth - root.clientWidth,
          cardClientWidth:card.clientWidth,
          cardScrollWidth:card.scrollWidth,
          noteOverflow:note.scrollWidth - note.clientWidth,
          noteRight:noteRect.right,
          noteWidth:noteRect.width,
          scoreOverflow:score.scrollWidth - score.clientWidth,
          scoreRight:scoreRect.right,
          scoreWidth:scoreRect.width,
          scoreFont:getComputedStyle(score).fontFamily,
          cardRight:cardRect.right
        };
      }, archivedId);
      assert.ok(
        longNoteMetrics.documentOverflow <= 1 &&
          longNoteMetrics.cardScrollWidth -
            longNoteMetrics.cardClientWidth <= 1 &&
          longNoteMetrics.noteOverflow <= 1 &&
          longNoteMetrics.noteRight <= longNoteMetrics.cardRight + 1 &&
          longNoteMetrics.scoreOverflow <= 1,
        `La note et le score maximal doivent rester contenus à ${width}px : ` +
          JSON.stringify(longNoteMetrics)
      );
    }
    await page.setViewportSize({ width:390, height:844 });

    await archivedReportCard.getByRole("button", {
      name:"Corriger le rapport",
      exact:true
    }).click();
    await bossReportOverlay.waitFor({ state:"visible" });
    assert.equal(
      await page.locator("#bossScore").inputValue(),
      "9007199254740991"
    );
    assert.equal(
      (await page.locator("#bossReportNote").inputValue()).length,
      1000
    );
    await page.locator("#bossScore").fill("13000001");
    await page.locator("#bossReportNote").fill("Rotation corrigée.");
    await page.locator("#bossReportSubmit").click();
    await bossReportOverlay.waitFor({ state:"hidden" });
    await page.waitForFunction(id => {
      const card = [...document.querySelectorAll(".boss-report-card")]
        .find(item => item.dataset.sessionId === id);
      return card && card.textContent.includes("Rotation corrigée.");
    }, archivedId);
    assert.equal(
      await page.evaluate(() =>
        document.activeElement.classList.contains("boss-report-edit")
      ),
      true,
      "La correction doit restituer le focus à son action recréée"
    );

    const correctedReport = await page.evaluate(id => {
      const state = window.__fakeSupabaseState;
      const report = state.boss_run_reports.find(item => item.session_id === id);
      const participants = state.boss_participation.filter(item =>
        item.session_id === id
      );
      return {
        report,
        participants:JSON.stringify(participants),
        snapshot:JSON.stringify(participants[0].team_snapshot)
      };
    }, archivedId);
    assert.equal(correctedReport.report.global_score, 13000001);
    assert.equal(correctedReport.report.note, "Rotation corrigée.");
    assert.equal(correctedReport.report.updated_by, "user-1");
    assert.equal(correctedReport.report.updated_by_pseudo, "Yannis");
    assert.equal(correctedReport.report.updated_at, "2026-07-25T10:45:00.000Z");
    assert.deepEqual(
      {
        session_id:correctedReport.report.session_id,
        created_by:correctedReport.report.created_by,
        created_by_pseudo:correctedReport.report.created_by_pseudo,
        created_at:correctedReport.report.created_at
      },
      immutableReportBefore.immutableReportFields
    );
    assert.equal(correctedReport.participants, immutableReportBefore.participants);
    assert.equal(correctedReport.snapshot, immutableReportBefore.snapshot);
    assert.match(
      await archivedReportCard.locator(".boss-report-meta").textContent(),
      /Corrigé par Yannis/
    );

    await page.evaluate(id => {
      const state = window.__fakeSupabaseState;
      state.boss_run_reports.find(item => item.session_id === id).note =
        "Version de lecture ancienne.";
      window.__fakeSupabaseHoldBossReadOnce("boss_run_reports");
      window.__fakeSupabaseEmit("boss_run_reports", "UPDATE");
    }, archivedId);
    await page.waitForFunction(() =>
      typeof window.__fakeSupabaseState.bossReadHold?.release === "function"
    );
    await page.evaluate(id => {
      window.__fakeSupabaseState.boss_run_reports
        .find(item => item.session_id === id).note = "Rotation corrigée.";
    }, archivedId);
    await page.locator('.tab[data-view="builder"]').click();
    await page.locator('.tab[data-view="boss"]').click();
    await page.locator(".boss-report-card", {
      hasText:"Groupe 2 · Run 1"
    }).getByText("Rotation corrigée.", { exact:true }).waitFor();
    await page.evaluate(() => window.__fakeSupabaseReleaseBossRead());
    await page.waitForFunction(() => !window.__fakeSupabaseState.bossReadHold);
    await page.waitForTimeout(150);
    assert.doesNotMatch(
      await page.locator(".boss-report-card", {
        hasText:"Groupe 2 · Run 1"
      }).textContent(),
      /Version de lecture ancienne/,
      "Une lecture de rapport tardive ne doit pas remplacer un rendu plus récent"
    );

    await page.evaluate(id => {
      const report = window.__fakeSupabaseState.boss_run_reports
        .find(item => item.session_id === id);
      report.note = "Succès ancien à ignorer.";
      window.__fakeSupabaseQueueBossRead(
        "boss-old-success",
        "boss_run_reports"
      );
      window.__fakeSupabaseQueueBossRead(
        "boss-new-success",
        "boss_run_reports"
      );
    }, archivedId);
    await page.locator('.tab[data-view="builder"]').click();
    await page.locator('.tab[data-view="boss"]').click();
    await page.waitForFunction(() =>
      window.__fakeSupabaseState.bossReadQueue
        .some(item => item.token === "boss-old-success" && item.claimed)
    );
    await page.evaluate(id => {
      window.__fakeSupabaseState.boss_run_reports
        .find(item => item.session_id === id).note =
          "Succès récent encore en attente.";
    }, archivedId);
    await page.locator('.tab[data-view="builder"]').click();
    await page.locator('.tab[data-view="boss"]').click();
    await page.waitForFunction(() =>
      window.__fakeSupabaseState.bossReadQueue
        .some(item => item.token === "boss-new-success" && item.claimed)
    );
    await page.evaluate(() =>
      window.__fakeSupabaseReleaseQueuedBossRead("boss-old-success")
    );
    await page.waitForFunction(() =>
      window.__fakeSupabaseState.bossReadQueue
        .some(item => item.token === "boss-old-success" && item.finished)
    );
    await page.waitForTimeout(30);
    assert.doesNotMatch(
      await page.locator("#bossBody").textContent(),
      /Succès ancien à ignorer/,
      "Un succès ancien ne doit pas modifier le DOM pendant le rendu plus récent"
    );
    await page.evaluate(() =>
      window.__fakeSupabaseReleaseQueuedBossRead("boss-new-success")
    );
    await page.getByText("Succès récent encore en attente.", {
      exact:true
    }).waitFor();

    const toastBeforeStaleError = await page.locator("#toast").textContent();
    await page.evaluate(() => {
      window.__fakeSupabaseQueueBossRead(
        "boss-old-error",
        "boss_run_reports",
        "OLD_BOSS_READ_FAILURE"
      );
      window.__fakeSupabaseQueueBossRead(
        "boss-new-after-error",
        "boss_run_reports"
      );
    });
    await page.locator('.tab[data-view="builder"]').click();
    await page.locator('.tab[data-view="boss"]').click();
    await page.waitForFunction(() =>
      window.__fakeSupabaseState.bossReadQueue
        .some(item => item.token === "boss-old-error" && item.claimed)
    );
    await page.locator('.tab[data-view="builder"]').click();
    await page.locator('.tab[data-view="boss"]').click();
    await page.waitForFunction(() =>
      window.__fakeSupabaseState.bossReadQueue
        .some(item => item.token === "boss-new-after-error" && item.claimed)
    );
    await page.evaluate(() =>
      window.__fakeSupabaseReleaseQueuedBossRead("boss-old-error")
    );
    await page.waitForFunction(() =>
      window.__fakeSupabaseState.bossReadQueue
        .some(item => item.token === "boss-old-error" && item.finished)
    );
    await page.waitForTimeout(30);
    assert.equal(
      await page.locator("#toast").textContent(),
      toastBeforeStaleError,
      "Une erreur ancienne ne doit pas remplacer le toast courant"
    );
    assert.doesNotMatch(
      await page.locator("#bossBody").textContent(),
      /Groupes indisponibles/,
      "Une erreur ancienne ne doit pas rendre un état indisponible"
    );
    await page.evaluate(() =>
      window.__fakeSupabaseReleaseQueuedBossRead("boss-new-after-error")
    );
    await page.getByText("Succès récent encore en attente.", {
      exact:true
    }).waitFor();
    await page.evaluate(() => window.__fakeSupabaseClearBossReadQueue());

    await page.evaluate(() => window.__fakeSupabaseApplySession({
      id:"user-2",
      email:"merlin@example.test"
    }));
    await page.locator("#accountPseudo").getByText("Merlin", { exact:true }).waitFor();
    const reportForNonParticipant = page.locator(".boss-report-card", {
      hasText:"Groupe 2 · Run 1"
    });
    await reportForNonParticipant.waitFor();
    assert.equal(
      await reportForNonParticipant.getByRole("button", {
        name:"Corriger le rapport",
        exact:true
      }).count(),
      0,
      "Un non-participant ne doit jamais voir l’action de correction"
    );
    const forbiddenCorrectionError = await page.evaluate(async id => {
      const result = await window.__fakeSupabaseClient.rpc(
        "update_boss_run_report",
        {
          p_session_id:id,
          p_global_score:"14000000",
          p_note:"Intrusion"
        }
      );
      return result.error && result.error.message;
    }, archivedId);
    assert.equal(forbiddenCorrectionError, "NOT_A_PARTICIPANT");

    await page.evaluate(() => window.__fakeSupabaseApplySession({
      id:"user-1",
      email:"yannis@example.test"
    }));
    await page.locator("#accountPseudo").getByText("Yannis", { exact:true }).waitFor();
    await page.locator(".boss-report-card", {
      hasText:"Groupe 2 · Run 1"
    }).getByRole("button", {
      name:"Corriger le rapport",
      exact:true
    }).waitFor();

    const statsFixtures = await page.evaluate(archivedSessionId => {
      const state = window.__fakeSupabaseState;
      const current = state.boss_sessions.find(item =>
        item.id === archivedSessionId
      ).week_start;
      const previousDate = new Date(current + "T00:00:00.000Z");
      previousDate.setUTCDate(previousDate.getUTCDate() - 7);
      const previous = previousDate.toISOString().slice(0,10);
      const sourceSnapshot = state.boss_participation.find(item =>
        item.session_id === archivedSessionId
      ).team_snapshot;
      const currentId = "boss-stats-current";
      const previousId = "boss-stats-previous";
      const legacyId = "boss-report-legacy";

      state.boss_sessions.push(
        {
          id:currentId,
          created_by:"user-2",
          title:"Groupe 5",
          boss_name:"Akumu, bête démoniaque",
          session_date:current,
          week_start:current,
          slot:5,
          run_no:9,
          elements:[],
          status:"archived",
          completed_at:"2026-07-26T11:00:00.000Z",
          created_at:"2026-07-26T09:00:00.000Z"
        },
        {
          id:previousId,
          created_by:"user-2",
          title:"Groupe 4",
          boss_name:"Akumu, bête démoniaque",
          session_date:previous,
          week_start:previous,
          slot:4,
          run_no:2,
          elements:[],
          status:"archived",
          completed_at:"2026-07-19T11:00:00.000Z",
          created_at:"2026-07-19T09:00:00.000Z"
        },
        {
          id:legacyId,
          created_by:"user-1",
          title:"Groupe 1",
          boss_name:"Akumu, bête démoniaque",
          session_date:previous,
          week_start:previous,
          slot:1,
          run_no:1,
          elements:[],
          status:"archived",
          completed_at:"2026-07-18T10:00:00.000Z",
          created_at:"2026-07-18T09:00:00.000Z"
        }
      );
      state.boss_participation.push(
        {
          session_id:currentId,
          owner:"user-2",
          pseudo:"Merlin",
          team_id:sourceSnapshot.id,
          team_snapshot:JSON.parse(JSON.stringify(sourceSnapshot)),
          updated_at:"2026-07-26T11:00:00.000Z"
        },
        {
          session_id:previousId,
          owner:"user-2",
          pseudo:"Merlin",
          team_id:sourceSnapshot.id,
          team_snapshot:JSON.parse(JSON.stringify(sourceSnapshot)),
          updated_at:"2026-07-19T11:00:00.000Z"
        },
        {
          session_id:legacyId,
          owner:"user-1",
          pseudo:"Yannis",
          team_id:null,
          team_snapshot:null,
          updated_at:"2026-07-18T10:00:00.000Z"
        }
      );
      state.boss_run_reports.push(
        {
          session_id:currentId,
          global_score:"15000001",
          note:"Dernière rotation.",
          created_by:"user-2",
          created_by_pseudo:"Merlin",
          created_at:"2026-07-24T09:00:00.000Z",
          updated_by:null,
          updated_by_pseudo:null,
          updated_at:null
        },
        {
          session_id:previousId,
          global_score:"10000000",
          note:"Semaine précédente.",
          created_by:"user-2",
          created_by_pseudo:"Merlin",
          created_at:"2026-07-19T11:00:00.000Z",
          updated_by:null,
          updated_by_pseudo:null,
          updated_at:null
        }
      );
      window.__fakeSupabaseEmit("boss_sessions", "INSERT");
      window.__fakeSupabaseEmit("boss_run_reports", "INSERT");
      return { currentId, previousId, legacyId };
    }, archivedId);

    const bossStats = page.locator(".boss-stats");
    await page.waitForFunction(() =>
      document.querySelector(".boss-stat-count")?.textContent === "2"
    );
    assert.equal(await bossStats.locator(".boss-stat-count").textContent(), "2");
    assert.equal(
      (await bossStats.locator(".boss-stat-best").textContent())
        .replace(/\s+/g, " ").trim(),
      "15 000 001"
    );
    assert.equal(
      (await bossStats.locator(".boss-stat-average").textContent())
        .replace(/\s+/g, " ").trim(),
      "14 000 001"
    );
    assert.equal(
      (await bossStats.locator(".boss-stat-latest").textContent())
        .replace(/\s+/g, " ").trim(),
      "15 000 001",
      "Le dernier score doit suivre completed_at, pas l’ordre created_at des rapports"
    );
    assert.equal(
      (await bossStats.locator(".boss-stat-evolution").textContent())
        .replace(/\s+/g, " ").trim(),
      "+4 000 001 (+40,00 %) par rapport à la semaine précédente"
    );
    await page.evaluate(previousId => {
      window.__fakeSupabaseState.boss_run_reports
        .find(item => item.session_id === previousId).global_score =
          "20000003";
      window.__fakeSupabaseEmit("boss_run_reports", "UPDATE");
    }, statsFixtures.previousId);
    await page.waitForFunction(() =>
      document.querySelector(".boss-stat-evolution")?.textContent
        .includes("−6")
    );
    assert.equal(
      (await bossStats.locator(".boss-stat-evolution").textContent())
        .replace(/\s+/g, " ").trim(),
      "−6 000 002 (−30,00 %) par rapport à la semaine précédente",
      "Une baisse hebdomadaire doit conserver son signe et sa valeur exacte"
    );
    await page.evaluate(previousId => {
      window.__fakeSupabaseState.boss_run_reports
        .find(item => item.session_id === previousId).global_score =
          "14000001";
      window.__fakeSupabaseEmit("boss_run_reports", "UPDATE");
    }, statsFixtures.previousId);
    await page.waitForFunction(() =>
      document.querySelector(".boss-stat-evolution")?.textContent
        .includes("(0,00 %)")
    );
    assert.equal(
      (await bossStats.locator(".boss-stat-evolution").textContent())
        .replace(/\s+/g, " ").trim(),
      "0 (0,00 %) par rapport à la semaine précédente",
      "Une moyenne identique doit afficher une évolution nulle exacte"
    );

    await page.evaluate(({ archivedId, currentId, previousId }) => {
      const reports = window.__fakeSupabaseState.boss_run_reports;
      reports.find(item => item.session_id === archivedId).global_score =
        "9007199254740989";
      reports.find(item => item.session_id === currentId).global_score =
        "9007199254740991";
      reports.find(item => item.session_id === previousId).global_score =
        "4503599627370495";
      window.__fakeSupabaseEmit("boss_run_reports", "UPDATE");
    }, {
      archivedId,
      currentId:statsFixtures.currentId,
      previousId:statsFixtures.previousId
    });
    await page.waitForFunction(() =>
      document.querySelector(".boss-stat-evolution")?.textContent
        .includes("(+100,00 %)")
    );
    assert.equal(
      (await bossStats.locator(".boss-stat-average").textContent())
        .replace(/\s+/g, " ").trim(),
      "9 007 199 254 740 990",
      "La moyenne doit rester exacte près de MAX_SAFE_INTEGER"
    );
    assert.equal(
      (await bossStats.locator(".boss-stat-evolution").textContent())
        .replace(/\s+/g, " ").trim(),
      "+4 503 599 627 370 495 (+100,00 %) par rapport à la semaine précédente",
      "Le delta et le pourcentage ne doivent perdre aucun bit via Number"
    );
    await page.locator("details.boss-archive:not(.boss-archive-current)>summary")
      .click();
    await page.getByText(
      "Rapport non disponible pour cette ancienne run.",
      { exact:true }
    ).waitFor();

    for(const width of [320, 390]){
      await page.setViewportSize({ width, height:844 });
      const archiveMetrics = await page.evaluate(id => {
        const root = document.scrollingElement;
        const card = [...document.querySelectorAll(".boss-report-card")]
          .find(item => item.dataset.sessionId === id);
        const action = card.querySelector("button");
        return {
          overflow:root.scrollWidth - root.clientWidth,
          cardRight:card.getBoundingClientRect().right,
          actionHeight:action.getBoundingClientRect().height
        };
      }, archivedId);
      assert.ok(
        archiveMetrics.overflow <= 1,
        `Débordement des archives de ${archiveMetrics.overflow}px à ${width}px`
      );
      assert.ok(archiveMetrics.cardRight <= width, "Le rapport doit rester dans la fenêtre");
      assert.ok(archiveMetrics.actionHeight >= 44, "Voir l’équipe doit rester une cible de 44 px");
    }
    await page.setViewportSize({ width:390, height:844 });

    await page.evaluate(previousId => {
      const state = window.__fakeSupabaseState;
      state.boss_run_reports = state.boss_run_reports.filter(item =>
        item.session_id !== previousId
      );
      window.__fakeSupabaseEmit("boss_run_reports", "DELETE");
    }, statsFixtures.previousId);
    await page.waitForFunction(() =>
      !document.querySelector(".boss-stat-evolution")
    );
    assert.equal(
      await page.locator(".boss-stat-evolution").count(),
      0,
      "L’évolution ne doit pas apparaître sans moyenne précédente"
    );

    const longBossPseudo = "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW";
    await page.evaluate(pseudo => {
      const state = window.__fakeSupabaseState;
      const run = state.boss_sessions.find(item =>
        item.slot === 3 && item.run_no === 1
      );
      const membership = state.boss_participation.find(item =>
        item.session_id === run.id && item.owner === "user-1"
      );
      membership.pseudo = pseudo;
    }, longBossPseudo);
    await page.locator('.tab[data-view="builder"]').click();
    await page.locator('.tab[data-view="boss"]').click();
    await page.locator(".boss-member-name", { hasText:longBossPseudo }).waitFor();

    for(const width of [320, 360, 390]){
      await page.setViewportSize({ width, height:844 });
      const overflow = await page.evaluate(() =>
        document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth
      );
      assert.ok(overflow <= 1, `Débordement boss de ${overflow}px à ${width}px`);
      const pseudoLayout = await page.locator(".boss-member-name", { hasText:longBossPseudo })
        .evaluate(element => {
          const rect = element.getBoundingClientRect();
          const parentRect = element.parentElement.getBoundingClientRect();
          return {
            right:rect.right,
            parentRight:parentRect.right,
            overflowX:getComputedStyle(element).overflowX
          };
        });
      assert.ok(
        pseudoLayout.right <= pseudoLayout.parentRight + 1 &&
          pseudoLayout.overflowX === "hidden",
        `Le pseudo boss doit rester visuellement contenu à ${width}px`
      );
    }

    /* ---------- Mon suivi : rendu connecté ----------
       Les participations de user-1 sont remises à plat pour que les compteurs
       soient déterministes, quoi qu'aient laissé les scénarios Boss précédents. */
    await page.setViewportSize({ width:1280, height:900 });
    const dashboardWeekStart = await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      const week = state.boss_sessions[0].week_start;
      const openRun = state.boss_sessions.find(run =>
        run.slot === 2 && run.week_start === week && run.status === "open"
      );
      const archivedRun = state.boss_sessions.find(run =>
        run.slot === 4 && run.week_start === week
      );
      archivedRun.status = "archived";
      archivedRun.completed_at = "2026-07-30T20:00:00.000Z";
      state.boss_participation = state.boss_participation
        .filter(item => item.owner !== "user-1");
      state.boss_run_reports.length = 0;
      state.boss_participation.push(
        {
          session_id:openRun.id,
          owner:"user-1",
          pseudo:"Yannis",
          team_id:null,
          team_snapshot:null
        },
        {
          session_id:openRun.id,
          owner:"user-2",
          pseudo:"Merlin",
          team_id:"team-other",
          team_snapshot:{ id:"team-other" }
        },
        {
          session_id:archivedRun.id,
          owner:"user-1",
          pseudo:"Yannis",
          team_id:"team-own",
          team_snapshot:{ id:"team-own" }
        }
      );
      state.boss_run_reports.push({
        session_id:archivedRun.id,
        global_score:"9007199254740991",
        note:"Rapport exact",
        created_by:"user-1",
        created_by_pseudo:"Yannis",
        created_at:"2026-07-30T20:00:00.000Z",
        updated_by:null,
        updated_by_pseudo:null,
        updated_at:null
      });
      return week;
    });
    await page.locator('.tab[data-view="dashboard"]').click();

    await page.getByText("Runs engagées 2/3", { exact:true }).waitFor();
    const dashboardText = () => page.locator("#dashboardBody").textContent();
    assert.match(await dashboardText(), /1\s*Terminées/);
    assert.match(await dashboardText(), /1\s*En cours/);
    assert.match(await dashboardText(), /1\s*Encore disponibles/);
    // Le numéro de run dépend des scénarios Boss précédents : on ne le fige pas.
    assert.match(await dashboardText(), /Groupe 2 · Run \d+/);
    assert.match(await dashboardText(), /Équipe manquante/);
    assert.match(await dashboardText(), /9\s*007\s*199\s*254\s*740\s*991/);
    assert.ok(dashboardWeekStart, "La semaine du tableau de bord doit être connue");

    // ---- Cache écrit par compte et par semaine ----
    const dashboardCacheKey =
      "confrerie7ds.cloud.dashboard.user-1."+dashboardWeekStart;
    assert.equal(
      await page.evaluate(
        key => localStorage.getItem(key) !== null,
        dashboardCacheKey
      ),
      true,
      "Un suivi valide doit être mis en cache"
    );

    // ---- Hors ligne avec cache : dernier état connu + badge ----
    await page.locator('.tab[data-view="builder"]').click();
    await page.evaluate(() => {
      window.__fakeSupabaseState.bossReadFailureOnce = {
        table:"boss_sessions",
        message:"Réseau dashboard indisponible"
      };
      window.__fakeSupabaseEmit("boss_participation", "UPDATE");
    });
    await page.locator('.tab[data-view="dashboard"]').click();
    await page.getByText("Hors ligne", { exact:true }).waitFor();
    assert.match(await dashboardText(), /Runs engagées 2\/3/);
    assert.match(await dashboardText(), /Données potentiellement anciennes/);
    assert.equal(
      await page.locator(
        '#dashboardBody [data-dashboard-network-action="true"]'
      ).first().isDisabled(),
      true,
      "Les actions réseau doivent être désactivées hors ligne"
    );

    // ---- Hors ligne sans cache : jamais un faux 0/3 ----
    await page.evaluate(key => {
      localStorage.removeItem(key);
      window.__fakeSupabaseApplySession(null);
    }, dashboardCacheKey);
    await page.getByText("Connecte-toi pour afficher ton suivi", {
      exact:true
    }).waitFor();
    await page.evaluate(() => {
      window.__fakeSupabaseState.bossReadFailureOnce = {
        table:"boss_sessions",
        message:"Réseau dashboard toujours indisponible"
      };
      window.__fakeSupabaseApplySession({
        id:"user-1",
        email:"yannis@example.test"
      });
    });
    await page.getByText("Suivi indisponible hors ligne", { exact:true }).waitFor();
    assert.doesNotMatch(await dashboardText(), /0\/3/);
    assert.equal(await page.locator(".dashboard-progress").count(), 0);
    await page.getByRole("button", { name:"Réessayer", exact:true }).click();
    await page.getByText("Runs engagées 2/3", { exact:true }).waitFor();

    // ---- Realtime : vue active relue, vue inactive seulement marquée sale ----
    await page.evaluate(() => {
      window.__fakeSupabaseState.calls.length = 0;
      window.__fakeSupabaseEmit("boss_participation", "UPDATE");
    });
    await page.waitForFunction(() =>
      window.__fakeSupabaseState.calls.some(call =>
        call.table === "boss_sessions" && call.operation === "select"
      )
    );

    await page.locator('.tab[data-view="builder"]').click();
    await page.evaluate(() => {
      window.__fakeSupabaseState.calls.length = 0;
      window.__fakeSupabaseEmit("boss_participation", "UPDATE");
    });
    await page.waitForTimeout(180);
    assert.equal(
      await page.evaluate(() =>
        window.__fakeSupabaseState.calls.some(call =>
          call.table === "boss_sessions" && call.operation === "select"
        )
      ),
      false,
      "Realtime ne doit pas relire le dashboard inactif"
    );
    await page.locator('.tab[data-view="dashboard"]').click();
    await page.waitForFunction(() =>
      window.__fakeSupabaseState.calls.some(call =>
        call.table === "boss_sessions" && call.operation === "select"
      )
    );

    // ---- Course : une lecture ancienne ne remplace pas un état plus récent ----
    await page.locator('.tab[data-view="builder"]').click();
    await page.evaluate(() => {
      window.__fakeSupabaseQueueBossRead("dashboard-old", "boss_sessions");
      window.__fakeSupabaseEmit("boss_participation", "UPDATE");
    });
    await page.locator('.tab[data-view="dashboard"]').click();
    await page.waitForFunction(() =>
      window.__fakeSupabaseState.bossReadQueue.some(item =>
        item.token === "dashboard-old" && item.claimed
      )
    );

    await page.locator('.tab[data-view="builder"]').click();
    await page.evaluate(() => {
      const run = window.__fakeSupabaseState.boss_sessions.find(item =>
        item.slot === 2 && item.status === "open"
      );
      run.title = "Groupe actualisé";
      window.__fakeSupabaseEmit("boss_sessions", "UPDATE");
    });
    await page.locator('.tab[data-view="dashboard"]').click();
    await page.getByText(/Groupe actualisé · Run \d+/).first().waitFor();
    await page.evaluate(() =>
      window.__fakeSupabaseReleaseQueuedBossRead("dashboard-old")
    );
    await page.waitForFunction(() =>
      window.__fakeSupabaseState.bossReadQueue.some(item =>
        item.token === "dashboard-old" && item.finished
      )
    );
    assert.match(await dashboardText(), /Groupe actualisé/);

    /* ---- Aucune fuite entre comptes ----
       Merlin est vidé de ses participations pour que son 0/3 soit déterministe
       et distinct des 2/3 de Yannis. */
    await page.locator('.tab[data-view="builder"]').click();
    await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      state.boss_participation = state.boss_participation
        .filter(item => item.owner !== "user-2");
      window.__fakeSupabaseQueueBossRead("dashboard-user-1", "boss_sessions");
      window.__fakeSupabaseEmit("boss_sessions", "UPDATE");
    });
    await page.locator('.tab[data-view="dashboard"]').click();
    await page.waitForFunction(() =>
      window.__fakeSupabaseState.bossReadQueue.some(item =>
        item.token === "dashboard-user-1" && item.claimed
      )
    );
    await page.evaluate(() => window.__fakeSupabaseApplySession({
      id:"user-2",
      email:"merlin@example.test"
    }));
    await page.locator("#accountPseudo").getByText("Merlin", { exact:true }).waitFor();
    await page.getByText("Runs engagées 0/3", { exact:true }).waitFor();
    await page.evaluate(() =>
      window.__fakeSupabaseReleaseQueuedBossRead("dashboard-user-1")
    );
    await page.waitForTimeout(50);
    assert.equal(await page.locator("#accountPseudo").textContent(), "Merlin");
    assert.match(await dashboardText(), /Runs engagées 0\/3/);
    assert.doesNotMatch(await dashboardText(), /Groupe actualisé/);
    await page.evaluate(() => window.__fakeSupabaseApplySession({
      id:"user-1",
      email:"yannis@example.test"
    }));
    await page.locator("#accountPseudo").getByText("Yannis", { exact:true }).waitFor();

    /* ---- Actions directes : chaque bouton ouvre la vraie interface ---- */
    await page.locator('.tab[data-view="dashboard"]').click();
    await page.getByText("Runs engagées 2/3", { exact:true }).waitFor();

    // Choisir mon équipe -> sélecteur d'équipe de la bonne participation.
    await page.locator(
      '[data-dashboard-action="choose-team"][data-session-id]'
    ).click();
    await page.locator("#bossTeamOverlay").waitFor({ state:"visible" });
    assert.equal(
      await page.locator("#bossTeamOverlay").getAttribute("aria-hidden"),
      "false"
    );
    await page.locator("#bossTeamClose").click();
    await page.waitForFunction(() =>
      document.querySelector("#view-boss").contains(document.activeElement)
    );

    // Voir le groupe -> onglet Boss, focus sur la carte de la bonne session.
    await page.locator('.tab[data-view="dashboard"]').click();
    await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      const membership = state.boss_participation.find(item =>
        item.owner === "user-1" && !item.team_snapshot
      );
      membership.team_id = "team-own";
      membership.team_snapshot = { id:"team-own" };
      window.__fakeSupabaseEmit("boss_participation", "UPDATE");
    });
    await page.locator('[data-dashboard-action="view-group"]').first().waitFor();
    const viewGroupSessionId = await page
      .locator('[data-dashboard-action="view-group"]').first()
      .getAttribute("data-session-id");
    await page.locator('[data-dashboard-action="view-group"]').first().click();
    await page.locator("#view-boss").waitFor({ state:"visible" });
    assert.equal(
      await page.evaluate(() =>
        document.activeElement.closest("[data-session-id]")?.dataset.sessionId
      ),
      viewGroupSessionId
    );

    // Corriger le rapport -> modale de rapport en mode correction.
    await page.locator('.tab[data-view="dashboard"]').click();
    await page.locator('[data-dashboard-action="edit-report"]').first().click();
    await page.locator("#bossReportOverlay").waitFor({ state:"visible" });
    assert.equal(
      await page.locator("#bossReportTitle").textContent(),
      "Corriger le rapport"
    );
    await page.locator("#bossReportClose").click();
    await page.waitForFunction(() =>
      document.querySelector("#view-boss").contains(document.activeElement)
    );

    // Trouver un groupe -> onglet Boss, focus sur un Rejoindre disponible.
    await page.locator('.tab[data-view="dashboard"]').click();
    await page.locator('[data-dashboard-action="find-group"]').click();
    await page.locator("#view-boss").waitFor({ state:"visible" });
    assert.equal(
      await page.evaluate(() =>
        document.activeElement.classList.contains("boss-join")
      ),
      true,
      "« Trouver un groupe » doit focaliser un Rejoindre disponible"
    );

    // Voir mes équipes -> onglet des équipes, focus sur son titre.
    await page.locator('.tab[data-view="dashboard"]').click();
    await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      const membership = state.boss_participation.find(item =>
        item.owner === "user-1" && item.team_snapshot
      );
      membership.team_id = null;
      membership.team_snapshot = null;
      window.__fakeSupabaseEmit("boss_participation", "UPDATE");
    });
    await page.locator('[data-dashboard-action="view-teams"]').first().waitFor();
    await page.locator('[data-dashboard-action="view-teams"]').first().click();
    await page.locator("#view-roster").waitFor({ state:"visible" });
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "rosterTitle"
    );

    // Créer une équipe -> builder vierge, hors mode édition.
    await page.locator('.tab[data-view="dashboard"]').click();
    const ownTeamsForDashboard = await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      const removed = state.teams.filter(team => team.owner === "user-1");
      state.teams = state.teams.filter(team => team.owner !== "user-1");
      window.__fakeSupabaseEmit("teams", "DELETE");
      return removed;
    });
    await page.locator('[data-dashboard-action="create-team"]').first().waitFor();
    await page.locator('[data-dashboard-action="create-team"]').first().click();
    await page.locator("#view-builder").waitFor({ state:"visible" });
    assert.equal(await page.locator("#editFlag").isVisible(), false);
    assert.equal(await page.locator(".hero .portrait img").count(), 0);
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "builderTitle"
    );
    await page.evaluate(teams => {
      window.__fakeSupabaseState.teams.push(...teams);
      window.__fakeSupabaseEmit("teams", "INSERT");
    }, ownTeamsForDashboard);

    // Une run devenue archivée entre le clic et le rendu ne doit rien ouvrir.
    await page.locator('.tab[data-view="dashboard"]').click();
    await page.getByText("Runs engagées 2/3", { exact:true }).waitFor();
    await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      const run = state.boss_sessions.find(item =>
        item.slot === 2 && item.status === "open"
      );
      state.staleDashboardRunId = run.id;
    });
    const staleChooseTeam = page.locator(
      '[data-dashboard-action="choose-team"][data-session-id]'
    );
    await staleChooseTeam.waitFor();
    await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      const run = state.boss_sessions.find(item =>
        item.id === state.staleDashboardRunId
      );
      run.status = "archived";
      run.completed_at = "2026-07-31T20:00:00.000Z";
    });
    await staleChooseTeam.click();
    await page.getByText("Cette run n’accepte plus de sélection d’équipe.", {
      exact:true
    }).waitFor();
    assert.equal(
      await page.locator("#bossTeamOverlay").isVisible(),
      false,
      "Une run périmée ne doit pas ouvrir de sélecteur"
    );
    await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      const run = state.boss_sessions.find(item =>
        item.id === state.staleDashboardRunId
      );
      run.status = "open";
      run.completed_at = null;
    });

    /* ---- Mon suivi : mobile de 320 à 390 px ---- */
    await page.locator('.tab[data-view="dashboard"]').click();
    await page.getByText("Runs engagées 2/3", { exact:true }).waitFor();
    for(const width of [320, 360, 375, 390]){
      await page.setViewportSize({ width, height:844 });
      await page.locator('.tab[data-view="dashboard"]').click();
      await page.locator("#dashboardBody").waitFor();
      const metrics = await page.evaluate(() => {
        const root = document.scrollingElement;
        const controls = [...document.querySelectorAll(
          "#view-dashboard button:not([hidden])"
        )].filter(node => node.getClientRects().length).map(node => {
          const rect = node.getBoundingClientRect();
          return { width:rect.width, height:rect.height, right:rect.right };
        });
        const cards = [...document.querySelectorAll(
          "#view-dashboard .dashboard-run-card"
        )].map(node => {
          const rect = node.getBoundingClientRect();
          return { left:rect.left, right:rect.right, width:rect.width };
        });
        return {
          viewport:document.documentElement.clientWidth,
          overflow:root.scrollWidth-root.clientWidth,
          controls,
          cards
        };
      });
      assert.ok(metrics.overflow <= 1, `Mon suivi déborde à ${width}px`);
      assert.ok(metrics.controls.length > 0, `Aucune action mesurée à ${width}px`);
      assert.ok(metrics.cards.length > 0, `Aucune carte mesurée à ${width}px`);
      metrics.controls.forEach(control => {
        assert.ok(control.height >= 44, `Action inférieure à 44 px à ${width}px`);
        assert.ok(control.right <= metrics.viewport + 1);
      });
      metrics.cards.forEach(card => {
        assert.ok(card.left >= 0 && card.right <= metrics.viewport + 1);
      });
    }
    await page.setViewportSize({ width:1280, height:900 });

    await page.getByRole("button", { name:"Déconnexion", exact:true }).click();
    await authOverlay.waitFor({ state:"visible" });
    assert.equal(await authOverlay.evaluate(el => el.classList.contains("on")), true);
    await page.waitForFunction(() =>
      window.__fakeSupabaseState.realtimeChannels.length === 0
    );
    assert.equal(
      await page.evaluate(() => window.__fakeSupabaseState.removedRealtimeChannels),
      11,
      "Chaque changement de compte et déconnexion doit retirer l’ancienne chaîne"
    );
    await page.locator("#authEmail").fill("yannis@example.test");
    await page.locator("#authPassword").fill("mot-de-passe-test");
    await page.getByRole("button", { name:"Se connecter", exact:true }).click();
    await page.waitForFunction(() =>
      window.__fakeSupabaseState.realtimeChannels.length === 1
    );

    await page.evaluate(() => {
      window.__fakeSupabaseHoldProfileRead("user-1");
      window.__fakeSupabaseApplySession({
        id:"user-1",
        email:"yannis@example.test"
      });
    });
    await page.waitForFunction(() =>
      typeof window.__fakeSupabaseState.profileReadHold.release === "function"
    );
    await page.evaluate(() => {
      window.__fakeSupabaseApplySession({
        id:"user-2",
        email:"merlin@example.test"
      });
    });
    await page.locator("#accountPseudo").getByText("Merlin", { exact:true }).waitFor();
    await page.evaluate(() => window.__fakeSupabaseReleaseProfileRead());
    await page.waitForFunction(() =>
      window.__fakeSupabaseState.profileReadHold === null
    );
    assert.equal(await page.locator("#accountPseudo").textContent(), "Merlin");

    // La connexion précédente a ouvert « Mon suivi » : ce scénario vise Boss.
    await page.locator('.tab[data-view="boss"]').click();
    const merlinGroupOne = page.locator(".boss-card", {
      hasText:"Groupe 1 · Run 1"
    });
    await merlinGroupOne.getByRole("button", {
      name:"Rejoindre",
      exact:true
    }).waitFor();
    await page.evaluate(() =>
      window.__fakeSupabaseHoldBossRpc("join_boss_run")
    );
    await merlinGroupOne.getByRole("button", {
      name:"Rejoindre",
      exact:true
    }).click();
    await page.waitForFunction(() =>
      typeof window.__fakeSupabaseState.bossRpcHold.release === "function"
    );
    assert.match(await merlinGroupOne.textContent(), /Merlin/);
    assert.doesNotMatch(await merlinGroupOne.textContent(), /Yannis/);
    await page.evaluate(() => window.__fakeSupabaseReleaseBossRpc());
    await page.waitForFunction(() =>
      window.__fakeSupabaseState.boss_participation.some(item =>
        item.owner === "user-2"
      )
    );
    assert.deepEqual(errors, []);

    console.log("PASS Playwright: Supabase Étape 1 — auth, partage et migration");
  }finally{
    await browser.close();
  }
})().catch(error=>{
  console.error(error);
  process.exitCode = 1;
});

async function installFakeSupabase(page){
  await page.addInitScript(() => {
    const emptyHeroes = () => Array.from({ length:4 }, () => ({
      char:null,
      weapon:null,
      armor:{ Haut:null, Bas:null, Bottes:null, Ceinture:null, "Armure liee":null },
      jewel:{ Anneau:null, Collier:null, "Boucle d'oreille":null },
      potentiel:{ tier:0 },
      note:""
    }));
    const state = {
      session:null,
      authCallbacks:[],
      realtimeChannels:[],
      realtimeTables:[],
      removedRealtimeChannels:0,
      failNextRosterUpsert:false,
      profiles:[
        { id:"user-1", pseudo:"Yannis" },
        { id:"user-2", pseudo:"Merlin" }
      ],
      teams:[
        {
          id:"team-own",
          owner:"user-1",
          pseudo:"Yannis",
          data:{ id:"team-own", pseudo:"Yannis", heroes:emptyHeroes() },
          created_at:"2026-07-24T20:00:00.000Z",
          updated_at:"2026-07-25T08:00:00.000Z"
        },
        {
          id:"team-other",
          owner:"user-2",
          pseudo:"Merlin",
          data:{ id:"team-other", pseudo:"Merlin", heroes:emptyHeroes() },
          created_at:"2026-07-24T19:00:00.000Z",
          updated_at:"2026-07-25T07:00:00.000Z"
        }
      ],
      recensement:[
        {
          owner:"user-1",
          pseudo:"Yannis",
          dps:[{ char:"meliodas", element:"FIRE", pot:7 }],
          updated_at:"2026-07-25T08:30:00.000Z"
        },
        {
          owner:"user-2",
          pseudo:"Merlin",
          dps:[{ char:"merlin", element:"ICE", pot:9 }],
          updated_at:"2026-07-25T08:20:00.000Z"
        }
      ],
      roster_characters:[
        {
          owner:"user-1",
          char_id:"meliodas",
          potential_tier:7,
          builds:{
            Hache:{
              weapon:"7ds-armes/Hache/Hache à l'aura triomphale.webp",
              armor:{
                Haut:"7ds-armures-ssr/Haut/Haut de la mélodie d'Arachnée.webp"
              },
              jewel:{
                Anneau:"7ds-bijoux/Anneau/Anneau de la mélodie d'Arachnée.webp"
              },
              note:"Mon build",
              favorite:true
            },
            "Epee 1 main":{
              weapon:"7ds-armes/Epee 1 main/En plein cœur !.webp",
              armor:{},
              jewel:{},
              note:"",
              favorite:false
            }
          },
          updated_at:"2026-07-25T08:40:00.000Z"
        },
        {
          owner:"user-2",
          char_id:"merlin",
          potential_tier:9,
          builds:{
            Livre:{ weapon:"7ds-armes/Livre/Grimoire béni.webp", armor:{}, jewel:{}, note:"" }
          },
          updated_at:"2026-07-25T08:35:00.000Z"
        }
      ],
      boss_sessions:[],
      boss_participation:[],
      boss_run_reports:[],
      calls:[],
      rpcCalls:[],
      bossRpcFailureOnce:null,
      bossRpcHold:null,
      bossReadHold:null,
      bossReadQueue:[],
      bossReadFailureOnce:null,
      profileReadHold:null
    };

    function clone(value){
      return value == null ? value : JSON.parse(JSON.stringify(value));
    }

    function emit(event){
      const session = clone(state.session);
      queueMicrotask(() => state.authCallbacks.forEach(callback => callback(event, session)));
    }

    function tableRows(table){
      return state[table];
    }

    const bossAcl = {
      sharedReadTables:new Set([
        "boss_sessions",
        "boss_participation",
        "boss_run_reports"
      ]),
      rpcOnlyWriteTables:new Set([
        "boss_participation",
        "boss_run_reports"
      ]),
      owner(){
        return state.session && state.session.user && state.session.user.id;
      },
      canRead(table){
        return !this.sharedReadTables.has(table) || !!this.owner();
      },
      requiresAuthentication(table, operation){
        return operation !== "select" && this.sharedReadTables.has(table);
      },
      requiresRpc(table, operation){
        if(operation === "select") return false;
        if(this.rpcOnlyWriteTables.has(table)) return true;
        return table === "boss_sessions" && operation !== "upsert";
      }
    };

    function currentBossWeekStart(now){
      const p = new Intl.DateTimeFormat("en-CA",{ timeZone:"Europe/Paris",
        year:"numeric", month:"2-digit", day:"2-digit", weekday:"short", hour:"2-digit", hourCycle:"h23" })
        .formatToParts(now || new Date());
      const get = type => (p.find(item => item.type === type) || {}).value;
      const year = +get("year"), month = +get("month"), day = +get("day"), hour = +get("hour");
      const weekday = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 }[get("weekday")];
      let offset = (weekday + 6) % 7;
      if(weekday === 1 && hour < 9) offset = 7;
      const start = new Date(Date.UTC(year, month - 1, day));
      start.setUTCDate(start.getUTCDate() - offset);
      return start.toISOString().slice(0,10);
    }

    async function rpc(name, args){
      const sessionId = args && args.p_session_id;
      const owner = bossAcl.owner();
      const fail = message => ({ data:null, error:{ message } });
      state.rpcCalls.push({ name, args:clone(args) });
      if(!owner) return fail("AUTH_REQUIRED");
      const hold = state.bossRpcHold;
      if(hold && (!hold.name || hold.name === name)){
        await new Promise(resolve => { hold.release = resolve; });
        if(state.bossRpcHold === hold) state.bossRpcHold = null;
      }
      if(state.bossRpcFailureOnce &&
        (!state.bossRpcFailureOnce.name || state.bossRpcFailureOnce.name === name)){
        const message = state.bossRpcFailureOnce.message;
        state.bossRpcFailureOnce = null;
        return fail(message);
      }
      if(name === "complete_boss_run") return fail("REPORT_REQUIRED");

      const scoreValue = value => {
        if(typeof value === "number" && !Number.isSafeInteger(value)) return null;
        const text = String(value == null ? "" : value).trim();
        if(!/^[+-]?\d+$/.test(text)) return null;
        try{
          const exact = BigInt(text);
          if(exact <= 0n) return null;
          return {
            exact,
            stored:exact <= BigInt(Number.MAX_SAFE_INTEGER)
              ? Number(exact)
              : exact.toString()
          };
        }catch(error){
          return null;
        }
      };
      const noteValue = value => String(value == null ? "" : value);
      const profile = state.profiles.find(item => item.id === owner);
      const pseudo = (profile && String(profile.pseudo || "").trim()) || "Membre";

      if(name === "update_boss_run_report"){
        const report = state.boss_run_reports.find(item =>
          item.session_id === sessionId
        );
        if(!report) return fail("REPORT_NOT_FOUND");
        const reportRun = state.boss_sessions.find(item =>
          item.id === report.session_id
        );
        if(!reportRun || reportRun.status !== "archived"){
          return fail("RUN_NOT_ARCHIVED");
        }
        const mine = state.boss_participation.some(item =>
          item.session_id === sessionId && item.owner === owner
        );
        if(!mine) return fail("NOT_A_PARTICIPANT");
        const score = scoreValue(args && args.p_global_score);
        if(!score) return fail("INVALID_SCORE");
        const note = noteValue(args && args.p_note);
        if(Array.from(note).length > 1000) return fail("NOTE_TOO_LONG");
        report.global_score = score.stored;
        report.note = note.trim();
        report.updated_by = owner;
        report.updated_by_pseudo = pseudo;
        report.updated_at = "2026-07-25T10:45:00.000Z";
        return { data:null, error:null };
      }

      const run = state.boss_sessions.find(item => item.id === sessionId);
      if(!run) return fail("RUN_NOT_FOUND");
      if(!run.week_start || run.week_start !== currentBossWeekStart()){
        return fail("RUN_INVALID_WEEK");
      }

      if(name === "join_boss_run"){
        if(run.status !== "open") return fail("RUN_ARCHIVED");
        if(state.boss_participation.some(item =>
          item.session_id === sessionId && item.owner === owner
        )) return { data:null, error:null };
        const memberCount = state.boss_participation.filter(item =>
          item.session_id === sessionId
        ).length;
        if(memberCount >= 5) return fail("GROUP_FULL");
        const weekSessionIds = new Set(state.boss_sessions
          .filter(item => item.week_start === run.week_start)
          .map(item => item.id));
        const used = state.boss_participation.filter(item =>
          item.owner === owner && weekSessionIds.has(item.session_id)
        ).length;
        if(used >= 3) return fail("RUN_LIMIT_REACHED");
        state.boss_participation.push({
          session_id:sessionId,
          owner,
          pseudo,
          team_id:null,
          team_snapshot:null,
          updated_at:"2026-07-25T10:00:00.000Z"
        });
        return { data:null, error:null };
      }

      if(name === "select_boss_team"){
        if(run.status !== "open") return fail("RUN_ARCHIVED");
        const membership = state.boss_participation.find(item =>
          item.session_id === sessionId && item.owner === owner
        );
        if(!membership) return fail("NOT_A_PARTICIPANT");
        const team = state.teams.find(item =>
          item.id === args.p_team_id && item.owner === owner
        );
        if(!team) return fail("TEAM_NOT_OWNED");
        membership.team_id = team.id;
        membership.team_snapshot = clone({
          id:team.id,
          owner:team.owner,
          pseudo:team.pseudo,
          data:team.data,
          createdAt:team.created_at,
          updatedAt:team.updated_at,
          capturedAt:"2026-07-25T10:15:00.000Z"
        });
        membership.updated_at = "2026-07-25T10:15:00.000Z";
        emitDatabase("boss_participation", "UPDATE");
        return { data:null, error:null };
      }

      if(name === "leave_boss_run"){
        if(run.status !== "open") return fail("RUN_ARCHIVED");
        state.boss_participation = state.boss_participation.filter(item =>
          item.session_id !== sessionId || item.owner !== owner
        );
        return { data:null, error:null };
      }

      if(name === "complete_boss_run_with_report"){
        const members = state.boss_participation.filter(item =>
          item.session_id === sessionId
        );
        if(run.status !== "open") return fail("RUN_ARCHIVED");
        const mine = members.some(item =>
          item.session_id === sessionId && item.owner === owner
        );
        if(!mine || members.length < 1) return fail("NOT_A_PARTICIPANT");
        if(members.length > 5) return fail("GROUP_OVER_CAPACITY");
        const missing = members.filter(item => !item.team_snapshot);
        if(missing.length){
          return fail(
            "TEAM_REQUIRED:" +
            (missing.map(item => item.pseudo || "Membre").join(", ") || "Membre")
          );
        }
        const score = scoreValue(args && args.p_global_score);
        if(!score) return fail("INVALID_SCORE");
        const note = noteValue(args && args.p_note);
        if(Array.from(note).length > 1000) return fail("NOTE_TOO_LONG");

        state.boss_run_reports.push({
          session_id:sessionId,
          global_score:score.stored,
          note:note.trim(),
          created_by:owner,
          created_by_pseudo:pseudo,
          created_at:"2026-07-25T10:30:00.000Z",
          updated_by:null,
          updated_by_pseudo:null,
          updated_at:null
        });
        run.status = "archived";
        run.completed_at = "2026-07-25T10:30:00.000Z";
        const nextRunNo = (run.run_no || 1) + 1;
        if(!state.boss_sessions.some(item =>
          item.week_start === run.week_start &&
          item.slot === run.slot &&
          item.run_no === nextRunNo
        )){
          state.boss_sessions.push({
            id:"boss-" + run.week_start + "-" + run.slot + "-" + nextRunNo,
            created_by:owner,
            title:"Groupe " + run.slot,
            boss_name:run.boss_name || null,
            session_date:run.session_date || null,
            week_start:run.week_start,
            slot:run.slot,
            run_no:nextRunNo,
            elements:clone(run.elements || []),
            status:"open",
            completed_at:null,
            created_at:"2026-07-25T10:30:00.000Z"
          });
        }
        return { data:null, error:null };
      }

      return fail("RPC inconnue");
    }

    function query(table){
      let operation = "select";
      let payload = null;
      let upsertOptions = null;
      const filters = [];
      const sorts = [];
      const matchRow = row => filters.every(([key, value]) => {
        if(typeof key === "string" && key.startsWith("__in:")) return value.includes(row[key.slice(5)]);
        return row[key] === value;
      });
      const builder = {
        select(){ operation = "select"; return builder; },
        order(column, options){ sorts.push([column, options && options.ascending === false ? -1 : 1]); return builder; },
        eq(column, value){ filters.push([column, value]); return builder; },
        in(column, values){ filters.push(["__in:" + column, values || []]); return builder; },
        maybeSingle(){ return execute().then(result => ({
          data:Array.isArray(result.data) ? (result.data[0] || null) : result.data,
          error:result.error
        })); },
        upsert(value, options){ operation = "upsert"; payload = clone(value); upsertOptions = options || null; return execute(); },
        update(value){ operation = "update"; payload = clone(value); return builder; },
        delete(){ operation = "delete"; return builder; },
        then(resolve, reject){ return execute().then(resolve, reject); }
      };

      async function execute(){
        state.calls.push({ table, operation, filters:clone(filters), payload:clone(payload) });
        const rows = tableRows(table);
        if(!Array.isArray(rows)) return { data:null, error:{ message:"Table inconnue" } };

        const rpcRequired = () => ({ data:null, error:{ message:"RPC_REQUIRED" } });
        if(
          bossAcl.requiresAuthentication(table, operation) &&
          !bossAcl.owner()
        ){
          return { data:null, error:{ message:"AUTH_REQUIRED" } };
        }
        if(bossAcl.requiresRpc(table, operation)){
          return rpcRequired();
        }

        if(operation === "select"){
          const selected = bossAcl.canRead(table)
            ? clone(rows.filter(matchRow))
            : [];
          if(sorts.length){
            selected.sort((a,b) => {
              for(const [col,dir] of sorts){
                const av = a[col], bv = b[col];
                let c;
                if(typeof av === "number" && typeof bv === "number") c = (av - bv);
                else c = String(av==null?"":av).localeCompare(String(bv==null?"":bv));
                if(c) return c * dir;
              }
              return 0;
            });
          }
          const queuedHold = state.bossReadQueue.find(item =>
            !item.claimed && (!item.table || item.table === table)
          );
          if(queuedHold){
            queuedHold.claimed = true;
            await new Promise(resolve => { queuedHold.release = resolve; });
            queuedHold.finished = true;
            if(queuedHold.error){
              return { data:null, error:{ message:queuedHold.error } };
            }
          }
          if(state.bossReadFailureOnce &&
            (!state.bossReadFailureOnce.table || state.bossReadFailureOnce.table === table)){
            const message = state.bossReadFailureOnce.message;
            state.bossReadFailureOnce = null;
            return { data:null, error:{ message } };
          }
          const hold = state.bossReadHold;
          if(
            hold &&
            (!hold.table || hold.table === table) &&
            (!hold.once || !hold.claimed)
          ){
            hold.claimed = true;
            await new Promise(resolve => { hold.release = resolve; });
            if(state.bossReadHold === hold) state.bossReadHold = null;
          }
          const profileHold = state.profileReadHold;
          const profileId = filters.find(([key]) => key === "id");
          if(table === "profiles" && profileHold &&
            (!profileHold.userId || (profileId && profileId[1] === profileHold.userId))){
            await new Promise(resolve => { profileHold.release = resolve; });
            if(state.profileReadHold === profileHold) state.profileReadHold = null;
          }
          return { data:selected, error:null };
        }

        if(operation === "delete"){
          for(let index = rows.length - 1; index >= 0; index--){
            if(matchRow(rows[index])) rows.splice(index, 1);
          }
          return { data:null, error:null };
        }

        if(operation === "update"){
          rows.forEach((row, index) => {
            if(matchRow(row)) rows[index] = Object.assign({}, row, payload);
          });
          return { data:null, error:null };
        }

        const values = Array.isArray(payload) ? payload : [payload];
        if(table === "boss_sessions"){
          const validSeed = operation === "upsert" &&
            upsertOptions && upsertOptions.ignoreDuplicates === true &&
            values.length === 6 &&
            values.every(value =>
              value.created_by === (state.session && state.session.user && state.session.user.id) &&
              value.week_start === currentBossWeekStart() &&
              value.session_date === value.week_start &&
              (value.run_no == null || value.run_no === 1) &&
              value.title === "Groupe " + value.slot &&
              value.boss_name === "Akumu, bête démoniaque" &&
              Array.isArray(value.elements) && value.elements.length === 0 &&
              value.status === "open" &&
              value.completed_at == null &&
              value.remind_at == null &&
              value.reminded_at == null
            );
          const slots = values.map(value => value.slot).sort((a,b) => a-b);
          if(!validSeed || slots.join(",") !== "1,2,3,4,5,6") return rpcRequired();
        }
        if(table === "roster_characters" && state.failNextRosterUpsert){
          state.failNextRosterUpsert = false;
          return { data:null, error:{ message:"Échec simulé" } };
        }
        values.forEach(value => {
          const index = rows.findIndex(row => {
            if(table === "roster_characters"){
              return row.owner === value.owner && row.char_id === value.char_id;
            }
            if(table === "boss_participation"){
              return row.session_id === value.session_id && row.owner === value.owner;
            }
            if(table === "boss_sessions"){
              return row.week_start === value.week_start &&
                row.slot === value.slot &&
                (row.run_no || 1) === (value.run_no || 1);
            }
            const key = table === "profiles"
              ? "id"
              : (table === "recensement" ? "owner" : "id");
            return row[key] === value[key];
          });
          // onConflict + ignoreDuplicates : on ne réécrit pas une ligne déjà là (garde son id).
          if(index >= 0 && upsertOptions && upsertOptions.ignoreDuplicates) return;
          const stamped = Object.assign({}, value);
          if(table === "boss_sessions") stamped.run_no = stamped.run_no || 1;
          if(table === "teams"){
            stamped.created_at = index >= 0 ? rows[index].created_at : "2026-07-25T09:00:00.000Z";
            stamped.updated_at = stamped.updated_at || "2026-07-25T09:00:00.000Z";
          }
          if(index >= 0) rows[index] = Object.assign({}, rows[index], stamped);
          else rows.push(stamped);
        });
        return { data:clone(values), error:null };
      }

      return builder;
    }

    function channel(name){
      const handlers = [];
      const realtimeChannel = {
        name,
        handlers,
        on(kind, filter, callback){
          if(
            kind === "postgres_changes" &&
            !state.realtimeTables.includes(filter.table)
          ){
            state.realtimeTables.push(filter.table);
          }
          handlers.push({ kind, filter:clone(filter), callback });
          return realtimeChannel;
        },
        subscribe(callback){
          realtimeChannel.statusCallback = callback;
          state.realtimeChannels.push(realtimeChannel);
          queueMicrotask(() => callback("SUBSCRIBED"));
          return realtimeChannel;
        }
      };
      return realtimeChannel;
    }

    function emitDatabase(table, eventType){
      state.realtimeChannels.forEach(realtimeChannel => {
        realtimeChannel.handlers
          .filter(handler =>
            handler.kind === "postgres_changes" &&
            handler.filter.schema === "public" &&
            handler.filter.table === table
          )
          .forEach(handler => handler.callback({
            schema:"public",
            table,
            eventType:eventType || "UPDATE",
            new:{},
            old:{}
          }));
      });
    }

    window.__fakeSupabaseState = state;
    window.__fakeSupabaseEmit = emitDatabase;
    window.__fakeSupabaseHoldBossRpc = name => {
      state.bossRpcHold = { name, release:null };
    };
    window.__fakeSupabaseReleaseBossRpc = () => {
      const hold = state.bossRpcHold;
      if(!hold || typeof hold.release !== "function") return false;
      hold.release();
      return true;
    };
    window.__fakeSupabaseHoldBossRead = table => {
      state.bossReadHold = { table, release:null, once:false, claimed:false };
    };
    window.__fakeSupabaseHoldBossReadOnce = table => {
      state.bossReadHold = { table, release:null, once:true, claimed:false };
    };
    window.__fakeSupabaseReleaseBossRead = () => {
      const hold = state.bossReadHold;
      if(!hold || typeof hold.release !== "function") return false;
      hold.release();
      return true;
    };
    window.__fakeSupabaseQueueBossRead = (token, table, error) => {
      state.bossReadQueue.push({
        token,
        table,
        error:error || null,
        claimed:false,
        release:null,
        finished:false
      });
    };
    window.__fakeSupabaseReleaseQueuedBossRead = token => {
      const hold = state.bossReadQueue.find(item => item.token === token);
      if(!hold || typeof hold.release !== "function") return false;
      hold.release();
      return true;
    };
    window.__fakeSupabaseClearBossReadQueue = () => {
      state.bossReadQueue = state.bossReadQueue.filter(item => !item.finished);
    };
    window.__fakeSupabaseHoldProfileRead = userId => {
      state.profileReadHold = { userId, release:null };
    };
    window.__fakeSupabaseReleaseProfileRead = () => {
      const hold = state.profileReadHold;
      if(!hold || typeof hold.release !== "function") return false;
      hold.release();
      return true;
    };
    window.__fakeSupabaseApplySession = user => {
      state.session = user ? { user:clone(user) } : null;
      emit(user ? "SIGNED_IN" : "SIGNED_OUT");
    };
    localStorage.setItem("confrerie7ds.teams", JSON.stringify([{
      id:"local-team",
      pseudo:"Ancien pseudo",
      heroes:emptyHeroes(),
      createdAt:1700000000000,
      updatedAt:1700000000000
    }]));
    localStorage.setItem("confrerie7ds.recensement", JSON.stringify([{
      id:"local-player",
      name:"Yannis",
      dps:[{ char:"diane", element:"EARTH", pot:6 }]
    }]));
    window.__fakeSupabaseClient = {
      auth:{
        async getSession(){ return { data:{ session:clone(state.session) }, error:null }; },
        async signInWithPassword({ email }){
          state.session = { user:{ id:"user-1", email } };
          emit("SIGNED_IN");
          return { data:{ session:clone(state.session), user:clone(state.session.user) }, error:null };
        },
        async signUp({ email }){
          state.session = { user:{ id:"user-1", email } };
          emit("SIGNED_IN");
          return { data:{ session:clone(state.session), user:clone(state.session.user) }, error:null };
        },
        async signOut(){
          state.session = null;
          emit("SIGNED_OUT");
          return { error:null };
        },
        onAuthStateChange(callback){
          state.authCallbacks.push(callback);
          return { data:{ subscription:{ unsubscribe(){} } } };
        }
      },
      channel,
      async removeChannel(realtimeChannel){
        state.realtimeChannels = state.realtimeChannels
          .filter(item => item !== realtimeChannel);
        state.removedRealtimeChannels++;
        return "ok";
      },
      rpc,
      from:query
    };
  });

  await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*", route =>
    route.fulfill({
      status:200,
      contentType:"application/javascript",
      body:"window.supabase={createClient:function(){return window.__fakeSupabaseClient;}};"
    })
  );
}
