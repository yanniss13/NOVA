"use strict";

/* L'apport d'une piece, verifie dans un vrai navigateur.

   Conception : docs/superpowers/specs/2026-08-03-apport-par-piece-modale-design.md

   L'equipe est amorcee dans localStorage plutot que construite au clic : le
   parcours d'equipement est deja couvert par potentiel-commun.playwright.js.

   Le heros porte une piece configuree ET une piece non configuree : c'est ce
   qui permet de verifier l'ordre du parcours. */

const assert = require("node:assert/strict");
const { serveRepo } = require("./helpers/serve");
const { chromium } = require("playwright");

const STORAGE_KEY = "confrerie7ds.teams";
const HAUT = "7ds-armures-ssr/Haut/Haut de l'araignée de l'ombre.webp";
const BAS = "7ds-armures-ssr/Bas/Bas de l'araignée de l'ombre.webp";

const CONFIG = { version:1, level:120, reinforce:0, enchantments:[], passiveLevel:null };

/* Une piece gravable — seules 40 des 96 pieces le sont — avec un jet place
   au maximum de son intervalle : la jauge doit alors etre pleine, ce qui
   est la seule valeur qu'on peut affirmer sans recopier le calcul ici. */
const BOTTES = "7ds-armures-ssr/Bottes/Bottes de combat du venin tissé.webp";
const BOTTES_STAT = "Debuff_Time_Rate";
const BOTTES_MAX = 2219;
const CONFIG_GRAVEE = {
  version:1, level:120, reinforce:0, passiveLevel:null,
  enchantments:[{ slot:0, stat:BOTTES_STAT, value:BOTTES_MAX }]
};

/* L'arme aussi porte des tirages : le jeu les appelle « Enchanter », et
   c'est le cas que la premiere version n'avait jamais verifie.

   Une HACHE : Diane porte Hache, Gantelets et Cudgel — la normalisation de
   l'equipe ecarte une arme incompatible, et le heros se retrouverait sans
   arme sans que le test le dise. */
const ARME = "7ds-armes/Hache/Hache bénie.webp";
const ARME_CONFIG = {
  version:1,
  gradeGameId:"131121003",
  level:0,
  promotion:0,
  overlimit:0,
  /* C_Critical_Dam_Rate vaut [900, 1100] au catalogue, ramene a [450, 550]
     par le taux de l'emplacement (5000 / 10000). Le jet est pose au maximum :
     jauge pleine attendue. */
  enchantments:[{ slot:0, stat:"C_Critical_Dam_Rate", value:550 }]
};

const EQUIPE = {
  id:"apport-1",
  name:"Apport",
  pseudo:"Apport",
  heroes:[{
    char:"diane",
    weapon:ARME,
    weaponConfig:ARME_CONFIG,
    armor:{ Haut:HAUT, Bas:BAS, Bottes:BOTTES },
    armorConfig:{ Haut:CONFIG, Bottes:CONFIG_GRAVEE },
    jewel:{},
    jewelConfig:{},
    potentiel:{ tier:0 }
  }]
};

