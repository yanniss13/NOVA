"use strict";

/* Le lot 2 du wiki dans un vrai navigateur : les quatre catégories d'objets,
   leurs filtres et leurs fiches.

   Le parcours héros du lot 1 est couvert par `wiki.playwright.js`, qui doit
   rester inchangé : c'est lui la preuve de non-régression. */

const assert = require("node:assert/strict");
const { serveRepo } = require("./helpers/serve");
const { chromium } = require("playwright");

/* Relevé sur la version 2.0 du jeu, le 26 août 2026 : le Nunchaku de l'âme
   vorace porte les armes de 155 à 156, et la fournée de costumes les gravées
   de 83 à 93. Armures et bijoux ne bougent pas. */
const EFFECTIFS = {
  wikiCategoryArmes:156,
  wikiCategoryArmures:62,
  wikiCategoryBijoux:37,
  wikiCategoryGravees:93
};

(async()=>{
  const server = await serveRepo();
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{ width:1440, height:1000 } });
  const errors = [];
  const imagesRatees = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("response", reponse => {
    if(reponse.status() >= 400 && /\.webp$/.test(reponse.url())){
      imagesRatees.push(reponse.url());
    }
  });

  const tuiles = () => page.locator("#wikiGrid .wiki-tile");
  const attendreTuiles = nombre => page.waitForFunction(
    attendu => document.querySelectorAll("#wikiGrid .wiki-tile").length === attendu,
    nombre
  );

  try{
    await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*", route =>
      route.fulfill({ status:200, contentType:"application/javascript", body:"" })
    );
    await page.goto(server.url + "/index.html");
    await page.locator("#tab-wiki").click();
    await page.locator("#view-wiki").waitFor({ state:"visible" });
    await tuiles().first().waitFor();

    /* Chaque catégorie liste ce que le dépôt contient. Ces nombres sont le
       filet : une image ajoutée sans régénération, ou l'inverse, s'y voit. */
    for(const [bouton, attendu] of Object.entries(EFFECTIFS)){
      await page.locator("#" + bouton).click();
      await attendreTuiles(attendu);
      assert.equal(
        await page.locator("#" + bouton).getAttribute("aria-pressed"), "true",
        bouton + " doit être marquée active"
      );
    }

    /* Les filtres appartiennent à la catégorie : ceux du héros n'ont rien à
       faire sur la grille des armes. */
    await page.locator("#wikiCategoryArmes").click();
    await attendreTuiles(156);
    assert.equal(
      await page.locator("#wikiFilterElement").count(), 0,
      "le filtre élément est propre aux personnages"
    );
    assert.equal(
      await page.locator("#wikiFilters [data-filtre]").count(), 3,
      "la catégorie Armes a trois filtres"
    );

    // Le type d'arme, dérivé des données et nommé en français.
    const types = await page.locator("#wikiFilterWeaponType option")
      .evaluateAll(nodes => nodes.map(node => node.textContent));
    assert.ok(types.includes("Hache"), "le type Hache doit être proposé, reçu "
      + JSON.stringify(types));
    await page.locator("#wikiFilterWeaponType").selectOption({ label:"Hache" });
    await attendreTuiles(13);

    /* ⚠️ Les raretés ne doivent présenter AUCUN trou.

       Une arme monte de grade 1 à grade 3, ou n'existe qu'en grade 4 ou 5 —
       jamais les deux. Un filtre bâti sur la rareté MAXIMALE faisait donc
       disparaître « Grade 2 », qui n'est jamais un plafond : la liste affichait
       « Grade 1, Grade 3, Grade 4, Grade 5 » et un membre ne pouvait pas
       chercher les armes qui existent en grade 2. Le filtre porte sur toutes
       les raretés où l'arme existe. */
    await page.locator("#wikiFilterWeaponType").selectOption("");
    const grades = await page.locator("#wikiFilterWeaponGrade option")
      .evaluateAll(nodes => nodes.slice(1).map(node => node.textContent));
    const rangs = grades.map(texte => Number(texte.replace(/\D/g, "")));
    assert.deepEqual(
      rangs,
      rangs.map((_, index) => rangs[0] + index),
      "les raretés doivent se suivre sans trou, reçu " + JSON.stringify(grades)
    );
    // Grade 2 n'est le plafond d'aucune arme, mais 60 armes y existent.
    await page.locator("#wikiFilterWeaponGrade").selectOption({ label:"Grade 2" });
    await attendreTuiles(60);
    await page.locator("#wikiFilterWeaponGrade").selectOption("");
    await attendreTuiles(156);

    /* Le filtre passif : 95 armes sur 156 en portent un. Les 61 autres sont
       listées quand même — leur fiche ne doit simplement rien inventer. */
    await page.locator("#wikiFilterWeaponPassive").selectOption("oui");
    await attendreTuiles(95);
    await page.locator("#wikiFilterWeaponPassive").selectOption("non");
    await attendreTuiles(61);
    await page.locator("#wikiFilterWeaponPassive").selectOption("");
    await attendreTuiles(156);

    // La recherche par nom, et l'état vide annoncé plutôt que laissé nu.
    await page.locator("#wikiSearch").fill("zzzzz");
    await page.locator("#wikiEmpty").waitFor({ state:"visible" });
    assert.match(
      await page.locator("#wikiEmpty").textContent(), /arme/,
      "l'état vide doit parler de la catégorie affichée"
    );

    /* Changer de catégorie repart d'une recherche vierge : « zzzzz » ne
       désigne rien nulle part, et une grille vide sans cause visible est le
       pire des accueils. */
    await page.locator("#wikiCategoryArmures").click();
    await attendreTuiles(62);
    assert.equal(await page.locator("#wikiSearch").inputValue(), "");

    // Un ensemble d'armures, nommé en français par le catalogue.
    const ensembles = await page.locator("#wikiFilterArmorSet option")
      .evaluateAll(nodes => nodes.map(node => node.textContent));
    assert.ok(
      ensembles.length > 2 && ensembles.every(nom => !/^(armor|equip)_t/.test(nom)),
      "les ensembles doivent porter leur nom français, reçu "
        + JSON.stringify(ensembles)
    );
    const avantEnsemble = await tuiles().count();
    await page.locator("#wikiFilterArmorSet").selectOption({ index:1 });
    await page.waitForFunction(
      avant => {
        const compte = document.querySelectorAll("#wikiGrid .wiki-tile").length;
        return compte > 0 && compte < avant;
      },
      avantEnsemble
    );

    // Les bijoux ont leurs propres emplacements.
    await page.locator("#wikiCategoryBijoux").click();
    await attendreTuiles(37);
    const emplacements = await page.locator("#wikiFilterJewelSlot option")
      .evaluateAll(nodes => nodes.map(node => node.textContent));
    assert.ok(
      emplacements.includes("Anneau") && emplacements.includes("Collier"),
      "les emplacements de bijoux, reçu " + JSON.stringify(emplacements)
    );

    /* Les armures gravées se filtrent par héros : c'est leur seul axe, chacune
       étant liée à un personnage et un seul. */
    await page.locator("#wikiCategoryGravees").click();
    await attendreTuiles(93);
    await page.locator("#wikiFilterEngravedHero")
      .selectOption({ label:"Derieri" });
    await page.waitForFunction(
      () => {
        const compte = document.querySelectorAll("#wikiGrid .wiki-tile").length;
        return compte > 0 && compte < 93;
      }
    );

    /* ====================== Les fiches d'objet ====================== */

    // Une arme à passif : sept pastilles, ouvertes sur le niveau maximum.
    await page.locator("#wikiCategoryArmes").click();
    await attendreTuiles(156);
    await page.locator("#wikiFilterWeaponPassive").selectOption("oui");
    await attendreTuiles(95);
    await tuiles().first().click();
    await page.locator("#wikiItemOverlay.on").waitFor();

    const niveaux = page.locator("#wikiItemBody .wiki-level");
    assert.equal(await niveaux.count(), 7, "un passif d'arme a sept niveaux");
    assert.equal(
      await niveaux.nth(6).getAttribute("aria-pressed"), "true",
      "la fiche doit s'ouvrir sur le niveau maximum"
    );

    /* Le balisage couleur du jeu est rendu, pas affiché tel quel : c'est le
       contrat de renderBonus(). */
    const passifMax = await page.locator("#wikiItemBody .wiki-skill-desc")
      .first().textContent();
    assert.ok(passifMax.length > 0 && !passifMax.includes("[#"),
      "le balisage couleur doit être rendu, pas laissé brut");

    // Changer de niveau change le texte : ce sont les mêmes phrases, d'autres
    // chiffres.
    await niveaux.nth(0).click();
    await page.waitForFunction(
      avant => document.querySelector("#wikiItemBody .wiki-skill-desc")
        .textContent !== avant,
      passifMax
    );

    /* Les deux blocs repliables d'une arme tirent des données déjà chargées :
       aucun appel réseau n'est fait à l'ouverture d'une fiche. */
    assert.deepEqual(
      await page.locator("#wikiItemBody .wiki-fold > summary")
        .evaluateAll(nodes => nodes.map(node => node.textContent)),
      ["Statistiques par rareté", "Enchantements"]
    );

    // La navigation clavier passe à l'arme suivante, et repart de son maximum.
    const position = await page.locator("#wikiItemPosition").textContent();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(
      avant => document.querySelector("#wikiItemPosition").textContent !== avant,
      position
    );
    assert.equal(
      await page.locator("#wikiItemBody .wiki-level.active").getAttribute("aria-label"),
      "Niveau 7",
      "changer d'arme doit rouvrir sur le niveau maximum"
    );
    await page.locator("#wikiItemClose").click();
    await page.locator("#wikiItemOverlay.on").waitFor({ state:"detached" });

    /* Une arme SANS passif n'affiche pas de section vide : 61 armes sont dans
       ce cas, et une rubrique creuse laisserait croire à une donnée manquante
       plutôt qu'à une arme qui n'en a pas. */
    await page.locator("#wikiFilterWeaponPassive").selectOption("non");
    await attendreTuiles(61);
    await tuiles().first().click();
    await page.locator("#wikiItemOverlay.on").waitFor();
    assert.equal(await page.locator("#wikiItemBody .wiki-level").count(), 0);
    assert.equal(
      await page.locator("#wikiItemBody .wiki-section-label")
        .evaluateAll(nodes => nodes.filter(n => n.textContent === "Passif").length),
      0,
      "aucune section Passif pour une arme qui n'en a pas"
    );
    await page.locator("#wikiItemClose").click();
    await page.locator("#wikiItemOverlay.on").waitFor({ state:"detached" });

    /* LA TRANSCENDANCE SUR LA FICHE DE LA PIÈCE.

       C'est là qu'elle décide quelque chose : un membre qui ouvre une armure
       gravée se demande s'il doit la monter jusqu'au bout, et la
       transcendance ne tombe qu'au renforcement maximal.

       Tristan est le cas qui discrimine — QUATRE tenues gravées, mais TROIS
       transcendances. La quatrième ne doit afficher aucune section, comme une
       arme sans passif juste au-dessus : une rubrique creuse ferait croire à
       une donnée manquante. */
    await page.locator("#wikiCategoryGravees").click();
    await attendreTuiles(93);

    /* Le plafond des tenues gravées est +15. Les cinq premiers paliers
       utilisent la même progression que les armures ordinaires, puis les dix
       paliers de transcendance poursuivent jusqu'au multiplicateur x1,50.
       "Une nouvelle aventure" distingue le cas : ses valeurs brutes à
       qualité 130 sont 17 342 / 1 324 / 6 207 / 8,12 %, donc les afficher
       telles quelles prouve que le +15 a été ignoré. */
    await page.locator("#wikiFilterEngravedHero")
      .selectOption({ label:"Meliodas" });
    await page.locator("#wikiSearch").fill("Une nouvelle aventure");
    await attendreTuiles(1);
    await tuiles().first().click();
    await page.locator("#wikiItemOverlay.on").waitFor();
    /* La liste est qualifiée : la section « Transcendance » juste au-dessus
       porte elle aussi des `.wiki-stat-value` — les deux statistiques de ses
       paliers +5 et +10 — et un sélecteur nu lirait celles-là. */
    assert.deepEqual(
      await page.locator("#wikiItemBody .wiki-stats:not(.wiki-paliers) .wiki-stat-value")
        .evaluateAll(nodes => nodes.slice(0, 4)
          .map(node => node.textContent.replace(/\s/g, ""))),
      ["+26013", "+1986", "+9311", "+12,18%"],
      "les statistiques au maximum doivent appliquer le renforcement +15"
    );

    /* LES TROIS PALIERS DE LA TRANSCENDANCE.

       La fiche n'affichait que le passif du dernier palier. Les deux premiers
       rendent chacun une statistique, et un membre qui décide s'il monte la
       pièce doit les voir : ils tombent bien avant le passif. */
    const paliers = await page.locator("#wikiItemBody .wiki-paliers .wiki-stat")
      .evaluateAll(nodes => nodes.map(node => ({
        seuil:node.querySelector(".wiki-palier-seuil").textContent.trim(),
        nom:node.querySelector(".wiki-stat-name").textContent.trim(),
        valeur:node.querySelector(".wiki-stat-value").textContent.replace(/\s/g, "")
      })));
    assert.equal(paliers.length, 2,
      "deux statistiques avant le passif, reçu " + JSON.stringify(paliers));
    assert.deepEqual(paliers.map(item => item.seuil), ["+5", "+10"],
      "les deux premiers paliers se débloquent à +5 et +10");
    paliers.forEach(item => {
      assert.ok(item.nom.replace(item.seuil, "").trim().length > 2,
        "un palier sans libellé ne se lit pas : " + JSON.stringify(item));
      assert.ok(/\d/.test(item.valeur),
        "un palier sans valeur ne décide rien : " + JSON.stringify(item));
    });
    /* Et le passif porte le sien, +14 — pas le +15 que la fiche annonçait :
       +15 est le plafond que cette transcendance OUVRE, pas celui auquel elle
       se fait. Un membre qui lisait +15 attendait un palier hors d'atteinte. */
    assert.equal(
      (await page.locator("#wikiItemBody .wiki-transcendance-nom .wiki-palier-seuil")
        .textContent()).trim(),
      "+14",
      "le passif se débloque à la troisième transcendance, faite à +14"
    );
    await page.locator("#wikiItemClose").click();
    await page.locator("#wikiItemOverlay.on").waitFor({ state:"detached" });
    await page.locator("#wikiSearch").fill("");

    await page.locator("#wikiFilterEngravedHero").selectOption({ label:"Tristan" });
    await page.waitForFunction(() => {
      const compte = document.querySelectorAll("#wikiGrid .wiki-tile").length;
      return compte > 0 && compte < 93;
    });
    assert.equal(await tuiles().count(), 4, "Tristan a quatre tenues gravées");

    const transcendancesVues = [];
    for(let index = 0; index < 4; index++){
      await tuiles().nth(index).click();
      await page.locator("#wikiItemOverlay.on").waitFor();
      if(await page.locator("#wikiItemBody .wiki-transcendance-nom").count()){
        transcendancesVues.push(
          await page.locator("#wikiItemBody .wiki-gravee-arme").textContent()
        );
      }
      await page.locator("#wikiItemClose").click();
      await page.locator("#wikiItemOverlay.on").waitFor({ state:"detached" });
    }
    assert.equal(transcendancesVues.length, 3,
      "trois des quatre tenues de Tristan donnent une transcendance");
    /* Chaque transcendance vise une arme différente du héros : deux fois la
       même signalerait un rapprochement effondré en amont. */
    assert.equal(new Set(transcendancesVues).size, 3,
      "trois armes conseillées distinctes, reçu "
      + JSON.stringify(transcendancesVues));

    /* Une pièce d'ensemble : le nom de l'ensemble, sa prose, et ses pièces
       sœurs — y compris celles de l'autre grille. */
    await page.locator("#wikiCategoryArmures").click();
    await attendreTuiles(62);
    await page.locator("#wikiFilterArmorSet").selectOption({ index:1 });
    await page.waitForFunction(
      () => document.querySelectorAll("#wikiGrid .wiki-tile").length > 0
    );
    await tuiles().first().click();
    await page.locator("#wikiItemOverlay.on").waitFor();

    assert.ok(
      (await page.locator("#wikiItemBody .wiki-set-name").textContent()).length > 2,
      "l'ensemble doit être nommé"
    );
    assert.ok(
      await page.locator("#wikiItemBody .wiki-set-tier").count() >= 1,
      "l'ensemble doit annoncer au moins un palier"
    );
    /* Le seuil se lit dans les données : « 2 pièces » est un abus de langage,
       il vaut 3 dans une bonne moitié des ensembles. */
    assert.match(
      await page.locator("#wikiItemBody .wiki-set-count").first().textContent(),
      /^\d+ pièces?$/
    );
    const proses = await page.locator("#wikiItemBody .wiki-set-text")
      .evaluateAll(nodes => nodes.map(node => node.textContent));
    assert.ok(proses.length > 0, "un palier doit porter sa prose");
    assert.ok(proses.every(texte => !texte.includes("[#")),
      "la prose d'ensemble doit être rendue, pas laissée brute");

    const soeurs = page.locator("#wikiItemBody .wiki-set-piece");
    assert.ok(await soeurs.count() >= 2, "un ensemble a plusieurs pièces");
    assert.equal(
      await page.locator("#wikiItemBody .wiki-set-piece.active").count(), 1,
      "la pièce courante doit être marquée parmi ses sœurs"
    );

    // Cliquer une sœur ouvre sa fiche, sans quitter la modale.
    const titreAvant = await page.locator("#wikiItemTitle").textContent();
    await soeurs.locator(":not(.active)").first().click();
    await page.waitForFunction(
      avant => document.querySelector("#wikiItemTitle").textContent !== avant,
      titreAvant
    );
    await page.locator("#wikiItemClose").click();
    await page.locator("#wikiItemOverlay.on").waitFor({ state:"detached" });

    /* Une armure gravée : son héros, et le seul chemin qui mène d'un objet à
       un personnage. */
    await page.locator("#wikiCategoryGravees").click();
    await attendreTuiles(93);
    await page.locator("#wikiFilterEngravedHero").selectOption({ label:"Derieri" });
    await page.waitForFunction(
      () => document.querySelectorAll("#wikiGrid .wiki-tile").length > 0
    );
    await tuiles().first().click();
    await page.locator("#wikiItemOverlay.on").waitFor();

    assert.equal(
      await page.locator("#wikiItemBody .wiki-level").count(), 3,
      "un passif d'armure gravée a trois niveaux"
    );
    assert.equal(await page.locator("#wikiItemBody .wiki-set").count(), 0,
      "une armure gravée n'appartient à aucun ensemble");

    const versHeros = page.locator("#wikiItemBody .wiki-linked-hero");
    assert.equal(await versHeros.getAttribute("data-char"), "derieri");
    await versHeros.click();
    await page.locator("#wikiHeroOverlay.on").waitFor();
    assert.equal(await page.locator("#wikiHeroTitle").textContent(), "Derieri");
    /* La fiche de héros s'empile PAR-DESSUS : la fermer doit rendre la fiche
       d'objet, pas laisser le membre sur la grille. */
    await page.locator("#wikiHeroClose").click();
    await page.locator("#wikiHeroOverlay.on").waitFor({ state:"detached" });
    await page.locator("#wikiItemOverlay.on").waitFor();
    await page.locator("#wikiItemClose").click();
    await page.locator("#wikiItemOverlay.on").waitFor({ state:"detached" });

    /* Revenir aux personnages restaure les quatre filtres du lot 1, avec leurs
       identifiants d'origine. */
    await page.locator("#wikiCategoryHeros").click();
    await attendreTuiles(26);
    for(const id of ["wikiFilterElement", "wikiFilterWeapon",
                     "wikiFilterRole", "wikiFilterRarity"]){
      assert.equal(await page.locator("#" + id).count(), 1,
        "#" + id + " doit revenir avec la catégorie Personnages");
    }

    /* LES GRAVURES POSSIBLES SUR UN ECRAN DE TELEPHONE.

       Sur 390 px, « Augmentation des degats, competence de releve » et sa
       fourchette « +17,01 % -> +42,52 % » font 63 caracteres : ils ne peuvent
       pas partager une ligne. La valeur doit alors basculer ENTIERE sous le
       libelle, collee a droite. Avant, elle se coupait au milieu et laissait
       le « % » seul sur la ligne suivante.

       Les mesures comparent des coordonnees ENTRE ELLES, jamais une largeur en
       pixels : les polices du runner Linux sont plus larges qu'en local, et un
       seuil absolu passerait ici pour casser le deploiement. */
    await page.setViewportSize({ width:390, height:844 });
    await page.locator("#wikiCategoryGravees").click();
    await page.locator("#wikiFilterEngravedHero").selectOption({ label:"Meliodas" });
    await page.locator("#wikiSearch").fill("Une nouvelle aventure");
    await attendreTuiles(1);
    await tuiles().first().click();
    await page.locator("#wikiItemOverlay.on").waitFor();

    const replis = page.locator("#wikiItemBody .wiki-fold > summary");
    const rangGravures = (await replis.evaluateAll(n => n.map(x => x.textContent)))
      .indexOf("Gravures possibles");
    assert.notEqual(rangGravures, -1,
      "la fiche d'une tenue gravee doit offrir « Gravures possibles »");
    await replis.nth(rangGravures).click();

    const mesuresGravures = await page
      .locator("#wikiItemBody .wiki-fold[open] .wiki-stat")
      .evaluateAll(lignes => lignes.map(ligne => {
        const nom = ligne.querySelector(".wiki-stat-name");
        const valeur = ligne.querySelector(".wiki-stat-value");
        const cadreLigne = ligne.getBoundingClientRect();
        const cadreNom = nom.getBoundingClientRect();
        const cadreValeur = valeur.getBoundingClientRect();
        return {
          libelle:nom.textContent,
          texte:valeur.textContent,
          repliee:cadreValeur.top >= cadreNom.bottom - 1,
          ecartDroite:Math.abs(cadreLigne.right - cadreValeur.right),
          debordeAGauche:cadreLigne.left - cadreValeur.left
        };
      }));
    assert.ok(mesuresGravures.length > 0,
      "les gravures possibles doivent lister des stats");

    assert.deepEqual(mesuresGravures.filter(m => / %/.test(m.texte)), [],
      "une espace ordinaire devant le % laisserait le navigateur l'isoler");
    assert.deepEqual(mesuresGravures.filter(m => m.ecartDroite > 1.5), [],
      "chaque valeur doit rester alignee sur le bord droit de sa ligne");
    assert.deepEqual(mesuresGravures.filter(m => m.debordeAGauche > 1), [],
      "aucune valeur ne doit deborder de sa ligne");
    assert.ok(mesuresGravures.some(m => m.repliee),
      "sur 390 px, un libelle long doit renvoyer sa valeur a la ligne suivante");
    /* La ligne au libelle LE PLUS COURT est celle qui discrimine. Une assertion
       sur « au moins une ligne non repliee » ne prouvait rien : « Efficacite de
       Deluge de tous les elements » a une valeur courte et restait cote a cote
       meme avec un flex-basis forfaitaire, qui repliait pourtant « Defense
       crit. » a tort. */
    const plusCourte = mesuresGravures
      .reduce((a, b) => b.libelle.length < a.libelle.length ? b : a);
    assert.equal(plusCourte.repliee, false,
      "le libelle le plus court (« " + plusCourte.libelle + " ») doit garder sa "
      + "valeur sur la meme ligne, sinon le repli est un empilement systematique");

    await page.locator("#wikiItemClose").click();
    await page.locator("#wikiItemOverlay.on").waitFor({ state:"detached" });

    assert.deepEqual(errors, [], "aucune erreur de page attendue");
    assert.deepEqual(imagesRatees, [], "aucune image manquante attendue");
  } finally {
    await browser.close();
    await server.close();
  }

  console.log("PASS Playwright: wiki lot 2, catégories et filtres");
})();
