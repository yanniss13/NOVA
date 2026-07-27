"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

async function assertPickerTilesContained(page, label){
  const layout = await page.locator("#pickerGrid").evaluate(grid => ({
    clientHeight:grid.clientHeight,
    scrollHeight:grid.scrollHeight,
    tiles:[...grid.querySelectorAll(".tile")].slice(0, 6).map(tile => {
      const tileRect = tile.getBoundingClientRect();
      const imageRect = tile.querySelector(".tile-img").getBoundingClientRect();
      const nameRect = tile.querySelector(".tile-name").getBoundingClientRect();
      return {
        tileTop:tileRect.top,
        tileBottom:tileRect.bottom,
        imageTop:imageRect.top,
        imageBottom:imageRect.bottom,
        nameTop:nameRect.top,
        nameBottom:nameRect.bottom
      };
    })
  }));
  assert.ok(layout.scrollHeight > layout.clientHeight, label+" doit rester défilable");
  layout.tiles.forEach((item, index) => {
    assert.ok(
      item.imageTop >= item.tileTop - 1 &&
      item.imageBottom <= item.tileBottom + 1,
      label+" : image hors de la vignette "+index
    );
    assert.ok(
      item.nameTop >= item.tileTop - 1 &&
      item.nameBottom <= item.tileBottom + 1,
      label+" : nom hors de la vignette "+index
    );
  });
}

