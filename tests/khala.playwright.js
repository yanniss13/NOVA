"use strict";

/* Parcours visible de Khala : les catalogues n'ont de valeur que s'ils
   atteignent les écrans réellement utilisés par la confrérie. Le faux
   Supabase est le même que les autres parcours : il garde auth, lecture de
   roster et Realtime sur le contrat de production. */

const assert = require("node:assert/strict");
const { serveRepo } = require("./helpers/serve");
const { installFakeSupabase } = require("./helpers/faux-supabase");
const { chromium } = require("playwright");

const KHALA_WEAPONS = ["Epees doubles", "Nunchaku", "Gantelets"];

function seedKhala(page){
  return page.evaluate(types => {
    const weaponFor = type => {
      const weapons = window.SEVEN_DS_DATA.armes[type] || [];
      if(!weapons.length) throw new Error("FIXTURE_KHALA_WEAPON_MISSING:" + type);
      return weapons[0].file;
    };
    const builds = Object.fromEntries(types.map((type, index) => [type, {
      weapon:weaponFor(type),
      armor:index === 0
        ? { "Armure liee":window.SEVEN_DS_ARMURES_LIEES.khala[0] }
        : {},
      jewel:{},
      note:"Build Khala " + type,
      favorite:index === 0
    }]));
    const state = window.__fakeSupabaseState;
    state.roster_characters = state.roster_characters.filter(row =>
      !(row.owner === "user-1" && row.char_id === "khala")
    );
    state.roster_characters.push({
      owner:"user-1",
      char_id:"khala",
      potential_tier:7,
      builds,
      updated_at:"2026-09-17T08:00:00.000Z"
    });
    const ownTeam = state.teams.find(team => team.id === "team-own");
    if(!ownTeam) throw new Error("FIXTURE_KHALA_OWN_TEAM_MISSING");
    ownTeam.data.heroes = types.map(type => ({
      char:"khala",
      weapon:weaponFor(type),
      armor:{},
      jewel:{},
      potentiel:{ tier:7 }
    }));
    ownTeam.updated_at = "2026-09-17T08:00:00.000Z";
    window.__fakeSupabaseEmit("roster_characters", "INSERT");
    window.__fakeSupabaseEmit("teams", "UPDATE");
  }, KHALA_WEAPONS);
}

/* La connexion, à TOUTE largeur. Attendre `#accountPseudo` VISIBLE ne marche
   qu'au-dessus de 560 px : en portrait, le header devient compact et le compte
   déménage dans le panneau « Plus », donc l'élément existe, porte le bon
   pseudo, et reste masqué — l'attente expirait au bout de trente secondes sur
   un site parfaitement connecté.

   Le signal width-agnostique est l'état que `updateAccountUi()` publie
   lui-même : `#accountConnected` cesse d'être `hidden` quand la session
   existe. On vérifie les deux copies, desktop et mobile, pour que le panneau
   « Plus » ne puisse pas rester en retard sur le header. */
async function connect(page){
  await page.locator("#authOverlay").waitFor({ state:"visible" });
  await page.locator("#authEmail").fill("yannis@example.test");
  await page.locator("#authPassword").fill("mot-de-passe-test");
  await page.getByRole("button", { name:"Se connecter", exact:true }).click();
  await page.waitForFunction(() => {
    const desktop = document.querySelector("#accountConnected");
    const mobile = document.querySelector("#mobileAccountConnected");
    return desktop && mobile
      && desktop.hidden === false && mobile.hidden === false
      && document.querySelector("#accountPseudo").textContent === "Yannis"
      && document.querySelector("#mobileAccountPseudo").textContent === "Yannis";
  });
}

/* LE MEME ROSTER, MAIS MONTE DE PIED EN CAP.

   « Puissance par arme » ne chiffre rien tant qu'une pièce manque — c'est le
   même garde-fou que le calculateur, et c'est voulu. Pour éprouver la chaîne
   élémentaire, il faut donc un build complet sur chacune de ses trois armes.
   Toutes les pièces viennent des CATALOGUES : un chemin d'image écrit à la
   main se périmerait au premier renommage. */
