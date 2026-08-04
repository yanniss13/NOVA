"use strict";

/* Bout en bout de l'onglet « Dispos ».
   Le faux Supabase reprend la forme de celui de accessibilite-mobile, avec deux
   ajouts indispensables ici : l'upsert écrit vraiment dans l'état (le test
   vérifie ce qui est enregistré) et le delete est supporté (la purge des vieilles
   semaines s'en sert). */

const assert = require("node:assert/strict");
const { serveRepo } = require("./helpers/serve");
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

/* La semaine de BOSS n'est pas la semaine de dispos : elle bascule le lundi a
   9h (Europe/Paris), pas a minuit — voir currentBossWeek() dans
   metier/boss-logique.js. Les deux coincident six jours et quinze heures sur
   sept, puis divergent chaque lundi entre 0h et 9h. Semer la session de boss
   avec la semaine de dispos faisait donc echouer ce test neuf heures par
   semaine, sans qu'aucun code n'ait change. */
function bossWeekStart(now){
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone:"Europe/Paris",
    year:"numeric", month:"2-digit", day:"2-digit", weekday:"short",
    hour:"2-digit", hourCycle:"h23"
  }).formatToParts(now);
  const get = type => (parts.find(part => part.type === type) || {}).value;
  const weekday = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 }[
    get("weekday")
  ];
  let offset = (weekday + 6) % 7;
  if(weekday === 1 && +get("hour") < 9) offset = 7;
  const base = new Date(Date.UTC(+get("year"), +get("month") - 1, +get("day")));
  base.setUTCDate(base.getUTCDate() - offset);
  return base.toISOString().slice(0, 10);
}

async function installFakeSupabase(page, weekStart, semaineBoss){
  await page.addInitScript(injected => {
    const injectedWeekStart = injected.semaineDispos;
    const injectedBossWeek = injected.semaineBoss;
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
      boss_sessions:[{ id:"run-1", week_start:injectedBossWeek, slot:1 }],
      boss_participation:[{ session_id:"run-1", owner:"bea" }],
      boss_run_reports:[],
      member_availability:[
        { owner:"alix", week_start:injectedWeekStart, slots:maskOf([21, 45]) },
        { owner:"bea", week_start:injectedWeekStart, slots:maskOf([21]) }
      ],
      channels:[],
      queryCalls:[],
      /* Promesse qui retient la reponse de l'upsert, posee par
         `window.__availHoldUpsert()` et levee par `window.__availReleaseUpsert()`. */
      upsertHold:null,
      /* Vrai -> tout upsert echoue sans rien ecrire. */
      upsertFailure:false
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
          /* Echec d'ecriture : rien n'est ecrit et l'erreur remonte, comme un
             reseau coupe. Pose par `state.upsertFailure`. */
          if(state.upsertFailure){
            return Promise.resolve({
              data:null, error:{ message:"Ecriture refusee" }
            });
          }
          const rows = state[table] || (state[table] = []);
          const at = rows.findIndex(row =>
            row.owner === payload.owner && row.week_start === payload.week_start
          );
          if(at === -1) rows.push(clone(payload));
          else rows[at] = clone(payload);
          /* La ligne est ecrite, la REPONSE peut etre retenue : c'est le seul
             moyen de faire cliquer le membre pendant que l'upsert vole, ce que
             la vraie latence reseau produit sans effort. */
          if(state.upsertHold){
            const attente = state.upsertHold;
            return attente.then(execute);
          }
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
    let libererUpsert = null;
    window.__availHoldUpsert = () => {
      state.upsertHold = new Promise(resolve => { libererUpsert = resolve; });
    };
    window.__availReleaseUpsert = () => {
      const liberer = libererUpsert;
      state.upsertHold = null;
      libererUpsert = null;
      if(liberer) liberer();
    };
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
  }, { semaineDispos:weekStart, semaineBoss:semaineBoss });
  await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*", route =>
    route.fulfill({
      status:200,
      contentType:"application/javascript",
      body:"window.supabase={createClient:function(){return window.__availClient;}};"
    })
  );
}

