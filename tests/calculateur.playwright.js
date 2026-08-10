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

    /* L'essai d'enchantements reste une branche locale : il ouvre les deux
       editeurs du build sans exposer niveau, grade ou renforcement. */
    const essaiEnchantements = page.locator(".calc-essai-enchantements");
    await essaiEnchantements.waitFor();
    await page.getByRole("button", {
      name:"Essayer les enchantements de l'arme"
    }).click();
    await page.locator("#weaponConfigOverlay.on").waitFor();
    assert.equal(await page.locator("#weaponConfigOverlay .weapon-config-grade").count(), 0,
      "l'essai ne doit pas changer le grade de l'arme");
    assert.equal(await page.locator("#weaponConfigOverlay .weapon-config-level").count(), 0,
      "l'essai ne doit pas changer le niveau de l'arme");
    assert.ok(await page.locator(
      "#weaponConfigOverlay .weapon-enchantment, #weaponConfigOverlay .weapon-enchantment-slot"
    ).count() > 0, "l'essai d'arme doit garder ses enchantements");
    await page.getByRole("button", { name:"Annuler" }).click();

    await page.getByRole("button", {
      name:"Essayer les enchantements de l'armure gravée"
    }).click();
    await page.locator("#gearConfigOverlay.on").waitFor();
    assert.equal(await page.locator("#gearConfigOverlay .gear-config-level").count(), 0,
      "l'essai ne doit pas changer le niveau de l'armure gravée");
    assert.equal(await page.locator("#gearConfigOverlay .gear-config-reinforce").count(), 0,
      "l'essai ne doit pas changer son renforcement");
    assert.equal(await page.locator("#gearConfigOverlay .gear-config-passive").count(), 0,
      "l'essai ne doit pas changer son passif");
    assert.ok(await page.locator("#gearConfigOverlay [data-gear-slot]").count() > 0,
      "l'essai de gravure doit garder ses enchantements");
    await page.getByRole("button", { name:"Annuler" }).click();

    /* LES TROIS COLONNES. L'esperance est une ponderation des deux autres,
       donc elle reste toujours entre elles - mais leur ORDRE n'est pas acquis :
       quand les degats critiques du build passent sous la defense critique de
       la cible, le coup critique frappe plus faiblement que le coup normal et
       les deux bornes s'echangent. Akumu resiste a 50 %, ce n'est pas un cas
       theorique. */
    const ligne = page.locator(".calc-table tbody tr").first();
    const chiffres = (await ligne.locator(".calc-valeur").allTextContents())
      .map(t => Number(t.replace(/[^0-9]/g, "")));
    assert.equal(chiffres.length, 3, "trois colonnes par competence");
    assert.ok(chiffres.every(n => n > 0), "aucune colonne ne doit valoir zero");
    const [nonCrit, crit, esperance] = chiffres;
    assert.ok(
      Math.min(nonCrit, crit) <= esperance && esperance <= Math.max(nonCrit, crit),
      "l'esperance doit rester encadree par les deux bornes, recu : "
        + chiffres.join(", ")
    );

    /* L'essai conserve la reference dans chaque cellule et ne touche jamais
       l'equipe locale. Reinitialiser doit rendre les trois chiffres initiaux. */
    const teamsAvantEssai = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
    await page.getByRole("button", {
      name:"Essayer les enchantements de l'arme"
    }).click();
    const statEssai = page.locator(
      "#weaponConfigOverlay .weapon-config-enchantment-choice"
    ).first();
    const optionEssai = await statEssai.locator("option").evaluateAll(options =>
      options.map(option => option.value).find(value => value !== "none")
    );
    await statEssai.selectOption(optionEssai);
    const valeurEssai = page.locator(
      "#weaponConfigOverlay .weapon-config-enchantment-value"
    ).first();
    await valeurEssai.fill(await valeurEssai.getAttribute("max"));
    await page.getByRole("button", { name:"Valider la configuration" }).click();
    await page.locator(".calc-essai").first().waitFor();
    assert.match(await ligne.textContent(), /Essai.*[+−]/,
      "chaque valeur doit annoncer la reference, l'essai et son ecart");
    assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY),
      teamsAvantEssai, "un essai ne doit jamais ecrire l'equipe locale");
    await page.getByRole("button", { name:"Réinitialiser l'essai" }).click();
    await page.waitForFunction(() => !document.querySelector(".calc-essai"));
    const apresEssai = (await ligne.locator(".calc-valeur").allTextContents())
      .map(t => Number(t.replace(/[^0-9]/g, "")));
    assert.deepEqual(apresEssai, chiffres,
      "reinitialiser l'essai doit retrouver les valeurs de reference");

    await page.getByRole("button", {
      name:"Essayer les enchantements de l'armure gravée"
    }).click();
    const statGravure = page.locator(
      "#gearConfigOverlay .gear-config-enchantment-stat"
    ).first();
    const optionGravure = await statGravure.locator("option").evaluateAll(options =>
      options.map(option => option.value).find(value => value)
    );
    await statGravure.selectOption(optionGravure);
    const valeurGravure = page.locator(
      "#gearConfigOverlay .gear-config-enchantment-value"
    ).first();
    await valeurGravure.fill(await valeurGravure.getAttribute("max"));
    await page.getByRole("button", { name:"Valider la configuration" }).click();
    await page.locator(".calc-essai").first().waitFor();
    await page.getByRole("button", { name:"Réinitialiser l'essai" }).click();
    await page.waitForFunction(() => !document.querySelector(".calc-essai"));
    assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY),
      teamsAvantEssai, "un essai de gravure ne doit jamais ecrire l'equipe locale");

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

    /* LES EMPLACEMENTS DE COEQUIPIER. Localises par LIBELLE, jamais par
       index : un `.calc-champ` de plus decale tout reperage positionnel, et
       c'est exactement ce qui a casse ce fichier une fois deja.

       Ce parcours est celui d'une equipe LOCALE, sans compte - et le roster
       est lie au compte. Il n'y a donc rien a choisir ici, et c'est
       precisement ce qu'on verifie : les emplacements existent, ils sont
       vides, et la page DIT pourquoi au lieu de laisser trois listes muettes.

       Le filtrage lui-meme est couvert par tests/equipe-buffs.test.js, qui
       n'a besoin d'aucune session pour l'exercer. */
    const premierCoequipier = page
      .locator(".calc-champ", { hasText:"Coéquipier 1" }).locator("select");
    await premierCoequipier.waitFor();
    assert.equal(await premierCoequipier.inputValue(), "",
      "les emplacements doivent demarrer vides : aucun chiffre ne bouge tant "
        + "que le membre n'a rien touche");
    assert.equal(
      await page.locator(".calc-coequipier").count(), 3,
      "trois emplacements, le heros calcule occupant le quatrieme siege"
    );
    assert.match(
      await page.locator(".calc-coequipiers").textContent(),
      /Aucun build dans ton roster/,
      "sans roster, la page doit dire pourquoi aucun coequipier n'est proposable"
    );
    assert.ok(await premierCoequipier.isDisabled(),
      "un emplacement sans rien a proposer doit etre desactive");

    /* Sans coequipier retenu, tous les soutiens du catalogue restent
       proposes : c'est le comportement d'avant, et il ne doit pas bouger. */
    assert.ok(await page.locator(".calc-soutien").count() > 0,
      "sans coequipier, tous les soutiens du catalogue doivent etre proposes");

    /* Les buffs de soutien sont DECOCHES par defaut : le chiffre par defaut
       est celui du heros seul. */
    const cases = page.locator(".calc-buff input");
    assert.ok(await cases.count() > 0, "des buffs sans element doivent etre proposes");
    assert.equal(
      await page.locator(".calc-buff input:checked").count(), 0,
      "aucun buff coche par defaut"
    );

    /* Un soutien a cumuls ne peut pas etre tout ou rien : son selecteur part
       a zero, montre son apport reel, puis ne retient que les trois crans
       demandes. Le retour a zero rend le heros seul pour le test suivant. */
    const cumulDaisy = page.locator(".calc-soutiens .calc-cumul-ligne", {
      hasText:"Chances crit. +5 % par cumul, 4 cumuls"
    });
    const selecteurDaisy = cumulDaisy.locator("select");
    await selecteurDaisy.waitFor();
    assert.equal(await selecteurDaisy.inputValue(), "0",
      "un soutien a cumuls doit demarrer eteint");
    assert.match(await cumulDaisy.textContent(), /\/ 4 cumuls .*éteint/,
      "la ligne doit annoncer son etat reel, pas son plafond");
    await selecteurDaisy.selectOption("3");
    await page.waitForFunction(() => document.querySelector(".calc-soutiens .calc-cumul-ligne")
      .textContent.includes("+15 %"));
    assert.match(
      await page.locator(".calc-avertissement").allTextContents()
        .then(liste => liste.join(" ")),
      /Avec 1 ligne\(s\) active\(s\)/,
      "trois cumuls de soutien doivent compter comme une ligne active"
    );
    await selecteurDaisy.selectOption("0");
    await page.waitForFunction(() => document.querySelector(".calc-soutiens .calc-cumul-ligne")
      .textContent.includes("éteint"));

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
    /* « ligne(s) active(s) » et non « case(s) cochee(s) » : un passif de tenue
       a cumuls se REGLE au cran au lieu de se cocher, donc le compte ne peut
       plus parler de cases. */
    assert.match(
      await page.locator(".calc-avertissement").allTextContents()
        .then(liste => liste.join(" ")),
      /Avec 1 ligne\(s\) active\(s\)/,
      "l'en-tete doit annoncer le nombre de lignes actives"
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
    assert.match(
      await page.locator(".calc-essai-enchantements").innerText(),
      /masquer l.[ée]cart de l.essai/i,
      "une retouche doit avertir qu'elle peut masquer l'ecart de l'essai"
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

    /* LA CALIBRATION, bouclee de bout en bout par l'interface : on relit le
       coup non critique que la page vient d'afficher, on le saisit comme s'il
       venait du jeu, et la constante retrouvee doit etre celle qui a servi a
       le produire. Le seul ecart tolere vient de l'arrondi a l'affichage. */
    const calibration = page.locator(".calc-calibration");
    await calibration.waitFor();
    assert.match(await calibration.textContent(), /Valeur par défaut/,
      "sans mesure, le panneau doit dire qu'il ne predit pas encore");

    const chiffree = page.locator(".calc-table tbody tr:not(.calc-muette)").first();
    const nonCritAffiche = Number(
      (await chiffree.locator(".calc-valeur").first().textContent())
        .replace(/[^0-9]/g, "")
    );
    assert.ok(nonCritAffiche > 0, "il faut un coup non critique a saisir");

    const mesure = calibration.locator("input[type=number]");
    await mesure.fill(String(nonCritAffiche));
    await mesure.blur();
    await calibration.getByRole("button", { name:"Calibrer" }).click();
    await page.locator(".calc-calibration-message").waitFor();

    const message = await page.locator(".calc-calibration-message").textContent();
    const retrouvee = Number(message.replace(/[^0-9]/g, ""));
    assert.ok(Math.abs(retrouvee - 5600) <= 20,
      "la constante retrouvee doit etre celle qui a produit le chiffre, recu : "
        + message);
    assert.match(await calibration.textContent(), /Mesurée sur ce build/,
      "une fois calibree, le panneau doit le dire");

    /* Le refus : un coup CRITIQUE saisi par erreur donne des degats au-dela
       du possible. La page doit le dire plutot qu'enregistrer une constante
       fausse, qui fausserait ensuite chaque ligne sans plus se signaler. */
    await mesure.fill(String(nonCritAffiche * 10));
    await mesure.blur();
    await calibration.getByRole("button", { name:"Calibrer" }).click();
    await page.locator(".calc-calibration-message").waitFor();
    assert.match(
      await page.locator(".calc-calibration-message").textContent(),
      /dépassent/,
      "des degats impossibles doivent etre refuses"
    );

    /* Et la mesure s'oublie. */
    await page.getByRole("button", { name:"Oublier la mesure" }).click();
    await calibration.waitFor();
    assert.match(await calibration.textContent(), /Valeur par défaut/,
      "oublier la mesure doit rendre la constante par defaut");

    /* Les pourcentages s'affichent en POURCENTS et non en dix-milliemes : un
       membre a 30 % de taux critique doit lire 30, pas 3000. */
    /* Repere par son LIBELLE, pas par son rang : l'ordre des champs a deja
       change une fois — l'ajout du selecteur de cible — et un index decale
       faisait echouer ce test sur un champ qui n'avait rien a se reprocher. */
    const champTaux = page.locator(".calc-champ")
      .filter({ hasText:"Taux critique" })
      .locator("input[type=number]");
    const affiche = Number(await champTaux.inputValue());
    assert.ok(affiche >= 0 && affiche < 200,
      "le taux critique doit s'afficher en pourcent, lu : " + affiche);

    /* Et la saisie repart bien en dix-milliemes : a 0 % de critique,
       l'esperance rejoint exactement le coup non critique. Si la conversion
       manquait dans ce sens, le moteur lirait la valeur cent fois trop
       petite et l'ecart persisterait. */
    await champTaux.fill("0");
    await champTaux.blur();
    await page.locator(".calc-table tbody tr").first().waitFor();
    const aZeroCrit = (await page
      .locator(".calc-table tbody tr:not(.calc-muette)").first()
      .locator(".calc-valeur").allTextContents())
      .map(t => Number(t.replace(/[^0-9]/g, "")));
    assert.equal(aZeroCrit[2], aZeroCrit[0],
      "a 0 % de critique, l'esperance vaut le coup non critique, recu : "
        + aZeroCrit.join(", "));

    /* Les limites annoncees a l'ecran, pas releguees en commentaire. */
    const bas = await page.locator("#calculateurBody").textContent();
    assert.match(bas, /Non inclus dans le calcul/);
    assert.match(bas, /résistance au percement du boss/,
      "la page doit dire que la résistance au percement n'est pas appliquée");

    /* Le choix de la cible : vingt paliers d'Akumu, puis le mannequin. */
    const cible = page.locator(".calc-cible");
    assert.equal(await cible.locator("option").count(), 21);
    assert.equal(await cible.inputValue(), "akumu-1",
      "le palier 1 reste le defaut, pour ne deplacer aucun chiffre affiche");

    /* Le mannequin n'a ni defense ni resistance : les degats affiches valent
       exactement l'ATK multipliee par le coefficient, donc ils MONTENT quand
       on quitte un boss qui absorbe. Le verifier de bout en bout garantit que
       le choix atteint reellement le calcul, pas seulement l'affichage. */
    const avant = (await page
      .locator(".calc-table tbody tr:not(.calc-muette)").first()
      .locator(".calc-valeur").allTextContents())
      .map(t => Number(t.replace(/[^0-9]/g, "")));
    await cible.selectOption("mannequin");
    await page.locator(".calc-table tbody tr").first().waitFor();
    const surMannequin = (await page
      .locator(".calc-table tbody tr:not(.calc-muette)").first()
      .locator(".calc-valeur").allTextContents())
      .map(t => Number(t.replace(/[^0-9]/g, "")));
    assert.ok(surMannequin[0] > avant[0],
      "sur le mannequin, le coup non critique doit depasser celui du boss, recu : "
        + surMannequin.join(", ") + " contre " + avant.join(", "));

    const basMannequin = await page.locator("#calculateurBody").textContent();
    assert.match(basMannequin, /ne s'y calibre pas/,
      "la page doit dire que la constante C ne se calibre pas sans defense");

    /* La section des tenues gravees existe, et ses cases sont DECOCHEES : ces
       passifs sont presque tous conditionnels, donc rien ne s'applique sans un
       geste du membre. La fixture equipe Meliodas d'une tenue gravee reelle,
       choisie parmi celles que le catalogue connait. */
    const tenues = page.locator(".calc-tenues");
    await tenues.waitFor();
    assert.equal(await tenues.locator("input:checked").count(), 0,
      "aucun passif de tenue gravee coche par defaut");

    /* « TOUT COCHER » doit vraiment tout cocher. Une case qui n'en attraperait
       que quatre sur cinq serait pire que pas de case du tout : le membre
       croirait avoir tout declare, et le chiffre serait faux sans rien dire.

       On compte donc les cases AVANT et APRES, sur toute la page - et le
       chiffre doit bouger, sans quoi le test passerait sur une page vide. */
    const toutes = page.locator(
      ".calc-soutiens input, .calc-tenues input, .calc-potentiels input, "
        + ".calc-passifs-armes input, "
        + ".calc-supplements input"
    );
    const combien = await toutes.count();
    assert.ok(combien > 0, "la page doit proposer au moins une case a cocher");
    const cumulsSoutiens = page.locator(".calc-soutiens .calc-cumuls-choix");
    assert.ok(await cumulsSoutiens.count() > 0,
      "les soutiens a cumuls doivent proposer leur propre reglage");

    /* La case « tout cocher » ne doit PAS compter parmi les buffs : elle les
       commande. Si elle portait leur classe, « cocher le premier buff »
       cocherait la page entiere - c'est arrive, et c'est ce que ce controle
       empeche de reproduire. */
    assert.equal(await page.locator(".calc-tout-cocher .calc-buff").count(), 0,
      "la case « tout cocher » ne doit pas se presenter comme un buff");

    const pageNue = await page.locator("#calculateurBody").textContent();
    await page.locator(".calc-tout-cocher input").check();
    await page.waitForFunction(
      n => document.querySelectorAll(
        ".calc-soutiens input:checked, .calc-tenues input:checked, "
          + ".calc-potentiels input:checked, "
          + ".calc-passifs-armes input:checked, "
          + ".calc-supplements input:checked"
      ).length === n,
      combien
    );
    await page.waitForFunction(() => [...document.querySelectorAll(
      ".calc-soutiens .calc-cumuls-choix"
    )].every(select => Number(select.value) > 0));

    /* Et le CHIFFRE doit avoir bouge : cocher sans rien changer au tableau
       signalerait des buffs branches nulle part. */
    const pageBuffee = await page.locator("#calculateurBody").textContent();
    assert.notEqual(pageBuffee, pageNue,
      "tout cocher doit deplacer les degats affiches");

    /* Decochee, elle rend l'etat de depart - elle retire ce qu'elle a mis. */
    await page.locator(".calc-tout-cocher input").uncheck();
    await page.waitForFunction(() => document.querySelectorAll(
      ".calc-soutiens input:checked, .calc-tenues input:checked, "
        + ".calc-potentiels input:checked, "
        + ".calc-passifs-armes input:checked, "
        + ".calc-supplements input:checked"
    ).length === 0);
    await page.waitForFunction(() => [...document.querySelectorAll(
      ".calc-soutiens .calc-cumuls-choix"
    )].every(select => select.value === "0"));

    /* L'HABILLAGE. Les cinq sources de buffs sont des cartes titrees, comme
       partout ailleurs sur le site : c'etait le seul onglet a empiler des
       sections nues sous un <strong>. */
    for(const classe of [
      "calc-soutiens","calc-tenues","calc-potentiels","calc-passifs-armes",
      "calc-supplements"
    ]){
      const carte = page.locator("." + classe);
      assert.ok(
        await carte.evaluate(n => n.classList.contains("calc-carte")),
        classe + " doit porter la coque de carte"
      );
      assert.equal(await carte.locator("h3.calc-carte-titre").count(), 1,
        classe + " doit porter un titre h3, pas un <strong> nu");
      assert.equal(await carte.locator("> strong").count(), 0,
        classe + " ne doit plus avoir de <strong> de titre");
    }

    /* Cinq liseres DISTINCTS, tous sur l'axe dore : les sept teintes
       d'element sont deja prises, et le badge d'element du build est sur cette
       meme page. On lit la couleur calculee, pas la variable : elle resout les
       jetons et ne depend pas du navigateur. */
    const liseres = await page.evaluate(() => [
      "calc-soutiens","calc-tenues","calc-potentiels","calc-passifs-armes",
      "calc-supplements"
    ].map(c => getComputedStyle(
      document.querySelector("." + c)).borderTopColor));
    assert.equal(new Set(liseres).size, 5,
      "les cinq sources doivent avoir cinq liseres distincts, recu : "
        + liseres.join(" / "));

    /* La section des passifs d'arme EXISTE meme sur un build qui n'en a aucun.
       Une carte vide dit que la mecanique est connue, sans inventer un effet. */
    assert.match(
      await page.locator(".calc-passifs-armes").textContent(),
      /Aucun passif d'arme chiffré ne s'applique à ce build/,
      "un build sans passif d'arme doit le DIRE, pas laisser la carte nue"
    );

    /* La carte REMPLACE le separateur : les garder tous les deux poserait un
       filet a l'interieur du cadre. */
    assert.equal(
      await page.locator(".calc-soutiens")
        .evaluate(n => getComputedStyle(n).borderTopWidth),
      "2px",
      "le bord haut de la carte est le lisere, pas l'ancien separateur d'1px"
    );

    /* La calibration prend la coque mais JAMAIS le lisere : le degrade signifie
       « source de buff », et elle n'en est pas une. */
    assert.equal(
      await page.locator(".calc-calibration")
        .evaluate(n => getComputedStyle(n).borderTopWidth),
      "1px",
      "la calibration porte un bord neutre, pas le lisere de 2px"
    );

    /* « Tout cocher » n'est PAS une carte : elle commande les quatre sections,
       elle n'en est pas une cinquieme. */
    assert.equal(await page.locator(".calc-tout-cocher.calc-carte").count(), 0,
      "« tout cocher » doit rester l'en-tete des sections, pas une carte");

    /* LE PANNEAU DE RESULTAT. Le tableau reste un vrai <table> - les
       assertions plus haut le lisent en `tbody tr` -, il est seulement
       enveloppe. */
    const panneau = page.locator(".calc-resultat");
    assert.equal(await panneau.count(), 1, "un seul panneau de resultat");
    assert.equal(await panneau.locator("> .calc-resultat-titre").count(), 1,
      "le panneau porte un bandeau");
    assert.equal(await panneau.locator("> table.calc-table").count(), 1,
      "le tableau reste un <table>, enfant direct du panneau");
    assert.equal(
      (await panneau.locator(".calc-resultat-titre").textContent()).trim(),
      "Dégâts par compétence",
      "le bandeau annonce ce que le tableau contient"
    );

    /* Le bandeau ne doit PAS etre un `.calc-avertissement` : trois assertions
       plus haut comparent le texte complet de cette classe, et un texte de plus
       les ferait mentir. */
    assert.equal(
      await page.locator(".calc-resultat-titre.calc-avertissement").count(), 0,
      "le bandeau ne doit pas se presenter comme un avertissement"
    );

    /* NI TRI, NI VEDETTE. Seule `calc-muette` a le droit d'habiller une ligne :
       toute autre classe signalerait une mise en avant, explicitement hors
       perimetre. */
    const classesDeLigne = await page.evaluate(() =>
      [...document.querySelectorAll(".calc-table tbody tr")]
        .map(tr => tr.className.trim())
        .filter(c => c && c !== "calc-muette"));
    assert.deepEqual(classesDeLigne, [],
      "aucune ligne mise en avant : pas de tri, pas de vedette, recu : "
        + classesDeLigne.join(" / "));

    /* A 320 PX. La densite gagnee sur grand ecran ne doit pas se payer en
       largeur utile : la carte perd du rembourrage, pas le tableau sa
       lisibilite. */
    await page.setViewportSize({ width:320, height:720 });
    await page.locator(".calc-table tbody tr").first().waitFor();

    const debord = await page.evaluate(() =>
      document.documentElement.scrollWidth
        - document.documentElement.clientWidth);
    assert.ok(debord <= 1,
      "aucun debordement horizontal a 320 px, recu : " + debord + " px");

    /* La colonne Crit cede la place - regle deja en place, on verifie qu'elle
       survit au panneau. Non-crit et esperance suffisent a comparer. */
    assert.equal(
      await page.locator(".calc-table tbody tr").first()
        .locator(".calc-valeur:visible").count(),
      2,
      "sous 560 px, la colonne Crit est masquee"
    );

    /* La cible tactile reste a 44 px : c'est la regle du site, et une carte
       plus dense ne l'annule pas. */
    const hauteurCase = await page.locator(".calc-buff").first()
      .evaluate(n => n.getBoundingClientRect().height);
    assert.ok(hauteurCase >= 44,
      "une case a cocher reste a 44 px au doigt, recu : " + hauteurCase);

    /* Le rembourrage de carte se resserre, sans disparaitre. */
    const rembourrage = await page.locator(".calc-soutiens")
      .evaluate(n => parseFloat(getComputedStyle(n).paddingLeft));
    assert.ok(rembourrage > 0 && rembourrage < 14,
      "la carte se resserre sous 560 px sans coller au bord, recu : "
        + rembourrage);

    await page.setViewportSize({ width:1280, height:720 });

    assert.deepEqual(errors, [], "aucune erreur de page attendue");
  } finally {
    await browser.close();
    await server.close();
  }

  console.log("PASS Playwright: calculateur, trois colonnes, buffs et retouche");
})();
