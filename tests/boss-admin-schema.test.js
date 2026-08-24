"use strict";

/* Le droit d'un administrateur d'agir SUR LE GROUPE D'UN AUTRE vit dans le SQL,
   et nulle part ailleurs. Ce test ne parle à aucun serveur : il lit le fichier
   que le propriétaire collera dans Supabase.

   Il compte plus que les tests d'interface : masquer un bouton est une
   politesse, refuser un appel RPC est la seule barrière réelle. Un membre qui
   appellerait `admin_join_boss_run` depuis la console doit être renvoyé.

   Ce que ce test protège surtout, c'est le REGROUPEMENT des règles. Les trois
   gestes portent chacun une quarantaine de lignes de conditions — semaine
   courante, session ouverte, groupe à cinq, trois runs par semaine. Recopiées
   dans une variante « admin », elles divergeraient au premier correctif : on
   corrigerait la règle du membre en laissant celle de l'admin en arrière. Les
   assertions ci-dessous exigent donc qu'elles n'existent qu'en un seul
   exemplaire, dans les fonctions privées. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sql = fs.readFileSync(
  path.resolve(__dirname, "..", "supabase", "schema.sql"),
  "utf8"
);

/* Le corps d'une fonction, depuis sa déclaration jusqu'au `$$;` qui la ferme.
   Les corps PL/pgSQL de ce schéma sont tous délimités par `$$`. */
function corpsDeLaFonction(nom){
  const trouve = sql.match(new RegExp(
    "create or replace function " + nom.replace(".", "\\.")
      + "\\s*\\([\\s\\S]*?\\$\\$;",
    "i"
  ));
  return trouve ? trouve[0] : null;
}

/* ---- Les trois gestes ont une version privée qui prend le propriétaire. ---- */

const GESTES = [
  { prive:"private.rejoindre_run",     publique:"public.join_boss_run",
    admin:"public.admin_join_boss_run" },
  { prive:"private.quitter_run",       publique:"public.leave_boss_run",
    admin:"public.admin_leave_boss_run" },
  { prive:"private.choisir_equipe_run", publique:"public.select_boss_team",
    admin:"public.admin_select_boss_team" }
];

GESTES.forEach(geste => {
  const prive = corpsDeLaFonction(geste.prive);
  assert.ok(prive, geste.prive + " doit exister : c'est là que vivent les règles");
  assert.match(
    prive,
    /p_owner uuid/i,
    geste.prive + " doit recevoir le propriétaire en argument, pas le déduire"
  );
  assert.equal(
    /auth\.uid\(\)/i.test(prive),
    false,
    geste.prive + " ne doit jamais lire auth.uid() : elle sert deux appelants"
  );
});

/* ---- L'entrée du membre : son propre identifiant, et rien d'autre. ---- */

GESTES.forEach(geste => {
  const publique = corpsDeLaFonction(geste.publique);
  assert.ok(publique, geste.publique + " doit rester en place");
  assert.match(
    publique,
    new RegExp(geste.prive.replace(".", "\\.") + "\\s*\\(", "i"),
    geste.publique + " doit déléguer à " + geste.prive
  );
  assert.match(
    publique,
    /auth\.uid\(\)/i,
    geste.publique + " agit pour l'appelant : elle doit passer auth.uid()"
  );
});

/* ---- L'entrée de l'administrateur, et son garde. ---- */

GESTES.forEach(geste => {
  const admin = corpsDeLaFonction(geste.admin);
  assert.ok(admin, geste.admin + " doit exister");
  assert.match(
    admin,
    /private\.est_admin\s*\(\s*auth\.uid\(\)\s*\)/i,
    geste.admin + " doit exiger que l'APPELANT soit administrateur"
  );
  assert.match(
    admin,
    /ADMIN_REQUIS/,
    geste.admin + " doit refuser par ADMIN_REQUIS, comme le reste du site"
  );
  assert.match(
    admin,
    new RegExp(geste.prive.replace(".", "\\.") + "\\s*\\(", "i"),
    geste.admin + " doit déléguer à " + geste.prive + ", jamais recopier les règles"
  );
  /* Le garde doit précéder le geste. Une vérification posée après l'insertion
     ne protégerait rien. */
  assert.ok(
    admin.search(/est_admin/i) < admin.search(
      new RegExp(geste.prive.replace(".", "\\."), "i")
    ),
    geste.admin + " doit vérifier le droit AVANT d'agir"
  );
});

/* ---- Les règles du jeu ne sont écrites qu'une fois. ---- */

/* `GROUP_FULL` et `RUN_LIMIT_REACHED` sont les deux plafonds du boss. Ils
   doivent vivre dans la fonction privée et nulle part ailleurs : c'est la
   preuve qu'un administrateur ne dispose pas d'un chemin qui les ignore. */
[
  { jeton:"GROUP_FULL", prive:"private.rejoindre_run" },
  { jeton:"RUN_LIMIT_REACHED", prive:"private.rejoindre_run" },
  { jeton:"TEAM_NOT_OWNED", prive:"private.choisir_equipe_run" }
].forEach(regle => {
  /* On compte les REFUS, pas les mentions : un commentaire qui explique la
     règle ne la duplique pas, alors qu'un second `raise` la ferait vivre à
     deux endroits qui finiraient par diverger. */
  const occurrences = (sql.match(
    new RegExp("raise exception '" + regle.jeton + "'", "g")
  ) || []).length;
  assert.equal(
    occurrences, 1,
    regle.jeton + " ne doit être levée qu'à un seul endroit : "
      + "un second exemplaire finirait par diverger du premier"
  );
  const prive = corpsDeLaFonction(regle.prive);
  assert.match(
    prive, new RegExp(regle.jeton),
    regle.jeton + " doit vivre dans " + regle.prive
  );
});

/* ---- Les droits d'exécution. ---- */

GESTES.forEach(geste => {
  const nom = geste.admin.replace("public.", "");
  assert.match(
    sql,
    new RegExp("revoke all on function public\\." + nom + "\\([^)]*\\) from public", "i"),
    nom + " ne doit pas être exécutable par `public`"
  );
  assert.match(
    sql,
    new RegExp("grant execute on function public\\." + nom + "\\([^)]*\\) to authenticated", "i"),
    nom + " doit être ouverte aux comptes connectés — le garde fait le tri"
  );
});

/* Les fonctions privées ne s'appellent pas depuis une session : le schéma
   révoque déjà tout sur le schéma `private`, mais l'oubli serait grave. */
GESTES.forEach(geste => {
  const nom = geste.prive.replace("private.", "");
  assert.equal(
    new RegExp("grant execute on function private\\." + nom, "i").test(sql),
    false,
    nom + " ne doit jamais être accordée à un rôle de session"
  );
});

console.log("PASS boss-admin : un administrateur compose un groupe sans plier les règles");
