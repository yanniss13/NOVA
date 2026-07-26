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

    await page.locator("#authEmail").fill("yannis@example.test");
    await page.locator("#authPassword").fill("mot-de-passe-test");
    await page.getByRole("button", { name:"Se connecter", exact:true }).click();

    await page.locator("#accountPseudo").getByText("Yannis", { exact:true }).waitFor();
    assert.equal(await authOverlay.evaluate(el => el.classList.contains("on")), false);
    await page.getByText("À jour", { exact:true }).waitFor();
    assert.equal(
      await page.evaluate(() => window.__fakeSupabaseState.realtimeChannels.length),
      1
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
        row.builds.Hache.favorite === true;
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

    await page.locator("#memberRosterOthers").click();
    await page.locator("#memberRosterOwner").selectOption("user-2");
    await page.locator("#memberRosterGrid .member-roster-card").first().waitFor();
    assert.match(await page.locator("#memberRosterGrid").textContent(), /Merlin/);
    assert.equal(await page.locator("#memberRosterGrid .member-roster-edit").count(), 0);
    assert.equal(await page.locator("#memberRosterGrid .member-roster-delete").count(), 0);

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
    assert.equal(
      await page.locator("#rosterGrid .team-actions").count(),
      1,
      "Seule l'équipe du membre connecté doit être modifiable"
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
    const ownTeam = page.locator("#rosterGrid .team")
      .filter({ hasText:"Yannis" })
      .first();
    await ownTeam.getByRole("button", { name:/Voir l'équipement/ }).click();
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
    assert.equal(await migrateButton.isDisabled(), true);
    assert.equal(await migrateButton.textContent(), "Données locales importées");
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
        "complete_boss_run"
      ].map(async name => {
        const result = await window.__fakeSupabaseClient.rpc(name, {
          p_session_id:invalidRun.id
        });
        return result.error && result.error.message;
      }));
      state.boss_sessions = state.boss_sessions.filter(item => item.id !== invalidRun.id);
      return errors;
    });
    assert.deepEqual(invalidWeekErrors, [
      "RUN_INVALID_WEEK",
      "RUN_INVALID_WEEK",
      "RUN_INVALID_WEEK"
    ]);
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
        client.from("boss_sessions").delete().eq("id", run.id)
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

    const chooseBossTeam = groupOne.getByRole("button", {
      name:"Choisir mon équipe",
      exact:true
    });
    await chooseBossTeam.click();
    const bossTeamOverlay = page.locator("#bossTeamOverlay");
    await bossTeamOverlay.waitFor({ state:"visible" });
    const bossTeamChoices = page.locator("#bossTeamList .boss-team-choice");
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
    assert.equal(
      await page.evaluate(() =>
        document.activeElement.classList.contains("boss-team-choice")
      ),
      true,
      "Le focus initial doit arriver sur la première équipe"
    );
    for(const width of [320, 390]){
      await page.setViewportSize({ width, height:844 });
      const modalMetrics = await page.evaluate(() => {
        const root = document.scrollingElement;
        const choice = document.querySelector(".boss-team-choice");
        const rect = choice.getBoundingClientRect();
        return {
          overflow:root.scrollWidth - root.clientWidth,
          choiceHeight:rect.height,
          choiceRight:rect.right
        };
      });
      assert.ok(
        modalMetrics.overflow <= 1,
        `Débordement du sélecteur d’équipe de ${modalMetrics.overflow}px à ${width}px`
      );
      assert.ok(modalMetrics.choiceHeight >= 44, "Une équipe doit rester une cible tactile de 44 px");
      assert.ok(modalMetrics.choiceRight <= width, "Une équipe ne doit pas sortir de la fenêtre");
    }
    await page.setViewportSize({ width:390, height:844 });
    await page.keyboard.press("Escape");
    await bossTeamOverlay.waitFor({ state:"hidden" });
    assert.equal(
      await page.evaluate(() => document.activeElement.textContent.trim()),
      "Choisir mon équipe",
      "Le focus doit revenir au bouton qui a ouvert le sélecteur"
    );

    await chooseBossTeam.click();
    await bossTeamOverlay.waitFor({ state:"visible" });
    await page.evaluate(() => {
      window.__fakeSupabaseState.bossRpcFailureOnce = {
        name:"select_boss_team",
        message:"TEAM_NOT_OWNED"
      };
    });
    await bossTeamChoices.first().click();
    await page.waitForFunction(() =>
      document.querySelector("#toast").textContent.includes("Cette équipe ne t’appartient plus.")
    );
    assert.equal(await bossTeamOverlay.isVisible(), true);
    assert.equal(await bossTeamChoices.first().isDisabled(), false);

    await bossTeamChoices.first().click();
    await bossTeamOverlay.waitFor({ state:"hidden" });
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
      return {
        membership,
        source,
        sameDataReference:membership.team_snapshot.data === source.data
      };
    });
    assert.equal(selectedBossTeam.membership.team_snapshot.capturedAt, "2026-07-25T10:15:00.000Z");
    assert.equal(selectedBossTeam.sameDataReference, false);

    const bossTeamDetailButton = groupOne.getByRole("button", {
      name:/Voir l’équipe de Yannis/
    });
    await bossTeamDetailButton.click();
    await page.locator("#teamOverlay").waitFor({ state:"visible" });
    assert.equal(await page.locator("#teamDetail .hdetail").count(), 4);
    await page.locator("#teamClose").click();

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
    await page.keyboard.press("Escape");
    await page.evaluate(teams => {
      window.__fakeSupabaseState.teams.push(...teams);
    }, ownTeams);

    const fullGroup = page.locator(".boss-card", {
      hasText:"Groupe 6 · Run 1"
    });
    const fullSessionId = await page.evaluate(() => {
      const state = window.__fakeSupabaseState;
      const run = state.boss_sessions.find(item => item.slot === 6 && item.run_no === 1);
      for(let index = 1; index <= 5; index++){
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
      await fullGroup.getByRole("button", { name:"Rejoindre", exact:true }).isDisabled(),
      true
    );
    const fullResult = await page.evaluate(async sessionId => {
      const result = await window.__fakeSupabaseClient.rpc("join_boss_run", {
        p_session_id:sessionId
      });
      return result.error && result.error.message;
    }, fullSessionId);
    assert.equal(fullResult, "GROUP_FULL");
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

    page.once("dialog", dialog => dialog.accept());
    await page.locator(".boss-card", { hasText:"Groupe 2 · Run 1" })
      .getByRole("button", { name:"Run terminée", exact:true }).click();
    await page.locator(".boss-card", { hasText:"Groupe 2 · Run 2" }).waitFor();
    assert.equal(
      await page.evaluate(() => window.__fakeSupabaseState.rpcCalls.some(call =>
        call.name === "complete_boss_run" &&
        call.args.p_session_id === window.__fakeSupabaseState.boss_sessions.find(item =>
          item.slot === 2 && item.run_no === 1
        ).id
      )),
      true,
      "Run terminée passe par complete_boss_run"
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

    const archivedId = await page.evaluate(() =>
      window.__fakeSupabaseState.boss_sessions.find(item =>
        item.slot === 2 && item.run_no === 1
      ).id
    );
    await page.evaluate(async id => {
      await window.__fakeSupabaseClient.rpc("complete_boss_run", { p_session_id:id });
    }, archivedId);
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

    const nonMemberError = await page.evaluate(async () => {
      const run = window.__fakeSupabaseState.boss_sessions.find(item =>
        item.slot === 5 && item.run_no === 1
      );
      const result = await window.__fakeSupabaseClient.rpc(
        "complete_boss_run",
        { p_session_id:run.id }
      );
      return result.error && result.error.message;
    });
    assert.equal(nonMemberError, "RUN_MEMBERS_ONLY");

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
    await page.locator(".boss-chip", { hasText:longBossPseudo }).waitFor();

    for(const width of [320, 360, 390]){
      await page.setViewportSize({ width, height:844 });
      const overflow = await page.evaluate(() =>
        document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth
      );
      assert.ok(overflow <= 1, `Débordement boss de ${overflow}px à ${width}px`);
      const chipOverflow = await page.locator(".boss-chip", { hasText:longBossPseudo })
        .evaluate(element => element.scrollWidth - element.clientWidth);
      assert.ok(
        chipOverflow <= 1,
        `Débordement interne du pseudo boss de ${chipOverflow}px à ${width}px`
      );
    }

    await page.getByRole("button", { name:"Déconnexion", exact:true }).click();
    await authOverlay.waitFor({ state:"visible" });
    assert.equal(await authOverlay.evaluate(el => el.classList.contains("on")), true);
    await page.waitForFunction(() =>
      window.__fakeSupabaseState.realtimeChannels.length === 0
    );
    assert.equal(
      await page.evaluate(() => window.__fakeSupabaseState.removedRealtimeChannels),
      2
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
      const run = state.boss_sessions.find(item => item.id === sessionId);
      const owner = state.session && state.session.user && state.session.user.id;
      const fail = message => ({ data:null, error:{ message } });
      state.rpcCalls.push({ name, args:clone(args) });
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
      if(!owner) return fail("AUTH_REQUIRED");
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
        const profile = state.profiles.find(item => item.id === owner);
        state.boss_participation.push({
          session_id:sessionId,
          owner,
          pseudo:(profile && profile.pseudo) || "Membre",
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
          created_at:team.created_at,
          updated_at:team.updated_at,
          capturedAt:"2026-07-25T10:15:00.000Z"
        });
        membership.updated_at = "2026-07-25T10:15:00.000Z";
        return { data:null, error:null };
      }

      if(name === "leave_boss_run"){
        if(run.status !== "open") return fail("RUN_ARCHIVED");
        state.boss_participation = state.boss_participation.filter(item =>
          item.session_id !== sessionId || item.owner !== owner
        );
        return { data:null, error:null };
      }

      if(name === "complete_boss_run"){
        if(run.status !== "open") return { data:null, error:null };
        const mine = state.boss_participation.some(item =>
          item.session_id === sessionId && item.owner === owner
        );
        if(!mine) return fail("RUN_MEMBERS_ONLY");
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
        if(table === "boss_participation" && ["upsert", "update", "delete"].includes(operation)){
          return rpcRequired();
        }
        if(table === "boss_sessions" && ["update", "delete"].includes(operation)){
          return rpcRequired();
        }

        if(operation === "select"){
          const selected = clone(rows.filter(matchRow));
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
          if(state.bossReadFailureOnce &&
            (!state.bossReadFailureOnce.table || state.bossReadFailureOnce.table === table)){
            const message = state.bossReadFailureOnce.message;
            state.bossReadFailureOnce = null;
            return { data:null, error:{ message } };
          }
          const hold = state.bossReadHold;
          if(hold && (!hold.table || hold.table === table)){
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
      state.bossReadHold = { table, release:null };
    };
    window.__fakeSupabaseReleaseBossRead = () => {
      const hold = state.bossReadHold;
      if(!hold || typeof hold.release !== "function") return false;
      hold.release();
      return true;
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
