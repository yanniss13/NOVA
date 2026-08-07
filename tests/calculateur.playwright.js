"use strict";

/* Le calculateur de degats, dans un vrai navigateur.

   L'equipe est batie DEPUIS LES CATALOGUES plutot qu'ecrite en dur : le
   calcul n'accepte qu'un build complet - arme, cinq armures, trois bijoux,
   les neuf configurations valides - et une liste de fichiers ecrite a la main
   se perimerait au premier renommage d'image. Meme procede que
   tests/potentiel-commun.playwright.js, dont ce bloc est repris.

   Le parcours teste est celui d'une equipe LOCALE, sans compte : c'est le cas
   qui prouve que le lien de la fiche de heros ne mene pas a une impasse. */

const assert = require("node:assert/strict");
const { serveRepo } = require("./helpers/serve");
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

    await page.evaluate(key => {
      const catalog = window.SEVEN_DS_BUILD_STATS;
      const firstCatalogFile = (items, definitions) => {
        const match = (items || []).find(item => definitions[item.file]);
        if(!match) throw new Error("FIXTURE_EQUIPMENT_MISSING");
        return match.file;
      };
      let weapon = null;
      let grade = null;
      for(const item of window.SEVEN_DS_DATA.armes.Hache){
        const definition = catalog.weaponsByFile[item.file];
        const candidate = definition
          && Object.values(definition.gradesByGameId).find(value =>
            value.mainStatValues
            && value.promotionValues
            && value.enchantments
            && value.enchantments.type === "basic"
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
        Haut:firstCatalogFile(window.SEVEN_DS_DATA.armures.Haut, catalog.gearByFile),
        Bas:firstCatalogFile(window.SEVEN_DS_DATA.armures.Bas, catalog.gearByFile),
        Bottes:firstCatalogFile(window.SEVEN_DS_DATA.armures.Bottes, catalog.gearByFile),
        Ceinture:firstCatalogFile(window.SEVEN_DS_DATA.armures.Ceinture, catalog.gearByFile),
        "Armure liee":(window.SEVEN_DS_ARMURES_LIEES.meliodas || [])
          .find(file => catalog.engravedByFile[file])
      };
      if(!armor["Armure liee"]) throw new Error("FIXTURE_ENGRAVING_MISSING");
      const jewel = {
        Anneau:firstCatalogFile(window.SEVEN_DS_DATA.bijoux.Anneau, catalog.gearByFile),
        Collier:firstCatalogFile(window.SEVEN_DS_DATA.bijoux.Collier, catalog.gearByFile),
        "Boucle d'oreille":firstCatalogFile(
          window.SEVEN_DS_DATA.bijoux["Boucle d'oreille"], catalog.gearByFile
        )
      };
      localStorage.setItem(key, JSON.stringify([{
        id:"equipe-calculateur",
        pseudo:"Calculateur",
        heroes:[{
          char:"meliodas",
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
        }]
      }]));
    }, STORAGE_KEY);
    await page.reload();

    /* Depuis la fiche de heros d'une equipe locale. */
    await page.locator('.tab[data-view="roster"]').click();
    await page.getByRole("button", { name:/Voir l.équipement/ }).first().click();
    const lien = page.getByRole("button", { name:"Calculer les dégâts" }).first();
    await lien.waitFor({ state:"visible" });
    await lien.click();

    await page.locator("#view-calculateur").waitFor({ state:"visible" });
    await page.locator(".calc-table tbody tr").first().waitFor();

    /* La modale doit s'etre fermee : sans cela, la page s'afficherait
       DERRIERE elle et le document resterait fige. */
    assert.equal(
      await page.locator("#teamOverlay.on").count(), 0,
      "ouvrir le calculateur doit fermer la modale qui le recouvrait"
    );

    assert.equal(
      await page.evaluate(() => typeof window.SEVEN_DS_COMPETENCES),
      "object",
      "l'ouverture doit charger le catalogue"
    );

    /* LES TROIS COLONNES, et leur ordre : l'esperance est toujours encadree
       par le coup sans critique et le coup critique plein. */
    const ligne = page.locator(".calc-table tbody tr").first();
    const chiffres = (await ligne.locator(".calc-valeur").allTextContents())
      .map(t => Number(t.replace(/[^0-9]/g, "")));
    assert.equal(chiffres.length, 3, "trois colonnes par competence");
    assert.ok(chiffres.every(n => n > 0), "aucune colonne ne doit valoir zero");
    assert.ok(
      chiffres[0] <= chiffres[2] && chiffres[2] <= chiffres[1],
      "non-crit <= esperance <= crit, recu : " + chiffres.join(", ")
    );

    /* Une competence non chiffrable garde sa ligne et n'affiche JAMAIS un
       zero : la masquer ferait croire qu'elle n'existe pas. */
    const muettes = page.locator(".calc-table tbody tr.calc-muette");
    if(await muettes.count()){
      const texte = await muettes.first().textContent();
      assert.match(texte, /Non inclus dans le calcul/,
        "une competence non chiffrable porte la formule exacte");
      assert.doesNotMatch(texte, /\d/,
        "une competence non chiffrable ne doit afficher aucun chiffre");
    }

    /* Les buffs de soutien sont DECOCHES par defaut : le chiffre par defaut
       est celui du heros seul. */
    const cases = page.locator(".calc-buff input");
    assert.ok(await cases.count() > 0, "des buffs sans element doivent etre proposes");
    assert.equal(
      await page.locator(".calc-buff input:checked").count(), 0,
      "aucun buff coche par defaut"
    );

    /* Cocher un buff doit faire monter le chiffre, et le dire. */
    await cases.first().check();
    await page.locator(".calc-table tbody tr").first().waitFor();
    const apres = (await page.locator(".calc-table tbody tr").first()
      .locator(".calc-valeur").allTextContents())
      .map(t => Number(t.replace(/[^0-9]/g, "")));
    /* C'est l'ESPERANCE qu'on regarde, pas le coup sans critique : le premier
       buff propose augmente les degats critiques, donc il ne touche par
       construction pas la colonne non-crit. */
    assert.ok(apres[2] > chiffres[2],
      "un buff coche doit augmenter l'esperance, avant : " + chiffres.join(", ")
        + " apres : " + apres.join(", "));
    assert.match(
      await page.locator(".calc-avertissement").allTextContents()
        .then(liste => liste.join(" ")),
      /buff\(s\) d.équipe/,
      "l'en-tete doit annoncer le nombre de buffs actifs"
    );

    /* Retoucher une base doit se voir : le chiffre ne decrit alors plus le
       build enregistre. */
    const champ = page.locator(".calc-champ input[type=number]").first();
    await champ.fill("99999");
    await champ.blur();
    await page.locator(".calc-table tbody tr").first().waitFor();
    assert.match(
      await page.locator(".calc-avertissement").allTextContents()
        .then(liste => liste.join(" ")),
      /retouch/i,
      "une valeur retouchee doit etre annoncee"
    );

    /* Et « Reinitialiser » doit rendre le chiffre du build. */
    await page.getByRole("button", { name:"Réinitialiser" }).click();
    await page.locator(".calc-table tbody tr").first().waitFor();
    assert.doesNotMatch(
      await page.locator(".calc-avertissement").allTextContents()
        .then(liste => liste.join(" ")),
      /retouch/i,
      "reinitialiser doit retirer l'avertissement"
    );

    /* Les limites annoncees a l'ecran, pas releguees en commentaire. */
    const bas = await page.locator("#calculateurBody").textContent();
    assert.match(bas, /Non inclus dans le calcul/);
    assert.match(bas, /vingt niveaux de difficulté/,
      "la page doit dire que la cible n'a qu'un seul jeu de stats publie");

    assert.deepEqual(errors, [], "aucune erreur de page attendue");
  } finally {
    await browser.close();
    await server.close();
  }

  console.log("PASS Playwright: calculateur, trois colonnes, buffs et retouche");
})();
