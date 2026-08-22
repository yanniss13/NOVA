"use strict";

const assert = require("node:assert/strict");
const { loadApp, plain } = require("./helpers/load-app");

const { hooks } = loadApp();
const {
  dashboardDeadlineStatus,
  buildDashboardState
} = hooks;

const weekStart = "2026-07-27";
const openRun = {
  id:"run-open",
  title:"Groupe 2",
  week_start:weekStart,
  slot:2,
  run_no:1,
  status:"open",
  completed_at:null
};
const archivedRun = {
  id:"run-archived",
  title:"Groupe 4",
  week_start:weekStart,
  slot:4,
  run_no:1,
  status:"archived",
  completed_at:"2026-07-30T20:00:00.000Z"
};
const foreignRun = {
  id:"run-old",
  title:"Groupe 1",
  week_start:"2026-07-20",
  slot:1,
  run_no:3,
  status:"archived",
  completed_at:"2026-07-26T10:00:00.000Z"
};

{
  const state = plain(buildDashboardState({
    userId:"user-1",
    weekStart,
    sessions:[openRun, archivedRun, foreignRun],
    membership:[
      {
        session_id:"run-open",
        owner:"user-1",
        pseudo:"Yannis",
        team_snapshot:null
      },
      {
        session_id:"run-open",
        owner:"user-1",
        pseudo:"Doublon",
        team_snapshot:null
      },
      {
        session_id:"run-open",
        owner:"user-2",
        pseudo:"Merlin",
        team_snapshot:{ id:"other-team" }
      },
      {
        session_id:"run-archived",
        owner:"user-1",
        pseudo:"Yannis",
        team_snapshot:{ id:"team-own" }
      },
      {
        session_id:"run-old",
        owner:"user-1",
        pseudo:"Yannis",
        team_snapshot:{ id:"old-team" }
      }
    ],
    reports:[{
      session_id:"run-archived",
      global_score:"9007199254740991",
      note:"Rapport exact"
    }],
    teams:[{ id:"team-own", owner:"user-1" }, { id:"other", owner:"user-2" }],
    now:new Date("2026-07-31T12:00:00.000Z"),
    lastSyncedAt:1234,
    offline:false
  }));

  assert.equal(state.engaged, 2);
  assert.equal(state.completed, 1);
  assert.equal(state.open, 1);
  assert.equal(state.remaining, 1);
  assert.deepEqual(
    state.actions.map(action => action.type),
    ["choose-team", "find-group", "edit-report"]
  );
  assert.equal(state.groups.find(group => group.id === "run-open").memberCount, 3);
  assert.equal(
    state.groups.find(group => group.id === "run-archived").report.globalScore,
    "9007199254740991"
  );
  assert.equal(state.groups.some(group => group.id === "run-old"), false);
}

{
  const state = plain(buildDashboardState({
    userId:"user-1",
    weekStart,
    sessions:[
      openRun,
      Object.assign({}, archivedRun, { id:"run-2" }),
      Object.assign({}, archivedRun, { id:"run-3", slot:5 })
    ],
    membership:[
      { session_id:"run-open", owner:"user-1", team_snapshot:{} },
      { session_id:"run-2", owner:"user-1", team_snapshot:{} },
      { session_id:"run-3", owner:"user-1", team_snapshot:{} }
    ],
    reports:[],
    teams:[],
    now:new Date("2026-08-02T11:00:00.000Z")
  }));
  assert.equal(state.engaged, 3);
  assert.equal(state.remaining, 0);
  assert.equal(state.deadlineStatus.level, "complete");
  assert.equal(state.actions[0].type, "view-group");
  assert.equal(state.actions.some(action => action.type === "find-group"), false);
}

{
  const noTeam = plain(buildDashboardState({
    userId:"user-1",
    weekStart,
    sessions:[openRun],
    membership:[{ session_id:"run-open", owner:"user-1", team_snapshot:null }],
    reports:[],
    teams:[],
    now:new Date("2026-07-31T12:00:00.000Z")
  }));
  assert.equal(noTeam.actions[0].type, "create-team");
}

