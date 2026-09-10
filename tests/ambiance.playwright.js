"use strict";

const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { serveRepo } = require("./helpers/serve");

(async () => {
  const server = await serveRepo();
  const browser = await chromium.launch({ headless:true });
  try {
    const context = await browser.newContext({ serviceWorkers:"block" });
    const page = await context.newPage();
    await page.route("https://**/*", route => route.abort());
    await page.goto(server.url + "/#builder");
    await page.locator("#view-builder.active").waitFor();
    /* Le sélecteur existe en DEUX exemplaires : celui de l'en-tête, et celui
       du panneau « Plus » pour le mobile, dont l'en-tête compact ne peut pas
       l'accueillir. Un seul est visible à la fois — c'est ce qu'on vise. */
    const bascule = theme => page.locator('[data-ambiance="' + theme + '"]:visible');
    const ouvrirPlusSiMobile = async () => {
      if(page.viewportSize().width > 560) return;
      const plus = page.locator('[aria-controls="mobileMorePanel"]');
      if(await plus.getAttribute("aria-expanded") !== "true") await plus.click();
    };
    assert.equal(await page.locator('[data-ambiance="light"]').count(), 2,
      "Le membre peut choisir l'ambiance Lumière, en en-tête comme dans « Plus »");
    assert.equal(await bascule("light").count(), 1,
      "Un seul exemplaire du sélecteur doit être visible à la fois");
    await page.locator("#teamName").fill("Les gardiens de NOVA");
    await page.locator(".portrait").first().click();
    await page.locator('#pickerGrid .tile').first().click();
    const hero = await page.locator(".hero-title").first().textContent();
    for(const theme of ["light", "dark", "light"]){
      await bascule(theme).click();
      assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
      assert.equal(await bascule(theme).getAttribute("aria-pressed"), "true",
        "Les deux exemplaires doivent refléter le choix");
      assert.equal(await page.locator("#teamName").inputValue(), "Les gardiens de NOVA");
      assert.equal(await page.locator(".hero-title").first().textContent(), hero);
    }
    await page.reload();
    await page.locator("#view-builder.active").waitFor();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "light",
      "Le choix survit au rechargement");
    for(const width of [320, 390, 768, 1440]){
      await page.setViewportSize({ width, height:900 });
      await ouvrirPlusSiMobile();
      for(const theme of ["dark", "light"]){
        const button = bascule(theme);
        await button.click();
        await ouvrirPlusSiMobile();
        const box = await button.boundingBox();
        assert.ok(box.width >= 44 && box.height >= 44, "Cible tactile de l'ambiance");
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          "Pas de débordement à "+width+" px en "+theme);
      }
    }
    await page.evaluate(() => localStorage.setItem("confrerie7ds.ambiance", "inconnue"));
    await page.reload();
    await page.locator("#view-builder.active").waitFor();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    const other = await page.context().newPage();
    await other.route("https://**/*", route => route.abort());
    await other.goto(server.url + "/#builder");
    await other.locator("#view-builder.active").waitFor();
    await other.locator('[data-ambiance="light"]:visible').click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === "light");
    await other.close();
    await page.addInitScript(() => {
      const read = Storage.prototype.getItem;
      const write = Storage.prototype.setItem;
      Storage.prototype.getItem = function(key){
        if(key === "confrerie7ds.ambiance") throw new Error("Stockage indisponible");
        return read.call(this, key);
      };
      Storage.prototype.setItem = function(key, value){
        if(key === "confrerie7ds.ambiance") throw new Error("Stockage indisponible");
        return write.call(this, key, value);
      };
    });
    await page.reload();
    await page.locator("#view-builder.active").waitFor();
    await page.locator('[data-ambiance="light"]:visible').focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("html").getAttribute("data-theme"), "light",
      "La bascule clavier fonctionne même si le stockage est refusé");
    /* La bannière ne doit plus se lire comme une boîte posée sur la page.
       Trois faits l'attestent, et ce sont eux qu'on mesure plutôt que le
       rendu : aucun bord visible, le panorama qui remonte SOUS l'en-tête, et
       un en-tête réellement translucide pour le laisser transparaître. */
    await page.setViewportSize({ width:1440, height:900 });
    await page.locator('[data-ambiance="dark"]:visible').click();
    const decor = await page.evaluate(() => {
      const banner = document.querySelector(".guild-banner");
      const bar = document.querySelector(".topbar");
      const styleBanner = getComputedStyle(banner);
      const styleBar = getComputedStyle(bar);
      const publiee = getComputedStyle(document.documentElement)
        .getPropertyValue("--topbar-h").trim();
      return {
        hauteurPubliee:parseFloat(publiee),
        hauteurReelle:Math.round(bar.getBoundingClientRect().height),
        bordBas:styleBanner.borderBottomWidth,
        couleurBordBas:styleBanner.borderBottomColor,
        hautBanniere:Math.round(banner.getBoundingClientRect().top),
        basEnTete:Math.round(bar.getBoundingClientRect().bottom),
        fondEnTete:styleBar.backgroundColor,
        masque:styleBanner.getPropertyValue("--banner-fondu").trim()
      };
    });
    assert.ok(decor.hauteurPubliee > 0,
      "La hauteur de l'en-tête doit être publiée : sans elle le panorama se décale");
    assert.ok(Math.abs(decor.hauteurPubliee - decor.hauteurReelle) <= 1,
      `--topbar-h (${decor.hauteurPubliee}) doit suivre l'en-tête (${decor.hauteurReelle})`);
    assert.ok(decor.bordBas === "0px" || /rgba\(0, 0, 0, 0\)/.test(decor.couleurBordBas),
      "La bannière ne doit plus porter de filet doré : c'est lui qui en faisait une boîte");
    assert.ok(decor.hautBanniere < decor.basEnTete,
      "Le panorama doit remonter sous l'en-tête, pas commencer après lui");
    /* En haut de page l'en-tête est ENTIÈREMENT transparent : le panorama se
       voit sans voile. Après défilement il reprend son verre, sinon les
       onglets se poseraient illisibles sur le contenu qui passe dessous. */
    const alphaHaut = decor.fondEnTete.match(/rgba?\([^)]*?,\s*([\d.]+)\)\s*$/);
    assert.ok(alphaHaut && Number(alphaHaut[1]) === 0,
      `En haut de page l'en-tête doit être transparent (${decor.fondEnTete})`);
    await page.evaluate(() => window.scrollTo(0, 1400));
    await page.waitForFunction(() => document.documentElement.dataset.defile === "oui");
    /* Le fond arrive par une transition de 220 ms : lire juste après la
       bascule rendrait la valeur de DÉPART, c'est-à-dire transparente.
       On attend donc l'état stable plutôt qu'un délai deviné. */
    const fondDefile = await page.waitForFunction(() => {
      const fond = getComputedStyle(document.querySelector(".topbar")).backgroundColor;
      const alpha = fond.match(/rgba?\([^)]*?,\s*([\d.]+)\)\s*$/);
      return (!alpha || Number(alpha[1]) > 0.5) ? fond : false;
    }).then(handle => handle.jsonValue());
    const alphaBas = fondDefile.match(/rgba?\([^)]*?,\s*([\d.]+)\)\s*$/);
    assert.ok(!alphaBas || Number(alphaBas[1]) > 0.5,
      `Une fois défilé, l'en-tête doit reprendre son fond (${fondDefile})`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForFunction(() => document.documentElement.dataset.defile === "non");
    assert.ok(decor.masque.includes("transparent"),
      "Le fondu du bas doit aller vers la transparence, pas vers une couleur de fond");

    /* La bannière doit être IDENTIQUE d'une page à l'autre. Elle ne l'était
       pas : un jeu de règles la raccourcissait dans les catalogues, titre à
       36 px et lien d'appel masqué, alors que l'Accueil et le Builder la
       montraient en entier. On compare donc les deux familles de vues. */
    /* Un délai deviné ne prouve rien : `--topbar-h` est publié par le module
       d'ambiance APRÈS le chargement, et la bannière s'y cale. Mesurer avant
       sa publication lit une bannière pas encore posée — c'est ce qui rendait
       cet essai intermittent. On attend donc la valeur, puis une trame. */
    const attendreDecorPose = async () => {
      /* Il ne suffit PAS que `--topbar-h` existe : le ResizeObserver la
         republie à la trame suivante, et encore après quand les polices
         changent la hauteur de l'en-tête. On attend qu'elle CORRESPONDE à
         l'en-tête réel, puis une trame. Mesurer entre les deux lit une
         bannière réglée sur une hauteur périmée. */
      await page.waitForFunction(() => {
        const barre = document.querySelector(".topbar").getBoundingClientRect().height;
        const publiee = parseFloat(getComputedStyle(document.documentElement)
          .getPropertyValue("--topbar-h"));
        return barre > 0 && Math.abs(publiee - barre) <= 1;
      });
      await page.evaluate(() => new Promise(requestAnimationFrame));
    };
    /* La référence est le Builder et non l'Accueil : l'Accueil demande un
       compte, sa modale de connexion s'ouvre, et le verrou de défilement retire
       la barre latérale. La fenêtre utile change de largeur, l'en-tête se
       replie autrement, et on mesurerait une bannière dans une page déformée. */
    const signatureBanniere = async vue => {
      await page.goto(server.url + "/#" + vue);
      await page.locator("#view-" + vue + ".active").waitFor();
      if(await page.locator("#authOverlay.on").count()) await page.keyboard.press("Escape");
      /* `getBoundingClientRect` est relatif à la FENÊTRE : mesurer une page
         défilée décale le titre d'autant. La section précédente laissait 40 px
         de défilement, et la référence valait 184 au lieu de 224. */
      await page.evaluate(() => window.scrollTo(0, 0));
      await attendreDecorPose();
      return page.evaluate(() => {
        const titreVisible = () => [...document.querySelectorAll(".guild-banner-title")]
          .find(e => e.getBoundingClientRect().height > 0);
        const titre = titreVisible();
        const lead = document.querySelector(".guild-banner-lead");
        const lien = document.querySelector(".guild-banner-link");
        return {
          titreTaille:getComputedStyle(titre).fontSize,
          titrePolice:getComputedStyle(titre).fontFamily,
          leadTaille:getComputedStyle(lead).fontSize,
          leadMarge:getComputedStyle(lead).margin,
          lienAffiche:getComputedStyle(lien).display,
          hauteur:Math.round(document.querySelector(".guild-banner").getBoundingClientRect().height),
          /* L'en-tête et le défilement entrent dans la comparaison : un titre
             mesuré page défilée, ou sous un en-tête replié autrement, ne dit
             rien de la bannière elle-même. */
          enTete:Math.round(document.querySelector(".topbar").getBoundingClientRect().height),
          defilement:Math.round(window.scrollY),
          titreY:Math.round(titre.getBoundingClientRect().top)
        };
      });
    };
    await page.setViewportSize({ width:1440, height:900 });
    /* Une phrase par vue, et une seule à l'écran. Les onze coexistent dans le
       document : si le CSS en laissait passer deux, la bannière afficherait
       deux titres l'un sous l'autre et changerait de hauteur. */
    const phrases = new Map();
    for(const vue of ["dashboard", "builder", "wiki", "collection", "calculateur"]){
      await page.goto(server.url + "/#" + vue);
      await page.locator("#view-" + vue + ".active").waitFor();
      if(await page.locator("#authOverlay.on").count()) await page.keyboard.press("Escape");
      const vu = await page.evaluate(() => {
        const peints = [...document.querySelectorAll(".guild-banner-texte")]
          .filter(e => e.getBoundingClientRect().height > 0);
        return { combien:peints.length,
                 vue:peints[0] && peints[0].dataset.vue,
                 titre:peints[0] && peints[0].querySelector(".guild-banner-title").textContent.trim(),
                 lignes:peints[0] && peints[0].querySelectorAll(".guild-banner-title br").length };
      });
      assert.equal(vu.combien, 1,
        `Une seule phrase doit paraître sur « ${vue} » (${vu.combien})`);
      assert.equal(vu.vue, vue,
        `La phrase affichée sur « ${vue} » doit être la sienne (${vu.vue})`);
      assert.equal(vu.lignes, 1,
        `Le titre de « ${vue} » doit tenir sur deux lignes : sans quoi la bannière change de hauteur`);
      phrases.set(vue, vu.titre);
    }
    assert.equal(new Set(phrases.values()).size, phrases.size,
      "Chaque vue doit avoir sa propre phrase, pas la même répétée");

    const surBuilder = await signatureBanniere("builder");
    for(const vue of ["wiki", "collection", "calculateur"]){
      const ailleurs = await signatureBanniere(vue);
      assert.deepEqual(ailleurs, surBuilder,
        `La bannière de « ${vue} » doit être identique à celle du Builder`);
    }
    assert.notEqual(surBuilder.lienAffiche, "none",
      "Le lien d'appel de la bannière doit être visible partout, pas seulement sur le Builder");

    /* Dans les catalogues, le texte est ancré au BAS d'une bannière de hauteur
       constante. Les vues du groupe « Boss de Guilde » ajoutent une seconde
       ligne d'onglets : sans cet ancrage, le titre descendait de 52 px d'une
       vue à l'autre. On fait grandir l'en-tête pour le vérifier. */
    await page.goto(server.url + "/#wiki");
    await page.locator("#view-wiki.active").waitFor();
    await page.setViewportSize({ width:1440, height:900 });
    const mesurerBanniere = () => page.evaluate(() => ({
      enTete:Math.round(document.querySelector(".topbar").getBoundingClientRect().height),
      banniere:Math.round(document.querySelector(".guild-banner").getBoundingClientRect().height),
      titreY:Math.round([...document.querySelectorAll(".guild-banner-title")]
        .find(e => e.getBoundingClientRect().height > 0).getBoundingClientRect().top)
    }));
    const court = await mesurerBanniere();
    await page.evaluate(() => {
      const sub = document.querySelector(".subtabs");
      if(sub){ sub.hidden = false; sub.style.display = "flex"; }
    });
    /* Attendre que l'en-tête ait grandi ne suffit pas : `--topbar-h` n'est
       republié qu'à la trame suivante par le ResizeObserver, et la bannière se
       cale dessus. Mesurer entre les deux lit une bannière encore réglée sur
       l'ANCIENNE hauteur — c'est ce qui rendait cet essai intermittent.
       On attend donc que la valeur publiée rejoigne la hauteur réelle. */
    await page.waitForFunction(hauteur => {
      const barre = Math.round(
        document.querySelector(".topbar").getBoundingClientRect().height);
      const publiee = parseFloat(getComputedStyle(document.documentElement)
        .getPropertyValue("--topbar-h"));
      return barre > hauteur && Math.abs(publiee - barre) <= 1;
    }, court.enTete);
    await page.evaluate(() => new Promise(requestAnimationFrame));
    const haut = await mesurerBanniere();
    assert.ok(haut.enTete > court.enTete,
      "L'essai n'a pas fait grandir l'en-tête : il ne prouve rien");
    assert.equal(haut.titreY, court.titreY,
      `Le titre doit rester à la même hauteur quand l'en-tête grandit (${court.titreY} puis ${haut.titreY})`);
    assert.equal(haut.banniere, court.banniere,
      `La bannière doit garder sa hauteur (${court.banniere} puis ${haut.banniere})`);
    /* Deux gardes que la première version de cet essai n'avait pas, et qui ont
       laissé passer une vraie régression : le bloc de texte s'était réduit à
       sa largeur de contenu, et le sélecteur d'ambiance était venu sur le
       titre. Des marges auto sur l'axe transversal d'un flex en colonne
       annulent l'étirement — d'où la mesure de largeur. */
    for(const largeur of [1920, 1440, 1100]){
      await page.setViewportSize({ width:largeur, height:900 });
      await attendreDecorPose();
      const geo = await page.evaluate(() => {
        /* On mesure ce qui est PEINT : le titre existe en onze exemplaires dont
           un seul paraît, et le sélecteur en deux — celui de l'en-tête et celui
           du panneau « Plus ». Prendre le premier venu ne mesurerait rien. */
        const boite = noeud => {
          const b = noeud.getBoundingClientRect();
          return { gauche:b.left, droite:b.right, haut:b.top, bas:b.bottom, largeur:b.width };
        };
        const peint = sel => [...document.querySelectorAll(sel)]
          .find(e => e.getBoundingClientRect().height > 0);
        return { inner:boite(document.querySelector(".guild-banner-inner")),
                 titre:boite(peint(".guild-banner-title")),
                 bascule:boite(peint(".ambiance-switch")) };
      });
      assert.equal(Math.round(geo.inner.largeur), Math.min(1180, largeur),
        `Le bloc de bannière doit occuper toute la colonne à ${largeur} px (${Math.round(geo.inner.largeur)} px)`);
      const separes = geo.bascule.bas <= geo.titre.haut
        || geo.bascule.haut >= geo.titre.bas
        || geo.bascule.droite <= geo.titre.gauche
        || geo.bascule.gauche >= geo.titre.droite;
      assert.ok(separes,
        `Le sélecteur d'ambiance ne doit pas recouvrir le titre à ${largeur} px`);
    }

    await page.setViewportSize({ width:1440, height:900 });
    await page.goto(server.url + "/#builder");
    await page.locator("#view-builder.active").waitFor();

    /* Le lien affilié a quitté l'en-tête : son jaune de marque y devenait
       illisible dès qu'on passait en Lumière. On vérifie qu'il est bien en
       pied de page, que sa rémunération y est écrite pour les membres et non
       plus seulement déclarée aux moteurs, et qu'il garde son fond sombre
       dans les DEUX ambiances — sans quoi il redeviendrait illisible. */
    assert.equal(await page.locator(".topbar .lootbar").count(), 0,
      "L'en-tête ne doit plus porter le lien LootBar");
    assert.equal(await page.locator("footer.site-footer #lootbarLink").count(), 1,
      "Le lien LootBar doit vivre en pied de page");
    assert.equal(
      await page.locator("footer.site-footer #lootbarLink").getAttribute("rel"),
      "sponsored noopener noreferrer",
      "Un lien rémunéré se déclare, et n'ouvre pas d'accès à cette page");
    /* `textContent` et non `innerText` : le CSS met la mention en capitales,
       et innerText rend le texte tel qu'il est PEINT. On teste ce que le
       document dit, pas la casse décorative. */
    assert.equal(
      (await page.locator(".site-footer-mention").textContent()).trim(),
      "Lien partenaire",
      "La rémunération doit être lisible par les membres");
    for(const theme of ["dark", "light"]){
      await bascule(theme).click();
      const socle = await page.evaluate(() => {
        const fond = getComputedStyle(document.querySelector(".site-footer")).backgroundColor;
        const [r, g, b] = fond.match(/[\d.]+/g).map(Number);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      });
      assert.ok(socle < 90,
        `Le pied de page doit rester un socle sombre en ${theme} : le jaune LootBar en dépend`);
    }

    /* Les glyphes d'arme et de compétence sont du blanc pur sur transparence :
       invisibles sur l'ivoire du thème clair. Ils y passent en noir. Le piège
       est qu'un filtre s'applique aussi au FOND de l'élément — noircir une
       image qui porte son propre fond sombre peint un carré noir plein. On
       vérifie donc les deux à la fois : glyphe noirci, fond resté clair. */
    await page.setViewportSize({ width:1440, height:1000 });
    await page.goto(server.url + "/#wiki");
    await page.locator("#view-wiki.active").waitFor();
    if(await page.locator("#authOverlay.on").count()) await page.keyboard.press("Escape");
    await page.locator('[data-ambiance="light"]:visible').click();
    await page.locator("#tab-wiki").click();
    await page.locator("#wikiGrid .wiki-tile").first().waitFor();
    await page.locator("#wikiGrid .wiki-tile").first().click();
    await page.locator(".wiki-hero-weapon-icon").first().waitFor();
    const glyphes = await page.evaluate(() => {
      const fondEffectif = noeud => {
        let e = noeud;
        while(e && e !== document.documentElement){
          const f = getComputedStyle(e).backgroundColor;
          const m = f.match(/rgba?\(([^)]+)\)/);
          if(m){
            const v = m[1].split(",").map(Number);
            if(v.length < 4 || v[3] > 0.2){
              return Math.round(0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]);
            }
          }
          e = e.parentElement;
        }
        return null;
      };
      return [...document.querySelectorAll(
        'img[src*="7ds-ui/mastery/"],img[src*="7ds-ui/skills/"]')]
        .filter(img => img.getBoundingClientRect().width > 0)
        .map(img => ({
          classe:img.className,
          filtre:getComputedStyle(img).filter,
          fond:fondEffectif(img)
        }));
    });
    assert.ok(glyphes.length > 0,
      "L'essai doit trouver des glyphes à vérifier, sinon il ne prouve rien");
    glyphes.forEach(glyphe => {
      assert.equal(glyphe.filtre, "brightness(0)",
        `Le glyphe « ${glyphe.classe} » doit être noirci en ambiance Lumière`);
      assert.ok(glyphe.fond === null || glyphe.fond > 140,
        `Le glyphe « ${glyphe.classe} » est noirci sur un fond sombre (luminance ${glyphe.fond}) : il y disparaîtrait`);
    });
    /* Les icônes d'élément sont des illustrations EN COULEUR : les noircir les
       détruirait. Elles ne doivent jamais tomber sous le même filtre. */
    const couleurs = await page.evaluate(() =>
      [...document.querySelectorAll('img[src*="7ds-ui/role-elements/"]')]
        .map(img => getComputedStyle(img).filter));
    couleurs.forEach(filtre => assert.equal(filtre, "none",
      "Les icônes d'élément sont en couleur : elles ne doivent pas être noircies"));
    await page.keyboard.press("Escape");
    await page.goto(server.url + "/#builder");
    await page.locator("#view-builder.active").waitFor();

    /* La barre au pouce est fixe. Le pied de page est devenu le dernier bloc
       de la page : c'est lui, désormais, qui doit lui réserver sa place. */
    await page.setViewportSize({ width:390, height:780 });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForFunction(() => {
      const lien = document.querySelector("footer.site-footer #lootbarLink");
      return lien && lien.getBoundingClientRect().height > 0;
    });
    const bas = await page.evaluate(() => {
      const lien = document.querySelector("footer.site-footer #lootbarLink");
      const barre = document.querySelector(".mobile-nav");
      return {
        basDuLien:lien.getBoundingClientRect().bottom,
        hautDeLaBarre:barre ? barre.getBoundingClientRect().top : Infinity
      };
    });
    assert.ok(bas.basDuLien <= bas.hautDeLaBarre + 1,
      `La barre au pouce ne doit pas recouvrir le lien partenaire (${bas.basDuLien} > ${bas.hautDeLaBarre})`);

    console.log("PASS ambiances : bascule sans perte de brouillon, mémoire, mobile, décor fondu et pied de page");
  } finally {
    await browser.close();
    await server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
