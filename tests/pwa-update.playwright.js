"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

const PAGE_URL = pathToFileURL(
  path.resolve(__dirname, "..", "index.html")
).href;

/* Faux `navigator.serviceWorker`. Il est installé AVANT les scripts de la page
   pour que l'enregistrement au `load` d'index.html tombe sur ce double.
   `withController` simule un onglet déjà contrôlé par une version installée ;
   `withWaiting` simule une nouvelle version déjà téléchargée et en attente. */
function fakeServiceWorker({ withController, withWaiting, throwOnPostMessage }){
  return `(() => {
    const state = {
      messages: [],
      updateCalls: 0,
      loads: 0
    };
    try{
      const previous = Number(sessionStorage.getItem("pwaTestLoads") || "0");
      state.loads = previous + 1;
      sessionStorage.setItem("pwaTestLoads", String(state.loads));
    }catch(error){
      state.loads = 1;
    }

    /* Deux registres SÉPARÉS : \`updatefound\` n'existe que sur l'inscription et
       \`controllerchange\` que sur le conteneur, comme dans un vrai navigateur.
       Écouter le mauvais objet ne déclenche donc rien et le test échoue. */
    const regListeners = { updatefound: [] };
    const containerListeners = { controllerchange: [] };
    const bind = registry => ({
      addEventListener(type, listener){
        if(registry[type]) registry[type].push(listener);
      },
      removeEventListener(type, listener){
        if(!registry[type]) return;
        const index = registry[type].indexOf(listener);
        if(index >= 0) registry[type].splice(index, 1);
      }
    });
    const emit = (registry, type) => {
      (registry[type] || []).slice().forEach(listener => listener({ type }));
    };

    let workerId = 0;
    const makeWorker = workerState => {
      const workerListeners = [];
      const worker = {
        id: ++workerId,
        state: workerState,
        postMessage(data){
          if(${throwOnPostMessage ? "true" : "false"}){
            throw new Error("worker disparu");
          }
          state.messages.push(data);
        },
        addEventListener(type, listener){
          if(type === "statechange") workerListeners.push(listener);
        },
        removeEventListener(type, listener){
          const index = workerListeners.indexOf(listener);
          if(type === "statechange" && index >= 0) workerListeners.splice(index, 1);
        },
        setState(next){
          worker.state = next;
          workerListeners.slice().forEach(listener =>
            listener({ type: "statechange", target: worker })
          );
        }
      };
      return worker;
    };

    const registration = Object.assign(bind(regListeners), {
      installing: null,
      waiting: ${withWaiting} ? makeWorker("installed") : null,
      active: ${withController} ? makeWorker("activated") : null,
      update(){
        state.updateCalls += 1;
        return Promise.resolve(registration);
      }
    });

    const container = Object.assign(bind(containerListeners), {
      controller: ${withController} ? registration.active : null,
      register(){ return Promise.resolve(registration); },
      getRegistration(){ return Promise.resolve(registration); },
      ready: Promise.resolve(registration)
    });

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      get(){ return container; }
    });

    state.registration = registration;
    /* Simule le téléchargement d'une nouvelle version : updatefound, puis le
       passage de installing à installed. */
    state.installUpdate = () => {
      const worker = makeWorker("installing");
      registration.installing = worker;
      emit(regListeners, "updatefound");
      worker.setState("installed");
      registration.installing = null;
      registration.waiting = worker;
      return worker;
    };
    /* Deux controllerchange synchrones : le contrat exige un seul rechargement. */
    state.fireControllerChangeTwice = () => {
      emit(containerListeners, "controllerchange");
      emit(containerListeners, "controllerchange");
    };
    window.__pwaTest = state;
  })();`;
}