assert.equal(
  dashboardDeadlineStatus(
    new Date("2026-07-31T12:00:00.000Z"),
    2
  ).level,
  "neutral"
);
assert.equal(
  dashboardDeadlineStatus(
    new Date("2026-08-01T10:00:00.000Z"),
    2
  ).level,
  "warning"
);
assert.equal(
  dashboardDeadlineStatus(
    new Date("2026-08-02T09:59:00.000Z"),
    2
  ).level,
  "warning"
);
assert.equal(
  dashboardDeadlineStatus(
    new Date("2026-08-02T10:00:00.000Z"),
    2
  ).level,
  "urgent"
);
assert.equal(
  dashboardDeadlineStatus(
    new Date("2026-08-03T06:59:00.000Z"),
    2
  ).level,
  "urgent"
);
assert.equal(
  dashboardDeadlineStatus(
    new Date("2026-08-03T07:00:00.000Z"),
    2
  ).level,
  "neutral"
);
assert.equal(
  dashboardDeadlineStatus(
    new Date("2026-08-03T07:00:00.000Z"),
    0
  ).level,
  "complete"
);

/* Cache strictement cloisonné par compte et par semaine, et refusant une
   enveloppe d'une autre version de format. */
{
  const { hooks:cacheHooks, localStorage } = loadApp();
  const cached = {
    weekStart:"2026-07-27",
    engaged:2,
    completed:1,
    open:1,
    remaining:1,
    groups:[{
      id:"run-archived",
      report:{ globalScore:"9007199254740991", note:"Exact" }
    }],
    actions:[],
    deadlineStatus:{ level:"neutral", label:"Reset lundi 9 h", remaining:1 },
    lastSyncedAt:1234,
    offline:false
  };
  cacheHooks.writeDashboardCache("user-1", cached);
  assert.equal(
    cacheHooks.readDashboardCache("user-1", "2026-07-27")
      .groups[0].report.globalScore,
    "9007199254740991"
  );
  // Un cache relu est toujours signalé comme potentiellement ancien.
  assert.equal(
    cacheHooks.readDashboardCache("user-1", "2026-07-27").offline,
    true
  );
  assert.equal(
    cacheHooks.readDashboardCache("user-2", "2026-07-27"),
    null
  );
  assert.equal(
    cacheHooks.readDashboardCache("user-1", "2026-08-03"),
    null
  );
  localStorage.setItem(
    cacheHooks.dashboardCacheKey("user-1", "2026-07-27"),
    JSON.stringify({ version:999, userId:"user-1", weekStart:"2026-07-27" })
  );
  assert.equal(
    cacheHooks.readDashboardCache("user-1", "2026-07-27"),
    null
  );
}


