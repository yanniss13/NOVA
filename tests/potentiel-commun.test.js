"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const STORAGE_KEY = "confrerie7ds.teams";

class FakeElement {
  constructor(){
    this.children = [];
    this.dataset = {};
    this.events = {};
    this.files = [];
    this.style = {};
    this.value = "";
    this.textContent = "";
    this.innerHTML = "";
    this.className = "";
    const classes = new Set();
    this.classList = {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      toggle: (name, force) => {
        if(force === true) classes.add(name);
        else if(force === false) classes.delete(name);
        else if(classes.has(name)) classes.delete(name);
        else classes.add(name);
      },
      contains: name => classes.has(name)
    };
  }
  addEventListener(type, handler){ this.events[type] = handler; }
  appendChild(child){ this.children.push(child); return child; }
  click(){ if(this.events.click) this.events.click({ target:this }); }
  focus(){}
  remove(){}
  setAttribute(name, value){ this[name] = value; }
}

function makeDocument(){
  const nodes = new Map();
  const getNode = key => {
    if(!nodes.has(key)) nodes.set(key, new FakeElement());
    return nodes.get(key);
  };
  return {
    body:new FakeElement(),
    createElement:() => new FakeElement(),
    createTextNode:text => ({ textContent:String(text) }),
    addEventListener(){},
    getElementById:id => getNode("#"+id),
    querySelector:selector => getNode(selector),
    querySelectorAll:() => []
  };
}

function makeLocalStorage(initialTeams){
  const values = new Map();
  if(initialTeams !== undefined){
    values.set(STORAGE_KEY, JSON.stringify(initialTeams));
  }
  return {
    getItem:key => values.has(key) ? values.get(key) : null,
    removeItem:key => values.delete(key),
    setItem:(key, value) => values.set(key, String(value))
  };
}

function loadApp(initialTeams){
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1]);
  const source = scripts.find(script => script.includes("(function(){"));
  assert.ok(source, "Le script principal inline doit exister");

  const exposed = source.replace(
    /\}\)\(\);\s*$/,
    "Object.assign(globalThis.__hooks,{normalizePotentiel,normalizeHero,normalizeTeam,potentielDetailsOf,weaponTypesOf,isWeaponCompatible,compatibleWeaponGroups,Store});})();"
  );
  assert.notStrictEqual(exposed, source, "Le chargeur doit exposer les fonctions réelles");

  const document = makeDocument();
  const localStorage = makeLocalStorage(initialTeams);
  const sandbox = {
    __hooks:{},
    Blob:class {},
    FileReader:class {},
    URL:{ createObjectURL:() => "blob:test", revokeObjectURL(){} },
    clearTimeout(){},
    confirm:() => true,
    console,
    crypto:{ randomUUID:() => "test-uuid" },
    document,
    localStorage,
    setTimeout:() => 1,
    SEVEN_DS_DATA:{
      generatedAt:"",
      personnages:[
        { id:"meliodas", name:"Meliodas", file:"7ds-personnages/meliodas.webp" },
        { id:"merlin", name:"Merlin", file:"7ds-personnages/merlin.webp" }
      ],
      armes:{
        "Epee a une main":[
          { name:"Épée", file:"7ds-armes/Epee 1 main/epee.webp" }
        ],
        "Epees doubles":[
          { name:"Doubles", file:"7ds-armes/Epees doubles/doubles.webp" }
        ],
        Grimoire:[
          { name:"Livre", file:"7ds-armes/Livre/livre.webp" }
        ],
        Hache:[
          { name:"Hache", file:"7ds-armes/Hache/hache.webp" }
        ]
      },
      armures:{ Haut:[], Bas:[], Bottes:[], Ceinture:[], "Armure liee":[] },
      bijoux:{ Anneau:[], Collier:[], "Boucle d'oreille":[] }
    },
    SEVEN_DS_POTENTIELS:{
      meliodas:{
        Hache:["Bonus hache T1"],
        "Epee 1 main":["Bonus épée T1"],
        "Epees doubles":["Bonus doubles T1"]
      },
      merlin:{
        Livre:["Bonus livre T1"],
        Baton:["Bonus bâton T1"],
        Baguette:["Bonus baguette T1"]
      }
    }
  };
  sandbox.window = sandbox;
  vm.runInNewContext(exposed, sandbox, { filename:"index.html" });
  return { hooks:sandbox.__hooks, localStorage };
}

function plain(value){
  return JSON.parse(JSON.stringify(value));
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

console.log("PASS potentiel commun");