function equiperKhala(page, types){
  return page.evaluate(types => {
    const catalog = window.SEVEN_DS_BUILD_STATS;
    const piece = slot => {
      const trouve = Object.entries(catalog.gearByFile)
        .find(([, def]) => def.setId === "equip_t5_greed" && def.slot === slot);
      if(!trouve) throw new Error("FIXTURE_KHALA_PIECE_MANQUANTE:" + slot);
      return trouve[0];
    };
    const reglage = fichier => {
      const def = catalog.gearByFile[fichier] || catalog.engravedByFile[fichier];
      if(!def) throw new Error("FIXTURE_KHALA_DEF_MANQUANTE:" + fichier);
      return {
        version:1,
        level:def.qualityMin,
        reinforce:0,
        enchantments:Array(
          def.randomOptions ? def.randomOptions.slots : 0
        ).fill(null),
        passiveLevel:null
      };
    };
    const armeDe = dossier => {
      for(const item of window.SEVEN_DS_DATA.armes[dossier] || []){
        const def = catalog.weaponsByFile[item.file];
        const grade = def && Object.values(def.gradesByGameId).find(valeur =>
          valeur.mainStatValues && valeur.promotionValues && valeur.enchantments
          && valeur.enchantments.type === "basic"
          && valeur.enchantments.slots.length > 0);
        if(grade) return { file:item.file, grade };
      }
      throw new Error("FIXTURE_KHALA_ARME_MANQUANTE:" + dossier);
    };
    const gravee = (window.SEVEN_DS_ARMURES_LIEES.khala || [])
      .find(fichier => catalog.engravedByFile[fichier]);
    if(!gravee) throw new Error("FIXTURE_KHALA_GRAVEE_MANQUANTE");

    const builds = Object.fromEntries(types.map((type, rang) => {
      const arme = armeDe(type);
      const armor = {
        Haut:piece("Top"), Bas:piece("Bottom"), Bottes:piece("Shoes"),
        Ceinture:piece("Belt"), "Armure liee":gravee
      };
      const jewel = {
        Anneau:piece("Ring"), Collier:piece("Necklace"),
        "Boucle d'oreille":piece("Earring")
      };
      return [type, {
        weapon:arme.file,
        weaponConfig:{
          version:1, gradeGameId:arme.grade.gameId, level:0,
          promotion:0, overlimit:0,
          enchantments:Array(arme.grade.enchantments.slots.length).fill(null)
        },
        armor,
        armorConfig:Object.fromEntries(Object.entries(armor)
          .map(([slot, fichier]) => [slot, reglage(fichier)])),
        jewel,
        jewelConfig:Object.fromEntries(Object.entries(jewel)
          .map(([slot, fichier]) => [slot, reglage(fichier)])),
        note:"Build Khala " + type,
        favorite:rang === 0
      }];
    }));

    const state = window.__fakeSupabaseState;
    const ligne = state.roster_characters.find(row =>
      row.owner === "user-1" && row.char_id === "khala");
    if(!ligne) throw new Error("FIXTURE_KHALA_ROSTER_ABSENT");
    ligne.builds = builds;
    ligne.updated_at = "2026-09-17T09:00:00.000Z";
    window.__fakeSupabaseEmit("roster_characters", "UPDATE");
  }, types);
}

/* ALLER AU ROSTER, à la largeur où l'on se trouve.

   Sous 560 px le rail d'onglets du header est masqué et remplacé par la barre
   du pouce : le bouton `.tab[data-view="member-roster"]` existe encore dans le
   DOM, mais avec une boîte de 0 × 0. Cliquer dessus attend indéfiniment un
   élément qui ne reviendra pas. « Roster » est justement l'une des cinq
   destinations stables de la barre mobile — on la prend, comme un membre au
   téléphone. */
async function allerAuRoster(page){
  const onglet = page.locator('.tab[data-view="member-roster"]');
  if(await onglet.isVisible()){
    await onglet.click();
    return;
  }
  const mobile = page.locator("#mobileNavRoster");
  await mobile.waitFor({ state:"visible" });
  await mobile.click();
  await page.locator("#view-member-roster").waitFor({ state:"visible" });
}

async function openKhalaDetail(page){
  await allerAuRoster(page);
  const card = page.locator("#memberRosterGrid .member-roster-card", {
    has:page.locator(".member-roster-name", { hasText:"Khala" })
  });
  await card.waitFor();
  await card.getByRole("button", { name:"Voir les builds", exact:true }).click();
  await page.locator("#rosterDetailOverlay").waitFor({ state:"visible" });
}

