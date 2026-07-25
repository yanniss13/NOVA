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

    await page.locator('.tab[data-view="member-roster"]').click();
    await page.locator("#memberRosterGrid .member-roster-card").first().waitFor();
    assert.equal(await page.locator("#memberRosterGrid .member-roster-card").count(), 1);
    assert.match(await page.locator("#memberRosterGrid").textContent(), /Meliodas/);
    assert.equal(await page.locator("#memberRosterGrid .member-roster-edit").count(), 1);
    await page.locator("#memberRosterGrid .member-roster-edit").click();
    await page.locator("#memberRosterOverlay").waitFor({ state:"visible" });
    assert.match(await page.locator("#memberRosterEditor").textContent(), /Potentiel commun/);
    assert.match(await page.locator("#memberRosterEditor").textContent(), /Hache/);
    await page.locator("#memberRosterSave").click();
    await page.locator("#memberRosterOverlay").waitFor({ state:"hidden" });
    assert.equal(
      await page.evaluate(() =>
        window.__fakeSupabaseState.roster_characters
          .find(row => row.owner === "user-1" && row.char_id === "meliodas")
          .potential_tier
      ),
      7
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

    // #1 Groupes de boss : 6 groupes auto-créés par semaine ; rejoindre / quitter (multi-groupes).
    await page.locator('.tab[data-view="boss"]').click();
    await page.locator(".boss-grid .boss-card").nth(5).waitFor();
    assert.equal(await page.locator(".boss-grid .boss-card").count(), 6, "6 groupes créés automatiquement");
    // Une seule semaine de groupes créée (pas de doublon malgré plusieurs rendus/ensureWeek).
    assert.equal(await page.evaluate(() => window.__fakeSupabaseState.boss_sessions.length), 6);

    const groupe1 = page.locator(".boss-card", { hasText:"Groupe 1" });
    await groupe1.getByRole("button", { name:"Rejoindre", exact:true }).click();
    await page.waitForFunction(() => window.__fakeSupabaseState.boss_participation.some(r => r.owner === "user-1"));
    await groupe1.getByRole("button", { name:"Quitter", exact:true }).waitFor();
    assert.match(await page.locator("#bossCount").textContent(), /1\s+groupe rejoint/);

    // Multi-groupes : on peut aussi rejoindre le Groupe 2.
    await page.locator(".boss-card", { hasText:"Groupe 2" }).getByRole("button", { name:"Rejoindre", exact:true }).click();
    await page.waitForFunction(() => window.__fakeSupabaseState.boss_participation.length === 2);
    assert.match(await page.locator("#bossCount").textContent(), /2\s+groupes rejoints/);

    // Quitter le Groupe 1 -> il ne reste qu'un groupe.
    await groupe1.getByRole("button", { name:"Quitter", exact:true }).click();
    await page.waitForFunction(() => window.__fakeSupabaseState.boss_participation.length === 1);
    assert.match(await page.locator("#bossCount").textContent(), /1\s+groupe rejoint/);

    await page.getByRole("button", { name:"Déconnexion", exact:true }).click();
    await authOverlay.waitFor({ state:"visible" });
    assert.equal(await authOverlay.evaluate(el => el.classList.contains("on")), true);
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
              armor:{},
              jewel:{},
              note:"Mon build"
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
      calls:[]
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

        if(operation === "select"){
          const selected = rows.filter(matchRow);
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
          return { data:clone(selected), error:null };
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
              return row.week_start === value.week_start && row.slot === value.slot;
            }
            const key = table === "profiles"
              ? "id"
              : (table === "recensement" ? "owner" : "id");
            return row[key] === value[key];
          });
          // onConflict + ignoreDuplicates : on ne réécrit pas une ligne déjà là (garde son id).
          if(index >= 0 && upsertOptions && upsertOptions.ignoreDuplicates) return;
          const stamped = Object.assign({}, value);
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

    window.__fakeSupabaseState = state;
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
