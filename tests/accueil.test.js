"use strict";

const assert = require("node:assert/strict");
/* `plain` est indispensable : les objets renvoyes naissent dans le bac a sable
   `vm`, donc avec un autre Object.prototype que celui du test. deepStrictEqual
   compare les prototypes et echouerait sur des valeurs pourtant identiques. */
const { loadApp, plain } = require("./helpers/load-app");

const { hooks } = loadApp();
const { availabilitySummary, rosterSummary, judgedWeaponType } = hooks;

const VIDE = "0".repeat(168);
function masqueAvec(...indexes){
  const cases = VIDE.split("");
  indexes.forEach(index => { cases[index] = "1"; });
  return cases.join("");
}

/* LECTURE INDISPONIBLE : `null`, jamais un resume vide.

   Annoncer « tes dispos ne sont pas posees » parce que la requete a echoue
   pousserait le membre a refaire un travail deja fait. La carte doit
   disparaitre, donc le resume doit pouvoir dire « je ne sais pas ». */
assert.strictEqual(availabilitySummary({ rows:null, userId:"moi" }), null);
assert.strictEqual(availabilitySummary({ rows:undefined, userId:"moi" }), null);
assert.strictEqual(availabilitySummary(), null);
assert.strictEqual(rosterSummary({ characters:null }), null);
assert.strictEqual(rosterSummary(), null);

/* SEMAINE VIDE : personne n'a rien pose. C'est une donnee, pas une absence. */
{
  const resume = availabilitySummary({ rows:[], userId:"moi" });
  assert.strictEqual(resume.mine.posed, false);
  assert.strictEqual(resume.mine.count, 0);
  assert.strictEqual(resume.best, null);
}

/* MES CRENEAUX : seules mes lignes comptent pour `mine`. */
{
  const resume = availabilitySummary({
    userId:"moi",
    rows:[
      { owner:"moi", slots:masqueAvec(0, 1, 2) },
      { owner:"autre", slots:masqueAvec(0, 1, 2, 3, 4) }
    ]
  });
  assert.strictEqual(resume.mine.posed, true);
  assert.strictEqual(
    resume.mine.count, 3,
    "Le decompte ne doit compter que MES creneaux"
  );
}

/* CRENEAU FORT : le plus peuple, tous membres confondus. L'index 25 vaut
   mardi 1h (index = jour * 24 + heure), et il est le seul a reunir deux
   membres. */
{
  const resume = availabilitySummary({
    userId:"moi",
    rows:[
      { owner:"moi", slots:masqueAvec(25) },
      { owner:"autre", slots:masqueAvec(25, 30) }
    ]
  });
  assert.deepStrictEqual(
    { day:resume.best.day, hour:resume.best.hour, count:resume.best.count },
    { day:1, hour:1, count:2 }
  );
}

/* Un membre sans ligne du tout n'a rien pose, mais la semaine reste lisible. */
{
  const resume = availabilitySummary({
    userId:"absent",
    rows:[{ owner:"autre", slots:masqueAvec(10) }]
  });
  assert.strictEqual(resume.mine.posed, false);
  assert.strictEqual(resume.best.count, 1);
}

/* ROSTER : le build JUGE est le favori.

   Merlin porte trois types d'arme (Livre, Baton, Baguette). Un membre qui
   garde volontairement un build alternatif a moitie rempli ne doit PAS etre
   signale : c'est son favori qui fait foi. */
{
  assert.deepStrictEqual(plain(rosterSummary({ characters:[] })), { toComplete:0 });

  /* Aucun build du tout -> a completer. */
  assert.deepStrictEqual(
    plain(rosterSummary({
      characters:[{ owner:"moi", charId:"merlin", builds:{} }]
    })),
    { toComplete:1 }
  );

  /* Un build sans arme -> a completer. */
  assert.deepStrictEqual(
    plain(rosterSummary({
      characters:[{
        owner:"moi", charId:"merlin",
        builds:{ Livre:{ favorite:true } }
      }]
    })),
    { toComplete:1 }
  );

  /* Une entree que le catalogue ne reconnait pas -> a completer, jamais une
     exception : le tableau de bord ne doit pas tomber sur une donnee vieillie. */
  assert.deepStrictEqual(
    plain(rosterSummary({
      characters:[{ owner:"moi", charId:"personnage-inconnu" }]
    })),
    { toComplete:1 }
  );
}

/* LE BUILD JUGE : le favori, pas le premier declare.

   C'est la seule regle inventee pour l'accueil, donc celle qui merite le plus
   d'etre fixee. Elle se teste ici et non a travers `rosterSummary` : ce dernier
   ne renvoie qu'un decompte, et deux builds invalides y donnent le meme
   resultat. Les distinguer exigerait un build entierement valide — arme,
   cinq armures dont une gravee, trois bijoux et leurs neuf configurations —
   soit un cout sans rapport avec ce qu'on verifie.

   Merlin declare ses armes dans l'ordre Livre, Baton, Baguette. */
{
  assert.strictEqual(
    judgedWeaponType({
      owner:"moi", charId:"merlin",
      builds:{ Livre:{}, Baguette:{ favorite:true } }
    }),
    "Baguette",
    "Le favori l'emporte sur le premier build declare"
  );

  /* Sans favori, le premier declare — deterministe parce que
     `normalizeRosterCharacter` pose les cles dans l'ordre de weaponTypesOf. */
  assert.strictEqual(
    judgedWeaponType({
      owner:"moi", charId:"merlin",
      builds:{ Baguette:{}, Baton:{} }
    }),
    "Baton",
    "Sans favori, l'ordre du catalogue tranche, pas celui de l'objet recu"
  );

  assert.strictEqual(
    judgedWeaponType({ owner:"moi", charId:"merlin", builds:{} }),
    null
  );
  assert.strictEqual(
    judgedWeaponType({ owner:"moi", charId:"personnage-inconnu" }),
    null
  );
}

console.log("accueil.test.js OK");