/* La case à cocher est visuellement masquée : c'est le libellé qui la porte, et
   c'est lui qu'un membre clique réellement. */
async function setRangeDay(page, day, checked){
  const input = page.locator('#availRangeDays input[value="'+day+'"]');
  if(await input.isChecked() === checked) return;
  await page.click('#availRangeDays label:has(input[value="'+day+'"])');
  assert.equal(
    await input.isChecked(), checked,
    "Le libellé du jour "+day+" doit basculer sa case"
  );
}

function ownMask(page){
  return page.evaluate(() => {
    const row = window.__availState.member_availability
      .find(item => item.owner === "moi");
    return row ? row.slots : null;
  });
}

/* Gestes tactiles réels : `page.mouse` produit pointerType "mouse" et ne
   reproduit donc pas le comportement mobile. On passe par CDP. */
async function runMobileChecks(browser, baseUrl){
  const page = await browser.newPage({
    viewport:{ width:390, height:780 }, hasTouch:true, isMobile:true
  });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  try{
    const maintenant = new Date();
    await installFakeSupabase(
      page, isoWeekStart(maintenant), bossWeekStart(maintenant)
    );
    await page.goto(baseUrl + "/index.html");
    await page.click("#tab-availability");
    await page.waitForSelector("#availGrid .avail-cell");

    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", {
      type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id:1 }]
    });
    const filledCount = () => page.evaluate(() => {
      const row = window.__availState.member_availability
        .find(item => item.owner === "moi");
      if(!row) return 0;
      let total = 0;
      for(let index = 0; index < 168; index += 1){
        if(row.slots[index] === "1") total += 1;
      }
      return total;
    });
    /* Une case hors écran a quand même un boundingBox : sans ce défilement
       préalable, le toucher serait envoyé en dehors du viewport et n'atteindrait
       rien. */
    const centre = async selector => {
      await page.locator(selector).scrollIntoViewIfNeeded();
      const box = await page.locator(selector).boundingBox();
      return { x:box.x + box.width / 2, y:box.y + box.height / 2 };
    };

    /* Un doigt pose pour faire defiler, qui ne bouge pas assez pour que le
       navigateur emette pointercancel, ne doit PAS remplir de creneau. C'est
       le cas qui remplissait le planning en tentant de defiler. */
    const slow = await centre('#availGrid .avail-cell[data-index="3"]');
    await touch("touchStart", slow.x, slow.y);
    await page.waitForTimeout(450);
    await touch("touchMove", slow.x, slow.y - 2);
    await touch("touchEnd", slow.x, slow.y - 2);
    await page.waitForTimeout(1100);
    assert.equal(
      await filledCount(), 0,
      "Un doigt pose puis relache sans appui franc ne doit rien remplir"
    );

    // Un appui franc et bref reste le moyen de poser un creneau au doigt.
    const tap = await centre('#availGrid .avail-cell[data-index="5"]');
    await touch("touchStart", tap.x, tap.y);
    await page.waitForTimeout(60);
    await touch("touchEnd", tap.x, tap.y);
    await page.waitForFunction(() => {
      const row = window.__availState.member_availability
        .find(item => item.owner === "moi");
      return row && row.slots[5] === "1";
    }, null, { timeout:5000 });
    assert.equal(
      await filledCount(), 1,
      "L'appui franc ne doit poser QUE le créneau visé"
    );

    /* Ajouter un creneau ne doit pas reconstruire la grille : le membre perdrait
       sa position de defilement et son focus a chaque case. */
    await page.evaluate(() => {
      window.__probeCell = document.querySelector(
        '#availGrid .avail-cell[data-index="7"]'
      );
    });
    const second = await centre('#availGrid .avail-cell[data-index="7"]');
    await touch("touchStart", second.x, second.y);
    await page.waitForTimeout(60);
    await touch("touchEnd", second.x, second.y);
    await page.waitForFunction(() => {
      const row = window.__availState.member_availability
        .find(item => item.owner === "moi");
      return row && row.slots[7] === "1";
    }, null, { timeout:5000 });
    const stable = await page.evaluate(() => window.__probeCell
      === document.querySelector('#availGrid .avail-cell[data-index="7"]'));
    assert.equal(
      stable, true,
      "La grille doit être mise à jour sur place, pas reconstruite"
    );
    assert.equal(
      await page.locator('#availGrid .avail-cell[data-index="7"]')
        .getAttribute("aria-pressed"),
      "true",
      "La case touchée doit refléter son nouvel état sans reconstruction"
    );

    /* LE BUG REMONTÉ PAR UN MEMBRE : « quand je descends avec ma molette, ça
       remonte tout seul ».

       Il était SEUL sur le site : le coupable n'est donc pas l'écriture d'un
       autre membre, mais l'écho Realtime de sa PROPRE saisie. Cet écho arrive
       après la réponse de l'upsert, quand `savePending` est déjà retombé, et
       relançait une relecture complète de la vue — laquelle reconstruisait la
       grille, emportant la position de défilement.

       Deux verrous, vérifiés séparément ci-dessous. */
    await page.evaluate(() => {
      const wrap = document.querySelector(".avail-grid-wrap");
      wrap.scrollTop = 400;
      window.__probeWrap = wrap;
      window.__probeGrid = document.querySelector("#availGrid");
    });
    const defilementAvant = await page.evaluate(
      () => document.querySelector(".avail-grid-wrap").scrollTop
    );
    assert.ok(
      defilementAvant > 0,
      "La grille doit pouvoir défiler pour que le test ait un sens, reçu : "
        + defilementAvant
    );

    /* Verrou 1 — la cause : sa propre écriture ne doit RIEN relire.
       La case 7 vient d'être enregistrée juste au-dessus ; on rejoue l'écho
       que Supabase renvoie derrière cet enregistrement. */
    const requetesAvantEcho = await page.evaluate(() =>
      window.__availState.queryCalls.filter(t => t === "member_availability").length
    );
    await page.evaluate(() => {
      window.__availEmit(
        "member_availability",
        window.__availState.member_availability.find(item => item.owner === "moi")
      );
    });
    await page.waitForTimeout(400);
    assert.equal(
      await page.evaluate(() => window.__availState.queryCalls
        .filter(t => t === "member_availability").length),
      requetesAvantEcho,
      "L'écho de sa propre écriture ne doit déclencher aucune relecture"
    );
    assert.equal(
      await page.evaluate(
        () => document.querySelector(".avail-grid-wrap").scrollTop
      ),
      defilementAvant,
      "Sa propre saisie ne doit pas voler le défilement du membre"
    );

    /* Verrou 2 — le filet : l'écriture d'un AUTRE membre relit bien, elle,
       mais met la grille à jour sur place au lieu de la reconstruire. */
    const requetesAvant = await page.evaluate(() =>
      window.__availState.queryCalls.filter(t => t === "member_availability").length
    );
    await page.evaluate(() => {
      const semaine = window.__availState.member_availability[0].week_start;
      const ligne = window.__availState.member_availability
        .find(item => item.owner === "alix");
      ligne.slots = ligne.slots.slice(0, 60) + "1" + ligne.slots.slice(61);
      window.__availEmit("member_availability", ligne);
    });
    await page.waitForFunction(n =>
      window.__availState.queryCalls
        .filter(t => t === "member_availability").length > n,
      requetesAvant,
      { timeout:5000 }
    );
    await page.waitForTimeout(250);

    assert.equal(
      await page.evaluate(() => window.__probeGrid
        === document.querySelector("#availGrid")),
      true,
      "L'écriture d'un autre membre ne doit pas reconstruire la grille"
    );
    assert.equal(
      await page.evaluate(
        () => document.querySelector(".avail-grid-wrap").scrollTop
      ),
      defilementAvant,
      "Le défilement doit rester où le membre l'a laissé"
    );

    assert.deepEqual(errors, [], "Aucune erreur JS sur mobile");
  }finally{
    await page.close();
  }
}

