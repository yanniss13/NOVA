"use strict";

/* Chargeur `vm` partagé par les tests Node.
   Il lit le script principal inline de `index.html`, remplace la fin de son
   IIFE par une exposition explicite des fonctions internes, puis l'exécute dans
   un contexte isolé avec un DOM et un `localStorage` factices.
   Les hooks facultatifs sont gardés par `typeof` : un test peut ainsi tourner
   avant que la fonction visée n'existe, et échouer sur son absence plutôt que
   sur une ReferenceError du chargeur. */

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..", "..");
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

const HOOK_EXPORT = `Object.assign(globalThis.__hooks,{
  normalizePotentiel,
  normalizeHero,
  normalizeTeam,
  potentielDetailsOf,
  weaponTypesOf,
  isWeaponCompatible,
  compatibleWeaponGroups,
  linkedArmorsOf,
  isLinkedArmorCompatible,
  emptyRosterBuild,
  normalizeRosterBuild,
  normalizeRosterCharacter,
  favoriteRosterWeaponType,
  setFavoriteRosterBuild,
  copyFavoriteRosterBuild,
  rosterHeroSnapshot,
  cloudRosterFromRow,
  rosterToCloudRow,
  replaceRosterCacheForOwner,
  MemberRosterStore,
  Store,
  dpsEntriesFromRoster,
  recPlayersForView:typeof recPlayersForView === "function"
    ? recPlayersForView
    : undefined,
  dashboardDeadlineStatus:typeof dashboardDeadlineStatus === "function"
    ? dashboardDeadlineStatus
    : undefined,
  buildDashboardState:typeof buildDashboardState === "function"
    ? buildDashboardState
    : undefined,
  dashboardCacheKey:typeof dashboardCacheKey === "function"
    ? dashboardCacheKey
    : undefined,
  readDashboardCache:typeof readDashboardCache === "function"
    ? readDashboardCache
    : undefined,
  writeDashboardCache:typeof writeDashboardCache === "function"
    ? writeDashboardCache
    : undefined
});})();`;

function loadApp(initialTeams){
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1]);
  const source = scripts.find(script => script.includes("(function(){"));
  assert.ok(source, "Le script principal inline doit exister");

  const exposed = source.replace(/\}\)\(\);\s*$/, HOOK_EXPORT);
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
      },
      gowther:{
        Baguette:["Bonus baguette T1"],
        Livre:["Bonus livre T1"],
        Baton:["Bonus bâton T1"]
      }
    },
    SEVEN_DS_META:{
      meliodas:{ element:"DARK", role:"ATTACKER", rarity:"SSR", weapons:[
        { weapon:"Axe", role:"Attacker", element:"Dark" },
        { weapon:"Sword1h", role:"Attacker", element:"Dark" },
        { weapon:"SwordDual", role:"Attacker", element:"Dark" }
      ]},
      merlin:{ element:"ICE", role:"ATTACKER", rarity:"SSR", weapons:[
        { weapon:"Book", role:"Attacker", element:"Ice" },
        { weapon:"Wand", role:"Attacker", element:"Thunder" },
        { weapon:"Staff", role:"Buster", element:"Fire" }
      ]},
      gowther:{ element:"THUNDER", role:"ATTACKER", rarity:"SSR", weapons:[
        { weapon:"Wand", role:"Buster", element:"Thunder" },
        { weapon:"Book", role:"Supporter", element:"Default" },
        { weapon:"Staff", role:"Supporter", element:"Thunder" }
      ]}
    },
    SEVEN_DS_ARMURES_LIEES:{
      meliodas:[
        "7ds-armures-ssr/Armure liee/Défense simple.webp",
        "7ds-armures-ssr/Armure liee/Majesté bien malveillante.webp",
        "7ds-armures-ssr/Armure liee/Une nouvelle aventure.webp"
      ],
      merlin:[
        "7ds-armures-ssr/Armure liee/Chercheuse de savoir.webp",
        "7ds-armures-ssr/Armure liee/Le Sanglier de la Gourmandise.webp",
        "7ds-armures-ssr/Armure liee/Vêtements formels légers.webp"
      ]
    }
  };
  sandbox.window = sandbox;
  vm.runInNewContext(exposed, sandbox, { filename:"index.html" });
  return { hooks:sandbox.__hooks, localStorage };
}

function plain(value){
  return JSON.parse(JSON.stringify(value));
}

module.exports = { loadApp, plain };
