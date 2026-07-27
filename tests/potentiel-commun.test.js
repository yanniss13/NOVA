"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { loadApp, plain } = require("./helpers/load-app");

/* Ces constantes restent ici : elles servent aux tests qui chargent
   `armures-liees.js` et `data.js` directement, sans passer par le chargeur. */
const ROOT = path.resolve(__dirname, "..");
const STORAGE_KEY = "confrerie7ds.teams";

// Régression ciblée : la fiche provisoire du membre courant ne pollue pas l'Analyse.
{
  const { hooks } = loadApp();
  assert.strictEqual(typeof hooks.recPlayersForView, "function");
  const rows = [{ id:"user-2", owner:"user-2", name:"Merlin", dps:[] }];
  assert.deepStrictEqual(
    plain(hooks.recPlayersForView(rows, "user-1", "Yannis", true)),
    [
      { id:"user-1", owner:"user-1", name:"Yannis", dps:[], updatedAt:0 },
      { id:"user-2", owner:"user-2", name:"Merlin", dps:[] }
    ]
  );
  assert.deepStrictEqual(
    plain(hooks.recPlayersForView(rows, "user-1", "Yannis", false)),
    rows
  );
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
    fs.readFileSync(path.join(ROOT, "armures-liees.js"), "utf8"),
    armorContext,
    { filename:"armures-liees.js" }
  );
  const dataContext = { window:{} };
  vm.runInNewContext(
    fs.readFileSync(path.join(ROOT, "data.js"), "utf8"),
    dataContext,
    { filename:"data.js" }
  );
  const linked = armorContext.window.SEVEN_DS_ARMURES_LIEES;
  const files = Object.values(linked).flat();
  const localArmorFiles = dataContext.window.SEVEN_DS_DATA.armures["Armure liee"]
    .map(item => item.file);

  assert.strictEqual(Object.keys(linked).length, 24);
  assert.strictEqual(files.length, 66);
  assert.strictEqual(new Set(files).size, 66);
  assert.ok(Object.values(linked).every(items => [2, 3].includes(items.length)));
  assert.deepStrictEqual(
    plain([...files].sort()),
    plain([...localArmorFiles].sort())
  );
}

// Donnée générée réelle : 24 héros, exactement 3 types d'armes chacun.
{
  const actual = { window:{} };
  vm.runInNewContext(
    fs.readFileSync(path.join(ROOT, "potentiels.js"), "utf8"),
    actual,
    { filename:"potentiels.js" }
  );
  const actualPot = actual.window.SEVEN_DS_POTENTIELS;
  assert.strictEqual(Object.keys(actualPot).length, 24);
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

  const migrated = plain(hooks.normalizeTeam({
    id:"ancienne",
    pseudo:"Membre",
    heroes:[{
      char:"meliodas",
      potentiel:{ weaponType:"Hache", tier:7 }
    }]
  }));
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

// #5 Recensement auto : DPS dérivés du roster.
{
  const { hooks } = loadApp();

  // meliodas : Hache + Epée à une main = 2 builds Attaquant/Ténèbres -> dédup -> 1 DPS
  assert.deepStrictEqual(
    plain(hooks.dpsEntriesFromRoster({ charId:"meliodas", potentialTier:7,
      builds:{ Hache:{}, "Epee 1 main":{} } })),
    [{ char:"meliodas", element:"DARK", pot:7 }]
  );

  // merlin : Livre(Attaquant/Glace) est recensé, Bâton(Briseur/Feu) est exclu
  assert.deepStrictEqual(
    plain(hooks.dpsEntriesFromRoster({ charId:"merlin", potentialTier:9,
      builds:{ Livre:{}, Baton:{} } })),
    [{ char:"merlin", element:"ICE", pot:9 }]
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
    [{ char:"gowther", element:"THUNDER", pot:7 }]
  );
  assert.deepStrictEqual(
    plain(hooks.dpsEntriesFromRoster({ charId:"gowther", potentialTier:10,
      builds:{ Baguette:{} } })),
    [{ char:"gowther", element:"THUNDER", pot:10 }]
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

console.log("PASS potentiel commun");
