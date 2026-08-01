"use strict";

/* Bout en bout de l'onglet « Dispos ».
   Le faux Supabase reprend la forme de celui de accessibilite-mobile, avec deux
   ajouts indispensables ici : l'upsert écrit vraiment dans l'état (le test
   vérifie ce qui est enregistré) et le delete est supporté (la purge des vieilles
   semaines s'en sert). */

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

/* La semaine est recalculée à chaque exécution : une valeur en dur ferait
   passer le test aujourd'hui et échouer la semaine prochaine. */
function isoWeekStart(now){
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone:"Europe/Paris",
    year:"numeric", month:"2-digit", day:"2-digit", weekday:"short"
  }).formatToParts(now);
  const get = type => (parts.find(part => part.type === type) || {}).value;
  const weekday = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 }[
    get("weekday")
  ];
  const base = new Date(Date.UTC(+get("year"), +get("month") - 1, +get("day")));
  base.setUTCDate(base.getUTCDate() - ((weekday + 6) % 7));
  return base.toISOString().slice(0, 10);
}

async function installFakeSupabase(page, weekStart){
  await page.addInitScript(injectedWeekStart => {
    const clone = value => value == null
      ? value
      : JSON.parse(JSON.stringify(value));
    const EMPTY = "0".repeat(168);
    const maskOf = indexes => {
      const chars = EMPTY.split("");
      indexes.forEach(index => { chars[index] = "1"; });
      return chars.join("");
    };
    const state = {
      session:{ user:{ id:"moi", email:"moi@example.test" } },
      profiles:[
        { id:"moi", pseudo:"Moi" },
        { id:"alix", pseudo:"Alix" },
        { id:"bea", pseudo:"Béa" }
      ],
      teams:[],
      roster_characters:[],
      /* Béa a rejoint un groupe cette semaine, Alix non : le panneau doit donc
         marquer Alix « sans groupe » et pas Béa. */
      boss_sessions:[{ id:"run-1", week_start:injectedWeekStart, slot:1 }],
      boss_participation:[{ session_id:"run-1", owner:"bea" }],
      boss_run_reports:[],
      member_availability:[
        { owner:"alix", week_start:injectedWeekStart, slots:maskOf([21, 45]) },
        { owner:"bea", week_start:injectedWeekStart, slots:maskOf([21]) }
      ],
      channels:[],
      queryCalls:[]
    };

    function query(table){
      state.queryCalls.push(table);
      let operation = "select";
      let payload = null;
      const filters = [];
      const matches = row => filters.every(([column, value]) =>
        Array.isArray(value) ? value.includes(row[column]) : row[column] === value
      );
      const builder = {
        select(){ if(operation === "select") operation = "select"; return builder; },
        order(){ return builder; },
        eq(column, value){ filters.push([column, value]); return builder; },
        in(column, values){ filters.push([column, values]); return builder; },
        delete(){ operation = "delete"; return builder; },
        maybeSingle(){
          return execute().then(result => ({
            data:Array.isArray(result.data) ? (result.data[0] || null) : result.data,
            error:result.error
          }));
        },
        upsert(value){
          operation = "upsert";
          payload = clone(value);
          const rows = state[table] || (state[table] = []);
          const at = rows.findIndex(row =>
            row.owner === payload.owner && row.week_start === payload.week_start
          );
          if(at === -1) rows.push(clone(payload));
          else rows[at] = clone(payload);
          return execute();
        },
        then(resolve, reject){ return execute().then(resolve, reject); }
      };
      async function execute(){
        const rows = state[table] || [];
        if(operation === "upsert") return { data:clone(payload), error:null };
        if(operation === "delete"){
          state[table] = rows.filter(row => !matches(row));
          return { data:null, error:null };
        }
        return { data:clone(rows.filter(matches)), error:null };
      }
      return builder;
    }

    function channel(){
      const handlers = [];
      const value = {
        on(kind, filter, callback){
          handlers.push({ kind, filter, callback });
          return value;
        },
        subscribe(callback){
          value.statusCallback = callback;
          state.channels.push(value);
          queueMicrotask(() => callback("SUBSCRIBED"));
          return value;
        },
        handlers
      };
      return value;
    }

    window.__availState = state;
    window.__availEmit = (table, row) => {
      state.channels.forEach(item => item.handlers
        .filter(handler =>
          handler.kind === "postgres_changes" &&
          handler.filter.table === table
        )
        .forEach(handler => handler.callback({
          schema:"public",
          table,
          eventType:"UPDATE",
          new:clone(row) || {},
          old:{}
        })));
    };
    window.__availClient = {
      auth:{
        async getSession(){
          return { data:{ session:clone(state.session) }, error:null };
        },
        onAuthStateChange(){
          return { data:{ subscription:{ unsubscribe(){} } } };
        }
      },
      from:query,
      channel,
      async removeChannel(){ return "ok"; },
      async rpc(){ return { data:null, error:null }; }
    };
  }, weekStart);
  await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*", route =>
    route.fulfill({
      status:200,
      contentType:"application/javascript",
      body:"window.supabase={createClient:function(){return window.__availClient;}};"
    })
  );
}

