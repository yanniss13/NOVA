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

const { MODULES } = require("./modules");

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
  /* Le faux DOM ne construit pas d'arbre interrogeable : une recherche rend
     toujours une liste vide, ce qui suffit aux tests de logique pure et évite
     que le chargement du script échoue sur une méthode absente. */
  querySelector(){ return null; }
  querySelectorAll(){ return []; }
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
    createElement:tag => {
      const node = new FakeElement();
      node.tag = String(tag);
      return node;
    },
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
  degatsAttendus:typeof degatsAttendus === "function"
    ? degatsAttendus
    : undefined,
  CIBLE_REFERENCE:typeof CIBLE_REFERENCE === "object"
    ? CIBLE_REFERENCE
    : undefined,
  CIBLES:typeof CIBLES === "object"
    ? CIBLES
    : undefined,
  calibrerConstante:typeof calibrerConstante === "function"
    ? calibrerConstante
    : undefined,
  CONSTANTE_PAR_DEFAUT:typeof CONSTANTE_PAR_DEFAUT === "number"
    ? CONSTANTE_PAR_DEFAUT
    : undefined,
  buffsApplicables:typeof buffsApplicables === "function"
    ? buffsApplicables
    : undefined,
  buffsDeLEquipe:typeof buffsDeLEquipe === "function"
    ? buffsDeLEquipe
    : undefined,
  passifsGravesApplicables:typeof passifsGravesApplicables === "function"
    ? passifsGravesApplicables
    : undefined,
  bonusCategorieDesBuffs:typeof bonusCategorieDesBuffs === "function"
    ? bonusCategorieDesBuffs
    : undefined,
  entreesDuCalcul:typeof entreesDuCalcul === "function"
    ? entreesDuCalcul
    : undefined,
  resultatsParCompetence:typeof resultatsParCompetence === "function"
    ? resultatsParCompetence
    : undefined,
  numericKeyboardInputProps:
    typeof numericKeyboardInputProps === "function"
      ? numericKeyboardInputProps
      : undefined,
  availabilityWeekStart:typeof availabilityWeekStart === "function"
    ? availabilityWeekStart
    : undefined,
  availabilityPreviousWeekStart:
    typeof availabilityPreviousWeekStart === "function"
      ? availabilityPreviousWeekStart
      : undefined,
  availabilitySlotIndex:typeof availabilitySlotIndex === "function"
    ? availabilitySlotIndex
    : undefined,
  availabilitySlotFromIndex:typeof availabilitySlotFromIndex === "function"
    ? availabilitySlotFromIndex
    : undefined,
  normalizeAvailabilityMask:typeof normalizeAvailabilityMask === "function"
    ? normalizeAvailabilityMask
    : undefined,
  availabilityMaskHas:typeof availabilityMaskHas === "function"
    ? availabilityMaskHas
    : undefined,
  availabilityMaskWith:typeof availabilityMaskWith === "function"
    ? availabilityMaskWith
    : undefined,
  applyAvailabilityRange:typeof applyAvailabilityRange === "function"
    ? applyAvailabilityRange
    : undefined,
  paintAvailabilityRectangle:typeof paintAvailabilityRectangle === "function"
    ? paintAvailabilityRectangle
    : undefined,
  aggregateAvailability:typeof aggregateAvailability === "function"
    ? aggregateAvailability
    : undefined,
  availabilityDensityTier:typeof availabilityDensityTier === "function"
    ? availabilityDensityTier
    : undefined,
  availabilitySlotMembers:typeof availabilitySlotMembers === "function"
    ? availabilitySlotMembers
    : undefined,
  staleAvailabilityWeeks:typeof staleAvailabilityWeeks === "function"
    ? staleAvailabilityWeeks
    : undefined,
  availabilityViewState:typeof availabilityViewState === "function"
    ? availabilityViewState
    : undefined,
  availabilityWeekLabel:typeof availabilityWeekLabel === "function"
    ? availabilityWeekLabel
    : undefined,
  availabilityToggleDay:typeof availabilityToggleDay === "function"
    ? availabilityToggleDay
    : undefined,
  availabilityToggleHour:typeof availabilityToggleHour === "function"
    ? availabilityToggleHour
    : undefined,
  shouldIgnoreAvailabilityEcho:
    typeof shouldIgnoreAvailabilityEcho === "function"
      ? shouldIgnoreAvailabilityEcho
      : undefined,
  availabilitySummary:typeof availabilitySummary === "function"
    ? availabilitySummary
    : undefined,
  rosterSummary:typeof rosterSummary === "function"
    ? rosterSummary
    : undefined,
  rosterSignature:typeof rosterSignature === "function"
    ? rosterSignature
    : undefined,
  /* Privee, exposee ici seule : elle porte la regle « le build juge est le
     favori », qu'un test passant par rosterSummary ne saurait distinguer sans
     fabriquer un build entierement valide.
     (Pas d'accent grave dans ce fichier : son contenu vit dans un gabarit de
     chaine, et un accent grave le refermerait.) */
  judgedWeaponType:typeof judgedWeaponType === "function"
    ? judgedWeaponType
    : undefined,
  normalizePotentiel,
  normalizeHero,
  normalizeTeam,
  normalizeBuildFields:typeof normalizeBuildFields === "function"
    ? normalizeBuildFields
    : undefined,
  teamBuildSnapshot:typeof teamBuildSnapshot === "function"
    ? teamBuildSnapshot
    : undefined,
  storeActiveHeroBuild:typeof storeActiveHeroBuild === "function"
    ? storeActiveHeroBuild
    : undefined,
  activateHeroBuild:typeof activateHeroBuild === "function"
    ? activateHeroBuild
    : undefined,
  applyCharacterChange:typeof applyCharacterChange === "function"
    ? applyCharacterChange
    : undefined,
  rosterEntryWithActiveHeroBuild:
    typeof rosterEntryWithActiveHeroBuild === "function"
      ? rosterEntryWithActiveHeroBuild
      : undefined,
  rosterBaselineIdentityMatches:
    typeof rosterBaselineIdentityMatches === "function"
      ? rosterBaselineIdentityMatches
      : undefined,
  rosterBaselineVersionMatches:
    typeof rosterBaselineVersionMatches === "function"
      ? rosterBaselineVersionMatches
      : undefined,
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
  buildWeaponDefinition:typeof buildWeaponDefinition === "function"
    ? buildWeaponDefinition
    : undefined,
  buildGearDefinition:typeof buildGearDefinition === "function"
    ? buildGearDefinition
    : undefined,
  emptyGearConfig:typeof emptyGearConfig === "function"
    ? emptyGearConfig
    : undefined,
  gearConfigStatus:typeof gearConfigStatus === "function"
    ? gearConfigStatus
    : undefined,
  GEAR_PASSIVE_MAX_LEVEL:typeof GEAR_PASSIVE_MAX_LEVEL === "number"
    ? GEAR_PASSIVE_MAX_LEVEL
    : undefined,
  WEAPON_PASSIVE_MAX_LEVEL:typeof WEAPON_PASSIVE_MAX_LEVEL === "number"
    ? WEAPON_PASSIVE_MAX_LEVEL
    : undefined,
  gearPassiveStatus:typeof gearPassiveStatus === "function"
    ? gearPassiveStatus
    : undefined,
  weaponPassiveFact:typeof weaponPassiveFact === "function"
    ? weaponPassiveFact
    : undefined,
  characterDefinitionForHero:typeof characterDefinitionForHero === "function"
    ? characterDefinitionForHero
    : undefined,
  characterBaseTerms:typeof characterBaseTerms === "function"
    ? characterBaseTerms
    : undefined,
  fullMasteryTerms:typeof fullMasteryTerms === "function"
    ? fullMasteryTerms
    : undefined,
  reserveMasteryTerms:typeof reserveMasteryTerms === "function"
    ? reserveMasteryTerms
    : undefined,
  potentialTerms:typeof potentialTerms === "function"
    ? potentialTerms
    : undefined,
  canonicalHeroTerm:typeof canonicalHeroTerm === "function"
    ? canonicalHeroTerm
    : undefined,
  HERO_MAIN_RATE_APPLICATION_MODE:
    typeof HERO_MAIN_RATE_APPLICATION_MODE === "string"
      ? HERO_MAIN_RATE_APPLICATION_MODE
      : undefined,
  heroMainRateTargetBuckets:typeof heroMainRateTargetBuckets === "function"
    ? heroMainRateTargetBuckets
    : undefined,
  SECONDARY_WEAPON_ATTACK_TRANSFER_RATE:
    typeof SECONDARY_WEAPON_ATTACK_TRANSFER_RATE === "number"
      ? SECONDARY_WEAPON_ATTACK_TRANSFER_RATE
      : undefined,
  SECONDARY_WEAPON_TRANSFER_APPLICATION_MODE:
    typeof SECONDARY_WEAPON_TRANSFER_APPLICATION_MODE === "string"
      ? SECONDARY_WEAPON_TRANSFER_APPLICATION_MODE
      : undefined,
  secondaryWeaponAttackResult:
    typeof secondaryWeaponAttackResult === "function"
      ? secondaryWeaponAttackResult
      : undefined,
  calculateHeroStats:typeof calculateHeroStats === "function"
    ? calculateHeroStats
    : undefined,
  heroTermOriginLabel:typeof heroTermOriginLabel === "function"
    ? heroTermOriginLabel
    : undefined,
  heroTermLabel:typeof heroTermLabel === "function"
    ? heroTermLabel
    : undefined,
  statTermGroups:typeof statTermGroups === "function"
    ? statTermGroups
    : undefined,
  statTermsDetails:typeof statTermsDetails === "function"
    ? statTermsDetails
    : undefined,
  heroTermValue:typeof heroTermValue === "function"
    ? heroTermValue
    : undefined,
  heroTermProvenance:typeof heroTermProvenance === "function"
    ? heroTermProvenance
    : undefined,
  weaponTermProvenance:typeof weaponTermProvenance === "function"
    ? weaponTermProvenance
    : undefined,
  heroStatsTitle:typeof heroStatsTitle === "function"
    ? heroStatsTitle
    : undefined,
  heroStatsGroups:typeof heroStatsGroups === "function"
    ? heroStatsGroups
    : undefined,
  heroStatsSection:typeof heroStatsSection === "function"
    ? heroStatsSection
    : undefined,
  ARMOR_LEVEL_ORIGIN_MODE:typeof ARMOR_LEVEL_ORIGIN_MODE === "string"
    ? ARMOR_LEVEL_ORIGIN_MODE
    : undefined,
  REINFORCE_PROGRESSION:typeof REINFORCE_PROGRESSION !== "undefined"
    ? REINFORCE_PROGRESSION
    : undefined,
  reinforceMultiplier:typeof reinforceMultiplier === "function"
    ? reinforceMultiplier
    : undefined,
  gearSegmentCount:typeof gearSegmentCount === "function"
    ? gearSegmentCount
    : undefined,
  gearSegmentIndex:typeof gearSegmentIndex === "function"
    ? gearSegmentIndex
    : undefined,
  gearLevelOrigin:typeof gearLevelOrigin === "function"
    ? gearLevelOrigin
    : undefined,
  gearStatValue:typeof gearStatValue === "function"
    ? gearStatValue
    : undefined,
  buildWeaponGrade:typeof buildWeaponGrade === "function"
    ? buildWeaponGrade
    : undefined,
  normalizeWeaponConfig:typeof normalizeWeaponConfig === "function"
    ? normalizeWeaponConfig
    : undefined,
  emptyWeaponConfig:typeof emptyWeaponConfig === "function"
    ? emptyWeaponConfig
    : undefined,
  weaponConfigStatus:typeof weaponConfigStatus === "function"
    ? weaponConfigStatus
    : undefined,
  weaponConfigSummary:typeof weaponConfigSummary === "function"
    ? weaponConfigSummary
    : undefined,
  curveValueAtLevel:typeof curveValueAtLevel === "function"
    ? curveValueAtLevel
    : undefined,
  promotionValueAt:typeof promotionValueAt === "function"
    ? promotionValueAt
    : undefined,
  buildStatsTitle:typeof buildStatsTitle === "function"
    ? buildStatsTitle
    : undefined,
  pearlSlotCount:typeof pearlSlotCount === "function"
    ? pearlSlotCount
    : undefined,
  pearlRequiredSlotCount:typeof pearlRequiredSlotCount === "function"
    ? pearlRequiredSlotCount
    : undefined,
  pearlTierLabel:typeof pearlTierLabel === "function"
    ? pearlTierLabel
    : undefined,
  enchantmentBounds:typeof enchantmentBounds === "function"
    ? enchantmentBounds
    : undefined,
  overlimitTargetBuckets:typeof overlimitTargetBuckets === "function"
    ? overlimitTargetBuckets
    : undefined,
  calculateWeaponStats:typeof calculateWeaponStats === "function"
    ? calculateWeaponStats
    : undefined,
  calculateGearStats:typeof calculateGearStats === "function"
    ? calculateGearStats
    : undefined,
  buildGearCatalog:typeof buildGearCatalog === "function"
    ? buildGearCatalog
    : undefined,
  buildGearSets:typeof buildGearSets === "function"
    ? buildGearSets
    : undefined,
  activeGearSets:typeof activeGearSets === "function"
    ? activeGearSets
    : undefined,
  gearSetTerms:typeof gearSetTerms === "function"
    ? gearSetTerms
    : undefined,
  calculateBuildStats:typeof calculateBuildStats === "function"
    ? calculateBuildStats
    : undefined,
  groupBuildTermsBySlot:typeof groupBuildTermsBySlot === "function"
    ? groupBuildTermsBySlot
    : undefined,
  orderedBuildEntries:typeof orderedBuildEntries === "function"
    ? orderedBuildEntries
    : undefined,
  randomRollsFor:typeof randomRollsFor === "function"
    ? randomRollsFor
    : undefined,
  fixedStatsOf:typeof fixedStatsOf === "function"
    ? fixedStatsOf
    : undefined,
  reconstructStatTotals:typeof reconstructStatTotals === "function"
    ? reconstructStatTotals
    : undefined,
  groupBuildStatResults:typeof groupBuildStatResults === "function"
    ? groupBuildStatResults
    : undefined,
  formatBuildStatValue:typeof formatBuildStatValue === "function"
    ? formatBuildStatValue
    : undefined,
  OVERLIMIT_APPLICATION_MODE:typeof OVERLIMIT_APPLICATION_MODE === "string"
    ? OVERLIMIT_APPLICATION_MODE
    : undefined,
  weaponLevelCap:typeof weaponLevelCap === "function"
    ? weaponLevelCap
    : undefined,
  applyWeaponChange:typeof applyWeaponChange === "function"
    ? applyWeaponChange
    : undefined,
  cloudRosterFromRow,
  rosterToCloudRow,
  replaceRosterCacheForOwner,
  MemberRosterStore,
  Store,
  dpsEntriesFromRoster,
  rosterPlayerFrom:typeof rosterPlayerFrom === "function"
    ? rosterPlayerFrom
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
    : undefined,
  armorSetsFrom:typeof armorSetsFrom === "function"
    ? armorSetsFrom
    : undefined,
  jewelSetsFrom:typeof jewelSetsFrom === "function"
    ? jewelSetsFrom
    : undefined
});})();`;

function testWeaponDefinition(gameId, base, percentOption){
  return {
    mainStat:"attack",
    mainStatCode:"B_Atk_Equip",
    passiveLevels:[],
    gradesByGameId:{
      [gameId]:{
        gameId,
        mainStatValues:{
          base,
          max:base + 50,
          progression:[1, 1, 1, 1, 1]
        },
        subStats:[],
        promotionSteps:[
          { reinforceMax:20 }, { reinforceMax:30 },
          { reinforceMax:40 }, { reinforceMax:50 }
        ],
        promotionValues:{ base:5, max:55, progression:[5, 10, 15, 20] },
        overlimit:{
          levels:[
            { level:0, passiveLevel:1, statRate:0 },
            { level:1, passiveLevel:2, statRate:500 }
          ]
        },
        enchantments:{
          type:"basic",
          slots:[10000],
          options:[
            { stat:"B_Atk_Equip", min:1, max:1000 },
            ...(percentOption
              ? [{ stat:"I_AtkAdd_Rate", min:1, max:5000 }]
              : [])
          ]
        }
      }
    }
  };
}

function loadApp(initialTeams){
  /* Depuis le lot 1 du refactor, le script principal vit dans js/app.js. Il
     sera découpé en plusieurs modules : MODULES tient l'ordre de concaténation,
     qui doit rester identique à l'ordre de chargement déclaré dans index.html. */
  const modules = MODULES
    .map(name => fs.readFileSync(path.join(ROOT, "js", name), "utf8"))
    .join("\n");
  /* La concaténation place tous les symboles dans une même portée : les
     déclarations de module n'y ont plus de sens et feraient échouer le `vm`,
     qui exécute un script classique et non un module. */
  const source = modules
    .replace(/^\s*import\s[\s\S]*?from\s+"[^"]*";\s*$/gm, "")
    .replace(/^\s*export\s+(?=(?:const|let|function|class)\s)/gm, "")
    .replace(/^\s*export\s*\{[\s\S]*?\}\s*;\s*$/gm, "");
  assert.ok(source.includes("(function(){"), "Le script principal doit exister");
  assert.ok(
    !/^\s*(?:import|export)\s/m.test(source),
    "Aucune déclaration de module ne doit survivre à la concaténation"
  );

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
      ]},
      // SR Attaquant : sert uniquement à prouver l'exclusion des SR de l'analyse DPS.
      bug:{ element:"DARK", role:"ATTACKER", rarity:"SR", weapons:[
        { weapon:"Axe", role:"Attacker", element:"Dark" },
        { weapon:"SwordDual", role:"Attacker", element:"Dark" },
        { weapon:"Book", role:"Supporter", element:"Dark" }
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
    },
    SEVEN_DS_BUILD_STATS:{
      version:1,
      statLabels:{
        B_Atk_Equip:{ fr:"Attaque de l'équipement", family:"main", unit:"flat" },
        I_AtkAdd_Rate:{ fr:"ATK", family:"main", unit:"ten-thousandths" },
        critRate:{ fr:"Chances crit.", family:"additional", unit:"ten-thousandths" }
      },
      weaponsByFile:{
        "7ds-armes/Hache/hache.webp":{
          mainStat:"attack",
          mainStatCode:"B_Atk_Equip",
          passiveLevels:Array.from({length:7}, (_, index) => ({
            level:index + 1,
            textFr:"Passif arme " + (index + 1)
          })),
          gradesByGameId:{
            "grade-axe":{
              gameId:"grade-axe",
              mainStatValues:{ base:10, max:60, progression:[1, 1, 1, 1, 1] },
              subStats:[{ stat:"critRate", values:{ base:20, max:70, progression:[1, 1, 1, 1, 1] } }],
              promotionSteps:[
                { reinforceMax:20 }, { reinforceMax:30 },
                { reinforceMax:40 }, { reinforceMax:50 }
              ],
              promotionValues:{ base:5, max:55, progression:[5, 10, 15, 20] },
              overlimit:{
                levels:[
                  { level:0, passiveLevel:1, statRate:0 },
                  { level:1, passiveLevel:2, statRate:500 }
                ]
              },
              enchantments:{
                type:"basic",
                slots:[5000],
                options:[{ stat:"critRate", min:10, max:20 }]
              }
            },
            "grade-sans-courbe":{
              gameId:"grade-sans-courbe",
              mainStatValues:null,
              subStats:[],
              enchantments:{
                type:"masterstone",
                tiers:[{ tier:1, options:[{ stat:"B_Atk_Equip", min:5, max:10 }] }]
              }
            }
          }
        },
        "7ds-armes/Epee 1 main/epee.webp":
          testWeaponDefinition("grade-sword", 100, true),
        "7ds-armes/Epees doubles/doubles.webp":
          testWeaponDefinition("grade-dual", 200, true)
      }
    }
  };
  const catalogSandbox = { window:{} };
  vm.runInNewContext(
    fs.readFileSync(path.join(ROOT, "data", "stats-build.js"), "utf8"),
    catalogSandbox,
    { filename:"stats-build.js" }
  );
  const realBuildStats = catalogSandbox.window.SEVEN_DS_BUILD_STATS;
  sandbox.SEVEN_DS_BUILD_STATS = {
    version:realBuildStats.version,
    statLabels:Object.assign(
      {},
      realBuildStats.statLabels,
      sandbox.SEVEN_DS_BUILD_STATS.statLabels
    ),
    weaponsByFile:Object.assign(
      {},
      realBuildStats.weaponsByFile,
      sandbox.SEVEN_DS_BUILD_STATS.weaponsByFile
    ),
    gearByFile:realBuildStats.gearByFile,
    engravedByFile:realBuildStats.engravedByFile,
    gearSets:realBuildStats.gearSets,
    charactersBySlug:realBuildStats.charactersBySlug
  };
  /* La table des buffs de soutien est ECRITE A LA MAIN : la doubler par une
     fixture ferait tester une invention plutot que le fichier livre. On charge
     donc la vraie, comme stats-build.js juste au-dessus. */
  const buffsSandbox = { window:{} };
  vm.runInNewContext(
    fs.readFileSync(path.join(ROOT, "data", "buffs-supports.js"), "utf8"),
    buffsSandbox,
    { filename:"buffs-supports.js" }
  );
  sandbox.SEVEN_DS_BUFFS_SUPPORTS = buffsSandbox.window.SEVEN_DS_BUFFS_SUPPORTS;
  /* Meme raison : la table des passifs graves est ecrite a la main, donc on
     charge la VRAIE plutot qu'une fixture qui testerait une invention. */
  const passifsSandbox = { window:{} };
  vm.runInNewContext(
    fs.readFileSync(path.join(ROOT, "data", "passifs-graves.js"), "utf8"),
    passifsSandbox,
    { filename:"passifs-graves.js" }
  );
  sandbox.SEVEN_DS_PASSIFS_GRAVES = passifsSandbox.window.SEVEN_DS_PASSIFS_GRAVES;
  sandbox.window = sandbox;
  /* Le bac a sable modelise un navigateur : il lui faut donc les points
     d'accroche globaux que le code utilise. Les dispos ecoutent `online` pour
     republier une saisie restee en echec ; sans ce stub, le simple chargement
     des modules jetait "window.addEventListener is not a function". */
  if(typeof sandbox.addEventListener !== "function"){
    sandbox.addEventListener = function(){};
    sandbox.removeEventListener = function(){};
  }
  vm.runInNewContext(exposed, sandbox, { filename:"index.html" });
  return { hooks:sandbox.__hooks, localStorage };
}

function plain(value){
  return JSON.parse(JSON.stringify(value));
}

module.exports = { loadApp, plain };