/* La carte de chronometrage : la seule porte du site vers l'outil de mesure.
   Elle est testee sans reseau — le fichier d'avancement est fourni ici. */
{
  const { chronoCarte } = hooks;
  assert.equal(
    typeof chronoCarte,
    "function",
    "le rendu de la carte de chronometrage doit rester isolable"
  );

  const texte = noeud => {
    if(noeud === null || noeud === undefined) return "";
    if(typeof noeud === "string") return noeud;
    return String(noeud.textContent || "")
      + (Array.isArray(noeud.children) ? noeud.children.map(texte).join("") : "");
  };

  const carte = chronoCarte({
    total:335,
    mesurees:0,
    debloquent:76,
    affinent:184,
    releves:75,
    prochaines:[{
      gameId:"klotho_staff_normalatk_enchant_ready",
      heros:"klotho",
      arme:"Bâton",
      nom:"Projection dimensionnelle",
      categorie:"Attaque normale",
      touche:"clic gauche",
      role:"debloque"
    }]
  });
  const lu = texte(carte);
  assert.match(lu, /0 \/ 335 animations mesurées/);
  assert.match(lu, /76 compétences sans recharge deviennent calculables avec leur mesure/);
  assert.match(lu, /75 compétences de relève attendent une simulation d’équipe/);
  assert.match(lu, /Projection dimensionnelle/);

  const lien = (carte.children || []).find(noeud => noeud.tag === "a");
  assert.ok(lien, "la carte doit porter le lien vers l'outil");
  assert.equal(lien.href, "outils/chrono-animation.html");
  assert.equal(lien.target, "_blank");
  assert.equal(lien.rel, "noopener");

  const lireChrono = compteurs => texte(chronoCarte(Object.assign({
    total:335,
    mesurees:0,
    prochaines:[]
  }, compteurs)));
  const clauses = {
    debloque:/compétences sans recharge deviennent calculables avec leur mesure/,
    affine:/calculs existants sont affinés/,
    releve:/compétences de relève attendent une simulation d’équipe/
  };

  /* Les anciens caches ne publient que le premier compteur. Les deux groupes
     ajoutés ne doivent ni apparaître, ni interpoler une valeur absente. */
  const ancienCache = lireChrono({ debloquent:8 });
  assert.match(ancienCache, /8 compétences sans recharge deviennent calculables avec leur mesure/);
  assert.doesNotMatch(ancienCache, clauses.affine);
  assert.doesNotMatch(ancienCache, clauses.releve);
  assert.doesNotMatch(ancienCache, /undefined/);

  [
    ["debloque", { debloquent:7, affinent:0, releves:0 }],
    ["affine", { debloquent:0, affinent:8, releves:0 }],
    ["releve", { debloquent:0, affinent:0, releves:9 }]
  ].forEach(([seuleClause, compteurs]) => {
    const lu = lireChrono(compteurs);
    Object.entries(clauses).forEach(([nom, clause]) => {
      assert.equal(clause.test(lu), nom === seuleClause,
        "seule la clause "+seuleClause+" est rendue");
    });
  });

  const deuxClauses = lireChrono({ debloquent:2, affinent:3, releves:0 });
  assert.match(deuxClauses,
    /2 compétences sans recharge deviennent calculables avec leur mesure ; 3 calculs existants sont affinés\./);
  assert.doesNotMatch(deuxClauses, /  |\.\./);

  [
    [{ debloquent:2, affinent:0, releves:5 },
      /2 compétences sans recharge deviennent calculables avec leur mesure\. 5 compétences de relève attendent une simulation d’équipe/],
    [{ debloquent:0, affinent:3, releves:5 },
      /3 calculs existants sont affinés\. 5 compétences de relève attendent une simulation d’équipe/],
    [{ debloquent:2, affinent:3, releves:5 },
      /2 compétences sans recharge deviennent calculables avec leur mesure ; 3 calculs existants sont affinés\. 5 compétences de relève attendent une simulation d’équipe/]
  ].forEach(([compteurs, attendu]) => {
    const lu = lireChrono(compteurs);
    assert.match(lu, attendu,
      "la relève commence une nouvelle phrase après les calculs");
    assert.doesNotMatch(lu, /; 5 compétences de relève/,
      "la relève ne rejoint jamais les clauses de calcul");
  });

  const aucunCompteur = lireChrono({ debloquent:0, affinent:0, releves:0 });
  assert.match(aucunCompteur, /Aucune source publique ne publie ces durées\./);
  assert.doesNotMatch(aucunCompteur, /undefined|NaN|compétences sans recharge|calculs existants|compétences de relève/);

  /* Un travail fini n'a pas de carte : la meme regle que les trois cartes
     d'accueil, qu'un « 0 » affiche rendrait bruyantes. */
  assert.equal(chronoCarte({ total:335, mesurees:335, prochaines:[] }), null);
  assert.equal(chronoCarte({ total:0, mesurees:0, prochaines:[] }), null);
}

console.log("PASS Mon suivi : compteurs, priorités, échéances et cache");