function ownMask(page){
  return page.evaluate(() => {
    const row = window.__availState.member_availability
      .find(item => item.owner === "moi");
    return row ? row.slots : null;
  });
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{ width:360, height:780 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  try{
    await installFakeSupabase(page, isoWeekStart(new Date()));
    await page.goto(pathToFileURL(
      path.resolve(__dirname, "..", "index.html")
    ).href);
    await page.click("#tab-availability");
    await page.waitForSelector("#availGrid .avail-cell");

    // La grille couvre la semaine entière, minuit à minuit.
    assert.equal(
      await page.locator("#availGrid .avail-cell").count(),
      168,
      "La grille doit compter 168 créneaux"
    );

    // Aucune vue ne déborde horizontalement : seule la grille défile.
    const overflow = await page.evaluate(() => ({
      doc:document.documentElement.scrollWidth,
      view:window.innerWidth
    }));
    assert.ok(
      overflow.doc <= overflow.view + 1,
      "La page ne doit pas déborder horizontalement sur 360 px"
    );

    // Les cibles tactiles respectent 44 px.
    const box = await page.locator('#availGrid .avail-cell[data-index="0"]')
      .boundingBox();
    assert.ok(box.height >= 44, "Une case doit faire au moins 44 px de haut");

    // Un clic bascule un créneau et déclenche un enregistrement.
    await page.click('#availGrid .avail-cell[data-index="20"]');
    await page.waitForFunction(() => {
      const row = window.__availState.member_availability
        .find(item => item.owner === "moi");
      return row && row.slots[20] === "1";
    }, null, { timeout:5000 });
    assert.match(
      await page.locator("#availSaveStatus").innerText(),
      /Enregistré/,
      "L'indicateur doit confirmer l'enregistrement"
    );

    /* Un glissement à la souris peint un rectangle jours × heures.
       Les heures visées sont en bas de la grille, qui défile dans son propre
       conteneur : il faut les amener à l'écran AVANT de mesurer, sinon le
       curseur irait cliquer en dehors de la zone visible. */
    const anchorCell = page.locator('#availGrid .avail-cell[data-index="44"]');
    await anchorCell.scrollIntoViewIfNeeded();
    const from = await anchorCell.boundingBox();
    const to = await page.locator('#availGrid .avail-cell[data-index="93"]')
      .boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps:8 });
    await page.mouse.up();
    await page.waitForFunction(() => {
      const row = window.__availState.member_availability
        .find(item => item.owner === "moi");
      return row
        && row.slots[44] === "1" && row.slots[45] === "1"
        && row.slots[68] === "1" && row.slots[69] === "1"
        && row.slots[92] === "1" && row.slots[93] === "1";
    }, null, { timeout:5000 });
    assert.equal(
      (await ownMask(page))[70], "0",
      "Le rectangle ne doit pas déborder au-delà de l'heure d'arrivée"
    );

    // L'en-tête d'un jour remplit la colonne, puis la vide.
    await page.click('#availGrid .avail-head[data-day="5"]');
    await page.waitForFunction(() => {
      const row = window.__availState.member_availability
        .find(item => item.owner === "moi");
      if(!row) return false;
      for(let hour = 0; hour < 24; hour += 1){
        if(row.slots[120 + hour] !== "1") return false;
      }
      return true;
    }, null, { timeout:5000 });
    await page.click('#availGrid .avail-head[data-day="5"]');
    await page.waitForFunction(() => {
      const row = window.__availState.member_availability
        .find(item => item.owner === "moi");
      return row && row.slots[120] === "0" && row.slots[143] === "0";
    }, null, { timeout:5000 });

    // Le clavier suffit à basculer un créneau.
    await page.focus('#availGrid .avail-cell[data-index="100"]');
    await page.keyboard.press("Space");
    await page.waitForFunction(() => {
      const cell = document.querySelector(
        '#availGrid .avail-cell[data-index="100"]'
      );
      return cell && cell.getAttribute("aria-pressed") === "true";
    }, null, { timeout:5000 });

    assert.deepEqual(errors, [], "Aucune erreur JS ne doit survenir");
    console.log("PASS Playwright: dispos hebdomadaires");
  }finally{
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
