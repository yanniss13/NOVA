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
   arme sans que le test le dise.

   Celle-ci precisement, parce qu'AUCUNE hache du catalogue n'a a la fois un
   passif et un grade a enchantements « basic ». Les sept haches a passif
   utilisent toutes des perles — d'ou cette fixture, qui couvre du meme coup
   la jauge d'une perle et le passif de l'arme. */
const ARME = "7ds-armes/Hache/Hache de l'âme vorace.webp";
const ARME_CONFIG = {
  version:1,
  gradeGameId:"131125010",
  level:0,
  promotion:0,
  /* overlimit 0 donne passiveLevel 1 : le passif est lisible. */
  overlimit:0,
  /* Palier 1, un seul emplacement. B_Def_Equip vaut [56, 112] : le jet est
     pose au maximum, jauge pleine attendue. */
  enchantments:[{ slot:0, tier:1, element:null, stat:"B_Def_Equip", value:112 }]
};

/* L'armure gravee de Diane — ce que le jeu appelle une tenue. Toutes les
   armures gravees portent un passif (66 sur 66). */
const TENUE = "7ds-armures-ssr/Armure liee/Tenue de combat cloutée.webp";
const TENUE_CONFIG = {
  version:1,
  level:120,
  reinforce:0,
  passiveLevel:1,
  enchantments:[
    { slot:0, stat:"Buff_Time_Rate", value:3328 },
    null,
    null
  ]
};

const EQUIPE = {
  id:"apport-1",
  name:"Apport",
  pseudo:"Apport",
  heroes:[{
    char:"diane",
    weapon:ARME,
    weaponConfig:ARME_CONFIG,
    armor:{ Haut:HAUT, Bas:BAS, Bottes:BOTTES, "Armure liee":TENUE },
    armorConfig:{ Haut:CONFIG, Bottes:CONFIG_GRAVEE, "Armure liee":TENUE_CONFIG },
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
      "Hache de l'âme vorace",
      "la modale est titree du nom de l'arme, qui ouvre le parcours"
    );
    assert.equal(
      (await position.textContent()).trim(),
      "1 / 5",
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
      "un jet au maximum de l'intervalle remplit la jauge de la perle"
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

    /* LE DOUBLON FRANC, sur cette arme precise : « Degats crit. » vient
       ENTIEREMENT de l'enchantement, et s'affichait a l'identique dans la
       section des enchantements et dans les statistiques agregees.

       L'assertion ne vaut que pour cette arme. Une piece peut legitimement
       porter la meme statistique en fixe ET en gravure, avec deux valeurs
       differentes : ce n'est pas un doublon, c'est deux apports distincts. */
    const libellesTires = await page.locator("#pieceDetailBody .roll-label")
      .evaluateAll(ns => ns.map(n => n.textContent.trim()));
    const libellesFixes = await page
      .locator("#pieceDetailBody .weapon-stat .weapon-stat-head > span:first-child")
      .evaluateAll(ns => ns.map(n => n.textContent.trim()));
    const communs = libellesTires.filter(l => libellesFixes.includes(l));
    assert.deepEqual(
      communs,
      [],
      "sur cette arme, une statistique purement tiree ne doit pas etre "
        + "repetee en fixe, recu : " + communs.join(", ")
    );

    /* L'ordre du jeu : les statistiques fixes de la piece AVANT les tirages. */
    const ordre = await page.evaluate(() => {
      const sections = [...document.querySelectorAll(
        "#pieceDetailBody .weapon-stats-family"
      )];
      return sections.map(n => n.classList.contains("roll-section") ? "tirages" : "fixes");
    });
    assert.ok(
      ordre.indexOf("fixes") >= 0 && ordre.indexOf("tirages") >= 0,
      "l'arme presente les deux sections, recu : " + ordre.join(", ")
    );
    assert.ok(
      ordre.indexOf("fixes") < ordre.indexOf("tirages"),
      "les statistiques fixes passent au-dessus des tirages, recu : " + ordre.join(", ")
    );

    /* Le passif de l'arme, sur l'arme. Il etait relegue au bloc du heros en
       bas de fiche, alors que le membre le cherche sur la piece. */
    const passif = page.locator("#pieceDetailBody .hero-passive");
    assert.equal(
      await passif.count(),
      1,
      "l'arme affiche son passif dans sa propre modale"
    );
    assert.match(
      await passif.locator(".hero-passive-head").textContent(),
      /Niveau \d+ \/ \d+/,
      "le passif annonce son niveau et son maximum"
    );
    assert.ok(
      (await passif.locator(".hero-passive-text").textContent()).trim().length > 10,
      "le passif porte son texte"
    );
    /* La reserve doit rester visible : rien ici n'est chiffre dans les
       totaux, et laisser croire le contraire serait un faux calcul. */
    assert.match(
      await page.locator("#pieceDetailBody").textContent(),
      /Non inclus dans le calcul/,
      "le passif annonce qu'il n'entre pas dans le calcul"
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
      /Hache de l/,
      "la vignette est bien celle de la piece affichee"
    );

    /* Une piece configuree mais non gravee : aucune section de tirage. Une
       section vide serait pire que pas de section du tout. */
    await page.locator("#pieceDetailNext").click();
    assert.equal(
      (await position.textContent()).trim(),
      "2 / 5",
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

    /* Pas de « Detail du calcul » ici : il vit une seule fois, dans le bloc
       de statistiques du heros. Le repeter sur chacune des neuf pieces
       rallongeait la modale sans rien apprendre de plus. */
    assert.equal(
      await page.locator("#pieceDetailBody .weapon-stat-details").count(),
      0,
      "la modale d'une piece ne repete pas la ventilation par terme"
    );
    assert.doesNotMatch(
      await page.locator("#pieceDetailBody").textContent(),
      /Détail du calcul/,
      "aucun « Detail du calcul » dans la modale d'une piece"
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

    /* L'ARMURE GRAVEE — ce que le jeu appelle une tenue. Elle porte un
       passif comme l'arme, et c'est le second cas demande. */
    await page.locator("#pieceDetailNext").click();
    assert.equal(
      (await titre.textContent()).trim(),
      "Tenue de combat cloutée",
      "l'armure gravee vient ensuite"
    );
    assert.equal(
      await page.locator("#pieceDetailBody .hero-passive").count(),
      1,
      "l'armure gravee affiche son passif dans sa propre modale"
    );
    assert.match(
      await page.locator("#pieceDetailBody .hero-passive .hero-passive-head")
        .textContent(),
      /Niveau 1 \/ 3/,
      "le passif de la tenue annonce son niveau et son maximum"
    );

    await page.locator("#pieceDetailNext").click();
    assert.equal(
      (await position.textContent()).trim(),
      "5 / 5",
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
