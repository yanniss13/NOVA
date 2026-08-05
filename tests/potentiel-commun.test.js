"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
/* Balisage ET script : le JavaScript vit desormais dans js/. */
const { appSource } = require("./helpers/app-source");
const { loadApp, plain } = require("./helpers/load-app");

/* Ces constantes restent ici : elles servent aux tests qui chargent
   `armures-liees.js` et `data.js` directement, sans passer par le chargeur. */
const ROOT = path.resolve(__dirname, "..");
const STORAGE_KEY = "confrerie7ds.teams";

// Les saisies exclusivement entières doivent demander le pavé numérique mobile.
{
  const source = appSource();
  const { hooks } = loadApp();
  assert.strictEqual(
    typeof hooks.numericKeyboardInputProps,
    "function",
    "Le contrat des champs numériques doit être exposé aux tests"
  );
  assert.deepStrictEqual(
    plain(hooks.numericKeyboardInputProps({ class:"numeric-test", min:"0" })),
    {
      type:"number",
      inputmode:"numeric",
      pattern:"[0-9]*",
      class:"numeric-test",
      min:"0"
    }
  );
  assert.match(
    source,
    /<input id="bossScore"[^>]*inputmode="numeric"[^>]*pattern="\[0-9\]\*"/
  );
  assert.strictEqual(
    (source.match(/numericKeyboardInputProps\(\{/g) || []).length,
    5,
    "Les cinq créations de champs numériques dynamiques doivent partager le contrat"
  );
  assert.strictEqual(
    (source.match(/type:"number"/g) || []).length,
    1,
    "Le type number doit être centralisé dans numericKeyboardInputProps"
  );
}

// Le Recensement a disparu du frontend, mais son schéma et ses données restent.
{
  const source = appSource();
  [
    /tab-recensement/,
    /view-recensement/,
    /function\s+renderRecensement\s*\(/,
    /function\s+recPlayersForView\s*\(/,
    /function\s+saveCloudRecCache\s*\(/,
    /function\s+readRecCache\s*\(/,
    /\.from\(["']recensement["']\)/
  ].forEach(pattern => assert.doesNotMatch(source, pattern));
}

// Régression ciblée : une armure liée d'un autre héros est retirée à la migration.
{
  const { hooks } = loadApp();
  assert.deepStrictEqual(plain(hooks.linkedArmorsOf("meliodas")), [
    "7ds-armures-ssr/Armure liee/Défense simple.webp",
    "7ds-armures-ssr/Armure liee/Majesté bien malveillante.webp",
    "7ds-armures-ssr/Armure liee/Une nouvelle aventure.webp"
  ]);
  assert.strictEqual(
    hooks.isLinkedArmorCompatible(
      "meliodas",
      "7ds-armures-ssr/Armure liee/Une nouvelle aventure.webp"
    ),
    true
  );
  assert.strictEqual(
    hooks.isLinkedArmorCompatible(
      "meliodas",
      "7ds-armures-ssr/Armure liee/Chercheuse de savoir.webp"
    ),
    false
  );

  const normalized = plain(hooks.normalizeHero({
    char:"meliodas",
    armor:{
      Haut:"7ds-armures-ssr/Haut/universel.webp",
      "Armure liee":"7ds-armures-ssr/Armure liee/Chercheuse de savoir.webp"
    }
  }));
  assert.strictEqual(normalized.armor.Haut, "7ds-armures-ssr/Haut/universel.webp");
  assert.strictEqual(normalized.armor["Armure liee"], null);
}

// Régression ciblée : les identifiants inconnus ou hérités refusent l'armure liée.
{
  const { hooks } = loadApp();
  ["inconnu", "constructor", "__proto__"].forEach(charId => {
    assert.deepStrictEqual(plain(hooks.linkedArmorsOf(charId)), []);
    assert.strictEqual(
      hooks.isLinkedArmorCompatible(
        charId,
        "7ds-armures-ssr/Armure liee/Défense simple.webp"
      ),
      false
    );
  });

  const normalized = plain(hooks.normalizeHero({
    char:"__proto__",
    armor:{ "Armure liee":"7ds-armures-ssr/Armure liee/Défense simple.webp" }
  }));
  assert.strictEqual(normalized.armor["Armure liee"], null);
}

// Donnée générée réelle : chaque armure liée locale est attribuée une fois.
{
  const armorContext = { window:{} };
  vm.runInNewContext(
    fs.readFileSync(path.join(ROOT, "data", "armures-liees.js"), "utf8"),
    armorContext,
    { filename:"armures-liees.js" }
  );
  const dataContext = { window:{} };
  vm.runInNewContext(
    fs.readFileSync(path.join(ROOT, "data", "data.js"), "utf8"),
    dataContext,
    { filename:"data.js" }
  );
  const linked = armorContext.window.SEVEN_DS_ARMURES_LIEES;
  const files = Object.values(linked).flat();
  const localArmorFiles = dataContext.window.SEVEN_DS_DATA.armures["Armure liee"]
    .map(item => item.file);

  assert.strictEqual(Object.keys(linked).length, 25);
  assert.strictEqual(files.length, 68);
  assert.strictEqual(new Set(files).size, 68);
  assert.ok(Object.values(linked).every(items => [2, 3].includes(items.length)));
  assert.deepStrictEqual(
    plain([...files].sort()),
    plain([...localArmorFiles].sort())
  );
}

// Donnée générée réelle : 25 héros, exactement 3 types d'armes chacun.
{
  const actual = { window:{} };
  vm.runInNewContext(
    fs.readFileSync(path.join(ROOT, "data", "potentiels.js"), "utf8"),
    actual,
    { filename:"potentiels.js" }
  );
  const actualPot = actual.window.SEVEN_DS_POTENTIELS;
  assert.strictEqual(Object.keys(actualPot).length, 25);
  assert.ok(Object.values(actualPot).every(
    byWeapon => Object.keys(byWeapon).length === 3
  ));
}

// Régression ciblée : seuls les trois dossiers autorisés alimentent le picker.
{
  const { hooks } = loadApp();
  assert.deepStrictEqual(plain(hooks.weaponTypesOf("meliodas")).sort(), [
    "Epee 1 main", "Epees doubles", "Hache"
  ]);
  assert.strictEqual(
    hooks.isWeaponCompatible("meliodas", "7ds-armes/Hache/hache.webp"),
    true
  );
  assert.strictEqual(
    hooks.isWeaponCompatible("meliodas", "7ds-armes/Livre/livre.webp"),
    false
  );
  assert.strictEqual(hooks.isWeaponCompatible("meliodas", null), true);

  const groups = plain(hooks.compatibleWeaponGroups("meliodas"));
  assert.deepStrictEqual(Object.keys(groups).sort(), [
    "Epee a une main", "Epees doubles", "Hache"
  ]);
  assert.ok(Object.values(groups).flat().every(item =>
    ["Hache", "Epee 1 main", "Epees doubles"].includes(item.file.split("/")[1])
  ));
}

// Régression ciblée : retirer weaponType ne doit jamais perdre le palier existant.
{
  const { hooks } = loadApp();
  assert.deepStrictEqual(
    plain(hooks.normalizePotentiel({ weaponType:"Hache", tier:6 })),
    { tier:6 }
  );
  assert.deepStrictEqual(plain(hooks.normalizePotentiel({ tier:99 })), { tier:10 });
  assert.deepStrictEqual(plain(hooks.normalizePotentiel({ tier:-4 })), { tier:0 });

  /* Nom d'équipe : facultatif, coupé, borné à 40 caractères, et vide pour les
     équipes créées avant son existence. Aucune migration Supabase : le champ
     vit dans le jsonb de teams.data. */
  assert.strictEqual(
    plain(hooks.normalizeTeam({ name:"  Compo burst  " })).name,
    "Compo burst"
  );
  assert.strictEqual(plain(hooks.normalizeTeam({})).name, "");
  assert.strictEqual(plain(hooks.normalizeTeam({ name:null })).name, "");
  assert.strictEqual(plain(hooks.normalizeTeam({ name:42 })).name, "42");
  assert.strictEqual(
    plain(hooks.normalizeTeam({ name:"N".repeat(60) })).name.length,
    40
  );

  const migrated = plain(hooks.normalizeTeam({
    id:"ancienne",
    pseudo:"Membre",
    heroes:[{
      char:"meliodas",
      potentiel:{ weaponType:"Hache", tier:7 }
    }]
  }));
  assert.strictEqual(migrated.name, "", "Une ancienne équipe reste sans nom");
  assert.strictEqual(migrated.heroes.length, 4);
  assert.deepStrictEqual(migrated.heroes[0].potentiel, { tier:7 });
  assert.ok(!("weaponType" in migrated.heroes[0].potentiel));

  const incompatible = plain(hooks.normalizeTeam({
    heroes:[{
      char:"meliodas",
      weapon:"7ds-armes/Livre/livre.webp"
    }]
  }));
  assert.strictEqual(incompatible.heroes[0].weapon, null);

  const compatible = plain(hooks.normalizeTeam({
    heroes:[{
      char:"meliodas",
      weapon:"7ds-armes/Hache/hache.webp"
    }]
  }));
  assert.strictEqual(compatible.heroes[0].weapon, "7ds-armes/Hache/hache.webp");
}

// Régression ciblée : l'arme choisit les textes, jamais le palier du héros.
{
  const { hooks } = loadApp();
  const hero = {
    char:"meliodas",
    weapon:"7ds-armes/Hache/hache.webp",
    potentiel:{ tier:5 }
  };
  assert.deepStrictEqual(plain(hooks.potentielDetailsOf(hero)), {
    weaponType:"Hache",
    list:["Bonus hache T1"]
  });

  hero.weapon = "7ds-armes/Epee 1 main/epee.webp";
  assert.deepStrictEqual(plain(hooks.potentielDetailsOf(hero)), {
    weaponType:"Epee 1 main",
    list:["Bonus épée T1"]
  });
  assert.deepStrictEqual(hero.potentiel, { tier:5 });

  hero.weapon = null;
  assert.deepStrictEqual(plain(hooks.potentielDetailsOf(hero)), {
    weaponType:null,
    list:[]
  });
  assert.deepStrictEqual(hero.potentiel, { tier:5 });
}

// Régression ciblée : les frontières de stockage migrent aussi l'ancien format.
{
  const legacyTeams = [{
    id:"stockee",
    pseudo:"Membre",
    heroes:[{
      char:"meliodas",
      potentiel:{ weaponType:"Hache", tier:8 }
    }]
  }];
  const { hooks, localStorage } = loadApp(legacyTeams);
  const loaded = plain(hooks.Store.all());
  assert.deepStrictEqual(loaded[0].heroes[0].potentiel, { tier:8 });
  hooks.Store.save(loaded);
  assert.ok(!localStorage.getItem(STORAGE_KEY).includes("weaponType"));
}

// Roster : une seule fiche conserve le potentiel commun et les builds compatibles.
{
  const { hooks } = loadApp();
  const raw = {
    owner:"user-1",
    charId:"meliodas",
    potentialTier:7,
    builds:{
      Hache:{
        weapon:"7ds-armes/Hache/hache.webp",
        armor:{
          Haut:"7ds-armures-ssr/Haut/universel.webp",
          "Armure liee":"7ds-armures-ssr/Armure liee/Une nouvelle aventure.webp"
        },
        jewel:{ Anneau:"7ds-bijoux/Anneau/test.webp" },
        note:"Boss"
      },
      Livre:{ weapon:"7ds-armes/Livre/livre.webp" }
    }
  };
  const entry = plain(hooks.normalizeRosterCharacter(raw));
  assert.strictEqual(entry.potentialTier, 7);
  assert.deepStrictEqual(Object.keys(entry.builds), ["Hache"]);
  assert.strictEqual(entry.builds.Hache.weapon, "7ds-armes/Hache/hache.webp");
  assert.strictEqual(
    entry.builds.Hache.armor["Armure liee"],
    "7ds-armures-ssr/Armure liee/Une nouvelle aventure.webp"
  );

  const snapshot = plain(hooks.rosterHeroSnapshot(entry, "Hache"));
  assert.strictEqual(snapshot.char, "meliodas");
  assert.deepStrictEqual(snapshot.potentiel, { tier:7 });
  snapshot.note = "Copie modifiée";
  assert.strictEqual(entry.builds.Hache.note, "Boss");

  assert.strictEqual(hooks.normalizeRosterCharacter({ charId:"inconnu" }), null);
  assert.strictEqual(hooks.rosterHeroSnapshot(entry, "Livre"), null);
}

// Roster : migration du favori, unicité et résolution du build favori.
{
  const { hooks } = loadApp();
  const legacy = plain(hooks.normalizeRosterCharacter({
    owner:"user-1",
    charId:"meliodas",
    potentialTier:7,
    builds:{ Hache:{ note:"Ancien build" } }
  }));
  assert.equal(legacy.builds.Hache.favorite, false);
  assert.equal(hooks.favoriteRosterWeaponType(legacy), null);

  const duplicated = plain(hooks.normalizeRosterCharacter({
    owner:"user-1",
    charId:"meliodas",
    potentialTier:7,
    builds:{
      Hache:{ favorite:true },
      "Epee 1 main":{ favorite:true }
    }
  }));
  assert.equal(duplicated.builds.Hache.favorite, true);
  assert.equal(duplicated.builds["Epee 1 main"].favorite, false);
  assert.equal(hooks.favoriteRosterWeaponType(duplicated), "Hache");
}

// Roster : bascule du favori et copie indépendante vers un autre type d'arme.
{
  const { hooks } = loadApp();
  const original = {
    owner:"user-1",
    charId:"meliodas",
    potentialTier:8,
    builds:{
      Hache:{
        weapon:"7ds-armes/Hache/hache.webp",
        armor:{ Haut:"haut.webp" },
        jewel:{ Anneau:"anneau.webp" },
        note:"Favori",
        favorite:true
      },
      "Epee 1 main":{
        weapon:"7ds-armes/Epee 1 main/epee.webp",
        armor:{ Haut:"ancien.webp" },
        jewel:{ Anneau:"ancien-anneau.webp" },
        note:"Destination",
        favorite:false
      }
    }
  };

  const switched = plain(hooks.setFavoriteRosterBuild(
    original,
    "Epee 1 main"
  ));
  assert.equal(switched.builds.Hache.favorite, false);
  assert.equal(switched.builds["Epee 1 main"].favorite, true);
  assert.equal(hooks.favoriteRosterWeaponType(switched), "Epee 1 main");

  const removed = plain(hooks.setFavoriteRosterBuild(
    switched,
    "Epee 1 main"
  ));
  assert.equal(hooks.favoriteRosterWeaponType(removed), null);
  assert.equal(
    removed.builds["Epee 1 main"].weapon,
    "7ds-armes/Epee 1 main/epee.webp"
  );
  assert.equal(hooks.setFavoriteRosterBuild(original, "Epees doubles"), null);

  const copied = plain(hooks.copyFavoriteRosterBuild(
    original,
    "Epee 1 main"
  ));
  const source = copied.builds.Hache;
  const target = copied.builds["Epee 1 main"];
  assert.equal(target.weapon, "7ds-armes/Epee 1 main/epee.webp");
  assert.deepStrictEqual(target.armor, source.armor);
  assert.deepStrictEqual(target.jewel, source.jewel);
  assert.equal(target.note, "Favori");
  assert.equal(target.favorite, false);
  assert.equal(source.favorite, true);

  target.armor.Haut = "copie-modifiee.webp";
  target.jewel.Anneau = "copie-modifiee.webp";
  assert.equal(source.armor.Haut, "haut.webp");
  assert.equal(source.jewel.Anneau, "anneau.webp");

  const newTarget = plain(hooks.copyFavoriteRosterBuild(
    original,
    "Epees doubles"
  ));
  assert.equal(newTarget.builds["Epees doubles"].weapon, null);
  assert.equal(newTarget.builds["Epees doubles"].note, "Favori");

  assert.equal(hooks.copyFavoriteRosterBuild(original, "Hache"), null);
  assert.equal(hooks.copyFavoriteRosterBuild({
    charId:"meliodas",
    builds:{ Hache:{ favorite:false } }
  }, "Epee 1 main"), null);
}

// #5 Analyse : DPS dérivés du roster.
{
  const { hooks } = loadApp();

  // meliodas : Hache + Epée à une main = 2 builds Attaquant/Ténèbres -> agrégés en 1 ligne
  assert.deepStrictEqual(
    plain(hooks.dpsEntriesFromRoster({ charId:"meliodas", potentialTier:7,
      builds:{ Hache:{}, "Epee 1 main":{} } })),
    [{
      char:"meliodas", element:"DARK", pot:7,
      weaponTypes:["Axe", "Sword1h"], preferredWeaponType:"Sword1h"
    }]
  );

  // merlin : Livre(Attaquant/Glace) est recensé, Bâton(Briseur/Feu) est exclu
  assert.deepStrictEqual(
    plain(hooks.dpsEntriesFromRoster({ charId:"merlin", potentialTier:9,
      builds:{ Livre:{}, Baton:{} } })),
    [{
      char:"merlin", element:"ICE", pot:9,
      weaponTypes:["Book"], preferredWeaponType:"Book"
    }]
  );

  // Gowther : seule la Baguette Briseur est admise, à partir de P7.
  assert.deepStrictEqual(
    plain(hooks.dpsEntriesFromRoster({ charId:"gowther", potentialTier:6,
      builds:{ Baguette:{} } })),
    []
  );
  assert.deepStrictEqual(
    plain(hooks.dpsEntriesFromRoster({ charId:"gowther", potentialTier:7,
      builds:{ Baguette:{} } })),
    [{
      char:"gowther", element:"THUNDER", pot:7,
      weaponTypes:["Wand"], preferredWeaponType:"Wand"
    }]
  );
  assert.deepStrictEqual(
    plain(hooks.dpsEntriesFromRoster({ charId:"gowther", potentialTier:10,
      builds:{ Baguette:{} } })),
    [{
      char:"gowther", element:"THUNDER", pot:10,
      weaponTypes:["Wand"], preferredWeaponType:"Wand"
    }]
  );
  assert.deepStrictEqual(
    plain(hooks.dpsEntriesFromRoster({ charId:"gowther", potentialTier:9,
      builds:{ Livre:{}, Baton:{} } })),
    []
  );

  // perso inconnu ou builds vides -> aucun DPS
  assert.deepStrictEqual(plain(hooks.dpsEntriesFromRoster({ charId:"inconnu", builds:{ Hache:{} } })), []);
  assert.deepStrictEqual(plain(hooks.dpsEntriesFromRoster({ charId:"meliodas", builds:{} })), []);
}

// #5 bis Analyse : agrégation des builds DPS et exclusion des SR.
{
  const { hooks } = loadApp();

  function dpsFixture(charId, folders, tier){
    const builds = {};
    folders.forEach(folder => { builds[folder] = { weapon:"x.webp" }; });
    return { charId, potentialTier:tier || 0, builds };
  }

  function testDpsAggregatesWeaponTypes(hooks){
    // Meliodas SSR : trois builds DPS Ténèbres. Une seule ligne, trois armes.
    const entries = plain(hooks.dpsEntriesFromRoster(
      dpsFixture("meliodas", ["Epee 1 main", "Hache", "Epees doubles"], 7)
    ));
    const dark = entries.filter(e => e.element === "DARK");
    assert.strictEqual(dark.length, 1, "Une seule ligne par personnage et élément");
    assert.deepStrictEqual(
      dark[0].weaponTypes.slice().sort(),
      ["Axe", "Sword1h", "SwordDual"],
      "Aucun build DPS n'est perdu par la déduplication"
    );
  }

  function testDpsWeaponOrderIsStable(hooks){
    const forward = plain(hooks.dpsEntriesFromRoster(
      dpsFixture("meliodas", ["Epee 1 main", "Hache", "Epees doubles"], 7)
    ));
    const reversed = plain(hooks.dpsEntriesFromRoster(
      dpsFixture("meliodas", ["Epees doubles", "Hache", "Epee 1 main"], 7)
    ));
    assert.deepStrictEqual(
      forward.find(e => e.element === "DARK").weaponTypes,
      reversed.find(e => e.element === "DARK").weaponTypes,
      "L'ordre suit les slots du personnage, pas l'ordre de saisie"
    );
  }

  function testDpsExcludesSr(hooks){
    // `bug` est SR Attaquant avec deux builds Ténèbres : il ne doit rien produire.
    assert.deepStrictEqual(
      plain(hooks.dpsEntriesFromRoster(dpsFixture("bug", ["Hache", "Epees doubles"]))),
      [],
      "Un SR ne produit aucune entrée DPS, même avec des builds valides"
    );
    assert.ok(
      plain(hooks.dpsEntriesFromRoster(
        dpsFixture("meliodas", ["Hache"], 0)
      )).length > 0,
      "Un SSR équivalent reste présent"
    );
  }

  function testDpsPreferredWeapon(hooks){
    const entry = dpsFixture("meliodas", ["Hache", "Epee 1 main"], 7);
    assert.strictEqual(
      plain(hooks.dpsEntriesFromRoster(entry))
        .find(e => e.element === "DARK").preferredWeaponType,
      "Sword1h",
      "Sans favori, Meliodas ouvre Sword1h"
    );

    const favored = dpsFixture("meliodas", ["Hache", "Epee 1 main"], 7);
    favored.builds["Hache"].favorite = true;
    assert.strictEqual(
      plain(hooks.dpsEntriesFromRoster(favored))
        .find(e => e.element === "DARK").preferredWeaponType,
      "Axe",
      "Le favori prime sur la préférence Meliodas"
    );

    const noSword = dpsFixture("meliodas", ["Hache", "Epees doubles"], 7);
    const fallback = plain(hooks.dpsEntriesFromRoster(noSword))
      .find(e => e.element === "DARK");
    assert.strictEqual(
      fallback.preferredWeaponType,
      fallback.weaponTypes[0],
      "Sans Sword1h, repli stable sur le premier de weaponTypes"
    );
  }

  function testGowtherPotentialGate(hooks){
    const seven = plain(hooks.dpsEntriesFromRoster(dpsFixture("gowther", ["Baguette"], 7)));
    assert.deepStrictEqual(
      seven.length ? seven[0].weaponTypes : [],
      ["Wand"],
      "Gowther P7 ne porte que la Baguette"
    );
    assert.deepStrictEqual(
      plain(hooks.dpsEntriesFromRoster(dpsFixture("gowther", ["Baguette"], 6))),
      [],
      "Gowther P6 ne produit aucune entrée DPS"
    );
  }

  testDpsAggregatesWeaponTypes(hooks);
  testDpsWeaponOrderIsStable(hooks);
  testDpsExcludesSr(hooks);
  testDpsPreferredWeapon(hooks);
  testGowtherPotentialGate(hooks);
}

// Analyse : rosterPlayerFrom assemble un joueur sans jeter les personnages normalisés.
{
  const { hooks } = loadApp();
  assert.strictEqual(typeof hooks.rosterPlayerFrom, "function");

  // Personnage réellement normalisé (mêmes champs que cloudRosterFromRow),
  // pas un raccourci inventé : sinon le test ne prouve rien sur la modale.
  const character = hooks.normalizeRosterCharacter({
    owner:"owner-1",
    charId:"meliodas",
    potentialTier:7,
    builds:{ Hache:{ weapon:"7ds-armes/Hache/hache.webp" } }
  });
  const player = plain(hooks.rosterPlayerFrom("owner-1", "Yannis", [character]));

  assert.strictEqual(player.owner, "owner-1");
  assert.strictEqual(player.name, "Yannis");
  assert.ok(player.dps.length > 0, "Les entrées DPS restent calculées");
  assert.deepStrictEqual(
    player.characters.map(c => c.charId),
    ["meliodas"],
    "Les personnages normalisés sont conservés pour la modale"
  );
  assert.strictEqual(
    player.characters[0].builds.Hache.weapon,
    "7ds-armes/Hache/hache.webp",
    "Le détail du build normalisé reste disponible sans relecture réseau"
  );
}

// Roster partagé : conversion Supabase et cache isolé par propriétaire.
{
  const { hooks, localStorage } = loadApp();
  const row = {
    owner:"user-1",
    char_id:"meliodas",
    potential_tier:8,
    builds:{ Hache:{ weapon:"7ds-armes/Hache/hache.webp" } },
    updated_at:"2026-07-25T12:00:00.000Z"
  };
  const entry = plain(hooks.cloudRosterFromRow(row));
  assert.strictEqual(entry.charId, "meliodas");
  assert.strictEqual(entry.potentialTier, 8);

  hooks.replaceRosterCacheForOwner("user-2", [{
    owner:"user-2",
    charId:"merlin",
    potentialTier:4,
    builds:{}
  }]);
  hooks.replaceRosterCacheForOwner("user-1", [entry]);

  assert.strictEqual(plain(hooks.MemberRosterStore.all("user-1")).length, 1);
  assert.strictEqual(plain(hooks.MemberRosterStore.all("user-2")).length, 1);
  assert.match(
    localStorage.getItem("confrerie7ds.cloud.roster"),
    /"charId":"meliodas"/
  );
}

/* Sets d'armure déduits des données, jamais listés en dur. Le nom d'une pièce
   est le libellé de son emplacement suivi du nom du set, d'où le regroupement
   par plus long suffixe commun. */
{
  const { hooks } = loadApp();
  const armorSetsFrom = hooks.armorSetsFrom;
  assert.strictEqual(typeof armorSetsFrom, "function");

  const synthetic = plain(armorSetsFrom({
    Haut:[
      { name:"Haut du cristal de vie", file:"h/cristal.webp" },
      { name:"Haut de l'œil solitaire", file:"h/oeil.webp" }
    ],
    Bas:[{ name:"Bas du cristal de vie", file:"b/cristal.webp" }],
    Bottes:[{ name:"Bottes de combat du cristal de vie", file:"o/cristal.webp" }],
    Ceinture:[{ name:"Ceinture du cristal de vie", file:"c/cristal.webp" }]
  }));
  assert.strictEqual(synthetic.length, 1, "Une pièce orpheline ne forme pas un set");
  assert.strictEqual(synthetic[0].name, "Cristal de vie");
  assert.deepStrictEqual(synthetic[0].pieces, {
    Haut:"h/cristal.webp",
    Bas:"b/cristal.webp",
    Bottes:"o/cristal.webp",
    Ceinture:"c/cristal.webp"
  });

  // Un emplacement vide ne peut produire aucun set complet.
  assert.deepStrictEqual(plain(armorSetsFrom({ Haut:[], Bas:[], Bottes:[], Ceinture:[] })), []);
  assert.deepStrictEqual(plain(armorSetsFrom(null)), []);

  // Données générées réelles : 14 sets complets, chacun avec ses 4 fichiers.
  const dataContext = { window:{} };
  vm.runInNewContext(
    fs.readFileSync(path.join(ROOT, "data", "data.js"), "utf8"),
    dataContext,
    { filename:"data.js" }
  );
  const armures = dataContext.window.SEVEN_DS_DATA.armures;
  const realSets = plain(armorSetsFrom(armures));
  assert.strictEqual(realSets.length, 14, "14 sets complets attendus");
  const slots = ["Haut", "Bas", "Bottes", "Ceinture"];
  const filesBySlot = {};
  slots.forEach(slot => {
    filesBySlot[slot] = new Set(armures[slot].map(item => item.file));
  });
  realSets.forEach(set => {
    assert.ok(set.name && set.name === set.name.trim(), "Nom de set propre requis");
    slots.forEach(slot => {
      assert.ok(
        filesBySlot[slot].has(set.pieces[slot]),
        "La pièce "+slot+" du set "+set.name+" doit exister dans son emplacement"
      );
    });
  });
  // Aucun doublon de nom, et un tri français stable.
  assert.strictEqual(new Set(realSets.map(s => s.name)).size, 14);
  assert.deepStrictEqual(
    realSets.map(s => s.name),
    [...realSets.map(s => s.name)].sort((a, b) => a.localeCompare(b, "fr-FR"))
  );

  /* Les bijoux suivent la même convention que les armures. Une note entre
     parenthèses en fin de nom n'appartient pas à l'identité du set : sans ce
     nettoyage, « des 100 jours (jamais porté) » et « (jamais portées) » ne se
     rejoignent pas, l'accord du participe cassant le suffixe commun. */
  const jewelSetsFrom = hooks.jewelSetsFrom;
  assert.strictEqual(typeof jewelSetsFrom, "function");

  const syntheticJewels = plain(jewelSetsFrom({
    Anneau:[
      { name:"Anneau des 100 jours (jamais porté)", file:"a/100.webp" },
      { name:"Anneau du serment solitaire", file:"a/serment.webp" }
    ],
    Collier:[{ name:"Collier des 100 jours (jamais porté)", file:"c/100.webp" }],
    "Boucle d'oreille":[
      { name:"Boucles d'oreilles des 100 jours (jamais portées)", file:"b/100.webp" }
    ]
  }));
  assert.strictEqual(syntheticJewels.length, 1, "L'anneau orphelin ne forme pas un set");
  assert.strictEqual(syntheticJewels[0].name, "100 jours");
  assert.deepStrictEqual(syntheticJewels[0].pieces, {
    Anneau:"a/100.webp",
    Collier:"c/100.webp",
    "Boucle d'oreille":"b/100.webp"
  });

  const realJewelSets = plain(jewelSetsFrom(dataContext.window.SEVEN_DS_DATA.bijoux));
  assert.strictEqual(realJewelSets.length, 11, "11 sets de bijoux attendus");
  const jewelSlots = ["Anneau", "Collier", "Boucle d'oreille"];
  const jewelFiles = {};
  jewelSlots.forEach(slot => {
    jewelFiles[slot] = new Set(
      dataContext.window.SEVEN_DS_DATA.bijoux[slot].map(item => item.file)
    );
  });
  realJewelSets.forEach(set => {
    jewelSlots.forEach(slot => {
      assert.ok(
        jewelFiles[slot].has(set.pieces[slot]),
        "La pièce "+slot+" du set "+set.name+" doit exister dans son emplacement"
      );
    });
  });
  assert.ok(
    realJewelSets.some(set => set.name === "100 jours"),
    "Le set « 100 jours » ne doit pas être perdu à cause de l'accord au pluriel"
  );
  assert.strictEqual(new Set(realJewelSets.map(s => s.name)).size, 11);
}

console.log("PASS potentiel commun");