async function openPage(browser, options){
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 }
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*", route =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "window.supabase=undefined;"
    })
  );
  await page.addInitScript(fakeServiceWorker(options));
  await page.goto(PAGE_URL);
  return { context, page, errors };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try{
    // ---- Cas 1 : onglet déjà contrôlé + version en attente ----------------
    const waiting = await openPage(browser, {
      withController: true,
      withWaiting: true
    });
    const page = waiting.page;
    const banner = page.locator("#pwaUpdateBanner");
    const apply = page.locator("#pwaUpdateApply");
    const close = page.locator("#pwaUpdateClose");

    await banner.waitFor({ state: "visible" });
    assert.equal(
      await page.locator("#pwaUpdateText").innerText(),
      "Nouvelle version disponible"
    );
    assert.equal(
      await banner.evaluate(node =>
        node.getAttribute("aria-labelledby") === "pwaUpdateText" &&
        node.tagName.toLowerCase() === "aside"
      ),
      true,
      "le bandeau doit rester annoncé aux lecteurs d'écran"
    );

    // Aucune activation, aucun rechargement avant le clic.
    assert.deepStrictEqual(
      await page.evaluate(() => window.__pwaTest.messages),
      [],
      "aucun message ne doit partir sans action du membre"
    );
    assert.equal(
      await page.evaluate(() => window.__pwaTest.loads),
      1,
      "afficher le bandeau ne doit pas recharger la page"
    );
    assert.ok(
      await page.evaluate(() => window.__pwaTest.updateCalls) >= 1,
      "une vérification de mise à jour est attendue après l'enregistrement"
    );

    // ---- Cas 2 : fermeture temporaire, sans message -----------------------
    await close.click();
    await banner.waitFor({ state: "hidden" });
    assert.deepStrictEqual(
      await page.evaluate(() => window.__pwaTest.messages),
      [],
      "fermer le bandeau ne doit rien activer"
    );

    // ---- Cas 3 : une nouvelle version installée réaffiche le bandeau ------
    await page.evaluate(() => window.__pwaTest.installUpdate());
    await banner.waitFor({ state: "visible" });

    // ---- Cas 4 : « Mettre à jour » envoie exactement un SKIP_WAITING ------
    await apply.click();
    assert.deepStrictEqual(
      await page.evaluate(() => window.__pwaTest.messages),
      [{ type: "SKIP_WAITING" }],
      "un seul message SKIP_WAITING est attendu"
    );
    assert.equal(await apply.isDisabled(), true, "le bouton doit être occupé");
    assert.equal(await apply.innerText(), "Mise à jour…");

    // Un second clic ne doit jamais renvoyer un deuxième SKIP_WAITING.
    await apply.dispatchEvent("click");
    assert.deepStrictEqual(
      await page.evaluate(() => window.__pwaTest.messages),
      [{ type: "SKIP_WAITING" }],
      "le double clic doit rester sans effet"
    );

    // ---- Cas 5 : deux controllerchange -> un seul rechargement ------------
    await page.evaluate(() => window.__pwaTest.fireControllerChangeTwice());
    await page.waitForFunction(() => window.__pwaTest.loads === 2);
    await page.waitForTimeout(300);
    assert.equal(
      await page.evaluate(() => window.__pwaTest.loads),
      2,
      "l'activation doit provoquer exactement un rechargement"
    );
    assert.deepStrictEqual(waiting.errors, [], "aucune erreur de page attendue");
    await waiting.context.close();

    // ---- Cas 6 : première installation -> pas de bandeau -----------------
    const first = await openPage(browser, {
      withController: false,
      withWaiting: false
    });
    await first.page.waitForFunction(() => window.__pwaTest.updateCalls >= 1);
    assert.equal(
      await first.page.locator("#pwaUpdateBanner").isVisible(),
      false,
      "une première installation ne doit pas afficher le bandeau"
    );
    // Un clients.claim() de première installation ne doit rien recharger.
    await first.page.evaluate(() => window.__pwaTest.fireControllerChangeTwice());
    await first.page.waitForTimeout(300);
    assert.equal(
      await first.page.evaluate(() => window.__pwaTest.loads),
      1,
      "la première prise de contrôle ne doit pas recharger"
    );
    assert.deepStrictEqual(first.errors, [], "aucune erreur de page attendue");
    await first.context.close();

    // ---- Cas 7 : worker disparu -> pas de rechargement forcé -------------
    const broken = await openPage(browser, {
      withController: true,
      withWaiting: true,
      throwOnPostMessage: true
    });
    const brokenBanner = broken.page.locator("#pwaUpdateBanner");
    const brokenApply = broken.page.locator("#pwaUpdateApply");
    await brokenBanner.waitFor({ state: "visible" });
    await brokenApply.click();
    await brokenBanner.waitFor({ state: "hidden" });
    assert.equal(
      await brokenApply.isDisabled(),
      false,
      "le bouton doit redevenir utilisable si l'activation échoue"
    );
    assert.equal(await brokenApply.innerText(), "Mettre à jour");
    await broken.page.evaluate(() => window.__pwaTest.fireControllerChangeTwice());
    await broken.page.waitForTimeout(300);
    assert.equal(
      await broken.page.evaluate(() => window.__pwaTest.loads),
      1,
      "un envoi échoué ne doit jamais recharger"
    );
    assert.deepStrictEqual(broken.errors, [], "aucune erreur de page attendue");
    await broken.context.close();

    console.log("PASS Playwright: bandeau PWA, activation choisie, un seul rechargement");
  }finally{
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