(async()=>{
  const server = await serveRepo();
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{ width:1440, height:1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  try{
    await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*", route =>
      route.fulfill({ status:200, contentType:"application/javascript", body:"" })
    );
    await page.goto(server.url + "/index.html");
    await page.evaluate(([key, data]) => {
      localStorage.setItem(key, JSON.stringify(data));
    }, [STORAGE_KEY, [EQUIPE]]);
    await page.reload();

    await page.locator('[data-view="roster"]').click();
    await page.getByRole("button", { name:/Voir l.équipement/ }).first().click();

    /* La ligne d'une piece equipee est un bouton, et elle ouvre la modale. */
    const ligne = page.locator("button.eq-line").first();
    await ligne.waitFor({ state:"visible" });
    await ligne.click();

    const overlay = page.locator("#pieceDetailOverlay");
    await overlay.waitFor({ state:"visible" });
    assert.equal(
      await overlay.evaluate(node => node.classList.contains("on")),
      true,
      "un clic sur la ligne ouvre la modale de la piece"
    );

    /* L'ARME OUVRE LE PARCOURS. C'est le cas que la premiere version n'avait
       jamais verifie : le code existait, rien ne prouvait qu'il fonctionnait. */
    const titre = page.locator("#pieceDetailTitle");
    const position = page.locator("#pieceDetailPosition");
    const jauges = page.locator("#pieceDetailBody .roll-line");
    const titreTirages = page.locator(
      "#pieceDetailBody .roll-section .weapon-stats-family-title"
    );

    assert.equal(
      (await titre.textContent()).trim(),
      "Hache bénie",
      "la modale est titree du nom de l'arme, qui ouvre le parcours"
    );
    assert.equal(
      (await position.textContent()).trim(),
      "1 / 4",
      "la position reflete le parcours"
    );
    assert.equal(
      await page.locator("#pieceDetailPrev").isDisabled(),
      true,
      "la fleche precedente est desactivee sur la premiere entree"
    );

    /* L'enchantement de l'arme, avec sa jauge. Le jet est pose au maximum de
       son intervalle : jauge pleine, la seule valeur affirmable sans recopier
       ici le calcul du ratio. */
    assert.equal(
      await jauges.count(),
      1,
      "l'arme enchantee affiche son enchantement"
    );
    assert.equal(
      await page.locator("#pieceDetailBody .roll-gauge-fill")
        .evaluate(node => node.style.width),
      "100%",
      "un jet au maximum de l'intervalle remplit la jauge de l'arme"
    );
    assert.equal(
      (await titreTirages.textContent()).trim(),
      "Enchantement",
      "l'arme parle d'enchantement, pas de gravure : c'est le mot du jeu"
    );
    assert.ok(
      (await jauges.first().locator(".roll-value").textContent()).trim().length > 1,
      "la jauge porte la valeur du tirage a cote d'elle"
    );

    /* La vignette : c'est elle que le membre reconnait dans le jeu, bien
       avant le libelle du catalogue. */
    const vignette = page.locator("#pieceDetailThumb");
    assert.equal(
      await vignette.isVisible(),
      true,
      "la modale montre la vignette de la piece"
    );
    assert.match(
      await vignette.evaluate(node => node.style.backgroundImage),
      /Hache bénie/,
      "la vignette est bien celle de la piece affichee"
    );

    /* Une piece configuree mais non gravee : aucune section de tirage. Une
       section vide serait pire que pas de section du tout. */
    await page.locator("#pieceDetailNext").click();
    assert.equal(
      (await position.textContent()).trim(),
      "2 / 4",
      "la fleche suivante avance dans le parcours"
    );
    assert.equal(
      (await titre.textContent()).trim(),
      "Haut de l'araignée de l'ombre",
      "le titre suit la navigation"
    );
    assert.match(
      await vignette.evaluate(node => node.style.backgroundImage),
      /Haut de l/,
      "la vignette suit la navigation, elle ne reste pas sur la piece precedente"
    );
    assert.ok(
      await page.locator("#pieceDetailBody .weapon-stat").count() > 0,
      "une piece configuree affiche ses statistiques"
    );
    assert.equal(
      await jauges.count(),
      0,
      "une piece sans gravure n'affiche aucune jauge"
    );

    /* Une piece gravee : meme jauge, mais le mot du jeu change. */
    await page.locator("#pieceDetailNext").click();
    assert.equal(
      (await titre.textContent()).trim(),
      "Bottes de combat du venin tissé",
      "la piece gravee vient ensuite"
    );
    assert.equal(
      await jauges.count(),
      1,
      "la piece gravee affiche sa gravure"
    );
    assert.equal(
      (await titreTirages.textContent()).trim(),
      "Gravure",
      "une piece d'equipement parle de gravure, pas d'enchantement"
    );

    await page.locator("#pieceDetailNext").click();
    assert.equal(
      (await position.textContent()).trim(),
      "4 / 4",
      "la piece non configuree ferme le parcours"
    );
    assert.equal(
      (await titre.textContent()).trim(),
      "Bas de l'araignée de l'ombre",
      "la piece non configuree passe apres les configurees"
    );
    assert.equal(
      await page.locator("#pieceDetailNext").isDisabled(),
      true,
      "la fleche suivante est desactivee sur la derniere entree"
    );

    /* Une piece non configuree annonce son etat, sans statistique. */
    assert.match(
      await page.locator("#pieceDetailBody").textContent(),
      /pas encore configurée/,
      "une piece non configuree affiche son message"
    );
    assert.equal(
      await page.locator("#pieceDetailBody .weapon-stat").count(),
      0,
      "une piece non configuree n'affiche aucune statistique"
    );

    /* Echap ferme la modale de piece SANS fermer la modale d'equipe qui la
       porte : ModalStack ne leve son verrou de defilement qu'a la derniere
       fermeture, une regression ici casserait le defilement de la page. */
    await page.keyboard.press("Escape");
    assert.equal(
      await overlay.evaluate(node => node.classList.contains("on")),
      false,
      "Echap ferme la modale de la piece"
    );
    assert.equal(
      await page.locator("#teamOverlay").evaluate(node => node.classList.contains("on")),
      true,
      "la modale d'equipe reste ouverte dessous"
    );

    /* Le focus revient sur la ligne d'origine. */
    assert.equal(
      await page.evaluate(() =>
        document.activeElement && document.activeElement.classList.contains("eq-line")
      ),
      true,
      "le focus revient sur la ligne qui a ouvert la modale"
    );

    assert.deepEqual(errors, [], "aucune erreur de page pendant le scenario");
    console.log("PASS Playwright: apport par piece");
  }finally{
    await browser.close();
    await server.close();
  }
})();