(async()=>{
  const server = await serveRepo();
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{ width:1440, height:1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  try{
    await installFakeSupabase(page);
    await page.goto(server.url + "/index.html");
    await connect(page);

    /* Builder : aucun chemin spécial Khala. Elle passe par le picker commun
       et le portrait vient de l'inventaire généré. */
    await page.locator("#tab-builder").click();
    await page.getByRole("button", { name:"Choisir manuellement" }).first().click();

    /* LE FILTRE DU PICKER la trouve comme n'importe qui d'autre. Le 27e héros
       n'est pas une exception de plus dans une liste : il entre par la
       recherche commune, et la grille se réduit à lui seul. */
    /* `.tile.none` est le « Aucun » qui vide l'emplacement : il n'est pas un
       personnage et ne doit pas se compter comme tel. */
    const tuilesDuPicker = () => page.locator("#pickerGrid .tile:not(.none)");
    const avantFiltre = await tuilesDuPicker().count();
    const heros = await page.evaluate(() =>
      (window.SEVEN_DS_DATA.personnages || []).length);
    assert.equal(avantFiltre, heros,
      "le picker doit proposer les " + heros + " personnages du catalogue");
    /* Aucun effectif écrit en dur : un 28e héros rendrait ce parcours rouge
       et bloquerait le déploiement sans que rien ne soit cassé. Ce qui compte
       ici, c'est que Khala FASSE PARTIE de l'inventaire régénéré et que le
       picker la propose parmi les autres. */
    assert.ok(
      await page.evaluate(() => (window.SEVEN_DS_DATA.personnages || [])
        .some(perso => perso.id === "khala"
          && perso.file === "7ds-personnages/khala.webp")),
      "l'inventaire régénéré doit porter Khala et son portrait local"
    );
    assert.equal(
      await page.locator('#pickerGrid .tile:not(.none)[title="Khala"]').count(), 1,
      "le picker doit proposer Khala parmi les " + heros + " personnages"
    );
    await page.locator("#pickerSearch").fill("khala");
    await page.waitForFunction(() =>
      document.querySelectorAll("#pickerGrid .tile:not(.none)").length === 1);
    assert.equal(
      await tuilesDuPicker().first().getAttribute("title"), "Khala",
      "la recherche du picker doit isoler Khala"
    );
    await page.locator('#pickerGrid .tile[title="Khala"]').click();
    assert.equal(
      await page.locator("#heroGrid .hero").first().locator(".portrait img")
        .getAttribute("src"),
      "7ds-personnages/khala.webp",
      "le builder doit afficher le portrait local de Khala"
    );

    await seedKhala(page);
    /* La comparaison DPS est volontairement masquée dans la PWA pendant sa
       finition ; le commutateur de test existant permet de vérifier son
       chargeur sans exposer cette ébauche aux membres. */
    await page.evaluate(() => { window.NOVA_AFFICHER_PUISSANCE_PAR_ARME = true; });

    /* Roster puis fiche : les trois builds sauvegardés sont consultables. */
    await openKhalaDetail(page);
    const weapons = page.locator("#rosterDetailBody .roster-detail-weapon");
    assert.deepEqual(
      (await weapons.evaluateAll(nodes => nodes.map(node => node.dataset.weaponType))).sort(),
      KHALA_WEAPONS.slice().sort(),
      "la fiche roster doit exposer les trois types d'arme de Khala"
    );
    assert.equal(
      await page.locator('#rosterDetailBody .roster-detail-weapon[aria-pressed="true"]')
        .getAttribute("data-weapon-type"),
      "Epees doubles",
      "le build favori ouvre la fiche roster"
    );
    await page.locator("#rosterDetailClose").click();
    await page.locator("#rosterDetailOverlay").waitFor({ state:"hidden" });

    /* Wiki : la recherche traverse bien le catalogue chargé à la demande. */
    await page.locator("#tab-wiki").click();
    await page.locator("#wikiSearch").fill("Khala");
    await page.waitForFunction(() =>
      document.querySelectorAll("#wikiGrid .wiki-tile").length === 1
    );
    assert.equal(
      await page.locator("#wikiGrid .wiki-tile").first().getAttribute("title"),
      "Khala",
      "le Wiki doit retrouver Khala seule"
    );

    /* Analyse : seules les épées doubles Attaquant comptent comme DPS, avec
       l'élément Vent de CE slot. Les deux builds Briseur restent hors matrice. */
    await page.locator('.tab[data-view="analyse"]').click();
    await page.locator('.analyse-subnav-button[data-analyse-section="dps"]').click();
    const khalaDps = page.locator('#analysePanel-dps .mx-action[data-char="khala"]');
    await khalaDps.waitFor();
    assert.deepEqual(
      await khalaDps.evaluateAll(nodes => nodes.map(node => node.dataset.elem)),
      ["WIND"],
      "l'Analyse doit retenir Khala Attaquant Vent, pas ses builds Briseur"
    );

    /* Collection : les trois gravures liées sont proposées sous leur libellé
       officiel, même si le chemin local est préfixé pour rester unique. */
    await page.locator("#tab-collection").click();
    await page.locator("#collectionFilterPossession").selectOption("tout");
    await page.locator("#collectionFilterUtiles").selectOption("oui");
    const khalaArmors = page.locator(
      '#collectionBody .wiki-tile[data-file*="/Khala"]'
    );
    await khalaArmors.first().waitFor();
    assert.equal(await khalaArmors.count(), 3,
      "la Collection doit proposer les trois armures liées de Khala");
    assert.deepEqual(
      await khalaArmors.locator(".wiki-tile-name").allTextContents(),
      ["Citoyenne modèle", "Préparation totale", "Tenue de travail ultralégère"],
      "la Collection doit afficher les libellés officiels sans leur préfixe local"
    );

    /* Calculateur : la fiche déclenche les deux catalogues DPS paresseux. */
    await openKhalaDetail(page);
    await page.getByRole("button", { name:"Calculer les dégâts", exact:true }).click();
    await page.locator("#view-calculateur").waitFor({ state:"visible" });
    await page.waitForFunction(() =>
      window.SEVEN_DS_COMPETENCES
      && window.SEVEN_DS_COMPETENCES.khala
      && window.SEVEN_DS_EFFETS_DPS
      && window.SEVEN_DS_EFFETS_DPS.heroes
      && window.SEVEN_DS_EFFETS_DPS.heroes.khala
    );
    assert.equal(
      await page.evaluate(() => window.SEVEN_DS_COMPETENCES.khala.length),
      15,
      "le calculateur doit charger les quinze compétences non passives de Khala"
    );
    assert.ok(
      await page.evaluate(() => Object.keys(window.SEVEN_DS_EFFETS_DPS.heroes.khala).length > 0),
      "le calculateur doit charger les effets DPS de Khala"
    );

    /* Rotation : trois instantanés Khala portent les quinze compétences non
       passives du catalogue. Les trois relèves restent déduites et les douze
       actions manuelles constituent donc la palette effectivement visible. */
    await page.locator("#tab-roster").click();
    await page.getByRole("button", { name:/Voir l'équipement de Yannis/ }).first()
      .click();
    await page.locator(".rota-lien").click();
    await page.locator("#rotationOverlay").waitFor({ state:"visible" });
    const rotation = page.locator("#rotationBody");
    await rotation.locator(".rota-palette-bouton").first().waitFor();
    assert.equal(
      await page.evaluate(() => window.SEVEN_DS_WIKI_COMPETENCES.khala
        .filter(skill => skill.categorie !== "PASSIVE").length),
      15,
      "la rotation doit connaître les quinze compétences non passives de Khala"
    );
    assert.equal(await rotation.locator(".rota-palette-bouton").count(), 12,
      "la palette expose les douze actions manuelles et déduit les trois relèves");
    /* On referme les deux modales empilées avant de changer d'onglet : tant
       qu'elles couvrent la page, le rail d'onglets n'est pas cliquable. */
    await page.locator("#rotationClose").click();
    await page.locator("#rotationOverlay").waitFor({ state:"hidden" });
    await page.locator("#teamClose").click();
    await page.locator("#teamOverlay").waitFor({ state:"hidden" });

    /* ================================================================
       LE BONUS DE VENT DE « CONTREFAÇON », DE BOUT EN BOUT.

       C'est la seule chose que les tâches précédentes n'ont pas pu éprouver
       hors navigateur. La chaîne compte trois maillons et chacun peut casser
       sans bruit :

         SEVEN_DS_META.khala.weapons  →  elementActif()  →  bonusElementaire

       `elementActif` lit l'élément du SLOT — « Wind » aux épées doubles — et
       le passe en minuscules. La règle du passif vise `element:wind`. Si les
       deux ne se rencontrent pas, `appliquerReglesStatiques` laisse la règle
       de côté, `ajouterBonus` ne la reconnaît pas davantage, et le bonus
       disparaît EN SILENCE : aucune erreur, juste un DPS trop bas que
       personne ne sait reconnaître.

       On ne compare donc pas un chiffre à une constante — un chiffre absolu
       dépendrait des catalogues et se périmerait. On éprouve DEUX propriétés
       que seule la chaîne entière peut produire :

         1. le DPS des épées doubles est AFFINE en la valeur de la règle
            (le bonus tombe dans le seau additif de facteursHorsConstante,
            qui multiplie tout le reste) ;
         2. il n'y est plus du tout sensible dès que META cesse de dire
            « Wind » pour ce slot.

       La 1 sans la 2 ne prouverait pas que l'élément vient de META ; la 2
       sans la 1 ne prouverait pas que le bonus arrive jusqu'aux dégâts. */
    await equiperKhala(page, KHALA_WEAPONS);

    const passifVent = await page.evaluate(() => {
      const branche = window.SEVEN_DS_EFFETS_DPS.heroes.khala.SwordDual;
      const passif = (branche.passives || {}).calla_sworddual_passive;
      if(!passif) throw new Error("FIXTURE_PASSIF_CONTREFACON_ABSENT");
      const regle = (passif.regles || []).find(r => r.cible === "element:wind");
      return {
        id:passif.id,
        classification:passif.classification,
        regle:regle || null,
        autresArmes:["Cudgel3c", "Gauntlets"].map(arme => {
          const autre = window.SEVEN_DS_EFFETS_DPS.heroes.khala[arme] || {};
          return Object.values(autre.passives || {}).some(entree =>
            (entree.regles || []).some(r => r.cible === "element:wind"));
        })
      };
    });
    assert.equal(passifVent.id, "hero-passive:calla_sworddual_passive",
      "le buff compté doit être celui du passif d'épées doubles de Khala");
    assert.equal(passifVent.classification, "modelise",
      "un effet non modélisé ne doit pas peser sur les dégâts");
    assert.ok(passifVent.regle, "la règle « element:wind » doit exister");
    assert.equal(passifVent.regle.valeur, 3000,
      "« Contrefaçon » vaut +30 % de dégâts de Vent, soit 3000 dix-millièmes");
    assert.equal(passifVent.regle.mode, "passif-max",
      "le buff est permanent : il se lit à son maximum, sans condition");
    assert.equal(passifVent.regle.portee, "Hero",
      "il ne vise que la porteuse, pas son équipe");
    assert.deepEqual(passifVent.autresArmes, [false, false],
      "aucune de ses deux autres armes ne porte ce bonus");

    /* Le DPS affiché, arme par arme, tel que le membre le lit. */
    const dpsParArme = async () => {
      await openKhalaDetail(page);
      await page.locator("#rosterDetailBody .hd-puissance .hd-puissance-ligne")
        .first().waitFor({ timeout:60000 });
      const lu = await page.evaluate(() => {
        const sortie = {};
        document.querySelectorAll("#rosterDetailBody .hd-puissance-ligne")
          .forEach(ligne => {
            const valeur = ligne.querySelector(".hd-puissance-valeur");
            /* Intl fr-FR sépare les milliers par une espace insécable
               étroite : on ne garde que les chiffres. */
            sortie[ligne.querySelector("strong").textContent] =
              Number(String(valeur.textContent).replace(/[^0-9]/g, ""));
          });
        return sortie;
      });
      await page.locator("#rosterDetailClose").click();
      await page.locator("#rosterDetailOverlay").waitFor({ state:"hidden" });
      return lu;
    };
    /* La valeur de la règle se règle DANS le catalogue chargé par la page :
       c'est exactement ce que la chaîne consomme, donc le seul point de
       poussée honnête. */
    const reglerBonus = valeur => page.evaluate(v => {
      const passif = window.SEVEN_DS_EFFETS_DPS.heroes.khala.SwordDual
        .passives.calla_sworddual_passive;
      const regle = passif.regles.find(r => r.cible === "element:wind");
      regle.valeur = v;
    }, valeur);

    const nominal = passifVent.regle.valeur;
    const auNominal = await dpsParArme();
    assert.deepEqual(
      Object.keys(auNominal).slice().sort(),
      KHALA_WEAPONS.slice().sort(),
      "la fiche doit chiffrer les trois armes de Khala"
    );
    await reglerBonus(0);
    const aZero = await dpsParArme();
    await reglerBonus(nominal * 2);
    await page.waitForTimeout(0);
    const auDouble = await dpsParArme();
    await reglerBonus(nominal);

    const doubles = etat => etat["Epees doubles"];
    assert.ok(doubles(aZero) > 0,
      "le build complet doit produire un DPS, reçu " + doubles(aZero));
    assert.ok(doubles(aZero) < doubles(auNominal),
      "+30 % de dégâts de Vent doivent FAIRE MONTER le DPS des épées doubles : "
        + doubles(aZero) + " puis " + doubles(auNominal));
    assert.ok(doubles(auNominal) < doubles(auDouble),
      "et +60 % doivent le faire monter davantage : " + doubles(auNominal)
        + " puis " + doubles(auDouble));
    /* L'AFFINITE. Le bonus rejoint un seau ADDITIF qui multiplie ensuite tout
       le reste : doubler la règle doit donc doubler l'écart, au dix-millième
       près. Un bonus qui arriverait par un autre chemin — une seconde
       comptabilisation, un plafond, un produit — briserait cette égalité.
       La tolérance d'une unité est celle de l'arrondi à l'affichage. */
    const premierPas = doubles(auNominal) - doubles(aZero);
    const secondPas = doubles(auDouble) - doubles(auNominal);
    assert.ok(Math.abs(premierPas - secondPas) <= 1,
      "le bonus élémentaire doit peser linéairement : +" + premierPas
        + " puis +" + secondPas);

    /* Les DEUX AUTRES ARMES ne bougent pas d'un point : le passif appartient
       au slot des épées doubles, et les gantelets ne sont même pas de Vent.
       Sans cette garde, un bonus versé au seau global passerait pour un bonus
       élémentaire. */
    for(const arme of KHALA_WEAPONS.filter(nom => nom !== "Epees doubles")){
      assert.equal(aZero[arme], auNominal[arme],
        arme + " ne doit pas dépendre du passif des épées doubles");
      assert.equal(auDouble[arme], auNominal[arme],
        arme + " ne doit pas dépendre du passif des épées doubles");
    }

    /* ET L'ELEMENT VIENT BIEN DE META. On débranche le Vent de CE slot — sans
       toucher ni au passif ni à l'équipement — et la règle cesse de mordre :
       le DPS des épées doubles devient insensible à sa valeur. C'est le
       maillon qu'aucun test hors navigateur ne pouvait éprouver.

       On mute le slot EN PLACE : `constantes.js` capture l'objet `META` au
       chargement du module, donc réaffecter `window.SEVEN_DS_META` ne serait
       vu de personne. */
    const elementDOrigine = await page.evaluate(() => {
      const slot = window.SEVEN_DS_META.khala.weapons
        .find(item => item.weapon === "SwordDual");
      const avant = slot.element;
      slot.element = "Fire";
      return avant;
    });
    assert.equal(elementDOrigine, "Wind",
      "le catalogue doit dire Khala de Vent aux épées doubles");
    await reglerBonus(0);
    const sansVentAZero = await dpsParArme();
    await reglerBonus(nominal * 2);
    const sansVentAuDouble = await dpsParArme();
    assert.equal(
      doubles(sansVentAZero), doubles(sansVentAuDouble),
      "sans le Vent au catalogue, la règle « element:wind » ne doit plus rien"
        + " ajouter : " + doubles(sansVentAZero) + " puis "
        + doubles(sansVentAuDouble)
    );
    /* Remise en état : la suite du parcours doit lire le vrai catalogue. */
    await page.evaluate(element => {
      window.SEVEN_DS_META.khala.weapons
        .find(item => item.weapon === "SwordDual").element = element;
    }, elementDOrigine);
    await reglerBonus(nominal);
    const retabli = await dpsParArme();
    assert.equal(doubles(retabli), doubles(auNominal),
      "le catalogue remis en place doit rendre le chiffre de départ");

    assert.deepEqual(errors, [], "aucune erreur de page attendue sur le parcours bureau");

    /* Mobile : le détail garde les trois armes atteignables exclusivement au
       clavier et ne crée aucun débordement horizontal à 390 px. */
    const mobileContext = await browser.newContext({ viewport:{ width:390, height:844 } });
    const mobile = await mobileContext.newPage();
    const mobileErrors = [];
    mobile.on("pageerror", error => mobileErrors.push(error.message));
    try{
      await installFakeSupabase(mobile);
      await mobile.goto(server.url + "/index.html");
      await connect(mobile);
      await seedKhala(mobile);

      /* L'HYPOTHESE DE `allerAuRoster`, posée noir sur blanc : sous 560 px le
         rail du header a disparu et c'est la barre du pouce qui mène au
         roster. tests/navigation-mobile.playwright.js garde le détail des
         cinq destinations ; on ne vérifie ici que ce dont ce parcours
         dépend. */
      assert.equal(await mobile.locator(".tabs-rail").isHidden(), true,
        "le rail d'onglets ne doit pas doubler la barre du pouce");
      assert.equal(await mobile.locator("#mobileNavRoster").isVisible(), true,
        "« Roster » doit rester atteignable au pouce");

      await openKhalaDetail(mobile);
      assert.ok(await mobile.evaluate(() =>
        document.documentElement.scrollWidth <= window.innerWidth
      ), "la fiche Khala ne doit pas déborder horizontalement à 390 px");

      /* ET A 320 PX, la largeur la plus étroite que le site tient. Une fiche
         à trois armes est le cas qui déborde en premier : c'est la rangée la
         plus large de la modale. */
      await mobile.setViewportSize({ width:320, height:720 });
      assert.ok(await mobile.evaluate(() =>
        document.documentElement.scrollWidth <= window.innerWidth
      ), "la fiche Khala ne doit pas déborder horizontalement à 320 px");
      /* Les cibles tactiles tiennent les 44 px, y compris sur la rangée
         d'armes : c'est elle que la largeur pousse à rétrécir. */
      const cibles = await mobile.locator(
        "#rosterDetailBody .roster-detail-weapon"
      ).evaluateAll(noeuds => noeuds.map(noeud => {
        const boite = noeud.getBoundingClientRect();
        return [Math.round(boite.width), Math.round(boite.height)];
      }));
      assert.equal(cibles.length, 3,
        "les trois armes doivent rester présentes à 320 px");
      cibles.forEach(([largeur, hauteur], rang) => {
        assert.ok(largeur >= 44 && hauteur >= 44,
          "l'arme n°" + (rang + 1) + " doit rester à 44 × 44 px au doigt, reçu "
            + largeur + " × " + hauteur);
      });
      await mobile.setViewportSize({ width:390, height:844 });

      const mobileWeapons = mobile.locator("#rosterDetailBody .roster-detail-weapon");
      assert.equal(await mobileWeapons.count(), 3,
        "les trois armes doivent rester présentes sur mobile");
      for(const target of KHALA_WEAPONS){
        await mobile.locator("#rosterDetailClose").focus();
        for(let tab = 0; tab < 20; tab++){
          if(await mobile.evaluate(type =>
            document.activeElement?.dataset.weaponType === type, target
          )) break;
          await mobile.keyboard.press("Tab");
        }
        assert.equal(await mobile.evaluate(() => document.activeElement?.dataset.weaponType), target,
          target + " doit être atteignable avec Tab");
        await mobile.keyboard.press("Enter");
        assert.equal(
          await mobile.locator('#rosterDetailBody .roster-detail-weapon[aria-pressed="true"]')
            .getAttribute("data-weapon-type"),
          target,
          target + " doit s'activer avec Entrée"
        );
      }
      await mobile.keyboard.press("Escape");
      await mobile.locator("#rosterDetailOverlay").waitFor({ state:"hidden" });
      assert.deepEqual(mobileErrors, [], "aucune erreur de page attendue sur mobile");
    } finally {
      await mobileContext.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }

  console.log("PASS Playwright: parcours Khala bureau et mobile");
})().catch(error=>{
  console.error(error);
  process.exitCode = 1;
});