(async()=>{
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{width:1280,height:900} });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  try{
    await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*", route =>
      route.fulfill({
        status:200,
        contentType:"application/javascript",
        body:"window.supabase=undefined;"
      })
    );
    await page.goto(pathToFileURL(path.resolve(__dirname, "..", "index.html")).href);
    const tabs = page.getByRole("tab");
    assert.equal(await tabs.count(), 7);
    assert.equal(await tabs.nth(0).getAttribute("aria-selected"), "true");
    assert.equal(await tabs.nth(0).getAttribute("tabindex"), "0");
    assert.equal(await tabs.nth(1).getAttribute("aria-selected"), "false");
    assert.equal(await tabs.nth(1).getAttribute("tabindex"), "-1");

    await tabs.nth(0).focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await tabs.nth(1).getAttribute("aria-selected"), "true");
    assert.equal(await page.locator("#view-dashboard").isVisible(), true);

    // Flèche gauche revient sur le Team Builder, sans sauter d'onglet.
    await page.keyboard.press("ArrowLeft");
    assert.equal(await tabs.nth(0).getAttribute("aria-selected"), "true");
    assert.equal(await page.locator("#view-builder").isVisible(), true);

    await page.keyboard.press("End");
    assert.equal(await tabs.nth(6).getAttribute("aria-selected"), "true");
    assert.equal(await page.locator("#view-boss").isVisible(), true);

    await page.keyboard.press("Home");
    assert.equal(await tabs.nth(0).getAttribute("aria-selected"), "true");
    assert.equal(await page.locator("#view-builder").isVisible(), true);

    /* « Mon suivi » déconnecté propose la connexion, et fermer la modale par
       Échap rend le focus au bouton qui l'a ouverte. */
    await page.locator('.tab[data-view="dashboard"]').click();
    const dashboardConnect = page.locator("#dashboardBody").getByRole("button", {
      name:"Connexion",
      exact:true
    });
    await dashboardConnect.waitFor();
    assert.match(
      await page.locator("#dashboardBody").textContent(),
      /Connecte-toi pour afficher ton suivi/
    );
    await dashboardConnect.click();
    await page.locator("#authOverlay").waitFor({ state:"visible" });
    await page.keyboard.press("Escape");
    await page.locator("#authOverlay").waitFor({ state:"hidden" });
    await page.waitForFunction(() =>
      document.activeElement === document.querySelector(
        "#dashboardBody button"
      )
    );
    await page.locator('.tab[data-view="builder"]').click();

    const login = page.locator("#accountLogin");
    await login.focus();
    await login.click();
    await page.locator("#authOverlay").waitFor({state:"visible"});
    await page.waitForFunction(() => document.activeElement.id === "authEmail");
    await page.keyboard.press("Escape");
    await page.locator("#authOverlay").waitFor({state:"hidden"});
    await page.waitForFunction(() => document.activeElement.id === "accountLogin");
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "accountLogin"
    );

    const portrait = page.locator(".hero .portrait").first();
    await portrait.click();
    await page.locator("#overlay").waitFor({state:"visible"});
    await page.locator("#pickerClose").focus();
    await page.keyboard.press("Shift+Tab");
    assert.equal(
      await page.evaluate(() =>
        document.querySelector("#overlay").contains(document.activeElement)
      ),
      true
    );
    await page.keyboard.press("Escape");
    await page.locator("#overlay").waitFor({state:"hidden"});
    await page.waitForFunction(() =>
      document.querySelector(".hero .portrait") === document.activeElement
    );
    assert.equal(
      await portrait.evaluate(node => node === document.activeElement),
      true
    );

    /* Fermer une modale ne doit pas reprendre un focus déplacé volontairement.
       `ModalStack.close()` restaure le déclencheur deux fois : une fois tout de
       suite, puis une seconde fois au tick suivant pour rattraper un
       déclencheur pas encore rendu. Cette seconde passe ne doit jamais voler un
       focus valide placé ailleurs entre-temps.
       Le déplacement est fait depuis un MutationObserver : son callback est une
       microtâche, donc il s'exécute forcément AVANT le `setTimeout(0)` de la
       restauration différée, quelle que soit la vitesse de la machine. */
    await portrait.click();
    await page.locator("#overlay").waitFor({state:"visible"});
    await page.evaluate(() => {
      const overlay = document.querySelector("#overlay");
      const observer = new MutationObserver(() => {
        if(overlay.classList.contains("on")) return;
        observer.disconnect();
        document.querySelector("#accountLogin").focus();
        window.__focusMovedDuringClose = document.activeElement.id;
      });
      observer.observe(overlay, { attributes:true, attributeFilter:["class"] });
    });
    await page.keyboard.press("Escape");
    await page.locator("#overlay").waitFor({state:"hidden"});
    assert.equal(
      await page.evaluate(() => window.__focusMovedDuringClose),
      "accountLogin",
      "Le focus doit bien avoir été déplacé pendant la fermeture"
    );
    await page.waitForTimeout(50);
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "accountLogin",
      "La restauration différée ne doit pas reprendre un focus déplacé"
    );

    for(const width of [320, 390]){
      const pickerContext = await browser.newContext({
        viewport:{width,height:844},
        isMobile:true,
        hasTouch:true,
        reducedMotion:"reduce"
      });
      const pickerPage = await pickerContext.newPage();
      await pickerPage.route(
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*",
        route => route.fulfill({
          status:200,
          contentType:"application/javascript",
          body:"window.supabase=undefined;"
        })
      );
      await pickerPage.goto(
        pathToFileURL(path.resolve(__dirname, "..", "index.html")).href
      );

      /* Bandeau de mise à jour PWA : il est masqué par défaut ici (pas de
         service worker en `file://`), on le révèle le temps des mesures. */
      await pickerPage.evaluate(() => {
        document.querySelector("#pwaUpdateBanner").hidden = false;
        document.body.classList.add("pwa-update-on");
      });
      assert.ok(
        await pickerPage.evaluate(() =>
          document.scrollingElement.scrollWidth -
          document.scrollingElement.clientWidth
        ) <= 1,
        "Le bandeau de mise à jour déborde à "+width+"px"
      );
      const bannerLayout = await pickerPage.evaluate(() => {
        const rect = id =>
          document.querySelector(id).getBoundingClientRect().toJSON();
        return {
          text:rect("#pwaUpdateText"),
          apply:rect("#pwaUpdateApply"),
          close:rect("#pwaUpdateClose")
        };
      });
      for(const key of ["apply", "close"]){
        const box = bannerLayout[key];
        assert.ok(
          box.height >= 44,
          "Bandeau "+width+"px : "+key+" doit mesurer 44 px de haut"
        );
        assert.ok(
          box.width >= 44,
          "Bandeau "+width+"px : "+key+" doit mesurer 44 px de large"
        );
      }
      const bannerPairs = [
        ["text", "apply"], ["text", "close"], ["apply", "close"]
      ];
      bannerPairs.forEach(([a, b]) => {
        const first = bannerLayout[a];
        const second = bannerLayout[b];
        const overlaps =
          first.left < second.right - 1 && second.left < first.right - 1 &&
          first.top < second.bottom - 1 && second.top < first.bottom - 1;
        assert.ok(
          !overlaps,
          "Bandeau "+width+"px : "+a+" et "+b+" se superposent"
        );
      });
      /* Le bandeau ne doit jamais intercepter les clics d'une modale ouverte :
         le piège à focus le rend inatteignable au clavier, donc il doit aussi
         rester sous la couche des modales à la souris et au doigt.
         L'ordre d'empilement est vérifié directement, car un simple test
         géométrique dépend de la hauteur de l'écran. */
      const stacking = await pickerPage.evaluate(() => {
        const z = selector =>
          parseInt(
            getComputedStyle(document.querySelector(selector)).zIndex, 10
          );
        return {
          banner:z("#pwaUpdateBanner"),
          picker:z("#overlay"),
          auth:z("#authOverlay"),
          toast:z("#toast")
        };
      });
      assert.ok(
        stacking.banner < stacking.picker &&
        stacking.banner < stacking.auth,
        "Le bandeau doit rester sous les modales : "+JSON.stringify(stacking)
      );
      assert.ok(
        stacking.banner < stacking.toast,
        "Le toast doit rester au-dessus du bandeau : "+JSON.stringify(stacking)
      );

      /* Écran court : c'est là que le bandeau et la modale se chevauchent
         réellement. Aucun bouton de la modale ne doit être intercepté. */
      await pickerPage.setViewportSize({width, height:640});
      await pickerPage.locator("#accountLogin").click();
      await pickerPage.locator("#authOverlay").waitFor({state:"visible"});
      const blocked = await pickerPage.evaluate(() => {
        const banner = document.querySelector("#pwaUpdateBanner")
          .getBoundingClientRect();
        return ["#authOffline", "#authSignIn"].filter(id => {
          const box = document.querySelector(id).getBoundingClientRect();
          const overlaps =
            box.left < banner.right && banner.left < box.right &&
            box.top < banner.bottom && banner.top < box.bottom;
          if(!overlaps) return false;
          const hit = document.elementFromPoint(
            box.x + box.width / 2, box.y + box.height / 2
          );
          return !(hit && hit.closest("#authOverlay"));
        });
      });
      assert.deepStrictEqual(
        blocked, [],
        "Le bandeau masque des boutons de la modale à "+width+"px"
      );
      await pickerPage.keyboard.press("Escape");
      await pickerPage.locator("#authOverlay").waitFor({state:"hidden"});
      await pickerPage.setViewportSize({width, height:844});

      await pickerPage.evaluate(() => {
        document.querySelector("#pwaUpdateBanner").hidden = true;
        document.body.classList.remove("pwa-update-on");
      });

      for(const modalCase of [
        {
          overlay:"#bossTeamOverlay",
          modal:".boss-team-modal",
          body:"#bossTeamList",
          content:".boss-team-choice",
          close:"#bossTeamClose",
          label:"sélecteur d’équipe"
        },
        {
          overlay:"#bossReportOverlay",
          modal:".boss-report-modal",
          body:".boss-report-body",
          content:"#bossScore,#bossReportNote,.boss-report-member",
          close:"#bossReportClose",
          submit:"#bossReportSubmit",
          label:"rapport de run"
        }
      ]){
        await pickerPage.evaluate(({ overlay }) => {
          const node = document.querySelector(overlay);
          if(overlay === "#bossTeamOverlay"){
            const list = document.querySelector("#bossTeamList");
            const choice = document.createElement("button");
            choice.className = "boss-team-choice";
            choice.type = "button";
            const heroes = document.createElement("span");
            heroes.className = "boss-team-choice-heroes";
            for(let index = 0; index < 4; index++){
              const hero = document.createElement("span");
              hero.className = "boss-team-choice-hero";
              hero.textContent =
                "PersonnageSansEspaceTrèsLong"+index+"W".repeat(30);
              heroes.appendChild(hero);
            }
            choice.appendChild(heroes);
            list.replaceChildren(choice);
          }else{
            const members = document.querySelector("#bossReportMembers");
            const member = document.createElement("div");
            member.className = "boss-report-member";
            member.textContent = "MembreSansEspace"+"W".repeat(120);
            members.replaceChildren(member);
            document.querySelector("#bossScore").value = "9007199254740991";
            document.querySelector("#bossReportNote").value = "W".repeat(1000);
            document.querySelector("#bossReportCount").textContent = "1000/1000";
          }
          node.classList.add("on");
          node.setAttribute("aria-hidden", "false");
        }, modalCase);
        await pickerPage.locator(modalCase.overlay).waitFor({state:"visible"});
        const bossModalLayout = await pickerPage.evaluate(modalCase => {
          const root = document.scrollingElement;
          const overlay = document.querySelector(modalCase.overlay)
            .getBoundingClientRect();
          const modal = document.querySelector(modalCase.modal)
            .getBoundingClientRect();
          const body = document.querySelector(modalCase.body)
            .getBoundingClientRect();
          const close = document.querySelector(modalCase.close)
            .getBoundingClientRect();
          const submit = modalCase.submit
            ? document.querySelector(modalCase.submit).getBoundingClientRect()
            : null;
          const content = [...document.querySelectorAll(modalCase.content)]
            .map(node => {
              const rect = node.getBoundingClientRect();
              return {
                rect:rect.toJSON(),
                overflow:node.scrollWidth - node.clientWidth
              };
            });
          return {
            viewportWidth:document.documentElement.clientWidth,
            viewportHeight:document.documentElement.clientHeight,
            overflow:root.scrollWidth - root.clientWidth,
            overlay:overlay.toJSON(),
            modal:modal.toJSON(),
            body:body.toJSON(),
            content,
            closeWidth:close.width,
            closeHeight:close.height,
            submitWidth:submit && submit.width,
            submitHeight:submit && submit.height
          };
        }, modalCase);
        assert.ok(
          bossModalLayout.overflow <= 1,
          "La modale "+modalCase.label+" déborde à "+width+"px"
        );
        for(const [label, rect] of [
          ["overlay", bossModalLayout.overlay],
          ["modale", bossModalLayout.modal],
          ["corps", bossModalLayout.body]
        ]){
          assert.ok(
            rect.left >= 0 && rect.top >= 0 &&
            rect.right <= bossModalLayout.viewportWidth &&
            rect.bottom <= bossModalLayout.viewportHeight,
            label+" "+modalCase.label+" hors viewport à "+width+"px : "+
              JSON.stringify(rect)
          );
        }
        bossModalLayout.content.forEach(({ rect, overflow }) => {
          assert.ok(
            rect.left >= bossModalLayout.modal.left &&
            rect.right <= bossModalLayout.modal.right &&
            overflow <= 1,
            "Contenu "+modalCase.label+" hors modale à "+width+"px : "+
              JSON.stringify({ rect, overflow })
          );
        });
        assert.ok(
          bossModalLayout.closeWidth >= 44 &&
          bossModalLayout.closeHeight >= 44,
          "La fermeture "+modalCase.label+" doit mesurer 44 × 44 px à "+
            width+"px"
        );
        if(modalCase.submit){
          assert.ok(
            bossModalLayout.submitWidth >= 44 &&
            bossModalLayout.submitHeight >= 44,
            "La validation du rapport doit mesurer 44 × 44 px à "+
              width+"px"
          );
        }
        await pickerPage.evaluate(({ overlay }) => {
          const node = document.querySelector(overlay);
          node.classList.remove("on");
          node.setAttribute("aria-hidden", "true");
        }, modalCase);
      }

      await pickerPage.locator(".hero .portrait").first().click();
      await assertPickerTilesContained(pickerPage, "Héros "+width+"px");
      assert.ok(
        await pickerPage.evaluate(() =>
          document.scrollingElement.scrollWidth -
          document.scrollingElement.clientWidth
        ) <= 1,
        "Le sélecteur de héros déborde à "+width+"px"
      );

      await pickerPage.locator('#pickerGrid .tile[title="Meliodas"]').click();
      await pickerPage.locator(".hero .gear-slot.weapon").first().click();
      await assertPickerTilesContained(pickerPage, "Armes "+width+"px");
      assert.ok(
        await pickerPage.evaluate(() =>
          document.scrollingElement.scrollWidth -
          document.scrollingElement.clientWidth
        ) <= 1,
        "Le sélecteur d'armes déborde à "+width+"px"
      );
      await pickerContext.close();
    }

    const mobileContext = await browser.newContext({
      viewport:{width:390,height:844},
      isMobile:true,
      hasTouch:true,
      reducedMotion:"reduce"
    });
    const mobile = await mobileContext.newPage();
    await mobile.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*", route =>
      route.fulfill({
        status:200,
        contentType:"application/javascript",
        body:"window.supabase=undefined;"
      })
    );
    await mobile.goto(pathToFileURL(path.resolve(__dirname, "..", "index.html")).href);

    assert.equal(await mobile.locator("#toast").getAttribute("role"), "status");
    assert.equal(await mobile.locator("#toast").getAttribute("aria-live"), "polite");

    for(const selector of [".tab", ".btn"]){
      const box = await mobile.locator(selector).first().boundingBox();
      assert.ok(box && box.height >= 44, selector+" doit mesurer au moins 44 px");
    }

    await mobile.locator(".hero .portrait").first().click();
    await mobile.locator('#pickerGrid .tile[title="Meliodas"]').click();
    const gearBox = await mobile.locator(".hero .gear-slot.weapon")
      .first().boundingBox();
    assert.ok(gearBox && gearBox.height >= 44, ".gear-slot doit mesurer 44 px");
    await mobile.locator(".hero .gear-slot.weapon").first().click();
    await mobile.locator("#overlay").waitFor({state:"visible"});
    for(const selector of [".icon-btn", ".chip"]){
      const box = await mobile.locator(selector).first().boundingBox();
      assert.ok(box && box.height >= 44, selector+" doit mesurer au moins 44 px");
      assert.ok(box.width >= 44, selector+" doit mesurer au moins 44 px de large");
    }
    const compactChipWidth = await mobile.evaluate(() => {
      const chip = document.createElement("button");
      chip.className = "chip";
      chip.textContent = "T0";
      document.body.appendChild(chip);
      const width = chip.getBoundingClientRect().width;
      chip.remove();
      return width;
    });
    assert.ok(
      compactChipWidth >= 44,
      ".chip compacte doit mesurer au moins 44 px de large"
    );
    await mobile.keyboard.press("Escape");

    for(const name of [
      "builder", "dashboard", "roster", "member-roster",
      "recensement", "analyse", "boss"
    ]){
      await mobile.locator('.tab[data-view="'+name+'"]').click();
      await mobile.waitForTimeout(50);
      const overflow = await mobile.evaluate(() =>
        document.scrollingElement.scrollWidth -
        document.scrollingElement.clientWidth
      );
      assert.ok(overflow <= 1, "Débordement "+name+" : "+overflow+"px");
    }

    const motion = await mobile.locator(".view.active").evaluate(node => ({
      animationName:getComputedStyle(node).animationName,
      animationDuration:getComputedStyle(node).animationDuration
    }));
    assert.ok(
      motion.animationName === "none" || motion.animationDuration === "0s",
      "Les animations doivent être neutralisées"
    );
    await mobileContext.close();

    /* Header rétractable : en descendant, la marque et le bloc compte se
       replient et seule la barre d'onglets reste collante. Le compte connecté
       est révélé de force pour mesurer le cas réel le plus haut. */
    for(const width of [320, 390]){
      const headerContext = await browser.newContext({
        viewport:{width,height:844},
        isMobile:true,
        hasTouch:true,
        reducedMotion:"reduce"
      });
      const headerPage = await headerContext.newPage();
      await headerPage.route(
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*",
        route => route.fulfill({
          status:200,
          contentType:"application/javascript",
          body:"window.supabase=undefined;"
        })
      );
      await headerPage.goto(
        pathToFileURL(path.resolve(__dirname, "..", "index.html")).href
      );
      await headerPage.evaluate(() => {
        document.querySelector("#accountLogin").hidden = true;
        document.querySelector("#accountConnected").hidden = false;
        document.querySelector("#accountPseudo").textContent = "Yannis";
        document.querySelector("#liveStatus").textContent = "À jour";
      });

      const headerMetrics = () => headerPage.evaluate(() => {
        const bar = document.querySelector(".topbar");
        const visible = selector => {
          const node = document.querySelector(selector);
          return !!node && node.getClientRects().length > 0;
        };
        const root = document.scrollingElement;
        return {
          height:Math.round(bar.getBoundingClientRect().height),
          retracted:bar.classList.contains("is-retracted"),
          brandVisible:visible(".brand"),
          accountVisible:visible("#accountConnected"),
          tabsVisible:visible(".tabs"),
          overflow:root.scrollWidth - root.clientWidth,
          scrollable:root.scrollHeight - root.clientHeight
        };
      });

      const expanded = await headerMetrics();
      assert.ok(
        expanded.scrollable > 400,
        `La page doit être défilable pour tester le header à ${width}px`
      );
      assert.equal(expanded.retracted, false);
      assert.equal(expanded.brandVisible, true);
      assert.equal(expanded.accountVisible, true);

      await headerPage.evaluate(() => window.scrollTo({ top:600 }));
      await headerPage.waitForFunction(() =>
        document.querySelector(".topbar").classList.contains("is-retracted")
      );
      const retracted = await headerMetrics();
      assert.equal(retracted.brandVisible, false, `Marque encore visible à ${width}px`);
      assert.equal(
        retracted.accountVisible,
        false,
        `Bloc compte encore visible à ${width}px`
      );
      assert.equal(
        retracted.tabsVisible,
        true,
        `Les onglets doivent rester atteignables à ${width}px`
      );
      assert.ok(
        retracted.height <= expanded.height * 0.5,
        `Le header replié doit perdre au moins la moitié de sa hauteur `+
        `à ${width}px (${expanded.height} -> ${retracted.height})`
      );
      assert.ok(retracted.overflow <= 1, `Débordement au repli à ${width}px`);
      // Un contrôle replié ne doit plus être atteignable au clavier.
      assert.equal(
        await headerPage.evaluate(() => {
          const logout = document.querySelector("#authLogout");
          logout.focus();
          return document.activeElement === logout;
        }),
        false,
        `Le bouton replié ne doit pas être focalisable à ${width}px`
      );

      // Remonter redéploie le header.
      await headerPage.evaluate(() => window.scrollTo({ top:0 }));
      await headerPage.waitForFunction(() =>
        !document.querySelector(".topbar").classList.contains("is-retracted")
      );
      const restored = await headerMetrics();
      assert.equal(restored.brandVisible, true, `Marque non restaurée à ${width}px`);
      assert.equal(restored.height, expanded.height);

      /* Naviguer laisse le focus sur l'onglet cliqué, et les onglets vivent dans
         le header. Comme ils restent visibles une fois replié, ils ne doivent
         jamais bloquer le repli. */
      await headerPage.locator('.tab[data-view="builder"]').click();
      await headerPage.waitForFunction(() =>
        document.activeElement === document.querySelector('.tab[data-view="builder"]')
      );
      await headerPage.evaluate(() => window.scrollTo({ top:800 }));
      await headerPage.waitForFunction(() =>
        document.querySelector(".topbar").classList.contains("is-retracted"),
        undefined,
        { timeout:4000 }
      );

      /* À l'inverse, un contrôle du bloc compte détient le focus : le replier le
         ferait disparaître sous les doigts, donc on s'en abstient. */
      await headerPage.evaluate(() => window.scrollTo({ top:0 }));
      await headerPage.waitForFunction(() =>
        !document.querySelector(".topbar").classList.contains("is-retracted")
      );
      await headerPage.locator("#authLogout").focus();
      await headerPage.evaluate(() => window.scrollTo({ top:800 }));
      await headerPage.waitForTimeout(250);
      assert.equal(
        await headerPage.evaluate(() =>
          document.querySelector(".topbar").classList.contains("is-retracted")
        ),
        false,
        `Le focus dans le bloc compte doit empêcher le repli à ${width}px`
      );
      /* Focus relâché : le repli redevient possible. Les deux défilements sont
         séparés par une frame, sinon le throttle `requestAnimationFrame` les
         fusionne et le contrôleur ne voit que la position finale — un doigt ne
         peut pas se téléporter de 0 à 800 en une frame. */
      await headerPage.evaluate(() => document.activeElement.blur());
      await headerPage.evaluate(() => window.scrollTo({ top:0 }));
      await headerPage.waitForFunction(() => Math.round(window.scrollY) === 0);
      await headerPage.evaluate(() => new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      ));
      await headerPage.evaluate(() => window.scrollTo({ top:800 }));
      await headerPage.waitForFunction(() =>
        document.querySelector(".topbar").classList.contains("is-retracted"),
        undefined,
        { timeout:4000 }
      );
      await headerContext.close();
    }

    // En desktop, le header ne se replie jamais.
    const deskHeader = await browser.newContext({ viewport:{width:1280,height:900} });
    const deskPage = await deskHeader.newPage();
    await deskPage.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*", route =>
      route.fulfill({
        status:200,
        contentType:"application/javascript",
        body:"window.supabase=undefined;"
      })
    );
    await deskPage.goto(
      pathToFileURL(path.resolve(__dirname, "..", "index.html")).href
    );
    await deskPage.evaluate(() => window.scrollTo({ top:600 }));
    await deskPage.waitForTimeout(120);
    assert.equal(
      await deskPage.evaluate(() =>
        document.querySelector(".topbar").classList.contains("is-retracted")
      ),
      false,
      "Le header ne doit jamais se replier en desktop"
    );
    assert.equal(
      await deskPage.evaluate(() =>
        document.querySelector(".brand").getClientRects().length > 0
      ),
      true
    );
    await deskHeader.close();

    assert.deepStrictEqual(errors, []);
    console.log("PASS accessibilité : onglets, modales, header rétractable et mobile");
  }finally{
    await browser.close();
  }
})().catch(error=>{
  console.error(error);
  process.exitCode = 1;
});
