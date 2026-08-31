"use strict";

/* CORRIGER UNE RUN DEJA TERMINEE.

   Une run se termine par un rapport, et la session passe en `archived`. A
   partir de la, les trois gestes de composition sont refuses : `RUN_ARCHIVED`
   pour le statut, `RUN_INVALID_WEEK` des que la semaine a tourne. C'est ce qui
   protege l'historique d'une modification distraite.

   Un administrateur doit pouvoir reparer : quelqu'un inscrit a la place d'un
   autre, une equipe posee sur la mauvaise ligne, un score mal recopie. Ce test
   lit le fichier que le proprietaire collera dans Supabase et verifie que la
   reparation LEVE EXACTEMENT CES DEUX VERROUS, et rien d'autre.

   C'est la tout l'enjeu. Un chemin de correction qui relacherait aussi les
   plafonds — cinq par groupe, trois runs par semaine, equipe reellement
   possedee — ne serait plus une reparation : ce serait une porte pour ecrire
   dans l'archive des groupes que le jeu n'a jamais permis. Les assertions
   ci-dessous exigent donc que les plafonds restent HORS du bloc relache. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sql = fs.readFileSync(
  path.resolve(__dirname, "..", "supabase", "schema.sql"),
  "utf8"
);

function corpsDeLaFonction(nom){
  const trouve = sql.match(new RegExp(
    "create or replace function " + nom.replace(".", "\\.")
      + "\\s*\\([\\s\\S]*?\\$\\$;",
    "i"
  ));
  return trouve ? trouve[0] : null;
}

/* Le bloc que `p_correction` relache : de `if not p_correction then` jusqu'au
   `end if;` de MEME INDENTATION. Les conditions internes en portent une plus
   grande, elles ne ferment donc pas le bloc. */
function blocRelache(corps){
  const trouve = corps.match(/if not p_correction then[\s\S]*?\r?\n {2}end if;/i);
  return trouve ? trouve[0] : null;
}

const GESTES = [
  {
    prive:"private.rejoindre_run",
    ancienneSignature:"private.rejoindre_run(uuid, uuid)",
    publique:"public.join_boss_run",
    admin:"public.admin_join_boss_run",
    correction:"public.admin_correct_boss_run_join",
    arguments:"uuid, uuid",
    delegation:"p_owner"
  },
  {
    prive:"private.quitter_run",
    ancienneSignature:"private.quitter_run(uuid, uuid)",
    publique:"public.leave_boss_run",
    admin:"public.admin_leave_boss_run",
    correction:"public.admin_correct_boss_run_leave",
    arguments:"uuid, uuid",
    delegation:"p_owner"
  },
  {
    prive:"private.choisir_equipe_run",
    ancienneSignature:"private.choisir_equipe_run(uuid, uuid, uuid)",
    publique:"public.select_boss_team",
    admin:"public.admin_select_boss_team",
    correction:"public.admin_correct_boss_run_team",
    arguments:"uuid, uuid, uuid",
    delegation:"p_owner, p_team_id"
  }
];

/* ---- L'ancienne signature est retiree avant d'etre redefinie. ---- */

/* `create or replace` ne sait pas ajouter un argument : sans ce retrait, le
   collage echouerait sur une base deja a jour du schema precedent. */
GESTES.forEach(geste => {
  assert.match(
    sql,
    new RegExp(
      "drop function if exists "
        + geste.ancienneSignature.replace(/[.()]/g, "\\$&"),
      "i"
    ),
    geste.prive + " : l'ancienne signature doit etre retiree avant le create"
  );
});

/* ---- Les trois fonctions privees recoivent le drapeau de correction. ---- */

GESTES.forEach(geste => {
  const corps = corpsDeLaFonction(geste.prive);
  assert.ok(corps, geste.prive + " doit exister");
  assert.match(
    corps,
    /p_correction boolean/i,
    geste.prive + " doit recevoir le drapeau de correction en argument"
  );

  const bloc = blocRelache(corps);
  assert.ok(
    bloc,
    geste.prive + " doit rassembler les verrous relachables dans un seul bloc"
  );

  /* Les deux verrous d'une run terminee vivent DANS le bloc. */
  assert.match(
    bloc,
    /RUN_INVALID_WEEK/,
    geste.prive + " : le verrou de semaine doit etre relachable"
  );
  assert.match(
    bloc,
    /RUN_ARCHIVED/,
    geste.prive + " : le verrou d'archive doit etre relachable"
  );

  /* Et nulle part ailleurs dans la fonction : un second exemplaire hors du
     bloc rendrait la correction impossible sans qu'on comprenne pourquoi.

     `RUN_INVALID_WEEK` se leve a deux titres — une session sans semaine, et une
     semaine qui n'est pas la courante — et seul le second est relachable. On
     compte donc la COMPARAISON, pas le code d'erreur. */
  assert.equal(
    (corps.match(/private\.current_boss_week_start\(\)/g) || []).length, 1,
    geste.prive + " : la comparaison de semaine ne doit exister qu'une fois"
  );
  assert.equal(
    (corps.match(/raise exception 'RUN_ARCHIVED'/g) || []).length, 1,
    geste.prive + " : RUN_ARCHIVED ne doit etre levee qu'une fois"
  );

  /* CE QUE LE BLOC NE DOIT PAS CONTENIR. Une regle du jeu qui y tomberait
     deviendrait contournable par la porte de correction. */
  [
    "MEMBRE_REQUIS",
    "RUN_NOT_FOUND",
    "GROUP_FULL",
    "RUN_LIMIT_REACHED",
    "TEAM_NOT_OWNED",
    "NOT_A_PARTICIPANT"
  ].forEach(jeton => {
    assert.equal(
      new RegExp(jeton).test(bloc), false,
      geste.prive + " : " + jeton + " ne doit pas etre relachee par une correction"
    );
  });

  /* Le bloc n'ecrit rien : il ne fait que refuser. */
  assert.equal(
    /\b(?:insert|update|delete)\b/i.test(bloc), false,
    geste.prive + " : le bloc relachable ne doit rien ecrire"
  );

  /* `week_start` absent reste un refus, correction ou non : une session sans
     semaine est une donnee cassee, pas une run a reparer. */
  const avantLeBloc = corps.slice(0, corps.indexOf(bloc));
  assert.match(
    avantLeBloc,
    /if v_week is null then\s*\r?\n\s*raise exception 'RUN_INVALID_WEEK'/i,
    geste.prive + " : une session sans semaine doit rester refusee"
  );
});

