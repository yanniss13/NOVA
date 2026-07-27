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

console.log("PASS Mon suivi : compteurs, priorités, échéances et cache");