(async () => {
  const server = await serveRepo();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{ width:360, height:780 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  try{
    const maintenant = new Date();
    await installFakeSupabase(
      page, isoWeekStart(maintenant), bossWeekStart(maintenant)
    );
    await page.goto(server.url + "/index.html");
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
    /* On amène à l'écran la case la PLUS BASSE du rectangle : `boundingBox()`
       renvoie des coordonnées même pour un élément hors viewport, et la souris
       s'y déplacerait dans le vide — `elementFromPoint` rendrait null. */
    await page.locator('#availGrid .avail-cell[data-index="93"]')
      .scrollIntoViewIfNeeded();
    const centreOf = async index => {
      const box = await page
        .locator('#availGrid .avail-cell[data-index="' + index + '"]')
        .boundingBox();
      return { x:box.x + box.width / 2, y:box.y + box.height / 2 };
    };
    const from = await centreOf(44);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    /* La position d'arrivée est relue APRÈS l'appui : presser une case peut
       faire défiler le conteneur pour l'amener entièrement à l'écran, et des
       coordonnées calculées avant deviendraient fausses. */
    const to = await centreOf(93);
    await page.mouse.move(to.x, to.y, { steps:8 });
    const release = await centreOf(93);
    await page.mouse.move(release.x, release.y);
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

    // Le formulaire de nuit franchit minuit : 22h → 02h le lundi.
    await page.selectOption("#availRangeStart", "22");
    await page.selectOption("#availRangeEnd", "2");
    await setRangeDay(page, 0, true);
    await page.click("#availRangeAdd");
    await page.waitForFunction(() => {
      const row = window.__availState.member_availability
        .find(item => item.owner === "moi");
      return row
        && row.slots[22] === "1" && row.slots[23] === "1"
        && row.slots[24] === "1" && row.slots[25] === "1";
    }, null, { timeout:5000 });
    assert.equal(
      (await ownMask(page))[26], "0",
      "La plage est [début, fin[ : 02h ne doit pas être sélectionné"
    );
    assert.match(
      await page.locator("#availRangeHint").innerText(),
      /se poursuit le lendemain/,
      "Le formulaire doit annoncer le franchissement de minuit"
    );

    // Retirer la même plage doit rendre exactement l'état antérieur.
    await page.click("#availRangeRemove");
    await page.waitForFunction(() => {
      const row = window.__availState.member_availability
        .find(item => item.owner === "moi");
      return row && row.slots[22] === "0" && row.slots[25] === "0";
    }, null, { timeout:5000 });

    // Heures égales : les deux boutons se désactivent.
    await page.selectOption("#availRangeEnd", "22");
    assert.ok(
      await page.locator("#availRangeAdd").isDisabled(),
      "Une plage d'heures égales doit être refusée"
    );
    assert.ok(await page.locator("#availRangeRemove").isDisabled());
    assert.match(
      await page.locator("#availRangeHint").innerText(),
      /heures différentes/
    );

    // Nuit du dimanche : la part qui déborde est écrêtée, pas reportée.
    await page.selectOption("#availRangeStart", "23");
    await page.selectOption("#availRangeEnd", "2");
    await setRangeDay(page, 0, false);
    await setRangeDay(page, 6, true);
    await page.click("#availRangeAdd");
    await page.waitForFunction(() => {
      const row = window.__availState.member_availability
        .find(item => item.owner === "moi");
      return row && row.slots[167] === "1";
    }, null, { timeout:5000 });
    assert.equal(
      (await ownMask(page))[0], "0",
      "La nuit du dimanche ne doit jamais déborder sur le lundi de la grille"
    );

    // Le bouton de reprise ne s'affiche que sur une semaine encore vierge.
    assert.ok(
      await page.locator("#availCopyPrevious").isHidden(),
      "La reprise doit rester masquée quand des dispos existent déjà"
    );

    /* Vue confrérie : effectifs écrits en clair, densité par paliers, panneau
       nominatif et marquage des membres sans groupe. */
    await page.click("#availModeGuild");
    await page.waitForSelector("#availGrid .avail-cell[data-tier]");
    assert.ok(
      await page.locator("#availRangeForm").isHidden(),
      "Les commandes de saisie n'ont pas leur place en lecture collective"
    );

    // Alix et Béa sont dispos à 21h le lundi, moi non : le compte doit valoir 2.
    const cell21 = page.locator('#availGrid .avail-cell[data-index="21"]');
    assert.equal(
      (await cell21.innerText()).trim(), "2",
      "La case doit écrire l'effectif, la couleur ne suffit pas"
    );
    assert.equal(
      await cell21.getAttribute("data-tier"), "4",
      "Le créneau le plus fourni doit atteindre le palier maximal"
    );

    assert.match(
      await page.locator("#availBest").innerText(),
      /Meilleurs créneaux/,
      "Les meilleurs créneaux de la semaine doivent être proposés"
    );

    await cell21.scrollIntoViewIfNeeded();
    await cell21.click();
    await page.waitForSelector("#availSlotOverlay[aria-hidden='false']");
    const slotTitle = await page.locator("#availSlotTitle").innerText();
    assert.match(slotTitle, /Lundi 21h/, "Le panneau doit nommer le créneau");
    assert.match(slotTitle, /2 membres/);
    const listText = await page.locator("#availSlotList").innerText();
    assert.match(listText, /Alix/, "Le panneau doit nommer les membres");
    assert.match(listText, /Béa/);
    // Béa a rejoint un groupe, Alix non : une seule mention « sans groupe ».
    assert.equal(
      await page.locator("#availSlotList .avail-slot-tag").count(), 1,
      "Seul le membre sans groupe doit porter la mention"
    );
    assert.match(
      await page.locator("#availSlotList li:has(.avail-slot-tag)").innerText(),
      /Alix/,
      "C'est Alix, sans groupe cette semaine, qui doit être marquée"
    );
    await page.click("#availSlotClose");
    await page.waitForSelector("#availSlotOverlay", { state:"hidden" });
    assert.equal(
      await page.locator("#availSlotOverlay").getAttribute("aria-hidden"),
      "true",
      "La fermeture doit rendre le panneau inerte pour les lecteurs d'écran"
    );

    /* La table doit être écoutée par la chaîne Realtime unique, et un événement
       venu d'un autre membre doit rafraîchir la vue ouverte. */
    await page.evaluate(() => {
      window.__availState.member_availability.push({
        owner:"tardif",
        week_start:window.__availState.member_availability[0].week_start,
        slots:"1".repeat(168)
      });
      window.__availState.profiles.push({ id:"tardif", pseudo:"Tardif" });
      window.__availEmit("member_availability", { owner:"tardif" });
    });
    await page.waitForFunction(() => {
      const cell = document.querySelector(
        '#availGrid .avail-cell[data-index="21"]'
      );
      return cell && cell.textContent.trim() === "3";
    }, null, { timeout:5000 });

    await page.click("#availModeMine");
    await page.waitForSelector('#availGrid .avail-cell[aria-pressed]');

    /* CLICS RAPIDES : aucun créneau ne doit se perdre.

       Le bug remonté : « quand je clique sur plusieurs créneaux rapidement,
       certains ne sont pas pris en compte ».

       Le scénario reproduit la course exacte. Un premier clic déclenche
       l'enregistrement différé ; pendant que l'upsert vole, un second clic
       peint un autre créneau. L'écho Realtime de la PREMIÈRE écriture arrive
       ensuite, porteur d'un masque plus ancien que ce qui est affiché.

       `savePending` retombait à la réponse de l'upsert sans regarder si une
       saisie plus récente attendait déjà : l'écho passait la garde, et
       `refresh()` remplaçait le masque local par celui du serveur. Le second
       créneau disparaissait de l'écran ET du prochain enregistrement. */
    await page.evaluate(() => {
      const ligne = window.__availState.member_availability
        .find(row => row.owner === "moi");
      ligne.slots = "0".repeat(168);
      window.__availHoldUpsert();
    });
    await page.click('#availGrid .avail-cell[data-index="40"]');
    /* On attend que l'upsert soit VRAIMENT parti : la ligne stockée porte déjà
       le premier créneau, mais la réponse est retenue. */
    await page.waitForFunction(() => {
      const ligne = window.__availState.member_availability
        .find(row => row.owner === "moi");
      return ligne && ligne.slots[40] === "1";
    }, null, { timeout:5000 });

    await page.click('#availGrid .avail-cell[data-index="41"]');
    await page.evaluate(() => window.__availReleaseUpsert());
    /* La réponse doit avoir été TRAITÉE avant d'émettre l'écho : sinon
       `savePending` n'est pas encore retombé et la garde masquerait la course
       qu'on cherche justement à provoquer. */
    await page.waitForFunction(
      () => document.querySelector("#availSaveStatus")
        .dataset.state === "saved",
      null, { timeout:5000 }
    );
    await page.evaluate(() => {
      /* L'écho de la première écriture : le serveur ne connaît pas encore le
         second créneau. */
      window.__availEmit("member_availability", {
        owner:"moi",
        week_start:window.__availState.member_availability
          .find(row => row.owner === "moi").week_start,
        slots:"0".repeat(40) + "1" + "0".repeat(127)
      });
    });
    await page.waitForTimeout(400);

    assert.equal(
      await page.locator('#availGrid .avail-cell[data-index="41"]')
        .getAttribute("aria-pressed"),
      "true",
      "Un créneau peint pendant l'enregistrement ne doit pas disparaitre"
    );
    await page.waitForFunction(() => {
      const ligne = window.__availState.member_availability
        .find(row => row.owner === "moi");
      return ligne && ligne.slots[40] === "1" && ligne.slots[41] === "1";
    }, null, { timeout:5000 });

    /* MÊME PERTE, AUTRE DÉCLENCHEUR : l'écriture d'un AUTRE membre.

       L'enregistrement est différé de 600 ms. Si un rafraîchissement légitime
       tombe dans cette fenêtre, `refresh()` relit le serveur — qui ignore
       encore le créneau qu'on vient de peindre — et l'efface. Le membre voit
       le même symptôme sans qu'aucun écho de sa propre écriture soit en jeu. */
    await page.click('#availGrid .avail-cell[data-index="52"]');
    await page.evaluate(() => {
      const semaine = window.__availState.member_availability
        .find(row => row.owner === "moi").week_start;
      window.__availEmit("member_availability", {
        owner:"alix",
        week_start:semaine,
        slots:"1".repeat(168)
      });
    });
    await page.waitForTimeout(300);
    assert.equal(
      await page.locator('#availGrid .avail-cell[data-index="52"]')
        .getAttribute("aria-pressed"),
      "true",
      "L'ecriture d'un autre membre ne doit pas effacer une saisie en attente"
    );
    await page.waitForFunction(() => {
      const ligne = window.__availState.member_availability
        .find(row => row.owner === "moi");
      return ligne && ligne.slots[52] === "1";
    }, null, { timeout:5000 });

    /* LE VOILE DE DÉFILEMENT : présent seulement s'il dit vrai.

       Les barres sont masquées sur tout le site, si bien que rien n'annonçait
       les 24 heures de grille sous la ligne de flottaison. Le voile le dit —
       et disparaît une fois en bas, sous peine de promettre du vide. */
    assert.equal(
      await page.locator(".avail-grid-frame").getAttribute("data-more"),
      "bottom",
      "En haut de grille, le voile doit annoncer la suite"
    );
    await page.evaluate(() => {
      const wrap = document.querySelector(".avail-grid-wrap");
      wrap.scrollTop = wrap.scrollHeight;
    });
    await page.waitForFunction(
      () => document.querySelector(".avail-grid-frame").dataset.more === "none",
      null, { timeout:5000 }
    );
    await page.evaluate(() => {
      document.querySelector(".avail-grid-wrap").scrollTop = 0;
    });
    await page.waitForFunction(
      () => document.querySelector(".avail-grid-frame").dataset.more === "bottom",
      null, { timeout:5000 }
    );

    /* ENREGISTREMENT EN ÉCHEC : la saisie ne doit pas disparaître.

       Hors ligne — métro, coupure — l'upsert échoue. Le drapeau `savePending`
       retombait quand même, si bien que la première relecture venue rendait
       au membre le masque du serveur : ses créneaux s'effaçaient en silence,
       alors que le bandeau lui disait seulement de réessayer plus tard.

       On vérifie trois choses : la saisie tient à l'écran, elle survit à une
       relecture, et elle repart toute seule au retour du réseau. */
    await page.evaluate(() => { window.__availState.upsertFailure = true; });
    await page.click('#availGrid .avail-cell[data-index="60"]');
    await page.waitForFunction(
      () => document.querySelector("#availSaveStatus").dataset.state === "error",
      null, { timeout:5000 }
    );

    await page.evaluate(() => {
      window.__availEmit("member_availability", {
        owner:"alix",
        week_start:window.__availState.member_availability
          .find(row => row.owner === "moi").week_start,
        slots:"1".repeat(168)
      });
    });
    await page.waitForTimeout(400);
    assert.equal(
      await page.locator('#availGrid .avail-cell[data-index="60"]')
        .getAttribute("aria-pressed"),
      "true",
      "Une saisie non enregistree ne doit pas etre effacee par une relecture"
    );

    /* Le reseau revient : la saisie repart sans que le membre y touche. */
    await page.evaluate(() => {
      window.__availState.upsertFailure = false;
      window.dispatchEvent(new Event("online"));
    });
    await page.waitForFunction(() => {
      const ligne = window.__availState.member_availability
        .find(row => row.owner === "moi");
      return ligne && ligne.slots[60] === "1";
    }, null, { timeout:8000 });

    /* Purge : une semaine vieille de plus de quatre semaines part au prochain
       enregistrement, la semaine précédente reste. */
    await page.evaluate(() => {
      const rows = window.__availState.member_availability;
      const current = rows.find(row => row.owner === "moi").week_start;
      const shift = weeks => {
        const parts = current.split("-").map(Number);
        const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
        date.setUTCDate(date.getUTCDate() - weeks * 7);
        return date.toISOString().slice(0, 10);
      };
      rows.push({ owner:"moi", week_start:shift(1), slots:"0".repeat(168) });
      rows.push({ owner:"moi", week_start:shift(9), slots:"0".repeat(168) });
      window.__availPurgeProbe = { recente:shift(1), ancienne:shift(9) };
    });
    await page.click('#availGrid .avail-cell[data-index="30"]');
    await page.waitForFunction(() => {
      const probe = window.__availPurgeProbe;
      const weeks = window.__availState.member_availability
        .filter(row => row.owner === "moi")
        .map(row => row.week_start);
      return weeks.includes(probe.recente) && !weeks.includes(probe.ancienne);
    }, null, { timeout:6000 });

    assert.deepEqual(errors, [], "Aucune erreur JS ne doit survenir");
    await runMobileChecks(browser, server.url);
    console.log("PASS Playwright: dispos hebdomadaires");
  }finally{
    await browser.close();
    await server.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
