"use strict";

/* La rotation d'une equipe, dans un vrai navigateur.

   L'equipe est batie DEPUIS LES CATALOGUES plutot qu'ecrite en dur : une liste
   de fichiers ecrite a la main se perimerait au premier renommage d'image.
   Meme procede que tests/calculateur.playwright.js, dont ce bloc est repris.

   Ban est monte AUX GANTELETS, et ce n'est pas un detail : c'est la seule arme
   avec laquelle il lance une compétence combinée. Au nunchaku, la palette n'en
   proposerait aucune — ce que garde deja tests/rotation-equipe.test.js. */

const assert = require("node:assert/strict");
const { serveRepo } = require("./helpers/serve");
const { installFakeSupabase } = require("./helpers/faux-supabase");
const { chromium } = require("playwright");

const STORAGE_KEY = "confrerie7ds.teams";

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

    /* Le catalogue est PARESSEUX : 7491 lignes que ne doit pas payer un
       visiteur qui ne calcule rien. */
    assert.equal(
      await page.evaluate(() => typeof window.SEVEN_DS_COMPETENCES),
      "undefined",
      "le catalogue ne doit pas etre charge au demarrage"
    );

    /* Le catalogue chiffre est lui aussi charge a la demande. Le Builder est
       la premiere vue de ce parcours qui en a besoin. */
    await page.locator("#tab-builder").click();
    await page.waitForFunction(() =>
      Object.keys(window.SEVEN_DS_BUILD_STATS?.weaponsByFile || {}).length > 0
    );

    await page.evaluate(key => {
      const catalog = window.SEVEN_DS_BUILD_STATS;
      const souverainCupide = slot => {
        const match = Object.entries(catalog.gearByFile)
          .find(([, definition]) => definition.setId === "equip_t5_greed"
            && definition.slot === slot);
        if(!match) throw new Error("FIXTURE_GREED_SLOT_MISSING:"+slot);
        return match[0];
      };
      let weapon = null;
      let grade = null;
      for(const item of window.SEVEN_DS_DATA.armes.Gantelets){
        const definition = catalog.weaponsByFile[item.file];
        const candidate = definition
          && Object.values(definition.gradesByGameId).find(value =>
            value.mainStatValues
            && value.promotionValues
            && value.enchantments
            && value.enchantments.type === "basic"
            && value.enchantments.slots.length > 0
          );
        if(candidate){
          weapon = item.file;
          grade = candidate;
          break;
        }
      }
      if(!weapon || !grade) throw new Error("FIXTURE_WEAPON_GRADE_MISSING");

      const configFor = file => {
        const definition = catalog.gearByFile[file]
          || catalog.engravedByFile[file];
        if(!definition) throw new Error("FIXTURE_GEAR_MISSING:"+file);
        return {
          version:1,
          level:definition.qualityMin,
          reinforce:0,
          enchantments:Array(
            definition.randomOptions ? definition.randomOptions.slots : 0
          ).fill(null),
          passiveLevel:null
        };
      };
      const armor = {
        Haut:souverainCupide("Top"),
        Bas:souverainCupide("Bottom"),
        Bottes:souverainCupide("Shoes"),
        Ceinture:souverainCupide("Belt"),
        "Armure liee":(window.SEVEN_DS_ARMURES_LIEES.ban || [])
          .find(file => catalog.engravedByFile[file])
      };
      if(!armor["Armure liee"]) throw new Error("FIXTURE_ENGRAVING_MISSING");
      const jewel = {
        Anneau:souverainCupide("Ring"),
        Collier:souverainCupide("Necklace"),
        "Boucle d'oreille":souverainCupide("Earring")
      };
      localStorage.setItem(key, JSON.stringify([{
        id:"equipe-calculateur",
        pseudo:"Calculateur",
        heroes:[{
          char:"ban",
          weapon,
          weaponConfig:{
            version:1,
            gradeGameId:grade.gameId,
            level:0,
            promotion:0,
            overlimit:0,
            enchantments:Array(grade.enchantments.slots.length).fill(null)
          },
          armor,
          armorConfig:Object.fromEntries(
            Object.entries(armor).map(([slot, file]) => [slot, configFor(file)])
          ),
          jewel,
          jewelConfig:Object.fromEntries(
            Object.entries(jewel).map(([slot, file]) => [slot, configFor(file)])
          ),
          potentiel:{ tier:0 }
        },
        /* UN SECOND HEROS, monte a minima : la rotation n'a besoin que de son
           personnage et de son arme EQUIPEE. Il est la pour qu'une
           combinaison existe — Ban aux gantelets ne se combine pas tout seul.

           Tristan aux epees doubles est le partenaire verifie par
           tests/rotation-equipe.test.js, et la table porte les deux sens :
           Ban lance avec Tristan, et Tristan lance avec Ban. */
        {
          char:"tristan",
          weapon:Object.keys(catalog.weaponsByFile)
            .find(file => file.indexOf("/Epees doubles/") >= 0)
        }]
      }]));
    }, STORAGE_KEY);
    await page.reload();
    /* La modale de detail d'une equipe qu'on possede. La rotation n'y est PAS :
       cette modale porte deja quatre fiches de heros avec leur arme, leurs cinq
       pieces d'armure et leurs trois bijoux, et le membre l'a dit illisible au
       telephone. Il n'en reste qu'une rangee, qui ouvre la rotation par-dessus. */
    await page.locator('.tabs .tab[data-view="roster"]').click();
    await page.getByRole("button", { name:/Voir l.équipement/ }).first().click();
    const lien = page.locator(".rota-lien");
    await lien.waitFor();
    assert.equal(
      await page.locator("#teamDetail .rota-suite").count(), 0,
      "la rotation ne doit plus etre dessinee dans la modale d'equipe"
    );
    /* La rangee ne demande rien au reseau : le catalogue du wiki ne part qu'a
       l'ouverture de la rotation. */
    assert.equal(
      await page.evaluate(() => typeof window.SEVEN_DS_WIKI_COMPETENCES),
      "undefined",
      "ouvrir une equipe ne doit pas payer les 230 Ko du catalogue"
    );

    const ouvrirRota = async () => {
      await page.locator(".rota-lien").click();
      await page.locator("#rotationOverlay.on").waitFor();
      await page.locator("#rotationBody .rota-corps").waitFor();
    };
    await ouvrirRota();
    const rota = page.locator("#rotationBody");
    await rota.locator(".rota-palette-bouton").first().waitFor();

    /* Deux appuis sur la MEME competence font une case x2, pas deux cases.
       C'est la demande du membre : onze cases identiques ne se lisent pas. */
    const premiere = rota.locator(".rota-palette-bouton").first();
    await premiere.click();
    await premiere.click();
    assert.equal(
      await rota.locator(".rota-case").count(), 1,
      "deux appuis identiques font une seule case"
    );
    assert.equal(
      await rota.locator(".rota-fois").innerText(), "×2",
      "la case annonce sa serie"
    );

    /* Une seconde competence ouvre une seconde case. */
    await rota.locator(".rota-palette-bouton").nth(1).click();
    assert.equal(await rota.locator(".rota-case").count(), 2);

    /* Les fleches reordonnent — la voie sure, celle qui marche au clavier. */
    const avant = await rota.locator(".rota-case").first().getAttribute("title");
    await rota.locator(".rota-case").first()
      .locator('.rota-cmd[title="Déplacer vers la droite"]').click();
    const apres = await rota.locator(".rota-case").first().getAttribute("title");
    assert.notEqual(avant, apres, "la premiere case a change apres le deplacement");

    /* LE GLISSER. `mouse.move` de Playwright emet de vrais Pointer Events,
       donc le geste se teste pour de bon — pas seulement les fleches. */
    await rota.locator(".rota-palette-bouton").nth(2).click();
    assert.equal(await rota.locator(".rota-case").count(), 3);
    const tiree = await rota.locator(".rota-case").first().getAttribute("title");
    const source = await rota.locator(".rota-case").first().boundingBox();
    const destination = await rota.locator(".rota-case").last().boundingBox();
    /* On vise le HAUT de la case, pas son centre : les commandes occupent le
       bas, et un appui dessus n'ouvre pas un glisser — c'est voulu. */
    await page.mouse.move(source.x + source.width / 2, source.y + 10);
    await page.mouse.down();
    await page.mouse.move(
      destination.x + destination.width / 2, destination.y + 10,
      { steps:12 }
    );
    await page.mouse.up();
    assert.equal(
      await rota.locator(".rota-case").last().getAttribute("title"), tiree,
      "la case tiree doit finir la ou on l'a lachee"
    );

    /* LA COMBINAISON. Ban aux gantelets en a : la section existe. */
    assert.ok(
      await rota.locator(".rota-palette-combine").count() > 0,
      "Ban aux gantelets doit proposer au moins une combinaison"
    );

    /* Enregistrer, fermer, rouvrir : l'ordre a survecu. */
    const ordreAvant = await rota.locator(".rota-case").allTextContents();
    await page.getByRole("button", { name:"Enregistrer la rotation" }).click();
    await page.waitForFunction(() =>
      document.querySelector(".rota-barre .btn").disabled === true);
    await page.locator("#rotationClose").click();
    await page.locator("#teamClose").click();
    await page.getByRole("button", { name:/Voir l.équipement/ }).first().click();
    await ouvrirRota();
    await rota.locator(".rota-case").first().waitFor();
    assert.deepEqual(
      await rota.locator(".rota-case").allTextContents(), ordreAvant,
      "la rotation enregistree revient dans le meme ordre"
    );

    /* LA PLACE DE LA RANGEE DANS LA MODALE D'EQUIPE : en tete, avant les
       fiches. C'est le resume, les fiches sont le detail. */
    assert.equal(
      await page.evaluate(() => {
        const enfants = Array.from(document.querySelector("#teamDetail").children);
        return enfants.findIndex(n => n.classList.contains("rota-entree"))
          < enfants.findIndex(n => n.classList.contains("hdetail"));
      }),
      true,
      "la rangee de rotation doit preceder les fiches de heros"
    );
    /* Et elle dit le compte, sans ouvrir quoi que ce soit. */
    assert.match(
      await page.locator(".rota-lien-detail").innerText(),
      /\d+ appuis? posés/,
      "la rangee annonce le nombre d'appuis"
    );

    /* LA PALETTE EST REPLIEE quand il y a deja une rotation : c'est elle qui
       fait la hauteur du bloc, et on vient d'abord LIRE. */
    assert.equal(
      await rota.locator(".rota-palette").count(), 0,
      "la palette doit etre repliee sur une rotation deja composee"
    );
    const bascule = rota.locator(".rota-bascule");
    assert.equal(await bascule.count(), 1, "la bascule de palette doit exister");
    await bascule.click();
    assert.equal(
      await rota.locator(".rota-palette").count(), 1,
      "la bascule doit deplier la palette"
    );

    /* « Enregistrer » vient AVANT la palette : le bouton qui valide le travail
       ne doit pas etre le plus loin du doigt. */
    assert.equal(
      await page.evaluate(() => {
        const corps = document.querySelector(".rota-corps");
        const enfants = Array.from(corps.children);
        return enfants.findIndex(n => n.classList.contains("rota-barre"))
          < enfants.findIndex(n => n.classList.contains("rota-palette"));
      }),
      true,
      "la barre de commandes doit preceder la palette"
    );

    /* Les cibles tactiles restent conformes — les pastilles d'angle comprises,
       et elles debordent de la case : une croix rognee par le bord de la
       modale serait injouable au doigt. */
    for(const selecteur of [".rota-cmd", ".rota-retrait", ".rota-plus"]){
      const boite = await rota.locator(selecteur).first().boundingBox();
      assert.ok(
        boite.width >= 22 && boite.height >= 22,
        selecteur + " doit rester touchable, recu : "
          + boite.width + "×" + boite.height
      );
      assert.ok(boite.x >= 0, selecteur + " sort de l'ecran a gauche");
    }

    /* LE RETRAIT D'UNE CASE ENTIERE.

       Signale par le membre ainsi : « je peux pas supprimer les competences
       que je mets pour ma rota ». Le « moins » repondait — verifie au clic,
       au doigt et sur un ecran de telephone — mais il ne retire QU'UNE
       occurrence, et rien ne permettait de faire partir une serie « x11 »
       d'un geste. Ces deux assertions gardent la sortie. */
    const avantRetrait = await rota.locator(".rota-case").count();
    assert.ok(avantRetrait >= 2, "il faut au moins deux cases pour ce test");
    assert.equal(
      await rota.locator(".rota-retrait").count(), avantRetrait,
      "CHAQUE case porte sa croix, pas seulement les orphelines"
    );
    await rota.locator(".rota-retrait").first().click();
    assert.equal(
      await rota.locator(".rota-case").count(), avantRetrait - 1,
      "la croix retire la case entiere, occurrences comprises"
    );

    /* « Tout effacer » vide d'un geste, et « Annuler » ramene la rotation
       ENREGISTREE : effacer ne devient definitif qu'a l'enregistrement. */
    await page.getByRole("button", { name:"Tout effacer" }).click();
    assert.equal(
      await rota.locator(".rota-case").count(), 0,
      "« Tout effacer » vide la rotation"
    );
    await page.getByRole("button", { name:"Annuler" }).click();
    assert.deepEqual(
      await rota.locator(".rota-case").allTextContents(), ordreAvant,
      "« Annuler » ramene la rotation enregistree apres un effacement"
    );

    /* LA RELEVE SE DEDUIT DE LA JAUGE, pas du changement de heros.

       Le membre ne la pose pas — la palette ne la propose plus. Mais changer
       de heros ne suffit pas : il faut un point de releve, et un point coute
       1000 de jauge. */
    assert.equal(
      await rota.locator(".rota-releve").count(), 0,
      "une rotation d'un seul heros ne releve pas"
    );
    /* La deuxieme ligne de la palette est celle du second heros — Tristan. */
    const versTristan = rota.locator(".rota-palette-ligne").nth(1)
      .locator(".rota-palette-bouton").first();
    await versTristan.click();
    assert.equal(
      await rota.locator(".rota-releve").count(), 0,
      "sans point, le changement de heros se fait SANS attaque d'entree"
    );
    /* On remplit la jauge : le E de Ban aux gantelets vaut 181, six appuis
       passent les 1000. */
    const banE = rota.locator(".rota-palette-ligne").nth(0)
      .locator(".rota-palette-bouton").nth(1);
    for(let appui = 0; appui < 6; appui++) await banE.click();
    await versTristan.click();
    assert.equal(
      await rota.locator(".rota-releve").count(), 1,
      "la jauge remplie, le changement de heros releve"
    );
    /* Elle se tient JUSTE AVANT la case qui l'a provoquee. */
    assert.equal(
      await page.evaluate(() => {
        const suite = document.querySelector(".rota-suite");
        const enfants = Array.from(suite.children);
        const releve = enfants.findIndex(n => n.classList.contains("rota-releve"));
        return releve === enfants.length - 2;
      }),
      true,
      "la releve precede immediatement la case du heros entrant"
    );
    /* Elle ne porte AUCUNE commande : on ne deplace pas une consequence. */
    assert.equal(
      await rota.locator(".rota-releve button").count(), 0,
      "une releve deduite n'a ni croix ni fleches"
    );

    assert.deepEqual(errors, [], "aucune erreur de page attendue");

    /* ================================================================
       L'EQUIPE DE QUELQU'UN D'AUTRE.

       Tout ce qui precede se joue hors compte, ou tout est modifiable. Ce
       parcours-la manquait : connecte, sur l'equipe d'un autre membre, la
       rotation doit se LIRE et rien de plus. Il faut un vrai Supabase
       simule — `canManageTeam` compare le proprietaire de l'equipe a
       l'utilisateur en session, et sans session tout appartient a tout le
       monde.
       ================================================================ */
    const contexteLecture = await browser.newContext({
      viewport:{ width:1440, height:1000 }
    });
    const pageLecture = await contexteLecture.newPage();
    const erreursLecture = [];
    pageLecture.on("pageerror", erreur => erreursLecture.push(erreur.message));
    try{
      await installFakeSupabase(pageLecture);
      await pageLecture.goto(server.url + "/index.html");
      await pageLecture.locator("#authOverlay").waitFor({ state:"visible" });
      await pageLecture.locator("#authEmail").fill("yannis@example.test");
      await pageLecture.locator("#authPassword").fill("mot-de-passe-test");
      await pageLecture.getByRole("button", { name:"Se connecter", exact:true })
        .click();
      await pageLecture.locator("#accountPseudo")
        .getByText("Yannis", { exact:true }).waitFor();

      /* L'equipe de Merlin recoit deux heros et une rotation. Les armes
         viennent du catalogue, jamais d'un chemin ecrit a la main. */
      await pageLecture.locator("#tab-builder").click();
      await pageLecture.waitForFunction(() =>
        Object.keys(window.SEVEN_DS_BUILD_STATS?.weaponsByFile || {}).length > 0);
      await pageLecture.evaluate(() => {
        const catalogue = window.SEVEN_DS_BUILD_STATS;
        const gantelets = window.SEVEN_DS_DATA.armes.Gantelets
          .map(arme => arme.file).find(file => catalogue.weaponsByFile[file]);
        const epees = Object.keys(catalogue.weaponsByFile)
          .find(file => file.indexOf("/Epees doubles/") >= 0);
        if(!gantelets || !epees) throw new Error("FIXTURE_ARMES_MANQUANTES");
        const equipe = window.__fakeSupabaseState.teams
          .find(ligne => ligne.id === "team-other");
        equipe.data.name = "Boss de guilde";
        equipe.data.heroes = [
          { char:"ban", weapon:gantelets },
          { char:"tristan", weapon:epees }
        ];
        /* SIX E de Ban, et pas deux : a 181 de jauge chacun, il en faut six
           pour payer la releve de 1000 qui suit. Une rotation plus courte
           n'en montrerait aucune, et le test ne prouverait plus rien. */
        equipe.data.rotation = new Array(6).fill("ban_gauntlets_skill_e")
          .concat(["tristan_sworddual_skill_e", "ban_gauntlets_jumpatk"]);
        equipe.updated_at = new Date().toISOString();
      });
      await pageLecture.locator('.tabs .tab[data-view="roster"]').click();
      await pageLecture.evaluate(() =>
        window.__fakeSupabaseEmit("teams", "UPDATE"));

      const carteDeMerlin = pageLecture
        .getByRole("button", { name:/Voir l.équipement/ }).first();
      await carteDeMerlin.click();
      assert.match(
        await pageLecture.locator("#teamTitle").innerText(), /Merlin/,
        "on doit bien ouvrir l'equipe de l'autre membre"
      );

      /* La rangee mene a la rotation comme chez soi. */
      await pageLecture.locator(".rota-lien").click();
      await pageLecture.locator("#rotationOverlay.on").waitFor();
      const lecture = pageLecture.locator("#rotationBody");
      await lecture.locator(".rota-case").first().waitFor();

      assert.equal(await lecture.locator(".rota-case").count(), 3,
        "la rotation de l'autre membre se lit en entier");
      /* UNE seule releve : les six E payent un point, le passage a Tristan le
         depense, et le retour vers Ban n'a plus rien a depenser. */
      assert.equal(await lecture.locator(".rota-releve").count(), 1,
        "les releves se deduisent aussi chez les autres");
      /* LE POINT DUR : aucune prise. Ni croix, ni fleches, ni « + », ni
         palette, ni bouton d'enregistrement. */
      assert.equal(await lecture.locator("button").count(), 0,
        "une rotation qu'on ne possede pas n'offre aucun bouton");
      assert.equal(await lecture.locator(".rota-palette").count(), 0,
        "pas de palette sur l'equipe d'un autre");
      assert.equal(await lecture.locator(".rota-barre").count(), 0,
        "pas de barre d'enregistrement sur l'equipe d'un autre");
      /* Et pas de `touch-action:none` : la page doit defiler sous le doigt
         quand on ne fait que lire. */
      assert.equal(
        await lecture.locator(".rota-suite-edition").count(), 0,
        "la suite ne doit pas etre en mode edition"
      );

      /* CHEZ SOI, au contraire, la rangee invite a composer. */
      await pageLecture.locator("#rotationClose").click();
      await pageLecture.locator("#teamClose").click();
      await pageLecture.getByRole("button", { name:/Voir l.équipement/ })
        .nth(1).click();
      assert.match(
        await pageLecture.locator(".rota-lien-detail").innerText(),
        /Aucune rotation — compose la tienne/,
        "sur sa propre equipe vide, la rangee invite a composer"
      );

      assert.deepEqual(erreursLecture, [],
        "aucune erreur de page sur le parcours en lecture");
    } finally {
      await contexteLecture.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }

  console.log("PASS Playwright: rotation d'équipe, composition et relecture");
})();
