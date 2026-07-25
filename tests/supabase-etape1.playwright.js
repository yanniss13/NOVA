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

    await page.locator('.tab[data-view="recensement"]').click();
    await page.locator("#recGrid .rec-player").first().waitFor();
    assert.equal(await page.locator("#recGrid .rec-player").count(), 2);
    assert.equal(await page.locator("#recAddPlayer").isVisible(), false);

    const ownRecensement = page.locator("#recGrid .rec-player").filter({ hasText:"Yannis" });
    const otherRecensement = page.locator("#recGrid .rec-player").filter({ hasText:"Merlin" });
    assert.equal(await ownRecensement.locator(".dps-add").count(), 1);
    assert.equal(await otherRecensement.locator(".dps-add").count(), 0);
    assert.equal(await otherRecensement.locator(".rec-del").count(), 0);

    await ownRecensement.locator(".dps-add").click();
    await page.locator('#pickerGrid .tile[title="Diane"]').click();
    await page.waitForFunction(() => {
      const mine = window.__fakeSupabaseState.recensement.find(row => row.owner === "user-1");
      return mine && mine.dps.length === 2;
    });

    await page.locator('.tab[data-view="analyse"]').click();
    await page.locator("#analyseBody .rank-table").waitFor();
    const analyseText = await page.locator("#analyseBody").textContent();
    assert.match(analyseText, /Yannis/);
    assert.match(analyseText, /Merlin/);

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

    const migratedRecensement = await page.evaluate(() =>
      window.__fakeSupabaseState.recensement.find(row => row.owner === "user-1")
    );
    assert.deepEqual(migratedRecensement.dps, [
      { char:"diane", element:"EARTH", pot:6 }
    ]);
    assert.equal(await migrateButton.isDisabled(), true);
    assert.equal(await migrateButton.textContent(), "Données locales importées");
    assert.equal(
      await page.evaluate(() => localStorage.getItem("confrerie7ds.teams") !== null),
      true,
      "La migration ne doit pas supprimer le filet de sauvegarde local"
    );

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
      profiles:[{ id:"user-1", pseudo:"Yannis" }],
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
      const filters = [];
      const builder = {
        select(){ operation = "select"; return builder; },
        order(column, options){
          return execute().then(result => {
            if(result.error || !Array.isArray(result.data)) return result;
            const direction = options && options.ascending === false ? -1 : 1;
            result.data.sort((a,b) => String(a[column]||"").localeCompare(String(b[column]||"")) * direction);
            return result;
          });
        },
        eq(column, value){ filters.push([column, value]); return builder; },
        maybeSingle(){ return execute().then(result => ({
          data:Array.isArray(result.data) ? (result.data[0] || null) : result.data,
          error:result.error
        })); },
        upsert(value){ operation = "upsert"; payload = clone(value); return execute(); },
        delete(){ operation = "delete"; return builder; },
        then(resolve, reject){ return execute().then(resolve, reject); }
      };

      async function execute(){
        state.calls.push({ table, operation, filters:clone(filters), payload:clone(payload) });
        const rows = tableRows(table);
        if(!Array.isArray(rows)) return { data:null, error:{ message:"Table inconnue" } };

        if(operation === "select"){
          const selected = rows.filter(row => filters.every(([key,value]) => row[key] === value));
          return { data:clone(selected), error:null };
        }

        if(operation === "delete"){
          for(let index = rows.length - 1; index >= 0; index--){
            if(filters.every(([key,value]) => rows[index][key] === value)) rows.splice(index, 1);
          }
          return { data:null, error:null };
        }

        const values = Array.isArray(payload) ? payload : [payload];
        values.forEach(value => {
          const key = table === "profiles" ? "id" : (table === "recensement" ? "owner" : "id");
          const index = rows.findIndex(row => row[key] === value[key]);
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