/* ---- Les gestes ordinaires ne corrigent rien. ---- */

/* Le membre et l'administrateur qui composent un groupe VIVANT passent `false`.
   Un `true` egare ici ouvrirait l'archive au geste le plus frequent du site. */
GESTES.forEach(geste => {
  [geste.publique, geste.admin].forEach(nom => {
    const corps = corpsDeLaFonction(nom);
    assert.ok(corps, nom + " doit rester en place");
    assert.match(
      corps,
      new RegExp(
        geste.prive.replace(".", "\\.") + "\\s*\\([^)]*(?:\\)[^;]*)?,\\s*false\\s*\\)",
        "i"
      ),
      nom + " doit passer false : ce geste n'agit que sur une run ouverte"
    );
  });
});

/* ---- Les trois portes de correction. ---- */

GESTES.forEach(geste => {
  const corps = corpsDeLaFonction(geste.correction);
  assert.ok(corps, geste.correction + " doit exister");

  assert.match(
    corps,
    /private\.est_admin\s*\(\s*auth\.uid\(\)\s*\)/i,
    geste.correction + " doit exiger que l'APPELANT soit administrateur"
  );
  assert.match(
    corps,
    /ADMIN_REQUIS/,
    geste.correction + " doit refuser par ADMIN_REQUIS"
  );
  assert.match(
    corps,
    /if p_owner is null then[\s\S]*?MEMBRE_REQUIS/i,
    geste.correction + " doit nommer quelqu'un, comme les autres portes admin"
  );

  /* Elle delegue, elle ne recopie pas : c'est ce qui garantit que les plafonds
     s'appliquent aussi a une correction. */
  const delegation = new RegExp(
    geste.prive.replace(".", "\\.")
      + "\\s*\\(\\s*p_session_id\\s*,\\s*"
      + geste.delegation.replace(/,\s*/g, "\\s*,\\s*")
      + "\\s*,\\s*true\\s*\\)",
    "i"
  );
  assert.match(
    corps, delegation,
    geste.correction + " doit deleguer a " + geste.prive + " avec true"
  );

  assert.ok(
    corps.search(/est_admin/i) < corps.search(
      new RegExp(geste.prive.replace(".", "\\."), "i")
    ),
    geste.correction + " doit verifier le droit AVANT d'agir"
  );

  /* Aucune ecriture propre : tout passe par la fonction privee. */
  assert.equal(
    /\b(?:insert into|delete from)\b|\bupdate public\./i.test(corps), false,
    geste.correction + " ne doit ecrire dans aucune table elle-meme"
  );
});

/* ---- Les droits d'execution des portes de correction. ---- */

GESTES.forEach(geste => {
  const nom = geste.correction.replace("public.", "");
  assert.match(
    sql,
    new RegExp(
      "revoke all on function public\\." + nom + "\\([^)]*\\) from public", "i"
    ),
    nom + " ne doit pas etre executable par `public`"
  );
  assert.match(
    sql,
    new RegExp(
      "grant execute on function public\\." + nom + "\\([^)]*\\) to authenticated",
      "i"
    ),
    nom + " doit etre ouverte aux comptes connectes — le garde fait le tri"
  );
});

/* ---- Le rapport : un administrateur corrige celui des autres. ---- */

const updateReport = corpsDeLaFonction("public.update_boss_run_report");
assert.ok(updateReport, "update_boss_run_report doit exister");
assert.match(
  updateReport,
  /private\.est_admin\s*\(\s*v_owner\s*\)/i,
  "update_boss_run_report doit accepter un administrateur non participant"
);
assert.match(
  updateReport,
  /NOT_A_PARTICIPANT/,
  "update_boss_run_report doit toujours refuser un membre etranger a la run"
);
assert.ok(
  updateReport.search(/est_admin/i) < updateReport.search(/NOT_A_PARTICIPANT/),
  "le droit d'administrateur doit etre lu avant le refus"
);
/* Le reste du garde ne bouge pas : on corrige un rapport ecrit, sur une run
   terminee, avec un score valide. */
assert.match(
  updateReport,
  /v_run_status <> 'archived'/i,
  "update_boss_run_report ne doit pas devenir un moyen d'ecrire sur une run ouverte"
);
assert.match(
  updateReport,
  /REPORT_NOT_FOUND/,
  "update_boss_run_report ne doit corriger qu'un rapport existant"
);

console.log(
  "PASS boss-correction : une run terminee se repare sans que le jeu plie"
);
